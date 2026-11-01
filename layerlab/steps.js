// LayerLab · движок шагов (набор kind: "steps").
// Шаг собирается из компонентов, как в BOOM Virtual Foley Artist: пятка (Heel) → носок (Tip) → отрыв (Rel),
// по желанию скольжение (Slide Short/Normal/Long), лестница (Stairs), плюс аксессуары обуви (ткань, кожа, металл)
// и обобщённая поверхность (листья, снег, вода, дребезг металла, скрип досок). Три зоны силы удара, round-robin.
// Макросы приходят из app.js через Steps.setParams(set, params): params[компонент].gain и params.global.*

const Steps = (() => {
  const RR_LIMIT = 8;              // вариантов на зону при загрузке (всего их до 30)
  const LIB = '/vfa/';             // смонтировано в serve.py → mounts.json (абсолютный путь: страница лежит в /layerlab/)

  // ---------- компоненты шага ----------
  const COMPONENTS = [
    { id: 'heel',    name: 'пятка',            gain: 80 },
    { id: 'tip',     name: 'носок',            gain: 80 },
    { id: 'rel',     name: 'отрыв (шарканье)', gain: 70 },
    { id: 'slide',   name: 'скольжение',       gain: 75 },
    { id: 'stairs',  name: 'лестница',         gain: 80 },
    { id: 'generic', name: 'доп. поверхность', gain: 70 },
    { id: 'acc1',    name: 'аксессуар 1',      gain: 80 },
    { id: 'acc2',    name: 'аксессуар 2',      gain: 80 },
  ];

  // Обобщённые поверхности и доп. слои: откуда брать пятку/носок/отрыв. sides=true → подпапки Left/Right.
  const GENERICS = {
    none:        { name: 'нет' },
    leaves:      { name: 'листва',            folder: 'Generic 01 Leaves 01', sub: 'Leaves Left and Right Shoe', heel: 'Heel', tip: 'Tip', rel: 'Rel' },
    snow:        { name: 'снег',              folder: 'Generic 01 Snow 01',   sides: true, heel: 'Heel', tip: 'Tip', rel: 'Rel' },
    water:       { name: 'вода',              folder: 'Generic 01 Water 01',  sub: 'Water Left and Right Shoe', heel: 'Heel', tip: 'Tip', rel: 'Rel' },
    metal_ra1:   { name: 'металл: дребезг 1', folder: 'Metal Additional', sub: '.', heel: 'RA1' },
    metal_ra2:   { name: 'металл: дребезг 2', folder: 'Metal Additional', sub: '.', heel: 'RA2' },
    metal_ro1:   { name: 'металл: гул 1',     folder: 'Metal Additional', sub: '.', heel: 'RO1' },
    metal_ro2:   { name: 'металл: гул 2',     folder: 'Metal Additional', sub: '.', heel: 'RO2' },
    wood_c1:     { name: 'доски: скрип 1',    folder: 'Wood Planks Additional', sub: '.', heel: 'C1' },
    wood_c2:     { name: 'доски: скрип 2',    folder: 'Wood Planks Additional', sub: '.', heel: 'C2' },
    wood_s1:     { name: 'доски: стук 1',     folder: 'Wood Planks Additional', sub: '.', heel: 'S1' },
    wood_s2:     { name: 'доски: стук 2',     folder: 'Wood Planks Additional', sub: '.', heel: 'S2' },
  };
  const ACCESSORIES = {
    none:     { name: 'нет' },
    cloth:    { name: 'ткань (штанина)', folder: 'Additional Layers', sub: 'Cloth',    heel: 'Heel', rel: 'Rel' },
    leather1: { name: 'кожа 1',          folder: 'Additional Layers', sub: 'Leather1', heel: 'Heel', tip: 'Tip', rel: 'Rel' },
    leather2: { name: 'кожа 2',          folder: 'Additional Layers', sub: 'Leather2', heel: 'Heel', tip: 'Tip', rel: 'Rel' },
    leather3: { name: 'кожа 3',          folder: 'Additional Layers', sub: 'Leather3', heel: 'Heel', tip: 'Tip', rel: 'Rel' },
    metal1:   { name: 'металл 1',        folder: 'Additional Layers', sub: 'Metal1',   heel: 'Heel' },
    metal2:   { name: 'металл 2',        folder: 'Additional Layers', sub: 'Metal2',   heel: 'Heel', rel: 'Rel' },
  };
  const SHOE_RU = { 'Boots': 'ботинки', 'Dress Boots': 'сапоги (dress boots)', 'High Heels': 'каблуки', 'Leather Shoes': 'кожаные туфли', 'Sneaker': 'кроссовки' };
  const SURF_RU = { 'Concrete Clean': 'бетон чистый', 'Concrete Gritty': 'бетон с крошкой', 'Gravel Light': 'гравий мелкий', 'Gravel Medium': 'гравий средний', 'Metal': 'металл', 'Sand': 'песок', 'Wood Parquet': 'паркет', 'Wood Plank': 'доски' };

  // ---------- макро-ползунки: главный раскрывается в три подползунка ----------
  // Карты подползунков целятся в компонент ("heel", "tip"…) или в "global" (тайминг, разброс, зона силы, фильтры).
  const MACROS = [
    { id: 'weight', name: 'Вес', default: 50, hint: 'лёгкий ↔ тяжёлый: сила удара, пятка, носок, низ', sub: [
      { id: 'heel', name: 'Пятка', default: 50, map: [ { layer: 'heel', param: 'gain', from: -10, to: 4 }, { layer: 'global', param: 'zone', from: 0, to: 1 } ] },
      { id: 'tip',  name: 'Носок', default: 50, map: [ { layer: 'tip',  param: 'gain', from: -12, to: 6 } ] },
      { id: 'low',  name: 'Низ',   default: 50, map: [ { layer: 'global', param: 'lowShelf', from: -6, to: 9 } ] },
    ] },
    { id: 'tempo', name: 'Темп', default: 45, hint: 'крадётся ↔ бежит: шагов в минуту и паузы внутри шага', sub: [
      { id: 'spm',  name: 'Шагов / мин',   default: 45, map: [ { layer: 'global', param: 'spm', from: 50, to: 180 } ] },
      { id: 'ht',   name: 'Пятка → носок', default: 45, map: [ { layer: 'global', param: 'gapHeelTip', from: 220, to: 40 } ] },
      { id: 'tr',   name: 'Носок → отрыв', default: 45, map: [ { layer: 'global', param: 'gapTipRel', from: 260, to: 60 } ] },
    ] },
    { id: 'scuff', name: 'Шарканье', default: 35, hint: 'чётко ↔ шаркает: отрыв, скольжения, их длина', sub: [
      { id: 'rel',  name: 'Отрыв',      default: 35, map: [ { layer: 'rel',    param: 'gain', from: -24, to: 6 } ] },
      { id: 'prob', name: 'Скольжения', default: 35, map: [ { layer: 'global', param: 'slideProb', from: 0, to: 0.8 }, { layer: 'slide', param: 'gain', from: -12, to: 3 } ] },
      { id: 'len',  name: 'Длина',      default: 35, map: [ { layer: 'global', param: 'slideLen', from: 0, to: 1 } ] },
    ] },
    { id: 'hardware', name: 'Фурнитура', default: 30, hint: 'аксессуары обуви и доп. поверхность', sub: [
      { id: 'a1', name: 'Аксессуар 1',      default: 30, map: [ { layer: 'acc1',    param: 'gain', from: -24, to: 6 } ] },
      { id: 'a2', name: 'Аксессуар 2',      default: 30, map: [ { layer: 'acc2',    param: 'gain', from: -24, to: 6 } ] },
      { id: 'gn', name: 'Доп. поверхность', default: 30, map: [ { layer: 'generic', param: 'gain', from: -24, to: 6 } ] },
    ] },
    { id: 'variation', name: 'Разброс', default: 40, hint: 'машинно ↔ живо: случайный питч, громкость, время', sub: [
      { id: 'pitch', name: 'Питч',      default: 40, map: [ { layer: 'global', param: 'randPitch', from: 0, to: 120 } ] },
      { id: 'gain',  name: 'Громкость', default: 40, map: [ { layer: 'global', param: 'randGain', from: 0, to: 6 } ] },
      { id: 'time',  name: 'Время',     default: 40, map: [ { layer: 'global', param: 'randTime', from: 0, to: 40 } ] },
    ] },
    // Дистанция по физике (distance.js): расхождение −6 дБ/удвоение, воздух ISO 9613-1, земля ISO 9613-2.
    // Подползунки: температура, влажность, грунт (грунт сам ставится по выбранной поверхности).
    { id: 'dist', kind: 'distance', name: 'Дистанция', default: 0, hint: '1…200 м от слушателя; шаг у земли (5 см), ухо на 1.6 м', hs: 0.05, hr: 1.6 },
  ];

  // ---------- характеры: выбор обуви/поверхности/слоёв + положения ползунков ----------
  // Значения: главный ползунок и его три подползунка. Это стартовые точки, владелец доводит на слух.
  const CHARACTERS = [
    { id: 'boots_hard', name: 'Тяжёлые ботинки по бетону, жёстко',
      select: { shoe: 'Boots', surface: 'Concrete Gritty', generic: 'none', acc1: 'metal2', acc2: 'leather2' },
      values: { weight: 78, 'weight.heel': 85, 'weight.tip': 60, 'weight.low': 80, tempo: 40, 'tempo.spm': 40, 'tempo.ht': 40, 'tempo.tr': 35,
                scuff: 40, 'scuff.rel': 45, 'scuff.prob': 30, 'scuff.len': 40, hardware: 35, 'hardware.a1': 35, 'hardware.a2': 25, 'hardware.gn': 0,
                variation: 40, 'variation.pitch': 35, 'variation.gain': 40, 'variation.time': 45, dist: 0 } },
    { id: 'sneak', name: 'Крадётся в кроссовках по паркету, мягко',
      select: { shoe: 'Sneaker', surface: 'Wood Parquet', generic: 'wood_c1', acc1: 'cloth', acc2: 'none' },
      values: { weight: 22, 'weight.heel': 15, 'weight.tip': 35, 'weight.low': 15, tempo: 15, 'tempo.spm': 12, 'tempo.ht': 15, 'tempo.tr': 15,
                scuff: 55, 'scuff.rel': 60, 'scuff.prob': 45, 'scuff.len': 60, hardware: 25, 'hardware.a1': 40, 'hardware.a2': 0, 'hardware.gn': 25,
                variation: 55, 'variation.pitch': 50, 'variation.gain': 60, 'variation.time': 55, dist: 0 } },
    { id: 'heels', name: 'Каблуки по паркету, резко',
      select: { shoe: 'High Heels', surface: 'Wood Parquet', generic: 'none', acc1: 'none', acc2: 'none' },
      values: { weight: 65, 'weight.heel': 80, 'weight.tip': 70, 'weight.low': 20, tempo: 60, 'tempo.spm': 62, 'tempo.ht': 65, 'tempo.tr': 60,
                scuff: 10, 'scuff.rel': 0, 'scuff.prob': 10, 'scuff.len': 20, hardware: 0, 'hardware.a1': 0, 'hardware.a2': 0, 'hardware.gn': 0,
                variation: 35, 'variation.pitch': 30, 'variation.gain': 35, 'variation.time': 30, dist: 0 } },
    { id: 'business', name: 'Деловой шаг, кожаные туфли по чистому бетону',
      select: { shoe: 'Leather Shoes', surface: 'Concrete Clean', generic: 'none', acc1: 'leather1', acc2: 'none' },
      values: { weight: 50, 'weight.heel': 55, 'weight.tip': 50, 'weight.low': 40, tempo: 55, 'tempo.spm': 55, 'tempo.ht': 55, 'tempo.tr': 55,
                scuff: 25, 'scuff.rel': 25, 'scuff.prob': 15, 'scuff.len': 30, hardware: 30, 'hardware.a1': 30, 'hardware.a2': 0, 'hardware.gn': 0,
                variation: 40, 'variation.pitch': 35, 'variation.gain': 40, 'variation.time': 40, dist: 0 } },
    { id: 'gravel_slow', name: 'Сапоги по гравию, медленно и тяжело',
      select: { shoe: 'Dress Boots', surface: 'Gravel Medium', generic: 'none', acc1: 'leather3', acc2: 'none' },
      values: { weight: 62, 'weight.heel': 70, 'weight.tip': 55, 'weight.low': 60, tempo: 25, 'tempo.spm': 22, 'tempo.ht': 25, 'tempo.tr': 25,
                scuff: 55, 'scuff.rel': 60, 'scuff.prob': 50, 'scuff.len': 55, hardware: 25, 'hardware.a1': 25, 'hardware.a2': 0, 'hardware.gn': 0,
                variation: 45, 'variation.pitch': 40, 'variation.gain': 45, 'variation.time': 50, dist: 0 } },
    { id: 'forest', name: 'По листве в лесу, ботинки',
      select: { shoe: 'Boots', surface: 'Gravel Light', generic: 'leaves', acc1: 'cloth', acc2: 'none' },
      values: { weight: 55, 'weight.heel': 55, 'weight.tip': 55, 'weight.low': 50, tempo: 40, 'tempo.spm': 38, 'tempo.ht': 40, 'tempo.tr': 40,
                scuff: 50, 'scuff.rel': 50, 'scuff.prob': 40, 'scuff.len': 50, hardware: 60, 'hardware.a1': 35, 'hardware.a2': 0, 'hardware.gn': 85,
                variation: 50, 'variation.pitch': 45, 'variation.gain': 50, 'variation.time': 50, dist: 0 } },
    { id: 'far', name: 'Шаги вдалеке по металлу (тот же вес, далеко)',
      select: { shoe: 'Boots', surface: 'Metal', generic: 'metal_ro1', acc1: 'none', acc2: 'none' },
      values: { weight: 60, 'weight.heel': 65, 'weight.tip': 55, 'weight.low': 60, tempo: 45, 'tempo.spm': 45, 'tempo.ht': 45, 'tempo.tr': 45,
                scuff: 30, 'scuff.rel': 30, 'scuff.prob': 20, 'scuff.len': 30, hardware: 50, 'hardware.a1': 0, 'hardware.a2': 0, 'hardware.gn': 70,
                variation: 40, 'variation.pitch': 35, 'variation.gain': 40, 'variation.time': 40, dist: 70 } },
  ];

  const DEFAULT_P = { zone: 0.5, lowShelf: 0, cutoff: 20000, hp: 30, gain: 0, randPitch: 40, randGain: 2, randTime: 12,
                      gapHeelTip: 120, gapTipRel: 150, slideProb: 0.2, slideLen: 0.4, spm: 100 };

  // ---------- состояние движка ----------
  const S = {
    index: null, set: null, cache: new Map(), bank: {}, comps: new Map(), bus: null,
    P: { ...DEFAULT_P }, compGain: {}, loadToken: 0, loaded: 0, total: 0, last: new Map(),
    walk: { on: false, timer: null, next: 0, side: 'L' }, onStatus: () => {}, onProgress: () => {}, voices: 0, steps: 0,
  };
  const dbToGain = db => Math.pow(10, db / 20);
  const clamp01 = v => Math.max(0, Math.min(1, v));

  async function loadIndex() {
    if (S.index) return S.index;
    const r = await fetch('vfa-index.json');
    S.index = r.ok ? (await r.json()).folders : {};
    return S.index;
  }
  function catalog() {
    const shoes = new Set(), surfaces = new Set();
    for (const f of Object.keys(S.index || {})) {
      const m = f.match(/^(.*?) 01 (.*?) 01 Dry$/);
      if (m) { shoes.add(m[1]); surfaces.add(m[2]); }
    }
    return { shoes: [...shoes], surfaces: [...surfaces] };
  }

  // Все зоны силы, где есть эта артикуляция, по возрастанию velocity → [{zone, p, n}]
  function zonesFor(folder, sub, art) {
    const subs = S.index?.[folder]; if (!subs) return [];
    const zones = subs[sub]; if (!zones) return [];
    return Object.entries(zones).filter(([, arts]) => arts[art]).map(([z, arts]) => ({ zone: z, lo: +z.split('-')[0], ...arts[art] }))
      .sort((a, b) => a.lo - b.lo);
  }
  function fileUrl(folder, sub, p, n) {
    const path = sub === '.' ? `${folder}/${p}${String(n).padStart(2, '0')}.wav` : `${folder}/${sub}/${p}${String(n).padStart(2, '0')}.wav`;
    return LIB + path.split('/').map(encodeURIComponent).join('/');
  }
  async function decode(url) {
    if (S.cache.has(url)) return S.cache.get(url);
    try {
      const data = await (await fetch(url)).arrayBuffer();
      const buf = await audio.ctx.decodeAudioData(data);
      S.cache.set(url, buf); return buf;
    } catch (e) { return null; }
  }
  // Загружает артикуляцию: массив по зонам, в каждой до RR_LIMIT буферов
  // по PARALLEL файлов одновременно: fetch и decode идут в фоне, иначе 300 файлов грузятся минуту
  const PARALLEL = 8;
  async function loadArt(folder, sub, art, token) {
    const zones = zonesFor(folder, sub, art);
    const out = [];
    for (const z of zones) {
      const nums = z.n.slice(0, RR_LIMIT);
      const bufs = new Array(nums.length).fill(null);
      let next = 0;
      const worker = async () => {
        while (next < nums.length) {
          const i = next++;
          if (token !== S.loadToken) return;
          bufs[i] = await decode(fileUrl(folder, sub, z.p, nums[i]));
          S.loaded++; S.onProgress(S.loaded, S.total);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, nums.length) }, worker));
      if (token !== S.loadToken) return null;
      const got = bufs.filter(Boolean);
      if (got.length) out.push(got);
    }
    return out;
  }
  const countArt = (folder, sub, art) => zonesFor(folder, sub, art).reduce((a, z) => a + Math.min(RR_LIMIT, z.n.length), 0);

  // ---------- загрузка выбранного набора ----------
  async function loadSelection(set) {
    await loadIndex();
    if (!audio.ctx) ensureAudio();
    const token = ++S.loadToken;
    const sel = set.select;
    const main = `${sel.shoe} 01 ${sel.surface} 01 Dry`;
    const gen = GENERICS[sel.generic] || GENERICS.none, a1 = ACCESSORIES[sel.acc1] || ACCESSORIES.none, a2 = ACCESSORIES[sel.acc2] || ACCESSORIES.none;
    const plan = [];  // [компонент, ключ, folder, sub, art]
    for (const side of ['L', 'R']) {
      const sub = side === 'L' ? 'Left' : 'Right';
      for (const art of ['Heel', 'Tip', 'Rel']) plan.push([art.toLowerCase(), side, main, sub, art]);
    }
    for (const len of ['Short', 'Normal', 'Long']) plan.push(['slide', len, main, 'Slides', 'Slide ' + len]);
    plan.push(['stairs', 'X', main, 'Stairs', 'Full']);
    const extra = (comp, def) => {
      if (!def.folder) return;
      for (const part of ['heel', 'tip', 'rel']) {
        if (!def[part]) continue;
        if (def.sides) { plan.push([comp + '.' + part, 'L', def.folder, 'Left', def[part]]); plan.push([comp + '.' + part, 'R', def.folder, 'Right', def[part]]); }
        else plan.push([comp + '.' + part, 'X', def.folder, def.sub, def[part]]);
      }
    };
    extra('generic', gen); extra('acc1', a1); extra('acc2', a2);

    S.loaded = 0; S.total = plan.reduce((a, [, , f, s, art]) => a + countArt(f, s, art), 0);
    S.bank = {}; S.onProgress(0, S.total);
    S.onStatus(`грузим: ${sel.shoe} / ${sel.surface}`);
    for (const [comp, key, folder, sub, art] of plan) {
      const zones = await loadArt(folder, sub, art, token);
      if (zones === null) return;                       // выбор сменился, бросаем
      (S.bank[comp] ??= {})[key] = zones;
    }
    S.onStatus(`готово: ${SHOE_RU[sel.shoe] || sel.shoe} / ${SURF_RU[sel.surface] || sel.surface}`);
  }

  // ---------- граф ----------
  function ensureBus() {
    if (S.bus) return;
    const ctx = audio.ctx;
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 160;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30; hp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
    const out = ctx.createGain(), dist = Distance.create(ctx);
    low.connect(hp).connect(lp).connect(out).connect(dist.input); dist.output.connect(audio.master);
    S.bus = { low, hp, lp, out, dist, input: low };
    for (const c of COMPONENTS) {
      const macro = ctx.createGain(), user = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 512;
      macro.connect(user).connect(an).connect(S.bus.input);
      S.comps.set(c.id, { macro, user, an, input: macro });
      audio.meters.set(S.set.id + '/' + c.id, an);
    }
  }

  function setParams(set, params) {
    const g = params.global || {};
    S.P = { ...DEFAULT_P, ...g };
    if (!audio.ctx) return;
    ensureBus();
    const now = audio.ctx.currentTime;
    S.bus.low.gain.setTargetAtTime(S.P.lowShelf, now, 0.03);
    S.bus.hp.frequency.setTargetAtTime(S.P.hp, now, 0.03);
    S.bus.lp.frequency.setTargetAtTime(S.P.cutoff, now, 0.03);
    S.bus.out.gain.setTargetAtTime(dbToGain(S.P.gain), now, 0.03);
    if (params.__distance) S.bus.dist.set(params.__distance);
    for (const c of COMPONENTS) {
      const db = params[c.id]?.gain ?? 0;
      S.comps.get(c.id).macro.gain.setTargetAtTime(dbToGain(db), now, 0.03);
    }
  }
  function applyUserGain(set, layer, audible) {
    if (!audio.ctx) return;
    ensureBus();
    const c = S.comps.get(layer.id); if (!c) return;
    c.user.gain.setTargetAtTime(audible ? Math.pow((layer.gain ?? 80) / 100, 2) : 0, audio.ctx.currentTime, 0.02);
  }

  // ---------- выбор сэмпла ----------
  function pickZone(zones) {
    if (!zones || !zones.length) return null;
    const v = clamp01(S.P.zone + (Math.random() - 0.5) * 0.35);
    return zones[Math.min(zones.length - 1, Math.floor(v * zones.length))];
  }
  function pickRR(list, key) {
    if (!list || !list.length) return null;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === S.last.get(key)) i = (i + 1) % list.length;
    S.last.set(key, i);
    return list[i];
  }
  function sample(comp, key) {
    const zones = S.bank[comp]?.[key] || S.bank[comp]?.X;
    const z = pickZone(zones);
    return z ? pickRR(z, comp + '/' + key + '/' + zones.indexOf(z)) : null;
  }
  function voice(compId, buf, t, extraDb = 0) {
    if (!buf) return;
    const ctx = audio.ctx, c = S.comps.get(compId); if (!c) return;
    S.voices++;
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = Math.pow(2, ((Math.random() * 2 - 1) * S.P.randPitch) / 1200);
    const g = ctx.createGain(); g.gain.value = dbToGain(extraDb + (Math.random() * 2 - 1) * S.P.randGain);
    src.connect(g).connect(c.input);
    const jitter = (Math.random() * 2 - 1) * S.P.randTime / 1000;
    src.start(Math.max(t + jitter, ctx.currentTime));
    src.onended = () => { src.disconnect(); g.disconnect(); };
  }

  // ---------- один шаг ----------
  function step(side, when) {
    if (!audio.ctx) ensureAudio();
    ensureBus();
    const t0 = when ?? audio.ctx.currentTime + 0.03;
    S.steps++;
    const tTip = t0 + S.P.gapHeelTip / 1000, tRel = tTip + S.P.gapTipRel / 1000;
    voice('heel', sample('heel', side), t0);
    voice('tip', sample('tip', side), tTip);
    voice('rel', sample('rel', side), tRel);
    for (const comp of ['generic', 'acc1', 'acc2']) {
      voice(comp, sample(comp + '.heel', side), t0 + 0.004);
      voice(comp, sample(comp + '.tip', side), tTip + 0.004);
      voice(comp, sample(comp + '.rel', side), tRel + 0.004);
    }
    if (Math.random() < S.P.slideProb) slide(tTip + 0.03);
  }
  function slide(when) {
    if (!audio.ctx) ensureAudio();
    ensureBus();
    const len = S.P.slideLen < 0.33 ? 'Short' : S.P.slideLen < 0.66 ? 'Normal' : 'Long';
    voice('slide', sample('slide', len), when ?? audio.ctx.currentTime + 0.03);
  }
  function stairs(when) {
    if (!audio.ctx) ensureAudio();
    ensureBus();
    voice('stairs', sample('stairs', 'X'), when ?? audio.ctx.currentTime + 0.03);
  }

  // ---------- автоход ----------
  function walkTick() {
    const ctx = audio.ctx;
    while (S.walk.next < ctx.currentTime + 0.25) {
      step(S.walk.side, S.walk.next);
      S.walk.side = S.walk.side === 'L' ? 'R' : 'L';
      S.walk.next += 60 / S.P.spm * (1 + (Math.random() - 0.5) * 0.08);
    }
  }
  function walkRun(run) {
    if (run && !S.walk.timer) { ensureAudio(); S.walk.next = audio.ctx.currentTime + 0.05; S.walk.timer = setInterval(walkTick, 50); }
    if (!run && S.walk.timer) { clearInterval(S.walk.timer); S.walk.timer = null; }
  }
  function walkWanted() { return S.walk.on && (!video.src || !video.paused); }
  function setWalk(on) { S.walk.on = on; walkRun(walkWanted()); }
  function onTransport() { walkRun(walkWanted()); }

  // ---------- набор ----------
  function init(set) {
    S.set = set;
    set.kind = 'steps';
    set.layers = COMPONENTS.map(c => ({ ...c, mode: 'oneshot', ...(set.layers || []).find(l => l.id === c.id) }));
    set.macros = set.macros?.length ? set.macros : JSON.parse(JSON.stringify(MACROS));
    set.characters = CHARACTERS;
    set.select = { shoe: 'Boots', surface: 'Concrete Clean', generic: 'none', acc1: 'none', acc2: 'none', ...(set.select || {}) };
  }
  function characterValues(id) {
    const ch = CHARACTERS.find(c => c.id === id);
    return ch ? { select: { ...ch.select }, values: { ...ch.values } } : null;
  }

  // ---------- панель слева: выбор обуви/поверхности/слоёв, кнопки ----------
  function renderPanel(el, set, hooks) {
    if (!S.index) { loadIndex().then(() => renderPanel(el, set, hooks)); el.innerHTML = '<div class="progress">читаю индекс библиотеки…</div>'; return; }
    const cat = catalog();
    const opt = (list, cur, ru) => list.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${ru ? (ru[v] || v) : v}</option>`).join('');
    const optMap = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v.name}</option>`).join('');
    el.innerHTML = `
      <div class="sel"><label>Обувь</label><select data-sel="shoe">${opt(cat.shoes, set.select.shoe, SHOE_RU)}</select></div>
      <div class="sel"><label>Поверхность</label><select data-sel="surface">${opt(cat.surfaces, set.select.surface, SURF_RU)}</select></div>
      <div class="sel"><label>Доп. поверхность</label><select data-sel="generic">${optMap(GENERICS, set.select.generic)}</select></div>
      <div class="sel"><label>Аксессуар 1</label><select data-sel="acc1">${optMap(ACCESSORIES, set.select.acc1)}</select></div>
      <div class="sel"><label>Аксессуар 2</label><select data-sel="acc2">${optMap(ACCESSORIES, set.select.acc2)}</select></div>
      <div class="trig">
        <button class="btn" data-trig="L" title="клавиша 1">Шаг Л</button>
        <button class="btn" data-trig="R" title="клавиша 2">Шаг П</button>
        <button class="btn" data-trig="slide" title="клавиша 3">Скольж.</button>
        <button class="btn" data-trig="stairs" title="клавиша 4">Лестн.</button>
        <button class="btn walk${S.walk.on ? ' on' : ''}" data-trig="walk" title="клавиша G">Идти</button>
      </div>
      <div class="progress" id="stepsProgress"></div>`;
    for (const s of el.querySelectorAll('select')) s.onchange = () => { set.select[s.dataset.sel] = s.value; hooks.onSelect(); };
    for (const b of el.querySelectorAll('[data-trig]')) b.onclick = () => trigger(b.dataset.trig, el);
    S.onProgress = (n, m) => { const p = document.getElementById('stepsProgress'); if (p) p.textContent = n < m ? `загружено ${n} / ${m}` : `сэмплов в памяти: ${m}`; };
    S.onProgress(S.loaded, S.total);
  }
  function trigger(what, el) {
    ensureAudio();
    if (what === 'L' || what === 'R') step(what);
    else if (what === 'slide') slide();
    else if (what === 'stairs') stairs();
    else if (what === 'walk') { setWalk(!S.walk.on); const b = (el || document).querySelector('[data-trig="walk"]'); if (b) b.classList.toggle('on', S.walk.on); }
  }

  return { init, loadSelection, renderPanel, setParams, applyUserGain, trigger, onTransport, characterValues, COMPONENTS, MACROS, CHARACTERS,
           get state() { return S; } };
})();

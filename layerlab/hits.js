// SFX Lab · движок ударов по предметам (набор kind: "hits"). Гибрид: записи + синтез.
// Записанные слои берутся из BOOM VFA (удар каблуком о металлический лист / доски / бетон / песок — настоящие удары
// по материалу с тремя зонами силы и round-robin; отдельно записанные гул и дребезг металла, стук и скрип досок,
// шорох ткани) и из нарезки Krotos (приземления тела на металл, бетон, землю, паркет — тяжёлые удары).
// Синтез (шумовой импульс, банк мод материала, низкий толчок, звон осколков) остаётся там, где записей нет
// (пластик, стекло) и как подмешиваемый резонанс. Слои: контакт, корпус, дребезг/крошка, низ.
// «Сила» выбирает зону силы записи и громкость, «жёсткость» — пятку (твёрдый контакт) или носок (мягкий), ярче/тупее;
// «размер» понижает высоту записи и мод и удлиняет хвост; «глухость» укорачивает хвосты; «отскоки» — брошенный предмет.
// Все случайности считаются в плане (сеяно при экспорте), проигрывание детерминировано. ANALYSIS, часть 12.

const Hits = (() => {
  // ---------- материалы: записи [папка, подпапка, артикуляция] из индекса BOOM, heavy — нарезка Krotos; синтез-резонанс ----------
  const MATERIALS = {
    metal:   { name: 'металл',  icon: 'mat-metal',   hint: 'лист, забор, ведро: удар каблуком о металл, гул и дребезг листа',
      src: { strike: ['Boots 01 Metal 01 Dry', 'Left', 'Heel'], soft: ['Boots 01 Metal 01 Dry', 'Left', 'Tip'], small: ['High Heels 01 Metal 01 Dry', 'Left', 'Heel'], heavy: 'Krotos_Metal',
             body: ['Metal Additional', '.', 'RO1'], body2: ['Metal Additional', '.', 'RO2'], rattle: ['Metal Additional', '.', 'RA1'], rattle2: ['Metal Additional', '.', 'RA2'] },
      synth: 0.2, thump: 0.5, rattleProb: 0.9, grains: false, base: 420, ratios: [1, 2.76, 5.40, 8.93, 13.34, 18.6], decay: [1.6, 1.2, 0.9, 0.7, 0.5, 0.4], noiseCut: 9000, noiseLen: 1, noise: 0.3 },
    wood:    { name: 'дерево',  icon: 'mat-wood',    hint: 'ящик, доска: удар о доски, стук и скрип дерева',
      src: { strike: ['Boots 01 Wood Plank 01 Dry', 'Left', 'Heel'], soft: ['Boots 01 Wood Plank 01 Dry', 'Left', 'Tip'], small: ['High Heels 01 Wood Plank 01 Dry', 'Left', 'Heel'], heavy: 'Krotos_Parquet',
             body: ['Wood Planks Additional', '.', 'S1'], body2: ['Wood Planks Additional', '.', 'S2'], rattle: ['Wood Planks Additional', '.', 'C1'], rattle2: ['Wood Planks Additional', '.', 'C2'] },
      synth: 0.15, thump: 0.8, rattleProb: 0.35, grains: false, base: 330, ratios: [1, 2.2, 3.4, 4.9, 6.6], decay: [0.25, 0.18, 0.12, 0.09, 0.06], noiseCut: 4500, noiseLen: 1.4, noise: 0.5 },
    stone:   { name: 'камень',  icon: 'mat-stone',   hint: 'камень, бетон: удар о бетон с крошкой, осыпание гравия',
      src: { strike: ['Boots 01 Concrete Gritty 01 Dry', 'Left', 'Heel'], soft: ['Boots 01 Concrete Gritty 01 Dry', 'Left', 'Tip'], small: ['High Heels 01 Concrete Clean 01 Dry', 'Left', 'Heel'], heavy: 'Krotos_Concrete',
             body: ['Boots 01 Concrete Clean 01 Dry', 'Left', 'Heel'], rattle: ['Boots 01 Gravel Light 01 Dry', 'Left', 'Heel'] },
      synth: 0.1, thump: 0.9, rattleProb: 0.8, grains: true, base: 520, ratios: [1, 1.7, 2.9, 4.6], decay: [0.09, 0.07, 0.05, 0.04], noiseCut: 6500, noiseLen: 1.2, noise: 0.6 },
    dirt:    { name: 'земля',   icon: 'mat-dirt',    hint: 'земля, мешок: удар о песок и гравий, тяжёлое приземление',
      src: { strike: ['Boots 01 Sand 01 Dry', 'Left', 'Heel'], soft: ['Boots 01 Sand 01 Dry', 'Left', 'Tip'], heavy: 'Krotos_Dirt',
             body: ['Boots 01 Gravel Medium 01 Dry', 'Left', 'Tip'], rattle: ['Boots 01 Gravel Medium 01 Dry', 'Left', 'Heel'] },
      synth: 0.1, thump: 1.0, rattleProb: 0.8, grains: true, base: 160, ratios: [1, 1.5], decay: [0.05, 0.04], noiseCut: 2200, noiseLen: 3, noise: 0.6 },
    cloth:   { name: 'ткань',   icon: 'mat-cloth',   hint: 'подушка, мешок с тряпками: записанный шорох ткани и мягкий толчок',
      src: { strike: ['Additional Layers', 'Cloth', 'Heel'], body: ['Additional Layers', 'Cloth', 'Rel'] },
      synth: 0, thump: 0.7, rattleProb: 0, grains: false, base: 0, ratios: [], decay: [], noiseCut: 1300, noiseLen: 30, noise: 0.8 },
    plastic: { name: 'пластик', icon: 'mat-plastic', hint: 'конус, ведро: записей пластика в библиотеке нет — тупой контакт по паркету плюс синтез',
      src: { strike: ['Boots 01 Wood Parquet 01 Dry', 'Left', 'Tip'], soft: ['Boots 01 Wood Parquet 01 Dry', 'Left', 'Tip'] },
      synth: 1.0, thump: 0.5, rattleProb: 0, grains: false, base: 380, ratios: [1, 1.9, 3.1, 4.4], decay: [0.12, 0.08, 0.06, 0.04], noiseCut: 3200, noiseLen: 1.6, noise: 0.85, recGain: 0.5 },
    glass:   { name: 'стекло',  icon: 'mat-glass',   hint: 'записей стекла нет — острый щелчок каблука по бетону плюс синтез звона и осколков',
      src: { strike: ['High Heels 01 Concrete Clean 01 Dry', 'Left', 'Heel'] },
      synth: 1.0, thump: 0.2, rattleProb: 1, grains: false, tinkle: true, base: 1400, ratios: [1, 2.3, 4.1, 6.4, 9.2, 12.5], decay: [0.9, 0.7, 0.5, 0.4, 0.3, 0.2], noiseCut: 12000, noiseLen: 0.7, noise: 0.3, recGain: 0.45 },
  };
  const MAT_LIST = Object.keys(MATERIALS);

  // ---------- слои удара ----------
  const LAYERS = [
    { id: 'strike', name: 'контакт', gain: 80, rec: 100,   hint: 'сам удар: запись контакта с материалом (сила выбирает зону записи), сверху короткий синтез-импульс' },
    { id: 'body',   name: 'корпус',  gain: 80, synth: 100, hint: 'резонанс предмета: записанный гул / стук материала плюс синтез-моды (доля — ручка)' },
    { id: 'rattle', name: 'дребезг', gain: 65, count: 100, hint: 'после удара: записанный дребезг или скрип, осыпание гравия, звон осколков' },
    { id: 'thump',  name: 'низ',     gain: 70, tone: 100,  hint: 'толчок массы: низкий тон с падением высоты' },
  ];

  // ---------- макросы ----------
  const MACROS = [
    { id: 'drive', name: 'Жёсткость', default: 50, hub: true, hint: 'мягко ↔ жёстко: носок или пятка в записи, ярче контакт, больше верхних мод', map: [ { layer: 'global', param: 'hard', from: 0, to: 1 } ] },
    { id: 'force', name: 'Сила', default: 50, dial: true, hint: 'лёгкий ↔ сильный: зона силы записи, громкость, крошка; очень сильно и крупно — тяжёлое приземление',
      zones: [{ at: 15, name: 'легко', icon: 'feather' }, { at: 50, name: 'средне', icon: 'hammer' }, { at: 90, name: 'сильно', icon: 'zap' }],
      map: [ { layer: 'global', param: 'force', from: 0.08, to: 1 } ] },
    { id: 'size', name: 'Размер', default: 50, dial: true, hint: 'мелкий ↔ крупный предмет: записи и моды ниже, хвост длиннее',
      zones: [{ at: 12, name: 'мелкий', icon: 'grid' }, { at: 50, name: 'средний', icon: 'layers' }, { at: 88, name: 'крупный', icon: 'room' }],
      map: [ { layer: 'global', param: 'size', from: 0.4, to: 2.6, curve: 'log' } ] },
    { id: 'damp', name: 'Глухость', default: 40, hint: 'звонко ↔ глухо: как рука на предмете, укорачивает хвосты', map: [ { layer: 'global', param: 'damp', from: 2.2, to: 0.2, curve: 'log' } ] },
    { id: 'bounce', name: 'Отскоки', default: 0, hint: 'брошенный предмет: сколько отскоков и как быстро гаснут', sub: [
      { id: 'count', name: 'Сколько',   default: 0,  map: [ { layer: 'global', param: 'bounces', from: 0, to: 6 } ] },
      { id: 'rest',  name: 'Упругость', default: 50, map: [ { layer: 'global', param: 'rest', from: 0.45, to: 0.85 } ] },
    ] },
    { id: 'variation', name: 'Разброс', default: 40, hint: 'машинно ↔ живо: случайный тон, громкость, время', sub: [
      { id: 'pitch', name: 'Тон',       default: 40, map: [ { layer: 'global', param: 'randPitch', from: 0, to: 120 } ] },
      { id: 'gain',  name: 'Громкость', default: 40, map: [ { layer: 'global', param: 'randGain', from: 0, to: 6 } ] },
      { id: 'time',  name: 'Время',     default: 40, map: [ { layer: 'global', param: 'randTime', from: 0, to: 40 } ] },
    ] },
    { id: 'dist', kind: 'distance', name: 'Дистанция', default: 0, hint: '1…200 м от слушателя', hs: 0.8, hr: 1.6 },
  ];
  const DEFAULT_P = { hard: 0.5, force: 0.5, size: 1, damp: 1, bounces: 0, rest: 0.65, randPitch: 40, randGain: 2, randTime: 10 };

  // ---------- характеры (предметы) ----------
  const CHARACTERS = [
    { id: 'crate',  name: 'Деревянный ящик',           select: { material: 'wood' },    values: { drive: 55, force: 60, size: 62, damp: 40, bounce: 0, 'bounce.count': 0, variation: 45 } },
    { id: 'fence',  name: 'Металлический забор',       select: { material: 'metal' },   values: { drive: 60, force: 60, size: 75, damp: 20, bounce: 0, 'bounce.count': 0, variation: 40 } },
    { id: 'bucket', name: 'Железное ведро',            select: { material: 'metal' },   values: { drive: 55, force: 50, size: 42, damp: 45, bounce: 25, 'bounce.count': 30, 'bounce.rest': 55, variation: 45 } },
    { id: 'barrel', name: 'Бочка, кулаком',            select: { material: 'metal' },   values: { drive: 35, force: 75, size: 90, damp: 40, bounce: 0, 'bounce.count': 0, variation: 40 } },
    { id: 'cone',   name: 'Пластиковый конус',         select: { material: 'plastic' }, values: { drive: 45, force: 50, size: 48, damp: 55, bounce: 30, 'bounce.count': 35, 'bounce.rest': 50, variation: 45 } },
    { id: 'glass',  name: 'Стакан на стол',            select: { material: 'glass' },   values: { drive: 60, force: 30, size: 35, damp: 50, bounce: 0, 'bounce.count': 0, variation: 35 } },
    { id: 'rock',   name: 'Камень о камень',           select: { material: 'stone' },   values: { drive: 80, force: 70, size: 50, damp: 60, bounce: 15, 'bounce.count': 20, 'bounce.rest': 50, variation: 50 } },
    { id: 'sack',   name: 'Мешок на землю',            select: { material: 'dirt' },    values: { drive: 25, force: 85, size: 80, damp: 60, bounce: 0, 'bounce.count': 0, variation: 45 } },
    { id: 'pillow', name: 'Подушка',                   select: { material: 'cloth' },   values: { drive: 15, force: 60, size: 70, damp: 70, bounce: 0, 'bounce.count': 0, variation: 45 } },
  ];

  // ---------- состояние ----------
  const S = { set: null, P: { ...DEFAULT_P }, bus: null, comps: new Map(), bank: {}, loaded: 0, total: 0, loadToken: 0, last: new Map(),
              onStatus: () => {}, onProgress: () => {}, onHit: null, hits: 0, voices: 0, rng: null, distParams: null, noise: new Map() };
  const rnd = () => S.rng ? S.rng() : Math.random();
  const dbToGain = db => Math.pow(10, db / 20);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const matOf = set => MATERIALS[set?.select?.material] || MATERIALS.metal;

  function init(set) {
    const saved = set.layers || [];
    set.layers = LAYERS.map(c => ({ ...c, ...(saved.find(l => l.id === c.id) || {}) }));
    set.macros = set.macros?.length ? set.macros : JSON.parse(JSON.stringify(MACROS));
    set.characters = CHARACTERS;
    set.select = { material: 'metal', ...(set.select || {}) };
    if (!MATERIALS[set.select.material]) set.select.material = 'metal';
    S.set = set;
  }
  const layerJson = l => ({ id: l.id, on: l.on, gain: l.gain, rec: l.rec, synth: l.synth, count: l.count, tone: l.tone });
  function characterValues(id) { const ch = CHARACTERS.find(c => c.id === id); return ch ? { select: { ...ch.select }, values: { ...ch.values } } : null; }

  // ---------- загрузка записей материала ----------
  async function load(set) {
    S.set = set; if (!audio.ctx) return;
    ensureBus();
    await Steps.loadIndex();
    const m = matOf(set), token = ++S.loadToken, roles = Object.entries(m.src);
    S.bank = {}; S.last.clear();
    S.total = roles.reduce((a, [, src]) => a + (typeof src === 'string' ? Steps.lib.countFiles(src) : Steps.lib.countArt(...src)), 0); S.loaded = 0;
    S.onStatus(`грузим записи: ${m.name}`); S.onProgress(0, S.total);
    for (const [role, src] of roles) {
      const zones = typeof src === 'string' ? await Steps.lib.loadFiles(src) : await Steps.lib.loadArt(...src);
      if (token !== S.loadToken) return;                 // материал сменили, бросаем
      if (zones && zones.length) S.bank[role] = zones;
      S.loaded = Math.min(S.total, S.loaded + (typeof src === 'string' ? Steps.lib.countFiles(src) : Steps.lib.countArt(...src))); S.onProgress(S.loaded, S.total);
    }
    S.onStatus(`${m.name}: ${Object.keys(S.bank).length} записанных слоёв — H удар, D бросок`);
  }
  // запись роли по силе: зона силы (с лёгким разбросом) и round-robin без повтора
  function pickBuf(role, force) {
    const zones = S.bank[role]; if (!zones || !zones.length) return null;
    const zi = clamp(Math.round(clamp(force * 0.95 + (rnd() - 0.5) * 0.3, 0, 1) * (zones.length - 1)), 0, zones.length - 1), list = zones[zi];
    let i = Math.floor(rnd() * list.length); const key = role + zi; if (list.length > 1 && i === S.last.get(key)) i = (i + 1) % list.length; S.last.set(key, i);
    return list[i];
  }

  // ---------- граф ----------
  function buildBus(ctx, opts = {}) {
    const sum = ctx.createGain(), out = ctx.createGain(), comps = new Map();
    sum.connect(out);
    for (const c of LAYERS) {
      const l = S.set.layers.find(x => x.id === c.id) || c;
      const input = ctx.createGain(), user = ctx.createGain(); input.connect(user);
      const fx = Fx.build(ctx, S.set.wireFx?.[c.id], opts.live ? S.set.id + '/' + c.id : null);
      user.connect(fx.input);
      if (opts.live) { const an = ctx.createAnalyser(); an.fftSize = 512; fx.output.connect(an).connect(sum); comps.set(c.id, { input, user, an, fx }); audio.meters.set(S.set.id + '/' + c.id, an); }
      else { fx.output.connect(sum); user.gain.value = (opts.audible ? opts.audible(c.id) : true) && l.on !== false ? Math.pow((l.gain ?? 80) / 100, 2) : 0; comps.set(c.id, { input, user }); }
    }
    return { input: sum, out, comps };
  }
  function ensureBus() {
    if (S.bus) return;
    const ctx = audio.ctx, b = buildBus(ctx, { live: true }), dist = Distance.create(ctx), fx = Fx.build(ctx, S.set.fx, S.set.id);
    b.out.connect(fx.input); fx.output.connect(dist.input); dist.output.connect(setOutput(S.set.id));
    S.bus = { ...b, dist, fx }; S.comps = b.comps;
  }
  function setParams(set, params) {
    S.P = { ...DEFAULT_P, ...(params.global || {}) };
    if (params.__distance) S.distParams = params.__distance;
    if (!audio.ctx) return;
    ensureBus();
    if (params.__distance) S.bus.dist.set(params.__distance);
  }
  function applyUserGain(set, layer, audible) {
    if (!audio.ctx) return;
    ensureBus();
    const c = S.comps.get(layer.id); if (!c) return;
    c.user.gain.setTargetAtTime(audible && layer.on !== false ? Math.pow((layer.gain ?? 80) / 100, 2) : 0, audio.ctx.currentTime, 0.02);
  }
  function noiseBuffer(ctx) {
    const key = ctx.sampleRate + '@' + (ctx === audio.ctx ? 'live' : 'off');
    if (S.noise.has(key)) return S.noise.get(key);
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let seed = 1234567; for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
    S.noise.set(key, buf); return buf;
  }

  // ---------- план удара ----------
  function planHit(set, t0, forceMul = 1, first = true) {
    const P = S.P, m = matOf(set), lay = id => set.layers.find(l => l.id === id) || {};
    const force = clamp(P.force * forceMul, 0.03, 1), hard = P.hard, size = P.size;
    const jitter = (rnd() * 2 - 1) * P.randTime / 1000, pitch = Math.pow(2, (rnd() * 2 - 1) * P.randPitch / 1200), level = dbToGain((rnd() * 2 - 1) * P.randGain);
    const t = t0 + Math.max(0, jitter), rate = clamp(Math.pow(size, -0.45) * pitch, 0.5, 1.6), decayScale = Math.pow(1 / size, 0.7) * P.damp;
    const tail = P.damp < 1 ? 0.35 * P.damp * Math.sqrt(size) : null;   // глухость: укоротить хвост записи
    const plan = { t, material: set.select.material, force, hard, size, level, rate, voices: [], strike: null, modes: [], thump: null, debris: [] };
    const recGain = m.recGain ?? 1;
    // контакт: запись по силе и жёсткости (пятка/носок, мелкий — каблук, очень сильно — приземление), сверху импульс
    const sl = lay('strike'); if (sl.on !== false) {
      const role = (force > 0.68 && size >= 0.9 && S.bank.heavy && first) ? 'heavy' : (size < 0.7 && S.bank.small) ? 'small' : (hard < 0.4 && S.bank.soft) ? 'soft' : 'strike';
      const buf = pickBuf(role, force) || pickBuf('strike', force);
      if (buf) plan.voices.push({ layer: 'strike', buf, t, rate: role === 'heavy' ? clamp(rate, 0.8, 1.2) : rate, gain: recGain * (sl.rec ?? 100) / 100 * (0.25 + 0.75 * Math.pow(force, 0.8)) * (role === 'heavy' ? 0.9 : 1), shelf: (hard - 0.5) * 8, off: 0 });
      const len = (0.0006 + (1 - hard) * 0.006) * m.noiseLen;
      plan.strike = { len, cut: m.noiseCut * (0.35 + 0.65 * Math.pow(force, 0.7)) * (0.6 + 0.6 * hard), amp: 0.9 * Math.pow(force, 1.1) * m.noise * (buf ? 0.3 : 1), off: rnd() * 1.5 };
    }
    // корпус: записанный резонанс + доля синтез-мод
    const bl = lay('body'); if (bl.on !== false) {
      const role = S.bank.body2 && rnd() < 0.5 ? 'body2' : 'body', buf = pickBuf(role, force) || pickBuf('body', force);
      if (buf) plan.voices.push({ layer: 'body', buf, t: t + 0.003, rate, gain: (0.3 + 0.7 * Math.pow(force, 0.9)) * (m.synth >= 1 ? 0 : 1), tau: tail, off: 0 });
      const share = m.synth * (bl.synth ?? 100) / 100;
      if (share > 0 && m.ratios.length) {
        const n = m.ratios.length, p = 1.9 - 1.2 * clamp(force * (0.4 + 0.9 * hard), 0, 1);
        for (let i = 0; i < n; i++) {
          const f = m.base * pitch / size * m.ratios[i] * (1 + (rnd() - 0.5) * 0.03); if (f > 18000 || f < 25) continue;
          const dampHi = P.damp < 1 ? Math.pow(P.damp, i * 0.35) : 1;
          plan.modes.push({ f, decay: m.decay[i] * decayScale * (0.8 + 0.4 * rnd()), amp: 0.55 * force * Math.pow(i + 1, -p) * dampHi * share });
        }
      }
    }
    // дребезг / крошка: запись (с вероятностью по силе), зёрна гравия, синтез-осколки
    const rl = lay('rattle'); if (rl.on !== false) {
      const mul = (rl.count ?? 100) / 100 * (first ? 1 : 0.4);
      if (S.bank.rattle && rnd() < m.rattleProb * (0.4 + 0.7 * force) * Math.min(1, mul * 2)) {
        const role = S.bank.rattle2 && rnd() < 0.5 ? 'rattle2' : 'rattle', buf = pickBuf(role, force) || pickBuf('rattle', force);
        if (buf) plan.voices.push({ layer: 'rattle', buf, t: t + 0.008 + rnd() * 0.03, rate: rate * (m.grains ? 1 : 0.95 + rnd() * 0.1), gain: 0.7 * force * mul, tau: m.grains ? 0.05 : tail, off: 0 });
      }
      if (m.grains && S.bank.rattle) { const n = Math.round((1 + 5 * force * Math.min(size, 1.5)) * mul); for (let i = 0; i < n; i++) { const b = pickBuf('rattle', force * 0.5); if (b) plan.voices.push({ layer: 'rattle', buf: b, t: t + 0.03 + rnd() * rnd() * 0.35, rate: rate * (0.8 + rnd() * 0.5), gain: 0.22 * force * (0.3 + rnd()), tau: 0.03, off: 0 }); } }
      if (m.tinkle) { const n = Math.round((2 + 8 * force) * mul); for (let i = 0; i < n; i++) plan.debris.push({ kind: 'ping', t: 0.03 + rnd() * rnd() * 0.5, f: 3000 + rnd() * 7000, decay: 0.08 + rnd() * 0.15, amp: 0.1 * force * (0.4 + rnd()) }); }
    }
    // низ: толчок массы
    const tl = lay('thump'); if (tl.on !== false && m.thump > 0) {
      const f0 = clamp(55 * Math.pow(size, 0.6) * ((tl.tone ?? 100) / 100), 30, 160);
      plan.thump = { f0, decay: (0.06 + 0.16 * Math.min(size, 2) / 2) * Math.max(0.4, P.damp), amp: 0.85 * m.thump * Math.pow(force, 1.3) };
    }
    return plan;
  }
  function planEvent(set, t0, opts = {}) {
    const P = S.P, n = opts.bounces ?? Math.round(P.bounces), plans = [planHit(set, t0, 1, true)];
    let t = t0, gap = 0.16 * Math.pow(P.size, 0.5) * (0.8 + 0.4 * rnd()), f = 1;
    for (let i = 0; i < n; i++) { t += gap; f *= Math.pow(P.rest, 1.6); gap *= P.rest * (0.9 + 0.2 * rnd()); if (f < 0.02) break; plans.push(planHit(set, t, f, false)); }
    return plans;
  }
  const planLength = plans => Math.min(8, Math.max(...plans.map(p => p.t + Math.max(0.15, ...p.modes.map(m => m.decay * 1.4), p.thump ? p.thump.decay * 1.5 : 0,
    ...p.debris.map(d => d.t + (d.decay || 0) * 1.5), ...p.voices.map(v => v.t - p.t + (v.tau ? Math.min(v.buf.duration / v.rate, v.tau * 8) : v.buf.duration / v.rate))))) + 0.15);

  // ---------- проигрывание плана ----------
  function playPlan(plan, ctx, comps) {
    const t = Math.max(plan.t, ctx.currentTime), L = plan.level, dest = id => comps.get(id)?.input;
    if (ctx === audio.ctx) S.onHit?.('strike', t);
    for (const v of plan.voices) {
      const d = dest(v.layer); if (!d) continue;
      const src = ctx.createBufferSource(); src.buffer = v.buf; src.playbackRate.value = v.rate;
      const g = ctx.createGain(); g.gain.value = v.gain * L; let head = src;
      if (v.shelf) { const sh = ctx.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 3000; sh.gain.value = v.shelf; head.connect(sh); head = sh; }
      head.connect(g).connect(d);
      const tv = Math.max(v.t, t), dur = v.buf.duration / v.rate;
      if (v.tau) { g.gain.setValueAtTime(v.gain * L, tv + 0.02); g.gain.setTargetAtTime(0, tv + 0.02, v.tau); }
      src.start(tv, v.off || 0); src.stop(tv + (v.tau ? Math.min(dur, v.tau * 8) : dur) + 0.02); S.voices++;
      if (ctx === audio.ctx) src.onended = () => { src.disconnect(); g.disconnect(); };
    }
    if (plan.strike && dest('strike') && plan.strike.amp > 0.001) {
      const s = plan.strike, src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(s.cut, 200, 18000); lp.Q.value = 0.8;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(s.amp * L, t + 0.0004); g.gain.setTargetAtTime(0, t + s.len * 0.4, s.len / 3);
      src.connect(lp).connect(hp).connect(g).connect(dest('strike')); src.start(t, s.off); src.stop(t + s.len * 4 + 0.03); S.voices++;
    }
    const body = dest('body');
    if (body) for (const m of plan.modes) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = m.f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(m.amp * L, t + 0.0008); g.gain.setTargetAtTime(0, t + 0.001, m.decay / 6.9);
      o.connect(g).connect(body); o.start(t); o.stop(t + m.decay * 1.5 + 0.05); S.voices++;
      if (ctx === audio.ctx) o.onended = () => { o.disconnect(); g.disconnect(); };
    }
    if (plan.thump && dest('thump')) {
      const th = plan.thump, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(th.f0 * 2.2, t); o.frequency.exponentialRampToValueAtTime(th.f0, t + 0.025);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(th.amp * L, t + 0.002); g.gain.setTargetAtTime(0, t + 0.004, th.decay / 6.9);
      o.connect(g).connect(dest('thump')); o.start(t); o.stop(t + th.decay * 1.6 + 0.05); S.voices++;
    }
    const deb = dest('rattle');
    if (deb) for (const d of plan.debris) {
      const td = t + d.t, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = clamp(d.f, 100, 18000);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, td); g.gain.linearRampToValueAtTime(d.amp * L, td + 0.0006); g.gain.setTargetAtTime(0, td + 0.001, d.decay / 6.9);
      o.connect(g).connect(deb); o.start(td); o.stop(td + d.decay * 1.6 + 0.03); S.voices++;
    }
  }

  // ---------- живой удар ----------
  function trigger(what) {
    if (!S.set) return;
    ensureAudio(); ensureBus();
    if (!Object.keys(S.bank).length && !S.total) load(S.set);
    const t0 = audio.ctx.currentTime + 0.01;
    const plans = what === 'drop' ? planEvent(S.set, t0, { bounces: Math.max(3, Math.round(S.P.bounces)) }) : planEvent(S.set, t0);
    for (const p of plans) playPlan(p, audio.ctx, S.comps);
    S.hits++;
    S.onStatus(`${matOf(S.set).name}: ${plans.length > 1 ? plans.length - 1 + ' отскоков, ' : ''}${plans[0].voices.length} записей, ${plans[0].modes.length} мод${S.loaded < S.total ? ' · записи ещё грузятся' : ''}`);
  }
  function render(ctx, set, plans, opts = {}) {
    const bus = buildBus(ctx, { audible: opts.audible });
    for (const p of plans) playPlan(p, ctx, bus.comps);
    return { out: bus.out, voices: plans.length };
  }

  // ---------- выбор материала ----------
  const pickers = set => [{ id: 'material', name: 'Материал', value: set.select.material, items: MAT_LIST.map(k => ({ id: k, name: MATERIALS[k].name, icon: MATERIALS[k].icon })) }];
  function pick(set, what, v) { if (what === 'material' && MATERIALS[v]) set.select.material = v; }
  const matName = set => matOf(set).name;
  const ready = () => S.total > 0 && S.loaded >= S.total;

  // ---------- панель слева и ручки слоя ----------
  const PARAMS = { strike: ['rec', 'запись', 0, 150, '%'], body: ['synth', 'синтез', 0, 200, '%'], rattle: ['count', 'кол-во', 0, 300, '%'], thump: ['tone', 'тон', 50, 200, '%'] };
  function layerHtml(l) {
    const [k, name, lo, hi, unit] = PARAMS[l.id];
    return `<div class="wl-head"><label><input type="checkbox" data-on${l.on !== false ? ' checked' : ''}> ${l.name}</label><span class="sum">${l.hint}</span></div>
      <div class="wl-row"><span class="lbl">${name}</span><input type="range" class="thin" data-p="${k}" min="${lo}" max="${hi}" value="${l[k] ?? 100}"><span class="val" data-pv>${l[k] ?? 100}${unit}</span></div>`;
  }
  function bindLayer(box, l, hooks) {
    Knob.convert(box);
    const [k, , , , unit] = PARAMS[l.id];
    const on = box.querySelector('[data-on]'); if (on) on.onchange = e => { l.on = e.target.checked; box.classList.toggle('off', !l.on); hooks?.onSelect?.(); };
    const r = box.querySelector('[data-p]'); r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
    r.oninput = () => { l[k] = +r.value; box.querySelector('[data-pv]').textContent = r.value + unit; r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); };
  }
  function renderLayerControls(el, set, l, hooks) { el.innerHTML = layerHtml(l); bindLayer(el, l, hooks); }
  function renderPanel(el, set, hooks) {
    el.innerHTML = `
      <div class="sel"><label>Материал</label><select data-pick="material">${MAT_LIST.map(k => `<option value="${k}"${k === set.select.material ? ' selected' : ''}>${MATERIALS[k].name}</option>`).join('')}</select></div>
      <div class="progress">${matOf(set).hint}</div>
      <div class="trig">
        <button class="btn go" data-trig="hit" title="клавиша H">Удар</button>
        <button class="btn" data-trig="drop" title="клавиша D">Бросок</button>
      </div>
      <div class="progress" id="hitsProgress"></div>
      <h3>Слои удара</h3>
      ${set.layers.map(l => `<div class="wl${l.on === false ? ' off' : ''}" data-l="${l.id}">${layerHtml(l)}</div>`).join('')}`;
    el.querySelector('select[data-pick]').onchange = e => { if (hooks.onPick) hooks.onPick('material', e.target.value); else { pick(set, 'material', e.target.value); hooks.onSelect?.(); renderPanel(el, set, hooks); } };
    for (const b of el.querySelectorAll('[data-trig]')) b.onclick = () => trigger(b.dataset.trig);
    for (const box of el.querySelectorAll('.wl')) bindLayer(box, set.layers.find(x => x.id === box.dataset.l), hooks);
    S.onStatus = t => { const p = document.getElementById('hitsProgress'); if (p) p.textContent = t; };
    S.onProgress = (n, m) => { const p = document.getElementById('hitsProgress'); if (p && n < m) p.textContent = `записи: ${n} / ${m}`; };
  }

  return { init, load, renderPanel, renderLayerControls, setParams, applyUserGain, trigger, planEvent, planLength, playPlan, render, buildBus, characterValues, layerJson,
           pickers, pick, matName, ready, MATERIALS, LAYERS, MACROS, CHARACTERS, get state() { return S; } };
})();

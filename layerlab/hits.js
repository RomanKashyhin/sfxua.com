// SFX Lab · движок ударов по предметам (набор kind: "hits"). Синтез по физике, без библиотеки:
// удар = возбудитель (короткий шумовой импульс, его длина и яркость — «жёсткость» и «сила») × резонатор предмета
// (банк мод: набор частот и затуханий, свой у металла, дерева, пластика, стекла, камня, ткани, земли)
// + «низ» (глухой толчок массы с падением тона) + «крошка» (дребезг, осыпание, звон осколков, шорох ткани — зависит от
// материала). «Размер» сдвигает все моды вниз и удлиняет хвост, «глухость» глушит хвост и верхние моды (как рука на
// предмете), «отскоки» — брошенный предмет с убывающими ударами. Так устроены Wwise SoundSeed Impact, SDT (Rocchesso),
// FoleyAutomatic (van den Doel & Pai): возбудитель × модальный резонатор. Подробности — ANALYSIS, часть 12.

const Hits = (() => {
  // ---------- материалы: отношения частот мод, затухания (с, при размере 1), базовая частота, характер ----------
  const MATERIALS = {
    metal:   { name: 'металл',  icon: 'mat-metal',   base: 420,  ratios: [1, 2.76, 5.40, 8.93, 13.34, 18.6], decay: [1.6, 1.2, 0.9, 0.7, 0.5, 0.4], noiseCut: 9000, noiseLen: 1,   noise: 0.35, thump: 0.5, debris: 'rattle',  hint: 'звенит долго, негармонично, как пластина или кастрюля' },
    wood:    { name: 'дерево',  icon: 'mat-wood',    base: 330,  ratios: [1, 2.2, 3.4, 4.9, 6.6],              decay: [0.25, 0.18, 0.12, 0.09, 0.06], noiseCut: 4500, noiseLen: 1.4, noise: 0.7,  thump: 0.8, debris: 'none',    hint: 'тёплый короткий стук, быстро гаснет' },
    plastic: { name: 'пластик', icon: 'mat-plastic', base: 380,  ratios: [1, 1.9, 3.1, 4.4],                   decay: [0.12, 0.08, 0.06, 0.04],       noiseCut: 3200, noiseLen: 1.6, noise: 0.85, thump: 0.5, debris: 'none',    hint: 'тупой пустой щелчок, почти без звона' },
    glass:   { name: 'стекло',  icon: 'mat-glass',   base: 1400, ratios: [1, 2.3, 4.1, 6.4, 9.2, 12.5],         decay: [0.9, 0.7, 0.5, 0.4, 0.3, 0.2], noiseCut: 12000, noiseLen: 0.7, noise: 0.3, thump: 0.2, debris: 'tinkle',  hint: 'высокий чистый звон, осколки' },
    stone:   { name: 'камень',  icon: 'mat-stone',   base: 520,  ratios: [1, 1.7, 2.9, 4.6],                   decay: [0.09, 0.07, 0.05, 0.04],       noiseCut: 6500, noiseLen: 1.2, noise: 1.0,  thump: 0.9, debris: 'crumble', hint: 'сухой плотный щелчок с осыпанием' },
    cloth:   { name: 'ткань',   icon: 'mat-cloth',   base: 0,    ratios: [],                                   decay: [],                             noiseCut: 1300, noiseLen: 30,  noise: 1.0,  thump: 0.7, debris: 'rustle',  hint: 'мягкий глухой шлепок и шорох' },
    dirt:    { name: 'земля',   icon: 'mat-dirt',    base: 160,  ratios: [1, 1.5],                             decay: [0.05, 0.04],                   noiseCut: 2200, noiseLen: 3,   noise: 1.0,  thump: 1.0, debris: 'crumble', hint: 'тяжёлый глухой шлепок, крошка' },
  };
  const MAT_LIST = Object.keys(MATERIALS);

  // ---------- слои удара ----------
  const LAYERS = [
    { id: 'strike', name: 'удар',    gain: 80, len: 100,  hint: 'сам контакт: короткий шумовой импульс, его длина и яркость' },
    { id: 'body',   name: 'тело',    gain: 80, modes: 6,  hint: 'резонанс предмета: моды материала, затухание по размеру' },
    { id: 'thump',  name: 'низ',     gain: 70, tone: 100, hint: 'толчок массы: низкий тон с падением высоты' },
    { id: 'debris', name: 'крошка',  gain: 60, count: 100, hint: 'после удара: дребезг, осыпание, осколки или шорох — по материалу' },
  ];

  // ---------- макросы ----------
  const MACROS = [
    { id: 'drive', name: 'Жёсткость', default: 50, hub: true, hint: 'мягко ↔ жёстко: короче и ярче контакт, больше верхних мод', map: [ { layer: 'global', param: 'hard', from: 0, to: 1 } ] },
    { id: 'force', name: 'Сила', default: 50, dial: true, hint: 'лёгкий ↔ сильный: громкость, яркость, крошка',
      zones: [{ at: 15, name: 'легко', icon: 'feather' }, { at: 50, name: 'средне', icon: 'hammer' }, { at: 90, name: 'сильно', icon: 'zap' }],
      map: [ { layer: 'global', param: 'force', from: 0.08, to: 1 } ] },
    { id: 'size', name: 'Размер', default: 50, dial: true, hint: 'мелкий ↔ крупный предмет: моды ниже, хвост длиннее',
      zones: [{ at: 12, name: 'мелкий', icon: 'grid' }, { at: 50, name: 'средний', icon: 'layers' }, { at: 88, name: 'крупный', icon: 'room' }],
      map: [ { layer: 'global', param: 'size', from: 0.4, to: 2.6, curve: 'log' } ] },
    { id: 'damp', name: 'Глухость', default: 40, hint: 'звонко ↔ глухо: как рука на предмете, гасит хвост и верх', map: [ { layer: 'global', param: 'damp', from: 2.2, to: 0.2, curve: 'log' } ] },
    { id: 'bounce', name: 'Отскоки', default: 0, hint: 'брошенный предмет: сколько отскоков и как быстро гаснут', sub: [
      { id: 'count', name: 'Сколько',  default: 0,  map: [ { layer: 'global', param: 'bounces', from: 0, to: 6 } ] },
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

  // ---------- характеры ----------
  const CHARACTERS = [
    { id: 'pan',     name: 'Кастрюля, удар ложкой',          select: { material: 'metal' },   values: { drive: 70, force: 55, size: 42, damp: 30, bounce: 0, 'bounce.count': 0, variation: 40 } },
    { id: 'drum',    name: 'Бочка железная, кулаком',        select: { material: 'metal' },   values: { drive: 35, force: 70, size: 85, damp: 45, bounce: 0, 'bounce.count': 0, variation: 40 } },
    { id: 'plank',   name: 'Доска упала на пол',             select: { material: 'wood' },    values: { drive: 55, force: 65, size: 70, damp: 40, bounce: 40, 'bounce.count': 40, 'bounce.rest': 45, variation: 50 } },
    { id: 'bucket',  name: 'Пластиковое ведро',              select: { material: 'plastic' }, values: { drive: 45, force: 50, size: 60, damp: 35, bounce: 20, 'bounce.count': 25, 'bounce.rest': 55, variation: 45 } },
    { id: 'bottle',  name: 'Стакан поставили на стол',       select: { material: 'glass' },   values: { drive: 60, force: 30, size: 35, damp: 50, bounce: 0, 'bounce.count': 0, variation: 35 } },
    { id: 'rock',    name: 'Камень о камень',                select: { material: 'stone' },   values: { drive: 80, force: 70, size: 50, damp: 60, bounce: 15, 'bounce.count': 20, 'bounce.rest': 50, variation: 50 } },
    { id: 'pillow',  name: 'Подушка / мешок с тряпками',     select: { material: 'cloth' },   values: { drive: 15, force: 60, size: 70, damp: 70, bounce: 0, 'bounce.count': 0, variation: 45 } },
    { id: 'sack',    name: 'Мешок на землю',                 select: { material: 'dirt' },    values: { drive: 25, force: 80, size: 75, damp: 60, bounce: 0, 'bounce.count': 0, variation: 45 } },
  ];

  // ---------- состояние ----------
  const S = { set: null, P: { ...DEFAULT_P }, bus: null, comps: new Map(), onStatus: () => {}, onHit: null, hits: 0, voices: 0, rng: null, distParams: null, noise: new Map(), lastPlan: null };
  const rnd = () => S.rng ? S.rng() : Math.random();
  const dbToGain = db => Math.pow(10, db / 20);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const matOf = set => MATERIALS[set?.select?.material] || MATERIALS.metal;
  const layerOf = id => S.set?.layers.find(l => l.id === id) || LAYERS.find(l => l.id === id);

  function init(set) {
    const saved = set.layers || [];
    set.layers = LAYERS.map(c => ({ ...c, ...(saved.find(l => l.id === c.id) || {}) }));
    set.macros = set.macros?.length ? set.macros : JSON.parse(JSON.stringify(MACROS));
    set.characters = CHARACTERS;
    set.select = { material: 'metal', ...(set.select || {}) };
    if (!MATERIALS[set.select.material]) set.select.material = 'metal';
    S.set = set;
  }
  async function load(set) { S.set = set; if (!audio.ctx) return; ensureBus(); S.onStatus('удары: ' + matOf(set).name + ' — H удар, D бросок'); }
  const layerJson = l => ({ id: l.id, on: l.on, gain: l.gain, len: l.len, modes: l.modes, tone: l.tone, count: l.count });
  function characterValues(id) { const ch = CHARACTERS.find(c => c.id === id); return ch ? { select: { ...ch.select }, values: { ...ch.values } } : null; }

  // ---------- граф ----------
  // Шина ударов на любом контексте: слой → пользовательская громкость → модули ниточки → анализатор → сумма → шина набора
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
    let seed = 1234567; for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }   // один и тот же шум вживую и в экспорте
    S.noise.set(key, buf); return buf;
  }

  // ---------- план удара ----------
  // Все случайности считаются здесь (сеяно при экспорте), проигрывание детерминировано: один план = один и тот же звук.
  function planHit(set, t0, forceMul = 1, first = true) {
    const P = S.P, m = matOf(set), lay = id => set.layers.find(l => l.id === id) || {};
    const force = clamp(P.force * forceMul, 0.03, 1), hard = P.hard, size = P.size;
    const jitter = (rnd() * 2 - 1) * P.randTime / 1000, pitch = Math.pow(2, (rnd() * 2 - 1) * P.randPitch / 1200), level = dbToGain((rnd() * 2 - 1) * P.randGain);
    const t = t0 + Math.max(0, jitter), decayScale = Math.pow(1 / size, 0.7) * P.damp;
    const plan = { t, material: set.select.material, force, hard, size, level, pitch, strike: null, modes: [], thump: null, debris: [] };
    // удар: длина импульса от жёсткости и материала, яркость от силы и жёсткости
    const sl = lay('strike'); if (sl.on !== false) {
      const len = (0.0006 + (1 - hard) * 0.006) * m.noiseLen * ((sl.len ?? 100) / 100);
      plan.strike = { len, cut: m.noiseCut * (0.35 + 0.65 * Math.pow(force, 0.7)) * (0.6 + 0.6 * hard), amp: 0.9 * Math.pow(force, 1.1) * m.noise, off: rnd() * 1.5 };
    }
    // тело: моды материала; верхних мод больше при силе и жёсткости, глухость гасит хвост и верх
    const bl = lay('body'); if (bl.on !== false && m.ratios.length) {
      const n = Math.min(m.ratios.length, Math.max(1, Math.round(bl.modes ?? 6))), p = 1.9 - 1.2 * clamp(force * (0.4 + 0.9 * hard), 0, 1);
      for (let i = 0; i < n; i++) {
        const f = m.base * pitch / size * m.ratios[i] * (1 + (rnd() - 0.5) * 0.03); if (f > 18000 || f < 25) continue;
        const dampHi = P.damp < 1 ? Math.pow(P.damp, i * 0.35) : 1;
        plan.modes.push({ f, decay: m.decay[i] * decayScale * (0.8 + 0.4 * rnd()), amp: 0.55 * force * Math.pow(i + 1, -p) * dampHi });
      }
    }
    // низ: толчок массы
    const tl = lay('thump'); if (tl.on !== false && m.thump > 0) {
      const f0 = clamp(55 * Math.pow(size, 0.6) * ((tl.tone ?? 100) / 100), 30, 160);
      plan.thump = { f0, decay: (0.06 + 0.16 * Math.min(size, 2) / 2) * Math.max(0.4, P.damp), amp: 0.85 * m.thump * Math.pow(force, 1.3) };
    }
    // крошка: по материалу; у отскоков её меньше
    const dl = lay('debris'); if (dl.on !== false && m.debris !== 'none') {
      const mul = (dl.count ?? 100) / 100 * (first ? 1 : 0.35);
      if (m.debris === 'rattle') { const n = Math.round((2 + 7 * force * Math.min(size, 1.5)) * mul); for (let i = 0; i < n; i++) plan.debris.push({ kind: 'ping', t: 0.02 + rnd() * rnd() * 0.3, f: (1500 + rnd() * 4500) / Math.pow(size, 0.4), decay: 0.03 + rnd() * 0.06, amp: 0.12 * force * (0.4 + rnd()) }); }
      else if (m.debris === 'tinkle') { const n = Math.round((2 + 8 * force) * mul); for (let i = 0; i < n; i++) plan.debris.push({ kind: 'ping', t: 0.03 + rnd() * rnd() * 0.5, f: 3000 + rnd() * 7000, decay: 0.08 + rnd() * 0.15, amp: 0.1 * force * (0.4 + rnd()) }); }
      else if (m.debris === 'crumble') { const n = Math.round((3 + 12 * force * Math.min(size, 1.5)) * mul); for (let i = 0; i < n; i++) plan.debris.push({ kind: 'grain', t: 0.012 + rnd() * rnd() * 0.35, len: 0.004 + rnd() * 0.016, cut: 1200 + rnd() * 2800, amp: 0.18 * force * (0.3 + rnd()), off: rnd() * 1.5 }); }
      else if (m.debris === 'rustle') plan.debris.push({ kind: 'grain', t: 0.005, len: 0.06 + 0.1 * size * rnd(), cut: 500 + rnd() * 500, amp: 0.25 * force, off: rnd() * 1.5 });
    }
    return plan;
  }
  // серия: удар и отскоки брошенного предмета (упругость → убывающие паузы и сила)
  function planEvent(set, t0, opts = {}) {
    const P = S.P, n = opts.bounces ?? Math.round(P.bounces), plans = [planHit(set, t0, 1, true)];
    let t = t0, gap = 0.16 * Math.pow(P.size, 0.5) * (0.8 + 0.4 * rnd()), f = 1;
    for (let i = 0; i < n; i++) { t += gap; f *= Math.pow(P.rest, 1.6); gap *= P.rest * (0.9 + 0.2 * rnd()); if (f < 0.02) break; plans.push(planHit(set, t, f, false)); }
    return plans;
  }
  const planLength = plans => Math.min(6, Math.max(...plans.map(p => p.t + Math.max(0.15, ...p.modes.map(m => m.decay * 1.4), p.thump ? p.thump.decay * 1.5 : 0, ...p.debris.map(d => d.t + (d.decay || d.len || 0) * 1.5)))) + 0.15);

  // ---------- проигрывание плана на любом контексте ----------
  function playPlan(plan, ctx, comps) {
    const t = Math.max(plan.t, ctx.currentTime), L = plan.level, stopAt = [];
    const dest = id => comps.get(id)?.input;
    if (ctx === audio.ctx) S.onHit?.('strike', t);
    // удар: шумовой импульс через LP/HP
    if (plan.strike && dest('strike')) {
      const s = plan.strike, src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(s.cut, 200, 18000); lp.Q.value = 0.8;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(s.amp * L, t + 0.0004); g.gain.setTargetAtTime(0, t + s.len * 0.4, s.len / 3);
      src.connect(lp).connect(hp).connect(g).connect(dest('strike')); src.start(t, s.off); src.stop(t + s.len * 4 + 0.03); S.voices++;
    }
    // тело: синус на моду с экспоненциальным хвостом
    const body = dest('body');
    if (body) for (const m of plan.modes) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = m.f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(m.amp * L, t + 0.0008); g.gain.setTargetAtTime(0, t + 0.001, m.decay / 6.9);
      o.connect(g).connect(body); o.start(t); o.stop(t + m.decay * 1.5 + 0.05); S.voices++;
      if (ctx === audio.ctx) o.onended = () => { o.disconnect(); g.disconnect(); };
    }
    // низ: тон падает вдвое за 25 мс
    if (plan.thump && dest('thump')) {
      const th = plan.thump, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(th.f0 * 2.2, t); o.frequency.exponentialRampToValueAtTime(th.f0, t + 0.025);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(th.amp * L, t + 0.002); g.gain.setTargetAtTime(0, t + 0.004, th.decay / 6.9);
      o.connect(g).connect(dest('thump')); o.start(t); o.stop(t + th.decay * 1.6 + 0.05); S.voices++;
    }
    // крошка: пинги или зёрна шума
    const deb = dest('debris');
    if (deb) for (const d of plan.debris) {
      const td = t + d.t;
      if (d.kind === 'ping') {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = clamp(d.f, 100, 18000);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, td); g.gain.linearRampToValueAtTime(d.amp * L, td + 0.0006); g.gain.setTargetAtTime(0, td + 0.001, d.decay / 6.9);
        o.connect(g).connect(deb); o.start(td); o.stop(td + d.decay * 1.6 + 0.03);
      } else {
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = d.cut;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, td); g.gain.linearRampToValueAtTime(d.amp * L, td + 0.002); g.gain.setTargetAtTime(0, td + d.len * 0.5, d.len / 3);
        src.connect(lp).connect(g).connect(deb); src.start(td, d.off); src.stop(td + d.len * 4 + 0.03);
      }
      S.voices++;
    }
  }

  // ---------- живой удар ----------
  function trigger(what) {
    if (!S.set) return;
    ensureAudio(); ensureBus();
    const t0 = audio.ctx.currentTime + 0.01;
    const plans = what === 'drop' ? planEvent(S.set, t0, { bounces: Math.max(3, Math.round(S.P.bounces)) }) : planEvent(S.set, t0);
    for (const p of plans) playPlan(p, audio.ctx, S.comps);
    S.hits++; S.lastPlan = plans;
    S.onStatus(`${matOf(S.set).name}: ${plans.length > 1 ? plans.length - 1 + ' отскоков, ' : ''}${plans[0].modes.length} мод, ${plans[0].debris.length} крошек`);
  }
  // экспорт: тот же план на офлайн-контексте, слои по opts.audible
  function render(ctx, set, plans, opts = {}) {
    const bus = buildBus(ctx, { audible: opts.audible });
    for (const p of plans) playPlan(p, ctx, bus.comps);
    return { out: bus.out, voices: plans.length };
  }

  // ---------- выбор материала (дуга на схеме, список слева) ----------
  const pickers = set => [{ id: 'material', name: 'Материал', value: set.select.material, items: MAT_LIST.map(k => ({ id: k, name: MATERIALS[k].name, icon: MATERIALS[k].icon })) }];
  function pick(set, what, v) { if (what === 'material' && MATERIALS[v]) set.select.material = v; }
  const matName = set => matOf(set).name;

  // ---------- панель слева и ручки слоя ----------
  const PARAMS = { strike: ['len', 'длина', 30, 300, '%'], body: ['modes', 'мод', 1, 6, ''], thump: ['tone', 'тон', 50, 200, '%'], debris: ['count', 'кол-во', 0, 300, '%'] };
  function layerHtml(l) {
    const [k, name, lo, hi, unit] = PARAMS[l.id];
    return `<div class="wl-head"><label><input type="checkbox" data-on${l.on !== false ? ' checked' : ''}> ${l.name}</label><span class="sum">${l.hint}</span></div>
      <div class="wl-row"><span class="lbl">${name}</span><input type="range" class="thin" data-p="${k}" min="${lo}" max="${hi}" value="${l[k] ?? (hi + lo) / 2}"><span class="val" data-pv>${l[k] ?? ''}${unit}</span></div>`;
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
  }

  return { init, load, renderPanel, renderLayerControls, setParams, applyUserGain, trigger, planEvent, planLength, playPlan, render, buildBus, characterValues, layerJson,
           pickers, pick, matName, MATERIALS, LAYERS, MACROS, CHARACTERS, get state() { return S; } };
})();

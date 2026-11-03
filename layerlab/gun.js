// SFX Lab · движок выстрелов из револьвера (набор kind: "gun"). Синтез по слоям, как собирают выстрел профи
// (Krotos Weaponiser: onset / body / thump / tail; библиотеки BOOM Guns и Watson Wu: механика, выстрел вблизи, хвост
// отдельно): механика (взвод курка, трещотка барабана, спуск), хлопок (ударная волна, 1…3 мс), выстрел (дульный
// выхлоп, полоса по калибру и стволу, сатурация), низ (толчок 45…70 Гц с падением тона), хвост (выстрел через
// импульсную характеристику окружения: поле, лес, город, комната, бункер). Записей выстрелов в библиотеке нет,
// поэтому всё синтез; слои сложены так, что сумма файлов равна миксу. ANALYSIS, часть 13.

const Gun = (() => {
  // ---------- калибры: полоса выстрела, длина, доля хлопка и низа, сатурация ----------
  const CALIBERS = {
    '22':  { name: '.22 LR',      icon: 'gun', f: 900, len: 0.025, crack: 0.9,  sub: 0.25, level: 0.6,  sat: 2, f0: 70, hint: 'мелкий: сухой щелчок, почти без низа' },
    '38':  { name: '.38 Special', icon: 'gun', f: 520, len: 0.045, crack: 0.8,  sub: 0.6,  level: 0.85, sat: 4, f0: 60, hint: 'полицейский: плотный хлопок, умеренный низ' },
    '357': { name: '.357 Magnum', icon: 'gun', f: 420, len: 0.06,  crack: 1.0,  sub: 0.85, level: 1.0,  sat: 6, f0: 55, hint: 'резкий и злой: сильный хлопок, много низа' },
    '44':  { name: '.44 Magnum',  icon: 'gun', f: 300, len: 0.085, crack: 0.85, sub: 1.0,  level: 1.0,  sat: 7, f0: 46, hint: 'тяжёлый: глубокий выхлоп, длинный низ' },
    '45':  { name: '.45 Colt',    icon: 'gun', f: 360, len: 0.07,  crack: 0.7,  sub: 0.9,  level: 0.95, sat: 5, f0: 50, hint: 'вестерн: мягче хлопок, круглый низ' },
  };
  const CAL_LIST = Object.keys(CALIBERS);
  // ---------- окружения для хвоста: длина, как быстро гаснет верх, ранние отражения, плотность, флаттер ----------
  const ENVS = {
    field:  { name: 'поле',    len: 1.3, hf: 0.25, early: [],                                             dense: 0.5, pre: 0.010, flutter: 0,     gain: 0.35 },
    forest: { name: 'лес',     len: 1.7, hf: 0.12, early: [],                                             dense: 0.8, pre: 0.015, flutter: 0,     gain: 0.4 },
    city:   { name: 'город',   len: 2.4, hf: 0.4,  early: [[0.09, 0.5], [0.17, 0.35], [0.31, 0.25], [0.46, 0.15]], dense: 0.4, pre: 0.020, flutter: 0, gain: 0.45 },
    room:   { name: 'комната', len: 0.55, hf: 0.5, early: [[0.011, 0.6], [0.022, 0.45], [0.033, 0.35]],     dense: 1.0, pre: 0.003, flutter: 0.011, gain: 0.5 },
    bunker: { name: 'бункер',  len: 3.0, hf: 0.3,  early: [[0.02, 0.5], [0.04, 0.4]],                       dense: 1.0, pre: 0.005, flutter: 0.019, gain: 0.5 },
  };
  const ENV_LIST = Object.keys(ENVS);

  // ---------- слои ----------
  const LAYERS = [
    { id: 'mech',  name: 'механика', gain: 70, speed: 100, hint: 'взвод курка, трещотка барабана, спуск — щелчки металла до и в момент выстрела' },
    { id: 'crack', name: 'хлопок',   gain: 80, len: 100,   hint: 'ударная волна у дула: 1…3 мс, верх, самое резкое в выстреле' },
    { id: 'blast', name: 'выстрел',  gain: 80, sat: 100,   hint: 'дульный выхлоп: полоса по калибру и стволу, сатурация, 25…90 мс' },
    { id: 'sub',   name: 'низ',      gain: 70, tone: 100,  hint: 'толчок 45…70 Гц с падением тона — вес и отдача' },
    { id: 'tail',  name: 'хвост',    gain: 75, size: 100,  hint: 'выстрел через импульс окружения: поле, лес, город, комната, бункер' },
  ];

  // ---------- макросы ----------
  const MACROS = [
    { id: 'drive', name: 'Жёсткость', default: 50, hub: true, hint: 'мягко ↔ резко: доля хлопка и верха выхлопа', map: [ { layer: 'global', param: 'hard', from: 0, to: 1 } ] },
    { id: 'barrel', name: 'Ствол', default: 40, dial: true, hint: 'короткий ↔ длинный ствол: короткий громче и ярче, длинный глубже',
      zones: [{ at: 8, name: '2″', icon: 'gun' }, { at: 40, name: '4″', icon: 'gun' }, { at: 72, name: '6″', icon: 'gun' }, { at: 96, name: '8″', icon: 'gun' }],
      map: [ { layer: 'global', param: 'barrel', from: 2, to: 8 } ] },
    { id: 'env', name: 'Окружение', default: 0, dial: true, hint: 'где стреляют: хвост выстрела',
      zones: [{ at: 0, name: 'поле', icon: 'sun' }, { at: 25, name: 'лес', icon: 'mat-wood' }, { at: 50, name: 'город', icon: 'room' }, { at: 75, name: 'комната', icon: 'grid' }, { at: 100, name: 'бункер', icon: 'mat-metal' }],
      map: [ { layer: 'global', param: 'env', from: 0, to: 1 } ] },
    { id: 'mech', name: 'Механика', default: 35, hint: 'громкость щелчков курка и барабана', map: [ { layer: 'global', param: 'mech', from: 0, to: 1 } ] },
    { id: 'burst', name: 'Серия', default: 0, hint: 'несколько выстрелов подряд: сколько и как быстро', sub: [
      { id: 'n',   name: 'Сколько',  default: 0,  map: [ { layer: 'global', param: 'shots', from: 1, to: 6 } ] },
      { id: 'gap', name: 'Интервал', default: 40, map: [ { layer: 'global', param: 'gap', from: 0.09, to: 0.6, curve: 'log' } ] },
    ] },
    { id: 'variation', name: 'Разброс', default: 35, hint: 'машинно ↔ живо: случайный тон, громкость, время', sub: [
      { id: 'pitch', name: 'Тон',       default: 35, map: [ { layer: 'global', param: 'randPitch', from: 0, to: 80 } ] },
      { id: 'gain',  name: 'Громкость', default: 35, map: [ { layer: 'global', param: 'randGain', from: 0, to: 4 } ] },
      { id: 'time',  name: 'Время',     default: 35, map: [ { layer: 'global', param: 'randTime', from: 0, to: 30 } ] },
    ] },
    { id: 'dist', kind: 'distance', name: 'Дистанция', default: 0, hint: '1…200 м от слушателя: вдали остаётся низ и хвост', hs: 1.4, hr: 1.6 },
  ];
  const DEFAULT_P = { hard: 0.5, barrel: 4, env: 0, mech: 0.35, shots: 1, gap: 0.2, randPitch: 28, randGain: 1.4, randTime: 10 };

  // ---------- характеры ----------
  const CHARACTERS = [
    { id: 'police', name: '.38 Special, улица',           select: { caliber: '38', action: 'da' },  values: { drive: 55, barrel: 40, env: 50, mech: 35, burst: 0, 'burst.n': 0, variation: 35 } },
    { id: 'magnum', name: '.357 Magnum, поле',            select: { caliber: '357', action: 'da' }, values: { drive: 65, barrel: 50, env: 0,  mech: 30, burst: 0, 'burst.n': 0, variation: 35 } },
    { id: 'snub',   name: '.38 снаб-нос 2″, комната',     select: { caliber: '38', action: 'da' },  values: { drive: 70, barrel: 8,  env: 75, mech: 40, burst: 0, 'burst.n': 0, variation: 40 } },
    { id: 'dirty',  name: '.44 Magnum 6″, город',         select: { caliber: '44', action: 'sa' },  values: { drive: 60, barrel: 72, env: 50, mech: 40, burst: 0, 'burst.n': 0, variation: 30 } },
    { id: 'west',   name: '.45 Colt, вестерн, каньон',    select: { caliber: '45', action: 'sa' },  values: { drive: 45, barrel: 72, env: 100, mech: 45, burst: 0, 'burst.n': 0, variation: 40 } },
    { id: 'fan',    name: '.45 Colt, веером (fanning)',   select: { caliber: '45', action: 'sa' },  values: { drive: 50, barrel: 50, env: 0,  mech: 50, burst: 60, 'burst.n': 80, 'burst.gap': 10, variation: 45 } },
    { id: 'small',  name: '.22 в лесу',                   select: { caliber: '22', action: 'sa' },  values: { drive: 60, barrel: 60, env: 25, mech: 40, burst: 0, 'burst.n': 0, variation: 40 } },
  ];

  // ---------- состояние ----------
  const S = { set: null, P: { ...DEFAULT_P }, bus: null, comps: new Map(), onStatus: () => {}, onHit: null, shots: 0, voices: 0, rng: null, distParams: null, noise: new Map(), irs: new Map() };
  const rnd = () => S.rng ? S.rng() : Math.random();
  const dbToGain = db => Math.pow(10, db / 20);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const calOf = set => CALIBERS[set?.select?.caliber] || CALIBERS['357'];
  const envKey = P => ENV_LIST[clamp(Math.round((P.env ?? 0) * (ENV_LIST.length - 1)), 0, ENV_LIST.length - 1)];

  function init(set) {
    const saved = set.layers || [];
    set.layers = LAYERS.map(c => ({ ...c, ...(saved.find(l => l.id === c.id) || {}) }));
    set.macros = set.macros?.length ? set.macros : JSON.parse(JSON.stringify(MACROS));
    set.characters = CHARACTERS;
    set.select = { caliber: '357', action: 'da', ...(set.select || {}) };
    if (!CALIBERS[set.select.caliber]) set.select.caliber = '357';
    S.set = set;
  }
  async function load(set) { S.set = set; if (!audio.ctx) return; ensureBus(); S.onStatus(`${calOf(set).name} · ${ENVS[envKey(S.P)].name} — F выстрел, C взвод, B серия`); }
  const layerJson = l => ({ id: l.id, on: l.on, gain: l.gain, speed: l.speed, len: l.len, sat: l.sat, tone: l.tone, size: l.size });
  function characterValues(id) { const ch = CHARACTERS.find(c => c.id === id); return ch ? { select: { ...ch.select }, values: { ...ch.values } } : null; }
  const ready = () => true;

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
  // детерминированный шум: один и тот же вживую и в экспорте
  function noiseBuffer(ctx) {
    const key = ctx.sampleRate + '@' + (ctx === audio.ctx ? 'live' : 'off');
    if (S.noise.has(key)) return S.noise.get(key);
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let seed = 987654; for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
    S.noise.set(key, buf); return buf;
  }
  // импульсная характеристика окружения: шум с экспоненциальным спадом, верх гаснет быстрее, ранние отражения, флаттер
  function tailIR(ctx, env, sizeMul) {
    const key = env + '@' + ctx.sampleRate + '@' + sizeMul.toFixed(2) + '@' + (ctx === audio.ctx ? 'live' : 'off');
    if (S.irs.has(key)) return S.irs.get(key);
    const E = ENVS[env], sr = ctx.sampleRate, len = E.len * sizeMul, n = Math.ceil(sr * (len + E.pre + 0.05)), buf = ctx.createBuffer(2, n, sr);
    let seed = 4242;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0; const tau = len / 6.9;
      for (let i = 0; i < n; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0; const w = seed / 2147483648 - 1, t = i / sr - E.pre; if (t < 0) continue;
        const a = Math.pow(E.hf, t / len);                               // верх гаснет быстрее низа: доля прямого шума падает со временем
        lp += (w - lp) * 0.12; const v = (w * a + lp * (1 - a)) * Math.exp(-t / tau);
        d[i] = v * (0.4 + 0.6 * E.dense) * (seed % 7 < 7 * E.dense ? 1 : 0.25);
      }
      for (const [tt, g] of E.early) { const i = Math.round((tt + E.pre) * sr); if (i < n) d[i] += g * (ch ? -1 : 1) * 0.8; }
      if (E.flutter) { const step = Math.round(E.flutter * sr); for (let i = n - 1; i >= step; i--) d[i] += d[i - step] * 0.45; }
      d[0] = 0;
    }
    let e = 0; for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) e += d[i] * d[i]; }
    const norm = Math.sqrt(2 / Math.max(e, 1e-9)) * E.gain;
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] *= norm; }
    S.irs.set(key, buf); return buf;
  }
  function satCurve(k) { const n = 1024, c = new Float32Array(n), norm = Math.tanh(k); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / norm; } return c; }

  // ---------- план выстрела ----------
  // Все случайности здесь (сеяно при экспорте). Механика до выстрела: самовзвод (DA) — трещотка барабана, взвод, спуск;
  // ручной взвод (SA) — только спуск (взвод играется отдельно клавишей C).
  function planShot(set, t0, opts = {}) {
    const P = S.P, c = calOf(set), lay = id => set.layers.find(l => l.id === id) || {};
    const hard = P.hard, barrel = P.barrel, k = (4 - barrel) / 2;            // k > 0: короче 4″
    const jitter = (rnd() * 2 - 1) * P.randTime / 1000, pitch = Math.pow(2, (rnd() * 2 - 1) * P.randPitch / 1200), level = dbToGain((rnd() * 2 - 1) * P.randGain);
    const t = t0 + Math.max(0, jitter);
    const plan = { t, caliber: set.select.caliber, env: envKey(P), level, mech: [], crack: null, blast: null, sub: null, tail: null };
    const ml = lay('mech'), sp = (ml.speed ?? 100) / 100, mg = P.mech * 0.5;
    if (ml.on !== false && mg > 0.001) {
      if (opts.cock) { plan.mech.push({ t: 0, kind: 'cock1', amp: mg }, { t: 0.07 * sp, kind: 'cock2', amp: mg }); for (let i = 0; i < 3; i++) plan.mech.push({ t: (0.012 + i * 0.02) * sp, kind: 'tick', amp: mg * 0.5 }); }
      else {
        if (set.select.action !== 'sa' && opts.first !== false) { for (let i = 0; i < 4; i++) plan.mech.push({ t: (-0.26 + i * 0.045) * sp, kind: 'tick', amp: mg * 0.55 }); plan.mech.push({ t: -0.09 * sp, kind: 'cock2', amp: mg * 0.8 }); }
        plan.mech.push({ t: -0.004, kind: 'fall', amp: mg });
      }
    }
    if (opts.cock) return plan;
    const cl = lay('crack'); if (cl.on !== false) plan.crack = { len: 0.0025 * (cl.len ?? 100) / 100 * Math.pow(0.85, k), amp: c.crack * (0.5 + 0.8 * hard) * Math.pow(1.25, k) * c.level, hp: 1500 * Math.pow(1.15, k), sat: 2 + 3 * hard, off: rnd() * 1.5 };
    const bl = lay('blast'); if (bl.on !== false) plan.blast = { f: c.f * Math.pow(1.3, k) * pitch, len: c.len * Math.pow(0.9, k), amp: 0.9 * c.level, sat: c.sat * (bl.sat ?? 100) / 100 * (0.6 + 0.8 * hard), q: 0.9 + 0.6 * hard, off: rnd() * 1.5, off2: rnd() * 1.5 };
    const sl = lay('sub'); if (sl.on !== false) plan.sub = { f0: c.f0 * (sl.tone ?? 100) / 100 * Math.pow(0.95, -k), decay: 0.12 + 1.4 * c.len, amp: 0.8 * c.sub * c.level };
    const tl = lay('tail'); if (tl.on !== false && plan.blast) plan.tail = { env: plan.env, size: (tl.size ?? 100) / 100, amp: 1 };
    return plan;
  }
  function planEvent(set, t0, opts = {}) {
    if (opts.cock) return [planShot(set, t0, { cock: true })];
    const n = opts.shots ?? Math.max(1, Math.round(S.P.shots)), plans = [];
    let t = t0 + (set.select.action !== 'sa' ? 0.27 : 0.01);
    for (let i = 0; i < n; i++) { plans.push(planShot(set, t, { first: i === 0 })); t += S.P.gap * (0.92 + 0.16 * rnd()); }
    return plans;
  }
  const planLength = plans => Math.min(8, Math.max(...plans.map(p => p.t + (p.tail ? ENVS[p.tail.env].len * p.tail.size + 0.3 : 0) + (p.sub ? p.sub.decay * 1.5 : 0.1) + (p.blast ? p.blast.len * 3 : 0))) + 0.15);

  // ---------- проигрывание ----------
  const MECH = { cock1: { f: 3200, ping: 4300, dec: 0.025, a: 1 }, cock2: { f: 1200, ping: 2600, dec: 0.04, a: 1.2 }, tick: { f: 5200, ping: 6200, dec: 0.012, a: 0.6 }, fall: { f: 900, ping: 3400, dec: 0.05, a: 1.4 } };
  function click(ctx, dest, t, kind, amp, L) {
    const m = MECH[kind], src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = m.f; bp.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * m.a * L, t + 0.0003); g.gain.setTargetAtTime(0, t + 0.0006, 0.0012);
    src.connect(bp).connect(g).connect(dest); src.start(t, (kind.length * 0.37) % 1.5); src.stop(t + 0.02);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = m.ping;
    const pg = ctx.createGain(); pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(amp * m.a * 0.25 * L, t + 0.0005); pg.gain.setTargetAtTime(0, t + 0.001, m.dec / 6.9);
    o.connect(pg).connect(dest); o.start(t); o.stop(t + m.dec * 1.5 + 0.02); S.voices += 2;
  }
  // источники хлопка и выхлопа: один и тот же набор строится дважды — в свои слои и во вход хвоста
  function fire(ctx, plan, t, L, dests) {
    const b = plan.blast, c = plan.crack;
    if (c && dests.crack) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = c.hp; hp.Q.value = 0.7;
      const ws = ctx.createWaveShaper(); ws.curve = satCurve(c.sat); ws.oversample = '2x';
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(c.amp * L, t + 0.0003); g.gain.setTargetAtTime(0, t + 0.0006, c.len / 2.5);
      src.connect(hp).connect(ws).connect(g).connect(dests.crack); src.start(t, c.off); src.stop(t + c.len * 6 + 0.02); S.voices++;
    }
    if (b && dests.blast) {
      for (const [f, q, amp, off, len] of [[b.f, b.q, 1, b.off, b.len], [b.f / 2.6, 0.7, 0.6, b.off2, b.len * 1.3]]) {
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const ws = ctx.createWaveShaper(); ws.curve = satCurve(b.sat); ws.oversample = '2x';
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(b.amp * amp * L, t + 0.0008); g.gain.setValueAtTime(b.amp * amp * L, t + 0.004); g.gain.setTargetAtTime(0, t + 0.005, len / 4);
        src.connect(bp).connect(ws).connect(g).connect(dests.blast); src.start(t, off); src.stop(t + len * 5 + 0.03); S.voices++;
      }
    }
  }
  function playPlan(plan, ctx, comps) {
    const t = Math.max(plan.t, ctx.currentTime + 0.3 * (plan.mech.some(m => m.t < -0.1) ? 1 : 0)), L = plan.level, dest = id => comps.get(id)?.input;
    if (ctx === audio.ctx) S.onHit?.(plan.blast ? 'blast' : 'mech', t);
    const md = dest('mech'); if (md) for (const m of plan.mech) click(ctx, md, Math.max(t + m.t, ctx.currentTime), m.kind, m.amp, L);
    fire(ctx, plan, t, L, { crack: dest('crack'), blast: dest('blast') });
    if (plan.sub && dest('sub')) {
      const s = plan.sub, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(s.f0 * 2.4, t); o.frequency.exponentialRampToValueAtTime(s.f0, t + 0.03);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(s.amp * L, t + 0.0025); g.gain.setTargetAtTime(0, t + 0.004, s.decay / 6.9);
      o.connect(g).connect(dest('sub')); o.start(t); o.stop(t + s.decay * 1.6 + 0.05); S.voices++;
    }
    if (plan.tail && dest('tail')) {
      const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = tailIR(ctx, plan.tail.env, plan.tail.size);
      const inp = ctx.createGain(); inp.gain.value = plan.tail.amp; inp.connect(conv).connect(dest('tail'));
      fire(ctx, plan, t, L, { crack: inp, blast: inp });
    }
  }

  // ---------- живой выстрел ----------
  function trigger(what) {
    if (!S.set) return;
    ensureAudio(); ensureBus();
    const t0 = audio.ctx.currentTime + 0.01;
    const plans = what === 'cock' ? planEvent(S.set, t0, { cock: true }) : what === 'burst' ? planEvent(S.set, t0, { shots: Math.max(3, Math.round(S.P.shots)) }) : planEvent(S.set, t0);
    for (const p of plans) playPlan(p, audio.ctx, S.comps);
    if (what !== 'cock') S.shots += plans.length;
    S.onStatus(what === 'cock' ? 'взвод' : `${calOf(S.set).name}, ${ENVS[plans[0].env].name}: ${plans.length} выстр., ствол ${S.P.barrel.toFixed(0)}″`);
  }
  function render(ctx, set, plans, opts = {}) {
    const bus = buildBus(ctx, { audible: opts.audible });
    for (const p of plans) playPlan(p, ctx, bus.comps);
    return { out: bus.out, voices: plans.length };
  }

  // ---------- выбор калибра ----------
  const pickers = set => [{ id: 'caliber', name: 'Калибр', value: set.select.caliber, items: CAL_LIST.map(k => ({ id: k, name: CALIBERS[k].name, icon: 'gun' })) }];
  function pick(set, what, v) { if (what === 'caliber' && CALIBERS[v]) set.select.caliber = v; if (what === 'action' && (v === 'da' || v === 'sa')) set.select.action = v; }
  const calName = set => calOf(set).name;
  const envName = () => ENVS[envKey(S.P)].name;

  // ---------- панель и ручки слоя ----------
  const PARAMS = { mech: ['speed', 'темп', 50, 200, '%'], crack: ['len', 'длина', 50, 200, '%'], blast: ['sat', 'сатурация', 0, 200, '%'], sub: ['tone', 'тон', 50, 200, '%'], tail: ['size', 'размер', 50, 200, '%'] };
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
      <div class="sel"><label>Калибр</label><select data-pick="caliber">${CAL_LIST.map(k => `<option value="${k}"${k === set.select.caliber ? ' selected' : ''}>${CALIBERS[k].name}</option>`).join('')}</select></div>
      <div class="progress">${calOf(set).hint}</div>
      <div class="sel"><label>Взвод</label><select data-pick="action"><option value="da"${set.select.action !== 'sa' ? ' selected' : ''}>самовзвод (DA): трещотка, взвод, спуск</option><option value="sa"${set.select.action === 'sa' ? ' selected' : ''}>ручной (SA): взвод клавишей C, спуск</option></select></div>
      <div class="trig">
        <button class="btn go" data-trig="shot" title="клавиша F">Выстрел</button>
        <button class="btn" data-trig="cock" title="клавиша C">Взвод</button>
        <button class="btn" data-trig="burst" title="клавиша B">Серия</button>
      </div>
      <div class="progress" id="gunProgress"></div>
      <h3>Слои выстрела</h3>
      ${set.layers.map(l => `<div class="wl${l.on === false ? ' off' : ''}" data-l="${l.id}">${layerHtml(l)}</div>`).join('')}`;
    for (const s of el.querySelectorAll('select[data-pick]')) s.onchange = e => { if (hooks.onPick) hooks.onPick(s.dataset.pick, e.target.value); else { pick(set, s.dataset.pick, e.target.value); hooks.onSelect?.(); renderPanel(el, set, hooks); } };
    for (const b of el.querySelectorAll('[data-trig]')) b.onclick = () => trigger(b.dataset.trig);
    for (const box of el.querySelectorAll('.wl')) bindLayer(box, set.layers.find(x => x.id === box.dataset.l), hooks);
    S.onStatus = t => { const p = document.getElementById('gunProgress'); if (p) p.textContent = t; };
  }

  return { init, load, renderPanel, renderLayerControls, setParams, applyUserGain, trigger, planEvent, planLength, playPlan, render, buildBus, characterValues, layerJson,
           pickers, pick, calName, envName, ready, CALIBERS, ENVS, LAYERS, MACROS, CHARACTERS, get state() { return S; } };
})();

// SFX Lab · движок вжухов (набор kind: "whoosh"), по мотивам UVI Whoosh FX.
// Три слоя: шум (синтез: белый, розовый, коричневый, голубой, фиолетовый, полоса, S+H, синус) и две текстуры (wav).
// У каждого слоя: фильтр (LP/HP/BP, срез), питч, панорама, наклон, нарисованная огибающая громкости (она же ведёт фильтр).
// Глобально: длительность, перекос огибающих (Warp), движение мимо слушателя ПО ФИЗИКЕ (скорость, ближняя дистанция,
// направление → Доплер, громкость 1/d, панорама по углу), глубина Доплера, фильтр (глубина/резонанс/тон), дрожание (LFO),
// ширина образа, дистанция всего события (distance.js). Один вжух = свежие узлы на каждый слой, все кривые считаются
// заранее и ставятся через setValueCurveAtTime, поэтому ничего не щёлкает и всё повторяемо.

const Whoosh = (() => {
  const C_SOUND = 343;                   // м/с
  const ENV_N = 64, CURVE_N = 256;

  const NOISES = {
    white: 'белый', pink: 'розовый', brown: 'коричневый', blue: 'голубой', violet: 'фиолетовый',
    band: 'полоса', sh: 'ступеньки (S+H)', sinus: 'синус (свист)',
  };
  const FILTERS = { lp: 'LP низ', hp: 'HP верх', bp: 'BP полоса' };
  const LAYERS = [
    { id: 'noise', name: 'шум',        type: 'noise',   src: 'pink',  gain: 80, filter: 'lp', cutoff: 2500, pitch: 0, pan: 0, tilt: 0 },
    { id: 'tex1',  name: 'текстура 1', type: 'texture', file: '',     gain: 70, filter: 'lp', cutoff: 6000, pitch: 0, pan: 0, tilt: 0 },
    { id: 'tex2',  name: 'текстура 2', type: 'texture', file: '',     gain: 70, filter: 'hp', cutoff: 300,  pitch: 0, pan: 0, tilt: 0 },
  ];

  // ---------- пресеты огибающих (0…1 по 64 точкам) ----------
  const shape = fn => Float32Array.from({ length: ENV_N }, (_, i) => Math.max(0, Math.min(1, fn(i / (ENV_N - 1)))));
  const ENVS = {
    swell:   { name: 'волна',        env: shape(x => Math.pow(Math.sin(Math.PI * x), 1.5)) },
    passby:  { name: 'мимо',         env: shape(x => Math.exp(-Math.pow((x - 0.5) / 0.22, 2))) },
    hit:     { name: 'удар',         env: shape(x => x < 0.04 ? x / 0.04 : Math.exp(-(x - 0.04) * 6)) },
    swish:   { name: 'взмах',        env: shape(x => Math.pow(Math.sin(Math.PI * Math.pow(x, 0.6)), 2)) },
    rise:    { name: 'подъём',       env: shape(x => x < 0.92 ? Math.pow(x / 0.92, 2.2) : (1 - x) / 0.08) },
    fall:    { name: 'спад',         env: shape(x => x < 0.03 ? x / 0.03 : Math.pow(1 - (x - 0.03) / 0.97, 1.8)) },
    reverse: { name: 'обратный',     env: shape(x => x < 0.9 ? Math.exp((x - 0.9) * 5) : (1 - x) / 0.1) },
    gate:    { name: 'ровно',        env: shape(x => x < 0.05 ? x / 0.05 : x > 0.95 ? (1 - x) / 0.05 : 1) },
    pulses:  { name: 'пульсы',       env: shape(x => Math.pow(Math.sin(Math.PI * x), 0.5) * (0.35 + 0.65 * Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * 6 * x), 3))) },
  };

  // ---------- макросы (карты → global.*) ----------
  const MACROS = [
    { id: 'dur', name: 'Длительность', default: 30, hint: '0.2 … 32 с', map: [ { layer: 'global', param: 'dur', from: 0.2, to: 32, curve: 'log' } ] },
    { id: 'drive', name: 'Жёсткость', default: 50, hub: true, hint: 'мягко ↔ жёстко: резонанс фильтра и верх', map: [ { layer: 'global', param: 'hard', from: 0, to: 1 } ] },
    { id: 'warp', name: 'Перекос', default: 50, hint: 'все огибающие влево ↔ вправо (Warp)', map: [ { layer: 'global', param: 'warp', from: -1, to: 1 } ] },
    { id: 'move', name: 'Движение', default: 50, hint: 'источник пролетает мимо: скорость, как близко, куда', sub: [
      { id: 'speed', name: 'Скорость',  default: 50, map: [ { layer: 'global', param: 'speed', from: 2, to: 300, curve: 'log' } ] },   // км/ч
      { id: 'near',  name: 'Ближе всего', default: 40, map: [ { layer: 'global', param: 'near', from: 0.3, to: 30, curve: 'log' } ] },  // м
      { id: 'dir',   name: 'Направление', default: 100, map: [ { layer: 'global', param: 'dir', from: -1, to: 1 } ] },               // −1 справа налево, +1 слева направо
    ] },
    { id: 'doppler', name: 'Доплер', default: 50, hint: '0 нет, 50 как в физике, 100 вдвое сильнее', map: [ { layer: 'global', param: 'doppler', from: 0, to: 2 } ] },
    { id: 'filter', name: 'Фильтр', default: 50, hint: 'огибающая ведёт срез: глубина в октавах, резонанс, тон', sub: [
      { id: 'depth', name: 'Глубина',  default: 50, map: [ { layer: 'global', param: 'fDepth', from: 0, to: 4 } ] },
      { id: 'res',   name: 'Резонанс', default: 30, map: [ { layer: 'global', param: 'fQ', from: 0.5, to: 12, curve: 'log' } ] },
      { id: 'tone',  name: 'Тон',      default: 50, map: [ { layer: 'global', param: 'fTone', from: 0.25, to: 4, curve: 'log' } ] },   // множитель к срезу слоя
    ] },
    { id: 'lfo', name: 'Дрожание', default: 0, hint: 'амплитудный LFO: скорость, глубина, разгон', sub: [
      { id: 'freq',  name: 'Скорость', default: 40, map: [ { layer: 'global', param: 'lfoF', from: 0.5, to: 40, curve: 'log' } ] },
      { id: 'depth', name: 'Глубина',  default: 0,  map: [ { layer: 'global', param: 'lfoD', from: 0, to: 1 } ] },
      { id: 'shift', name: 'Разгон',   default: 50, map: [ { layer: 'global', param: 'lfoS', from: -1, to: 1 } ] },
    ] },
    { id: 'width', name: 'Ширина', default: 60, hint: 'моно ↔ стерео ↔ широко', map: [ { layer: 'global', param: 'width', from: 0, to: 1.5 } ] },
    { id: 'dist', kind: 'distance', name: 'Дистанция', default: 0, hint: 'всё событие дальше: расхождение и воздух', ground: false },
  ];
  const DEFAULT_P = { hard: 0.5, dur: 1, warp: 0, speed: 25, near: 2, dir: 1, doppler: 1, fDepth: 2, fQ: 1, fTone: 1, lfoF: 4, lfoD: 0, lfoS: 0, width: 0.9 };

  // ---------- характеры ----------
  const CHARACTERS = [
    { id: 'swish', name: 'Взмах рукой / палкой, коротко',
      layers: { noise: { src: 'band', filter: 'bp', cutoff: 2800, env: 'swish', on: true }, tex1: { on: false }, tex2: { on: false } },
      values: { dur: 12, warp: 45, move: 40, 'move.speed': 70, 'move.near': 10, 'move.dir': 100, doppler: 35, filter: 50, 'filter.depth': 60, 'filter.res': 55, 'filter.tone': 50, lfo: 0, 'lfo.freq': 40, 'lfo.depth': 0, 'lfo.shift': 50, width: 70, dist: 0 } },
    { id: 'cape', name: 'Плащ / ткань, взмах',
      layers: { noise: { src: 'pink', filter: 'lp', cutoff: 1800, env: 'passby', on: true }, tex1: { on: false }, tex2: { on: false } },
      values: { dur: 22, warp: 55, move: 40, 'move.speed': 60, 'move.near': 15, 'move.dir': 100, doppler: 25, filter: 50, 'filter.depth': 45, 'filter.res': 30, 'filter.tone': 45, lfo: 0, 'lfo.depth': 0, width: 60, dist: 0 } },
    { id: 'car', name: 'Машина проезжает мимо',
      layers: { noise: { src: 'brown', filter: 'lp', cutoff: 900, env: 'gate', on: true }, tex1: { on: true, env: 'gate', filter: 'lp', cutoff: 4000 }, tex2: { on: false } },
      values: { dur: 62, warp: 50, move: 60, 'move.speed': 68, 'move.near': 55, 'move.dir': 100, doppler: 50, filter: 50, 'filter.depth': 30, 'filter.res': 20, 'filter.tone': 50, lfo: 0, 'lfo.depth': 0, width: 80, dist: 0 } },
    { id: 'gust', name: 'Порыв ветра',
      layers: { noise: { src: 'pink', filter: 'lp', cutoff: 1400, env: 'swell', on: true }, tex1: { on: true, env: 'swell', filter: 'lp', cutoff: 5000 }, tex2: { on: false } },
      values: { dur: 66, warp: 40, move: 20, 'move.speed': 20, 'move.near': 60, 'move.dir': 50, doppler: 0, filter: 50, 'filter.depth': 55, 'filter.res': 25, 'filter.tone': 50, lfo: 0, 'lfo.depth': 0, width: 90, dist: 0 } },
    { id: 'rise', name: 'Подъём (riser) к удару',
      layers: { noise: { src: 'white', filter: 'hp', cutoff: 400, env: 'rise', on: true }, tex1: { on: false }, tex2: { on: false } },
      values: { dur: 74, warp: 50, move: 30, 'move.speed': 30, 'move.near': 40, 'move.dir': 50, doppler: 0, filter: 50, 'filter.depth': 85, 'filter.res': 45, 'filter.tone': 40, lfo: 30, 'lfo.freq': 35, 'lfo.depth': 55, 'lfo.shift': 85, width: 70, dist: 0 } },
    { id: 'arrow', name: 'Стрела / свист пролетает',
      layers: { noise: { src: 'sinus', filter: 'bp', cutoff: 3500, pitch: 14, env: 'passby', on: true }, tex1: { on: false }, tex2: { on: false } },
      values: { dur: 28, warp: 50, move: 70, 'move.speed': 90, 'move.near': 25, 'move.dir': 100, doppler: 60, filter: 50, 'filter.depth': 30, 'filter.res': 60, 'filter.tone': 50, lfo: 0, 'lfo.depth': 0, width: 75, dist: 0 } },
  ];

  // ---------- состояние ----------
  const S = { set: null, P: { ...DEFAULT_P }, bus: null, nodes: new Map(), buffers: new Map(), active: [], onStatus: () => {}, whooshes: 0, rng: null };
  const rnd = () => S.rng ? S.rng() : Math.random();          // сеяная случайность при экспорте
  const dbToGain = db => Math.pow(10, db / 20);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- шумы ----------
  function noiseBuffer(type, ctx = audio.ctx) {
    const key = type + '@' + ctx.sampleRate;
    if (S.buffers.has(key)) return S.buffers.get(key);
    const sr = ctx.sampleRate, n = sr * 4, buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, hold = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      let v;
      if (type === 'white' || type === 'band') v = w;
      else if (type === 'pink') {                                           // Paul Kellet
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        v = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; v = last * 3.5; }
      else if (type === 'blue') { v = (w - prev) * 0.5; prev = w; }                       // производная белого
      else if (type === 'violet') { const p = w - prev; prev = w; v = (p - last) * 0.35; last = p; }
      else if (type === 'sh') { if (i % 24 === 0) hold = w; v = hold; }                  // ступеньки ~2 кГц
      else if (type === 'sinus') v = Math.sin(2 * Math.PI * 440 * i / sr) * 0.7;
      else v = w;
      d[i] = v;
    }
    if (type === 'sinus') { const f = Math.floor(sr * 0.01); for (let i = 0; i < f; i++) { d[i] *= i / f; d[n - 1 - i] *= i / f; } }
    S.buffers.set(key, buf);
    return buf;
  }

  // ---------- текстуры ----------
  async function load(set) {
    if (!audio.ctx) return;
    for (const l of set.layers) {
      if (l.type !== 'texture' || (!l.file && !l.blob)) continue;
      const key = (l.blob ? 'blob:' + l.blob.name + l.blob.size : l.file);
      if (l.buffer && l.bufferKey === key) continue;
      S.onStatus('грузится ' + l.name);
      try {
        const data = l.blob ? await l.blob.arrayBuffer() : await (await fetch(l.file)).arrayBuffer();
        l.buffer = await audio.ctx.decodeAudioData(data); l.bufferKey = key; l.seconds = l.buffer.duration;
        S.onStatus('готово: ' + l.name + ' (' + l.seconds.toFixed(1) + ' с)');
      } catch (e) { S.onStatus('не смог прочитать ' + l.name); }
    }
  }

  // ---------- граф ----------
  function ensureBus() {
    if (S.bus) return;
    const ctx = audio.ctx;
    const input = ctx.createGain(), dist = Distance.create(ctx);
    const fx = Fx.build(ctx, S.set.fx, S.set.id);
    input.connect(fx.input); fx.output.connect(dist.input); dist.output.connect(setOutput(S.set.id));
    S.bus = { input, dist };
    for (const l of S.set.layers) {
      const user = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 512;
      const fx = Fx.build(ctx, S.set.wireFx?.[l.id], S.set.id + '/' + l.id);           // цепочка модулей на ниточке
      user.connect(fx.input); fx.output.connect(an).connect(input);
      S.nodes.set(l.id, { user, an, fx });
      audio.meters.set(S.set.id + '/' + l.id, an);
    }
  }
  function setParams(set, params) {
    S.P = { ...DEFAULT_P, ...(params.global || {}) };
    S.distParams = params.__distance || null;
    if (!audio.ctx) return;
    ensureBus();
    if (params.__distance) S.bus.dist.set(params.__distance);
  }
  function applyUserGain(set, layer, audible) {
    if (!audio.ctx) return;
    ensureBus();
    const n = S.nodes.get(layer.id); if (!n) return;
    n.user.gain.setTargetAtTime(audible && layer.on !== false ? Math.pow((layer.gain ?? 80) / 100, 2) : 0, audio.ctx.currentTime, 0.02);
  }

  // ---------- кривые ----------
  // Огибающая слоя с перекосом: warp > 0 сдвигает горб вправо.
  function envAt(env, x, warp) {
    const xx = Math.pow(clamp(x, 0, 1), Math.pow(2, 2 * warp));
    const p = xx * (ENV_N - 1), i = Math.floor(p), t = p - i;
    return i >= ENV_N - 1 ? env[ENV_N - 1] : env[i] + (env[i + 1] - env[i]) * t;
  }
  // Пролёт мимо: положение вдоль пути u(t), расстояние d(t), радиальная скорость → Доплер, громкость 1/d, панорама.
  function motion(P) {
    const v = P.speed / 3.6, r = Math.max(P.near, 0.3), D = P.dur;
    const out = { rate: new Float32Array(CURVE_N), amp: new Float32Array(CURVE_N), pan: new Float32Array(CURVE_N) };
    for (let i = 0; i < CURVE_N; i++) {
      const t = i / (CURVE_N - 1) * D, u = v * (t - D / 2), d = Math.sqrt(u * u + r * r);
      const vr = v * u / d;                                                 // < 0 пока приближается
      out.rate[i] = Math.pow(C_SOUND / (C_SOUND + vr), P.doppler);
      out.amp[i] = r / d;                                                   // 1 в ближней точке
      out.pan[i] = clamp(P.dir * u / d * Math.min(P.width, 1), -1, 1);
    }
    return out;
  }
  function lfoCurve(P) {
    const out = new Float32Array(CURVE_N); let ph = 0; const dt = P.dur / (CURVE_N - 1);
    for (let i = 0; i < CURVE_N; i++) {
      const t = i / (CURVE_N - 1);
      const f = P.lfoF * Math.pow(2, 2 * P.lfoS * (t - 0.5));              // разгон: частота уходит вверх/вниз
      out[i] = 1 - P.lfoD * 0.5 * (1 - Math.cos(2 * Math.PI * ph)); ph += f * dt;
    }
    return out;
  }

  // ---------- вжух ----------
  // Один голос (слой) на любом контексте: живом или офлайн при экспорте. Возвращает { src, g } или null.
  function voice(ctx, l, P, t0, dest, mo, lfo, offset) {
    if (l.on === false) return null;
    const buf = l.type === 'noise' ? noiseBuffer(l.src || 'pink', ctx) : l.buffer;
    if (!buf) return null;
    const D = P.dur;
    const env = l.env instanceof Float32Array ? l.env : (ENVS[l.env]?.env || ENVS.swell.env);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = l.filter === 'hp' ? 'highpass' : l.filter === 'bp' ? 'bandpass' : 'lowpass';
    filt.Q.value = P.fQ * (l.src === 'band' ? 4 : 1) * (1 + (P.hard - 0.5) * 1.5);                     // жёсткость: резонанс
    const tLow = ctx.createBiquadFilter(); tLow.type = 'lowshelf'; tLow.frequency.value = 1000; tLow.gain.value = -(l.tilt || 0);
    const tHigh = ctx.createBiquadFilter(); tHigh.type = 'highshelf'; tHigh.frequency.value = 1000; tHigh.gain.value = +(l.tilt || 0) + (P.hard - 0.5) * 10;   // и верх ±5 дБ
    const g = ctx.createGain(), pan = ctx.createStereoPanner();
    const amp = new Float32Array(CURVE_N), cut = new Float32Array(CURVE_N), rate = new Float32Array(CURVE_N), pn = new Float32Array(CURVE_N);
    const base = (l.cutoff || 2000) * P.fTone, pitch = Math.pow(2, (l.pitch || 0) / 12);
    for (let i = 0; i < CURVE_N; i++) {
      const x = i / (CURVE_N - 1), e = envAt(env, x, P.warp);
      amp[i] = e * mo.amp[i] * lfo[i];
      cut[i] = clamp(base * Math.pow(2, P.fDepth * (e - 0.5)), 30, 20000);
      rate[i] = pitch * mo.rate[i];
      pn[i] = clamp((l.pan || 0) + mo.pan[i], -1, 1);
    }
    amp[0] = 0; amp[CURVE_N - 1] = 0;
    g.gain.setValueCurveAtTime(amp, t0, D);
    filt.frequency.setValueCurveAtTime(cut, t0, D);
    src.playbackRate.setValueCurveAtTime(rate, t0, D);
    pan.pan.setValueCurveAtTime(pn, t0, D);
    src.connect(filt).connect(tLow).connect(tHigh).connect(g).connect(pan).connect(dest);
    src.start(t0, offset);
    src.stop(t0 + D + 0.05);
    src.onended = () => { try { src.disconnect(); filt.disconnect(); tLow.disconnect(); tHigh.disconnect(); g.disconnect(); pan.disconnect(); } catch (e) {} };
    return { src, g, offset, layer: l };
  }
  // Стартовая точка слоя. Жребий бросается для КАЖДОГО слоя в одном порядке, даже если слой в этот файл не входит,
  // поэтому при экспорте группа «только текстура» получает ту же точку, что и микс.
  const startOffset = (l, D) => l.type === 'texture' ? rnd() * Math.max(0, (l.buffer ? l.buffer.duration : 0) - D) : rnd() * 2;
  function trigger(when) {
    ensureAudio(); ensureBus();
    const ctx = audio.ctx, P = S.P, t0 = when ?? ctx.currentTime + 0.02, D = P.dur;
    const mo = motion(P), lfo = lfoCurve(P);
    const voices = [];
    for (const l of S.set.layers) {
      const off = startOffset(l, D);
      const v = voice(ctx, l, P, t0, S.nodes.get(l.id).user, mo, lfo, off);
      if (!v) continue;
      S.onHit?.(l.id, t0, D);
      voices.push(v);
    }
    S.active.push(...voices); S.whooshes++;
    S.last = { t0, D, mo };
    return voices.length;
  }
  // Офлайн-рендер для экспорта: тот же голос на чужом контексте, громкости слоёв как в панели (gain², mute/solo).
  // opts.audible(layerId) → слой входит в этот файл. Возвращает узел, который надо подключить дальше (Fx/дистанция/выход).
  function render(ctx, set, P, t0, opts = {}) {
    const mo = motion(P), lfo = lfoCurve(P), out = ctx.createGain(), voices = [];
    for (const l of set.layers) {
      const off = startOffset(l, P.dur);
      if (opts.audible && !opts.audible(l.id)) continue;
      const user = ctx.createGain(); user.gain.value = Math.pow((l.gain ?? 80) / 100, 2);
      const fx = Fx.build(ctx, set.wireFx?.[l.id]); user.connect(fx.input); fx.output.connect(out);
      const v = voice(ctx, l, P, t0, user, mo, lfo, off);
      if (v) voices.push(v);
    }
    return { out, voices };
  }
  function stop() {
    const now = audio.ctx?.currentTime ?? 0;
    for (const v of S.active) { try { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, 0.02); v.src.stop(now + 0.1); } catch (e) {} }
    S.active = [];
  }

  // ---------- набор ----------
  function init(set) {
    S.set = set;
    set.kind = 'whoosh';
    set.layers = LAYERS.map(d => { const l = { ...d, mode: 'oneshot', env: 'swell', on: true, ...((set.layers || []).find(x => x.id === d.id) || {}) };
      if (Array.isArray(l.env)) l.env = Float32Array.from(l.env); return l; });
    set.macros = set.macros?.length ? set.macros : JSON.parse(JSON.stringify(MACROS));
    set.characters = CHARACTERS;
  }
  function characterValues(id) {
    const ch = CHARACTERS.find(c => c.id === id);
    return ch ? { layers: ch.layers, values: { ...ch.values } } : null;
  }
  function applyCharacter(set, ch) {
    for (const [id, patch] of Object.entries(ch.layers || {})) { const l = set.layers.find(x => x.id === id); if (l) Object.assign(l, patch); }
    for (const l of set.layers) if (l.type === 'texture' && l.on && !l.file && !l.blob) l.on = false;
  }
  function layerJson(l) {
    const o = { id: l.id, gain: l.gain, on: l.on !== false, src: l.src, file: l.file || '', filter: l.filter, cutoff: l.cutoff, pitch: l.pitch, pan: l.pan, tilt: l.tilt,
                env: l.env instanceof Float32Array ? Array.from(l.env, v => +v.toFixed(3)) : l.env };
    return o;
  }

  // ---------- панель слева: источники, фильтры, огибающие, кнопки ----------
  const opt = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v}</option>`).join('');
  const envOpt = l => '<option value="">нарисована</option>' + Object.entries(ENVS).map(([k, v]) => `<option value="${k}"${l.env === k ? ' selected' : ''}>${v.name}</option>`).join('');
  // Заголовок слоя (включатель + источник) и тело (фильтр, питч, пан, наклон, огибающая): для панели слева и экрана-схемы.
  function layerHeadHtml(l) {
    return `<div class="wl-head"><label><input type="checkbox" data-on${l.on !== false ? ' checked' : ''}> ${l.name}</label>
      ${l.type === 'noise' ? `<select data-src>${opt(NOISES, l.src)}</select>`
                          : `<button class="btn small" data-file title="${l.file || (l.blob && l.blob.name) || ''}">${l.file ? l.file.split('/').pop() : l.blob ? l.blob.name : 'файл…'}</button>`}
    </div>`;
  }
  function layerBodyHtml(l) {
    return `<div class="wl-row"><select data-filter>${opt(FILTERS, l.filter)}</select>
        <input type="range" data-cut min="0" max="100" value="${Math.round(Math.log(l.cutoff / 40) / Math.log(500) * 100)}" title="срез"><span class="val" data-cutv>${Math.round(l.cutoff)} Гц</span></div>
      <div class="wl-row"><span class="lbl">питч</span><input type="range" data-pitch min="-24" max="24" value="${l.pitch || 0}"><span class="val" data-pitchv>${l.pitch || 0} st</span></div>
      <div class="wl-row"><span class="lbl">пан</span><input type="range" data-pan min="-100" max="100" value="${Math.round((l.pan || 0) * 100)}"><span class="val" data-panv>${Math.round((l.pan || 0) * 100)}</span></div>
      <div class="wl-row"><span class="lbl">наклон</span><input type="range" data-tilt min="-12" max="12" value="${l.tilt || 0}"><span class="val" data-tiltv>${l.tilt || 0} дБ</span></div>
      <div class="wl-row"><select data-env>${envOpt(l)}</select><button class="btn small" data-smooth title="сгладить">~</button><button class="btn small" data-all title="эту огибающую всем слоям">всем</button></div>
      <canvas class="env" data-env-canvas title="тяни мышью: огибающая громкости (и фильтра)"></canvas>`;
  }
  // box — элемент, внутри которого лежат head и body; rerender — перерисовать контейнер целиком (смена файла, «всем»)
  function bindLayer(box, l, set, hooks, rerender) {
    const q = s => box.querySelector(s);
    const paintR = () => { for (const r of box.querySelectorAll('input[type=range]')) r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); };
    Knob.convert(box);
    paintR();
    if (q('[data-on]')) q('[data-on]').onchange = e => { l.on = e.target.checked; box.classList.toggle('off', !l.on); hooks.onSelect(); };
    if (q('[data-src]')) q('[data-src]').onchange = e => { l.src = e.target.value; };
    if (q('[data-file]')) q('[data-file]').onclick = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*';
      inp.onchange = () => { if (inp.files[0]) { l.blob = inp.files[0]; l.file = ''; l.on = true; hooks.onSelect(); rerender(); } };
      inp.click();
    };
    q('[data-filter]').onchange = e => { l.filter = e.target.value; };
    q('[data-cut]').oninput = e => { l.cutoff = Math.round(40 * Math.pow(500, e.target.value / 100)); q('[data-cutv]').textContent = l.cutoff + ' Гц'; paintR(); };
    q('[data-pitch]').oninput = e => { l.pitch = +e.target.value; q('[data-pitchv]').textContent = l.pitch + ' st'; paintR(); };
    q('[data-pan]').oninput = e => { l.pan = e.target.value / 100; q('[data-panv]').textContent = e.target.value; paintR(); };
    q('[data-tilt]').oninput = e => { l.tilt = +e.target.value; q('[data-tiltv]').textContent = l.tilt + ' дБ'; paintR(); };
    const canvas = q('[data-env-canvas]');
    const curEnv = () => l.env instanceof Float32Array ? l.env : (ENVS[l.env]?.env || ENVS.swell.env);
    const draw = () => drawEnv(canvas, curEnv(), S.P.warp);
    q('[data-env]').onchange = e => { l.env = e.target.value || Float32Array.from(curEnv()); draw(); };
    q('[data-smooth]').onclick = () => { const e = Float32Array.from(curEnv()); const o = new Float32Array(ENV_N); for (let i = 0; i < ENV_N; i++) o[i] = (e[Math.max(0, i - 1)] + e[i] + e[Math.min(ENV_N - 1, i + 1)]) / 3; l.env = o; q('[data-env]').value = ''; draw(); };
    q('[data-all]').onclick = () => { for (const x of set.layers) x.env = l.env instanceof Float32Array ? Float32Array.from(l.env) : l.env; rerender(); };
    let drawing = false, lastI = -1;
    const paintAt = ev => {
      const r = canvas.getBoundingClientRect(); const x = clamp((ev.clientX - r.left) / r.width, 0, 1), y = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1);
      if (!(l.env instanceof Float32Array)) { l.env = Float32Array.from(curEnv()); q('[data-env]').value = ''; }
      const i = Math.round(x * (ENV_N - 1));
      if (lastI >= 0 && Math.abs(i - lastI) > 1) { const a = Math.min(i, lastI), b = Math.max(i, lastI); const va = l.env[lastI]; for (let k = a; k <= b; k++) l.env[k] = va + (y - va) * ((k - lastI) / (i - lastI)); }
      l.env[i] = y; lastI = i; draw();
    };
    canvas.onpointerdown = ev => { drawing = true; lastI = -1; canvas.setPointerCapture(ev.pointerId); paintAt(ev); };
    canvas.onpointermove = ev => { if (drawing) paintAt(ev); };
    canvas.onpointerup = canvas.onpointercancel = () => { drawing = false; lastI = -1; };
    requestAnimationFrame(draw);
    box._draw = draw;
  }
  function renderLayerControls(el, set, l, hooks, rerender) { el.innerHTML = layerHeadHtml(l) + layerBodyHtml(l); bindLayer(el, l, set, hooks, rerender || (() => renderLayerControls(el, set, l, hooks))); }

  function renderPanel(el, set, hooks) {
    el.innerHTML = `
      <div class="trig">
        <button class="btn go" data-trig="go" title="клавиша W">Вжух</button>
        <button class="btn" data-trig="stop" title="клавиша X">Стоп</button>
      </div>
      ${set.layers.map(l => `<div class="wl${l.on === false ? ' off' : ''}" data-l="${l.id}">${layerHeadHtml(l)}${layerBodyHtml(l)}</div>`).join('')}
      <div class="progress" id="whooshProgress"></div>`;
    for (const b of el.querySelectorAll('[data-trig]')) b.onclick = () => trigger_(b.dataset.trig);
    for (const box of el.querySelectorAll('.wl')) bindLayer(box, set.layers.find(x => x.id === box.dataset.l), set, hooks, () => renderPanel(el, set, hooks));
    S.onStatus = t => { const p = document.getElementById('whooshProgress'); if (p) p.textContent = t; };
    S.redrawAll = () => { for (const box of el.querySelectorAll('.wl')) box._draw && box._draw(); };
  }
  function drawEnv(canvas, env, warp) {
    const W = canvas.width = (canvas.clientWidth || 200) * devicePixelRatio, H = canvas.height = 56 * devicePixelRatio;
    const c = canvas.getContext('2d'), cs = getComputedStyle(document.documentElement), col = v => cs.getPropertyValue(v).trim() || '#888';
    c.clearRect(0, 0, W, H);
    c.strokeStyle = col('--line'); c.lineWidth = 1; for (const x of [0.25, 0.5, 0.75]) { c.beginPath(); c.moveTo(x * W, 0); c.lineTo(x * W, H); c.stroke(); }
    const path = (fn, colour, fill) => {
      c.beginPath(); c.moveTo(0, H);
      for (let i = 0; i <= 128; i++) { const x = i / 128; c.lineTo(x * W, H - fn(x) * (H - 2) - 1); }
      c.lineTo(W, H); if (fill) { c.fillStyle = fill; c.fill(); } c.strokeStyle = colour; c.lineWidth = 1.5 * devicePixelRatio; c.stroke();
    };
    if (warp) path(x => envAt(env, x, warp), col('--muted'));
    path(x => envAt(env, x, 0), col('--accent'), 'rgba(255,255,255,0.06)');
  }
  function trigger_(what) {
    if (what === 'go') { const n = trigger(); S.onStatus(n ? `вжух: ${n} слоя, ${S.P.dur.toFixed(2)} с` : 'нет включённых слоёв с источником'); }
    else if (what === 'stop') stop();
  }

  return { init, load, renderPanel, renderLayerControls, setParams, applyUserGain, trigger: trigger_, render, characterValues, applyCharacter, layerJson, motion, lfoCurve, envAt,
           NOISES, FILTERS, ENVS, MACROS, CHARACTERS, LAYERS, get state() { return S; } };
})();

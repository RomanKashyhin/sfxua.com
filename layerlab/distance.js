// LayerLab · дистанция по физике, без реверберации.
// Что меняется со звуком на расстоянии d от слушателя (относительно 1 м):
//   1. Геометрическое расхождение: −20·log10(d / 1 м), то есть −6 дБ на каждое удвоение (точечный источник).
//   2. Поглощение воздухом по ISO 9613-1:1993 — коэффициент α(f, T, влажность, давление) в дБ/м, растёт ~f²
//      на низких и ломается на частотах релаксации кислорода и азота. Это и есть «даль режет верха».
//   3. Влияние земли по ISO 9613-2:1996 (общий метод, табл. 3): над мягким грунтом (трава, снег, песок, G = 1)
//      провал 250…1000 Гц, растущий с расстоянием; над твёрдым (бетон, асфальт, вода, G = 0) +3 дБ отражения.
// Всё это считается как одна кривая |H(f)| и превращается в минимально-фазовый FIR (ConvolverNode),
// чтобы транзиент шага не размазывался пре-эхом. Громкость расхождения идёт отдельным GainNode.
// Не моделируем: реверберацию, ветер/градиент температуры (рефракцию), турбулентность, Доплер, ближнее поле < 1 м.

const Distance = (() => {
  const D_REF = 1;                 // метр, где всё = 0 дБ
  const D_MIN = 1, D_MAX = 200;    // диапазон главного ползунка (лог)
  const FFT_N = 4096, TAPS = 1024; // расчёт кривой и длина импульса

  // ---------- ISO 9613-1: поглощение воздухом, дБ/м ----------
  function alphaAir(f, tC, rh, pKpa = 101.325) {
    const T = tC + 273.15, T0 = 293.15, T01 = 273.16, pr = 101.325, ps = pKpa;
    const C = -6.8346 * Math.pow(T01 / T, 1.261) + 4.6151;
    const h = rh * (pr / ps) * Math.pow(10, C);                                   // молярная доля водяного пара, %
    const frO = (ps / pr) * (24 + 4.04e4 * h * (0.02 + h) / (0.391 + h));         // релаксация кислорода, Гц
    const frN = (ps / pr) * Math.pow(T / T0, -0.5) * (9 + 280 * h * Math.exp(-4.170 * (Math.pow(T / T0, -1 / 3) - 1)));  // азота
    return 8.686 * f * f * (1.84e-11 * (pr / ps) * Math.sqrt(T / T0)
      + Math.pow(T / T0, -2.5) * (0.01275 * Math.exp(-2239.1 / T) / (frO + f * f / frO)
                                 + 0.1068 * Math.exp(-3352.0 / T) / (frN + f * f / frN)));
  }

  // ---------- ISO 9613-2: затухание у земли по октавам (положительное = тише) ----------
  // G: 0 твёрдая (бетон, асфальт, вода), 1 пористая (трава, снег, песок, листва). hs/hr: высота источника и слушателя, м.
  const OCT = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
  function groundOctaves(d, hs, hr, G) {
    const dp = Math.max(d, 1);
    const region = h => {
      const k = 1 - Math.exp(-dp / 50);
      const a = 1.5 + 3.0 * Math.exp(-0.12 * (h - 5) * (h - 5)) * k + 5.7 * Math.exp(-0.09 * h * h) * (1 - Math.exp(-2.8e-6 * dp * dp));
      const b = 1.5 + 8.6 * Math.exp(-0.09 * h * h) * k;
      const c = 1.5 + 14.0 * Math.exp(-0.46 * h * h) * k;
      const e = 1.5 + 5.0 * Math.exp(-0.9 * h * h) * k;
      return [-1.5, -1.5 + G * a, -1.5 + G * b, -1.5 + G * c, -1.5 + G * e, -1.5 * (1 - G), -1.5 * (1 - G), -1.5 * (1 - G)];
    };
    const q = dp <= 30 * (hs + hr) ? 0 : 1 - 30 * (hs + hr) / dp;
    const Am = -3 * q * (1 - G);
    const S = region(hs), R = region(hr);
    return OCT.map((_, i) => S[i] + R[i] + Am);
  }
  // гладкая интерполяция октавных точек по log f (за краями — крайние значения)
  function interpOct(vals, f) {
    const x = Math.log2(f / 63);
    if (x <= 0) return vals[0];
    if (x >= 7) return vals[7];
    const i = Math.floor(x), t = x - i, s = t * t * (3 - 2 * t);
    return vals[i] + (vals[i + 1] - vals[i]) * s;
  }

  // ---------- полная кривая, дБ относительно 1 м (без расхождения — оно в GainNode) ----------
  // p = { d, t, rh, g, hs, hr, ground, pressure }
  function curveDb(f, p) {
    const d = Math.max(p.d ?? 1, D_REF);
    let db = -alphaAir(f, p.t ?? 20, p.rh ?? 50, p.pressure ?? 101.325) * (d - D_REF);
    if (p.ground !== false) db -= interpOct(groundOctaves(d, p.hs ?? 0.05, p.hr ?? 1.6, p.g ?? 0), f);
    return db;
  }
  const spreadDb = p => -20 * Math.log10(Math.max(p.d ?? 1, D_REF) / D_REF) * (p.spread ?? 1);

  // ---------- FFT (radix-2, на месте) ----------
  function fft(re, im, inverse) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = 2 * Math.PI / len * (inverse ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  // ---------- минимально-фазовый импульс из кривой (кепстр) ----------
  function designIR(sampleRate, p) {
    const n = FFT_N, re = new Float64Array(n), im = new Float64Array(n);
    for (let k = 0; k <= n / 2; k++) {
      const f = Math.max(k * sampleRate / n, 20);
      const db = Math.max(curveDb(f, p), -90);
      re[k] = Math.log(Math.pow(10, db / 20));
      if (k > 0 && k < n / 2) re[n - k] = re[k];
    }
    fft(re, im, true);                                        // вещественный кепстр
    for (let i = 1; i < n / 2; i++) re[i] *= 2;
    for (let i = n / 2 + 1; i < n; i++) re[i] = 0;
    im.fill(0);
    fft(re, im, false);
    for (let i = 0; i < n; i++) { const m = Math.exp(re[i]); re[i] = m * Math.cos(im[i]); im[i] = m * Math.sin(im[i]); }
    fft(re, im, true);
    const ir = new Float32Array(TAPS), fade = 128;
    for (let i = 0; i < TAPS; i++) ir[i] = re[i] * (i < TAPS - fade ? 1 : 0.5 * (1 + Math.cos(Math.PI * (i - (TAPS - fade)) / fade)));
    return ir;
  }

  // ---------- узел: вход → (свёртка, с кроссфейдом при смене) → громкость расхождения → выход ----------
  function create(ctx) {
    const input = ctx.createGain(), spread = ctx.createGain(), output = ctx.createGain();
    spread.connect(output);
    const node = { input, output, spread, ctx, cur: null, params: null, pending: null, last: 0, ir: null };
    node.set = p => {
      node.params = { ...p };
      const now = performance.now();
      if (now - node.last < 60) { clearTimeout(node.pending); node.pending = setTimeout(() => node.set(node.params), 70 - (now - node.last)); return; }
      node.last = now;
      node.ir = designIR(ctx.sampleRate, p);
      const buf = ctx.createBuffer(1, TAPS, ctx.sampleRate); buf.copyToChannel(node.ir, 0);
      const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0;
      input.connect(conv).connect(g).connect(spread);
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(1, t, 0.015);
      const old = node.cur;
      if (old) { old.g.gain.setTargetAtTime(0, t, 0.015); setTimeout(() => { try { old.conv.disconnect(); old.g.disconnect(); } catch (e) {} }, 150); }
      node.cur = { conv, g };
      spread.gain.setTargetAtTime(Math.pow(10, spreadDb(p) / 20), t, 0.03);
    };
    return node;
  }

  // статичный узел для офлайн-рендера (экспорт): тот же FIR и расхождение, без кроссфейдов
  function createStatic(ctx, p) {
    const input = ctx.createGain(), output = ctx.createGain();
    const ir = designIR(ctx.sampleRate, p), buf = ctx.createBuffer(1, TAPS, ctx.sampleRate); buf.copyToChannel(ir, 0);
    const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = buf;
    output.gain.value = Math.pow(10, spreadDb(p) / 20);
    input.connect(conv).connect(output);
    return { input, output };
  }

  // ---------- значения ползунков 0…100 → физика ----------
  const toMetres = v => D_MIN * Math.pow(D_MAX / D_MIN, v / 100);
  const toTemp = v => -20 + 60 * v / 100;          // −20…+40 °C
  const toRh = v => 10 + 90 * v / 100;             // 10…100 %
  const SUBS = [
    { id: 't',  name: 'Температура', default: 67, fmt: v => toTemp(v).toFixed(0) + ' °C' },
    { id: 'rh', name: 'Влажность',   default: 44, fmt: v => toRh(v).toFixed(0) + ' %' },
    { id: 'g',  name: 'Грунт',       default: 0,  fmt: v => (v / 100).toFixed(2) + (v < 25 ? ' твёрдый' : v > 75 ? ' мягкий' : ' смешанный') },
  ];
  const PRESETS = [
    { id: 'summer', name: 'лето, +20 °C, 50 %',   t: 67, rh: 44 },
    { id: 'heat',   name: 'жара, +35 °C, 20 %',   t: 92, rh: 11 },
    { id: 'winter', name: 'зима, −10 °C, 80 %',   t: 17, rh: 78 },
    { id: 'fog',    name: 'сырость, +10 °C, 95 %', t: 50, rh: 94 },
    { id: 'dry',    name: 'сухо, +15 °C, 20 %',   t: 58, rh: 11 },
  ];
  function paramsFrom(m, vals) {
    const v = k => vals[m.id + '.' + k] ?? SUBS.find(s => s.id === k).default;
    return { d: toMetres(vals[m.id] ?? m.default ?? 0), t: toTemp(v('t')), rh: toRh(v('rh')), g: v('g') / 100,
             hs: m.hs ?? 0.05, hr: m.hr ?? 1.6, ground: m.ground !== false, spread: m.spread ?? 1 };
  }
  const fmtMetres = d => d < 10 ? d.toFixed(1) + ' м' : Math.round(d) + ' м';

  // пористость грунта по выбранной поверхности шагов (ISO 9613-2: твёрдая 0, пористая 1)
  const GROUND = { 'Concrete Clean': 0, 'Concrete Gritty': 0.05, 'Metal': 0, 'Wood Parquet': 0, 'Wood Plank': 0.1,
                   'Gravel Light': 0.5, 'Gravel Medium': 0.6, 'Sand': 1 };
  const GROUND_GENERIC = { leaves: 1, snow: 1, water: 0 };
  function groundFor(sel) {
    if (sel.generic && sel.generic !== 'none') { const k = Object.keys(GROUND_GENERIC).find(k => sel.generic.startsWith(k)); if (k) return GROUND_GENERIC[k]; }
    return GROUND[sel.surface] ?? 0.5;
  }

  // ---------- картинка кривой ----------
  function draw(canvas, p) {
    const W = canvas.width = canvas.clientWidth * devicePixelRatio || 300, H = canvas.height = 72 * devicePixelRatio;
    const c = canvas.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const col = v => cs.getPropertyValue(v).trim() || '#888';
    c.clearRect(0, 0, W, H);
    const fMin = 40, fMax = 20000, dbMin = -60;
    const x = f => Math.log(f / fMin) / Math.log(fMax / fMin) * W, y = db => (1 - Math.max(db, dbMin) / dbMin) * (H - 2) + 1;
    c.strokeStyle = col('--line'); c.lineWidth = 1;
    for (const f of OCT) { c.beginPath(); c.moveTo(x(f), 0); c.lineTo(x(f), H); c.stroke(); }
    for (const db of [-20, -40]) { c.beginPath(); c.moveTo(0, y(db)); c.lineTo(W, y(db)); c.stroke(); }
    const path = (fn, colour, dash) => {
      c.strokeStyle = colour; c.lineWidth = 1.5 * devicePixelRatio; c.setLineDash(dash || []);
      c.beginPath();
      for (let i = 0; i <= 120; i++) { const f = fMin * Math.pow(fMax / fMin, i / 120); const yy = y(fn(f)); i ? c.lineTo(x(f), yy) : c.moveTo(x(f), yy); }
      c.stroke(); c.setLineDash([]);
    };
    const sp = spreadDb(p);
    path(f => sp - alphaAir(f, p.t, p.rh) * (Math.max(p.d, 1) - 1), col('--muted'), [4, 4]);   // только воздух + расхождение
    path(f => sp + curveDb(f, p), col('--accent'));                                                // всё вместе
    c.fillStyle = col('--muted'); c.font = `${10 * devicePixelRatio}px system-ui`;
    for (const [f, l] of [[63, '63'], [250, '250'], [1000, '1k'], [4000, '4k'], [8000, '8k']]) c.fillText(l, x(f) + 2, H - 3);
    c.fillText('0', 2, 10 * devicePixelRatio); c.fillText('−60 дБ', 2, H - 3 - 10 * devicePixelRatio);
  }

  // таблица для отчёта: дБ по октавам на дистанции d
  function table(p) { return OCT.map(f => ({ f, air: -alphaAir(f, p.t, p.rh) * (p.d - 1), ground: p.ground === false ? 0 : -interpOct(groundOctaves(p.d, p.hs, p.hr, p.g), f), spread: spreadDb(p) })); }

  return { alphaAir, groundOctaves, curveDb, spreadDb, designIR, create, createStatic, paramsFrom, toMetres, toTemp, toRh, fmtMetres, SUBS, PRESETS, groundFor, draw, table, OCT, TAPS };
})();

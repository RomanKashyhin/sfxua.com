// SFX Lab · модули обработки. Цепочка — упорядоченный список экземпляров { uid, id, on, p }.
// Цепочки живут на ниточках схемы (компонент → узел: set.wireFx[compId]) и на шине набора (узел → дистанция: set.fx).
// Модули берутся из палитры и перетягиваются на ниточку; один и тот же модуль может стоять несколько раз.
// У каждого модуля есть значок и объяснение (подсказка при наведении) и живая картинка того, что он делает (ui.js).
// Каждый экземпляр: вход → сухой → сумма и вход → обработка → мокрый → сумма (кроссфейд при выключении, без щелчков).
// Та же цепочка строится на офлайн-контексте при экспорте, поэтому выгрузка звучит как в тулзе.
//
// «Умный EQ» (aeq) — два режима, можно оба сразу:
//   • по слуху (ISO 226:2003, кривые равной громкости, то, что раньше звали Флетчер–Мансон): меряет громкость сигнала,
//     переводит в фоны (калибровка «0 dBFS = N дБ SPL») и докручивает низ/верх так, как ухо слышало бы этот звук
//     на опорной громкости. Тихий сигнал ⇒ больше низа и верха; громче опоры ⇒ наоборот. Зависит от громкости, не от дистанции.
//   • к шуму: меряет долгий спектр сигнала по октавам и подтягивает его к белому (0 дБ/окт), розовому (−3) или
//     коричневому (−6) шуму; «сила» — насколько, «скорость» — как быстро следит.
//   Оба режима работают одним банком из 10 октавных фильтров (31,5 Гц … 16 кГц).

const Fx = (() => {
  const dbToGain = db => Math.pow(10, db / 20);
  const lin = (v, a, b) => a + (b - a) * v / 100;
  const log = (v, a, b) => a * Math.pow(b / a, v / 100);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- ISO 226:2003 ----------
  const ISO_F  = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500];
  const ISO_AF = [0.532, 0.506, 0.480, 0.455, 0.432, 0.409, 0.387, 0.367, 0.349, 0.330, 0.315, 0.301, 0.288, 0.276, 0.267, 0.259, 0.253, 0.250, 0.246, 0.244, 0.243, 0.243, 0.243, 0.242, 0.242, 0.245, 0.254, 0.271, 0.301];
  const ISO_LU = [-31.6, -27.2, -23.0, -19.1, -16.1, -13.0, -10.3, -8.1, -6.2, -4.5, -3.1, -2.0, -1.1, -0.4, 0.0, 0.3, 0.5, 0.0, -2.7, -4.1, -1.0, 1.7, 2.5, 1.2, -2.1, -7.1, -11.2, -10.7, -3.1];
  const ISO_TF = [78.5, 68.7, 59.5, 51.1, 44.0, 37.5, 31.5, 26.5, 22.1, 17.9, 14.4, 11.4, 8.6, 6.2, 4.4, 3.0, 2.2, 2.4, 3.5, 1.7, -1.3, -4.2, -6.0, -5.4, -1.5, 6.0, 12.6, 13.9, 12.3];
  // уровень давления (дБ SPL) на частоте таблицы i, который звучит как Ln фон
  function isoAt(i, Ln) {
    const af = ISO_AF[i], Lu = ISO_LU[i], Tf = ISO_TF[i];
    const Af = 4.47e-3 * (Math.pow(10, 0.025 * Ln) - 1.15) + Math.pow(0.4 * Math.pow(10, (Tf + Lu) / 10 - 9), af);
    return 10 / af * Math.log10(Af) - Lu + 94;
  }
  // то же на любой частоте: интерполяция по log f, за краями таблицы — крайние значения
  function isoLp(f, Ln) {
    Ln = clamp(Ln, 0, 100);
    if (f <= ISO_F[0]) return isoAt(0, Ln);
    if (f >= ISO_F[ISO_F.length - 1]) return isoAt(ISO_F.length - 1, Ln);
    let i = 0; while (ISO_F[i + 1] < f) i++;
    const t = Math.log(f / ISO_F[i]) / Math.log(ISO_F[i + 1] / ISO_F[i]);
    return isoAt(i, Ln) * (1 - t) + isoAt(i + 1, Ln) * t;
  }
  // поправка (дБ) на частоте f, чтобы сигнал уровнем L фон слышался как на опорной громкости Lref фон
  const isoGain = (f, L, Lref) => (isoLp(f, L) - isoLp(f, Lref)) - (L - Lref);

  const BANDS = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const SLOPES = { white: 0, pink: -3, brown: -6 };

  // icon — символ из спрайта (#i-…), hint — коротко на плитке, desc — что делает, hear — что слышно (подсказка при наведении)
  const MODULES = [
    { id: 'sat', name: 'Сатурация', short: 'САТ', icon: 'sat', hint: 'плотнее и теплее',
      desc: 'Мягко поджимает пики волны (tanh): громкие места чуть сплющиваются, появляются тёплые гармоники. «Микс» — сколько обработанного подмешать к сухому.',
      hear: 'звук плотнее, ближе, «толще»; на большом драйве — хрипотца и песок', params: [
      { id: 'drive', name: 'драйв', default: 30, fmt: v => v + ' %' },
      { id: 'mix',   name: 'микс',  default: 100, fmt: v => v + ' %' },
    ] },
    { id: 'comp', name: 'Компрессор', short: 'КОМ', icon: 'comp', hint: 'ровнее по громкости',
      desc: 'Всё, что громче порога, прижимается в «степень» раз. «Атака» — как быстро ловит удар, «отпуск» — как быстро отпускает, «добавка» возвращает громкость.',
      hear: 'шаги ровнее по громкости, хвост слышнее; быстрая атака притупляет удар, медленная — наоборот подчёркивает', params: [
      { id: 'thr',     name: 'порог',   default: 60, fmt: v => lin(v, -48, 0).toFixed(0) + ' дБ' },
      { id: 'ratio',   name: 'степень', default: 30, fmt: v => lin(v, 1, 12).toFixed(1) + ':1' },
      { id: 'attack',  name: 'атака',   default: 25, fmt: v => log(v, 1, 60).toFixed(0) + ' мс' },
      { id: 'release', name: 'отпуск',  default: 40, fmt: v => log(v, 40, 600).toFixed(0) + ' мс' },
      { id: 'makeup',  name: 'добавка', default: 25, fmt: v => '+' + lin(v, 0, 12).toFixed(0) + ' дБ' },
    ] },
    { id: 'eq', name: 'Эквалайзер', short: 'EQ', icon: 'eq', hint: 'низ · середина · верх',
      desc: 'Три ручки тембра: полка ниже 120 Гц, колокол вокруг 1 кГц, полка выше 6 кГц, каждая ±12 дБ.',
      hear: 'низ — вес и гул; середина — тело и «картон»; верх — хруст и воздух', params: [
      { id: 'low',  name: 'низ',      default: 50, fmt: v => lin(v, -12, 12).toFixed(0) + ' дБ' },
      { id: 'mid',  name: 'середина', default: 50, fmt: v => lin(v, -12, 12).toFixed(0) + ' дБ' },
      { id: 'high', name: 'верх',     default: 50, fmt: v => lin(v, -12, 12).toFixed(0) + ' дБ' },
    ] },
    { id: 'aeq', name: 'Умный EQ', short: 'УEQ', icon: 'ear', hint: 'по слуху · к шуму',
      desc: '«По слуху»: меряет громкость сигнала и докручивает низ и верх так, как ухо слышало бы его на опорной громкости (кривые равной громкости ISO 226). «К шуму»: подтягивает долгий спектр к белому, розовому или коричневому шуму.',
      hear: 'тихий звук не становится тонким — низ и верх возвращаются; «к шуму» выравнивает тембр', params: [
      { id: 'iso',      name: 'по слуху', type: 'toggle', default: 1, hint: 'кривые равной громкости: тихий звук теряет низ и верх, докручиваем как на опорной громкости' },
      { id: 'ref',      name: 'опора',    default: 75, fmt: v => lin(v, 40, 100).toFixed(0) + ' фон', group: 'iso' },
      { id: 'cal',      name: '0 dBFS',   default: 50, fmt: v => lin(v, 70, 110).toFixed(0) + ' дБ', group: 'iso' },
      { id: 'isoAmt',   name: 'сила',     default: 100, fmt: v => v + ' %', group: 'iso' },
      { id: 'match',    name: 'к шуму',   type: 'toggle', default: 0, hint: 'подтянуть долгий спектр к выбранному шуму' },
      { id: 'target',   name: 'цель',     type: 'select', default: 'pink', options: [['white', 'белый 0 дБ/окт'], ['pink', 'розовый −3'], ['brown', 'коричневый −6']], group: 'match' },
      { id: 'matchAmt', name: 'сила',     default: 60, fmt: v => v + ' %', group: 'match' },
      { id: 'speed',    name: 'скорость', default: 40, fmt: v => log(v, 0.1, 5).toFixed(2) + ' с', group: 'match' },
    ] },
    { id: 'room', name: 'Комната', short: 'КОМН', icon: 'room', hint: 'воздух вокруг',
      desc: 'Короткий синтетический хвост отражений: «размер» — его длина, «микс» — сколько подмешать к сухому удару.',
      hear: 'вокруг шага появляется помещение; слишком много — «ванная»', params: [
      { id: 'size', name: 'размер', default: 40, fmt: v => log(v, 0.05, 0.8).toFixed(2) + ' с' },
      { id: 'mix',  name: 'микс',   default: 30, fmt: v => Math.round(lin(v, 0, 50)) + ' %' },
    ] },
  ];
  const def = id => MODULES.find(m => m.id === id);
  const defaultP = id => Object.fromEntries((def(id)?.params || []).map(p => [p.id, p.default]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const make = id => ({ uid: uid(), id, on: true, p: defaultP(id) });
  // старый формат (список всех модулей с флагами on) → новый (только добавленные, с uid)
  function migrate(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(x => def(x.id) && (x.uid || x.on)).map(x => ({ uid: x.uid || uid(), id: x.id, on: x.on !== false, p: { ...defaultP(x.id), ...(x.p || {}) } }));
  }
  const live = new Map();   // ключ (setId или setId/compId) → живая цепочка
  const MEMO = new Map();   // uid умного EQ → последние измеренные усиления полос (для офлайн-экспорта)

  function satCurve(drive) {
    const k = 1 + drive / 100 * 14, n = 2048, c = new Float32Array(n), norm = Math.tanh(k);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
    return c;
  }
  function roomIR(ctx, seconds) {
    const sr = ctx.sampleRate, n = Math.max(1, Math.round(sr * seconds)), buf = ctx.createBuffer(2, n, sr), tau = seconds / 4;
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / sr / tau) * 0.35; }
    return buf;
  }

  // один модуль: in → dry → sum, in → proc → wet → sum
  function makeModule(ctx, id, muid) {
    const inp = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), sum = ctx.createGain();
    inp.connect(dry).connect(sum); wet.connect(sum);
    const m = { id, uid: muid, inp, dry, wet, sum, nodes: {}, cfg: null, anIn: null, anOut: null };
    if (typeof audio !== 'undefined' && ctx === audio.ctx) {   // метры «вход / выход» для картинки модуля
      m.anIn = ctx.createAnalyser(); m.anIn.fftSize = 256; m.anOut = ctx.createAnalyser(); m.anOut.fftSize = 256;
      inp.connect(m.anIn); sum.connect(m.anOut);
    }
    if (id === 'sat') {
      const ws = ctx.createWaveShaper(); ws.oversample = '2x'; ws.curve = satCurve(30);
      inp.connect(ws).connect(wet); m.nodes = { ws, drive: 30 };
    } else if (id === 'comp') {
      const c = ctx.createDynamicsCompressor(), mk = ctx.createGain(); c.knee.value = 12;
      inp.connect(c).connect(mk).connect(wet); m.nodes = { c, mk };
    } else if (id === 'eq') {
      const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 120;
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.9;
      const hi = ctx.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 6000;
      inp.connect(lo).connect(mid).connect(hi).connect(wet); m.nodes = { lo, mid, hi };
    } else if (id === 'aeq') {
      const bank = BANDS.map((f, i) => {
        const b = ctx.createBiquadFilter();
        if (i === 0) { b.type = 'lowshelf'; b.frequency.value = 45; }
        else if (i === BANDS.length - 1) { b.type = 'highshelf'; b.frequency.value = 11300; }
        else { b.type = 'peaking'; b.frequency.value = f; b.Q.value = 1.2; }
        return b;
      });
      let prev = inp; for (const b of bank) { prev.connect(b); prev = b; } prev.connect(wet);
      const liveCtx = typeof audio !== 'undefined' && ctx === audio.ctx;
      let an = null, td = null, fd = null;
      if (liveCtx) { an = ctx.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0.6; inp.connect(an); td = new Float32Array(an.fftSize); fd = new Float32Array(an.frequencyBinCount); }
      m.nodes = { bank, an, td, fd, lvl: -60, g: new Float32Array(BANDS.length), iso: new Float32Array(BANDS.length), match: new Float32Array(BANDS.length), spec: null, last: 0 };
    } else if (id === 'room') {
      const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = roomIR(ctx, 0.2);
      inp.connect(conv).connect(wet); m.nodes = { conv, size: 0.2 };
    }
    return m;
  }
  function teardown(m) {
    for (const n of [m.inp, m.dry, m.wet, m.sum, m.anIn, m.anOut, ...Object.values(m.nodes).filter(x => x && typeof x.disconnect === 'function'), ...(m.nodes.bank || [])]) { try { n.disconnect(); } catch (e) {} }
  }
  function applyModule(ctx, m, cfg, smooth) {
    const now = ctx.currentTime, set = (param, v) => smooth ? param.setTargetAtTime(v, now, 0.03) : (param.value = v);
    const p = cfg.p, on = !!cfg.on; m.cfg = cfg;
    let wetLevel = on ? 1 : 0, dryLevel = on ? 0 : 1;
    if (m.id === 'sat') { if (m.nodes.drive !== p.drive) { m.nodes.ws.curve = satCurve(p.drive); m.nodes.drive = p.drive; } if (on) { wetLevel = p.mix / 100; dryLevel = 1 - p.mix / 100; } }
    else if (m.id === 'comp') { const c = m.nodes.c; set(c.threshold, lin(p.thr, -48, 0)); set(c.ratio, lin(p.ratio, 1, 12)); set(c.attack, log(p.attack, 1, 60) / 1000); set(c.release, log(p.release, 40, 600) / 1000); set(m.nodes.mk.gain, dbToGain(lin(p.makeup, 0, 12))); }
    else if (m.id === 'eq') { set(m.nodes.lo.gain, lin(p.low, -12, 12)); set(m.nodes.mid.gain, lin(p.mid, -12, 12)); set(m.nodes.hi.gain, lin(p.high, -12, 12)); }
    else if (m.id === 'aeq') {
      if (!m.nodes.an) {                                   // офлайн: берём то, что намеряли вживую, иначе считаем сигнал −20 dBFS
        const memo = MEMO.get(m.uid), g = memo ? memo.g : aeqStatic(p, -20);
        m.nodes.bank.forEach((b, i) => { b.gain.value = on ? g[i] : 0; });
      }
    }
    else if (m.id === 'room') {
      const size = log(p.size, 0.05, 0.8);
      if (Math.abs(size - m.nodes.size) > 0.005) { const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = roomIR(ctx, size); try { m.nodes.conv.disconnect(); } catch (e) {} m.inp.connect(conv).connect(m.wet); m.nodes.conv = conv; m.nodes.size = size; }
      if (on) { wetLevel = lin(p.mix, 0, 50) / 100; dryLevel = 1; }
    }
    set(m.wet.gain, wetLevel); set(m.dry.gain, dryLevel);
  }
  // усиления полос умного EQ без измерения спектра (только режим «по слуху» при заданном уровне, dBFS)
  function aeqStatic(p, dbfs) {
    const g = new Float32Array(BANDS.length);
    if (p.iso) { const L = clamp(lin(p.cal, 70, 110) + dbfs, 10, 100), Lref = lin(p.ref, 40, 100); BANDS.forEach((f, i) => { g[i] = clamp(isoGain(f, L, Lref) * p.isoAmt / 100, -18, 18); }); }
    return g;
  }
  // живой тик умного EQ (каждые ~30 мс): громкость → фоны → поправка по слуху; спектр по октавам → подгонка к шуму
  function aeqTick(ctx, m) {
    const n = m.nodes, p = m.cfg?.p; if (!n.an || !p) return;
    const now = performance.now(), dt = Math.min(0.2, (now - (n.last || now)) / 1000); n.last = now;
    n.an.getFloatTimeDomainData(n.td);
    let s = 0; for (let i = 0; i < n.td.length; i++) s += n.td[i] * n.td[i];
    const dbfs = 20 * Math.log10(Math.sqrt(s / n.td.length) + 1e-7);
    const present = dbfs > -60;                                                // тишина: ничего не меряем, держим последнее
    n.lvl = dbfs > n.lvl ? dbfs : Math.max(dbfs, n.lvl - 10 * dt, -60);        // вверх сразу, вниз 10 дБ/с, пол −60 dBFS
    const tau = log(p.speed, 0.1, 5), k = 1 - Math.exp(-dt / tau);
    const L = clamp(lin(p.cal, 70, 110) + n.lvl, 10, 100), Lref = lin(p.ref, 40, 100);
    if (p.iso) { if (present) BANDS.forEach((f, i) => { const t = clamp(isoGain(f, L, Lref) * p.isoAmt / 100, -18, 18); n.iso[i] += (t - n.iso[i]) * (Math.abs(t) < Math.abs(n.iso[i]) ? 0.6 : Math.min(1, k * 3)); }); }   // к нулю быстро (атака), от нуля плавно
    else n.iso.fill(0);
    if (p.match && present) {
      n.an.getFloatFrequencyData(n.fd);
      const sr = ctx.sampleRate, binHz = sr / n.an.fftSize, slope = SLOPES[p.target] ?? -3, dev = [];
      for (const f of BANDS) {
        const a = Math.max(1, Math.floor(f / Math.SQRT2 / binHz)), b = Math.min(n.fd.length - 1, Math.ceil(f * Math.SQRT2 / binHz));
        let e = 0, c = 0; for (let i = a; i <= b; i++) { e += Math.pow(10, n.fd[i] / 10); c++; }
        dev.push(c ? 10 * Math.log10(e / c + 1e-12) - slope * Math.log2(f / 1000) : NaN);
      }
      const ok = dev.filter(x => Number.isFinite(x) && x > -95), mean = ok.length ? ok.reduce((x, y) => x + y, 0) / ok.length : 0;
      BANDS.forEach((f, i) => { const d = Number.isFinite(dev[i]) && dev[i] > -95 ? dev[i] - mean : 0; n.match[i] += (clamp(-d * p.matchAmt / 100, -15, 15) - n.match[i]) * k; });
    } else if (!p.match) n.match.fill(0);
    const on = !!m.cfg.on;
    BANDS.forEach((f, i) => { const g = on ? clamp(n.iso[i] + n.match[i], -18, 18) : 0; if (Math.abs(g - n.g[i]) > 0.05) { n.g[i] = g; n.bank[i].gain.setTargetAtTime(g, ctx.currentTime, 0.05); } });
    MEMO.set(m.uid, { g: Float32Array.from(n.g), lvl: n.lvl, phon: L });
  }
  let timer = 0;
  function startTicks() {
    if (timer) return;
    timer = setInterval(() => { for (const ch of live.values()) for (const m of ch.mods) if (m.id === 'aeq' && m.nodes.an) aeqTick(ch.ctx, m); }, 30);
  }

  // цепочка на контексте из списка экземпляров; для audio.ctx регистрируется как живая по ключу
  function build(ctx, list, key) {
    const input = ctx.createGain(), output = ctx.createGain();
    const chain = { ctx, key, input, output, mods: [], sig: null,
      update(l, smooth = true) {
        l = Array.isArray(l) ? l : [];
        const sig = l.map(x => x.uid + ':' + x.id).join(',');
        if (sig !== chain.sig) {
          try { input.disconnect(); } catch (e) {}
          for (const m of chain.mods) teardown(m);
          chain.mods = l.map(x => makeModule(ctx, x.id, x.uid));
          let prev = input; for (const m of chain.mods) { prev.connect(m.inp); prev = m.sum; } prev.connect(output);
          chain.sig = sig; smooth = false;
        }
        chain.mods.forEach((m, i) => applyModule(ctx, m, { on: l[i].on !== false, p: { ...defaultP(m.id), ...(l[i].p || {}) } }, smooth));
      } };
    chain.update(list, false);
    if (key && typeof audio !== 'undefined' && ctx === audio.ctx) { live.set(key, chain); startTicks(); }
    return chain;
  }
  // модуль на тихом офлайн-контексте: кривые для картинок, когда живого звука ещё нет
  let pctx = null; const previews = new Map();
  function preview(cfg) {
    if (!pctx) pctx = new OfflineAudioContext(1, 128, 48000);
    let m = previews.get(cfg.uid); if (!m || m.id !== cfg.id) { m = makeModule(pctx, cfg.id, cfg.uid); previews.set(cfg.uid, m); }
    applyModule(pctx, m, { on: cfg.on !== false, p: { ...defaultP(cfg.id), ...(cfg.p || {}) } }, false);
    return m;
  }
  const mod = (key, muid) => live.get(key)?.mods.find(m => m.uid === muid) || null;
  const summary = list => (list || []).filter(x => x.on !== false).map(x => def(x.id)?.name).join(' → ') || 'без обработки';
  const memo = muid => MEMO.get(muid);

  return { MODULES, BANDS, def, make, migrate, defaultP, build, live: key => live.get(key), mod, preview, summary, satCurve, isoLp, isoGain, memo };
})();

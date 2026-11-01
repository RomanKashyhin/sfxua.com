// SFX Lab · цепочка модулей обработки на шине набора: компоненты → [Мягкость → Сатурация → Компрессор → EQ → Комната] → дистанция.
// Каждый модуль можно включить/выключить (кроссфейд сухого и обработанного), у каждого две-пять ручек 0…100.
// Та же цепочка строится и на офлайн-контексте при экспорте, поэтому выгрузка звучит как в тулзе.

const Fx = (() => {
  const dbToGain = db => Math.pow(10, db / 20);
  const lin = (v, a, b) => a + (b - a) * v / 100;
  const log = (v, a, b) => a * Math.pow(b / a, v / 100);
  const MODULES = [
    { id: 'soft', name: 'Мягкость', hint: 'тупее и ближе: срез верха и полка от 4 кГц', params: [
      { id: 'cut',   name: 'срез',  default: 100, fmt: v => Math.round(log(v, 800, 20000)) + ' Гц' },
      { id: 'shelf', name: 'верх',  default: 50,  fmt: v => (lin(v, -18, 0)).toFixed(0) + ' дБ' },
    ] },
    { id: 'sat', name: 'Сатурация', hint: 'мягкое насыщение tanh, плотнее и теплее', params: [
      { id: 'drive', name: 'драйв', default: 30, fmt: v => v + ' %' },
      { id: 'mix',   name: 'микс',  default: 100, fmt: v => v + ' %' },
    ] },
    { id: 'comp', name: 'Компрессор', hint: 'ровнее по громкости, атаку можно придавить', params: [
      { id: 'thr',     name: 'порог',   default: 60, fmt: v => lin(v, -48, 0).toFixed(0) + ' дБ' },
      { id: 'ratio',   name: 'степень', default: 30, fmt: v => lin(v, 1, 12).toFixed(1) + ':1' },
      { id: 'attack',  name: 'атака',   default: 25, fmt: v => log(v, 1, 60).toFixed(0) + ' мс' },
      { id: 'release', name: 'отпуск',  default: 40, fmt: v => log(v, 40, 600).toFixed(0) + ' мс' },
      { id: 'makeup',  name: 'добавка', default: 25, fmt: v => '+' + lin(v, 0, 12).toFixed(0) + ' дБ' },
    ] },
    { id: 'eq', name: 'Эквалайзер', hint: 'три полки: низ 120 Гц, середина 1 кГц, верх 6 кГц', params: [
      { id: 'low',  name: 'низ',      default: 50, fmt: v => lin(v, -12, 12).toFixed(0) + ' дБ' },
      { id: 'mid',  name: 'середина', default: 50, fmt: v => lin(v, -12, 12).toFixed(0) + ' дБ' },
      { id: 'high', name: 'верх',     default: 50, fmt: v => lin(v, -12, 12).toFixed(0) + ' дБ' },
    ] },
    { id: 'room', name: 'Комната', hint: 'короткий синтетический хвост, воздух вокруг шага', params: [
      { id: 'size', name: 'размер', default: 40, fmt: v => log(v, 0.05, 0.8).toFixed(2) + ' с' },
      { id: 'mix',  name: 'микс',   default: 30, fmt: v => Math.round(lin(v, 0, 50)) + ' %' },
    ] },
  ];
  const defaults = () => MODULES.map(m => ({ id: m.id, on: false, p: Object.fromEntries(m.params.map(p => [p.id, p.default])) }));
  const live = new Map();   // setId → живая цепочка

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
  function makeModule(ctx, id) {
    const inp = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), sum = ctx.createGain();
    inp.connect(dry).connect(sum); wet.connect(sum);
    const m = { id, inp, dry, wet, sum, nodes: {} };
    if (id === 'soft') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
      const sh = ctx.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 4000;
      inp.connect(lp).connect(sh).connect(wet); m.nodes = { lp, sh };
    } else if (id === 'sat') {
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
    } else if (id === 'room') {
      const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = roomIR(ctx, 0.2);
      inp.connect(conv).connect(wet); m.nodes = { conv, size: 0.2 };
    }
    return m;
  }
  function applyModule(ctx, m, cfg, smooth) {
    const now = ctx.currentTime, set = (param, v) => smooth ? param.setTargetAtTime(v, now, 0.03) : (param.value = v);
    const p = cfg.p, on = !!cfg.on;
    let wetLevel = on ? 1 : 0, dryLevel = on ? 0 : 1;
    if (m.id === 'soft') { set(m.nodes.lp.frequency, log(p.cut, 800, 20000)); set(m.nodes.sh.gain, lin(p.shelf, -18, 0)); }
    else if (m.id === 'sat') { if (m.nodes.drive !== p.drive) { m.nodes.ws.curve = satCurve(p.drive); m.nodes.drive = p.drive; } if (on) { wetLevel = p.mix / 100; dryLevel = 1 - p.mix / 100; } }
    else if (m.id === 'comp') { const c = m.nodes.c; set(c.threshold, lin(p.thr, -48, 0)); set(c.ratio, lin(p.ratio, 1, 12)); set(c.attack, log(p.attack, 1, 60) / 1000); set(c.release, log(p.release, 40, 600) / 1000); set(m.nodes.mk.gain, dbToGain(lin(p.makeup, 0, 12))); }
    else if (m.id === 'eq') { set(m.nodes.lo.gain, lin(p.low, -12, 12)); set(m.nodes.mid.gain, lin(p.mid, -12, 12)); set(m.nodes.hi.gain, lin(p.high, -12, 12)); }
    else if (m.id === 'room') {
      const size = log(p.size, 0.05, 0.8);
      if (Math.abs(size - m.nodes.size) > 0.005) { const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = roomIR(ctx, size); try { m.nodes.conv.disconnect(); } catch (e) {} m.inp.connect(conv).connect(m.wet); m.nodes.conv = conv; m.nodes.size = size; }
      if (on) { wetLevel = lin(p.mix, 0, 50) / 100; dryLevel = 1; }
    }
    set(m.wet.gain, wetLevel); set(m.dry.gain, dryLevel);
  }

  // цепочка на контексте; list — set.fx; для audio.ctx регистрируется как живая по setId
  function build(ctx, list, setId) {
    const input = ctx.createGain(), output = ctx.createGain();
    const mods = MODULES.map(d => makeModule(ctx, d.id));
    let prev = input; for (const m of mods) { prev.connect(m.inp); prev = m.sum; } prev.connect(output);
    const chain = { input, output, mods, update(l, smooth = true) { for (const m of mods) { const cfg = (l || []).find(x => x.id === m.id) || { on: false, p: {} }; applyModule(ctx, m, { on: cfg.on, p: { ...Object.fromEntries(MODULES.find(d => d.id === m.id).params.map(p => [p.id, p.default])), ...cfg.p } }, smooth); } } };
    chain.update(list, false);
    if (setId && typeof audio !== 'undefined' && ctx === audio.ctx) live.set(setId, chain);
    return chain;
  }
  const summary = list => (list || []).filter(x => x.on).map(x => MODULES.find(d => d.id === x.id)?.name).join(' → ') || 'без обработки';

  return { MODULES, defaults, build, live: id => live.get(id), summary, satCurve };
})();

// SFX Lab · экспорт WAV-файлами слоями.
// Шаги: один вариант = один план шага (какие сэмплы, случайный питч/громкость/сдвиг) с сеяной случайностью.
//   План рендерится несколько раз на OfflineAudioContext — по одному разу на группу компонентов (шаг / ткань /
//   поверхность …) тем же графом, что играет вживую (полосы, макро-громкости, шина, по желанию дистанция).
// Вжухи: один вариант = один вжух с сеяными стартовыми точками шума и текстур; файл на группу слоёв (шум / текстура 1 / …).
// Эмбиент: каждая петля рендерится отрезком заданной длины с теми же макро-параметрами (громкость, срез, скорость);
//   хвост заворачивается на начало равномощным кроссфейдом, поэтому файл зациклен без шва.
// Во всех случаях сумма файлов одного варианта равна миксу. Итог — zip: wav на группу × вариант и recipe.json.

const Export = (() => {
  const DEFAULT_GROUPS = [
    { id: 'step',    name: 'шаг',         comps: ['heel', 'tip', 'rel'] },
    { id: 'cloth',   name: 'ткань',       comps: ['acc1', 'acc2'] },
    { id: 'surface', name: 'поверхность', comps: ['generic', 'slide'] },
  ];
  function mulberry32(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const seedFor = (seed, v) => seed * 7919 + v * 104729 + 17;
  // общий хвост шины: модули набора (если хоть один включён) и, по желанию, дистанция
  function tailChain(ctx, set, tail, opts, distParams) {
    if (set.fx && set.fx.some(x => x.on)) { const fx = Fx.build(ctx, set.fx); tail.connect(fx.input); tail = fx.output; }
    if (opts.withDistance && distParams && distParams.d > 1) { const d = Distance.createStatic(ctx, distParams); tail.connect(d.input); tail = d.output; }
    tail.connect(ctx.destination);
  }
  const jobsOf = (groups, opts) => [...groups.filter(g => g.comps.length), ...(opts.mix ? [{ id: 'mix', name: 'микс', comps: null }] : [])];

  // ---------- шаги ----------
  async function renderSteps(set, opts, onProgress) {
    const variants = opts.variants ?? 6, sr = opts.sr ?? 48000, seed = opts.seed ?? 1;
    const S = Steps.state, prevRng = S.rng, prevLast = new Map(S.last);
    const jobs = jobsOf(opts.groups, opts);
    const out = [];
    try {
      for (let v = 0; v < variants; v++) {
        S.rng = mulberry32(seedFor(seed, v)); S.last.clear();
        const plan = Steps.planStep(v % 2 ? 'R' : 'L', 0.02);
        if (!plan.length) throw new Error('нет загруженных сэмплов');
        const len = Math.min(4, Math.max(...plan.map(h => h.t + Math.abs(h.jitter) + h.buf.duration / Math.pow(2, h.pitch - 1))) + 0.1);
        for (const g of jobs) {
          const inGroup = id => !g.comps || g.comps.includes(id);
          const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
          const bus = Steps.buildBus(ctx, { audible: id => inGroup(id) && (opts.audible ? opts.audible(id) : true) });
          tailChain(ctx, set, bus.out, opts, S.distParams);
          for (const h of plan) if (inGroup(h.comp)) Steps.playHit(h, ctx, bus.comps);
          const buf = await ctx.startRendering();
          out.push({ v, group: g, buf, plan: plan.filter(h => inGroup(h.comp)) });
          onProgress?.(out.length, variants * jobs.length);
        }
      }
    } finally { S.rng = prevRng; S.last = prevLast; }
    return out;
  }

  // ---------- вжухи ----------
  async function renderWhoosh(set, opts, onProgress) {
    const variants = opts.variants ?? 6, sr = opts.sr ?? 48000, seed = opts.seed ?? 1;
    const S = Whoosh.state, prevRng = S.rng, P = { ...S.P };
    const jobs = jobsOf(opts.groups, opts);
    const out = [];
    try {
      for (let v = 0; v < variants; v++) {
        for (const g of jobs) {
          S.rng = mulberry32(seedFor(seed, v));                   // одна и та же случайность для всех групп варианта
          const inGroup = id => !g.comps || g.comps.includes(id);
          const len = P.dur + 0.1 + (opts.withDistance && S.distParams ? 0.1 : 0);
          const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
          const r = Whoosh.render(ctx, set, P, 0.02, { audible: id => inGroup(id) && (opts.audible ? opts.audible(id) : true) });
          if (!r.voices.length) { if (g.comps === null) throw new Error('нет включённых слоёв с источником'); continue; }   // группа без звука: файла нет
          tailChain(ctx, set, r.out, opts, S.distParams);
          const buf = await ctx.startRendering();
          out.push({ v, group: g, buf, voices: r.voices.map(x => ({ layer: x.layer.id, src: x.layer.type === 'noise' ? x.layer.src : (x.layer.file || x.layer.blob?.name || ''), offsetMs: Math.round(x.offset * 1000) })) });
          onProgress?.(v * jobs.length + jobs.indexOf(g) + 1, variants * jobs.length);
        }
      }
    } finally { S.rng = prevRng; }
    return out;
  }

  // ---------- эмбиент (петли) ----------
  // opts.buffers(layerId) → AudioBuffer, opts.params → set.params (gain дБ / cutoff / rate на слой, __distance), opts.userGain(layer) → линейный
  async function renderLoops(set, opts, onProgress) {
    const sr = opts.sr ?? 48000, seconds = opts.seconds ?? 10, xf = Math.min(opts.xfade ?? 1, seconds / 2);
    const jobs = jobsOf(opts.groups, opts), out = [];
    const params = opts.params || {};
    for (const g of jobs) {
      const inGroup = id => !g.comps || g.comps.includes(id);
      const ctx = new OfflineAudioContext(2, Math.ceil((seconds + xf) * sr), sr), bus = ctx.createGain();
      let n = 0;
      const used = [];
      for (const l of set.layers) {
        const buf = opts.buffers(l.id); if (!buf || !inGroup(l.id)) continue;
        const p = params[l.id] || {}, ug = opts.userGain ? opts.userGain(l) : 1;
        if (ug <= 0) continue;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = p.rate ?? 1;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(40, Math.min(20000, p.cutoff ?? 20000)); lp.Q.value = 0.5;
        const mg = ctx.createGain(); mg.gain.value = p.gain != null ? Math.pow(10, p.gain / 20) : 1;
        const u = ctx.createGain(); u.gain.value = ug;
        src.connect(lp).connect(mg).connect(u).connect(bus);
        src.start(0, (opts.start ?? 0) % buf.duration);
        used.push({ layer: l.id, file: l.file || l.blob?.name || '', gainDb: +(20 * Math.log10(mg.gain.value * ug)).toFixed(2), cutoff: Math.round(lp.frequency.value), rate: +src.playbackRate.value.toFixed(4) });
        n++;
      }
      if (!n && g.comps === null) throw new Error('нет загруженных петель');
      tailChain(ctx, set, bus, opts, params.__distance);
      const buf = await ctx.startRendering();
      out.push({ v: 0, group: g, buf, chs: foldLoop(buf, seconds, xf), used });
      onProgress?.(out.length, jobs.length);
    }
    return out;
  }
  // хвост (последние xf с) заворачивается на начало равномощным кроссфейдом → бесшовная петля длиной seconds
  function foldLoop(buf, seconds, xf) {
    const sr = buf.sampleRate, N = Math.round(seconds * sr), X = Math.round(xf * sr), chs = [];
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c), o = new Float32Array(N);
      o.set(d.subarray(0, N));
      for (let i = 0; i < X && N + i < d.length; i++) { const t = i / X; o[i] = o[i] * Math.sin(t * Math.PI / 2) + d[N + i] * Math.cos(t * Math.PI / 2); }
      chs.push(o);
    }
    return chs;
  }

  // ---------- обрезка хвоста и нормализация ----------
  function trimmed(buf) {
    const n = buf.length, chs = []; for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    let last = 0; const thr = 1e-4;
    for (let i = n - 1; i >= 0; i--) { let hit = false; for (const ch of chs) if (Math.abs(ch[i]) > thr) { hit = true; break; } if (hit) { last = i; break; } }
    const end = Math.min(n, last + Math.round(buf.sampleRate * 0.05));
    return chs.map(ch => ch.subarray(0, Math.max(end, Math.round(buf.sampleRate * 0.1))));
  }
  const peakOf = chs => { let p = 0; for (const ch of chs) for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > p) p = a; } return p; };

  // ---------- WAV PCM 16/24 бит ----------
  function wav(chs, sr, bits) {
    const n = chs[0].length, nch = chs.length, bps = bits / 8, dataLen = n * nch * bps;
    const ab = new ArrayBuffer(44 + dataLen), dv = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, nch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * nch * bps, true);
    dv.setUint16(32, nch * bps, true); dv.setUint16(34, bits, true); str(36, 'data'); dv.setUint32(40, dataLen, true);
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) {
      const x = Math.max(-1, Math.min(1, chs[c][i]));
      if (bits === 16) { dv.setInt16(o, Math.round(x * 32767), true); o += 2; }
      else { const v = Math.round(x * 8388607); dv.setUint8(o, v & 255); dv.setUint8(o + 1, (v >> 8) & 255); dv.setUint8(o + 2, (v >> 16) & 255); o += 3; }
    }
    return new Uint8Array(ab);
  }

  // ---------- zip без сжатия ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const now = new Date(), dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(8, 0, true); h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(10, 0, true); c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true);
      c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    }
    const cdLen = central.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(4, 0, true); e.setUint16(6, 0, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdLen, true); e.setUint32(16, off, true); e.setUint16(20, 0, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }

  // ---------- нормализация + упаковка (общее для всех видов) ----------
  // items: { v, group, buf, chs?, ...meta }; recipeOf(item) → поля для recipe.json; recipeBase → шапка recipe.json
  function pack(items, opts, recipeBase, recipeOf) {
    const bits = opts.bits ?? 24, prefix = (opts.prefix || 'SFX').replace(/[^\w\-]+/g, '_'), numbered = opts.numbered !== false;
    for (const i of items) i.chs ??= trimmed(i.buf);
    // нормализация: off / group (своя громкость у каждой группы) / all (одна на всё, отношения сохраняются)
    const target = Math.pow(10, (opts.peakDb ?? -1) / 20), gains = new Map();
    if (opts.normalize === 'all') { const p = Math.max(...items.map(i => peakOf(i.chs)), 1e-9); for (const i of items) gains.set(i, target / p); }
    else if (opts.normalize === 'group') { for (const g of new Set(items.map(i => i.group.id))) { const its = items.filter(i => i.group.id === g); const p = Math.max(...its.map(i => peakOf(i.chs)), 1e-9); for (const i of its) gains.set(i, target / p); } }
    else for (const i of items) gains.set(i, 1);
    const files = [], recipeFiles = [];
    for (const i of items) {
      const g = gains.get(i), chs = i.chs.map(ch => { const o = new Float32Array(ch.length); for (let k = 0; k < ch.length; k++) o[k] = ch[k] * g; return o; });
      const name = `${prefix}_${i.group.id}${numbered ? '_' + String(i.v + 1).padStart(2, '0') : ''}.wav`;
      files.push({ name, data: wav(chs, i.buf.sampleRate, bits) });
      recipeFiles.push({ file: name, variant: i.v + 1, group: i.group.id, gainDb: +(20 * Math.log10(g)).toFixed(2), seconds: +(chs[0].length / i.buf.sampleRate).toFixed(3), ...(recipeOf ? recipeOf(i) : {}) });
    }
    const recipe = { tool: 'SFX Lab', date: new Date().toISOString(), ...recipeBase,
      export: { groups: opts.groups, variants: opts.variants, sampleRate: opts.sr, bits, normalize: opts.normalize, peakDb: opts.peakDb, mix: !!opts.mix, seed: opts.seed, prefix, seconds: opts.seconds, xfade: opts.xfade, withDistance: !!opts.withDistance },
      files: recipeFiles };
    files.push({ name: 'recipe.json', data: new TextEncoder().encode(JSON.stringify(recipe, null, 2)) });
    return { blob: zip(files), files: files.map(f => f.name), recipe };
  }

  // ---------- всё вместе ----------
  async function exportSteps(set, opts, onProgress) {
    const rendered = await renderSteps(set, opts, (a, b) => onProgress?.(a, b, 'рендер'));
    const S = Steps.state;
    onProgress?.(1, 1, 'упаковка');
    return pack(rendered, opts,
      { kind: 'steps', set: set.id, select: set.select, values: state.values[set.id], layers: set.layers.map(l => ({ id: l.id, gain: l.gain, bands: l.bands })), params: S.P, distance: opts.withDistance ? S.distParams : null },
      i => ({ hits: i.plan.map(h => ({ comp: h.comp, sample: h.buf.name || '', atMs: Math.round((h.t + h.jitter) * 1000), pitchCents: Math.round(h.pitch * 1200), db: +(h.db + h.extraDb).toFixed(2) })) }));
  }
  async function exportWhoosh(set, opts, onProgress) {
    const rendered = await renderWhoosh(set, opts, (a, b) => onProgress?.(a, b, 'рендер'));
    const S = Whoosh.state;
    onProgress?.(1, 1, 'упаковка');
    return pack(rendered, opts,
      { kind: 'whoosh', set: set.id, values: state.values[set.id], layers: set.layers.map(Whoosh.layerJson), params: S.P, distance: opts.withDistance ? S.distParams : null },
      i => ({ voices: i.voices }));
  }
  async function exportLoops(set, opts, onProgress) {
    const rendered = await renderLoops(set, opts, (a, b) => onProgress?.(a, b, 'рендер'));
    onProgress?.(1, 1, 'упаковка');
    return pack(rendered, { ...opts, numbered: false, variants: 1 },
      { kind: 'loop', set: set.id, values: state.values[set.id], layers: set.layers.map(l => ({ id: l.id, name: l.name, file: l.file || '', gain: l.gain, trim: l.trim || 0 })), distance: opts.withDistance ? (opts.params?.__distance || null) : null },
      i => ({ loop: true, layers: i.used }));
  }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); }

  return { DEFAULT_GROUPS, renderSteps, renderWhoosh, renderLoops, exportSteps, exportWhoosh, exportLoops, pack, foldLoop, wav, zip, download, trimmed, peakOf };
})();

// SFX Lab · экспорт шага WAV-файлами слоями.
// Один вариант = один план шага (какие сэмплы, случайный питч/громкость/сдвиг) с сеяной случайностью.
// План рендерится несколько раз на OfflineAudioContext — по одному разу на группу компонентов (шаг / ткань /
// поверхность …) тем же графом, что играет вживую (полосы, макро-громкости, шина, по желанию дистанция).
// Поэтому сумма файлов одного варианта равна миксу. Итог — zip: wav на каждую группу × вариант и recipe.json.

const Export = (() => {
  const DEFAULT_GROUPS = [
    { id: 'step',    name: 'шаг',         comps: ['heel', 'tip', 'rel'] },
    { id: 'cloth',   name: 'ткань',       comps: ['acc1', 'acc2'] },
    { id: 'surface', name: 'поверхность', comps: ['generic', 'slide'] },
  ];
  function mulberry32(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // ---------- рендер ----------
  async function renderSteps(set, opts, onProgress) {
    const groups = opts.groups.filter(g => g.comps.length), variants = opts.variants ?? 6, sr = opts.sr ?? 48000, seed = opts.seed ?? 1;
    const S = Steps.state, prevRng = S.rng, prevLast = new Map(S.last);
    const jobs = [...groups, ...(opts.mix ? [{ id: 'mix', name: 'микс', comps: null }] : [])];
    const out = [];
    try {
      for (let v = 0; v < variants; v++) {
        S.rng = mulberry32(seed * 7919 + v * 104729 + 17); S.last.clear();
        const plan = Steps.planStep(v % 2 ? 'R' : 'L', 0.02);
        if (!plan.length) throw new Error('нет загруженных сэмплов');
        const len = Math.min(4, Math.max(...plan.map(h => h.t + Math.abs(h.jitter) + h.buf.duration / Math.pow(2, h.pitch - 1))) + 0.1);
        for (const g of jobs) {
          const inGroup = id => !g.comps || g.comps.includes(id);
          const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
          const bus = Steps.buildBus(ctx, { audible: id => inGroup(id) && (opts.audible ? opts.audible(id) : true) });
          let tail = bus.out;
          if (set.fx && set.fx.some(x => x.on)) { const fx = Fx.build(ctx, set.fx); tail.connect(fx.input); tail = fx.output; }
          if (opts.withDistance && S.distParams && S.distParams.d > 1) { const d = Distance.createStatic(ctx, S.distParams); tail.connect(d.input); tail = d.output; }
          tail.connect(ctx.destination);
          for (const h of plan) if (inGroup(h.comp)) Steps.playHit(h, ctx, bus.comps);
          const buf = await ctx.startRendering();
          out.push({ v, group: g, buf, plan: plan.filter(h => inGroup(h.comp)) });
          onProgress?.(out.length, variants * jobs.length);
        }
      }
    } finally { S.rng = prevRng; S.last = prevLast; }
    return out;
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

  // ---------- всё вместе ----------
  async function exportSteps(set, opts, onProgress) {
    const rendered = await renderSteps(set, opts, (a, b) => onProgress?.(a, b, 'рендер'));
    const bits = opts.bits ?? 24, prefix = (opts.prefix || 'FOOT').replace(/[^\w\-]+/g, '_');
    const items = rendered.map(r => ({ ...r, chs: trimmed(r.buf) }));
    // нормализация: off / group (своя громкость у каждой группы) / all (одна на всё, отношения сохраняются)
    const target = Math.pow(10, (opts.peakDb ?? -1) / 20), gains = new Map();
    if (opts.normalize === 'all') { const p = Math.max(...items.map(i => peakOf(i.chs)), 1e-9); for (const i of items) gains.set(i, target / p); }
    else if (opts.normalize === 'group') { for (const g of new Set(items.map(i => i.group.id))) { const its = items.filter(i => i.group.id === g); const p = Math.max(...its.map(i => peakOf(i.chs)), 1e-9); for (const i of its) gains.set(i, target / p); } }
    else for (const i of items) gains.set(i, 1);
    const files = [], recipeFiles = [];
    for (const i of items) {
      const g = gains.get(i), chs = i.chs.map(ch => { const o = new Float32Array(ch.length); for (let k = 0; k < ch.length; k++) o[k] = ch[k] * g; return o; });
      const name = `${prefix}_${i.group.id}_${String(i.v + 1).padStart(2, '0')}.wav`;
      files.push({ name, data: wav(chs, i.buf.sampleRate, bits) });
      recipeFiles.push({ file: name, variant: i.v + 1, group: i.group.id, gainDb: +(20 * Math.log10(g)).toFixed(2), seconds: +(chs[0].length / i.buf.sampleRate).toFixed(3),
        hits: i.plan.map(h => ({ comp: h.comp, sample: h.buf.name || '', atMs: Math.round((h.t + h.jitter) * 1000), pitchCents: Math.round(h.pitch * 1200), db: +(h.db + h.extraDb).toFixed(2) })) });
    }
    const S = Steps.state;
    const recipe = {
      tool: 'SFX Lab', date: new Date().toISOString(), set: set.id, select: set.select, values: state.values[set.id],
      layers: set.layers.map(l => ({ id: l.id, gain: l.gain, bands: l.bands })), params: S.P, distance: opts.withDistance ? S.distParams : null,
      export: { groups: opts.groups, variants: opts.variants, sampleRate: opts.sr, bits, normalize: opts.normalize, peakDb: opts.peakDb, mix: !!opts.mix, seed: opts.seed, prefix },
      files: recipeFiles,
    };
    files.push({ name: 'recipe.json', data: new TextEncoder().encode(JSON.stringify(recipe, null, 2)) });
    onProgress?.(1, 1, 'упаковка');
    return { blob: zip(files), files: files.map(f => f.name), recipe };
  }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); }

  return { DEFAULT_GROUPS, renderSteps, exportSteps, wav, zip, download, trimmed, peakOf };
})();

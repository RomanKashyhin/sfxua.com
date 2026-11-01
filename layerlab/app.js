// LayerLab · приложение: состояние, петли, макросы с подползунками, проект, транспорт.
// Наборы бывают двух видов: kind "loop" (эмбиент: слои-петли) и kind "steps" (шаги, движок в steps.js).

let PROJECT = { name: '', video: '', sets: [] };
const state = { set: null, values: {}, snaps: {}, open: {}, loopA: null, loopB: null, loop: false, mute: {}, solo: {} };
const $ = id => document.getElementById(id);
const fmt = t => { if (!isFinite(t)) t = 0; const m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); };
const paint = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
const currentSet = () => PROJECT.sets.find(s => s.id === state.set);
const setStatus = t => $('audioState').textContent = t;
const dbToGain = db => Math.pow(10, db / 20);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Наборы с собственным движком: шаги (steps.js) и вжухи (whoosh.js). Эмбиент-петли живут здесь.
const MODULES = { steps: Steps, whoosh: Whoosh };
const moduleOf = set => set && MODULES[set.kind];

// ===================== звук: общий граф =====================
const audio = { ctx: null, master: null, masterAn: null, layers: new Map(), meters: new Map() };
function ensureAudio() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return audio.ctx; }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  audio.ctx = ctx;
  audio.master = ctx.createGain();
  audio.masterAn = ctx.createAnalyser(); audio.masterAn.fftSize = 1024;
  audio.master.gain.value = Math.pow(+$('master').value / 100, 2);
  audio.master.connect(audio.masterAn).connect(ctx.destination);
  return ctx;
}

// ---------- петли (kind "loop") ----------
//   source(loop) → lowpass → macroGain → userGain(гром./mute/solo/trim) → analyser → шина набора (дистанция) → master
const setBuses = new Map();
function setBus(setId) {
  let b = setBuses.get(setId);
  if (!b) {
    const ctx = ensureAudio(), input = ctx.createGain(), dist = Distance.create(ctx);
    input.connect(dist.input); dist.output.connect(audio.master);
    b = { input, dist }; setBuses.set(setId, b);
  }
  return b;
}
async function loadLayerAudio(setId, l) {
  if (!l.file && !l.blob) return;
  const ctx = ensureAudio();
  const key = setId + '/' + l.id;
  if (audio.layers.has(key)) return;
  const node = { key, setId, layer: l, buffer: null, src: null, lp: null, mg: null, ug: null, an: null, params: { gain: 1, cutoff: 20000, rate: 1 } };
  audio.layers.set(key, node);
  setStatus('грузится ' + l.name);
  try {
    const data = l.blob ? await l.blob.arrayBuffer() : await (await fetch(l.file)).arrayBuffer();
    node.buffer = await ctx.decodeAudioData(data);
  } catch (e) { setStatus('не смог прочитать ' + l.name); audio.layers.delete(key); return; }
  node.lp = ctx.createBiquadFilter(); node.lp.type = 'lowpass'; node.lp.frequency.value = 20000; node.lp.Q.value = 0.5;
  node.mg = ctx.createGain(); node.ug = ctx.createGain();
  node.an = ctx.createAnalyser(); node.an.fftSize = 512;
  node.lp.connect(node.mg).connect(node.ug).connect(node.an).connect(setBus(setId).input);
  audio.meters.set(key, node.an);
  l.seconds = node.buffer.duration;
  applyUserGainLoop(node);
  applyMacros(setId);
  setStatus('готов: ' + l.name + ' (' + l.seconds.toFixed(1) + ' с)');
  if (!video.paused) startLayer(node);
  renderLayers();
}
function startLayer(node) {
  if (node.src || !node.buffer) return;
  const src = audio.ctx.createBufferSource();
  src.buffer = node.buffer; src.loop = true;
  src.playbackRate.value = node.params.rate;
  src.connect(node.lp);
  src.start(0, node.buffer.duration ? (video.currentTime % node.buffer.duration) : 0);  // то же место при перемотке
  node.src = src;
}
function stopLayer(node) { if (node.src) { try { node.src.stop(); } catch (e) {} node.src.disconnect(); node.src = null; } }
function startAll() { ensureAudio(); for (const n of audio.layers.values()) startLayer(n); }
function stopAll() { for (const n of audio.layers.values()) stopLayer(n); }
function restartAll() { if (video.paused) return; stopAll(); startAll(); }

function audible(setId, key) {
  const anySolo = Object.keys(state.solo).some(k => k.startsWith(setId + '/') && state.solo[k]);
  return !state.mute[key] && (!anySolo || state.solo[key]);
}
function applyUserGainLoop(node) {
  const g = audible(node.setId, node.key) ? Math.pow((node.layer.gain ?? 80) / 100, 2) * dbToGain(node.layer.trim ?? 0) : 0;
  node.ug.gain.setTargetAtTime(g, audio.ctx.currentTime, 0.02);
}
function applyUserGain(set, layer) {
  const key = set.id + '/' + layer.id;
  if (moduleOf(set)) { moduleOf(set).applyUserGain(set, layer, audible(set.id, key)); return; }
  const n = audio.layers.get(key); if (n && n.ug) applyUserGainLoop(n);
}
function refreshGains(set) { for (const l of set.layers) applyUserGain(set, l); }

// ---------- макросы → параметры ----------
// Каждая карта: { layer, param, from, to, curve?: "log", mode?: "mul" }. Значение подползунка (или главного,
// если подползунков нет) 0…100 → from…to. "mul" домножает относительно своего from, остальные задают базу;
// базы gain (дБ) складываются.
function macroValue(setId, m, s) {
  const key = s ? m.id + '.' + s.id : m.id;
  return state.values[setId][key] ?? (s ? s.default : m.default) ?? 50;
}
function computeParams(set) {
  const acc = {};
  const add = (e, t) => {
    const v = e.curve === 'log' ? e.from * Math.pow(e.to / e.from, t) : e.from + (e.to - e.from) * t;
    const slot = ((acc[e.layer] ??= {})[e.param] ??= { base: null, mul: 1 });
    if (e.mode === 'mul') slot.mul *= e.param === 'gain' ? dbToGain(v) : v / e.from;
    else if (e.param === 'gain') slot.base = (slot.base ?? 0) + v;
    else slot.base ??= v;
  };
  for (const m of set.macros) {
    for (const e of m.map || []) add(e, macroValue(set.id, m) / 100);
    for (const s of m.sub || []) for (const e of s.map || []) add(e, macroValue(set.id, m, s) / 100);
  }
  const out = {};
  for (const [layer, params] of Object.entries(acc)) {
    out[layer] = {};
    for (const [p, s] of Object.entries(params)) {
      if (p === 'gain') out[layer][p] = 20 * Math.log10(dbToGain(s.base ?? 0) * s.mul);   // итог в дБ
      else out[layer][p] = (s.base ?? (p === 'cutoff' ? 20000 : p === 'rate' ? 1 : 0)) * s.mul;
    }
  }
  for (const m of set.macros) if (m.kind === 'distance') out.__distance = Distance.paramsFrom(m, state.values[set.id]);
  return out;
}
function applyMacros(setId) {
  const set = PROJECT.sets.find(s => s.id === setId);
  if (!set) return;
  const params = computeParams(set);
  set.params = params;
  if (moduleOf(set)) { moduleOf(set).setParams(set, params); return; }
  if (!audio.ctx) return;
  const now = audio.ctx.currentTime;
  if (params.__distance) setBus(setId).dist.set(params.__distance);
  for (const [layerId, p] of Object.entries(params)) {
    const node = audio.layers.get(setId + '/' + layerId);
    if (!node || !node.mg) continue;
    if (p.gain != null)   { node.params.gain = dbToGain(p.gain); node.mg.gain.setTargetAtTime(node.params.gain, now, 0.03); }
    if (p.cutoff != null) { node.params.cutoff = clamp(p.cutoff, 40, 20000); node.lp.frequency.setTargetAtTime(node.params.cutoff, now, 0.03); }
    if (p.rate != null)   { node.params.rate = p.rate; if (node.src) node.src.playbackRate.setTargetAtTime(p.rate, now, 0.05); }
  }
}

// ---------- метры ----------
const meterBuf = new Float32Array(1024);
function rms(an) { an.getFloatTimeDomainData(meterBuf); let s = 0; const n = an.fftSize; for (let i = 0; i < n; i++) s += meterBuf[i] * meterBuf[i]; return Math.sqrt(s / n); }
const meterPct = an => Math.max(0, Math.min(100, (20 * Math.log10(rms(an) + 1e-6) + 60) / 60 * 100));  // −60…0 dBFS → 0…100 %
function tickMeters() {
  requestAnimationFrame(tickMeters);
  if (!audio.ctx) return;
  for (const [key, an] of audio.meters) {
    const el = document.querySelector(`[data-meter="${key}"]`);
    if (el) el.style.width = meterPct(an) + '%';
  }
  $('masterMeter').style.width = meterPct(audio.masterAn) + '%';
}
tickMeters();

// ===================== проект =====================
function initValues(set) {
  state.values[set.id] = {};
  for (const m of set.macros) {
    state.values[set.id][m.id] = m.default ?? 50;
    for (const s of m.sub || []) state.values[set.id][m.id + '.' + s.id] = s.default ?? m.default ?? 50;
    if (m.kind === 'distance') for (const s of Distance.SUBS) state.values[set.id][m.id + '.' + s.id] = s.default;
  }
}
async function openProject(p) {
  PROJECT = p;
  state.values = {}; state.snaps = {}; state.mute = {}; state.solo = {}; state.open = {};
  stopAll(); audio.layers.clear(); audio.meters.clear(); setBuses.clear();
  for (const s of p.sets) { if (MODULES[s.kind]) MODULES[s.kind].init(s); initValues(s); }
  state.set = p.sets[0]?.id || null;
  $('projectName').textContent = p.name || 'проект';
  if (p.video) loadVideoUrl(p.video, p.video.split('/').pop());
  renderTabs(); renderLayers(); renderMacros();
  setStatus('проект открыт, нажми ▶ или кнопку шага');
}
async function loadAllLayers() {
  ensureAudio();
  for (const s of PROJECT.sets) {
    if (s.kind === 'steps') { if (!Steps.state.total) loadStepsSelection(s); continue; }
    if (s.kind === 'whoosh') { loadWhoosh(s); continue; }
    for (const l of s.layers) await loadLayerAudio(s.id, l);
  }
}
async function loadStepsSelection(set) {
  ensureAudio();
  const distMacro = set.macros.find(m => m.kind === 'distance');
  if (distMacro) { state.values[set.id][distMacro.id + '.g'] = Math.round(Distance.groundFor(set.select) * 100); renderMacros(); }  // грунт по поверхности
  Steps.state.onStatus = setStatus;
  await Steps.loadSelection(set);
  applyMacros(set.id); refreshGains(set);
}
async function loadWhoosh(set) {
  ensureAudio();
  await Whoosh.load(set);
  applyMacros(set.id); refreshGains(set); renderLayers();
}
function projectJson() {
  const out = JSON.parse(JSON.stringify(PROJECT, (k, v) => (k === 'blob' || k === 'seconds' || k === 'params' || k === 'characters') ? undefined : v));
  for (const s of out.sets) {
    if (s.kind === 'steps') { delete s.macros; s.layers = s.layers.map(l => ({ id: l.id, gain: l.gain, bands: l.bands })); }   // шаги: дефолты живут в steps.js
    if (s.kind === 'whoosh') { delete s.macros; const live = PROJECT.sets.find(x => x.id === s.id); s.layers = live.layers.map(Whoosh.layerJson); }
  }
  out.values = state.values; out.snapshots = state.snaps; out.loop = { a: state.loopA, b: state.loopB };
  return JSON.stringify(out, null, 2);
}
$('saveProject').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([projectJson()], { type: 'application/json' }));
  a.download = (PROJECT.name || 'layerlab').replace(/\s+/g, '_') + '.json'; a.click();
  setStatus('проект сохранён в загрузки');
};
$('openProject').onclick = () => $('projectFile').click();
$('projectFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const p = JSON.parse(await f.text());
  await openProject(p);
  if (p.values) { for (const [k, v] of Object.entries(p.values)) Object.assign(state.values[k] ??= {}, v); state.snaps = p.snapshots || {}; renderMacros(); }
};

// ===================== вкладки и слои =====================
function renderTabs() {
  $('tabs').innerHTML = '';
  for (const s of PROJECT.sets) {
    const b = document.createElement('div');
    b.className = 'tab' + (s.id === state.set ? ' active' : '');
    b.dataset.kind = s.kind || 'loop';
    b.innerHTML = `<svg class="ico"><use href="#i-${s.kind === 'steps' ? 'foot' : s.kind === 'whoosh' ? 'zap' : 'wind'}"/></svg>${s.name}`;
    b.onclick = () => { state.set = s.id; renderTabs(); renderLayers(); renderMacros(); };
    $('tabs').appendChild(b);
  }
}
function renderLayers() {
  const set = currentSet();
  $('layers').innerHTML = ''; $('setPanel').innerHTML = '';
  $('addLayer').style.display = set && !moduleOf(set) ? '' : 'none';
  if (!set) return;
  if (set.kind === 'steps') Steps.renderPanel($('setPanel'), set, { onSelect: () => loadStepsSelection(set) });
  if (set.kind === 'whoosh') Whoosh.renderPanel($('setPanel'), set, { onSelect: () => loadWhoosh(set) });
  if (!set.layers.length) { const d = document.createElement('div'); d.className = 'layer empty'; d.innerHTML = '<div class="mode">слоёв пока нет — добавь wav</div>'; $('layers').appendChild(d); }
  for (const l of set.layers) {
    const key = set.id + '/' + l.id;
    const el = document.createElement('div');
    el.className = 'layer' + (state.mute[key] ? ' muted' : '');
    const fileName = (l.file || l.blob?.name || '').split('/').pop();
    const sub = moduleOf(set) ? (l.on === false ? 'выключен' : 'ван-шот') : `${l.mode === 'loop' ? 'петля' : 'ван-шот'} · ${fileName || 'файл не назначен'}${l.seconds ? ' · ' + l.seconds.toFixed(1) + ' с' : ''}`;
    el.innerHTML = `
      <div class="name">${l.name}</div>
      <div class="ms"><button data-m>M</button><button data-s>S</button></div>
      <div class="mode" title="${fileName}">${sub}</div>
      <div class="meter"><i data-meter="${key}"></i></div>
      <input class="gain thin" type="range" min="0" max="100" value="${l.gain ?? 80}" title="громкость слоя">`;
    const bm = el.querySelector('[data-m]'), bs = el.querySelector('[data-s]');
    if (state.mute[key]) bm.classList.add('on-m');
    if (state.solo[key]) bs.classList.add('on-s');
    bm.onclick = () => { state.mute[key] = !state.mute[key]; renderLayers(); refreshGains(set); };
    bs.onclick = () => { state.solo[key] = !state.solo[key]; renderLayers(); refreshGains(set); };
    const g = el.querySelector('.gain'); paint(g);
    const setGain = v => { l.gain = v; g.value = v; paint(g); applyUserGain(set, l); };
    g.oninput = () => setGain(+g.value);
    g.ondblclick = () => setGain(80);
    $('layers').appendChild(el);
  }
}
$('addLayer').onclick = () => $('layerFile').click();
$('layerFile').onchange = async e => {
  const set = currentSet(); if (!set || moduleOf(set)) return;
  for (const f of e.target.files) {
    const base = f.name.replace(/\.\w+$/, '');
    const l = { id: base, name: base, mode: 'loop', blob: f, file: '', gain: 80 };
    set.layers.push(l);
    await loadLayerAudio(set.id, l);
  }
  renderLayers();
};

// ===================== макро-ползунки =====================
function sliderRow(label, value, hint, cls) {
  const el = document.createElement('div');
  el.className = 'macro ' + (cls || '');
  el.innerHTML = `
    <div class="row"><span class="label">${label}</span><span class="val">${value}</span></div>
    <input type="range" min="0" max="100" value="${value}">
    ${hint ? `<div class="hint">${hint}</div>` : ''}`;
  return el;
}
function renderMacros() {
  const set = currentSet();
  $('macros').innerHTML = ''; $('charRow').innerHTML = '';
  if (!set) return;
  $('macroTitle').textContent = set.name;
  if (moduleOf(set) && set.characters) {
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">характер: выбрать…</option>' + set.characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    sel.onchange = () => { if (sel.value) applyCharacter(set, sel.value); };
    $('charRow').appendChild(sel);
  }
  const vals = state.values[set.id];
  for (const m of set.macros) {
    if (m.kind === 'distance') { renderDistance(set, m, vals); continue; }
    const hasSub = (m.sub || []).length > 0;
    const live = hasSub || (m.map || []).length > 0;
    const main = sliderRow(m.name, vals[m.id], m.hint, live ? '' : 'idle');
    const r = main.querySelector('input'), val = main.querySelector('.val');
    paint(r);
    let prev = +r.value;
    const openKey = set.id + '/' + m.id;
    if (hasSub) {
      const tog = document.createElement('button'); tog.className = 'tog'; tog.textContent = state.open[openKey] ? '▾' : '▸';
      tog.title = 'раскрыть подползунки';
      tog.onclick = () => { state.open[openKey] = !state.open[openKey]; renderMacros(); };
      main.querySelector('.row').prepend(tog);
    }
    const applyMain = () => {
      const v = +r.value, d = v - prev; prev = v;
      vals[m.id] = v; val.textContent = v; paint(r);
      for (const s of m.sub || []) {                      // главный тянет подползунки на ту же величину
        const k = m.id + '.' + s.id; vals[k] = clamp((vals[k] ?? s.default ?? 50) + d, 0, 100);
        const sr = main.querySelector(`[data-sub="${s.id}"]`); if (sr) { sr.value = vals[k]; paint(sr); sr.closest('.macro').querySelector('.val').textContent = vals[k]; }
      }
      applyMacros(set.id);
    };
    r.oninput = applyMain;
    r.ondblclick = () => { r.value = m.default ?? 50; for (const s of m.sub || []) vals[m.id + '.' + s.id] = s.default ?? 50; prev = +r.value; applyMain(); };
    r.onwheel = e => { e.preventDefault(); r.value = clamp(+r.value - Math.sign(e.deltaY), 0, 100); applyMain(); };
    $('macros').appendChild(main);
    if (hasSub && state.open[openKey]) {
      const box = document.createElement('div'); box.className = 'subs';
      for (const s of m.sub) {
        const k = m.id + '.' + s.id;
        const row = sliderRow(s.name, vals[k], '', 'sub');
        const sr = row.querySelector('input'), sv = row.querySelector('.val');
        sr.dataset.sub = s.id; sr.classList.add('thin'); paint(sr);
        const applySub = () => { vals[k] = +sr.value; sv.textContent = sr.value; paint(sr); applyMacros(set.id); };
        sr.oninput = applySub;
        sr.ondblclick = () => { sr.value = s.default ?? 50; applySub(); };
        sr.onwheel = e => { e.preventDefault(); sr.value = clamp(+sr.value - Math.sign(e.deltaY), 0, 100); applySub(); };
        box.appendChild(row);
      }
      $('macros').appendChild(box);
    }
  }
  $('snapA').classList.toggle('on', !!state.snaps[set.id + '/A']);
  $('snapB').classList.toggle('on', !!state.snaps[set.id + '/B']);
  applyMacros(set.id);
}
// Дистанция: главный ползунок в метрах (лог), подползунки — температура, влажность, грунт; кривая под ползунком.
function renderDistance(set, m, vals) {
  const openKey = set.id + '/' + m.id;
  const main = sliderRow(m.name, vals[m.id] ?? m.default ?? 0, m.hint, 'dist');
  const r = main.querySelector('input'), val = main.querySelector('.val');
  const show = () => { val.textContent = Distance.fmtMetres(Distance.toMetres(+r.value)); paint(r); };
  show();
  const tog = document.createElement('button'); tog.className = 'tog'; tog.textContent = state.open[openKey] ? '▾' : '▸';
  tog.title = 'воздух и грунт';
  tog.onclick = () => { state.open[openKey] = !state.open[openKey]; renderMacros(); };
  main.querySelector('.row').prepend(tog);
  const canvas = document.createElement('canvas'); canvas.className = 'distCurve'; canvas.title = 'сплошная: всё вместе; пунктир: только расхождение и воздух';
  main.appendChild(canvas);
  const redraw = () => Distance.draw(canvas, Distance.paramsFrom(m, vals));
  const apply = () => { vals[m.id] = +r.value; show(); applyMacros(set.id); redraw(); };
  r.oninput = apply;
  r.ondblclick = () => { r.value = m.default ?? 0; apply(); };
  r.onwheel = e => { e.preventDefault(); r.value = clamp(+r.value - Math.sign(e.deltaY), 0, 100); apply(); };
  $('macros').appendChild(main);
  if (state.open[openKey]) {
    const box = document.createElement('div'); box.className = 'subs';
    const sel = document.createElement('select'); sel.className = 'air';
    sel.innerHTML = '<option value="">воздух: пресет…</option>' + Distance.PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    sel.onchange = () => { const p = Distance.PRESETS.find(x => x.id === sel.value); if (!p) return; vals[m.id + '.t'] = p.t; vals[m.id + '.rh'] = p.rh; renderMacros(); };
    box.appendChild(sel);
    for (const s of Distance.SUBS) {
      if (s.id === 'g' && m.ground === false) continue;
      const k = m.id + '.' + s.id;
      const row = sliderRow(s.name, vals[k] ?? s.default, '', 'sub');
      const sr = row.querySelector('input'), sv = row.querySelector('.val');
      sr.classList.add('thin');
      const showSub = () => { sv.textContent = s.fmt(+sr.value); paint(sr); };
      showSub();
      const applySub = () => { vals[k] = +sr.value; showSub(); applyMacros(set.id); redraw(); };
      sr.oninput = applySub;
      sr.ondblclick = () => { sr.value = s.default; applySub(); };
      sr.onwheel = e => { e.preventDefault(); sr.value = clamp(+sr.value - Math.sign(e.deltaY), 0, 100); applySub(); };
      box.appendChild(row);
    }
    $('macros').appendChild(box);
  }
  requestAnimationFrame(redraw);
}
function applyCharacter(set, id) {
  const mod = moduleOf(set), ch = mod.characterValues(id); if (!ch) return;
  if (ch.select) Object.assign(set.select, ch.select);
  if (mod.applyCharacter) mod.applyCharacter(set, ch);
  Object.assign(state.values[set.id], ch.values);
  renderLayers(); renderMacros();
  if (set.kind === 'steps') loadStepsSelection(set); else loadWhoosh(set);
  setStatus('характер: ' + set.characters.find(c => c.id === id).name);
}
function snapshot(slot, e) {
  if (!state.set) return;
  const key = state.set + '/' + slot;
  if (e.shiftKey || !state.snaps[key]) { state.snaps[key] = { ...state.values[state.set] }; setStatus('снимок ' + slot + ' записан'); }
  else { Object.assign(state.values[state.set], state.snaps[key]); setStatus('снимок ' + slot); }
  renderMacros();
}
$('snapA').onclick = e => snapshot('A', e);
$('snapB').onclick = e => snapshot('B', e);
$('snapA').title = 'клик — вернуть снимок A; shift+клик — записать текущее в A';
$('snapB').title = 'клик — вернуть снимок B; shift+клик — записать текущее в B';
$('reset').onclick = () => { const set = currentSet(); if (!set) return; initValues(set); renderMacros(); };
$('master').oninput = e => { $('masterVal').textContent = e.target.value; paint(e.target); if (audio.master) audio.master.gain.setTargetAtTime(Math.pow(e.target.value / 100, 2), audio.ctx.currentTime, 0.02); };
paint($('master'));

// ===================== видео и транспорт =====================
const video = $('video'), scrub = $('scrub'), stage = $('stage');
function loadVideoUrl(url, name) {
  video.src = url;
  $('projectName').textContent = (PROJECT.name ? PROJECT.name + ' · ' : '') + name;
  $('drop').classList.add('hidden');
  stage.classList.add('loaded');
}
function loadVideo(file) { if (file) loadVideoUrl(URL.createObjectURL(file), file.name); }
$('openVideo').onclick = () => $('videoFile').click();
$('videoFile').onchange = e => loadVideo(e.target.files[0]);
stage.ondragover = e => { e.preventDefault(); stage.classList.add('over'); };
stage.ondragleave = () => stage.classList.remove('over');
stage.ondrop = e => { e.preventDefault(); stage.classList.remove('over'); loadVideo([...e.dataTransfer.files].find(f => f.type.startsWith('video/'))); };

async function togglePlay() {
  if (!video.src) return;
  ensureAudio();
  if (!audio.layers.size) await loadAllLayers();
  video.paused ? video.play() : video.pause();
}
$('play').onclick = togglePlay;
// Звук самой дорожки видео: по умолчанию заглушен (мешает слушать слои), запоминается.
function setVideoMute(m) {
  video.muted = m; try { localStorage.setItem('layerlab.videoMuted', m ? '1' : '0'); } catch (e) {}
  $('vidMute').classList.toggle('on', !m);
}
setVideoMute((() => { try { return localStorage.getItem('layerlab.videoMuted') !== '0'; } catch (e) { return true; } })());
$('vidMute').onclick = () => setVideoMute(!video.muted);
video.onplay = () => { $('play').classList.add('playing'); startAll(); Steps.onTransport(); setStatus('играет'); };
video.onpause = () => { $('play').classList.remove('playing'); stopAll(); Steps.onTransport(); setStatus('пауза'); };
video.onseeking = () => restartAll();
video.onloadedmetadata = () => { $('tDur').textContent = fmt(video.duration); drawLoop(); };
video.ontimeupdate = () => {
  $('tCur').textContent = fmt(video.currentTime);
  if (video.duration) { scrub.value = video.currentTime / video.duration * 1000; paint(scrub); }
  if (state.loop && state.loopA != null && state.loopB != null && video.currentTime >= state.loopB) video.currentTime = state.loopA;
};
scrub.oninput = () => { if (video.duration) video.currentTime = scrub.value / 1000 * video.duration; paint(scrub); };
$('stop').onclick = () => { video.pause(); video.currentTime = state.loop && state.loopA != null ? state.loopA : 0; };
function drawLoop() {
  const bar = $('loopBar');
  $('loopOn').classList.toggle('on', state.loop);
  if (state.loopA == null || state.loopB == null || !video.duration) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  bar.style.left = (state.loopA / video.duration * 100) + '%';
  bar.style.width = ((state.loopB - state.loopA) / video.duration * 100) + '%';
}
const setA = () => { state.loopA = video.currentTime; if (state.loopB != null && state.loopB <= state.loopA) state.loopB = null; drawLoop(); };
const setB = () => { state.loopB = video.currentTime; if (state.loopA == null || state.loopA >= state.loopB) state.loopA = 0; state.loop = true; drawLoop(); };
$('loopA').onclick = setA; $('loopB').onclick = setB;
$('loopOn').onclick = () => { state.loop = !state.loop; drawLoop(); };

// ===================== горячие клавиши =====================
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || (e.target.tagName === 'INPUT' && e.target.type !== 'range')) return;
  const stepsSet = PROJECT.sets.find(s => s.kind === 'steps'), whooshSet = PROJECT.sets.find(s => s.kind === 'whoosh');
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === '[') setA();
  else if (e.key === ']') setB();
  else if (e.key === 'l' || e.key === 'L') { state.loop = !state.loop; drawLoop(); }
  else if (e.key === 'Home') $('stop').click();
  else if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') setVideoMute(!video.muted);
  else if (e.key === 'a' || e.key === 'A') snapshot('A', e);
  else if (e.key === 'b' || e.key === 'B') snapshot('B', e);
  else if (e.key === 'ArrowLeft') video.currentTime -= e.shiftKey ? 1 : 1 / 25;
  else if (e.key === 'ArrowRight') video.currentTime += e.shiftKey ? 1 : 1 / 25;
  else if (stepsSet && e.key === '1') Steps.trigger('L');
  else if (stepsSet && e.key === '2') Steps.trigger('R');
  else if (stepsSet && e.key === '3') Steps.trigger('slide');
  else if (stepsSet && e.key === '4') Steps.trigger('stairs');
  else if (stepsSet && (e.key === 'g' || e.key === 'G')) Steps.trigger('walk');
  else if (whooshSet && 'wWцЦ'.includes(e.key)) Whoosh.trigger('go');
  else if (whooshSet && 'xXчЧ'.includes(e.key)) Whoosh.trigger('stop');
});

// ===================== старт =====================
// ?project=knauf → projects/knauf.json; по умолчанию knauf
const projectId = new URLSearchParams(location.search).get('project') || 'knauf';
fetch('projects/' + projectId + '.json').then(r => r.ok ? r.json() : Promise.reject(r.status))
  .then(p => openProject(p))
  .catch(() => { setStatus('нет проекта projects/' + projectId + '.json — открой видео и добавь слои вручную'); renderTabs(); renderLayers(); renderMacros(); });

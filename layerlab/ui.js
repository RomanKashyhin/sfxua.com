// SFX Lab · подсказки при наведении (Tip) и живые картинки модулей (FxView).
// Tip: любой элемент с data-tip="<html>" через 350 мс показывает всплывашку; Tip.html(название, что делает, что слышно) собирает текст.
// FxView.mount(box, cfg, key): рисует в box, что модуль делает прямо сейчас — кривую тембра (EQ, умный EQ),
// вход→выход и столбик сжатия (компрессор), кривую насыщения (сатурация), хвост (комната) — и метры «вход / выход».
// Если звук ещё не запущен, берётся тихая копия модуля (Fx.preview), чтобы кривая была видна сразу.

const Tip = (() => {
  let el = null, timer = 0, cur = null;
  function show(target) {
    const t = target.dataset.tip; if (!t) return;
    if (!el) { el = document.createElement('div'); el.className = 'tip'; document.body.appendChild(el); }
    el.innerHTML = t; el.style.display = 'block';
    const r = target.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
    x = Math.max(8, Math.min(x, innerWidth - w - 8));
    if (y + h > innerHeight - 8) y = r.top - h - 8;
    el.style.left = x + 'px'; el.style.top = Math.max(8, y) + 'px';
    cur = target;
  }
  function hide() { clearTimeout(timer); timer = 0; if (el) el.style.display = 'none'; cur = null; }
  document.addEventListener('pointerover', e => { const t = e.target.closest?.('[data-tip]'); if (!t || t === cur) return; hide(); timer = setTimeout(() => show(t), 350); });
  document.addEventListener('pointerout', e => { const t = e.target.closest?.('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hide(); });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', hide, true);
  const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  // текст подсказки (html) → его же можно класть в атрибут через Tip.attr
  const html = (title, desc, hear) => `<b>${esc(title)}</b>${desc ? `<p>${esc(desc)}</p>` : ''}${hear ? `<p class="hear"><i>слышно:</i> ${esc(hear)}</p>` : ''}`;
  const attr = s => String(s).replace(/"/g, '&quot;');
  return { hide, html, attr };
})();

const FxView = (() => {
  const N = 96, F = Array.from({ length: N }, (_, i) => 20 * Math.pow(1000, i / (N - 1))), F32 = Float32Array.from(F);
  const mag = new Float32Array(N), ph = new Float32Array(N), tbuf = new Float32Array(256);
  const views = new Set(); let raf = 0;
  const lin = (v, a, b) => a + (b - a) * v / 100;
  const log = (v, a, b) => a * Math.pow(b / a, v / 100);
  const rmsDb = an => { if (!an) return null; an.getFloatTimeDomainData(tbuf); let s = 0; for (let i = 0; i < tbuf.length; i++) s += tbuf[i] * tbuf[i]; return 20 * Math.log10(Math.sqrt(s / tbuf.length) + 1e-7); };
  const peak = an => { if (!an) return 0; an.getFloatTimeDomainData(tbuf); let p = 0; for (let i = 0; i < tbuf.length; i++) p = Math.max(p, Math.abs(tbuf[i])); return p; };
  function response(filters) { const out = new Float64Array(N); for (const b of filters) { b.getFrequencyResponse(F32, mag, ph); for (let i = 0; i < N; i++) out[i] += 20 * Math.log10(mag[i] + 1e-9); } return out; }

  function mount(box, cfg, key) {
    box.innerHTML = `<canvas class="fx-scope"></canvas><div class="fx-io"><span>вход</span><i><b data-in></b></i><span>выход</span><i><b data-out></b></i><em data-read></em></div>`;
    const v = { box, cfg, key, cv: box.querySelector('canvas'), inB: box.querySelector('[data-in]'), outB: box.querySelector('[data-out]'), read: box.querySelector('[data-read]') };
    views.add(v); if (!raf) raf = requestAnimationFrame(tick);
    return () => views.delete(v);
  }
  function tick() {
    raf = 0;
    for (const v of views) { if (!v.box.isConnected) { views.delete(v); continue; } try { draw(v); } catch (e) {} }
    if (views.size) raf = requestAnimationFrame(tick);
  }
  // метр с медленным спадом: короткий удар держится на глазах, а не исчезает за кадр
  const meter = (el, db) => { const now = Math.max(0, Math.min(100, db == null ? 0 : (db + 60) / 60 * 100)), prev = el._pct || 0; el._pct = now > prev ? now : Math.max(now, prev - 1.2); el.style.width = el._pct.toFixed(0) + '%'; };
  function draw(v) {
    const cv = v.cv, dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const col = getComputedStyle(v.box).getPropertyValue('--g').trim() || '#4fd1a1';
    const live = Fx.mod(v.key, v.cfg.uid), m = live || Fx.preview(v.cfg), p = { ...Fx.defaultP(v.cfg.id), ...(v.cfg.p || {}) };
    const inDb = rmsDb(live?.anIn), outDb = rmsDb(live?.anOut);
    meter(v.inB, inDb); meter(v.outB, outDb);
    g.globalAlpha = v.cfg.on === false ? .35 : 1;
    g.font = '9px Inter, system-ui, sans-serif';
    if (m.id === 'eq' || m.id === 'aeq') drawCurve(g, W, H, col, m);
    else if (m.id === 'comp') drawComp(g, W, H, col, m, p, inDb);
    else if (m.id === 'sat') drawSat(g, W, H, col, m, live);
    else if (m.id === 'room') drawRoom(g, W, H, col, p);
    g.globalAlpha = 1;
    const r = readout(m, p, live); if (v.read.textContent !== r) v.read.textContent = r;
  }
  const xf = (W, f) => Math.log(f / 20) / Math.log(1000) * W;
  function grid(g, W, H) {
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,.3)'; g.textAlign = 'center';
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) { const x = xf(W, f); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); if ([100, 1000, 10000].includes(f)) g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x, H - 2); }
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  }
  // кривая тембра: что модуль делает с каждой частотой (дБ), 20 Гц … 20 кГц, ±18 дБ
  function drawCurve(g, W, H, col, m) {
    grid(g, W, H);
    const filters = m.id === 'eq' ? [m.nodes.lo, m.nodes.mid, m.nodes.hi] : m.nodes.bank;
    const r = response(filters), R = 18, y = db => H / 2 - Math.max(-R, Math.min(R, db)) / R * (H / 2 - 4);
    g.beginPath(); g.moveTo(0, H / 2); for (let i = 0; i < N; i++) g.lineTo(xf(W, F[i]), y(r[i])); g.lineTo(W, H / 2); g.closePath();
    const a = g.globalAlpha; g.fillStyle = col; g.globalAlpha = a * .18; g.fill(); g.globalAlpha = a;
    g.beginPath(); for (let i = 0; i < N; i++) { const px = xf(W, F[i]), py = y(r[i]); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.strokeStyle = col; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.textAlign = 'left'; g.fillText('+' + R, 2, 9); g.fillText('−' + R, 2, H - 2);
  }
  // компрессор: слева кривая «вход → выход» (точка — текущий уровень), справа столбик — на сколько дБ сейчас прижимает
  function drawComp(g, W, H, col, m, p, inDb) {
    const T = lin(p.thr, -48, 0), R = lin(p.ratio, 1, 12), K = 12, mk = lin(p.makeup, 0, 12), Wc = W - 34;
    const fn = x => { const d = x - T; const y = d < -K / 2 ? x : d > K / 2 ? T + d / R : x + (1 / R - 1) * (d + K / 2) ** 2 / (2 * K); return y + mk; };
    const px = x => (x + 60) / 60 * Wc, py = y => H - (y + 60) / 60 * H;
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (const d of [-40, -20]) { g.beginPath(); g.moveTo(px(d), 0); g.lineTo(px(d), H); g.moveTo(0, py(d)); g.lineTo(Wc, py(d)); g.stroke(); }
    g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(px(-60), py(-60)); g.lineTo(px(0), py(0)); g.stroke(); g.setLineDash([]);
    g.beginPath(); for (let x = -60; x <= 0; x++) { const X = px(x), Y = py(Math.min(0, fn(x))); x === -60 ? g.moveTo(X, Y) : g.lineTo(X, Y); } g.strokeStyle = col; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.textAlign = 'left'; g.fillText('порог ' + T.toFixed(0) + ' дБ', 3, 10); g.textAlign = 'right'; g.fillText('вход →', Wc - 3, H - 2);
    if (inDb != null && inDb > -60) { g.fillStyle = col; g.beginPath(); g.arc(px(inDb), py(Math.min(0, fn(inDb))), 3.2, 0, Math.PI * 2); g.fill(); }
    const gr = m.nodes.c?.reduction ?? 0, bx = W - 24, bw = 10;
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(bx, 0, bw, H - 12);
    g.fillStyle = col; g.fillRect(bx, 0, bw, Math.min(H - 12, -gr / 24 * (H - 12)));
    g.fillStyle = 'rgba(255,255,255,.4)'; g.textAlign = 'center'; g.fillText('сж.', bx + bw / 2, H - 2);
  }
  // сатурация: кривая «вход → выход» по амплитуде; точки — текущий пик сигнала
  function drawSat(g, W, H, col, m, live) {
    const c = m.nodes.ws.curve, n = c.length, pad = 3;
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(pad, H - pad); g.lineTo(W - pad, pad); g.stroke(); g.setLineDash([]);
    const X = a => pad + (a + 1) / 2 * (W - 2 * pad), Y = a => H / 2 - a * (H / 2 - pad);
    g.beginPath(); for (let i = 0; i < n; i += 8) { const x = X(i / (n - 1) * 2 - 1), y = Y(c[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = col; g.lineWidth = 1.6; g.stroke();
    const pk = peak(live?.anIn);
    if (pk > 0.002) for (const s of [pk, -pk]) { const i = Math.round((s + 1) / 2 * (n - 1)); g.fillStyle = col; g.beginPath(); g.arc(X(s), Y(c[i]), 3.2, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.textAlign = 'left'; g.fillText('пунктир — без изменений', 4, 10);
  }
  // комната: сухой удар (полоска) и хвост, который к нему подмешивается
  function drawRoom(g, W, H, col, p) {
    const size = log(p.size, 0.05, 0.8), mix = lin(p.mix, 0, 50) / 100, T = 0.9, tau = size / 4, base = H - 11, top = 6;
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,.3)'; g.textAlign = 'center';
    for (const t of [0.25, 0.5, 0.75]) { const x = 8 + t / T * (W - 8); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, base); g.stroke(); g.fillText(t * 1000 + ' мс', x, H - 2); }
    g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(6, top, 3, base - top);
    g.beginPath(); g.moveTo(9, base);
    for (let x = 9; x <= W; x++) { const t = (x - 8) / (W - 8) * T, a = t < size ? Math.exp(-t / tau) : 0; g.lineTo(x, base - a * mix * (base - top)); }
    g.lineTo(W, base); g.closePath();
    const a0 = g.globalAlpha; g.fillStyle = col; g.globalAlpha = a0 * .4; g.fill(); g.globalAlpha = a0;
    g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); for (let x = 9; x <= W; x++) { const t = (x - 8) / (W - 8) * T, a = t < size ? Math.exp(-t / tau) : 0; const y = base - a * mix * (base - top); x === 9 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
  }
  const fmtDb = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + ' дБ';
  function readout(m, p, live) {
    if (m.id === 'aeq') {
      const memo = Fx.memo(m.uid), lvl = live?.nodes?.lvl ?? memo?.lvl, g = live?.nodes?.g ?? memo?.g;
      if (lvl == null || lvl <= -60 || !g) return live ? 'тишина — держу последнее' : 'ещё не слышал сигнала';
      return `${lvl.toFixed(0)} dBFS → ${memo?.phon?.toFixed(0) ?? '?'} фон · низ ${fmtDb(g[1])} · верх ${fmtDb(g[8])}`;
    }
    if (m.id === 'comp') { const gr = m.nodes.c?.reduction ?? 0; return gr < -0.3 ? `прижимает на ${(-gr).toFixed(1)} дБ` : live ? 'ниже порога — не трогает' : ''; }
    if (m.id === 'sat') { const pk = peak(live?.anIn); return pk > 0.002 ? `пик ${(20 * Math.log10(pk)).toFixed(0)} dBFS` : ''; }
    if (m.id === 'room') return `хвост ${log(p.size, 0.05, 0.8).toFixed(2)} с · подмешано ${Math.round(lin(p.mix, 0, 50))} %`;
    return '';
  }
  return { mount };
})();

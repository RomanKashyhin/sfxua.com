// SFX Lab · экран-схема: в центре узел набора, слева и справа карточки компонентов на светящихся линиях.
// Карточка раскрывается в свои слои (полосы удара у шагов, фильтр/огибающая у вжухов, громкость у петель).
// Линия и карточка вспыхивают, когда компонент звучит; метры живут на карточках, кольцо в центре — мастер.

const Graph = (() => {
  const KIND = { loop: '#38bdf8', steps: '#f5b84a', whoosh: '#a78bfa' };
  const ICON = { heel: 'foot', tip: 'foot', rel: 'wind', slide: 'wind', stairs: 'layers', generic: 'grid', acc1: 'zap', acc2: 'zap', noise: 'wind', tex1: 'layers', tex2: 'layers' };
  const G = { el: null, set: null, open: new Set(['heel', 'noise']), raf: 0, ro: null, hooks: {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function summary(set, l) {
    if (set.kind === 'steps') return Steps.bandSummary(l);
    if (set.kind === 'whoosh') return l.on === false ? 'выключен' : l.type === 'noise' ? (Whoosh.NOISES[l.src] || l.src) : (l.file ? l.file.split('/').pop() : l.blob ? l.blob.name : 'нет файла');
    return `${l.mode === 'loop' ? 'петля' : 'ван-шот'}${l.seconds ? ' · ' + l.seconds.toFixed(1) + ' с' : ''}`;
  }
  function subtitle(set) {
    if (set.kind === 'steps') return `${set.select.shoe} · ${set.select.surface}`;
    if (set.kind === 'whoosh') return `${set.layers.filter(l => l.on !== false).length} слоя · ${Whoosh.state.P.dur.toFixed(2)} с`;
    return `${set.layers.length} слоёв`;
  }
  function card(set, l) {
    const key = set.id + '/' + l.id, off = l.on === false || state.mute[key];
    return `<div class="g-card${G.open.has(l.id) ? ' open' : ''}${off ? ' off' : ''}" data-l="${esc(l.id)}">
      <div class="g-head">
        <span class="g-ico"><svg class="ico"><use href="#i-${ICON[l.id] || 'layers'}"/></svg></span>
        <div class="g-txt"><b>${esc(l.name)}</b><i>${esc(summary(set, l))}</i></div>
        <span class="g-val">${l.gain ?? 80}</span>
        <button class="g-tog" title="раскрыть слои">${G.open.has(l.id) ? '▾' : '▸'}</button>
      </div>
      <div class="g-meter"><i></i></div>
      <div class="g-detail"></div>
    </div>`;
  }
  function metricsHtml(set) {
    const m = metrics(set);
    return m.map(x => `<div class="g-tile"><svg class="ico"><use href="#i-${x.icon}"/></svg><div><i>${x.label}</i><b data-metric="${x.id}">${x.value}</b></div></div>`).join('');
  }
  function metrics(set) {
    if (set.kind === 'steps') {
      const S = Steps.state, d = Distance.toMetres(state.values[set.id]?.dist ?? 0);
      return [{ id: 'steps', icon: 'foot', label: 'шагов сыграно', value: S.steps }, { id: 'voices', icon: 'layers', label: 'голосов', value: S.voices },
              { id: 'spm', icon: 'repeat', label: 'шагов / мин', value: Math.round(S.P.spm) }, { id: 'dist', icon: 'wind', label: 'дистанция', value: Distance.fmtMetres(d) },
              { id: 'lib', icon: 'grid', label: 'сэмплов в памяти', value: `${S.loaded} / ${S.total}` }];
    }
    if (set.kind === 'whoosh') {
      const S = Whoosh.state;
      return [{ id: 'n', icon: 'zap', label: 'вжухов', value: S.whooshes }, { id: 'dur', icon: 'repeat', label: 'длительность', value: S.P.dur.toFixed(2) + ' с' },
              { id: 'speed', icon: 'wind', label: 'скорость', value: Math.round(S.P.speed) + ' км/ч' }, { id: 'near', icon: 'grid', label: 'ближе всего', value: S.P.near.toFixed(1) + ' м' },
              { id: 'dop', icon: 'sliders', label: 'доплер', value: Math.round(S.P.doppler * 100) + ' %' }];
    }
    const d = Distance.toMetres(state.values[set.id]?.dist ?? 0);
    return [{ id: 'layers', icon: 'layers', label: 'слоёв', value: set.layers.length }, { id: 'playing', icon: 'play', label: 'видео', value: video.paused ? 'пауза' : 'играет' },
            { id: 'dist', icon: 'wind', label: 'дистанция', value: Distance.fmtMetres(d) }, { id: 'time', icon: 'repeat', label: 'время', value: fmt(video.currentTime) }];
  }

  function render(el, set, hooks = {}) {
    G.el = el; G.set = set; G.hooks = hooks;
    const color = KIND[set.kind || 'loop'];
    el.style.setProperty('--g', color);
    const L = set.layers.filter((_, i) => i % 2 === 0), R = set.layers.filter((_, i) => i % 2 === 1);
    const hubMacro = (set.macros || []).find(m => m.hub);
    el.innerHTML = `
      <div class="g-metrics">${metricsHtml(set)}</div>
      <div class="g-body">
        <svg class="g-wires"><defs><filter id="g-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
        <div class="g-col left">${L.map(l => card(set, l)).join('')}</div>
        <div class="g-mid"><div class="g-video-slot"></div>
          <div class="g-hub${hubMacro ? ' ctl' : ''}" title="${hubMacro ? 'тяни вверх/вниз: ' + esc(hubMacro.hint || hubMacro.name) : ''}"><div class="g-ring"><i></i></div>
            ${hubMacro ? '<svg class="g-vring" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46" stroke-dasharray="0 289"/></svg>' : ''}
            <div class="g-core"><b>${esc(set.name)}</b><span>${esc(subtitle(set))}</span>${hubMacro ? '<em class="g-hard"></em><em class="g-hard-lbl"></em>' : ''}</div></div>
          <div class="g-chain">${(set.fx || []).map(x => `<span class="g-chip${x.on ? ' on' : ''}" data-fx="${x.id}">${esc(Fx.MODULES.find(m => m.id === x.id)?.name || x.id)}</span>`).join('')}</div></div>
        <div class="g-col right">${R.map(l => card(set, l)).join('')}</div>
      </div>`;
    for (const c of el.querySelectorAll('.g-card')) {
      const l = set.layers.find(x => x.id === c.dataset.l);
      const tog = () => { if (G.open.has(l.id)) G.open.delete(l.id); else G.open.add(l.id); render(el, set, hooks); };
      c.querySelector('.g-tog').onclick = tog;
      c.querySelector('.g-txt').onclick = tog;
      c.querySelector('.g-ico').onclick = () => { hooks.onToggleMute?.(l); };
      if (G.open.has(l.id)) renderDetail(c.querySelector('.g-detail'), set, l, c);
    }
    if (hubMacro) bindHub(el.querySelector('.g-hub'), set, hubMacro);
    for (const chip of el.querySelectorAll('.g-chip')) chip.onclick = () => { const cfg = set.fx.find(x => x.id === chip.dataset.fx); cfg.on = !cfg.on; Fx.live(set.id)?.update(set.fx); chip.classList.toggle('on', cfg.on); renderMacros(); };
    for (const c of el.querySelectorAll('.g-card')) {
      const l = set.layers.find(x => x.id === c.dataset.l), val = c.querySelector('.g-val');
      Knob.dragNumber(val, { get: () => l.gain ?? 80, set: v => { l.gain = Math.max(0, Math.min(100, Math.round(v))); val.textContent = l.gain; hooks.onGain?.(l); }, range: 100,
        onEnd: () => { const f = document.querySelector(`#layers .layer input.gain[data-key="${CSS.escape(set.id + '/' + l.id)}"]`); if (f) { f.value = l.gain; f.style.setProperty('--p', l.gain + '%'); } }, onReset: () => { l.gain = 80; val.textContent = 80; hooks.onGain?.(l); } });
    }
    setTimeout(wires, 0); requestAnimationFrame(wires);   // таймер нужен, когда вкладка в фоне и rAF спит
    if (!G.ro) { G.ro = new ResizeObserver(() => wires()); el.addEventListener('scroll', placeVideo); }
    G.ro.disconnect(); G.ro.observe(el);
    if (!G.raf) tick();
  }
  function renderDetail(box, set, l, cardEl) {
    const sync = () => { cardEl.querySelector('.g-txt i').textContent = summary(set, l); requestAnimationFrame(wires); };
    if (set.kind === 'steps') { Steps.renderBands(box, l, sync); return; }
    if (set.kind === 'whoosh') { Whoosh.renderLayerControls(box, set, l, { onSelect: () => { G.hooks.onSelect?.(); sync(); } }, () => render(G.el, set, G.hooks)); box.classList.add('wl'); return; }
    const key = set.id + '/' + l.id;
    box.innerHTML = `<div class="wl-row"><span class="lbl">громк.</span><input type="range" class="thin" data-g min="0" max="100" value="${l.gain ?? 80}"><span class="val">${l.gain ?? 80}</span></div>
      <div class="wl-row"><span class="lbl">файл</span><span class="val" style="grid-column: 2 / span 2; text-align:left">${esc((l.file || l.blob?.name || '').split('/').pop() || 'не назначен')}</span></div>`;
    Knob.convert(box);
    const r = box.querySelector('[data-g]'); r.style.setProperty('--p', r.value + '%');
    r.oninput = () => { l.gain = +r.value; r.style.setProperty('--p', r.value + '%'); r.nextElementSibling.textContent = r.value; cardEl.querySelector('.g-val').textContent = r.value; G.hooks.onGain?.(l); };
  }

  // центральный круг как ручка «Жёсткость»: тянуть вверх/вниз, колесо, двойной клик — сброс.
  // Цвет кольца: бирюзовый (мягко, ASMR) → янтарный → красно-оранжевый (жёстко).
  const hardColor = t => { const h = t < 0.5 ? 190 - (190 - 40) * (t / 0.5) : 40 - (40 - 8) * ((t - 0.5) / 0.5); return `hsl(${h.toFixed(0)} 85% ${(58 - 8 * t).toFixed(0)}%)`; };
  const hardWord = t => t < 0.2 ? 'мягко · ASMR' : t < 0.4 ? 'мягко' : t < 0.6 ? 'ровно' : t < 0.8 ? 'жёстко' : 'очень жёстко';
  function hubValue(set, m) { return state.values[set.id]?.[m.id] ?? m.default ?? 50; }
  function paintHub(hub, set, m) {
    if (!hub) return;
    const v = hubValue(set, m), t = v / 100;
    hub.style.setProperty('--g2', hardColor(t)); hub.style.setProperty('--hard', t.toFixed(3));
    const e = hub.querySelector('.g-hard'), l = hub.querySelector('.g-hard-lbl'), fg = hub.querySelector('.g-vring .fg');
    if (fg) fg.setAttribute('stroke-dasharray', `${(289 * t).toFixed(1)} 289`);   // контур: 0 пусто, 50 половина, 100 полный круг
    if (e && e.textContent != v) e.textContent = v;
    if (l) l.textContent = m.name + ' · ' + hardWord(t);
  }
  function bindHub(hub, set, m) {
    paintHub(hub, set, m);
    let drag = null;
    const setV = v => { v = Math.max(0, Math.min(100, Math.round(v))); state.values[set.id][m.id] = v; applyMacros(set.id); paintHub(hub, set, m); };
    hub.onpointerdown = e => { if (e.button !== 0) return; drag = { y: e.clientY, v: hubValue(set, m) }; hub.setPointerCapture(e.pointerId); e.preventDefault(); };
    hub.onpointermove = e => { if (drag) setV(drag.v + (drag.y - e.clientY) * (e.shiftKey ? 0.1 : 1) * 100 / 300); };
    hub.onpointerup = hub.onpointercancel = () => { if (drag) { drag = null; renderMacros(); } };
    hub.onwheel = e => { e.preventDefault(); setV(hubValue(set, m) - Math.sign(e.deltaY) * (e.shiftKey ? 0.2 : 1)); clearTimeout(hub._t); hub._t = setTimeout(renderMacros, 400); };
    hub.ondblclick = () => { setV(m.default ?? 50); renderMacros(); };
    hub._paint = () => paintHub(hub, set, m);
  }

  // линии: от порта карточки к краю центрального узла
  function wires() {
    if (!G.el || !G.el.isConnected) return;
    const body = G.el.querySelector('.g-body'), svg = G.el.querySelector('.g-wires'); if (!body) return;
    const br = body.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${br.width} ${br.height}`);
    const hub = G.el.querySelector('.g-hub').getBoundingClientRect();
    const hx = hub.left - br.left + hub.width / 2, hy = hub.top - br.top + hub.height / 2, hr = hub.width / 2;
    let d = '';
    for (const c of G.el.querySelectorAll('.g-card')) {
      const r = c.querySelector('.g-head').getBoundingClientRect();
      const left = c.closest('.g-col').classList.contains('left');
      const px = (left ? r.right : r.left) - br.left, py = r.top - br.top + r.height / 2;
      const ex = hx + (left ? -hr : hr), ey = hy;
      const cx = (px + ex) / 2;
      d += `<path data-l="${esc(c.dataset.l)}" class="${c.classList.contains('off') ? 'off' : ''}" d="M${px},${py} C${cx},${py} ${cx},${ey} ${ex},${ey}"/>`;
      d += `<circle cx="${px}" cy="${py}" r="3.5" class="port"/>`;
    }
    svg.innerHTML = svg.querySelector('defs').outerHTML + `<g filter="url(#g-glow)">${d}</g>`;
    placeVideo();
  }
  // видео в режиме схемы живёт в слоте над узлом: сам элемент остаётся в main, мы только двигаем его на место слота
  function placeVideo() {
    const slot = G.el?.querySelector('.g-video-slot'), stage = document.getElementById('stage'), main = document.getElementById('main');
    if (!slot || !stage || !main.classList.contains('graph-mode')) return;
    const s = slot.getBoundingClientRect(), m = main.getBoundingClientRect();
    stage.style.left = (s.left - m.left) + 'px'; stage.style.top = (s.top - m.top) + 'px'; stage.style.width = s.width + 'px'; stage.style.height = s.height + 'px';
  }
  function hit(id) {
    if (!G.el || !G.el.isConnected) return;
    const c = G.el.querySelector(`.g-card[data-l="${CSS.escape(id)}"]`), p = G.el.querySelector(`path[data-l="${CSS.escape(id)}"]`);
    for (const x of [c, p]) if (x) { x.classList.remove('hit'); void x.getBoundingClientRect(); x.classList.add('hit'); }
    const hub = G.el.querySelector('.g-hub'); if (hub) { hub.classList.remove('hit'); void hub.offsetWidth; hub.classList.add('hit'); }
  }
  function tick() {
    G.raf = requestAnimationFrame(tick);
    if (!G.el || !G.el.isConnected || !G.el.offsetParent) return;
    const set = G.set;
    for (const c of G.el.querySelectorAll('.g-card')) {
      const an = audio.meters.get(set.id + '/' + c.dataset.l); if (!an) continue;
      const pct = meterPct(an); c.querySelector('.g-meter i').style.width = pct + '%'; c.style.setProperty('--lv', (pct / 100).toFixed(2));
    }
    const hub = G.el.querySelector('.g-hub'); if (hub && hub._paint) hub._paint();
    if (audio.masterAn) { const pct = meterPct(audio.masterAn); G.el.querySelector('.g-ring i').style.transform = `scale(${(0.6 + pct / 100 * 0.6).toFixed(3)})`; G.el.querySelector('.g-hub').style.setProperty('--lv', (pct / 100).toFixed(2)); }
    const m = metrics(set); for (const x of m) { const b = G.el.querySelector(`[data-metric="${x.id}"]`); if (b && b.textContent != x.value) b.textContent = x.value; }
    const sub = G.el.querySelector('.g-core span'); const st = subtitle(set); if (sub && sub.textContent !== st) sub.textContent = st;
  }
  function paintChain() { if (!G.el || !G.set) return; for (const chip of G.el.querySelectorAll('.g-chip')) chip.classList.toggle('on', !!G.set.fx?.find(x => x.id === chip.dataset.fx)?.on); }
  return { render, hit, wires, placeVideo, paintChain, get open() { return G.open; } };
})();

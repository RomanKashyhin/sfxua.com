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
    if (set.kind === 'steps') return `${Steps.SHOE_RU[set.select.shoe] || set.select.shoe} · ${Steps.SURF_RU[set.select.surface] || set.select.surface}`;
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
      ${paletteHtml()}
      <div class="g-body">
        <div class="g-blocks"></div>
        <svg class="g-wires"><defs><filter id="g-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
        <div class="g-col left">${L.map(l => card(set, l)).join('')}</div>
        <div class="g-mid"><div class="g-video-slot"></div>
          <div class="g-hub${hubMacro ? ' ctl' : ''}" data-tip="${Tip.attr(Tip.html(hubMacro ? hubMacro.name : set.name, hubMacro ? 'Тяни круг вверх/вниз или крути колесом: ' + (hubMacro.hint || '') + '. Двойной клик — середина.' : 'Сюда сходятся все слои набора.', null))}">
            ${hubMacro ? '<svg class="g-vring" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46" stroke-dasharray="0 289"/></svg>' : ''}
            <div class="g-disc"><i class="g-lv"></i>${hubMacro ? '<i class="g-ptr"></i>' : ''}</div>
            <div class="g-core"><b>${esc(set.name)}</b>${hubMacro ? '<em class="g-hard"></em><em class="g-hard-lbl"></em>' : ''}</div></div>
          <div class="g-cap">${esc(subtitle(set))}</div>
          <div class="g-chain"></div></div>
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
    closePop(); paintChain(); bindPalette();
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
    if (fg) fg.setAttribute('stroke-dasharray', `${(216.8 * t).toFixed(1)} 289`);   // дуга 270°: 0 пусто, 50 половина, 100 полная
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
    placeBlocks();
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
    if (audio.masterAn) { const pct = meterPct(audio.masterAn); G.el.querySelector('.g-lv').style.transform = `scale(${(0.5 + pct / 100 * 0.7).toFixed(3)})`; G.el.querySelector('.g-hub').style.setProperty('--lv', (pct / 100).toFixed(2)); }
    const m = metrics(set); for (const x of m) { const b = G.el.querySelector(`[data-metric="${x.id}"]`); if (b && b.textContent != x.value) b.textContent = x.value; }
    const sub = G.el.querySelector('.g-cap'); const st = subtitle(set); if (sub && sub.textContent !== st) sub.textContent = st;
  }
  // ===================== модули на ниточках =====================
  // Палитра над схемой: плитки модулей. Тянешь плитку на ниточку (компонент → узел) или на узел (шина набора) —
  // на ниточке появляется блок; блоки идут последовательно по ходу сигнала. Клик по блоку — его ручки,
  // блок можно перетащить на другую ниточку или в пустоту (убрать).
  const chainKey = (set, comp) => comp === 'bus' ? set.id : set.id + '/' + comp;
  const chainList = (set, comp) => comp === 'bus' ? (set.fx ??= []) : ((set.wireFx ??= {})[comp] ??= []);
  const whereText = (set, comp) => comp === 'bus' ? 'на всём наборе' : 'только «' + (set.layers.find(l => l.id === comp)?.name || comp) + '»';
  function paletteHtml() {
    return `<div class="g-palette"><span class="g-pal-lbl">модули</span>
      ${Fx.MODULES.map(m => `<span class="g-pal" data-mod="${m.id}" data-tip="${Tip.attr(Tip.html(m.name, m.desc, m.hear))}"><svg class="ico"><use href="#i-${m.icon}"/></svg><span><b>${esc(m.name)}</b><i>${esc(m.hint)}</i></span></span>`).join('')}
      <span class="g-pal-hint">тяни плитку на ниточку — обработает только тот слой; на круг — все слои вместе</span></div>`;
  }
  function blockHtml(set, comp, cfg, i) {
    const d = Fx.def(cfg.id);
    const tip = Tip.html((d?.name || cfg.id) + ' · ' + whereText(set, comp), 'Клик — ручки и живая картинка. Тяни — переставить на другую ниточку или в пустоту, чтобы убрать.', null);
    return `<div class="g-block${cfg.on === false ? ' off' : ''}" data-comp="${esc(comp)}" data-uid="${esc(cfg.uid)}" data-tip="${Tip.attr(tip)}"><svg class="ico"><use href="#i-${d?.icon || 'grid'}"/></svg></div>`;
  }
  // блоки на шине: ряд под узлом
  function paintChain() {
    if (!G.el || !G.set) return;
    const row = G.el.querySelector('.g-chain'); if (!row) return;
    const list = chainList(G.set, 'bus');
    const tip = Tip.html('Модули на всём наборе', 'Сюда попадают все слои уже смешанными, перед дистанцией. Модуль на ниточке действует только на свой слой, модуль здесь — на всё сразу.', null);
    row.innerHTML = `<span class="g-chain-lbl" data-tip="${Tip.attr(tip)}">весь набор</span>` + list.map((c, i) => blockHtml(G.set, 'bus', c, i)).join('') + (list.length ? '' : '<span class="g-chain-empty">пусто — брось плитку на круг</span>');
    for (const b of row.querySelectorAll('.g-block')) bindBlock(b);
  }
  // блоки на ниточках: поверх линий, равномерно по длине
  function placeBlocks() {
    const layer = G.el?.querySelector('.g-blocks'); if (!layer) return;
    let html = '';
    const pos = [];
    for (const p of G.el.querySelectorAll('.g-wires path[data-l]')) {
      const comp = p.dataset.l, list = G.set.wireFx?.[comp] || []; if (!list.length) continue;
      const len = p.getTotalLength();
      list.forEach((cfg, i) => { const pt = p.getPointAtLength(len * (i + 1) / (list.length + 1)); pos.push([pt.x, pt.y]); html += blockHtml(G.set, comp, cfg, i); });
    }
    layer.innerHTML = html;
    [...layer.children].forEach((b, i) => { b.style.left = pos[i][0] + 'px'; b.style.top = pos[i][1] + 'px'; bindBlock(b); });
  }
  function bindBlock(b) {
    const comp = b.dataset.comp, uid = b.dataset.uid;
    let down = null;
    b.onpointerdown = e => { if (e.button !== 0) return; down = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
    b.onpointermove = e => { if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) return; const d = down; down = null; startDrag(e, { from: comp, uid }, b); };
    b.onpointerup = e => { if (!down) return; down = null; openPop(b, comp, uid); };
    b.onpointercancel = () => { down = null; };
  }
  function bindPalette() {
    for (const tile of G.el.querySelectorAll('.g-pal')) tile.onpointerdown = e => { if (e.button === 0) { e.preventDefault(); startDrag(e, { mod: tile.dataset.mod }, tile); } };
  }
  // общее перетаскивание: призрак под курсором, подсветка цели, вставка на отпускание
  function startDrag(e, src, fromEl) {
    const body = G.el.querySelector('.g-body'), br = body.getBoundingClientRect();
    const paths = [...G.el.querySelectorAll('.g-wires path[data-l]')].map(p => {
      const len = p.getTotalLength(), pts = []; for (let s = 0; s <= len; s += 10) { const q = p.getPointAtLength(s); pts.push([q.x, q.y, s / len]); } return { p, comp: p.dataset.l, pts };
    });
    const hub = G.el.querySelector('.g-hub'), chainRow = G.el.querySelector('.g-chain');
    const def = Fx.def(src.mod || chainList(G.set, src.from).find(x => x.uid === src.uid)?.id);
    const ghost = document.createElement('div'); ghost.className = 'g-ghost'; ghost.innerHTML = `<svg class="ico"><use href="#i-${def?.icon || 'grid'}"/></svg><span></span>`;
    const gtxt = ghost.querySelector('span');
    Tip.hide();
    document.body.appendChild(ghost);
    G.el.classList.add('dragging'); fromEl.classList.add('drag-src');
    let target = null;
    const move = ev => {
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      const x = ev.clientX - br.left, y = ev.clientY - br.top;
      let best = null;
      for (const r of [hub.getBoundingClientRect(), chainRow.getBoundingClientRect()]) if (ev.clientX >= r.left - 12 && ev.clientX <= r.right + 12 && ev.clientY >= r.top - 12 && ev.clientY <= r.bottom + 12) best = { comp: 'bus', t: 1 };
      if (!best) { let md = 28; for (const w of paths) for (const [px, py, t] of w.pts) { const d = Math.hypot(px - x, py - y); if (d < md) { md = d; best = { comp: w.comp, t, el: w.p }; } } }
      if (target?.el) target.el.classList.remove('target'); hub.classList.remove('target'); chainRow.classList.remove('target');
      target = best;
      if (target?.el) target.el.classList.add('target'); else if (target) { hub.classList.add('target'); chainRow.classList.add('target'); }
      ghost.classList.toggle('ok', !!target); ghost.classList.toggle('rm', !target && !!src.uid);
      gtxt.textContent = target ? (def?.name || '') + ' → ' + whereText(G.set, target.comp) : src.uid ? 'убрать' : 'мимо';
    };
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      ghost.remove(); G.el.classList.remove('dragging'); fromEl.classList.remove('drag-src');
      if (target?.el) target.el.classList.remove('target'); hub.classList.remove('target'); chainRow.classList.remove('target');
      let cfg = null;
      if (src.uid) { const from = chainList(G.set, src.from), i = from.findIndex(x => x.uid === src.uid); if (i >= 0) cfg = from.splice(i, 1)[0]; Fx.live(chainKey(G.set, src.from))?.update(from); }
      else cfg = Fx.make(src.mod);
      if (target && cfg) {
        const list = chainList(G.set, target.comp);
        const at = target.comp === 'bus' ? list.length : Math.min(list.length, Math.round(target.t * (list.length + 1) - 0.5));
        list.splice(Math.max(0, at), 0, cfg);
        Fx.live(chainKey(G.set, target.comp))?.update(list);
      }
      if (typeof renderFx === 'function') renderFx(G.set);
      paintChain(); wires();
      if (target && cfg) { const b = G.el.querySelector(`.g-block[data-uid="${CSS.escape(cfg.uid)}"]`); if (b && !src.uid) openPop(b, target.comp, cfg.uid); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    move(e);
  }
  // всплывашка с ручками модуля рядом с блоком
  function openPop(block, comp, uid) {
    closePop();
    const list = chainList(G.set, comp), cfg = list.find(x => x.uid === uid); if (!cfg) return;
    const pop = document.createElement('div'); pop.className = 'g-pop';
    const el = fxModuleEl(G.set, list, cfg, chainKey(G.set, comp), why => { block.classList.toggle('off', cfg.on === false); if (why === 'removed') { closePop(); paintChain(); wires(); } if (comp === 'bus' && typeof renderFx === 'function') renderFx(G.set); });
    if (!el) return;
    pop.appendChild(el);
    const where = document.createElement('div'); where.className = 'g-pop-where';
    where.innerHTML = comp === 'bus' ? '<b>на всём наборе</b> — все слои вместе, перед дистанцией' : `<b>${esc(whereText(G.set, comp))}</b> — остальные слои не трогает`;
    pop.prepend(where);
    G.el.appendChild(pop);
    const er = G.el.getBoundingClientRect(), b = block.getBoundingClientRect();
    let x = b.left - er.left + G.el.scrollLeft + b.width / 2 - pop.offsetWidth / 2, y = b.bottom - er.top + G.el.scrollTop + 10;
    x = Math.max(8, Math.min(x, G.el.clientWidth - pop.offsetWidth - 8));
    if (y + pop.offsetHeight > G.el.scrollTop + G.el.clientHeight - 8) y = b.top - er.top + G.el.scrollTop - pop.offsetHeight - 10;
    pop.style.left = x + 'px'; pop.style.top = Math.max(8, y) + 'px';
    G.pop = pop;
    setTimeout(() => { document.addEventListener('pointerdown', G.popClose = ev => { if (!pop.contains(ev.target) && !block.contains(ev.target)) closePop(); }, true); }, 0);
  }
  function closePop() { if (G.pop) { G.pop.remove(); G.pop = null; Tip.hide(); } if (G.popClose) { document.removeEventListener('pointerdown', G.popClose, true); G.popClose = null; } }

  return { render, hit, wires, placeVideo, paintChain, get open() { return G.open; } };
})();

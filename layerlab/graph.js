// SFX Lab · экран-схема («психокружочек»).
// В центре круг из долек: долька = слой набора, её длина = громкость слоя. Тянешь дольку вверх/вниз — громче/тише,
// Ctrl+клик — выключить/включить, клик — подробности слоя (полосы удара, огибающие), колесо — по шагу, двойной клик — 80.
// Внутри круга — ребристое кольцо «Жёсткость»: крутишь влево/вправо, число посередине. Между ними — кольцо модулей
// на всём наборе: плитку из палитры бросаешь на дольку (обработает только этот слой) или на кольцо (все слои вместе);
// по сегменту кольца тянешь влево/вправо — микс (сухой/обработанный) этого модуля, клик — его ручки и картинка.
// Слева дуги выбора обуви и поверхности, справа веера темпа и погоды (крутятся, показывают, к какому состоянию ближе).

const Graph = (() => {
  const KIND = { loop: '#38bdf8', steps: '#f5b84a', whoosh: '#a78bfa' };
  const ICON = { heel: 'foot', tip: 'foot', rel: 'wind', slide: 'wind', stairs: 'layers', generic: 'grid', water: 'rain', puddle: 'rain', acc1: 'zap', acc2: 'zap', noise: 'wind', tex1: 'layers', tex2: 'layers' };
  const R = 168, R0 = 94, RING = [64, 86], RIB = [40, 58], SZ = 2 * (R + 40), GAP = 3.5, SLOTS = 8;   // радиусы круга, размер svg, зазор долек, сегментов кольца
  const G = { el: null, set: null, raf: 0, ro: null, hooks: {}, pop: null, popClose: null, pie: null, vals: {} };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pol = (r, a) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];   // угол от верха по часовой
  const f1 = v => v.toFixed(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // сектор кольца a0…a1 (градусы), радиусы r0…r1
  function arcPath(a0, a1, r0, r1) {
    const [x0, y0] = pol(r1, a0), [x1, y1] = pol(r1, a1), [x2, y2] = pol(r0, a1), [x3, y3] = pol(r0, a0), big = a1 - a0 > 180 ? 1 : 0;
    return `M${f1(x3)},${f1(y3)} L${f1(x0)},${f1(y0)} A${r1},${r1} 0 ${big} 1 ${f1(x1)},${f1(y1)} L${f1(x2)},${f1(y2)} A${r0},${r0} 0 ${big} 0 ${f1(x3)},${f1(y3)} Z`;
  }

  function summary(set, l) {
    if (set.kind === 'steps') return Steps.bandSummary(l);
    if (set.kind === 'whoosh') return l.on === false ? 'выключен' : l.type === 'noise' ? (Whoosh.NOISES[l.src] || l.src) : (l.file ? l.file.split('/').pop() : l.blob ? l.blob.name : 'нет файла');
    return `${l.mode === 'loop' ? 'петля' : 'ван-шот'}${l.seconds ? ' · ' + l.seconds.toFixed(1) + ' с' : ''}`;
  }
  function subtitle(set) {
    if (set.kind === 'steps') return `${Steps.SHOE_RU[set.select.shoe] || set.select.shoe} · ${Steps.surfName(set)}`;
    if (set.kind === 'whoosh') return `${set.layers.filter(l => l.on !== false).length} слоя · ${Whoosh.state.P.dur.toFixed(2)} с`;
    return `${set.layers.length} слоёв`;
  }
  // дольки: у шагов только компоненты, у которых есть сэмплы (пустые слоты не рисуем)
  const layersOf = set => set.layers.filter(l => set.kind !== 'steps' || Steps.hasSamples(l.id, set));
  function metricsHtml(set) {
    return metrics(set).map(x => `<div class="g-tile"><svg class="ico"><use href="#i-${x.icon}"/></svg><div><i>${x.label}</i><b data-metric="${x.id}">${x.value}</b></div></div>`).join('');
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

  // ===================== разметка =====================
  function render(el, set, hooks = {}) {
    closePop(); closeMenu();
    G.el = el; G.set = set; G.hooks = hooks;
    el.style.setProperty('--g', KIND[set.kind || 'loop']);
    const hubMacro = (set.macros || []).find(m => m.hub), dials = (set.macros || []).filter(m => m.dial);
    const pickers = set.kind === 'steps' ? Steps.pickers(set) : [];
    const hubTip = hubMacro ? Tip.html(hubMacro.name, 'Крути ребристое кольцо влево/вправо или колесом: ' + (hubMacro.hint || '') + '. Двойной клик — середина. Кольцо снаружи — модули на всём наборе: тяни сегмент влево/вправо — микс, клик — ручки.', null) : Tip.html(set.name, 'Сюда сходятся все слои набора. Кольцо снаружи — модули на всём наборе.', null);
    el.innerHTML = `
      <div class="g-metrics">${metricsHtml(set)}</div>
      ${paletteHtml()}
      <div class="g-body">
        <div class="g-side left">${pickers.map(pickerHtml).join('')}</div>
        <div class="g-mid">
          <div class="g-video-slot"></div>
          <div class="g-pie-wrap" style="width:${SZ}px;height:${SZ}px">
            <svg class="g-pie" viewBox="${-SZ / 2} ${-SZ / 2} ${SZ} ${SZ}">
              <g class="g-wedges"></g>
              <g class="g-ring"></g>
              <g class="g-rib"${hubMacro ? '' : ' style="display:none"'}><g class="rib-rot"></g><path class="rib-hit" d="${arcPath(0.01, 359.99, RIB[0], RIB[1] + 3)}"/></g>
              <g class="g-centre" data-tip="${Tip.attr(hubTip)}"><circle class="c-bg" r="${RIB[0] - 3}"/><text class="c-num" y="${hubMacro ? 5 : 4}">${hubMacro ? '' : esc(set.name)}</text><text class="c-lbl" y="${hubMacro ? 21 : 18}">${hubMacro ? '' : esc(subtitle(set))}</text></g>
            </svg>
            <div class="g-blocks"></div>
            <button class="g-preset" data-tip="${Tip.attr(Tip.html('Пресеты круга', 'Сохранить всё как сейчас под своим именем или выбрать сохранённое: ползунки, обувь и поверхность, слои, модули.', null))}"><svg class="ico"><use href="#i-bookmark"/></svg></button>
          </div>
          <div class="g-cap">${esc(set.name)} · ${esc(subtitle(set))}</div>
        </div>
        <div class="g-side right">${dials.map(dialHtml).join('')}</div>
      </div>`;
    G.pie = el.querySelector('.g-pie-wrap');
    paintWedges(); paintRing(); paintRib(hubMacro); bindPie(hubMacro);
    bindPalette(); bindPickers(set); bindDials(set); bindPreset();
    setTimeout(layout, 0); requestAnimationFrame(layout);   // таймер нужен, когда вкладка в фоне и rAF спит
    if (!G.ro) { G.ro = new ResizeObserver(() => layout()); el.addEventListener('scroll', placeVideo); }
    G.ro.disconnect(); G.ro.observe(el);
    if (!G.raf) tick();
  }
  function layout() { if (!G.el || !G.el.isConnected) return; placeBlocks(); placeVideo(); }
  // видео в режиме схемы живёт в слоте над кругом: сам элемент остаётся в main, мы только двигаем его на место слота
  function placeVideo() {
    const slot = G.el?.querySelector('.g-video-slot'), stage = document.getElementById('stage'), main = document.getElementById('main');
    if (!slot || !stage || !main.classList.contains('graph-mode')) return;
    if (state.videoFree) { stage.style.left = state.videoFree.x + 'px'; stage.style.top = state.videoFree.y + 'px'; stage.style.width = '300px'; stage.style.height = '170px'; return; }   // закреплённое окошко
    const s = slot.getBoundingClientRect(), m = main.getBoundingClientRect();
    stage.style.left = (s.left - m.left) + 'px'; stage.style.top = (s.top - m.top) + 'px'; stage.style.width = s.width + 'px'; stage.style.height = s.height + 'px';
  }

  // ===================== дольки слоёв =====================
  const wedgeR1 = gain => R0 + 12 + (R - R0 - 12) * clamp(gain ?? 80, 0, 100) / 100;
  function wedgeGeom(set, i, n) { const span = 360 / n; return { a0: i * span + GAP / 2, a1: (i + 1) * span - GAP / 2, am: (i + 0.5) * span }; }
  function paintWedges() {
    const set = G.set, L = layersOf(set), g = G.el.querySelector('.g-wedges');
    g.innerHTML = L.map((l, i) => {
      const key = set.id + '/' + l.id, off = l.on === false || state.mute[key];
      const tip = Tip.html(l.name, 'Тяни вверх/вниз — громкость слоя, Ctrl+клик — выключить/включить, клик — подробности (полосы, огибающие), колесо — по шагу, двойной клик — 80. Плитку модуля можно бросить прямо на дольку.', null);
      return `<g class="g-wedge${off ? ' off' : ''}" data-l="${esc(l.id)}" data-tip="${Tip.attr(tip)}"><path class="w-frame"/><path class="w-fill"/><path class="w-lv"/><text class="w-num"></text><text class="w-lbl"></text></g>`;
    }).join('');
    L.forEach((l, i) => paintWedge(l, i, L.length));
    bindWedges();
  }
  function paintWedge(l, i, n) {
    const w = G.el.querySelector(`.g-wedge[data-l="${CSS.escape(l.id)}"]`); if (!w) return;
    const { a0, a1, am } = wedgeGeom(G.set, i, n), gain = l.gain ?? 80, r1 = wedgeR1(gain), d = arcPath(a0, a1, R0, r1);
    w.querySelector('.w-frame').setAttribute('d', arcPath(a0, a1, R0, R));
    w.querySelector('.w-fill').setAttribute('d', d); w.querySelector('.w-lv').setAttribute('d', d);
    w.style.setProperty('--wf', `hsl(225 10% ${(58 + 34 * gain / 100).toFixed(0)}%)`);
    const rt = (R0 + R) / 2 + 2, [tx, ty] = pol(rt, am);
    w.classList.toggle('lite', r1 < rt + 12);   // заливка не дошла до текста — текст светлый
    const num = w.querySelector('.w-num'), lbl = w.querySelector('.w-lbl');
    num.setAttribute('x', f1(tx)); num.setAttribute('y', f1(ty - 2)); num.textContent = Math.round(gain);
    lbl.setAttribute('x', f1(tx)); lbl.setAttribute('y', f1(ty + 11)); lbl.textContent = l.name.length > 14 ? l.name.slice(0, 13) + '…' : l.name;
  }
  function wedgeAt(clientX, clientY) {   // → { comp, r, a } по координатам курсора; comp 'bus' на кольце модулей
    const rc = G.pie.getBoundingClientRect(), s = rc.width / SZ, dx = (clientX - rc.left) / s - SZ / 2, dy = (clientY - rc.top) / s - SZ / 2;
    const r = Math.hypot(dx, dy), a = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    if (r > RIB[0] && r <= RING[1] + 8) return { comp: 'bus', r, a, slot: Math.floor(a / (360 / SLOTS)) };
    if (r >= R0 - 10 && r <= R + 40) { const L = layersOf(G.set), i = Math.floor(a / (360 / L.length)); return L[i] ? { comp: L[i].id, r, a } : null; }
    return null;
  }

  // ===================== кольцо модулей на всём наборе =====================
  function paintRing() {
    const set = G.set, list = set.fx ??= [], g = G.el.querySelector('.g-ring'), span = 360 / SLOTS;
    g.innerHTML = Array.from({ length: SLOTS }, (_, i) => {
      const cfg = list[i], d = Fx.def(cfg?.id), a0 = i * span + 2, a1 = (i + 1) * span - 2, am = (i + 0.5) * span, [ix, iy] = pol((RING[0] + RING[1]) / 2, am);
      const tip = cfg ? Tip.html((d?.name || cfg.id) + ' · на всём наборе', 'Тяни влево/вправо — микс (сколько обработанного подмешано), клик — ручки и живая картинка. Порядок по кругу = порядок обработки.', d?.hear)
                      : Tip.html('Свободный слот', 'Брось сюда плитку модуля из палитры: он обработает все слои вместе, перед дистанцией.', null);
      return `<g class="r-seg${cfg ? ' full' : ' empty'}${cfg?.on === false ? ' off' : ''}" data-slot="${i}"${cfg ? ` data-uid="${esc(cfg.uid)}"` : ''} data-tip="${Tip.attr(tip)}"><path d="${arcPath(a0, a1, RING[0], RING[1])}"/>${cfg ? `<use class="r-ico" href="#i-${d?.icon || 'grid'}" x="${f1(ix - 8)}" y="${f1(iy - 8)}" width="16" height="16"/>` : ''}</g>`;
    }).join('');
    for (const seg of g.querySelectorAll('.r-seg.full')) bindSegment(seg);
  }
  const mixParam = cfg => Fx.def(cfg.id)?.params.find(p => p.id === 'mix');
  function bindSegment(seg) {
    const uid = seg.dataset.uid;
    let down = null, moved = false, float = null;
    seg.onpointerdown = e => { if (e.button !== 0) return; const cfg = G.set.fx.find(x => x.uid === uid); if (!cfg) return; down = { x: e.clientX, v: cfg.p.mix ?? mixParam(cfg)?.default ?? 100, cfg }; moved = false; seg.setPointerCapture(e.pointerId); e.preventDefault(); Tip.hide(); };
    seg.onpointermove = e => {
      if (!down) return; const dx = e.clientX - down.x; if (!moved && Math.abs(dx) < 4) return; moved = true;
      const p = mixParam(down.cfg); if (!p) return;
      down.cfg.p.mix = clamp(Math.round(down.v + dx * (e.shiftKey ? 0.1 : 0.5)), 0, 100);
      Fx.live(G.set.id)?.update(G.set.fx);
      if (!float) { float = document.createElement('div'); float.className = 'k-float'; document.body.appendChild(float); }
      const r = seg.getBoundingClientRect(); float.style.left = (r.left + r.width / 2) + 'px'; float.style.top = (r.top - 6) + 'px'; float.textContent = 'микс ' + p.fmt(down.cfg.p.mix);
    };
    seg.onpointerup = e => { const was = down; down = null; if (float) { float.remove(); float = null; } if (!was) return; if (moved) { if (typeof renderFx === 'function') renderFx(G.set); } else openPop(seg, 'bus', uid); };
    seg.onpointercancel = () => { down = null; if (float) { float.remove(); float = null; } };
  }

  // ===================== ребристое кольцо «Жёсткость» =====================
  const hardColor = t => { const h = t < 0.5 ? 190 - (190 - 40) * (t / 0.5) : 40 - (40 - 8) * ((t - 0.5) / 0.5); return `hsl(${h.toFixed(0)} 85% ${(60 - 8 * t).toFixed(0)}%)`; };
  const hardWord = t => t < 0.2 ? 'мягко · ASMR' : t < 0.4 ? 'мягко' : t < 0.6 ? 'ровно' : t < 0.8 ? 'жёстко' : 'очень жёстко';
  const hubValue = (set, m) => state.values[set.id]?.[m.id] ?? m.default ?? 50;
  function paintRib(m) {
    const g = G.el.querySelector('.rib-rot'); if (!g || !m) return;
    g.innerHTML = Array.from({ length: 72 }, (_, i) => { const a = i * 5, long = i % 9 === 0, [x0, y0] = pol(RIB[0] + (long ? 1 : 4), a), [x1, y1] = pol(RIB[1] - (long ? 1 : 4), a); return `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}"${long ? ' class="long"' : ''}/>`; }).join('');
    paintHub(m);
  }
  function paintHub(m) {
    if (!G.el || !m) return;
    const v = hubValue(G.set, m), t = v / 100, pie = G.pie;
    pie.style.setProperty('--g2', hardColor(t));
    const rot = G.el.querySelector('.rib-rot'); if (rot) rot.setAttribute('transform', `rotate(${((t - 0.5) * 270).toFixed(1)})`);
    const num = G.el.querySelector('.c-num'), lbl = G.el.querySelector('.c-lbl');
    if (num && num.textContent != v) num.textContent = v;
    const w = m.name + ' · ' + hardWord(t); if (lbl && lbl.textContent !== w) lbl.textContent = w;
  }
  function bindWedges() {
    const svg = G.el.querySelector('.g-pie');
    // дольки: тянуть громкость, Ctrl+клик — мьют, клик — подробности
    for (const w of svg.querySelectorAll('.g-wedge')) {
      const l = G.set.layers.find(x => x.id === w.dataset.l); if (!l) continue;
      let drag = null, moved = false;
      const setGain = v => { l.gain = clamp(Math.round(v), 0, 100); const L = layersOf(G.set); paintWedge(l, L.indexOf(l), L.length); G.hooks.onGain?.(l); };
      const syncFader = () => { const f = document.querySelector(`#layers .layer input.gain[data-key="${CSS.escape(G.set.id + '/' + l.id)}"]`); if (f) { f.value = l.gain; f.style.setProperty('--p', l.gain + '%'); } };
      w.onpointerdown = e => { if (e.button !== 0) return; drag = { y: e.clientY, v: l.gain ?? 80 }; moved = false; w.setPointerCapture(e.pointerId); e.preventDefault(); Tip.hide(); };
      w.onpointermove = e => { if (!drag) return; const dy = drag.y - e.clientY; if (!moved && Math.abs(dy) < 4) return; moved = true; w.classList.add('drag'); setGain(drag.v + dy * (e.shiftKey ? 0.1 : 1) * 100 / 260); };
      w.onpointerup = e => { const d = drag; drag = null; w.classList.remove('drag'); if (!d) return; if (moved) { syncFader(); return; } if (e.ctrlKey || e.metaKey) { G.hooks.onToggleMute?.(l); return; } openLayerPop(l, w); };
      w.onpointercancel = () => { drag = null; w.classList.remove('drag'); };
      w.ondblclick = () => { setGain(80); syncFader(); };
      w.onwheel = e => { e.preventDefault(); setGain((l.gain ?? 80) - Math.sign(e.deltaY) * (e.shiftKey ? 0.2 : 1)); clearTimeout(w._t); w._t = setTimeout(syncFader, 300); };
    }
  }
  function bindPie(m) {
    const svg = G.el.querySelector('.g-pie');
    if (!m) return;
    // ребристое кольцо: угол курсора вокруг центра → значение
    const hit = svg.querySelector('.rib-hit'), centre = svg.querySelector('.g-centre');
    const angleAt = e => { const rc = G.pie.getBoundingClientRect(); return Math.atan2(e.clientX - rc.left - rc.width / 2, -(e.clientY - rc.top - rc.height / 2)) * 180 / Math.PI; };
    let drag = null;
    const setV = v => { v = clamp(Math.round(v), 0, 100); state.values[G.set.id][m.id] = v; applyMacros(G.set.id); paintHub(m); };
    hit.onpointerdown = e => { if (e.button !== 0) return; drag = { a: angleAt(e), v: hubValue(G.set, m), acc: 0 }; hit.setPointerCapture(e.pointerId); e.preventDefault(); Tip.hide(); };
    hit.onpointermove = e => { if (!drag) return; let d = angleAt(e) - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360; drag.acc += d; drag.a = angleAt(e); setV(drag.v + drag.acc / 2.7 * (e.shiftKey ? 0.2 : 1)); };
    hit.onpointerup = hit.onpointercancel = () => { if (drag) { drag = null; renderMacros(); } };
    for (const el of [hit, centre]) {
      el.onwheel = e => { e.preventDefault(); setV(hubValue(G.set, m) - Math.sign(e.deltaY) * (e.shiftKey ? 0.2 : 1)); clearTimeout(G._ht); G._ht = setTimeout(renderMacros, 400); };
      el.ondblclick = () => { setV(m.default ?? 50); renderMacros(); };
    }
    centre.onpointerdown = hit.onpointerdown; centre.onpointermove = hit.onpointermove; centre.onpointerup = hit.onpointerup;
  }

  // ===================== удары, метры, цифры =====================
  function hit(id) {
    if (!G.el || !G.el.isConnected) return;
    const w = G.el.querySelector(`.g-wedge[data-l="${CSS.escape(id)}"]`);
    if (w) { w.classList.remove('hit'); void w.getBoundingClientRect(); w.classList.add('hit'); }
  }
  function tick() {
    G.raf = requestAnimationFrame(tick);
    if (!G.el || !G.el.isConnected || !G.el.offsetParent) return;
    const set = G.set;
    for (const w of G.el.querySelectorAll('.g-wedge')) {
      const an = audio.meters.get(set.id + '/' + w.dataset.l); if (!an) continue;
      w.querySelector('.w-lv').style.opacity = (meterPct(an) / 100 * 0.8).toFixed(2);
    }
    const hubMacro = (set.macros || []).find(m => m.hub); if (hubMacro) paintHub(hubMacro);
    if (audio.masterAn) G.pie.style.setProperty('--lv', (meterPct(audio.masterAn) / 100).toFixed(2));
    for (const x of metrics(set)) { const b = G.el.querySelector(`[data-metric="${x.id}"]`); if (b && b.textContent != x.value) b.textContent = x.value; }
    const cap = G.el.querySelector('.g-cap'); const st = set.name + ' · ' + subtitle(set); if (cap && cap.textContent !== st) cap.textContent = st;
    for (const m of (set.macros || []).filter(m => m.dial)) paintDial(m);
  }

  // ===================== веера темпа и погоды =====================
  // Веер крутится под неподвижной стрелкой: значение 0…100 = где стрелка на веере; подпись говорит, к какому состоянию ближе.
  const FAN = 150, FR = [38, 92];
  function dialHtml(m) {
    const n = m.zones.length, span = FAN / n;
    const sectors = m.zones.map((z, i) => { const a0 = -FAN / 2 + i * span + 1.2, a1 = a0 + span - 2.4, am = (a0 + a1) / 2, [ix, iy] = pol(74, am), [tx, ty] = pol(50, am);
      return `<g class="d-sec" data-i="${i}"><path d="${arcPath(a0, a1, FR[0], FR[1])}"/><use class="d-ico" href="#i-${z.icon}" x="${f1(ix - 9)}" y="${f1(iy - 9)}" width="18" height="18"/><text x="${f1(tx)}" y="${f1(ty + 3)}">${esc(z.name)}</text></g>`; }).join('');
    const tip = Tip.html(m.name, (m.hint || '') + '. Крути веер (тяни влево/вправо или колесом) — положение плавное, подсветка говорит, к какому состоянию ближе. Кнопка внизу — сброс.', null);
    return `<div class="g-dial" data-m="${esc(m.id)}" data-tip="${Tip.attr(tip)}"><svg viewBox="-104 -100 208 134"><g class="d-rot">${sectors}</g><g class="d-ptr-rot"><path class="d-ptr" d="M0,-99 L-6,-88 L6,-88 Z"/></g><g class="d-btn"><circle r="11" cy="12"/><svg class="ico" x="-6" y="6" width="12" height="12" viewBox="0 0 24 24"><use href="#i-repeat"/></svg></g></svg><div class="d-name"><b>${esc(m.name)}</b><span></span></div></div>`;
  }
  const nearestZone = (m, v) => m.zones.reduce((b, z) => Math.abs(z.at - v) < Math.abs(b.at - v) ? z : b, m.zones[0]);
  function paintDial(m) {
    const box = G.el.querySelector(`.g-dial[data-m="${CSS.escape(m.id)}"]`); if (!box) return;
    const v = state.values[G.set.id]?.[m.id] ?? m.default ?? 50;
    if (G.vals[m.id] === v && box._painted) return; G.vals[m.id] = v; box._painted = true;
    box.querySelector('.d-ptr-rot').setAttribute('transform', `rotate(${(v / 100 * FAN - FAN / 2).toFixed(1)})`);
    const z = nearestZone(m, v), i = m.zones.indexOf(z);
    box.querySelectorAll('.d-sec').forEach((s, j) => s.classList.toggle('on', j === i));
    box.querySelector('.d-name span').textContent = z.name + ' · ' + v;
  }
  function bindDials(set) {
    for (const box of G.el.querySelectorAll('.g-dial')) {
      const m = set.macros.find(x => x.id === box.dataset.m); if (!m) continue;
      const val = () => state.values[set.id]?.[m.id] ?? m.default ?? 50;
      const setV = v => { G.hooks.onMacro?.(m, clamp(v, 0, 100)); paintDial(m); };
      let drag = null;
      const rot = box.querySelector('.d-rot');
      rot.onpointerdown = e => { if (e.button !== 0) return; drag = { x: e.clientX, v: val() }; rot.setPointerCapture(e.pointerId); e.preventDefault(); Tip.hide(); };
      rot.onpointermove = e => { if (drag) setV(drag.v - (e.clientX - drag.x) * (e.shiftKey ? 0.1 : 0.45)); };
      rot.onpointerup = rot.onpointercancel = () => { drag = null; };
      box.onwheel = e => { e.preventDefault(); setV(val() - Math.sign(e.deltaY) * (e.shiftKey ? 0.2 : 2)); };
      box.querySelector('.d-btn').onclick = () => setV(m.default ?? 50);
      for (const s of box.querySelectorAll('.d-sec')) s.onclick = e => { if (drag) return; setV(m.zones[+s.dataset.i].at); };
      paintDial(m);
    }
  }

  // ===================== дуги выбора (обувь, поверхность) =====================
  // Список вдоль дуги: выбранное — в середине, крупнее; колесо/перетаскивание листают, клик выбирает.
  function pickerHtml(p) {
    return `<div class="g-pickbox"><div class="p-title">${esc(p.name)}</div><div class="g-pick" data-pick="${esc(p.id)}" data-tip="${Tip.attr(Tip.html(p.name, 'Крути колесом или тяни вверх/вниз — список едет по дуге; клик по пункту — выбрать.', null))}">
      <div class="p-arc"></div>
      ${p.items.map((it, i) => `<div class="p-item" data-i="${i}" data-v="${esc(it.id)}"><span class="p-lbl">${esc(it.name)}</span><span class="p-pill"${it.img ? ` style="background-image:url('${esc(it.img)}')"` : ''}>${it.icon ? `<svg class="ico"><use href="#i-${it.icon}"/></svg>` : ''}</span></div>`).join('')}
    </div></div>`;
  }
  const PICK_STEP = 13.5, PICK_R = 230;
  function paintPicker(box, p, sel) {
    const H = box.clientHeight || 190, W = box.clientWidth || 220, cx = W - 36 - PICK_R, cy = H / 2 + 8;
    const arc = box.querySelector('.p-arc'); arc.style.left = (cx - PICK_R) + 'px'; arc.style.top = (cy - PICK_R) + 'px'; arc.style.width = arc.style.height = (2 * PICK_R) + 'px';
    box.querySelectorAll('.p-item').forEach((it, i) => {
      const a = (i - sel) * PICK_STEP, vis = Math.abs(a) <= 40;
      const x = cx + PICK_R * Math.cos(a * Math.PI / 180), y = cy + PICK_R * Math.sin(a * Math.PI / 180);
      it.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-100%, -50%)`;
      it.style.opacity = vis ? (1 - Math.abs(a) / 48).toFixed(2) : 0; it.style.pointerEvents = vis ? 'auto' : 'none';
      it.classList.toggle('on', i === sel);
    });
  }
  function bindPickers(set) {
    for (const box of G.el.querySelectorAll('.g-pick')) {
      const p = Steps.pickers(set).find(x => x.id === box.dataset.pick); if (!p) continue;
      let sel = Math.max(0, p.items.findIndex(it => it.id === p.value)), view = sel;
      const paint = () => paintPicker(box, p, view);
      const choose = i => { i = clamp(i, 0, p.items.length - 1); view = sel = i; paint(); G.hooks.onPick?.(p.id, p.items[i].id); };
      box.onwheel = e => { e.preventDefault(); clearTimeout(box._t); view = clamp(view + Math.sign(e.deltaY), 0, p.items.length - 1); paint(); box._t = setTimeout(() => choose(view), 350); };
      let drag = null;
      box.onpointerdown = e => { if (e.button !== 0 || e.target.closest('.p-item')) return; drag = { y: e.clientY, v: view }; box.setPointerCapture(e.pointerId); };
      box.onpointermove = e => { if (!drag) return; view = clamp(Math.round(drag.v + (e.clientY - drag.y) / 34), 0, p.items.length - 1); paint(); };
      box.onpointerup = () => { if (drag) { drag = null; if (view !== sel) choose(view); } };
      for (const it of box.querySelectorAll('.p-item')) it.onclick = () => choose(+it.dataset.i);
      box._sync = () => { const p2 = Steps.pickers(set).find(x => x.id === p.id); if (!p2) return; const i = Math.max(0, p.items.findIndex(it => it.id === p2.value)); if (i !== sel) { view = sel = i; paint(); } };
      requestAnimationFrame(paint); paint();
    }
  }

  // ===================== модули: палитра, блоки на дольках, перетаскивание =====================
  const chainKey = (set, comp) => comp === 'bus' ? set.id : set.id + '/' + comp;
  const chainList = (set, comp) => comp === 'bus' ? (set.fx ??= []) : ((set.wireFx ??= {})[comp] ??= []);
  const whereText = (set, comp) => comp === 'bus' ? 'на всём наборе' : 'только «' + (set.layers.find(l => l.id === comp)?.name || comp) + '»';
  function paletteHtml() {
    return `<div class="g-palette"><span class="g-pal-lbl">модули</span>
      ${Fx.MODULES.map(m => `<span class="g-pal" data-mod="${m.id}" data-tip="${Tip.attr(Tip.html(m.name, m.desc, m.hear))}"><svg class="ico"><use href="#i-${m.icon}"/></svg><span><b>${esc(m.name)}</b><i>${esc(m.hint)}</i></span></span>`).join('')}
      <span class="g-pal-hint">тяни плитку на дольку — обработает только тот слой; на кольцо вокруг центра — все слои вместе</span></div>`;
  }
  function blockHtml(set, comp, cfg) {
    const d = Fx.def(cfg.id);
    const tip = Tip.html((d?.name || cfg.id) + ' · ' + whereText(set, comp), 'Клик — ручки и живая картинка. Тяни — переставить на другую дольку, на кольцо или в пустоту, чтобы убрать.', null);
    return `<div class="g-block${cfg.on === false ? ' off' : ''}" data-comp="${esc(comp)}" data-uid="${esc(cfg.uid)}" data-tip="${Tip.attr(tip)}"><svg class="ico"><use href="#i-${d?.icon || 'grid'}"/></svg></div>`;
  }
  // блоки на дольках: снаружи круга, у середины дольки, несколько — веером вдоль дуги
  function placeBlocks() {
    const layer = G.el?.querySelector('.g-blocks'); if (!layer) return;
    const L = layersOf(G.set), s = (G.pie.getBoundingClientRect().width || SZ) / SZ;
    let html = ''; const pos = [];
    L.forEach((l, i) => {
      const list = G.set.wireFx?.[l.id] || []; if (!list.length) return;
      const { am } = wedgeGeom(G.set, i, L.length), [px, py] = pol(R + 24, am), tx = Math.cos(am * Math.PI / 180), ty = Math.sin(am * Math.PI / 180);
      list.forEach((cfg, j) => { const o = (j - (list.length - 1) / 2) * 34; pos.push([(SZ / 2 + px + tx * o) * s, (SZ / 2 + py + ty * o) * s]); html += blockHtml(G.set, l.id, cfg); });
    });
    layer.innerHTML = html;
    [...layer.children].forEach((b, i) => { b.style.left = pos[i][0] + 'px'; b.style.top = pos[i][1] + 'px'; bindBlock(b); });
  }
  function bindBlock(b) {
    const comp = b.dataset.comp, uid = b.dataset.uid;
    let down = null;
    b.onpointerdown = e => { if (e.button !== 0) return; down = { x: e.clientX, y: e.clientY }; };
    b.onpointermove = e => { if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) return; down = null; startDrag(e, { from: comp, uid }, b); };
    b.onpointerup = () => { if (!down) return; down = null; openPop(b, comp, uid); };
    b.onpointercancel = () => { down = null; };
  }
  function bindPalette() {
    for (const tile of G.el.querySelectorAll('.g-pal')) tile.onpointerdown = e => { if (e.button === 0) { e.preventDefault(); startDrag(e, { mod: tile.dataset.mod }, tile); } };
  }
  // общее перетаскивание: призрак с подписью «куда ляжет», подсветка цели, вставка на отпускание
  function startDrag(e, src, fromEl) {
    const def = Fx.def(src.mod || chainList(G.set, src.from).find(x => x.uid === src.uid)?.id);
    const ghost = document.createElement('div'); ghost.className = 'g-ghost'; ghost.innerHTML = `<svg class="ico"><use href="#i-${def?.icon || 'grid'}"/></svg><span></span>`;
    const gtxt = ghost.querySelector('span');
    Tip.hide(); document.body.appendChild(ghost);
    G.el.classList.add('dragging'); fromEl.classList.add('drag-src');
    let target = null, lit = null;
    const light = el => { if (lit) lit.classList.remove('target'); lit = el; if (lit) lit.classList.add('target'); };
    const move = ev => {
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      target = wedgeAt(ev.clientX, ev.clientY);
      light(target ? (target.comp === 'bus' ? G.el.querySelector('.g-ring') : G.el.querySelector(`.g-wedge[data-l="${CSS.escape(target.comp)}"]`)) : null);
      ghost.classList.toggle('ok', !!target); ghost.classList.toggle('rm', !target && !!src.uid);
      gtxt.textContent = target ? (def?.name || '') + ' → ' + whereText(G.set, target.comp) : src.uid ? 'убрать' : 'мимо';
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      ghost.remove(); G.el.classList.remove('dragging'); fromEl.classList.remove('drag-src'); light(null);
      let cfg = null;
      if (src.uid) { const from = chainList(G.set, src.from), i = from.findIndex(x => x.uid === src.uid); if (i >= 0) cfg = from.splice(i, 1)[0]; Fx.live(chainKey(G.set, src.from))?.update(from); }
      else cfg = Fx.make(src.mod);
      if (target && cfg) {
        const list = chainList(G.set, target.comp);
        if (target.comp === 'bus') { if (list.length >= SLOTS) { list.push(cfg); } else list.splice(Math.min(list.length, target.slot), 0, cfg); }
        else list.push(cfg);
        Fx.live(chainKey(G.set, target.comp))?.update(list);
      }
      if (typeof renderFx === 'function') renderFx(G.set);
      paintRing(); placeBlocks();
      if (target && cfg && !src.uid) { const b = target.comp === 'bus' ? G.el.querySelector(`.r-seg[data-uid="${CSS.escape(cfg.uid)}"]`) : G.el.querySelector(`.g-block[data-uid="${CSS.escape(cfg.uid)}"]`); if (b) openPop(b, target.comp, cfg.uid); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    move(e);
  }

  // ===================== пресеты круга =====================
  function bindPreset() {
    const btn = G.el.querySelector('.g-preset'); if (!btn) return;
    btn.onclick = e => { e.stopPropagation(); if (G.menu) closeMenu(); else openMenu(btn); };
  }
  function openMenu(btn) {
    closePop();
    const list = G.hooks.presets?.() || [];
    const m = document.createElement('div'); m.className = 'g-menu';
    m.innerHTML = `<div class="m-title">Пресеты круга</div>` + list.map(p => `<div class="m-item${p.active ? ' on' : ''}" data-id="${esc(p.id)}"><span>${esc(p.name)}</span>${p.user ? '<i class="m-x" data-del title="убрать">×</i>' : '<i class="m-b">встроенный</i>'}</div>`).join('')
      + `<div class="m-item m-add" data-add>+ сохранить текущее…</div>`;
    G.el.appendChild(m); G.menu = m;
    const r = btn.getBoundingClientRect(), er = G.el.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(r.right - er.left + G.el.scrollLeft - m.offsetWidth, G.el.clientWidth - m.offsetWidth - 8)) + 'px'; m.style.top = (r.bottom - er.top + G.el.scrollTop + 6) + 'px';
    m.onclick = ev => {
      const it = ev.target.closest('.m-item'); if (!it) return;
      if (it.dataset.add != null) { const name = prompt('Название пресета:', ''); if (name && name.trim()) G.hooks.onPresetSave?.(name.trim()); closeMenu(); return; }
      if (ev.target.dataset.del != null) { if (confirm('Убрать пресет «' + it.querySelector('span').textContent + '»?')) G.hooks.onPresetDelete?.(it.dataset.id); closeMenu(); return; }
      G.hooks.onPresetApply?.(it.dataset.id); closeMenu();
    };
    setTimeout(() => document.addEventListener('pointerdown', G.menuClose = ev => { if (!m.contains(ev.target) && !btn.contains(ev.target)) closeMenu(); }, true), 0);
  }
  function closeMenu() { if (G.menu) { G.menu.remove(); G.menu = null; } if (G.menuClose) { document.removeEventListener('pointerdown', G.menuClose, true); G.menuClose = null; } }
  // обновить круг, подпись и дуги без полной перерисовки (выбор обуви/поверхности, громкости слева)
  function refresh() {
    if (!G.el?.isConnected) return;
    paintWedges(); placeBlocks();
    const cap = G.el.querySelector('.g-cap'); if (cap) cap.textContent = G.set.name + ' · ' + subtitle(G.set);
    for (const box of G.el.querySelectorAll('.g-pick')) box._sync?.();
  }

  // ===================== всплывашки =====================
  function placePop(pop, anchor) {
    G.el.appendChild(pop);
    const er = G.el.getBoundingClientRect(), b = anchor.getBoundingClientRect();
    let x = b.left - er.left + G.el.scrollLeft + b.width / 2 - pop.offsetWidth / 2, y = b.bottom - er.top + G.el.scrollTop + 10;
    x = Math.max(8, Math.min(x, G.el.clientWidth - pop.offsetWidth - 8));
    if (y + pop.offsetHeight > G.el.scrollTop + G.el.clientHeight - 8) y = b.top - er.top + G.el.scrollTop - pop.offsetHeight - 10;
    pop.style.left = x + 'px'; pop.style.top = Math.max(8, y) + 'px';
    G.pop = pop;
    setTimeout(() => { document.addEventListener('pointerdown', G.popClose = ev => { if (!pop.contains(ev.target) && !anchor.contains(ev.target)) closePop(); }, true); }, 0);
  }
  // модуль: где стоит, ручки и живая картинка (карточка из app.js)
  function openPop(anchor, comp, uid) {
    closePop();
    const list = chainList(G.set, comp), cfg = list.find(x => x.uid === uid); if (!cfg) return;
    const pop = document.createElement('div'); pop.className = 'g-pop';
    const el = fxModuleEl(G.set, list, cfg, chainKey(G.set, comp), why => {
      if (comp === 'bus') { paintRing(); if (typeof renderFx === 'function') renderFx(G.set); } else { const b = G.el.querySelector(`.g-block[data-uid="${CSS.escape(uid)}"]`); if (b) b.classList.toggle('off', cfg.on === false); }
      if (why === 'removed') { closePop(); paintRing(); placeBlocks(); }
    });
    if (!el) return;
    const where = document.createElement('div'); where.className = 'g-pop-where';
    where.innerHTML = comp === 'bus' ? '<b>на всём наборе</b> — все слои вместе, перед дистанцией' : `<b>${esc(whereText(G.set, comp))}</b> — остальные слои не трогает`;
    pop.append(where, el);
    placePop(pop, anchor);
  }
  // слой: полосы удара / огибающие вжуха / файл петли
  function openLayerPop(l, anchor) {
    closePop();
    const set = G.set, pop = document.createElement('div'); pop.className = 'g-pop g-lpop';
    pop.innerHTML = `<div class="g-pop-head"><svg class="ico"><use href="#i-${ICON[l.id] || 'layers'}"/></svg><b>${esc(l.name)}</b><i>${esc(summary(set, l))}</i></div><div class="g-detail"></div>`;
    const box = pop.querySelector('.g-detail'), sync = () => { pop.querySelector('.g-pop-head i').textContent = summary(set, l); };
    if (set.kind === 'steps') Steps.renderBands(box, l, sync);
    else if (set.kind === 'whoosh') { Whoosh.renderLayerControls(box, set, l, { onSelect: () => { G.hooks.onSelect?.(); sync(); } }, () => openLayerPop(l, anchor)); box.classList.add('wl'); }
    else {
      box.innerHTML = `<div class="wl-row"><span class="lbl">файл</span><span class="val" style="grid-column: 2 / span 2; text-align:left">${esc((l.file || l.blob?.name || '').split('/').pop() || 'не назначен')}</span></div>`;
    }
    placePop(pop, anchor);
  }
  function closePop() { if (G.pop) { G.pop.remove(); G.pop = null; Tip.hide(); } if (G.popClose) { document.removeEventListener('pointerdown', G.popClose, true); G.popClose = null; } }

  return { render, hit, wires: layout, placeVideo, paintChain: paintRing, repaint: refresh, refresh };
})();

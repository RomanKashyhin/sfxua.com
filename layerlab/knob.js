// LayerLab · крутилка поверх обычного <input type="range">.
// Сам input остаётся в DOM (скрытый), все обработчики (oninput, ondblclick) продолжают работать:
// крутилка меняет input.value и шлёт событие input; если код меняет input.value сам — крутилка это видит
// через переопределённый сеттер. Тянуть вверх/вниз, колесо — по шагу, Shift — в 10 раз точнее,
// двойной клик — сброс (отдаётся обработчику dblclick самого input).

const Knob = (() => {
  const A0 = -135, A1 = 135;                                            // градусы дуги
  const rad = a => (a - 90) * Math.PI / 180;
  const arc = (r, a0, a1) => {
    const x0 = 32 + r * Math.cos(rad(a0)), y0 = 32 + r * Math.sin(rad(a0)), x1 = 32 + r * Math.cos(rad(a1)), y1 = 32 + r * Math.sin(rad(a1));
    return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function fromRange(input, opts = {}) {
    if (input._knob) return input._knob;
    const mini = opts.mini ?? input.classList.contains('thin');
    const wrap = document.createElement('div');
    wrap.className = 'knob' + (mini ? ' mini' : '') + (opts.cls ? ' ' + opts.cls : '');
    const ticks = Array.from({ length: 11 }, (_, i) => { const a = rad(A0 + (A1 - A0) * i / 10), r0 = i % 5 === 0 ? 29.5 : 30.5, r1 = 32; return `<line class="k-tick" x1="${(32 + r0 * Math.cos(a)).toFixed(1)}" y1="${(32 + r0 * Math.sin(a)).toFixed(1)}" x2="${(32 + r1 * Math.cos(a)).toFixed(1)}" y2="${(32 + r1 * Math.sin(a)).toFixed(1)}"/>`; }).join('');
    wrap.innerHTML = `<svg viewBox="0 0 64 64">
        ${ticks}
        <path class="k-track" d="${arc(26, A0, A1)}"/>
        <path class="k-arc" d=""/>
        <circle class="k-body" cx="32" cy="32" r="19"/>
        <circle class="k-rim" cx="32" cy="32" r="16.5"/>
        <g class="k-rot"><ellipse class="k-hl" cx="32" cy="22" rx="8" ry="3.5"/><line class="k-ptr" x1="32" y1="30" x2="32" y2="16"/><circle class="k-dot" cx="32" cy="17" r="1.6"/></g>
      </svg>${opts.win ? '<div class="k-win"></div>' : ''}`;
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.classList.add('k-src');
    const win = wrap.querySelector('.k-win'), arcEl = wrap.querySelector('.k-arc'), ptr = wrap.querySelector('.k-rot');
    // подпись значения рядом с крутилкой (чип .val или <i> в ячейке) — её показываем крупно во время вращения
    const labelText = () => { const p = wrap.parentElement; const el = p && (p.querySelector(':scope > .val, :scope > i') || p.closest('.macro')?.querySelector('.val')); return el ? el.textContent : String(input.value); };
    let float = null;
    const showFloat = () => { if (!float) { float = document.createElement('div'); float.className = 'k-float'; document.body.appendChild(float); } const r = wrap.getBoundingClientRect(); float.style.left = (r.left + r.width / 2) + 'px'; float.style.top = (r.top - 8) + 'px'; float.style.setProperty('--kc', getComputedStyle(wrap).getPropertyValue('--kc')); setTimeout(() => { if (float) float.textContent = labelText(); }, 0); };
    const hideFloat = () => { if (float) { float.remove(); float = null; } };
    const min = () => +input.min || 0, max = () => +input.max || 100, step = () => +input.step || 1;
    const fmt = opts.fmt || (v => v);
    const update = () => {
      const v = +input.value, t = (v - min()) / (max() - min() || 1), a = A0 + (A1 - A0) * t;
      const zero = opts.bipolar ?? (min() < 0 && max() > 0);
      const aZero = zero ? A0 + (A1 - A0) * (-min() / (max() - min())) : A0;
      arcEl.setAttribute('d', Math.abs(a - aZero) < 0.5 ? '' : arc(26, Math.min(a, aZero), Math.max(a, aZero)));
      ptr.setAttribute('transform', `rotate(${a} 32 32)`);
      if (win) win.textContent = fmt(v);
    };
    Object.defineProperty(input, 'value', { get() { return proto.get.call(input); }, set(v) { proto.set.call(input, v); update(); }, configurable: true });
    const setVal = v => { const s = step(); v = Math.round(v / s) * s; v = Math.max(min(), Math.min(max(), v)); if (+input.value === v) return; input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); };
    let drag = null;
    wrap.onpointerdown = e => { if (e.button !== 0) return; drag = { y: e.clientY, v: +input.value }; wrap.setPointerCapture(e.pointerId); wrap.classList.add('drag'); showFloat(); e.preventDefault(); };
    wrap.onpointermove = e => { if (!drag) return; const range = max() - min(); const k = (e.shiftKey ? 0.1 : 1) * range / 300; setVal(drag.v + (drag.y - e.clientY) * k); showFloat(); };   // весь диапазон за 300 px
    wrap.onpointerup = wrap.onpointercancel = () => { drag = null; wrap.classList.remove('drag'); hideFloat(); };
    let wheelT = 0;
    wrap.onwheel = e => { e.preventDefault(); const range = max() - min(); setVal(+input.value - Math.sign(e.deltaY) * Math.max(step(), range / (e.shiftKey ? 500 : 100))); showFloat(); clearTimeout(wheelT); wheelT = setTimeout(hideFloat, 700); };
    wrap.ondblclick = e => { e.preventDefault(); input.dispatchEvent(new MouseEvent('dblclick', { bubbles: false })); update(); };
    input.addEventListener('input', update);
    update();
    // подпись-цифру рядом тоже можно тянуть вверх/вниз
    const lbl = (() => { const p = wrap.parentElement; return p && (p.querySelector(':scope > .val, :scope > i') || p.closest('.macro')?.querySelector('.val')); })();
    if (lbl && !lbl._dragNum) dragNumber(lbl, { get: () => +input.value, set: v => setVal(v), range: () => max() - min(), onStart: showFloat, onMove: showFloat, onEnd: hideFloat, cls: () => wrap.classList.toggle('drag') });
    input._knob = { wrap, update };
    return input._knob;
  }
  // Любая цифра как ручка: зажал, тянешь вверх — растёт, вниз — падает; колесо — по шагу.
  function dragNumber(el, o) {
    el._dragNum = true; el.classList.add('dragnum');
    let d = null;
    el.onpointerdown = e => { if (e.button !== 0) return; d = { y: e.clientY, v: o.get() }; el.setPointerCapture(e.pointerId); el.classList.add('drag'); o.onStart?.(); e.preventDefault(); };
    el.onpointermove = e => { if (!d) return; o.set(d.v + (d.y - e.clientY) * (e.shiftKey ? 0.1 : 1) * (typeof o.range === 'function' ? o.range() : o.range) / 300); o.onMove?.(); };
    el.onpointerup = el.onpointercancel = () => { if (!d) return; d = null; el.classList.remove('drag'); o.onEnd?.(); };
    el.onwheel = e => { e.preventDefault(); const r = typeof o.range === 'function' ? o.range() : o.range; o.set(o.get() - Math.sign(e.deltaY) * Math.max(o.step || 1, r / 100)); o.onMove?.(); clearTimeout(el._t); el._t = setTimeout(() => o.onEnd?.(), 600); };
    el.ondblclick = e => { e.preventDefault(); o.onReset?.(); };
  }
  // все ползунки внутри root → крутилки (кроме тех, что помечены data-fader и скраббера)
  function convert(root, opts = {}) {
    for (const r of root.querySelectorAll('input[type=range]')) {
      if (r._knob || r.dataset.fader != null || r.classList.contains('scrubber')) continue;
      fromRange(r, opts);
    }
  }
  return { fromRange, convert, dragNumber };
})();

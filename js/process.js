// "How we work": one route through the six stations, from the brief to the handover.
// The line is laid through the station markers of whatever layout the page has (two rows that turn
// at the right on a desktop, a snake over two columns on a tablet, straight down on a phone). As the
// visitor scrolls, the coloured part of the line follows the reading position, a small "sound
// package" travels along it and each station lights up when the line reaches it. Everything is
// readable without this: the cards never hide, and with reduced motion the line is simply drawn in
// full and every station lit. Nothing here runs on a timer; it only follows the scroll position.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function initProcessRoute(root, { reduce }) {
  const svg = root.querySelector('.route__svg');
  const track = root.querySelector('.route__track');
  const done = root.querySelector('.route__done');
  const token = root.querySelector('.route__token');
  const grad = svg.querySelector('linearGradient');
  const steps = [...root.querySelectorAll('[data-step]')];
  if (!svg || !steps.length) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const probe = document.createElementNS(NS, 'path');
  probe.setAttribute('visibility', 'hidden');
  svg.appendChild(probe);

  let total = 0, at = [], firstY = 0, lastY = 0, visible = false, raf = 0, lenNow = -1;

  // the path through the stations: straight along a row, a rounded U-turn beside the cards where the
  // route changes rows, straight down when all stations share one column
  function layout() {
    const box = root.getBoundingClientRect();
    if (!box.width) return;
    const pts = steps.map((s) => {
      const r = s.querySelector('.step__num').getBoundingClientRect();
      const c = s.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, l: c.left - box.left, r: c.right - box.left };
    });
    const column = pts.every((p) => Math.abs(p.x - pts[0].x) < 4);
    const parts = [];
    if (column) {
      parts.push(`M${pts[0].x} ${pts[0].y - 34}`);
      pts.forEach((p) => parts.push(`L${p.x} ${p.y}`));
      const q = pts[pts.length - 1];
      parts.push(`L${q.x} ${q.y + 46}`);
    } else {
      const a0 = pts[0];
      parts.push(`M${a0.l + 8} ${a0.y}L${a0.x} ${a0.y}`);
      const pad = Math.max(18, (box.width - (pts.reduce((m, p) => Math.max(m, p.r), 0) - pts.reduce((m, p) => Math.min(m, p.l), 1e9))) / 2 - 6);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (Math.abs(a.y - b.y) < 4) { parts.push(`L${b.x} ${b.y}`); continue; }
        const side = a.x > box.width / 2 ? 1 : -1;
        const xe = side > 0 ? a.r + pad : a.l - pad;
        const r = Math.min(40, Math.abs(b.y - a.y) / 2);
        parts.push(`L${xe - side * r} ${a.y}Q${xe} ${a.y} ${xe} ${a.y + r}L${xe} ${b.y - r}Q${xe} ${b.y} ${xe - side * r} ${b.y}L${b.x} ${b.y}`);
      }
      const p = pts[pts.length - 1], q = pts[pts.length - 2];
      const dir = Math.abs(p.y - q.y) < 4 ? Math.sign(p.x - q.x) : (p.x > box.width / 2 ? 1 : -1);
      parts.push(`L${dir > 0 ? p.r - 8 : p.l + 8} ${p.y}`);
    }
    const d = parts.join('');
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    track.setAttribute('d', d); done.setAttribute('d', d);
    total = track.getTotalLength();
    // how far along the route each station is
    at = pts.map((_, i) => { probe.setAttribute('d', parts.slice(0, i + (column ? 2 : 1)).join('')); return probe.getTotalLength(); });
    firstY = pts[0].y; lastY = pts[pts.length - 1].y;
    grad?.setAttribute('x2', column ? 0 : box.width); grad?.setAttribute('y2', column ? box.height : 0);
    done.style.strokeDasharray = `${total} ${total}`;
    lenNow = -1;
    update();
  }

  // the reading position: the line starts as the first row comes up from below and is complete when
  // the last row has reached the upper part of the screen
  function update() {
    raf = 0;
    if (!total) return;
    let len = total;
    if (!reduce.matches) {
      const top = root.getBoundingClientRect().top, vh = innerHeight;
      const start = vh * 0.8 - (top + firstY), span = Math.max(1, lastY - firstY + vh * 0.35);
      len = clamp(start / span) * total;
    }
    if (Math.abs(len - lenNow) < 0.5) return;
    lenNow = len;
    done.style.strokeDashoffset = `${total - len}`;
    const p = track.getPointAtLength(Math.max(0, Math.min(total, len)));
    token.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    steps.forEach((s, i) => s.classList.toggle('is-lit', len >= at[i] - 2));
  }
  const onScroll = () => { if (visible && !raf) raf = requestAnimationFrame(update); };

  root.classList.add('is-live');
  addEventListener('scroll', onScroll, { passive: true });
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) onScroll(); }, { rootMargin: '200px 0px' });
  io.observe(root);
  new ResizeObserver(() => layout()).observe(root);
  root.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', layout, { once: true }); });
  reduce.addEventListener?.('change', () => { lenNow = -1; update(); });
  layout();

  return {
    /** for checks: how much of the route is drawn (0..1) and which stations are lit */
    state: () => ({ drawn: total ? +(lenNow / total).toFixed(3) : 0, lit: steps.map((s) => s.classList.contains('is-lit')), total }),
  };
}

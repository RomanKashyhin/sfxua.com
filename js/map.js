// "How we work" as one map (round M, 22.10.2026): four stages always on screen, joined by a thin route
// with a direction. Hovering, focusing or choosing a stage lights the route up to it (a short pulse runs
// along it); nothing is hidden and nothing has to be done in order. Playing the boot, the keys or the
// Game Boy makes their node answer. A bigger instrument opens over the page and comes back to the map.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

// the sound categories (not a catalogue: what the audio of a game can cover), for the contact form
export const CATS = [
  { id: 'ambient', name: 'Environment' },
  { id: 'movement', name: 'Movement' },
  { id: 'surfaces', name: 'Surfaces' },
  { id: 'combat', name: 'Combat' },
  { id: 'ui', name: 'Interface' },
  { id: 'music', name: 'Music' },
];

export function initMap({ reduce } = {}) {
  const root = $('[data-map]');
  if (!root) return null;
  const route = $('[data-route]', root);
  const stages = $$('[data-map-stage]', root);
  const nodes = stages.map((s) => $('.stage__node', s));
  let chosen = 0, preview = 0;
  let home = null, card = null;     // the card opened bigger and the placeholder where it lives in the map

  /* ---- the route: from block to block, drawn from where the stages really are ---- */
  let segs = [];
  const draw = () => {
    route.replaceChildren();
    const box = root.getBoundingClientRect();
    route.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    // round T: the stages are blocks; an arrow joins each block to the next across the gap between them
    const rects = stages.map((st) => {
      const r = st.getBoundingClientRect();
      return { l: r.left - box.left, t: r.top - box.top, r: r.right - box.left, b: r.bottom - box.top };
    });
    const defs = svg('defs', {}, route);
    const mk = svg('marker', { id: 'route-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, defs);
    svg('path', { d: 'M1 1L9 5L1 9z', class: 'route__arrow' }, mk);
    segs = [];
    for (let i = 0; i < rects.length - 1; i++) {
      const a = rects[i], c = rects[i + 1];
      let d;
      if (Math.abs(c.t - a.t) < 4) {
        const y = a.t + 27;                                        // side by side: across the gap, level with the titles
        d = `M${a.r + 4} ${y}H${c.l - 4}`;
      } else if (Math.abs(c.l - a.l) < 4) {
        const x = (a.l + a.r) / 2;                                 // one under the other (phones): down the gap
        d = `M${x} ${a.b + 4}V${c.t - 4}`;
      } else {
        // to the next row: from under this block, along the gap between the rows, into the top of the next one
        const x0 = (a.l + a.r) / 2, x1 = (c.l + c.r) / 2, lane = (a.b + c.t) / 2;
        d = `M${x0} ${a.b + 4}V${lane}H${x1}V${c.t - 4}`;
      }
      const g = svg('g', { class: 'route__seg', 'data-seg': i + 1 }, route);
      svg('path', { d, class: 'route__base', 'marker-end': 'url(#route-arrow)' }, g);
      const lit = svg('path', { d, class: 'route__lit' }, g);
      const pulse = svg('path', { d, class: 'route__pulse' }, g);
      const len = lit.getTotalLength();
      lit.style.setProperty('--len', `${len}px`);
      pulse.style.setProperty('--len', `${len}px`);
      segs.push(g);
    }
    paint();
  };

  /* ---- lighting: up to the stage under the pointer or focus, else up to the chosen one ---- */
  const paint = () => {
    const upTo = preview || chosen;
    root.dataset.lit = String(upTo);
    stages.forEach((s, i) => {
      s.classList.toggle('is-lit', i < upTo);
      s.classList.toggle('is-here', i + 1 === upTo);
    });
    nodes.forEach((n, i) => n.setAttribute('aria-pressed', String(chosen === i + 1)));
    segs.forEach((g, i) => g.classList.toggle('is-lit', i + 1 < upTo));
  };
  const runPulse = (upTo) => {
    if (reduce?.matches || upTo < 2) return;
    segs.slice(0, upTo - 1).forEach((g, i) => {
      g.classList.remove('is-pulsing');
      void g.getBoundingClientRect();
      g.style.setProperty('--delay', `${i * 0.28}s`);
      g.classList.add('is-pulsing');
    });
  };
  const show = (n) => { if (preview === n) return; preview = n; paint(); if (n) runPulse(n); };

  stages.forEach((s, i) => {
    s.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') show(i + 1); });
    s.addEventListener('pointerleave', () => show(0));
    s.addEventListener('focusin', () => show(i + 1));
    s.addEventListener('focusout', (e) => { if (!s.contains(e.relatedTarget)) show(0); });
  });
  nodes.forEach((n, i) => {
    n.addEventListener('click', () => { chosen = chosen === i + 1 ? 0 : i + 1; paint(); runPulse(chosen); });
    n.addEventListener('keydown', (e) => {
      const k = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: nodes.length - 1 }[e.key];
      if (k == null) return;
      e.preventDefault();
      nodes[(k + nodes.length) % nodes.length].focus();
    });
  });

  /* ---- a node answers when its instrument is played ---- */
  const ping = (node) => {
    if (!node) return;
    node.classList.remove('is-ping');
    void node.offsetWidth;
    node.classList.add('is-ping');
  };
  // listened on the document: a card opened bigger (below) sits outside the map for a while
  document.addEventListener('sfx:played', (e) => {
    const place = home && card?.contains(e.target) ? home.parentNode : e.target;
    if (!root.contains(place)) return;
    const bay = place.closest('[data-bay]');
    ping(bay ? $(`[data-bay-dot="${bay.dataset.bay}"]`, root) : null);
    ping(place.closest('[data-map-stage]')?.querySelector('.stage__dot'));
    phoneReact(e.detail?.kind);
  });

  /* ---- the game in the phone hears what is played (stage 01: the game the team works on) ---- */
  const phone = $('[data-phone-life]', root);
  const phoneReact = (kind) => {
    if (!phone || !kind) return;
    const mark = $(`[data-mark="${kind}"]`, phone);
    if (!mark) return;
    mark.classList.remove('is-on');
    void mark.getBoundingClientRect();
    mark.classList.add('is-on');
    root.classList.add('has-sound');
  };

  /* ---- a bigger instrument over the page; the same element moves, so nothing runs twice ---- */
  const dialog = $('[data-zoom]');
  const body = dialog && $('[data-zoom-body]', dialog);
  let opener = null;
  $$('[data-zoom-open]', root).forEach((b) => b.addEventListener('click', () => {
    card = $(`#${b.dataset.zoomOpen}`);
    if (!card || !dialog) return;
    opener = b;
    home = document.createComment('map-card');
    card.before(home);
    $('[data-zoom-title]', dialog).textContent = b.dataset.zoomLabel || '';
    body.appendChild(card);
    dialog.showModal();
    card.focus?.({ preventScroll: true });
  }));
  dialog?.addEventListener('close', () => {
    if (home && card) { home.replaceWith(card); }
    home = card = null;
    document.dispatchEvent(new CustomEvent('soundfx:stop-audio'));
    requestAnimationFrame(draw);
    opener?.focus({ preventScroll: true });
  });
  $('[data-zoom-close]', dialog)?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  new ResizeObserver(() => draw()).observe(root);
  document.fonts?.ready.then(draw);
  draw();
  if (reduce?.matches) root.classList.add('is-still');
  return { get chosen() { return chosen; }, choose(n) { chosen = n; paint(); }, draw };
}

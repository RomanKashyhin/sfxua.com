// "How we work" (#process): one compact, interactive route in four steps over one game scene.
//   01 Analysis & agreement   - the forest gets its first touch of colour: the sound direction is set
//   02 Assembly & adaptation  - the boot and the piano; the sound categories next to the scene can be
//                               picked: a picked one lights up, a line joins it to its spot in the scene
//                               and that part of the world comes alive (birds and wind, steps, the
//                               ground answering, a hit, the HUD, notes). After a pick, step 03 is lit.
//   03 Integration & testing  - the Game Boy; every category joins the game, the world is lively
//   04 Delivery & support     - the gift; the finished sound world
// The steps are tabs (arrow keys, Home, End); every step has its own short text, so nothing is hidden
// behind the sequence. Switching a step never plays a sound; a picked category gives a short blip only
// when the visitor's sound is already on. Reduced motion: the same states, no movement.
// Texts are English; js/i18n.js translates them as they appear.
import { music, sound } from './music/sound.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const svg = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the sound categories the studio presents (symbols from ComfyUI, _dev/design/comfyui/jobs-system.json);
// spot: where each one lives in the forest scene (scene units 1600 x 914, assets/system/scene-forest.webp)
export const CATS = [
  { id: 'ambient', name: 'Environment', color: 'var(--mint)', symbol: 'assets/system/mod-ambient.webp', spot: [419, 300] },
  { id: 'movement', name: 'Movement', color: 'var(--sky)', symbol: 'assets/system/mod-movement.webp', spot: [735, 836] },
  { id: 'surfaces', name: 'Surfaces', color: 'var(--zest)', symbol: 'assets/system/mod-surfaces.webp', spot: [1330, 812] },
  { id: 'combat', name: 'Combat', color: 'var(--jam)', symbol: 'assets/system/mod-combat.webp', spot: [600, 770] },
  { id: 'ui', name: 'Interface', color: 'var(--jam)', symbol: 'assets/system/mod-ui.webp', spot: [205, 86] },
  { id: 'music', name: 'Music', color: 'var(--sky)', symbol: 'assets/system/mod-music.webp', spot: [745, 560] },
];

/* ---- the life of each category, drawn as flat shapes over the forest ---- */
function drawLife(g, id) {
  const ring = (x, y, color, delay = 0) => {
    for (let k = 0; k < 2; k++) svg('circle', { cx: x, cy: y, r: 30, class: 'life-ring', stroke: color, style: `animation-delay:${delay + k * 0.9}s` }, g);
  };
  if (id === 'ambient') {
    for (const [dy, dur, delay] of [[0, 16, 0], [46, 19, 5]]) {
      const b = svg('g', { class: 'life-fly', style: `--dur:${dur}s; animation-delay:-${delay}s` }, g);
      svg('path', { d: `M0 ${190 + dy} q14 -14 28 0 q14 -14 28 0`, class: 'life-bird' }, b);
    }
    for (const [y, delay] of [[280, 0], [340, 1.6], [230, 3.1]]) svg('path', { d: `M120 ${y} q160 -40 320 0 t320 0`, class: 'life-wind', style: `animation-delay:${delay}s` }, g);
    ring(419, 300, 'var(--mint)');
  } else if (id === 'movement') {
    for (let k = 0; k < 7; k++) {
      const x = 470 + (530 * k) / 6, y = 836 + (k % 2 ? 14 : -14);
      svg('ellipse', { cx: x, cy: y, rx: 18, ry: 9, class: 'life-step', style: `animation-delay:${(k * 0.32).toFixed(2)}s` }, g);
    }
  } else if (id === 'surfaces') {
    // the ground answers: sand, the wooden bridge, the water, the grass, each in its own colour
    for (const [x, y, c, d] of [[540, 860, 'var(--zest)', 0], [1440, 752, '#c98a4b', 0.5], [1330, 850, 'var(--sky)', 1], [130, 830, 'var(--mint)', 1.5]]) {
      ring(x, y, c, d);
      for (let k = -1; k <= 1; k++) svg('path', { d: `M${x + k * 22} ${y - 40} l${k * 6} -16`, class: 'life-tap', stroke: c, style: `animation-delay:${d}s` }, g);
    }
  } else if (id === 'combat') {
    const [x, y] = [600, 770];
    const star = svg('g', { class: 'life-hit', style: `transform-origin:${x}px ${y}px` }, g);
    const pts = [];
    for (let k = 0; k < 16; k++) { const r = k % 2 ? 22 : 54, a = (k / 16) * Math.PI * 2; pts.push(`${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`); }
    svg('polygon', { points: pts.join(' '), class: 'life-star' }, star);
    ring(x, y, 'var(--zest)', 0.2);
  } else if (id === 'ui') {
    const hud = svg('g', { class: 'life-hud' }, g);
    for (let k = 0; k < 3; k++) {
      const x = 70 + k * 64, y = 70;
      svg('path', { d: `M${x} ${y + 8}c-8-12-26-6-22 8c3 10 22 22 22 22s19-12 22-22c4-14-14-20-22-8z`, class: 'life-heart', style: `animation-delay:${k * 0.12}s` }, hud);
    }
    svg('rect', { x: 1340, y: 46, width: 200, height: 56, rx: 28, class: 'life-pill' }, hud);
    svg('circle', { cx: 1374, cy: 74, r: 18, class: 'life-coin' }, hud);
    for (let k = 0; k < 3; k++) svg('rect', { x: 1404 + k * 38, y: 66, width: 26, height: 16, rx: 6, class: 'life-bar' }, hud);
  } else if (id === 'music') {
    for (let k = 0; k < 3; k++) {
      const n = svg('g', { class: 'life-note', style: `animation-delay:${k * 0.9}s` }, g);
      const nx = 745 + k * 46 - 46, y = 560;
      svg('ellipse', { cx: nx, cy: y, rx: 15, ry: 11, transform: `rotate(-20 ${nx} ${y})`, class: 'life-notehead' }, n);
      svg('path', { d: `M${nx + 13} ${y - 3}V${y - 64}l24 10`, class: 'life-stem' }, n);
    }
  }
}

// step 01: the direction of the sound world (a pin on the clearing); step 04: the finished world
function drawMarks(life) {
  const plan = svg('g', { class: 'mark-plan' }, life);
  svg('circle', { cx: 800, cy: 640, r: 120, class: 'mark-plan__ring' }, plan);
  svg('path', { d: 'M800 470c-34 0-60 26-60 58 0 44 60 104 60 104s60-60 60-104c0-32-26-58-60-58z', class: 'mark-plan__pin' }, plan);
  svg('circle', { cx: 800, cy: 528, r: 20, class: 'mark-plan__dot' }, plan);
  const done = svg('g', { class: 'mark-done' }, life);
  for (const [x, y, d] of [[300, 160, 0], [1050, 230, 0.6], [1460, 520, 1.2], [620, 420, 1.8]]) {
    svg('path', { d: `M${x} ${y - 26}l9 17 17 9 -17 9 -9 17 -9 -17 -17 -9 17 -9z`, class: 'life-spark', style: `animation-delay:${d}s` }, done);
  }
}

export function initJourney({ reduce, onPick } = {}) {
  const root = $('[data-journey]');
  if (!root) return null;
  const tabs = $$('[role=tab]', root), panels = $$('[role=tabpanel]', root);
  const catsList = $('[data-cats]', root), life = $('[data-life]', root), links = $('[data-links]', root);
  const sceneBox = $('[data-scene-box]', root), world = $('[data-world]', root), status = $('[data-status]', root);
  let step = 1, awake = false;
  const picked = new Set();

  catsList.innerHTML = CATS.map((c) => `
    <li><button class="cat" type="button" data-cat="${c.id}" aria-pressed="false" style="--c:${c.color}">
      <span class="cat__face"><img src="${esc(c.symbol)}" alt="" width="512" height="512" loading="lazy" decoding="async"></span>
      <span class="cat__name">${esc(c.name)}</span>
    </button></li>`).join('');
  const catButtons = $$('.cat', catsList);
  const groups = {};
  for (const c of CATS) { groups[c.id] = svg('g', { class: 'life', 'data-life-of': c.id }, life); drawLife(groups[c.id], c.id); }
  drawMarks(life);

  // what the scene shows: step 01 a first accent, 02 the visitor's picks, 03 and 04 everything
  const shown = () => (step <= 1 ? new Set() : step === 2 ? picked : new Set(CATS.map((c) => c.id)));
  const lifeLevel = () => (!awake ? 0 : step === 1 ? 0.3 : step === 2 ? 0.4 + 0.1 * picked.size : step === 3 ? 0.9 : 1);

  const drawLinks = () => {
    links.replaceChildren();
    if (getComputedStyle(links).display === 'none') return;
    const box = world.getBoundingClientRect(), sc = sceneBox.getBoundingClientRect();
    links.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const on = shown();
    for (const c of CATS) {
      if (!on.has(c.id)) continue;
      const b = $(`[data-cat=${c.id}]`, catsList).getBoundingClientRect();
      const x0 = b.right - box.left, y0 = b.top + b.height / 2 - box.top;
      const x1 = sc.left - box.left + (c.spot[0] / 1600) * sc.width, y1 = sc.top - box.top + (c.spot[1] / 914) * sc.height;
      const mx = x0 + (x1 - x0) * 0.45;
      const p = svg('path', { d: `M${x0} ${y0}C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`, class: `link${step >= 3 ? ' is-live' : ''}` }, links);
      p.style.setProperty('--c', c.color);
      svg('circle', { cx: x1, cy: y1, r: 7, class: 'link__end' }, links).style.setProperty('--c', c.color);
    }
  };

  const STATUS = {
    1: 'The direction of the sound world is set.',
    2: 'Pick a sound category to bring the scene to life.',
    3: 'Connected to the game and checked in context.',
    4: 'Your game’s sound world is ready.',
  };
  const paint = () => {
    root.dataset.step = String(step);
    tabs.forEach((t) => {
      const on = +t.dataset.step === step;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('is-done', +t.dataset.step < step);
      t.classList.toggle('is-next', step === 2 && picked.size > 0 && t.dataset.step === '3');
    });
    panels.forEach((p) => {
      const on = +p.dataset.panel === step;
      p.classList.toggle('is-active', on);
      p.toggleAttribute('inert', !on);
    });
    $('[data-panel="2"] .journey__next', root)?.classList.toggle('is-ready', picked.size > 0);
    const on = shown();
    for (const c of CATS) groups[c.id].classList.toggle('is-on', on.has(c.id));
    catButtons.forEach((b) => {
      b.setAttribute('aria-pressed', String(picked.has(b.dataset.cat)));
      b.classList.toggle('is-shown', on.has(b.dataset.cat));
    });
    sceneBox.style.setProperty('--life', lifeLevel().toFixed(2));
    status.textContent = step === 2 && picked.size ? `${picked.size} of ${CATS.length} sound categories in the scene.` : STATUS[step];
    drawLinks();
  };

  const go = (n, { focus = false } = {}) => {
    step = Math.max(1, Math.min(4, n));
    paint();
    if (focus) tabs[step - 1].focus();
  };
  tabs.forEach((t) => t.addEventListener('click', () => go(+t.dataset.step)));
  $('.journey__steps', root).addEventListener('keydown', (e) => {
    const k = { ArrowRight: step + 1, ArrowDown: step + 1, ArrowLeft: step - 1, ArrowUp: step - 1, Home: 1, End: 4 }[e.key];
    if (k == null) return;
    e.preventDefault();
    go(k < 1 ? 4 : k > 4 ? 1 : k, { focus: true });
  });
  $$('[data-go]', root).forEach((b) => b.addEventListener('click', () => {
    go(+b.dataset.go);
    const tab = tabs[step - 1];
    if (tab.getBoundingClientRect().top < 70) tab.scrollIntoView({ block: 'start', behavior: reduce?.matches ? 'auto' : 'smooth' });
    tab.focus({ preventScroll: true });
  }));

  const blip = (on, i) => {
    if (!sound.live) return;           // a category never switches sound on by itself
    const t = music.now();
    if (on) [0, 2].forEach((d, k) => music.marimba(t + k * 0.07, music.degree(i + d, 5), 0.35));
    else music.marimba(t, music.degree(i, 4), 0.25);
  };
  catsList.addEventListener('click', (e) => {
    const b = e.target.closest('.cat');
    if (!b) return;
    const id = b.dataset.cat;
    if (step !== 2) { step = 2; picked.add(id); }      // a pick belongs to step 02: show it there
    else if (picked.has(id)) picked.delete(id); else picked.add(id);
    blip(picked.has(id), CATS.findIndex((c) => c.id === id));
    paint();
    onPick?.([...picked]);
  });

  // the forest wakes into its first accent when the section comes into view
  if (reduce?.matches) { root.classList.add('is-still'); awake = true; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((x) => x.isIntersecting)) { awake = true; io.disconnect(); paint(); }
  }, { threshold: 0.25 });
  io.observe(sceneBox);
  new ResizeObserver(() => drawLinks()).observe(root);
  $$('.cat img', catsList).forEach((i) => i.addEventListener('load', drawLinks, { once: true }));
  paint();

  return {
    get step() { return step; },
    get picked() { return [...picked]; },
    go,
    redraw: drawLinks,
  };
}

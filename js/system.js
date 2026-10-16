// The builder (#system): pick the game's activities and watch the audio system assemble.
//   - Every module is a tile (a real toggle button). A connected tile lights up, its cable to the core
//     glows, and the game scene above gets that module's life: birds and wind, footprints, a hit,
//     the HUD, a glowing chest, notes. With nothing connected the world is grey and still.
//   - The panel explains the focused module in four parts (covers / how it sounds / tailored /
//     connected) and what its content sounds like in the chosen example world. The world switch keeps
//     the structure and changes the character.
//   - The summary lists the activities covered. "Send this configuration" (and every change, until the
//     visitor edits the form by hand) fills the form's "What should the audio cover?".
//   - No price or deadline is computed from a click. Nothing plays by itself; a short blip only when
//     sound is already on.
// Texts are English; js/i18n.js translates them as they appear.
import { MODULES, WORLDS } from './modules.js';
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

/* ---- where each module comes to life in each world (scene units 1600 x 914) ---- */
const SPOTS = {    // tuned to assets/system/scene-*.webp (ComfyUI scene2-forest-b, scene2-pirate-a, scene2-scifi-b)
  forest: { sky: 190, tree: [419, 300], ground: 836, path: [470, 1000], hit: [600, 770], object: [1090, 690], notes: [745, 560], gear: [1515, 220] },
  pirate: { sky: 170, tree: [238, 374], ground: 846, path: [330, 880], hit: [760, 800], object: [1060, 736], notes: [1320, 330], gear: [1515, 220] },
  scifi: { sky: 150, tree: [317, 429], ground: 812, path: [400, 960], hit: [690, 650], object: [1245, 540], notes: [829, 360], gear: [1515, 220] },
};

/* ---- the life of each module, drawn as flat shapes over the scene ---- */
function drawLife(g, id, w) {
  const s = SPOTS[w];
  const ring = (x, y, color, delay = 0) => {
    for (let k = 0; k < 2; k++) svg('circle', { cx: x, cy: y, r: 30, class: 'life-ring', stroke: color, style: `animation-delay:${delay + k * 0.9}s` }, g);
  };
  if (id === 'ambient' && w === 'scifi') {
    // a station has no birds: dust drifting in the air flow from the vents
    for (let k = 0; k < 9; k++) {
      const y = 180 + (k * 71) % 420, dur = 9 + (k % 4) * 2.5;
      const d = svg('g', { class: 'life-fly', style: `--dur:${dur}s; animation-delay:-${(k * 1.7).toFixed(1)}s` }, g);
      svg('circle', { cx: 0, cy: y, r: 6 + (k % 3) * 3, class: 'life-dust' }, d);
    }
    for (const [y, delay] of [[260, 0], [330, 1.6]]) svg('path', { d: `M560 ${y} q160 -30 320 0 t320 0`, class: 'life-wind', style: `animation-delay:${delay}s` }, g);
    ring(s.tree[0], s.tree[1], 'var(--mint)');
  } else if (id === 'ambient') {
    for (const [dy, dur, delay] of [[0, 16, 0], [46, 19, 5]]) {
      const b = svg('g', { class: 'life-fly', style: `--dur:${dur}s; animation-delay:-${delay}s` }, g);
      svg('path', { d: `M0 ${s.sky + dy} q14 -14 28 0 q14 -14 28 0`, class: 'life-bird' }, b);
    }
    for (const [y, delay] of [[s.sky + 90, 0], [s.sky + 150, 1.6], [s.sky + 40, 3.1]]) {
      svg('path', { d: `M120 ${y} q160 -40 320 0 t320 0`, class: 'life-wind', style: `animation-delay:${delay}s` }, g);
    }
    ring(s.tree[0], s.tree[1], 'var(--mint)');
  } else if (id === 'movement') {
    const [x0, x1] = s.path, n = 7;
    for (let k = 0; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / (n - 1), y = s.ground + (k % 2 ? 14 : -14);
      svg('ellipse', { cx: x, cy: y, rx: 18, ry: 9, class: 'life-step', style: `animation-delay:${(k * 0.32).toFixed(2)}s` }, g);
    }
  } else if (id === 'combat') {
    const [x, y] = s.hit;
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
  } else if (id === 'interactive') {
    const [x, y] = s.object;
    ring(x, y, 'var(--zest)');
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      svg('path', { d: `M${x + Math.cos(a) * 70} ${y + Math.sin(a) * 70}l6 -16 6 16 16 6 -16 6 -6 16 -6 -16 -16 -6z`, class: 'life-spark', style: `animation-delay:${k * 0.35}s` }, g);
    }
  } else if (id === 'music') {
    const [x, y] = s.notes;
    for (let k = 0; k < 3; k++) {
      const n = svg('g', { class: 'life-note', style: `animation-delay:${k * 0.9}s` }, g);
      const nx = x + k * 46 - 46;
      svg('ellipse', { cx: nx, cy: y, rx: 15, ry: 11, transform: `rotate(-20 ${nx} ${y})`, class: 'life-notehead' }, n);
      svg('path', { d: `M${nx + 13} ${y - 3}V${y - 64}l24 10`, class: 'life-stem' }, n);
    }
  } else if (id === 'special') {
    const [x, y] = s.gear;
    const gear = svg('g', { class: 'life-gear', style: `transform-origin:${x}px ${y}px` }, g);
    for (let k = 0; k < 8; k++) svg('rect', { x: x - 9, y: y - 46, width: 18, height: 24, rx: 4, transform: `rotate(${k * 45} ${x} ${y})`, class: 'life-cog' }, gear);
    svg('circle', { cx: x, cy: y, r: 30, class: 'life-cog' }, gear);
    svg('circle', { cx: x, cy: y, r: 11, class: 'life-cog-hole' }, gear);
  }
}

export function initSystem({ reduce, onChange } = {}) {
  const root = $('[data-builder]');
  if (!root) return null;
  const tiles = $('[data-mods]', root), cables = $('[data-cables]', root), life = $('[data-life]', root);
  const img = $('[data-world-img]', root), screen = $('[data-screen]', root), core = $('[data-core]', root);
  const detail = $('[data-detail]', root), status = $('[data-status]', root), count = $('[data-count]', root), acts = $('[data-acts]', root);
  const on = new Set();
  let world = 'forest', focus = MODULES[0].id;

  /* tiles */
  tiles.innerHTML = MODULES.map((m) => `
    <li><button class="mod" type="button" data-mod="${m.id}" aria-pressed="false" style="--c:${m.color}">
      <span class="mod__plug" aria-hidden="true"></span>
      <span class="mod__face"><img class="mod__img" src="${esc(m.symbol)}" alt="" width="512" height="512" loading="lazy" decoding="async"><span class="mod__word" aria-hidden="true">${esc(m.word)}</span></span>
      <span class="mod__name">${esc(m.name)}</span>
      ${m.onRequest ? '<span class="mod__tag">On request</span>' : ''}
    </button></li>`).join('');
  const buttons = $$('.mod', tiles);

  /* worlds */
  const worlds = $('[data-worlds]', root);
  worlds.innerHTML = WORLDS.map((w) => `<button type="button" data-w="${w.id}" aria-pressed="${w.id === world}">${esc(w.name)}</button>`).join('');

  /* the life layers: one group per module, rebuilt for each world */
  const groups = {};
  const buildLife = () => {
    life.replaceChildren();
    for (const m of MODULES) {
      const g = svg('g', { class: 'life', 'data-life-of': m.id }, life);
      drawLife(g, m.id, world);
      g.classList.toggle('is-on', on.has(m.id));
      groups[m.id] = g;
    }
  };

  /* cables: from each tile's plug up into the core, and from the core up into the game */
  const drawCables = () => {
    cables.replaceChildren();
    if (getComputedStyle(cables).display === 'none') return;
    const box = cables.getBoundingClientRect();
    cables.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const c = core.getBoundingClientRect();
    const cx = c.left + c.width / 2 - box.left, cy = c.bottom - box.top - c.height * 0.12;
    const sc = screen.getBoundingClientRect();
    svg('path', { d: `M${cx} ${c.top - box.top + c.height * 0.1}V${sc.bottom - box.top}`, class: `cable cable--game${on.size ? ' is-on' : ''}` }, cables);
    for (const b of buttons) {
      const p = $('.mod__plug', b).getBoundingClientRect();
      const x = p.left + p.width / 2 - box.left, y = p.top + p.height / 2 - box.top;
      const k = Math.max(30, (y - cy) * 0.55);
      const path = svg('path', { d: `M${x} ${y}C${x} ${y - k} ${cx + (x - cx) * 0.25} ${cy + k * 0.6} ${cx} ${cy}`, class: 'cable', 'data-cable': b.dataset.mod }, cables);
      path.style.setProperty('--c', MODULES.find((m) => m.id === b.dataset.mod).color);
      path.classList.toggle('is-on', on.has(b.dataset.mod));
    }
  };

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const paintDetail = () => {
    const m = MODULES.find((x) => x.id === focus);
    const w = WORLDS.find((x) => x.id === world);
    detail.style.setProperty('--c', m.color);
    detail.innerHTML = `
      <div class="detail__head">
        <img class="detail__img" src="${esc(m.symbol)}" alt="" width="512" height="512">
        <div>
          <h3 class="detail__name">${esc(m.name)}</h3>
          <p class="detail__state">${on.has(m.id) ? 'Connected' : 'Not connected yet'}${m.onRequest ? ' · <span>On request</span>' : ''}</p>
        </div>
      </div>
      <dl class="detail__parts">
        <div><dt>Covers</dt><dd><ul>${m.covers.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></dd></div>
        <div><dt>How it sounds</dt><dd>${esc(m.behaves)}</dd></div>
        <div><dt>Tailored to your game</dt><dd>${esc(m.tailored)}</dd></div>
        <div><dt>Connected in your project</dt><dd>${esc(m.connected)}</dd></div>
        <div class="detail__world"><dt><span class="detail__world-label">In this world:</span> <span>${esc(w.name)}</span></dt><dd>${esc(m.world[world])}</dd></div>
      </dl>`;
  };
  const paint = () => {
    buttons.forEach((b) => {
      const v = on.has(b.dataset.mod);
      b.setAttribute('aria-pressed', String(v));
      b.classList.toggle('is-focus', b.dataset.mod === focus);
    });
    MODULES.forEach((m) => groups[m.id]?.classList.toggle('is-on', on.has(m.id)));
    $$('.cable', cables).forEach((p) => p.classList.toggle('is-on', p.classList.contains('cable--game') ? on.size > 0 : on.has(p.dataset.cable)));
    screen.style.setProperty('--life', Math.min(1, on.size / 4).toFixed(2));
    root.classList.toggle('is-live', on.size > 0);
    const n = on.size;
    status.textContent = n === 0 ? 'A silent world. Connect an activity below.' : n < 4 ? 'The world is waking up.' : 'The world answers the player.';
    const chosen = MODULES.filter((m) => on.has(m.id));
    const list = [...new Set(chosen.flatMap((m) => m.acts))];
    count.textContent = n === 0 ? 'Nothing connected yet.' : `${plural(n, 'module', 'modules')} · ${plural(list.length, 'activity', 'activities')}`;
    acts.innerHTML = list.map((a) => `<li>${esc(a)}</li>`).join('');
    paintDetail();
    onChange?.(chosen.map((m) => m.id));
  };

  const blip = (connect) => {
    if (!sound.live) return;           // a builder tile never switches sound on by itself
    const t = music.now(), i = MODULES.findIndex((m) => m.id === focus);
    if (connect) [0, 2].forEach((d, k) => music.marimba(t + k * 0.07, music.degree(i + d, 5), 0.35));
    else music.marimba(t, music.degree(i, 4), 0.25);
  };

  tiles.addEventListener('click', (e) => {
    const b = e.target.closest('.mod');
    if (!b) return;
    const id = b.dataset.mod;
    focus = id;
    if (on.has(id)) on.delete(id); else on.add(id);
    blip(on.has(id));
    paint();
  });
  tiles.addEventListener('focusin', (e) => {
    const b = e.target.closest('.mod');
    if (b && b.dataset.mod !== focus) { focus = b.dataset.mod; paint(); }
  });
  tiles.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.mod');
    if (b && e.pointerType === 'mouse' && b.dataset.mod !== focus) { focus = b.dataset.mod; paint(); }
  });
  worlds.addEventListener('click', (e) => {
    const b = e.target.closest('[data-w]');
    if (!b || b.dataset.w === world) return;
    world = b.dataset.w;
    $$('[data-w]', worlds).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const w = WORLDS.find((x) => x.id === world);
    screen.classList.add('is-swapping');
    const next = new Image();
    next.onload = next.onerror = () => {
      img.src = w.img;
      buildLife();
      requestAnimationFrame(() => screen.classList.remove('is-swapping'));
    };
    next.src = w.img;
    paint();
  });
  $('[data-reset]', root).addEventListener('click', () => { on.clear(); paint(); });

  if (reduce?.matches) root.classList.add('is-still');
  buildLife();
  paint();
  new ResizeObserver(() => drawCables()).observe(root);
  window.addEventListener('load', drawCables);
  img.addEventListener('load', drawCables);
  $$('.mod__img', tiles).forEach((i) => i.addEventListener('load', drawCables, { once: true }));
  drawCables();

  return {
    get selected() { return MODULES.filter((m) => on.has(m.id)).map((m) => m.id); },
    get world() { return world; },
    set(ids) { on.clear(); ids.forEach((id) => on.add(id)); paint(); },
    redraw: drawCables,
  };
}

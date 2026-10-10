// Studio card 1: the boot over four surfaces (dirt, sand, grass, snow).
// Press a surface: the boot lifts, travels there, strikes it with the sole and settles; on the
// frame the sole lands the surface answers (a little dust, a few sand grains, the grass bends,
// a footprint in the snow) and its footstep plays. A new press always starts from wherever the
// boot is, so quick presses never queue up. On its own the card walks across the surfaces in
// silence; it never makes a sound by itself.
// Sounds: assets/foley/steps/<surface>-<1..3>.wav (tools/make_footsteps.py; replace them with
// recordings under the same names and nothing else changes). They play through the site's one
// sound switch (js/music/sound.js).
import { music, sound } from './music/sound.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (u) => 1 - (1 - u) ** 3;
const easeIn = (u) => u * u * u;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const INK = '#101c3f';

// a small seeded random, so the textures are the same on every visit
const rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/* ---- layout (viewBox 1024 x 768) ---- */
const SURFACES = [
  { id: 'dirt', label: 'Dirt', sink: 0 },
  { id: 'sand', label: 'Sand', sink: 6 },
  { id: 'grass', label: 'Grass', sink: 5 },
  { id: 'snow', label: 'Snow', sink: 9 },
];
const LEFT = 30, GAP = 14, PW = (1024 - 2 * LEFT - 3 * GAP) / 4;
const TOP = 488, BOTTOM = 690;
SURFACES.forEach((s, i) => { s.x0 = LEFT + i * (PW + GAP); s.cx = s.x0 + PW / 2; });

// the boot bitmap (the same ComfyUI boot as before): its sole runs at 11.5 deg; this pivot is the
// middle of the sole, so rotating by -11.5 deg stands it flat on the ground
const BOOT = { href: 'assets/studio/anim/foley-boot.webp', w: 447, h: 427, px: 220, py: 392.6, tilt: -11.5, k: 0.55 };

const TIMING = { up: 0.13, down: 0.085, settle: 0.22 };       // contact = up + down after a press

/* ---- surfaces, drawn as flat shapes in the site's style ---- */
function topEdge(s, bumps, amp, r) {
  // a softly uneven top edge from the left to the right of the patch
  const pts = [];
  const n = 16;
  for (let k = 0; k <= n; k++) {
    const x = s.x0 + (PW * k) / n;
    const y = TOP + amp * Math.sin((k / n) * Math.PI * bumps + r * 6) * (k === 0 || k === n ? 0.3 : 1);
    pts.push([x, y]);
  }
  let d = `M${s.x0} ${BOTTOM - 24} V${pts[0][1].toFixed(1)}`;
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    d += ` Q${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  d += ` L${s.x0 + PW} ${pts[n][1].toFixed(1)} V${BOTTOM - 24} Q${s.x0 + PW} ${BOTTOM} ${s.x0 + PW - 24} ${BOTTOM} H${s.x0 + 24} Q${s.x0} ${BOTTOM} ${s.x0} ${BOTTOM - 24}Z`;
  return d;
}

function drawSurface(s, g, front, defs, uid) {
  const r = rand(7 + s.x0);
  const clipId = `foley-clip-${uid}-${s.id}`;
  const clip = el('clipPath', { id: clipId }, defs);
  const shapeD = { dirt: topEdge(s, 5, 4, 0.2), sand: topEdge(s, 1.5, 6, 0.6), grass: topEdge(s, 3, 3, 0.1), snow: topEdge(s, 3, 9, 0.35) }[s.id];
  el('path', { d: shapeD }, clip);
  const body = el('g', { 'clip-path': `url(#${clipId})` }, g);
  const fill = (c) => el('path', { d: shapeD, fill: c }, body);
  s.back = el('g', {}, g);                     // under the boot: the footprint in the snow
  s.fx = el('g', {}, front);                   // over the boot: dust, grains, crumbs
  // dirt and sand are filled with ComfyUI textures (design/comfyui/jobs-foley-surfaces.json);
  // grass and snow stay vector: the blades bend under the boot and the snow keeps its outline
  const texture = (name, shiftX) => el('image', { href: `assets/studio/foley/${name}.webp`, x: s.x0 - shiftX, y: TOP - 14, width: PW * 2.6, height: BOTTOM - TOP + 14, preserveAspectRatio: 'none' }, body);
  if (s.id === 'dirt') {
    fill('#8f633f');
    texture('dirt', PW * 0.6);
    el('path', { d: shapeD, fill: 'none', stroke: '#6e4528', 'stroke-width': 7, opacity: 0.55 }, body);
    for (let k = 0; k < 4; k++) el('ellipse', { cx: s.x0 + 18 + r() * (PW - 36), cy: TOP + 40 + r() * 130, rx: 7 + r() * 7, ry: 5 + r() * 4, fill: '#6b4127', opacity: 0.85 }, body);
  } else if (s.id === 'sand') {
    fill('#f3d394');
    texture('sand', PW * 0.9);
    el('path', { d: shapeD, fill: 'none', stroke: '#e2b867', 'stroke-width': 6, opacity: 0.8 }, body);
    for (let k = 0; k < 12; k++) el('circle', { cx: s.x0 + 8 + r() * (PW - 16), cy: TOP + 16 + r() * 170, r: 1.6 + r() * 2, fill: r() > 0.5 ? '#c99548' : '#fbe6b8' }, body);
  } else if (s.id === 'grass') {
    fill('#57b965');
    el('path', { d: shapeD, fill: '#3f9a4d', transform: 'translate(0 96)' }, body);
    for (let k = 0; k < 7; k++) el('circle', { cx: s.x0 + 18 + r() * (PW - 36), cy: TOP + 100 + r() * 80, r: 3 + r() * 3, fill: '#2f7f3c', opacity: 0.6 }, body);
    // blades on top, each its own shape so it can bend; they stand in front of the boot, so a boot
    // on the grass sinks into it
    s.blades = [];
    const bl = el('g', {}, front);
    for (let k = 0; k < 19; k++) {
      const bx = s.x0 + 6 + (k + r() * 0.6) * ((PW - 12) / 19), h = 30 + r() * 26, lean = (r() - 0.5) * 14;
      const blade = el('path', { d: `M${bx - 6} ${TOP + 8} Q${bx + lean * 0.4} ${TOP - h * 0.5} ${bx + lean} ${TOP - h} Q${bx + 3 + lean * 0.3} ${TOP - h * 0.45} ${bx + 6} ${TOP + 8}Z`, fill: k % 3 === 1 ? '#7fd88a' : '#3f9a4d' }, bl);
      s.blades.push({ el: blade, x: bx, y: TOP + 6 });
    }
  } else {   // snow
    const gid = `foley-snow-${uid}`;
    const lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0.35', 'stop-color': '#f8fcff' }, lg);
    el('stop', { offset: '1', 'stop-color': '#cfe6f8' }, lg);
    fill(`url(#${gid})`);
    el('path', { d: shapeD, fill: 'none', stroke: '#b4d6ef', 'stroke-width': 5 }, body);
    for (let k = 0; k < 5; k++) {
      const x = s.x0 + 22 + r() * (PW - 44), y = TOP + 40 + r() * 130, a = 5 + r() * 4;
      el('path', { d: `M${x} ${y - a}V${y + a}M${x - a} ${y}H${x + a}`, stroke: '#a9d1ef', 'stroke-width': 3, 'stroke-linecap': 'round' }, body);
    }
  }
  return s;
}

/* ---- footstep sounds ---- */
const TAKES = 3;
const files = {};
let decoded = null;
function prefetch() {
  for (const s of SURFACES) for (let k = 1; k <= TAKES; k++) {
    const url = `assets/foley/steps/${s.id}-${k}.wav`;
    files[url] ||= fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  }
}
function buffers() {
  if (decoded) return decoded;
  const ctx = music.context;
  decoded = Promise.all(SURFACES.map((s) => Promise.all(Array.from({ length: TAKES }, async (_, k) => {
    const data = await files[`assets/foley/steps/${s.id}-${k + 1}.wav`];
    return data ? ctx.decodeAudioData(data.slice(0)).catch(() => null) : null;
  })))).then((rows) => Object.fromEntries(SURFACES.map((s, i) => [s.id, rows[i].filter(Boolean)])));
  return decoded;
}

export function buildFoleyStage(svg, defs, card) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const uid = Math.random().toString(36).slice(2, 7);
  // the twelve takes (~0.45 MB) load only for visitors who may hear them: sound already on, or a
  // first sign of interest in the card (pointer over it, focus, a touch)
  if (sound.on) prefetch();
  ['pointerenter', 'focusin', 'touchstart'].forEach((type) => card.addEventListener(type, prefetch, { once: true, passive: true }));

  // the whole ground sits on one ink base, so the four surfaces read as one scene
  const ground = el('g', {}, svg);
  const bootG = el('g', {}, svg);
  const front = el('g', {}, svg);
  el('rect', { x: LEFT - 8, y: BOTTOM - 4, width: 1024 - 2 * LEFT + 16, height: 20, rx: 10, fill: INK }, ground);
  SURFACES.forEach((s) => drawSurface(s, ground, front, defs, uid));

  // reactions (one set per surface, reused: they never pile up)
  for (const s of SURFACES) {
    s.parts = [];
    const n = { dirt: 5, sand: 8, grass: 0, snow: 5 }[s.id];
    if (s.id === 'snow') s.print = el('ellipse', { cx: s.cx, cy: TOP + 8, rx: 132, ry: 11, fill: '#c3dff4', opacity: 0 }, s.back);
    for (let k = 0; k < n; k++) {
      const c = s.id === 'dirt' ? el('circle', { r: 9, fill: '#a87b56', opacity: 0 }, s.fx)
        : s.id === 'sand' ? el('circle', { r: 4.5, fill: '#e0b05a', opacity: 0 }, s.fx)
          : el('circle', { r: 6.5, fill: '#fff', stroke: '#b4d6ef', 'stroke-width': 2.5, opacity: 0 }, s.fx);
      s.parts.push({ el: c, vx: 0, vy: 0 });
    }
    s.hitAt = -9;
    s.hitX = s.cx;
  }

  el('image', { href: BOOT.href, x: 0, y: 0, width: BOOT.w, height: BOOT.h, preserveAspectRatio: 'none' }, bootG);

  // the surfaces are real buttons: they take clicks, taps and the keyboard, and don't hold the page
  const pads = document.createElement('div');
  pads.className = 'foley-pads';
  SURFACES.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'foley-pad';
    // the buttons meet in the middle of the gaps, so there is no dead strip between surfaces
    const x0 = i === 0 ? 0 : s.x0 - GAP / 2, x1 = i === SURFACES.length - 1 ? 1024 : s.x0 + PW + GAP / 2;
    b.style.setProperty('--x', `${(x0 / 1024) * 100}%`);
    b.style.setProperty('--w', `${((x1 - x0) / 1024) * 100}%`);
    b.innerHTML = `<span class="foley-pad__label">${s.label}</span>`;
    b.setAttribute('aria-label', `Step on ${s.label.toLowerCase()}`);
    b.addEventListener('click', () => press(i));
    s.pad = b;
    pads.appendChild(b);
  });
  card.appendChild(pads);

  /* ---- motion ---- */
  const now = () => performance.now() / 1000;
  const pose = { x: SURFACES[0].cx, lift: 0, rot: 0, sx: 1, sy: 1, sink: 0 };
  let move = null;                 // the current step: { from, to, start, contact, travel, hit }
  let at = 0;                      // index of the surface the boot stands on
  let lastPress = -99, demoNext = 0, drivenAt = -1;

  function startStep(i, { silent }) {
    const t = now(), to = SURFACES[i];
    const travel = Math.abs(to.cx - pose.x) > 4;
    move = { from: { ...pose }, to, i, start: t, travel, hit: false, silent, calm: reduce.matches };
    move.contact = t + (move.calm ? 0.04 : TIMING.up + TIMING.down);
    at = i;
    kick();
    return move.contact - t;
  }

  function press(i) {
    lastPress = now();
    card.classList.add('is-played');
    const delay = startStep(i, { silent: false });
    playAt(SURFACES[i], delay, performance.now());
  }

  function render() {
    const t = now();
    if (move) {
      const m = move, u = t - m.start, calm = m.calm;
      const L = m.travel ? 62 : 40, up = TIMING.up, down = TIMING.down, c = up + down;
      if (calm) {
        Object.assign(pose, { x: m.to.cx, lift: 0, rot: 0, sx: 1, sy: 1, sink: m.to.sink });
      } else {
        pose.x = m.from.x + (m.to.cx - m.from.x) * easeInOut(clamp(u / (up + down * 0.6)));
        if (u < up) {
          const v = easeOut(u / up);
          pose.lift = m.from.lift + (L - m.from.lift) * v;
          pose.rot = m.from.rot + (-9 - m.from.rot) * v;
          pose.sink = m.from.sink * (1 - v);
        } else if (u < c) {
          const v = easeIn((u - up) / down);
          pose.lift = L * (1 - v);
          pose.rot = -9 + 11 * v;
          pose.sink = m.to.sink * v;
        } else {
          const v = clamp((u - c) / TIMING.settle);
          const sq = Math.sin(Math.PI * clamp((u - c) / 0.16));
          pose.lift = 3 * Math.sin(Math.PI * v) * (1 - v);
          pose.rot = 2 * (1 - easeOut(v));
          pose.sy = 1 - 0.07 * sq; pose.sx = 1 + 0.035 * sq;
          pose.sink = m.to.sink;
        }
      }
      if (!m.hit && t >= m.contact) { m.hit = true; hit(m.to); }
      if (u > c + TIMING.settle + 0.05 || (calm && u > 0.1)) { Object.assign(pose, { lift: 0, rot: 0, sx: 1, sy: 1 }); move = null; }
    }
    const X = pose.x, Y = TOP + 6 + pose.sink - pose.lift;
    bootG.setAttribute('transform',
      `translate(${X.toFixed(2)} ${Y.toFixed(2)}) scale(${pose.sx.toFixed(4)} ${pose.sy.toFixed(4)}) rotate(${(BOOT.tilt + pose.rot).toFixed(3)}) scale(${BOOT.k}) translate(${-BOOT.px} ${-BOOT.py})`);
    let busy = !!move;
    for (const s of SURFACES) busy = reactions(s, t) || busy;
    SURFACES.forEach((s, i) => s.pad.classList.toggle('is-here', i === at));
    return busy;
  }

  function hit(s) {
    s.hitAt = now();
    s.hitX = pose.x;
    if (reduce.matches) return;
    s.parts.forEach((p) => {
      const side = Math.random() < 0.5 ? -1 : 1;
      // they start under the heel or the toe (the sole runs about 115 units each way)
      const edge = s.hitX + side * (100 + Math.random() * 22);
      if (s.id === 'dirt') { p.x = edge; p.y = TOP - 6; p.vx = side * (45 + Math.random() * 55); p.vy = -(25 + Math.random() * 45); }
      else if (s.id === 'sand') { p.x = edge; p.y = TOP; p.vx = side * (90 + Math.random() * 130); p.vy = -(200 + Math.random() * 120); }
      else if (s.id === 'snow') { p.x = edge; p.y = TOP + 2; p.vx = side * (50 + Math.random() * 80); p.vy = -(150 + Math.random() * 90); }
    });
  }

  function reactions(s, t) {
    const u = t - s.hitAt;
    let busy = false;
    if (s.id === 'grass' && s.blades) {
      const onIt = SURFACES[at] === s && pose.lift < 20 && u >= 0;    // the boot is standing in this grass
      const dt = Math.min(0.05, Math.max(0, t - (s.lastT ?? t))); s.lastT = t;
      for (const b of s.blades) {
        const d = b.x - (onIt ? pose.x : s.hitX), ad = Math.abs(d);
        const spring = u >= 0 && u < 0.9 && !reduce.matches ? Math.cos(u * 16) * Math.exp(-u * 5.5) : 0;
        // under the sole: pressed flat on contact, then half of it springs back up around the sole;
        // when the boot leaves, the blades stand up again with a small overshoot
        const target = onIt && ad < 112 ? (u < 0.12 ? 0.62 : 0.42) : 0;
        b.v = (b.v || 0) + ((target - (b.press || 0)) * 260 - (b.v || 0) * 22) * dt;
        b.press = Math.min(0.7, Math.max(-0.08, (b.press || 0) + b.v * dt));
        if (reduce.matches) { b.press = target; b.v = 0; }
        // at the edges: pushed outward, springing back
        const a = ad >= 80 && ad < 175 ? Math.sign(d) * 26 * (1 - (ad - 80) / 95) * spring : 0;
        const p = Math.abs(b.press) < 0.002 ? 0 : b.press;
        b.el.setAttribute('transform', a || p ? `rotate(${a.toFixed(2)} ${b.x.toFixed(1)} ${b.y}) translate(0 ${b.y}) scale(1 ${(1 - p).toFixed(3)}) translate(0 ${-b.y})` : '');
        if (a || Math.abs(target - b.press) > 0.003 || Math.abs(b.v) > 0.01) busy = true;
      }
    }
    if (s.print) {
      const o = u < 0 ? 0 : u < 1.1 ? 1 : clamp(1 - (u - 1.1) / 0.6);
      s.print.setAttribute('cx', s.hitX.toFixed(1));
      s.print.setAttribute('opacity', o.toFixed(3));
      if (o > 0) busy = true;
    }
    for (const p of s.parts) {
      const life = s.id === 'dirt' ? 0.55 : 0.5;
      if (u < 0 || u > life || reduce.matches) { p.el.setAttribute('opacity', 0); continue; }
      busy = true;
      const g = s.id === 'dirt' ? 0 : s.id === 'sand' ? 900 : 700;
      const x = p.x + p.vx * u, y = p.y + p.vy * u + 0.5 * g * u * u;
      const fade = s.id === 'dirt' ? 0.55 * (1 - u / life) : clamp((life - u) / (life * 0.35));
      p.el.setAttribute('cx', x.toFixed(1)); p.el.setAttribute('cy', y.toFixed(1));
      p.el.setAttribute('opacity', fade.toFixed(3));
      if (s.id === 'dirt') p.el.setAttribute('r', (9 + 14 * u / life).toFixed(1));
    }
    return busy;
  }

  // own frames while something moves and the card's loop is not drawing (reduced motion, idle)
  let raf = 0;
  const frame = () => { raf = 0; if (now() - drivenAt < 0.1) return; if (render()) raf = requestAnimationFrame(frame); };
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  /* ---- sound: scheduled on the audio clock for the moment the sole lands ---- */
  let pending = null;
  const unStop = sound.addStopper(() => { try { pending?.src.stop(); } catch { /* already done */ } pending = null; });
  let lastTake = {};
  async function playAt(s, delay, pressedAt) {
    if (!sound.live && !(await sound.ensure())) return;          // switched off by the visitor: picture only
    const set = await buffers();
    const takes = set[s.id];
    if (!takes?.length || !sound.live) return;
    let k = Math.floor(Math.random() * takes.length);
    if (takes.length > 1 && k === lastTake[s.id]) k = (k + 1) % takes.length;
    lastTake[s.id] = k;
    const ctx = music.context;
    const left = delay - (performance.now() - pressedAt) / 1000;
    const when = ctx.currentTime + Math.max(0, left);
    if (pending && pending.when > ctx.currentTime + 0.003) { try { pending.src.stop(); } catch { /* fine */ } }
    const src = ctx.createBufferSource();
    src.buffer = takes[k];
    const g = ctx.createGain();
    g.gain.value = 0.55;            // matched by ear to the piano and the rest of the site
    src.connect(g).connect(sound.output);       // through the site's safety limiter
    src.start(when);
    pending = { src, when };
    card.dataset.lastStep = `${s.id}-${k + 1}`;      // which recording played (for checks: sand on Sand, grass on Grass)
  }
  sound.onChange((on) => { if (on) { prefetch(); if (music.context) buffers(); } });

  return {
    cycle: 4.6,
    hold: 0.36,
    // the card's own loop: a silent walk across the surfaces until the visitor presses one
    draw(t) {
      drivenAt = now();
      if (now() - lastPress > 8 && !reduce.matches) {
        const slot = t < 2.3 ? 0 : 1;
        if (slot !== demoNext) { demoNext = slot; startStep((at + 1) % SURFACES.length, { silent: true }); }
      }
      render();
    },
    dispose() { unStop(); cancelAnimationFrame(raf); pads.remove(); },
  };
}

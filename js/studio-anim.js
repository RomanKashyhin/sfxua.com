// Studio pictures, animated: action -> contact -> colour.
// Each scene is built from layers cut out of one ComfyUI picture (tools/prepare_anim_scenes.py).
// A colour layer stores, in its alpha channel, how close each pixel is to the point where the
// sound is made; one SVG filter turns that into a mask, and moving a single threshold makes the
// colour grow from the source along the objects. Motion is plain SVG transforms.
import { SCENES } from './studio-scenes-data.js';

const NS = 'http://www.w3.org/2000/svg';
const D = 600;          // must match D in tools/prepare_anim_scenes.py
const SLOPE = 150;      // edge sharpness of the colour front (in alpha units)
let uid = 0;

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (t, a, b) => clamp((t - a) / (b - a));
const easeIn = (u) => u * u * u;
const easeOut = (u) => 1 - (1 - u) ** 3;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const mix = (a, b, u) => a + (b - a) * u;
// After the hold the colour runs back to where it came from; it only turns transparent at the very end.
const recede = (t, [f0, f1], px, full) => (t < f0 ? px : mix(full, -10, easeInOut(span(t, f0, f1))));
const fadeOut = (t, [f0, f1]) => 1 - span(t, f0 + (f1 - f0) * 0.7, f1);

// One threshold filter: colour pixels closer than `px` to the source are shown.
function thresholdFilter(defs) {
  const id = `sfx-grow-${++uid}`;
  const f = el('filter', { id, x: -300, y: -300, width: 1700, height: 1400, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, defs);
  const ct = el('feComponentTransfer', {}, f);
  const fa = el('feFuncA', { type: 'linear', slope: SLOPE, intercept: -SLOPE * 2 }, ct);
  let last = null;
  return {
    url: `url(#${id})`,
    set(px) {
      const v = (-SLOPE * (1 - px / D)).toFixed(2);
      if (v !== last) { fa.setAttribute('intercept', v); last = v; }
    },
  };
}

function image(layer, parent, extra = {}) {
  return el('image', { href: layer.href, x: layer.x, y: layer.y, width: layer.w, height: layer.h, preserveAspectRatio: 'none', ...extra }, parent);
}

function setT(node, x, y, rot = 0, px = 0, py = 0, sx = 1, sy = sx) {
  node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(3)} ${px} ${py}) translate(${px} ${py}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-px} ${-py})`);
}

/* ---------- 1. foley: the boot steps onto the stones ---------- */
function buildFoley(svg, defs) {
  const data = SCENES.foley;
  const m = data.meta;
  const grow = thresholdFilter(defs);
  const colours = [];
  const parts = {};
  // a little smaller and lower, so the lifted boot never touches the card's top edge
  const root = el('g', { transform: 'translate(61 58) scale(0.88)' }, svg);
  for (const L of data.layers) {
    const g = el('g', {}, root);
    image(L.navy, g);
    colours.push(image(L.colour, g, { filter: grow.url }));
    (parts[L.group] ||= []).push({ g, L });
  }
  const [cx, cy] = m.contact;
  const [bx, by] = m.bootPivot;
  const T = { cycle: 4.8, lift: [0.25, 0.75], down: 0.98, settle: 1.45, back: [3.65, 4.65], fade: [3.45, 4.3] };
  return {
    cycle: T.cycle,
    hold: 2.9,
    draw(t) {
      // boot: a small lift, a quick step down, weight onto the foot, then back up
      let y = -10 * easeInOut(span(t, ...T.lift));
      if (t >= T.lift[1]) y = mix(-10, m.descend, easeIn(span(t, T.lift[1], T.down)));
      const settle = easeOut(span(t, T.down, T.settle));
      const back = easeInOut(span(t, ...T.back));
      if (t >= T.down) y = mix(m.descend, 0, back);
      const x = 6 * settle * (1 - back);
      const rot = -4 * settle * (1 - back);
      for (const { g } of parts.boot) setT(g, x, y, rot, bx, by);

      // stones under the sole give a little, pebbles hop
      const hit = span(t, T.down, T.down + 0.09);
      const recoil = easeOut(span(t, T.down + 0.09, T.down + 0.5));
      const shove = (hit - 0.6 * recoil) * (1 - back);
      for (const { g, L } of parts.nudge || []) {
        const dir = Math.sign(L.cx - cx) || 1;
        setT(g, dir * 4 * shove, 5 * shove, dir * 1.5 * shove, L.cx, L.cy);
      }
      for (const { g, L } of parts.hop || []) {
        const u = span(t, T.down + 0.02, T.down + 0.46);
        const h = (L.dir < 0 ? 34 : 26) * 4 * u * (1 - u);
        const drift = L.dir * 14 * easeOut(u) * (1 - back);
        setT(g, drift, -h, L.dir * 30 * u * (1 - back), L.cx, L.cy);
      }

      // colour: nothing before contact, a spot at contact, then the spread
      let px = -10;
      if (t >= T.down) px = mix(0, m.thresholds.contact, easeOut(span(t, T.down, T.down + 0.12)));
      if (t >= T.down + 0.16) px = mix(m.thresholds.contact, m.thresholds.full, easeInOut(span(t, T.down + 0.16, T.down + 1.35)));
      grow.set(recede(t, T.fade, px, m.thresholds.full));
      const op = fadeOut(t, T.fade).toFixed(3);
      for (const c of colours) c.setAttribute('opacity', op);
    },
  };
}

/* ---------- 2. music: one key goes down ---------- */
function buildKeys(svg, defs) {
  const data = SCENES.keys;
  const m = data.meta;
  const grow = thresholdFilter(defs);      // the rest of the keyboard: phase 3 only
  const keyGrow = thresholdFilter(defs);   // the pressed key: a spot at the bottom of the press, then the whole key
  const colours = [];
  const base = data.layers.find((l) => l.id === 'keyboard');
  const key = data.layers.find((l) => l.id === 'key');
  const g0 = el('g', {}, svg);
  image(base.navy, g0);
  colours.push(image(base.colour, g0, { filter: grow.url }));
  // the key sinks into its own slot: clipped to where it sits at rest
  const maskId = `sfx-key-${++uid}`;
  const mask = el('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1024, height: 768, style: 'mask-type:alpha' }, defs);
  image(key.navy, mask);
  const clip = el('g', { mask: `url(#${maskId})` }, svg);
  const kg = el('g', {}, clip);
  image(key.navy, kg);
  colours.push(image(key.colour, kg, { filter: keyGrow.url }));
  // the sound itself: three short arcs over the key
  const [tx, ty] = m.keyTop;
  const arcs = el('g', { fill: 'none', stroke: '#ffd02e', 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);
  const arcPaths = [
    `M${tx - 46} ${ty - 22} q -14 -26 2 -50`,
    `M${tx + 4} ${ty - 34} q 2 -30 22 -48`,
    `M${tx + 52} ${ty - 14} q 18 -22 40 -26`,
  ].map((d) => el('path', { d, pathLength: 1, 'stroke-dasharray': '0 2' }, arcs));
  const T = { cycle: 4.6, down: [0.84, 0.98], up: [1.5, 2.05], fade: [3.25, 4.35] };
  return {
    cycle: T.cycle,
    hold: 2.7,
    draw(t) {
      const press = easeIn(span(t, ...T.down)) * (1 - easeOut(span(t, ...T.up)));
      kg.setAttribute('transform', `translate(0 ${(m.press * press).toFixed(2)})`);
      // the arcs shoot out from the key and then run off their far ends: no dim, half-transparent stage
      const a = span(t, T.down[1], T.down[1] + 0.6);
      const show = a > 0 && a < 1;
      arcs.setAttribute('opacity', show ? 1 : 0);
      arcs.setAttribute('transform', `translate(${tx} ${ty}) scale(${(0.75 + 0.5 * easeOut(a)).toFixed(3)}) translate(${-tx} ${-ty})`);
      const head = easeOut(span(a, 0, 0.4)), tail = easeIn(span(a, 0.3, 1));
      for (const p of arcPaths) {
        p.setAttribute('stroke-dasharray', `${Math.max(head - tail, 0).toFixed(3)} 2`);
        p.setAttribute('stroke-dashoffset', (-tail).toFixed(3));
      }
      const th = m.thresholds;
      let kp = -10, px = -10;
      if (t >= T.down[1]) kp = mix(0, th.contact, easeOut(span(t, T.down[1], T.down[1] + 0.12)));
      if (t >= T.down[1] + 0.2) kp = mix(th.contact, th.keyFull, easeInOut(span(t, T.down[1] + 0.2, T.down[1] + 0.7)));
      if (t >= T.down[1] + 0.32) px = mix(0, th.full, easeInOut(span(t, T.down[1] + 0.32, T.down[1] + 1.4)));
      keyGrow.set(recede(t, T.fade, kp, th.keyFull));
      grow.set(recede(t, T.fade, px, th.full));
      const op = fadeOut(t, T.fade).toFixed(3);
      for (const c of colours) c.setAttribute('opacity', op);
    },
  };
}

/* ---------- 3. interactive audio: a button press, the tools answer, the game lights up ---------- */
const BLOCKS = [['Wwise'], ['FMOD'], ['Unity +', 'Unreal Engine']];
const RAINBOW = ['#ffd02e', '#ff7a5c', '#ff3d8b', '#2ec9c1'];

function buildConsole(svg, defs) {
  const data = SCENES.console;
  const m = data.meta;
  const [bx0, by0, bx1, by1] = m.bbox;
  const scale = 512 / (by1 - by0);
  const ox = 1024 - 40 - (bx1 - bx0) * scale;
  const oy = (768 - (by1 - by0) * scale) / 2;
  const toScene = (x, y) => [ox + (x - bx0) * scale, oy + (y - by0) * scale];
  const [portX, portY] = toScene(bx0, m.port[1]);

  // audio tools (names only), a bus and the cable to the console
  const blocks = el('g', {}, svg);
  const centres = [246, 384, 522];
  BLOCKS.forEach((lines, i) => {
    const y = centres[i];
    el('rect', { x: 26, y: y - 58, width: 330, height: 116, rx: 30, fill: '#101c3f' }, blocks);
    const text = el('text', { x: 191, y: y + (lines.length > 1 ? -8 : 18), 'text-anchor': 'middle', fill: '#fff',
      style: `font: 800 ${lines.length > 1 ? 37 : 54}px Archivo, system-ui, sans-serif; font-stretch: 108%` }, blocks);
    lines.forEach((line, k) => {
      const ts = el('tspan', { x: 191, dy: k ? 42 : 0 }, text);
      ts.textContent = line;
    });
  });
  const bus = el('path', { d: 'M356 246 H386 V522 H356 M356 384 H386', fill: 'none', stroke: '#101c3f', 'stroke-width': 10, 'stroke-linejoin': 'round' }, svg);
  const busFlash = el('path', { d: 'M356 246 H386 V522 H356 M356 384 H386', fill: 'none', stroke: '#ffd02e', 'stroke-width': 6, 'stroke-linejoin': 'round', opacity: 0 }, svg);
  const cableD = `M386 384 C 440 384 430 560 486 560 C 548 560 ${portX - 70} ${portY} ${portX + 4} ${portY}`;
  el('path', { d: cableD, fill: 'none', stroke: '#101c3f', 'stroke-width': 16, 'stroke-linecap': 'round' }, svg);
  const signal = el('path', { d: cableD, fill: 'none', stroke: '#ffd02e', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0 }, svg);
  const bands = RAINBOW.map((c) => el('path', { d: cableD, fill: 'none', stroke: c, 'stroke-width': 10, 'stroke-linecap': 'butt' }, svg));

  // the console itself
  const outer = el('g', { transform: `translate(${ox} ${oy}) scale(${scale}) translate(${-bx0} ${-by0})` }, svg);
  const body = el('g', {}, outer);
  const grow = thresholdFilter(defs);
  const fill = thresholdFilter(defs);
  const colours = [];
  for (const L of data.layers) {
    if (L.navy) image(L.navy, body);
    colours.push(image(L.colour, body, { filter: (L.filter === 'screen' ? fill : grow).url }));
  }
  const { cx: bcx, cy: bcy, r: br } = m.button;
  const button = el('g', {}, body);
  const btn = el('circle', { cx: bcx, cy: bcy, r: br - 4, fill: '#101c3f', stroke: '#fff', 'stroke-width': 10 }, button);
  const [sx0, sy0, sx1, sy1] = m.screen;
  const scx = (sx0 + sx1) / 2, scy = (sy0 + sy1) / 2 + 8;
  const star = el('path', { d: starPath(scx, scy, 62, 27), fill: '#ffd02e', stroke: '#101c3f', 'stroke-width': 8, 'stroke-linejoin': 'round' }, body);

  let L = 0;
  const T = { cycle: 5.0, press: [0.7, 0.8], release: [1.05, 1.35], signal: [0.86, 1.34], rainbow: [1.5, 2.4], fade: [3.95, 4.85] };
  const seg = 38;
  return {
    cycle: T.cycle,
    hold: 3.4,
    measure() { L = bands[0].getTotalLength(); for (const b of [...bands, signal]) b.setAttribute('stroke-dasharray', `${seg} ${L * 3}`); signal.setAttribute('stroke-dasharray', `46 ${L * 3}`); },
    draw(t) {
      if (!L) this.measure();
      const fade = span(t, ...T.fade);
      // button press, a tiny kick of the body
      const p = easeIn(span(t, ...T.press)) * (1 - easeOut(span(t, ...T.release)));
      setT(button, 0, 3 * p, 0, bcx, bcy, 1 - 0.14 * p);
      const kick = Math.sin(Math.PI * span(t, T.press[0], T.press[0] + 0.28));
      body.setAttribute('transform', `translate(0 ${(2.5 * kick).toFixed(2)})`);
      const accent = t >= T.press[1] - 0.02 && fade < 1;
      btn.setAttribute('fill', accent ? '#ff7a5c' : '#101c3f');
      btn.setAttribute('fill-opacity', accent ? (1 - fade).toFixed(3) : 1);
      // a thin game-event signal runs back along the cable to the tools
      const sg = span(t, ...T.signal);
      signal.setAttribute('opacity', sg > 0 && sg < 1 ? 1 : 0);
      signal.setAttribute('stroke-dashoffset', (-(L - sg * (L + 46))).toFixed(1));
      const flash = Math.sin(Math.PI * span(t, T.signal[1] - 0.04, T.rainbow[0] + 0.2));
      busFlash.setAttribute('opacity', flash.toFixed(3));
      // the answer: a rainbow pulse along the cable into the console
      const run = span(t, ...T.rainbow);
      const pos = run * (L + RAINBOW.length * seg);
      bands.forEach((b, i) => {
        b.setAttribute('stroke-dashoffset', (-(pos - (i + 1) * seg)).toFixed(1));
        b.setAttribute('opacity', run > 0 && run < 1 ? 1 : 0);
      });
      const arrive = T.rainbow[0] + (T.rainbow[1] - T.rainbow[0]) * (L / (L + RAINBOW.length * seg));
      let g = -10, f = -10;
      if (t >= arrive) g = mix(0, m.thresholds.contact, easeOut(span(t, arrive, arrive + 0.14)));
      if (t >= arrive + 0.16) g = mix(m.thresholds.contact, m.thresholds.full, easeInOut(span(t, arrive + 0.16, arrive + 1.2)));
      if (t >= arrive + 0.18) f = mix(0, m.thresholds.screenFull, easeInOut(span(t, arrive + 0.18, arrive + 0.85)));
      grow.set(recede(t, T.fade, g, m.thresholds.full));
      fill.set(recede(t, T.fade, f, m.thresholds.screenFull));
      for (const c of colours) c.setAttribute('opacity', fadeOut(t, T.fade).toFixed(3));
      // a star pops onto the screen, with one small bounce
      const sp = span(t, arrive + 0.62, arrive + 1.0);
      const pop = sp <= 0 ? 0 : sp < 0.6 ? easeOut(sp / 0.6) * 1.18 : 1.18 - 0.18 * easeInOut((sp - 0.6) / 0.4);
      const bounce = -14 * Math.sin(Math.PI * span(t, arrive + 1.05, arrive + 1.4));
      const out = easeIn(span(t, T.fade[0], T.fade[0] + 0.3));      // the star leaves first, before the screen empties
      setT(star, 0, bounce, 0, scx, scy, Math.max(pop * (1 - out), 0.001));
      star.setAttribute('opacity', (sp > 0 ? 1 - out : 0).toFixed(3));
    },
  };
}

function starPath(cx, cy, R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + 'Z';
}

const BUILD = { foley: buildFoley, keys: buildKeys, console: buildConsole };

export function mountScene(container, name) {
  const svg = el('svg', { viewBox: '0 0 1024 768', class: 'principle__svg', 'aria-hidden': 'true', focusable: 'false' });
  const defs = el('defs', {}, svg);
  container.appendChild(svg);
  const scene = BUILD[name](svg, defs);
  return { svg, ...scene };
}

// Runs the three cards: each animates only while on screen, with its cycle offset so they never
// hit at the same time. With reduced motion every card shows its third phase and stays still.
export function initStudioScenes(cards, { reduce = false, offsets = [0, 1.55, 3.1] } = {}) {
  const scenes = cards.map((card, i) => {
    const s = mountScene(card, card.dataset.scene);
    s.card = card;
    s.clock = offsets[i] || 0;
    s.active = false;
    return s;
  });
  const ready = (s) => {
    const imgs = [...s.svg.querySelectorAll('image')];
    return Promise.all(imgs.map((im) => new Promise((res) => {
      const probe = new Image();
      probe.onload = probe.onerror = res;
      probe.src = im.getAttribute('href');
    })));
  };
  scenes.forEach((s) => ready(s).then(() => {
    s.draw(reduce ? s.hold : s.clock % s.cycle);
    s.card.classList.add('is-live');
  }));
  if (reduce) return;

  let raf = 0, last = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let any = false;
    for (const s of scenes) {
      if (!s.active) continue;
      any = true;
      s.clock += dt;
      s.draw(s.clock % s.cycle);
    }
    raf = any ? requestAnimationFrame(frame) : 0;
  };
  const wake = () => { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const s = scenes.find((x) => x.card === e.target);
      if (s) s.active = e.isIntersecting;
    }
    wake();
  }, { rootMargin: '80px 0px' });
  scenes.forEach((s) => io.observe(s.card));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); });
}

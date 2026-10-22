// Studio card 2: a small keyboard, drawn as vector shapes so every key stays crisp at any size.
// On its own it plays a short silent phrase (action -> contact -> colour, like the other two cards):
// keys go down, the pressed key lights up from inside and two short arcs leave it, then everything
// clears. Visitors can play it: mouse (with glissando), touch (several fingers), or the keyboard
// (A W S E D F T G Y H U J K O L P ; ' while the card has focus). Notes go through the site's one
// engine (js/music/sound.js), so they share the key and the volume of the other toys.
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

const INK = '#1d2327';             // round N: the site's graphite
const COLOURS = ['#ff6b5b', '#ffbf1f', '#16b896', '#4fc6ef'];   // coral, sun, teal, sky (round N)
const WHITE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const WHITE_SEMI = [0, 2, 4, 5, 7, 9, 11];
const BASE_MIDI = 60;               // C4
const N_WHITE = 12;                 // C4 .. G5

// layout (viewBox 1024 x 768)
const X0 = 138, X1 = 886, TOP = 346, WHITE_LEN = 206, LIP = 18, GAP = 4;
const WW = (X1 - X0) / N_WHITE;
const BW = 36, BLEN = 128, PRESS = 6;

// computer keyboard -> semitones above C4 (the usual "piano on the home row" layout)
const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };

function keyList() {
  const keys = [];
  for (let i = 0; i < N_WHITE; i++) {
    const oct = Math.floor(i / 7), w = i % 7;
    keys.push({ black: false, semi: oct * 12 + WHITE_SEMI[w], name: WHITE_NAMES[w] + (4 + oct), x: X0 + i * WW, i });
    // a black key after C, D, F, G, A (not after E or B), and not past the last white key
    if ([0, 1, 3, 4, 5].includes(w) && i < N_WHITE - 1) {
      keys.push({ black: true, semi: oct * 12 + WHITE_SEMI[w] + 1, name: WHITE_NAMES[w] + '#' + (4 + oct), x: X0 + (i + 1) * WW, i });
    }
  }
  return keys;
}

const roundBottom = (x, y, w, h, r) => `M${x} ${y}H${x + w}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}Z`;

export function buildPiano(svg, defs, card) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const keys = keyList();
  const bySemi = new Map(keys.map((k) => [k.semi, k]));

  /* ---- the instrument ---- */
  const root = el('g', { class: 'piano' }, svg);
  // back panel and key bed: one light rounded body
  el('path', { d: 'M102 336V272Q102 224 150 224H874Q922 224 922 272V336Z', fill: INK }, root);
  el('path', { d: 'M102 330H922V566Q922 600 888 600H136Q102 600 102 566Z', fill: INK }, root);
  el('path', { d: 'M152 252H408', stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.9 }, root);
  // a small meter: one dot per pitch class lights up with the note's colour
  const leds = [];
  for (let k = 0; k < 5; k++) leds.push(el('circle', { cx: 724 + k * 30, cy: 280, r: 7, fill: '#fff', opacity: 0.16 }, root));

  const whites = el('g', {}, root);
  const blacks = el('g', {}, root);
  const waves = el('g', { fill: 'none', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);

  keys.forEach((k) => {
    // white keys cycle jam / zest / mint, so the notes of a chord (every other key) never match;
    // black keys light up sky blue
    k.colour = k.black ? COLOURS[3] : COLOURS[k.i % 3];
    const g = el('g', { class: 'piano__key', 'data-key': k.semi }, k.black ? blacks : whites);
    if (!k.black) {
      const x = k.x + GAP / 2, w = WW - GAP;
      k.lip = el('path', { d: roundBottom(x, TOP + WHITE_LEN - 10, w, LIP + 10, 8), fill: '#dde5e2' }, g);
      k.top = el('g', {}, g);
      el('path', { d: roundBottom(x, TOP, w, WHITE_LEN, 7), fill: '#fff' }, k.top);
      k.glow = el('path', { d: roundBottom(x, TOP, w, WHITE_LEN, 7), fill: k.colour, opacity: 0 }, k.top);
      k.cx = x + w / 2;
    } else {
      const x = k.x - BW / 2;
      k.lip = el('path', { d: roundBottom(x, TOP - 2, BW, BLEN + 2, 6), fill: '#0d1113' }, g);
      k.top = el('g', {}, g);
      el('path', { d: roundBottom(x + 2, TOP - 2, BW - 4, BLEN - 10, 5), fill: '#2d363a' }, k.top);
      k.glow = el('path', { d: roundBottom(x + 2, TOP - 2, BW - 4, BLEN - 10, 5), fill: k.colour, opacity: 0 }, k.top);
      el('path', { d: `M${x + 9} ${TOP + 12}V${TOP + BLEN - 34}`, stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.22 }, k.top);
      k.cx = k.x;
    }
    // the wave: two short arcs that leave the instrument above this key
    k.wave = el('g', { stroke: k.colour, opacity: 0 }, waves);
    el('path', { d: `M${k.cx - 26} 196 Q${k.cx} 176 ${k.cx + 26} 196`, 'stroke-width': 7 }, k.wave);
    el('path', { d: `M${k.cx - 42} 168 Q${k.cx} 138 ${k.cx + 42} 168`, 'stroke-width': 6 }, k.wave);
    k.down = 0; k.lit = 0; k.hit = -9; k.held = false;
  });

  /* ---- state -> picture ---- */
  // a key's look depends on: is it held (sinks), when it was last struck (glow + wave)
  const userKeys = new Set();
  let demo = new Map(), demoOn = true, pausedUntil = 0;
  const now = () => performance.now() / 1000;

  function render() {
    const t = now();
    let ledLevel = [0, 0, 0, 0, 0], ledCol = ['', '', '', '', ''];
    for (const k of keys) {
      const d = demoOn ? demo.get(k.semi) : null;
      const held = k.held || !!d?.held;
      const since = Math.min(t - k.hit, d ? d.since : 9);
      // sinking: quick down, a touch softer up
      const target = held ? 1 : 0;
      k.down += (target - k.down) * (target ? 0.6 : 0.35);
      if (Math.abs(k.down - target) < 0.01) k.down = target;
      const sink = reduce.matches ? 0 : PRESS * k.down * (k.black ? 0.8 : 1);
      k.top.setAttribute('transform', `translate(0 ${sink.toFixed(2)})`);
      // glow: full while held, then clears in ~0.35 s; it never builds up past one key's worth
      const glow = held ? Math.min(1, 0.55 + since * 6) : clamp(1 - since / 0.35) * (since < 9 ? 1 : 0);
      k.glow.setAttribute('opacity', (glow * (k.black ? 0.95 : 0.9)).toFixed(3));
      // wave: grows and fades out in half a second
      const u = since / 0.5;
      if (u >= 0 && u < 1 && !reduce.matches) {
        const s = 0.82 + 0.3 * easeOut(u);
        k.wave.setAttribute('opacity', (1 - u) ** 1.4);
        k.wave.setAttribute('transform', `translate(${k.cx} 200) scale(${s.toFixed(3)}) translate(${-k.cx} ${-200 - 14 * easeOut(u)})`);
      } else if (reduce.matches && glow > 0) {
        k.wave.setAttribute('opacity', glow.toFixed(3)); k.wave.removeAttribute('transform');
      } else k.wave.setAttribute('opacity', 0);
      const slot = k.semi % 5;
      if (glow > ledLevel[slot]) { ledLevel[slot] = glow; ledCol[slot] = k.colour; }
    }
    leds.forEach((c, i) => {
      c.setAttribute('fill', ledLevel[i] > 0.02 ? ledCol[i] : '#fff');
      c.setAttribute('opacity', (0.16 + 0.84 * ledLevel[i]).toFixed(3));
    });
  }
  // the picture settles by itself after the last change
  let fxRaf = 0, drivenAt = -1;
  const busy = () => keys.some((k) => k.held || k.down > 0 || now() - k.hit < 0.55);
  function fxFrame() {
    fxRaf = 0;
    if (now() - drivenAt < 0.1) return;           // the card's own animation loop is drawing
    render();
    if (busy()) fxRaf = requestAnimationFrame(fxFrame);
  }
  const kick = () => { if (!fxRaf) fxRaf = requestAnimationFrame(fxFrame); };

  /* ---- the silent phrase on its own (no sound, ever) ---- */
  const PHRASE = [[4, 0.7, 1.05], [7, 1.15, 1.5], [12, 1.7, 2.6], [16, 1.7, 2.6], [19, 1.7, 2.6]];
  const CYCLE = 4.6;
  function demoAt(t) {
    const m = new Map();
    for (const [semi, a, b] of PHRASE) if (t >= a) m.set(semi, { held: t < b, since: t - a });
    return m;
  }

  /* ---- playing ---- */
  // a soft electric-piano tone: an FM bell with the modulator at the note's own pitch
  const voice = (k, vel) => music.bell(music.now(), BASE_MIDI + k.semi, vel, { ratio: 1, index: 1.4, decay: 1.4 });
  function strike(k, vel = 0.7) {
    k.hit = now();
    pausedUntil = k.hit + 6;
    if (demoOn) { demoOn = false; demo = new Map(); }
    card.classList.add('is-played');
    card.dispatchEvent(new CustomEvent('sfx:played', { bubbles: true, detail: { kind: 'keys' } }));   // the map's node answers (js/map.js)
    if (sound.live) voice(k, vel);
    kick();
  }
  const press = (k, vel) => { k.held = true; strike(k, vel); userKeys.add(k); };
  const release = (k) => { if (!k) return; k.held = false; userKeys.delete(k); kick(); };
  const keyAt = (x, y) => {
    const g = document.elementFromPoint(x, y)?.closest?.('.piano__key');
    return g && card.contains(g) ? bySemi.get(+g.dataset.key) : null;
  };

  const pointers = new Map();        // pointerId -> { key, touch, x, y, tap }
  card.addEventListener('pointerdown', (e) => {
    const k = keyAt(e.clientX, e.clientY);
    if (!k || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const touch = e.pointerType === 'touch', wasLive = sound.live;
    if (!touch) { e.preventDefault(); card.focus({ preventScroll: true }); }
    pointers.set(e.pointerId, { key: k, touch, x: e.clientX, y: e.clientY, tap: true });
    press(k);
    // a click is deliberate: it switches sound on (unless the visitor turned it off), and this first note still plays
    if (!touch && !wasLive) sound.ensure().then((ok) => ok && voice(k, 0.7));
  });
  card.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.touch && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) p.tap = false;
    const k = keyAt(e.clientX, e.clientY);
    if (k && k !== p.key) { release(p.key); p.key = k; press(k, 0.6); }   // glissando
  });
  const up = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    release(p.key);
    // a finger only switches sound on with a clear tap, never with the start of a scroll
    if (p.touch && p.tap && e.type === 'pointerup' && !sound.live) sound.ensure().then((ok) => ok && voice(p.key, 0.7));
  };
  card.addEventListener('pointerup', up);
  card.addEventListener('pointercancel', up);

  const keyDown = new Map();
  card.addEventListener('keydown', async (e) => {
    const semi = KEYMAP[e.key?.toLowerCase()];
    if (semi == null || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (e.repeat || keyDown.has(e.key)) return;
    const k = bySemi.get(semi);
    if (!k) return;
    keyDown.set(e.key, k);
    if (!sound.live) await sound.ensure();
    press(k);
  });
  card.addEventListener('keyup', (e) => { const k = keyDown.get(e.key); keyDown.delete(e.key); release(k); });
  card.addEventListener('blur', () => { keyDown.forEach(release); keyDown.clear(); });

  return {
    cycle: CYCLE,
    hold: 1.85,
    draw(t) {
      drivenAt = now();
      if (!demoOn && now() > pausedUntil && !userKeys.size) demoOn = true;
      demo = demoOn ? demoAt(t) : new Map();
      render();
    },
  };
}

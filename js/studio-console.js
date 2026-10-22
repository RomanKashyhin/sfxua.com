// Studio card 3: the handheld console with a little rhythm game on its screen.
// The screen shows a guitar neck going into the distance with four strings. Press Play and notes
// slide down the strings towards the targets at the bottom; pluck the right string as a note
// reaches its target and the note lights up and plays. The melody is made of what you catch:
// a missed note simply passes and stays a rest. Out of a game the strings can be plucked freely.
// Pluck by passing the cursor across a string (no click, no held button: the harp principle), by
// swiping a finger across them on a touch screen, or with D F J K while the console has focus.
// Each string always sounds one note, in free play and on a caught note alike: C, E, G, A (PITCH),
// and its target is labelled with that note. The keys are shown apart, in a small "Keyboard controls"
// hint next to the card (index.html), so a key letter is never read as a note.
// On its own the card still tells its story in silence: a signal runs along the cable to the audio
// solution (the effects and the music, plugged into a Unity or Unreal project; round L) and a rainbow
// pulse comes back into the console.
// Notes and hits run on one clock (time, not frames); the game pauses when the tab is hidden or the
// card scrolls away, and continues exactly where it stopped. Sound goes through the site's engine.
// (The earlier four-button gamepad is in archive/studio-console-v2-buttons/.)
import { music, sound } from './music/sound.js';

const NS = 'http://www.w3.org/2000/svg';
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
const INK = '#1d2327';             // round N: the site's graphite
const RAINBOW = ['#ffbf1f', '#ff8a2b', '#ff6b5b', '#16b896'];   // sun, orange, coral, teal (round N)
const LANE_COLOURS = ['#ff6b5b', '#ffbf1f', '#16b896', '#4fc6ef'];   // coral, sun, teal, sky (round N)
const KEYS = ['d', 'f', 'j', 'k'];
const BLOCKS = [['Effects'], ['Music'], ['Unity /', 'Unreal']];
let uid = 0;

/* ---- the console (500 x 650 units): a big screen, the classic controls below it ---- */
const W = 500, H = 650;
const PORT = [-14, 190];
const BODY_D = 'M28 0H472Q500 0 500 28V530Q500 650 380 650H28Q0 650 0 622V28Q0 0 28 0Z';
const BEZEL = { x0: 30, y0: 30, x1: 470, y1: 402 };
const GLASS = { x0: 52, y0: 52, x1: 448, y1: 380 };
const roundRect = (x0, y0, x1, y1, r, rbr) => `M${x0 + r} ${y0}H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + r}V${y1 - rbr}Q${x1} ${y1} ${x1 - rbr} ${y1}H${x0 + r}Q${x0} ${y1} ${x0} ${y1 - r}V${y0 + r}Q${x0} ${y0} ${x0 + r} ${y0}Z`;

/* ---- the neck on the screen, in perspective ---- */
const NECK = { cx: 250, yTop: 62, yHit: 322, yBot: 380, wTop: 112, wBot: 372 };
const widthAt = (y) => NECK.wTop + (NECK.wBot - NECK.wTop) * ((y - NECK.yTop) / (NECK.yBot - NECK.yTop));
const laneX = (lane, y) => NECK.cx + (lane - 1.5) * (widthAt(y) / 4);
// a note's depth: it speeds up a little as it comes closer, and keeps going past the targets
const depthY = (u) => NECK.yTop + (NECK.yHit - NECK.yTop) * (u <= 1 ? u ** 1.45 : 1 + (u - 1) * 1.45);

/* ---- the melody: original, slow, single notes on four strings (C, E, G, A of the site's scale) ---- */
const PITCH = [60, 64, 67, 69];
const NOTE_NAMES = ['C', 'E', 'G', 'A'];            // what PITCH sounds (C4 E4 G4 A4): the labels on the targets
const BEAT = 0.75;                                    // 80 BPM
const SONG = [                                        // [beat, string]
  [0, 0], [2, 1], [4, 2], [6, 1],
  [8, 0], [9, 1], [10, 2], [12, 3], [14, 2],
  [16, 1], [17, 2], [18, 3], [19, 2], [20, 1], [22, 0],
  [24, 1], [25, 2], [26, 1], [27, 0], [28, 0],
];
const LEAD = 2.2;                                     // seconds a note takes from the far end to its target
const WINDOW = 0.24;                                  // early or late, still a hit: friendly from the first try
const FIRST = 1.2;                                    // a short breath before the first note arrives

const LAYOUTS = {
  wide: {
    view: [1024, 768],
    blocks: [{ x: 20, y: 196, w: 270, h: 100 }, { x: 20, y: 334, w: 270, h: 100 }, { x: 20, y: 472, w: 270, h: 100 }],
    text: [48, 32],
    bus: 'M290 246H316V522H290M290 384H316',
    console: { tx: 460, ty: 34, s: 1.077 },
    cableFrom: [316, 384],
  },
  tall: {
    view: [768, 1024],
    blocks: [{ x: 22, y: 104, w: 228, h: 92 }, { x: 270, y: 104, w: 228, h: 92 }, { x: 518, y: 104, w: 228, h: 92 }],
    text: [40, 26],
    bus: 'M136 196V220M384 196V220M632 196V220M136 220H632',
    console: { tx: 96.5, ty: 262, s: 1.15 },
    cableFrom: [136, 220],
  },
};

export function buildConsolePad(svg, defs, card) {
  // round M: tall (cable from above) when the card itself is narrow, wide when it has room (the zoom view)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const tall = () => card.clientWidth < 560 || card.clientHeight > card.clientWidth;
  let inst = null, isTall = null;
  const mount = () => { isTall = tall(); inst?.dispose(); inst = layout(svg, defs, card, isTall ? LAYOUTS.tall : LAYOUTS.wide, reduce); };
  mount();
  const ro = new ResizeObserver(() => { if (card.clientWidth && tall() !== isTall) mount(); });
  ro.observe(card);
  return {
    cycle: 5.0,
    hold: 3.4,
    draw: (t) => inst.draw(t),
    game: () => inst.game,
    dispose() { ro.disconnect(); inst?.dispose(); },
  };
}

function layout(svg, defs, card, L, reduce) {
  const id = ++uid;
  svg.setAttribute('viewBox', `0 0 ${L.view[0]} ${L.view[1]}`);
  const root = el('g', {}, svg);
  const own = [];
  const def = (tag, attrs) => { const n = el(tag, attrs, defs); own.push(n); return n; };
  const { tx, ty, s } = L.console;
  const toScene = (x, y) => [tx + x * s, ty + y * s];
  const [portX, portY] = toScene(...PORT);

  /* ---- audio tools, the bus and the cable ---- */
  BLOCKS.forEach((lines, i) => {
    const b = L.blocks[i];
    el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 28, fill: INK }, root);
    const two = lines.length > 1, size = L.text[two ? 1 : 0];
    const text = el('text', { x: b.x + b.w / 2, y: b.y + b.h / 2 + (two ? -size * 0.22 : size * 0.35), 'text-anchor': 'middle', fill: '#fff',
      style: `font: 800 ${size}px Archivo, system-ui, sans-serif; font-stretch: 108%` }, root);
    lines.forEach((line, k) => { const ts = el('tspan', { x: b.x + b.w / 2, dy: k ? size * 1.12 : 0 }, text); ts.textContent = line; });
  });
  el('path', { d: L.bus, fill: 'none', stroke: INK, 'stroke-width': 10, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, root);
  const busFlash = el('path', { d: L.bus, fill: 'none', stroke: '#ffbf1f', 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0 }, root);
  const [cx0, cy0] = L.cableFrom;
  const cableD = L === LAYOUTS.wide
    ? `M${cx0} ${cy0}C${cx0 + 64} ${cy0} ${portX - 64} ${portY} ${portX + 4} ${portY}`
    : `M${cx0} ${cy0}C${cx0} ${cy0 + 60} 40 ${cy0 + 70} 40 ${cy0 + 170}C40 ${portY - 30} ${portX - 30} ${portY} ${portX + 4} ${portY}`;
  el('path', { d: cableD, fill: 'none', stroke: INK, 'stroke-width': 16, 'stroke-linecap': 'round' }, root);
  const signal = el('path', { d: cableD, fill: 'none', stroke: '#ffbf1f', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0 }, root);
  const bands = RAINBOW.map((c) => el('path', { d: cableD, fill: 'none', stroke: c, 'stroke-width': 10, 'stroke-linecap': 'butt', opacity: 0 }, root));

  /* ---- the console body ---- */
  const outer = el('g', { transform: `translate(${tx} ${ty}) scale(${s})` }, root);
  const body = el('g', {}, outer);
  el('rect', { x: PORT[0], y: 150, width: 20, height: 80, rx: 8, fill: INK }, body);
  el('path', { d: BODY_D, fill: INK }, body);
  const gradId = `pad-rainbow-${id}`, maskId = `pad-grow-${id}`, clipId = `pad-glass-${id}`;
  const grad = def('radialGradient', { id: gradId, gradientUnits: 'userSpaceOnUse', cx: PORT[0], cy: PORT[1], r: 720 });
  RAINBOW.forEach((c, i) => el('stop', { offset: (i / (RAINBOW.length - 1)).toFixed(2), 'stop-color': c }, grad));
  const mask = def('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: -40, y: -40, width: W + 80, height: H + 80 });
  const growCircle = el('circle', { cx: PORT[0], cy: PORT[1], r: 0, fill: '#fff' }, mask);
  const colourBody = el('path', { d: BODY_D, fill: `url(#${gradId})`, mask: `url(#${maskId})`, opacity: 0 }, body);
  el('path', { d: roundRect(BEZEL.x0, BEZEL.y0, BEZEL.x1, BEZEL.y1, 24, 62), fill: 'none', stroke: '#fff', 'stroke-width': 12 }, body);
  const glassD = roundRect(GLASS.x0, GLASS.y0, GLASS.x1, GLASS.y1, 14, 44);
  el('path', { d: glassD, fill: '#15282b' }, body);
  const clip = def('clipPath', { id: clipId }); el('path', { d: glassD }, clip);
  // the classic controls (decoration now: the game is played on the strings)
  el('path', { d: 'M93 448H131V486H167V524H131V562H93V524H57V486H93Z', fill: INK, stroke: '#fff', 'stroke-width': 8, 'stroke-linejoin': 'round' }, body);
  for (const [x, y] of [[392, 482], [328, 520]]) el('circle', { cx: x, cy: y, r: 25, fill: INK, stroke: '#fff', 'stroke-width': 8 }, body);
  const aLight = el('circle', { cx: 392, cy: 482, r: 20, fill: '#ff8a2b', opacity: 0 }, body);
  for (const x of [196, 270]) el('rect', { x: x - 24, y: 593, width: 48, height: 14, rx: 7, fill: 'none', stroke: '#fff', 'stroke-width': 6, transform: `rotate(-24 ${x} 600)` }, body);
  for (const k of [0, 1, 2]) el('path', { d: `M${396 + k * 22} 620L${414 + k * 22} 588`, stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round' }, body);

  /* ---- the screen: neck, frets, strings, targets, notes ---- */
  const screen = el('g', { 'clip-path': `url(#${clipId})` }, body);
  const nl = NECK.cx - NECK.wTop / 2, nr = NECK.cx + NECK.wTop / 2, bl = NECK.cx - NECK.wBot / 2, br = NECK.cx + NECK.wBot / 2;
  el('path', { d: `M${nl} ${NECK.yTop}H${nr}L${br} ${NECK.yBot}H${bl}Z`, fill: '#1d3d41' }, screen);
  el('path', { d: `M${nl} ${NECK.yTop}L${bl} ${NECK.yBot}M${nr} ${NECK.yTop}L${br} ${NECK.yBot}`, stroke: '#45d3b6', 'stroke-width': 3, opacity: 0.55 }, screen);
  const frets = el('g', { stroke: '#2e5b5e', 'stroke-width': 3 }, screen);
  const fretLines = Array.from({ length: 7 }, () => el('line', {}, frets));
  el('line', { x1: laneX(-0.6, NECK.yHit), y1: NECK.yHit, x2: laneX(3.6, NECK.yHit), y2: NECK.yHit, stroke: '#fff', 'stroke-width': 3, opacity: 0.35 }, screen);
  const lanes = [0, 1, 2, 3].map((i) => {
    const r = (widthAt(NECK.yHit) / 4) * 0.36;
    const x = laneX(i, NECK.yHit);
    const string = el('path', { fill: 'none', stroke: '#e9f4ff', 'stroke-width': 2.6 + i * 0.5, 'stroke-linecap': 'round' }, screen);
    const target = el('circle', { cx: x, cy: NECK.yHit, r, fill: '#15282b', stroke: LANE_COLOURS[i], 'stroke-width': 5, opacity: 0.95 }, screen);
    const fillT = el('circle', { cx: x, cy: NECK.yHit, r: r - 4, fill: LANE_COLOURS[i], opacity: 0, 'data-light': i }, screen);
    const ring = el('circle', { cx: x, cy: NECK.yHit, r, fill: 'none', stroke: LANE_COLOURS[i], 'stroke-width': 4, opacity: 0 }, screen);
    const name = el('text', { x, y: NECK.yHit + 8.5, 'text-anchor': 'middle', fill: '#fff', opacity: 0.9, class: 'pad-notename',
      style: 'font: 800 24px Archivo, system-ui, sans-serif' }, screen);   // the note this string plays, inside its target
    name.textContent = NOTE_NAMES[i];
    return { i, x, r, target, fillT, ring, string, amp: 0, pluckAt: -9, hitAt: -9 };
  });
  const noteLayer = el('g', {}, screen);
  const counter = el('text', { x: GLASS.x0 + 18, y: GLASS.y0 + 34, fill: '#fff', opacity: 0, style: 'font: 800 24px Archivo, system-ui, sans-serif' }, screen);

  /* ---- HTML controls over the drawing: the play zone, string names, Play / Stop / Resume ---- */
  const pct = (x, y) => { const [sx, sy] = toScene(x, y); return [(sx / L.view[0]) * 100, (sy / L.view[1]) * 100]; };
  const box = (n, x0, y0, x1, y1, inZone) => {
    if (inZone) {   // positions inside the zone, in % of the zone
      const gw = GLASS.x1 - GLASS.x0, gh = GLASS.y1 - GLASS.y0;
      Object.assign(n.style, { left: `${((x0 - GLASS.x0) / gw) * 100}%`, top: `${((y0 - GLASS.y0) / gh) * 100}%`, width: `${((x1 - x0) / gw) * 100}%`, height: `${((y1 - y0) / gh) * 100}%` });
      return;
    }
    const [a, b] = pct(x0, y0), [c, d] = pct(x1, y1);
    Object.assign(n.style, { left: `${a}%`, top: `${b}%`, width: `${c - a}%`, height: `${d - b}%` });
  };
  const ctrls = document.createElement('div');
  ctrls.className = 'pad-ctrls';
  const zone = document.createElement('div');
  zone.className = 'pad-zone';
  box(zone, GLASS.x0, GLASS.y0, GLASS.x1, GLASS.y1);
  ctrls.appendChild(zone);
  const stringBtns = lanes.map((ln) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pad-string';
    b.setAttribute('aria-label', `String ${ln.i + 1}, note ${NOTE_NAMES[ln.i]} (key ${KEYS[ln.i].toUpperCase()})`);
    if (ln.i) b.tabIndex = -1;
    const w = widthAt(NECK.yHit) / 4;
    box(b, ln.x - w / 2, NECK.yHit - 60, ln.x + w / 2, GLASS.y1, true);
    zone.appendChild(b);
    return b;
  });
  const btn = (cls, label) => { const b = document.createElement('button'); b.type = 'button'; b.className = `pad-btn ${cls}`; b.textContent = label; ctrls.appendChild(b); return b; };
  const playBtn = btn('pad-btn--play', 'Play');
  const stopBtn = btn('pad-btn--stop', '');
  stopBtn.setAttribute('aria-label', 'Stop the game');
  stopBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  const [pcx, pcy] = pct((GLASS.x0 + GLASS.x1) / 2, GLASS.y0 + 118);
  Object.assign(playBtn.style, { left: `${pcx}%`, top: `${pcy}%` });
  const [scx, scy] = pct(GLASS.x1 - 30, GLASS.y0 + 28);
  Object.assign(stopBtn.style, { left: `${scx}%`, top: `${scy}%` });
  const live = document.createElement('p');
  live.className = 'visually-hidden'; live.setAttribute('aria-live', 'polite');
  ctrls.appendChild(live);
  card.appendChild(ctrls);

  /* ---- the game, on one clock ---- */
  const now = () => performance.now() / 1000;
  const game = { state: 'idle', start: 0, pausedAt: 0, pausedTotal: 0, notes: [], hits: 0, endAt: 0 };
  let lastPlay = -99;
  const songTime = () => {
    if (game.state === 'idle') return -99;
    const ref = game.state === 'paused' ? game.pausedAt : game.state === 'done' ? game.doneAt : now();
    return ref - game.start - game.pausedTotal - LEAD;
  };
  const paint = () => {
    const st = game.state;
    playBtn.hidden = st === 'playing';
    playBtn.textContent = st === 'paused' ? 'Resume' : st === 'done' ? `${game.hits}/${SONG.length} · Play again` : 'Play';
    stopBtn.hidden = !(st === 'playing' || st === 'paused');
    card.classList.toggle('is-gaming', st === 'playing' || st === 'paused');
  };
  function startGame() {
    game.notes = SONG.map(([beat, lane]) => ({ t: FIRST + beat * BEAT, lane, state: 'pending', el: null, at: -9 }));
    noteLayer.replaceChildren();
    for (const n of game.notes) n.el = el('ellipse', { rx: 0, ry: 0, fill: LANE_COLOURS[n.lane], stroke: '#fff', 'stroke-width': 3, opacity: 0, class: 'pad-note' }, noteLayer);
    Object.assign(game, { state: 'playing', start: now(), pausedTotal: 0, hits: 0 });
    game.endAt = game.notes[game.notes.length - 1].t + 1.4;
    lastPlay = now();
    paint(); live.textContent = 'Game started. Pluck each string as its note reaches the target.';
    kick();
  }
  function stopGame() { game.state = 'idle'; noteLayer.replaceChildren(); paint(); live.textContent = 'Game stopped'; kick(); }
  function pause() { if (game.state !== 'playing') return; game.state = 'paused'; game.pausedAt = now(); paint(); live.textContent = 'Paused'; kick(); }
  function resume() { if (game.state !== 'paused') return; game.pausedTotal += now() - game.pausedAt; game.state = 'playing'; lastPlay = now(); paint(); kick(); }
  playBtn.addEventListener('click', () => {
    if (game.state === 'paused') { resume(); return; }
    startGame();                                  // the game never waits for audio
    sound.ensure();                               // pressing Play is deliberate: sound on, unless the visitor turned it off
    stringBtns[0].focus({ preventScroll: true });
  });
  stopBtn.addEventListener('click', () => { stopGame(); playBtn.focus({ preventScroll: true }); });

  // one pluck = at most one note: the closest waiting note on that string, within the window
  const plucked = [0, 0, 0, 0];                       // plucks per string (for checks)
  function pluck(lane, strength = 1, deliberate = true, delay = 0) {
    const ln = lanes[lane];
    plucked[lane]++;
    ln.pluckAt = now(); ln.amp = reduce.matches ? 0 : 7 * strength;
    lastPlay = now();
    card.classList.add('is-played');
    let hit = null;
    if (game.state === 'playing') {
      const t = songTime();
      for (const n of game.notes) {
        if (n.lane !== lane || n.state !== 'pending') continue;
        const d = Math.abs(n.t - t);
        if (d <= WINDOW && (!hit || d < Math.abs(hit.t - t))) hit = n;
      }
    }
    if (hit) { hit.state = 'hit'; hit.at = now(); game.hits++; ln.hitAt = now(); }
    card.dispatchEvent(new CustomEvent('sfx:played', { bubbles: true, detail: { kind: 'console' } }));   // the map's node answers (js/map.js)
    // a hit plays its melody note; out of a game the open string rings; a stray pluck in a game is
    // only a soft touch of the string
    const vel = hit ? 0.85 : game.state === 'playing' ? 0.16 : 0.7;
    const ring = () => { hideTip(); music.pluck(music.now() + delay, PITCH[lane], vel); };
    if (sound.live) ring();
    else if (deliberate) sound.ensure().then((ok) => ok && ring());   // the first press switches sound on
    // sound already chosen "on" and the visitor has pressed something on this page: the browser lets
    // a passing cursor wake the audio (after the tab was hidden, for example)
    else if (sound.on && navigator.userActivation?.hasBeenActive) sound.ensure().then((ok) => ok && ring());
    else showTip();
    kick();
    return !!hit;
  }

  // pointer: a string is plucked when the cursor passes across it, no click needed (the harp
  // principle); on a touch screen, when a finger swipes across it. A small dead zone either side of
  // each string keeps a resting or trembling cursor from plucking it again and again; crossing it
  // once more (either way) plucks it anew. Fast sweeps catch every string they pass, in order.
  const DEAD = 0.14;                                   // half the dead zone, in string spacings
  const toNeck = (e) => {
    const r = zone.getBoundingClientRect();
    const lx = GLASS.x0 + ((e.clientX - r.left) / r.width) * (GLASS.x1 - GLASS.x0);
    const ly = GLASS.y0 + ((e.clientY - r.top) / r.height) * (GLASS.y1 - GLASS.y0);
    const y = clamp(ly, NECK.yTop, NECK.yBot);
    return { f: (lx - (NECK.cx - widthAt(y) / 2)) / (widthAt(y) / 4) - 0.5,   // 0..3 across the strings at that depth
             inside: ly >= NECK.yTop - 8 && ly <= NECK.yBot + 8 };
  };
  const sideOf = (f, k, was) => (f - k > DEAD ? 1 : f - k < -DEAD ? -1 : was);
  const fresh = (f) => ({ f, sides: [0, 1, 2, 3].map((k) => sideOf(f, k, 0)) });
  const pointers = new Map();                          // pointerId -> { f, sides }
  const lastPluck = [-9, -9, -9, -9];
  const track = (e) => {
    const { f, inside } = toNeck(e);
    if (!inside) { pointers.delete(e.pointerId); return; }
    const st = pointers.get(e.pointerId);
    if (!st) { pointers.set(e.pointerId, fresh(f)); return; }
    const crossed = [];
    for (let k = 0; k < 4; k++) {
      const s = sideOf(f, k, st.sides[k]);
      if (st.sides[k] && s !== st.sides[k]) crossed.push(k);
      st.sides[k] = s;
    }
    crossed.sort((a, b) => Math.abs(a - st.f) - Math.abs(b - st.f));      // in the order the pointer met them
    st.f = f;
    crossed.forEach((k, i) => {
      if (now() - lastPluck[k] < 0.05) return;
      lastPluck[k] = now();
      pluck(k, 0.85, false, i * 0.014);            // a passing cursor never switches sound on by itself
    });
  };
  const onMove = (e) => {
    const all = e.getCoalescedEvents?.();                // every sample of a fast move, not only the last
    for (const ce of all?.length ? all : [e]) track(ce);
  };
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    // a press is deliberate: it may switch sound on (the browser allows audio from here on) and
    // plucks the string under it; on a touch screen it also starts the swipe
    const { f } = toNeck(e), lane = Math.round(clamp(f, 0, 3));
    if (e.pointerType !== 'mouse' || Math.abs(f - lane) < 0.45) { lastPluck[lane] = now(); pluck(lane); }
    else sound.ensure();
    pointers.set(e.pointerId, fresh(f));
  };
  const onGone = (e) => pointers.delete(e.pointerId);
  const onUp = (e) => { if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') pointers.delete(e.pointerId); };
  zone.addEventListener('pointerdown', onDown);
  zone.addEventListener('pointermove', onMove);
  zone.addEventListener('pointerup', onUp);
  zone.addEventListener('pointercancel', onGone);
  zone.addEventListener('pointerleave', onGone);
  stringBtns.forEach((b, i) => b.addEventListener('click', (e) => { if (e.detail === 0) pluck(i); }));

  // the strings answer silently until sound may play; then a small tip says how to hear them
  const tip = document.createElement('button');
  tip.type = 'button'; tip.className = 'pad-tip'; tip.hidden = true;
  const [tcx, tcy] = pct((GLASS.x0 + GLASS.x1) / 2, BEZEL.y1 + 31);
  Object.assign(tip.style, { left: `${tcx}%`, top: `${tcy}%` });
  ctrls.appendChild(tip);
  let tipTimer = 0;
  const hideTip = () => { tip.hidden = true; clearTimeout(tipTimer); };
  const showTip = () => {
    if (sound.chosenOff) return;                      // the visitor chose silence: no nagging
    tip.textContent = 'Click once to hear the strings';
    tip.hidden = false;
    clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 4000);
  };
  tip.addEventListener('click', () => { hideTip(); sound.enable(); });
  const offSound = sound.onChange((on) => { if (on) hideTip(); });

  // keyboard while the console has focus: D F J K pluck; never while typing anywhere
  const held = new Set();
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable]')) return;
    const lane = KEYS.indexOf((e.key || '').toLowerCase());
    if (lane < 0) return;
    e.preventDefault();
    if (e.repeat || held.has(lane)) return;
    held.add(lane);
    pluck(lane);
  };
  const onKeyUp = (e) => held.delete(KEYS.indexOf((e.key || '').toLowerCase()));
  card.addEventListener('keydown', onKey);
  card.addEventListener('keyup', onKeyUp);

  // pause when the tab is hidden or the card scrolls away; Resume continues where it stopped
  const onVis = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVis);
  const io = new IntersectionObserver(([en]) => { if (!en.isIntersecting) pause(); }, { threshold: 0.15 });
  io.observe(card);

  /* ---- drawing ---- */
  let L_cable = 0;
  const seg = 38;
  const measure = () => {
    L_cable = bands[0].getTotalLength();
    for (const b of bands) b.setAttribute('stroke-dasharray', `${seg} ${L_cable * 3}`);
    signal.setAttribute('stroke-dasharray', `46 ${L_cable * 3}`);
  };
  const T = { press: [0.7, 0.8], release: [1.05, 1.35], signal: [0.86, 1.34], rainbow: [1.5, 2.4], fade: [3.95, 4.85] };
  let demoT = -1;

  function render() {
    const t = now();
    if (!L_cable) measure();
    let busy = false;
    // the silent story (only while nobody plays)
    const quiet = game.state === 'idle' && t - lastPlay > 8;
    const d = quiet && !reduce.matches ? demoT : quiet && reduce.matches ? 3.4 : -1;
    let grow = 0, press = 0;
    if (d >= 0) {
      press = easeIn(span(d, ...T.press)) * (1 - easeOut(span(d, ...T.release)));
      const sg = span(d, ...T.signal);
      signal.setAttribute('opacity', sg > 0 && sg < 1 && !reduce.matches ? 1 : 0);
      signal.setAttribute('stroke-dashoffset', (-(L_cable - sg * (L_cable + 46))).toFixed(1));
      busFlash.setAttribute('opacity', Math.sin(Math.PI * span(d, T.signal[1] - 0.04, T.rainbow[0] + 0.2)).toFixed(3));
      const run = span(d, ...T.rainbow), pos = run * (L_cable + RAINBOW.length * seg);
      bands.forEach((b, i) => { b.setAttribute('stroke-dashoffset', (-(pos - (i + 1) * seg)).toFixed(1)); b.setAttribute('opacity', run > 0 && run < 1 ? 1 : 0); });
      const arrive = T.rainbow[0] + (T.rainbow[1] - T.rainbow[0]) * (L_cable / (L_cable + RAINBOW.length * seg));
      grow = d < arrive ? 0 : easeInOut(span(d, arrive, arrive + 1.2)) * (1 - easeInOut(span(d, ...T.fade)));
    } else {
      signal.setAttribute('opacity', 0); busFlash.setAttribute('opacity', 0);
      bands.forEach((b) => b.setAttribute('opacity', 0));
    }
    growCircle.setAttribute('r', (grow * 760).toFixed(1));
    colourBody.setAttribute('opacity', grow > 0 ? 0.9 : 0);
    aLight.setAttribute('opacity', press.toFixed(3));

    // frets slide towards the player on the beat while a game runs
    const st = songTime();
    const phase = game.state === 'idle' ? 0.35 : ((st / BEAT) % 1 + 1) % 1;
    fretLines.forEach((ln, k) => {
      const u = (k + phase) / fretLines.length;
      const y = depthY(u * 1.1);
      if (y > NECK.yBot) { ln.setAttribute('opacity', 0); return; }
      const w = widthAt(y) / 2;
      ln.setAttribute('x1', (NECK.cx - w).toFixed(1)); ln.setAttribute('x2', (NECK.cx + w).toFixed(1));
      ln.setAttribute('y1', y.toFixed(1)); ln.setAttribute('y2', y.toFixed(1));
      ln.setAttribute('opacity', (0.35 + 0.65 * u).toFixed(2));
    });

    // strings: a plucked string shivers and fades; a hit lights its target and sends a ring
    for (const ln of lanes) {
      const u = t - ln.pluckAt;
      const a = ln.amp * Math.exp(-u * 7) * Math.sin(u * 70);
      if (Math.abs(a) > 0.05) busy = true;
      const x0 = laneX(ln.i, NECK.yTop), x1 = laneX(ln.i, NECK.yBot), my = (NECK.yTop + NECK.yBot) / 2;
      ln.string.setAttribute('d', `M${x0.toFixed(1)} ${NECK.yTop}Q${((x0 + x1) / 2 + a * 2).toFixed(1)} ${my} ${x1.toFixed(1)} ${NECK.yBot}`);
      const glow = clamp(1 - u / 0.25);
      ln.string.setAttribute('stroke', glow > 0 ? LANE_COLOURS[ln.i] : '#e9f4ff');
      const h = t - ln.hitAt;
      ln.fillT.setAttribute('opacity', Math.max(glow * 0.45, h < 0.3 ? 0.9 * (1 - h / 0.3) : 0).toFixed(3));
      if (h < 0.4 && !reduce.matches) {
        ln.ring.setAttribute('r', (ln.r * (1 + h * 2.2)).toFixed(1));
        ln.ring.setAttribute('opacity', (1 - h / 0.4).toFixed(3));
      } else ln.ring.setAttribute('opacity', 0);
      if (glow > 0 || h < 0.4) busy = true;
    }

    // notes, all placed from one clock
    if (game.state !== 'idle') {
      for (const n of game.notes) {
        const u = 1 - (n.t - st) / LEAD;
        if (n.state === 'pending' && st - n.t > WINDOW) n.state = 'missed';
        if (u < 0 || (n.state === 'missed' && u > 1.32)) { n.el.setAttribute('opacity', 0); continue; }
        const y = depthY(u), w = widthAt(Math.min(y, NECK.yBot)) / 4;
        let r = w * 0.32, op = 1, fill = LANE_COLOURS[n.lane];
        if (n.state === 'hit') {
          const k = (t - n.at) / 0.25;
          if (k >= 1) { n.el.setAttribute('opacity', 0); continue; }
          r *= reduce.matches ? 1 : 1 + 0.6 * k; op = 1 - k; fill = '#fff';
        } else if (n.state === 'missed') op = clamp((1.32 - u) / 0.3) * 0.6;
        n.el.setAttribute('cx', laneX(n.lane, Math.min(y, NECK.yBot + 20)).toFixed(1));
        n.el.setAttribute('cy', (n.state === 'hit' ? NECK.yHit : y).toFixed(1));
        n.el.setAttribute('rx', r.toFixed(1)); n.el.setAttribute('ry', (r * 0.78).toFixed(1));
        n.el.setAttribute('fill', fill); n.el.setAttribute('opacity', op.toFixed(3));
      }
      if (game.state === 'playing') {
        busy = true;
        if (st > game.endAt) {
          game.state = 'done'; game.doneAt = now(); paint();
          live.textContent = `Finished: ${game.hits} of ${SONG.length} notes`;
        }
      }
      counter.textContent = `${game.hits}/${SONG.length}`;
      counter.setAttribute('opacity', 0.85);
    } else counter.setAttribute('opacity', 0);
    return busy;
  }

  let raf = 0, drivenAt = -1;
  const frame = () => { raf = 0; if (now() - drivenAt < 0.1) return; if (render()) raf = requestAnimationFrame(frame); };
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  paint();
  render();
  return {
    game: { get state() { return game.state; }, get hits() { return game.hits; }, notes: () => game.notes, songTime, pluck, start: startGame, tip, plucked },
    draw(t) { drivenAt = now(); demoT = t; render(); },
    dispose() {
      cancelAnimationFrame(raf); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      card.removeEventListener('keydown', onKey);
      card.removeEventListener('keyup', onKeyUp);
      offSound(); clearTimeout(tipTimer);
      ctrls.remove(); root.remove(); own.forEach((n) => n.remove());
    },
  };
}

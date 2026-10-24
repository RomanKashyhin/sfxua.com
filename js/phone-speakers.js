// The game in the hero phone (round O; round Q: light outline speakers): speakers pinned to the things that sound (the
// footsteps on the grass, the campfire, the tree; round S: each a short one-shot). A press plays a short example through the
// site's engine and the speaker shows a few sound waves while it plays; at rest they stay quiet. The name
// of each source is a small tooltip on hover or keyboard focus. Nothing plays by itself: a press is the
// only start, and the sound switch in the header still decides whether anything is heard. Round P: every
// source heard gives the game a little more colour (sound adds colour to the game).
import { music, sound } from './music/sound.js';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// a few footsteps on the grass: the same recordings as the boot (assets/foley/steps)
let grass = null;
async function grassSteps() {
  if (!grass) {
    grass = Promise.all([1, 2, 3].map(async (k) => {
      const r = await fetch(`assets/foley/steps/grass-${k}.wav`);
      return music.context.decodeAudioData(await r.arrayBuffer());
    })).catch(() => null);
  }
  return grass;
}
function play(buf, t, gain = 0.8, rate = 1) {
  const ctx = music.context;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = rate; g.gain.value = gain;
  src.connect(g).connect(sound.output);
  src.start(t);
  return src;
}

// Round S: each source is a short one-shot (0.6-1.5 s) that ends by itself; a new press stops the one still
// sounding and starts it again. Every source returns { dur, nodes } (the nodes, to stop them early).
const noise = (ctx, sec) => {
  const n = Math.round(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
};

// the tree (round W, the owner: black birds fly out of it and only the birds are heard): a small flock taking off,
// quick two-note chirps from three birds at slightly different pitches, no wind, 1.3 s
function tree(t0) {
  const ctx = music.context, dur = 1.3, nodes = [];
  const chirps = [[0.02, 3300, 1], [0.11, 3700, 1], [0.24, 2900, 0.8], [0.33, 3250, 0.8], [0.47, 4000, 0.9], [0.55, 3500, 0.9],
    [0.7, 3100, 0.7], [0.79, 3600, 0.7], [0.95, 3900, 0.55], [1.04, 3400, 0.5], [1.18, 3700, 0.35]];
  chirps.forEach(([dt, f, v]) => {
    const o = ctx.createOscillator(), og = ctx.createGain(), at = t0 + dt;
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.82, at); o.frequency.exponentialRampToValueAtTime(f * 1.32, at + 0.035); o.frequency.exponentialRampToValueAtTime(f * 1.05, at + 0.07);
    og.gain.setValueAtTime(0, at); og.gain.linearRampToValueAtTime(0.11 * v, at + 0.008); og.gain.exponentialRampToValueAtTime(0.0008, at + 0.075);
    o.connect(og).connect(sound.output); o.start(at); o.stop(at + 0.09);
    nodes.push(o);
  });
  return { dur, nodes };
}

// the campfire (round W, the owner: a clear fire sound, the picture of the fire glowing brighter): it catches with a
// soft low «фух», then a crackle of bright little pops over a quiet warm rumble that dies away, 1.1 s (the rumble is
// low-passed and quiet, so there is no hiss of noise behind it)
function fire(t0) {
  const ctx = music.context, dur = 1.1, nodes = [];
  const sr = ctx.sampleRate, n = Math.round(sr * dur);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < n; i++) {                                                     // the warm rumble of the flames
    lp += (Math.random() * 2 - 1 - lp) * 0.03;
    const tt = i / sr;
    d[i] = lp * 1.6 * Math.min(1, tt / 0.12) * Math.exp(-tt * 2.2);
  }
  const pops = 16;
  for (let c = 0; c < pops; c++) {                                                  // the crackle: sharp little pops
    const at = Math.floor(sr * (0.08 + (c / pops) * 0.85 + Math.random() * 0.05)), len = 40 + Math.floor(Math.random() * 220);
    const amp = (0.35 + Math.random() * 0.6) * (1 - (c / pops) * 0.55);
    for (let i = 0; i < len && at + i < n; i++) d[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / len) ** 4;
  }
  const src = ctx.createBufferSource(), hs = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; hs.type = 'highshelf'; hs.frequency.value = 2600; hs.gain.value = 3;
  g.gain.setValueAtTime(0.5, t0); g.gain.setValueAtTime(0.5, t0 + dur - 0.15); g.gain.linearRampToValueAtTime(0, t0 + dur);
  src.connect(hs).connect(g).connect(sound.output); src.start(t0); src.stop(t0 + dur);
  nodes.push(src);
  const o = ctx.createOscillator(), og = ctx.createGain();                         // the soft «фух» as it catches
  o.type = 'sine'; o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(55, t0 + 0.3);
  og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.22, t0 + 0.04); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  o.connect(og).connect(sound.output); o.start(t0); o.stop(t0 + 0.37);
  nodes.push(o);
  return { dur, nodes };
}

// what the picture does with the sound (round W): birds fly up out of the tree; the campfire glows brighter
function birds(world, x, y) {
  const flock = document.createElement('span');
  flock.className = 'spk-birds';
  flock.style.setProperty('--x', x); flock.style.setProperty('--y', y);
  // each bird: where it flies to (in its own widths), its delay, its size, and where in the crown it starts
  [[-70, -60, 0, 1, -20, 6], [-30, -88, 0.07, 0.9, -9, 14], [30, -80, 0.12, 1, 3, 9], [70, -56, 0.04, 0.85, 12, 16], [2, -104, 0.18, 0.8, -4, 22]].forEach(([dx, dy, dl, sc, sx, sy]) => {
    const bird = document.createElement('i');
    bird.style.setProperty('--dx', `${dx}%`); bird.style.setProperty('--dy', `${dy}%`); bird.style.setProperty('--dl', `${dl}s`); bird.style.setProperty('--s', sc);
    bird.style.setProperty('--sx', `${sx}%`); bird.style.setProperty('--sy', `${sy}%`);
    bird.innerHTML = '<svg viewBox="0 0 24 12"><path d="M0 6C4 1 8 1 12 6C16 1 20 1 24 6C20 4.5 16 5 12 10C8 5 4 4.5 0 6Z"/></svg>';
    flock.appendChild(bird);
  });
  world.appendChild(flock);
  setTimeout(() => flock.remove(), 2100);
}
function glow(world, x, y, dur) {
  world.querySelector('.spk-glow')?.remove();
  const g = document.createElement('span');
  g.className = 'spk-glow';
  g.style.setProperty('--x', x); g.style.setProperty('--y', y); g.style.setProperty('--dur', `${dur}s`);
  world.appendChild(g);
  setTimeout(() => g.remove(), dur * 1000 + 600);
}

// the footsteps (round W, the owner: prints that walk round the tree while the steps sound): from the prints already
// in the picture, left of the tree, one print per step on a loop round the trunk: in front of it, past its right side
// and behind it (where the trunk hides them) back to the left; left and right foot in turn, each turned the way it
// walks; they stay a moment and fade
const STEP_AT = [0, 0.28, 0.56, 0.84, 1.12, 1.4, 1.68, 1.96];
const RATIO = 731 / 1280;                                   // the scene's height to its width
const TRUNK = { l: 20.5, r: 31.5, b: 83 };                 // the trunk in the picture (% of its width and height)
function prints(world) {
  world.querySelector('.spk-steps')?.remove();
  const box = document.createElement('span');
  box.className = 'spk-steps';
  const cx = 26, cy = 81 * RATIO, rx = 13, ry = 5.5 * RATIO;   // round the trunk's foot (x and y both in % of the width)
  const at = (a) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  const a0 = 200 * Math.PI / 180, a1 = -140 * Math.PI / 180, n = 360, pts = [], len = [0];   // left, front, right, back
  for (let k = 0; k <= n; k++) pts.push(at(a0 + (a1 - a0) * k / n));
  for (let k = 1; k <= n; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  STEP_AT.forEach((dl, i) => {
    const want = len[n] * (i + 0.5) / STEP_AT.length;
    const k = Math.min(n - 1, len.findIndex((v) => v >= want));
    const [x, y] = pts[k], [x2, y2] = pts[k + 1];
    const dir = Math.atan2(y2 - y, x2 - x), side = i % 2 ? 1 : -1;            // left foot, right foot
    const px = x + Math.cos(dir + Math.PI / 2) * side * 1.2, py = (y + Math.sin(dir + Math.PI / 2) * side * 1.2) / RATIO;
    if (px > TRUNK.l && px < TRUNK.r && py < TRUNK.b) return;                // behind the trunk: heard, not seen
    const foot = document.createElement('i');
    foot.style.setProperty('--x', `${px.toFixed(2)}%`); foot.style.setProperty('--y', `${py.toFixed(2)}%`);
    foot.style.setProperty('--r', `${(dir * 180 / Math.PI + 90).toFixed(1)}deg`); foot.style.setProperty('--dl', `${dl}s`);
    foot.innerHTML = '<svg viewBox="0 0 10 16"><ellipse cx="5" cy="5.6" rx="4" ry="5.2"/><ellipse cx="5" cy="13.2" rx="3" ry="2.5"/></svg>';
    box.appendChild(foot);
  });
  world.appendChild(box);
  setTimeout(() => box.remove(), 3400);
}

const SOURCES = {
  // the footsteps: eight steps on the grass, one for each print round the tree (the boot's own recordings: each
  // sounds for about 0.26 s), 2.25 s
  async steps(t) {
    const takes = await grassSteps();
    if (!takes) return { dur: 0, nodes: [] };
    const nodes = STEP_AT.map((dt, i) => play(takes[i % takes.length], t + dt, 0.75, 0.96 + Math.random() * 0.08));
    return { dur: 2.25, nodes };
  },
  async fire(t) { return fire(t); },
  async tree(t) { return tree(t); },
};
const LENGTH = { steps: 2.25, fire: 1.1, tree: 1.3 };   // the picture lasts as long as the sound

export function initPhoneSpeakers(root = document) {
  const buttons = $$('[data-spk]', root);
  if (!buttons.length) return null;
  const timers = new Map();
  const wave = (btn, dur, restart = true) => {
    const li = btn.closest('.spk');
    if (restart || !li.classList.contains('is-playing')) {
      li.classList.remove('is-playing');
      void li.offsetWidth;
      li.classList.add('is-playing');
    }
    clearTimeout(timers.get(btn));
    timers.set(btn, setTimeout(() => li.classList.remove('is-playing'), dur * 1000));
  };
  const counts = {};
  // sound adds colour: the game starts a little muted and gains colour with every source that has played
  const phone = root.closest?.('.hero-phone') || root;
  const colour = () => {
    const heard = Object.keys(counts).length / buttons.length;
    phone.style.setProperty('--colour', heard.toFixed(3));
    phone.classList.toggle('is-full', heard >= 1);
  };
  // round R: the name stays inside the screen: above the speaker, or below it near the top edge, and moved
  // in from a side edge (it used to be cut by the screen's edge at the left source)
  const screen = phone.querySelector('.hero-phone__screen') || phone;
  const fitTip = (btn) => {
    const li = btn.closest('.spk'), tip = li?.querySelector('.spk__tip');
    if (!tip) return;
    li.style.removeProperty('--tip-dx');
    li.classList.remove('is-tip-below');
    const s = screen.getBoundingClientRect(), b = btn.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, m = 6;
    const ml = 26;   // on the left the phone's dark side bar lies over the screen's edge
    if (b.top - h - 8 < s.top + m) li.classList.add('is-tip-below');
    const cx = b.left + b.width / 2;
    const dx = Math.max(s.left + ml - (cx - w / 2), 0) + Math.min(s.right - m - (cx + w / 2), 0);
    li.style.setProperty('--tip-dx', `${dx.toFixed(1)}px`);
  };
  buttons.forEach((btn) => { btn.addEventListener('pointerenter', () => fitTip(btn)); btn.addEventListener('focus', () => fitTip(btn)); });
  const sounding = new Map();
  buttons.forEach((btn) => btn.addEventListener('click', async () => {
    const id = btn.dataset.spk;
    counts[id] = (counts[id] || 0) + 1;
    colour();
    wave(btn, LENGTH[id]);                                            // the speaker answers at once, as long as the sound
    const world = btn.closest('.hero-phone__world'), li = btn.closest('.spk');
    if (world && id === 'tree' && !matchMedia('(prefers-reduced-motion: reduce)').matches) birds(world, li.style.getPropertyValue('--x'), li.style.getPropertyValue('--y'));
    if (world && id === 'fire') glow(world, li.style.getPropertyValue('--x'), li.style.getPropertyValue('--y'), LENGTH.fire);
    if (world && id === 'steps') prints(world);
    if (!sound.live && !(await sound.ensure())) return;               // switched off by the visitor: picture only
    sounding.get(id)?.forEach((n) => { try { n.stop(); } catch { /* already ended */ } });   // a new press starts it again
    const { dur, nodes } = await SOURCES[id](music.now());
    sounding.set(id, nodes);
    if (dur) wave(btn, dur, false);                                   // ends with the sound, without a second start
  }));
  return { counts, fitTip };
}

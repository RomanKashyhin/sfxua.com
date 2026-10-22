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

// the tree: a light breeze through the leaves and one or two short chirps of a bird, 1.3 s
function tree(t0) {
  const ctx = music.context, dur = 1.3, nodes = [];
  const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise(ctx, dur); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(700, t0); bp.frequency.linearRampToValueAtTime(1300, t0 + 0.6); bp.frequency.linearRampToValueAtTime(800, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.35); g.gain.linearRampToValueAtTime(0.12, t0 + 0.8); g.gain.linearRampToValueAtTime(0, t0 + dur);
  src.connect(bp).connect(g).connect(sound.output); src.start(t0); src.stop(t0 + dur);
  nodes.push(src);
  // «цвірінь»: two quick upward sweeps, then a second pair a moment later
  [[0.32, 2900], [0.42, 3200], [0.7, 3000], [0.79, 3400]].forEach(([dt, f]) => {
    const o = ctx.createOscillator(), og = ctx.createGain(), at = t0 + dt;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * 1.45, at + 0.05); o.frequency.exponentialRampToValueAtTime(f * 1.1, at + 0.08);
    og.gain.setValueAtTime(0, at); og.gain.linearRampToValueAtTime(0.09, at + 0.012); og.gain.exponentialRampToValueAtTime(0.0008, at + 0.085);
    o.connect(og).connect(sound.output); o.start(at); o.stop(at + 0.1);
    nodes.push(o);
  });
  return { dur, nodes };
}

// the campfire: it catches with a soft whoosh, crackles and settles, 1 s
function fire(t0) {
  const ctx = music.context, dur = 1.0, nodes = [];
  const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise(ctx, dur); bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(260, t0); bp.frequency.exponentialRampToValueAtTime(1800, t0 + 0.28); bp.frequency.exponentialRampToValueAtTime(500, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.42, t0 + 0.18); g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.75); g.gain.linearRampToValueAtTime(0, t0 + dur);
  src.connect(bp).connect(g).connect(sound.output); src.start(t0); src.stop(t0 + dur);
  nodes.push(src);
  const n = Math.round(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let c = 0; c < 9; c++) {                                                      // the cracks: tiny bright clicks
    const at = Math.floor(ctx.sampleRate * (0.12 + Math.random() * 0.72)), len = 80 + Math.floor(Math.random() * 300), amp = 0.3 + Math.random() * 0.5;
    for (let i = 0; i < len && at + i < n; i++) d[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / len) ** 3;
  }
  const cr = ctx.createBufferSource(), hs = ctx.createBiquadFilter(), cg = ctx.createGain();
  cr.buffer = buf; hs.type = 'highshelf'; hs.frequency.value = 2400; hs.gain.value = 4; cg.gain.value = 0.45;
  cr.connect(hs).connect(cg).connect(sound.output); cr.start(t0);
  nodes.push(cr);
  return { dur, nodes };
}

const SOURCES = {
  // the footsteps: three steps on the grass (the boot's own recordings: each sounds for about 0.26 s), 0.9 s
  async steps(t) {
    const takes = await grassSteps();
    if (!takes) return { dur: 0, nodes: [] };
    const nodes = [0, 0.32, 0.64].map((dt, i) => play(takes[i % takes.length], t + dt, 0.75, 0.96 + Math.random() * 0.08));
    return { dur: 0.9, nodes };
  },
  async fire(t) { return fire(t); },
  async tree(t) { return tree(t); },
};
const LENGTH = { steps: 0.9, fire: 1.0, tree: 1.3 };   // the picture lasts as long as the sound

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
    if (!sound.live && !(await sound.ensure())) return;               // switched off by the visitor: picture only
    sounding.get(id)?.forEach((n) => { try { n.stop(); } catch { /* already ended */ } });   // a new press starts it again
    const { dur, nodes } = await SOURCES[id](music.now());
    sounding.set(id, nodes);
    if (dur) wave(btn, dur, false);                                   // ends with the sound, without a second start
  }));
  return { counts, fitTip };
}

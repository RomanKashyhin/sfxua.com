// The game in the hero phone (round O): small graphite speakers pinned to the things that sound (the
// footsteps on the grass, the campfire, the calm music). A press plays a short example through the
// site's engine and the speaker shows a few sound waves while it plays; at rest they stay quiet. The name
// of each source is a small tooltip on hover or keyboard focus. Nothing plays by itself: a press is the
// only start, and the sound switch in the header still decides whether anything is heard.
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

// a campfire: soft low rumble of the flames and a few dry crackles (synthesised)
function campfire(t0, dur = 1.8) {
  const ctx = music.context;
  const n = Math.round(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += (Math.random() * 2 - 1 - lp) * 0.02;                     // the rumble: brown-ish noise
    const env = Math.min(1, i / (ctx.sampleRate * 0.25)) * Math.min(1, (n - i) / (ctx.sampleRate * 0.5));
    d[i] = lp * 0.9 * env;
  }
  for (let c = 0; c < 18; c++) {                                     // the crackles: tiny bright clicks
    const at = Math.floor(Math.random() * (n - 800));
    const len = 120 + Math.floor(Math.random() * 500), amp = 0.25 + Math.random() * 0.55;
    for (let i = 0; i < len; i++) d[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / len) ** 3;
  }
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'highshelf'; f.frequency.value = 2400; f.gain.value = 4; g.gain.value = 0.55;
  src.connect(f).connect(g).connect(sound.output);
  src.start(t0);
  return dur;
}

const SOURCES = {
  async steps(t) {
    const takes = await grassSteps();
    if (!takes) return 0;
    [0, 0.42, 0.84, 1.26].forEach((dt, i) => play(takes[i % takes.length], t + dt, 0.75, 0.96 + Math.random() * 0.08));
    return 1.7;
  },
  async fire(t) { return campfire(t); },
  async music(t) {                                                   // a calm phrase on the marimba
    [[0, 0], [0.32, 2], [0.64, 4], [1.12, 3], [1.6, 2]].forEach(([dt, deg]) => music.marimba(t + dt, music.degree(deg, 5), 0.5));
    return 2.2;
  },
};

export function initPhoneSpeakers(root = document) {
  const buttons = $$('[data-spk]', root);
  if (!buttons.length) return null;
  const timers = new Map();
  const wave = (btn, dur) => {
    const li = btn.closest('.spk');
    li.classList.remove('is-playing');
    void li.offsetWidth;
    li.classList.add('is-playing');
    clearTimeout(timers.get(btn));
    timers.set(btn, setTimeout(() => li.classList.remove('is-playing'), dur * 1000));
  };
  const counts = {};
  buttons.forEach((btn) => btn.addEventListener('click', async () => {
    const id = btn.dataset.spk;
    counts[id] = (counts[id] || 0) + 1;
    wave(btn, 1.4);                                                   // the speaker answers at once
    if (!sound.live && !(await sound.ensure())) return;               // switched off by the visitor: picture only
    const dur = await SOURCES[id](music.now());
    if (dur) wave(btn, dur);
  }));
  return { counts };
}

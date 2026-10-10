// One sound engine for the whole site (music-kit's music.js, unchanged) and the one switch that
// controls it. Rules:
//   - nothing plays on page load; the Web Audio context starts only from a click, tap or key press;
//   - hovering never switches sound on; until the visitor has chosen, a deliberate press on an
//     instrument (a piano key, a surface under the boot) does, and the switch shows it;
//   - once the visitor switches sound off, presses stay silent (the pictures still react) until
//     they switch it back on;
//   - switching off stops everything at once; the choice is remembered, but even when it was "on"
//     the next visit stays silent until the visitor touches something;
//   - hiding the tab stops everything.
import { createMusic } from './music.js';

const KEY = 'sfx-sound';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private mode: not remembered */ } };

// C major pentatonic, 100 BPM: the piano's white keys (C major) sit in the same key as every toy.
export const music = createMusic({ bpm: 100, root: 'C', scale: 'majorPentatonic', volume: 0.7 });

// After the engine's own compressor: a tone filter (the gamepad stick moves it; centred it is
// transparent) and a safety limiter, so piano, drums and footsteps together never clip.
// Built once, the first time the engine starts, on the engine's own AudioContext.
let post = null;
function wire() {
  const ctx = music.context;
  if (post || !ctx) return post;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 20; hp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = 0.7;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const meter = ctx.createAnalyser(); meter.fftSize = 2048;          // what actually leaves the site
  music.analyser.disconnect();
  music.analyser.connect(hp).connect(lp).connect(limiter).connect(ctx.destination);
  limiter.connect(meter);
  post = { hp, lp, limiter, meter };
  return post;
}
async function startEngine() { await music.start(); wire(); }

let on = read() === 'on';
let chosenOff = read() === 'off';     // the visitor switched sound off on purpose
const listeners = new Set();
const stoppers = new Set();
const emit = () => listeners.forEach((fn) => fn(on));

function stopAll() {
  stoppers.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  if (post) sound.setTone(0, 0);
  document.dispatchEvent(new CustomEvent('soundfx:stop-audio'));   // the case-page audio player (js/audio.js)
}

export const sound = {
  get on() { return on; },
  /** true when a note can sound right now (switch on and the audio context running) */
  get live() { return on && music.running; },
  /** true when the visitor switched sound off on purpose */
  get chosenOff() { return chosenOff; },
  async enable({ logo = false } = {}) {
    const was = on;
    on = true; chosenOff = false; write('on'); if (!was) emit();
    await startEngine();
    if (logo) sonicLogo();
  },
  disable() {
    on = false; chosenOff = true; write('off');
    stopAll();
    if (music.context) music.stop();
    emit();
  },
  toggle() { return on ? this.disable() : this.enable({ logo: true }); },
  /** call from a deliberate press: switches sound on unless the visitor turned it off;
   *  resolves true when a note may play now */
  async ensure() {
    if (!on) {
      if (chosenOff) return false;
      await this.enable();
    } else if (!music.running) await startEngine();
    return true;
  },
  /** where sounds that are not the engine's instruments go (the footsteps): the safety limiter */
  get output() { return wire()?.limiter || music.context?.destination; },
  /** the stick's tone: x, y in -1..1 (centre = unchanged). Down darkens (low-pass to ~650 Hz), up thins
   *  the low end (high-pass to ~700 Hz), sideways adds a gentle resonance. Every extreme stays soft. */
  setTone(x = 0, y = 0) {
    const p = wire();
    if (!p) return;
    const t = music.context.currentTime, k = 0.035;
    const down = Math.max(0, Math.min(1, y)), up = Math.max(0, Math.min(1, -y));
    p.lp.frequency.setTargetAtTime(18000 * Math.pow(650 / 18000, down), t, k);
    p.hp.frequency.setTargetAtTime(20 * Math.pow(700 / 20, up), t, k);
    const q = 0.7 + 2.6 * Math.min(1, Math.abs(x));
    p.lp.Q.setTargetAtTime(q, t, k);
    p.hp.Q.setTargetAtTime(q, t, k);
  },
  /** the highest sample leaving the site right now (0..1), after the limiter (for checks) */
  peak() { if (!post) return 0; const d = new Float32Array(post.meter.fftSize); post.meter.getFloatTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); return m; },
  /** where the tone filter is right now (for checks): low-pass and high-pass cut-offs, resonance */
  get tone() { return post ? { lp: post.lp.frequency.value, hp: post.hp.frequency.value, q: post.lp.Q.value } : null; },
  /** fn(on) on every change; returns unsubscribe */
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** register something that plays on its own (a loop, a phrase): fn stops it; returns unregister */
  addStopper(fn) { stoppers.add(fn); return () => stoppers.delete(fn); },
};

/** a short "mic check" motif to confirm sound is on (music-kit's sonicLogo, softer) */
function sonicLogo() {
  const t = music.now();
  [0, 3, 5, 2].forEach((d, i) => music.marimba(t + i * 0.11, music.degree(d, i < 2 ? 4 : 5), 0.45));
}

// Remembered "on": wake the audio context silently on the first gesture of this visit, so the
// console's strings answer a passing cursor. Nothing is played here.
const wake = () => { if (on && !music.running) startEngine(); };
['pointerdown', 'keydown'].forEach((type) => document.addEventListener(type, wake, { capture: true, passive: true }));

document.addEventListener('visibilitychange', () => {
  if (document.hidden && music.running) { stopAll(); music.stop(); }
});

/** wires every [data-sound-toggle] switch (role=switch, name "Sound") to the engine */
export function initSoundToggles(root = document) {
  const buttons = [...root.querySelectorAll('[data-sound-toggle]')];
  const paint = () => buttons.forEach((b) => {
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('is-on', on);
    const state = b.querySelector('[data-sound-state]');
    if (state) state.textContent = on ? 'on' : 'off';
  });
  buttons.forEach((b) => b.addEventListener('click', () => sound.toggle()));
  sound.onChange(paint);
  paint();
}

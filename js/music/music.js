// music-kit · music.js
// A tiny, dependency-free Web Audio engine for playful site music. No audio files: every sound
// is synthesized (Karplus-Strong plucks, FM bells, pads, bass, drums) and goes through a shared
// reverb + compressor, so anything users trigger stays in key, in time and never clips.
//
//   const m = createMusic({ bpm: 100, root: 'D', scale: 'majorPentatonic' });
//   button.onclick = () => m.start();                  // audio needs a user gesture
//   m.onStep((step, time) => { if (step % 4 === 0) m.kick(time); });
//   m.pluck(m.now(), m.degree(3, 4));                  // 4th note of the scale, octave 4

export const SCALES = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10]
};
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function createMusic({ bpm = 100, root = 'D', scale = 'majorPentatonic', volume = 0.8 } = {}) {
  let ctx = null, master, comp, analyser, dry, revIn;
  const buses = {};
  const st = { bpm, root: NOTE[root] ?? 2, scale: SCALES[scale] || SCALES.majorPentatonic, running: false };
  const listeners = new Set();
  let nextTime = 0, step = 0, timer = null, noise = null;
  const ks = new Map();

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds), buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = volume;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.7;
    dry = ctx.createGain();
    const rev = ctx.createConvolver(); rev.buffer = impulse(2.8, 3);
    revIn = ctx.createGain();
    dry.connect(master); revIn.connect(rev).connect(master);
    master.connect(comp).connect(analyser).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    for (const [name, wet, gain] of [['pluck', 0.35, 0.9], ['bell', 0.4, 0.55], ['pad', 0.55, 0.32], ['bass', 0.08, 0.75], ['drums', 0.12, 0.9], ['fx', 0.3, 0.6]]) {
      const g = ctx.createGain(); g.gain.value = gain; g.connect(dry);
      const s = ctx.createGain(); s.gain.value = wet; g.connect(s).connect(revIn);
      buses[name] = g;
    }
  }
  const env = (g, t, peak, attack, decay, floor = 0.0001) => {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(floor, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, floor * 2), t + attack);
    g.gain.exponentialRampToValueAtTime(floor, t + attack + decay);
  };

  /* ---------- instruments ---------- */
  function ksBuffer(midi) {
    if (ks.has(midi)) return ks.get(midi);
    const sr = ctx.sampleRate, f = mtof(midi), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 1.8);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = (Math.random() + Math.random() - 1);   // softer, slightly low-passed burst
    const damp = 0.996 - Math.min(0.01, f / 200000);
    for (let i = 0, k = 0; i < len; i++) {
      const v = ring[k], n = ring[(k + 1) % N];
      d[i] = v; ring[k] = (v + n) * 0.5 * damp; k = (k + 1) % N;
    }
    ks.set(midi, buf);
    return buf;
  }
  function pluck(time, midi, vel = 0.8) {
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(midi);
    const g = ctx.createGain(); g.gain.value = 0.55 * vel;
    src.connect(g).connect(buses.pluck); src.start(time); src.stop(time + 1.8);
  }
  function bell(time, midi, vel = 0.7, { ratio = 3.5, index = 4, decay = 1.6 } = {}) {
    const f = mtof(midi), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, time); mg.gain.exponentialRampToValueAtTime(f * 0.05, time + decay * 0.6);
    mod.connect(mg).connect(car.frequency);
    env(g, time, 0.5 * vel, 0.004, decay);
    car.connect(g).connect(buses.bell);
    car.start(time); mod.start(time); car.stop(time + decay + 0.1); mod.stop(time + decay + 0.1);
  }
  function marimba(time, midi, vel = 0.7) { bell(time, midi, vel, { ratio: 4, index: 1.6, decay: 0.55 }); }
  function pad(time, midis, dur = 2, vel = 0.6) {
    for (const m of midis) {
      const f = mtof(m), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, time); lp.frequency.linearRampToValueAtTime(1600, time + dur * 0.5); lp.Q.value = 0.4;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.16 * vel, time + Math.min(0.6, dur * 0.4));
      g.gain.setValueAtTime(0.16 * vel, time + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 1.2);
      for (const [type, det] of [['triangle', -7], ['sawtooth', 7]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
        const og = ctx.createGain(); og.gain.value = type === 'sawtooth' ? 0.35 : 1;
        o.connect(og).connect(lp); o.start(time); o.stop(time + dur + 1.3);
      }
      lp.connect(g).connect(buses.pad);
    }
  }
  function bass(time, midi, dur = 0.4, vel = 0.8) {
    const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sine'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, time); lp.frequency.exponentialRampToValueAtTime(220, time + 0.25);
    env(g, time, 0.7 * vel, 0.008, dur);
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(buses.bass);
    o.start(time); o2.start(time); o.stop(time + dur + 0.1); o2.stop(time + dur + 0.1);
  }
  function kick(time, vel = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, time); o.frequency.exponentialRampToValueAtTime(45, time + 0.16);
    env(g, time, 1 * vel, 0.002, 0.38);
    o.connect(g).connect(buses.drums); o.start(time); o.stop(time + 0.45);
  }
  function noiseHit(time, { type = 'highpass', freq = 7000, q = 0.7, peak = 0.35, decay = 0.06, offset = Math.random() * 0.5 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, time, peak, 0.001, decay);
    s.connect(f).connect(g).connect(buses.drums); s.start(time, offset); s.stop(time + decay + 0.05);
  }
  function hat(time, vel = 0.6, open = false) { noiseHit(time, { peak: 0.32 * vel, decay: open ? 0.28 : 0.05 }); }
  function snare(time, vel = 0.8) {
    noiseHit(time, { type: 'bandpass', freq: 1800, q: 0.6, peak: 0.6 * vel, decay: 0.18 });
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(220, time); o.frequency.exponentialRampToValueAtTime(140, time + 0.08);
    env(g, time, 0.4 * vel, 0.002, 0.1); o.connect(g).connect(buses.drums); o.start(time); o.stop(time + 0.15);
  }
  function clap(time, vel = 0.8) {
    for (let i = 0; i < 3; i++) noiseHit(time + i * 0.012, { type: 'bandpass', freq: 1200, q: 0.9, peak: 0.45 * vel, decay: i === 2 ? 0.16 : 0.02 });
  }
  function shaker(time, vel = 0.5) { noiseHit(time, { freq: 9000, peak: 0.18 * vel, decay: 0.035 }); }

  /* ---------- clock ---------- */
  const stepDur = () => 60 / st.bpm / 4;          // a 16th note
  function tick() {
    while (nextTime < ctx.currentTime + 0.12) {
      for (const fn of listeners) { try { fn(step, nextTime); } catch (e) { console.error(e); } }
      nextTime += stepDur(); step++;
    }
  }

  return {
    get context() { return ctx; },
    get analyser() { return analyser; },
    get running() { return st.running; },
    get bpm() { return st.bpm; },
    set bpm(v) { st.bpm = v; },
    get step() { return step; },
    /** call from a click/keydown; resumes audio and starts the 16th-note clock */
    async start() {
      if (!ctx) build();
      if (ctx.state !== 'running') await ctx.resume();
      if (!timer) { nextTime = ctx.currentTime + 0.08; step = 0; timer = setInterval(tick, 25); }
      st.running = true;
    },
    stop() { clearInterval(timer); timer = null; st.running = false; ctx?.suspend(); },
    now() { return ctx ? ctx.currentTime + 0.01 : 0; },
    /** subscribe to the clock: fn(step, time) for every 16th; returns unsubscribe */
    onStep(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** time of the next bar start (16 steps), for quantized entries */
    nextBar() { const s = stepDur(), stepsLeft = (16 - (step % 16)) % 16; return nextTime + stepsLeft * s; },
    stepDur,
    setKey(rootName, scaleName) { if (rootName in NOTE) st.root = NOTE[rootName]; if (SCALES[scaleName]) st.scale = SCALES[scaleName]; },
    /** scale degree (0 = root, can be negative or > scale length) → MIDI note */
    degree(d, octave = 4) {
      const n = st.scale.length, o = Math.floor(d / n), i = ((d % n) + n) % n;
      return 12 * (octave + 1 + o) + st.root + st.scale[i];
    },
    /** triad on a degree of the MAJOR scale of the current root, e.g. chord(0) = I, chord(5) = vi */
    chord(deg, octave = 3) {
      const maj = SCALES.major, at = d => 12 * (octave + 1 + Math.floor(d / 7)) + st.root + maj[((d % 7) + 7) % 7];
      return [at(deg), at(deg + 2), at(deg + 4)];
    },
    pluck, bell, marimba, pad, bass, kick, snare, hat, clap, shaker,
    /** 0..1 levels of the whole mix (for visuals): { level, low, mid, high } */
    levels() {
      if (!analyser) return { level: 0, low: 0, mid: 0, high: 0 };
      const d = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(d);
      const hz = ctx.sampleRate / analyser.fftSize, band = (a, b) => { let s = 0, n = 0; for (let i = Math.floor(a / hz); i <= Math.min(d.length - 1, Math.ceil(b / hz)); i++) { s += d[i]; n++; } return n ? s / n / 255 : 0; };
      const low = band(30, 200), mid = band(200, 2000), high = band(2000, 9000);
      return { level: (low + mid + high) / 3, low, mid, high };
    },
    /** render a pattern offline into an AudioBuffer (e.g. a loop for a turntable to scratch) */
    async render(seconds, writer) {
      if (!ctx) build();
      const off = new OfflineAudioContext(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
      const sub = createOfflineVoices(off);
      writer(sub);
      return off.startRendering();
    }
  };
}

/* A minimal instrument set bound to an OfflineAudioContext (for pre-rendering loops). */
function createOfflineVoices(ctx) {
  const out = ctx.createGain(); out.gain.value = 0.8; out.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const env = (g, t, p, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  return {
    kick(t, v = 1) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.16); env(g, t, v, 0.002, 0.38); o.connect(g).connect(out); o.start(t); o.stop(t + 0.45); },
    hat(t, v = 0.5) { const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); env(g, t, 0.3 * v, 0.001, 0.05); s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + 0.1); },
    snare(t, v = 0.8) { const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); env(g, t, 0.6 * v, 0.001, 0.18); s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + 0.25); },
    bass(t, midi, d = 0.3) { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(midi); lp.type = 'lowpass'; lp.frequency.value = 500; env(g, t, 0.45, 0.006, d); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); },
    stab(t, midis, d = 0.25) { for (const m of midis) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = mtof(m); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; env(g, t, 0.09, 0.005, d); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); } },
    chip(t, midi, d = 0.12) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = mtof(midi); env(g, t, 0.12, 0.003, d); o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); },
    pad(t, midis, d = 2) { for (const m of midis) { const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = mtof(m); lp.type = 'lowpass'; lp.frequency.value = 1200; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + d * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + d); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); } },
    bell(t, midi, d = 1.2) { const f = mtof(midi), c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(); c.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.5, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + d * 0.6); m.connect(mg).connect(c.frequency); env(g, t, 0.18, 0.004, d); c.connect(g).connect(out); c.start(t); m.start(t); c.stop(t + d + 0.05); m.stop(t + d + 0.05); }
  };
}

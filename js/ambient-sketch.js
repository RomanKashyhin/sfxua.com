// "Hear it change" (#ambient): a concept sketch of the ambient module's behaviour, synthesized in the
// browser. It shows the structure, not the final content and not the Unity engine:
//   - a shared base (air) that keeps playing across places and is never doubled;
//   - place layers (forest: leaves, a stream, birds; coast: surf, gulls) that crossfade in ~3 s when
//     the place changes;
//   - details as separate events at varied times, picked from small pools with no immediate repeats
//     and a little pitch and level variation;
//   - rain as an add-on that changes the state: it fades in over the base, and the birds and gulls
//     grow rarer and quieter while it rains.
// Nothing plays until the visitor presses Play. The site's Sound switch, a hidden tab or Stop end it.
// Levels are kept moderate and everything goes through the site's safety limiter.
import { music, sound } from './music/sound.js';

const $ = (s, r = document) => r.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (pool, last) => { let k; do { k = Math.floor(Math.random() * pool.length); } while (pool.length > 2 && last.includes(k)); return k; };

const LAYERS = [
  { id: 'air', name: 'Air', kind: 'base', places: ['forest', 'coast'] },
  { id: 'leaves', name: 'Leaves', kind: 'details', places: ['forest'] },
  { id: 'stream', name: 'Stream', kind: 'base', places: ['forest'] },
  { id: 'birds', name: 'Birds', kind: 'details', places: ['forest'] },
  { id: 'surf', name: 'Surf', kind: 'base', places: ['coast'] },
  { id: 'gulls', name: 'Gulls', kind: 'details', places: ['coast'] },
  { id: 'rain', name: 'Rain', kind: 'add-on', places: ['forest', 'coast'] },
];

export function initAmbientSketch() {
  const root = $('[data-sketch]');
  if (!root) return null;
  const playBtn = $('[data-sketch-play]', root), rainBtn = $('[data-sketch-rain]', root), placeSeg = $('[data-sketch-place]', root);
  const list = $('[data-sketch-layers]', root);
  list.innerHTML = LAYERS.map((l) => `<li data-layer="${l.id}"><span class="sk-name">${l.name}</span><span class="sk-kind">${l.kind}</span><span class="sk-meter"><span></span></span></li>`).join('');
  const rows = Object.fromEntries(LAYERS.map((l) => [l.id, $(`[data-layer="${l.id}"]`, list)]));

  let place = 'forest', rain = false, eng = null;
  const level = Object.fromEntries(LAYERS.map((l) => [l.id, 0]));   // shown on the meters (0..1)
  const flash = Object.fromEntries(LAYERS.map((l) => [l.id, 0]));

  const paintButtons = () => {
    playBtn.setAttribute('aria-pressed', String(!!eng));
    playBtn.textContent = eng ? 'Stop' : 'Play';
    rainBtn.setAttribute('aria-pressed', String(rain));
    placeSeg.querySelectorAll('[data-place]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.place === place)));
    LAYERS.forEach((l) => rows[l.id].classList.toggle('is-off', !(l.places.includes(place) && (l.id !== 'rain' || rain))));
  };

  /* ---- the engine: built on Play, torn down on Stop ---- */
  function build() {
    const ctx = music.context;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(sound.output);
    out.gain.setTargetAtTime(0.85, ctx.currentTime, 0.4);
    const len = ctx.sampleRate * 4, nb = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = nb.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {   // soft pink-ish noise (Kellet's economy filter)
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
      }
    }
    const nodes = [];
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.loopStart = Math.random() * 3; s.start(ctx.currentTime, Math.random() * 3); nodes.push(s); return s; };
    const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const pan = (p) => { const n = ctx.createStereoPanner(); n.pan.value = p; return n; };
    const lfo = (rate, depth, target) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g).connect(target); o.start(); nodes.push(o); };

    // base: the air, shared by both places
    const air = gain(0);
    noise().connect(filt('highpass', 90)).connect(filt('lowpass', 750, 0.4)).connect(air).connect(out);
    lfo(0.07, 0.012, air.gain);
    // forest: a stream on the left, leaves as rustles (details), birds (details)
    const stream = gain(0);
    for (const [f, rate] of [[1150, 0.31], [2400, 0.47]]) {
      const g = gain(0.5); noise().connect(filt('bandpass', f, 1.4)).connect(g); lfo(rate, 0.25, g.gain); g.connect(stream);
    }
    stream.connect(pan(-0.55)).connect(out);
    const leavesBus = gain(1); leavesBus.connect(out);
    const birdsBus = gain(1); birdsBus.connect(out);
    // coast: the surf in slow swells, gulls (details)
    const surf = gain(0); const surfBody = gain(0.5), surfHiss = gain(0.12);
    noise().connect(filt('lowpass', 520, 0.5)).connect(surfBody).connect(surf);
    noise().connect(filt('highpass', 2600)).connect(surfHiss).connect(surf);
    surf.connect(out);
    const gullsBus = gain(1); gullsBus.connect(out);
    // add-on: rain, a hiss bed plus drops
    const rainBed = gain(0);
    noise().connect(filt('highpass', 1400)).connect(filt('lowpass', 9000)).connect(rainBed).connect(out);
    const dropsBus = gain(0); dropsBus.connect(out);

    const bed = { air, stream, surf, rainBed };
    const BED = { air: 0.09, stream: 0.05, surf: 1, rainBed: 0.07 };
    const setBeds = (fade = 1.0) => {
      const t = ctx.currentTime;
      air.gain.setTargetAtTime(BED.air, t, fade);
      stream.gain.setTargetAtTime(place === 'forest' ? BED.stream : 0, t, fade);
      surf.gain.setTargetAtTime(place === 'coast' ? BED.surf : 0, t, fade);
      rainBed.gain.setTargetAtTime(rain ? BED.rainBed : 0, t, 0.8);
      dropsBus.gain.setTargetAtTime(rain ? 1 : 0, t, 0.8);
    };

    /* details */
    const cents = (c) => Math.pow(2, c / 1200);
    const lastBird = [], lastGull = [];
    const BIRDS = [
      (t, k, g, p) => { for (let i = 0; i < 4; i++) chirp(t + i * 0.13, 3300 * k, 4300 * k, 0.07, g, p); },          // quick tweets
      (t, k, g, p) => { for (let i = 0; i < 9; i++) chirp(t + i * 0.055, (i % 2 ? 4100 : 3600) * k, (i % 2 ? 4000 : 3700) * k, 0.035, g * 0.8, p); },   // a trill
      (t, k, g, p) => { chirp(t, 2700 * k, 2050 * k, 0.26, g, p); chirp(t + 0.34, 2900 * k, 2950 * k, 0.09, g * 0.8, p); },   // a two-note whistle
      (t, k, g, p) => { warble(t, 3400 * k, 0.42, g * 0.85, p); },                                                   // a warble
      (t, k, g, p) => { chirp(t, 4600 * k, 3500 * k, 0.05, g, p); chirp(t + 0.1, 4600 * k, 3500 * k, 0.05, g, p); chirp(t + 0.32, 3900 * k, 4500 * k, 0.12, g, p); },
    ];
    function chirp(t, f0, f1, dur, g, p) {
      const o = ctx.createOscillator(), e = gain(0), pn = pan(p);
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(e).connect(pn).connect(birdsBus); o.start(t); o.stop(t + dur + 0.02);
    }
    function warble(t, f, dur, g, p) {
      const o = ctx.createOscillator(), v = ctx.createOscillator(), vg = gain(f * 0.08), e = gain(0), pn = pan(p);
      o.frequency.value = f; v.frequency.value = 28; v.connect(vg).connect(o.frequency);
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + 0.04); e.gain.setValueAtTime(g, t + dur - 0.08); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(e).connect(pn).connect(birdsBus); o.start(t); v.start(t); o.stop(t + dur + 0.02); v.stop(t + dur + 0.02);
    }
    function gull(t, k, g, p) {
      const calls = Math.random() < 0.5 ? 2 : 3;
      for (let i = 0; i < calls; i++) {
        const s = t + i * rnd(0.42, 0.55), o = ctx.createOscillator(), v = ctx.createOscillator(), vg = gain(26), bp = filt('bandpass', 1500 * k, 2.2), e = gain(0), pn = pan(p);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(1250 * k, s); o.frequency.linearRampToValueAtTime(1650 * k, s + 0.06); o.frequency.exponentialRampToValueAtTime(880 * k, s + 0.36);
        v.frequency.value = 22; v.connect(vg).connect(o.frequency);
        e.gain.setValueAtTime(0.0001, s); e.gain.exponentialRampToValueAtTime(g, s + 0.04); e.gain.exponentialRampToValueAtTime(0.0001, s + 0.38);
        o.connect(bp).connect(e).connect(pn).connect(gullsBus); o.start(s); v.start(s); o.stop(s + 0.4); v.stop(s + 0.4);
      }
    }
    function rustle(t, g, p) {
      const s = ctx.createBufferSource(); s.buffer = nb; const bp = filt('bandpass', rnd(3200, 5200), 0.9), e = gain(0), pn = pan(p);
      const dur = rnd(0.6, 1.4);
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + dur * 0.35); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp).connect(e).connect(pn).connect(leavesBus); s.start(t, Math.random() * 3, dur + 0.05);
    }
    function drop(t) {
      const s = ctx.createBufferSource(); s.buffer = nb; const bp = filt('bandpass', rnd(1800, 5200), 3), e = gain(0), pn = pan(rnd(-0.8, 0.8));
      const g = rnd(0.05, 0.16);
      e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      s.connect(bp).connect(e).connect(pn).connect(dropsBus); s.start(t, Math.random() * 3, 0.04);
    }
    // the surf breathes in slow swells, each one a little different
    let nextWave = ctx.currentTime + 0.2;
    const wave = (t) => {
      const up = rnd(1.8, 2.6), down = rnd(3.2, 4.4), peak = rnd(0.11, 0.17);
      surfBody.gain.setTargetAtTime(peak, t, up / 3); surfBody.gain.setTargetAtTime(0.035, t + up, down / 3);
      surfHiss.gain.setTargetAtTime(peak * 0.9, t + up * 0.7, 0.3); surfHiss.gain.setTargetAtTime(0.01, t + up * 0.7 + 0.6, 0.9);
      return t + up + down * rnd(0.7, 1);
    };

    const next = { bird: ctx.currentTime + rnd(0.6, 2), gull: ctx.currentTime + rnd(1, 3), leaves: ctx.currentTime + rnd(1, 3), drop: ctx.currentTime };
    const fire = (id) => { flash[id] = 1; };
    const tick = () => {
      const t = ctx.currentTime, ahead = t + 0.25;
      const calm = rain ? 0.6 : 1, rare = rain ? 2.6 : 1;      // the rain changes the state: creatures grow rarer and quieter
      if (place === 'forest') {
        while (next.bird < ahead) {
          const k = pick(BIRDS, lastBird); lastBird.push(k); if (lastBird.length > 2) lastBird.shift();
          BIRDS[k](next.bird, cents(rnd(-40, 40)), 0.05 * calm * rnd(0.8, 1.15), rnd(-0.7, 0.7));
          setTimeout(() => fire('birds'), Math.max(0, (next.bird - t) * 1000));
          next.bird += rnd(3.5, 9) * rare;
        }
        while (next.leaves < ahead) {
          rustle(next.leaves, (rain ? 0.05 : 0.035) * rnd(0.8, 1.2), rnd(-0.6, 0.6));
          setTimeout(() => fire('leaves'), Math.max(0, (next.leaves - t) * 1000));
          next.leaves += rnd(2.5, 7) / (rain ? 1.6 : 1);
        }
      } else {
        next.bird = Math.max(next.bird, t + 1.5); next.leaves = Math.max(next.leaves, t + 1);
        while (next.gull < ahead) {
          gull(next.gull, cents(rnd(-50, 50)), 0.035 * calm * rnd(0.8, 1.1), rnd(-0.6, 0.6));
          setTimeout(() => fire('gulls'), Math.max(0, (next.gull - t) * 1000));
          next.gull += rnd(6, 13) * rare;
        }
        while (nextWave < ahead) nextWave = wave(nextWave);
      }
      if (place === 'forest') next.gull = Math.max(next.gull, t + 2);
      if (rain) {
        while (next.drop < ahead) { drop(next.drop); next.drop += -Math.log(1 - Math.random()) / 14; }
        flash.rain = Math.max(flash.rain, 0.5);
      } else next.drop = t;
    };
    const timer = setInterval(tick, 90);
    tick();
    setBeds(0.2);
    return {
      setBeds, bed,
      stop() {
        clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, 0.15);
        setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* done */ } }); out.disconnect(); }, 900);
      },
    };
  }

  /* ---- meters: what plays now ---- */
  let raf = 0;
  const meter = () => {
    raf = 0;
    if (!eng) { LAYERS.forEach((l) => { rows[l.id].style.setProperty('--lv', 0); }); return; }
    const active = (id) => LAYERS.find((l) => l.id === id).places.includes(place) && (id !== 'rain' || rain);
    for (const l of LAYERS) {
      const base = l.kind === 'details' ? 0.12 : active(l.id) ? 0.7 : 0;
      level[l.id] += ((active(l.id) ? base : 0) - level[l.id]) * 0.06;
      flash[l.id] *= 0.93;
      const v = Math.min(1, level[l.id] + (active(l.id) ? flash[l.id] * 0.85 : 0));
      rows[l.id].style.setProperty('--lv', v.toFixed(3));
    }
    raf = requestAnimationFrame(meter);
  };

  const stop = () => { if (!eng) return; eng.stop(); eng = null; paintButtons(); };
  sound.addStopper(stop);
  sound.onChange((v) => { if (!v) stop(); });
  playBtn.addEventListener('click', async () => {
    if (eng) { stop(); return; }
    if (!(await sound.ensure())) { const m = $('[data-sketch-muted]', root); m.hidden = false; setTimeout(() => { m.hidden = true; }, 5000); return; }
    eng = build(); paintButtons();
    if (!raf) raf = requestAnimationFrame(meter);
  });
  placeSeg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-place]');
    if (!b || b.dataset.place === place) return;
    place = b.dataset.place; paintButtons(); eng?.setBeds(1.0);
  });
  rainBtn.addEventListener('click', () => { rain = !rain; paintButtons(); eng?.setBeds(1.0); });
  paintButtons();
  return { get playing() { return !!eng; }, get place() { return place; }, get rain() { return rain; }, level, flash };
}

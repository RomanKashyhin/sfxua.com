// Studio pictures: three small scenes that play by themselves (always silently) and answer the
// visitor: the boot over four surfaces (js/studio-foley.js), the keyboard (js/studio-piano.js) and
// the handheld console as a little instrument (js/studio-console.js). All drawn in vector around
// one ComfyUI bitmap (the boot), so they stay crisp at any size.
import { buildPiano } from './studio-piano.js';
import { buildFoleyStage } from './studio-foley.js';
import { buildConsolePad } from './studio-console.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

const BUILD = { foley: buildFoleyStage, keys: buildPiano, console: buildConsolePad };

export function mountScene(container, name) {
  const svg = el('svg', { viewBox: '0 0 1024 768', class: 'principle__svg', 'aria-hidden': 'true', focusable: 'false' });
  const defs = el('defs', {}, svg);
  container.appendChild(svg);
  const scene = BUILD[name](svg, defs, container);
  return { svg, ...scene };
}

// Runs the three cards: each animates only while on screen, with its cycle offset so they never
// hit at the same time. With reduced motion every card shows its third phase and stays still.
export function initStudioScenes(cards, { reduce = false, offsets = [0, 1.55, 3.1] } = {}) {
  const scenes = cards.map((card, i) => {
    const s = mountScene(card, card.dataset.scene);
    s.card = card;
    card.__scene = s;          // for checks (tools/qa.mjs) and debugging
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

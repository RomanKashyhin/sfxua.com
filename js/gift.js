// The gift at the end of the How we work route.
//   - Moving the cursor over it shakes it a little: a spring tilt nudged by the cursor's speed,
//     capped, settling back on its own. Nothing has to be held, and a fast mouse never piles up
//     motions: there is one spring, not one animation per move.
//   - A click, a tap, Enter or Space opens it (no shaking needed): the lid flies off and a card with
//     −10% comes out. After a moment the page takes the visitor to the contact form, once.
//   - The bonus is then shown in the form and goes with the request (a hidden field and a line in the
//     email the form composes). It is remembered in this browser, so a reload keeps it.
//   - Reduced motion: no shaking, the card simply appears. A short chime only when sound is already on.
// Texts are English here; js/i18n.js switches them like everything else.
import { music, sound } from './music/sound.js';

const KEY = 'sfx-gift';
const VALUE = 'Gift: 10% off the first project, any package';
const remembered = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode: only this visit */ } };

/** show (or hide) the bonus in the contact form and put it in the request */
export function applyBonusToForm(on = remembered()) {
  const banner = document.querySelector('[data-bonus]');
  const field = document.querySelector('[data-bonus-field]');
  if (banner) banner.hidden = !on;
  if (field) field.value = on ? VALUE : '';
}

export function initGift({ reduce }) {
  applyBonusToForm();
  const root = document.querySelector('[data-gift]');
  if (!root) return null;
  const box = root.querySelector('[data-gift-open]');
  const live = root.querySelector('[data-gift-live]');

  /* ---- the shake ---- */
  let tilt = 0, vel = 0, hop = 0, hopV = 0, raf = 0, last = 0, lastX = null, lastT = 0;
  // on the whole gift: the box tilts and hops, its shadow on the ground answers the hop
  const paint = () => { root.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`); root.style.setProperty('--hop', `${hop.toFixed(2)}px`); };
  const step = (ts) => {
    const dt = Math.min(0.033, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    vel += (-150 * tilt - 10 * vel) * dt;           // spring back to straight, with a little damping
    tilt = Math.max(-6, Math.min(6, tilt + vel * dt));
    hopV += (-280 * hop - 18 * hopV) * dt;
    hop = Math.max(-7, Math.min(0, hop + hopV * dt));
    paint();
    if (Math.abs(tilt) < 0.04 && Math.abs(vel) < 0.08 && Math.abs(hop) < 0.04 && Math.abs(hopV) < 0.08) {
      tilt = vel = hop = hopV = 0; paint(); raf = 0; return;
    }
    raf = requestAnimationFrame(step);
  };
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };
  box.addEventListener('pointermove', (e) => {
    if (reduce.matches || root.classList.contains('is-open')) return;
    if (lastX != null && e.timeStamp - lastT < 120) {
      const v = (e.clientX - lastX) / Math.max(8, e.timeStamp - lastT);     // px per ms
      vel = Math.max(-70, Math.min(70, vel + v * 80));                       // a nudge, capped
      hopV = Math.max(-60, hopV - Math.min(24, Math.abs(v) * 30));
      kick();
    }
    lastX = e.clientX; lastT = e.timeStamp;
  });
  box.addEventListener('pointerleave', () => { lastX = null; });

  /* ---- opening ---- */
  let opened = false, pending = 0;
  const goToForm = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('f-name')?.focus({ preventScroll: true }), reduce.matches ? 0 : 900);
  };
  const chime = () => { const t = music.now(); [0, 2, 4, 7].forEach((d, i) => music.marimba(t + i * 0.08, music.degree(d, 5), 0.5)); };
  box.addEventListener('click', () => {
    if (pending) return;                              // on its way to the form already: one trip only
    if (opened) { goToForm(); return; }               // opened before: a click simply takes you there
    opened = true;
    root.classList.add('is-open');
    box.setAttribute('aria-label', 'Your gift: 10% off your first project');
    tilt = vel = hop = hopV = 0; paint();
    remember();
    applyBonusToForm(true);
    live.textContent = '10% off your first project with any package. Taking you to the contact form.';
    if (sound.live) chime();
    pending = setTimeout(() => { pending = 0; goToForm(); }, reduce.matches ? 1000 : 2000);
  });
  // opened on an earlier visit: shown open, no trip
  if (remembered()) {
    opened = true;
    root.classList.add('is-open', 'is-still');
    box.setAttribute('aria-label', 'Your gift: 10% off your first project');
  }
  return { state: () => ({ opened, open: root.classList.contains('is-open'), pending: !!pending, tilt: +tilt.toFixed(2), shaking: !!raf }) };
}

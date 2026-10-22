// The team on the first screen (round P, 22.10.2026): three people on three places, a big one in the middle
// and two calmer ones at the sides, that swap round in a circle. Drag or swipe sideways anywhere on the
// team (not on the fur of the microphone: that turns the microphone), press a side person to bring them to
// the middle, use the two small buttons, or the arrow keys when the team has focus. Each person moves with
// their own things; the role under the team follows the person in the middle. Nothing moves by itself.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initTeamCarousel({ reduce, t = (s) => s } = {}) {
  const root = $('[data-team]');
  if (!root) return null;
  const people = $$('[data-member]', root);
  const N = people.length;
  const role = $('[data-team-role]', root);
  const live = $('[data-team-live]', root);
  const ROLE = { rec: 'Recording and sound effects', mix: 'Music and sound tuning', test: 'Integration and testing in the game' };
  // places: k = -1 left, 0 middle, +1 right; between them the person glides; past ±1 they fade and come
  // back on the other side, so the circle has no jump
  const SPREAD = () => (root.clientWidth < 520 ? 0.33 : 0.31);
  let pos = +(root.dataset.start || 0), target = pos, vel = 0, raf = 0, last = 0;
  const wrap = (k) => { let x = ((k + N / 2) % N + N) % N - N / 2; if (x >= N / 2) x -= N; return x; };

  const place = () => {
    const spread = SPREAD();
    people.forEach((el, i) => {
      const k = wrap(i - pos);
      const a = Math.min(1, Math.abs(k));
      const x = 50 + k * spread * 100;
      const s = 1 - 0.24 * a;
      const fade = Math.abs(k) <= 1 ? 1 : Math.max(0, 1 - (Math.abs(k) - 1) * 2);
      el.style.left = `${x.toFixed(2)}%`;
      el.style.transform = `translateX(-50%) scale(${s.toFixed(4)})`;
      el.style.opacity = fade.toFixed(3);
      el.style.zIndex = String(Math.round((1 - a) * 10) + 1);
      el.classList.toggle('is-centre', Math.abs(k) < 0.5);
      el.setAttribute('aria-hidden', String(Math.abs(k) >= 0.5));
    });
    const centre = ((Math.round(pos) % N) + N) % N;
    if (root.dataset.centre !== String(centre)) {
      root.dataset.centre = String(centre);
      const id = people[centre].dataset.member;
      if (role) role.textContent = t(ROLE[id]);
      if (live) live.textContent = t(ROLE[id]);
      root.dispatchEvent(new CustomEvent('team:centre', { detail: { id } }));
    }
  };
  const tick = (now) => {
    const dt = Math.min(0.04, (now - last) / 1000 || 0.016);
    last = now;
    vel += (-(pos - target) * 90 - vel * 17) * dt;
    pos += vel * dt;
    if (Math.abs(pos - target) < 0.0015 && Math.abs(vel) < 0.003) { pos = target; vel = 0; place(); raf = 0; return; }
    place();
    raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (reduce?.matches) { pos = target; vel = 0; root.classList.add('is-swapping'); place(); setTimeout(() => root.classList.remove('is-swapping'), 180); return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  };
  const go = (d) => { target = Math.round(target) + d; kick(); };
  const goTo = (i) => { const k = wrap(i - Math.round(target)); target = Math.round(target) + k; kick(); };

  // drag / swipe: the direction decides after a few pixels; vertical stays with the page
  let drag = null;
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('[data-no-swipe], button, a')) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: pos, mode: null, x: e.clientX, t: e.timeStamp, v: 0 };
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.mode) {
      if (Math.hypot(dx, dy) < 12) return;
      drag.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (drag.mode === 'y') { drag = null; return; }
      root.setPointerCapture(e.pointerId);
      root.classList.add('is-dragging');
      cancelAnimationFrame(raf); raf = 0;
    }
    const unit = root.clientWidth * SPREAD();
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = drag.v * 0.6 + (-(e.clientX - drag.x) / unit / dt) * 1000 * 0.4;
    drag.x = e.clientX; drag.t = e.timeStamp;
    pos = drag.p0 - dx / unit;
    target = pos;
    place();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.mode === 'x') {
      root.classList.remove('is-dragging');
      // a swipe past a third of a place, or a quick flick, moves one place; never more than one at a time
      const moved = pos - d.p0;
      const step = Math.abs(moved) > 0.33 || Math.abs(d.v) > 1.2 ? Math.sign(Math.abs(moved) > 0.33 ? moved : d.v) : 0;
      target = Math.round(d.p0) + step;
      vel = 0;
      kick();
      root.dataset.justDragged = '1';
      setTimeout(() => { delete root.dataset.justDragged; }, 60);
    }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  // a press on a side person brings them to the middle (a press, not the end of a drag)
  people.forEach((el, i) => el.addEventListener('click', (e) => {
    if (root.dataset.justDragged || e.target.closest('[data-no-swipe]')) return;
    if (!el.classList.contains('is-centre')) goTo(i);
  }));
  $('[data-team-prev]', root)?.addEventListener('click', () => go(-1));
  $('[data-team-next]', root)?.addEventListener('click', () => go(1));
  root.addEventListener('keydown', (e) => {
    if (e.target !== root) return;
    const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!k) return;
    e.preventDefault();
    go(k);
  });
  place();
  return { get pos() { return pos; }, get centre() { return people[((Math.round(pos) % N) + N) % N].dataset.member; }, go, goTo };
}

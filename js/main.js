import { SITE, PROJECTS } from './content.js';
import { micLayout, STILL } from './mic-layout.js';
import { initSoundToggles } from './music/sound.js';
import { t } from './i18n.js';   // the language layer itself starts in js/i18n-boot.js

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const phone = matchMedia('(max-width: 760px)');
const stacked = matchMedia('(max-width: 1024px)');
const strip = matchMedia('(max-width: 900px)');
const params = new URLSearchParams(location.search);

/* ---------- header ---------- */
function initHeader() {
  const head = $('.site-head');
  const toggle = $('.menu-toggle');
  const setOpen = (open) => {
    head.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  $('#site-nav').addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && head.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });

  const links = new Map($$('.site-nav a').map((a) => [a.hash.slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((a, id) => {
        if (id === entry.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });

  // The glass bar follows the section underneath it: dark over Work, ink button over the pink contact block.
  const themed = $$('main > section, .site-foot');
  const headIO = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) head.dataset.theme = entry.target.dataset.head || '';
  }, { rootMargin: '-40px 0px -92% 0px' });
  themed.forEach((el) => headIO.observe(el));

  // Smooth scrolling only for clicks, so arriving on a #hash lands instantly.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip') || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const el = a.hash.length > 1 && document.getElementById(a.hash.slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    history.pushState(null, '', a.hash);
  });
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) links.forEach((a) => a.removeAttribute('aria-current'));
  }, { rootMargin: '-45% 0px -50% 0px' }).observe($('.hero'));
}

/* ---------- hero word ---------- */
function fitHeroWord() {
  const word = $('.hero-word');
  const lines = $$('.hero-word__line', word);
  word.style.fontSize = '100px';
  const widths = lines.map((l) => l.getBoundingClientRect().width);
  const text = phone.matches ? Math.max(...widths) : widths.reduce((a, b) => a + b, 0);
  const avail = word.clientWidth * (phone.matches ? 0.94 : 0.975);
  // Fill the width, but never grow so tall that the word runs into the copy below.
  const box = stacked.matches ? $('.hero__stage').clientHeight * 0.42 : $('.hero').clientHeight * 0.28;
  word.style.fontSize = `${Math.min((100 * avail) / text, phone.matches ? Infinity : box)}px`;
}

/* ---------- microphone ---------- */
// Hardware WebGL only: software renderers would block the page for seconds per frame.
function webglAvailable() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch { return false; }
}

function initMic() {
  const hero = $('.hero');
  const stage = $('.hero__stage');
  const canvas = $('.mic-canvas');
  const still = $('.mic-still');

  const placeStill = () => {
    const L = micLayout(stage.clientWidth, stage.clientHeight, stacked.matches);
    const k = L.ppu / STILL.ppu;
    still.style.setProperty('--still-w', `${STILL.w * k}px`);
    still.style.setProperty('--still-x', `${L.ax - STILL.ax * k}px`);
    still.style.setProperty('--still-y', `${L.ay - STILL.ay * k}px`);
  };
  placeStill();
  const hideBroken = () => { still.hidden = true; };
  if (still.complete && !still.naturalWidth) hideBroken();
  else still.addEventListener('error', hideBroken, { once: true });

  const exporting = params.has('still');
  if (!exporting && (reduceMotion.matches || !webglAvailable())) {
    new ResizeObserver(placeStill).observe(stage);
    return;
  }

  const boot = async () => {
    let mic;
    try {
      const { createMic } = await import('./mic.js');
      const lite = phone.matches || (navigator.hardwareConcurrency || 8) <= 4;
      mic = await createMic(canvas, { lite: exporting ? false : lite, compact: exporting ? false : stacked.matches, still: exporting });
    } catch (err) {
      console.warn('3D microphone unavailable, keeping the still.', err);
      return;
    }
    if (exporting) { exportStill(mic); return; }
    if (params.has('debug')) window.__mic = mic;

    const size = () => { mic.resize(stage.clientWidth, stage.clientHeight); placeStill(); };
    size();
    new ResizeObserver(size).observe(stage);
    mic.step(0);
    mic.render();
    // Fade the canvas in over the identical still, then drop the still and start turning.
    let ready = false;
    const settle = () => { if (ready) return; ready = true; hero.classList.add('is-mic-live', 'is-mic-ready'); update(); };
    if (canvas.animate) canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' }).finished.then(settle, settle);
    else settle();

    let running = false, raf = 0, last = 0, visible = true;
    // Quality guard. Browsers slow animation frames down on their own in background tabs,
    // unfocused panes and battery saver; that says nothing about the GPU. The old guard read
    // those slow frames as a weak GPU and thinned the fur for good (down to 20 layers), which
    // showed up as long, stepped strands. Now it times the GPU where the browser allows it,
    // otherwise counts only steady frames of a visible page; steps: pixel ratio 1, then fewer fur shells, then the still.
    const gl = mic.renderer.getContext();
    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const samples = [];
    let level = 0, query = null, tick = 0;
    const fallBack = () => {
      ready = false; running = false; cancelAnimationFrame(raf);
      hero.classList.remove('is-mic-live', 'is-mic-ready');
      mic.dispose();
    };
    const judge = (ms, limit) => {
      if (params.has('debug')) return;
      samples.push(ms);
      if (samples.length < 60) return;
      const sorted = samples.splice(0).sort((a, b) => a - b);
      if (sorted[sorted.length >> 1] <= limit) return;
      level += 1;
      if (level === 1) { mic.renderer.setPixelRatio(1); size(); }
      else if (level === 2) mic.setShells(24);              // fur kit: 24 of 40 shells (quality 0.6, as the kit suggests for weak GPUs)
      else fallBack();
    };
    const frame = (now) => {
      const ms = now - last;
      const dt = Math.min(0.05, ms / 1000);
      last = now;
      mic.step(dt);
      if (timer) {
        if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
          if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) judge(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6, 22);
          gl.deleteQuery(query);
          query = null;
        }
        const measure = !query && ++tick % 4 === 0;
        if (measure) { query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); }
        mic.render();
        if (measure) gl.endQuery(timer.TIME_ELAPSED_EXT);
      } else {
        mic.render();
        if (document.visibilityState === 'visible' && ms < 100) judge(ms, 40);
      }
      if (ready) raf = requestAnimationFrame(frame);
    };
    const update = () => {
      const want = ready && visible && !document.hidden;
      if (want === running) return;
      running = want;
      if (want) { last = performance.now(); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }).observe(stage);
    document.addEventListener('visibilitychange', update);
    update();

    // hover slows the turntable, drag spins it, a tap gives it a squash
    let over = false, drag = null, pending = null;
    const setOver = (v) => {
      if (v === over) return;
      over = v;
      mic.setHover(v);
      hero.classList.toggle('is-over-mic', v);
    };
    stage.addEventListener('pointermove', (e) => {
      if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.x;
        const dt = (e.timeStamp - drag.t) / 1000;
        drag.x = e.clientX; drag.t = e.timeStamp; drag.moved += Math.abs(dx);
        if (drag.moved > 4) { mic.state.dragging = true; hero.classList.add('is-dragging-mic'); }
        mic.dragBy(dx, dt);
        return;
      }
      if (e.pointerType !== 'mouse') return;
      pending = e;
      requestAnimationFrame(() => { if (pending) { setOver(mic.hit(pending.clientX, pending.clientY)); pending = null; } });
    });
    stage.addEventListener('pointerleave', (e) => { if (!drag && e.pointerType === 'mouse') setOver(false); });
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !mic.hit(e.clientX, e.clientY)) return;
      drag = { id: e.pointerId, x: e.clientX, t: e.timeStamp, moved: 0 };
      stage.setPointerCapture(e.pointerId);
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved <= 4 && e.type === 'pointerup') mic.poke();
      drag = null;
      mic.state.dragging = false;
      hero.classList.remove('is-dragging-mic');
      if (e.pointerType !== 'mouse') setOver(false);
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
  };

  if (exporting) boot();
  else if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 1200 });
  else setTimeout(boot, 300);
}

// ?still=1: renders the key pose with a real alpha channel and saves it through the dev server.
async function exportStill(mic) {
  const W = 1600, H = 1000, dpr = 2;
  mic.renderer.setPixelRatio(dpr);
  mic.resize(W, H);
  // ?still=1&turn=N: N evenly spaced angles of the head, same crop each time, for checking a full turn.
  if (params.has('turn')) {
    const n = +params.get('turn') || 12;
    const L = micLayout(W, H, false);
    const cw = Math.round(L.ppu * 8.4 * dpr), ch = Math.round(L.ppu * 5 * dpr);
    const x0 = Math.round(L.ax * dpr - cw / 2), y0 = Math.round(L.ay * dpr - ch * 0.46);
    const crop = document.createElement('canvas');
    crop.width = cw; crop.height = ch;
    const g = crop.getContext('2d');
    const start = mic.state.angle;
    for (let i = 0; i < n; i++) {
      mic.state.angle = start + (i / n) * Math.PI * 2;
      mic.step(0); mic.render();
      g.clearRect(0, 0, cw, ch);
      g.drawImage(mic.renderer.domElement, x0, y0, cw, ch, 0, 0, cw, ch);
      const blob = await new Promise((r) => crop.toBlob(r, 'image/png'));
      await fetch(`/__save?name=turn-${String(i).padStart(3, '0')}.png`, { method: 'POST', body: blob });
    }
    document.title = `turn saved ${n}`;
    return;
  }
  for (let i = 0; i < 3; i++) { mic.step(0); mic.render(); }
  const src = mic.renderer.domElement;
  const probe = document.createElement('canvas');
  probe.width = src.width; probe.height = src.height;
  const g = probe.getContext('2d');
  g.drawImage(src, 0, 0);
  const { data } = g.getImageData(0, 0, probe.width, probe.height);
  let x0 = probe.width, y0 = probe.height, x1 = 0, y1 = 0;
  for (let y = 0; y < probe.height; y++) for (let x = 0; x < probe.width; x++) {
    if (data[(y * probe.width + x) * 4 + 3] > 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const pad = 12;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(probe.width - 1, x1 + pad); y1 = Math.min(probe.height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  const og = out.getContext('2d');
  og.drawImage(probe, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  // feather the outer 24px of alpha so faint shadow never ends in a hard edge
  og.globalCompositeOperation = 'destination-out';
  const f = 24;
  for (const [x, y, w, h, gx0, gy0, gx1, gy1] of [
    [0, 0, f, out.height, 0, 0, f, 0], [out.width - f, 0, f, out.height, out.width, 0, out.width - f, 0],
    [0, 0, out.width, f, 0, 0, 0, f], [0, out.height - f, out.width, f, 0, out.height, 0, out.height - f]]) {
    const g = og.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    og.fillStyle = g; og.fillRect(x, y, w, h);
  }
  og.globalCompositeOperation = 'source-over';
  const L = micLayout(W, H, false);
  const meta = { w: out.width, h: out.height, ax: +(L.ax * dpr - x0).toFixed(1), ay: +(L.ay * dpr - y0).toFixed(1), ppu: +(L.ppu * dpr).toFixed(3) };
  const save = async (name, blob) => fetch(`/__save?name=${name}`, { method: 'POST', body: blob });
  const blob = (type, q) => new Promise((r) => out.toBlob(r, type, q));
  await save('mic-still.webp', await blob('image/webp', 0.9));
  await save('mic-still.png', await blob('image/png'));
  await save('mic-still.json', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  document.title = 'still saved ' + JSON.stringify(meta);
  console.log('STILL', JSON.stringify(meta));
}

/* ---------- vinyl spin ---------- */
function spinner(el, period = 4800) {
  if (!el.animate) return { start() {}, stop() {} };
  const anim = el.animate([{ transform: 'rotate(0turn)' }, { transform: 'rotate(1turn)' }], { duration: period, iterations: Infinity });
  anim.pause();
  let rate = 0, goal = 0, raf = 0;
  const tick = () => {
    rate += (goal - rate) * (goal ? 0.06 : 0.1);   // spins up gently, settles a little faster
    if (Math.abs(goal - rate) < 0.004) rate = goal;
    anim.playbackRate = Math.max(rate, 0.0001);
    if (rate === 0) { anim.pause(); return; }
    if (rate !== goal) raf = requestAnimationFrame(tick);
  };
  return {
    start() {
      if (reduceMotion.matches) return;
      goal = 1; cancelAnimationFrame(raf);
      if (anim.playState !== 'running') { anim.playbackRate = Math.max(rate, 0.0001); anim.play(); }
      tick();
    },
    stop() { goal = 0; cancelAnimationFrame(raf); if (anim.playState === 'running') tick(); },
  };
}

/* ---------- work collection ---------- */
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.2 9.3h3.1l4.6-3.9c.6-.5 1.6-.1 1.6.7v11.8c0 .8-1 1.2-1.6.7l-4.6-3.9H3.2A1.2 1.2 0 0 1 2 13.5v-3a1.2 1.2 0 0 1 1.2-1.2z" fill="currentColor"/><path d="M15.4 9.1a4.1 4.1 0 0 1 0 5.8M18.2 6.4a7.9 7.9 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>';

const recordSummary = (p) => (p.kind === 'studio'
  ? 'SoundFX’s own record, kept apart from client work.'
  : p.case?.summary || p.about || (p.project ? `SoundFX has worked with ${p.title} on ${p.project}.` : `SoundFX has worked with ${p.title}. Project details coming soon.`));
const recordKind = (p) => (p.kind === 'studio' ? 'Studio record' : 'Client');

function sleeve(p) {
  if (p.kind === 'studio') {
    return `<span class="rec__cover rec__cover--studio" style="--cover:${esc(p.cover)}"><span class="rec__studio">${SPEAKER}<span>SoundFX</span></span></span>`;
  }
  const hex = (p.cover || '#fff').replace('#', '');
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
  // A finished sleeve image when there is one; if it fails, the logo (or the name) on the cover colour.
  return `<span class="rec__cover${dark ? ' is-dark' : ''}${p.art || p.logo ? '' : ' is-missing'}${p.art ? ' has-art' : ''}" style="--cover:${esc(p.cover)}; --logo-scale:${p.logoScale || 1}">
      ${p.art ? `<img class="rec__art" src="${esc(p.art)}" alt="" loading="lazy" decoding="async" draggable="false">` : ''}
      ${p.logo ? `<img class="rec__logo" src="${esc(p.logo)}" alt="" loading="lazy" decoding="async" draggable="false">` : ''}
      <span class="rec__cover-name">${esc(p.title)}</span></span>`;
}

function recordMarkup(p, i) {
  return `
  <li class="rec rec--${p.kind}" data-i="${i}" style="--vinyl:${esc(p.vinyl)}">
    <div class="rec__visual">
      <button class="rec__hit" type="button" tabindex="-1" aria-label="${esc(p.title)}, ${recordKind(p).toLowerCase()}">
        <span class="rec__disc" aria-hidden="true"><span class="rec__spin"></span><span class="rec__gloss"></span></span>
        <span class="rec__jacket" style="--edge:${esc(p.cover || '#fff')}">${sleeve(p)}<span class="rec__film"></span></span>
      </button>
    </div>
    <div class="rec__info">
      <p class="rec__meta"><span class="chip ${p.kind === 'studio' ? 'chip--zest' : 'chip--sky'}">${recordKind(p)}</span></p>
      <h3 class="rec__name">${esc(p.title)}</h3>
      <p class="rec__summary">${esc(recordSummary(p))}</p>
      ${p.link ? `<p class="rec__link"><a href="${esc(p.link.href)}" target="_blank" rel="noopener">${esc(p.link.label)}<span class="visually-hidden"> (opens in a new tab)</span></a></p>` : ''}
      ${p.case ? `<button class="btn btn--zest btn--small" type="button" data-open-i="${i}">Open project</button>` : ''}
    </div>
  </li>`;
}

function initWork(openProject) {
  const list = $('[data-recs]');
  const stage = $('[data-stage]');
  const N = PROJECTS.length;
  list.innerHTML = PROJECTS.map(recordMarkup).join('');
  // a logo that fails to load leaves the company name on the sleeve instead of a broken image
  const onFail = (img, fn) => { if (img.complete && !img.naturalWidth) fn(); else img.addEventListener('error', fn, { once: true }); };
  $$('.rec__art', list).forEach((img) => onFail(img, () => img.parentElement.classList.remove('has-art')));
  $$('.rec__logo', list).forEach((img) => onFail(img, () => img.parentElement.classList.add('is-missing')));
  const items = $$('.rec', list);
  const spins = items.map((li) => spinner($('.rec__spin', li)));
  $('[data-hub-total]').textContent = N;

  const hub = {
    box: $('.hub__project'), index: $('[data-hub-index]'), kind: $('[data-hub-kind]'),
    name: $('[data-hub-name]'), summary: $('[data-hub-summary]'), open: $('[data-open]'), link: $('[data-hub-link]'),
  };
  let active = -1;
  const setActive = (i) => {
    if (i === active) return;
    if (active >= 0) { spins[active].stop(); items[active].classList.remove('is-active'); }
    active = i;
    items[i].classList.add('is-active');
    spins[i].start();
    const p = PROJECTS[i];
    hub.index.textContent = i + 1;
    hub.kind.textContent = recordKind(p);
    hub.kind.className = `chip ${p.kind === 'studio' ? 'chip--zest' : 'chip--sky'}`;
    hub.name.textContent = p.title;
    hub.summary.textContent = recordSummary(p);
    hub.link.hidden = !p.link;                // the official page, when there is one
    if (p.link) { hub.link.href = p.link.href; hub.link.firstChild.textContent = p.link.label; }
    hub.open.hidden = !p.case;       // no case material yet: no button that opens an empty page
    if (!reduceMotion.matches && hub.box.animate) {
      hub.box.animate([{ opacity: 0.25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' });
    }
  };

  // --- orbit (desktop) ---
  // A full ring around the hub: the selected record sits in front, below the hub;
  // the others travel up the sides and pass behind it, smaller and a little darker.
  const STEP = (2 * Math.PI) / Math.max(N, 3);
  const BACK = 0.52;   // scale of the record straight behind the hub
  let pos = 0, target = 0, vel = 0, looping = false, lastT = 0, dragging = false;
  const mod = (n) => ((n % N) + N) % N;
  const offset = (i, p) => { let k = i - p; k -= Math.round(k / N) * N; return k; };

  function layout() {
    if (strip.matches) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    const S = items[0].offsetWidth;
    const yFront = H - 14 - S / 2;
    const yBack = 6 + (S * BACK) / 2;
    const cx = W / 2, cy = (yFront + yBack) / 2, Ry = (yFront - yBack) / 2;
    const Rx = Math.min(W * 0.4, 600);
    items.forEach((li, i) => {
      const k = offset(i, pos);
      const a = k * STEP;
      const front = (Math.cos(a) + 1) / 2;      // 1 in front, 0 straight behind the hub
      const depth = 0.76 + 0.24 * front;           // far side of the ring draws in toward the middle
      const x = Math.sin(a) * Rx * depth - S * 0.22 * Math.max(0, 1 - Math.abs(k)) ** 2;   // room for the record sliding out
      const y = cy + Math.cos(a) * Ry;
      const scale = BACK + (1 - BACK) * front ** 1.1;
      li.style.transform = `translate(${cx + x - S / 2}px, ${y - S / 2}px) perspective(1100px) rotateY(${-Math.sin(a) * 24}deg) scale(${scale})`;
      li.style.zIndex = String(Math.round(front * 200));
      li.style.filter = `brightness(${(0.66 + 0.34 * front).toFixed(3)})`;
    });
    setActive(mod(Math.round(pos)));
  }

  const tick = (now) => {
    const dt = Math.min(0.04, (now - lastT) / 1000 || 0.016);
    lastT = now;
    if (!dragging) {
      vel += (-(pos - target) * 110 - vel * 19) * dt;
      pos += vel * dt;
      if (Math.abs(pos - target) < 0.0008 && Math.abs(vel) < 0.002) { pos = target; vel = 0; looping = false; }
    }
    layout();
    if (looping) requestAnimationFrame(tick);
  };
  const kick = () => {
    if (reduceMotion.matches) { pos = target; vel = 0; layout(); return; }
    if (!looping) { looping = true; lastT = performance.now(); requestAnimationFrame(tick); }
  };
  const go = (d) => {
    if (strip.matches) { scrollStrip(d); return; }
    target = Math.round(target) + d; kick();
  };
  const goTo = (i) => { const base = Math.round(pos); target = base + offset(i, base); kick(); };

  // --- strip (phones, tablets) ---
  const scrollStrip = (d) => {
    const next = items[Math.min(N - 1, Math.max(0, active + d))];
    next.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  };
  const stripIO = new IntersectionObserver((entries) => {
    if (!strip.matches) return;
    const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (best) setActive(+best.target.dataset.i);
  }, { root: stage, threshold: [0.6, 0.9] });
  items.forEach((li) => stripIO.observe(li));

  const applyMode = () => {
    if (strip.matches) {
      items.forEach((li) => { li.removeAttribute('style'); li.style.setProperty('--vinyl', PROJECTS[li.dataset.i].vinyl); });
    } else {
      pos = target = mod(Math.max(active, 0)); layout();
    }
  };
  strip.addEventListener('change', applyMode);
  new ResizeObserver(() => layout()).observe(stage);

  // --- input ---
  $('[data-prev]').addEventListener('click', () => go(-1));
  $('[data-next]').addEventListener('click', () => go(1));
  $('[data-open]').addEventListener('click', () => openProject(active));
  list.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-i]');
    if (openBtn) { openProject(+openBtn.dataset.openI); return; }
    const li = e.target.closest('.rec');
    if (!li || moved) return;
    const i = +li.dataset.i;
    if (strip.matches || (i === active && Math.abs(pos - target) < 0.05)) openProject(i);
    else goTo(i);
  });
  stage.addEventListener('keydown', (e) => {
    if (e.target !== stage) return;
    const keys = { ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in keys) { e.preventDefault(); go(keys[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); strip.matches ? items[0].scrollIntoView({ inline: 'center', block: 'nearest' }) : goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); strip.matches ? items[N - 1].scrollIntoView({ inline: 'center', block: 'nearest' }) : goTo(N - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(active); }
  });

  let drag = null, moved = false;
  // a press on a sleeve starts our drag; the browser's own drag of the cover image would cancel it
  stage.addEventListener('dragstart', (e) => e.preventDefault());
  stage.addEventListener('pointerdown', (e) => {
    if (strip.matches || e.button !== 0) return;
    drag = { id: e.pointerId, x0: e.clientX, p0: pos, x: e.clientX, t: e.timeStamp, v: 0 };
    moved = false;
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!dragging && Math.abs(dx) > 6) {
      dragging = true; moved = true;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('is-dragging');
    }
    if (!dragging) return;
    const unit = items[0].offsetWidth * 0.95;
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = drag.v * 0.6 + (-(e.clientX - drag.x) / unit / dt) * 1000 * 0.4;
    drag.x = e.clientX; drag.t = e.timeStamp;
    pos = drag.p0 - dx / unit;
    target = pos;
    layout();
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (dragging) {
      dragging = false;
      stage.classList.remove('is-dragging');
      target = Math.round(pos + Math.max(-2, Math.min(2, drag.v * 0.18)));
      vel = drag.v;
      kick();
    }
    drag = null;
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  let wheelAcc = 0, wheelAt = 0;
  stage.addEventListener('wheel', (e) => {
    if (strip.matches || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // vertical scrolling stays with the page
    e.preventDefault();
    wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 40 && e.timeStamp - wheelAt > 260) { go(Math.sign(wheelAcc)); wheelAcc = 0; wheelAt = e.timeStamp; }
  }, { passive: false });

  applyMode();
  if (active < 0) setActive(0);
  return { get active() { return active; } };
}

/* ---------- project view ---------- */
function initCase() {
  const dialog = $('[data-case]');
  const f = {
    media: $('[data-case-media]'),
    genre: $('[data-case-genre]'), title: $('[data-case-title]'), summary: $('[data-case-summary]'),
    task: $('[data-case-task]'), work: $('[data-case-work]'), audio: $('[data-case-audio]'),
  };
  let pushed = false, spin = null, returnFocus = null;

  function open(i, { push = true } = {}) {
    const p = PROJECTS[i];
    if (!p?.case) return;
    const c = p.case;
    returnFocus = document.activeElement;
    dialog.style.setProperty('--vinyl', p.vinyl);
    f.genre.textContent = c.genre || '';
    f.title.textContent = p.title;
    f.summary.textContent = c.summary || '';
    f.task.textContent = c.task || '';
    f.work.innerHTML = (c.work || []).map((w) => `<li>${esc(w)}</li>`).join('');
    const media = (c.media || []).map((m) => m.type === 'video'
      ? `<video src="${esc(m.src)}" controls playsinline preload="metadata"${m.poster ? ` poster="${esc(m.poster)}"` : ''}></video>`
      : `<img src="${esc(m.src)}" alt="${esc(m.alt || '')}" loading="lazy">`).join('');
    f.media.innerHTML = `
      <div class="case__record">
        <span class="rec__disc" aria-hidden="true"><span class="rec__spin"></span><span class="rec__gloss"></span></span>
        <span class="rec__jacket" style="--edge:${esc(p.cover || '#fff')}">${sleeve(p)}<span class="rec__film"></span></span>
      </div>
      ${media}`;
    spin = spinner($('.rec__spin', f.media), 6000);
    f.audio.innerHTML = '';
    if (c.audio?.length) import('./audio.js').then((m) => m.renderSoundList(f.audio, c.audio));
    if (!dialog.open) dialog.showModal();
    spin.start();
    dialog.querySelector('.case__inner').scrollTop = 0;
    if (push) { history.pushState({ project: p.id }, '', `#work/${p.id}`); pushed = true; }
  }

  dialog.addEventListener('close', () => {
    spin?.stop();
    document.dispatchEvent(new CustomEvent('soundfx:stop-audio'));
    if (pushed) { pushed = false; history.back(); }
    else if (location.hash.startsWith('#work/')) history.replaceState(null, '', '#work');
    returnFocus?.focus?.({ preventScroll: true });
  });
  $('[data-case-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  const fromHash = () => {
    const m = location.hash.match(/^#work\/([\w-]+)$/);
    const i = m ? PROJECTS.findIndex((p) => p.id === m[1]) : -1;
    if (i >= 0 && !dialog.open) open(i, { push: false });
    if (i < 0 && dialog.open) { pushed = false; dialog.close(); }
  };
  window.addEventListener('popstate', fromHash);
  return { open, fromHash };
}

/* ---------- studio pictures: action -> contact -> colour ---------- */
// The scenes load when the Studio section comes near; with reduced motion they show their third phase still.
function initStudioArt() {
  const cards = $$('.principle__art[data-scene]');
  if (!cards.length) return;
  const start = () => import('./studio-anim.js')
    .then((m) => m.initStudioScenes(cards, { reduce: reduceMotion.matches }))
    .catch((err) => console.warn('Studio scenes unavailable, keeping the stills.', err));
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: '600px 0px' });
  cards.forEach((c) => io.observe(c));
}

/* ---------- how we work: the short line between the stations draws in once ---------- */
// Everything is readable without this; it only adds the small reveal when the map comes into view.
function initProcess() {
  const route = $('[data-route]');
  if (!route || reduceMotion.matches || !('IntersectionObserver' in window)) return;
  route.classList.add('is-armed');
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { route.classList.add('is-in'); io.disconnect(); }
  }, { threshold: 0.3 });
  io.observe(route);
}

/* ---------- pricing tickets ---------- */
function initPricing() {
  const select = $('#f-package');
  const field = $('[data-package-field]');
  // "Discuss" buttons land on the contact form with that package already chosen (and still changeable).
  $$('[data-package]').forEach((btn) => btn.addEventListener('click', () => {
    select.value = btn.dataset.package;
    field.classList.remove('is-picked');
    void field.offsetWidth;
    field.classList.add('is-picked');
    setTimeout(() => field.classList.remove('is-picked'), 1600);
  }));

  // Hover: a small lift and tilt, and the gloss or foil follows the pointer. Mouse only, never with reduced motion.
  if (reduceMotion.matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  $$('.ticket').forEach((t) => {
    const max = t.classList.contains('ticket--headliner') ? 6 : 3.5;
    t.addEventListener('pointermove', (e) => {
      const r = t.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      t.classList.add('is-tilting');
      t.style.setProperty('--ry', `${((x - 0.5) * max).toFixed(2)}deg`);
      t.style.setProperty('--rx', `${((0.5 - y) * max).toFixed(2)}deg`);
      t.style.setProperty('--glare', `${(20 + x * 80).toFixed(1)}%`);
      t.style.setProperty('--foil', `${(y * 100).toFixed(1)}%`);
      t.style.setProperty('--spin', `${(x * 120).toFixed(1)}deg`);
    });
    t.addEventListener('pointerleave', () => {
      t.classList.remove('is-tilting');
      ['--rx', '--ry', '--glare', '--foil', '--spin'].forEach((k) => t.style.removeProperty(k));
    });
  });
}

/* ---------- clients, contact, footer ---------- */
function initClients() {
  if (!SITE.clients.length) return;
  $('#clients').hidden = false;
  $('[data-clients]').innerHTML = SITE.clients.map((c) => {
    const logo = `<img src="${esc(c.logo)}" alt="${esc(c.name)}" loading="lazy">`;
    return `<li>${c.href ? `<a href="${esc(c.href)}" rel="noopener">${logo}</a>` : logo}</li>`;
  }).join('');
}

function initContact() {
  const form = $('[data-brief-form]');
  const submit = $('[data-submit]');
  const note = $('[data-form-note]');
  const email = SITE.email.trim();

  if (!email) {
    submit.disabled = true;
    note.textContent = 'Email isn’t connected yet, so this form is turned off for now.';
  } else {
    $('[data-contact-direct]').hidden = false;
    const link = $('[data-email-link]');
    link.href = `mailto:${email}`;
    link.textContent = email;
    $('[data-copy-email]').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(email); e.currentTarget.textContent = 'Copied'; }
      catch { e.currentTarget.textContent = 'Select and copy the address'; }
    });
    $('[data-contact-links]').innerHTML = SITE.links.map((l) => `<li><a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a></li>`).join('');
  }

  const showError = (field, msg) => {
    const input = form.elements[field];
    input.setAttribute('aria-invalid', 'true');
    let err = input.parentElement.querySelector('.field__error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'field__error';
      err.id = `${input.id}-error`;
      input.setAttribute('aria-describedby', err.id);
      input.after(err);
    }
    err.textContent = msg;
  };
  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) {
      e.target.removeAttribute('aria-invalid');
      e.target.parentElement.querySelector('.field__error')?.remove();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!email) return;
    const data = new FormData(form);
    const name = (data.get('name') || '').trim();
    const message = (data.get('message') || '').trim();
    if (!name) showError('name', t('Add your name so we know who to reply to.'));
    if (!message) showError('message', t('Add a few words about the game.'));
    if (!name || !message) { form.querySelector('[aria-invalid="true"]').focus(); return; }
    const game = (data.get('game') || '').trim();
    const needs = data.getAll('needs');
    // the email is written in the language of the page
    const lines = [`${t('Name')}: ${name}`];
    if (game) lines.push(`${t('Studio or game')}: ${game}`);
    const pack = data.get('package');
    if (pack) lines.push(`${t('Package')}: ${t(pack)}`);
    if (needs.length) lines.push(`${t('Needs sound for')}: ${needs.map(t).join(', ')}`);
    lines.push('', message);
    const body = lines.join('\n');
    const subject = t(`Sound for ${game || t('our game')}`);
    location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    note.textContent = `Your email app should open with the draft. If it didn’t, write to ${email}.`;
  });
}

/* ---------- boot ---------- */
// QA helper for headless screenshots: ?only=work shows a single section at the top.
if (params.has('only')) {
  $$('main > section').forEach((sec) => { if (sec.id !== params.get('only')) sec.style.display = 'none'; });
  $('main').style.paddingTop = '88px';   // where a section lands after a nav jump
}
if (params.has('nomic')) $('.mic-layer').style.visibility = 'hidden';

$$('.hero-word__line > span').forEach((s, i) => s.style.setProperty('--i', i));
const fit = () => fitHeroWord();
document.fonts?.ready.then(fit);
fit();
phone.addEventListener('change', fit);
new ResizeObserver(fit).observe($('.hero'));

initHeader();
initMic();
const project = initCase();
initWork(project.open);
initClients();
initContact();
initPricing();
initStudioArt();
initProcess();
initSoundToggles();
$$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
project.fromHash();

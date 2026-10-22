import { SITE, PROJECTS } from './content.js';
import { initSoundToggles } from './music/sound.js';
import { t } from './i18n.js';
import { initGift } from './gift.js';   // the language layer itself starts in js/i18n-boot.js
import { initMap, CATS } from './map.js';
import { initPhoneSpeakers } from './phone-speakers.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const phone = matchMedia('(max-width: 760px)');
const stacked = matchMedia('(max-width: 1024px)');
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

  // The glass bar follows the section underneath it: dark over Work (round M: graphite).
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
  const box = stacked.matches ? $('.hero__stage').clientHeight * 0.42 : $('.hero').clientHeight * 0.235;   // round K: a taller copy block below
  word.style.fontSize = `${Math.min((100 * avail) / text, phone.matches ? Infinity : box)}px`;
}

/* ---------- microphone ---------- */
// Round O: the recording person's windshield is real 3D (js/boom-mic.js), so it turns around its own long
// axis. At rest it turns a few degrees one way and back; dragging it (mouse or finger, sideways) turns it
// all the way round, either way, with no stop; it stays where it is let go and the gentle turn resumes
// there after a pause. A short click gives the fur a little bounce. Arrow keys turn it from the keyboard.
// Until three.js is ready, and without WebGL, the still picture of the same render (assets/team/mic-still.webp)
// stands in its place; reduced motion keeps the hand turning but drops the turn at rest.
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

// the canvas box and where the pole's tip and the windshield sit in it, from the picture's own geometry
function boomGeometry(box) {
  const tip = box.dataset.tip.split(',').map(Number);
  const cfg = JSON.parse(box.dataset.mic);
  const cs = getComputedStyle(box);
  const pct = (v) => parseFloat(cs.getPropertyValue(v)) / 100;
  const [arW, arH] = cs.getPropertyValue('--ar').split('/').map(Number);
  const ar = arW / arH, cx = pct('--cx'), cy = pct('--cy'), cw = pct('--cw'), ch = pct('--ch');
  const L = 4.1;                                                       // the windshield's length in world units (SHAPE)
  // world units per picture height, and the windshield's centre in world units from the knuckle
  const perH = L / cfg.size;
  const centre = [(cfg.centre[0] - tip[0]) * ar * perH, -(cfg.centre[1] - tip[1]) * perH];
  return {
    pose: { axis: cfg.axis, yaw: cfg.yaw, centre },
    frame: (W, H) => ({ ax: ((tip[0] - cx) / cw) * W, ay: ((tip[1] - cy) / ch) * H, ppu: (H / ch) / perH }),
  };
}

function initMic() {
  const hero = $('.hero');
  const box = $('[data-boom]');
  if (!box) return;
  const canvas = $('.boom__canvas', box), still = $('.boom__still', box), grip = $('.boom__grip', box);
  const geo = boomGeometry(box);
  const exporting = params.has('micstill');
  if (!exporting && !webglAvailable()) { box.classList.add('is-still-only'); return; }

  const boot = async () => {
    let mic;
    try {
      const { createBoomMic } = await import('./boom-mic.js');
      const lite = phone.matches || (navigator.hardwareConcurrency || 8) <= 4;
      mic = await createBoomMic(canvas, { lite: exporting ? false : lite, pose: geo.pose, reduce: reduceMotion.matches, still: exporting, dpr: exporting ? 2 : undefined });
    } catch (err) {
      console.warn('3D microphone unavailable, keeping the still.', err);
      box.classList.add('is-still-only');
      return;
    }
    const size = () => mic.resize(canvas.clientWidth, canvas.clientHeight, geo.frame);
    size();
    if (exporting) { mic.step(0); mic.render(); window.__micStill = canvas.toDataURL('image/png'); document.title = 'mic still ready'; return; }
    if (params.has('debug')) window.__boom = mic;
    box.__boom = mic;
    new ResizeObserver(size).observe(canvas);
    reduceMotion.addEventListener('change', () => mic.setReduce(reduceMotion.matches));
    mic.step(0); mic.render();
    box.classList.add('is-live');

    let raf = 0, last = 0, visible = true;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      mic.step(dt); mic.render();
      raf = requestAnimationFrame(frame);
    };
    const run = () => {
      const want = visible && !document.hidden;
      if (want && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(box);
    document.addEventListener('visibilitychange', run);
    run();

    const turned = () => {
      const d = Math.round((((mic.state.angle * 180) / Math.PI) % 360 + 360) % 360);
      grip.setAttribute('aria-valuenow', String(d));
      grip.setAttribute('aria-valuetext', t(`Turned ${d}°`));
      box.classList.add('has-turned');
    };
    // the stage listens (the canvas lets clicks through to the phone's speakers); only a press on the
    // windshield itself starts a turn, so the page scrolls as usual everywhere else
    const stage = $('.hero__stage');
    let drag = null;
    stage.addEventListener('pointermove', (e) => {
      if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        const r = geo.frame(canvas.clientWidth, canvas.clientHeight).ppu * 1.4;   // ~ the windshield's radius in px
        mic.turnBy((dx + dy) / Math.max(18, r));
        turned();
        return;
      }
      if (e.pointerType === 'mouse') box.classList.toggle('is-over', mic.hit(e.clientX, e.clientY));
    });
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !mic.hit(e.clientX, e.clientY)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, at: e.timeStamp };
      stage.setPointerCapture(e.pointerId);
      mic.hold();
      box.classList.add('is-dragging');
      e.preventDefault();
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved < 6 && e.type === 'pointerup') mic.poke();
      drag = null;
      mic.letGo();
      box.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) box.classList.remove('is-over'); });
    grip.addEventListener('keydown', (e) => {
      const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (!k) return;
      e.preventDefault();
      mic.nudge((k * 15 * Math.PI) / 180);
      turned();
    });
  };
  if (exporting) {
    // ?micstill=1 (_dev/tools/mic-still.mjs): the box alone, sized so the canvas is 440 x 390 CSS px
    const cs = getComputedStyle(box);
    Object.assign(box.style, { position: 'fixed', left: '0px', top: '0px', bottom: 'auto', height: 'auto', zIndex: 9999, width: `${440 / (parseFloat(cs.getPropertyValue('--cw')) / 100)}px` });
    boot();
  } else if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 1500 });
  else setTimeout(boot, 400);
}

/* ---------- work collection ---------- */
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.2 9.3h3.1l4.6-3.9c.6-.5 1.6-.1 1.6.7v11.8c0 .8-1 1.2-1.6.7l-4.6-3.9H3.2A1.2 1.2 0 0 1 2 13.5v-3a1.2 1.2 0 0 1 1.2-1.2z" fill="currentColor"/><path d="M15.4 9.1a4.1 4.1 0 0 1 0 5.8M18.2 6.4a7.9 7.9 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>';

// the card: the company's name, then what the company is (p.company, from its official pages), then
// our part, apart from it (p.project as the owner named it; nothing invented)
const recordSummary = (p) => (p.kind === 'studio' ? 'SoundFX’s own record, kept apart from client work.' : p.case?.summary || p.company || '');

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

// Round O: the work is a clean shelf of collectible records, every card readable at once: the sleeve with
// its record half out, the company's name, what it is, and our part only where the owner confirmed one
// (the section's note says the rest once, instead of a repeated line on every card).
function discCard(p, i) {
  const ours = p.kind === 'studio' ? '' : p.ours || (p.project ? `Our team worked on ${p.project}.` : '');
  return `
  <li class="disc-card" data-i="${i}" style="--vinyl:${esc(p.vinyl)}; --edge:${esc(p.cover || '#fff')}">
    <div class="disc-card__art" aria-hidden="true">
      <span class="disc"><span class="disc__grooves"></span><span class="disc__label"></span></span>
      <span class="sleeve">${sleeve(p)}</span>
    </div>
    <div class="disc-card__text">
      <h3 class="disc-card__name">${esc(p.title)}</h3>
      ${recordSummary(p) ? `<p class="disc-card__about">${esc(recordSummary(p))}</p>` : ''}
      ${ours ? `<p class="disc-card__ours">${esc(ours)}</p>` : ''}
      ${p.link ? `<p class="disc-card__link"><a href="${esc(p.link.href)}" target="_blank" rel="noopener">${esc(p.link.label)}<span class="visually-hidden"> (opens in a new tab)</span></a></p>` : ''}
      ${p.case ? `<button class="btn btn--lime btn--small" type="button" data-open-i="${i}">Open project</button>` : ''}
    </div>
  </li>`;
}

// the first four (our game work, the owner's order) on the main shelf, the rest below in the same order
function initWork(openProject) {
  const main = $('[data-shelf="main"]'), more = $('[data-shelf="more"]');
  if (!main || !more) return;
  main.innerHTML = PROJECTS.slice(0, 4).map((p, i) => discCard(p, i)).join('');
  more.innerHTML = PROJECTS.slice(4).map((p, i) => discCard(p, i + 4)).join('');
  // a sleeve image that fails leaves the logo, or the name, on the cover colour
  const onFail = (img, fn) => { if (img.complete && !img.naturalWidth) fn(); else img.addEventListener('error', fn, { once: true }); };
  $$('.rec__art', $('#work')).forEach((img) => onFail(img, () => img.parentElement.classList.remove('has-art')));
  $$('.rec__logo', $('#work')).forEach((img) => onFail(img, () => img.parentElement.classList.add('is-missing')));
  $('#work').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-i]');
    if (b) openProject(+b.dataset.openI);
  });
}

/* ---------- project view ---------- */
function initCase() {
  const dialog = $('[data-case]');
  const f = {
    media: $('[data-case-media]'),
    genre: $('[data-case-genre]'), title: $('[data-case-title]'), summary: $('[data-case-summary]'),
    task: $('[data-case-task]'), work: $('[data-case-work]'), audio: $('[data-case-audio]'),
  };
  let pushed = false, returnFocus = null;

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
      <div class="case__record disc-card__art" style="--vinyl:${esc(p.vinyl)}; --edge:${esc(p.cover || '#fff')}">
        <span class="disc"><span class="disc__grooves"></span><span class="disc__label"></span></span>
        <span class="sleeve">${sleeve(p)}</span>
      </div>
      ${media}`;
    f.audio.innerHTML = '';
    if (c.audio?.length) import('./audio.js').then((m) => m.renderSoundList(f.audio, c.audio));
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.case__inner').scrollTop = 0;
    if (push) { history.pushState({ project: p.id }, '', `#work/${p.id}`); pushed = true; }
  }

  dialog.addEventListener('close', () => {
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

  // "What should the audio cover?": the sound categories of the route, plus "not sure yet"
  $('[data-module-chips]').innerHTML = CATS.map((m) => `<label class="chip-check"><input type="checkbox" name="modules" value="${esc(m.id)}"><span>${esc(m.name)}</span></label>`).join('')
    + '<label class="chip-check"><input type="checkbox" name="modules" value="unsure"><span>Not sure yet</span></label>';
  const moduleName = (id) => (id === 'unsure' ? 'Not sure yet' : CATS.find((m) => m.id === id)?.name || id);

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
    const val = (k) => (data.get(k) || '').trim();
    const name = val('name'), game = val('game');
    if (!game) showError('game', t('Add a link or a few words about the game.'));
    if (!name) showError('name', t('Add your name so we know who to reply to.'));
    if (!name || !game) { form.querySelector('[aria-invalid="true"]').focus(); return; }
    // the email is written in the language of the page
    const lines = [`${t('Name')}: ${name}`];
    if (val('contact')) lines.push(`${t('How to reach me')}: ${val('contact')}`);
    lines.push(`${t('Game')}: ${game}`);
    if (val('genre')) lines.push(`${t('Genre and setting')}: ${val('genre')}`);
    const platforms = data.getAll('platforms');
    if (platforms.length) lines.push(`${t('Platforms')}: ${platforms.map(t).join(', ')}`);
    const mods = data.getAll('modules');
    if (mods.length) lines.push(`${t('Audio to cover')}: ${mods.map((m) => t(moduleName(m))).join(', ')}`);
    const pack = data.get('package');
    if (pack) lines.push(`${t('Package')}: ${t(pack)}`);
    if (val('unity')) lines.push(`${t('Engine and version')}: ${val('unity')}`);
    if (val('link')) lines.push(`${t('Video or build')}: ${val('link')}`);
    if (data.get('bonus')) lines.push(`${t('Gift from the site')}: ${t('10% off the first project, with any package')}`);
    if (val('message')) lines.push('', val('message'));
    const body = lines.join('\n');
    const subject = t(`Audio plan for ${game.length > 60 ? t('our game') : game}`);
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
if (params.has('nomic')) $$('.boom__canvas, .boom__still, .boom__hint').forEach((el) => el.style.setProperty('visibility', 'hidden'));

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
const speakers = initPhoneSpeakers($('.hero-phone'));
if (speakers) $('.hero-phone').__speakers = speakers;
const map = initMap({ reduce: reduceMotion });
if (map) $('[data-map]').__map = map;
const gift = initGift({ reduce: reduceMotion });
if (gift) $('[data-gift]').__gift = gift;
initPricing();
initStudioArt();
initSoundToggles();
$$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
project.fromHash();

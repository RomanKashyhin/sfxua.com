import { SITE, PROJECTS } from './content.js';
import { initSoundToggles, music, sound } from './music/sound.js';
import { t } from './i18n.js';
import { initGift } from './gift.js';   // the language layer itself starts in js/i18n-boot.js
import { initMap, CATS } from './map.js';
import { initPhoneSpeakers } from './phone-speakers.js';
import { initTeamCarousel } from './team-carousel.js';
import { BOOM_FRAME } from './boom-frame.js';

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

/* ---------- hero composition ---------- */
// Round Q: the word SOUNDFX is always fully readable: no person, no phone, no speaker or wave ever lies on it,
// in any place of the team carousel. Wide screens: the word along the top on the left and the phone with the
// game at the same height on the right, the team below both. Stacked screens (tablet, phone): the word in one
// line on top, the phone under it, the team under the phone. The people's tops come from their pictures:
// bands of their silhouettes, every 4 % of the height (_dev/tools/team_silhouette.py), her microphone from
// js/boom-frame.js; thin things (her pole) are left out.
const SILHOUETTE = {"test":[[0.0,0.04,0.422,0.791],[0.04,0.08,0.391,0.812],[0.08,0.12,0.396,0.812],[0.12,0.16,0.381,0.719],[0.16,0.2,0.383,0.709],[0.2,0.24,0.0,0.828],[0.24,0.28,0.0,0.896],[0.28,0.32,0.002,0.934],[0.32,0.36,0.045,0.971],[0.36,0.4,0.072,0.998],[0.4,0.44,0.08,1.0],[0.44,0.48,0.285,0.986],[0.48,0.52,0.281,0.945],[0.52,0.56,0.285,0.828],[0.56,0.6,0.32,0.777]],"rec":[[0.12,0.16,0.726,0.832],[0.16,0.2,0.611,0.924],[0.2,0.24,0.587,0.939],[0.24,0.28,0.576,0.954],[0.28,0.32,0.354,0.956],[0.32,0.36,0.359,0.95],[0.36,0.4,0.32,0.936],[0.4,0.44,0.317,0.974],[0.44,0.48,0.35,0.996],[0.48,0.52,0.488,1.0],[0.52,0.56,0.475,0.969],[0.56,0.6,0.499,0.901]],"mix":[[0.0,0.04,0.221,0.546],[0.04,0.08,0.112,0.633],[0.08,0.12,0.087,0.633],[0.12,0.16,0.077,0.602],[0.16,0.2,0.108,0.562],[0.2,0.24,0.231,0.585],[0.24,0.28,0.127,0.683],[0.28,0.32,0.071,0.74],[0.32,0.36,0.025,0.794],[0.36,0.4,0.0,0.831],[0.4,0.44,0.0,0.848],[0.44,0.48,0.027,0.994],[0.48,0.52,0.113,1.0],[0.52,0.56,0.023,0.892],[0.56,0.6,0.044,0.698]]};
const PHONE_RATIO = 2.05;

// every place the people pass on the carousel (k = -1 left ... 0 middle ... +1 right), as rects on the stage
function teamTops(stageRect) {
  const ring = $('.team__ring').getBoundingClientRect();
  const spread = $('[data-team]').clientWidth < 520 ? 0.33 : 0.31;
  const out = [];
  for (const el of $$('[data-member]')) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) continue;
    const bands = [...SILHOUETTE[el.dataset.member]];
    const box = $('[data-boom]', el);
    if (box) {   // her windshield, where placeBoom puts it, in the figure's fractions
      const [tx, ty] = box.dataset.tip.split(',').map(Number);
      const bw = +box.dataset.size, bh = (bw * w) / BOOM_FRAME.aspect / h;
      const [x0, y0, x1, y1] = BOOM_FRAME.bbox;
      const left = tx - BOOM_FRAME.pivot[0] * bw, top = ty - BOOM_FRAME.pivot[1] * bh;
      bands.push([top + y0 * bh, top + y1 * bh, left + x0 * bw, left + x1 * bw]);
    }
    for (let k = -1; k <= 1.001; k += 0.125) {
      const sc = 1 - 0.24 * Math.abs(k);
      const cx = ring.left - stageRect.left + ring.width * (0.5 + k * spread);
      const bottom = ring.bottom - stageRect.top;
      for (const [y0, y1, x0, x1] of bands) {
        out.push({ l: cx + (x0 - 0.5) * w * sc, r: cx + (x1 - 0.5) * w * sc, t: bottom - (1 - y0) * h * sc });
      }
    }
  }
  return out;
}
// how low something spanning [l, r] may reach before it touches anybody
const clearAbove = (tops, l, r) => tops.reduce((m, o) => (o.r > l && o.l < r ? Math.min(m, o.t) : m), Infinity);

// round S: the window's height as it was for this width: a phone's address bar showing or hiding (or a
// full-page screenshot) changes the height alone, and must not reshuffle the first screen
let heightFor = { w: 0, h: 0 };
const stableHeight = () => {
  if (window.innerWidth !== heightFor.w) heightFor = { w: window.innerWidth, h: window.innerHeight };
  return heightFor.h;
};

function composeHero() {
  const stage = $('.hero__stage'), word = $('.hero-word'), ph = $('.hero-phone'), team = $('[data-team]');
  // the header is fixed to the window: its bottom on the page (with the page at its top) is where it is now;
  // the stage is measured on the page too, so a reflow while the page is scrolled lands in the same place
  const headBottom = $('.site-head__bar').getBoundingClientRect().bottom;
  const stageTop = stage.getBoundingClientRect().top + window.scrollY;
  word.style.fontSize = '100px';
  const per100 = word.scrollWidth;   // the word's width at 100px
  if (stacked.matches) {
    // top to bottom: the word, the phone, the team; the stage grows to hold them
    const W = stage.clientWidth, vh = stableHeight();
    const top = headBottom - stageTop + 12;
    const f = Math.min((W * 0.92 * 100) / per100, (Math.max(46, vh * 0.1)) / 0.8);
    Object.assign(word.style, { fontSize: `${f}px`, top: `${top}px`, left: `${(W - (per100 * f) / 100) / 2}px` });
    const pw = Math.min(W * (phone.matches ? 0.72 : 0.5), 380), phH = pw / PHONE_RATIO;
    const py = top + 0.8 * f + 24;
    Object.assign(ph.style, { width: `${pw}px`, left: `${(W - pw) / 2}px`, top: `${py}px` });
    const tt = py + phH + 22, th = Math.min(500, Math.max(330, vh * (phone.matches ? 0.44 : 0.5)));
    Object.assign(team.style, { top: `${tt}px`, height: `${th}px` });
    stage.style.height = `${tt + th}px`;
    return;
  }
  ['top', 'height'].forEach((k) => team.style.removeProperty(k));
  stage.style.removeProperty('height');
  const S = stage.getBoundingClientRect(), T = team.getBoundingClientRect(), C = $('.hero__copy').getBoundingClientRect();
  const tops = teamTops(S);
  const GAP = 16;
  const top = headBottom - stageTop + GAP;
  const right = T.right - S.left, left = C.left - S.left, copyTop = C.top - S.top;
  // the phone at the top right: as wide as a good part of the team, as tall as the people below allow
  let pw = Math.min(T.width * 0.46, 460);
  let phH = pw / PHONE_RATIO;
  const under = clearAbove(tops, right - pw, right) - GAP - 10;   // 10: its white ring
  if (top + phH > under) { phH = Math.max(84, under - top); pw = phH * PHONE_RATIO; }
  // the word: from the copy's edge to the phone, as large as fits, level with the phone's middle
  const wr = right - pw - 34;
  const floor = Math.min(clearAbove(tops, left, wr), copyTop) - GAP;
  const f = Math.max(40, Math.min(((wr - left) * 100) / per100, (floor - top) / 0.8));
  const y = Math.min(Math.max(top, top + phH / 2 - 0.4 * f), floor - 0.8 * f);
  // on tall screens both come down a little into the air above the people (never onto them)
  const down = Math.max(0, 0.45 * Math.min(floor - (y + 0.8 * f), under - (top + phH)));
  Object.assign(ph.style, { width: `${pw}px`, left: `${right - pw}px`, top: `${top + down}px` });
  Object.assign(word.style, { fontSize: `${f}px`, top: `${y + down}px`, left: `${left}px` });
}

/* ---------- the word's letters under the pointer ---------- */
// Round S: the word lies behind the phone and the team, so where they cover it :hover never reaches a letter.
// The pointer is followed over the whole hero instead and the letter under it gets .is-lit; a touch lights
// a letter for 0.6 s. Clicks and drags still go to the phone and the team, untouched.
function initWordHover() {
  const hero = $('.hero');
  const letters = $$('.hero-word__line > span');
  let lit = null, frame = 0, px = 0, py = 0;
  const light = (el) => {
    if (el === lit) return;
    lit?.classList.remove('is-lit');
    lit = el;
    el?.classList.add('is-lit');
  };
  const at = (x, y) => letters.find((l) => { const r = l.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }) || null;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; light(at(px, py)); });
  });
  hero.addEventListener('pointerleave', () => light(null));
  hero.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const el = at(e.clientX, e.clientY);
    if (!el) return;
    el.classList.add('is-lit');
    setTimeout(() => { if (el !== lit) el.classList.remove('is-lit'); }, 600);
  });
}

/* ---------- microphone ---------- */
// The windshield of the round N sheet, as the owner chose it (23.10.2026: the picture itself, still; it does not
// turn), on the shock mount at the tip of the recording person's pole. It hangs in her own picture, so it travels
// with her round the team carousel; its box (js/boom-frame.js) sits with the mount's knuckle on her pole tip.
function placeBoom(box) {
  const tip = box.dataset.tip.split(',').map(Number);
  const size = +box.dataset.size;
  const [px, py] = BOOM_FRAME.pivot;
  const figure = box.parentElement;
  const fw = figure.clientWidth, fh = figure.clientHeight;
  const w = size * fw, h = w / BOOM_FRAME.aspect;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
  box.style.left = `${tip[0] * fw - px * w}px`;
  box.style.top = `${tip[1] * fh - py * h}px`;
}

function initMic() {
  const box = $('[data-boom]');
  if (!box) return;
  const place = () => placeBoom(box);
  place();
  new ResizeObserver(place).observe(box.parentElement);
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

// Round P: the circle of records comes back (round L's orbit), cleaned up: every record keeps its shape at
// every place on the ring (only translate and scale; no rotateY, no filter, so discs stay circles and
// logos keep their colours), the record half out of its sleeve is the ComfyUI vinyl tinted with the
// client's colour, and its label turns while the record is chosen. Phones get a swipe strip.
const recordOurs = (p) => (p.kind === 'studio' ? '' : p.ours || (p.project ? `Our team worked on ${p.project}.` : ''));

const TILT = [-2, 1.5, -1, 2, -1.5, 1, -2, 1.5, -1];
// round S: the tag on a sleeve says what our team did there (PROJECTS[].work), not a catalogue number
const WORK_TAG = { events: 'Events', gameplay: 'Gameplay' };
const workTag = (p) => WORK_TAG[p.work] || '';
function recordMarkup(p, i) {
  const ours = recordOurs(p);
  return `
  <li class="rec rec--${p.kind}" data-i="${i}" style="--vinyl:${esc(p.vinyl)}; --edge:${esc(p.cover || '#fff')}; --tilt:${TILT[i % TILT.length]}deg">
    <div class="rec__visual">
      <button class="rec__hit" type="button" tabindex="-1" aria-label="${esc(p.title)}">
        <span class="disc" aria-hidden="true"><span class="disc__grooves"></span><span class="disc__label"></span></span>
        <span class="sleeve">${sleeve(p)}<span class="sleeve__glint" aria-hidden="true"></span></span>
        ${workTag(p) ? `<span class="rec__cat" aria-hidden="true">${workTag(p)}</span>` : ''}
      </button>
    </div>
    <div class="rec__info">
      <h3 class="rec__name">${esc(p.title)}</h3>
      ${recordSummary(p) ? `<p class="rec__summary">${esc(recordSummary(p))}</p>` : ''}
      ${ours ? `<div class="rec__ours"><p class="rec__tag">Our part</p><p>${esc(ours)}</p></div>` : ''}
      ${p.link ? `<p class="rec__link"><a href="${esc(p.link.href)}" target="_blank" rel="noopener">${esc(p.link.label)}<span class="visually-hidden"> (opens in a new tab)</span></a></p>` : ''}
      ${p.case ? `<button class="btn btn--lime btn--small" type="button" data-open-i="${i}">Open project</button>` : ''}
    </div>
  </li>`;
}

function initWork(openProject) {
  const list = $('[data-recs]');
  const stage = $('[data-stage]');
  if (!list || !stage) return null;
  const N = PROJECTS.length;
  list.innerHTML = PROJECTS.map(recordMarkup).join('');
  // a sleeve image that fails leaves the logo, or the name, on the cover colour
  const onFail = (img, fn) => { if (img.complete && !img.naturalWidth) fn(); else img.addEventListener('error', fn, { once: true }); };
  $$('.rec__art', list).forEach((img) => onFail(img, () => img.parentElement.classList.remove('has-art')));
  $$('.rec__logo', list).forEach((img) => onFail(img, () => img.parentElement.classList.add('is-missing')));
  const items = $$('.rec', list);
  $('[data-hub-total]').textContent = N;

  const section = $('#work');
  const hub = {
    box: $('.hub__project'), index: $('[data-hub-index]'), ours: $('[data-hub-ours]'), oursBox: $('[data-hub-ours-box]'),
    name: $('[data-hub-name]'), summary: $('[data-hub-summary]'), open: $('[data-open]'), link: $('[data-hub-link]'),
  };
  const deck = $('[data-deck]'), playBtn = $('[data-play]'), bar = $('[data-seek]');
  const ambient = $$('[data-ambient]');
  // the track list: the clients numbered like the tracks of an album (no years or genres: those aren't in
  // the data; under the name, the project our team worked on, where the owner confirmed one)
  const tracks = $('[data-tracks]');
  tracks.innerHTML = PROJECTS.map((p, i) => `<li><button class="track" type="button" data-track="${i}" style="--vinyl:${esc(p.vinyl)}">
    <span class="track__no">${String(i + 1).padStart(2, '0')}</span><span class="track__eq" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="track__name">${esc(p.title)}</span>${p.project ? `<span class="track__sub">${esc(p.project)}</span>` : ''}
    ${workTag(p) ? `<span class="track__cat">${workTag(p)}</span>` : '<span></span>'}</button></li>`).join('');
  const rows = $$('[data-track]', tracks);

  // play / pause (round S): the player waits on pause, on load and whenever a record is chosen; only play
  // turns the record, lowers the tonearm (once) and runs the bar. No sound plays apart from the needle drop
  // on play, and only with the sound switch on. Reduced motion: the record and the bar stand still.
  const PLAY_SECONDS = 45;
  let playing = false, progress = 0, lastFrame = 0, raf = 0, inView = false;
  const paintBar = () => {
    bar.value = String(Math.round(progress * 1000));
    bar.style.setProperty('--p', progress.toFixed(4));
    bar.setAttribute('aria-valuetext', `${Math.round(progress * 100)}%`);
  };
  // the tonearm comes down once when play is pressed; a quick lift and drop when the record changes while it
  // plays; never a second run on top of one still going
  const armMove = (cls) => {
    if (reduceMotion.matches || deck.classList.contains('is-cueing') || deck.classList.contains('is-hopping')) return;
    deck.classList.add(cls);
  };
  deck.addEventListener('animationend', (e) => { if (e.target.classList.contains('player__arm')) deck.classList.remove('is-cueing', 'is-hopping'); });
  const setPlaying = (on, { fromButton = false } = {}) => {
    const was = playing;
    playing = on;
    section.classList.toggle('is-playing', on);
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.setAttribute('aria-label', t(on ? 'Pause' : 'Play'));
    $('[data-now-label]').textContent = t(on ? 'Now playing' : 'Paused');
    if (on && !was) { armMove('is-cueing'); if (fromButton) needle(); }
    run();
  };
  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!playing || !inView) return;
    progress = Math.min(1, progress + dt / PLAY_SECONDS);
    paintBar();
    if (progress >= 1) { setPlaying(false); return; }
    raf = requestAnimationFrame(frame);
  };
  function run() { if (playing && inView && !raf && !reduceMotion.matches) { lastFrame = performance.now(); raf = requestAnimationFrame(frame); } }
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; run(); }).observe(section);
  playBtn.addEventListener('click', () => { if (!playing && progress >= 1) { progress = 0; paintBar(); } setPlaying(!playing, { fromButton: true }); });
  // the position: dragged by mouse or finger, clicked anywhere on the bar, or stepped by 5 % with the arrow
  // keys; it never starts or stops the playing
  bar.addEventListener('input', () => { progress = +bar.value / 1000; paintBar(); });
  bar.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: -0.05, ArrowDown: -0.05, ArrowRight: 0.05, ArrowUp: 0.05 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    progress = Math.min(1, Math.max(0, progress + k));
    paintBar();
  });
  paintBar();

  // a quiet needle drop when play is pressed, only while the sound switch is on
  const needle = () => {
    if (!sound.live) return;
    const ctx = music.context;
    const n = Math.round(ctx.sampleRate * 0.42), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / ctx.sampleRate;
      lp += (Math.random() * 2 - 1 - lp) * 0.08;
      d[i] = Math.sin(2 * Math.PI * 58 * tt) * Math.exp(-tt * 38) * 0.9 + lp * 0.18 * Math.exp(-tt * 5);   // the touch-down and a little hiss
    }
    for (let c = 0; c < 14; c++) {                                                                       // the crackle
      const at = Math.floor(Math.random() * (n - 300)), len = 40 + Math.floor(Math.random() * 160), amp = 0.2 + Math.random() * 0.5;
      for (let i = 0; i < len; i++) d[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / len) ** 2;
    }
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = 0.16;
    src.connect(g).connect(sound.output);
    src.start(music.now());
  };

  let active = -1, byHand = false, ambientSide = 0;
  const setActive = (i) => {
    if (i === active) return;
    if (active >= 0) { items[active].classList.remove('is-active'); rows[active].classList.remove('is-active'); rows[active].removeAttribute('aria-current'); }
    active = i;
    items[i].classList.add('is-active');
    rows[i].classList.add('is-active');
    rows[i].setAttribute('aria-current', 'true');
    const p = PROJECTS[i];
    hub.index.textContent = i + 1;
    section.style.setProperty('--accent', p.vinyl);   // the chosen record lends its colour to the scene
    deck.style.setProperty('--vinyl', p.vinyl);
    hub.name.textContent = p.title;
    hub.summary.textContent = recordSummary(p);
    hub.summary.hidden = !recordSummary(p);
    hub.ours.textContent = recordOurs(p);
    hub.oursBox.hidden = !recordOurs(p);
    hub.link.hidden = !p.link;
    if (p.link) { hub.link.href = p.link.href; hub.link.firstChild.textContent = p.link.label; }
    hub.open.hidden = !p.case;
    // the sleeve, blurred, under the whole section: the two layers cross-fade
    if (p.art) {
      ambientSide = 1 - ambientSide;
      ambient[ambientSide].src = p.art;
      ambient[ambientSide].classList.add('is-on');
      ambient[1 - ambientSide].classList.remove('is-on');
    }
    // the next record: the bar goes back to the start; the tonearm stays as it is (up on pause; on the go a
    // single quick lift and drop)
    progress = 0; paintBar();
    if (playing) armMove('is-hopping');
    if (!reduceMotion.matches && hub.box.animate) {
      hub.box.animate([{ opacity: 0.25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' });
    }
    byHand = false;
  };

  // --- the ring (desktop): the chosen record in front, under the hub; the others travel up the sides
  // and pass behind it, smaller. Only translate + scale: the shapes never skew.
  const STEP = (2 * Math.PI) / Math.max(N, 3);
  const BACK = 0.5;
  let pos = 0, target = 0, vel = 0, looping = false, lastT = 0, dragging = false;
  const mod = (n) => ((n % N) + N) % N;
  const offset = (i, p) => { let k = i - p; k -= Math.round(k / N) * N; return k; };

  function layout() {
    if (strip.matches) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    const S = items[0].offsetWidth;
    const yFront = H - 18 - S / 2;
    const yBack = 10 + (S * BACK) / 2;
    const cx = W / 2, cy = (yFront + yBack) / 2, Ry = (yFront - yBack) / 2;
    const Rx = Math.min(W * 0.45, 620);
    items.forEach((li, i) => {
      const k = offset(i, pos);
      const a = k * STEP;
      const front = (Math.cos(a) + 1) / 2;
      const depth = 0.78 + 0.22 * front;
      const x = Math.sin(a) * Rx * depth - S * 0.22 * Math.max(0, 1 - Math.abs(k)) ** 2;   // room for the record sliding out
      const y = cy + Math.cos(a) * Ry;
      const scale = BACK + (1 - BACK) * front ** 1.1;
      li.style.transform = `translate3d(${(cx + x - S / 2).toFixed(1)}px, ${(y - S / 2).toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
      li.style.zIndex = String(Math.round(front * 200));
      li.style.setProperty('--depth', front.toFixed(3));
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
  // phones (round S): a strip of sleeves to swipe above the player, the track list under it; the sleeve in
  // the middle of the strip is the chosen record
  const stripTo = (i) => {
    setActive(i);
    items[i].scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  };
  const go = (d) => {
    byHand = true;
    if (strip.matches) { stripTo(mod(active + d)); return; }
    target = Math.round(target) + d; kick();
  };
  const goTo = (i) => {
    byHand = true;
    if (strip.matches) { stripTo(i); return; }
    const base = Math.round(pos); target = base + offset(i, base); kick();
  };
  let stripSettle = 0;
  stage.addEventListener('scroll', () => {
    if (!strip.matches) return;
    clearTimeout(stripSettle);
    stripSettle = setTimeout(() => {
      const mid = stage.getBoundingClientRect().left + stage.clientWidth / 2;
      let best = active, bestD = Infinity;
      items.forEach((li, i) => { const r = li.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bestD) { bestD = d; best = i; } });
      if (best !== active) setActive(best);
    }, 90);
  }, { passive: true });

  const applyMode = () => {
    if (strip.matches) items.forEach((li) => { li.style.transform = ''; li.style.zIndex = ''; });
    else { pos = target = mod(Math.max(active, 0)); layout(); }
  };
  strip.addEventListener('change', applyMode);
  new ResizeObserver(() => layout()).observe(stage);

  // --- input
  $('[data-prev]').addEventListener('click', () => go(-1));
  $('[data-next]').addEventListener('click', () => go(1));
  $('[data-shuffle]').addEventListener('click', () => { let i = active; while (N > 1 && i === active) i = Math.floor(Math.random() * N); goTo(i); });
  // the track list: a row lights its record on the circle, a press chooses it
  rows.forEach((row, i) => {
    row.addEventListener('click', () => goTo(i));
    row.addEventListener('pointerenter', () => items[i].classList.add('is-hinted'));
    row.addEventListener('pointerleave', () => items[i].classList.remove('is-hinted'));
    row.addEventListener('focus', () => items[i].classList.add('is-hinted'));
    row.addEventListener('blur', () => items[i].classList.remove('is-hinted'));
  });
  // a swipe across the player on a phone changes the record
  let swipe = null;
  $('.player').addEventListener('pointerdown', (e) => { if (strip.matches && e.pointerType !== 'mouse') swipe = { x: e.clientX, y: e.clientY }; });
  $('.player').addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  });
  // a small parallax of the circle after the mouse (none with reduced motion)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stage.addEventListener('pointermove', (e) => {
      if (reduceMotion.matches || strip.matches) return;
      const r = stage.getBoundingClientRect();
      list.style.setProperty('--px', `${(((e.clientX - r.left) / r.width - 0.5) * -6).toFixed(2)}px`);
      list.style.setProperty('--py', `${(((e.clientY - r.top) / r.height - 0.5) * -4).toFixed(2)}px`);
    });
    stage.addEventListener('pointerleave', () => { list.style.removeProperty('--px'); list.style.removeProperty('--py'); });
  }
  $('[data-open]').addEventListener('click', () => openProject(active));
  let drag = null, moved = false;
  list.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-i]');
    if (openBtn) { openProject(+openBtn.dataset.openI); return; }
    const li = e.target.closest('.rec');
    if (!li || moved) return;
    const i = +li.dataset.i;
    if (strip.matches) { li.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' }); return; }
    if (i === active && PROJECTS[i].case && Math.abs(pos - target) < 0.05) openProject(i);
    else goTo(i);
  });
  stage.addEventListener('keydown', (e) => {
    if (e.target !== stage) return;
    const keys = { ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in keys) { e.preventDefault(); go(keys[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); strip.matches ? items[0].scrollIntoView({ inline: 'center', block: 'nearest' }) : goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); strip.matches ? items[N - 1].scrollIntoView({ inline: 'center', block: 'nearest' }) : goTo(N - 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && PROJECTS[active]?.case) { e.preventDefault(); openProject(active); }
  });

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
  setPlaying(false);
  return { get active() { return active; }, go, goTo, get pos() { return pos; }, get playing() { return playing; }, get progress() { return progress; } };
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
    // round R: a record with no case page is chosen in the player instead
    if (i >= 0 && !PROJECTS[i].case) { $('#work').__orbit?.goTo(i); $('#work').scrollIntoView({ block: 'start' }); return; }
    if (i >= 0 && !dialog.open) open(i, { push: false });
    if (i < 0 && dialog.open) { pushed = false; dialog.close(); }
  };
  window.addEventListener('popstate', fromHash);
  window.addEventListener('hashchange', fromHash);
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
  // "Discuss" buttons land on the contact form; round R: the package goes with the request in a hidden field
  // and a line in the letter, with nothing to fill in
  const field = $('[data-package-field]');
  $$('[data-package]').forEach((btn) => btn.addEventListener('click', () => { field.value = btn.dataset.package; }));

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

// Round R: the simplest form: the game (a link or a few words) and where to reply (email, Telegram, a phone:
// no format check). Enter sends. The letter opens in the visitor's email app with everything filled in; the
// gift and a package picked on a ticket go with it. Under the form, the studio's own contacts as pills (the
// email copies on a press); they show only once they are filled in js/content.js, and while there is no
// email the form stays off and says so.
function initContact() {
  const form = $('[data-brief-form]');
  const submit = $('[data-submit]');
  const note = $('[data-form-note]');
  const opened = $('[data-form-opened]');
  let email = SITE.email.trim();

  const pills = () => {
    const items = SITE.links.map((l) => `<li><a class="pill" href="${esc(l.href)}" rel="noopener" target="_blank">${esc(l.label)}<span class="visually-hidden"> (opens in a new tab)</span></a></li>`);
    if (email) items.push(`<li><button class="pill pill--copy" type="button" data-copy-email>${esc(email)}<span class="pill__tip" aria-hidden="true">Copied</span></button></li>`);
    $('[data-contact-pills]').innerHTML = items.join('');
    $('[data-contact-direct]').hidden = !items.length;
    $('[data-copy-email]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      try { await navigator.clipboard.writeText(email); } catch { /* the address is on the button: it can still be selected */ }
      btn.classList.add('is-copied');
      $('[data-copy-live]').textContent = t('Copied');
      setTimeout(() => btn.classList.remove('is-copied'), 1600);
    });
  };
  const ready = () => {
    submit.disabled = !email;
    note.textContent = email ? t('Your email opens with the letter ready.') : t('Email isn’t connected yet, so this form is turned off for now.');
    pills();
  };
  ready();
  form.__setEmail = (v) => { email = v; ready(); };   // for checks (_dev/tools/qa.mjs)

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
    const game = val('game');
    if (!game) {
      const input = form.elements.game;
      input.setAttribute('aria-invalid', 'true');
      let err = input.parentElement.querySelector('.field__error');
      if (!err) {
        err = document.createElement('p');
        err.className = 'field__error';
        err.id = 'f-game-error';
        input.setAttribute('aria-describedby', err.id);
        input.after(err);
      }
      err.textContent = t('Add a link or a few words about the game.');
      input.focus();
      return;
    }
    // the letter is written in the language of the page
    const lines = [`${t('Game')}: ${game}`];
    if (val('contact')) lines.push(`${t('Where to reply')}: ${val('contact')}`);
    if (val('package')) lines.push(`${t('Package')}: ${t(val('package'))}`);
    if (data.get('bonus')) lines.push(`${t('Gift from the site')}: ${t('10% off the first project, with any package')}`);
    const subject = t(`Audio plan for ${game.length > 60 ? t('our game') : game}`);
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    form.__lastMail = url;   // for checks
    location.href = url;
    opened.hidden = false;
    opened.textContent = t(`Email opened. If it didn’t, write to ${email}.`);
    opened.focus();
  });
}

/* ---------- boot ---------- */
// QA helper for headless screenshots: ?only=work shows a single section at the top.
if (params.has('only')) {
  $$('main > section').forEach((sec) => { if (sec.id !== params.get('only')) sec.style.display = 'none'; });
  $('main').style.paddingTop = '88px';   // where a section lands after a nav jump
}
if (params.has('nomic')) $$('.boom').forEach((el) => el.style.setProperty('visibility', 'hidden'));

$$('.hero-word__line > span').forEach((s, i) => s.style.setProperty('--i', i));
const fit = () => composeHero();
document.fonts?.ready.then(fit);
fit();
phone.addEventListener('change', fit);
stacked.addEventListener('change', fit);
new ResizeObserver(fit).observe($('.hero'));

initHeader();
initWordHover();
initMic();
const team = initTeamCarousel({ reduce: reduceMotion, t });
if (team) $('[data-team]').__team = team;
const project = initCase();
const work = initWork(project.open);
if (work) $('#work').__orbit = work;
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

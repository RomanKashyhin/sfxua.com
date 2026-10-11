// English / Ukrainian. One dictionary for the whole site (js/i18n-uk.js), keyed by the English text,
// so the page itself, every component and the screen-reader labels stay written in English and are
// switched here, in one place:
//   - the static page: every text node and the aria-label / alt / placeholder / title attributes,
//     plus the document title and meta description;
//   - everything the scripts write later (the record hub, the console's buttons and live messages,
//     the form's notes, the sound switch's state…): a MutationObserver translates it as it appears,
//     so no component needs to know the language, nothing is rebuilt and no sound engine or game
//     is restarted when the language changes;
//   - texts with a variable part (a company name, a score) are matched by patterns.
// The choice is remembered (localStorage "sfx-lang"); without one the site is English. Switching keeps
// the visitor where they are: the element at the top of the screen stays at the same place.
import { UK, UK_PATTERNS } from './i18n-uk.js';

const KEY = 'sfx-lang';
const ATTRS = ['aria-label', 'alt', 'placeholder', 'title'];
const SKIP = 'script, style, noscript, [data-no-i18n]';
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private mode: not remembered */ } };

let lang = read() === 'uk' ? 'uk' : 'en';
const listeners = new Set();
const textOrig = new WeakMap();     // text node -> its English text
const textMine = new WeakMap();     // text node -> the translation we wrote (so our own writes are ignored)
const attrOrig = new WeakMap();     // element -> { attr: English value }
const UK_VALUES = new Set(Object.values(UK));

/** the Ukrainian for an English string (whitespace-insensitive), or null when there is none */
function lookup(en) {
  const k = norm(en);
  if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(UK, k)) return UK[k];
  for (const [re, to] of UK_PATTERNS) if (re.test(k)) return k.replace(re, typeof to === 'function' ? to : to);
  return null;
}

/** translate a string for the current language (for text the scripts compose, such as an email) */
export function t(en) {
  if (lang !== 'uk') return en;
  return lookup(en) ?? en;
}
export const getLang = () => lang;
export function onLang(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ---- the DOM ---- */
function keepSpaces(orig, inner) {
  const lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
  return lead + inner + trail;
}
function doText(node) {
  if (node.parentElement?.closest(SKIP)) return;
  const v = node.nodeValue;
  if (lang === 'uk') {
    if (textMine.get(node) === v) return;                    // our own translation
    const uk = lookup(v);
    if (uk == null) return;
    textOrig.set(node, v);
    const out = keepSpaces(v, uk);
    textMine.set(node, out);
    node.nodeValue = out;
  } else if (textOrig.has(node)) {
    if (textMine.get(node) === v) node.nodeValue = textOrig.get(node);
    textOrig.delete(node); textMine.delete(node);
  }
}
function doAttrs(el) {
  if (el.closest(SKIP)) return;
  let saved = attrOrig.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const v = el.getAttribute(a);
    if (lang === 'uk') {
      if (saved?.[a] && UK_VALUES.has(v)) continue;
      const uk = lookup(v);
      if (uk == null || uk === v) continue;
      if (!saved) { saved = {}; attrOrig.set(el, saved); }
      saved[a] = v;
      el.setAttribute(a, uk);
    } else if (saved?.[a] != null) {
      el.setAttribute(a, saved[a]);
      delete saved[a];
    }
  }
}
function walk(root) {
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType !== 1) return;
  doAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) (n.nodeType === 3 ? doText(n) : doAttrs(n));
}
const meta = () => document.querySelector('meta[name="description"]');
let titleEn = null, metaEn = null;
function doHead() {
  titleEn ??= document.title;
  const m = meta();
  if (m) metaEn ??= m.getAttribute('content');
  document.title = lang === 'uk' ? (lookup(titleEn) ?? titleEn) : titleEn;
  if (m) m.setAttribute('content', lang === 'uk' ? (lookup(metaEn) ?? metaEn) : metaEn);
}

const mo = new MutationObserver((list) => {
  if (lang !== 'uk') return;
  for (const m of list) {
    if (m.type === 'characterData') doText(m.target);
    else if (m.type === 'attributes') doAttrs(m.target);
    else m.addedNodes.forEach(walk);
  }
});

/* ---- switching ---- */
function paintSwitches() {
  document.querySelectorAll('[data-lang]').forEach((b) => {
    const on = b.dataset.lang === lang;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('is-on', on);
  });
}
// the visitor stays where they are: the first heading, paragraph or card below the header keeps its
// place on the screen, however much the texts above it grew or shrank
function anchor() {
  const head = document.querySelector('.site-head__bar')?.getBoundingClientRect().bottom || 0;
  let best = null, bestTop = Infinity;
  for (const el of document.querySelectorAll('main h1, main h2, main h3, main p, main li, main label, main img, body > footer')) {
    const r = el.getBoundingClientRect();
    if (r.height && r.top >= head + 4 && r.top < bestTop && r.top < innerHeight) { best = el; bestTop = r.top; }
  }
  if (!best) return () => {};
  return () => { const d = best.getBoundingClientRect().top - bestTop; if (Math.abs(d) > 1) scrollBy(0, d); };
}
export function setLang(next, { remember = true } = {}) {
  next = next === 'uk' ? 'uk' : 'en';
  if (remember) write(next);
  if (next === lang) { paintSwitches(); return; }
  const restore = anchor();
  lang = next;
  document.documentElement.lang = lang;
  walk(document.body);
  doHead();
  paintSwitches();
  restore();
  listeners.forEach((fn) => { try { fn(lang); } catch (e) { console.error(e); } });
}

let started = false;
export function initI18n() {
  if (started) return;
  started = true;
  document.documentElement.lang = lang;
  if (lang === 'uk') { walk(document.body); doHead(); }
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  paintSwitches();
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) setLang(b.dataset.lang);
  });
  document.documentElement.classList.remove('i18n-wait');
}

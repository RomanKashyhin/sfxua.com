// The record prints (owner, 25.10.2026: "give each work example a logical print on its record").
// Every record carries its own simple flat motif, pressed under the grooves like a picture disc. Each motif comes
// only from what js/content.js says about that card (the game, the genre, the company's line); no text (it would
// need EN and UA), no client logos or cover art. PROJECTS[].print names the motif; a record without one, or with
// a name not listed here, gets the neutral 'sound' print (an equaliser ring).
// The drawing is in disc units: the centre at 0 0, the edge at 50. The label covers up to 19 and the rim starts
// about 44, so every motif lives in the vinyl band between 20 and 43. Colours: the classes d (a dark shade of the
// record's colour), l (a light tint of it) and c (cream, the label's paper) come from css/style.css ("record
// prints"), so a print follows its record's colour; a few fixed colours are written in place.

const f = (n) => +n.toFixed(2);
// n copies of a part round the record: part(i) is drawn at the top (local "up" = outwards) and turned into place
const ring = (n, r, part, start = 0) => Array.from({ length: n }, (_, i) =>
  `<g transform="rotate(${f(start + (360 / n) * i)}) translate(0 ${-r})">${part(i)}</g>`).join('');
// a point on the record: deg clockwise from the top, r from the centre
const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return `${f(Math.sin(a) * r)} ${f(-Math.cos(a) * r)}`; };
// a four-point sparkle
const spark = (s, cls) => `<path class="${cls}" d="M0 ${-s}Q${f(s * .18)} ${f(-s * .18)} ${s} 0Q${f(s * .18)} ${f(s * .18)} 0 ${s}Q${f(-s * .18)} ${f(s * .18)} ${-s} 0Q${f(-s * .18)} ${f(-s * .18)} 0 ${-s}Z"/>`;

// RJ Games: "the mobile puzzle RPG Puzzle Breakers" -> jigsaw pieces scattered round the record
const PIECE = 'M-6-6H-2.2A2.8 2.8 0 1 1 2.2-6H6V-2.2A2.8 2.8 0 1 1 6 2.2V6H2.2A2.8 2.8 0 1 0-2.2 6H-6V2.2A2.8 2.8 0 1 0-6-2.2Z';
const puzzle = () => ring(6, 31.5, (i) =>
  `<path class="${i % 2 ? 'd' : 'c'}" transform="rotate(${i % 2 ? 14 : -10}) translate(-2.2 -2.2) scale(.95)" d="${PIECE}"/>`);

// RJ Games, round X (the owner: a green record, "RJ Games" in the middle, decorated with stones from the game): the
// gems of Puzzle Breakers as its own video shows them (the green premium gem and the purple one), cut stones round the
// record with small sparkles between
const GEM = {
  green: ['#c6ffdc', '#6ef3a6', '#26c96c', '#0e8a44', '#09512a'],
  purple: ['#f1d8ff', '#cc92ff', '#a24bf0', '#6c20b6', '#3d0f70'],
};
const gem = (kind) => {
  const [hi, lt, mid, dk, line] = GEM[kind];
  return `<path fill="${lt}" d="M-5.5-1.5L-3-5L-1.8-1.5Z"/><path fill="${hi}" d="M-3-5H3L1.8-1.5H-1.8Z"/><path fill="${mid}" d="M5.5-1.5L3-5L1.8-1.5Z"/>`
    + `<path fill="${mid}" d="M-5.5-1.5H-1.8L0 6.5Z"/><path fill="${lt}" d="M-1.8-1.5H1.8L0 6.5Z"/><path fill="${dk}" d="M1.8-1.5H5.5L0 6.5Z"/>`
    + `<path fill="none" stroke="${line}" stroke-width=".75" stroke-linejoin="round" d="M-5.5-1.5L-3-5H3L5.5-1.5L0 6.5Z"/>`
    + `<path fill="#fff" opacity=".9" d="M-2.3-4.1l.5 1.2l1.2.5l-1.2.5l-.5 1.2l-.5-1.2l-1.2-.5l1.2-.5Z"/>`;
};
const TILT_G = [-12, 10, -6, 14, -14, 8, -4, 12];
const gems = () => ring(8, 31.5, (i) => `<g transform="rotate(${TILT_G[i]}) scale(${i % 2 ? .82 : 1.08})">${gem(i % 2 ? 'purple' : 'green')}</g>`)
  + ring(8, 40.5, (i) => spark(i % 2 ? 1.6 : 2.2, 'c'), 22.5) + ring(8, 23.5, () => '<circle class="c" r=".8" opacity=".75"/>', 22.5);

// Vogster: "Carnivores: Dinosaur Hunter HD" -> a trail of three-toed dinosaur tracks walking round the record
const TRACK = '<path stroke-width="1" stroke-linejoin="round" d="M0 6C-3.2 6-4.4 3.6-4 1.4L-6.8-5.6C-7-6.4-6.2-6.8-5.6-6.2L-1.8-1.6L-1.6-8.6C-1.3-10 1.3-10 1.6-8.6L1.8-1.6L5.6-6.2C6.2-6.8 7-6.4 6.8-5.6L4 1.4C4.4 3.6 3.2 6 0 6Z"/>';
const tracks = () => `<g class="d sd">${ring(6, 0, (i) =>
  `<g transform="translate(0 ${i % 2 ? -27.8 : -36.4}) rotate(90) scale(${i % 2 ? .82 : .92})">${TRACK}</g>`, 15)}</g>`;

// HEY CLAY: "air-dry modelling clay sets" for children -> rolled clay balls and little clay snakes in bright colours
const CLAY = ['#ff6b5a', '#3f9dff', '#35c48d', '#ff7fc4', '#9a6bff'];
const BLOB = 'M0-6C3.6-6.2 6.2-3.4 5.9.2C5.6 3.8 3 6.1-.4 5.9C-3.9 5.7-6.2 3.1-5.9-.4C-5.6-3.6-3.4-5.8 0-6Z';
const clay = () => ring(10, 32, (i) => {
  const k = Math.floor(i / 2);
  return i % 2
    ? `<path d="M-5.6 0C-4-2.8-1.9-2.8 0 0S4 2.8 5.6 0" fill="none" stroke="${CLAY[(k + 2) % CLAY.length]}" stroke-width="4.2" stroke-linecap="round" transform="rotate(90)"/>`
    : `<path fill="${CLAY[k % CLAY.length]}" transform="rotate(${k * 47}) scale(${k % 2 ? .86 : .98})" d="${BLOB}"/><ellipse cx="-1.9" cy="-2" rx="1.7" ry="1.15" fill="#fff" opacity=".7"/>`;
});

// Ultimate Pirates: "pirate-themed city-building and strategy" game -> the record is a ship's wheel (the label its hub)
const wheel = () => `<circle r="30.5" fill="none" class="sd" stroke-width="3.4"/><circle r="30.5" fill="none" class="sc" stroke-width=".9" opacity=".55"/>`
  + ring(8, 0, () => `<path class="sd" d="M0-20.5V-37" stroke-width="2.8" stroke-linecap="round"/><rect class="d" x="-2.4" y="-43.4" width="4.8" height="8.6" rx="2.4"/>`, 22.5)
  + ring(8, 30.5, () => '<circle class="c" r="1.05" opacity=".8"/>');

// NAVI: an "esports club with teams in Counter-Strike 2, Dota 2, VALORANT..." -> a crosshair, ticks in the club card's yellow
const crosshair = () => `<circle r="40.5" fill="none" class="sd" stroke-width="2.2"/><circle r="27" fill="none" class="sd" stroke-width="1.6"/>`
  + ring(4, 0, () => '<path class="sd" d="M0-21.5V-43" stroke-width="3.4" stroke-linecap="round"/>')
  + ring(4, 0, () => '<path d="M0-33.5L-3.4-39.5H3.4Z" fill="#ffee00" stroke="#ffee00" stroke-width="1.2" stroke-linejoin="round"/>', 45)
  + ring(24, 40.5, (i) => (i % 6 ? '<path class="sd" d="M0 0V3.4" stroke-width="1.3" stroke-linecap="round"/>' : ''));

// Valve: the name, and "maker of the Steam platform" -> puffs of steam curling round the record
const PUFF = '<circle cx="-4.4" cy="1.4" r="3.5"/><circle cx="0" cy="-1" r="4.7"/><circle cx="4.5" cy="1.6" r="3.3"/><rect x="-7.9" y="1" width="15.6" height="4.4" rx="2.2"/>';
const steam = () => ring(5, 32, (i) => {
  const s = [1, .8, .95, .75, .88][i];
  return `<g transform="scale(${s})"><g class="d" transform="translate(.9 1.4)" opacity=".55">${PUFF}</g><g class="c">${PUFF}</g></g>`;
}) + ring(5, 32, () => {
  const curl = (x, cls, dy = 0) => `<path class="${cls}" fill="none" stroke-width="1.8" stroke-linecap="round" d="M${x} ${f(5 + dy)}c2.4-2.2-2.4-4 0-6.2s-2.4-4 0-6.2"/>`;
  return `<g opacity=".55">${curl(-1.6, 'sd', .9)}${curl(2.4, 'sd', .9)}</g>${curl(-2.4, 'sc')}${curl(1.6, 'sc')}`;
}, 36);

// Epic Games: "behind Fortnite and Unreal Engine" -> a low-poly mesh, the triangles a game engine draws
const mesh = () => {
  const n = 12, rin = 21, rout = 43, out = [];
  const shade = ['l', 'c', 'd', '', 'l', 'd', 'c', '', 'd', 'l', '', 'c'];
  for (let k = 0; k < n; k++) {
    const a = (360 / n) * k, b = a + 360 / n, m = a + 180 / n, m2 = m + 360 / n;
    const up = `M${pt(a, rin)}L${pt(b, rin)}L${pt(m, rout)}Z`, down = `M${pt(m, rout)}L${pt(m2, rout)}L${pt(b, rin)}Z`;
    if (shade[k]) out.push(`<path class="${shade[k]}" opacity="${shade[k] === 'd' ? .36 : .52}" d="${up}"/>`);
    if (shade[(k + 5) % n]) out.push(`<path class="${shade[(k + 5) % n]}" opacity=".26" d="${down}"/>`);
    out.push(`<path class="sc" fill="none" stroke-width=".8" stroke-linejoin="round" opacity=".62" d="${up}${down}"/>`);
  }
  return out.join('') + ring(n, rout, () => '<circle class="c" r="1.3"/>', 15) + ring(n, rin + .6, () => '<circle class="c" r="1"/>');
};

// Riot Games: "League of Legends, VALORANT, Teamfight Tactics" -> crossed swords, guards in the card's red, sparks between
const SWORD = '<path class="c sd" stroke-width=".7" stroke-linejoin="round" d="M0-12L1.8-8.8V3.6H-1.8V-8.8Z"/><rect fill="#d13639" x="-5" y="3.3" width="10" height="2.4" rx="1.2"/><rect class="d" x="-1" y="5.5" width="2" height="4.4" rx="1"/><circle fill="#d13639" cy="10.8" r="1.6"/>';
const swords = () => ring(3, 32, () => `<g transform="rotate(-36) translate(0 1.4)">${SWORD}</g><g transform="rotate(36) translate(0 1.4)">${SWORD}</g>`)
  + ring(3, 32.5, () => spark(4.4, 'd'), 60) + ring(6, 24.5, () => '<circle class="d" r="1.1" opacity=".7"/>', 30);

// WePlay Studios: "produces esports tournaments, gaming shows and other events" -> stage spotlights and sparkles
const spotlights = () => ring(6, 0, (i) => `<path class="${i % 2 ? 'c' : 'l'}" opacity="${i % 2 ? .5 : .62}" d="M-1.6-20.5H1.6L7.4-42.6Q0-44.6-7.4-42.6Z"/>`)
  + ring(6, 35, (i) => spark(i % 2 ? 3.4 : 2.6, 'c'), 30) + ring(6, 25.5, () => '<circle class="c" r=".9" opacity=".8"/>', 30);

// NFL (round Y): "professional American football league" -> footballs with their laces round the record, stars between
const BALL = '<ellipse rx="4.4" ry="7.4" fill="#8a4a22"/><ellipse rx="3.2" ry="6" fill="#a65c2c" opacity=".7" transform="translate(-.8 -.6)"/>'
  + '<path fill="none" stroke="#fff8ec" stroke-width=".8" stroke-linecap="round" d="M-3.6-4.6Q0-3.6 3.6-4.6M-3.6 4.6Q0 3.6 3.6 4.6M0-2.6V2.6M-1.2-1.6H1.2M-1.2 0H1.2M-1.2 1.6H1.2"/>';
const football = () => ring(6, 32, (i) => `<g transform="rotate(${i % 2 ? 24 : -24})">${BALL}</g>`) + ring(6, 33, () => spark(2.6, 'c'), 30)
  + ring(12, 23.5, () => '<circle class="c" r=".75" opacity=".75"/>', 15);

// no clear theme in the card: a neutral sound print, an equaliser round the record
const LEVELS = [7, 12, 9, 15, 11, 6, 13, 17, 10, 8, 14, 9];
const sound = () => ring(36, 0, (i) => `<path class="sd" d="M0-22.5V${f(-22.5 - LEVELS[i % LEVELS.length])}" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>`);

// Cosmobot (round X): "gravitate around thousands of planets" -> little planets on their orbits round the record, the
// mossy green and the dark metal ones of the game, with coins between
const orbits = () => '<circle r="31.5" fill="none" class="sc" stroke-width=".7" stroke-dasharray="1.6 2.4" opacity=".7"/>'
  + ring(6, 31.5, (i) => i % 2
    ? '<circle r="5.6" fill="#3a4148"/><path d="M-3.6-2.4A5.6 5.6 0 0 1 3.4-3.6" fill="none" stroke="#7d8a94" stroke-width="1.2" stroke-linecap="round"/><circle cx="1.6" cy="1.8" r="1.1" fill="#252b30"/>'
    : '<circle r="6.4" fill="#5f9c3a"/><circle cx="-1.8" cy="-1.6" r="2.4" fill="#86c45a"/><circle cx="2.4" cy="2.2" r="1.3" fill="#3f7426"/><ellipse rx="9.6" ry="2.6" fill="none" stroke="#fff8ec" stroke-width=".9" opacity=".8" transform="rotate(-18)"/>')
  + ring(6, 40, () => '<circle r="2.1" fill="#ffc83a"/><circle r="1" fill="#ffe7a0"/>', 30) + ring(12, 23.5, () => '<circle class="c" r=".7" opacity=".7"/>', 15);

export const PRINTS = { puzzle, gems, orbits, tracks, clay, wheel, crosshair, steam, mesh, swords, spotlights, football, sound };

// the print of one record, as markup for inside its .disc (under .disc__grooves); each motif is drawn once
const made = new Map();
export function discPrint(p) {
  const name = p && Object.hasOwn(PRINTS, p.print) ? p.print : 'sound';
  if (!made.has(name)) made.set(name, `<svg class="disc__print disc__print--${name}" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">${PRINTS[name]()}</svg>`);
  return made.get(name);
}

// round X: a record may carry its maker's name on the label (round Z: every record does; a long name is set as large
// as the label's width allows, so the names read about the same size) (PROJECTS[].label, e.g. ['RJ', 'Games']: a big first line
// over the spindle hole, a small second one under it); a brand name, so the same in both languages
export function discLabel(p) {
  if (!p?.label) return '';
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const [top, bottom = ''] = p.label;
  return `<svg class="disc__name" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false" data-no-i18n>`
    + `<text y="-12" text-anchor="middle" class="disc__name-top"${top.length > 3 ? ` style="font-size:${Math.round(Math.min(31, 104 / top.length))}px"` : ''}>${esc(top)}</text>`
    + (bottom ? `<text y="30" text-anchor="middle" class="disc__name-bottom"${bottom.length > 5 ? ` style="font-size:${Math.round(Math.min(15, (80 / bottom.length - 2) / .7))}px"` : ''}>${esc(bottom.toUpperCase())}</text>` : '')
    + '</svg>';
}

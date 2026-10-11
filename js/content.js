// Everything the studio will edit lives here.

export const SITE = {
  // Real contact details only. While email is empty, the contact form stays
  // disabled and says so, instead of pretending to send anything.
  email: '',
  links: [
    // { label: 'LinkedIn', href: 'https://…' },
  ],
  // Logos of studios SoundFX has actually worked with. The section stays hidden while empty.
  // { name: 'Studio name', logo: 'assets/clients/studio.svg', href: 'https://…' }
  clients: [],
};

// The record collection: the companies and games our team has worked on. Order (owner, round I): our
// game work first (RJ Games, Vogster, HEY CLAY, Ultimate Pirates), then the other companies; the first
// record is the one shown when the page opens. Each sleeve is a finished
// album cover built by tools/build_covers.py (ComfyUI background + the company's official logo
// and official marks of its games laid on top; sources in design/covers/SOURCES.md).
// The games on a cover refer to the company's world; they do not claim SoundFX worked on them.
// project: the title SoundFX worked on with that company, as the owner named it (shown in the caption).
// Tasks and the studio's part are not published yet, so records carry no case page.
// When a case is ready, add  case: { summary, task, work: [...], media: [...], audio: [...] }
// to that record and the "Open project" button appears for it.
//   art:   the finished sleeve (assets/covers/<id>.webp)
//   logo:  fallback if the sleeve image is missing: official logo on the cover colour
//   about: the caption, when the record is a game rather than a company
//   link:  { href, label } the official page, shown under the caption (opens in a new tab)
export const PROJECTS = [
  { id: 'rj-games', kind: 'client', title: 'RJ Games', project: 'Puzzle Breakers', vinyl: '#ff7a2f', cover: '#0f332f', art: 'assets/covers/rj-games.webp', logo: 'assets/clients/rj-games.svg' },
  { id: 'vogster', kind: 'client', title: 'Vogster Entertainment', project: 'Carnivores: Dinosaur Hunter HD', vinyl: '#29b6f0', cover: '#0b0f1a', art: 'assets/covers/vogster.webp', logo: null },
  { id: 'hey-clay', kind: 'client', title: 'HEY CLAY', project: 'LIPAKA (ЛІПАКА)', vinyl: '#ffd02e', cover: '#eef5f9', art: 'assets/covers/hey-clay.webp', logo: 'assets/clients/hey-clay.webp' },
  // a game rather than a company: its own caption, and a link to its official page (Steam, developer and publisher Moonmana)
  { id: 'ultimate-pirates', kind: 'client', title: 'Ultimate Pirates', vinyl: '#f2b33d', cover: '#101a24', art: 'assets/covers/ultimate-pirates.webp', logo: null,
    about: 'Our team has worked on Ultimate Pirates, the pirate MMO by Moonmana. Project details coming soon.',
    link: { href: 'https://store.steampowered.com/app/2628460/Ultimate_pirates/', label: 'Ultimate Pirates on Steam' } },
  { id: 'navi', kind: 'client', title: 'NAVI', vinyl: '#29b6f0', cover: '#ffee00', art: 'assets/covers/navi.webp', logo: 'assets/clients/navi.svg' },
  { id: 'valve', kind: 'client', title: 'Valve', vinyl: '#ffd02e', cover: '#1b1b1f', art: 'assets/covers/valve.webp', logo: 'assets/clients/valve.svg' },
  { id: 'epic-games', kind: 'client', title: 'Epic Games', vinyl: '#ff3d8b', cover: '#f0f0ec', art: 'assets/covers/epic-games.webp', logo: 'assets/clients/epic-games.svg' },
  { id: 'riot-games', kind: 'client', title: 'Riot Games', vinyl: '#3ed6a3', cover: '#d13639', art: 'assets/covers/riot-games.webp', logo: 'assets/clients/riot-games.png' },
  { id: 'weplay', kind: 'client', title: 'WePlay Studios', vinyl: '#8a6bff', cover: '#14082b', art: 'assets/covers/weplay.webp', logo: 'assets/clients/weplay.svg' },
];

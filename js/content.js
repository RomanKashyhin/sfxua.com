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

// The record collection: eight companies SoundFX has worked with. Each sleeve is a finished
// album cover built by tools/build_covers.py (ComfyUI background + the company's official logo
// and official marks of its games laid on top; sources in design/covers/SOURCES.md).
// The games on a cover refer to the company's world; they do not claim SoundFX worked on them.
// Project names, tasks and the studio's part are not published yet, so records carry no case page.
// When a case is ready, add  case: { summary, task, work: [...], media: [...], audio: [...] }
// to that record and the "Open project" button appears for it.
//   art:   the finished sleeve (assets/covers/<id>.webp)
//   logo:  fallback if the sleeve image is missing: official logo on the cover colour
export const PROJECTS = [
  { id: 'navi', kind: 'client', title: 'NAVI', vinyl: '#29b6f0', cover: '#ffee00', art: 'assets/covers/navi.webp', logo: 'assets/clients/navi.svg' },
  { id: 'valve', kind: 'client', title: 'Valve', vinyl: '#ffd02e', cover: '#1b1b1f', art: 'assets/covers/valve.webp', logo: 'assets/clients/valve.svg' },
  { id: 'epic-games', kind: 'client', title: 'Epic Games', vinyl: '#ff3d8b', cover: '#121212', art: 'assets/covers/epic-games.webp', logo: 'assets/clients/epic-games.svg' },
  { id: 'riot-games', kind: 'client', title: 'Riot Games', vinyl: '#3ed6a3', cover: '#d13639', art: 'assets/covers/riot-games.webp', logo: 'assets/clients/riot-games.png' },
  { id: 'weplay', kind: 'client', title: 'WePlay Studios', vinyl: '#8a6bff', cover: '#14082b', art: 'assets/covers/weplay.webp', logo: 'assets/clients/weplay.svg' },
  { id: 'rj-games', kind: 'client', title: 'RJ Games', vinyl: '#ff7a2f', cover: '#0f332f', art: 'assets/covers/rj-games.webp', logo: 'assets/clients/rj-games.svg' },
  { id: 'vogster', kind: 'client', title: 'Vogster Entertainment', vinyl: '#29b6f0', cover: '#0b0f1a', art: 'assets/covers/vogster.webp', logo: null },
  { id: 'hey-clay', kind: 'client', title: 'HEY CLAY', vinyl: '#ffd02e', cover: '#eef5f9', art: 'assets/covers/hey-clay.webp', logo: 'assets/clients/hey-clay.webp' },
];

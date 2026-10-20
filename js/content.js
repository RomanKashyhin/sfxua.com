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
//   company: what the company is, one neutral sentence from its OFFICIAL pages (checked 20.10.2026,
//            sources in _dev/docs/clients.md); for a game card, what the game is
//   ours:    our team's part, apart from the description (only what the owner confirmed)
//   link:    { href, label } the official page, shown under the caption (opens in a new tab)
export const PROJECTS = [
  { id: 'rj-games', kind: 'client', title: 'RJ Games', project: 'Puzzle Breakers', vinyl: '#ff7a2f', cover: '#0f332f', art: 'assets/covers/rj-games.webp', logo: 'assets/clients/rj-games.svg',
    company: 'Game developer that created the mobile puzzle RPG Puzzle Breakers: Champions War, as well as strategy and casual games.' },
  // Vogster's own site is offline; the official PlayStation Blog posts by its project lead confirm the game
  { id: 'vogster', kind: 'client', title: 'Vogster Entertainment', project: 'Carnivores: Dinosaur Hunter HD', vinyl: '#29b6f0', cover: '#0b0f1a', art: 'assets/covers/vogster.webp', logo: null,
    company: 'Game company behind Carnivores: Dinosaur Hunter HD for PlayStation 3.' },
  { id: 'hey-clay', kind: 'client', title: 'HEY CLAY', project: 'LIPAKA (ЛІПАКА)', vinyl: '#ffd02e', cover: '#eef5f9', art: 'assets/covers/hey-clay.webp', logo: 'assets/clients/hey-clay.webp',
    company: 'Children’s brand combining air-dry modelling clay sets with an app of step-by-step animated sculpting guides.' },
  // a game rather than a company: what the game is, and a link to its official page (Steam, developer and publisher Moonmana)
  { id: 'ultimate-pirates', kind: 'client', title: 'Ultimate Pirates', vinyl: '#f2b33d', cover: '#101a24', art: 'assets/covers/ultimate-pirates.webp', logo: null,
    company: 'Free pirate-themed city-building and strategy MMO on Steam, developed and published by Moonmana.',
    ours: 'Our team has worked on Ultimate Pirates.',
    link: { href: 'https://store.steampowered.com/app/2628460/Ultimate_pirates/', label: 'Ultimate Pirates on Steam' } },
  { id: 'navi', kind: 'client', title: 'NAVI', vinyl: '#29b6f0', cover: '#ffee00', art: 'assets/covers/navi.webp', logo: 'assets/clients/navi.svg',
    company: 'Esports club with teams in Counter-Strike 2, Dota 2, VALORANT, League of Legends and other games.' },
  { id: 'valve', kind: 'client', title: 'Valve', vinyl: '#ffd02e', cover: '#1b1b1f', art: 'assets/covers/valve.webp', logo: 'assets/clients/valve.svg',
    company: 'Game developer behind Half-Life, Counter-Strike 2 and Dota 2, and maker of the Steam platform and Steam Deck.' },
  { id: 'epic-games', kind: 'client', title: 'Epic Games', vinyl: '#ff3d8b', cover: '#f0f0ec', art: 'assets/covers/epic-games.webp', logo: 'assets/clients/epic-games.svg',
    company: 'Interactive entertainment company behind Fortnite and Unreal Engine, which also runs the Epic Games Store.' },
  { id: 'riot-games', kind: 'client', title: 'Riot Games', vinyl: '#3ed6a3', cover: '#d13639', art: 'assets/covers/riot-games.webp', logo: 'assets/clients/riot-games.png',
    company: 'Game developer and publisher of League of Legends, VALORANT, Teamfight Tactics and other titles.' },
  { id: 'weplay', kind: 'client', title: 'WePlay Studios', vinyl: '#8a6bff', cover: '#14082b', art: 'assets/covers/weplay.webp', logo: 'assets/clients/weplay.svg',
    company: 'Content production company that produces esports tournaments, gaming shows and other events; part of WePlay Holding.' },
];

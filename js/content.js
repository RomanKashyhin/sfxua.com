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
//   print:   the motif printed on the record, under its grooves (js/disc-prints.js): drawn only from what this card
//            says (the game, the genre, the company's line), never a client logo or text; none -> the neutral 'sound' print
//   label:   (round X) the maker's name on the record's label, [first line, second line]; a brand name, never translated
//   video:   (round X) a sound example in the game: { webm (AV1), mp4 (H.264, fast start), poster, preview (a
//            silent 5 s loop, 360x640 H.264), previewPoster, moments: [{ src (a frame), t (its second) }] }. A record with a
//            video shows its phone screen and three moments in the player instead of the description; play or the phone plays it
//            right in the phone with its sound; a moment jumps the video to its second (no window, no full screen)
//   work:    what our team did there, as the owner said (round S): 'events', 'gameplay' or (round X) 'media'; it is the small
//            tag on the sleeve and in the track list (no tag when it isn't set)
export const PROJECTS = [
  { id: 'rj-games', kind: 'client', work: 'gameplay', title: 'RJ Games', project: 'Puzzle Breakers', vinyl: '#2fbf63', cover: '#0f332f', print: 'gems', label: ['RJ', 'Games'],
    video: { webm: 'assets/work/rj-puzzle-breakers.webm', mp4: 'assets/work/rj-puzzle-breakers.mp4', poster: 'assets/work/rj-puzzle-breakers.webp',
      preview: 'assets/work/rj-puzzle-breakers-preview.mp4', previewPoster: 'assets/work/rj-puzzle-breakers-preview.webp',
      moments: [{ src: 'assets/work/rj-puzzle-breakers-6s.webp', t: 5 }, { src: 'assets/work/rj-puzzle-breakers-11s.webp', t: 10 }, { src: 'assets/work/rj-puzzle-breakers-24s.webp', t: 23 }] }, art: 'assets/covers/rj-games.webp', logo: 'assets/clients/rj-games.svg',
    company: 'Game developer that created the mobile puzzle RPG Puzzle Breakers: Champions War, as well as strategy and casual games.' },
  // round X: the owner's second sound example; the game identified by its own video (the launch tower, the pink-haired
  // mechanic) against its App Store page: Cosmobot – Hyper Jump by Ankama, released 21.09.2018
  { id: 'cosmobot', kind: 'client', work: 'gameplay', title: 'Ankama', project: 'Cosmobot – Hyper Jump', vinyl: '#22c3dc', cover: '#0e3a4a', print: 'orbits', label: ['Cosmo', 'bot'],
    video: { webm: 'assets/work/cosmobot-hyper-jump.webm', mp4: 'assets/work/cosmobot-hyper-jump.mp4', poster: 'assets/work/cosmobot-hyper-jump.webp',
      preview: 'assets/work/cosmobot-hyper-jump-preview.mp4', previewPoster: 'assets/work/cosmobot-hyper-jump-preview.webp',
      moments: [{ src: 'assets/work/cosmobot-hyper-jump-1s.webp', t: 0.5 }, { src: 'assets/work/cosmobot-hyper-jump-6s.webp', t: 6 }, { src: 'assets/work/cosmobot-hyper-jump-12s.webp', t: 11.5 }] },
    art: 'assets/covers/cosmobot.webp', logo: null,
    company: 'Game studio behind Cosmobot – Hyper Jump, a casual mobile game in which little robots hyper-jump from planet to planet.',
    link: { href: 'https://apps.apple.com/us/app/cosmobot-hyper-jump/id1385059317', label: 'Cosmobot – Hyper Jump on the App Store' } },
  // Vogster's own site is offline; the official PlayStation Blog posts by its project lead confirm the game
  { id: 'vogster', kind: 'client', work: 'gameplay', title: 'Vogster Entertainment', project: 'Carnivores: Dinosaur Hunter HD', vinyl: '#29b6f0', cover: '#0b0f1a', print: 'tracks', art: 'assets/covers/vogster.webp', logo: null,
    company: 'Game company behind Carnivores: Dinosaur Hunter HD for PlayStation 3.' },
  { id: 'hey-clay', kind: 'client', work: 'gameplay', title: 'HEY CLAY', project: 'LIPAKA (ЛІПАКА)', vinyl: '#ffd02e', cover: '#eef5f9', print: 'clay', art: 'assets/covers/hey-clay.webp', logo: 'assets/clients/hey-clay.webp',
    company: 'Children’s brand combining air-dry modelling clay sets with an app of step-by-step animated sculpting guides.' },
  // a game rather than a company: what the game is, and a link to its official page (Steam, developer and publisher Moonmana)
  { id: 'ultimate-pirates', kind: 'client', work: 'gameplay', title: 'Ultimate Pirates', vinyl: '#f2b33d', cover: '#101a24', print: 'wheel', art: 'assets/covers/ultimate-pirates.webp', logo: null,
    company: 'Free pirate-themed city-building and strategy MMO on Steam, developed and published by Moonmana.',
    ours: 'Our team has worked on Ultimate Pirates.',
    link: { href: 'https://store.steampowered.com/app/2628460/Ultimate_pirates/', label: 'Ultimate Pirates on Steam' } },
  { id: 'navi', kind: 'client', work: 'media', title: 'NAVI', vinyl: '#29b6f0', cover: '#ffee00', print: 'crosshair', art: 'assets/covers/navi.webp', logo: 'assets/clients/navi.svg',
    company: 'Esports club with teams in Counter-Strike 2, Dota 2, VALORANT, League of Legends and other games.' },
  { id: 'valve', kind: 'client', work: 'events', title: 'Valve', vinyl: '#ffd02e', cover: '#1b1b1f', print: 'steam', art: 'assets/covers/valve.webp', logo: 'assets/clients/valve.svg',
    company: 'Game developer behind Half-Life, Counter-Strike 2 and Dota 2, and maker of the Steam platform and Steam Deck.' },
  { id: 'epic-games', kind: 'client', work: 'events', title: 'Epic Games', vinyl: '#ff3d8b', cover: '#f0f0ec', print: 'mesh', art: 'assets/covers/epic-games.webp', logo: 'assets/clients/epic-games.svg',
    company: 'Interactive entertainment company behind Fortnite and Unreal Engine, which also runs the Epic Games Store.' },
  { id: 'riot-games', kind: 'client', work: 'events', title: 'Riot Games', vinyl: '#3ed6a3', cover: '#d13639', print: 'swords', art: 'assets/covers/riot-games.webp', logo: 'assets/clients/riot-games.png',
    company: 'Game developer and publisher of League of Legends, VALORANT, Teamfight Tactics and other titles.' },
  { id: 'weplay', kind: 'client', work: 'events', title: 'WePlay Studios', vinyl: '#8a6bff', cover: '#14082b', print: 'spotlights', art: 'assets/covers/weplay.webp', logo: 'assets/clients/weplay.svg',
    company: 'Content production company that produces esports tournaments, gaming shows and other events; part of WePlay Holding.' },
];

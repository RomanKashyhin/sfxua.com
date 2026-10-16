// The module catalogue the builder shows (#system) and the contact form offers.
// Texts are English; js/i18n-uk.js translates them like everything else.
// A category here shows how the system is organised. It is NOT a claim that a module is finished for
// every genre: what is ready for a given game is confirmed in its audio plan (see _dev/docs/confirm.md).
//   covers / behaves / tailored / connected: the four parts of every module card
//   acts:   the game activities it covers (the summary under the builder)
//   world:  what its content sounds like in each example world (same structure, different character)
export const MODULES = [
  {
    id: 'ambient', name: 'Environment & atmosphere', word: 'Shhh…', color: 'var(--mint)', symbol: 'assets/system/mod-ambient.webp',
    covers: ['Background layers of places', 'Weather and natural phenomena', 'Local details: creatures, water, fire, machines'],
    behaves: 'Layers change with zones and states. Details come at varied times instead of one constant loop, and places blend smoothly into each other.',
    tailored: 'Which places and phenomena your world has, its creatures and materials, how dense or calm it sounds.',
    connected: 'The zones and states of your scenes: areas, time of day, weather, whatever your game has.',
    acts: ['Places and their atmosphere', 'Weather', 'Local sound sources'],
    world: { forest: 'Wind in the trees, birds, the stream, the campfire', pirate: 'Surf, gulls, the dock, the rigging', scifi: 'Air hum, vents, glowing panels, doors' },
  },
  {
    id: 'movement', name: 'Movement & surfaces', word: 'Tap-tap', color: 'var(--sky)', symbol: 'assets/system/mod-movement.webp',
    covers: ['Footsteps on the surfaces you need', 'Jumps and landings', 'The character’s gear in motion'],
    behaves: 'Each step picks a variant, the surface switches the material and the level stays even. Reaction to the type of movement where the configuration supports it.',
    tailored: 'The size and weight of your characters, the surfaces and the footwear of the setting.',
    connected: 'Movement events and the surface under the character.',
    acts: ['Footsteps and surfaces', 'Jumps and landings'],
    world: { forest: 'Grass, dirt, the wooden bridge', pirate: 'Sand, the wet planks of the dock', scifi: 'Metal floor, grates, ramps' },
  },
  {
    id: 'combat', name: 'Combat & weapons', word: 'Bonk!', color: 'var(--zest)', symbol: 'assets/system/mod-combat.webp',
    covers: ['Attacks and hits', 'Weapons and materials', 'Outcomes: block, miss, defeat'],
    behaves: 'Weapons, materials and outcomes sound different; variants keep repeats in check. Priorities and balance where the configuration implements them.',
    tailored: 'The kinds of attacks in your game and how heavy or stylised the hits are.',
    connected: 'Attack, hit and outcome events.',
    acts: ['Attacks and hits', 'Weapons and materials'],
    world: { forest: 'A wooden staff, leather, bushes', pirate: 'Cutlasses, pistols, barrels', scifi: 'Blasters, energy shields, armour' },
  },
  {
    id: 'ui', name: 'Interface & feedback', word: 'Ding!', color: 'var(--jam)', symbol: 'assets/system/mod-ui.webp',
    covers: ['Hover, confirm, cancel', 'Errors and warnings', 'Rewards and progress'],
    behaves: 'One sound character for the whole interface, with variants and protection from annoying repetition where supported.',
    tailored: 'The visual style of your interface and the mood of the game.',
    connected: 'Menu and HUD events.',
    acts: ['Menus and buttons', 'Rewards and progress'],
    world: { forest: 'Wood and leaves', pirate: 'Coins and paper maps', scifi: 'Soft beeps and glass' },
  },
  {
    id: 'interactive', name: 'Interactive objects', word: 'Click!', color: 'var(--zest)', symbol: 'assets/system/mod-interactive.webp',
    covers: ['Doors, chests, levers', 'Pick-ups and items', 'Mechanisms in the world'],
    behaves: 'An object sounds by its state: opening, closed, locked, used.',
    tailored: 'The materials and size of the objects in your world.',
    connected: 'Object interaction events.',
    acts: ['Doors and mechanisms', 'Items and pick-ups'],
    world: { forest: 'The hut door, a chest, a well', pirate: 'A treasure chest, the ship’s wheel, a cannon', scifi: 'Sliding doors, consoles, crates' },
  },
  {
    id: 'music', name: 'Music & game states', word: 'La-la', color: 'var(--sky)', symbol: 'assets/system/mod-music.webp',
    covers: ['Music for scenes and menus', 'Changes between game states', 'Short stingers for events'],
    behaves: 'The music follows the game: exploration, danger, victory, with smooth transitions.',
    tailored: 'The genre, instruments and pace of your game.',
    connected: 'Game states and key events.',
    acts: ['Music for scenes', 'Game states and transitions'],
    world: { forest: 'Flutes and soft strings', pirate: 'An accordion and shanty drums', scifi: 'Synth pads and pulses' },
  },
  {
    id: 'special', name: 'Special systems', word: '+', color: 'var(--jam)', symbol: 'assets/system/mod-special.webp',
    covers: ['Systems your game needs beyond the catalogue', 'For example, vehicles or crowds'],
    behaves: 'Designed individually with your team.',
    tailored: 'Built around the mechanics of your game.',
    connected: 'Agreed in the audio plan.',
    acts: ['A special system, on request'],
    world: { forest: 'Planned with your team', pirate: 'Planned with your team', scifi: 'Planned with your team' },
    onRequest: true,
  },
];

// Example worlds: the same modules, a different character. Spots are in the scene's 1600 x 914 units.
export const WORLDS = [
  { id: 'forest', name: 'Forest adventure', img: 'assets/system/scene-forest.webp' },
  { id: 'pirate', name: 'Pirate coast', img: 'assets/system/scene-pirate.webp' },
  { id: 'scifi', name: 'Sci‑fi station', img: 'assets/system/scene-scifi.webp' },
];

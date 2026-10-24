// Where the windshield sits on the girl's boom (round Q; round R: along her pole; 23.10.2026: the round N
// windshield across the tip of her pole, nearly level, the shock mount under it, the picture itself and still).
// Shared by main.js (placing the box and its picture, assets/team/mic-3d.webp, made by _dev/tools/mic_static.py)
// and composeHero (keeping the word off it). The box comes from the round S model with the windshield turned
// across (in _dev/design/retired-r/: q-mic-lab.html?frame=1&tilt=15&ahead=0&toward=0&aspect=1.377&unit=0.1676
// &size=0.6366&pivot=0.567,0.798), so the mount and the pole meet where they did.
//   aspect: box width / height. pivot: where the shock-mount knuckle (the tip of her pole) sits in the box,
//   as fractions. unit: pixels per world unit of the model, as a fraction of the box width. bbox: the
//   windshield, [x0, y0, x1, y1] fractions of the box (keeps the word off it). pole: see below.
export const BOOM_FRAME = {
  aspect: 1.377,
  pivot: [0.567, 0.798],
  unit: 0.1676,
  bbox: [0.055, 0.058, 0.94, 0.855],
  still: 'mic-3d.webp',
  pole: 65.33,   // round V: the pole angle (degrees) the picture was made for; index.html data-pole turns it from there
};

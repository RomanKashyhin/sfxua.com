// Where the windshield sits on the girl's boom (round Q; round R: along her pole; 23.10.2026: the round N
// windshield, js/boom-roll.js; task 2: across the tip of her pole, nearly level, the shock mount under it).
// Shared by main.js (placing the box and the still picture, before the script loads) and composeHero (keeping
// the word off it). The numbers come from the round S model with the windshield turned across (in
// _dev/design/retired-r/: q-mic-lab.html?frame=1&tilt=15&ahead=0&toward=0&aspect=1.377&unit=0.1676&size=0.6366
// &pivot=0.567,0.798); the round N windshield is laid on that model's capsule (_dev/tools/mic_wrap.py), and the
// mount is that model's. bbox is measured on the turning windshield itself, over a full turn.
//   aspect: box width / height. pivot: where the shock-mount knuckle (the tip of her pole) sits in the box,
//   as fractions. unit: pixels per world unit of the model, as a fraction of the box width. tilt: the
//   windshield's own angle, degrees up from the horizon (front end to the right), apart from her pole's.
//   grip: the windshield's ellipse on the screen as [cx, cy, rx, ry] fractions of the box (the handle for
//   dragging). bbox: the windshield with its fur at any turn, [x0, y0, x1, y1] fractions of the box (keeps it
//   off the word).
export const BOOM_FRAME = {
  aspect: 1.377,
  pivot: [0.567, 0.798],
  unit: 0.1676,
  tilt: 15,
  grip: [0.5, 0.45, 0.46, 0.37],
  bbox: [0.025, 0.02, 0.975, 0.89],
  still: 'mic-3d.webp',
};

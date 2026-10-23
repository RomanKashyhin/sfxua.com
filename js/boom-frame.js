// Where the windshield sits on the girl's boom (round Q; round R: along her pole; 23.10.2026: the round N
// windshield, js/boom-roll.js). Shared by main.js (placing the box and the still picture, before the script loads)
// and composeHero (keeping the word off it). The numbers came from the round S 3D model (_dev/design/q-mic-lab.html
// ?frame=1, now in _dev/design/retired-r/); the round N windshield is laid on that model's capsule
// (_dev/tools/mic_wrap.py), so the mount, the box and the hand stayed where they were.
//   aspect: box width / height. pivot: where the shock-mount knuckle (the tip of her pole) sits in the box,
//   as fractions. unit: pixels per world unit of the old model, as a fraction of the box width. grip: the
//   windshield's ellipse on the screen as [cx, cy, rx, ry] fractions of the box (the handle for dragging). bbox:
//   the windshield with its fur at any turn, [x0, y0, x1, y1] fractions of the box (keeps it off the word).
export const BOOM_FRAME = {
  aspect: 0.769,
  pivot: [0.932, 0.586],
  unit: 0.227,
  grip: [0.49, 0.5, 0.43, 0.46],
  bbox: [0.057, 0.044, 0.925, 0.956],
  still: 'mic-3d.webp',
};

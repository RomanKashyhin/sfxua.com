// Round Q (22.10.2026; round R: the windshield along her pole; round S: the round Q fur again): where the 3D windshield sits on the girl's boom. Shared by main.js (placing the box
// and the still picture, before three.js loads) and js/boom-mic3d.js (the camera), so both land in the same
// spot. The numbers come from _dev/design/q-mic-lab.html (?frame=1), which projects the model.
//   aspect: box width / height. pivot: where the shock-mount knuckle (the tip of her pole) sits in the box,
//   as fractions. unit: pixels per world unit, as a fraction of the box width. grip: the windshield's
//   ellipse on the screen as [cx, cy, rx, ry] fractions of the box (the handle for dragging). bbox: the
//   windshield with its fur at any turn, [x0, y0, x1, y1] fractions of the box (keeps it off the word).
export const BOOM_FRAME = {
  aspect: 0.769,
  pivot: [0.932, 0.586],
  unit: 0.227,
  grip: [0.49, 0.5, 0.43, 0.46],
  bbox: [0.057, 0.044, 0.923, 0.956],
  still: 'mic-3d.webp',
};

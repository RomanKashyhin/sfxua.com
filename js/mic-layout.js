// Shared by the 3D scene and the static still, so both land in the same spot.
// No three.js here: this file loads with the page.
const deg = (d) => (d * Math.PI) / 180;

export const MIC = {
  radius: 1.06,
  halfLength: 2.15,
  shapeExp: 3.0,
  fur: 0.42,
  tilt: deg(36),
  pivot: 1.1,          // turntable axis sits this far toward the pole end
  period: 19,          // seconds per full turn
  keyAngle: deg(38),   // three-quarter pose used for the still and the first frame
  elevation: deg(9),
  fov: 24,
  palette: {
    furRoot: '#2e3441',
    furTip: '#d3d8e0',
    rim: '#f4fdff',
    key: '#fff6ea',
    sky: '#bdefff',
    shadow: '#1f6c96',
    carbon: '#2a2f38',
    gunmetal: '#3b414b',
    rubber: '#1c1f26',
    cable: '#181b21',
    jam: '#ff3d8b',
  },
};

// (ax, ay): screen point of the turntable axis at head height. ppu: pixels per world unit.
export function micLayout(width, height, compact) {
  if (compact) {
    const ppu = Math.min(width * 0.15, height * 0.13);
    return { ax: width * 0.52, ay: height * 0.36, ppu };
  }
  const ppu = Math.min(height * 0.112, width * 0.075);
  return { ax: width * 0.565, ay: height * 0.3, ppu };
}

// Written by ?still=1 export (see main.js). Pixel geometry of assets/mic-still.webp.
export const STILL = { w: 2166, h: 1736, ax: 1269, ay: 336, ppu: 224 };

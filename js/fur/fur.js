// deadcat-fur-kit · fur.js
// Shell + fin fur for three.js (r150+, WebGL2). Grows fur on any THREE.Mesh:
// all shells are one instanced draw call, silhouette fins are a second one.
// Fur bends with world-space gravity, lags behind rotation/translation through
// an underdamped spring, and keeps its strand pattern in object space (no UV seams).
//
//   import { addFur } from './fur.js';
//   const fur = addFur(deadcatMesh, 'plush-tufts', { camera });
//   renderer.setAnimationLoop(() => { fur.update(clock.getDelta()); renderer.render(scene, camera); });
//
// The renderer must be created with { antialias: true } for alpha-to-coverage.
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Parameters                                                          */
/* ------------------------------------------------------------------ */
// All lengths are in units of the object's radius (bounding-sphere radius of
// the fur geometry), so presets look the same on a model of any size.
export const FUR_DEFAULTS = {
  shells: 40,            // shell layers (one draw call regardless of count)
  length: 0.23,          // fur length, × object radius
  density: 28,           // strand cells per radius unit
  thickness: 0.46,       // strand radius inside its cell (0.3 thin … 0.65 merged)
  taper: 0.85,           // 0 = blunt cylinders, 1 = sharp cones
  lengthJitter: 0.4,     // random strand length (0 = all equal)
  clump: 0.55,           // strands converge into tufts towards the tip (0 … 0.9)
  clumpScale: 5.4,       // tufts per radius unit (bigger number = smaller tufts)
  tuftPoint: 0.6,        // outer strands of a tuft are shorter → pointed tufts
  curlRadius: 0,         // lock spiral radius, × object radius (0 = straight)
  curlTurns: 0,          // spiral turns along the strand
  curlFlat: 0,           // 0 = round curl, 1 = flat zig-zag wave
  strandCurl: 0,         // per-strand spiral (boucle / lamb curls), radius in strand cells 0 … 0.45
  strandCurlTurns: 2,    // spiral turns per strand
  parting: 0.25,         // darken the partings between tufts
  combDir: [0, 0, 0],    // comb direction in the mesh's local space
  combStrength: 0,       // how hard the fur is combed along combDir
  gravity: 0.42,         // droop towards world -Y
  inertia: 0.1,          // lag behind rotation
  linearInertia: 0.15,   // lag behind translation
  stiffness: 70,         // spring stiffness (lower = floppier, slower wobble)
  damping: 0.2,          // damping ratio (lower = more overshoot)
  wind: 0.1,             // idle breathing / breeze
  windSpeed: 1,
  rootColor: '#2f2b36',
  tipColor: '#c3bdd0',
  tipStart: 0,           // where the tip colour starts along the strand (0 … 0.9)
  rimColor: '#f1ecf8',
  rim: 0.55,             // soft halo on the silhouette
  ao: 0.72,              // darkening towards the roots
  toonSteps: 3,          // 0 = smooth light, 2–4 = cartoon bands
  clumpTint: 0.08,       // brightness variation per tuft
  strandTint: 0.1,       // brightness variation per strand
  fins: true,            // silhouette fins (fix "stacked pancakes" at the edge)
  edgeFix: 1,            // thicken strands at grazing angles
  alphaToCoverage: true  // soft strand edges via MSAA (needs antialias: true)
};

export const FUR_PRESETS = {
  'plush-tufts': {
    name: 'Плюшеві пучки',
    description: 'Середня довжина, м\'які загострені пучки. Універсальний мультяшний дедкет.',
    tags: ['за замовчуванням', 'мультяшний', 'пучки'],
    params: {}
  },
  'shaggy-long': {
    name: 'Кудлатий довгий',
    description: 'Довгий важкий ворс, як у справжнього дедкета: сильно звисає і довго хитається.',
    tags: ['реалістичний', 'довгий', 'інерція'],
    params: {
      shells: 56, length: 0.42, density: 34, thickness: 0.42, taper: 0.9, lengthJitter: 0.5,
      clump: 0.7, clumpScale: 4.0, tuftPoint: 0.7, gravity: 0.7, inertia: 0.14, linearInertia: 0.22,
      stiffness: 42, damping: 0.15, wind: 0.14, rootColor: '#1c1a21', tipColor: '#8f8a9a',
      rimColor: '#d9d4e2', rim: 0.4, toonSteps: 0, ao: 0.8
    }
  },
  'velvet-short': {
    name: 'Короткий оксамит',
    description: 'Дуже короткий густий ворс без пучків, з м\'яким сяйвом по краю. Як велюровий чохол.',
    tags: ['короткий', 'щільний', 'легкий для GPU'],
    params: {
      shells: 20, length: 0.09, density: 64, thickness: 0.5, taper: 0.35, lengthJitter: 0.15, parting: 0,
      clump: 0, tuftPoint: 0, gravity: 0.12, inertia: 0.04, linearInertia: 0.05, wind: 0,
      rootColor: '#3a3542', tipColor: '#a39db3', rimColor: '#f4f0fa', rim: 0.95, ao: 0.5,
      toonSteps: 0, strandTint: 0.06, clumpTint: 0.03
    }
  },
  'cartoon-spikes': {
    name: 'Мультяшні шипи',
    description: 'Мало великих гострих пучків і 2 тони світла. Найбільш «намальований» вигляд.',
    tags: ['стилізований', 'великі пучки', 'тоновий'],
    params: {
      shells: 44, length: 0.27, density: 17, thickness: 0.48, taper: 0.92, lengthJitter: 0.2,
      clump: 0.8, clumpScale: 3.0, tuftPoint: 0.85, gravity: 0.5, inertia: 0.12, stiffness: 85,
      damping: 0.24, rootColor: '#2b2735', tipColor: '#bdb6d0', rim: 0.45, toonSteps: 2, ao: 0.75,
      clumpTint: 0.12, parting: 0.45
    }
  },
  'curly-lamb': {
    name: 'Кучерявий баранчик',
    description: 'Світлі кучері-завитки, що закручуються по спіралі. Пухнасто й мило.',
    tags: ['кучері', 'світлий', 'м\'який'],
    params: {
      shells: 48, length: 0.17, density: 15, thickness: 0.3, taper: 0.15, lengthJitter: 0.2,
      clump: 0.15, clumpScale: 6, tuftPoint: 0.2, strandCurl: 0.32, strandCurlTurns: 1.7,
      gravity: 0.12, inertia: 0.06, linearInertia: 0.08, stiffness: 80, damping: 0.25, wind: 0.05,
      rootColor: '#4e4856', tipColor: '#f1edf5', rimColor: '#ffffff', rim: 0.3, ao: 0.85,
      toonSteps: 3, clumpTint: 0.06, strandTint: 0.12, parting: 0.1, edgeFix: 0.6
    }
  },
  'combed-wavy': {
    name: 'Начесаний хвилястий',
    description: 'М\'які хвилясті пасма, начесані в один бік. Схоже на флісовий чохол.',
    tags: ['хвилі', 'начесаний', 'м\'який'],
    params: {
      shells: 44, length: 0.28, density: 30, thickness: 0.44, taper: 0.85, lengthJitter: 0.3,
      clump: 0.5, clumpScale: 5, tuftPoint: 0.5, curlRadius: 0.03, curlTurns: 2, curlFlat: 1,
      combDir: [-1, -0.25, 0], combStrength: 0.9, gravity: 0.3, inertia: 0.1,
      rootColor: '#2d2a33', tipColor: '#b6b0c4', toonSteps: 3
    }
  },
  'matted-clumps': {
    name: 'Збиті ковтуни',
    description: 'Товсті тупі ковтуни з глибокими проділами між ними. Пошарпаний вигляд.',
    tags: ['ковтуни', 'тупі пучки', 'фактурний'],
    params: {
      shells: 44, length: 0.25, density: 24, thickness: 0.5, taper: 0.6, lengthJitter: 0.3,
      clump: 0.82, clumpScale: 4.2, tuftPoint: 0.55, gravity: 0.6, inertia: 0.1, stiffness: 55,
      rootColor: '#1f1c25', tipColor: '#a19bad', ao: 0.85, rim: 0.4, toonSteps: 3, clumpTint: 0.2,
      parting: 0.6
    }
  },
  'frosted-wisps': {
    name: 'Пасма з інеєм',
    description: 'Рідші тонкі пасма з темним підшерстком і світлими кінчиками.',
    tags: ['двоколірний', 'рідкий', 'контрастний'],
    params: {
      shells: 48, length: 0.3, density: 18, thickness: 0.3, taper: 0.95, lengthJitter: 0.6,
      clump: 0.6, clumpScale: 6, tuftPoint: 0.55, gravity: 0.45, inertia: 0.12, stiffness: 60,
      damping: 0.18, rootColor: '#25222b', tipColor: '#f3f0f8', tipStart: 0.5, rim: 0.6, ao: 0.6,
      toonSteps: 0
    }
  }
};

export const FUR_COLORWAYS = {
  graphite: { name: 'Графіт', rootColor: '#2f2b36', tipColor: '#c3bdd0' },
  black: { name: 'Чорний', rootColor: '#121116', tipColor: '#55515e' },
  light: { name: 'Світлий', rootColor: '#6f6a78', tipColor: '#f5f3f8' },
  brown: { name: 'Коричневий', rootColor: '#2e2119', tipColor: '#b8916f' },
  sand: { name: 'Пісочний', rootColor: '#5a4b3a', tipColor: '#e7d8bf' }
};

export function resolveFurParams(preset, overrides = {}) {
  const base = typeof preset === 'string' ? FUR_PRESETS[preset] : preset;
  if (typeof preset === 'string' && !base) throw new Error(`Unknown fur preset "${preset}". Known: ${Object.keys(FUR_PRESETS).join(', ')}`);
  const fromPreset = base ? (base.params || base) : {};
  return { ...FUR_DEFAULTS, ...fromPreset, ...overrides };
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */
const VS_COMMON = /* glsl */`
uniform float uLen;
uniform float uScale;
uniform vec3 uGrav;
uniform vec3 uComb;
uniform vec3 uOmega;
uniform float uInertia;
uniform vec3 uVel;
uniform float uLinInertia;
uniform vec3 uWind;
uniform float uTime;
uniform float uWindSpeed;
varying vec3 vBase;
varying vec3 vN;
varying vec3 vNW;
varying vec3 vV;
varying float vH;
vec3 furOffset(vec3 pos, vec3 n, float h){
  vec3 p = pos / uScale;
  vec3 bend = uGrav + uComb - cross(uOmega, p) * uInertia - uVel * uLinInertia;
  float ph = dot(p, vec3(3.1, 1.7, 2.3));
  bend += uWind * (0.6 + 0.4 * sin(uTime * 2.3 * uWindSpeed + ph));
  bend -= n * min(dot(bend, n) + 0.55, 0.0);
  float bl = length(bend);
  if (bl > 1.3) bend *= 1.3 / bl;
  float s = 1.0 / max(length(n + bend), 0.4);
  return (n * h + bend * h * h) * s;
}
`;

const FS_COMMON = /* glsl */`
uniform vec3 uRootCol;
uniform vec3 uTipCol;
uniform vec3 uRimCol;
uniform vec3 uLight;
uniform float uTipStart;
uniform float uRim;
uniform float uAO;
uniform float uToonSteps;
uniform float uClumpTint;
uniform float uStrandTint;
uniform float uA2C;
uniform float uScale;
uniform float uDensity;
uniform float uThick;
uniform float uTaper;
uniform float uLenJitter;
uniform float uClump;
uniform float uClumpScale;
uniform float uTuftPoint;
uniform float uCurlR;
uniform float uCurlTurns;
uniform float uCurlFlat;
uniform float uSCurl;
uniform float uSCurlTurns;
uniform float uParting;
uniform float uEdgeFix;
varying vec3 vBase;
varying vec3 vN;
varying vec3 vNW;
varying vec3 vV;
varying float vH;
vec3 shadeFur(vec3 Nw, vec3 V, float h, float hn, float sRnd, float cRnd){
  vec3 L = normalize(uLight);
  float diff = dot(Nw, L) * 0.5 + 0.5;
  if (uToonSteps > 0.5) {
    float q = diff * uToonSteps;
    diff = (floor(q) + smoothstep(0.42, 0.58, fract(q))) / uToonSteps;
    diff = 0.2 + 0.8 * diff;
  }
  float ao = mix(1.0 - uAO, 1.0, pow(clamp(h, 0.0, 1.0), 0.7));
  vec3 col = mix(uRootCol, uTipCol, smoothstep(uTipStart, 1.0, hn));
  col *= 1.0 + (sRnd - 0.5) * 2.0 * uStrandTint;
  col *= 1.0 + (cRnd - 0.5) * 2.0 * uClumpTint;
  col *= (0.3 + 0.75 * diff) * ao;
  float ndv = clamp(abs(dot(Nw, V)), 0.0, 1.0);
  col += uRimCol * pow(1.0 - ndv, 3.0) * hn * uRim;
  return col;
}
float coverage(float dist, float radius, float aa){
  return clamp((radius - dist) / (aa * 1.5) + 0.5, 0.0, 1.0);
}
`;

const SHELL_VS = VS_COMMON + /* glsl */`
attribute float aShell;
void main(){
  vec3 n = normalize(normal);
  float h = aShell;
  vec3 p = position + furOffset(position, n, h) * uLen;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vBase = position; vN = n; vH = h;
  vNW = normalize(mat3(modelMatrix) * n);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SHELL_FS = FS_COMMON + /* glsl */`
vec3 hash33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
// nearest jittered feature point, distance measured in the surface tangent plane
void nearestT(vec3 q, vec3 n, float jit, out vec3 fp, out float id, out float d2){
  vec3 c = floor(q - 0.5);
  d2 = 1e9; fp = q; id = 0.0;
  for (int i = 0; i < 2; i++)
  for (int j = 0; j < 2; j++)
  for (int k = 0; k < 2; k++){
    vec3 cell = c + vec3(float(i), float(j), float(k));
    vec3 f = cell + 0.5 + (hash33(cell) - 0.5) * jit;
    vec3 d = f - q; d -= n * dot(d, n);
    float dd = dot(d, d);
    if (dd < d2){ d2 = dd; fp = f; id = hash13(cell + 19.19); }
  }
}
// same, but every strand spirals around its root with its own phase (boucle curls)
void nearestCurl(vec3 q, vec3 n, vec3 t1, vec3 t2, float h, out float id, out float d2){
  vec3 c = floor(q - 0.5);
  d2 = 1e9; id = 0.0;
  for (int i = 0; i < 2; i++)
  for (int j = 0; j < 2; j++)
  for (int k = 0; k < 2; k++){
    vec3 cell = c + vec3(float(i), float(j), float(k));
    vec3 rnd = hash33(cell);
    vec3 f = cell + 0.5 + (rnd - 0.5) * 0.4;
    float ph = rnd.x * 6.2831853;
    float a = ph + h * uSCurlTurns * (0.8 + 0.4 * rnd.y) * 6.2831853;
    f += ((cos(a) - cos(ph)) * t1 + (sin(a) - sin(ph)) * t2) * uSCurl;
    vec3 d = f - q; d -= n * dot(d, n);
    float dd = dot(d, d);
    if (dd < d2){ d2 = dd; id = hash13(cell + 19.19); }
  }
}
void main(){
  vec3 n = normalize(vN);
  float h = vH;
  vec3 Nw = normalize(vNW);
  vec3 V = normalize(vV);
  vec3 b = vBase / uScale;
  vec3 cf; float cid; float cd2;
  nearestT(b * uClumpScale, n, 0.85, cf, cid, cd2);
  vec3 cc = cf / uClumpScale;
  vec3 t1 = normalize(cross(normalize(vec3(0.37, 0.52, 0.77)), n));
  vec3 t2 = cross(n, t1);
  if (uCurlR > 0.0) {
    float ph = cid * 6.2831853;
    float a = ph + h * uCurlTurns * 6.2831853;
    float squash = 1.0 - uCurlFlat;
    vec3 o = (cos(a) - cos(ph)) * t1 + (sin(a) - sin(ph)) * squash * t2;
    b -= o * uCurlR;
  }
  float k = min(uClump * h, 0.88);
  vec3 r = cc + (b - cc) / (1.0 - k);
  vec3 sf; float sid; float sd2;
  if (uSCurl > 0.0) nearestCurl(r * uDensity, n, t1, t2, h, sid, sd2);
  else nearestT(r * uDensity, n, 0.75, sf, sid, sd2);
  float dist = sqrt(sd2);
  float aa = clamp(fwidth(dist), 0.02, 0.35);
  vec3 dc = r - cc; dc -= n * dot(dc, n);
  float cdn = length(dc) * uClumpScale;
  float part = 1.0 - uParting * smoothstep(0.3, 0.95, cdn) * smoothstep(0.0, 0.35, h);
  float len = (1.0 - uLenJitter * sid) * (1.0 - uClump * uTuftPoint * smoothstep(0.15, 0.85, cdn));
  float hn = h / max(len, 0.05);
  float ndv = abs(dot(Nw, V));
  float radius = uThick * (1.0 - uTaper * hn);
  radius *= 1.0 + uEdgeFix * 1.3 * pow(1.0 - ndv, 3.0);
  float cov = coverage(dist, radius, aa);
  if (hn > 1.0) cov = 0.0;
  if (h < 0.0001) { cov = 1.0; hn = 0.0; }
  if (uA2C < 0.5) { if (cov < 0.5) discard; cov = 1.0; }
  else if (cov < 0.02) discard;
  gl_FragColor = vec4(shadeFur(Nw, V, h, min(hn, 1.0), sid, cid) * part, cov);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const FIN_VS = VS_COMMON + /* glsl */`
attribute float aH;
attribute float aU;
attribute float aSeed;
attribute vec3 aFinN;
varying float vU;
varying float vSeed;
varying vec3 vFinNW;
void main(){
  vec3 n = normalize(normal);
  vec3 p = position + furOffset(position, n, aH) * uLen;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vBase = position; vN = n; vH = aH; vU = aU / uScale; vSeed = aSeed;
  vNW = normalize(mat3(modelMatrix) * n);
  vFinNW = normalize(mat3(modelMatrix) * aFinN);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FIN_FS = FS_COMMON + /* glsl */`
varying float vU;
varying float vSeed;
varying vec3 vFinNW;
float h11(float x){ return fract(sin(x * 127.1 + 11.7) * 43758.5453); }
void main(){
  float h = vH;
  vec3 Nw = normalize(vNW);
  vec3 V = normalize(vV);
  float u = vU + vSeed * 37.0;
  float ccell = floor(u * uClumpScale);
  float cu = (ccell + 0.5) / uClumpScale;
  float cidf = h11(ccell + 3.1);
  if (uCurlR > 0.0) {
    float ph = cidf * 6.2831853;
    u -= (sin(ph + h * uCurlTurns * 6.2831853) - sin(ph)) * uCurlR;
  }
  float k = min(uClump * h, 0.88);
  float r = cu + (u - cu) / (1.0 - k);
  float q = r * uDensity;
  if (uSCurl > 0.0) {
    float ph = h11(floor(q) + vSeed * 5.0) * 6.2831853;
    q -= (sin(ph + h * uSCurlTurns * 6.2831853) - sin(ph)) * uSCurl;
  }
  float cell = floor(q);
  float rnd = h11(cell + vSeed * 13.0);
  float center = cell + 0.5 + (rnd - 0.5) * 0.5;
  float dist = abs(q - center);
  float aa = clamp(fwidth(q), 0.02, 0.35);
  float cdn = abs(r - cu) * uClumpScale * 2.0;
  float part = 1.0 - uParting * smoothstep(0.3, 0.95, cdn) * smoothstep(0.0, 0.35, h);
  float len = (1.0 - uLenJitter * rnd) * (1.0 - uClump * uTuftPoint * smoothstep(0.15, 0.85, cdn));
  float hn = h / max(len, 0.05);
  float radius = uThick * 1.15 * (1.0 - uTaper * hn);
  float cov = coverage(dist, radius, aa);
  if (hn > 1.0) cov = 0.0;
  float ndv = abs(dot(Nw, V));
  float fade = (1.0 - smoothstep(0.12, 0.45, ndv)) * smoothstep(0.1, 0.45, abs(dot(normalize(vFinNW), V)));
  cov *= fade;
  if (uA2C < 0.5) { if (cov < 0.5) discard; cov = 1.0; }
  else if (cov < 0.02) discard;
  gl_FragColor = vec4(shadeFur(Nw, V, h, min(hn, 1.0), rnd, cidf) * part, cov);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */
function buildFins(g, rows = 4) {
  const P = g.attributes.position, N = g.attributes.normal;
  const I = g.index ? g.index.array : Array.from({ length: P.count }, (_, i) => i);
  const key = i => Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4);
  const canon = new Map(), remap = new Uint32Array(P.count);
  for (let i = 0; i < P.count; i++) { const k = key(i); if (!canon.has(k)) canon.set(k, i); remap[i] = canon.get(k); }
  const seen = new Set(), edges = [];
  for (let t = 0; t + 2 < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = remap[I[t + e]], b = remap[I[t + (e + 1) % 3]];
      if (a === b) continue;
      const lo = Math.min(a, b), hi = Math.max(a, b), k = lo * 4194304 + hi;
      if (seen.has(k)) continue;
      seen.add(k); edges.push(lo, hi);
    }
  }
  const E = edges.length / 2, vpe = (rows + 1) * 2;
  const pos = new Float32Array(E * vpe * 3), nor = new Float32Array(E * vpe * 3), fin = new Float32Array(E * vpe * 3);
  const aH = new Float32Array(E * vpe), aU = new Float32Array(E * vpe), aS = new Float32Array(E * vpe);
  const idx = new Uint32Array(E * rows * 6);
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), na = new THREE.Vector3(), nb = new THREE.Vector3();
  const ed = new THREE.Vector3(), nav = new THREE.Vector3(), fn = new THREE.Vector3();
  let ii = 0;
  for (let e = 0; e < E; e++) {
    const a = edges[2 * e], b = edges[2 * e + 1];
    va.fromBufferAttribute(P, a); vb.fromBufferAttribute(P, b);
    na.fromBufferAttribute(N, a).normalize(); nb.fromBufferAttribute(N, b).normalize();
    ed.subVectors(vb, va); const len = ed.length();
    nav.addVectors(na, nb).normalize();
    fn.crossVectors(ed, nav).normalize();
    const seed = Math.random();
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < 2; c++) {
        const vi = e * vpe + r * 2 + c, v = c ? vb : va, nn = c ? nb : na;
        pos[vi * 3] = v.x; pos[vi * 3 + 1] = v.y; pos[vi * 3 + 2] = v.z;
        nor[vi * 3] = nn.x; nor[vi * 3 + 1] = nn.y; nor[vi * 3 + 2] = nn.z;
        fin[vi * 3] = fn.x; fin[vi * 3 + 1] = fn.y; fin[vi * 3 + 2] = fn.z;
        aH[vi] = r / rows; aU[vi] = c ? len : 0; aS[vi] = seed;
      }
    }
    for (let r = 0; r < rows; r++) {
      const i0 = e * vpe + r * 2;
      idx[ii++] = i0; idx[ii++] = i0 + 1; idx[ii++] = i0 + 2;
      idx[ii++] = i0 + 1; idx[ii++] = i0 + 3; idx[ii++] = i0 + 2;
    }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  fg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  fg.setAttribute('aFinN', new THREE.BufferAttribute(fin, 3));
  fg.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  fg.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  fg.setAttribute('aSeed', new THREE.BufferAttribute(aS, 1));
  fg.setIndex(new THREE.BufferAttribute(idx, 1));
  return fg;
}

/**
 * Capsule geometry fitted to an object's bounding box along its longest axis.
 * Use it as `options.geometry` when the deadcat is not a separate mesh, or when
 * the real mesh is too dense for fins (> ~20k triangles).
 */
export function capsuleFromBounds(object, { radialSegments = 56, capSegments = 18, inset = 0 } = {}) {
  object.updateWorldMatrix(true, true);
  const geom = object.geometry;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const box = geom.boundingBox, size = new THREE.Vector3(), center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  const long = size[axis];
  const others = ['x', 'y', 'z'].filter(a => a !== axis).map(a => size[a]);
  const radius = Math.max(1e-4, Math.min(...others) / 2 - inset);
  const g = new THREE.CapsuleGeometry(radius, Math.max(0, long - 2 * radius), capSegments, radialSegments);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(center.x, center.y, center.z);
  return g;
}

/**
 * Apply a fur-config.json exported from gallery.html:
 *   { mode: '3d', preset: 'curly-lamb', overrides: { tipColor: '#fff' } }
 */
export function addFurFromConfig(target, config, options = {}) {
  if (config.mode && config.mode !== '3d') throw new Error('addFurFromConfig: this config is for the 2D module (src/fur2d.js)');
  return addFur(target, config.preset || 'plush-tufts', { ...options, overrides: { ...(config.overrides || {}), ...(options.overrides || {}) } });
}

/* ------------------------------------------------------------------ */
/* Controller                                                          */
/* ------------------------------------------------------------------ */
const DOWN = new THREE.Vector3(0, -1, 0);
const DEFAULT_LIGHT = new THREE.Vector3(0.45, 0.65, 0.6).normalize();
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _dq = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3();

function angularVelocity(prev, cur, dt, out) {
  _dq.copy(cur).multiply(_qi.copy(prev).invert());
  if (_dq.w < 0) { _dq.x = -_dq.x; _dq.y = -_dq.y; _dq.z = -_dq.z; _dq.w = -_dq.w; }
  const w = Math.min(1, _dq.w), angle = 2 * Math.acos(w), s = Math.sqrt(Math.max(0, 1 - w * w));
  if (s < 1e-6) return out.set(0, 0, 0);
  return out.set(_dq.x / s, _dq.y / s, _dq.z / s).multiplyScalar(angle / dt);
}

/**
 * Grow fur on a mesh.
 * @param {THREE.Mesh} target  mesh whose surface gets fur (fur meshes are added as its children)
 * @param {string|object} preset  preset id from FUR_PRESETS, or a params object
 * @param {object} [options]
 *   overrides   – param overrides on top of the preset (e.g. { length: 0.3, tipColor: '#fff' })
 *   geometry    – grow fur from this geometry instead of target.geometry (see capsuleFromBounds)
 *   camera      – pass the camera if the user rotates the CAMERA (OrbitControls) rather than the object;
 *                 fur then reacts to the relative rotation
 *   light       – THREE.DirectionalLight to take the light direction from (else a fixed top-front light)
 *   quality     – multiplier for the shell count (e.g. 0.5 on phones)
 *   hideBase    – hide the original surface (default: true; false when `geometry` is given,
 *                 because then the mesh may also contain the mic body — pass true for a dense deadcat)
 *   scale       – object radius in local units (default: bounding-sphere radius of the fur geometry)
 */
export function addFur(target, preset = 'plush-tufts', options = {}) {
  if (!target || !target.isMesh) throw new Error('addFur: target must be a THREE.Mesh');
  const params = resolveFurParams(preset, options.overrides);
  let quality = options.quality ?? 1;

  const src = options.geometry || target.geometry;
  const geo = src.attributes.normal ? src : src.clone();
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const scale = options.scale ?? geo.boundingSphere.radius;

  const U = {
    uLen: { value: 0 }, uScale: { value: scale }, uGrav: { value: new THREE.Vector3() }, uComb: { value: new THREE.Vector3() },
    uOmega: { value: new THREE.Vector3() }, uInertia: { value: 0 }, uVel: { value: new THREE.Vector3() }, uLinInertia: { value: 0 },
    uWind: { value: new THREE.Vector3() }, uTime: { value: 0 }, uWindSpeed: { value: 1 },
    uRootCol: { value: new THREE.Color() }, uTipCol: { value: new THREE.Color() }, uRimCol: { value: new THREE.Color() },
    uLight: { value: DEFAULT_LIGHT.clone() }, uTipStart: { value: 0 }, uRim: { value: 0 }, uAO: { value: 0 },
    uToonSteps: { value: 0 }, uClumpTint: { value: 0 }, uStrandTint: { value: 0 }, uA2C: { value: 1 },
    uDensity: { value: 0 }, uThick: { value: 0 }, uTaper: { value: 0 }, uLenJitter: { value: 0 }, uClump: { value: 0 },
    uClumpScale: { value: 1 }, uTuftPoint: { value: 0 }, uCurlR: { value: 0 }, uCurlTurns: { value: 0 }, uCurlFlat: { value: 0 },
    uSCurl: { value: 0 }, uSCurlTurns: { value: 0 }, uParting: { value: 0 }, uEdgeFix: { value: 0 }
  };

  // shells: instance 0 is the opaque skin (h = 0), instances 1..n are fur layers
  const MAX_SHELLS = 96;
  const shellGeo = new THREE.InstancedBufferGeometry();
  if (geo.index) shellGeo.setIndex(geo.index);
  shellGeo.setAttribute('position', geo.attributes.position);
  shellGeo.setAttribute('normal', geo.attributes.normal);
  const hArr = new Float32Array(MAX_SHELLS + 1);
  const hAttr = new THREE.InstancedBufferAttribute(hArr, 1);
  shellGeo.setAttribute('aShell', hAttr);

  // Alpha-to-coverage writes strand coverage into the alpha channel. Plain "replace" blending then
  // leaves straight (non-premultiplied) colour with alpha < 1, and the browser bleaches the fur with
  // the page background. Premultiplied "over" blending keeps colour and alpha consistent, so the fur
  // looks the same on an opaque canvas and on a transparent one ({ alpha: true }).
  const matOpts = {
    uniforms: U, alphaToCoverage: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor
  };
  const shellMat = new THREE.ShaderMaterial({ ...matOpts, vertexShader: SHELL_VS, fragmentShader: SHELL_FS, side: THREE.FrontSide });
  const finMat = new THREE.ShaderMaterial({ ...matOpts, vertexShader: FIN_VS, fragmentShader: FIN_FS, side: THREE.DoubleSide });

  const group = new THREE.Group();
  group.name = 'fur';
  const shells = new THREE.Mesh(shellGeo, shellMat);
  shells.name = 'fur-shells';
  shells.frustumCulled = false;
  group.add(shells);
  let fins = null;
  function ensureFins() {
    if (fins) return fins;
    fins = new THREE.Mesh(buildFins(geo, 4), finMat);
    fins.name = 'fur-fins';
    fins.frustumCulled = false;
    group.add(fins);
    return fins;
  }
  target.add(group);

  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const originalMaterial = target.material;
  // by default the fur's own skin replaces the surface; with a proxy geometry the base stays visible unless asked
  if (options.hideBase ?? !options.geometry) target.material = hidden;

  function applyShells() {
    const n = Math.max(2, Math.min(MAX_SHELLS, Math.round(params.shells * quality)));
    hArr[0] = 0;
    for (let i = 1; i <= n; i++) hArr[i] = i / n;
    hAttr.needsUpdate = true;
    shellGeo.instanceCount = n + 1;
  }

  function apply() {
    applyShells();
    U.uLen.value = params.length * scale;
    U.uDensity.value = params.density;
    U.uThick.value = params.thickness;
    U.uTaper.value = params.taper;
    U.uLenJitter.value = params.lengthJitter;
    U.uClump.value = params.clump;
    U.uClumpScale.value = params.clumpScale;
    U.uTuftPoint.value = params.tuftPoint;
    U.uCurlR.value = params.curlRadius;
    U.uCurlTurns.value = params.curlTurns;
    U.uCurlFlat.value = params.curlFlat;
    U.uSCurl.value = params.strandCurl;
    U.uSCurlTurns.value = params.strandCurlTurns;
    U.uParting.value = params.parting;
    U.uInertia.value = params.inertia;
    U.uLinInertia.value = params.linearInertia;
    U.uWindSpeed.value = params.windSpeed;
    U.uRootCol.value.set(params.rootColor);
    U.uTipCol.value.set(params.tipColor);
    U.uRimCol.value.set(params.rimColor);
    U.uTipStart.value = params.tipStart;
    U.uRim.value = params.rim;
    U.uAO.value = params.ao;
    U.uToonSteps.value = params.toonSteps;
    U.uClumpTint.value = params.clumpTint;
    U.uStrandTint.value = params.strandTint;
    U.uEdgeFix.value = params.edgeFix;
    U.uA2C.value = params.alphaToCoverage ? 1 : 0;
    shellMat.alphaToCoverage = finMat.alphaToCoverage = !!params.alphaToCoverage;
    const c = params.combDir || [0, 0, 0];
    U.uComb.value.set(c[0], c[1], c[2]);
    if (U.uComb.value.lengthSq() > 0) U.uComb.value.normalize().multiplyScalar(params.combStrength);
    if (params.fins) ensureFins().visible = true;
    else if (fins) fins.visible = false;
  }
  apply();

  // motion state
  const st = {
    first: true, prevQ: new THREE.Quaternion(), prevPos: new THREE.Vector3(), prevCamQ: new THREE.Quaternion(),
    omega: new THREE.Vector3(), lag: new THREE.Vector3(), lagV: new THREE.Vector3(),
    vel: new THREE.Vector3(), vlag: new THREE.Vector3(), vlagV: new THREE.Vector3(), wind: new THREE.Vector3()
  };

  function update(dt = 1 / 60) {
    dt = Math.min(Math.max(dt, 1e-4), 0.05);
    target.updateWorldMatrix(true, false);
    target.matrixWorld.decompose(_p, _q, _s);
    const worldRadius = scale * Math.max(_s.x, _s.y, _s.z);
    const cam = options.camera;
    if (cam) cam.updateWorldMatrix(true, false);
    if (st.first) {
      st.prevQ.copy(_q); st.prevPos.copy(_p);
      if (cam) cam.getWorldQuaternion(st.prevCamQ);
      st.first = false;
    }
    // angular velocity of the object relative to the viewer (world space)
    angularVelocity(st.prevQ, _q, dt, _a);
    if (cam) {
      const camQ = cam.getWorldQuaternion(new THREE.Quaternion());
      _a.sub(angularVelocity(st.prevCamQ, camQ, dt, _v));
      st.prevCamQ.copy(camQ);
    }
    if (_a.length() > 25) _a.setLength(25);
    st.omega.lerp(_a, 1 - Math.exp(-dt * 30));
    // linear velocity in object radii per second
    _v.subVectors(_p, st.prevPos).divideScalar(dt * Math.max(worldRadius, 1e-6));
    if (_v.length() > 30) _v.setLength(30);
    st.vel.lerp(_v, 1 - Math.exp(-dt * 30));
    st.prevQ.copy(_q); st.prevPos.copy(_p);

    // underdamped springs: the fur lags, then overshoots once the motion stops
    const K = params.stiffness, C = 2 * Math.sqrt(K) * params.damping, n = 4, h = dt / n;
    for (let i = 0; i < n; i++) {
      _v.copy(st.omega).sub(st.lag).multiplyScalar(K).addScaledVector(st.lagV, -C);
      st.lagV.addScaledVector(_v, h); st.lag.addScaledVector(st.lagV, h);
      _v.copy(st.vel).sub(st.vlag).multiplyScalar(K).addScaledVector(st.vlagV, -C);
      st.vlagV.addScaledVector(_v, h); st.vlag.addScaledVector(st.vlagV, h);
    }

    _qi.copy(_q).invert();
    U.uOmega.value.copy(st.lag).applyQuaternion(_qi);
    U.uVel.value.copy(st.vlag).applyQuaternion(_qi);
    U.uGrav.value.copy(DOWN).applyQuaternion(_qi).multiplyScalar(params.gravity);
    U.uTime.value += dt;
    const t = U.uTime.value * params.windSpeed;
    st.wind.set(Math.sin(t * 0.7) * 1.2, 0, Math.cos(t * 0.53) * 0.9).multiplyScalar(params.wind);
    U.uWind.value.copy(st.wind).applyQuaternion(_qi);
    const light = options.light;
    if (light && light.isDirectionalLight) {
      light.updateWorldMatrix(true, false); light.target.updateWorldMatrix(true, false);
      U.uLight.value.setFromMatrixPosition(light.matrixWorld).sub(_v.setFromMatrixPosition(light.target.matrixWorld)).normalize();
    }
  }

  return {
    group, shells, get fins() { return fins; }, uniforms: U, params,
    update,
    /** switch to another preset (keeps motion state); extra overrides are applied on top */
    setPreset(next, overrides = {}) { Object.assign(params, resolveFurParams(next, overrides)); apply(); },
    /** tweak individual params, e.g. fur.set({ length: 0.3, tipColor: '#ffffff' }) */
    set(patch) { Object.assign(params, patch); apply(); },
    setQuality(q) { quality = q; applyShells(); },
    /** kick the fur as if the object was flicked (handy for testing): axis in world space, speed in rad/s */
    impulse(axis = new THREE.Vector3(0, 1, 0), speed = 6) { st.lagV.addScaledVector(axis.clone().normalize(), speed * params.stiffness * 0.05); },
    dispose() {
      target.remove(group);
      shellGeo.dispose(); shellMat.dispose(); finMat.dispose(); hidden.dispose();
      if (fins) fins.geometry.dispose();
      if (target.material === hidden) target.material = originalMaterial;
      if (geo !== src) geo.dispose();
    }
  };
}

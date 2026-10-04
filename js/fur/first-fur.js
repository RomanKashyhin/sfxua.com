// SoundFX · first-fur.js
// The very first fur of the site's microphone (round 1, archive/mic-shells/mic.js), as a module with
// the same handle as deadcat-fur-kit's fur.js (update, set, setPreset, setQuality, params, dispose),
// so the gallery (tools/fur-gallery.html) and js/mic.js can switch to it like to any other variant.
//
// 72 instanced shells; strands from a tileable Voronoi field, tips gathered into tufts by a second
// field; planar projection by the dominant axis of the object normal. Lengths are in units of the
// object's radius (bounding-sphere radius), so it looks the same on the site's zeppelin and on the
// gallery's capsule. Fur lags behind the object's own rotation, measured from its world matrix.
import * as THREE from 'three';

const REF = 2.15;   // bounding radius of the site's zeppelin, which round 1 was tuned on

export const FIRST_FUR = {
  name: 'Найперший',
  description: 'Перший ворс сайту: світлі загострені пучки, 72 шари. Повернуто з архіву для порівняння.',
  tags: ['перший раунд', 'світлий', 'пучки'],
  params: {
    shells: 72,
    length: 0.42 / REF,          // × object radius
    density: 0.56 * 64 * REF,    // strand cells per object radius (0.56 tiles per unit, 64 cells per tile)
    clump: 0.42,                 // tips gather into tufts
    gravity: 0.35,
    drag: 0.55,                  // lag behind the rotation
    rim: 0.9,                    // halo on the silhouette
    rootColor: '#2e3441',
    tipColor: '#d3d8e0',
    rimColor: '#f4fdff',
    keyColor: '#fff6ea',
    skyColor: '#bdefff',
  },
};

export function resolveFirstParams(overrides = {}) {
  const out = { ...FIRST_FUR.params };
  for (const [k, v] of Object.entries(overrides)) if (k in out) out[k] = v;
  return out;
}

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable strand field: R = distance to nearest strand centre (in cells), G = strand length, B = tint.
function strandTexture(size = 512, cells = 64) {
  const rand = mulberry32(1987);
  const cs = size / cells, n = cells * cells;
  const cx = new Float32Array(n), cy = new Float32Array(n), len = new Float32Array(n), tint = new Float32Array(n);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const k = j * cells + i;
    cx[k] = (i + 0.12 + 0.76 * rand()) * cs; cy[k] = (j + 0.12 + 0.76 * rand()) * cs;
    len[k] = rand(); tint[k] = rand();
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const gj = Math.floor(y / cs);
    for (let x = 0; x < size; x++) {
      const gi = Math.floor(x / cs);
      let best = 1e9, bk = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = (gi + di + cells) % cells, nj = (gj + dj + cells) % cells, k = nj * cells + ni;
        const d = (x + 0.5 - (cx[k] + (gi + di - ni) * cs)) ** 2 + (y + 0.5 - (cy[k] + (gj + dj - nj) * cs)) ** 2;
        if (d < best) { best = d; bk = k; }
      }
      const o = (y * size + x) * 4;
      data[o] = Math.min(255, (Math.sqrt(best) / cs) * 255); data[o + 1] = len[bk] * 255; data[o + 2] = tint[bk] * 255; data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false; tex.needsUpdate = true;
  return tex;
}

// Tileable clump field: RG = vector to the nearest clump centre (in clump cells), B = clump shade.
function clumpTexture(size = 256, cells = 10) {
  const rand = mulberry32(4242);
  const cs = size / cells, n = cells * cells;
  const cx = new Float32Array(n), cy = new Float32Array(n), shade = new Float32Array(n);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const k = j * cells + i;
    cx[k] = (i + 0.2 + 0.6 * rand()) * cs; cy[k] = (j + 0.2 + 0.6 * rand()) * cs; shade[k] = rand();
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const gj = Math.floor(y / cs);
    for (let x = 0; x < size; x++) {
      const gi = Math.floor(x / cs);
      let best = 1e9, bx = 0, by = 0, bk = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = (gi + di + cells) % cells, nj = (gj + dj + cells) % cells, k = nj * cells + ni;
        const px = cx[k] + (gi + di - ni) * cs, py = cy[k] + (gj + dj - nj) * cs;
        const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
        if (d < best) { best = d; bx = px - x - 0.5; by = py - y - 0.5; bk = k; }
      }
      const o = (y * size + x) * 4;
      data[o] = (Math.max(-1, Math.min(1, bx / cs)) * 0.5 + 0.5) * 255;
      data[o + 1] = (Math.max(-1, Math.min(1, by / cs)) * 0.5 + 0.5) * 255;
      data[o + 2] = shade[bk] * 255; data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false; tex.needsUpdate = true;
  return tex;
}

const vertexShader = /* glsl */ `
  attribute float aLayer;
  uniform float uFurLen, uR, uDrag, uGravity;
  uniform vec3 uOmega;          // lagged angular velocity of the object (world)
  varying vec3 vRoot, vObjN, vWorldN, vWorldPos;
  varying float vH;
  void main() {
    float h = aLayer;
    vec3 n = normalize(normal);
    vec4 wp = modelMatrix * vec4(position + n * uFurLen * h, 1.0);
    vec3 wn = normalize(mat3(modelMatrix) * n);
    vec3 root = position * (${REF.toFixed(2)} / uR);      // round 1 was drawn in the zeppelin's own units
    vec3 clump = vec3(sin(root.x * 3.1 + root.y * 1.7), sin(root.y * 2.3 + root.z * 2.9), sin(root.z * 2.7 + root.x * 1.3));
    clump += 0.45 * vec3(sin(root.y * 7.0), sin(root.z * 6.0), sin(root.x * 8.0));
    vec3 vel = cross(uOmega, wp.xyz) * (${REF.toFixed(2)} / uR);
    vec3 disp = vec3(0.0, -uGravity, 0.0) - vel * uDrag + clump * 0.5;
    disp -= wn * dot(disp, wn) * 0.7;                     // bend, don't stretch
    wp.xyz += disp * uFurLen * h * h;
    vRoot = position / uR; vObjN = n; vWorldN = wn; vWorldPos = wp.xyz; vH = h;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uStrands, uClumps;
  uniform float uClumpCells, uClump, uDensity, uRimStrength;
  uniform vec3 uRoot, uTip, uKeyDir, uKey, uSky, uRim;
  varying vec3 vRoot, vObjN, vWorldN, vWorldPos;
  varying float vH;
  void main() {
    float h = vH;
    vec3 an = abs(vObjN);
    vec2 uv = (an.x > an.y && an.x > an.z ? vRoot.yz : (an.y > an.z ? vRoot.xz + 0.37 : vRoot.xy + 0.71)) * uDensity;
    vec4 cl = texture2D(uClumps, uv);
    uv += (cl.rg * 2.0 - 1.0) / uClumpCells * uClump * pow(h, 1.3);
    vec4 s = texture2D(uStrands, uv);
    float len = mix(0.5, 1.0, s.g);
    if (h > len) discard;
    float t = h / len;
    float radius = mix(0.82, 0.16, pow(t, 0.8));
    float aa = fwidth(s.r) + 0.004;
    float alpha = h < 0.001 ? 1.0 : 1.0 - smoothstep(radius - aa, radius + aa, s.r);
    if (alpha < 0.01) discard;
    vec3 N = normalize(vWorldN), V = normalize(cameraPosition - vWorldPos), L = normalize(uKeyDir);
    float wrap = clamp((dot(N, L) + 0.3) / 1.3, 0.0, 1.0);
    float ao = mix(0.14, 1.0, pow(h, 0.6)) * mix(0.5, 1.0, smoothstep(-0.9, 0.5, N.y));
    vec3 base = mix(uRoot, uTip, pow(t, 1.1)) * mix(0.84, 1.12, s.b) * mix(0.78, 1.14, cl.b);
    vec3 col = base * (0.2 + uKey * wrap * 1.05) * ao;
    col += base * uSky * clamp(N.y * 0.5 + 0.5, 0.0, 1.0) * 0.28 * ao;
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.4);
    col += uRim * fres * smoothstep(0.15, 1.0, t) * uRimStrength * (0.55 + 0.45 * clamp(-dot(N, L) + 0.6, 0.0, 1.0));
    vec3 H = normalize(L + V);
    col += uKey * pow(max(dot(N, H), 0.0), 10.0) * 0.14 * t;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const MAX_SHELLS = 128;
const BASE_OMEGA = (Math.PI * 2) / 19;   // round 1 limited the lag to its normal turning speed

export function addFirstFur(target, { light = null, quality = 1, overrides = {} } = {}) {
  const src = target.geometry;
  if (!src.boundingSphere) src.computeBoundingSphere();
  const R = src.boundingSphere.radius;
  let params = resolveFirstParams(overrides);
  let q = quality;

  const geo = new THREE.InstancedBufferGeometry();
  geo.index = src.index;
  geo.setAttribute('position', src.getAttribute('position'));
  geo.setAttribute('normal', src.getAttribute('normal'));
  const layers = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SHELLS), 1);
  geo.setAttribute('aLayer', layers);

  const keyDir = new THREE.Vector3(-0.55, 0.75, 0.55).normalize();
  const U = {
    uStrands: { value: strandTexture() }, uClumps: { value: clumpTexture() }, uClumpCells: { value: 10 },
    uClump: { value: 0 }, uDensity: { value: 0 }, uFurLen: { value: 0 }, uR: { value: R },
    uOmega: { value: new THREE.Vector3() }, uDrag: { value: 0 }, uGravity: { value: 0 },
    uRoot: { value: new THREE.Color() }, uTip: { value: new THREE.Color() }, uKeyDir: { value: keyDir },
    uKey: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uRim: { value: new THREE.Color() },
    uRimStrength: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader, fragmentShader, transparent: true, depthWrite: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'first-fur';
  mesh.frustumCulled = false;
  target.add(mesh);

  // the fur draws its own opaque skin (layer 0), so the object's own surface is hidden
  const ownMaterial = target.material;
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  target.material = hidden;

  function apply() {
    const n = Math.max(8, Math.min(MAX_SHELLS, Math.round(params.shells * q)));
    for (let i = 0; i < n; i++) layers.array[i] = i / (n - 1);
    layers.needsUpdate = true;
    geo.instanceCount = n;
    U.uFurLen.value = params.length * R;
    U.uDensity.value = params.density / 64;
    U.uClump.value = params.clump;
    U.uGravity.value = params.gravity;
    U.uDrag.value = params.drag;
    U.uRimStrength.value = params.rim;
    U.uRoot.value.set(params.rootColor);
    U.uTip.value.set(params.tipColor);
    U.uRim.value.set(params.rimColor);
    U.uKey.value.set(params.keyColor);
    U.uSky.value.set(params.skyColor);
  }
  apply();

  // lag: the object's angular velocity (from its world rotation), followed by a critically damped spring
  const qNow = new THREE.Quaternion(), qPrev = new THREE.Quaternion(), dq = new THREE.Quaternion();
  const omega = new THREE.Vector3(), swing = new THREE.Vector3(), swingV = new THREE.Vector3(), tmp = new THREE.Vector3();
  let first = true;
  function update(dt = 1 / 60) {
    if (light) U.uKeyDir.value.copy(light.position).sub(light.target ? light.target.position : tmp.set(0, 0, 0)).normalize();
    target.updateWorldMatrix(true, false);
    target.getWorldQuaternion(qNow);
    if (!first && dt > 0) {
      dq.copy(qNow).multiply(qPrev.invert());
      if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
      const angle = 2 * Math.acos(Math.min(1, dq.w));
      const s = Math.sqrt(Math.max(1 - dq.w * dq.w, 0));
      if (s > 1e-6) omega.set(dq.x / s, dq.y / s, dq.z / s).multiplyScalar(angle / dt);
      else omega.set(0, 0, 0);
    }
    first = false;
    qPrev.copy(qNow);
    const k = 38, c = 12.4;
    tmp.copy(swing).sub(omega).multiplyScalar(-k).addScaledVector(swingV, -c);
    swingV.addScaledVector(tmp, dt);
    swing.addScaledVector(swingV, dt);
    U.uOmega.value.copy(swing).clampLength(0, BASE_OMEGA * 1.25);
  }

  return {
    mesh,
    get params() { return params; },
    update,
    set(p) { params = { ...params, ...Object.fromEntries(Object.entries(p).filter(([k2]) => k2 in params)) }; apply(); },
    setPreset(_id, ov = {}) { params = resolveFirstParams(ov); apply(); },
    setQuality(v) { q = v; apply(); },
    dispose() {
      target.remove(mesh);
      target.material = ownMaterial;
      geo.dispose(); mat.dispose(); hidden.dispose();
      U.uStrands.value.dispose(); U.uClumps.value.dispose();
    },
  };
}

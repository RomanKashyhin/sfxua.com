// The boom microphone, round Q (22.10.2026): a real 3D model, so the windshield turns round its own long
// axis as ONE object: the fur, the front end, the outline, the highlights and the shading of the tufts all
// move together, and nothing of the picture stays behind. The fur is deadcat-fur-kit's own module
// (js/fur/fur.js): shells and silhouette fins in the object's space, with the round M settings the owner
// chose in the kit's gallery (no droop, short dense fur, soft tufts) in the warm cream of the round N
// windshield. The shock mount and her pole never turn. Loaded lazily by main.js; WebGL2.
// Round S (owner): back to this round Q fur (round R's tufted shape is gone), but whole: one closed surface
// (the lathe's seam and poles welded, no UV), tufts and strands chosen in the object's space with no cell
// planes, and the fins on the outline drawn from the same field (local fixes in js/fur/fur.js). The windshield
// lies along her pole as in round R, so the turn carries the fur across the screen, left and right, the way
// the hand drags it (round Q's yaw 35 / pitch -18 pointed the axis at the viewer and the fur ran up and down).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { addFurFromConfig } from './fur/fur.js';
import { BOOM_FRAME } from './boom-frame.js';

export const FUR_CONFIG = {
  kit: 'deadcat-fur-kit', version: 1, mode: '3d', preset: 'plush-tufts',
  overrides: {
    gravity: 0, length: 0.15, density: 27, clump: 0.4, clumpScale: 7, taper: 0.7, thickness: 0.5,
    rootColor: '#c98f58', tipColor: '#ffeccc', rimColor: '#ffffff', tipStart: 0.1, ao: 0.5, rim: 0.35, toonSteps: 0,
  },
};

const deg = THREE.MathUtils.degToRad;
// the model, in world units; the knuckle of the shock mount is the origin
export const MODEL = {
  radius: 1, halfLength: 2.3, shapeExp: 3.4,       // the windshield: a rounded capsule (round Q)
  toward: 0.3,                                     // its front end turns this much toward the viewer
  stem: 0.55,                                      // the mount's stem, from the pole's tip to the windshield
  ahead: 0.55,                                     // its middle sits this far up the pole past the tip (x half-length)
  fov: 22,
};

// rounded capsule (superellipse profile) turned on a lathe, lying along X
function windshieldGeometry(radial, rings) {
  const { radius, halfLength, shapeExp: p } = MODEL;
  const pts = [];
  for (let i = 0; i <= rings; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / rings;
    const s = Math.sin(a), c = Math.cos(a);
    pts.push(new THREE.Vector2(Math.max(Math.abs(c) ** (2 / p) * radius, 1e-4), Math.sign(s) * Math.abs(s) ** (2 / p) * halfLength));
  }
  const lathe = new THREE.LatheGeometry(pts, radial);
  lathe.rotateZ(-Math.PI / 2);   // +X is the front end
  // one closed surface for the shells and the fins: the lathe's seam and its two poles welded, no UV
  lathe.deleteAttribute('uv');
  lathe.deleteAttribute('normal');
  const geo = mergeVertices(lathe, 1e-4);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// world-space layout: P down her pole (toward her hands), A the long axis (back -> front, up the pole), U from
// the knuckle across to the windshield (perpendicular to A), C the windshield's middle
export function rig(poleDeg) {
  // her pole lies in the picture plane, so on the screen it keeps exactly her angle (y down)
  const P = new THREE.Vector3(Math.cos(deg(poleDeg)), -Math.sin(deg(poleDeg)), 0);
  const A = P.clone().negate().add(new THREE.Vector3(0, 0, MODEL.toward)).normalize();
  const away = new THREE.Vector3(P.y, -P.x, 0);           // across her pole, the side away from her face
  const U = away.addScaledVector(A, -away.dot(A)).normalize();
  const C = U.clone().multiplyScalar(MODEL.radius + MODEL.stem).addScaledVector(A, MODEL.ahead * MODEL.halfLength);
  return { A, U, C, P };
}

export async function createBoomMic(canvas, { pole = 65, figureWidth = 0, boxWidth = 0, quality, config = FUR_CONFIG } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!renderer.capabilities.isWebGL2) throw new Error('no WebGL2');
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.04;

  const scene = new THREE.Scene();
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  // the light of the team pictures: a warm key from the upper left and front, a cool rim from behind right
  const key = new THREE.DirectionalLight('#fff3e2', 2.2);
  key.position.set(-5.5, 7.5, 5.5);
  scene.add(key);
  const rimLight = new THREE.DirectionalLight('#dff7ff', 1.3);
  rimLight.position.set(5, 3, -6);
  scene.add(rimLight);
  scene.add(new THREE.HemisphereLight('#c9f3e6', '#fff6e8', 0.6));

  const { A, U, C, P } = rig(pole);
  // the windshield: its local +X is the long axis, so turning it round X turns it round its own axis
  const holder = new THREE.Group();
  holder.position.copy(C);
  holder.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), A);
  scene.add(holder);
  const geo = windshieldGeometry(96, 72);
  const windshield = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#7a5c42', roughness: 1 }));
  holder.add(windshield);
  const small = quality ?? (Math.min(window.innerWidth, window.innerHeight) < 700 ? 0.6 : 1);
  const fur = addFurFromConfig(windshield, config, { light: key, quality: small });

  // the shock mount and the clamp on her pole: they hold the windshield and never turn
  const mat = {
    body: new THREE.MeshPhysicalMaterial({ color: '#34302e', roughness: 0.42, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: '#5b5753', roughness: 0.3, metalness: 0.85 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#26231f', roughness: 0.85 }),
  };
  const along = (from, dir, len, r, m, seg = 32) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.position.copy(from).addScaledVector(dir.clone().normalize(), len / 2);
    scene.add(mesh);
    return mesh;
  };
  // her pole's radius in world units, from its width in the picture (1.84 % of the figure)
  const poleR = figureWidth && boxWidth ? (0.0184 * figureWidth) / 2 / (BOOM_FRAME.unit * boxWidth) : 0.07;
  const attach = U.clone().multiplyScalar(MODEL.stem + MODEL.radius * 0.2);   // straight across into the fur
  along(new THREE.Vector3(), attach, attach.length(), 0.13, mat.body);
  along(attach.clone().addScaledVector(U, -0.38), U, 0.12, 0.2, mat.rubber);   // the rubber ring under the fur
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), mat.body);
  scene.add(knuckle);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.56, 20), mat.metal);
  bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
  scene.add(bolt);
  along(new THREE.Vector3(), P, 0.62, Math.max(poleR * 1.55, 0.1), mat.body);       // the clamp on the pole's tip
  along(P.clone().multiplyScalar(0.62), P, 0.08, Math.max(poleR * 1.7, 0.11), mat.metal);

  const camera = new THREE.PerspectiveCamera(MODEL.fov, 1, 0.1, 200);
  let W = 1, H = 1;
  const resize = () => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    W = w; H = h;
    const ppu = BOOM_FRAME.unit * W;
    const f = H / (2 * Math.tan(deg(MODEL.fov) / 2));
    const dist = f / ppu;
    camera.aspect = W / H;
    camera.position.set(C.x, C.y, dist);
    camera.lookAt(C.x, C.y, 0);
    // put the knuckle (the origin) on the pivot of the box
    const kx = W / 2 + (0 - C.x) * ppu, ky = H / 2 + (C.y - 0) * ppu;
    camera.setViewOffset(W, H, kx - BOOM_FRAME.pivot[0] * W, ky - BOOM_FRAME.pivot[1] * H, W, H);
    camera.updateProjectionMatrix();
    // for the hand: the long axis on the screen (radians, y down) and the windshield's radius in pixels
    const p0 = C.clone().project(camera), p1 = C.clone().add(A).project(camera);
    api.axis = Math.atan2(-(p1.y - p0.y) * H, (p1.x - p0.x) * W);
    api.radius = (MODEL.radius + fur.params.length * geo.boundingSphere.radius) * ppu;
  };

  let last = performance.now();
  const render = (angle, dt) => {
    const now = performance.now();
    const step = dt ?? Math.min(0.05, (now - last) / 1000);
    last = now;
    windshield.rotation.x = angle;
    fur.update(Math.max(step, 1e-4));
    renderer.render(scene, camera);
  };
  const api = {
    resize, render, fur, camera, scene, windshield, axis: 0, radius: 40,
    project(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2, (1 - p.y) / 2]; },
    dispose() { fur.dispose(); renderer.dispose(); pmrem.dispose(); },
  };
  resize();
  return api;
}

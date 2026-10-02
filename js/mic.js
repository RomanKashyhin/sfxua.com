// SoundFX hero object: a boom microphone with a furry zeppelin, built as a real
// 3D model in three.js. The fur comes from deadcat-fur-kit (js/fur/fur.js), preset
// "plush-tufts": shells + silhouette fins that hang with gravity, lag behind the
// turntable and overshoot a little when it slows down.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MIC, micLayout } from './mic-layout.js';
import { addFurFromConfig } from './fur/fur.js';

// The look chosen in the kit's gallery (variant 1, colour "as in the variant", sliders untouched).
export const FUR_CONFIG = { kit: 'deadcat-fur-kit', version: 1, mode: '3d', preset: 'plush-tufts', overrides: {} };

const TAU = Math.PI * 2;
const deg = THREE.MathUtils.degToRad;

// Rounded capsule profile (superellipse) turned on a lathe, lying along X.
function zeppelinGeometry(radial, rings) {
  const { radius, halfLength, shapeExp: p } = MIC;
  const pts = [];
  for (let i = 0; i <= rings; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / rings;
    const s = Math.sin(a), c = Math.cos(a);
    const y = Math.sign(s) * Math.abs(s) ** (2 / p) * halfLength;
    const r = Math.abs(c) ** (2 / p) * radius;
    pts.push(new THREE.Vector2(Math.max(r, 1e-4), y));
  }
  const geo = new THREE.LatheGeometry(pts, radial);
  geo.rotateZ(Math.PI / 2);   // LatheGeometry's own normals are smooth across the seam: keep them
  return geo;
}

const shadowVertex = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const shadowFragment = /* glsl */ `
  uniform vec3 uHeadA; uniform vec3 uHeadB; uniform float uHeadR;
  uniform vec3 uPoleA; uniform vec3 uPoleB; uniform float uPoleR;
  uniform float uFloorY;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vW;
  float capsule(vec3 A, vec3 B, float r, float soft0, float softK, float fade) {
    vec2 p = vW.xz, a = A.xz, b = B.xz, ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float hgt = max(mix(A.y, B.y, t) - uFloorY, 0.0);
    float d = length(p - (a + ab * t)) - r;
    float soft = soft0 + hgt * softK;
    return (1.0 - smoothstep(-soft, soft * 1.8, d)) / (1.0 + hgt * fade);
  }
  void main() {
    float head = capsule(uHeadA, uHeadB, uHeadR, 0.4, 0.3, 0.18);
    float pole = capsule(uPoleA, uPoleB, uPoleR, 0.05, 0.3, 0.55);
    float a = 1.0 - (1.0 - head * 0.62) * (1.0 - pole * 0.85);
    gl_FragColor = vec4(uColor, a * uOpacity);
    #include <colorspace_fragment>
  }
`;

function tagTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = MIC.palette.jam;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 104px "Archivo", "Arial Black", sans-serif';
  g.fillText('SoundFX', 256, 132);
  g.beginPath();
  g.arc(58, 128, 16, 0, TAU);
  g.fillStyle = 'rgba(16, 28, 63, 0.35)';
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export async function createMic(canvas, opts = {}) {
  const lite = !!opts.lite;
  const compact = !!opts.compact;
  const P = MIC.palette;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, premultipliedAlpha: true,
    preserveDrawingBuffer: !!opts.still, powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  const maxDpr = opts.dpr || (lite ? 1.5 : 1.75);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const keyDir = new THREE.Vector3(-0.55, 0.75, 0.55).normalize();
  const key = new THREE.DirectionalLight(P.key, 2.1);
  key.position.copy(keyDir).multiplyScalar(10);
  scene.add(key);
  const rimLight = new THREE.DirectionalLight('#dff7ff', 1.4);
  rimLight.position.set(5, 3, -6);
  scene.add(rimLight);
  scene.add(new THREE.HemisphereLight(P.sky, '#ffffff', 0.55));

  const camera = new THREE.PerspectiveCamera(MIC.fov, 1, 0.1, 200);

  // ---------- assembly ----------
  const turntable = new THREE.Group();
  const bobber = new THREE.Group();
  const rig = new THREE.Group();
  rig.position.z = -MIC.pivot;
  turntable.add(bobber);
  bobber.add(rig);
  scene.add(turntable);

  const head = new THREE.Group();
  rig.add(head);

  const base = zeppelinGeometry(lite ? 64 : 96, lite ? 48 : 72);
  const zeppelin = new THREE.Mesh(base, new THREE.MeshStandardMaterial({ color: '#2f2b36', roughness: 1 }));
  head.add(zeppelin);
  const furQuality = opts.quality ?? (lite ? 0.6 : 1);
  const fur = addFurFromConfig(zeppelin, FUR_CONFIG, { light: key, quality: furQuality });

  const headProxy = new THREE.Mesh(base, new THREE.MeshBasicMaterial());
  headProxy.scale.setScalar(1.28);
  headProxy.visible = false;
  head.add(headProxy);

  const mat = {
    carbon: new THREE.MeshPhysicalMaterial({ color: P.carbon, roughness: 0.36, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.22 }),
    gun: new THREE.MeshStandardMaterial({ color: P.gunmetal, roughness: 0.26, metalness: 0.9 }),
    bright: new THREE.MeshStandardMaterial({ color: '#cfd4dc', roughness: 0.18, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: P.rubber, roughness: 0.88 }),
    cable: new THREE.MeshStandardMaterial({ color: P.cable, roughness: 0.5 }),
    jam: new THREE.MeshPhysicalMaterial({ color: P.jam, roughness: 0.32, clearcoat: 0.6 }),
  };
  const cyl = (r, len, m, seg = 32) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
    return mesh;
  };

  // shock-mount stem under the zeppelin
  const stem = cyl(0.13, 0.95, mat.carbon); stem.position.y = -1.02; rig.add(stem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 16, 48), mat.gun);
  ring.rotation.x = Math.PI / 2; ring.position.y = -1.22; rig.add(ring);
  const outlet = cyl(0.055, 0.2, mat.gun, 20); outlet.rotation.z = Math.PI / 2; outlet.position.set(0.19, -1.34, 0); rig.add(outlet);
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), mat.gun);
  knuckle.position.y = -1.62; rig.add(knuckle);
  for (const sx of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.26), mat.carbon);
    plate.position.set(sx * 0.2, -1.6, 0); rig.add(plate);
  }
  const bolt = cyl(0.045, 0.5, mat.bright, 20); bolt.rotation.z = Math.PI / 2; bolt.position.y = -1.62; rig.add(bolt);
  const knob = cyl(0.1, 0.07, mat.gun, 24); knob.rotation.z = Math.PI / 2; knob.position.set(0.27, -1.62, 0); rig.add(knob);

  // telescopic boom pole
  const pole = new THREE.Group();
  pole.position.y = -1.62;
  pole.rotation.x = -MIC.tilt;
  rig.add(pole);
  let s = 0.1;
  const segment = (r, len, m, extra) => {
    const c = cyl(r, len, m); c.position.y = -(s + len / 2); pole.add(c);
    if (extra) extra(c, s, len);
    s += len;
    return c;
  };
  segment(0.06, 0.14, mat.bright);
  segment(0.068, 1.3, mat.carbon);
  const collar = (r) => segment(r, 0.16, mat.gun, (c, top, len) => {
    for (let i = 0; i < 3; i++) {
      const k = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 40), mat.gun);
      k.rotation.x = Math.PI / 2; k.position.y = -(top + 0.035 + i * 0.045); pole.add(k);
    }
  });
  const collar1Top = s; collar(0.1);
  segment(0.082, 1.15, mat.carbon);
  collar(0.112);
  segment(0.095, 0.6, mat.carbon);
  segment(0.13, 0.75, mat.rubber, (c, top, len) => {
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.014, 8, 40), mat.rubber);
      rib.rotation.x = Math.PI / 2; rib.position.y = -(top + 0.08 + i * 0.115); pole.add(rib);
    }
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 16, 0, TAU, Math.PI / 2, Math.PI / 2), mat.rubber);
  cap.position.y = -s; pole.add(cap);
  const poleLength = s + 0.13;

  const poleProxy = cyl(0.3, poleLength, new THREE.MeshBasicMaterial(), 8);
  poleProxy.position.y = -poleLength / 2; poleProxy.visible = false; pole.add(poleProxy);

  // SoundFX tag: a band on the pole with a little flag
  const band = cyl(0.083, 0.16, mat.jam); band.position.y = -0.36; pole.add(band);
  const tagMat = new THREE.MeshPhysicalMaterial({ map: tagTexture(), roughness: 0.38, clearcoat: 0.5 });
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.025), [mat.jam, mat.jam, mat.jam, mat.jam, tagMat, tagMat]);
  tag.position.set(0.43, -0.36, 0);
  tag.rotation.y = deg(-12);
  pole.add(tag);

  // cable: out of the stem, a short droop, one and a half wraps, into collar 1
  pole.updateMatrixWorld(true); rig.updateMatrixWorld(true);
  const toRig = (v) => pole.localToWorld(v.clone()).applyMatrix4(new THREE.Matrix4().copy(rig.matrixWorld).invert());
  const pts = [
    new THREE.Vector3(0.29, -1.34, 0),
    new THREE.Vector3(0.42, -1.42, 0.05),
    new THREE.Vector3(0.36, -1.72, 0.2),
  ];
  const wrapR = 0.108;
  for (let i = 0; i <= 26; i++) {
    const f = i / 26;
    const a = f * TAU * 1.5 + 0.2;
    pts.push(toRig(new THREE.Vector3(Math.cos(a) * wrapR, -(0.55 + f * 0.85), Math.sin(a) * wrapR)));
  }
  pts.push(toRig(new THREE.Vector3(0.12, -(collar1Top - 0.12), 0.02)));
  pts.push(toRig(new THREE.Vector3(0.125, -(collar1Top + 0.02), 0)));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.032, 10), mat.cable);
  rig.add(cable);
  const plug = cyl(0.05, 0.16, mat.bright, 20);
  plug.position.set(0.125, -(collar1Top - 0.06), 0);
  pole.add(plug);

  // ---------- floor shadow ----------
  const poleEnd = new THREE.Vector3(0, -poleLength, 0);
  const poleEndRig = toRig(poleEnd);
  const floorY = poleEndRig.y - 0.45;
  const shadowUniforms = {
    uHeadA: { value: new THREE.Vector3() }, uHeadB: { value: new THREE.Vector3() }, uHeadR: { value: 1.05 },
    uPoleA: { value: new THREE.Vector3() }, uPoleB: { value: new THREE.Vector3() }, uPoleR: { value: 0.1 },
    uFloorY: { value: floorY },
    uColor: { value: new THREE.Color(P.shadow) },
    uOpacity: { value: 0.78 },
  };
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.ShaderMaterial({ uniforms: shadowUniforms, vertexShader: shadowVertex, fragmentShader: shadowFragment, transparent: true, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.renderOrder = -1;
  scene.add(floor);

  const headA = new THREE.Vector3(), headB = new THREE.Vector3(), poleA = new THREE.Vector3(), poleB = new THREE.Vector3();
  function updateShadow() {
    turntable.updateMatrixWorld(true);
    headA.set(-MIC.halfLength + 0.8, 0, 0); head.localToWorld(headA);
    headB.set(MIC.halfLength - 0.8, 0, 0); head.localToWorld(headB);
    poleA.set(0, -0.2, 0); pole.localToWorld(poleA);
    poleB.copy(poleEnd); pole.localToWorld(poleB);
    shadowUniforms.uHeadA.value.copy(headA); shadowUniforms.uHeadB.value.copy(headB);
    shadowUniforms.uPoleA.value.copy(poleA); shadowUniforms.uPoleB.value.copy(poleB);
  }

  // ---------- camera framing ----------
  let W = 1, H = 1;
  function resize(width, height) {
    W = Math.max(1, width); H = Math.max(1, height);
    renderer.setSize(W, H, false);
    const { ax, ay, ppu } = micLayout(W, H, compact);
    const dist = H / (2 * Math.tan(deg(MIC.fov) / 2) * ppu);
    camera.aspect = W / H;
    camera.position.set(0, Math.sin(MIC.elevation) * dist, Math.cos(MIC.elevation) * dist);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(W, H, W / 2 - ax, H / 2 - ay, W, H);
    camera.updateProjectionMatrix();
  }

  // ---------- motion ----------
  const baseOmega = TAU / MIC.period;
  const state = {
    angle: MIC.keyAngle, omega: baseOmega, target: 1, swing: baseOmega, swingV: 0,
    squash: 1, squashV: 0, time: 0, dragging: false, auto: !opts.still,
  };

  function step(dt) {
    state.time += dt;
    if (!state.dragging && state.auto) {
      const goal = baseOmega * state.target;
      const rate = Math.abs(state.omega) > Math.abs(goal) * 1.6 ? 1.1 : 2.4;
      state.omega += (goal - state.omega) * (1 - Math.exp(-dt * rate));
      state.angle += state.omega * dt;
    }
    // Fur lags behind the turntable on a critically damped spring: it settles when the speed
    // changes instead of whipping past it.
    const k = 38, c = 12.4;
    state.swingV += (-(state.swing - state.omega) * k - state.swingV * c) * dt;
    state.swing += state.swingV * dt;
    // squash & stretch after a poke
    state.squashV += (-(state.squash - 1) * 160 - state.squashV * 9) * dt;
    state.squash += state.squashV * dt;

    turntable.rotation.y = state.angle;
    bobber.position.y = state.auto ? Math.sin(state.time * TAU / 5.5) * 0.07 : 0;
    const sq = state.squash;
    head.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    // gravity, lag and overshoot come from the fur kit: it measures the rotation from the world matrix
    fur.update(dt);
  }

  function render() {
    updateShadow();
    renderer.render(scene, camera);
  }

  // ---------- pointer ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hit(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects([headProxy, poleProxy], false).length > 0;
  }

  return {
    renderer, state, resize, step, render, hit, floorY,
    setHover(on) { state.target = on ? 0.14 : 1; },
    // fewer shells for slower GPUs (n = shell count of the full-quality fur)
    setShells(n) { fur.setQuality(Math.max(0.3, n / fur.params.shells)); },
    fur,
    poke() { state.squashV -= 2.6; state.swingV += 4 * Math.sign(state.omega || 1); },
    dragBy(dx, dt) {
      const d = dx * 0.0085;
      state.angle += d;
      if (dt > 0) state.omega = THREE.MathUtils.lerp(state.omega, d / dt, 0.5);
    },
    dispose() { fur.dispose(); renderer.dispose(); pmrem.dispose(); },
  };
}

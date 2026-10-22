// The boom microphone of the recording person (round O, 22.10.2026): a real 3D windshield in three.js,
// so it can turn around its own long axis (from the front end to the back). The fur is stylised clumped
// shell fur (see shellFur below) over the whole body and both rounded ends, combed toward the back, with
// darker roots and lighter tips, so there is no smooth patch or bare side at any angle.
// The graphite shock mount and its arm stay put; only the windshield turns.
//   at rest: a gentle turn of about ±6° one way and back around the current angle (not with reduced motion)
//   drag:    a full turn either way, no stop; the angle stays where it is let go, the rest sway resumes
//            after a short pause around the new angle
//   click:   a soft little bounce of the fur (a click is told from a drag by the distance moved)
// The page keeps a still picture of the same render for no WebGL and for the first paint.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;
const deg = THREE.MathUtils.degToRad;
export const SHAPE = { halfLength: 2.05, radius: 1.0, exp: 3.2 };   // world units; the windshield is ~4.1 long

// the body profile: a rounded capsule (superellipse), front end at +X
function profile(n) {
  const { halfLength: L, radius: R, exp: p } = SHAPE, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    const s = Math.sin(a), c = Math.cos(a);
    pts.push([Math.sign(s) * Math.abs(s) ** (2 / p) * L, Math.abs(c) ** (2 / p) * R]);   // [x, r]
  }
  return pts;
}

// Stylised clumped fur: shells over the body. Every shell is the body pushed out along its normal (and combed
// toward the back); a fragment stays only inside its clump, and clumps narrow toward their tips. Clumps are
// cells of a 3D Voronoi noise on the body's own surface point, so there is no seam and no bare side at any
// angle, and the pattern turns with the windshield. Light is computed here: a soft wrapped key light, sky
// and ground fill, a warm rim on the tips, darker roots.
const FUR_VERT = /* glsl */ `
  uniform float uH, uLen, uComb;
  varying vec3 vP0, vN, vView;
  varying float vH;
  void main() {
    vec3 p0 = position, n = normalize(normal);
    vec3 back = vec3(-1.0, 0.0, 0.0);
    vec3 comb = back - n * dot(n, back);
    float cl = length(comb);
    comb = cl > 1e-3 ? comb / cl : vec3(0.0);
    vec3 p = p0 + n * (uH * uLen) + comb * (uH * uH * uLen * uComb);
    vP0 = p0; vH = uH;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normalize(n + comb * uH * 0.6));
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const FUR_FRAG = /* glsl */ `
  uniform float uH, uDensity;
  uniform vec3 uRoot, uTip, uRim, uSky, uGround, uKeyDir, uKeyCol;
  varying vec3 vP0, vN, vView;
  varying float vH;
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }
  // distance to the nearest feature point, and a random number of that cell
  vec2 cells(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    float best = 8.0, id = 0.0;
    for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) for (int c = -1; c <= 1; c++) {
      vec3 g = vec3(float(a), float(b), float(c));
      vec3 o = hash3(i + g);
      vec3 r = g + o - f;
      float d = dot(r, r);
      if (d < best) { best = d; id = fract(o.x * 7.31 + o.y * 3.17 + o.z * 1.13); }
    }
    return vec2(sqrt(best), id);
  }
  void main() {
    vec2 c = cells(vP0 * uDensity);
    float hmax = 0.62 + 0.38 * c.y;                    // clumps of different lengths
    float h = vH / hmax;
    if (h > 1.0) discard;
    float r = 0.8 * sqrt(max(0.0, 1.0 - pow(h, 1.5)));    // wide at the root, a soft rounded tip
    if (vH > 0.0 && c.x > r) discard;
    vec3 n = normalize(vN), v = normalize(vView);
    float wrap = pow(clamp(dot(n, normalize(uKeyDir)) * 0.6 + 0.4, 0.0, 1.0), 1.4);
    // fibres: a value noise stretched along the body's axis reads as strands inside each clump
    vec3 q = vP0 * vec3(9.0, 52.0, 52.0);
    float fib = fract(sin(dot(floor(q), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    // soft natural patches over the whole windshield (darker and lighter areas), so a turn reads at a glance
    vec2 big = cells(vP0 * 1.1 + vec3(3.1, 0.7, 1.9));
    float tone = mix(0.8, 1.16, smoothstep(0.2, 0.8, big.y));
    vec3 base = mix(uRoot, uTip, pow(clamp(vH, 0.0, 1.0), 1.25)) * (0.86 + 0.24 * c.y) * (0.9 + 0.2 * fib) * tone;
    vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
    float ao = 0.42 + 0.58 * pow(clamp(vH, 0.0, 1.0), 0.8);
    vec3 col = base * (amb * 0.55 + uKeyCol * wrap) * ao;
    col += uRim * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5) * vH * 0.55;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function shellFur(geo, { shells = 28, length = 0.55, comb = 0.9, density = 3.2 } = {}) {
  const group = new THREE.Group();
  const shared = {
    uLen: { value: length }, uComb: { value: comb }, uDensity: { value: density },
    uRoot: { value: new THREE.Color('#2f2d34') }, uTip: { value: new THREE.Color('#9d99a2') },
    uRim: { value: new THREE.Color('#fff1e8') }, uSky: { value: new THREE.Color('#e6f2f6') }, uGround: { value: new THREE.Color('#9a8a78') },
    uKeyDir: { value: new THREE.Vector3(-0.55, 0.7, 0.6) }, uKeyCol: { value: new THREE.Color('#fff0dc').multiplyScalar(0.95) },
  };
  for (let i = 0; i <= shells; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uH: { value: i / shells } },
      vertexShader: FUR_VERT, fragmentShader: FUR_FRAG,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = i;
    group.add(m);
  }
  group.userData.uniforms = shared;
  return group;
}

export async function createBoomMic(canvas, opts = {}) {
  const lite = !!opts.lite;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.still });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dpr || (lite ? 1.5 : 2)));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const key = new THREE.DirectionalLight('#fff0dc', 2.6); key.position.set(-5, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffd9cf', 2.2); rim.position.set(6, 4, -5); scene.add(rim);   // warm rim, as in the reference
  scene.add(new THREE.HemisphereLight('#eef8ff', '#8f7d66', 0.7));
  const camera = new THREE.PerspectiveCamera(18, 1, 0.1, 400);

  // pose: axis = the windshield's angle on screen (degrees, clockwise from pointing right), yaw = how far
  // its front end turns toward the viewer, centre = its middle in world units from the knuckle (origin)
  const cfg = { axis: 0, yaw: 26, centre: [0, 2.6], ...opts.pose };
  const rig = new THREE.Group();                // placed and aimed once; the shield turns inside it
  rig.position.set(cfg.centre[0], cfg.centre[1], 0);
  rig.rotation.order = 'ZYX';
  rig.rotation.set(0, deg(-cfg.yaw), deg(-cfg.axis));    // yaw > 0 turns the front end toward the viewer
  scene.add(rig);
  const shield = new THREE.Group();
  rig.add(shield);

  // the body (its first shell is the solid felt core) under the clumped fur
  const lathe = new THREE.LatheGeometry(profile(lite ? 56 : 80).map(([x, r]) => new THREE.Vector2(Math.max(r, 1e-3), x)), lite ? 48 : 72);
  lathe.rotateZ(-Math.PI / 2);
  const fur = shellFur(lathe, { shells: lite ? 28 : 44, length: 0.46, comb: 1.5, density: 7.5 });
  shield.add(fur);
  // a small coral fabric tag sewn into the fur near the back, as on real windjammers: it turns with the
  // windshield, so the eye reads the roll at once
  const tagMat = new THREE.MeshStandardMaterial({ color: '#ff6b5b', roughness: 0.7 });
  const tag = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 6, 14), tagMat);
  tag.rotation.z = Math.PI / 2;
  tag.scale.set(1, 1, 0.42);
  tag.position.set(-SHAPE.halfLength * 0.12, SHAPE.radius + 0.3, 0);
  shield.add(tag);
  const proxy = new THREE.Mesh(lathe, new THREE.MeshBasicMaterial());
  proxy.scale.setScalar(1.45); proxy.visible = false; shield.add(proxy);

  // the mount: a graphite ring around the back third and an arm down to the pole's knuckle (fixed)
  const metal = new THREE.MeshStandardMaterial({ color: '#2b3034', roughness: 0.38, metalness: 0.55 });
  const ringX = -SHAPE.halfLength * 0.42;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(SHAPE.radius + 0.52, 0.1, 14, 64), metal);   // on top of the fur, a clamp
  ring.rotation.y = Math.PI / 2; ring.position.x = ringX;
  rig.add(ring);
  rig.updateMatrixWorld(true);
  const ringBottom = new THREE.Vector3(ringX, -(SHAPE.radius + 0.52), 0).applyMatrix4(rig.matrixWorld);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1, 16), metal);
  arm.position.copy(ringBottom).multiplyScalar(0.5);
  arm.scale.y = ringBottom.length();
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ringBottom.clone().normalize());
  scene.add(arm);
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), metal);
  scene.add(knuckle);

  // ---- framing: the knuckle lands on (ax, ay) of the canvas, ppu pixels per world unit ----
  let W = 1, H = 1;
  function resize(width, height, frame) {
    W = Math.max(1, width); H = Math.max(1, height);
    renderer.setSize(W, H, false);
    const { ax, ay, ppu } = frame(W, H);
    const dist = H / (2 * Math.tan(deg(camera.fov) / 2) * ppu);
    camera.aspect = W / H;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(W, H, W / 2 - ax, H / 2 - ay, W, H);
    camera.updateProjectionMatrix();
  }

  // ---- motion ----
  const st = { angle: 0, base: 0, t: 0, held: false, sinceLetGo: 9, sway: 0, bounce: 0, bounceV: 0, still: !!opts.reduce };
  function step(dt) {
    st.t += dt;
    if (!st.held) {
      st.sinceLetGo += dt;
      const want = st.still ? 0 : Math.min(1, Math.max(0, (st.sinceLetGo - 0.9) / 1.2));   // pause, then ease back in
      st.sway += (want - st.sway) * Math.min(1, dt * 3);
      st.angle = st.base + deg(6) * st.sway * Math.sin(st.t * TAU / 4.6);
    }
    st.bounceV += (-st.bounce * 180 - st.bounceV * 10) * dt;
    st.bounce += st.bounceV * dt;
    shield.rotation.x = st.angle;
    const k = 1 + st.bounce;
    shield.scale.set(1 / Math.sqrt(k), k, k);
  }
  const render = () => renderer.render(scene, camera);

  // ---- picking and turning ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(proxy, false).length > 0;
  }
  // the screen direction across the windshield: dragging along it rolls the surface under the pointer
  function across() {
    const a = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.quaternion);
    const p = new THREE.Vector2(a.y, a.x);            // across the axis on screen (y grows downward)
    return p.lengthSq() > 1e-4 ? p.normalize() : new THREE.Vector2(0, 1);
  }

  return {
    renderer, step, render, resize, hit, across, state: st,
    hold() { st.held = true; st.sway = 0; st.base = st.angle; },
    turnBy(rad) { st.angle += rad; st.base = st.angle; },
    letGo() { st.held = false; st.sinceLetGo = 0; st.base = st.angle; },
    nudge(rad) { st.base += rad; st.angle += rad; st.sinceLetGo = 0; st.sway = 0; },   // the keyboard: a step from where it rests
    poke() { st.bounceV += 1.4; },
    setReduce(v) { st.still = v; },
    dispose() { renderer.dispose(); pmrem.dispose(); },
  };
}

// The boom microphone (23.10.2026): the windshield of the round N sheet, across the tip of her pole, turning round
// its own long axis as ONE object, without three.js. Volume fur (the owner: "the fur looks flat, like a texture"):
// the windshield is a capsule (a core of the size and proportions of the round N windshield, js/mic-roll-data.js
// `outer`) and every pixel's ray is marched through its coat of fur, the way fur is rendered as a volume
// (Kajiya & Kay 1989): tufts grow out of the core, each leaning its own way and narrowing to a rounded tip (the
// round N petals), they hide one another, the roots sit in their shade and every tuft is lit on its own side.
// The tufts are laid on the core in cells that close round the turn, so the coat has no seam and no repeat; the
// outline and both ends are the coat itself and turn with it. The light (a key from the upper left, as on the
// team) stays put. Colours: the round N windshield's own. The shock mount and the clamp (`mount`, rendered once
// from the round S model) never turn. One canvas the size of the box (js/boom-frame.js): the mount, then the fur.
// (The flat version, a picture of the fur rolled round the body, is kept in _dev/design/retired-r/.)
import { MIC_ROLL } from './mic-roll-data.js';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMount;
uniform float uRoll;                 // radians
uniform vec2 uMid, uDir;             // the windshield's middle on the box (fractions), its axis on the screen (cos, sin)
uniform float uBoxAspect;
uniform float uA, uR, uF;            // the core: half the length of its straight part, its radius; the coat's depth
uniform float uCell, uNC;            // a tuft's cell along the axis (box widths), cells round the turn
uniform float uLean, uAA, uSteps;
uniform vec3 uLight;                 // the key light in the windshield's own frame
const float PI = 3.14159265;
const int STEPS = 30;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }

// the tufts round a point of the coat: uv on the core in cells, h the height in the coat (0 root .. 1); wrap: the
// cells round the turn (0: a flat patch, the ends); returns the coverage and the nearest tuft's own height (0..1 of
// its length); side: where on the tuft (its radii), tint
vec2 tufts(vec2 uv, float h, float wrap, vec2 seed, out vec2 side, out float tint) {
  vec2 c0 = floor(uv);
  float best = 0., bh = 0.; side = vec2(0.); tint = 1.;
  for (int i = -1; i <= 1; i++)
  for (int j = -1; j <= 1; j++) {
    vec2 cell = c0 + vec2(float(i), float(j));
    vec2 id = (wrap > 0. ? vec2(cell.x, mod(cell.y, wrap)) : cell) + seed;   // the side's cells close round the turn
    vec2 r = hash2(id), q = hash2(id + 7.3);
    float len = .5 + .5 * q.x;                            // its length, of the coat's depth
    if (h > len) continue;
    float t = h / len;
    float a = r.x * 6.2831853;
    vec2 lean = vec2(cos(a), sin(a)) * uLean * (.6 + .4 * q.y);
    vec2 axis = cell + .25 + .5 * hash2(id + 3.1) + lean * t;      // a tuft lies over as it rises
    vec2 d = uv - axis;
    // a petal: wide across its lean, thin along it, narrowing to a rounded tip
    vec2 ld = normalize(lean + 1e-4);
    vec2 e = vec2(dot(d, ld) * 1.25, dot(d, vec2(-ld.y, ld.x)) * .7);
    float rad = (.56 + .2 * r.y) * pow(max(0., 1. - t), .7);
    // the fibres of a petal run along it: fine, uneven stripes; only its tip frays
    float fib = (sin(e.y * 61. + r.y * 40.) + .6 * sin(e.y * 23. + q.y * 30.)) * .3 + .5;
    float cov = smoothstep(rad, rad - .2, length(e) + .07 * fib * smoothstep(.55, 1., t));
    cov *= .94 + .06 * fib;
    if (cov > best) { best = cov; bh = t; side = d / max(rad, 1e-3); tint = (.93 + .12 * hash(id + 5.7)) * (.96 + .04 * fib); }
  }
  return vec2(best, bh);
}

void main() {
  vec4 mount = texture2D(uMount, vUv);
  // box -> the windshield's frame: x along its axis (front end +), y across (down +), z towards the viewer; box widths
  vec2 q = vec2(vUv.x - uMid.x, (vUv.y - uMid.y) / uBoxAspect);
  float x = dot(q, uDir), y = dot(q, vec2(-uDir.y, uDir.x));
  float dx = x - clamp(x, -uA, uA);
  float r2 = dx * dx + y * y, Ro = uR + uF;
  if (r2 > Ro * Ro) { gl_FragColor = mount; return; }
  float zo = sqrt(Ro * Ro - r2);
  bool core = r2 < uR * uR;
  float ze = core ? sqrt(uR * uR - r2) : -zo;
  float dz = (zo - ze) / uSteps;
  float z = zo - dz * hash(gl_FragCoord.xy);             // dithered start: no rings
  vec3 col = vec3(0.); float al = 0.;
  vec3 root = vec3(.78, .67, .58), mid = vec3(.98, .86, .74), tip = vec3(1., .96, .89);
  for (int k = 0; k < STEPS; k++) {
    if (float(k) >= uSteps) break;
    vec3 v = vec3(dx, y, z);
    float d = length(v);
    float h = (d - uR) / uF;
    if (h >= 0. && h < 1.) {
      vec3 n = v / d;
      // where this point of the coat grows from on the core: along the axis, and round it (turning with the roll);
      // on the rounded ends the tufts stand on the end's own flat patch (no crowding at the pole), the two blend
      float u = clamp(x, -uA, uA) + n.x * uR;
      float th = atan(n.y, n.z) - uRoll;
      float ring = length(n.yz), wEnd = smoothstep(.35, .8, abs(n.x));
      vec2 side, s2; float tint, t2;
      vec2 t = tufts(vec2(u / uCell, th / (2. * PI) * uNC), h, uNC, vec2(0.), side, tint);
      t.x *= 1. - smoothstep(.6, .95, abs(n.x));
      if (wEnd > 0.) {
        vec2 e = tufts(ring * uR / uCell * vec2(sin(th), cos(th)), h, 0., vec2(n.x > 0. ? 71. : -53., 17.), s2, t2);
        e.x *= wEnd;
        if (e.x > t.x) { t = e; side = s2; tint = t2; }
      }
      if (t.x > 0.) {
        // the tuft's own roundness gives it a lit side and a shaded side; the roots sit in the coat's shade
        vec3 tu = normalize(vec3(1., 0., 0.) - n * n.x + 1e-4);
        vec3 tv = ring > 1e-3 ? vec3(0., n.z, -n.y) / ring : vec3(0., 1., 0.);
        vec3 nn = normalize(n * (.75 + .5 * t.y) + (tu * side.x + tv * side.y) * .5);
        float lit = .84 + .34 * max(dot(nn, uLight), 0.);
        float ao = mix(.7, 1., smoothstep(0., .8, h));
        vec3 c = (t.y < .5 ? mix(root, mid, t.y * 2.) : mix(mid, tip, t.y * 2. - 1.)) * tint * lit * ao;
        float a = t.x * .9;
        col += (1. - al) * a * c; al += (1. - al) * a;
        if (al > .985) break;
      }
    }
    z -= dz;
  }
  if (core && al < .985) {                               // under the coat: the core, deep in shade
    vec3 n = normalize(vec3(dx, y, ze));
    col += (1. - al) * root * (.55 + .3 * max(dot(n, uLight), 0.));
    al = 1.;
  }
  float edge = smoothstep(0., uAA * 1.5, Ro - sqrt(r2));   // a soft edge for the outermost tips
  al *= edge; col *= edge;
  gl_FragColor = vec4(col, al) + mount * (1. - al);
}`;

function texture(gl, unit, src) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const load = (url) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = url; });

// the coat: its depth (of the windshield's outer radius), a tuft's cell (of the core's radius), how far tufts lean
const COAT = { fur: 0.32, cell: 0.44, lean: 1.0 };

export async function createBoomRoll(canvas, { base = 'assets/team/', aspect, tilt, coat = {} } = {}) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('no WebGL');
  const D = MIC_ROLL, C = { ...COAT, ...coat };
  const mount = await load(base + D.mount);
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  texture(gl, 0, mount);
  const U = (n) => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('uMount'), 0);
  // the windshield's own angle on the screen (front end up to the right), apart from her pole's
  const deg = tilt === undefined ? D.place.axis : -tilt;
  const a = (deg * Math.PI) / 180;
  const box = aspect || D.place.aspect;
  // the capsule: the round N windshield's outer length and radius (box widths), its coat C.fur of the radius deep
  const [len, rad] = D.place.outer;
  const F = rad * C.fur, R = rad - F, A = Math.max(0, len / 2 - rad);
  const cell = R * C.cell;
  gl.uniform2f(U('uMid'), D.place.mid[0], D.place.mid[1]);
  gl.uniform2f(U('uDir'), Math.cos(a), Math.sin(a));
  gl.uniform1f(U('uBoxAspect'), box);
  gl.uniform1f(U('uA'), A); gl.uniform1f(U('uR'), R); gl.uniform1f(U('uF'), F);
  gl.uniform1f(U('uCell'), cell);
  gl.uniform1f(U('uNC'), Math.max(6, Math.round((2 * Math.PI * R) / cell)));
  gl.uniform1f(U('uLean'), C.lean);
  // the key light from the upper left and in front (screen: x right, y down, z to the viewer), in the windshield's frame
  const L = [-0.5, -0.72, 0.48], ln = Math.hypot(...L);
  const lx = L[0] / ln, ly = L[1] / ln;
  gl.uniform3f(U('uLight'), lx * Math.cos(a) + ly * Math.sin(a), -lx * Math.sin(a) + ly * Math.cos(a), L[2] / ln);
  const uRoll = U('uRoll'), uAA = U('uAA');
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  gl.uniform1f(U('uSteps'), coarse ? 20 : 30);
  gl.clearColor(0, 0, 0, 0);
  // a point of the windshield's outline box ([0..1 along it, 0..1 across]) on the box (fractions), for checks
  const project = ([sx, sy]) => {
    const x = (sx - 0.5) * len, y = (sy - 0.5) * 2 * rad;
    return [D.place.mid[0] + x * Math.cos(a) - y * Math.sin(a), D.place.mid[1] + (x * Math.sin(a) + y * Math.cos(a)) * box];
  };
  const api = {
    axis: a,                                    // the long axis on the screen (radians, y down), for the hand
    radius: 40,                                 // the windshield's radius in CSS pixels, for the hand
    project,
    places: { top: [0.5, 0], bottom: [0.5, 1], front: [1, 0.5], back: [0, 0.5] },
    resize() {
      // a touch screen (a phone, a tablet: a slower GPU) gets a lighter canvas and fewer steps through the coat
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(uAA, 1 / w);                   // one device pixel, in box widths
      api.radius = rad * canvas.clientWidth;
    },
    render(angle) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uRoll, angle);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
  api.resize();
  return api;
}

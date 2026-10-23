// The boom microphone (23.10.2026): the windshield of the round N sheet turning round its own long axis as ONE
// object, without three.js (the round P way). Its fur is unwrapped round the body column by column and filled
// all the way round from the picture's own fur (_dev/tools/mic_wrap.py: pieces joined by minimum-error cuts,
// no period, nothing repeated in a row), so at every moment each point shows exactly one piece of the same fur.
// Task 2: everything that is seen turns with it, the outline and the two ends too. The body is the solid core
// of the fur; the fur standing out of it has its own length at every point of the turn (the unwrapped fur's
// alpha), so the bumps of the outline and the tufts on the ends move with the fur. Only the light (the
// picture's own soft shading, a multiplier on the colour) stays put, as light does. The windshield lies across
// the tip of her pole (js/boom-frame.js tilt); the shock mount and the clamp (js/mic-roll-data.js `mount`,
// rendered once from the round S model) never turn. One canvas the size of the box: the mount, then the fur.
import { MIC_ROLL } from './mic-roll-data.js';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uWrap, uShade, uProfile, uMount;
uniform float uRoll;                 // radians
uniform vec2 uMid, uDir;             // the windshield's middle on the box (fractions), its axis on the screen (cos, sin)
uniform float uLen, uBoxAspect, uStillAspect, uRows, uLmax, uAA;
const float PI = 3.14159265;
const float RIM = 1.2532;           // asin(.95): the colour of the very edge of the body, not its squeezed last rows
// the core of the body at s (0..1 along it): its centre line and radius, as fractions of the picture's height
vec2 core(float s) {
  vec4 p = texture2D(uProfile, vec2(clamp(s, 0., 1.), .5));
  return vec2(p.r * 65280. + p.g * 255., p.b * 65280. + p.a * 255.) / 65535.;
}
// the fur at s and at the angle th of the body: its colour (divided by the light) and how far it stands out
vec4 fur(float s, float th) {
  float k = fract((th + PI) / (2. * PI));
  return texture2D(uWrap, vec2(clamp(s, 0., 1.), (k * (uRows - 1.) + .5) / uRows));
}
void main() {
  vec4 mount = texture2D(uMount, vUv);
  // box -> along the windshield (s, 0..1 of its length, front end at 1) and across it (t, 0..1 of its height)
  vec2 q = vec2(vUv.x - uMid.x, (vUv.y - uMid.y) / uBoxAspect);
  vec2 st = vec2(.5 + dot(q, uDir) / uLen, .5 + dot(q, vec2(-uDir.y, uDir.x)) / (uLen * uStillAspect));
  float wh = 1. / uStillAspect;                        // its length in heights
  if (st.x < -.12 || st.x > 1.12 || st.y < -.12 || st.y > 1.12) { gl_FragColor = mount; return; }
  vec2 cr = core(st.x);
  float y = st.y - cr.x;                               // across the axis, + downwards
  vec3 col; float a;
  if (abs(y) < cr.y && st.x > 0. && st.x < 1.) {
    col = fur(st.x, asin(clamp(y / cr.y, -.95, .95)) - uRoll).rgb;   // the body: the angle on it that is here now
    a = 1.;
  } else {
    if (abs(y) - cr.y > uLmax * 1.05 && st.x > 0. && st.x < 1.) { gl_FragColor = mount; return; }
    // out of the core: the fur of the nearest point of the core's outline (the tips of the body included)
    // stands out by its own length; the outline is the core's, pushed out by the fur as it is there now
    float sgn = y > 0. ? 1. : -1.;
    float dn = 1e9, sn = st.x;
    for (int i = -6; i <= 6; i++) {
      float sk = st.x + float(i) * uLmax / wh / 6.;
      if (sk < 0. || sk > 1.) continue;
      vec2 ck = core(sk);
      if (ck.y < .002) continue;                       // past the tips there is no core
      float dx = (st.x - sk) * wh, dy = max(abs(st.y - ck.x) - ck.y, 0.);
      float d = sqrt(dx * dx + dy * dy);
      if (d < dn) { dn = d; sn = sk; }
    }
    float s0 = sn;                                       // and finer round the nearest one (the rounded ends)
    for (int i = -6; i <= 6; i++) {
      float sk = s0 + float(i) * uLmax / wh / 36.;
      if (sk < 0. || sk > 1.) continue;
      vec2 ck = core(sk);
      if (ck.y < .002) continue;                       // past the tips there is no core
      float dx = (st.x - sk) * wh, dy = max(abs(st.y - ck.x) - ck.y, 0.);
      float d = sqrt(dx * dx + dy * dy);
      if (d < dn) { dn = d; sn = sk; }
    }
    vec4 f = fur(sn, sgn * PI * .5 - uRoll);
    float L = max(f.a * uLmax, 1e-4), tip = clamp(dn / L, 0., 1.);
    a = smoothstep(-uAA, uAA, L - dn) * (1. - .4 * smoothstep(.5, 1., tip));   // soft, see-through tips
    if (a <= 0.) { gl_FragColor = mount; return; }
    // along a tuft its colour runs on over the top of the body (the fur just behind the edge), so the tufts
    // carry the fur's own pattern instead of one colour drawn out; a little lighter towards the tip
    col = fur(sn, sgn * mix(RIM, PI * .5 + .4, tip) - uRoll).rgb * mix(1., 1.08, tip);
  }
  vec3 light = texture2D(uShade, clamp(st, 0., 1.)).rgb * 2.;
  gl_FragColor = vec4(col * light * 2. * a, a) + mount * (1. - a);
}`;

function texture(gl, unit, src, { premultiply = false, data = null, w = 0 } = {}) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, premultiply ? gl.BROWSER_DEFAULT_WEBGL : gl.NONE);
  if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const load = (url) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = url; });

export async function createBoomRoll(canvas, { base = 'assets/team/', aspect, tilt } = {}) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('no WebGL');
  const D = MIC_ROLL;
  const [wrap, shade, mount] = await Promise.all([D.wrap, D.shade, D.mount].map((f) => load(base + f)));
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
  texture(gl, 0, wrap);
  texture(gl, 1, shade);
  // the profile, 16 bits a value: centre line (r, g), radius of the core (b, a)
  const prof = new Uint8Array(D.profile.length * 4);
  D.profile.forEach(([c, r], i) => {
    const C = Math.round(c * 65535), R = Math.round(r * 65535);
    prof.set([C >> 8, C & 255, R >> 8, R & 255], i * 4);
  });
  texture(gl, 2, null, { data: prof, w: D.profile.length });
  texture(gl, 3, mount, { premultiply: true });
  const U = (n) => gl.getUniformLocation(prog, n);
  ['uWrap', 'uShade', 'uProfile', 'uMount'].forEach((n, i) => gl.uniform1i(U(n), i));
  // the windshield's own angle on the screen (front end up to the right), apart from her pole's
  const deg = tilt === undefined ? D.place.axis : -tilt;
  const a = (deg * Math.PI) / 180;
  gl.uniform2f(U('uMid'), D.place.mid[0], D.place.mid[1]);
  gl.uniform2f(U('uDir'), Math.cos(a), Math.sin(a));
  gl.uniform1f(U('uLen'), D.place.length);
  gl.uniform1f(U('uBoxAspect'), aspect || D.place.aspect);
  gl.uniform1f(U('uStillAspect'), D.h / D.w);
  gl.uniform1f(U('uRows'), wrap.height);
  gl.uniform1f(U('uLmax'), D.lmax);
  const uRoll = U('uRoll'), uAA = U('uAA');
  gl.clearColor(0, 0, 0, 0);
  const api = {
    axis: a,                                    // the long axis on the screen (radians, y down), for the hand
    radius: 40,                                 // the windshield's radius in CSS pixels, for the hand
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(uAA, 1 / (w * D.place.length * (D.h / D.w)));   // one device pixel, in heights of the picture
      api.radius = D.place.radius * canvas.clientWidth;
    },
    render(angle) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uRoll, angle);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    // where a point of the straightened windshield ([0..1, 0..1]) is on the box (fractions), for checks
    project([sx, sy]) {
      const x = (sx - 0.5) * D.place.length, y = (sy - 0.5) * D.place.length * (D.h / D.w);
      const bx = D.place.mid[0] + x * Math.cos(a) - y * Math.sin(a);
      const by = D.place.mid[1] + (x * Math.sin(a) + y * Math.cos(a)) * (aspect || D.place.aspect);
      return [bx, by];
    },
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
  api.resize();
  return api;
}

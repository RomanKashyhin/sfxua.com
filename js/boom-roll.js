// The boom microphone (23.10.2026): the windshield of the round N sheet turning round its own long axis as ONE
// object, without three.js (the round P way). Its fur is unwrapped round the body column by column and filled
// all the way round from the picture's own fur (_dev/tools/mic_wrap.py: pieces joined by minimum-error cuts,
// no period, nothing repeated in a row), so at every moment each point shows exactly one piece of the same fur.
// The rounded ends are just columns with a smaller radius, so they turn with the side. The light (the picture's
// own soft shading) and the soft fringe of the outline stay put. The shock mount and the clamp on her pole are
// the same as before (rendered once from the round S model, js/mic-roll-data.js `mount`) and never turn.
// One canvas the size of the box (js/boom-frame.js): the mount first, the windshield over it along her pole.
import { MIC_ROLL } from './mic-roll-data.js';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uStill, uWrap, uShade, uProfile, uMount;
uniform float uRoll;                 // radians
uniform vec2 uMid, uDir;             // the windshield's middle on the box (fractions), its axis on the screen (cos, sin)
uniform float uLen, uBoxAspect, uStillAspect, uRows;
const float PI = 3.14159265;
void main() {
  vec4 mount = texture2D(uMount, vUv);
  // box -> the straightened windshield: lengths in box widths, its axis along x, front end at the right
  vec2 q = vec2(vUv.x - uMid.x, (vUv.y - uMid.y) / uBoxAspect);
  vec2 s = vec2(.5 + dot(q, uDir) / uLen, .5 + dot(q, vec2(-uDir.y, uDir.x)) / (uLen * uStillAspect));
  vec4 here = vec4(0.);
  if (s.x > 0. && s.x < 1. && s.y > 0. && s.y < 1.) here = texture2D(uStill, s);   // premultiplied
  if (here.a < .004) { gl_FragColor = mount; return; }
  vec4 prof = texture2D(uProfile, vec2(s.x, .5));
  float c = prof.r, r = prof.g;
  float v = r > .004 ? (s.y - c) / r : 9.;
  vec3 col = here.rgb / here.a;
  if (abs(v) < .97) {                                  // the round body rolls; the fringe stays as it is
    float th = asin(clamp(v, -1., 1.)) - uRoll;        // the angle on the body that is here now
    float k = fract((th + PI) / (2. * PI));            // one full turn of fur, no period
    vec3 det = texture2D(uWrap, vec2(s.x, (k * (uRows - 1.) + .5) / uRows)).rgb;
    vec3 shade = texture2D(uShade, s).rgb * 2.;
    // the very rim and the see-through fringe melt into the picture's own fringe
    col = mix(col, det * shade * 2., smoothstep(.97, .9, abs(v)) * smoothstep(.45, .85, here.a));
  }
  gl_FragColor = vec4(col * here.a, here.a) + mount * (1. - here.a);
}`;

function texture(gl, unit, src, { premultiply = false, data = null, w = 0 } = {}) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
  if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const load = (url) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = url; });

export async function createBoomRoll(canvas, { base = 'assets/team/', aspect } = {}) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('no WebGL');
  const D = MIC_ROLL;
  const [still, wrap, shade, mount] = await Promise.all([D.still, D.wrap, D.shade, D.mount].map((f) => load(base + f)));
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
  texture(gl, 0, still, { premultiply: true });
  texture(gl, 1, wrap);
  texture(gl, 2, shade);
  const prof = new Uint8Array(D.profile.length * 4);
  D.profile.forEach(([c, r], i) => { prof[i * 4] = Math.round(c * 255); prof[i * 4 + 1] = Math.round(r * 255); prof[i * 4 + 3] = 255; });
  texture(gl, 3, null, { data: prof, w: D.profile.length });
  texture(gl, 4, mount, { premultiply: true });
  const U = (n) => gl.getUniformLocation(prog, n);
  ['uStill', 'uWrap', 'uShade', 'uProfile', 'uMount'].forEach((n, i) => gl.uniform1i(U(n), i));
  const a = (D.place.axis * Math.PI) / 180;
  gl.uniform2f(U('uMid'), D.place.mid[0], D.place.mid[1]);
  gl.uniform2f(U('uDir'), Math.cos(a), Math.sin(a));
  gl.uniform1f(U('uLen'), D.place.length);
  gl.uniform1f(U('uBoxAspect'), aspect || D.place.aspect);
  gl.uniform1f(U('uStillAspect'), D.h / D.w);
  gl.uniform1f(U('uRows'), wrap.height);
  const uRoll = U('uRoll');
  gl.clearColor(0, 0, 0, 0);
  const api = {
    axis: a,                                    // the long axis on the screen (radians, y down), for the hand
    radius: 40,                                 // the windshield's radius in CSS pixels, for the hand
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
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

// Fragment shader for the "flowing intelligence" page transition.
// WebGL1 for the widest support. Coordinates are in device pixels.

export const vertexSource = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const fragmentSource = /* glsl */ `
precision highp float;

uniform vec2 uRes;        // canvas size (px)
uniform vec2 uOrigin;     // origin centre (px, GL coords: y up)
uniform float uOriginR;   // origin radius (px)
uniform float uT;         // seconds
uniform float uP;         // phase progress 0..1
uniform float uMode;      // 0 = cover, 1 = reveal

const vec3 BG = vec3(0.039, 0.039, 0.043);
const vec3 AMBER = vec3(0.949, 0.710, 0.267);

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
float easeInOut(float x) { return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }

// Radial filaments flowing outward from a point, with a forward "depth" zoom.
float filaments(vec2 d, float scale, float depth) {
  float r = length(d) / scale;
  float a = atan(d.y, d.x);
  float rz = r / (1.0 + depth * 2.2);              // zoom into the field as we travel
  float n = fbm(vec2(a * 2.4, rz * 2.6 - uT * 0.7));
  float lines = pow(abs(sin(a * 34.0 + n * 7.0)), 70.0);
  float pulse = fract(rz * 5.0 - uT * 1.6 + n * 1.3);
  float dash = smoothstep(0.0, 0.08, pulse) * smoothstep(0.55, 0.12, pulse);
  float fine = pow(abs(sin(a * 90.0 + n * 11.0)), 160.0) * 0.6;
  return (lines * (0.35 + 0.65 * dash) + fine * dash);
}

void main() {
  vec2 p = gl_FragCoord.xy;
  float scale = max(uRes.x, uRes.y);
  float e = easeInOut(clamp(uP, 0.0, 1.0));
  vec3 col = BG;
  float alpha = 0.0;

  if (uMode < 0.5) {
    // COVER: a front expands from the origin rect to beyond the screen corners.
    vec2 d = p - uOrigin;
    float maxR = length(max(uOrigin, uRes - uOrigin)) + 40.0;
    float radius = mix(uOriginR, maxR, e);
    float dist = length(d);
    float inside = 1.0 - smoothstep(radius - 2.0, radius + 2.0, dist);
    float front = exp(-abs(dist - radius) / (18.0 + 60.0 * e));
    float f = filaments(d, scale, e);
    float wake = smoothstep(radius * 1.25, radius * 0.2, dist);   // filaments lead slightly ahead of the front
    col = BG + AMBER * (f * 0.9 * wake + front * 0.55 * (1.0 - e * 0.6));
    alpha = clamp(inside + front * 0.8 + f * wake * 0.6, 0.0, 1.0);
  } else {
    // REVEAL: a hole opens from the centre; filaments disperse outward and fade.
    vec2 c = uRes * 0.5;
    vec2 d = p - c;
    float maxR = length(uRes) * 0.5 + 40.0;
    float hole = mix(0.0, maxR, e);
    float dist = length(d);
    float cover = smoothstep(hole - 3.0, hole + 3.0, dist);
    float rim = exp(-abs(dist - hole) / 26.0) * (1.0 - e);
    float f = filaments(d, scale, 1.0 + e) * (1.0 - e);
    col = BG + AMBER * (f * 0.8 + rim * 0.6);
    alpha = clamp(cover * (1.0 - e * 0.15) + rim * 0.8, 0.0, 1.0) * (1.0 - smoothstep(0.85, 1.0, e));
  }

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

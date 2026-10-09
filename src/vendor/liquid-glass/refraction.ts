/*
  Refraction shader adapted from liquid-glass-js by Armagan Amcalar
  (https://github.com/dashersw/liquid-glass-js, commit 78cb6cc, MIT, see ./LICENSE).

  Changes from the original Container shader:
  - Samples a small texture of the region behind the element (supplied live each
    frame) instead of an html2canvas snapshot of the whole page, so moving content
    such as a WebGL scene refracts correctly.
  - Blur kernel reduced from a radius of 6 to 4 texels, and the per-pixel
    "sampled gradient" pass (about 660 texture reads per fragment) replaced with a
    single vertical tint, to keep the cost reasonable on large panels.
  - Pill and circle shape detection removed; rounded rectangles only.
  The shape distance, normal, edge/rim/base intensity, corner boost, and ripple
  terms are kept as in the original.
*/

export const glassVertex = /* glsl */ `
attribute vec2 a_position;
varying vec2 v_texcoord;
void main() {
  v_texcoord = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const glassFragment = /* glsl */ `
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;   // element size (css px)
uniform vec2 u_textureSize;  // captured region size (css px) = element + 2 * margin
uniform float u_margin;
uniform float u_borderRadius;
uniform float u_scale;       // converts original page-normalised offsets to this texture
uniform float u_blurRadius;
uniform float u_edgeIntensity;
uniform float u_rimIntensity;
uniform float u_baseIntensity;
uniform float u_edgeDistance;
uniform float u_rimDistance;
uniform float u_baseDistance;
uniform float u_cornerBoost;
uniform float u_rippleEffect;
uniform float u_tintOpacity;
uniform float u_warp;
varying vec2 v_texcoord;

float roundedRectDistance(vec2 coord, vec2 size, float radius) {
  vec2 center = size * 0.5;
  vec2 pixelCoord = coord * size;
  vec2 toCorner = abs(pixelCoord - center) - (center - radius);
  float outsideCorner = length(max(toCorner, 0.0));
  float insideCorner = min(max(toCorner.x, toCorner.y), 0.0);
  return (outsideCorner + insideCorner - radius);
}

void main() {
  vec2 coord = v_texcoord;
  vec2 textureCoord = (u_margin + coord * u_resolution) / u_textureSize;

  float distFromEdgeShape = max(-roundedRectDistance(coord, u_resolution, u_borderRadius), 0.0);
  vec2 shapeNormal = normalize(coord - vec2(0.5) + 1e-5);

  float minDim = min(u_resolution.x, u_resolution.y);
  float normalizedDistance = distFromEdgeShape;
  float baseIntensity = 1.0 - exp(-normalizedDistance * u_baseDistance);
  float edgeIntensity = exp(-normalizedDistance * u_edgeDistance);
  float rimIntensity = exp(-normalizedDistance * u_rimDistance);
  float baseComponent = u_warp > 0.5 ? baseIntensity * u_baseIntensity : 0.0;
  float totalIntensity = baseComponent + edgeIntensity * u_edgeIntensity + rimIntensity * u_rimIntensity;
  vec2 baseRefraction = shapeNormal * totalIntensity;

  float cornerProximityX = min(coord.x, 1.0 - coord.x);
  float cornerProximityY = min(coord.y, 1.0 - coord.y);
  float cornerNormalized = max(cornerProximityX, cornerProximityY) * minDim;
  vec2 cornerRefraction = shapeNormal * exp(-cornerNormalized * 0.3) * u_cornerBoost;

  vec2 perpendicular = vec2(-shapeNormal.y, shapeNormal.x);
  float rippleEffect = sin(distFromEdgeShape / minDim * 25.0) * u_rippleEffect * rimIntensity;
  vec2 textureRefraction = perpendicular * rippleEffect;

  textureCoord += (baseRefraction + cornerRefraction + textureRefraction) * u_scale;

  vec4 color = vec4(0.0);
  vec2 texel = 1.0 / u_textureSize;
  float sigma = u_blurRadius / 2.0;
  float total = 0.0;
  for (float i = -4.0; i <= 4.0; i += 1.0) {
    for (float j = -4.0; j <= 4.0; j += 1.0) {
      float d = length(vec2(i, j));
      if (d > 4.0) continue;
      float w = exp(-(d * d) / (2.0 * sigma * sigma));
      color += texture2D(u_image, textureCoord + vec2(i, j) * texel * sigma) * w;
      total += w;
    }
  }
  color /= total;

  vec3 tint = mix(vec3(1.0), vec3(0.7), coord.y);
  color.rgb = mix(color.rgb, tint, u_tintOpacity);

  // Soft specular rim along the top edge
  float rim = exp(-distFromEdgeShape * 0.6) * smoothstep(0.6, 0.0, coord.y) * 0.18;
  color.rgb += rim;

  // Anti-aliased rounded-rect alpha mask
  float d = roundedRectDistance(coord, u_resolution, u_borderRadius);
  float a = 1.0 - smoothstep(-1.0, 0.5, d);
  gl_FragColor = vec4(color.rgb * a, a);
}
`;

// Defaults from the original library (window.glassControls fallbacks), with a lower
// tint so the glass reads well on a dark page.
export const glassDefaults = {
  blurRadius: 5,
  edgeIntensity: 0.01,
  rimIntensity: 0.05,
  baseIntensity: 0.01,
  edgeDistance: 0.15,
  rimDistance: 0.8,
  baseDistance: 0.1,
  cornerBoost: 0.02,
  rippleEffect: 0.1,
  tintOpacity: 0.06,
};

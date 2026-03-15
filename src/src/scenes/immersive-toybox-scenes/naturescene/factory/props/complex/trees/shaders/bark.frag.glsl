uniform vec3 uBarkColor;
uniform vec3 uBarkDark;
uniform vec3 uMossColor;
uniform float uSeed;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

// Simple 3D hash for procedural detail
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

// Value noise
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
  return n;
}

// fBm
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p *= 2.1;
    a *= 0.48;
  }
  return v;
}

void main() {
  vec3 p = vWorldPos * 3.0 + uSeed;

  // Vertical bark cracks — stretch noise along Y
  float cracks = fbm(vec3(p.x * 2.0, p.y * 0.4, p.z * 2.0));

  // Fine grain detail
  float grain = fbm(p * 8.0) * 0.3;

  // Horizontal ring pattern (growth rings visible in cracks)
  float rings = sin(length(p.xz) * 12.0 + p.y * 0.5) * 0.1;

  // Combine
  float pattern = cracks + grain + rings;

  // Color: dark in crevices, lighter on ridges
  vec3 bark = mix(uBarkDark, uBarkColor, smoothstep(0.3, 0.7, pattern));

  // Moss on upward-facing and north-facing surfaces
  float upFacing = max(0.0, vNormal.y);
  float northFacing = max(0.0, -vNormal.z) * 0.5;
  float mossAmount = (upFacing + northFacing) * smoothstep(0.5, 0.8, fbm(p * 2.0 + 10.0));
  // More moss near base
  float heightFade = 1.0 - smoothstep(0.0, 3.0, vWorldPos.y);
  mossAmount *= heightFade * 0.7;

  vec3 color = mix(bark, uMossColor, mossAmount);

  // Simple lighting from normal
  vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
  float diff = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.5;
  color *= diff;

  // Darken crevices (ambient occlusion fake)
  color *= smoothstep(0.15, 0.55, pattern) * 0.4 + 0.6;

  gl_FragColor = vec4(color, 1.0);
}

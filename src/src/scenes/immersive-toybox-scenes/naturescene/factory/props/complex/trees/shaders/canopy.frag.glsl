uniform vec3 uLeafLight;
uniform vec3 uLeafMid;
uniform vec3 uLeafDark;
uniform float uSeed;

varying vec3 vWorldPos;
varying vec3 vNormal;

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise3(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec3 p = vWorldPos * 4.0 + uSeed;

  // Leaf cluster pattern — splotchy color variation
  float leafNoise = fbm(p);
  float detail = fbm(p * 3.0) * 0.5;

  // Three-tone leaf color
  vec3 color;
  float t = leafNoise + detail * 0.5;
  if (t < 0.4) {
    color = mix(uLeafDark, uLeafMid, t / 0.4);
  } else {
    color = mix(uLeafMid, uLeafLight, (t - 0.4) / 0.6);
  }

  // Dappled sunlight — bright spots where light punches through
  float sun = smoothstep(0.65, 0.85, fbm(p * 1.5 + 50.0));
  color = mix(color, uLeafLight * 1.3, sun * 0.4);

  // Translucency — backlit leaves glow warmly
  vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
  float backlit = max(0.0, dot(-vNormal, lightDir));
  float translucentGlow = pow(backlit, 2.0) * 0.3;
  color += vec3(0.15, 0.2, 0.02) * translucentGlow;

  // Standard diffuse
  float diff = max(dot(vNormal, lightDir), 0.0) * 0.45 + 0.55;
  color *= diff;

  // Darken undersides
  float underside = max(0.0, -vNormal.y) * 0.25;
  color *= 1.0 - underside;

  gl_FragColor = vec4(color, 1.0);
}

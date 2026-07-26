import { ShaderMaterial, DoubleSide, type Color } from 'three';

/**
 * Bubble-pop's own soap-bubble shader.
 *
 * Forked from `@app/minigames/shared/materials`'s `createBubbleMaterial`
 * (bubble-pop was its only consumer) because that version was tuned for a
 * bright scene: it composed `opacity = uAlpha * (0.1 + 0.5 * fresnel)` at
 * uAlpha 0.5/0.6 and `finalColor = baseColor * 0.4 + rim + spec`, so a bubble
 * facing the camera was 5% opaque and 40%-lit against this game's night sky
 * (top colour (0.015, 0.02, 0.07) — near black). Toddlers were being asked to
 * tap things they could barely see. The rim is deliberately kept; the goal is
 * a legible soap bubble, not an opaque ball.
 */

/**
 * Opacity floor — the share of uAlpha a bubble keeps head-on, where fresnel
 * is ~0. Was 0.1, which is invisible over a near-black sky.
 */
const OPACITY_FLOOR = 0.45;

/** Extra opacity the fresnel rim adds on top of the floor (floor + this = 1). */
const OPACITY_RIM = 0.55;

/**
 * Base-colour weight in the final colour. Was 0.4, which dimmed the pastel
 * palette to roughly sky level before the alpha blend even happened.
 */
const BASE_COLOR_WEIGHT = 0.85;

/**
 * Peak alpha for an ordinary bubble. With OPACITY_FLOOR this puts the
 * *minimum* resulting alpha anywhere on a normal bubble at
 * 0.85 * 0.45 = 0.3825 — call it 0.38 — rising to 0.85 at the rim.
 * Composited over the darkest sky the game shows, the flattest part of a
 * pastel bubble still lands around 0.2–0.3 luminance against a 0.025
 * background, which is unambiguous.
 */
export const BUBBLE_ALPHA_NORMAL = 0.85;

/** Peak alpha for a giant bubble — minimum alpha 0.92 * 0.45 = 0.414. */
export const BUBBLE_ALPHA_GIANT = 0.92;

/** Vertex shader — passes view-space normal and view direction to the fragment stage. */
const BUBBLE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

/** Fragment shader — Fresnel rim, thin-film iridescence, specular highlight. */
const BUBBLE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uTime;
  uniform float uPhase;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  // Thin-film iridescence approximated with a cosine palette.
  vec3 iridescence(float cosTheta, float phase) {
    float t = (1.0 - cosTheta) * 3.0 + phase;
    return vec3(
      0.5 + 0.5 * cos(6.2832 * (t * 1.0 + 0.0)),
      0.5 + 0.5 * cos(6.2832 * (t * 1.0 + 0.33)),
      0.5 + 0.5 * cos(6.2832 * (t * 1.0 + 0.67))
    );
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);

    // Fresnel: gentle falloff — softer rim, no hard edge
    float cosTheta = abs(dot(normal, viewDir));
    float fresnel = pow(1.0 - cosTheta, 1.8);

    vec3 iriColor = iridescence(cosTheta, uPhase + uTime * 0.3);

    // Blend base tint with iridescence — iridescence strongest at rim
    vec3 baseColor = mix(uColor, iriColor, 0.3 + 0.4 * fresnel);

    // Specular highlight (fake point light from above-right)
    vec3 lightDir = normalize(vec3(0.4, 1.0, 0.6));
    vec3 halfDir = normalize(viewDir + lightDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);

    vec3 rimGlow = iriColor * fresnel * 0.35;
    vec3 finalColor = baseColor * ${BASE_COLOR_WEIGHT.toFixed(2)} + rimGlow + vec3(spec * 0.9);

    // Opacity: a legible floor everywhere, brightening smoothly toward the rim
    float opacity = uAlpha * (${OPACITY_FLOOR.toFixed(2)} + ${OPACITY_RIM.toFixed(2)} * fresnel);

    // Add specular to opacity so highlights pop
    opacity = min(1.0, opacity + spec * 0.4);

    gl_FragColor = vec4(finalColor, opacity);
  }
`;

/**
 * Creates the soap-bubble ShaderMaterial used by every bubble in this game.
 *
 * @param name - Unique material identifier.
 * @param color - Base colour tint for the bubble surface.
 * @param alpha - Peak (rim) opacity. Defaults to BUBBLE_ALPHA_NORMAL.
 * @returns A ShaderMaterial legible against the game's night sky.
 */
export function createBubbleMaterial(name: string, color: Color, alpha: number = BUBBLE_ALPHA_NORMAL): ShaderMaterial {
  return new ShaderMaterial({
    name,
    vertexShader: BUBBLE_VERT,
    fragmentShader: BUBBLE_FRAG,
    uniforms: {
      uColor: { value: color.clone() },
      uAlpha: { value: alpha },
      uTime: { value: 0 },
      uPhase: { value: Math.random() * Math.PI * 2 },
    },
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
}

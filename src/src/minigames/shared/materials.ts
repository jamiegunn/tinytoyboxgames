import { MeshStandardMaterial, ShaderMaterial, Color, DoubleSide } from 'three';

// Re-export all base material factories for convenience
export {
  createWoodMaterial,
  createFeltMaterial,
  createGlossyPaintMaterial,
  createPlasticMaterial,
  createToyMetalMaterial,
  createTranslucentMaterial,
  createWovenMaterial,
  createPaperMaterial,
} from '@app/utils/materialFactory';

/**
 * Creates a MeshStandardMaterial simulating a soft rubber surface for balloons and rubber ducks.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the rubber surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.4.
 */
export function createRubberMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.4,
    emissive: color.clone().multiplyScalar(0.05),
  });
}

/**
 * Creates a MeshStandardMaterial simulating transparent glass for jars and bubbles.
 *
 * @param name - Unique material identifier.
 * @param color - Base color tint for the glass surface.
 * @param alpha - Opacity value from 0 (invisible) to 1 (opaque). Defaults to 0.35.
 * @returns A configured MeshStandardMaterial with metalness=0.1 and roughness=0.05.
 */
export function createGlassMaterial(name: string, color: Color, alpha = 0.35): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: alpha,
    side: DoubleSide,
  });
}

/** Vertex shader for soap-bubble material — passes view-space normal and direction to fragment. */
const BUBBLE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

/** Fragment shader for soap-bubble material — Fresnel rim, thin-film iridescence, specular. */
const BUBBLE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uTime;
  uniform float uPhase;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  // Attempt thin-film iridescence via simple cosine palette
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

    // Thin-film iridescent color
    vec3 iriColor = iridescence(cosTheta, uPhase + uTime * 0.3);

    // Blend base tint with iridescence — iridescence strongest at rim
    vec3 baseColor = mix(uColor, iriColor, 0.3 + 0.4 * fresnel);

    // Specular highlight (fake point light from above-right)
    vec3 lightDir = normalize(vec3(0.4, 1.0, 0.6));
    vec3 halfDir = normalize(viewDir + lightDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);

    // Compose: soft rim glow + base + specular
    vec3 rimGlow = iriColor * fresnel * 0.35;
    vec3 finalColor = baseColor * 0.4 + rimGlow + vec3(spec * 0.9);

    // Opacity: soft gradient from center to rim — no hard border
    float opacity = uAlpha * (0.1 + 0.5 * fresnel);

    // Add specular to opacity so highlights pop
    opacity = min(1.0, opacity + spec * 0.4);

    gl_FragColor = vec4(finalColor, opacity);
  }
`;

/**
 * Creates a custom ShaderMaterial simulating a soap bubble with Fresnel rim,
 * thin-film iridescence, and specular highlights.
 *
 * @param name - Unique material identifier.
 * @param color - Base color tint for the bubble surface.
 * @param alpha - Peak opacity (rim opacity). Defaults to 0.5.
 * @returns A ShaderMaterial that looks like a real soap bubble.
 */
export function createBubbleMaterial(name: string, color: Color, alpha = 0.5): ShaderMaterial {
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

/**
 * Creates a MeshStandardMaterial simulating a water surface with slight reflectivity.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the water surface.
 * @param alpha - Opacity value from 0 (invisible) to 1 (opaque). Defaults to 0.7.
 * @returns A configured MeshStandardMaterial with metalness=0.2 and roughness=0.1.
 */
export function createWaterMaterial(name: string, color: Color, alpha = 0.7): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.2,
    roughness: 0.1,
    transparent: true,
    opacity: alpha,
    emissive: color.clone().multiplyScalar(0.08),
  });
}

/**
 * Creates a MeshStandardMaterial simulating soft animal fur.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the fur surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.92.
 */
export function createFurMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.92,
    emissive: color.clone().multiplyScalar(0.03),
  });
}

/**
 * Creates a MeshStandardMaterial simulating animal skin (elephants, sharks, frogs).
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the skin surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.55.
 */
export function createSkinMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.55,
    emissive: color.clone().multiplyScalar(0.04),
  });
}

/**
 * Creates a MeshStandardMaterial for cartoon-style eye sclera (whites of the eyes).
 *
 * @param name - Unique material identifier.
 * @returns A configured MeshStandardMaterial with white base, metalness=0.05, and roughness=0.1.
 */
export function createCartoonEyeWhiteMaterial(name: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color: new Color(1, 1, 1),
    metalness: 0.05,
    roughness: 0.1,
    emissive: new Color(0.15, 0.15, 0.15),
  });
}

/**
 * Creates a MeshStandardMaterial for cartoon-style eye pupils.
 *
 * @param name - Unique material identifier.
 * @returns A configured MeshStandardMaterial with near-black base, metalness=0.1, and roughness=0.08.
 */
export function createCartoonPupilMaterial(name: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color: new Color(0.02, 0.02, 0.02),
    metalness: 0.1,
    roughness: 0.08,
  });
}

/**
 * Creates a MeshStandardMaterial for cartoon-style animal noses.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the nose surface.
 * @returns A configured MeshStandardMaterial with metalness=0.05 and roughness=0.15.
 */
export function createCartoonNoseMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0.05, roughness: 0.15 });
}

/**
 * Creates a MeshStandardMaterial simulating a dusty chalk or crayon surface.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the chalk surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.98.
 */
export function createChalkMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0, roughness: 0.98 });
}

/**
 * Creates a MeshStandardMaterial simulating a glazed ceramic surface for bowls and pots.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the ceramic glaze.
 * @returns A configured MeshStandardMaterial with metalness=0.05 and roughness=0.2.
 */
export function createCeramicMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0.05, roughness: 0.2 });
}

/**
 * Creates a MeshStandardMaterial simulating polished metal for collectible stars and coins.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the metal surface.
 * @returns A configured MeshStandardMaterial with metalness=0.85 and roughness=0.2.
 */
export function createMetalMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.85,
    roughness: 0.2,
    emissive: color.clone().multiplyScalar(0.1),
  });
}

/**
 * Creates a MeshStandardMaterial simulating a sandy ground or beach surface.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the sand surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.95.
 */
export function createSandMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.95,
    emissive: color.clone().multiplyScalar(0.02),
  });
}

/**
 * Creates a MeshStandardMaterial simulating leaves and grass.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the leaf surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.6.
 */
export function createLeafMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.6,
    emissive: color.clone().multiplyScalar(0.06),
  });
}

/**
 * Creates a MeshStandardMaterial simulating underwater coral with bioluminescent glow.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the coral surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.7.
 */
export function createCoralMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.7,
    emissive: color.clone().multiplyScalar(0.08),
  });
}

/**
 * Creates a MeshStandardMaterial for inner ear surfaces.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the inner ear (typically pink).
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.6.
 */
export function createInnerEarMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.6,
    emissive: color.clone().multiplyScalar(0.05),
  });
}

/**
 * Creates a MeshStandardMaterial for colored eye irises.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the iris.
 * @returns A configured MeshStandardMaterial with metalness=0.05 and roughness=0.15.
 */
export function createIrisMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.05,
    roughness: 0.15,
    emissive: color.clone().multiplyScalar(0.05),
  });
}

/**
 * Creates a MeshStandardMaterial for glossy collars and accessories.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the accessory.
 * @returns A configured MeshStandardMaterial with metalness=0.1 and roughness=0.25.
 */
export function createAccessoryMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.1,
    roughness: 0.25,
    emissive: color.clone().multiplyScalar(0.05),
  });
}

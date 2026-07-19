import { Scene, Vector3, Mesh, Group, SphereGeometry, Sprite, SpriteMaterial, AdditiveBlending, CanvasTexture, type MeshStandardMaterial } from 'three';
import { createTranslucentMaterial } from '@app/utils/materialFactory';
import { rand } from '@app/utils/randomHelpers';
import type { FireflyConfig, FireflyCreateResult, FireflyInstance } from './types';
import { startDrift, startBlink, GLOW_SPRITE_REST_OPACITY } from './animation';

/** Cached radial glow texture shared by every firefly glow sprite. */
let glowTexture: CanvasTexture | null = null;

/**
 * Returns a cached 64x64 soft radial glow texture for firefly glow sprites.
 * Created once and reused globally (mirrors the particle texture cache pattern).
 *
 * @returns The cached CanvasTexture with radial falloff.
 */
function getGlowTexture(): CanvasTexture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new CanvasTexture(canvas);
  return glowTexture;
}

/**
 * Generates a random spawn position within the nature world bounds.
 * Fireflies hover between Y 0.6 and 2.4, spread across the scene.
 * @returns A random Vector3 spawn position.
 */
function randomSpawn(): Vector3 {
  return new Vector3(rand.bipolar(10), rand.range(0.6, 2.4), rand.bipolar(8));
}

/**
 * Creates a group of fireflies with drifting motion and a pulsing glow.
 *
 * Each firefly:
 * - Drifts lazily between random waypoints using GSAP
 * - Glows via a bright emissive body plus an additive billboard sprite —
 *   no per-firefly PointLight, so StandardMaterial shaders stay cheap and
 *   never recompile when fireflies come and go
 * - Pulses emissive colour and sprite opacity with organic timing
 *
 * @param scene - The Three.js scene to add fireflies to.
 * @param config - Firefly configuration including colors and count.
 * @returns The root group, typed per-firefly instances, and cleanup functions.
 */
export function createFireflies(scene: Scene, config: FireflyConfig): FireflyCreateResult {
  const root = new Group();
  root.name = 'fireflies_root';
  scene.add(root);
  const instances: FireflyInstance[] = [];
  const killFns: (() => void)[] = [];

  for (let i = 0; i < config.count; i++) {
    const home = randomSpawn();

    const fly = new Mesh(new SphereGeometry(0.04, 6, 6), createTranslucentMaterial(`fireflyMat_${i}`, config.glowColor.clone(), 0.85));
    fly.name = `firefly_${i}`;
    fly.position.copy(home);
    const mat = fly.material as MeshStandardMaterial;
    mat.emissive = config.glowColor.clone();
    // Raised emissive so the body still reads as glowing without a PointLight;
    // ACES tone mapping rolls the highlight off softly.
    mat.emissiveIntensity = 2.5;
    root.add(fly);

    // Additive billboard glow — the cheap stand-in for the old per-firefly light.
    const glowMaterial = new SpriteMaterial({
      map: getGlowTexture(),
      color: config.lightColor.clone(),
      transparent: true,
      opacity: GLOW_SPRITE_REST_OPACITY,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new Sprite(glowMaterial);
    glowSprite.name = `fireflyGlow_${i}`;
    glowSprite.scale.setScalar(0.45);
    glowSprite.raycast = () => {}; // taps must hit the firefly mesh, not the glow halo
    fly.add(glowSprite);

    killFns.push(startDrift(fly, home));
    killFns.push(startBlink(mat, glowMaterial, config));

    instances.push({ mesh: fly, material: mat, glowSprite, glowMaterial, glowColor: config.glowColor.clone() });
  }

  return {
    root,
    instances,
    killAnimations: () => killFns.forEach((fn) => fn()),
    dispose: () => {
      // Sprites are not Meshes, so the generic scene disposal never reaches
      // their materials — release them here. The glow texture cache is shared
      // and intentionally kept alive, like the other CanvasTexture caches.
      instances.forEach(({ glowSprite, glowMaterial }) => {
        glowSprite.removeFromParent();
        glowMaterial.dispose();
      });
    },
  };
}

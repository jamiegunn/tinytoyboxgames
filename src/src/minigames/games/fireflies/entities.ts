import { type Scene, SpriteMaterial, Sprite, PointLight, Vector3, AdditiveBlending, CanvasTexture } from 'three';
import { createFireflyGlow } from '@app/minigames/shared/particleFx';
import type { FireflyData } from './types';
import { FIREFLY_COLOR, GOLDEN_COLOR } from './types';
import { randomRange } from '@app/minigames/shared/mathUtils';
import { randomSpawnPos, randomBehavior } from './helpers';

// ── Cached glow dot texture ─────────────────────────────────────────────────

let glowDotTexture: CanvasTexture | null = null;

/**
 * Returns a cached 64x64 soft radial glow texture.
 * Bright center fading smoothly to transparent — looks like a point of light.
 * @returns The cached CanvasTexture for glow dots.
 */
function getGlowDotTexture(): CanvasTexture {
  if (glowDotTexture) return glowDotTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowDotTexture = new CanvasTexture(canvas);
  return glowDotTexture;
}

/**
 * Creates a firefly entity as a soft glowing sprite with a point light
 * and particle trail. No 3D mesh — fireflies are points of light.
 *
 * @param scene - The Three.js scene.
 * @param index - Index for unique naming.
 * @param isGolden - Whether this is the golden variant.
 * @returns A FireflyData object ready for activation.
 */
export function createFirefly(scene: Scene, index: number, isGolden: boolean): FireflyData {
  const baseColor = isGolden ? GOLDEN_COLOR : FIREFLY_COLOR;

  // ── Sprite: the firefly IS a soft glowing dot ──
  const spriteSize = isGolden ? 0.45 : 0.3;
  const spriteMaterial = new SpriteMaterial({
    map: getGlowDotTexture(),
    color: baseColor.clone(),
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new Sprite(spriteMaterial);
  sprite.scale.setScalar(spriteSize);
  sprite.name = `nature_firefly_${isGolden ? 'golden' : 'standard'}_${index}`;
  sprite.raycast = () => {}; // hit detection is screen-space, not raycaster
  scene.add(sprite);

  // ── Point light for local glow illumination ──
  const light = new PointLight(baseColor.clone(), isGolden ? 0.6 : 0.35, isGolden ? 3.5 : 2.5);
  light.name = `nature_firefly_light_${index}`;
  scene.add(light);

  // ── Position ──
  const pos = randomSpawnPos();
  sprite.position.copy(pos);
  light.position.copy(pos);

  // ── Continuous glow particle trail ──
  const glowTrail = createFireflyGlow(scene, sprite, baseColor);

  const behavior = randomBehavior();
  const behaviorCenter = randomSpawnPos();
  const behaviorRadius = randomRange(0.8, 1.5);
  const zigzagDir = new Vector3(randomRange(-1, 1), randomRange(-0.5, 0.5), randomRange(-0.5, 0.5)).normalize();

  return {
    sprite,
    spriteMaterial,
    light,
    glowTrail,
    speed: randomRange(0.25, 0.55),
    glowPhase: Math.random() * Math.PI * 2,
    driftOffsetX: Math.random() * Math.PI * 2,
    driftOffsetY: Math.random() * Math.PI * 2,
    driftOffsetZ: Math.random() * Math.PI * 2,
    time: Math.random() * 100,
    isGolden,
    catching: false,
    catchProgress: 0,
    catchStartPos: new Vector3(0, 0, 0),
    flashing: false,
    flashTimer: 0,
    active: true,
    respawnTimer: 0,
    behavior,
    behaviorCenter,
    behaviorAngle: Math.random() * Math.PI * 2,
    behaviorRadius,
    zigzagTimer: randomRange(1.0, 2.0),
    zigzagDir,
  };
}

/**
 * Resets a firefly to a new random position with new drift parameters.
 *
 * @param fd - The firefly data to reset.
 * @param scene - The Three.js scene (needed to re-start the glow trail).
 */
export function resetFirefly(fd: FireflyData, scene: Scene): void {
  const pos = randomSpawnPos();
  fd.sprite.position.copy(pos);
  fd.light.position.copy(pos);
  fd.speed = randomRange(0.25, 0.55);
  fd.glowPhase = Math.random() * Math.PI * 2;
  fd.driftOffsetX = Math.random() * Math.PI * 2;
  fd.driftOffsetY = Math.random() * Math.PI * 2;
  fd.driftOffsetZ = Math.random() * Math.PI * 2;
  fd.time = Math.random() * 100;
  fd.catching = false;
  fd.catchProgress = 0;
  fd.flashing = false;
  fd.flashTimer = 0;
  fd.active = true;
  fd.respawnTimer = 0;
  fd.behavior = randomBehavior();
  fd.behaviorCenter = randomSpawnPos();
  fd.behaviorAngle = Math.random() * Math.PI * 2;
  fd.behaviorRadius = randomRange(0.8, 1.5);
  fd.zigzagTimer = randomRange(1.0, 2.0);
  fd.zigzagDir = new Vector3(randomRange(-1, 1), randomRange(-0.5, 0.5), randomRange(-0.5, 0.5)).normalize();
  fd.sprite.visible = true;
  fd.light.visible = true;
  fd.spriteMaterial.opacity = 0.85;
  fd.glowTrail.start(scene);
}

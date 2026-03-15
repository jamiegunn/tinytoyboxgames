import { Color, Vector3, type Scene, type Object3D } from 'three';
import { CanvasTexture } from 'three';
import { SimpleParticleSystem } from '@app/utils/particles';

// ---------------------------------------------------------------------------
// Texture cache — one circle and one sparkle texture globally
// ---------------------------------------------------------------------------

let circleTexture: CanvasTexture | null = null;
let sparkleTexture: CanvasTexture | null = null;

/**
 * Returns a cached soft-circle CanvasTexture, creating it on first access.
 *
 * @returns A reusable soft-circle CanvasTexture.
 */
function getCircleTexture(): CanvasTexture {
  if (circleTexture) return circleTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  circleTexture = new CanvasTexture(canvas);
  return circleTexture;
}

/**
 * Returns a cached sparkle / 4-pointed-star CanvasTexture, creating it on first access.
 *
 * @returns A reusable sparkle CanvasTexture.
 */
function getSparkleTexture(): CanvasTexture {
  if (sparkleTexture) return sparkleTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, size, size);
  // Radial glow
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fill();
  // Cross flare
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(half - 1, 0, 2, size);
  ctx.fillRect(0, half - 1, size, 2);
  sparkleTexture = new CanvasTexture(canvas);
  return sparkleTexture;
}

// ---------------------------------------------------------------------------
// Helper: create and configure a particle system
// ---------------------------------------------------------------------------

/**
 * Creates a SimpleParticleSystem with a custom texture.
 *
 * @param capacity - Maximum number of particles.
 * @param texture - The CanvasTexture to use.
 * @param blendMode - Blend mode for the particles. @default 'normal'
 * @returns A configured SimpleParticleSystem.
 */
function createSystem(capacity: number, texture: CanvasTexture, blendMode: 'additive' | 'normal' = 'normal'): SimpleParticleSystem {
  const ps = new SimpleParticleSystem(capacity, blendMode);
  // Override the default texture with the provided one
  const mat = ps.points.material as import('three').PointsMaterial;
  mat.map = texture;
  mat.needsUpdate = true;
  return ps;
}

// ---------------------------------------------------------------------------
// 1. Confetti burst
// ---------------------------------------------------------------------------

/**
 * Creates a short confetti burst that sprays small colourful particles upward.
 * Auto-disposes after particles die out.
 *
 * @param scene - The Three.js scene.
 * @param position - World-space origin of the burst.
 * @param color1 - Starting blend colour.
 * @param color2 - Ending blend colour.
 * @param count - Number of particles to emit. Defaults to 40.
 */
export function createConfettiBurst(scene: Scene, position: Vector3, color1: Color, color2: Color, count = 40): void {
  const ps = createSystem(count, getCircleTexture());
  ps.configure({
    emitterPosition: position,
    direction1: new Vector3(-2, 4, -2),
    direction2: new Vector3(2, 6, 2),
    minLifeTime: 1,
    maxLifeTime: 2,
    gravity: new Vector3(0, -2, 0),
    minSize: 0.05,
    maxSize: 0.15,
    minEmitPower: 3,
    maxEmitPower: 6,
    color1,
    alpha1: 1,
    color2,
    alpha2: 1,
  });
  ps.burst(count);
  ps.stop();
  ps.start(scene, true);
}

// ---------------------------------------------------------------------------
// 2. Sparkle burst
// ---------------------------------------------------------------------------

/**
 * Creates a short radial sparkle burst with additive blending.
 * Auto-disposes after particles die out.
 *
 * @param scene - The Three.js scene.
 * @param position - World-space origin of the burst.
 * @param color - Tint colour for the sparkles.
 * @param count - Number of particles to emit. Defaults to 20.
 */
export function createSparkleBurst(scene: Scene, position: Vector3, color: Color, count = 20): void {
  const ps = createSystem(count, getSparkleTexture(), 'additive');
  ps.configure({
    emitterPosition: position,
    direction1: new Vector3(-1, -1, -1),
    direction2: new Vector3(1, 1, 1),
    minLifeTime: 0.15,
    maxLifeTime: 0.35,
    gravity: new Vector3(0, -2, 0),
    minSize: 0.08,
    maxSize: 0.1,
    minEmitPower: 2,
    maxEmitPower: 4,
    color1: color,
    alpha1: 1,
    color2: color,
    alpha2: 0,
  });
  ps.burst(count);
  ps.stop();
  ps.start(scene, true);
}

// ---------------------------------------------------------------------------
// 3. Water splash
// ---------------------------------------------------------------------------

/**
 * Creates a short upward water-splash burst with blue-white particles.
 * Auto-disposes after particles die out.
 *
 * @param scene - The Three.js scene.
 * @param position - World-space origin of the splash.
 * @param count - Number of particles to emit. Defaults to 30.
 */
export function createWaterSplash(scene: Scene, position: Vector3, count = 30): void {
  const ps = createSystem(count, getCircleTexture());
  ps.configure({
    emitterPosition: position,
    direction1: new Vector3(-1.5, 3, -1.5),
    direction2: new Vector3(1.5, 5, 1.5),
    minLifeTime: 0.8,
    maxLifeTime: 1.5,
    gravity: new Vector3(0, -5, 0),
    minSize: 0.03,
    maxSize: 0.08,
    minEmitPower: 2,
    maxEmitPower: 5,
    color1: new Color(0.7, 0.85, 1),
    alpha1: 1,
    color2: new Color(0.4, 0.6, 1),
    alpha2: 0.9,
  });
  ps.burst(count);
  ps.stop();
  ps.start(scene, true);
}

// ---------------------------------------------------------------------------
// 4. Bubble pop
// ---------------------------------------------------------------------------

/**
 * Creates a very short radial fragment burst simulating a popping bubble.
 * Auto-disposes after particles die out.
 *
 * @param scene - The Three.js scene.
 * @param position - World-space origin of the pop.
 * @param color - Tint colour matching the bubble.
 * @param count - Number of particles to emit. Defaults to 15.
 */
export function createBubblePopEffect(scene: Scene, position: Vector3, color: Color, count = 15): void {
  const ps = createSystem(count, getCircleTexture());
  ps.configure({
    emitterPosition: position,
    direction1: new Vector3(-1, -1, -1),
    direction2: new Vector3(1, 1, 1),
    minLifeTime: 0.1,
    maxLifeTime: 0.3,
    gravity: new Vector3(0, -3, 0),
    minSize: 0.04,
    maxSize: 0.08,
    minEmitPower: 2,
    maxEmitPower: 4,
    color1: color,
    alpha1: 1,
    color2: color,
    alpha2: 0,
  });
  ps.burst(count);
  ps.stop();
  ps.start(scene, true);
}

// ---------------------------------------------------------------------------
// 5. Glow trail (continuous)
// ---------------------------------------------------------------------------

/**
 * Creates a continuous glowing particle trail that follows an emitter mesh.
 * The caller is responsible for disposing the returned system.
 *
 * @param scene - The Three.js scene.
 * @param emitter - The Object3D the trail follows.
 * @param color - Tint colour for the glow dots.
 * @param rate - Particles emitted per second. Defaults to 20.
 * @returns The SimpleParticleSystem (caller must dispose).
 */
export function createGlowTrail(scene: Scene, emitter: Object3D, color: Color, rate = 20): SimpleParticleSystem {
  const ps = createSystem(rate * 2, getCircleTexture(), 'additive');
  ps.configure({
    emitterPosition: emitter.position,
    direction1: new Vector3(-0.2, -0.2, -0.2),
    direction2: new Vector3(0.2, 0.2, 0.2),
    minLifeTime: 0.3,
    maxLifeTime: 0.8,
    gravity: new Vector3(0, 0, 0),
    minSize: 0.03,
    maxSize: 0.06,
    minEmitPower: 0.3,
    maxEmitPower: 0.5,
    color1: color,
    alpha1: 1,
    color2: color,
    alpha2: 0.6,
    emitRate: rate,
  });
  ps.start(scene);
  return ps;
}

// ---------------------------------------------------------------------------
// 6. Dust puff
// ---------------------------------------------------------------------------

/**
 * Creates a soft dust puff that expands outward and fades.
 * Auto-disposes after particles die out.
 *
 * @param scene - The Three.js scene.
 * @param position - World-space origin of the puff.
 * @param color - Optional tint colour; defaults to warm tan.
 * @param count - Number of particles to emit. Defaults to 15.
 */
export function createDustPuff(scene: Scene, position: Vector3, color: Color = new Color(0.76, 0.7, 0.56), count = 15): void {
  const ps = createSystem(count, getCircleTexture());
  ps.configure({
    emitterPosition: position,
    direction1: new Vector3(-0.5, 0.3, -0.5),
    direction2: new Vector3(0.5, 1.0, 0.5),
    minLifeTime: 0.5,
    maxLifeTime: 1,
    gravity: new Vector3(0, 0, 0),
    minSize: 0.1,
    maxSize: 0.2,
    minEmitPower: 0.5,
    maxEmitPower: 1.5,
    color1: color,
    alpha1: 0.6,
    color2: color,
    alpha2: 0.4,
  });
  ps.burst(count);
  ps.stop();
  ps.start(scene, true);
}

// ---------------------------------------------------------------------------
// 7. Star collect
// ---------------------------------------------------------------------------

/**
 * Creates a gold sparkle burst for collectible pickup feedback.
 * Auto-disposes after particles die out.
 *
 * @param scene - The Three.js scene.
 * @param position - World-space position of the collected item.
 * @param count - Number of particles to emit. Defaults to 10.
 */
export function createStarCollect(scene: Scene, position: Vector3, count = 10): void {
  const ps = createSystem(count, getSparkleTexture(), 'additive');
  ps.configure({
    emitterPosition: position,
    direction1: new Vector3(-0.8, 1, -0.8),
    direction2: new Vector3(0.8, 3, 0.8),
    minLifeTime: 0.5,
    maxLifeTime: 0.8,
    gravity: new Vector3(0, -1, 0),
    minSize: 0.08,
    maxSize: 0.15,
    minEmitPower: 2,
    maxEmitPower: 4,
    color1: new Color(1, 0.85, 0.2),
    alpha1: 1,
    color2: new Color(1, 0.7, 0.1),
    alpha2: 1,
  });
  ps.burst(count);
  ps.stop();
  ps.start(scene, true);
}

// ---------------------------------------------------------------------------
// 8. Firefly glow (continuous)
// ---------------------------------------------------------------------------

/**
 * Creates a low-rate continuous firefly glow around an emitter.
 * The caller is responsible for disposing the returned system.
 *
 * @param scene - The Three.js scene.
 * @param emitter - The Object3D the fireflies surround.
 * @param color - Tint colour; typically warm yellow-green.
 * @returns The SimpleParticleSystem (caller must dispose).
 */
export function createFireflyGlow(scene: Scene, emitter: Object3D, color: Color): SimpleParticleSystem {
  const rate = 4;
  const ps = createSystem(rate * 3, getCircleTexture(), 'additive');
  ps.configure({
    emitterPosition: emitter.position,
    direction1: new Vector3(-0.15, -0.1, -0.15),
    direction2: new Vector3(0.15, 0.15, 0.15),
    minLifeTime: 0.5,
    maxLifeTime: 1.2,
    gravity: new Vector3(0, 0, 0),
    minSize: 0.02,
    maxSize: 0.04,
    minEmitPower: 0.05,
    maxEmitPower: 0.15,
    color1: color,
    alpha1: 0.9,
    color2: color,
    alpha2: 0.6,
    emitRate: rate,
  });
  ps.start(scene);
  return ps;
}

// ---------------------------------------------------------------------------
// 9. Heart burst
// ---------------------------------------------------------------------------

/**
 * Creates a slow-rising heart-themed celebration burst.
 * Auto-disposes after particles die out.
 *
 * @param scene - The Three.js scene.
 * @param position - World-space origin of the burst.
 * @param color - Tint colour (pink/red recommended).
 * @param count - Number of particles to emit. Defaults to 8.
 */
export function createHeartBurst(scene: Scene, position: Vector3, color: Color, count = 8): void {
  const ps = createSystem(count, getCircleTexture());
  ps.configure({
    emitterPosition: position,
    direction1: new Vector3(-0.5, 1, -0.5),
    direction2: new Vector3(0.5, 2.5, 0.5),
    minLifeTime: 1,
    maxLifeTime: 2,
    gravity: new Vector3(0, 0.3, 0),
    minSize: 0.1,
    maxSize: 0.2,
    minEmitPower: 0.5,
    maxEmitPower: 1.5,
    color1: color,
    alpha1: 1,
    color2: color,
    alpha2: 0.8,
  });
  ps.burst(count);
  ps.stop();
  ps.start(scene, true);
}

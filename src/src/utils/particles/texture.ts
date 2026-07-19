/**
 * Shared particle point-sprite textures.
 *
 * See architecture-standards.md#particleengine. The three legacy particle
 * modules each built their own canvas textures; two of them (`particles.ts`'s
 * `createParticleTexture` and `particleFx.ts`'s `getCircleTexture`) were
 * byte-for-byte identical soft circles — duplicate GPU uploads. This module
 * builds each distinct sprite exactly once and hands back the cached instance,
 * so a whole app has at most one circle texture and one star texture on the GPU.
 *
 * Two sprites are kept (not literally "one texture") because the star carries a
 * cross-flare that the soft circle does not; collapsing them would flatten the
 * sparkle effects. That is the intended, documented refinement of the "single
 * shared texture" goal — the goal was to kill *duplicate* uploads, which this does.
 */

import { CanvasTexture } from 'three';

/** The sprite shape a particle preset draws with. */
export type ParticleTextureKind = 'circle' | 'star';

const cache = new Map<ParticleTextureKind, CanvasTexture>();

/**
 * Builds the 64×64 soft radial circle (matches the legacy circle sprites).
 *
 * @returns A new soft-circle CanvasTexture.
 */
function buildCircle(): CanvasTexture {
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
  return new CanvasTexture(canvas);
}

/**
 * Builds the 64×64 sparkle star with cross-flare (matches the legacy sparkle sprite).
 *
 * @returns A new sparkle-star CanvasTexture.
 */
function buildStar(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, size, size);
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(half - 1, 0, 2, size);
  ctx.fillRect(0, half - 1, size, 2);
  return new CanvasTexture(canvas);
}

/**
 * Returns the shared texture for a sprite kind, building it once on first use.
 *
 * These textures are process-global and intentionally never disposed — they
 * are tiny (64×64) and shared by every engine across every scene switch, so
 * tying their lifetime to any one scope would only cause repeated re-uploads.
 *
 * @param kind - Which sprite to retrieve.
 * @returns The cached {@link CanvasTexture}.
 */
export function getParticleTexture(kind: ParticleTextureKind): CanvasTexture {
  const existing = cache.get(kind);
  if (existing) return existing;
  const tex = kind === 'star' ? buildStar() : buildCircle();
  cache.set(kind, tex);
  return tex;
}

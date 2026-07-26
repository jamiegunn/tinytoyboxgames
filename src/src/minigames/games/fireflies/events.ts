import { type Scene, Vector3, Sprite, SpriteMaterial, AdditiveBlending, CanvasTexture, Color, type PerspectiveCamera } from 'three';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';

// ── Shooting Star ────────────────────────────────────────────────────────────

interface ShootingStar {
  sprite: Sprite;
  material: SpriteMaterial;
  startPos: Vector3;
  endPos: Vector3;
  progress: number;
  duration: number;
  active: boolean;
}

// ── Surprise Event Controller ────────────────────────────────────────────────
//
// This module owns the scene's non-firefly feedback: the shooting stars that
// cross the sky, and the ripple that answers a tap which did not land on a
// firefly.

export interface SurpriseEventController {
  update(deltaTime: number, tier: number): void;
  /**
   * Screen-space tap test against the shooting stars currently streaking.
   * A hit bursts the star into sparkles immediately, so a child who manages to
   * swat one gets an answer instead of watching it sail on.
   *
   * @param camera - The active camera, used to project star positions.
   * @param rect - The canvas bounding rect in CSS pixels.
   * @param screenX - Tap X in CSS pixels.
   * @param screenY - Tap Y in CSS pixels.
   * @param radiusPx - Hit radius in CSS pixels.
   * @returns The world position of the star that was hit, or null.
   */
  tryTap(camera: PerspectiveCamera, rect: DOMRect, screenX: number, screenY: number, radiusPx: number): Vector3 | null;
  dispose(): void;
}

/** Cached star streak texture. */
let streakTexture: CanvasTexture | null = null;

function getStreakTexture(): CanvasTexture {
  if (streakTexture) return streakTexture;
  const w = 64,
    h = 16;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, h / 2, w, h / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  streakTexture = new CanvasTexture(canvas);
  return streakTexture;
}

/**
 * Creates a surprise event controller that triggers occasional visual events:
 * - Shooting stars streak across the sky (tier >= 2)
 * @param scene - The Three.js scene.
 * @returns A SurpriseEventController with update and dispose methods.
 */
export function createSurpriseEvents(scene: Scene): SurpriseEventController {
  let disposed = false;

  // Shooting star pool (reuse up to 2)
  const stars: ShootingStar[] = [];
  let shootingStarTimer = 3 + Math.random() * 5; // first one after 3-8s

  function getOrCreateStar(): ShootingStar {
    const existing = stars.find((s) => !s.active);
    if (existing) return existing;

    const mat = new SpriteMaterial({
      map: getStreakTexture(),
      color: new Color(0.95, 0.95, 1.0),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new Sprite(mat);
    sprite.scale.set(2.5, 0.15, 1);
    sprite.visible = false;
    scene.add(sprite);

    const star: ShootingStar = {
      sprite,
      material: mat,
      startPos: new Vector3(),
      endPos: new Vector3(),
      progress: 0,
      duration: 0.6,
      active: false,
    };
    stars.push(star);
    return star;
  }

  function launchShootingStar(): void {
    const star = getOrCreateStar();

    // Start from upper-right area, streak down-left
    const startX = 2 + Math.random() * 6;
    const startY = 7 + Math.random() * 4;
    star.startPos.set(startX, startY, -7 - Math.random() * 2);
    star.endPos.set(startX - 6 - Math.random() * 4, startY - 3 - Math.random() * 2, star.startPos.z);
    star.progress = 0;
    star.duration = 0.5 + Math.random() * 0.4;
    star.active = true;
    star.sprite.visible = true;

    // Orient sprite along travel direction
    const dir = star.endPos.clone().sub(star.startPos).normalize();
    const angle = Math.atan2(dir.y, dir.x);
    star.sprite.material.rotation = angle;
  }

  // Ends a star early and pays out its sparkle burst at wherever it currently is.
  function burstStar(star: ShootingStar): Vector3 {
    const where = star.sprite.position.clone();
    star.active = false;
    star.sprite.visible = false;
    getParticleEngine(scene).emit(PARTICLES.starCollect, where, { colors: [new Color(0.9, 0.92, 1.0)], count: 16 });
    return where;
  }

  return {
    update(deltaTime: number, tier: number): void {
      if (disposed) return;

      // Shooting stars from the start, more frequent at higher tiers
      shootingStarTimer -= deltaTime;
      if (shootingStarTimer <= 0) {
        launchShootingStar();
        const baseInterval = Math.max(6, 18 - tier * 2);
        shootingStarTimer = baseInterval + Math.random() * 8;
      }

      // Animate active shooting stars
      for (const star of stars) {
        if (!star.active) continue;

        star.progress += deltaTime / star.duration;
        if (star.progress >= 1.0) {
          star.active = false;
          star.sprite.visible = false;
          // Sparkle burst at the end point
          getParticleEngine(scene).emit(PARTICLES.sparkle, star.endPos.clone(), { colors: [new Color(0.8, 0.85, 1.0)], count: 8 });
          continue;
        }

        const t = star.progress;
        // Ease-in: starts slow, accelerates
        const eased = t * t;
        const pos = star.startPos.clone().lerp(star.endPos, eased);
        star.sprite.position.copy(pos);

        // Fade: bright in middle, fade at start and end
        const fade = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1.0;
        star.material.opacity = 0.9 * fade;

        // Scale: stretch as it speeds up
        const stretch = 2.0 + eased * 2.0;
        star.sprite.scale.set(stretch, 0.12, 1);
      }
    },

    tryTap(camera: PerspectiveCamera, rect: DOMRect, screenX: number, screenY: number, radiusPx: number): Vector3 | null {
      if (disposed) return null;
      for (const star of stars) {
        if (!star.active) continue;
        const projected = star.sprite.position.clone().project(camera);
        if (projected.z > 1) continue;
        const sx = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;
        const dx = sx - screenX;
        const dy = sy - screenY;
        if (dx * dx + dy * dy <= radiusPx * radiusPx) return burstStar(star);
      }
      return null;
    },

    dispose(): void {
      disposed = true;
      for (const star of stars) {
        star.sprite.removeFromParent();
        star.material.dispose();
      }
      stars.length = 0;
    },
  };
}

// ── Tap ripple (miss acknowledgement) ────────────────────────────────────────

/** Pool of expanding rings played where a tap did not find a firefly. */
export interface TapRipplePool {
  /** Play a ripple at a world position. */
  play(position: Vector3, color: Color): void;
  update(deltaTime: number): void;
  dispose(): void;
}

interface Ripple {
  sprite: Sprite;
  material: SpriteMaterial;
  age: number;
  active: boolean;
}

/** How many ripples can overlap. Toddlers tap fast; four is plenty. */
const RIPPLE_POOL_SIZE = 4;

/** Seconds a ripple takes to expand and fade. */
const RIPPLE_DURATION = 0.55;

/** Cached soft ring texture for the ripple. */
let rippleTexture: CanvasTexture | null = null;

function getRippleTexture(): CanvasTexture {
  if (rippleTexture) return rippleTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  // A soft annulus: bright at the ring, transparent at the centre and rim.
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.9, 'rgba(255, 255, 255, 0.25)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  rippleTexture = new CanvasTexture(canvas);
  return rippleTexture;
}

/**
 * Creates the tap ripple pool.
 *
 * A missed tap used to produce no visual whatsoever and a single sound at 0.06
 * volume, which on a quiet tablet is indistinguishable from a broken game. A
 * ripple is a *non-punishing* acknowledgement: the world answers every tap, it
 * just does not award a firefly.
 *
 * @param scene - The Three.js scene.
 * @returns A TapRipplePool with play, update, and dispose methods.
 */
export function createTapRipples(scene: Scene): TapRipplePool {
  const ripples: Ripple[] = [];
  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
    const material = new SpriteMaterial({
      map: getRippleTexture(),
      color: new Color(1, 1, 1),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new Sprite(material);
    sprite.name = `fireflies_tap_ripple_${i}`;
    sprite.visible = false;
    sprite.raycast = () => {};
    scene.add(sprite);
    ripples.push({ sprite, material, age: 0, active: false });
  }

  return {
    play(position: Vector3, color: Color): void {
      // Reuse the oldest ripple when all four are busy — never drop a tap.
      let slot = ripples.find((r) => !r.active);
      if (!slot) {
        slot = ripples.reduce((a, b) => (a.age >= b.age ? a : b));
      }
      slot.active = true;
      slot.age = 0;
      slot.sprite.position.copy(position);
      slot.sprite.visible = true;
      slot.sprite.scale.setScalar(0.2);
      slot.material.color.copy(color);
      slot.material.opacity = 0.7;
    },

    update(deltaTime: number): void {
      for (const r of ripples) {
        if (!r.active) continue;
        r.age += deltaTime;
        const t = r.age / RIPPLE_DURATION;
        if (t >= 1) {
          r.active = false;
          r.sprite.visible = false;
          r.material.opacity = 0;
          continue;
        }
        // easeOutCubic expansion with a linear-ish fade — a soft "bloop".
        const eased = 1 - (1 - t) * (1 - t) * (1 - t);
        r.sprite.scale.setScalar(0.2 + eased * 1.15);
        r.material.opacity = 0.7 * (1 - t) * (1 - t);
      }
    },

    dispose(): void {
      for (const r of ripples) {
        r.sprite.removeFromParent();
        r.material.dispose();
      }
      ripples.length = 0;
    },
  };
}

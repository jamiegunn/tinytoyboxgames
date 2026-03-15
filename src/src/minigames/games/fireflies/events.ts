import { type Scene, Vector3, Sprite, SpriteMaterial, AdditiveBlending, CanvasTexture, Color } from 'three';
import { createSparkleBurst } from '@app/minigames/shared/particleFx';

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

export interface SurpriseEventController {
  update(deltaTime: number, tier: number): void;
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
          createSparkleBurst(scene, star.endPos.clone(), new Color(0.8, 0.85, 1.0), 8);
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

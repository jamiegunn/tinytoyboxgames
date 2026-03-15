import { type Scene, Sprite, SpriteMaterial, AdditiveBlending, CanvasTexture, Color, type Object3D } from 'three';

export interface TapHint {
  /** Call each frame. Tracks a target and animates. */
  update(deltaTime: number, target: Object3D | null): void;
  /** Call when the player catches their first firefly. */
  dismiss(): void;
  dispose(): void;
}

/** Cached concentric-ring "tap here" texture. */
let tapTexture: CanvasTexture | null = null;

function getTapTexture(): CanvasTexture {
  if (tapTexture) return tapTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cx, 50, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(cx, cx, 30, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center dot
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, 12);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cx, 12, 0, Math.PI * 2);
  ctx.fill();

  tapTexture = new CanvasTexture(canvas);
  return tapTexture;
}

/**
 * Creates a pulsing "tap here" indicator that follows a firefly.
 * Appears at game start, dismissed after first catch.
 * @param scene - The Three.js scene.
 * @returns A TapHint with update, dismiss, and dispose methods.
 */
export function createTapHint(scene: Scene): TapHint {
  const material = new SpriteMaterial({
    map: getTapTexture(),
    color: new Color(1, 0.9, 0.5),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  sprite.scale.setScalar(1.2);
  sprite.name = 'tap_hint';
  scene.add(sprite);

  let elapsed = 0;
  let dismissed = false;
  let fadeOut = false;
  let appearDelay = 1.5; // wait 1.5s before showing

  return {
    update(deltaTime: number, target: Object3D | null): void {
      if (dismissed && material.opacity <= 0) return;

      elapsed += deltaTime;

      // Delay before appearing
      if (appearDelay > 0) {
        appearDelay -= deltaTime;
        return;
      }

      if (fadeOut) {
        material.opacity = Math.max(0, material.opacity - deltaTime * 2);
        if (material.opacity <= 0) {
          sprite.visible = false;
          dismissed = true;
        }
        return;
      }

      // Fade in
      if (material.opacity < 0.7) {
        material.opacity = Math.min(0.7, material.opacity + deltaTime * 0.8);
      }

      // Pulse scale
      const pulse = 1.0 + 0.2 * Math.sin(elapsed * 3);
      sprite.scale.setScalar(1.2 * pulse);

      // Track target position (offset slightly above)
      if (target) {
        sprite.position.copy(target.position);
        sprite.position.y += 0.6;
      }
    },

    dismiss(): void {
      fadeOut = true;
    },

    dispose(): void {
      sprite.removeFromParent();
      material.dispose();
      dismissed = true;
    },
  };
}

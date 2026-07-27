import { type Scene, Sprite, SpriteMaterial, AdditiveBlending, CanvasTexture, Color, type Object3D } from 'three';

export interface TapHint {
  /**
   * Call each frame — including after {@link dismiss}, which only *starts* the
   * fade-out that this method plays out.
   */
  update(deltaTime: number, target: Object3D | null): void;
  /** Call when the player catches their first firefly. */
  dismiss(): void;
  dispose(): void;
}

/**
 * Billboard size of the hint in world units, before the pulse.
 *
 * The ring's luminance peak sits at 58% of the half-extent (see
 * {@link RING_STOPS}), so a 1.0-unit quad puts the ring at a world radius of
 * 0.29 — a diameter of 1.38x the firefly's own `FIREFLY_SPRITE_SCALE` = 0.42
 * glow halo, which is close enough to read as framing the creature.
 *
 * The `SPAWN` box spans 117 to 300 px per world unit for this camera, so the
 * ring is 68-174 px across depending on how near the firefly is. The previous
 * 1.2-unit quad put its outer stroke at texture radius 50 of 64, a world
 * diameter of 0.9375, i.e. 110-281 px, and the +-20% pulse took the near end to
 * 337 px — a quarter of the frame width, which is what the harness caught.
 */
const HINT_SCALE = 1.0;

/**
 * Soft annulus stops as `[fraction of the half-extent, alpha]`.
 *
 * The old texture stroked two hard-edged circles (`lineWidth` 3 and 2) which,
 * blown up to a quarter of the frame, read as wireframe debug overlay rather
 * than a glow. This is a single band with no discontinuity anywhere: alpha is
 * exactly 0 from the centre out to 0.34, rises to a 0.55 peak at 0.58 and
 * returns to exactly 0 at 0.82, leaving the outer 18% of the texture fully
 * transparent so the quad's own border can never show an edge.
 */
const RING_STOPS: readonly (readonly [number, number])[] = [
  [0.0, 0],
  [0.34, 0],
  [0.46, 0.16],
  [0.58, 0.55],
  [0.7, 0.16],
  [0.82, 0],
  [1.0, 0],
];

// Draws the soft ring into a fresh canvas texture. Owned by the returned hint
// (not module-cached) so `dispose` can release it — `disposeMeshDeep` does not
// touch textures, and a module-level cache would survive teardown forever.
function createTapTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  const ring = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [stop, alpha] of RING_STOPS) {
    ring.addColorStop(stop, `rgba(255, 252, 236, ${alpha})`);
  }
  ctx.fillStyle = ring;
  ctx.fillRect(0, 0, size, size);

  return new CanvasTexture(canvas);
}

/**
 * Creates a pulsing "tap here" halo that rides on a firefly.
 * Appears at game start, dismissed after first catch.
 *
 * It used to draw two hard-edged concentric strokes at texture radii 50 and 30
 * on a 1.2-unit sprite, offset 0.6 units above the firefly. A firefly near the
 * front of the play box sits at ~300 px per world unit, so the outer stroke
 * alone was a 281 px circle (337 px at the top of its +-20% pulse) with a 3 px
 * hard edge, floating 180 px above a 126 px creature: on a night sky that is
 * indistinguishable from a debug wireframe overlay. It is now a single soft
 * band, centred on the firefly, at 156-191 px — 1.38x the firefly's own glow
 * halo, so it reads as pointing at something.
 *
 * @param scene - The Three.js scene.
 * @returns A TapHint with update, dismiss, and dispose methods.
 */
export function createTapHint(scene: Scene): TapHint {
  const texture = createTapTexture();
  const material = new SpriteMaterial({
    map: texture,
    color: new Color(1, 0.9, 0.5),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  sprite.scale.setScalar(HINT_SCALE);
  sprite.name = 'tap_hint';
  // Decorative: it sits directly over the firefly it is pointing at, so without
  // this it would swallow the very tap it is asking for.
  sprite.raycast = () => {};
  sprite.renderOrder = 1;
  scene.add(sprite);

  let elapsed = 0;
  let dismissed = false;
  let fadeOut = false;
  let appearDelay = 1.5; // wait 1.5s before showing

  return {
    update(deltaTime: number, target: Object3D | null): void {
      if (dismissed) return;

      elapsed += deltaTime;

      // The fade-out is checked BEFORE the appear delay. `dismiss()` only raises
      // this flag; the fade itself happens here, so a child who catches their
      // first firefly inside the 1.5s appear delay used to leave `fadeOut` set
      // with `appearDelay` still counting down — the hint then popped in and
      // stayed forever. Handling it first also makes an early dismiss a no-op
      // fade that ends immediately (opacity is still 0).
      if (fadeOut) {
        material.opacity = Math.max(0, material.opacity - deltaTime * 2);
        if (material.opacity <= 0) {
          sprite.visible = false;
          dismissed = true;
        }
        return;
      }

      // Delay before appearing
      if (appearDelay > 0) {
        appearDelay -= deltaTime;
        return;
      }

      // Fade in
      if (material.opacity < 0.55) {
        material.opacity = Math.min(0.55, material.opacity + deltaTime * 0.8);
      }

      // Pulse scale: +-10%, so a near firefly's ring breathes between 156 and
      // 191 px rather than the +-20% that took the old one from 281 to 337 px.
      const pulse = 1.0 + 0.1 * Math.sin(elapsed * 3);
      sprite.scale.setScalar(HINT_SCALE * pulse);

      // Centred on the firefly, not above it. The old +0.6 offset was 1.4x the
      // firefly's whole glow halo, so the ring framed empty sky and read as an
      // unattached overlay instead of "tap this".
      if (target) {
        sprite.position.copy(target.position);
      }
    },

    dismiss(): void {
      fadeOut = true;
    },

    dispose(): void {
      sprite.removeFromParent();
      material.dispose();
      texture.dispose();
      dismissed = true;
    },
  };
}

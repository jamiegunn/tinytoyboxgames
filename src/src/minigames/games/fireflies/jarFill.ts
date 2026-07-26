import { type Scene, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, AdditiveBlending, CanvasTexture, type Vector3 } from 'three';
import { JAR_SCALE, FIREFLY_COLOR } from './types';

export interface JarFillIndicator {
  /** Update the displayed count (call when collectedCount changes). */
  setCount(count: number): void;
  /** Animate each frame. */
  update(deltaTime: number): void;
  dispose(): void;
}

/**
 * Hard cap on the dots drawn inside the jar.
 *
 * This is the whole point of this module. The live mechanic used to push one
 * unbounded additive `Sprite` per catch into a jar interior barely half a unit
 * across, so after a dozen catches the jar blew out into a featureless white
 * blob — the game's only progress indicator destroying itself exactly when a
 * child was doing well. A fixed-size buffer with `setDrawRange` can never do
 * that, and it draws the whole swarm in one call instead of N sprites.
 */
const MAX_JAR_DOTS = 30;

/** Jar interior in local (unscaled) jar units, from the LatheGeometry profile. */
const JAR_INNER_RADIUS = 0.55 * 0.72;
const JAR_INNER_FLOOR = 0.12;
const JAR_INNER_CEILING = 1.35;

/** Cached small glow texture for jar dots. */
let dotTexture: CanvasTexture | null = null;

function getDotTexture(): CanvasTexture {
  if (dotTexture) return dotTexture;
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  dotTexture = new CanvasTexture(canvas);
  return dotTexture;
}

/**
 * Creates a jar fill indicator that shows collected fireflies
 * as small glowing dots floating inside the jar.
 *
 * @param scene - The Three.js scene.
 * @param jarPos - The jar base position.
 * @returns A JarFillIndicator with setCount, update, and dispose methods.
 */
export function createJarFill(scene: Scene, jarPos: Vector3): JarFillIndicator {
  // Pre-generate random positions inside the jar volume. The jar mesh is drawn
  // at JAR_SCALE, so the profile radii have to be scaled too — unscaled values
  // here would scatter half the swarm outside the glass.
  const innerRadius = JAR_INNER_RADIUS * JAR_SCALE;
  const floorY = JAR_INNER_FLOOR * JAR_SCALE;
  const ceilingY = JAR_INNER_CEILING * JAR_SCALE;

  const positions = new Float32Array(MAX_JAR_DOTS * 3);
  // baseY is stored rather than recomputed from `phases` in update(): the old
  // code generated Y at random but re-derived it from the phase every frame, so
  // every dot teleported on the first animated frame.
  const baseY = new Float32Array(MAX_JAR_DOTS);
  const phases = new Float32Array(MAX_JAR_DOTS);
  for (let i = 0; i < MAX_JAR_DOTS; i++) {
    const angle = Math.random() * Math.PI * 2;
    // sqrt keeps the dots evenly spread through the disc instead of clumping
    // on the jar's axis, which is what makes a full jar still look like dots.
    const r = Math.sqrt(Math.random()) * innerRadius;
    baseY[i] = floorY + Math.random() * (ceilingY - floorY);
    positions[i * 3] = jarPos.x + Math.cos(angle) * r;
    positions[i * 3 + 1] = jarPos.y + baseY[i];
    positions[i * 3 + 2] = jarPos.z + Math.sin(angle) * r;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  // Start with 0 visible dots
  geometry.setDrawRange(0, 0);

  const material = new PointsMaterial({
    map: getDotTexture(),
    size: 0.075,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    color: FIREFLY_COLOR.clone(),
    sizeAttenuation: true,
  });

  const points = new Points(geometry, material);
  points.name = 'jar_fill_dots';
  // The jar glass is transparent and sorts unpredictably against dots at almost
  // the same depth; an explicit renderOrder keeps the swarm visible through it.
  points.renderOrder = 3;
  points.frustumCulled = false;
  scene.add(points);

  let currentCount = 0;
  let elapsed = 0;
  // Fresh arrivals flare briefly so a catch is visibly *added* to the jar.
  let arrivalFlash = 0;

  return {
    setCount(count: number): void {
      const next = Math.min(count, MAX_JAR_DOTS);
      if (next > currentCount) arrivalFlash = 1;
      currentCount = next;
      geometry.setDrawRange(0, currentCount);
    },

    update(deltaTime: number): void {
      if (currentCount === 0) return;
      elapsed += deltaTime;
      arrivalFlash = Math.max(0, arrivalFlash - deltaTime * 2.5);

      // Gently bob the dots up and down inside the jar
      const posAttr = geometry.getAttribute('position');
      for (let i = 0; i < currentCount; i++) {
        posAttr.setY(i, jarPos.y + baseY[i] + Math.sin(elapsed * 1.5 + phases[i]) * 0.03);
      }
      posAttr.needsUpdate = true;

      // Pulse opacity gently, plus the arrival flare
      material.opacity = Math.min(1, 0.6 + 0.18 * Math.sin(elapsed * 2) + 0.35 * arrivalFlash);
    },

    dispose(): void {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

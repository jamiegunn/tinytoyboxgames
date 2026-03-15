import { type Scene, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, AdditiveBlending, CanvasTexture, Color, Vector3 } from 'three';

export interface JarFillIndicator {
  /** Update the displayed count (call when collectedCount changes). */
  setCount(count: number): void;
  /** Animate each frame. */
  update(deltaTime: number): void;
  dispose(): void;
}

const MAX_JAR_DOTS = 30;

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
  // Pre-generate random positions inside the jar volume
  // Jar body is roughly a cylinder from y=0.1 to y=1.4, radius ~0.4
  const positions = new Float32Array(MAX_JAR_DOTS * 3);
  const phases = new Float32Array(MAX_JAR_DOTS);
  for (let i = 0; i < MAX_JAR_DOTS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.35;
    positions[i * 3] = jarPos.x + Math.cos(angle) * r;
    positions[i * 3 + 1] = jarPos.y + 0.15 + Math.random() * 1.15;
    positions[i * 3 + 2] = jarPos.z + Math.sin(angle) * r;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  // Start with 0 visible dots
  geometry.setDrawRange(0, 0);

  const material = new PointsMaterial({
    map: getDotTexture(),
    size: 0.08,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    color: new Color('#FFB347'),
    sizeAttenuation: true,
  });

  const points = new Points(geometry, material);
  points.name = 'jar_fill_dots';
  scene.add(points);

  let currentCount = 0;
  let elapsed = 0;

  return {
    setCount(count: number): void {
      currentCount = Math.min(count, MAX_JAR_DOTS);
      geometry.setDrawRange(0, currentCount);
    },

    update(deltaTime: number): void {
      if (currentCount === 0) return;
      elapsed += deltaTime;

      // Gently bob the dots up and down inside the jar
      const posAttr = geometry.getAttribute('position');
      for (let i = 0; i < currentCount; i++) {
        const baseY = 0.15 + (phases[i] / (Math.PI * 2)) * 1.15;
        posAttr.setY(i, jarPos.y + baseY + Math.sin(elapsed * 1.5 + phases[i]) * 0.04);
      }
      posAttr.needsUpdate = true;

      // Pulse opacity gently
      material.opacity = 0.6 + 0.2 * Math.sin(elapsed * 2);
    },

    dispose(): void {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

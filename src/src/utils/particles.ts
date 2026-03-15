import { Points, BufferGeometry, Float32BufferAttribute, PointsMaterial, Vector3, Color, AdditiveBlending, NormalBlending, type Scene } from 'three';
import { CanvasTexture } from 'three';

// ── Texture Cache ────────────────────────────────────────────────────────────

let cachedCircleTexture: CanvasTexture | null = null;

/**
 * Returns a cached 64x64 soft white circle CanvasTexture for particle systems.
 * Created once and reused globally.
 *
 * @returns A CanvasTexture containing a soft white circle with radial falloff.
 */
export function createParticleTexture(): CanvasTexture {
  if (cachedCircleTexture) return cachedCircleTexture;

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

  cachedCircleTexture = new CanvasTexture(canvas);
  return cachedCircleTexture;
}

// ── Particle State ───────────────────────────────────────────────────────────

interface Particle {
  position: Vector3;
  velocity: Vector3;
  color: Color;
  alpha: number;
  alphaDecay: number;
  size: number;
  age: number;
  lifetime: number;
  alive: boolean;
}

/**
 * Lightweight CPU-driven particle system built on Three.js Points.
 * Handles burst and continuous emission with gravity, velocity, and color interpolation.
 */
export class SimpleParticleSystem {
  readonly points: Points;
  private particles: Particle[] = [];
  private geometry: BufferGeometry;
  private capacity: number;
  private animationId: number | null = null;
  private lastTime = 0;
  private emitRate = 0;
  private emitAccumulator = 0;
  private stopped = false;
  private autoDispose = false;
  private gravity = new Vector3(0, 0, 0);
  private minLifeTime = 1;
  private maxLifeTime = 2;
  private minSize = 0.05;
  private maxSize = 0.1;
  private minEmitPower = 1;
  private maxEmitPower = 2;
  private direction1 = new Vector3(-1, 1, -1);
  private direction2 = new Vector3(1, 2, 1);
  private color1 = new Color(1, 1, 1);
  private alpha1 = 1;
  private color2 = new Color(1, 1, 1);
  private alpha2 = 1;
  private emitterPosition = new Vector3();

  constructor(capacity: number, blendMode: 'additive' | 'normal' = 'additive') {
    this.capacity = capacity;
    this.geometry = new BufferGeometry();

    const positions = new Float32Array(capacity * 3);
    const colors = new Float32Array(capacity * 4);
    const sizes = new Float32Array(capacity);
    this.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
    this.geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));

    const material = new PointsMaterial({
      map: createParticleTexture(),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: blendMode === 'additive' ? AdditiveBlending : NormalBlending,
      sizeAttenuation: true,
      size: 0.1,
    });

    this.points = new Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.raycast = () => {}; // Particles should never intercept raycaster picks
  }

  /**
   * Configures emission parameters.
   * @param opts - Partial emission configuration to apply
   */
  configure(opts: {
    gravity?: Vector3;
    minLifeTime?: number;
    maxLifeTime?: number;
    minSize?: number;
    maxSize?: number;
    minEmitPower?: number;
    maxEmitPower?: number;
    direction1?: Vector3;
    direction2?: Vector3;
    color1?: Color;
    alpha1?: number;
    color2?: Color;
    alpha2?: number;
    emitRate?: number;
    emitterPosition?: Vector3;
  }): void {
    if (opts.gravity) this.gravity.copy(opts.gravity);
    if (opts.minLifeTime !== undefined) this.minLifeTime = opts.minLifeTime;
    if (opts.maxLifeTime !== undefined) this.maxLifeTime = opts.maxLifeTime;
    if (opts.minSize !== undefined) this.minSize = opts.minSize;
    if (opts.maxSize !== undefined) this.maxSize = opts.maxSize;
    if (opts.minEmitPower !== undefined) this.minEmitPower = opts.minEmitPower;
    if (opts.maxEmitPower !== undefined) this.maxEmitPower = opts.maxEmitPower;
    if (opts.direction1) this.direction1.copy(opts.direction1);
    if (opts.direction2) this.direction2.copy(opts.direction2);
    if (opts.color1) this.color1.copy(opts.color1);
    if (opts.alpha1 !== undefined) this.alpha1 = opts.alpha1;
    if (opts.color2) this.color2.copy(opts.color2);
    if (opts.alpha2 !== undefined) this.alpha2 = opts.alpha2;
    if (opts.emitRate !== undefined) this.emitRate = opts.emitRate;
    if (opts.emitterPosition) this.emitterPosition.copy(opts.emitterPosition);
  }

  /**
   * Emits a specific number of particles immediately.
   * @param count - Number of particles to emit
   */
  burst(count: number): void {
    for (let i = 0; i < count; i++) {
      this.emitOne();
    }
  }

  /**
   * Starts the animation loop.
   * @param scene - The Three.js scene to add particles to
   * @param autoDispose - Whether to auto-dispose when all particles expire
   */
  start(scene: Scene, autoDispose = false): void {
    this.autoDispose = autoDispose;
    this.stopped = false;
    scene.add(this.points);
    this.lastTime = performance.now();
    this.tick();
  }

  /** Stops emitting but lets existing particles finish. */
  stop(): void {
    this.stopped = true;
    this.emitRate = 0;
  }

  /** Immediately removes and cleans up. */
  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.points.removeFromParent();
    this.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
  }

  private emitOne(): void {
    if (this.particles.length >= this.capacity) {
      // Reuse a dead particle
      const dead = this.particles.find((p) => !p.alive);
      if (dead) {
        this.initParticle(dead);
        return;
      }
      return;
    }
    const p: Particle = {
      position: new Vector3(),
      velocity: new Vector3(),
      color: new Color(),
      alpha: 1,
      alphaDecay: 0,
      size: 0,
      age: 0,
      lifetime: 0,
      alive: true,
    };
    this.initParticle(p);
    this.particles.push(p);
  }

  private initParticle(p: Particle): void {
    p.position.copy(this.emitterPosition);
    p.alive = true;
    p.age = 0;
    p.lifetime = lerp(this.minLifeTime, this.maxLifeTime, Math.random());
    p.size = lerp(this.minSize, this.maxSize, Math.random());

    const power = lerp(this.minEmitPower, this.maxEmitPower, Math.random());
    p.velocity.set(
      lerp(this.direction1.x, this.direction2.x, Math.random()),
      lerp(this.direction1.y, this.direction2.y, Math.random()),
      lerp(this.direction1.z, this.direction2.z, Math.random()),
    );
    p.velocity.normalize().multiplyScalar(power);

    const t = Math.random();
    p.color.copy(this.color1).lerp(this.color2, t);
    p.alpha = lerp(this.alpha1, this.alpha2, t);
    p.alphaDecay = p.alpha / p.lifetime;
  }

  private tick = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Continuous emission
    if (!this.stopped && this.emitRate > 0) {
      this.emitAccumulator += this.emitRate * dt;
      while (this.emitAccumulator >= 1) {
        this.emitOne();
        this.emitAccumulator -= 1;
      }
    }

    // Update particles
    let aliveCount = 0;
    const posAttr = this.geometry.getAttribute('position') as Float32BufferAttribute;
    const colAttr = this.geometry.getAttribute('color') as Float32BufferAttribute;
    const sizeAttr = this.geometry.getAttribute('size') as Float32BufferAttribute;

    for (const p of this.particles) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.lifetime) {
        p.alive = false;
        continue;
      }
      aliveCount++;

      // Physics
      p.velocity.x += this.gravity.x * dt;
      p.velocity.y += this.gravity.y * dt;
      p.velocity.z += this.gravity.z * dt;
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;

      // Fade
      p.alpha = Math.max(0, p.alpha - p.alphaDecay * dt);
    }

    // Write alive particles into buffer
    let idx = 0;
    for (const p of this.particles) {
      if (!p.alive) continue;
      posAttr.setXYZ(idx, p.position.x, p.position.y, p.position.z);
      colAttr.setXYZW(idx, p.color.r, p.color.g, p.color.b, p.alpha);
      sizeAttr.setX(idx, p.size);
      idx++;
    }
    // Only draw alive particles — no remnants from dead slots
    this.geometry.setDrawRange(0, idx);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    // Auto-dispose when all particles dead and stopped
    if (this.autoDispose && this.stopped && aliveCount === 0) {
      this.dispose();
      return;
    }

    this.animationId = requestAnimationFrame(this.tick);
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Convenience Functions ────────────────────────────────────────────────────

/**
 * Emits a one-shot burst of golden sparkle particles at the given origin.
 * The particle system auto-disposes after the burst completes.
 *
 * @param scene - The Three.js scene to add the particles to.
 * @param origin - World-space position where the burst originates.
 */
export function createSparkleBurst(scene: Scene, origin: Vector3): void {
  const ps = new SimpleParticleSystem(50, 'additive');
  ps.configure({
    emitterPosition: origin,
    minLifeTime: 0.3,
    maxLifeTime: 0.8,
    minSize: 0.03,
    maxSize: 0.08,
    color1: new Color(1, 0.95, 0.5),
    alpha1: 1,
    color2: new Color(1, 0.8, 0.3),
    alpha2: 0.8,
    gravity: new Vector3(0, -1, 0),
    direction1: new Vector3(-1.5, 2, -1.5),
    direction2: new Vector3(1.5, 3, 1.5),
    minEmitPower: 1,
    maxEmitPower: 2.5,
  });
  ps.burst(40);
  ps.stop();
  ps.start(scene, true);
}

/**
 * Emits a small puff of brown dust particles at the given origin.
 * The particle system auto-disposes after the puff completes.
 *
 * @param scene - The Three.js scene to add the particles to.
 * @param origin - World-space position where the puff originates.
 */
export function createDustPuff(scene: Scene, origin: Vector3): void {
  const ps = new SimpleParticleSystem(15, 'normal');
  ps.configure({
    emitterPosition: origin,
    minLifeTime: 0.3,
    maxLifeTime: 0.6,
    minSize: 0.04,
    maxSize: 0.1,
    color1: new Color(0.6, 0.55, 0.4),
    alpha1: 0.4,
    color2: new Color(0.5, 0.45, 0.35),
    alpha2: 0.25,
    gravity: new Vector3(0, 0.3, 0),
    direction1: new Vector3(-0.5, 0.5, -0.5),
    direction2: new Vector3(0.5, 1, 0.5),
    minEmitPower: 0.3,
    maxEmitPower: 0.6,
  });
  ps.burst(12);
  ps.stop();
  ps.start(scene, true);
}

/**
 * Creates a continuous ambient dust mote particle system.
 * The caller is responsible for calling dispose() on the returned system.
 *
 * @param scene - The Three.js scene to add the particles to.
 * @returns The running SimpleParticleSystem instance (caller must dispose).
 */
export function createDustMotes(scene: Scene): SimpleParticleSystem {
  const ps = new SimpleParticleSystem(30, 'additive');
  ps.configure({
    emitRate: 5,
    minLifeTime: 4,
    maxLifeTime: 8,
    minSize: 0.02,
    maxSize: 0.06,
    color1: new Color(1, 0.95, 0.8),
    alpha1: 0.3,
    color2: new Color(1, 0.9, 0.75),
    alpha2: 0.15,
    gravity: new Vector3(0, -0.02, 0),
    direction1: new Vector3(-0.05, -0.01, -0.05),
    direction2: new Vector3(0.05, 0.01, 0.05),
    minEmitPower: 0.01,
    maxEmitPower: 0.03,
  });
  ps.start(scene);
  return ps;
}

/**
 * Emits a one-shot burst of multi-colored confetti particles at the given origin.
 * The particle system auto-disposes after the shower completes.
 *
 * @param scene - The Three.js scene to add the particles to.
 * @param origin - World-space position where the confetti shower originates.
 */
export function createConfettiShower(scene: Scene, origin: Vector3): void {
  const ps = new SimpleParticleSystem(60, 'normal');
  ps.configure({
    emitterPosition: origin,
    minLifeTime: 0.8,
    maxLifeTime: 1.5,
    minSize: 0.03,
    maxSize: 0.07,
    color1: new Color(1, 0.3, 0.4),
    alpha1: 1,
    color2: new Color(0.3, 0.8, 1),
    alpha2: 1,
    gravity: new Vector3(0, -2, 0),
    direction1: new Vector3(-2, 3, -2),
    direction2: new Vector3(2, 5, 2),
    minEmitPower: 1.5,
    maxEmitPower: 3,
  });
  ps.burst(50);
  ps.stop();
  ps.start(scene, true);
}

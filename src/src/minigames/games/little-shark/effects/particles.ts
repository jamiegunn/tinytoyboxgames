import { Color, Vector3, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Mesh, type Scene, type Object3D } from 'three';

// ---------------------------------------------------------------------------
// Return type interfaces
// ---------------------------------------------------------------------------

/** Handle for a bubble trail effect that drifts and self-disposes. */
export interface BubbleTrail {
  /** Advance the trail by `dt` seconds. Returns false when all bubbles have expired. */
  update(dt: number): boolean;
  /** Immediately remove all bubble meshes from the scene. */
  dispose(): void;
}

/** Handle for a persistent golden shimmer aura around a mesh. */
export interface GoldenShimmer {
  /** Advance the shimmer animation by `dt` seconds. */
  update(dt: number): void;
  /** Immediately remove all shimmer meshes from the scene. */
  dispose(): void;
}

/** Handle for a caustic light ray that fades in and out. */
export interface CausticRay {
  /** Advance the ray animation by `dt` seconds. Returns false when fully faded out. */
  update(dt: number): boolean;
  /** Immediately remove the ray mesh from the scene. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a random float between min (inclusive) and max (exclusive).
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (exclusive).
 * @returns A random float in [min, max).
 */
function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Returns a small random offset vector for variance.
 * @param spread - Maximum spread magnitude per axis.
 * @returns A Vector3 with small random offsets.
 */
function randomOffset(spread: number): Vector3 {
  return new Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
}

// Shared geometries (created once, reused across all effects)
let _bubbleGeo: SphereGeometry | null = null;
let _sparkleGeo: SphereGeometry | null = null;
let _causticGeo: CylinderGeometry | null = null;

function getBubbleGeometry(): SphereGeometry {
  if (!_bubbleGeo) _bubbleGeo = new SphereGeometry(1, 8, 6);
  return _bubbleGeo;
}

function getSparkleGeometry(): SphereGeometry {
  if (!_sparkleGeo) _sparkleGeo = new SphereGeometry(1, 6, 4);
  return _sparkleGeo;
}

function getCausticGeometry(): CylinderGeometry {
  if (!_causticGeo) _causticGeo = new CylinderGeometry(1, 1, 1, 8, 1, true);
  return _causticGeo;
}

// ---------------------------------------------------------------------------
// 1. Bubble trail
// ---------------------------------------------------------------------------

interface BubbleParticle {
  mesh: Mesh;
  velocity: Vector3;
  wobblePhase: number;
  wobbleSpeed: number;
  age: number;
  lifespan: number;
  baseScale: number;
  alive: boolean;
}

/**
 * Creates a trail of translucent bubbles that drift in a direction, wobble, grow, and pop.
 *
 * Spawns 8-12 small sphere meshes at `startPos` that drift along `direction` with random
 * offsets. Each bubble rises, wobbles side to side, slowly grows, then self-removes.
 *
 * @param scene - The Three.js scene to add bubbles to.
 * @param startPos - World-space starting position for the trail.
 * @param direction - Primary drift direction for the bubbles.
 * @param color - Optional tint color; defaults to translucent white-blue.
 * @returns A BubbleTrail handle with `update(dt)` and `dispose()` methods.
 */
export function createBubbleTrail(scene: Scene, startPos: Vector3, direction: Vector3, color?: Color): BubbleTrail {
  const bubbleColor = color ?? new Color(0.8, 0.9, 1.0);
  const count = Math.floor(randRange(8, 13));
  const geo = getBubbleGeometry();
  const bubbles: BubbleParticle[] = [];

  for (let i = 0; i < count; i++) {
    const radius = randRange(0.02, 0.06);
    const mat = new MeshStandardMaterial({
      color: bubbleColor,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(startPos).add(randomOffset(0.05));
    mesh.scale.setScalar(radius);

    const vel = direction.clone().normalize().multiplyScalar(randRange(0.3, 0.8));
    vel.add(randomOffset(0.2));
    // Ensure bubbles rise
    vel.y = Math.abs(vel.y) + randRange(0.2, 0.5);

    scene.add(mesh);

    bubbles.push({
      mesh,
      velocity: vel,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: randRange(3, 6),
      age: 0,
      lifespan: randRange(1.0, 2.0),
      baseScale: radius,
      alive: true,
    });
  }

  let disposed = false;

  function disposeBubble(b: BubbleParticle): void {
    b.alive = false;
    scene.remove(b.mesh);
    (b.mesh.material as MeshStandardMaterial).dispose();
  }

  return {
    update(dt: number): boolean {
      if (disposed) return false;

      let anyAlive = false;
      for (const b of bubbles) {
        if (!b.alive) continue;

        b.age += dt;
        if (b.age >= b.lifespan) {
          disposeBubble(b);
          continue;
        }

        anyAlive = true;
        const t = b.age / b.lifespan;

        // Move along velocity
        b.mesh.position.addScaledVector(b.velocity, dt);

        // Wobble side to side
        const wobble = Math.sin(b.wobblePhase + b.age * b.wobbleSpeed) * 0.02;
        b.mesh.position.x += wobble;

        // Grow then shrink near end (pop)
        const growCurve = t < 0.7 ? 1.0 + t * 0.5 : 1.35 * (1.0 - (t - 0.7) / 0.3);
        b.mesh.scale.setScalar(b.baseScale * Math.max(growCurve, 0));

        // Fade out near end
        (b.mesh.material as MeshStandardMaterial).opacity = 0.6 * (1.0 - t * t);
      }

      if (!anyAlive) {
        disposed = true;
      }

      return anyAlive;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const b of bubbles) {
        if (b.alive) disposeBubble(b);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Catch explosion
// ---------------------------------------------------------------------------

interface ExplosionParticle {
  mesh: Mesh;
  velocity: Vector3;
  age: number;
  lifespan: number;
  isBubble: boolean;
  alive: boolean;
}

/**
 * Creates a burst of particles when a fish is caught, scaling with combo level.
 *
 * Emits a mix of color-matched sparkles (70%) and white rising bubbles (30%).
 * More particles spawn at higher combo levels. Self-cleans after all particles expire.
 *
 * @param scene - The Three.js scene to add particles to.
 * @param pos - World-space position of the catch.
 * @param fishColor - Color of the caught fish, used for sparkle tinting.
 * @param comboLevel - Current combo multiplier; increases particle count.
 */
export function createCatchExplosion(scene: Scene, pos: Vector3, fishColor: Color, comboLevel: number): void {
  const baseCount = 15;
  const count = Math.min(baseCount + comboLevel * 5, 40);
  const bubbleCount = Math.floor(count * 0.3);
  const sparkleCount = count - bubbleCount;
  const geo = getSparkleGeometry();
  const particles: ExplosionParticle[] = [];
  const gravity = new Vector3(0, -2.0, 0);
  const drag = 0.97;

  // Sparkle particles (70%)
  for (let i = 0; i < sparkleCount; i++) {
    const mat = new MeshStandardMaterial({
      color: fishColor,
      emissive: fishColor,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(pos);
    const scale = randRange(0.01, 0.03);
    mesh.scale.setScalar(scale);

    const vel = new Vector3((Math.random() - 0.5) * 4, randRange(1, 4), (Math.random() - 0.5) * 4);

    scene.add(mesh);
    particles.push({
      mesh,
      velocity: vel,
      age: 0,
      lifespan: randRange(0.5, 1.0),
      isBubble: false,
      alive: true,
    });
  }

  // Bubble particles (30%)
  for (let i = 0; i < bubbleCount; i++) {
    const mat = new MeshStandardMaterial({
      color: new Color(0.9, 0.95, 1.0),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(pos);
    const scale = randRange(0.015, 0.035);
    mesh.scale.setScalar(scale);

    const vel = new Vector3((Math.random() - 0.5) * 1.5, randRange(1.5, 3.5), (Math.random() - 0.5) * 1.5);

    scene.add(mesh);
    particles.push({
      mesh,
      velocity: vel,
      age: 0,
      lifespan: randRange(0.5, 1.0),
      isBubble: true,
      alive: true,
    });
  }

  // Self-updating animation via requestAnimationFrame
  let lastTime = performance.now();

  function tick(): void {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    let anyAlive = false;

    for (const p of particles) {
      if (!p.alive) continue;

      p.age += dt;
      if (p.age >= p.lifespan) {
        p.alive = false;
        scene.remove(p.mesh);
        (p.mesh.material as MeshStandardMaterial).dispose();
        continue;
      }

      anyAlive = true;
      const t = p.age / p.lifespan;

      // Apply gravity to sparkles, slight upward bias for bubbles
      if (!p.isBubble) {
        p.velocity.addScaledVector(gravity, dt);
      }
      p.velocity.multiplyScalar(drag);
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Fade out
      (p.mesh.material as MeshStandardMaterial).opacity = (1.0 - t) * (p.isBubble ? 0.7 : 1.0);
    }

    if (anyAlive) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// 3. Golden shimmer
// ---------------------------------------------------------------------------

/**
 * Creates a persistent golden sparkle aura that orbits around a target mesh.
 *
 * Six tiny emissive gold spheres orbit the target in a ring with gentle scale pulsing.
 * The effect persists until `dispose()` is called.
 *
 * @param scene - The Three.js scene to add shimmer meshes to.
 * @param targetRoot - The Object3D to surround with the shimmer aura.
 * @returns A GoldenShimmer handle with `update(dt)` and `dispose()` methods.
 */
export function createGoldenShimmer(scene: Scene, targetRoot: Object3D): GoldenShimmer {
  const orbitCount = 6;
  const orbitRadius = 0.25;
  const baseScale = 0.015;
  const geo = getSparkleGeometry();
  const goldColor = new Color(1.0, 0.85, 0.2);

  const orbiters: { mesh: Mesh; phaseOffset: number }[] = [];
  let elapsed = 0;
  let disposed = false;

  for (let i = 0; i < orbitCount; i++) {
    const mat = new MeshStandardMaterial({
      color: goldColor,
      emissive: goldColor,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new Mesh(geo, mat);
    mesh.scale.setScalar(baseScale);
    scene.add(mesh);

    orbiters.push({
      mesh,
      phaseOffset: (i / orbitCount) * Math.PI * 2,
    });
  }

  return {
    update(dt: number): void {
      if (disposed) return;

      elapsed += dt;
      const rotSpeed = 1.2; // radians per second
      const targetPos = targetRoot.position;

      for (const orb of orbiters) {
        const angle = elapsed * rotSpeed + orb.phaseOffset;
        orb.mesh.position.set(
          targetPos.x + Math.cos(angle) * orbitRadius,
          targetPos.y + Math.sin(elapsed * 2.0 + orb.phaseOffset) * 0.05,
          targetPos.z + Math.sin(angle) * orbitRadius,
        );

        // Gentle scale pulsing
        const pulse = 1.0 + Math.sin(elapsed * 3.0 + orb.phaseOffset) * 0.3;
        orb.mesh.scale.setScalar(baseScale * pulse);
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const orb of orbiters) {
        scene.remove(orb.mesh);
        (orb.mesh.material as MeshStandardMaterial).dispose();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Caustic ray
// ---------------------------------------------------------------------------

/**
 * Creates a vertical light shaft simulating sunlight filtering through water.
 *
 * A tall translucent cylinder fades in over 1s, holds for 1s, then fades out over 1s
 * (3s total). Gently sways side to side. Self-disposes when the animation completes.
 *
 * @param scene - The Three.js scene to add the ray to.
 * @param x - World-space X position for the ray.
 * @param z - World-space Z position for the ray.
 * @returns A CausticRay handle with `update(dt)` and `dispose()` methods.
 */
export function createCausticRay(scene: Scene, x: number, z: number): CausticRay {
  const height = 4.0;
  const radius = 0.08;
  const totalLife = 3.0;
  const fadeInEnd = 1.0;
  const fadeOutStart = 2.0;
  const maxOpacity = 0.15;

  const geo = getCausticGeometry();
  const mat = new MeshStandardMaterial({
    color: new Color(0.85, 0.92, 1.0),
    emissive: new Color(0.85, 0.92, 1.0),
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: 2, // DoubleSide
  });

  const mesh = new Mesh(geo, mat);
  mesh.scale.set(radius, height, radius);
  mesh.position.set(x, height * 0.5, z);
  scene.add(mesh);

  let elapsed = 0;
  let disposed = false;
  const swayPhase = Math.random() * Math.PI * 2;

  return {
    update(dt: number): boolean {
      if (disposed) return false;

      elapsed += dt;
      if (elapsed >= totalLife) {
        this.dispose();
        return false;
      }

      // Opacity envelope: fade in, hold, fade out
      let opacity: number;
      if (elapsed < fadeInEnd) {
        opacity = (elapsed / fadeInEnd) * maxOpacity;
      } else if (elapsed < fadeOutStart) {
        opacity = maxOpacity;
      } else {
        opacity = maxOpacity * (1.0 - (elapsed - fadeOutStart) / (totalLife - fadeOutStart));
      }
      mat.opacity = Math.max(opacity, 0);

      // Gentle sway
      const sway = Math.sin(swayPhase + elapsed * 1.5) * 0.04;
      mesh.position.x = x + sway;

      return true;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      scene.remove(mesh);
      mat.dispose();
    },
  };
}

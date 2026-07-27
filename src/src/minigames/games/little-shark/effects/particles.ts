import { Color, Vector3, SphereGeometry, MeshStandardMaterial, Mesh, type Scene } from 'three';
import { getSceneClock, getSceneDisposal } from '@app/utils/sceneRuntime';

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

// Marks a particle mesh as decoration the tap ray must ignore.
//
// Every effect in this file adds its meshes straight to the scene, and
// InputDispatcher.performPick raycasts `scene.children` recursively. With ~48
// live trail bubbles hugging the shark plus up to 40 burst particles, a tap
// aimed just past the shark's nose regularly hit a two-pixel bubble first;
// `pickedPoint` then came back at the bubble instead of the seabed and the
// shark steered half a unit short of where the child pointed. Particles are
// decoration and carry no handler, so they are excluded from picking entirely.
function makeUnpickable(mesh: Mesh): void {
  mesh.raycast = () => {};
}

// Shared geometries (created once, reused across all effects)
let _bubbleGeo: SphereGeometry | null = null;
let _sparkleGeo: SphereGeometry | null = null;

function getBubbleGeometry(): SphereGeometry {
  if (!_bubbleGeo) _bubbleGeo = new SphereGeometry(1, 8, 6);
  return _bubbleGeo;
}

function getSparkleGeometry(): SphereGeometry {
  if (!_sparkleGeo) _sparkleGeo = new SphereGeometry(1, 6, 4);
  return _sparkleGeo;
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

  // One material for the whole trail, not one per bubble.
  //
  // index.ts spawns a trail behind the shark at `Math.random() < dt * 3`, i.e.
  // three per second while it is moving, and each trail held 8-12 bubbles for
  // 1-2 seconds. That was ~30 MeshStandardMaterial allocations and ~30 disposals
  // *per second*, and every disposal makes WebGLRenderer tear down the program
  // and uniform state it had just built. Measured in the scene probe: about 48
  // live trail bubbles at any moment, carrying 48 distinct materials, each one
  // drawing a sphere roughly two pixels across.
  //
  // The trade is that the bubbles of a single trail now fade together rather
  // than each on its own lifespan. They are two pixels wide and spawn within
  // 0.05 units of each other, and the per-bubble grow/pop curve below still runs
  // independently, so the shared fade is not something a child can see.
  const trailMaterial = new MeshStandardMaterial({
    color: bubbleColor,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });

  for (let i = 0; i < count; i++) {
    const radius = randRange(0.02, 0.06);
    const mesh = new Mesh(geo, trailMaterial);
    mesh.position.copy(startPos).add(randomOffset(0.05));
    mesh.scale.setScalar(radius);

    const vel = direction.clone().normalize().multiplyScalar(randRange(0.3, 0.8));
    vel.add(randomOffset(0.2));
    // Ensure bubbles rise
    vel.y = Math.abs(vel.y) + randRange(0.2, 0.5);

    makeUnpickable(mesh);
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

  // The material is shared, so it is disposed once when the trail ends rather
  // than by whichever bubble happens to pop first.
  function disposeBubble(b: BubbleParticle): void {
    b.alive = false;
    scene.remove(b.mesh);
  }

  return {
    update(dt: number): boolean {
      if (disposed) return false;

      let fade = 0;
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

        // Fade out near end. Tracked as the strongest surviving bubble so the
        // shared material follows the trail rather than any one bubble.
        fade = Math.max(fade, 1.0 - t * t);
      }

      trailMaterial.opacity = 0.6 * fade;

      if (!anyAlive) {
        disposed = true;
        trailMaterial.dispose();
      }

      return anyAlive;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const b of bubbles) {
        if (b.alive) disposeBubble(b);
      }
      trailMaterial.dispose();
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

  // Two materials for the whole burst, not one per particle. Same reasoning as
  // createBubbleTrail above: a burst is up to 40 particles, every one of which
  // used to allocate and then dispose its own MeshStandardMaterial, and a
  // combo-happy child sets one off every second or so. All the sparkles share a
  // colour and all the bubbles share a colour, so nothing about the burst needs
  // per-particle material state — only the fade did, and every particle in a
  // burst starts at the same instant with a lifespan drawn from the same
  // half-second window.
  const sparkleMaterial = new MeshStandardMaterial({
    color: fishColor,
    emissive: fishColor,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const bubbleMaterial = new MeshStandardMaterial({
    color: new Color(0.9, 0.95, 1.0),
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });

  // Sparkle particles (70%)
  for (let i = 0; i < sparkleCount; i++) {
    const mesh = new Mesh(geo, sparkleMaterial);
    mesh.position.copy(pos);
    const scale = randRange(0.01, 0.03);
    mesh.scale.setScalar(scale);

    const vel = new Vector3((Math.random() - 0.5) * 4, randRange(1, 4), (Math.random() - 0.5) * 4);

    makeUnpickable(mesh);
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
    const mesh = new Mesh(geo, bubbleMaterial);
    mesh.position.copy(pos);
    const scale = randRange(0.015, 0.035);
    mesh.scale.setScalar(scale);

    const vel = new Vector3((Math.random() - 0.5) * 1.5, randRange(1.5, 3.5), (Math.random() - 0.5) * 1.5);

    makeUnpickable(mesh);
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

  // Retires one particle. It must NOT touch the material: the material is shared
  // by the whole burst, and the first particle to reach its lifespan would
  // otherwise dispose the material the other 39 are still being drawn with.
  const kill = (p: ExplosionParticle): void => {
    p.alive = false;
    scene.remove(p.mesh);
  };

  // The two shared materials are disposed exactly once, whichever comes first:
  // the burst finishing naturally, or the scene tearing down mid-burst.
  let materialsDisposed = false;
  const disposeMaterials = (): void => {
    if (materialsDisposed) return;
    materialsDisposed = true;
    sparkleMaterial.dispose();
    bubbleMaterial.dispose();
  };

  // Driven by the scene's shared FrameClock (no private rAF), and killed on
  // scene teardown so a burst can never touch removed objects.
  // See architecture-standards.md#frameclock.
  const clock = getSceneClock(scene);
  const scope = getSceneDisposal(scene);
  if (!clock || !scope) {
    // No scene runtime (should not happen inside a mini-game) — fail safe by
    // disposing immediately rather than leaking undriven meshes.
    for (const p of particles) kill(p);
    disposeMaterials();
    return;
  }

  let unsubscribe = (): void => {};
  const step = (dt: number): void => {
    let anyAlive = false;
    // Fade is now per material rather than per particle, tracked as the maximum
    // remaining life across that material's live particles. Every particle in a
    // burst is spawned on the same frame with a lifespan drawn from the same
    // 0.5-1.0s window, so the spread between the brightest and dimmest particle
    // is at most the spread in lifespans; taking the max means the burst holds
    // its brightness until its longest-lived member starts to go, and dead
    // particles are removed from the scene anyway so they cannot show it.
    let sparkleFade = 0;
    let bubbleFade = 0;
    for (const p of particles) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.lifespan) {
        kill(p);
        continue;
      }
      anyAlive = true;
      const t = p.age / p.lifespan;
      if (!p.isBubble) p.velocity.addScaledVector(gravity, dt);
      p.velocity.multiplyScalar(drag);
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.isBubble) bubbleFade = Math.max(bubbleFade, 1.0 - t);
      else sparkleFade = Math.max(sparkleFade, 1.0 - t);
    }
    sparkleMaterial.opacity = sparkleFade;
    bubbleMaterial.opacity = 0.7 * bubbleFade;
    if (!anyAlive) {
      disposeMaterials();
      unsubscribe();
    }
  };

  unsubscribe = clock.subscribe(step);
  // On teardown mid-burst: dispose any still-alive particles, then unsubscribe.
  scope.add(() => {
    for (const p of particles) {
      if (p.alive) kill(p);
    }
    disposeMaterials();
    unsubscribe();
  });
}

// ---------------------------------------------------------------------------
// NOT HERE, DELIBERATELY: createGoldenShimmer and createCausticRay
// ---------------------------------------------------------------------------
//
// This file used to also export two effect factories, each with a full handle
// interface, JSDoc, pooled geometry and a working dispose path:
//
//   createGoldenShimmer(scene, targetRoot)  six orbiting emissive gold spheres
//   createCausticRay(scene, x, z)           a 3 s fade-in/hold/fade-out shaft
//
// Nothing in the game constructed either one. They were not merely unused —
// their documentation asserted behaviour the reef does not have. The shimmer's
// docstring said the aura "persists until dispose() is called", which reads to
// anyone auditing the golden fish as a description of what is on screen right
// now. It is not: the golden fish is distinguished by GOLDEN_COLOR and
// GOLDEN_SCALE alone (fish/lifecycle.ts:191,207), and there is no orbiting
// sparkle ring anywhere in the build.
//
// Both effects also already have live replacements that work differently, so
// wiring these in would have been a duplicate, not a completion:
//
//   caustics  ->  buildCausticLights (environment/scenery.ts:410), four moving
//                 PointLights plus floor patches, driven by updateCausticLights,
//                 with the god-ray planes billboarded each frame by
//                 updateGodRays (environment/effects.ts:63). Their brightnesses
//                 were derived against the fog and the sand in scenery.ts:73-79.
//                 A translucent cylinder dropped in beside that rig would be a
//                 second, uncalibrated light shaft.
//   shimmer   ->  the golden fish's own colour and scale, chosen by the
//                 CIEDE2000 separation work recorded in types.ts. Six emissive
//                 spheres orbiting at radius 0.25 sit inside the fish's own
//                 silhouette at GOLDEN_SCALE 1.4 and would blur the one shape
//                 that palette work exists to keep distinct.
//
// Deleted rather than connected. The GoldenShimmer and CausticRay handle
// interfaces, getCausticGeometry, the _causticGeo cache and the CylinderGeometry
// import went with them; getSparkleGeometry stayed because createCatchExplosion
// still uses it.

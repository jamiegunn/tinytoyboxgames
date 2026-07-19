/**
 * ParticleEngine — one engine per scene, driven by that scene's FrameClock and
 * torn down by its DisposalScope.
 *
 * See architecture-standards.md#particleengine. Replaces the three legacy
 * modules (`utils/particles.ts`, `utils/particleFactory.ts`,
 * `minigames/shared/particleFx.ts`), each of which ran its own
 * `requestAnimationFrame` loop and uploaded its own duplicate point texture.
 *
 * Design:
 * - Effects are **data** ({@link ParticlePreset}); the engine owns the GPU
 *   objects. A preset maps to exactly one *batch* (one `Points`, one geometry,
 *   one material) created lazily on first use and pooled. Per-particle colour
 *   is a vertex attribute, so a single batch serves every colour variation of
 *   an effect.
 * - Sizing: standard `PointsMaterial` ignores a per-vertex size attribute — it
 *   only honours the uniform `material.size` (the legacy systems all rendered
 *   at the class default 0.1, so their configured size ranges were dead). The
 *   engine therefore gives each preset its own material sized from
 *   `preset.size`, uniform within a preset (as legacy was uniform), which
 *   finally realises the intended per-effect sizing without a custom shader.
 * - The engine subscribes exactly one callback to the FrameClock; there are no
 *   self-driven rAF loops. Everything is released on `scope.dispose()`.
 */

import {
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  Vector3,
  Quaternion,
  Color,
  AdditiveBlending,
  NormalBlending,
  DynamicDrawUsage,
  type Scene,
  type Object3D,
} from 'three';
import type { FrameClock } from '@app/utils/frameClock';
import type { DisposalScope } from '@app/utils/disposal';
import { randomRange } from '@app/utils/math';
import { getParticleTexture, type ParticleTextureKind } from './texture';

const UP = new Vector3(0, 1, 0);

/**
 * A data description of a particle effect. Presets are the single source of
 * truth for how an effect looks; the engine turns them into GPU work.
 */
export interface ParticlePreset {
  /** Sprite shape. Shared, deduped texture (see texture.ts). */
  texture: ParticleTextureKind;
  /** Blend mode: 'additive' for glows/sparkles, 'normal' for opaque flecks. */
  blending: 'additive' | 'normal';
  /** Default burst size (a fixed count, or an inclusive `[min, max]` range). */
  count: number | [min: number, max: number];
  /** Pool capacity — the max particles this preset can have alive at once. */
  capacity: number;
  /** Per-particle lifetime, seconds, uniform-random in `[min, max]`. */
  lifetime: [min: number, max: number];
  /** Launch speed, world units/second, uniform-random in `[min, max]`. */
  speed: [min: number, max: number];
  /**
   * Emission cone half-angles from the axis, radians: `[phiMin, phiMax]`.
   * `[0, 0]` fires straight along the axis; `[0, π]` sprays the full sphere.
   */
  cone: [phiMin: number, phiMax: number];
  /** Cone axis (need not be normalised). Defaults to +Y when omitted. */
  axis?: Vector3;
  /** Downward acceleration, world units/s²: `v.y -= gravity·dt`. Negative floats up. */
  gravity: number;
  /** Per-second velocity damping in `[0, 1]`: `v *= (1 - drag·dt)`. Default 0. */
  drag?: number;
  /** Render size (world units). Uniform per preset — see the sizing note above. */
  size: number;
  /**
   * Colour palette. One colour → fixed; two → per-particle random lerp between
   * them (matches the legacy two-endpoint blend); more → random pick.
   */
  colors: Color[];
  /**
   * Start opacity range `[min, max]`: each particle picks a random start alpha
   * in this range and fades linearly to 0 over its life (matches legacy).
   */
  opacity: [min: number, max: number];
}

/** Per-emit overrides for colour and count, for call sites that vary them. */
export interface EmitOverrides {
  /** Replace the preset palette (e.g. tint a burst to a bubble's colour). */
  colors?: Color[];
  /** Override the burst count. */
  count?: number;
}

/** Control handle for a running continuous stream (see `ParticleEngine.stream`). */
export interface StreamHandle {
  /** Pauses emission; already-live particles finish their lives naturally. */
  stop(): void;
  /** Resumes emission after a `stop()`. */
  start(): void;
  /** Changes the emit rate (particles/second) — e.g. a burst boost then restore. */
  setRate(rate: number): void;
}

/** A live per-scene particle engine. */
export interface ParticleEngine {
  /**
   * Fires a one-shot burst of a preset at a world position.
   *
   * @param preset - The effect to emit.
   * @param position - World-space origin.
   * @param overrides - Optional per-emit colour/count overrides.
   */
  emit(preset: ParticlePreset, position: Vector3, overrides?: EmitOverrides): void;
  /**
   * Starts a continuous stream that spawns particles at a moving target's
   * current world position every tick (fixes the legacy bug where a trail kept
   * emitting at the spawn point while its target drifted away).
   *
   * @param preset - The effect to stream.
   * @param follow - An Object3D (its world position is read each tick) or a
   *   getter returning the current emit position.
   * @param rate - Particles per second.
   * @param overrides - Optional per-emit colour overrides.
   * @returns A {@link StreamHandle}; also auto-stopped on scope disposal.
   */
  stream(preset: ParticlePreset, follow: Object3D | (() => Vector3), rate: number, overrides?: EmitOverrides): StreamHandle;
}

/** A single pooled particle within a batch. */
interface Particle {
  pos: Vector3;
  vel: Vector3;
  r: number;
  g: number;
  b: number;
  startAlpha: number;
  age: number;
  lifetime: number;
  alive: boolean;
}

/** One GPU batch: all live particles of a single preset. */
interface Batch {
  points: Points;
  geometry: BufferGeometry;
  posAttr: Float32BufferAttribute;
  colAttr: Float32BufferAttribute;
  particles: Particle[];
  capacity: number;
  drag: number;
  gravity: number;
}

/** A live continuous stream registration. */
interface Stream {
  preset: ParticlePreset;
  batch: Batch;
  follow: Object3D | (() => Vector3);
  rate: number;
  overrides?: EmitOverrides;
  accumulator: number;
  stopped: boolean;
}

/**
 * Resolves a `count` that may be a fixed number or an inclusive range.
 *
 * @param count - A fixed count or `[min, max]` range.
 * @returns A concrete integer count.
 */
function resolveCount(count: number | [number, number]): number {
  if (typeof count === 'number') return Math.round(count);
  return Math.round(randomRange(count[0], count[1]));
}

/**
 * Reads the current world position of a follow target into `out`.
 *
 * @param follow - The Object3D or position getter to read.
 * @param out - The vector to write the world position into.
 */
function readFollow(follow: Object3D | (() => Vector3), out: Vector3): void {
  if (typeof follow === 'function') {
    out.copy(follow());
  } else {
    follow.getWorldPosition(out);
  }
}

/**
 * Creates a particle engine bound to a scene's clock and disposal scope.
 *
 * @param scene - The scene batches are added to.
 * @param clock - The surface FrameClock that drives integration.
 * @param scope - The disposal scope that tears the engine down.
 * @returns A {@link ParticleEngine}.
 */
export function createParticleEngine(scene: Scene, clock: FrameClock, scope: DisposalScope): ParticleEngine {
  const batches = new Map<ParticlePreset, Batch>();
  const streams: Stream[] = [];
  // Cache the axis→cone rotation per preset (axis is constant per preset).
  const rotations = new Map<ParticlePreset, Quaternion | null>();

  // Scratch objects reused across emits to avoid per-particle allocation.
  const scratchDir = new Vector3();
  const scratchPos = new Vector3();
  const scratchColor = new Color();

  /**
   * Lazily creates (and scene-adds, scope-registers) the batch for a preset.
   *
   * @param preset - The preset whose batch is needed.
   * @returns The existing or newly created batch.
   */
  function batchFor(preset: ParticlePreset): Batch {
    const existing = batches.get(preset);
    if (existing) return existing;

    const geometry = new BufferGeometry();
    const posAttr = new Float32BufferAttribute(new Float32Array(preset.capacity * 3), 3);
    const colAttr = new Float32BufferAttribute(new Float32Array(preset.capacity * 4), 4);
    posAttr.setUsage(DynamicDrawUsage);
    colAttr.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colAttr);
    geometry.setDrawRange(0, 0);

    const material = new PointsMaterial({
      map: getParticleTexture(preset.texture),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: preset.blending === 'additive' ? AdditiveBlending : NormalBlending,
      sizeAttenuation: true,
      size: preset.size,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.raycast = () => {}; // never intercept gameplay picks
    scene.add(points);

    const batch: Batch = {
      points,
      geometry,
      posAttr,
      colAttr,
      particles: [],
      capacity: preset.capacity,
      drag: preset.drag ?? 0,
      gravity: preset.gravity,
    };
    batches.set(preset, batch);
    // Disposed on scope teardown (geometry + material freed, detached).
    scope.object3D(points);
    return batch;
  }

  /**
   * Returns the cached axis→+Y rotation for a preset, or null if axis is +Y.
   *
   * @param preset - The preset whose cone axis rotation is needed.
   * @returns The rotation quaternion, or null when the axis is +Y (no rotation).
   */
  function rotationFor(preset: ParticlePreset): Quaternion | null {
    if (rotations.has(preset)) return rotations.get(preset)!;
    let q: Quaternion | null = null;
    if (preset.axis) {
      const axis = scratchDir.copy(preset.axis).normalize();
      if (axis.distanceToSquared(UP) > 1e-8) {
        q = new Quaternion().setFromUnitVectors(UP, axis);
      }
    }
    rotations.set(preset, q);
    return q;
  }

  /**
   * Samples an emission direction in the preset's cone into `scratchDir`.
   *
   * @param preset - The preset whose cone is sampled.
   * @returns The shared `scratchDir` set to a unit direction in the cone.
   */
  function sampleDirection(preset: ParticlePreset): Vector3 {
    const [phiMin, phiMax] = preset.cone;
    const theta = randomRange(0, Math.PI * 2);
    // Area-correct: cosφ uniform in [cos φmax, cos φmin]. Sampling φ directly
    // would cluster particles at the pole. See architecture-standards.md.
    const cosPhi = randomRange(Math.cos(phiMax), Math.cos(phiMin));
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    scratchDir.set(sinPhi * Math.cos(theta), cosPhi, sinPhi * Math.sin(theta));
    const q = rotationFor(preset);
    if (q) scratchDir.applyQuaternion(q);
    return scratchDir;
  }

  /**
   * Picks a particle colour from the palette into `scratchColor`.
   *
   * @param colors - The palette: 1 fixed, 2 random-lerp, or 3+ random-pick.
   * @returns The shared `scratchColor` set to the sampled colour.
   */
  function sampleColor(colors: Color[]): Color {
    if (colors.length === 1) return scratchColor.copy(colors[0]);
    if (colors.length === 2) return scratchColor.copy(colors[0]).lerp(colors[1], Math.random());
    return scratchColor.copy(colors[Math.floor(Math.random() * colors.length)]);
  }

  /**
   * Acquires a free particle slot from a batch, or null if at capacity.
   *
   * @param batch - The batch to draw a slot from.
   * @returns A reusable/new particle, or null when the pool is exhausted.
   */
  function acquire(batch: Batch): Particle | null {
    for (const p of batch.particles) {
      if (!p.alive) return p;
    }
    if (batch.particles.length < batch.capacity) {
      const p: Particle = {
        pos: new Vector3(),
        vel: new Vector3(),
        r: 1,
        g: 1,
        b: 1,
        startAlpha: 1,
        age: 0,
        lifetime: 1,
        alive: false,
      };
      batch.particles.push(p);
      return p;
    }
    return null; // pool exhausted — drop the particle rather than grow unbounded
  }

  /**
   * Emits one particle of a preset at a position into its batch.
   *
   * @param preset - The preset defining the particle's motion and look.
   * @param batch - The batch that owns the particle pool.
   * @param position - World-space spawn position.
   * @param overrides - Optional per-emit colour overrides.
   */
  function emitOne(preset: ParticlePreset, batch: Batch, position: Vector3, overrides?: EmitOverrides): void {
    const p = acquire(batch);
    if (!p) return;
    p.pos.copy(position);
    const dir = sampleDirection(preset);
    const speed = randomRange(preset.speed[0], preset.speed[1]);
    p.vel.copy(dir).multiplyScalar(speed);
    const color = sampleColor(overrides?.colors ?? preset.colors);
    p.r = color.r;
    p.g = color.g;
    p.b = color.b;
    p.startAlpha = randomRange(preset.opacity[0], preset.opacity[1]);
    p.lifetime = randomRange(preset.lifetime[0], preset.lifetime[1]);
    p.age = 0;
    p.alive = true;
  }

  /**
   * Integrates one batch by dt and rewrites its GPU buffers.
   *
   * @param batch - The batch to advance.
   * @param dt - Clamped seconds since the previous tick.
   */
  function updateBatch(batch: Batch, dt: number): void {
    const dragFactor = 1 - batch.drag * dt;
    const gdt = batch.gravity * dt;
    let idx = 0;
    for (const p of batch.particles) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.lifetime) {
        p.alive = false;
        continue;
      }
      p.vel.multiplyScalar(dragFactor);
      p.vel.y -= gdt;
      p.pos.addScaledVector(p.vel, dt);

      const alpha = p.startAlpha * (1 - p.age / p.lifetime);
      batch.posAttr.setXYZ(idx, p.pos.x, p.pos.y, p.pos.z);
      batch.colAttr.setXYZW(idx, p.r, p.g, p.b, alpha);
      idx++;
    }
    batch.geometry.setDrawRange(0, idx);
    if (idx > 0) {
      batch.posAttr.needsUpdate = true;
      batch.colAttr.needsUpdate = true;
    }
  }

  // One clock subscription drives every batch and stream for this scene.
  const unsubscribe = clock.subscribe((dt) => {
    // Streams emit first, reading the follow target's *current* world position.
    for (const s of streams) {
      if (s.stopped) continue;
      s.accumulator += s.rate * dt;
      if (s.accumulator >= 1) {
        readFollow(s.follow, scratchPos);
        while (s.accumulator >= 1) {
          emitOne(s.preset, s.batch, scratchPos, s.overrides);
          s.accumulator -= 1;
        }
      }
    }
    for (const batch of batches.values()) {
      updateBatch(batch, dt);
    }
  });
  scope.add(unsubscribe);

  return {
    emit(preset, position, overrides): void {
      const batch = batchFor(preset);
      const count = overrides?.count ?? resolveCount(preset.count);
      for (let i = 0; i < count; i++) {
        emitOne(preset, batch, position, overrides);
      }
    },
    stream(preset, follow, rate, overrides): StreamHandle {
      const batch = batchFor(preset);
      const s: Stream = { preset, batch, follow, rate, overrides, accumulator: 0, stopped: false };
      streams.push(s);
      const handle: StreamHandle = {
        stop() {
          s.stopped = true;
        },
        start() {
          s.stopped = false;
        },
        setRate(nextRate: number) {
          s.rate = nextRate;
        },
      };
      scope.add(handle.stop);
      return handle;
    },
  };
}

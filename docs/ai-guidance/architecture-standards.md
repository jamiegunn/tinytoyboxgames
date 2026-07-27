# Architecture Standards & Standardization Plan

This is the north-star document for cross-cutting runtime standards in Tiny
Toybox Games. It exists because the app grew as **two parallel stacks** — a
"scenes" stack (rooms, immersive worlds) and a "minigames" stack — and almost
every subsystem drifted into two (or three) incompatible implementations.
Standardizing them removes duplication, prevents whole classes of bug
(resource/tween leaks, invisible backdrops), and makes each screen a
description rather than a snowflake.

Sibling standards already in force: [`scene-rendering-standards.md`](./scene-rendering-standards.md)
(camera-agnostic backdrop placement) and [`audio-standards.md`](./audio-standards.md)
(every scene/game ships its own music bed). The sky rig
(`src/src/utils/skyRig.ts`) was the first bridge across the two stacks; the
standards below are the rest of the bridges.

**Linking rule:** code that implements or consumes a standard cites its anchor
here in a comment, e.g. `// See architecture-standards.md#disposalscope`. That
keeps the "why" one click away from the "what".

---

## How to read this document <a id="howtoread"></a>

Every published signature below is a **transcription of the real code**, not a
design sketch. Where the shipped API diverged from the original plan, the plan
has been overwritten — the sketches are gone, because a sketch that no longer
matches the code is worse than no sketch at all: it reads as authoritative and
is wrong, and an agent that trusts it writes code that does not compile.

State is reported with three words, and the distinction between the last two is
the point:

| Word                  | Meaning                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **in force**          | The primitive exists, has contract tests, **and production code calls it.** The standard governs what actually renders.                          |
| **landed, not wired** | The primitive exists and is tested, but **nothing in `src/` calls it.** It governs nothing at runtime. It cannot regress, because it cannot run. |
| **partial**           | In force on some surfaces, absent on others; the gap is named explicitly.                                                                        |

The previous revision of this document marked every phase **done**, which
collapsed those three states into one and hid the two largest facts about the
codebase: that the capstone (§9) has never executed, and that §8's headline
child-UX guarantee is not actually enforced at runtime. Both are recorded
plainly below.

**Verification convention.** A claim about a count, a call site, or an absence
carries the command that produced it, so the next reader can re-run it instead
of trusting this file. Counts are current as of the commit that last touched
this document.

---

## The meta-pattern

The duplication was not random — it was exactly one scenes-version and one
minigames-version of each subsystem. This table is the **historical diagnosis**;
the "Now" column records where each concern actually stands today.

| Concern        | Scenes stack (was)                                                                 | Minigames stack (was)                                                | Now                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Disposal       | `disposeSceneResources`, `createDisposeCollector` (`utils/sceneHelpers.ts`)        | `disposeMeshDeep` (`minigames/shared/disposal.ts`), `disposeGameRig` | **in force** — `DisposalScope` (§1); `disposeGameRig` deleted                                                           |
| Frame loop     | per-effect `requestAnimationFrame`                                                 | per-effect `requestAnimationFrame`                                   | **in force** — one `FrameClock` per surface (§2)                                                                        |
| Particles      | `utils/particles.ts`, `utils/particleFactory.ts`                                   | `minigames/shared/particleFx.ts`                                     | **in force** — one engine (§4); all 3 legacy modules deleted                                                            |
| Idle animation | `utils/animationPresets.ts` + raw `gsap`                                           | raw `gsap`                                                           | **partial** — `IdleAnimator` (§5) in force for decor idles; one un-killed `repeat: -1` remains (see Phase 3)            |
| Lighting       | `createSceneLighting` (`LightingConfig`)                                           | `createGameLighting` (`GameLightingOptions`, Babylon "hemispheric")  | **in force** — one `LightingRig` (§6); both legacy entry points are now adapters                                        |
| Camera         | `createSceneCamera` (orbit, Babylon spherical, +π θ)                               | shell fixed camera + `createGameCamera` (beta/radius; often dead)    | **in force** — one `CameraDescriptor` (§7); `createGameCamera` deleted                                                  |
| Interaction    | `createWorldTapDispatcher`, `wireToyboxInteractions`, room `userData.onClick` scan | `createInputDispatcher` (tap/drag + forgiveness)                     | **partial** — one controller (§8), but no-dead-tap is **not** enforced at runtime                                       |
| Math           | `utils/mathHelpers.ts` (`lerp`)                                                    | `minigames/shared/mathUtils.ts` (`lerp` again)                       | **partial** — `utils/math.ts` is canonical, but both shims are still imported and `lerp` is defined **four** times (§3) |

---

## Sequencing (dependency order)

Implemented bottom-up; each phase is independently shippable behind the gates
(`tsc -b`, `eslint --max-warnings 0`, `node --test`, `vite build`) and, for
visual phases, a screenshot check.

```
Phase 1  Foundation:  DisposalScope → FrameClock → math consolidation      (no deps)
Phase 2  ParticleEngine                     (deps: DisposalScope, FrameClock, math)
Phase 3  IdleAnimator                       (deps: DisposalScope, FrameClock)
Phase 4  LightingRig                        (deps: qualityTier)
Phase 5  CameraDescriptor                   (deps: none; highest gameplay risk)
Phase 6  InteractionController              (deps: DisposalScope)
Phase 7  SceneDescriptor (capstone) + sky-rig migration of Nature/rooms
         (deps: Camera, Lighting, sky rig, Disposal, Interaction)
```

### Status

| Phase | Standard                             | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | DisposalScope / FrameClock / math    | **in force** for disposal + clock (`utils/disposal.ts`, `utils/frameClock.ts`); **partial** for math — `utils/math.ts` is canonical and `mathHelpers`/`mathUtils` are pure re-export shims, but 6 files still import `mathHelpers` and 7 still import `mathUtils`, so the shims cannot yet be deleted. Behavioural tests in `tests/framework/{math,disposal,frameClock}.test.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1.5   | Context integration                  | **in force** — `MiniGameContext` gains `clock`/`disposal`; `createScene` gains a `SceneLifecycle` arg; both surfaces tick the clock and dispose the scope on teardown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2     | ParticleEngine                       | **in force** — `utils/particles/{engine,presets,texture,registry}.ts`; one clock-driven, scope-disposed engine per scene reached via `getParticleEngine(scene)`; all 3 legacy modules deleted. **54 `emit`/`stream` call sites across 33 files** (`grep -rn "\.emit(PARTICLES\|\.stream(PARTICLES" src/`) — the "~35" in earlier revisions predated the owl and celebration migrations. Contract test in `tests/particles/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3     | IdleAnimator                         | **partial — one leak still open.** `utils/idle/{idleAnimator,registry}.ts` is in force and reached via `getIdleAnimator(scene)`, wired into both shells, contract-tested in `tests/framework/`. Decor idles use presets (spinningTop, hangingMobile, catPlush, rubberDuck, toyBall, toyTrain's orbit spin) and `register()` covers the keyframe loops (hoppingChick, windUpMouse, toy cars ×2, musicPlayer, animalVisitors). **`playroom/floorToys/toyTrain.ts:234` is a genuine un-killed leak**: `gsap.to({}, { duration: 0.8, repeat: -1, onRepeat: emitPuff })` is never assigned and never registered, and the horn at `:245`/`:248` self-reschedules via `gsap.delayedCall` with no cancel. This file _was_ previously listed as fixed — its `spin` was migrated (`:174`) and the puff timer beside it was missed. The other raw `repeat: -1` sites (owl `entities/owl/idle.ts`, raccoon, snail, skyBackdrop, gamePortal, `living-room/decor/fireplace.ts:137`/`:162`, `animalVisitors.ts:581`, `utils/animationHelpers.ts:161`) each self-manage via a returned cleanup, a `cleanups` array, or a tracked handle — verified individually, not assumed |
| 4     | LightingRig                          | **in force** — `utils/lighting/lightingRig.ts` (`createLightingRig(scene, descriptor, scope)`: directional key + hemisphere fill + point accents, shadow map size from qualityTier, all scope-disposed). `createSceneLighting` and `createGameLighting` are now thin vocabulary adapters onto the one rig — the duplicate rig/shadow implementations are gone and the directional shadow-map leak is fixed. bubble-pop's dead (never-added) game lights were removed. Contract test in `tests/framework/`; parity verified across all **5 scenes + 5 games**. Known limitation: the rig always casts shadows (see §6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 5     | CameraDescriptor                     | **in force** — `utils/camera/cameraDescriptor.ts` (the ONE three.js `Spherical` convention: θ=0→+Z, θ=π→−Z; `createCamera` for fixed/orbit; fov in degrees). Behavioural test pins it against three.js and both legacy formulas. Games declare a `camera?` descriptor in the manifest; the shell builds and applies it (default `DEFAULT_GAME_CAMERA`, fixed (0,2,5)); the dead never-applied cameras (bubble-pop, fireflies) and the Babylon `createGameCamera`/`disposeGameRig` are deleted. Scene presets fold the old `θ+π` into a native-θ `azimuth: π`. Verified pixel-identical across all 5 scenes + 5 games                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6     | InteractionController                | **partial — the headline rule is not enforced.** `utils/interaction/` is in force for gesture handling: `createWorldTapDispatcher` is a thin adapter over `createInteractionController`, so scene props, `createTapInteraction`, `wireToyboxInteractions`, and the room `userData.onClick` scan all flow through it with shared rules; `createInputDispatcher` (games) imports the same thresholds. Smear-tap forgiveness, proximity fallback and `pointercancel` reset are live and exhaustively tested via pure `gestureRules.ts`. **But no-dead-tap is dead code**: the fallback is gated on an optional `audio: InteractionAudio` argument, **no `InteractionAudio` implementation exists anywhere in `src/`**, and the only live caller (`utils/worldTapDispatcher.ts:33`) passes three arguments. See §8                                                                                                                                                                                                                                                                                                                                               |
| 7     | SceneDescriptor + backdrop migration | **landed, not wired — the capstone has never executed.** `utils/scene/{sceneDescriptor,buildScene,sceneDescriptors}.ts` exist and are internally coherent, and Nature's flat `PlaneGeometry` sky _was_ migrated to `createGradientSkydome` (screenshot-verified). But **`buildScene` has zero call sites in `src/`** and so does `getSceneDescriptor` (`grep -rn "buildScene\|getSceneDescriptor" src/` matches only `utils/scene/` itself and the unrelated `buildSceneBase`). Nature still builds via `buildSceneBase` + a bespoke `environment.ts`. The contract test does **not** run the builder: `tests/framework/sceneDescriptor.test.mjs:30` reads `buildScene.ts` as **text** and asserts on substrings (`:244`), so it would pass unchanged if the function were deleted from every code path — which is the current state. The descriptors validate, but nothing stops them drifting from what actually renders. See §9                                                                                                                                                                                                                           |

---

## 1. DisposalScope <a id="disposalscope"></a>

**Problem.** Four disposal helpers and ad-hoc per-scene/per-game teardown. When
something is forgotten the result is a leak: `repeat:-1` GSAP tweens that
animate detached objects forever, shadow-map render targets, per-effect rAF
loops. Teardown correctness used to depend on remembering every resource at
every site.

**Abstraction.** A `DisposalScope` is a LIFO registry of teardown actions.
Everything that allocates registers its cleanup; teardown is one call.

```ts
/** Anything with a kill() — gsap tweens and timelines both satisfy it. */
export interface Killable {
  kill: () => void;
}

export interface DisposalScope {
  /** Register a raw teardown function. */
  add(teardown: () => void): void;
  /** Dispose an Object3D subtree (geometry, materials, lights) on teardown. */
  object3D(obj: Object3D): void;
  /** Kill a GSAP tween/timeline on teardown (fixes the repeat:-1 leak class). */
  tween(tween: Killable): void;
  /** Remove a DOM listener on teardown. `options` must match the addEventListener call. */
  listener(
    target: EventTarget,
    type: string,
    fn: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void;
  /** Create a nested scope disposed with (or before) its parent. */
  child(): DisposalScope;
  /** Dispose everything in reverse registration order. Idempotent. */
  dispose(): void;
}
export function createDisposalScope(): DisposalScope;
```

Note `Killable` is a **local structural type**, not `gsap.core.Tween` —
`disposal.ts` imports nothing from gsap, which is what keeps it loadable by the
behavioural test runner without bundling.

**Invariants (the CS contract).**

- **LIFO order.** Teardown runs in reverse of registration, so a resource is
  never torn down before something that depends on it. Formally, if `a` is
  registered before `b`, then `b` disposes before `a`.
- **Idempotent.** `dispose()` is safe to call twice; the second call is a no-op.
  Guarded by an internal `disposed` flag and by clearing the registry.
- **Exception-isolated.** One failing teardown does not abort the rest (each is
  wrapped in try/catch), because a leaked resource must not block the others.
- **Late registration runs immediately.** Registering on an already-disposed
  scope does not silently leak — the teardown fires at once. This matters for
  async builders that resolve after their scene has gone away.

**Subsumes.** `createDisposeCollector` (→ `add`), `disposeSceneResources` (→
`object3D(scene)`), `disposeMeshDeep` (→ `object3D`), `disposeGameRig` (deleted).

**Naming / files.** `createDisposalScope`, `DisposalScope` in
`src/src/utils/disposal.ts`.

---

## 2. FrameClock <a id="frameclock"></a>

**Problem.** Every particle burst and idle effect started its own
`requestAnimationFrame`. These were decoupled from the renderer, kept running
after their scene was torn down (leak + battery), and were throttled
independently in background tabs.

**Abstraction.** One clock per rendering surface (one per `SceneFrame`, one per
`MiniGameShell`). Effects **subscribe**; the surface's single existing render
loop **ticks** it. No effect calls `requestAnimationFrame` any more.

```ts
export interface FrameClock {
  /** Subscribe a per-frame callback; returns an unsubscribe fn. */
  subscribe(
    cb: (dtSeconds: number, elapsedSeconds: number) => void,
  ): () => void;
  /** Advance the clock; called once per frame by the owning render loop. */
  tick(rawDtSeconds: number): void;
  /** Seconds accumulated since creation (clamped dt). */
  readonly elapsed: number;
}
export function createFrameClock(): FrameClock;

/** The dt clamp. Exported so tests and subscribers can cite the same number. */
export const MAX_DELTA_SECONDS = 0.1;
```

**The math.** Frame integration uses a **clamped variable timestep**:

```
dt      = min(rawDt, MAX_DELTA_SECONDS)     // 0.1 s (matches MiniGameShell)
elapsed = elapsed + dt
```

Clamping prevents the "teleport" that a large `rawDt` (after a tab switch or GC
pause) would inject into physics/particles. We deliberately use a clamped
variable step, not a fixed-step accumulator: these toys have no stiff physics
that requires determinism, and a fixed step would add complexity (accumulator,
interpolation) for no gameplay benefit. Subscribers that need integral
stability already clamp velocities.

**Integration.** `SceneFrame` and `MiniGameShell` each own a `FrameClock` and a
`DisposalScope`. `MiniGameShell` ticks the clock in its `setAnimationLoop` and
exposes both on `MiniGameContext` (`context.clock`, `context.disposal`);
`SceneFrame` ticks a per-scene clock in its RAF (paused while a minigame overlay
covers the scene) and passes both to `createScene` via a `SceneLifecycle`
argument. Both dispose the scope on teardown.

**Naming / files.** `createFrameClock`, `FrameClock`, `MAX_DELTA_SECONDS` in
`src/src/utils/frameClock.ts`.

---

## 3. math consolidation <a id="math"></a>

**Standard.** One module `src/src/utils/math.ts` is the single source of truth
(`lerp`, `lerpClamped`, `clamp`, `smooth01`, `easeOutCubic`, `randomRange`,
`randomInt`, `randomPick`, `wrapAngle`, `shuffle`, `parabolicY`, `xzDistance`).

**Status: partial, and the shims are load-bearing.** `minigames/shared/mathUtils.ts`
and `utils/mathHelpers.ts` are pure re-export shims — but they are **not
deleted, and cannot be** until their importers migrate:

- `mathHelpers` — 6 importers, all in the Nature scene:
  `factory/props/complex/trees/{canopy,create,roots,trunk}.ts`,
  `factory/props/complex/stream/shared/context.ts`,
  `factory/props/complex/stream/stream-bank/shared/math.ts`.
- `mathUtils` — 7 importers: `bubble-pop/{adaptive,balance,helpers}.ts`,
  `fireflies/{entities,helpers}.ts`, `little-shark/helpers.ts`,
  `little-shark/environment/coralFactory.ts`.

**And `lerp` is still defined four times, not twice.** The original diagnosis
counted only the two shared modules and missed the private copies:

| Definition                                               | Note                   |
| -------------------------------------------------------- | ---------------------- |
| `utils/math.ts:32`                                       | canonical              |
| `minigames/games/little-shark/shark/expressions.ts:91`   | private duplicate      |
| `minigames/games/little-shark/environment/terrain.ts:62` | private duplicate      |
| `minigames/games/cannonball-splash/helpers.ts:41`        | **exported** duplicate |

The two little-shark copies are deliberate under the games-stay-independently-deletable
rule (a game must not import another game's helpers, and copying a three-line
function is cheaper than a shared dependency) — but that rationale does not
extend to importing `utils/math.ts`, which is shared infrastructure, not another
game. They are duplicates, and this table is where they are accounted for rather
than forgotten.

`grep -rn "^function lerp\|^export function lerp" src/` reproduces the table.

---

## 4. ParticleEngine <a id="particleengine"></a>

**Problem.** Three modules (`utils/particles.ts`, `utils/particleFactory.ts`,
`minigames/shared/particleFx.ts`, ~1090 lines), two different
`createSparkleBurst`, two `createDustPuff`, duplicate point-sprite textures
(duplicate GPU uploads), and self-driven rAF loops.

**Abstraction.** One engine per scene, bound to `(scene, FrameClock,
DisposalScope)` and **two shared, deduped point textures**. Effects are **data**
(`ParticlePreset`); the engine owns the geometry/material and updates on the
clock tick.

```ts
export interface ParticlePreset {
  /** Sprite shape. Shared, deduped texture (see texture.ts). */
  texture: ParticleTextureKind; // 'circle' | 'star'
  blending: "additive" | "normal";
  /** Default burst size (a fixed count, or an inclusive [min, max] range). */
  count: number | [min: number, max: number];
  /** Pool capacity — max particles this preset can have alive at once. */
  capacity: number;
  lifetime: [min: number, max: number]; // seconds
  speed: [min: number, max: number]; // world units / s
  /** Cone half-angles from the axis, radians. [0,0] fires straight; [0,π] is the full sphere. */
  cone: [phiMin: number, phiMax: number];
  /** Cone axis (need not be normalised). Defaults to +Y. */
  axis?: Vector3;
  /** Downward acceleration, world units/s²: `v.y -= gravity·dt`. Negative floats up. */
  gravity: number;
  /** Per-second velocity damping in [0,1]: `v *= (1 - drag·dt)`. Default 0. */
  drag?: number;
  /** Render size, world units. Uniform per preset — see the sizing note below. */
  size: number;
  /** 1 colour → fixed; 2 → per-particle random lerp; 3+ → random pick. */
  colors: Color[];
  /** Per-particle random START alpha in [min, max], fading linearly to 0 over life. */
  opacity: [min: number, max: number];
}

export interface EmitOverrides {
  colors?: Color[];
  count?: number;
}

export interface StreamHandle {
  stop(): void; // pause emission; live particles finish naturally
  start(): void; // resume after stop()
  setRate(rate: number): void;
}

export interface ParticleEngine {
  emit(
    preset: ParticlePreset,
    position: Vector3,
    overrides?: EmitOverrides,
  ): void;
  stream(
    preset: ParticlePreset,
    follow: Object3D | (() => Vector3),
    rate: number,
    overrides?: EmitOverrides,
  ): StreamHandle;
}
export function createParticleEngine(
  scene: Scene,
  clock: FrameClock,
  scope: DisposalScope,
): ParticleEngine;
```

**The real preset registry** (`utils/particles/presets.ts:344`) has **18** keys:

```
sceneSparkle, sceneDust, dustMotes, pollen, waterRipple, glowSpores,
cannonConfetti, treasureGold, sparkle, bubblePop, glowTrail, starCollect,
fireflyGlow, owlAlert, owlTrail, owlLanding, celebrationConfetti,
celebrationFlash
```

Earlier revisions of this document published a different list containing
`dust`, `confetti`, `waterSplash`, `heart`, `glitter` and `ripple`. **None of
those keys exist**; `PARTICLES.dust` is a compile error. The nearest real
equivalents are `sceneDust`, `cannonConfetti`/`celebrationConfetti`,
`waterRipple` and `glowSpores`.

**The math.**

- **Emission direction** (cone around `axis`, default +Y): `θ ∈ [0, 2π)`
  uniform; `cosφ ∈ [cos φmax, cos φmin]` uniform (area-correct on the sphere —
  sampling `φ` uniformly would cluster at the pole). Then
  `dir = (sinφ·cosθ, cosφ, sinφ·sinθ)` in axis-local space,
  `v = dir · U[speedMin, speedMax]`.
- **Integration per tick** (uses `FrameClock` dt): `v *= (1 - drag·dt)`;
  `v.y -= gravity·dt`; `p += v·dt`; `age += dt`; `t = age/lifetime`.
- **Appearance**: `alpha = startAlpha · (1 − t)`. Buffers written once per tick.
- **Emitter-follow fix.** `stream` reads `follow`'s **world** position every
  tick (`getWorldPosition`), fixing the documented bug where trails emitted at
  the spawn point forever while the target drifted away.

**Why `size` is a scalar, not `[start, end]`.** The legacy `PointsMaterial` path
renders `gl_PointSize` from the material uniform and _ignores_ any per-vertex
size attribute — so every legacy system drew at the class default `0.1`
regardless of its configured range. `0.1` **is** the shipped look. Every preset
therefore uses `size: 0.1`, one batch (one `Points`/material) exists per preset,
and the authored ranges survive as comments in `presets.ts`. True per-particle
or over-life sizing is deferred: it needs a size shader and its own review.

**Streams share a batch.** All streams of a preset emit into its single batch
(every firefly into one glow batch), so `capacity` is sized for the whole scene,
not per emitter.

**Registry.** `setSceneParticleEngine(scene, clock, scope)` (called by
`MiniGameShell` and `SceneFrame`) creates and registers the engine;
`getParticleEngine(scene)` returns it, or a warning no-op engine if none is
registered — a missing sparkle never throws for a toddler.

**Naming / files.** `src/src/utils/particles/{engine,presets,texture,registry}.ts`.

---

## 5. IdleAnimator <a id="idleanimator"></a>

**Problem.** ~10 decor files started raw `gsap` `repeat:-1` tweens with no kill
on teardown (leak: immortal tweens animating detached objects, accumulating
across scene switches because the hub renderer persists).

**Abstraction.** A thin registry over GSAP bound to a `DisposalScope`; every
idle tween it starts is registered for `kill()` on `scope.dispose()`. Decor
"gently alive" motion uses named presets, not raw gsap.

```ts
export interface IdleAnimator {
  /** Uniform (or per-axis) scale pulse. */
  breathe(target: Object3D, opts: BreatheOpts): IdleHandle;
  /** rotation.z rocking — a swaying plant or hanging toy. */
  sway(target: Object3D, opts: SwingOpts): IdleHandle;
  /** position.y bobbing — a floating balloon or duck. */
  bob(target: Object3D, opts: SwingOpts): IdleHandle;
  /** Continuous rotation about an axis. */
  spin(target: Object3D, opts: SpinOpts): IdleHandle;
  /** Emissive-intensity oscillation — a flickering fire or glowing gem. */
  flicker(material: MeshStandardMaterial, opts: FlickerOpts): IdleHandle;
  /** Builds a registered `repeat: -1` timeline for a multi-keyframe idle loop. */
  loop(build: (tl: gsap.core.Timeline) => void): IdleHandle;
  /** Adopts an existing killable so it dies with the scope. Returns its argument. */
  register<T extends { kill: () => void }>(tween: T): T;
}
export function createIdleAnimator(scope: DisposalScope): IdleAnimator;
```

Three corrections against earlier revisions, all of which would break a caller
written from the old text:

- **Seven methods, not five.** `loop` and `register` were unpublished, and they
  are the two that carry the migration: `register` is how an existing tween is
  adopted without rewriting it, and `loop` is how a keyframe sequence becomes
  scope-owned.
- **Every method returns `IdleHandle`, not `void`.** A caller that needs to stop
  an idle early (a tapped toy that reacts, then resumes) needs the handle.
- **`opts` is required, and there is one shared `SwingOpts`.** `SwayOpts` and
  `BobOpts` do not exist; `sway` and `bob` take the same type. The real option
  types are `BreatheOpts`, `SwingOpts`, `SpinOpts`, `FlickerOpts` — the first,
  second and fourth extend a common `SinusoidOpts`.

**Registry (was unpublished).** `setSceneIdleAnimator(scene, scope)` creates and
registers the per-scene animator; `getIdleAnimator(scene)` retrieves it. Decor
files call the getter rather than constructing their own — that is what binds
them to the scene's lifetime.

**The math (all presets are sinusoidal idles).**
`value(t) = base + amplitude · sin(2π·t / period + phase)`, with `phase`
randomized per instance (via `seek`) so a shelf of toys doesn't pulse in
lockstep. `spin` is linear: `rotation += (2π / period)·dt`.

**Migration.** The `animationPresets.ts` keyframe helpers stay for one-shot
reactions (squash/hop/splat), which are not leaks. One raw site remains
un-adopted — see Phase 3 for `toyTrain.ts:234`.

---

## 6. LightingRig <a id="lightingrig"></a>

**Problem.** `createSceneLighting` (`LightingConfig`) and `createGameLighting`
(`GameLightingOptions`, Babylon "hemisphericIntensity") were two rigs with
different vocabularies.

**Abstraction.** One descriptor-driven factory:

```ts
export interface LightingDescriptor {
  /** Directional key. `direction` is the direction the light travels (need not be unit). */
  key: { direction: Vector3; intensity: number; color: Color };
  /**
   * Hemisphere fill. skyColor === groundColor reproduces the flat ambient fill
   * the mini-games used; differing colours give the diorama sky/bounce fill.
   */
  fill: { skyColor: Color; groundColor: Color; intensity: number };
  accents?: Array<{
    position: Vector3;
    intensity: number;
    color: Color;
    distance?: number;
  }>;
  /** Map size always comes from qualityTier; these override frustum/bias/clip planes. */
  shadow?: {
    bias?: number;
    normalBias?: number;
    frustum?: number;
    near?: number;
    far?: number;
  };
}

/** The live lights (already added to the scene and scope-owned). */
export interface LightingRig {
  key: DirectionalLight;
  fill: HemisphereLight;
  accents: PointLight[];
}

export function createLightingRig(
  scene: Scene,
  d: LightingDescriptor,
  scope: DisposalScope,
): LightingRig;
```

Shadow map size comes from `qualityTier` (already wired in `sceneHelpers`).
Retires "hemispheric" → "fill (sky/ground hemisphere)". The key light position
is `-direction · KEY_DISTANCE`; the shadow frustum is sized to the scene's
ground extent, not a fixed ±10.

**Known limitation — shadows are not optional.** `lightingRig.ts:56` sets
`key.castShadow = true` unconditionally, and the configuring helper is called at
`:91` regardless of whether the descriptor supplies a `shadow` block. There is
**no way to express "this screen casts no shadows"**: omitting `shadow` selects
the defaults, it does not disable them. A flat-lit screen that wants the shadow
map's cost back has to reach past the rig. If that ever matters, the fix is a
`shadow: false` variant on the descriptor — deliberately not added on
speculation, but recorded here so nobody re-derives the constraint by
experiment.

---

## 7. CameraDescriptor <a id="cameradescriptor"></a>

**Problem.** Three camera conventions: the fixed shell camera (`(0,2,5)`,
`lookAt(0,0,0)`, −Z, fov 60), the orbit scene camera (`createSceneCamera`,
Babylon spherical with a `+π` θ offset, +Z, fov 50), and `createGameCamera`
(beta/radius/alpha) which some games applied and others left as dead code. Axis
handedness differed (Star Catcher was mirrored). This is why backdrops needed
the sky rig and why gameplay code branched on scene type.

**Abstraction.** One descriptor and one builder.

```ts
export interface FixedCameraDescriptor {
  kind: "fixed";
  position: Vector3;
  target: Vector3;
  fov: number; // vertical, DEGREES
}
export interface OrbitCameraDescriptor {
  kind: "orbit";
  target: Vector3; // orbit centre
  azimuth: number; // θ radians; 0 → +Z, π → −Z
  polar: number; // φ from +Y, radians
  distance: number;
  fov: number; // vertical, DEGREES
}
export type CameraDescriptor = FixedCameraDescriptor | OrbitCameraDescriptor;

/** The default mini-game camera: the fixed shell view at (0, 2, 5). */
export const DEFAULT_GAME_CAMERA: FixedCameraDescriptor;

export function createCamera(
  d: CameraDescriptor,
  aspect: number,
): PerspectiveCamera;
export function sphericalPosition(
  target: Vector3,
  azimuth: number,
  polar: number,
  distance: number,
  out?: Vector3,
): Vector3;
export function fovRadiansToDegrees(radians: number): number;
```

`createCamera` returns a bare `PerspectiveCamera`. Earlier revisions published
`{ camera, controls? }` with an `OrbitConstraints` type — **neither exists**.
There are no `OrbitControls` in this codebase: an "orbit" descriptor describes a
_pose expressed in spherical coordinates_, not a user-draggable camera. A caller
written against the old signature would destructure `undefined`.

**The math — one spherical convention, documented once.** Given `target`,
`azimuth θ`, `polar φ` (from +Y), `distance r`:

```
position = target + ( r·sinφ·sinθ,  r·cosφ,  r·sinφ·cosθ )
```

This is the plain three.js `Spherical` convention (θ = 0 → +Z). The old scene
code's historical `θ += π` (a Babylon carry-over) is folded into the
descriptor's stored azimuth so no consumer applies ad-hoc offsets. `fov` is
stored in **degrees** (three.js native); the Babylon radians→degrees conversion
lives only in `fovRadiansToDegrees`, for legacy presets.

**Retired dead pattern.** Minigames declare a `CameraDescriptor` in the manifest
and the shell builds and applies it; the "create a `GameCamera` and never use
it" pattern (bubble-pop, fireflies) and the Babylon `createGameCamera` /
`disposeGameRig` are deleted. Games that need the default get
`DEFAULT_GAME_CAMERA`.

**A caveat that costs hours if unknown.** A manifest camera descriptor is the
_initial_ pose. A game whose own code drives the camera per frame — little-shark's
`camera/followCamera.ts` overwrites position and orientation on every tick —
renders from that code, not from the descriptor. Reading the manifest to find
out what the player sees will give the wrong answer for such a game. The
descriptor is authoritative only for cameras nothing else touches.

---

## 8. InteractionController <a id="interactioncontroller"></a>

**Problem.** Five ways to make something tappable
(`createWorldTapDispatcher`, `createInputDispatcher`, `createTapInteraction`,
`wireToyboxInteractions`, the room `userData.onClick` scan). The two child-UX
rules — **no dead tap** (every tap acknowledges) and **toddler smear-tap
forgiveness** (a wobble is still a tap) — lived in only one of them.

**Abstraction.** One controller per surface; register any `Object3D`.

```ts
export interface TapHit {
  object: Object3D;
  /** World-space hit point, or null when matched by the proximity fallback. */
  point: Vector3 | null;
}

export interface TapOptions {
  /** Target participates in dragging, so a past-threshold gesture is a drag, not a forgiven tap. */
  supportsDrag?: boolean;
  /** Handler intentionally makes no sound; suppress the no-dead-tap fallback. */
  silent?: boolean;
}

/** Audio hooks that WOULD let the controller enforce no-dead-tap. See below. */
export interface InteractionAudio {
  soundCount(): number;
  playFallback(): void;
}

export interface InteractionController {
  register(
    obj: Object3D,
    handler: (hit: TapHit) => void,
    opts?: TapOptions,
  ): () => void;
  setProximityRadiusPx(px: number): void;
  setPaused(paused: boolean): void;
}

export function createInteractionController(
  canvas: HTMLCanvasElement,
  camera: Camera,
  scope: DisposalScope,
  audio?: InteractionAudio,
): InteractionController;
```

**There is no `scene` parameter.** Earlier revisions published
`(canvas, scene, camera, scope)`. The real signature is
`(canvas, camera, scope, audio?)` — four parameters in a different order, with
`Camera` (the base class) not `PerspectiveCamera`. Code written from the old
text passes the scene where the camera belongs.

**Centralized rules (the math)** — `utils/interaction/gestureRules.ts`, pure and
exhaustively tested:

- **Tap vs drag.** Accumulate pointer path length `L`. `L < DRAG_THRESHOLD_PX`
  (10) → tap. `DRAG_THRESHOLD_PX ≤ L < WOBBLE_TAP_TOLERANCE_PX` (28) and the
  target has no drag handler → still a tap (toddler forgiveness). `L ≥ 28` → drag.
- **Proximity fallback.** A tap that misses all meshes but lands within
  `PROXIMITY_PX` (70, from fireflies/bubble-pop) of a registered target's screen
  projection fires that target.

(The constants carry `_PX` suffixes; earlier revisions dropped them.)

**No-dead-tap is NOT in force, and this is the largest live gap in the codebase.**
The mechanism is complete and correct in `interactionController.ts`: `fire()`
samples `audio.soundCount()` before and after the handler, and plays
`audio.playFallback()` if the handler emitted nothing and the registration is
not `silent`. But:

1. `audio` is an **optional** parameter, so omitting it silently disables the
   rule rather than failing.
2. **No `InteractionAudio` implementation exists anywhere in `src/`.**
   `grep -rn "soundCount" src/` matches only `interactionController.ts` itself.
3. The only production caller, `utils/worldTapDispatcher.ts:33`, passes three
   arguments.
4. The one call site that _would_ pass audio — `utils/scene/buildScene.ts:72`,
   which forwards `ctx.audio` — is in a function nothing calls (§9).

So every tap that reaches a handler which happens to make no sound is a **dead
tap**, exactly the failure the standard was written to prevent, and the doc
previously asserted the opposite. Closing this needs an `InteractionAudio`
implementation over the sound system plus threading it through
`worldTapDispatcher`; it does **not** need `buildScene` to be wired first.

`pointercancel` resets gesture state (iPadOS). `createInputDispatcher` (games)
imports the same thresholds, preserving its more permissive draggable-wobble
behaviour.

---

## 9. SceneDescriptor (capstone) <a id="scenedescriptor"></a>

**Problem.** Every scene hand-writes an `environment.ts` with a slightly
different shape. There is no single answer to "how is a screen described."

**Status: the schema and builder exist; nothing calls the builder.** Read the
rest of this section as a description of code that is present, compiles, and has
never run in the app.

```ts
export interface SceneDescriptor {
  id: SceneId;
  camera: CameraDescriptor; // §7
  lighting: LightingDescriptor; // §6
  ground: GroundDescriptor;
  backdrop?: SkyDescriptor; // sky rig (scene-rendering-standards.md)
  audio: SceneAudioDescriptor; // audio-standards.md
  portals?: PortalDescriptor[];
}

export interface SceneRuntime {
  clock: FrameClock;
  scope: DisposalScope;
  camera: PerspectiveCamera;
  lighting: LightingRig;
  interaction: InteractionController;
  ground: Mesh;
  sky: Mesh | null;
}

export function buildScene(
  scene: Scene,
  d: SceneDescriptor,
  ctx: SceneBuildContext,
): SceneRuntime;
```

`buildScene` composes the camera, lighting rig, ground, backdrop (skydome via
the sky rig), audio, portals, a `FrameClock`, a `DisposalScope` (published via
`setSceneRuntime`), and an `InteractionController` — the whole "how a screen is
described" in one place.

**What is actually true at runtime.**

- `buildScene` has **zero call sites** in `src/`. Nature builds via
  `buildSceneBase` + a bespoke `environment.ts`, as it always has.
  `grep -rn "buildScene" src/` matches `utils/scene/` and the unrelated
  `buildSceneBase`, nothing else.
- `getSceneDescriptor` has zero call sites. `SCENE_DESCRIPTORS` is read only by
  its own test.
- The contract test **does not execute the builder**.
  `tests/framework/sceneDescriptor.test.mjs:30` reads `buildScene.ts` with
  `readFileSync` and asserts that the source text contains
  `createLightingRig(`, `createGradientSkydome(`, `createInteractionController(`
  and `scope.dispose()`, plus a regex for `if (d.backdrop)`. Those assertions
  hold for a function that is never invoked — which is the case — so the suite's
  green is not evidence that any screen is built this way.

The descriptor validation _is_ real: it runs `validateSceneDescriptor` against
every registered descriptor and cross-checks camera poses and audio ids against
`sceneCatalog.ts`. That prevents the registry from becoming internally
inconsistent. It cannot prevent the registry from diverging from what renders,
because the two are not connected.

**What was genuinely delivered by this phase.** Nature's last bespoke backdrop —
the flat `PlaneGeometry` sky — was migrated to `createGradientSkydome`
(screenshot-verified, diorama preserved). That shipped and is live. It just did
not arrive via `buildScene`.

**To finish the phase**, a scene's runtime must call `buildScene` instead of its
bespoke factory, and the contract test must import and invoke the builder
against a stub scene rather than reading it as text. Until both happen, this
section documents an intention, and the honest state is **landed, not wired**.

---

## Testing & rollout

Every phase must leave all gates green and is committed/shipped on its own.

**Every framework-level / standardization primitive ships contract unit tests
that cite the driving doc.** This is a standing rule, not a per-phase option:
the whole point of a standard is that regressions are caught, so each primitive
gets a `node --test` suite whose header names the `architecture-standards.md`
anchor it enforces and whose cases pin the load-bearing behaviours (not
incidental details).

**A phase is not "done" until its tests exist — and a test is not evidence until
it can fail.** §9 is the cautionary example: a green suite that string-matches
source proves the file contains some characters, not that the system works.
Before trusting a new suite, mutate the thing it guards and confirm the suite
goes red. A suite that survives a deliberate break is decoration.

**Suite inventory** — 40 `.test.mjs` files (`find tests -name '*.test.mjs' | wc -l`):

| Directory                  | Files | Covers                                                                                                                                                                                                    |
| -------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/framework/`         | 12    | `math`, `disposal`, `frameClock`, `idleAnimator`, `lightingRig`, `cameraDescriptor`, `gestureRules`, `sceneDescriptor`, `celebrationSystem`, `frame-loop-guardrail`, `inputDispatcherTap`, `scoreDisplay` |
| `tests/minigame-template/` | 7     | the minigame authoring contract                                                                                                                                                                           |
| `tests/room-template/`     | 5     | the room authoring contract                                                                                                                                                                               |
| `tests/template/`          | 5     | shared template invariants                                                                                                                                                                                |
| `tests/minigames/`         | 5     | per-game logic (incl. `little-shark-regions.test.mjs`)                                                                                                                                                    |
| `tests/room/`              | 4     | room wiring                                                                                                                                                                                               |
| `tests/particles/`         | 1     | the ParticleEngine contract                                                                                                                                                                               |
| `tests/audio/`             | 1     | the audio-standards contract                                                                                                                                                                              |

Earlier revisions of this section named 5 suites and implied that was the whole
picture.

`package.json`'s `test` script globs **per directory**
(`node --test tests/template/*.test.mjs tests/room/*.test.mjs …`), listing all
eight directories above. A new suite dropped into an existing directory is
picked up automatically; a suite in a **new** directory silently never runs
until that directory is added to the script. Check the script when adding a
test directory — a suite that does not run is worse than no suite, because the
gates stay green.

**Two testing styles, by what the code needs at runtime:**

- **Behavioural** (preferred) for logic that needs no DOM/WebGL — math, the
  disposal scope, the frame clock, the gesture rules, region geometry. The
  _actual_ implementation runs.
- **Source-contract** for code that needs a browser at runtime (WebGL, canvas
  textures) — e.g. the ParticleEngine, whose batches upload GPU textures. Its
  math is validated behaviourally in isolation (area-correct cone sampling) and
  its structure by parsing source for the invariants. **Use this style only when
  the behavioural style is impossible**, and say so in the suite header. It is
  the weaker instrument: it cannot distinguish working code from unreachable
  code, which is precisely how §9's status went unnoticed.

**The TypeScript loader — `tests/framework/_tsload.mjs` exports two functions:**

- `loadTs(relPath)` — esbuild **transform** only, no bundling. For a module that
  imports nothing, or only real npm packages.
- `bundleTs(relPath)` — esbuild with `bundle: true`, `external: ['three']`, and
  `alias: { '@app': <packageRoot>/src }`, resolving the alias exactly as
  `vite.config.ts` does. For a module that imports the `@app/*` alias or sibling
  `.ts` files.

Earlier revisions carried the caveat "files using the `@app/*` alias can't load
this way yet." **That limitation was lifted by `bundleTs`** and the caveat is
withdrawn. If a module under test reaches across the alias, use `bundleTs` — do
not restructure the module to satisfy `loadTs`.

Visual phases (4–7) additionally get a screenshot smoke check over the affected
routes; the camera phase (5) and backdrop migration (7) are screenshot-gated per
scene because they change framing.

---

## Open work, in priority order <a id="openwork"></a>

Consolidated from the sections above so it is not spread across eight
status cells. Each item is a claim this document previously made and could not
support.

1. **§8 — implement `InteractionAudio` and pass it.** No-dead-tap is the only
   child-UX rule in this document that is asserted and not enforced. One
   implementation over the sound system, threaded through
   `utils/worldTapDispatcher.ts:33`, closes it. Highest value: it is a
   correctness rule for a three-year-old, not an architectural nicety.
2. **Phase 3 — kill the `toyTrain.ts:234` puff timer** and cancel the
   self-rescheduling horn at `:245`/`:248`. It is the last known un-killed
   `repeat: -1`, and it sits in a file the previous revision listed as fixed.
3. **§9 — wire one scene through `buildScene`**, and convert
   `sceneDescriptor.test.mjs` from source-matching to invoking the builder. Do
   these together; either alone leaves the phase unverifiable.
4. **§3 — migrate the 13 shim importers** off `mathHelpers`/`mathUtils` so the
   shims can be deleted, and fold the `cannonball-splash/helpers.ts:41` `lerp`
   export into `utils/math.ts`. Leave the two little-shark private copies —
   games stay independently deletable.
5. **§6 — decide whether `shadow: false` is needed** before another screen works
   around the unconditional `castShadow`.

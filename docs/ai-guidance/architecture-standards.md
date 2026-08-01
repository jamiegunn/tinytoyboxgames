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

An earlier revision marked every phase **done**, which collapsed those three
states into one and hid the two largest facts about the codebase: that the
capstone (§9) has never executed, and that §8's headline child-UX guarantee was
not enforced at runtime. §9 is still **landed, not wired**. §8's guarantee was
wired in `7e3d6b0` and is now measured (0 silent taps of 12500); the revision
that fixed it left the claim standing in three other places on this page, which
is the ordinary way a document like this rots — a fix updates the section it
touched and not the summaries above it.

There are also two sections here that are **not** phases. §10 and §11 are
cross-cutting invariants from the scene review rounds, both about code that
reads as working and is not. They have no row in the status table below because
they were never sequenced; they are enforced by test and by doctrine.

**Verification convention.** A claim about a count, a call site, or an absence
carries the command that produced it, so the next reader can re-run it instead
of trusting this file. Counts are current as of the commit that last touched
this document.

---

## The meta-pattern

The duplication was not random — it was exactly one scenes-version and one
minigames-version of each subsystem. This table is the **historical diagnosis**;
the "Now" column records where each concern actually stands today.

| Concern        | Scenes stack (was)                                                                 | Minigames stack (was)                                                | Now                                                                                                                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disposal       | `disposeSceneResources`, `createDisposeCollector` (`utils/sceneHelpers.ts`)        | `disposeMeshDeep` (`minigames/shared/disposal.ts`), `disposeGameRig` | **partial** — `DisposalScope` (§1) is canonical and `createDisposeCollector` is an adapter over it, but `disposeMeshDeep` is still an independent implementation with 23 call sites; `disposeGameRig` deleted                                                                                                  |
| Frame loop     | per-effect `requestAnimationFrame`                                                 | per-effect `requestAnimationFrame`                                   | **in force** — one `FrameClock` per surface (§2)                                                                                                                                                                                                                                                               |
| Particles      | `utils/particles.ts`, `utils/particleFactory.ts`                                   | `minigames/shared/particleFx.ts`                                     | **in force** — one engine (§4); all 3 legacy modules deleted                                                                                                                                                                                                                                                   |
| Idle animation | `utils/animationPresets.ts` + raw `gsap`                                           | raw `gsap`                                                           | **in force** — `IdleAnimator` (§5); the last un-killed `repeat: -1` was closed in `c8cacc5`; `animationPresets.ts` reached 0 importers against `animationRunners.ts`'s 11 and was deleted (§10)                                                                                                                |
| Lighting       | `createSceneLighting` (`LightingConfig`)                                           | `createGameLighting` (`GameLightingOptions`, Babylon "hemispheric")  | **in force** — one `LightingRig` (§6); both legacy entry points are now adapters, verified as delegation edges rather than inferred (§10)                                                                                                                                                                      |
| Camera         | `createSceneCamera` (orbit, Babylon spherical, +π θ)                               | shell fixed camera + `createGameCamera` (beta/radius; often dead)    | **split** — `CameraDescriptor` (§7) is canonical for the 3 `minigames/framework` modules; the 5 scenes still reach cameras through `utils/cameraPresets.createSceneCamera`, which calls nothing in `utils/camera/`. `createGameCamera` deleted. Unlike lighting and interaction, this one never inverted (§10) |
| Interaction    | `createWorldTapDispatcher`, `wireToyboxInteractions`, room `userData.onClick` scan | `createInputDispatcher` (tap/drag + forgiveness)                     | **partial** — one controller (§8); no-dead-tap is enforced and measured (`7e3d6b0`), but only world scenes get the visible half — rooms have the audible half alone                                                                                                                                            |
| Math           | `utils/mathHelpers.ts` (`lerp`)                                                    | `minigames/shared/mathUtils.ts` (`lerp` again)                       | **partial** — `utils/math.ts` is canonical, but both shims are still imported and `lerp` is defined **four** times (§3)                                                                                                                                                                                        |

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

| Phase | Standard                             | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | DisposalScope / FrameClock / math    | **in force** for the clock (`utils/frameClock.ts`); **partial** for disposal — `utils/disposal.ts` is canonical and `createDisposeCollector` now delegates to it (`sceneHelpers.ts:297`, 6 call sites), but `minigames/shared/disposal.ts`'s `disposeMeshDeep` is still a separate recursive walker with **23 call sites across 6 game files** (`grep -rn "disposeMeshDeep(" src/`), and `disposeSceneResources` is still called by both scene factories. **partial** for math — `utils/math.ts` is canonical and `mathHelpers`/`mathUtils` are pure re-export shims, but 6 files still import `mathHelpers` and 7 still import `mathUtils`, so the shims cannot yet be deleted. Behavioural tests in `tests/framework/{math,disposal,frameClock}.test.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.5   | Context integration                  | **in force** — `MiniGameContext` gains `clock`/`disposal`; `createScene` gains a `SceneLifecycle` arg; both surfaces tick the clock and dispose the scope on teardown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2     | ParticleEngine                       | **in force** — `utils/particles/{engine,presets,texture,registry}.ts`; one clock-driven, scope-disposed engine per scene reached via `getParticleEngine(scene)`; all 3 legacy modules deleted. **57 `emit`/`stream` call sites across 35 files** (`grep -rn "\.emit(PARTICLES\|\.stream(PARTICLES" src/`) — the "~35" in the original plan predated the owl and celebration migrations, and the "54 across 33" of the previous revision predated Round 6. Contract test in `tests/particles/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3     | IdleAnimator                         | **in force.** `utils/idle/{idleAnimator,registry}.ts` is reached via `getIdleAnimator(scene)`, wired into both shells, contract-tested in `tests/framework/`. Decor idles use presets (spinningTop, hangingMobile, catPlush, rubberDuck, toyBall, toyTrain's orbit spin) and `register()` covers the keyframe loops (hoppingChick, windUpMouse, toy cars ×2, musicPlayer, animalVisitors). The last un-killed leak — `playroom/floorToys/toyTrain.ts`'s puff tween and self-rescheduling horn — was closed in `c8cacc5` and is pinned by `tests/room/playroom-timer-ownership.test.mjs`; the rule it produced is in §5. The other raw `repeat: -1` sites (owl `entities/owl/idle.ts`, raccoon, snail, skyBackdrop, gamePortal, `living-room/decor/fireplace.ts:137`/`:162`, `animalVisitors.ts:581`, `utils/animationHelpers.ts:161`) each self-manage via a returned cleanup, a `cleanups` array, or a tracked handle — verified individually, not assumed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4     | LightingRig                          | **in force** — `utils/lighting/lightingRig.ts` (`createLightingRig(scene, descriptor, scope)`: directional key + hemisphere fill + point accents, shadow map size from qualityTier, all scope-disposed). `createSceneLighting` and `createGameLighting` are now thin vocabulary adapters onto the one rig — the duplicate rig/shadow implementations are gone and the directional shadow-map leak is fixed. bubble-pop's dead (never-added) game lights were removed. Contract test in `tests/framework/`; parity verified across all **5 scenes + 5 games**. Known limitation: the rig always casts shadows (see §6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5     | CameraDescriptor                     | **split — canonical for games, never adopted by scenes.** `utils/camera/cameraDescriptor.ts` has 3 live importers and all 3 are `minigames/framework`; no scene imports it. The 5 scenes build cameras through `utils/cameraPresets.createSceneCamera`, and `cameraPresets.ts` imports only `three`, `sceneCatalog` and `types/scenes` — it does not call `createCamera`, `sphericalPosition` or anything else here. Lighting and interaction finished by INVERSION (old name kept, body rewritten to call the new engine); camera did not, so the two conventions still both run. Tracked with recomputed numbers in `tests/framework/noAbandonedMigrations.test.mjs` → `camera-unification`. What follows is true of the games' half — `utils/camera/cameraDescriptor.ts` (the ONE three.js `Spherical` convention: θ=0→+Z, θ=π→−Z; `createCamera` for fixed/orbit; fov in degrees). Behavioural test pins it against three.js and both legacy formulas. Games declare a `camera?` descriptor in the manifest; the shell builds and applies it (default `DEFAULT_GAME_CAMERA`, fixed (0,2,5)); the dead never-applied cameras (bubble-pop, fireflies) and the Babylon `createGameCamera`/`disposeGameRig` are deleted. Scene presets fold the old `θ+π` into a native-θ `azimuth: π`. Verified pixel-identical across all 5 scenes + 5 games                                                                                                                                                                                                                                                                                                                                                                                              |
| 6     | InteractionController                | **in force.** `utils/interaction/` owns gesture handling: `createWorldTapDispatcher` is a thin adapter over `createInteractionController`, so scene props, `createTapInteraction`, `wireToyboxInteractions`, and the room `userData.onClick` scan all flow through it with shared rules; `createInputDispatcher` (games) imports the same thresholds. Smear-tap forgiveness, proximity fallback and `pointercancel` reset are live and exhaustively tested via pure `gestureRules.ts`. **No-dead-tap is wired in every scene that owns a dispatcher, and the acknowledgement's depth is now found rather than chosen**: `sceneBridge` supplies the `InteractionAudio` implementation, `worldTapDispatcher` passes it (11758 silent taps of 12500 before, 0 after), and both `worldSceneFactory` and `roomSceneFactory` install the one shared `createMissAcknowledgement(scene)`. The rooms had the audible half and no visual half at all — 26.2–49.7% of the canvas answered nothing a muted child could see — and the obvious repair of copying Nature's fixed `ray.at(12)` depth was **also** wrong: a render probe that raycasts camera→burst found the copied constant invisible over up to 22.0% of a room frame and found Nature's own already-shipped handler invisible over **11.6%** of its landscape frame, behind its own trunks. Anchoring on the raycast hit point and standing off 0.45 units along the world face normal takes the worst room viewport to 0.5% and Nature to 0.3%, with ≥0.866 of the sampled burst core visible everywhere. **`TapOptions.background`** stops an environment-scale surface from eating the small-target forgiveness beneath it (median p(hit) for a steady hand: 0–5.5% → 51–82%). See §8 |
| 7     | SceneDescriptor + backdrop migration | **landed, not wired — the capstone has never executed.** `utils/scene/{sceneDescriptor,buildScene,sceneDescriptors}.ts` exist and are internally coherent, and Nature's flat `PlaneGeometry` sky _was_ migrated to `createGradientSkydome` (screenshot-verified). But **`buildScene` has zero importers — live or dead** — and so does `getSceneDescriptor`. That is now an import-EDGE count out of `tests/framework/_moduleGraph.mjs`, not the `grep -rn` this row used to cite: grep counts a file that mentions a name the same as a file that imports it, and it has produced three wrong verdicts in this repo's review history (§10). Nature still builds via `buildSceneBase` + a bespoke `environment.ts`. The contract test does **not** run the builder: `tests/framework/sceneDescriptor.test.mjs:30` reads `buildScene.ts` as **text** and asserts on substrings (`:244`), so it would pass unchanged if the function were deleted from every code path — which is the current state. The descriptors validate, but nothing stops them drifting from what actually renders. See §9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

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
  listener(target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions | boolean): void;
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

**Subsumes — and how far that has actually gone.** The mapping is
`createDisposeCollector` (→ `add`), `disposeSceneResources` (→ `object3D(scene)`),
`disposeMeshDeep` (→ `object3D`), `disposeGameRig` (deleted). Only the last is
done. The real state, which the previous revision's "in force" concealed:

| Legacy helper            | State                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disposeGameRig`         | deleted                                                                                                                                                                         |
| `createDisposeCollector` | **adapter** — `sceneHelpers.ts:297` builds a `DisposalScope` internally, so its 6 callers get LIFO order, idempotence and exception isolation without knowing it. Safe to leave |
| `disposeSceneResources`  | **independent** — still called by `worldSceneFactory.ts:145` and `roomSceneFactory.ts:153`                                                                                      |
| `disposeMeshDeep`        | **independent** — a second recursive geometry/material walker, 23 call sites across 6 game files (`minigames/shared/disposal.ts`)                                               |

`createDisposeCollector` being an adapter is the same pattern §6 uses for
lighting, and it is fine: one implementation, two vocabularies. The other two
are genuinely a second implementation, and that is the open part of Phase 1.

**The ownership rule: whoever constructs it closes it.** `DisposalScope` answers
"when is this torn down"; it does not answer "by whom", and getting that wrong
produces a defect that no leak test catches because it looks like diligence. The
worked example is the Web Audio context. `initEngine(audioContext)` _receives_ a
context; `AudioProvider` _constructs_ one. Adding `ctx.close()` to
`disposeEngine()` — the intuitive fix, and the wrong one — would close a handle
the engine borrowed and cannot know its caller has finished with. So the rule is
that a module which receives a resource may drop its references to it and must
not release it, and the constructing site owns the release. `AudioProvider`'s
effect cleanup closes the context it made; `disposeEngine` still only nulls.

A corollary that cost real time: **closing is not enough if the handle is
retained.** React 19's StrictMode re-runs an effect on the same instance after
tearing it down, so cleanup that closes the context but leaves it in the ref
hands the second pass a dead handle and kills dev audio permanently — a fix that
trades a leak for a worse bug. Cleanup nulls the ref _and_ closes. Pinned
behaviourally in `tests/audio/audioContextLifecycle.test.mjs`, which drives the
real component through mount → gesture → unmount → remount against a recording
fake and includes a source scan asserting `AudioProvider` is still the only
`new AudioContext()` in the tree.

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
  subscribe(cb: (dtSeconds: number, elapsedSeconds: number) => void): () => void;
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
  blending: 'additive' | 'normal';
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
  emit(preset: ParticlePreset, position: Vector3, overrides?: EmitOverrides): void;
  stream(preset: ParticlePreset, follow: Object3D | (() => Vector3), rate: number, overrides?: EmitOverrides): StreamHandle;
}
export function createParticleEngine(scene: Scene, clock: FrameClock, scope: DisposalScope): ParticleEngine;
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

**Migration.** `animationPresets.ts` is **deleted**. This paragraph used to say
its keyframe helpers stayed for one-shot reactions (squash/hop/splat), which are
not leaks — true, and it stayed for nobody: seven exported builders, zero
importers, sitting one directory away from `animationRunners.ts`'s eleven. A bet
on shared vocabulary that lost, next to a bet on shared machinery that won, in
the same folder. The last un-adopted raw site,
`playroom/floorToys/toyTrain.ts`, was closed in `c8cacc5`; the migration is
complete and `tests/room/playroom-timer-ownership.test.mjs` keeps it that way.

**What has to be registered, and what does not.** The dividing line is not "is
it a timer" but "can it outlive the scene". A finite tween cannot: the worst it
costs a teardown is one already-scheduled puff that fires into a disposed rig
and does nothing. An endless one always can, and there are two shapes of it —
the declared kind (`repeat: -1`) and the disguised kind, a `gsap.delayedCall`
whose callback schedules the next `gsap.delayedCall`. The second is the one that
gets missed in review, because no line of it says "forever".

**Register the live handle once, not each reschedule.** The self-rescheduling
shape tempts a `register()` inside the callback, which is wrong in a way that
looks right: `DisposalScope.add` pushes onto an array that is never compacted,
so an eight-second horn on a ten-minute session registers seventy-five dead
handles and trades a leak for a slower leak. Register an indirection that reads
the current handle instead:

```ts
const idle = getIdleAnimator(scene);
idle.register(gsap.to({}, { duration: 0.8, repeat: -1, onRepeat: emitPuff, onStart: emitPuff }));

let hornCall = gsap.delayedCall(6, hornInterval);
function hornInterval(): void {
  triggerSound('sfx_hub_train_horn');
  hornCall = gsap.delayedCall(12 + Math.random() * 8, hornInterval);
}
idle.register({ kill: () => hornCall.kill() });
```

`register` takes anything with a `kill()`, so the object literal on the last
line is a first-class registration, not a workaround. It is registered once and
always kills whichever handle is live at teardown.

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

export function createLightingRig(scene: Scene, d: LightingDescriptor, scope: DisposalScope): LightingRig;
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
  kind: 'fixed';
  position: Vector3;
  target: Vector3;
  fov: number; // vertical, DEGREES
}
export interface OrbitCameraDescriptor {
  kind: 'orbit';
  target: Vector3; // orbit centre
  azimuth: number; // θ radians; 0 → +Z, π → −Z
  polar: number; // φ from +Y, radians
  distance: number;
  fov: number; // vertical, DEGREES
}
export type CameraDescriptor = FixedCameraDescriptor | OrbitCameraDescriptor;

/** The default mini-game camera: the fixed shell view at (0, 2, 5). */
export const DEFAULT_GAME_CAMERA: FixedCameraDescriptor;

export function createCamera(d: CameraDescriptor, aspect: number): PerspectiveCamera;
export function sphericalPosition(target: Vector3, azimuth: number, polar: number, distance: number, out?: Vector3): Vector3;
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
  /** Environment-scale surface (ground, water): still tappable, but last in the queue. */
  background?: boolean;
}

/** Audio hooks that let the controller enforce no-dead-tap. */
export interface InteractionAudio {
  soundCount(): number;
  playFallback(): void;
}

/** `userData` key mirroring `TapOptions.background` onto a registered object. */
export const TAP_BACKGROUND_KEY = 'tapBackground';

export interface InteractionController {
  register(obj: Object3D, handler: (hit: TapHit) => void, opts?: TapOptions): () => void;
  setProximityRadiusPx(px: number): void;
  /** Answers a tap that matched nothing; receives the camera ray through the tap. */
  setMissHandler(fn: ((ray: Ray) => void) | null): void;
  setPaused(paused: boolean): void;
}

export function createInteractionController(canvas: HTMLCanvasElement, camera: Camera, scope: DisposalScope, audio?: InteractionAudio): InteractionController;
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

**The arbitration order IS the child-UX policy**, so `onPointerUp` writes it out
as four numbered rules rather than leaving it implicit in the control flow:

1. a mesh the child could see themselves aiming at wins outright;
2. otherwise a small target near the finger wins, because that is what the tap
   was for even though it landed beside the thing;
3. otherwise the environment surface under the finger wins, so open ground and
   open water are still tappable;
4. otherwise nothing was hit at all, and soul.md#6 still owes the child an
   answer — `setMissHandler` supplies the visible half, the controller supplies
   the audible half.

**Rule 4's answer is FOUND, not chosen, and there is one implementation of it for
the whole codebase.** `utils/interaction/missAcknowledgement.ts` exports
`createMissAcknowledgement(scene)`; both `worldSceneFactory` and
`roomSceneFactory` install it and neither is permitted a sparkle depth of its own.
The rule this encodes is worth stating in general terms because it is not about
sparkles: **a reaction placed at a distance the author picked in advance is a
reaction the world can hide.** The old handler chose 12 units along the tap ray,
with a docblock arguing that the sky has no geometry so nothing could come
between. The sky has no geometry; the trees do. A render probe that raycasts
camera→burst found 11.6% of Nature's missed taps at 1280×720 emitting behind its
own trunks and canopies, and a literal copy of the same constant into the three
rooms was invisible over up to 22.0% of a frame — the shell is walls at |x| ≤
5.4–6.0 and a ceiling at y = 6.2–6.75, and the camera orbits at 14.

So the handler raycasts, anchors the burst on `hit.point`, lifts it along the
world-space face normal (flipping the normal toward the camera, because room walls
are boxes seen from inside and some authored geometry is wound the other way), and
uses the 12-unit constant **only** in the branch where the ray hit nothing at all —
a premise that is true by construction rather than by argument. Transparent
materials and invisible meshes are skipped: `Raycaster` tests neither, and Nature's
registered water plane is a transparent mesh spanning the pond, so treating it as a
surface would make the pond answer differently from the grass beside it.

**The standoff is 0.45 world units and both of its bounds are load-bearing.** The
ceiling is the world equivalent of the slack the codebase already accepts —
`PROXIMITY_PX = 70` at a 14-unit orbit and `SCENE_CAMERA_FOV = 50` is 1.269 units,
beyond which the burst stops reading as being under the finger. The floor is the
burst's own lateral reach — `SCENE_SPARKLE`'s cone half-angle is 0.82 rad, so a
particle at the graded core radius of 0.5 sits 0.366 units sideways, and on a wall
"sideways" is into the plaster. A first attempt used 0.25, satisfying the ceiling
and never computing the floor; it cured the anchor completely (22.0% → 0.5%) and
still left only 0.464 of the burst core visible against a 0.50 bar committed to in
advance. `tests/room/miss-acknowledgement.contract.test.mjs` re-derives the whole
window from those four constants, in the four files they live in, so changing any
of them fails at this decision instead of quietly invalidating it. After: worst
room viewport 0.5%, Nature 0.3%, core visibility ≥ 0.868 in every room.

**`background` is what makes rule 2 reachable at all.** The raycast runs first
and used to return on any hit, so a registered target spanning the frame
silently disabled the forgiveness below it: a tap aimed at a mushroom and
landing a finger-width off never "missed every mesh", it hit the ground, and
`pickByProximity` was never consulted. Measured in Nature before the flag
existed — the ground answered 52–62% of the canvas at all nine shipping
viewports, a flower's entire catchment was its own 36 px² silhouette, and a
steady-handed child reaching for one got it 2% of the time. The same first-hit
rule made small props under a **transparent** registered surface unreachable
outright (a raycast reads geometry, not appearance): two leaves staged under the
Nature stream measured zero tappable pixels everywhere. `pickRegistered` now
keeps the nearest ordinary hit and the nearest background hit separately, and
`pickByProximity` skips background surfaces entirely — an environment plane's
origin is the middle of the world, so leaving it in a nearest-centre contest
would re-create the problem the flag exists to solve. After: median p(hit) for a
steady-handed child rose from 0–5.5% to 51–82% at eight of the nine viewports.

**`background` means one thing, and it is not "scenery".** The name invites two
readings that the code does not support. It does not mean "this is environment
rather than a prop" — that is a description of the object, and the flag is not
about the object. It does not mean "this does not react" — a background target
still fires its handler on a direct hit, exactly like any other registration.
It means precisely this: **the target is excluded from `pickByProximity`, so it
can be tapped ON but never tapped NEAR.** Everything else about it is unchanged.

So the test to apply at a call site is **not** "is this scenery?" but: _would
this target's centre win proximity contests it has no business winning?_ An
origin that sits in the middle of the world, on an object whose silhouette
spans the frame, wins them constantly — which is why ground planes, water and
the Nature stream carry the flag. But the test is about the origin and the
extent, not about the category, and it can come out **true for an object a
child aims at deliberately**.

Pirate Cove's **sail** is that case, and it is the one worth knowing, because
"largest object in the scene, obviously a prop, obviously not background" is the
intuition the flag has to survive. Registered as a plain prop the sail won 185 /
230 / 204 / 215 near-miss samples across the four shipping viewports, and 36 /
0 / 16 / 8 of those were stolen from `parrot_prop` — the smallest and highest
thing on the rig — because the sail's origin sits at the sail head, right under
the crow's nest. Flagging it hands those back.

The mirror-image fear is the one to actually check: that a finger landing on
sail canvas within 70 px of the parrot's centre now fires the bird, re-creating
the defect in reverse. Measured at two grid pitches, that cost is **zero** — the
sail's ray-hit count is identical with and without the flag (718 / 1456 / 1010 /
1122 at 6 px, 181 / 362 / 251 / 284 at 12 px), because no prop centre comes
within 70 px of the sail's silhouette at any shipping viewport. The trade is
only free because that was measured rather than assumed, and a scene where a
prop _did_ sit that close would owe a different answer.

The nearest background wins, not an arbitrary one: `pickRegistered` iterates
hits in distance order and keeps the first background it sees, so the sail at
~14.8 units outranks the sea at 29+ even though both carry the flag. The
identical hit counts above are the proof of that ordering — had the sea
outranked the sail, they would have collapsed rather than held.

**No-dead-tap is now in force.** `assets/audio/sceneBridge.ts` counts sound
_requests_ (it ticks even when audio is unarmed or muted, because the question is
whether the interaction tried to speak), and `worldTapDispatcher` passes
`{ soundCount, playFallback }` — the fourth argument every earlier revision
omitted. `wireFloorTap` registers the floor as `background`, and
`worldSceneFactory` sets a miss handler that emits a sparkle on the camera ray,
which is the half that still arrives on a muted device. Verified by dispatching
real pointer events on a 20 px grid at all nine viewports: **11758 of 12500 taps
silent before, 0 after.** Room scenes get the audible half automatically (same
dispatcher) but not yet the visible half — `roomSceneFactory` sets no miss
handler, because a fixed-depth sparkle indoors can land inside a wall.

Behaviourally pinned in `tests/framework/tapArbitration.test.mjs`, where each
"the prop wins" assertion is paired with a control registering only the
environment surface — otherwise the test would pass equally if the tap point
had simply been over empty sky.

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

export function buildScene(scene: Scene, d: SceneDescriptor, ctx: SceneBuildContext): SceneRuntime;
```

`buildScene` composes the camera, lighting rig, ground, backdrop (skydome via
the sky rig), audio, portals, a `FrameClock`, a `DisposalScope` (published via
`setSceneRuntime`), and an `InteractionController` — the whole "how a screen is
described" in one place.

**What is actually true at runtime.**

- `buildScene` has **zero importers, live or dead**. Nature builds via
  `buildSceneBase` + a bespoke `environment.ts`, as it always has. This used to
  be stated as a `grep -rn "buildScene" src/` result; it is now an import-edge
  count from `tests/framework/_moduleGraph.mjs`, recomputed on every run by
  `noAbandonedMigrations.test.mjs`. The two agree here, which is luck rather
  than method — see §10 on why a grep count is not an import count.
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

**Why it is still here, and what it is not.** Deleting these three files is the
cheapest way to empty the reachability allowlist, and it would be a bad trade:
it removes the only place in the repo where the intended composition is written
down in one readable form, while leaving both imperative roots
(`createWorldScene` ×2, `createRoomScene` ×3), every disposal mechanism and the
never-adopted `SceneLifecycle` parameter exactly where they are. The codebase
would be measurably tidier and strictly less honest. So it is kept — and kept
under a register entry that recomputes its own numbers rather than under a
sentence nothing checks. Read the paragraph above as a standing intention with
no owner, not as a queued task: the last module in this repo that looked
obviously worth wiring in would have cost 72% of its game's headline metric
(§10). Whoever finishes this phase should expect to prove it helps first, and
`noAbandonedMigrations.test.mjs` → `scene-composition` states what the proof has
to cover.

---

## 10. Nothing inert <a id="nothinginert"></a>

Sections 1–9 are migration phases: each names a duplication and replaces it with
one primitive. This section and the next are not phases. They are cross-cutting
invariants that came out of the scene review rounds, and they share a subject —
**code that reads as working and is not**. That is a distinct failure mode from
duplication, and a worse one, because every ordinary signal (it compiles, it is
documented, it is internally consistent, the tests are green) points the wrong
way.

**Unreachable code is a correctness defect, not untidiness.** A static sweep
found 2,000+ lines under `src/` that nothing loads. The worst of it was not
stubs or fragments: `little-shark/fish/`'s five-species roster is 963 lines,
complete, documented, internally consistent, and answers a complaint the game
had actually received. Every signal said "finished feature, someone forgot the
wire" — and measurement said wiring it in would have cost 72% of the reef's
worst-case legibility. The danger is not the wasted bytes. It is that the next
reader, human or model, concludes the app does something it does not, or
helpfully connects it.

**Reachability, not an unused-export check.** This is the part that has to be
got right, because the weaker instrument has a hole it cannot see past: file A
imports a symbol from file B, so B's export is "used" — but nothing imports A
either. The reference is real and the code is still unreachable. That is exactly
how the species cluster hid, with `fish/meshes.ts` and `waves/templates.ts` both
importing `FishSpeciesId` from `fish/species.ts`, so all three looked referenced
while being orphans together. The same hole was live in the allowlist until this
round: three of the then-four `utils/*` barrels _were_ imported — only by
`utils/scene/`, which is itself unreachable. One connected dead component wearing
four independent-looking entries. A fifth barrel (`utils/idle/index.ts`) turned
up during the sweep, at zero in both directions. All five are now deleted.

`tests/framework/noUnreachableModules.test.mjs` walks static imports,
`export … from`, and `import()` with a literal specifier, starting from the real
browser entry point, and subtracts what `tests/` and `.probe/` reach. It cannot
follow a computed `import()` or a non-import path (a worker URL, a string handed
to a bundler plugin), so it **fails loudly on any computed `import()` it finds**
rather than quietly widening the graph — the fix for one is to judge that edge
by hand, never to allowlist its target.

**The allowlist is a list of admissions, not permissions.** Each entry states
why the module is unreachable and what the live mechanism is instead. Adding an
entry is deliberately cheap: the goal is not to forbid dead code but to make it
impossible to leave lying around _silently_. It is checked in both directions —
an unreachable module missing from the list fails, and an entry naming a module
that is no longer unreachable **also** fails. Without that second check the list
rots into a graveyard of names that were dead once, which is worse than no list,
because it is a document asserting a state the codebase has left.

**And a cheap entry has a price the list cannot show you.** The allowlist reached
thirteen entries and 862 lines before anyone read it as a whole, and read whole
it said something none of its entries said: this repo starts unifications and
leaves them looking unfinished. The per-file format is what kept that invisible —
thirteen specific true sentences average out to no claim at all. Worse, one of
them was not true. "All 17 consumers import `utils/idle/idleAnimator` directly"
described a **grep count** as an import count; exactly one file imports it, and
the other sixteen reach the animator through `utils/idle/registry.ts`, which is
already the public surface — which is why a second one had nothing to offer. A
wrong sentence sitting in a list of thirteen is indistinguishable from a right
one, because nothing checked the sentences. The allowlist is now three entries;
the subject matter that left it is in the register below.

**Migrations in this repo complete by INVERSION, so an importer count is evidence
of nothing on its own.** This is the correction that cost the most to find. The
pattern here is: the old function keeps its name and signature and its body is
rewritten to call the new engine. Every call site keeps the import it already
had, so the new module ends up with two or three importers and reads as
stillborn while being universal. Measured at the import edge:
`createGameLighting` (3 callers) now builds its lights by calling
`createLightingRig` at `minigames/shared/sceneSetup.ts:47`; `createDisposeCollector`
(5 callers, all scenes) opens with `createDisposalScope()` at
`utils/sceneHelpers.ts:351`; `createWorldTapDispatcher` is a thin adapter that
constructs `createInteractionController` at `utils/interaction/worldTapDispatcher.ts:45`,
and `createTapInteraction`'s 15 prop-file callers flow through it. Three names
for one entrance is a naming debt; it is not an unfinished migration. So the
question that makes a count meaningful is never "how many import it" but **"and
does the old API call the new one?"** — which is exactly the failure a count
cannot see: pasting the light-building back into `createGameLighting` would leave
every importer number correct and every other test green.

`tests/framework/noAbandonedMigrations.test.mjs` is the enforcing half. It holds
the same subject matter aggregated by MIGRATION rather than by file, every claim
carries a number a test recomputes from import edges, and it asserts the
delegation edges themselves. Five states are in use: `inverted` (adoption total,
import count low), `split` (two mechanisms live, neither calling the other —
camera, §7), `abandoned` (nothing routes through it by any path — `buildScene`,
and the `SceneLifecycle` fourth argument at 0 of 5), and `resolved` (decided and
closed, recorded so it cannot silently restart — the five barrels). Entries leave
the reachability allowlist for this file when what is wrong with them is not
"unreachable" but "unfinished".

The instrument lesson underneath all of it: **grep counts a file that mentions a
name the same as a file that imports it**, and it has now produced three wrong
verdicts in this review's history — "duck" matching 36 rubber ducks, "lifecycle"
matching a docblock sentence, and the false 17 above, which is the one that
shipped. Reach for the module graph, not the text.

**A guard that cannot fire is worse than no guard.** Same failure mode, different
shape: not code nothing reaches, but code everything reaches that does nothing.
`audioEngine.registerSound` carried a doc line promising "returns false if the
polyphony limit is exceeded", a `MAX_SFX = 4` cap, and an eviction branch. Every
part was inert — the body had one `return` and it was `return true`; no call site
read the value; and eviction only ever selected entries whose `stop()` was
`AudioProvider`'s `const stopFn = () => {}`, so it removed a row from an array
and silenced nothing. The cost is not the dead branch. It is that any reader
auditing "is polyphony bounded?" finds a cap, and stops.

**The repair for an inert guard is measurement, not activation.** The reflex —
make it work — is wrong twice here. First, the danger it claimed to prevent had
never been checked: `.probe/audio/r7-sfx-pileup.mjs` renders the _real_ graph
through Chromium's `OfflineAudioContext` and reads output samples, and twenty
overlapping taps peak at −14.6 dBFS (chomp −1.1, cannonball −8.0). Nothing
clips; the bus compressor is what protects small ears, and it is doing it.
Second, enforcing the cap would have been a regression: `activeSounds` drains on
a five-second timer, so a real `MAX_SFX = 4` refuses a child's fifth tap in five
seconds and returns silence to a deliberate press — the exact defect §11 exists
to remove. So the guard was deleted and the reasoning written where the next
reader will look. **If a limiter is genuinely needed later, it belongs in the
compressor, not in a refusal to answer the child.**

The return type went with it. `registerSound` now returns nothing, because it
never had a decision to report, and `tests/audio/polyphony.test.mjs:78` asserts
`undefined` so that nothing can come to depend on a value again without the
behaviour behind it. Read the paragraph above as history: the doc line promising
`false` is gone from the source, and this is the only place it still appears.

---

## 11. Reactions are sized in pixels <a id="screenspace"></a>

**A reaction that fires, plays a sound, and shows the child nothing is worse
than no reaction**, because it looks fixed — to the developer, to the test
suite, and to review. soul.md#6 is owed a _visible_ answer, and "visible" is a
screen-space property.

**The trap is a preset that works in the scene next door.** Nature's stream
answers a tap with `PARTICLES.waterRipple`, so the obvious fix for Pirate Cove's
inert sea was to copy that line. It does not survive measurement. `waterRipple`
is authored at 0.02–0.06 **world units**, and a particle preset's size is a
material uniform, so `EmitOverrides` can change colour and count but **cannot
change size**. Nature's stream spans camera distances 5.8–10.6 — a 1.8x range,
essentially one depth, where a fixed world size is legitimate. Pirate Cove's sea
spans 14.2–101.4 in landscape and 23.0–142.5 on a phone: **7.1x**, where one
world unit subtends 54 px at the rail and 7.6 px at the far edge. The same
0.06-unit puff renders about 3 px at the rail and under one pixel at the
horizon.

**So the rule is: check the depth spread before reusing a world-unit reaction.**
Under roughly 2x, world units are fine. At Pirate Cove's spread they are not,
and the reaction must be sized from the depth it was struck at:

```
pxPerUnit(d) = (h / 2) · f / d,        f = projectionMatrix.elements[5]
radius       = PROXIMITY_PX · d / (h · f)
```

where `d` is the point's **depth along the view axis** — distance from the eye
is a different number and the wrong one.

**Where the pixel target comes from — not from taste.** `PROXIMITY_PX`
(`gestureRules.ts`, §8) is the radius within which this app's own controller
will hand a near-miss to a small target. It is the codebase's single existing
assertion that "this many pixels is a thing a small child can aim at and see",
so a reaction is sized to span exactly that. Reusing an existing constant rather
than inventing one is what makes the number defensible.

**Read `f` and `h` off the live projection matrix and the live canvas**, never
off the authored camera preset. The preset is what the scene _asks for_;
`resize` is free to give it something else per viewport. Round 5 of this review
produced one retracted finding by measuring a camera the app never adopts, and a
second by typing a pixel constant in from memory. Both mistakes are unavailable
to code that reads the live values.

**Cap the honest size where it stops reading as the thing it is.** Past ~65
units the computed radius exceeds three world units and the ring reads as a crop
circle rather than a splash, so it clamps to 0.6 of the hull's beam — which at
the far edge still leaves roughly 45 px of ring, smaller than one at the rail,
which is correct, because it is further away.

**Parent the reaction to what the surface actually moves with.** The rings hang
off `seaAndSky`, not the scene root, because the ambient rig rolls and heaves
that group and deliberately leaves the deck rigid. A ripple on the scene root
would sit still while the water tilted underneath it, breaking the illusion the
whole rig exists to create — at exactly the moment the child is looking hardest
at the water.

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

**Suite inventory** — 66 `.test.mjs` files (`find tests -name '*.test.mjs' | wc -l`):

| Directory                  | Files | Covers                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/framework/`         | 20    | the primitives above (`math`, `disposal`, `frameClock`, `idleAnimator`, `lightingRig`, `cameraDescriptor`, `gestureRules`, `sceneDescriptor`, `celebrationSystem`, `frame-loop-guardrail`, `inputDispatcherTap`, `scoreDisplay`, `playAnimationsSpeed`) plus `tapArbitration`, `pirateCoveInteraction`, `readme-citations`, and the two static-analysis guards — `noUnreachableModules` and `noAbandonedMigrations` (both §10) |
| `tests/room/`              | 16    | room wiring, Pirate Cove composition/hull/ambient motion, playroom contracts incl. `playroom-timer-ownership` (§5), ground coverage, sky/fog                                                                                                                                                                                                                                                                                   |
| `tests/minigames/`         | 8     | per-game logic — seven of the eight are Little Shark (regions, aim, dodge, frenzy, agency, HUD, celebration)                                                                                                                                                                                                                                                                                                                   |
| `tests/minigame-template/` | 7     | the minigame authoring contract                                                                                                                                                                                                                                                                                                                                                                                                |
| `tests/room-template/`     | 5     | the room authoring contract                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/template/`          | 5     | shared template invariants                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tests/audio/`             | 4     | the audio-standards contract, music coverage, polyphony, and `audioContextLifecycle` (§1's ownership rule)                                                                                                                                                                                                                                                                                                                     |
| `tests/particles/`         | 1     | the ParticleEngine contract                                                                                                                                                                                                                                                                                                                                                                                                    |

Earlier revisions named 5 suites, then 40 files, and each time implied that was
the whole picture. The count is worth re-deriving rather than trusting: this
table is a snapshot, and the command that regenerates it is in the heading.

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

**The TypeScript loader — `tests/framework/_tsload.mjs` exports four functions**
(earlier revisions published two, which is why the later two keep being
reinvented per suite):

- `loadTs(relPath)` — esbuild **transform** only, no bundling. For a module that
  imports nothing, or only real npm packages.
- `bundleTs(relPath)` — esbuild with `bundle: true`, `external: ['three','gsap']`,
  and the `@app`/`@scenes`/`@game` aliases resolved exactly as `vite.config.ts`
  does. For a module that imports an alias or sibling `.ts` files.
- `bundleEntry(name, source)` — bundles a **synthetic entry**, a snippet of TS
  written for the test, together with everything it imports, into one bundle.
- `bundleComponent(name, source)` — the same, plus a fake `react` swapped in by
  an esbuild plugin, so a test can drive a component's effect lifecycle by hand.

Earlier revisions carried the caveat "files using the `@app/*` alias can't load
this way yet." **That limitation was lifted by `bundleTs`** and the caveat is
withdrawn. If a module under test reaches across the alias, use `bundleTs` — do
not restructure the module to satisfy `loadTs`.

**Why `bundleEntry` exists, which is not obvious and cost a green-but-empty
suite to learn.** `bundleTs` produces a self-contained module graph _per call_,
so two `bundleTs` calls that both reach `utils/idle/registry.ts` end up with two
copies of its module-private `WeakMap`. A test that bundles a scene rig one way
and the registry another can call `setSceneIdleAnimator` all it likes: the rig's
`getIdleAnimator` consults a different map, finds nothing, and falls back to the
no-op animator — which returns a well-formed handle for every preset, so every
assertion passes while proving nothing. One entry that re-exports both sides
fixes it, because there is then one instance of each module. **The general rule:
if a test depends on module-private state being shared, everything that touches
that state must come from a single bundle call.**

**Why `bundleComponent` needs a fake React.** React's hooks dispatch through an
internal renderer, so importing the real package and calling a component throws
"invalid hook call" — you need `react-dom` or `react-test-renderer`, and this
package ships neither. The stub gives the one thing a lifecycle test needs:
`useEffect` bodies captured as values, so a test can run an effect, run its
cleanup, and run it again — mount, unmount, and StrictMode's double-invoke, by
hand. `useState` returns the initial value and a no-op setter, so **anything
asserted must be observable outside React state** (a closed `AudioContext`, a
removed listener). That is a feature, not a limitation: it keeps these tests
pointed at real side effects rather than at re-render bookkeeping the stub
cannot model. Two mechanical traps, both already paid for: the re-exports must
go through the synthetic entry (an esbuild `footer` is appended _after_
bundling, so a `from 'react'` re-export written there resolves to the real
package at import time), and `import.meta.env.DEV` must be `define`d, because
`platform: 'neutral'` leaves `import.meta.env` undefined and any dev-only warning
branch throws.

Visual phases (4–7) additionally get a screenshot smoke check over the affected
routes; the camera phase (5) and backdrop migration (7) are screenshot-gated per
scene because they change framing.

---

## Open work, in priority order <a id="openwork"></a>

Consolidated from the sections above so it is not spread across a dozen status
cells. Each item is a claim this document makes and cannot yet support.

**Closed since the previous revision, recorded so they are not re-opened from
stale prose elsewhere:** the `InteractionAudio` / no-dead-tap item (closed by
`7e3d6b0`; §8 now measures 0 silent taps of 12500, and §8's own text had already
contradicted this list); the `toyTrain.ts` timer item (closed by `c8cacc5`,
pinned by `tests/room/playroom-timer-ownership.test.mjs`; the rule it produced is
in §5); and **the visible half of no-dead-tap in room scenes**, which this list
had described correctly, method included — _"a depth-aware miss response, which is
§11's problem restated — solve it with §11's method, by measuring where the ray
meets room geometry, not by picking a depth."_ That is what
`utils/interaction/missAcknowledgement.ts` does. Measuring it first also turned up
the part this list did not predict: the same fixed-depth flaw was already shipping
in Nature, invisible over 11.6% of its landscape frame behind its own trees. So
the fix is shared by both scene factories rather than added to the rooms. See §8;
the round is written up in `docs/reviews/2026-07-30-rooms-five-rounds.md`.

1. **§7 — the camera split, the last unification that did not invert.** The 3
   `minigames/framework` modules use `cameraDescriptor`; the 5 scenes use
   `utils/cameraPresets.createSceneCamera`, which calls nothing in
   `utils/camera/`. Two conventions, both live. Lighting and interaction closed
   the same shape by rewriting the old function's body onto the new engine while
   keeping its name — the cheap move here is the same one, and it has a
   prerequisite this list should state: lighting and interaction each have a
   behavioural contract test pinning the delegation, and camera does not, so
   inverting `createSceneCamera` today would be unpinned at the exact seam that
   matters. Write the test first. Tracked as `camera-unification` in
   `noAbandonedMigrations.test.mjs`.
2. **§9 — `buildScene` is parked, not queued.** It has zero importers and is
   kept as the only written statement of the intended scene composition; §9 says
   what finishing it would require and why "it looks obviously worth wiring in"
   is the exact signal this document distrusts. Nothing here is blocked on it.
   The rest of the old triage list is closed: the five `utils/*` barrels,
   `bubble-pop/animation/*`, `animationPresets.ts`, `scatterDecoratives.ts` and
   the Pirate Cove parent-scene stub were measured and deleted with
   NOT-HERE-DELIBERATELY blocks, the reachability allowlist is down from thirteen
   entries to three, and the two genuinely-at-zero seams (`buildScene`, the
   `SceneLifecycle` fourth argument) are now carried by the register with
   recomputed numbers. The stub was the sharpest of them: every field in it
   differed from the live Pirate Cove manifest, including a `z: -6.88` sitting
   deep in −z where the frustum is narrowest — a live instruction to undo tuned
   work, one obedient copy-paste away from doing it.
3. **§8 — the miss sparkle's apparent size now varies with the surface it
   answers.** This is the cost of the fix above, and it is a real residual rather
   than a hypothetical: because the burst is placed where the ray meets geometry,
   its distance from the camera ranges 5.6–31.0 world units across viewports and
   aim directions, against the old near-constant 12.0. `sizeAttenuation` is on, so
   a sparkle answering the far wall reads smaller than one answering a near prop.
   The visibility bars this fix was graded against do not measure it. §11's method
   applies — size the reaction in pixels, not in world units — and the probe
   already prints the depth table needed to check it. Also outstanding from the
   same round: 35 residual bursts (of ~10 500 room samples) sit behind geometry
   the tap ray missed but the offset burst does not clear, dominated by the
   Playroom mobile's strings and the Kitchen fridge body; a single-normal standoff
   cannot cure a concave neighbour.
4. **§7 — `resize()` derives less than construction does.** Construction sets
   the orbit radius via `radiusForAspect(preset, aspect)`, so the authored
   distance is scaled for the viewport. `resize` (`utils/cameraPresets.ts:376`)
   recomputes `aspect` and `maxDistance` and then only _clamps_ the existing
   radius into the new bounds — it never re-derives it. A device rotated from
   portrait to landscape therefore keeps a framing computed for the shape it is
   no longer, unless the clamp happens to move it. Decide deliberately whether
   re-deriving would fight a child who has already pinch-zoomed; the current
   behaviour looks like that decision but is not recorded as one.
5. **§3 — migrate the 13 shim importers** off `mathHelpers` (6) / `mathUtils`
   (7) so the shims can be deleted, and fold the
   `cannonball-splash/helpers.ts:41` `lerp` export into `utils/math.ts`. Leave
   the two little-shark private copies — games stay independently deletable.
6. **§6 — decide whether `shadow: false` is needed** before another screen works
   around the unconditional `castShadow`.

**A note on how to use this list.** Items 1 and 2 of the previous revision were
both already closed when it was read, and one of them was contradicted by §8's
own text on the same page. Before acting on an entry here, verify it against the
code — the sections above are re-derived at each revision, this list is
consolidated from them, and a consolidation is always the staler artefact.

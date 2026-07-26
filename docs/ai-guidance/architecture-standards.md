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

## The meta-pattern

The duplication is not random — it is exactly one scenes-version and one
minigames-version of each subsystem:

| Concern | Scenes stack | Minigames stack | Evidence |
|---|---|---|---|
| Disposal | `disposeSceneResources`, `createDisposeCollector` (`utils/sceneHelpers.ts`) | `disposeMeshDeep` (`minigames/shared/disposal.ts`), `disposeGameRig` | 4 helpers, ad-hoc per-scene teardown |
| Frame loop | per-effect `requestAnimationFrame` | per-effect `requestAnimationFrame` | effects self-drive rAF, outlive teardown |
| Particles | `utils/particles.ts`, `utils/particleFactory.ts` | `minigames/shared/particleFx.ts` | 3 modules, dup `createSparkleBurst`/`createDustPuff`, dup textures, 32 call sites |
| Idle animation | `utils/animationPresets.ts` + raw `gsap` | raw `gsap` | ~10 decor files with un-killed `repeat:-1` tweens |
| Lighting | `createSceneLighting` (`LightingConfig`) | `createGameLighting` (`GameLightingOptions`, Babylon "hemispheric") | 2 rigs, divergent vocab |
| Camera | `createSceneCamera` (orbit, Babylon spherical, +π θ) | shell fixed camera + `createGameCamera` (beta/radius; often dead) | 3 conventions, mirrored/inverted axes |
| Interaction | `createWorldTapDispatcher`, `wireToyboxInteractions`, room `userData.onClick` scan | `createInputDispatcher` (tap/drag + forgiveness) | 5 entry points; forgiveness only in one |
| Math | `utils/mathHelpers.ts` (`lerp`) | `minigames/shared/mathUtils.ts` (`lerp` again) | `lerp` defined twice |

The remedy is a small set of shared primitives that **both** stacks consume.

---

## Sequencing (dependency order)

Implement bottom-up; each phase is independently shippable behind the gates
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

| Phase | Standard | State |
|---|---|---|
| 1 | DisposalScope / FrameClock / math | **done** — `utils/disposal.ts`, `utils/frameClock.ts`, `utils/math.ts` (mathHelpers/mathUtils now re-export shims); behavioural tests in `tests/framework/` |
| 1.5 | Context integration | **done** — `MiniGameContext` gains `clock`/`disposal`; `createScene` gains a `SceneLifecycle` arg; both surfaces tick the clock and dispose the scope on teardown |
| 2 | ParticleEngine | **done** — `utils/particles/{engine,presets,texture,registry}.ts`; one clock-driven, scope-disposed engine per scene reached via `getParticleEngine(scene)`; all 3 legacy modules deleted, ~35 call sites migrated; contract test in `tests/particles/` |
| 3 | IdleAnimator | **done (leak class closed)** — `utils/idle/{idleAnimator,registry}.ts` (breathe/sway/bob/spin/flicker + loop/register, scope-killed, phase-seeded via seek); reached via `getIdleAnimator(scene)`; wired into both shells; contract test in `tests/framework/`. Every *unmanaged* `repeat:-1` leak is fixed: presets for the decor idles (spinningTop, hangingMobile, catPlush, rubberDuck, toyBall, toyTrain) and `register()` for the interactive/keyframe loops (hoppingChick, windUpMouse, toy cars ×2, musicPlayer, animalVisitors dog). The remaining raw `repeat:-1` sites (owl, raccoon, snail, skyBackdrop, gamePortal) already self-manage via a returned cleanup / owl runtime — not leaks; standardising those onto the animator is optional follow-up |
| 4 | LightingRig | **done** — `utils/lighting/lightingRig.ts` (`createLightingRig(scene, descriptor, scope)`: directional key + hemisphere fill + point accents, shadow map size from qualityTier, all scope-disposed). `createSceneLighting` and `createGameLighting` are now thin vocabulary adapters that map their legacy configs onto the one rig — the duplicate rig/shadow implementations are gone and the directional shadow-map leak is fixed. bubble-pop's dead (never-added) game lights were removed. Contract test in `tests/framework/`; parity verified across all 5 scenes + 4 games |
| 5 | CameraDescriptor | **done** — `utils/camera/cameraDescriptor.ts` (the ONE three.js `Spherical` convention: θ=0→+Z, θ=π→−Z; `createCamera` for fixed/orbit; fov in degrees). Ruthless behavioural test pins it against three.js and both legacy formulas. Games declare a `camera?` descriptor in the manifest; the shell builds+applies it (default fixed (0,2,5)); the dead never-applied cameras (bubble-pop, fireflies) and the Babylon `createGameCamera`/`disposeGameRig` are deleted. Scene presets fold the old `θ+π` into a native-θ `azimuth: π`, removing the offset from `cameraPresets.ts`. Verified pixel-identical across all 5 scenes + 5 games |
| 6 | InteractionController | **done** — `utils/interaction/` (`createInteractionController`: one `register(obj, handler)`; smear-tap forgiveness + proximity fallback via pure `gestureRules.ts`; controller-enforced no-dead-tap; pointercancel reset; scope-disposed). `createWorldTapDispatcher` is now a thin adapter over it, so scene props, `createTapInteraction`, `wireToyboxInteractions`, and the room `userData.onClick` scan all flow through the controller with the shared rules; `createInputDispatcher` (games) imports the same rule thresholds (its more-permissive draggable-wobble behaviour preserved). Pure rules exhaustively behaviour-tested; migration verified by a scripted-tap harness (baseline parity: same props fire for same taps; wobble fires, 80px pan does not; portal-tap navigation works) |
| 7 | SceneDescriptor + backdrop migration | **done** — `utils/scene/{sceneDescriptor,buildScene,sceneDescriptors}.ts`: the one declarative schema (`SceneDescriptor{id, camera §7, lighting §6, ground, backdrop?, audio, portals?}`) and its one builder `buildScene(scene, d, ctx)`, which composes camera + lighting rig + ground + sky-rig backdrop + a single FrameClock/DisposalScope (published via `setSceneRuntime`) + InteractionController, all scope-disposed. The immersive scenes (Nature, Pirate Cove) are registered as descriptors in `SCENE_DESCRIPTORS`, faithful to their `environment.ts` values. Nature's last bespoke backdrop — the flat `PlaneGeometry` sky — is migrated to `createGradientSkydome` (screenshot-verified, preserves the diorama). Contract test in `tests/framework/sceneDescriptor.test.mjs`: validates every registered descriptor (non-empty audio, resolvable backdrop, valid camera), pins the validator's rejections with ruthless boundary cases, and cross-checks each descriptor's camera pose + audio ids against `sceneCatalog.ts` so the registry can't drift. Wiring each scene's runtime to call `buildScene` (vs. the current world/room factories) is the data-driven-authoring on-ramp, tracked as follow-up |

---

## 1. DisposalScope <a id="disposalscope"></a>

**Problem.** Four disposal helpers and ad-hoc per-scene/per-game teardown. When
something is forgotten the result is a leak: `repeat:-1` GSAP tweens that
animate detached objects forever, shadow-map render targets, per-effect rAF
loops. Teardown correctness currently depends on remembering every resource at
every site.

**Abstraction.** A `DisposalScope` is a LIFO registry of teardown actions.
Everything that allocates registers its cleanup; teardown is one call.

```ts
export interface DisposalScope {
  /** Register a raw teardown function. */
  add(teardown: () => void): void;
  /** Dispose an Object3D subtree (geometry, materials, lights) on teardown. */
  object3D(obj: Object3D): void;
  /** Kill a GSAP tween/timeline on teardown (fixes the repeat:-1 leak class). */
  tween(tween: gsap.core.Tween | gsap.core.Timeline): void;
  /** Remove a DOM listener on teardown. */
  listener(target: EventTarget, type: string, fn: EventListener): void;
  /** Create a nested scope disposed with (or before) its parent. */
  child(): DisposalScope;
  /** Dispose everything in reverse registration order. Idempotent. */
  dispose(): void;
}
export function createDisposalScope(): DisposalScope;
```

**Invariants (the CS contract).**
- **LIFO order.** Teardown runs in reverse of registration, so a resource is
  never torn down before something that depends on it. Formally, if `a` is
  registered before `b`, then `b` disposes before `a`.
- **Idempotent.** `dispose()` is safe to call twice; the second call is a no-op.
  Guarded by an internal `disposed` flag and by clearing the registry.
- **Exception-isolated.** One failing teardown does not abort the rest (each is
  wrapped in try/catch), because a leaked resource must not block the others.

**Subsumes.** `createDisposeCollector` (→ `add`), `disposeSceneResources` (→
`object3D(scene)`), `disposeMeshDeep` (→ `object3D`), `disposeGameRig`.

**Naming / files.** `createDisposalScope`, `DisposalScope` in
`src/src/utils/disposal.ts`. Existing helpers become thin wrappers during
migration, then are removed.

---

## 2. FrameClock <a id="frameclock"></a>

**Problem.** Every particle burst and idle effect starts its own
`requestAnimationFrame`. These are decoupled from the renderer, keep running
after their scene is torn down (leak + battery), and are throttled
independently in background tabs.

**Abstraction.** One clock per rendering surface (one per `SceneFrame`, one per
`MiniGameShell`). Effects **subscribe**; the surface's single existing render
loop **ticks** it. No effect ever calls `requestAnimationFrame` again.

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
```

**The math.** Frame integration uses a **clamped variable timestep**:

```
dt      = min(rawDt, MAX_DT)          // MAX_DT = 0.1 s (matches MiniGameShell)
elapsed = elapsed + dt
```

Clamping prevents the "teleport" that a large `rawDt` (after a tab switch or GC
pause) would inject into physics/particles. We deliberately use a clamped
variable step, not a fixed-step accumulator: these toys have no stiff physics
that requires determinism, and a fixed step would add complexity (accumulator,
interpolation) for no gameplay benefit. Subscribers that need integral
stability already clamp velocities.

**Integration (done, Phase 1.5).** `SceneFrame` and `MiniGameShell` each own a
`FrameClock` and a `DisposalScope`. `MiniGameShell` ticks the clock in its
`setAnimationLoop` and exposes both on `MiniGameContext` (`context.clock`,
`context.disposal`); `SceneFrame` ticks a per-scene clock in its RAF (paused
while a minigame overlay covers the scene) and passes both to `createScene` via
a `SceneLifecycle` argument. Both dispose the scope on teardown. Consumers
(particles, animation, interaction) subscribe/register instead of self-driving
rAF or hand-rolling cleanup.

**Naming / files.** `createFrameClock`, `FrameClock` in
`src/src/utils/frameClock.ts`.

---

## 3. math consolidation <a id="math"></a>

**Problem.** `lerp` is defined twice (`utils/mathHelpers.ts`,
`minigames/shared/mathUtils.ts`); random/ease helpers are split across the two.

**Standard.** One module `src/src/utils/math.ts` is the single source of truth
(`lerp`, `clamp`, `smooth01`, `easeOutCubic`, `randomRange`, `randomInt`,
`randomPick`, `wrapAngle`, `shuffle`, `parabolicY`, `xzDistance`).
`minigames/shared/mathUtils.ts` and `utils/mathHelpers.ts` re-export from it
(zero call-site churn), then callers migrate and the shims are deleted.

---

## 4. ParticleEngine <a id="particleengine"></a>

**Problem.** Three modules (`utils/particles.ts`, `utils/particleFactory.ts`,
`minigames/shared/particleFx.ts`, ~1090 lines), two different
`createSparkleBurst`, two `createDustPuff`, duplicate point-sprite textures
(duplicate GPU uploads), and self-driven rAF loops. 32 call sites.

**Abstraction.** One engine per scene, bound to `(scene, FrameClock,
DisposalScope)` and a **single shared point texture**. Effects are **data**
(`ParticlePreset`); the engine owns the geometry/material and updates on the
clock tick.

```ts
export interface ParticlePreset {
  count: number | [min: number, max: number];
  lifetime: [min: number, max: number];       // seconds
  speed: [min: number, max: number];          // world units / s
  cone: { phiMin: number; phiMax: number };    // emission cone (radians from +Y)
  gravity: number;                             // world units / s^2 (can be negative)
  drag: number;                                // per-second velocity damping [0..1]
  size: [start: number, end: number];          // world units, lerped over life
  colors: Color[];                             // sampled per particle
  blending: 'normal' | 'additive';
  opacity: [start: number, end: number];
}
export interface ParticleEngine {
  /** One-shot burst at a world position. */
  emit(preset: ParticlePreset, position: Vector3): void;
  /** Continuous stream that follows a target each frame; returns a stop handle. */
  stream(preset: ParticlePreset, follow: Object3D | (() => Vector3), rate: number): () => void;
}
export function createParticleEngine(scene: Scene, clock: FrameClock, scope: DisposalScope): ParticleEngine;
export const PARTICLES: Record<string, ParticlePreset>;  // sparkle, dust, confetti, waterSplash, glowTrail, starCollect, heart, pollen, glitter, ripple, glowSpores, bubblePop, fireflyGlow
```

**The math.**
- **Emission direction** (cone around +Y): `θ ∈ [0, 2π)` uniform; `cosφ ∈
  [cos φmax, cos φmin]` uniform (area-correct on the sphere — sampling `φ`
  uniformly would cluster at the pole). Then
  `dir = (sinφ·cosθ, cosφ, sinφ·sinθ)`, `v = dir · U[speedMin, speedMax]`.
- **Integration per tick** (uses `FrameClock` dt): `v *= (1 - drag·dt)`;
  `v.y -= gravity·dt`; `p += v·dt`; `age += dt`; `t = age/lifetime`.
- **Appearance**: `size = lerp(size0, size1, t)`; `alpha = lerp(op0, op1, t)`.
  Buffers written once per tick.
- **Emitter-follow fix.** `stream` reads `follow`'s **world** position every
  tick (`getWorldPosition`), fixing the documented bug where trails emitted at
  the spawn point forever while the target drifted away.

**Naming / files.** `src/src/utils/particles/engine.ts`, `presets.ts`,
`texture.ts`, `registry.ts`. The three legacy modules are replaced; call sites migrate to
`engine.emit(PARTICLES.x, pos)`. The engine reaches call sites via the scene
context (Phase 7) or a per-scene engine handle during migration.

**As implemented (deviations from the sketch above, enforced by `tests/particles/`).**
- **Sizing.** Legacy `PointsMaterial` renders `gl_PointSize = size` from the
  material uniform and *ignores* any per-vertex size attribute — so every legacy
  system drew at the class default `0.1` regardless of its configured size
  range. To preserve the shipped look, `preset.size` is a single number and
  every preset uses `0.1`; one batch (one `Points`/material) exists per preset,
  so size is uniform within a preset (as legacy was). True per-particle /
  over-life sizing is deferred (needs a size shader).
- **Opacity / colour.** `opacity: [min, max]` is a per-particle random *start*
  alpha that fades linearly to 0 over life (matches the legacy
  `alpha = start·(1 − age/lifetime)`); `colors` is 1 fixed / 2 random-lerp / 3+
  random-pick. `emit(preset, pos, overrides?)` takes `{ colors?, count? }` so
  call sites can tint/scale a shared preset.
- **Streams.** `stream(preset, follow, rate, overrides?)` returns a
  `StreamHandle { stop(); start(); setRate(rate) }` (not a bare stop fn) — the
  firefly catch-arc boost and per-firefly restart need rate control and resume.
  All streams of a preset share its one batch (e.g. every firefly emits into one
  glow batch), so stream capacities are sized for the whole scene.
- **Textures.** Two deduped sprites (`'circle'`, `'star'`) via
  `getParticleTexture(kind)`, process-global; `preset.texture` selects one. This
  kills the *duplicate* circle uploads the problem statement names while keeping
  the star's cross-flare.
- **Registry.** `setSceneParticleEngine(scene, clock, scope)` (called by
  `MiniGameShell` and `SceneFrame`) creates + registers the engine;
  `getParticleEngine(scene)` returns it, or a warning no-op engine if none is
  registered — a missing sparkle never throws for a toddler.

---

## 5. IdleAnimator <a id="idleanimator"></a>

**Problem.** ~10 decor files start raw `gsap` `repeat:-1` tweens with no kill on
teardown (leak: immortal tweens animating detached objects, accumulating across
scene switches because the hub renderer persists).

**Abstraction.** A thin registry over GSAP bound to a `DisposalScope`; every
idle tween it starts is registered for `kill()` on `scope.dispose()`. Decor
"gently alive" motion uses named presets, not raw gsap.

```ts
export interface IdleAnimator {
  breathe(target: Object3D, opts?: BreatheOpts): void;   // scale sinusoid
  sway(target: Object3D, opts?: SwayOpts): void;         // rotation.z sinusoid
  bob(target: Object3D, opts?: BobOpts): void;           // position.y sinusoid
  spin(target: Object3D, opts?: SpinOpts): void;         // continuous rotation
  flicker(material: MeshStandardMaterial, opts?: FlickerOpts): void; // emissive
}
export function createIdleAnimator(scope: DisposalScope): IdleAnimator;
```

**The math (all presets are sinusoidal idles).**
`value(t) = base + amplitude · sin(2π·t / period + phase)`, with `phase`
randomized per instance so a shelf of toys doesn't pulse in lockstep. `spin` is
linear: `rotation += (2π / period)·dt`.

**Migration.** Replace the raw `repeat:-1` sites; the `animationPresets.ts`
keyframe helpers stay for one-shot reactions (squash/hop/splat), which are not
leaks.

---

## 6. LightingRig <a id="lightingrig"></a>

**Problem.** `createSceneLighting` (`LightingConfig`) and `createGameLighting`
(`GameLightingOptions`, Babylon "hemisphericIntensity") are two rigs with
different vocabularies.

**Abstraction.** One descriptor-driven factory:

```ts
export interface LightingDescriptor {
  key: { direction: Vector3; intensity: number; color: Color };
  fill: { skyColor: Color; groundColor: Color; intensity: number };  // hemisphere
  accents?: Array<{ position: Vector3; intensity: number; color: Color; distance?: number }>;
  shadow?: { bias?: number; normalBias?: number; frustum?: number };  // mapSize from qualityTier
}
export function createLightingRig(scene: Scene, d: LightingDescriptor, scope: DisposalScope): LightingRig;
```

Shadow map size comes from `qualityTier` (already wired in `sceneHelpers`).
Retires "hemispheric" → "fill (sky/ground hemisphere)". The key light position
is `-direction · KEY_DISTANCE`; the shadow frustum is sized to the scene's
ground extent, not a fixed ±10.

---

## 7. CameraDescriptor <a id="cameradescriptor"></a>

**Problem.** Three camera conventions: the fixed shell camera (`(0,2,5)`,
`lookAt(0,0,0)`, −Z, fov 60), the orbit scene camera (`createSceneCamera`,
Babylon spherical with a `+π` θ offset, +Z, fov 50), and `createGameCamera`
(beta/radius/alpha) which some games apply and others leave as dead code. Axis
handedness differs (Star Catcher is mirrored). This is why backdrops needed the
sky rig and why gameplay code branches on scene type.

**Abstraction.** One descriptor and one builder.

```ts
export type CameraDescriptor =
  | { kind: 'fixed'; position: Vector3; target: Vector3; fov: number }
  | { kind: 'orbit'; target: Vector3; azimuth: number; polar: number; distance: number;
      fov: number; constraints?: OrbitConstraints };
export function createCamera(d: CameraDescriptor, aspect: number): { camera: PerspectiveCamera; controls?: OrbitControls };
```

**The math — one spherical convention, documented once.** Given `target`,
`azimuth θ`, `polar φ` (from +Y), `distance r`:

```
position = target + ( r·sinφ·sinθ,  r·cosφ,  r·sinφ·cosθ )
```

This is the plain three.js `Spherical` convention (θ = 0 → +Z). The current
scene code's historical `θ += π` (a Babylon carry-over) is folded into the
descriptor's stored azimuth so no consumer applies ad-hoc offsets. `fov` is
stored in **degrees** (three.js native); the Babylon radians→degrees conversion
lives only inside the builder for legacy presets.

**Retire the dead pattern.** Minigames declare a `CameraDescriptor` (in the
manifest); the shell builds and applies it, deleting the "create a
`GameCamera` and never use it" pattern (bubble-pop). Minigames that need the
default get `{ kind: 'fixed', position: (0,2,5), target: (0,0,0), fov: 60 }`.

**Risk.** Highest — it changes gameplay framing. Migrate one surface at a time,
screenshot-verify each, and keep `projectToView` (sky rig) for all backdrop
placement so backdrops are unaffected by camera changes.

---

## 8. InteractionController <a id="interactioncontroller"></a>

**Problem.** Five ways to make something tappable
(`createWorldTapDispatcher`, `createInputDispatcher`, `createTapInteraction`,
`wireToyboxInteractions`, the room `userData.onClick` scan). The two child-UX
rules — **no dead tap** (every tap acknowledges) and **toddler smear-tap
forgiveness** (a wobble is still a tap) — live in only one of them.

**Abstraction.** One controller per surface; register any `Object3D`.

```ts
export interface InteractionController {
  register(obj: Object3D, handler: (hit: TapHit) => void, opts?: TapOptions): () => void;
  /** Screen-space fallback: nearest registered target within a px radius still fires. */
  setProximityRadiusPx(px: number): void;
}
export function createInteractionController(canvas: HTMLCanvasElement, scene: Scene, camera: PerspectiveCamera, scope: DisposalScope): InteractionController;
```

**Centralized rules (the math).**
- **Tap vs drag.** Accumulate pointer path length `L`. `L < DRAG_THRESHOLD`
  (10 px) → tap. `DRAG_THRESHOLD ≤ L < WOBBLE_TAP_TOLERANCE` (28 px) and the
  target has no drag handler → still a tap (toddler forgiveness). `L ≥ 28 px` →
  drag.
- **Proximity fallback.** For small targets, a tap that misses all meshes but
  lands within `PROXIMITY_PX` (70 px, from fireflies/bubble-pop) of a
  registered target's screen projection fires that target.
- **No dead tap.** If a registered handler returns without emitting audio, the
  controller plays `sfx_shared_tap_fallback`. (Enforces the soul-doc rule
  centrally instead of per-site.)

Subsumes all five entry points; `pointercancel` resets gesture state (iPadOS).

---

## 9. SceneDescriptor (capstone) <a id="scenedescriptor"></a>

**Problem.** Every scene hand-writes an `environment.ts` with a slightly
different shape. There is no single answer to "how is a screen described."

**Abstraction.** One declarative schema consumed by one builder; a screen
becomes data, wired through the unified factories above.

```ts
export interface SceneDescriptor {
  id: SceneId;
  camera: CameraDescriptor;         // §7
  lighting: LightingDescriptor;     // §6
  ground: GroundDescriptor;
  backdrop?: SkyDescriptor;         // sky rig (scene-rendering-standards.md)
  audio: { musicId: string; ambientId: string };  // audio-standards.md
  portals?: PortalDescriptor[];
}
export function buildScene(scene: Scene, d: SceneDescriptor, ctx: SceneBuildContext): SceneRuntime;
```

`buildScene` composes the camera, lighting rig, ground, backdrop (skydome via
the sky rig), audio, portals, a `FrameClock`, a `DisposalScope`, and an
`InteractionController` — the whole "how a screen is described" in one place. A
contract test validates every registered scene descriptor (non-empty audio per
`audio-standards.md`, resolvable backdrop, valid camera). This is also the
on-ramp to data-driven (JSON) authoring: the descriptor is already pure data
except for prop builders.

**Backdrop migration.** With `SkyDescriptor` in the schema, Nature's flat purple
"wall" and the room backdrops migrate to the sky rig (`createGradientSkydome`),
retiring the last bespoke backdrops.

---

## Testing & rollout

Every phase must leave all gates green and is committed/shipped on its own.

**Every framework-level / standardization primitive ships contract unit tests
that cite the driving doc.** This is a standing rule, not a per-phase option:
the whole point of a standard is that regressions are caught, so each primitive
gets a `node --test` suite whose header names the `architecture-standards.md`
anchor it enforces and whose cases pin the load-bearing behaviours (not
incidental details). A phase is not "done" until its tests exist.

Two testing styles, by what the code needs at runtime:
- **Behavioural** (preferred) for pure logic with no DOM/WebGL — math, the
  disposal scope, the frame clock. `tests/framework/_tsload.mjs` transforms one
  `.ts` file with esbuild (no bundling) and imports it, so the *actual*
  implementation runs. Suites: `tests/framework/{math,disposal,frameClock}.test.mjs`.
  This replaces the earlier "no TS unit runner" gap — vitest is no longer needed
  for foundation logic. (Only usable for files importing nothing, or only real
  npm packages; files using the `@app/*` alias can't load this way yet.)
- **Source-contract** for code that needs a browser at runtime (WebGL, canvas
  textures) — e.g. the ParticleEngine, whose batches upload GPU textures. Its
  math is validated behaviourally in isolation (area-correct cone sampling) and
  its structure by parsing source for the invariants (one clock subscription,
  scope registration, no private rAF, emitter-follow). Suite:
  `tests/particles/particle-engine.test.mjs`. Complemented by a screenshot smoke
  check over the affected routes.

Visual phases (4–7) additionally get a screenshot smoke check over the affected
routes; the camera phase (5) and backdrop migration (7) are screenshot-gated per
scene because they change framing.

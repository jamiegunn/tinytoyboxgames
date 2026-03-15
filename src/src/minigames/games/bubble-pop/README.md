# Mini-Game Architecture Reference

This document describes the architectural patterns, principles, and conventions used in this mini-game. It serves as the reference implementation for all 12 mini-games in the project.

## Invocation

The mini-game framework discovers games through a manifest registry (`MiniGameManifestEntry`). Each entry declares metadata and a lazy `load` function that returns a module with a single export: `createGame(context: MiniGameContext): IMiniGame`.

The framework drives the lifecycle:

```
load() → createGame(context) → setup() → start() → update(dt) / onTap(e) → pause() / resume() → teardown()
```

The game never controls its own lifecycle. The framework calls `update` on every frame, delivers input events, and decides when to pause or tear down. The game only reacts.

## Factory-Closure Pattern

Every game exports a single `createGame` factory function. This function returns an `IMiniGame` object literal whose methods close over mutable state declared as local variables inside the factory.

```
createGame(context)
  ├── closure variables (pool, activeBubbles, popCount, ...)
  ├── orchestration helpers (spawnBubble, popBubble, recycleBubble, ...)
  └── return { setup, start, update, teardown, onTap, ... }
```

**Why closures instead of classes:** The project enforces functional-only code (no classes, per ADR). Closure variables act as private state — inaccessible from outside, no getters/setters, no `this` binding. The returned object literal is the public API; everything else is encapsulated.

**Why orchestration helpers stay in the factory:** Functions like `spawnBubble` or `popBubble` touch 3-6 closure variables each (pool, active list, context, environment). Extracting them would require threading a mutable state-bag through every call, which adds complexity without improving cohesion. These stay as closure functions by design.

## Directory Structure

```
game-name/
├── index.ts          # Factory + lifecycle orchestration (the only export)
├── types.ts          # Interfaces, type aliases, tuning constants
├── helpers.ts        # Pure stateless utility functions
├── entities/         # Primary game entity domain
│   ├── index.ts      # Barrel re-exports
│   ├── lifecycle.ts  # What an entity IS — create, reset, dispose, material
│   ├── effects.ts    # How it LOOKS/MOVES — animation, particles, visual FX
│   └── rules.ts      # Game logic operating on collections of entities
└── environment/      # Scene/world domain
    ├── index.ts      # Barrel re-exports
    ├── setup.ts      # Camera, lighting rig, scene-level assembly
    ├── effects.ts    # Per-frame environment animation (ambient motion, pulse/decay)
    └── scenery.ts    # Low-level mesh/particle builders (pure constructors)
```

**Directories group by domain, not by technical category.** An `effects.ts` inside `entities/` handles entity animation; an `effects.ts` inside `environment/` handles scene animation. The directory provides the noun; the filename provides the verb.

**Barrel re-exports** in each `index.ts` give the factory a single import path per domain, keeping the orchestrator's import block clean and decoupled from internal file splits.

## Separation of Concerns

### Entity Domain vs. Environment Domain

Entity code and environment code never mix. A file in `entities/` never imports from `environment/`, and vice versa. The factory orchestrator is the only place that wires them together (e.g., "when an entity is popped, pulse the nearby stars").

This separation means either domain can be redesigned, rebalanced, or replaced without touching the other. It also prevents circular dependencies.

### Lifecycle vs. Effects vs. Rules

Within each domain directory, files are split by responsibility:

| File | Responsibility | Knows about |
|------|---------------|-------------|
| `lifecycle.ts` | Entity identity — creation, reset, disposal, material assignment | Single entities |
| `effects.ts` | Animation and visual feedback — motion, wobble, particle bursts | Single entities + time |
| `rules.ts` | Game logic — chain reactions, proximity triggers, multi-tap | Collections of entities |

**Rules never create or dispose entities.** They mutate state (queue a pop, apply wobble) and return. The orchestrator decides what to do with the result. This keeps rules testable without a scene graph.

**Effects never make gameplay decisions.** They read entity state and produce visuals. A pop burst doesn't decide *whether* to pop — it animates *that* a pop happened.

### Setup vs. Scenery (Environment)

`setup.ts` orchestrates the scene: creates the camera, lighting rig, and calls mesh builders to assemble the environment. `scenery.ts` contains pure constructors — functions that take a `Scene` and return a `Mesh` or `ParticleSystem` with no side effects beyond Babylon's scene graph registration. This follows the same lifecycle/builder split as the entity domain.

## Framework Integration

Games delegate to framework systems rather than reimplementing common concerns:

| System | Purpose | How the game uses it |
|--------|---------|---------------------|
| **ScoreManager** | Point tracking with combo multiplier | `context.score.addPoints(basePoints)` on every pop; `reset()` on start |
| **ComboTracker** | Streak detection and multiplier | `context.combo.registerHit()` on every pop; chain pops build streaks naturally |
| **DifficultyController** | Progressive ramp (0-1) based on score | `context.difficulty.level` drives entity count, speed, spawn variety, phase gating |
| **SpawnScheduler** | Timer-managed spawning with pause/resume | `context.spawner.register()` for primary loop and shower bursts; `pauseAll()`/`resumeAll()`/`clearAll()` for lifecycle |
| **CelebrationSystem** | Confetti, sounds, milestones | `confetti()` on every pop, `celebrationSound('pop'/'chime'/'whoosh')` per kind, `milestone()` at score thresholds |
| **EntityPool** | Object recycling (acquire/release) | Pool prewarmed at setup, entities recycled instead of created/destroyed |
| **AudioBridge** | Sound and music playback | SFX on interactions, background music on start, stop on teardown |

### Anti-Patterns Avoided

Games must never:
- Roll their own `setTimeout`/`setInterval` tracking — use `SpawnScheduler`
- Maintain local score counters for progression — use `ScoreManager` + `DifficultyController`
- Hardcode difficulty ramps (e.g., `if (count % 3 === 0) target++`) — derive from `context.difficulty.level`
- Use sentinel values to distinguish entity types — use discriminated fields (`kind`, not `colorIndex < 0`)

### Difficulty-Driven Design

Tuning constants in `types.ts` define MIN/MAX bounds. Actual runtime values are interpolated from `context.difficulty.level`:

- Entity count: SpawnScheduler's `maxCount` caps at `MAX_BUBBLES`; natural spawn cadence fills to capacity as difficulty rises
- Entity speed: interpolated between `MIN_FLOAT_SPEED` and `MAX_FLOAT_SPEED`
- Spawn variety: `pickBubbleKind(difficultyLevel)` unlocks rarer kinds and increases their probability as difficulty rises
- Game phase: `getPhase(difficultyLevel, elapsedTime)` gates crescendo onset on difficulty, then uses elapsed time for breathing rhythm

### Score Milestone Subscriptions

Games subscribe to `context.score.onScoreChanged()` in `start()` and fire `context.celebration.milestone()` at intervals defined by `SCORE_MILESTONE_INTERVAL`. The unsubscribe function is stored as a closure variable and called in `teardown()` to prevent leaks.

## Constants Model

All gameplay-affecting values live as named constants in `types.ts`. No magic numbers in orchestration or rule code.

### Constant categories

| Category | Examples | Notes |
|----------|---------|-------|
| **Bounds (MIN/MAX pairs)** | `MIN_FLOAT_SPEED`/`MAX_FLOAT_SPEED`, `MIN_RESPAWN_DELAY`/`MAX_RESPAWN_DELAY` | Interpolated by difficulty level at runtime |
| **Capacities** | `MAX_BUBBLES`, `INITIAL_BUBBLES`, `POOL_BUFFER` | Fixed limits for pool sizing and spawn caps |
| **Timing** | `SPAWN_INTERVAL`, `SPAWN_JITTER`, `SHOWER_SPAWN_INTERVAL`, `SPAWN_ANIM_DURATION` | SpawnScheduler config and animation durations |
| **Thresholds** | `RECYCLE_Y`, `CHAIN_POP_RADIUS`, `WOBBLE_RADIUS`, `MOON_PULSE_INTERVAL` | Trigger distances and event intervals |
| **Scoring** | `BUBBLE_POINTS` (per-kind record), `SCORE_MILESTONE_INTERVAL` | Framework-integrated point values |
| **Camera** | `CAMERA_RADIUS_PORTRAIT`, `CAMERA_RADIUS_LANDSCAPE` | Responsive layout values |
| **Audio** | `POP_SOUNDS` (indexed by sizeVariant) | Maps entity variant to sound ID |
| **Entity rules** | `GIANT_TAPS`, `GOLDEN_BURST_COUNT`, `WOBBLE_AUTO_POP_DELAY` | Game rule parameters |
| **Visual tuning** | `WOBBLE_AMPLITUDE`, `SWAY_AMPLITUDE`, `GIANT_SCALE` | Animation parameters used across multiple functions |

Animation-specific parameters that only appear in a single function (color values, easing curves, particle counts) remain as inline values in their respective `effects.ts` or `scenery.ts` files. Extracting every animation parameter to `types.ts` would hurt locality without improving maintainability.

## Key Principles

### Single Responsibility (SRP)

Each file has one reason to change. Tuning entity physics? `effects.ts`. Adjusting spawn probabilities? `helpers.ts`. Changing the sky color? `environment/scenery.ts`. No file serves two masters.

### Open/Closed

- **Via the framework:** Games are open for extension (new entity types, new rules) without modifying the framework. The `IMiniGame` interface is the contract.
- **Via entity kind:** The `BubbleKind` type (`'normal' | 'golden' | 'rainbow' | 'giant'`) is the discriminator for all kind-specific behavior — material, scoring, chain reactions, celebrations. Adding a new kind means adding a case to each switch, not modifying existing logic. The `kind` field is the single source of truth; other fields like `colorIndex` are only meaningful for specific kinds and are documented as such.

### Dependency Inversion

The game depends on abstractions (`MiniGameContext`, `EntityPool<T>`, `AudioBridge`, `CelebrationSystem`, `ScoreManager`, `DifficultyController`, `SpawnScheduler`), not concrete implementations. The framework injects these through the context object. The game never instantiates shared systems directly.

### DRY via Shared Libraries

Cross-cutting concerns live in `@app/minigames/shared/`:
- `materials` — reusable material factories (e.g., `createBubbleMaterial`)
- `meshBuilders` — common geometry (e.g., `buildSkyGradient`)
- `particleFx` — shared particle burst builders (e.g., `createSparkleBurst`)

Games import from shared libraries for common building blocks. Game-specific mesh builders live in the game's own `scenery.ts`.

**Known gap:** The shared `particleFx` module does not export its cached texture helpers (`getCircleTexture`, `getSparkleTexture`). This forces games with custom particle systems (e.g., the iridescent pop burst) to create their own canvas textures locally. A future pass should export these helpers so games can share the texture cache.

### No GC Pressure in Hot Paths

Per-frame code (anything called from `update`) avoids allocations:
- `copyFromFloats()` over `new Color3()` for color mutations
- Pre-allocated scratch variables for vector math
- Object pool (`EntityPool<T>`) for entity recycling — acquire/release instead of create/dispose
- No `setTimeout` in animation callbacks — use Babylon's `onAnimationEnd` instead

### No Raw Timers

All spawn timing is delegated to `context.spawner`. The framework handles timer creation, pause/resume synchronization, and cleanup on teardown. Games register spawn configs with `intervalSeconds`, `jitterSeconds`, `maxCount`, and an `activeCount` callback. No `setTimeout` or `setInterval` calls in game code.

## Dependencies

### Framework (injected via context)
- `IMiniGame` — lifecycle contract
- `MiniGameContext` — shared systems (scene, audio, pools, celebration, scoring, difficulty, spawning)
- `EntityPool<T>` — object recycling with acquire/release/prewarm/dispose
- `ScoreManager` — point tracking with combo-aware multiplier
- `ComboTracker` — streak detection and multiplier calculation
- `DifficultyController` — normalized 0-1 difficulty level derived from score
- `SpawnScheduler` — timer-managed spawning with pause/resume/cancel
- `CelebrationSystem` — confetti, celebration sounds, and score milestones
- `AudioBridge` — sound and music playback

### Engine (direct import)
- `@babylonjs/core` — Scene, Mesh, MeshBuilder, materials, lights, particles, vectors, colors

### Shared Libraries (cross-game reuse)
- `@app/minigames/shared/materials` — entity material factories
- `@app/minigames/shared/meshBuilders` — sky gradients, common geometry
- `@app/minigames/shared/particleFx` — sparkle bursts, confetti helpers

### Internal (game-specific)
- `types.ts` — all interfaces, type aliases, and tuning constants (MIN/MAX bounds, scoring, audio maps)
- `helpers.ts` — pure utility functions (random ranges, difficulty-driven phase/spawn selection)

No game file imports from another game. No game file imports from React, the app shell, or browser persistence APIs.

## Known Technical Debt

| Item | Scope | Notes |
|------|-------|-------|
| Shared texture helpers not exported | `shared/particleFx.ts` | `getCircleTexture`/`getSparkleTexture` are private; games create local canvas textures |
| `InputDispatcher` sends `pickResult: null` | `framework/InputDispatcher.ts` | Forces each game to call `scene.pick()` and do its own mesh-to-entity lookup |
| No shared lighting rig factory | `shared/` | Camera + 2-3 light setup repeated across games; pattern hasn't stabilized enough to abstract |
| No test coverage | `bubble-pop/` | Framework spec requires manifest, lifecycle, teardown, input, first-tap, and resize tests |

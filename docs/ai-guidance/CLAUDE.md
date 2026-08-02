# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

**Audio rule:** every scene and every minigame ships its own registered music bed at the quality bar in `docs/ai-guidance/audio-standards.md`; the music-coverage contract test enforces coverage.

## Product Naming

- **Public product name:** Tiny Toybox Games
- **Internal codename (optional):** Whimsical Toybox World

Use **Tiny Toybox Games** in public-facing copy.
Use the codename only when discussing internal architecture/spec material that already depends on it.

## Current-State Reading Order

Before making product, copy, routing, or scope claims, read these files in order:

1. `docs/status/current-state.md`
2. `docs/controlled-terminology.md`
3. `src/src/App.tsx`
4. `src/src/scenes/sceneCatalog.ts`
5. `src/src/minigames/framework/MiniGameManifest.ts`
6. relevant room toybox manifests
7. relevant immersive-scene `environment.ts` files

If docs and code disagree, verify against code and update the docs.

## Current Product Surface Area

The current repo registers five scenes:

- `playroom` (landing, and the default scene)
- `kitchen` (landing)
- `living-room` (landing)
- `nature` (toybox immersive scene)
- `pirate-cove` (toybox immersive scene)

The current minigame manifest registers five minigames:

- `bubble-pop`
- `fireflies`
- `little-shark`
- `star-catcher`
- `cannonball-splash`

Important nuance:

- registered is not the same as discoverable
- registration and discoverability are two independent surfaces: `SCENE_CATALOG[scene].games` decides what a scene is ALLOWED to launch, and the scene's own `environment.ts` `portals[]` decides what a player can SEE. Adding a manifest entry does not surface anything; wiring a portal is a separate change
- all four of Nature's registered games are surfaced through its portal array, `cannonball-splash` is surfaced in Pirate Cove
- the Playroom includes a visible `creative` toybox object whose destination is `null` — treat it as **present but inactive**

## Audience

- Public target audience: ages 3-6
- Design floor: age 3

Older children may still enjoy the experience, but docs and UX decisions should optimize for the youngest player.

## Architecture

### Bootstrap Sequence

1. `index.html` loads `main.tsx`
2. First import: `src/bootstrap/storageGuard.ts`
3. React root created
4. App shell renders
5. The Three.js renderer and active scene are created

### Component Tree

```text
<App>
  <ErrorBoundary>
    <ResponsiveProvider>
      <AudioProvider>
        <SceneRouter>        // scene <-> scene <-> minigame navigation
          <SceneFrame />     // canvas + renderer + active scene lifecycle
          <MiniGameOverlay />
          <UIOverlay />      // back button, audio toggle, loading
        </SceneRouter>
      </AudioProvider>
    </ResponsiveProvider>
  </ErrorBoundary>
</App>
```

### Key Boundary

- **React** owns layout, overlays, routing, accessibility, and coarse state
- **Three.js** owns scene graph updates, lighting, materials, particles, and frame-driven animation
- Do not push per-frame values through React state

### Current Routing State

The scene catalog registers these scene ids:

- `SceneId = keyof typeof SCENE_CATALOG` — today: `'playroom' | 'kitchen' | 'living-room' | 'nature' | 'pirate-cove'`. It is derived, never hand-written; do not declare a parallel union
- `MiniGameId = BuiltInMiniGameId | (string & {})` (`src/src/types/scenes.ts`). Note this is NOT a closed union: `BuiltInMiniGameId` lists four ids and the `string & {}` arm accepts any string, so the compiler will not catch a bad game id. `MiniGameManifest.ts` is the runtime source of truth, and it registers five: `bubble-pop`, `fireflies`, `little-shark`, `star-catcher`, `cannonball-splash`

### Runtime Truths

The current codebase includes:

- React app shell with hash-based routing
- direct Three.js scene lifecycle ownership
- lazy scene loading and lazy minigame loading
- shared room-scene and world-scene factories
- shared owl companion in every navigable non-minigame scene
- storage-guard bootstrap before React loads
- procedural geometry, material, and particle systems
- procedural audio architecture
- generators for immersive scenes, room scenes, and minigames

### Owl Rule

The owl is a shared companion, not a scene-local novelty:

- it appears in every navigable non-minigame scene
- it does not appear inside minigames by default
- scene code may tune owl placement and lightweight behavior
- owl lifecycle should be owned by shared scene scaffolding whenever possible

## Critical Language Rules

Always distinguish:

- **implemented** = code exists and is wired into runtime
- **registered** = present in a catalog or manifest
- **discoverable** = reachable by a normal player through the current UI
- **inactive** = present but not currently wired to an active destination
- **roadmap** = planned but not present in code
- **target architecture** = the intended structural end-state

Do not describe roadmap content as currently playable.

Do not claim:

- four worlds are currently playable
- twelve mini-games are currently playable
- all visible toyboxes are active
- all registered minigames are surfaced in-scene

## Critical Constraints

### Zero Browser Persistence

No localStorage, sessionStorage, IndexedDB, cookies, or Cache API app data.

The storage guard bootstrap module:

- lives at `src/bootstrap/storageGuard.ts`
- executes before React loads
- must not be implemented as a React component

### Procedural Assets Only

No external GLB, texture, MP3, OGG, or WAV files for baseline content. Art is authored as procedural asset modules. Audio is authored as procedural audio modules.

### Age-Appropriate Design

- age 3 is the floor
- no fail states, punishment, countdown pressure, or scary imagery
- no reading required for the core loop
- first-tap fallback must exist in navigable scenes
- audio is optional and supportive

## Tech Stack

Use `src/package.json` as the source of truth for versions.

Current important versions:

- React `19.2.0`
- React DOM `19.2.0`
- Three `0.175.0` — used **directly**. There is no React Three Fiber renderer in this repo; `SceneFrame` owns the `WebGLRenderer` and the scene graph itself
- `@react-three/fiber` `9.1.0` and `@react-three/drei` `10.0.0` are declared dependencies with **zero imports** anywhere in `src/`, `tests/` or `templates/` — `git log -S"from '@react-three'"` returns no commit, so they were never adopted rather than abandoned. They cost nothing at runtime (Rollup cannot bundle what nothing imports) but they are dead weight in the manifest. Removing them means editing `package.json` **and** regenerating `bun.lock` in the same change — `cd src && bun remove @react-three/fiber @react-three/drei` — because CI runs `bun install --frozen-lockfile` and will fail on a manifest/lockfile mismatch
- GSAP `3.12.0`
- Vite `7.3.1`
- TypeScript `~5.9.3`

Note: `src/bun.lock` is the only lockfile. There is no `package-lock.json` (it is gitignored). Bun is the primary workflow; the npm script names still work.

## Common Commands

Everything runs from `src/`, not the repo root — there is no `package.json` at
the root, so `bun install` from there fails.

```bash
cd src
bun install
bun run dev
bun run build
bun run format
bun run test
```

### Gates

These are what actually block a commit or a CI run. `bun run lint` is `eslint .`
with no `--max-warnings 0`, so it is **weaker than the gate**: because
`jsdoc/require-jsdoc` is a warning, the documented command can read green while
the real gate is red. Use these instead:

```bash
cd src
bunx eslint . --max-warnings 0        # the lint gate CI runs
bunx tsc -b                           # project type-check
bunx tsc -p .probe/tsconfig.probe.json --noEmit   # the probe harness, which tsc -b cannot reach
node --test "tests/**/*.test.mjs"     # the whole contract suite
node ../check-code-quality.cjs        # Prettier + ESLint, as CI runs it
node scripts/coverage-ratchet.mjs     # module-level coverage may not fall
```

The pre-commit hook (`src/scripts/precommit-check.cjs`, wired by
`.githooks/pre-commit`) runs all of these. It is installed by the `prepare`
script during `bun install` **inside `src/`**; if you installed elsewhere, run
`git config core.hooksPath .githooks` once.

## Canonical Terminology

Use terms from `docs/controlled-terminology.md`. Key terms:

- **Playroom** for the current room destination
- **Toybox immersive scene** for scenes such as Nature and Pirate Cove
- **Minigame** for play-mode game modules
- **Shared owl companion** for the recurring owl character

## Minigame Framework

Games implement the `IMiniGame` lifecycle:

- `setup`
- `start`
- `pause`
- `resume`
- `teardown`

Minigames are launched from immersive scenes and return to those scenes on exit. They are not navigable scenes.

## Reading Order

Read these before making structural changes:

1. `docs/status/current-state.md`
2. `docs/ai-guidance/vision.md`
3. `docs/controlled-terminology.md`
4. `docs/ai-guidance/soul.md`
5. `docs/ai-guidance/agents.md`

For lower-level implementation detail, then read the code directly:

- `src/src/scenes/sceneCatalog.ts`
- `src/src/minigames/framework/MiniGameManifest.ts`
- `src/src/utils/roomSceneFactory.ts` and `src/src/utils/worldSceneFactory.ts`
- the relevant scene or minigame folder under `src/src/`

Note: the historical ADR and spec documents (`docs/adr/`, `docs/specs/`) were removed from the repo; ADR numbers cited in code comments are historical references.

## JSDoc Standard

All public functions, methods, and classes must have JSDoc comments — this half
is **lint-enforced** by `jsdoc/require-jsdoc` in `src/eslint.config.js`, and
because CI runs ESLint with `--max-warnings 0`, a missing one blocks the build.

Interfaces and exported type aliases are a **convention, not a gate**: the rule's
`require` block covers functions, methods and classes only, and reaching
declarations would need the `contexts` option, which is not set. Write them
anyway; nothing will fail if you do not.

When modifying a file, add missing JSDoc for any public export you touch.

## Practical Rule

If you are changing docs or public copy:

1. verify the current state in code
2. update `docs/status/current-state.md`
3. then update README / landing page / guidance docs

If you are changing scene structure, routing, scene ids, or toybox ownership, read `docs/status/current-state.md` and the scene catalog / manifests in code first. The recursive hierarchy ADRs and specs that once defined the target model are historical and no longer in the repo.

# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

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

The current repo registers four scenes:

- `playroom`
- `kitchen`
- `nature`
- `pirate-cove`

The current minigame manifest registers five minigames:

- `bubble-pop`
- `fireflies`
- `little-shark`
- `star-catcher`
- `cannonball-splash`

Important nuance:

- registered is not the same as discoverable
- `star-catcher` is currently registered for `nature`, but is not currently surfaced through Nature's portal array
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

- `SceneId = 'playroom' | 'kitchen' | 'nature' | 'pirate-cove'`
- `MiniGameId = 'bubble-pop' | 'fireflies' | 'little-shark' | 'star-catcher' | 'cannonball-splash'`

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
- Three `0.175.0`
- `@react-three/fiber` `9.1.0`
- `@react-three/drei` `10.0.0`
- GSAP `3.12.0`
- Vite `7.3.1`
- TypeScript `~5.9.3`

Note: the repo currently contains both `bun.lock` and `package-lock.json`. Do not imply a single package-manager story unless the repo is intentionally standardized.

## Common Commands

```bash
bun install
bun run dev
bun run build
bun run lint
bun run format
bun run format:check
bun run test
```

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
4. `docs/specs/README.md`
5. `docs/adr/ADR-0009-adopt-a-recursive-scene-hierarchy-for-navigable-world-content.md`
6. `docs/adr/ADR-0010-keep-minigames-as-play-modes-with-hybrid-scene-ownership.md`
7. `docs/adr/ADR-0011-make-the-owl-a-shared-companion-in-all-navigable-scenes.md`
8. `docs/specs/phase-3/11-recursive-scene-hierarchy-spec.md`
9. `docs/specs/phase-3/12-recursive-scene-hierarchy-migration-plan.md`

For lower-level implementation detail, then read:

- `docs/specs/phase-3/05-app-architecture-spec.md`
- `docs/specs/phase-3/06-scene-implementation-spec.md`
- `docs/specs/phase-3/09-minigame-framework-spec.md`
- `docs/specs/phase-3/10-age-appropriate-ux-spec.md`

## JSDoc Standard

All public functions, interfaces, classes, and exported type aliases must have JSDoc comments. When modifying a file, add missing JSDoc for any public export you touch.

## Practical Rule

If you are changing docs or public copy:

1. verify the current state in code
2. update `docs/status/current-state.md`
3. then update README / landing page / guidance docs

If you are changing scene structure, routing, scene ids, or toybox ownership, read the recursive hierarchy ADRs and specs first. The current target model is defined by those documents.

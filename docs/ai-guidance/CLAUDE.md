# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Whimsical Toybox World** is a browser-based 3D interactive experience for children ages 3-12. The target architecture is a recursive hierarchy:

- World scene
- Place scenes such as House, Backyard, and Park
- optional sub-place scenes such as Playroom or Kitchen
- literal toyboxes that open immersive toybox scenes such as Nature
- minigames launched as play modes from immersive scenes

The current implementation is an early slice of that model:

- `hub` is the historical scene id for the Playroom landing scene
- `nature` is the current immersive toybox scene
- four minigames launch from Nature: `bubble-pop`, `hide-and-seek`, `fireflies`, and `little-shark`

All art and audio are procedural. No binary asset pipeline is required for the baseline experience.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **UI:** React 18+ with functional components and hooks
- **3D Engine:** Three.js with React Three Fiber
- **Animation:** GSAP 3.x
- **Build:** Vite 6.x
- **Runtime / Package Manager:** Bun 1.x
- **Linting:** ESLint 9
- **Formatting:** Prettier
- **Testing:** Vitest + React Testing Library

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
          <MiniGameRouter /> // lazy-loaded game modules
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

The repo is still on the legacy scene id surface:

- `SceneId = 'hub' | 'nature'`
- `MiniGameId = 'little-shark' | 'bubble-pop' | 'fireflies' | 'hide-and-seek'`

That is an implementation detail, not the target architecture. Read the recursive hierarchy docs before extending scene structure.

### Owl Rule

The owl is a shared companion, not a scene-local novelty:

- it appears in every navigable non-minigame scene
- it does not appear inside minigames by default
- scene code may tune owl placement and lightweight behavior
- owl lifecycle should be owned by shared scene scaffolding whenever possible

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

## Canonical Terminology

Use terms from `docs/controlled-terminology.md`. Key terms:

- **Playroom** for the current room destination
- **Toybox immersive scene** for scenes such as Nature
- **Minigame** for play-mode game modules
- **Shared owl companion** for the recurring owl character
- **hub** and **naturescene** only when referring to historical code paths or ids

## Reading Order

Read these before making structural changes:

1. `docs/ai-guidance/vision.md`
2. `docs/controlled-terminology.md`
3. `docs/specs/README.md`
4. `docs/adr/ADR-0009-adopt-a-recursive-scene-hierarchy-for-navigable-world-content.md`
5. `docs/adr/ADR-0010-keep-minigames-as-play-modes-with-hybrid-scene-ownership.md`
6. `docs/adr/ADR-0011-make-the-owl-a-shared-companion-in-all-navigable-scenes.md`
7. `docs/specs/phase-3/11-recursive-scene-hierarchy-spec.md`
8. `docs/specs/phase-3/12-recursive-scene-hierarchy-migration-plan.md`

For lower-level implementation detail, then read:

- `docs/specs/phase-3/05-app-architecture-spec.md`
- `docs/specs/phase-3/06-scene-implementation-spec.md`
- `docs/specs/phase-3/09-minigame-framework-spec.md`
- `docs/specs/phase-3/10-age-appropriate-ux-spec.md`

## Current Scene Notes

### Playroom

The current Playroom implementation lives under the historical path `src/src/scenes/hub`.

- `layout.ts` centralizes room-structural dimensions
- `room.ts` owns room contents, toyboxes, owl wiring, and interactions
- `index.ts` owns scene assembly and rendering pipeline orchestration

Treat this as the current Playroom landing scene, not as a generic hub pattern that should be copied unchanged.

### Nature

The current Nature implementation lives under `src/src/scenes/naturescene`.

- it is the reference implementation for an immersive toybox scene
- it uses shared world-scene scaffolding plus local staging and factory structure
- it is not the generic template as-is; use the recursive hierarchy docs to decide what should be generalized

## Minigame Framework

Games implement the `IMiniGame` lifecycle:

- `setup`
- `start`
- `pause`
- `resume`
- `teardown`

Minigames are launched from immersive scenes and return to those scenes on exit. They are not navigable scenes.

## JSDoc Standard

All public functions, interfaces, classes, and exported type aliases must have JSDoc comments. When modifying a file, add missing JSDoc for any public export you touch.

## Practical Rule

If you are changing scene structure, routing, scene ids, or toybox ownership, do not rely on older `hub` / "world scene" assumptions. The current target model is defined by the recursive hierarchy ADRs and specs, and the docs that still describe the older five-scene baseline should be read as implementation history unless they have been updated explicitly.

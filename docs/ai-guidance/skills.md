# Skills

This file defines reusable skills (prompt templates) for the Whimsical Toybox World project.

> **Historical note:** the ADR, spec, feature, and plan documents (`docs/adr/`, `docs/specs/`, `docs/features/`, `docs/plans/`) referenced by some skills were removed from the repo. Steps marked "(historical — not in repo)" cannot be executed as written; verify current behavior against `docs/status/current-state.md` and the code.

---

## /create-feature

**Trigger:** When a feature has been implemented or significantly updated and needs documentation.

**Usage:** `/create-feature [feature-name]`

**Steps:**

1. Identify the feature being documented. If `[feature-name]` is not provided, ask what was just built.
2. Read the feature template at `docs/features/TEMPLATE.md` (historical — not in repo).
3. Determine the correct phase, category, and short name for the filename.
4. Read the relevant source files to extract:
   - Key implementation files and their roles
   - Tuned parameter values (roughness, animation durations, particle counts, camera angles, colors, etc.)
   - Runtime behavior (what happens on load, tap, hover, transition)
5. Identify which spec sections the feature satisfies by checking (historical — not in repo):
   - `docs/specs/phase-1/` for product requirements
   - `docs/specs/phase-3/` for technical requirements
   - `docs/specs/phase-3/games/` for mini-game requirements
6. Run the soul alignment checklist from the template.
7. Create the feature file at `docs/features/{phase}-{category}-{short-name}.md` (historical — `docs/features/` is not in repo).
8. Update the index in `docs/features/README.md` with a link to the new file (historical — not in repo).

**Output:** A completed feature document and an updated index.

---

## /create-feature-batch

**Trigger:** When multiple features need documentation at once (e.g., after completing a phase).

**Usage:** `/create-feature-batch [phase]`

**Steps:**

1. Scan the source tree for all files modified or created in the given phase.
2. Group changes into logical features.
3. Run `/create-feature` for each identified feature.
4. Update the index in `docs/features/README.md` with all new entries (historical — not in repo).

---

## /create-scene

**Trigger:** When a new navigable scene needs to be created under the recursive hierarchy.

**Usage:** `/create-scene [scene-name]`

**Steps:**

1. Determine the scene kind. The catalog's `kind` field has exactly two values:
   - `landing` — a room the player navigates between (Playroom, Kitchen, Living Room)
   - `immersive-toybox` — a world opened from a toybox (Nature, Pirate Cove)

   `world` / `place` / `subplace` are **directory conventions** under
   `src/src/scenes/world/places/…/subplaces/`, not scene kinds, and there is no
   `parentSceneId` field — a child scene names its parent with `backTarget`.

2. Create the scene folder in the target hierarchy, for example:
   ```
   src/src/scenes/world/...
   ```
3. Prefer the generator over hand-rolling — it emits the required shape and
   registers the scene for you:
   ```bash
   cd src && npm run create:immersive-scene -- --scene-id coral-reef --display-name "Coral Reef"
   cd src && npm run create:room-scene -- --scene-id bedroom --display-name "Bedroom"
   ```
4. The required files, as asserted by the template structure tests:
   ```
   index.ts
   environment.ts
   materials.ts
   types.ts
   staging/
   factory/            # with props/{simple,interactive,complex}/ and scaffold/
   parent-scene-stubs/ # a copy source; delete each stub once its values are tuned in
   ```
   Optional by complexity: `layout.ts`.
5. There is no `meta.ts`. A scene's identity is split across three real files:
   `sceneCatalog.ts` (id, kind, camera, audio, `games`, `backTarget`),
   `toyboxes/manifest.ts` (its toyboxes), and `environment.ts` (its `portals`).
6. Populate `index.ts` with the standard scene assembly pattern and shared owl integration. Use the current Playroom implementation as the reference for room-level scenes and Nature as the reference for immersive toybox scenes.
7. If the new scene is an immersive toybox scene, surface its games in **two**
   places — they are independent: add the game id to `games` in
   `sceneCatalog.ts` (permission to launch) and add a portal to `portals[]` in
   the scene's `environment.ts` (what the player can actually see). There is no
   `minigames.ts`.
8. Register the scene in `src/src/scenes/sceneCatalog.ts`. `SceneId` is derived from `SCENE_CATALOG`, so do not add parallel unions or compatibility maps unless a real migration requires them.
9. If the scene contains literal toyboxes, add local toybox definitions. A toybox maps to **at most one** immersive scene: `destination` is `SceneId | null`, and a `null` destination ships a chest that wiggles, sparkles and plays a "not yet" tone without navigating (the Playroom's `creative` box).

**Output:** A bootable scene skeleton that follows the recursive hierarchy contract, includes the owl through shared scene scaffolding, and is ready for local layout or factory work.

---

## /create-prop

**Trigger:** When adding a new prop to an existing scene.

**Usage:** `/create-prop [scene-name] [prop-name] [simple|interactive|complex]`

**Steps:**

1. Determine category from the third argument.
2. Create the prop directory under `factory/props/{category}/{propname}/`.
3. Generate files based on category:
   - **simple:** `create.ts`, `compose.ts`, `constants.ts`, `index.ts`
   - **interactive:** same + `interaction.ts` + `types/` folder with `{Prop}BuildOptions.ts`, `{Prop}CreateResult.ts`, `index.ts`
   - **complex:** same as interactive + stub `README.md`
4. Generate a staging file at `staging/{propname}.ts` with an empty `readonly` placements array.
5. Wire the composer into the scene's `index.ts` `propComposers` array.
6. Add barrel exports to the prop's `index.ts`.

**Output:** A fully wired prop skeleton that compiles and renders nothing, ready for geometry authoring.

---

## /scene-conventions

**Trigger:** When needing a refresher on scene architecture conventions.

**Usage:** `/scene-conventions`

**Steps:**

1. Read the recursive hierarchy docs first (historical — not in repo):
   - `docs/specs/phase-3/11-recursive-scene-hierarchy-spec.md`
   - `docs/specs/phase-3/12-recursive-scene-hierarchy-migration-plan.md`
2. Read the current Nature implementation as the reference for an immersive toybox scene.
3. Present a summary of:
   - **Scene contract:** the required-file list above (no `meta.ts`), optional local files by complexity
   - **Compose pattern:** `ComposeContext` injection, `DisposeFn` contract, `propComposers` array where the scene warrants it
   - **Result types:** typed `CreateResult` interfaces per entity
   - **Interaction wiring:** `createTapInteraction(dispatcher, target, cb)` and `createRevealInteraction(scene, dispatcher, config)` via `WorldTapDispatcher`
   - **Disposal contract:** every composer returns `() => void` or registers with the active `DisposalScope`; shared scene factories dispose the scope and sweep scene resources on teardown
   - **Material tiers:** Tier 1 (scene-shared palette), Tier 2 (feature-local cached), Tier 3 (per-instance)
   - **Staging rules:** one file per entity in `staging/`, readonly placement arrays, positions and variant selection
   - **Owl rule:** every navigable non-minigame scene includes the shared owl companion

**Output:** A concise conventions reference.

---

## /spike-notes

**Trigger:** When capturing observations from a spike or prototype before deleting it.

**Usage:** `/spike-notes`

**Steps:**

1. Read the spike scope from `docs/plans/phase-4/01-spike.md` section 4 (Capture Notes) (historical — not in repo).
2. Walk through each checklist category (Visual Quality, Lighting, Composition, Interaction, Mobile, Transition).
3. For each item, check the current implementation and record observations.
4. Write the notes to `docs/spike-notes.md`.
5. These notes inform production material factories and lighting rigs.

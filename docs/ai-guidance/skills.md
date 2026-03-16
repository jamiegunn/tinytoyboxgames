# Skills

This file defines reusable skills (prompt templates) for the Whimsical Toybox World project.

---

## /create-feature

**Trigger:** When a feature has been implemented or significantly updated and needs documentation.

**Usage:** `/create-feature [feature-name]`

**Steps:**

1. Identify the feature being documented. If `[feature-name]` is not provided, ask what was just built.
2. Read the feature template at `docs/features/TEMPLATE.md`.
3. Determine the correct phase, category, and short name for the filename.
4. Read the relevant source files to extract:
   - Key implementation files and their roles
   - Tuned parameter values (roughness, animation durations, particle counts, camera angles, colors, etc.)
   - Runtime behavior (what happens on load, tap, hover, transition)
5. Identify which spec sections the feature satisfies by checking:
   - `docs/specs/phase-1/` for product requirements
   - `docs/specs/phase-3/` for technical requirements
   - `docs/specs/phase-3/games/` for mini-game requirements
6. Run the soul alignment checklist from the template.
7. Create the feature file at `docs/features/{phase}-{category}-{short-name}.md`.
8. Update the index in `docs/features/README.md` with a link to the new file.

**Output:** A completed feature document and an updated index.

---

## /create-feature-batch

**Trigger:** When multiple features need documentation at once (e.g., after completing a phase).

**Usage:** `/create-feature-batch [phase]`

**Steps:**

1. Scan the source tree for all files modified or created in the given phase.
2. Group changes into logical features.
3. Run `/create-feature` for each identified feature.
4. Update the index in `docs/features/README.md` with all new entries.

---

## /create-scene

**Trigger:** When a new navigable scene needs to be created under the recursive hierarchy.

**Usage:** `/create-scene [scene-name]`

**Steps:**

1. Determine the scene kind and parent path:
   - `world`
   - `place`
   - `subplace`
   - `toybox-interior`
2. Create the scene folder in the target hierarchy, for example:
   ```
   src/src/scenes/world/...
   ```
3. Create the minimum contract:
   ```
   index.ts
   meta.ts
   ```
4. Add optional files only when complexity justifies them:
   ```
   layout.ts
   environment.ts
   materials.ts
   minigames.ts        # immersive toybox scenes only
   staging/
   factory/
   ```
5. Populate `meta.ts` with the scene's `id`, `kind`, `parentSceneId`, child scene ids, toyboxes, and minigame links as needed.
6. Populate `index.ts` with the standard scene assembly pattern and shared owl integration. Use the current Playroom implementation as the reference for room-level scenes and Nature as the reference for immersive toybox scenes.
7. If the new scene is an immersive toybox scene, add `minigames.ts` with local minigame links that point to shared minigame implementations.
8. Register the scene through the current loader or registry layer. If the repo is still on legacy `SceneId = 'hub' | 'nature'`, add the smallest compatibility mapping necessary instead of expanding the old union casually.
9. If the scene contains literal toyboxes, add local toybox definitions that map each toybox to exactly one immersive scene.

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

1. Read the recursive hierarchy docs first:
   - `docs/specs/phase-3/11-recursive-scene-hierarchy-spec.md`
   - `docs/specs/phase-3/12-recursive-scene-hierarchy-migration-plan.md`
2. Read the current Nature implementation as the reference for an immersive toybox scene.
3. Present a summary of:
   - **Scene contract:** `index.ts` + `meta.ts` minimum, optional local files by complexity
   - **Compose pattern:** `ComposeContext` injection, `DisposeFn` contract, `propComposers` array where the scene warrants it
   - **Result types:** typed `CreateResult` interfaces per entity
   - **Interaction wiring:** `createTapInteraction(dispatcher, target, cb)` and `createRevealInteraction(scene, dispatcher, config)` via `WorldTapDispatcher`
   - **Disposal contract:** every composer returns `() => void`, collected by `createDisposeCollector`
   - **Material tiers:** Tier 1 (scene-shared palette), Tier 2 (feature-local cached), Tier 3 (per-instance)
   - **Staging rules:** one file per entity in `staging/`, readonly placement arrays, positions and variant selection
   - **Owl rule:** every navigable non-minigame scene includes the shared owl companion

**Output:** A concise conventions reference.

---

## /spike-notes

**Trigger:** When capturing observations from a spike or prototype before deleting it.

**Usage:** `/spike-notes`

**Steps:**

1. Read the spike scope from `docs/plans/phase-4/01-spike.md` section 4 (Capture Notes).
2. Walk through each checklist category (Visual Quality, Lighting, Composition, Interaction, Mobile, Transition).
3. For each item, check the current implementation and record observations.
4. Write the notes to `docs/spike-notes.md`.
5. These notes inform production material factories and lighting rigs.

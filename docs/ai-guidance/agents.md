# Agents — AI Collaboration Model

This document defines the specialized AI agent roles that collaborate on Tiny Toybox Games (internal codename: Whimsical Toybox World). Each agent has a distinct domain, a clear boundary of authority, and a defined relationship to the canonical documentation.

No agent may override the canonical specs. All agents operate within the source-of-truth hierarchy defined in the [README](../../README.md) and enforced by the [controlled terminology](../controlled-terminology.md).

> **Historical note:** the ADR and spec documents (`docs/adr/`, `docs/specs/`) referenced below were removed from the repo. Entries marked "(historical — not in repo)" are kept for context only; verify current behavior against `docs/status/current-state.md` and the code.

> **Agents must not promote roadmap or target-architecture items into current-state documentation or marketing copy.**
> When counts or availability are described, agents must verify them against `docs/status/current-state.md` and the code manifests/catalogs.

---

## Agent Principles

1. **Specification supremacy.** Every agent reads the canonical docs before acting. No agent introduces behavior that contradicts Phase 1, Phase 3, or the ADRs.
2. **Bounded authority.** Each agent owns a specific workstream. Agents do not make decisions outside their domain without explicit cross-agent coordination.
3. **Traceability.** Every artifact an agent produces must trace back to a canonical spec requirement. If the spec does not call for it, the agent must not invent it.
4. **Terminology compliance.** Agents use the vocabulary defined in [controlled-terminology.md](../controlled-terminology.md). Non-canonical terms are flagged and mapped.
5. **Soul alignment.** Every agent internalizes the emotional and philosophical principles in [soul.md](soul.md). Technical correctness without warmth is a failure.
6. **Current-state accuracy.** Every agent reads `docs/status/current-state.md` before making claims about what is implemented, registered, discoverable, or inactive.

---

## Agent Roster

### Product Architect

**Domain:** Product direction, scope governance, documentation structure, and cross-agent alignment.

**Authority:**

- Maintains the canonical reading order and document hierarchy
- Resolves ambiguity between spec documents
- Authors and updates ADRs when architectural decisions change
- Reviews agent outputs for spec compliance and terminology adherence
- Adjudicates scope questions — what is in the baseline, what is future roadmap

**Reads first:**

- `docs/status/current-state.md`
- `vision.md`
- `docs/controlled-terminology.md`
- `docs/specs/README.md` (historical — not in repo)
- All ADRs (historical — not in repo)

**Does not do:**

- Write implementation code
- Make art direction decisions unilaterally
- Override the Product & UX Spec without an ADR

---

### Scene Engineer

**Domain:** React app shell, Three.js integration, scene lifecycle, component architecture, state management, routing, bootstrap sequence, and responsive/orientation handling.

**Authority:**

- Owns the application architecture defined in the App Architecture Spec (historical — not in repo)
- Implements the storage guard bootstrap module
- Implements the `SceneRouter`, `SceneFrame`, `ResponsiveProvider`, and `AudioProvider`
- Manages scene transitions across the recursive hierarchy (`world` / `place` / `sub-place` / immersive scene) plus minigame launch and exit
- Enforces the React-for-shell / Three-for-rendering boundary

**Reads first:**

- `docs/status/current-state.md`
- App Architecture Spec (historical — not in repo)
- Scene Implementation Spec (historical — not in repo)
- Build & Deploy Spec (historical — not in repo)
- Technical Constraints (historical — not in repo)

**Key rules:**

- Storage guard must execute before React loads — no React component implementation
- Functional components only, hooks for state, refs for frame-driven values
- No per-frame values through React state
- Scene disposal on transition — no leaked meshes, listeners, or animations
- World scenes and mini-game chunks never preload before player navigation

---

### Art Engineer

**Domain:** Procedural mesh factories, PBR materials, particle systems, lighting rigs, ambient animations, and visual composition — all authored as TypeScript runtime modules.

**Authority:**

- Owns every procedural asset module in the art inventory
- Defines mesh geometry, material parameters, particle configurations, and animation curves
- Implements per-world lighting rigs matching the art direction spec
- Creates the shared owl companion mesh and scene-specific prop meshes
- Authors reward particle systems (sparkles, confetti, trails, bursts)

**Reads first:**

- Art Direction & Scene Design (historical — not in repo)
- Art Asset Inventory (historical — not in repo)
- Art Production Specs (historical — not in repo)
- Scene Implementation Spec (historical — not in repo)

**Key rules:**

- No external GLB, texture, or binary art files — procedural only
- Material fidelity through PBR workflows tuned for toy-like reflectance
- Meshes must read clearly at 375 px mobile viewports
- Particle counts must scale down on low-capability devices
- Follow the `{scene}_{category}_{name}` naming convention

---

### Sound Engineer

**Domain:** Procedural audio modules, runtime synthesis, Web Audio graphs, music systems, sound effects, ambient audio, and interaction feedback — all authored as TypeScript runtime modules.

**Authority:**

- Owns every procedural audio module in the sound inventory
- Implements runtime synthesis using the Web Audio API
- Creates interaction feedback sounds (splats, chimes, boings, pops)
- Creates ambient audio beds per world
- Creates music tracks (playroom lullaby, scene ambient music, minigame music)
- Implements crossfade, ducking, and spatial audio behaviors

**Reads first:**

- Sound Design Inventory (historical — not in repo)
- Sound Production Specs (historical — not in repo)
- Product & UX Spec — Audio Model (historical — not in repo)

**Key rules:**

- No shipped MP3, OGG, or WAV files — runtime synthesis is the preferred approach
- Audio unlock happens on first user gesture
- Global mute always wins over local controls
- Sounds must begin within 100 ms of their triggering interaction
- All audio is optional and supportive — never essential for comprehension

---

### Game Engineer

**Domain:** Mini-game framework, per-game implementation, shared game systems (score, combo, difficulty, spawning, celebration), and game-specific entity behavior.

**Authority:**

- Owns the mini-game framework defined in the Mini-Game Framework Spec (historical — not in repo)
- Implements the `IMiniGame` interface for each game
- Implements shared systems: `ScoreManager`, `ComboTracker`, `DifficultyController`, `SpawnScheduler`, `CelebrationSystem`, `InputDispatcher`, `EntityPool`
- Implements the `MiniGameRouter`, `MiniGameShell`, and `MiniGameHUD`
- Wires launch triggers via the `useMiniGameLauncher` hook

**Reads first:**

- `docs/status/current-state.md`
- Mini-Game Framework Spec (historical — not in repo)
- Age-Appropriate UX Spec (historical — not in repo)
- Per-Game Specs (historical — not in repo)

**Key rules:**

- Every game must be playable by the youngest segment (ages 3–4) — complexity is additive, never gating
- Core play loop requires no text comprehension
- Score, combo, and progress are positive feedback — never punitive
- Exit is always one tap, no confirmation dialog, top-left icon
- Games follow the standard lifecycle: `setup → start → pause/resume → teardown`
- Each game is a lazy-loaded module — no preloading before navigation

---

### UX Guardian

**Domain:** Age-appropriate design, accessibility, interaction safety, HUD design, tap target validation, color-vision accessibility, and no-reading-first compliance.

**Authority:**

- Reviews all agent outputs against the age-appropriate UX spec
- Validates tap targets meet the 48 px minimum (56 px for navigation)
- Ensures no mechanic relies solely on color differentiation
- Verifies first-tap fallback behavior in every scene
- Confirms no fail states, punishment, or countdown pressure exist
- Validates icon-first, text-free design across all overlays and HUD elements

**Reads first:**

- Age-Appropriate UX Spec (historical — not in repo)
- Product & UX Spec (historical — not in repo)
- Toybox Activities & Rewards (historical — not in repo)
- Acceptance Criteria (historical — not in repo)

**Key rules:**

- Age 3 is the floor — if a toddler cannot succeed through tapping alone, it fails review
- No floating text may contain words or letters — use icon-mode celebrations
- No hidden progression requirements
- No scary imagery, jump scares, or phobia-triggering creatures
- All creatures must be friendly, cute, and approachable
- Screen reader announcements for score changes (non-interrupting live region)

---

### Quality Engineer

**Domain:** Acceptance criteria validation, performance profiling, cross-browser testing, storage guard verification, and responsive/orientation testing.

**Authority:**

- Validates implementation against the historical acceptance-criteria documents (not in repo)
- Runs performance profiling on the official validation device matrix
- Verifies storage guard behavior across the browser test matrix
- Tests orientation changes during transitions
- Validates memory budgets (landing scene < 100 MB, immersive scene < 80 MB, minigame < 60 MB)
- Verifies scene disposal and resource cleanup

**Reads first:**

- `docs/status/current-state.md`
- Acceptance Criteria (historical — not in repo)
- Phase 3 Acceptance Criteria (historical — not in repo)
- Technical Constraints (historical — not in repo)

**Key rules:**

- Cold mobile load to interactive within 3.0 seconds on throttled 4G
- 60 fps sustained on reference mobile devices during idle
- No frame-time spike above 50 ms during normal interaction
- Warm transitions complete within 2.0 seconds
- Zero storage surfaces written after a full play session

---

## Cross-Agent Coordination

### Handoff Points

```
Product Architect
  │
  ├─ scope decisions ──────► all agents
  ├─ terminology updates ──► all agents
  │
Scene Engineer
  │
  ├─ component APIs ────────► Art Engineer (mesh loading contracts)
  ├─ audio integration ─────► Sound Engineer (AudioProvider interface)
  ├─ scene lifecycle ───────► Game Engineer (MiniGameShell integration)
  │
Art Engineer
  │
  ├─ asset IDs + factories ─► Scene Engineer (scene wiring)
  ├─ particle configs ──────► Game Engineer (celebration system)
  │
Sound Engineer
  │
  ├─ sound IDs + modules ───► Scene Engineer (interaction triggers)
  ├─ music crossfade API ───► Game Engineer (launch/exit transitions)
  │
Game Engineer
  │
  ├─ game manifests ────────► Scene Engineer (MiniGameRouter registration)
  ├─ HUD components ────────► UX Guardian (review)
  │
UX Guardian
  │
  ├─ review feedback ───────► all agents
  │
Quality Engineer
  │
  └─ test results ──────────► all agents (go/no-go)
```

### Conflict Resolution

When agents disagree:

1. Check the canonical spec. The spec wins.
2. If the spec is silent, check the ADRs. An existing decision wins.
3. If neither covers the case, escalate to the Product Architect for a ruling and, if the decision is material, a new ADR.

---

## Agent Activation

Agents are invoked based on the task at hand:

| Task                           | Primary Agent     | Supporting Agents                         |
| ------------------------------ | ----------------- | ----------------------------------------- |
| Writing or updating specs      | Product Architect | —                                         |
| Building the React shell       | Scene Engineer    | Art Engineer, Sound Engineer              |
| Creating procedural meshes     | Art Engineer      | Scene Engineer                            |
| Creating procedural audio      | Sound Engineer    | Scene Engineer                            |
| Implementing a mini-game       | Game Engineer     | Art Engineer, Sound Engineer, UX Guardian |
| Reviewing accessibility        | UX Guardian       | Game Engineer, Art Engineer               |
| Running acceptance tests       | Quality Engineer  | All agents                                |
| Resolving scope questions      | Product Architect | —                                         |
| Adding a new scene or minigame | Product Architect | All agents (ADR + spec update first)      |

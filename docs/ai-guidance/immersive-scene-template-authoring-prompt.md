# Immersive Scene Template Authoring Prompt

Use this prompt when extending or generating an immersive scene from the
canonical immersive scene template.

---

You are working inside the canonical immersive scene template for this project.

Your job is to extend a generated immersive scene without breaking the
architecture ceremony.

## Non-Negotiable Rules

1. Do not collapse the folder ceremony.
2. Keep these responsibilities separate:
   - `index.ts`: scene orchestration only
   - `environment.ts`: scene environment and portal config
   - `materials.ts`: scene-shared materials
   - `types.ts`: scene-local shared types
   - `staging/`: authored placement data
   - `factory/scaffold/`: scene shell
   - `factory/props/simple/`: non-interactive props
   - `factory/props/interactive/`: tappable or runtime-behavior props
   - `factory/props/complex/`: multi-subsystem props
   - `factory/systems/`: ambient systems
3. Preserve the `staging -> compose -> create -> interaction` pattern.
4. Use the shared world-scene runtime:
   - `createWorldScene`
   - centralized tap dispatch
   - shared owl and floor tap wiring
   - minigame portal wiring
5. Do not invent ad hoc scene architectures even if the scene is small.

## Required References

Before editing, align with:

- `/docs/adr/ADR-0012-adopt-a-canonical-immersive-scene-template.md`
- `/docs/adr/ADR-0013-provide-generator-prompt-and-template-only-tests-for-immersive-scene-scaffolding.md`
- `/docs/adr/ADR-0011-make-the-owl-a-shared-companion-in-all-navigable-scenes.md`
- `/docs/adr/ADR-0010-keep-minigames-as-play-modes-with-hybrid-scene-ownership.md`
- `/docs/specs/phase-3/13-immersive-scene-template-spec.md`
- `/docs/specs/phase-3/14-immersive-scene-template-generator-and-test-plan.md`

## Extension Rules

When adding a new prop:

1. Decide whether it is `simple`, `interactive`, or `complex`.
2. Add or update a staging file if scene-authored placement is required.
3. Add a feature folder with the expected file contract.
4. Wire it into `index.ts` through composition, not inline mesh creation.
5. If it is interactive, route input through the shared dispatcher.
6. If it owns animations or other runtime cleanup, return explicit cleanup
   handles and include them in scene disposal.

When updating structure:

1. Update the local `README.md` files.
2. Keep top-of-file explanatory comments and JSDoc accurate.
3. Prefer adding explicit files over hiding behavior in giant multi-purpose
   modules.

## Default Generated Baseline

A generated immersive scene starts with:

- walls or enclosure scaffold
- floor
- sky backdrop
- one simple prop example
- one interactive prop example
- one `bubble-pop` portal

Extend from that baseline. Do not delete the instructional structure unless the
project's canonical template spec changes first.

## Output Standard

Generated code should be:

- explicit
- heavily commented
- consistent with the canonical template
- free of template-name leakage
- easy to compare with other immersive scenes later

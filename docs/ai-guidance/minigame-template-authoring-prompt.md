# Minigame Template Authoring Prompt

Use this prompt when extending or generating a minigame from the canonical
minigame template.

---

You are working inside the canonical minigame template for this project.

Your job is to extend a generated minigame without breaking the scaffold
contract.

## Non-Negotiable Rules

1. Do not collapse the template structure into one giant `index.ts`.
2. Keep these responsibilities separate:
   - `index.ts`: lifecycle orchestration
   - `types.ts`: local game types
   - `helpers.ts`: small pure helpers
   - `environment/`: camera, lights, static setup, teardown helpers
   - `entities/`: game entities and their lifecycle
   - `rules/`: spawning, scoring, hit handling, per-frame rules
3. Use the existing shell contract from `framework/types.ts`.
4. Use shared context systems for score, combo, difficulty, celebration, and
   spawn scheduling instead of inventing replacements.
5. Keep teardown explicit and complete.
6. Update the template README if the generated game's structure changes.

## Required References

Before editing, align with:

- `/docs/adr/ADR-0014-adopt-a-canonical-minigame-template.md`
- `/docs/adr/ADR-0015-provide-generator-prompt-and-template-only-tests-for-minigame-scaffolding.md`
- `/docs/specs/phase-3/15-minigame-template-spec.md`
- `/docs/specs/phase-3/16-minigame-template-generator-and-test-plan.md`
- `/docs/specs/phase-3/09-minigame-framework-spec.md`

## Extension Rules

When adding new mechanics:

1. Keep shell lifecycle methods in `index.ts`.
2. Add new entity logic under `entities/`.
3. Add scoring/spawn/update rules under `rules/`.
4. Put camera or scene dressing changes under `environment/`.
5. Reuse shared framework systems before inventing local replacements.
6. Preserve the generated playable baseline unless the product decision changes.

## Default Generated Baseline

A generated minigame starts with:

- a registered manifest entry
- a visible environment
- tappable entities
- score + combo integration
- celebration feedback
- fallback tap response
- clean teardown

Extend from that baseline. Do not delete the instructional structure unless the
canonical template spec changes first.

## Output Standard

Generated code should be:

- explicit
- heavily commented
- structurally consistent with the canonical template
- free of template-name leakage
- easy to compare with other generated minigames later

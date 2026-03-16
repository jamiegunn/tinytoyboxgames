# Minigame Template Challenge Prompt

Use this prompt when you want an LLM or reviewer to attack the canonical
minigame template and the generated minigames that come from it.

---

Review this minigame template or generated minigame brutally.

Assume the goal is not to be nice. The goal is to find the places where the
template will fail future developers.

## Attack These Questions

1. Is this template actually based on shared minigame architecture, or did it
   quietly copy one game's quirks?
2. Is the generated game truly playable, or just technically non-empty?
3. Does `index.ts` stay focused on lifecycle orchestration, or is it becoming a
   dumping ground?
4. Are environment, entities, and rules actually separated, or only named that
   way?
5. Does teardown look trustworthy, or will the generated game leak timers,
   materials, event listeners, or pooled entities?
6. Is the manifest integration robust, or is the generator making brittle text
   edits?
7. Is the README concrete enough that a developer can actually use the
   generator and test the output in the browser?
8. Are the template-only tests protecting the real contract, or only proving
   that files exist?

## What To Look For

- structural drift
- over-generalization
- fake abstractions
- shell-contract violations
- missing cleanup
- stale docs
- generator brittleness
- missing validation

## Output Format

Return:

1. findings first, ordered by severity
2. concrete file references
3. open questions or assumptions
4. a short verdict on whether this is a good template source

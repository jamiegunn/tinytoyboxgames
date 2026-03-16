# Room Template Review Prompt

Use this prompt when you want an LLM or human reviewer to attack the room
template system brutally.

The goal is not to praise the template. The goal is to determine whether it is
actually a good source model for future rooms, whether the code is clean, and
whether the documentation is strong enough to keep the pattern stable over
time.

---

You are reviewing the canonical room template and its proof-of-pattern room
implementation.

Review it as if future maintainability depends on your honesty.

Do not optimize for politeness. Optimize for finding structural weakness,
confusing patterns, stale documentation risk, poor abstractions, hidden
coupling, and fake reuse.

## Required Review Scope

Review these areas together, not in isolation:

- room runtime integration
- template folder structure
- generated room code quality
- README quality and accuracy
- comment/JSDoc quality
- generator quality
- test quality
- DRY and SOLID compliance

## Required Files To Inspect

At minimum, review:

- `/src/templates/room-scene/README.md`
- `/src/templates/room-scene/index.ts`
- `/src/templates/room-scene/environment.ts`
- `/src/templates/room-scene/layout.ts`
- `/src/templates/room-scene/room.ts`
- `/src/src/utils/roomSceneFactory.ts`
- `/src/src/scenes/world/places/house/subplaces/playroom/README.md`
- `/src/scripts/create-room-scene.mjs`
- `/src/scripts/lib/roomSceneGenerator.mjs`
- `/src/tests/room-template/*`

If the generated proof room exists, review that too.

## Questions You Must Answer

1. Is the room template actually built on a shared runtime contract, or does it
   still hide bespoke Playroom assumptions?
2. Does the template follow good architectural boundaries, or are files merely
   separated without real ownership?
3. Is `index.ts` truly thin, or is the template drifting toward a dumping
   ground?
4. Is `layout.ts` appropriately scoped, or is it becoming a god-file?
5. Are shell, decor, and toybox responsibilities genuinely separated?
6. Does the code follow DRY in a healthy way, or is it creating premature
   abstraction?
7. Do the structures follow SOLID principles, especially single
   responsibility, open/closed, and dependency direction?
8. Are the README files actually useful for future contributors, or are they
   verbose but shallow?
9. Do the comments explain meaningful intent, or are they just restating the
   code?
10. Is the generator robust, or is it just brittle text substitution around a
    fragile template?
11. Do the tests protect the real contract, or only prove file existence?
12. If you cloned this pattern five times for future rooms, what would rot
    first?

## Required Attack Angles

### 1. Runtime honesty

- Is `createRoomScene` doing the real shared work?
- Does the room template still leak scene-specific behavior that should have
  been centralized?

### 2. Structural clarity

- Can a developer understand the pattern quickly after a month away?
- Are there files or folders that exist only symbolically?

### 3. Documentation quality

- Do the README files explain why the pattern exists, not just where files are?
- Are the testing instructions accurate and sufficient?

### 4. DRY and SOLID

- Are abstractions reusable for real reasons, or just extracted because the
  code "looked repetitive"?
- Are dependencies flowing the right direction?
- Are any modules taking on too many responsibilities?

### 5. Generator and test durability

- What will break first when file names, scene ids, imports, or registration
  surfaces change?
- Are the tests strong enough to catch that breakage early?

## Output Requirements

Your response must include:

1. findings first, ordered by severity
2. exact file references for every important finding
3. explicit notes on DRY and SOLID violations or strengths
4. explicit notes on README/comment quality
5. open questions or assumptions
6. a blunt verdict:
   - is this a good room template source or not?
   - what must change before it is trustworthy?

Do not give a soft summary first. Start with the problems.

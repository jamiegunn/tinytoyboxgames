# Minigame Template Review Prompt

Use this prompt when you want an LLM or human reviewer to attack the minigame
template system brutally.

The goal is not to admire the template. The goal is to determine whether it is
actually a strong source model for future minigames, whether the code is clean,
whether the generated output is genuinely playable, and whether the docs and
tests are good enough to prevent drift.

---

You are reviewing the canonical minigame template, its generator, and its proof
generated game.

Review it like a hostile architecture and code-quality audit.

Assume the template is guilty until proven otherwise.

## Required Review Scope

Review these areas together:

- minigame shell integration
- template folder structure
- generated game quality
- README quality and accuracy
- comment/JSDoc quality
- generator quality
- manifest integration quality
- test quality
- DRY and SOLID compliance

## Required Files To Inspect

At minimum, review:

- `/src/templates/minigame/README.md`
- `/src/templates/minigame/index.ts`
- `/src/templates/minigame/types.ts`
- `/src/templates/minigame/helpers.ts`
- `/src/templates/minigame/environment/*`
- `/src/templates/minigame/entities/*`
- `/src/templates/minigame/rules/*`
- `/src/src/minigames/framework/MiniGameManifest.ts`
- `/src/src/minigames/framework/MiniGameShell.tsx`
- `/src/scripts/create-minigame.mjs`
- `/src/scripts/lib/minigameGenerator.mjs`
- `/src/tests/minigame-template/*`
- `/src/src/minigames/games/star-catcher/*`

Also compare the template mentally against:

- `bubble-pop`
- `fireflies`
- `little-shark`

## Questions You Must Answer

1. Is the template actually derived from shared minigame architecture, or did
   it quietly copy one game's quirks?
2. Is the generated sample game truly playable, or just technically non-empty?
3. Does `index.ts` stay focused on lifecycle orchestration?
4. Are environment, entities, and rules genuinely separated by responsibility,
   or only separated by folder names?
5. Does the code follow DRY, or does it duplicate logic under the banner of
   readability?
6. Does the code follow SOLID, especially single responsibility and dependency
   direction?
7. Is teardown actually trustworthy, or will generated games leak timers,
   materials, pools, or scene objects?
8. Is the manifest/generator integration robust, or is it brittle text editing?
9. Are the README files concrete enough that a developer can use the generator
   and test the game without guessing?
10. Are the comments and JSDoc genuinely useful, or just verbose?
11. Do the template-only tests protect the real contract, or only prove files
    exist?
12. If you generated ten future minigames from this, what would degrade first?

## Required Attack Angles

### 1. Architectural honesty

- Is the template preserving shared lifecycle patterns or inventing a fake
  architecture?
- Does it fit naturally under `MiniGameShell` and `MiniGameManifest`?

### 2. Playability honesty

- Is the default loop enough to prove the template works?
- Are score, combo, miss feedback, spawning, and teardown meaningfully tested?

### 3. Documentation quality

- Does the README explain the generator, browser testing, and extension rules
  clearly?
- Are there places where tests should protect behavior instead of depending on
  prose staying current?

### 4. DRY and SOLID

- Are abstractions extracted for real reuse, or just to look "architected"?
- Are modules taking on too many reasons to change?
- Does the dependency direction keep higher-level orchestration above lower-level
  implementation details?

### 5. Generator and contract durability

- What breaks when ids, imports, or registry file shapes change?
- Does the current generator/test setup fail loudly enough?

## Output Requirements

Your response must include:

1. findings first, ordered by severity
2. exact file references for every major finding
3. explicit notes on DRY and SOLID violations or strengths
4. explicit notes on README/comment quality
5. open questions or assumptions
6. a blunt verdict:
   - is this a good minigame template source or not?
   - what must change before it is trustworthy?

Do not start with praise. Start with the problems.

# Code quality, coverage and drift audit — 2026-08-01

Commit audited: `195482c103aec17c40bd47e5ce3a3d1a7f56f4df` (branch `main`, working tree clean at start and at end).
Toolchain: Node v22.22.3, npm 10.9.8, TypeScript 5.9.3, ESLint 9.39.1, Prettier 3.8.1.
Method: the audit prompt at `.claude/commands/audit.md`. Every number below is followed by the command that produced it; the appendix carries the raw output.

**Deviation from the prompt, stated up front:** the prompt says to write this file to `docs/audits/`. That path is excluded by `.gitignore` (`docs/*` with an allowlist that does not include `audits/`), so the report would never have entered git. It is written to `docs/reviews/` instead, which the allowlist covers. No other deviation.

---

## 1. Verdict

The test suite is green — 429 of 429 pass in 23.8 s — but **284 of those 429 tests (66.2%) never execute in CI**, because `.github/workflows/ci.yml` enumerates five of the eight test directories by hand. Line coverage is **24.9% naive (9,274 / 37,255)** and **15.0% once the 152 reachable modules with no coverage record at all are counted in at zero**. Assertion strength, measured by 90 single-operator mutations, is **38.9% (Wilson 95% CI [29.5%, 49.2%], n=90)** — meaning roughly three in five semantic changes to executed code go undetected by the suite; adding `tsc` as a second grader raises it only to **51.1% [41.0%, 61.2%]**. The repository's own guard tests are unusually strong and the module-graph derivation agreed with `noUnreachableModules` exactly (3 unreachable modules, 3 allowlist entries), so the problem is not test design — it is that **the strongest guards live in the three directories CI skips**, and the one gate that would catch the rest, `check-code-quality.cjs`, is invoked by nothing and is red at HEAD.

---

## 1b. Corrections, found while applying the fixes

Everything in section 1 was written before any of it was implemented. Implementing it falsified three claims. They are corrected here rather than edited out of the body, because the body is the audit trail and a report that quietly rewrites itself is worth less than one that shows its working.

**C1 — Two of the ranked survivors are EQUIVALENT MUTANTS and cannot be killed by any test.**
Survivor #2 was `clamp`: `return v < lo ? lo : v > hi ? hi : v`, mutated `>` → `>=`. At `v === hi` the original takes the false branch and returns `v`, which _is_ `hi`; the mutant takes the true branch and returns `hi`. Same value, every input. Survivor #5, `frameClock`'s `rawDtSeconds < MAX ? rawDtSeconds : MAX`, is the same shape. Both are the classic min/max-ternary equivalence, and I ranked one of them the second most important finding in the report. It was not a finding at all.

Consequence for the headline number: at minimum 2 of the 90 mutants are unkillable by construction, and a third (`fish/effects.ts:186`, `Math.random() > 0.5` → `>=`) differs only when `Math.random()` returns exactly 0.5, probability 2⁻⁵³. Standard practice excludes equivalent mutants from the denominator. The remaining 41 survivors were **not** individually proven non-equivalent, so the corrected rate is itself an upper bound:

|                                    | killed | n   | rate      |
| ---------------------------------- | ------ | --- | --------- |
| As reported in §1                  | 35     | 90  | 38.9%     |
| After the 5 new tests below        | 40     | 90  | 44.4%     |
| Excluding the 3 unkillable mutants | 40     | 87  | **46.0%** |

**C2 — Running Prettier across the repository corrupts thirteen template files, and the proposed §5.2 fix was one line short.**
`prettier --write` over the tracked markdown rewrote `__SCENE_DISPLAY_NAME__` to `**SCENE_DISPLAY_NAME**` in all thirteen `src/templates/**/README.md` files. Markdown reads `__x__` as bold and Prettier normalizes bold to `**x**`; the generators substitute on the underscore form, so every scene generated afterwards would have shipped a README with a literal placeholder in its first line. `tests/template/immersive-scene-template.naming.test.mjs` caught it immediately — it asserts against "the broken display-name heading token", so this had already happened once before, which is why the test exists.

Two things follow. The §5.1 proposal to add a `Format check` step to CI would have been actively harmful without also excluding the templates — a green CI would have been enforcing the corruption. And §5.2's "one line" is wrong twice over: `src/.prettierignore` is not consulted at all when the gate runs from the repo root, so `check-code-quality.cjs` needed an explicit `--ignore-path` as well. Both are in the applied change.

**C3 — Line coverage is not deterministic here, so §5.6's ratchet design was unusable.**
Three identical runs of `tests/room` covered **3994**, **4022** and **4045** of the same 28,338 lines. The code under test calls `Math.random()` (`randomPick`, `randomRange`, variant and placement selection), so each run walks different branches. §5.6 proposed ratcheting `coveredLines`, which would have failed at random — and a gate that fails at random is deleted within a week.

What _is_ deterministic is which modules any test loads: the same 349 modules appeared in all three runs, byte-identical set. The implemented ratchet therefore gates on `modulesObserved` (may only rise) and `modulesWithZeroCoverage` (may only fall), and records line coverage without ever comparing it. This also explains why the re-measured headline moved from 24.9% to 22.6% after the suite got _stronger_: that difference is run-to-run noise, not a regression, and it is exactly why the number is not gated.

**Not corrected, but newly found and left alone: `wrapAngle(-π)` returns `-π`.**
`utils/math.ts` documents the range as `(-π, π]`, which excludes `-π`. The existing test passes only because it checks `w > -Math.PI - 1e-9`, and the tolerance swallows the endpoint. The surviving mutant at `math.ts:109` (`while (x < -Math.PI)` → `<=`) would _fix_ this. It is a real off-by-one, but changing it alters rotation behaviour in shipped code, so it is reported rather than applied — your call.

---

## 1c. What was applied

All of §5, with the corrections above folded in. Verified after: **438/438 tests pass**, `tsc -b` clean, probe project clean, ESLint zero warnings, `check-code-quality.cjs` Prettier stage clean.

| Change                             | File                                                                     | Effect                                                             |
| ---------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| CI runs the whole suite            | `.github/workflows/ci.yml`                                               | 145 → 438 tests in CI                                              |
| CI type-checks the probe harness   | `.github/workflows/ci.yml`                                               | closes the gap `precommit-check.cjs` documents                     |
| CI runs the formatting gate        | `.github/workflows/ci.yml`                                               | `check-code-quality.cjs` is invoked by something at last           |
| CI runs the coverage ratchet       | `.github/workflows/ci.yml`                                               | module-level coverage can no longer fall                           |
| Prettier ignores generated bundles | `src/.prettierignore`, `check-code-quality.cjs`                          | 45 of 77 failures gone; verdict no longer depends on scratch state |
| Prettier ignores template markdown | `src/.prettierignore`                                                    | prevents the C2 corruption                                         |
| 32 tracked `.md` files reformatted | `docs/**`, `src/README.md`                                               | remaining 32 failures gone; gate green                             |
| Coverage made measurable           | `src/tests/framework/_tsload.mjs`                                        | inline source maps; coverage names `.ts`, not the bundle           |
| Guard for the CI workflow          | `src/tests/framework/ciWorkflow.test.mjs` _(new, 4 tests)_               | verified red against the old `ci.yml`, green against the new       |
| Coverage ratchet                   | `src/scripts/coverage-ratchet.mjs`, `src/coverage-baseline.json` _(new)_ | both directions falsification-tested                               |
| 5 boundary assertions              | `sceneDescriptor`, `inputDispatcherTap`, `little-shark-dodge`, `math`    | **5/5 target mutants verified killed**                             |

The five newly-killed mutants, each re-run under its own mutation to confirm the test goes red: `sceneDescriptor.ts:162` (empty id accepted), `sceneDescriptor.ts:194` (zero intensity rejected), `fish/effects.ts:167` (one extra dodge), `InputDispatcher.ts:148` (drag threshold), `InputDispatcher.ts:175` (wobble-tap tolerance).

Still open: 39 survivors, the 152 zero-coverage modules, and the `wrapAngle` question above.

---

## 2. Numbers

| Metric                                  | Value                        | Derivation 1                             | Derivation 2                                             | Delta  | Tolerance | Agrees?       |
| --------------------------------------- | ---------------------------- | ---------------------------------------- | -------------------------------------------------------- | ------ | --------- | ------------- |
| Production files                        | 545 `.ts`/`.tsx`             | `find src -name '*.ts*' \| wc -l` = 545  | `walk(SRC)` in `_moduleGraph.mjs` = 545                  | 0      | 0         | ✅            |
| Production SLOC                         | 35,613                       | own counter, comments stripped           | per-dir sum, conservation check                          | 0      | 0         | ✅            |
| Test files                              | 68 `.test.mjs`               | `find tests -name '*.test.mjs'` = 68     | classification partition 34+10+24 = 68                   | 0      | 0         | ✅            |
| Test cases executed                     | 429                          | `node --test` → `# tests 429`            | per-directory sum 22+174+7+102+8+8+103+5 = 429           | 0      | 0         | ✅            |
| Tests run by CI                         | 145 (33.8%)                  | read `ci.yml` job steps                  | ran CI's exact command → `# tests 145`                   | 0      | 0         | ✅            |
| Line coverage (naive)                   | **24.9%** (9,274 / 37,255)   | merged lcov, 8 runs, source-mapped       | —                                                        | —      | —         | single        |
| Modules with a coverage record          | 392                          | lcov `SF:` entries under `src/`          | —                                                        | —      | —         | single        |
| Modules reachable from entry            | 542 of 545                   | `reachFrom(['src/main.tsx'])`            | `noUnreachableModules` allowlist has 3 entries           | 0      | 0         | ✅            |
| Reachable, **zero** coverage record     | **152**                      | set difference R \ C                     | conservation: 390 + 152 = 542 = \|R\|                    | 0      | 0         | ✅            |
| Line coverage (reachability-corrected)  | **15.0%** (9,274 / 61,861)   | naive + unobserved set at 0%             | raw-SLOC denominator → 18.0%                             | 3.0 pp | est.      | bounds stated |
| Module-level coverage of reachable code | 72.0% (390 / 542)            | exact, no denominator estimate           | —                                                        | —      | —         | single        |
| Mutation kill rate — tests only         | **38.9%** (35 / 90)          | per-mutant targeted runs                 | all 44 survivors applied at once → 429/429 green         | 0      | 0         | ✅            |
| Mutation kill rate — tests + `tsc`      | **51.1%** (46 / 90)          | 35 test-killed + 11 type-killed          | same combined run, `tsc` exit 0 on the 44                | 0      | 0         | ✅            |
| ESLint                                  | 0 errors, 0 warnings, 32.0 s | `npx eslint . --max-warnings 0` → exit 0 | —                                                        | —      | —         | single        |
| `tsc -b --noEmit`                       | clean, 8.8 s                 | exit 0                                   | —                                                        | —      | —         | single        |
| `check-code-quality.cjs`                | **FAILS**, 22.3 s            | exit 1, 77 files                         | 32 tracked `.md` + 45 generated `.tstest-tmp/*.mjs` = 77 | 0      | 0         | ✅            |

### Coverage by directory (naive; files absent from the report excluded)

| Directory    | Files in report | Instrumented lines | Covered   | **Uncovered** | %         |
| ------------ | --------------- | ------------------ | --------- | ------------- | --------- |
| `scenes`     | 294             | 19,714             | 3,507     | **16,207**    | 17.8%     |
| `utils`      | 35              | 5,918              | 2,301     | **3,617**     | 38.9%     |
| `minigames`  | 16              | 4,669              | 2,122     | **2,547**     | 45.4%     |
| `assets`     | 24              | 3,960              | 393       | **3,567**     | 9.9%      |
| `entities`   | 12              | 1,462              | 25        | **1,437**     | 1.7%      |
| `toyboxes`   | 10              | 1,241              | 766       | 475           | 61.7%     |
| `components` | 1               | 291                | 160       | 131           | 55.0%     |
| **Total**    | **392**         | **37,255**         | **9,274** | **27,981**    | **24.9%** |

Percentages hide size: `scenes` at 17.8% holds 16,207 uncovered lines — more than the entire `utils`, `minigames`, `assets` and `entities` uncovered counts combined.

### The 152 reachable modules with no coverage record at all

| Directory                                                     | Files   | SLOC       |
| ------------------------------------------------------------- | ------- | ---------- |
| `minigames`                                                   | 92      | 12,837     |
| `components`                                                  | 8       | 723        |
| `scenes`                                                      | 43      | 239        |
| `bootstrap`                                                   | 1       | 125        |
| `App.tsx`                                                     | 1       | 61         |
| others (`toyboxes`, `entities`, `types`, `main.tsx`, `utils`) | 7       | 162        |
| **Total**                                                     | **152** | **14,147** |

Largest: `little-shark/index.ts` (865), `little-shark/environment/ambientLife.ts` (757), `cannonball-splash/environment/setup.ts` (584), `fireflies/index.ts` (570), `star-catcher/environment/setup.ts` (479), `bubble-pop/index.ts` (431).

**Four of the five shipped minigames — `cannonball-splash`, `fireflies`, `star-catcher`, `bubble-pop` — have no executed line in any test.** Only `little-shark` has behavioural tests, and 92 of its sibling modules are still unobserved.

### Test suite composition

| Class         | Rule                                                                                           | Files  | Share |
| ------------- | ---------------------------------------------------------------------------------------------- | ------ | ----- |
| behavioural   | imports `loadTs`/`bundleTs`/`bundleEntry`/`bundleComponent`, i.e. executes the code under test | 34     | 50.0% |
| structural    | does not execute; asserts on source text or filesystem shape                                   | 24     | 35.3% |
| documentation | does not execute; reads a `.md`/README and asserts it matches code                             | 10     | 14.7% |
| **Total**     |                                                                                                | **68** | 100%  |

Conservation: 34 + 24 + 10 = 68 ✅. Half the suite is non-executing. That is a deliberate and defensible design here — the structural guards are what stop architectural drift — but it means the 429-test count overstates behavioural confidence by roughly a factor of two, and the mutation result below is the number that actually describes it.

---

## 3. Surviving mutants — ranked

90 mutations, one semantic operator each, applied only to lines the coverage data proves were **executed**. 35 were killed by an assertion; 11 more were killed by `tsc` alone (the tests stayed green); **44 survived every automated gate the repository has.** The 44 were then applied _simultaneously_ and the full suite re-run: `tsc` exit 0, `# tests 429 / # pass 429 / # fail 0`. That is the proof, not an inference.

Assertion kill rate **38.9%**, Wilson 95% CI **[29.5%, 49.2%]**, half-width ±9.9 pp — inside the ±10 pp the method requires, so the conclusion stands. (The sample is 90 of 153 eligible sites; with the finite-population correction the interval narrows to [33.0%, 45.7%]. The uncorrected interval is reported as the conservative one.)

The pattern is consistent and worth naming: **almost every survivor is a boundary condition inside a file that already has a dedicated, well-named test.** The tests assert the happy path; the comparison operator is unpinned.

| #   | Site                                             | Mutation                                           | Why it matters                                                                                                   | Test that should have caught it                             |
| --- | ------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `utils/interaction/interactionController.ts:308` | `paused \|\| !isDown` → `&&`                       | Input is processed **while the game is paused**. Both guards must now fail to short-circuit.                     | `tapArbitration.test.mjs`                                   |
| 2   | `utils/math.ts:21`                               | `v > hi` → `>=`                                    | `clamp` is the most widely shared utility in the codebase; its upper boundary is unpinned.                       | `math.test.mjs`                                             |
| 3   | `minigames/framework/InputDispatcher.ts:148`     | `totalDistance >= DRAG_THRESHOLD` → `>`            | Tap/drag arbitration boundary moves by one pixel — the exact class of defect `tapArbitration` exists to prevent. | `inputDispatcherTap.test.mjs`, `tapArbitration.test.mjs`    |
| 4   | `minigames/framework/InputDispatcher.ts:175`     | `totalDistance < WOBBLE_TAP_TOLERANCE` → `<=`      | Wobbly-tap tolerance boundary, same subsystem.                                                                   | as above                                                    |
| 5   | `utils/frameClock.ts:51`                         | `rawDtSeconds < MAX_DELTA_SECONDS` → `<=`          | The delta-time clamp that protects every animation from a tab-restore spike.                                     | `frameClock.test.mjs`                                       |
| 6   | `little-shark/fish/effects.ts:167`               | `fish.dodgeCount >= maxDodges` → `>`               | Fish get one extra dodge. There is a test file **named** `little-shark-dodge.test.mjs`.                          | `little-shark-dodge.test.mjs`                               |
| 7   | `little-shark/fish/effects.ts:152`               | `!fish.active \|\| kind !== 'golden'` → `&&`       | Golden-fish gating collapses; inactive fish get golden behaviour.                                                | `little-shark-dodge.test.mjs`                               |
| 8   | `assets/audio/utils/audioEngine.ts:61`           | `ctx === audioContext` → `!==`                     | Inverts an early-return guard outright — the engine now returns in exactly the cases it used to handle.          | `audioContextLifecycle.test.mjs`                            |
| 9   | `components/AudioProvider.tsx:103`               | `!disposed && state === 'running'` → `\|\|`        | A **disposed** AudioContext is treated as resumable.                                                             | `audioContextLifecycle.test.mjs`                            |
| 10  | `utils/qualityTier.ts:34`                        | `window undefined \|\| navigator undefined` → `&&` | Headless/SSR guard requires _both_ to be missing; a partial environment now walks into `navigator` access.       | `qualityTier` path in framework tests                       |
| 11  | `little-shark/environment/regions.ts:277`        | `d >= r.radius` → `>`                              | Region containment boundary — points exactly on the radius flip regions.                                         | `little-shark-regions.test.mjs`                             |
| 12  | `little-shark/celebrations.ts:189`               | `comboStreak >= 2` → `>`                           | Combo celebration now needs 3, not 2. Directly player-visible.                                                   | `little-shark-celebration.test.mjs`                         |
| 13  | `little-shark/frenzy.ts:139`                     | `phaseTime >= FRENZY_AFTERGLOW` → `>`              | Afterglow phase never terminates on the exact frame.                                                             | `little-shark-frenzy.test.mjs`                              |
| 14  | `utils/scene/sceneDescriptor.ts:162`             | `d.id.length > 0` → `>=`                           | **The validator's own emptiness check is disabled** — every empty id now validates.                              | `sceneDescriptor.test.mjs`                                  |
| 15  | `utils/scene/sceneDescriptor.ts:194`             | `light.key.intensity >= 0` → `>`                   | Validator now rejects a legal intensity of exactly 0.                                                            | `sceneDescriptor.test.mjs`                                  |
| 16  | `utils/interaction/interactionController.ts:289` | `projected.z > 1` → `>=`                           | Behind-camera culling boundary.                                                                                  | `pirateCoveInteraction.test.mjs`                            |
| 17  | `little-shark/shark/movement.ts:153,219,419`     | three boundary flips                               | Speed, distance and idle-drift thresholds — three survivors in one file.                                         | `little-shark-agency.test.mjs`, `little-shark-rig.test.mjs` |
| 18  | `frenzyHud.ts:140,142,152`                       | three flips                                        | HUD reveal/opacity thresholds.                                                                                   | `little-shark-hud.test.mjs`                                 |
| 19  | `CelebrationSystem.ts:94,147`                    | `> 1e-4` → `>=`, `\|\| 1` → `&& 1`                 | Epsilon guard and a canvas-dimension fallback that now yields `1` for every non-zero height.                     | `celebrationSystem.test.mjs`                                |
| 20  | `pirate-cove/.../sea/ripple.ts:170,184`          | `\|\|` → `&&`, `> 0` → `>=`                        | Canvas-size fallback chain and a degenerate-radius guard.                                                        | `pirate-cove-*` tests                                       |

The remaining 24 survivors are loop bounds in geometry builders (`for (let i = 0; i < N; i++)` → `<=`) and shader-string thresholds in `proceduralSurface.ts`. These are lower severity — an off-by-one in a decorative mesh loop is a visual defect, not a correctness one — but they are undetected all the same, and the same mutation in `sceneShell/create.ts:102` _was_ killed, which shows the geometry tests can catch this class when the assertion is written.

**11 mutants were killed by `tsc` and by nothing else** (`InputDispatcher.ts:89`, `celebrations.ts:167`, `fish/effects.ts:83`, `frenzyHud.ts:150`, `sceneShell/create.ts:258`, `sceneShell/interaction.ts:78`, `sceneDescriptor.ts:192,196`, `AudioProvider.tsx:137`, `emblem.ts:34,63`). The type-checker is doing a meaningful share of this repository's defect detection. That is worth knowing, because it means TypeScript strictness settings are load-bearing safety infrastructure here, not just ergonomics.

---

## 4. Unenforced invariants

Detection latency ∈ {pre-commit, CI, review, production, **never**}. The `never` rows are the findings.

| #      | Invariant                                         | Predicate                                        | Enforced today by                                                          | Latency    | Cost if violated                                                                                                                                                                                                    |
| ------ | ------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | CI runs the whole contract suite                  | `ci.yml` test step matches `tests/**/*.test.mjs` | **nothing**                                                                | **never**  | 284 tests (66.2%) — every architectural guard in `framework/`, all of `minigames/`, all of `particles/` — pass or fail unobserved on `main`. A contributor without the local hook installed can merge through them. |
| **D2** | `check-code-quality.cjs` passes                   | its own exit code                                | **nothing** — no script, no hook, no workflow references it                | **never**  | It is red at HEAD (77 files). A gate nobody runs is a comment; this one has apparently been red since at least the 2026-07-18 review, which records the same failure.                                               |
| **D3** | The Prettier target set excludes generated output | `.tstest-tmp/**` not in the glob                 | nothing                                                                    | **never**  | 45 of the 77 failures are esbuild bundles. The gate's verdict now depends on whether you have run the tests recently — the same commit passes or fails depending on scratch state.                                  |
| **D4** | Markdown stays formatted                          | Prettier `--check` on `docs/**/*.md`             | only `check-code-quality.cjs`, which nothing runs                          | **never**  | 32 tracked `.md` files fail, 13 of them in `docs/reviews/`.                                                                                                                                                         |
| **D5** | The probe harness type-checks                     | `tsc -p .probe/tsconfig.probe.json`              | pre-commit only                                                            | pre-commit | CI omits it. The gap `precommit-check.cjs` documents at length as its own past failure is live again in CI.                                                                                                         |
| **D6** | Coverage does not fall                            | any coverage measurement                         | **nothing — no instrumentation exists**                                    | **never**  | No baseline, so no drift can be detected. This audit is the first measurement.                                                                                                                                      |
| **D7** | Assertion strength does not fall                  | any mutation measurement                         | nothing                                                                    | **never**  | 38.9% is now a recorded baseline; without a gate it is a snapshot, not a floor.                                                                                                                                     |
| **D8** | The pre-commit hook is actually installed         | `core.hooksPath=.githooks`                       | `prepare` script, which runs only on `npm`/`bun install` **inside `src/`** | review     | A clone whose owner installs from the repo root, or uses a package manager that skips lifecycle scripts, has no hook — and CI does not compensate (D1).                                                             |
| D9     | No module unreachable without a reason            | `noUnreachableModules.test.mjs`                  | pre-commit (not CI)                                                        | pre-commit | Well enforced. My independent derivation matched it exactly: 3 unreachable, 3 allowlist entries.                                                                                                                    |
| D10    | No unused exports                                 | `noUnusedExports.test.mjs`                       | pre-commit (not CI)                                                        | pre-commit | Well enforced, but in a CI-skipped directory.                                                                                                                                                                       |
| D11    | Gate and `npm test` cannot enumerate directories  | `precommitGate.test.mjs`                         | pre-commit (not CI)                                                        | pre-commit | **Asserted for `precommit-check.cjs` and `package.json` — and `ci.yml` does exactly the forbidden thing, unwatched.**                                                                                               |

D11 is the sharpest one. `precommit-check.cjs` carries a comment explaining that an enumerated directory list is "an exclusion criterion doing unchecked work", and `precommitGate.test.mjs` asserts the glob is recursive so it can never regress. The same mistake is sitting in `ci.yml`, in the same repository, and the test that encodes the rule is itself in `tests/framework/` — one of the directories `ci.yml` does not run. The guard cannot see the thing it was written to prevent.

---

## 5. Proposed gates — unified diffs, unapplied

Nothing below has been applied. Ordered by value per line of change.

### 5.1 CI runs the whole suite (fixes D1, D5)

```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@
       - name: Typecheck
         run: bunx tsc -b

+      - name: Typecheck probe harness
+        run: bunx tsc -p .probe/tsconfig.probe.json --noEmit
+
       - name: Lint
         run: bunx eslint . --max-warnings 0

+      - name: Format check
+        run: node ../check-code-quality.cjs
+
       - name: Contract tests
-        run: node --test tests/template/*.test.mjs tests/room/*.test.mjs tests/room-template/*.test.mjs tests/minigame-template/*.test.mjs tests/audio/*.test.mjs
+        # A directory list is an exclusion criterion doing unchecked work — see
+        # the docblock in scripts/precommit-check.cjs. node expands this itself;
+        # do not add a shell.
+        run: node --test "tests/**/*.test.mjs"

       - name: Build
         run: bunx vite build
```

The `Format check` step must not be added until 5.2 and 5.3 land, or CI goes red immediately.

### 5.2 Stop grading generated output (fixes D3)

```diff
--- a/src/.prettierignore
+++ b/src/.prettierignore
 dist
 node_modules
 .vite
+.tstest-tmp
```

Verified: `.tstest-tmp` is in `src/.gitignore` but not in `.prettierignore`, and `check-code-quality.cjs` passes `src/**/*.{...,mjs,...}` from the repo root, which matches it. This one line removes 45 of the 77 failures.

### 5.3 Reformat the 32 tracked markdown files

`node_modules/.bin/prettier --config src/.prettierrc --write $(git ls-files '*.md')` — a mechanical, reviewable commit. It should land on its own so it does not hide a substantive change in the diff.

### 5.4 A guard for the guard (fixes D11)

New file, mirroring `precommitGate.test.mjs`'s own rule. Note the placement: `tests/framework/` is exactly where CI cannot see it today, so this test is only meaningful **after** 5.1 lands.

```diff
--- /dev/null
+++ b/src/tests/framework/ciWorkflow.test.mjs
@@
+/**
+ * The CI workflow may not enumerate test directories.
+ *
+ * `scripts/precommit-check.cjs` states the rule and `precommitGate.test.mjs`
+ * pins it — for the hook and for package.json. Nothing pinned it for CI, and
+ * on 2026-08-01 CI was running five of eight directories: 145 of 429 tests.
+ * The 284 it skipped included every guard in this directory, which is to say
+ * the rule was unenforced in the one place a contributor without the local
+ * hook would rely on it.
+ */
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { readFileSync, readdirSync } from 'node:fs';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+const CI = path.join(PKG, '..', '.github', 'workflows', 'ci.yml');
+
+test('the CI workflow runs the contract suite by recursive glob, not by directory list', () => {
+  const yml = readFileSync(CI, 'utf8');
+  const step = yml.split('\n').find((l) => l.includes('node --test'));
+  assert.ok(step, 'ci.yml must run node --test');
+  assert.match(step, /tests\/\*\*\/\*\.test\.mjs/, 'CI must use the recursive glob');
+  assert.ok(!/tests\/[a-z-]+\/\*\.test\.mjs\s+tests\//.test(step), 'CI must not enumerate test directories');
+});
+
+test('every test directory is reachable by the CI glob', () => {
+  const dirs = readdirSync(path.join(PKG, 'tests'), { withFileTypes: true })
+    .filter((e) => e.isDirectory())
+    .map((e) => e.name);
+  const yml = readFileSync(CI, 'utf8');
+  const named = dirs.filter((d) => yml.includes(`tests/${d}/`));
+  assert.deepEqual(named, [], `ci.yml names specific test directories: ${named.join(', ')}`);
+});
```

### 5.5 Make coverage measurable at all (fixes D6)

Without this patch there is no per-source coverage in this repository: `bundleTs`/`bundleEntry` emit no source map, so V8 attributes every executed line to `.tstest-tmp/*.bundle.mjs` and the real files never appear. Every coverage number in this report was produced with this patch applied in a scratch copy.

```diff
--- a/src/tests/framework/_tsload.mjs
+++ b/src/tests/framework/_tsload.mjs
@@ export async function loadTs(relPath) {
-  const code = esbuild.transformSync(readFileSync(abs, 'utf8'), { loader: 'ts', format: 'esm', target: 'es2022' }).code;
+  // sourcemap + sourcefile so `node --enable-source-maps --experimental-test-coverage`
+  // attributes coverage to the .ts file rather than to the temp bundle.
+  const code = esbuild.transformSync(readFileSync(abs, 'utf8'), { loader: 'ts', format: 'esm', target: 'es2022', sourcemap: 'inline', sourcefile: abs }).code;
@@ async function runBundle({ plugins: extraPlugins = [], ...inputOptions }, outName) {
     target: 'es2022',
+    sourcemap: 'inline',
+    sourcesContent: true,
     platform: 'neutral',
```

Then:

```
node --enable-source-maps --test --experimental-test-coverage \
     --test-reporter=lcov --test-reporter-destination=coverage.info "tests/**/*.test.mjs"
```

`--enable-source-maps` is not optional — without it the maps are emitted and ignored, and the report still names the bundles. That was verified both ways.

### 5.6 The ratchet (fixes D6, D7)

Absolute thresholds get lowered under deadline pressure; a monotone ratchet can only be raised. Proposed baseline, recorded from this audit:

```diff
--- /dev/null
+++ b/src/coverage-baseline.json
@@
+{
+  "recordedAt": "2026-08-01",
+  "commit": "195482c103aec17c40bd47e5ce3a3d1a7f56f4df",
+  "lineCoverageNaivePct": 24.9,
+  "coveredLines": 9274,
+  "uncoveredLines": 27981,
+  "reachableModules": 542,
+  "modulesWithZeroCoverage": 152,
+  "mutationAssertionKillRatePct": 38.9,
+  "mutationSampleSize": 90,
+  "_note": "Direction of travel: coveredLines and the kill rate may only rise; uncoveredLines and modulesWithZeroCoverage may only fall. To lower a number, edit it here in the same commit with a one-line justification below. The audit trail is the point — a ratchet with no documented way down gets deleted by whoever it blocks at 6pm on a Friday.",
+  "justifications": []
+}
```

Gate: `coveredLines(HEAD) >= baseline`, `modulesWithZeroCoverage(HEAD) <= baseline`. Run it in CI after 5.1 and 5.5. Deliberately _not_ a percentage — a percentage rises when you delete code, which is the wrong incentive for a repository whose largest uncovered directory is 16,207 lines.

### 5.7 Highest-value tests to write next

Not a gate, but the shortest path from 38.9% upward. Each of these is one boundary assertion in a test file that already exists:

1. `math.test.mjs` — `clamp(hi, lo, hi) === hi` and `clamp(hi + ε, …)`. Kills survivor #2, the most widely shared function in the codebase.
2. `inputDispatcherTap.test.mjs` — a gesture at exactly `DRAG_THRESHOLD` and at exactly `WOBBLE_TAP_TOLERANCE`. Kills #3 and #4.
3. `tapArbitration.test.mjs` — assert no input is dispatched while `paused` is true. Kills #1, which is the only survivor that is a plain logic inversion rather than a boundary.
4. `audioContextLifecycle.test.mjs` — resume attempted on a disposed context must be a no-op. Kills #9.
5. `sceneDescriptor.test.mjs` — empty-string id must be rejected; `intensity: 0` must be accepted. Kills #14 and #15.
6. Any executing test at all for `cannonball-splash`, `fireflies`, `star-catcher`, `bubble-pop` — four shipped minigames with zero executed lines. The `minigame-template` suite already shows the shape.

---

## 6. Self-audit

**Q1 — What did I measure by proxy and then report as direct?**
My first pass at the test-suite classification (§2) used a keyword grep and produced 34 behavioural / 22 structural / 12 documentation. It was wrong: it put `noCopiedConstants.test.mjs` in _behavioural_ because the word `bundleTs` appeared, and `precommitGate.test.mjs` in _documentation_ because the word `README` appeared. I replaced it with a mechanism-based rule (does the file import a loader that executes the code under test; failing that, does it read a `.md`) and the numbers moved to 34 / 24 / 10. The published table is the second one. The residual weakness is stated rather than hidden: `particles/particle-engine.test.mjs` is classed structural because it does not import a `_tsload` helper, and I did not read all 68 files individually to confirm every assignment. Treat the 50/35/15 split as ±2 files per bucket, not exact.

**Q2 — Which of my two derivations agreed only because they share a mechanism?**
The module-graph derivation (`|R| = 542`, 3 unreachable) uses `_moduleGraph.mjs` — the _same_ resolver `noUnreachableModules.test.mjs` uses. Their agreement is therefore not independent confirmation, and I have not claimed it as such. It confirms I invoked their resolver correctly, nothing more. Both share one real limitation, stated in that file's own docblock: it is regexes, not a TypeScript parser. The coverage-vs-reachability comparison _is_ independent — V8 runtime instrumentation against static text analysis, no shared code path — and that is the one the 24.9% → 15.0% correction rests on.

**Q3 — Highest-confidence claim, and the command that would falsify it.**
Claim: CI executes 145 of 429 tests. Falsifying command — CI's exact test step, run verbatim:

```
$ node --test tests/template/*.test.mjs tests/room/*.test.mjs tests/room-template/*.test.mjs \
       tests/minigame-template/*.test.mjs tests/audio/*.test.mjs
# tests 145
# pass 145
# fail 0
```

145 confirmed against the independently-derived per-directory sum (5 + 103 + 8 + 7 + 22 = 145). The claim stands.

**Q4 — What did I not measure?** (`unmeasured`, not `fine`)

- **`vite build`** — never run in this audit. CI runs it; I did not. Whether the production bundle builds at HEAD is unmeasured here.
- **Branch and function coverage** — the merged lcov carries `DA:` line records only. Every coverage number above is _line_ coverage. Branch coverage is strictly lower and is unmeasured.
- **The other 63 eligible mutation sites** — 90 of 153 sampled. The interval accounts for this; the specific 63 do not appear in §3.
- **Mutation sites in the 152 zero-coverage modules** — deliberately excluded, since a mutation in never-executed code cannot be killed and would have inflated the survivor count with a trivially predictable result. The kill rate therefore describes _executed_ code only, and is an **upper** bound on the suite's strength over the codebase as a whole.
- **Mutation classes other than single-operator flips** — no statement deletions, no constant perturbations, no argument swaps. Constant perturbation is the notable gap: `noCopiedConstants.test.mjs` suggests constants are load-bearing here.
- **The 45 shader/GLSL lines** — `bundleTs` stubs shaders to `''` by design, so no test can observe shader text; `proceduralSurface.ts` survivors are inside strings the harness cannot reach.
- **`.probe/`** — 120 tracked files, type-checked by the pre-commit gate, not otherwise examined.
- **Runtime/visual correctness** — nothing in this audit renders a frame. A mutation that changes what a child sees but not what a test asserts is counted as "survived", which is correct, but no positive claim about visual output is made anywhere.
- **Test flakiness** — every suite run in this audit was deterministic and green, but I did not run the suite repeatedly to look for flakes, and `Math.random()` appears in mutated lines (`fish/effects.ts:186`).

**Q5 — Where would a competent engineer who disagrees with me be right?**

The strongest counter-argument is that **24.9% line coverage is the wrong metric for this codebase and I have made it look worse than it is.** Most of `src/scenes` is declarative geometry — vertex tables, material constants, staging arrays. Executing those lines proves nothing, and _asserting_ on them would produce exactly the brittle change-detector tests that make refactoring miserable. On that view the repository has already made the right trade: it spends its effort on structural guards (`noUnusedExports`, `noCopiedConstants`, `noAbandonedMigrations`) that catch the failures that actually happen here — a scene silently unregistered, a constant copied and then diverged, a migration half-finished — none of which line coverage would ever catch. The reachability-corrected 15.0% figure sharpens this objection rather than answering it, because the 152 zero-coverage modules are dominated by minigame _content_, and demanding coverage of content is how you get a suite that fights every edit.

I think that argument is right about `scenes` and wrong about the rest, and the mutation result is what separates them: the survivors are not in vertex tables, they are in `clamp`, in the tap/drag threshold, in the paused-input guard, in the audio disposal check, and in the descriptor validator's own emptiness test. Those are behavioural boundaries in shared logic, in files that already have dedicated tests. That is not a coverage complaint; it is a missing-assertion complaint, and it survives the objection intact.

What the objection does defeat is any proposal to gate on a coverage _percentage_, which is why §5.6 ratchets absolute covered-line and zero-coverage-module counts instead. And it leaves D1 — 66.2% of tests not running in CI — completely untouched. That finding does not depend on any opinion about what coverage is worth.

---

## 7. Unmeasured

Consolidated from Q4, so nothing here reads as "no findings": `vite build`; branch and function coverage; 63 of 153 eligible mutation sites; all mutation in the 152 zero-coverage modules; non-operator mutation classes; shader/GLSL source; `.probe/` (120 files); rendered visual output; test flakiness under repetition; performance and bundle size; accessibility; dependency vulnerabilities; and the `deploy-pages.yml` workflow, which was read but not exercised.

---

## 8. Appendix — raw command output

All commands run at `195482c1`, in `src/` unless noted.

```
$ git rev-parse HEAD
195482c103aec17c40bd47e5ce3a3d1a7f56f4df
$ git status --porcelain          # empty, before and after
$ node --version
v22.22.3

$ node --test "tests/**/*.test.mjs"
# tests 429   # suites 0   # pass 429   # fail 0
# cancelled 0 # skipped 0  # todo 0     # duration_ms 23774.536594

$ npx eslint . --max-warnings 0            → exit 0,  WALL 32.00 s
$ npx tsc -b --noEmit                      → exit 0,  WALL  8.79 s
$ node ../check-code-quality.cjs           → exit 1,  WALL 22.33 s
    [warn] Code style issues found in 77 files. Run Prettier with --write to fix.
    → 45 under src/.tstest-tmp (generated, untracked), 32 tracked .md
      (13 in docs/reviews, 2 docs/ai-guidance/reviews, 2 docs/ai-guidance,
       1 docs, 13 src/templates/**/README.md, 1 src)
$ node scripts/precommit-check.cjs         → exit 1 ("staged file list was not
    provided") — by design; it is reachable only through .githooks/pre-commit.

per-directory test counts (each `node --test tests/<dir>/*.test.mjs`):
  audio 4 files / 22 tests          framework 21 / 174
  minigame-template 7 / 7           minigames 9 / 102
  particles 1 / 8                   room 16 / 103
  room-template 5 / 8               template 5 / 5
  sum = 68 files, 429 tests  ✅ matches the whole-suite run

CI's exact command:
  # tests 145  # pass 145  # fail 0     → 429 − 145 = 284 tests never run in CI

coverage (8 runs, merged lcov, _tsload patched per §5.5, --enable-source-maps):
  lcov files merged: 8;  distinct SF entries: 471
  SF entries under src/ that are .ts/.tsx: 392
  TOTAL files=392 lines=37255 covered=9274 uncovered=27981 → 24.9%
  CONSERVATION naive: files OK (392 vs 392); lines OK; cov OK

second derivation (reachFrom(['src/main.tsx'])):
  |allSrc| = 545      |R| = 542      |allSrc \ R| = 3
  CONSERVATION: 542 + 3 = 545 ✅
  |C| = 392   |R ∩ C| = 390   |R \ C| = 152   |C \ R| = 2
  CONSERVATION: 390 + 152 = 542 = |R| ✅
  computed import() holes in graph: 0
  module-level coverage of reachable code: 390/542 = 72.0%
  allSrc \ R = utils/scene/{buildScene,sceneDescriptor,sceneDescriptors}.ts
             — all three present in noUnreachableModules ALLOWED, with reasons.

reachability-corrected line coverage:
  lcov instrumented lines for the 392 observed files = 37255
  my SLOC for those same 392 files                   = 21419
  ratio lcov/SLOC = 1.7393
  SLOC of the 152 unobserved files = 14147 → est. 24606 instrumented lines
  9274 / (37255 + 24606) = 15.0%
  raw-SLOC denominator (no scaling): 9274 / (37255 + 14147) = 18.0%

mutation, n = 90 (sites sampled only from lines lcov proves were executed):
  killed by an assertion ............ 35
  killed by tsc, tests stayed green . 11
  survived every gate ............... 44
  CONSERVATION: 35 + 11 + 44 = 90 ✅

  assertion kill rate 35/90 = 38.9%
    Wilson 95% = [29.5%, 49.2%]   half-width ±9.9 pp
    with finite-population correction (N=153): [33.0%, 45.7%], ±6.4 pp
  gate kill rate (tests + tsc) 46/90 = 51.1%
    Wilson 95% = [41.0%, 61.2%]   half-width ±10.1 pp

  survivor confirmation — all 44 applied simultaneously across 22 files:
    tsc -b --force      → exit 0, 0 errors
    node --test "tests/**/*.test.mjs" → # tests 429 # pass 429 # fail 0
    all 22 files restored; scratch tree matches HEAD except the §5.5 patch

test-suite classification (mechanism-based rule, §2):
  behavioral 34 + structural 24 + documentation 10 = 68 ✅

isolation: every mutation ran in a scratch copy at /tmp, never in the repository.
final check: `git status --porcelain` in the repository → empty.
```

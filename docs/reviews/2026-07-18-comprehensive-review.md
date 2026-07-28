# Tiny Toybox Games — Comprehensive Review

**Date:** July 18, 2026
**Reviewed:** full repository snapshot (`~491 TS/TSX files, ~45,000 LOC`), built and tested in a clean environment
**Context:** primary player is a 3–4 year old, playing on iPad, phone, and laptop; the project is designed to be extended for years as he grows

---

## 1. Overall Assessment

This is an unusually well-conceived project. The bones are excellent: single registration surfaces per content type, marker-driven code generators, contract tests that police the templates, a disciplined React-shell / imperative-Three boundary, honest "registered vs discoverable vs implemented" vocabulary, and a genuinely defensible zero-persistence privacy stance for a kids' product. The `docs/status/current-state.md` + `controlled-terminology.md` pair is better anti-drift documentation than most professional teams maintain. These are exactly the right foundations for a decade of growth.

The problems are almost all **process failures, not design failures** — and they share one root cause: **nothing runs your quality gates automatically.** As of this snapshot:

| Gate | Status |
|---|---|
| `npm run build` (tsc + vite) | ❌ **FAILS** — 9 TypeScript errors |
| Test suite | ❌ **6 of 25 tests fail** |
| ESLint | ⚠️ 171 warnings (0 errors); the strict gate (`check-code-quality.cjs --max-warnings 0`) fails |
| `vite build` alone | ✅ builds (type checking skipped) |
| CI | ❌ none exists (no `.github/`, no pipeline anywhere) |

**The current tree cannot produce a new Docker image** — the Dockerfile runs `bun run build`, which runs `tsc -b`, which fails. The live site must have been built from an older, type-clean tree. Meanwhile a docs purge (the `docs/adr/`, `docs/specs/`, `docs/features/` trees are gone) left ~20 dangling references across README, CLAUDE.md, agents.md, and skills.md, and left 6 contract tests asserting README scaffolding that no longer exists in the templates.

The second-biggest finding is a happy one, in a way: **a large fraction of your audio system is well-built but silently unwired.** Whole games (Little Shark, Cannonball Splash) are effectively silent because the sound IDs they request don't exist in the registry, and the registry no-ops silently on unknown IDs. The best sound design in the codebase — a 395-line shark synth bank — is never imported by anything. Fixing wiring, before writing a note of new music, transforms the audio experience.

Everything below is organized so you can fix in priority order. Sections: build health (§2), audio/music (§3), graphics (§4), child UX (§5), architecture/extensibility (§6), documentation (§7), and a consolidated roadmap (§8).

---

## 2. Build Health — Restore the Ability to Ship (P0)

### 2.1 The 9 TypeScript errors

All are small and mechanical:

1. **Pirate Cove leftover generator scaffolding (6 errors).** When Pirate Cove's `materials.ts` was hand-rewritten into a real palette (`PirateCoveMaterials`), the generated sample props (`factory/props/simple/sampleSimple/`, `factory/props/interactive/sampleInteractive/`, and their `staging/` entries) were never deleted. They still reference the old `ImmersiveSceneMaterials` type and its `sampleSimpleBase`/`sampleInteractiveStem` keys. They're dead code — nothing composes them into the scene. **Fix: delete the four sample-prop locations.** (Nature did this cleanup correctly.)
2. **`cannonball-splash/rules/index.ts:79`** — unused `scene` parameter trips `noUnusedParameters`. Rename to `_scene`.
3. **`sceneCatalog.ts:48,59`** — `playroom` and `kitchen` omit the optional `games` property, so under `as const satisfies`, the union type lacks `.games`. **Fix: add `games: []` to both landing scenes.**

### 2.2 The 6 failing tests

All six fail on missing `README.md` files. A documentation purge removed README scaffolding from the templates (and the playroom), but the contract tests still assert the old "instructional scaffolding" contract. The room template kept its `GENERATED_README.md.template` (which the generator renames), which is why room-generator doc tests partially pass.

**Recommendation: restore README scaffolding to all three templates** using the room template's `GENERATED_README.md.template` rename pattern, rather than weakening the tests. Your whole workflow leans on generated docs for AI collaborators; the tests were right and the purge was wrong. Either way, decide deliberately — a permanently red suite trains you to ignore it, which is fatal for a years-long project.

### 2.3 The masking bug that let this happen

The one test that runs `tsc` (`minigame-template.compile-check.test.mjs`) **filters compiler output to errors inside the star-catcher directory only** — so the suite passes even when the project typecheck is red. Un-filter it (or add a project-wide typecheck test).

### 2.4 Committed cruft

- `src/eslint-results.json` and `src/eslint-jsdoc.json` are **byte-identical 1.3 MB lint dumps**; `src/eslint-remaining.txt` is a stale Windows-era dump referencing `C:\dev\canvas_webgl\...` paths and a deleted `balloon-race` game. Delete all three and gitignore.
- Dual lockfiles (`bun.lock` + `package-lock.json`). Docker is bun-only. **Pick bun, delete `package-lock.json`**, and say so in the README.
- `.claude/settings.local.json` (personal permissions, Windows-era) shouldn't be committed.
- `SceneFrame.tsx` has a UTF-8 BOM and mojibake em-dashes (`â€”`); ~10 naturescene files carry BOMs. One normalization pass.

### 2.5 The single highest-leverage fix in this whole review: CI

A ~20-line GitHub Actions workflow (`bun install` → `tsc -b` → `eslint --max-warnings 0` → `node --test` → `vite build`) would have caught **every problem in this section** the day it was introduced. You already built all the gates — nothing runs them. Of the 171 lint warnings, 138 are auto-fixable with `eslint --fix`.

---

## 3. Audio & Music — Your Top Ask

### 3.1 Headline: much of the audio system is unwired, and failures are invisible

`AudioProvider.playSound` silently no-ops on unknown IDs. Consequences, verified call-site by call-site:

- **Every `celebrationSound()` call in every minigame is silent.** `CelebrationSystem` requests `sfx_shared_pop/chime/fanfare/whoosh/chomp/splash` — none are in the registry (it only has `sparkle_burst` and `star_chime`).
- **Little Shark is effectively silent**: all 9 of its interaction sound IDs (`coral-bonk`, `shark-gulp`, `water-bloop`, `treasure-jingle`…) are unregistered. Meanwhile its 395-line `sharkSynth.ts` — the best SFX design in the codebase (chomp, golden chime, underwater ambient pad, victory fanfare) — **is exported and imported by nothing**.
- **Cannonball Splash's fire sound doesn't exist**; hits only sparkle.
- **The minigame `AudioBridge.playMusic`/`stopMusic` are TODO no-ops** — so no minigame has working music, including Bubble Pop, whose lullaby is written and registered. `isMuted` is hardcoded `false`.
- Kitchen and Pirate Cove scenes have **no music and no ambient at all** (`audio: null` / empty IDs); the playroom's room-tone ambient is registered but never plays.
- Nature's four bespoke SFX (mushroom bounce, leaf flip, stream splash, butterfly flutter) are registered but never triggered; same for the owl chirps, hub critter sounds, and the train chugga loop.

For a 3–4 year old, **inconsistency of feedback is the biggest failure**: he taps the shark → silence; taps a bubble → satisfying pop. At this age every action needs acknowledgment. First fix wiring; then improve composition. Also: log a dev-mode warning on unknown sound IDs so this entire failure class becomes visible.

### 3.2 Engine correctness bugs

1. **The nature melody overlaps itself forever.** Its rhythm pattern sums to 19.5 beats (= 19.5 s at 60 BPM) but the loop reschedules every 16 s — so every 16 seconds two out-of-phase copies of the melody collide. Pentatonic writing masks the dissonance, but the seam audibly stumbles.
2. **"Crossfade" is a hard cut.** `crossfadeMusic` instantly `disconnect()`s the outgoing gain that still has up to ~19 s of scheduled notes in it → an audible click/pop on every scene change. Only the incoming side actually fades.
3. **Wall-clock scheduling.** All music loops schedule a full cycle then rely on `setInterval` for the next — which drifts against the audio clock and gets throttled in background tabs. The hub's deliberate 200 ms splice gap papers over this. The standard fix is a lookahead scheduler (25 ms tick, ~150 ms horizon, all times from `ctx.currentTime`), which also fixes bugs 1 and the hub gap.
4. **The polyphony limiter is decorative** — every registered stop-function is `() => {}`, so voice caps do nothing.
5. **No master compressor/limiter, no reverb.** Everything runs dry into `masterGain` → destination. A single generated-impulse `ConvolverNode` reverb send plus a safety `DynamicsCompressor` are the two changes a listener would immediately hear.
6. **iOS lifecycle fragility**: unlock listeners are `{once: true}` with no retry — if the first `resume()` fails, audio is dead for the session with no recovery. No `statechange`/`visibilitychange` handling (an interrupted iPad context — phone call, Siri — never resumes). This matters most on exactly your primary device.
7. Mix balance: music sits ~9 dB below SFX (effective peaks ~0.037 vs ~0.09) — background music is nearly subliminal. `duck()` exists but is never called.

### 3.3 Musicality — an honest composer's read

- **Hub music-box lullaby:** three 8-note C-major arpeggio fragments, every note 0.35 s, constant velocity, monophonic — no harmony, no bass, no phrase arc, never cadences to C. It's also an octave too low for a music box (C4–A4 instead of C5+), played on a near-bare sine. It reads as "notes in a row," not a tune.
- **Nature flute:** right scale (D pentatonic) and tempo, but the contour is a random walk with no motif or repetition structure, zero harmony (not even a drone — the cheapest win in pentatonic writing), and the overlap bug above.
- **Bubble Pop lullaby:** a single broken C-major triad, one note every 2 s, looping every 6 s. The floor of what can be called music (and currently unreachable anyway).
- **Fireflies has the best musical thinking**: proper bell voicing on pentatonic catch chimes, golden catch = root + fifth, tier-up arpeggios. Its weakness: catch notes are chosen by `Math.random()`, so streaks never form melodies.
- **The most-played reward sound is out of key:** the sparkle burst uses four random frequencies in 1200–2400 Hz — a different dissonant cluster at every reward moment. Quantize it to the scene's scale.
- **There is no shared motif across the game** — hub is C major, nature D pentatonic, fireflies C5 pentatonic, star chime ~1 kHz-land. A 5-note "Toybox theme" quoted in every scene's own timbre/scale is what makes game audio feel authored.

### 3.4 Audio improvement plan (ordered by value-per-hour)

**Phase 1 — wire what exists (bug fixes, hours not days):**
register the six celebration SFX; implement `AudioBridge.playMusic/stopMusic/isMuted`; port `sharkSynth.ts` into the registry under the IDs Little Shark actually calls (rerouted through the SFX bus — it currently bypasses the mix bus entirely); register the cannonball fire sound; turn on scene audio for playroom ambient, kitchen, and pirate cove; trigger the orphaned nature/owl/critter sounds; warn on unknown IDs.

**Phase 2 — engine correctness:** lookahead scheduler (fixes nature overlap + hub gap + tab throttling); real crossfade (fixes the scene-change click); master `DynamicsCompressor`; generated-impulse reverb send; iOS unlock/interruption hardening; rebalance music vs SFX buses and wire `duck()` into celebrations.

**Phase 3 — make the music genuinely good:** three-layer arrangements everywhere (melody + properly-voiced chord pad + bass) — for the hub, I–vi–IV–V under a rewritten AABA melody moved up an octave with a music-box inharmonic partial; a shared generative pentatonic melody engine (weighted random walk stating a 2-bar motif, then varying it) so beds never loop identically; the shared Toybox motif; combo-indexed ascending catch notes in fireflies/star-catcher/bubble-pop (streaks become melodies); per-game music beds now that `playMusic` works (underwater pad for Little Shark, 6/8 shanty sketch for Cannonball, twinkling ostinato for Star Catcher).

### 3.5 Age-appropriateness verdict

Levels are uniformly gentle, attacks respect a 5 ms minimum (no startle transients), and the timbre palette is soft sine/triangle — good. The problems are the unpredictable crossfade click, the sour random sparkle clusters at reward moments, and above all the silent-response inconsistency. Frequency content is in safe, pleasant ranges.

---

## 4. Graphics & Rendering

### 4.1 The big one: your renderer config caps your art

First, a surprise: **`@react-three/fiber` and `@react-three/drei` are in package.json, the README tech table, and the vendor chunk config — but are imported nowhere.** The app is 100% imperative Three.js behind a React shell (which is honestly the better architecture for this codebase). Remove the dead deps and correct the docs.

The vision docs demand "Pixar-like warmth, premium cinematic, soft shadows." The current renderer cannot deliver that, no matter how good the procedural art gets — and the art is already good. Missing (verified — zero hits repo-wide):

- **No tone mapping** (defaults to `NoToneMapping`) — every emissive glow object hard-clips to flat saturated color. `ACESFilmic` (or AgX) + exposure tuning is the single cheapest "Pixar warmth" lever.
- **No environment lighting / PMREM** — your metal materials (metalness 0.85) reflect nothing and read as near-black plastic. One PMREM'd `RoomEnvironment` at startup transforms every StandardMaterial in the app at near-zero per-frame cost.
- **Shadows left at default hard `PCFShadowMap`** — directly contradicts "Shadows are soft" in soul.md. `PCFSoftShadowMap` is one line per renderer. Also: no `normalBias` (toy-sphere acne risk), one-size-fits-all ±10 shadow frustum, and the minigame rig never sets ortho extents — **most of Little Shark's 60-unit reef falls outside the default ±5 shadow box.**
- **No postprocessing** — the design language is saturated with glow (fireflies, portals, moon, jar-beacon) that renders as flat bright meshes. Selective bloom, gated by a quality tier, pays off everywhere at once.
- **Flat `AmbientLight` fill everywhere**; the `fillGroundColor` config that scenes pass in is *silently ignored* — `createSceneLighting` never reads it. The intended hemisphere fill (the classic "cozy" look) degrades to flat ambient.

Because both `SceneFrame` and `MiniGameShell` bootstrap their own renderers with divergent settings, build one shared `createConfiguredRenderer()` factory and fix everything in one place.

### 4.2 Performance on your actual devices (iPad/phone)

1. **Device pixel ratio is uncapped** — an iPhone at DPR 3 renders 9× the pixels of DPR 1 with MSAA on. Cap at 2 (1.5 on low tier). This is the #1 mobile perf item.
2. **Two full WebGL renderers run simultaneously during every minigame** — the hub scene keeps rendering every frame behind the opaque game overlay. Battery/thermals on iPad suffer for zero visual benefit. Pause the hub loop while a game is active.
3. **15+ dynamic PointLights from fireflies** (one per firefly in both the nature scene and the fireflies game) — every StandardMaterial fragment iterates all of them, and adding/removing lights mid-scene recompiles every shader (a classic iPad hitch). Replace with emissive sprites + bloom; keep at most 1–2 aggregate lights.
4. **Zero instancing anywhere.** Little Shark places **~290 coral/plant groups**, each 3–10 meshes with per-instance materials — an estimated 1,000–2,500 draw calls before fish and effects. Five coral + four plant `InstancedMesh` archetypes with per-instance color collapse that to ~15. House rooms have 393 `new Mesh(` sites; merge the static shells. Grass tufts (5–7 meshes *and materials* each) and Bubble Pop's 20 individual star meshes are the same story.
5. **The material cache is broken by design** — `getOrCreateMaterial` exists but none of the factories use it, and callers pass per-instance names (`coral_brain_mat_${id}`) that defeat sharing anyway. Nature scene wrote a three-tier material policy doc to compensate — codify that policy at the factory level instead.
6. **Every particle system runs its own private `requestAnimationFrame`** decoupled from the renderer — the fireflies game alone spawns a dozen+ stray rAF loops. Move to a shared ticker driven by the owning scene's loop (Bubble Pop already models this correctly).
7. **No weak-device adaptation at all** — `ResponsiveProvider` computes `isMobile` and `SceneFrame` discards it. Add a quality-tier module (DPR, cores, isMobile, plus an FPS watchdog that demotes at runtime) consumed by the renderer factory, prop densities, and particle rates.

### 4.3 Confirmed leaks

- **GSAP portal tween leak:** every portal starts two `repeat: -1` tweens that no dispose path ever kills — every visited world scene leaves immortal tweens animating detached objects forever (the hub renderer persists across scene switches, so these accumulate all session).
- **Shadow-map render-target leak:** scene disposal handles meshes but never calls `light.dispose()` — one leaked 1024² depth target per scene switch.
- **Particle emitter-follow bug:** glow trails claim to follow their firefly but the position is copied once at creation — trails emit at the spawn point forever while the firefly drifts away. (The owl works around this with a brute-force GSAP updater.)
- Dead code: the per-particle `size` attribute written every frame is ignored by `PointsMaterial` — every `minSize/maxSize` config in all three particle modules has no visual effect.

### 4.4 Framework duplication

Three overlapping particle modules (`utils/particles.ts`, `utils/particleFactory.ts`, `minigames/shared/particleFx.ts`) including **two different `createSparkleBurst` functions with different signatures** and a byte-identical copied texture generator producing duplicate GPU textures. Two lighting rigs, two camera systems, three deep-dispose helpers, `lerp` defined twice. Consolidate to one engine + preset registry; the Babylon-heritage parameter names (`hemisphericIntensity`, `beta`/`radius` camera coords) deserve retirement in the same pass.

`animalBuilder.ts` (48 KB, 1,343 lines, 11 animals of copy-pasted sphere assembly) works, but a body-plan data table + one interpreter would collapse ~70% of it and make new animals data-authoring — do it when you next add an animal.

**What's already good and should be kept:** EntityPool with prewarm, Bubble Pop's spatial hash and temp-vector pooling, single-listener raycast dispatchers, clamped delta time, visibility-pause for games, `raycast = () => {}` on scenery, the soap-bubble iridescence shader.

---

## 5. Child UX — Playing as a 3–4 Year Old

### 5.1 The highest-impact toddler fix in the codebase

**Wobbly toddler taps become dead taps.** The input dispatcher classifies any gesture that accumulates >10 px of movement as a drag; in tap-only games (four of five), the resulting drag-end event is silently swallowed — no pop, no fallback sparkle, nothing. Three-year-olds routinely smear 10+ px during a "tap." Fix: when a game doesn't support drag, deliver drag-end as a tap (or raise the threshold to ~24 px with a time component). This single change will make the games feel dramatically more responsive to his actual fingers.

### 5.2 The flagship dead tap

The **Creative toybox** — a prime attraction in the landing scene — is wired to a complete no-op: no wiggle, no sparkle, no sound. Your own soul.md says "a dead tap is a broken promise." Give it a wiggle + sparkle + gentle sound ("not yet!" energy), or hide it until it's wired.

### 5.3 Compliance with your no-fail philosophy — near-perfect, one exception

Verified per game: no game-overs, lives, countdowns, red flashes, or buzzers anywhere. Bubble Pop and Fireflies are exemplary (fireflies' 80 px proximity hit-test is toddler-perfect; consider giving Bubble Pop the same forgiveness — it currently requires exact mesh raycast hits, and small bubbles on a phone are precision targets). The one exception: **star-catcher's template-derived scoring breaks the combo on a missed tap** — the only punitive mechanic in the suite, and it lives in the *minigame template baseline*, so every future generated game inherits it. Replace with a fallback sparkle.

### 5.4 Navigation & session flow

- One-tap, no-confirmation exit from games: correct and toddler-right.
- **Browser-back walks the child to the marketing page**: every scene change and game launch does `pushState` (the JSDoc claims `replaceState`), so an accidental iPad edge-swipe steps back through the whole session and eventually lands a 3-year-old on the text-heavy landing page. Use `replaceState` for intra-app writes.
- The back button always goes to Playroom regardless of origin (a child who entered Nature from the Kitchen gets teleported); Kitchen itself is unreachable through any UI — deep-link only. Fine for now, but confirms the scene hierarchy isn't modeled yet.
- No stuck states found: invalid hashes → friendly 404; failed game loads auto-exit; transition re-entrancy is blocked. Good.

### 5.5 Tablet-session gaps (your primary device)

- **No web app manifest, no apple-touch-icon, no theme-color — and the favicon is still Vite's default** on the live site. A manifest with `display: standalone` is the single cheapest big win for iPad play: no URL bar, fewer accidental chrome taps, a real icon on the home screen. It requires no service worker and doesn't conflict with zero-persistence.
- **No wake lock** — during watch-the-shark play with sparse touches, the tablet sleeps mid-session.
- **No mute button during minigames** — the game overlay (z-30) covers the scene HUD (z-10), so a parent wanting quiet must exit the game to find the mute. Add mute to the minigame HUD.
- No safe-area insets (`viewport-fit=cover` + `env(safe-area-inset-*)`) — HUD corners can crowd the iPhone notch region in landscape.
- Scene music keeps playing underneath every minigame (accidental layering, not design) — duck or stop it on launch.

### 5.6 Accessibility & safety

- Buttons are properly sized (48–56 px) and aria-labeled. No color-only mechanics. Good.
- **Zero `prefers-reduced-motion` handling** anywhere, and no `aria-live` score region (your own agents.md requires one).
- Safety audit is clean: no external links on child-reachable surfaces, no ads/analytics/trackers, and the storage guard genuinely blocks everything before React loads. One blemish: **Google Fonts is imported on the landing page** — a third-party request on a product whose banner touts privacy. Self-host the two fonts.
- Debug console spam ships to the dev experience (`[SHARK-DBG]`, router logs, 9 log calls in MiniGameShell) — terser strips them in prod, but strip them at the source.

---

## 6. Architecture, Extensibility & Tech Choices

### 6.1 Extensibility — the actual mission

The generator → template → manifest → contract-test pipeline is the right architecture, and better than most professional content pipelines. Real friction found:

1. **"Registered" ≠ "discoverable" requires two manual post-generator edits** (scene `games` array + portal entry). Star Catcher proves this bites: generated, still carrying `description: 'TODO: …'` in the shipped manifest, never surfaced in Nature. **Extend `create:minigame` with `--scene nature` that also appends both entries** — registered-but-invisible content should be impossible by default.
2. **Sample-prop graduation hazard**: templates ship instructional sample props that must be hand-deleted when real props arrive; Pirate Cove shows the failure mode (half-deleted → 6 of your 9 type errors). Add a lint/test that flags `sample*` folders in non-template scenes.
3. Latent generator bug: `copyTemplateDirectory` drops `skipFiles` when recursing into subdirectories. Harmless today, a trap later.
4. `MiniGameContext.scene/renderer/camera` are typed `unknown` "to avoid a hard dep" — but every game immediately casts, and the framework imports `three` directly anyway. This buys nothing and costs type safety at the most important seam. Type them.

**Could your son author content himself someday? Yes — and you're closer than you think.** Toybox manifests, staging placement files, portal lists, and palettes are already data-shaped. The ladder: (1) now, he watches you tweak numbers/colors in `staging/*.ts` with hot reload; (2) later, extract staging/palettes/portals to schema-validated JSON so editing requires no TS; (3) eventually, an in-app edit mode (drag props, pick colors, export JSON) is feasible precisely because everything is procedural — no asset pipeline needed. Game *rules* stay code, but the template's environment/entities/rules split already isolates the parts a kid could own. Worth piloting the JSON extraction on one scene.

### 6.2 The persistence question — decide before more games accrue

Zero-persistence is a genuinely defensible privacy stance (no COPPA surface, nothing to leak) and current-state costs are small (mute resets each load). But as your son grows, "the game never remembers anything" will start to hurt — no "continue," no collections, no "the owl remembers you." Two policy-compatible options worth deciding on **now** (because the storage guard's `writable: false` patches mean an allowlist must be designed into the guard, not bolted on): a parent-gated opt-in namespace the guard permits after an explicit parent action, or — staying truly storage-free — progress encoded in the URL hash as a "magic bookmark" a parent saves. The hash option fits your existing router exactly.

### 6.3 Other tech-choice verdicts

- **React shell + imperative Three:** clean, well-policed boundary, right choice. Remove the phantom R3F deps.
- **Hash routing, Docker+nginx, storage guard:** all solid. Add `bun run test` + keep `tsc` in the Docker build so the image build is itself a quality gate.
- **node:test for contract tests:** fine, zero-dep. If you add runtime unit tests (scoring, spawn schedulers, the shark's hunt FSM are eminently testable), vitest integrates better with the Vite/TS setup.
- **Missing:** a Playwright smoke suite (visit every route, assert zero console errors + a WebGL context; screenshot each scene — for a procedural-3D app, visual regressions are otherwise invisible, especially with AI-heavy authoring); minimal error telemetry (`window.onerror` → beacon, or Sentry free tier) — without it, breakage on the kid's iPad is undiagnosable, and `drop_console` currently strips even your storage-guard warnings in prod.
- Consider (low priority): flattening the `src/src/` nesting and renaming `naturescene` → `nature` while the project is still small enough to grep-and-fix.

---

## 7. Documentation

### 7.1 What's genuinely excellent

`current-state.md` is accurate on every claim I checked against code (scenes, games, toybox destinations, the star-catcher nuance). The "registered vs discoverable vs implemented" vocabulary, the "claims docs must not make" section, and CLAUDE.md's verify-code-first rule are unusually disciplined. Keep this pattern; it's the backbone of trustworthy AI-assisted development.

### 7.2 The purge damage (P0)

Roughly **20 references point at deleted directories** (`docs/adr/`, `docs/specs/`, `docs/features/`, `docs/plans/`): the README's documentation map and structure tree, CLAUDE.md's 9-step reading order (step 4 is impossible), every "Reads first" list in agents.md, skills.md's slash-command dependencies, all four template authoring/review prompts, and even a code comment in `storageGuard.ts`. An AI collaborator following your own reading order hits dead ends immediately — which trains agents (and you) to ignore the governance scheme. Either restore the docs from git history or annotate every reference as historical.

### 7.3 Wrong-engine documentation (P0)

**`bubble-pop/README.md` — the designated "reference implementation" doc — is written for Babylon.js**, not Three: `@babylonjs/core` listed as the direct dependency, Babylon idioms throughout, a directory layout that doesn't match the actual code, and a "reference for all 12 mini-games" claim that violates your own claims policy. Leftover Babylon comments also survive in `sceneSetup.ts`, `CelebrationSystem.ts`, and `cameraPresets.ts`. Rewrite for reality.

### 7.4 Other findings

- The 58 KB fireflies review/remediation doc lives inside the game's source folder, is partially stale (its headline finding is already fixed), and references games that don't exist in this repo. Move to `docs/reviews/` with a status header.
- `src/README.md` is untouched Vite boilerplate — replace with a real dev README (bun-first install, scripts, tests, generators).
- `vision.md`'s "current implemented slice" section is stale on all three claims (scene id, scene count, game count) — defer to current-state.md.
- `controlled-terminology.md` contains two overlapping canonical-term tables that contradict each other about the top term.
- Missing docs worth writing: an architecture overview of the *actual* runtime (SceneFrame/SceneRouter/AudioProvider/MiniGameShell contracts — the specs that covered this are gone), an **audio system doc** (a named pillar, entirely undocumented), a deployment runbook, and a testing guide.

---

## 8. Consolidated Roadmap

**P0 — This week (restore integrity):**
1. Fix the 9 type errors (delete pirate-cove sample props, `_scene`, `games: []`) → green `npm run build` and Docker build.
2. Resolve the 6 test failures deliberately (recommend: restore template README scaffolding).
3. Delete cruft (1.3 MB lint dumps ×2, stale lint txt, `package-lock.json`, `.claude/settings.local.json`); fix BOM/mojibake.
4. **Add CI.** Un-filter the compile-check test.
5. Audio Phase 1: register missing celebration SFX, wire the minigame music bridge, port sharkSynth, un-silence Little Shark and Cannonball Splash, warn on unknown IDs.
6. Fix the doc-link rot and the Babylon-era bubble-pop README.

**P1 — Next (the quality leap):**
7. Renderer foundation: shared factory with ACES tone mapping, PCFSoft shadows, sRGB, DPR cap ≤2, PMREM environment, hemisphere fill honoring `fillGroundColor`, `normalBias`, per-scene shadow frustums. Then one lighting/emissive re-tuning sweep per scene.
8. Audio Phase 2: lookahead scheduler (fixes the nature overlap + hub gap), real crossfades (fixes the scene-change click), master compressor, reverb send, iOS lifecycle hardening, bus rebalance.
9. Toddler input fix (drag-end → tap in tap-only games) + Creative toybox response + mute in minigame HUD + pause hub renderer during games.
10. Web manifest + real favicon + apple-touch-icon + safe-area insets + wake lock.
11. Leak fixes: portal tweens, shadow-map targets, particle emitter-follow.

**P2 — Then (polish & growth):**
12. Audio Phase 3: chord pads + bass everywhere, hub melody rewrite, generative pentatonic engine, shared Toybox motif, combo-melody catches, per-game beds.
13. Selective bloom behind a quality-tier module; replace per-firefly PointLights with sprites.
14. Instancing: Little Shark reef, room shells, foliage, stars. Make the material cache the default path.
15. Generator upgrades: `--scene` flag wiring portals automatically; sample-prop graduation guard; typed MiniGameContext.
16. Remove combo-break-on-miss from the template; bubble-pop proximity forgiveness; reduced-motion + aria-live pass; self-host fonts; strip debug logs.
17. Decide the persistence story (parent-gated save or magic-bookmark hash) and design the guard allowlist now.
18. Playwright smoke/screenshot suite; error beacon; consolidate particle/material/dispose layers.

**P3 — Someday:**
19. Data-driven animalBuilder; JSON-staging pilot toward kid-authoring; in-app edit mode; flatten `src/src/`; per-scene fog/atmosphere pass; unify camera/lighting rigs and retire Babylon-heritage APIs.

---

## 9. Closing Thought

The gap between this project and the "premium, Pixar-warm" experience in your vision docs is not a content gap or a talent gap — the procedural art, the framework instincts, and the design philosophy are all already there. It's a wiring gap: sounds that never fire, a renderer missing five config lines, gates nobody runs, docs pointing at deleted files. Almost everything in the P0/P1 lists is days of work, not months, and each item lifts every scene and every future scene at once. That's the payoff of the architecture you chose — and it's the right architecture to grow with your son.

# The Minigame Teardown

A ruthless, itemised accounting of why all five minigames are bad, followed by
the plan to fix each one. Every claim below is anchored to a file and line with
the exact constant, because "it feels off" is not a bug report.

You said they all really suck. You were being generous.

---

## The verdict up front

These are not five games. They are five tech demos, each wrapped around one verb,
none of which finishes the sentence it starts. Four of the five contain a
**logic inversion so complete that the game does the opposite of its own
description**, and nobody noticed, because nothing in the build has an opinion
about whether a game is fun.

The single most damning finding: `CelebrationSystem.confetti()` — the function
every one of the five games calls on every single success, and which every
milestone routes through — rendered **nothing**. Not "rendered something
underwhelming." Nothing. Zero pixels. It played a sound and returned. It carried
this comment:

> `// Visual particle burst will be added when integrated with Babylon.js scene`

This codebase does not use Babylon.js. It has never used Babylon.js. That comment
is a fossil from a renderer that was abandoned, and the stub underneath it has
been shipping as the emotional payoff of the entire product ever since. A
three-year-old pops a bubble and the reward is a noise. That's it. That's the
game.

That is now fixed. What follows is everything else.

---

## Tier 0 — the systemic failures

These are not per-game bugs. These are framework decisions that break all five
games simultaneously, which is also why they are the cheapest things in this
document to fix.

### 0.1 Celebrations rendered nothing — `CelebrationSystem.ts`

Covered above. All three parameters were discarded (`_screenX`, `_screenY`,
`_intensity` — the underscores are the code admitting it). `milestone()` called
`this.confetti()` and then added a fanfare, so a milestone was two sounds and no
picture.

**Status: fixed.** See "What I fixed" below.

### 0.2 The score is a bare Arabic numeral — `MiniGameHUD.tsx`

The player cannot read. The score is rendered as digits. The entire progress
signal of every game is illegible to the person playing it. The only non-textual
feedback is a row of combo dots that appear at a 3-streak and are never
explained.

### 0.3 The input dispatcher silently eats double-taps — `InputDispatcher.ts`

There is a 120ms / 8px tap cooldown. A toddler's second tap inside that window
produces **no sound, no visual, nothing** — indistinguishable from a broken app.
Star-catcher's own source contains the line "a dead tap is a broken promise"
(`rules/scoring.ts:36-37`) in a game whose framework breaks that promise on every
excited double-tap.

Worse, in little-shark taps fire on `pointerup`, not `pointerdown`
(`InputDispatcher.ts:151-186`), so a child who rests a finger on the screen gets
unbounded latency.

### 0.4 The difficulty ramp is unreachable — `MiniGameShell.tsx:122-126`

`rampStart: 50, rampEnd: 500` in a framework where games award 1–20 points per
action. Star-catcher's difficulty bands need score **203** and **351.5**;
little-shark awards 1 point per fish. No child will ever see band 1. Every game
is permanently frozen at its opening difficulty, which is also why they all feel
like they never go anywhere — because they don't.

### 0.5 No game has a goal, an endpoint, or a win state

All five are `mode: 'endless'`, all five have `showProgressBar: false`, and
`MiniGameShell.tsx:77-78` holds `const [progress, _setProgress] = useState(0)`
next to a "Phase 4.5" TODO. Each game is one verb repeated until an adult closes
it. That is a screensaver with a hit-test.

### 0.6 The loading cards make a pre-reader read

`LoadingScreen` renders `displayName` — "Bubble Pop", "Star Catcher" — at 28px
bold. The stated design principle is that the child reads nowhere. The very first
thing the game shows them is text.

### 0.7 Thousands of lines of designed-but-unwired features

This is the most frustrating category, because the good version of each game
already exists in the repo and is simply not plugged in:

| Dead module                               | Lines | What it is                                                        |
| ----------------------------------------- | ----- | ----------------------------------------------------------------- |
| `little-shark/fish/species.ts`            | —     | The five-species registry. The game's entire variety. Unimported. |
| `little-shark/waves/templates.ts`         | 182   | Ten named waves, four formation types. Zero implementation.       |
| `little-shark/fish/schooling.ts`          | 230   | A boids implementation. Unused.                                   |
| `little-shark/fish/meshes.ts`             | 399   | Unused.                                                           |
| `little-shark/shark/splineBody.ts`        | 209   | Import commented out at `index.ts:78-79`.                         |
| `little-shark/audio/sharkSynth.ts`        | 395   | Unused.                                                           |
| `little-shark/environment/ambientLife.ts` | 1014  | Not imported by `setup.ts`.                                       |
| `fireflies/jarFill.ts`                    | 106   | A bounded, readable jar-fill meter. Never imported.               |
| `bubble-pop/animation/spring.ts`          | 111   | Unused.                                                           |

Somebody designed these games properly and then shipped the scaffolding instead.

---

## Tier 1 — the per-game logic inversions

### Bubble Pop

**Tapping a big bubble makes it bigger.** `rules.ts:36-38` increments
`sizeVariant` with the comment "Shrink slightly to show progress", against
`SIZE_VARIANTS = [0.2, 0.32, 0.45]` — which ascends. The comment and the array
disagree and the array wins. The core interaction of the game is inverted.

**The difficulty never changes.** `spawnInterval(effectiveDifficulty)` is
evaluated exactly once, at `start()`, with `ed = 0` (`index.ts:335`), and
`SpawnScheduler.ts:32-33` stores the result as a plain number. The spawn rate is
frozen at 0.3s + jitter for the entire session, forever.

**The difficulty-scaled rise speed is dead code.** Set at `index.ts:126`,
unconditionally overwritten at `lifecycle.ts:89` with `randomRange(0.15, 1.0)`.

**The crescendo showers have never fired, not once.** `index.ts:440-443` calls
`spawnShower()` every frame. Each call cancels the previous spawner
(`index.ts:142-163`). Nothing survives 16ms to reach its own trigger.

**The bubbles are nearly invisible.** `opacity = uAlpha * (0.1 + 0.5 * fresnel)`
with `uAlpha` at 0.5–0.6 gives a bubble that is **5% to 30% opaque**. The final
colour is `baseColor * 0.4 + rimGlow + spec * 0.9` against a sky top of
`(0.015, 0.02, 0.07)`. You are asking a toddler to tap faint rim outlines on a
near-black field.

**Most bubbles spawn off-screen.** fov 60 at z=5 gives a horizontal half-extent
of ~1.44 units. Spawns span x ∈ [−4.5, 4.5]. `CAMERA_RADIUS_PORTRAIT` and
`CAMERA_RADIUS_LANDSCAPE` are defined and never read.

**Escaped bubbles hold pool budget invisibly for 5–30 seconds**, because
`RECYCLE_Y = 9` is roughly 4.5 units above the top of the frame.

Also: every pop fires three sounds; every spawn fires one, at a 0.3s cadence;
`comboWindowSeconds: 0` means the multiplier is permanently 1×; the soft-body
collision radii are half the true size (`softBody.ts:22-25`).

### Fireflies

**Succeeding makes the game worse.** Illumination tier 1 is strictly darker than
tier 0 on all seven axes (`illumination.ts:53-65` vs `:40-52`):

|              | tier 0 | tier 1  |
| ------------ | ------ | ------- |
| directional  | 0.18   | 0.08    |
| ambient      | 0.12   | 0.04    |
| moon         | 0.6    | 0.25    |
| ground       | 0.05   | 0.01    |
| jar light    | 0.25   | **0.0** |
| jar emissive | 0.35   | 0.05    |

At the third catch the world goes dark and does not recover until catch fifteen.
The reward for playing well is being punished for eleven catches.

**The sky is never rendered.** Four `PlaneGeometry` strips sit at local z = +15
inside a group at z = −10, so world z = +5 — behind the camera's near plane,
facing away.

**The tap hint freezes on screen permanently.** `index.ts:300` guards
`tapHint.update()` on `!firstCatchDone`. `onTap` sets that flag and _then_ calls
`dismiss()`, which only raises a `fadeOut` flag that is consumed inside
`update()` — which will now never run again.

**The jar can never be full.** The live mechanic (`jarOrbitFireflies`,
`index.ts:44-121`) adds unbounded additive sprites at scale 0.12 into a ~0.55u
volume. It saturates to a featureless white blob. The bounded, readable
alternative with `MAX_JAR_DOTS = 30` and `setDrawRange` is sitting in
`jarFill.ts`, unimported.

**Saturn is being treated as a flower.** `flowerStart = 16 - 4 = 12`, slice
`[12..15]` — which is flowers 2, 3, 4 and Saturn. The most central flower never
glows, and a planet gets the flower emissive curve.

Also: missing is zero visual and one sound at 0.06 volume; drift and zigzag are
frame-rate dependent (no `dt`); the entire escalation is 7→14 fireflies and
×1.0→×1.2 speed; a golden firefly that is never caught permanently blocks all
future goldens (`goldenActive` is only cleared on catch); `SPAWN.yMin = -2` is
below the ground plane, so fireflies drift under the floor and stay tappable; and
the jar, cork, moon, Saturn, shooting stars, four flowers (max sway 0.05 rad —
2.9°), three trees, nine fruit, eight grass tufts and 120 stars are all inert.

### Star Catcher

**The stars rise.** `entities/index.ts:133` does
`position.y += driftSpeed * dt * 0.22`, which is 0.084–0.158 units per second
**upward** from a fixed spawn at y = 0.55, peaking at ~1.26. The escape check at
`rules/index.ts:47` tests `y > 2.8` and is unreachable dead code. The game's own
tagline — "Catch falling stars before they drift away!" — describes a mechanic
that does not exist in either half of the sentence.

**Catching a star hides it.** `resetTarget` (`entities/index.ts:148-163`) sets
`visible = false` and teleports to (0, −10, 0) on the same frame. No pop, no
fade, no burst. Timeout despawn is byte-identical, so success and failure look
exactly the same: the star blinks out.

**There is no tap forgiveness at all.** Exact-mesh raycast identity match against
a 0.68u target. `PROXIMITY_PX = 70` exists in
`utils/interaction/gestureRules.ts:30` and the minigame `InputDispatcher` does
not use it.

**In a game called Star Catcher, the stars are not tappable.** The 110-instance
background starfield and the moon are both `makeDecorative()` — raycast disabled.
They are the single most confusable elements it is possible to put on screen.

**The stars are 2D stickers.** `ExtrudeGeometry`, outer 0.34, inner 0.15, depth
0.07, bevel 0.03 — and locked face-on, because only `rotation.z` is ever mutated.
The extrusion is never visible from any angle.

Also: the sky is a flat `PlaneGeometry(36, 22, 1, 6)` whose glow term
`max(0, 1 - 4t)` confines all colour to the bottom 25%, leaving the rest flat
`#080A1F`; cloud mound 3 at (−0.6, 4.4) sits 0.03u _below_ the hill surface and
flickers through it via its own ±0.05 bob; every miss allocates a fresh
`TorusGeometry` and `MeshStandardMaterial` with no pooling, laid flat in XZ at a
forced y = 0.55 so it reads as an ellipse on the ground rather than a ring at the
fingertip; `onDrag`/`onDragEnd` are empty no-ops that aren't even wired, so
swiping produces total silence; the seed is a hardcoded 20260718, so the sky is
identical every session; hit #10 fires four sounds in one frame; and the "bonus"
star occurs 14% of the time and differs from a standard star by +20% scale and a
slightly warmer gold.

### Little Shark

**You are not driving. You are making suggestions.** Every lunge is followed by
an enforced 2.5s `restTimer` (`movement.ts:209`). Tapping a fish triggers a 0.3s
`NOTICE_DURATION` freeze with velocity clamped to zero
(`huntFSM.ts:117-125`). A full tap-a-fish round trip is **2.1 seconds minimum and
commonly 3**, with control effectively surrendered for the duration.

**The camera never calls `lookAt`.** `followCamera.ts:92-161` moves the camera
and never re-aims it. The view direction is frozen for the entire session.

**The turn rate is three different numbers.** Instant during hunt
(`index.ts:249`), 1.052 rad/s when idle or dragging (three full seconds for a
180°), and 7.854 rad/s during lunge rotation.

**Difficulty is multiplied by 0.5 after being computed as 1.0.**
`getSpeedMultiplier` returns 1.0 for the whole session — the ramp is 50→500 and
the game awards 1 point per fish — and `index.ts:545-561` then halves it anyway.

**Tapping seaweed does nothing.** It plays a sound. The boost `Map` returned from
`interactionState.update(dt)` is discarded at `index.ts:559`.

**Eight anemones match no prefix in `classifyPickedMesh`** and fall through to
`'water'`, so the shark lunges at scenery.

**Four of the five "surprises" play at fixed world coordinates near the origin**
while the camera follows a shark roaming ±50 units. They are usually off-screen.

Also: the drag spring is stiffness 4.0 critically damped, giving a 1.5–2s settle,
so the shark visibly lags the finger, and `onDragEnd` does exactly one thing —
clears a flag; no release impulse; god rays are six `PlaneGeometry(0.3, 3)` at
opacity **0.06** that never face the camera; the water surface is opacity 0.12;
the "caustics" are four emissive spheres and six flat circles; coral wiggle is 5°
over 0.3s and proximity wobble is multiplied by 0.003; the seafloor is a
`PlaneGeometry(120, 120, 128, 128)` with ±0.4 of relief, i.e. flat; and a missed
tap that hits nothing returns silently at `index.ts:633-635`.

### Cannonball Splash

**Rapid tapping produces nothing.** A silent 0.5s `FIRE_COOLDOWN`
(`index.ts:253`) discards the input with no feedback. Maximum two shots per
second. Hand a three-year-old a cannon and then ignore three quarters of what
they do with it.

**You cannot miss.** If a target resolved at tap time, the ball holds a direct
reference to it (`entities/lifecycle.ts:94-127`) and arrival is time-based
(`cannonball.ts:64-85`), not collision-based. There is also no gravity on the
ball — it's a parametric quadratic (`helpers.ts:48-50`); `GRAVITY: -9.8` is used
only for particles, fragments and coins.

**The ball leaves from where the barrel used to be.** `aimCannon` writes
`rig.aimYaw` / `rig.aimPitch`, and the rotation is lerp-applied on the _next_
frame in `updateCannonIdle` — but `getCannonMouthPosition` is read immediately at
`index.ts:273`.

**Tapping the sky fires at a hardcoded point.** `collision.ts:53-56`:
`if (!worldPoint.x && !worldPoint.z) worldPoint.set(0, 0, -8)`.

**The edge warning turns the entire scene red.** `rules/index.ts:141-156` sets
`emissive.setRGB(pulse, 0, 0)` on _module-level shared_ materials. One barrel
drifting past |x| > 7 turns **every** barrel and every duck red. Another target's
reset branch clears it. The result is a scene-wide red flicker. Golden barrels
have no reset branch at all, so they stay red permanently.

**Every newly spawned target flashes the leaving warning.** Targets spawn at
|x| = 9 and the warning triggers at |x| > 7, so each one pulses red for its first
2.9–6.7 seconds _while drifting inward_. The warning fires on arrival.

**There is no ship.** There is a `PlaneGeometry(18, 5)` deck at z = 1.5 — the
camera is at z = 2.8, so most of it is behind the camera — plus a railing whose
nine posts steal `pickResult` from the targets behind them.

**Targets get smaller as difficulty rises**, 1.35 → 1.10. The reward for
improving is a harder target and a slower cannon.

Also: `splashMat` is module-level but assigned unshared and then `.dispose()`d on
expiry (`effects.ts:32/106/439`), and `recycleTarget` traverses and disposes
module-level singletons (`lifecycle.ts:65-75`, `targets.ts:31-40`); the score
indicator is a blank gold `BoxGeometry(0.2, 0.12, 0.02)` that looks like a score
popup and displays no number; the water's "waves" are the entire rigid plane
translating ±0.12 in Y; camera shake is a single decaying random offset of 0.06
units; cloud drift is framerate-dependent (hardcoded `1/60`, `setup.ts:557`);
`startOpacity` is read at `effects.ts:428` and never written, so every
transparent particle snaps to 0.5; explosions play at the impact point captured
at _fire_ time, up to 0.7u from where the target actually is; and `OCEAN_Y`,
`COMBO_WINDOW`, `RAMP_START`, `RAMP_END`, `GOLDEN_UNLOCK` (150, which doesn't
even match the effective 185), `RAINBOW_UNLOCK` and `CAMERA_SHAKE_FRAMES` are all
dead.

---

## The plan

Ordered by leverage, not by how interesting the code is.

**Tier 0 — one fix, five games.** Make `CelebrationSystem` render. Then the
child-UX layer that every game inherits: a non-numeric score, universal tap
forgiveness, and an input path that never silently swallows a tap.

**Tier 1 — un-invert the games.** Each of the four inversions above is a
small diff with a large effect: bubbles shrink when tapped, stars fall, the
firefly world brightens as you succeed, and the cannon's edge warning is
per-target. Alongside those, the frozen difficulty in every game, and the
control-latency problems in little-shark and cannonball-splash.

**Tier 2 — make the worlds legible.** Bubble contrast against the sky,
fireflies' unrendered sky, star-catcher's untappable stars and 2D stickers,
cannonball's missing ship, little-shark's invisible god rays.

**Tier 3 — wire up what's already written.** The species registry, the wave
templates, the jar-fill meter. These are the difference between one verb and a
game, and they are already in the repo.

Each increment gets committed, gated (`tsc -b`, `eslint --max-warnings 0`,
`npm test`, `vite build`), and shipped, and then re-evaluated against this
document — including a pass over whether the evaluation itself is measuring the
right things.

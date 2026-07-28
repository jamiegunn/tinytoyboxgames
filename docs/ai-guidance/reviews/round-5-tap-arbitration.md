# Round 5 — the outdoor scene answers the wrong tap, or no tap at all

This round took eleven charges to find the defect. Ten of them died. They are
kept, in order, because the corrections are the argument: every one was
plausible, most were code-accurate, and any of them would have shipped as a
"fix" if I had stopped at the point where I felt confident.

The last three are the real ones, and they were invisible from every direction
this round had been looking.

## The ten dead charges

**1 — `resize()` never re-applies the pull-back.** `createSceneCamera` opens at
`radiusForAspect(preset, aspect)`; `resize()` recomputes the ceiling and clamps,
and a clamp can lower a radius but never raise one, so rotating into portrait
leaves the camera at the landscape distance. The code reading is correct.
`.probe/pc-rotate-pullback.mjs` measured four real devices: radius 12.000 before
rotation, 12.000 after, 12.000 opened fresh, 12.000 after six rotations. No
consequence at all.

**2 — Pirate Cove's pull-back is clamped dead.** Which is why charge 1 had no
consequence. The preset declares `distance: 12` with
`constraints: { minDistance: 11, maxDistance: 12 }`, and

```
radiusForAspect = clamp(distance * distanceMultiplierForAspect(aspect), minDistance, maxDistance)
distanceMultiplierForAspect(a) = max(1, 0.75 / a)      // never below 1
```

so the product is never below `distance` and `maxDistance === distance` discards
every bit of it, at every aspect. `.probe/pc-pullback-dead.mjs`: Pirate Cove is
the only scene in the catalog where this happens. True — and rendering the
alternative killed the fix. Obeying the rule on an iPhone 15 shrinks the ship
from 33% of the frame to 24% and fills the bottom 45% with bare planking. The
pin is the only thing keeping the scene composed.

**3 — the pull-back rule steers on a variable unrelated to what it damages.**
Provable, and I still believe the proof: for a fixed _vertical_ fov,
`px per world unit = viewportHeightPx / (2 · distance · tan(fov/2))`, in which
aspect does not appear. `.probe/pc-target-scale.mjs` confirms it numerically —
80.419010 px/unit at aspect 1.778, 1.333, 1.000, 0.556 and 0.400, identical to
six decimals across a 4.4× range — and the closed form was then validated
against 28 rendered rows produced by hiding props and diffing real frames (worst
error 7.1%). The rule keys off aspect; on-screen size depends only on viewport
height and distance, so it dollies away hardest exactly where props are already
smallest. Real, and not the reason the scene feels bad.

**4 — so props are under the 44 px touch floor and cannot be tapped.** Void.
`gestureRules.ts` defines `PROXIMITY_PX = 70` and the controller applies it. A
prop rendering 11 px wide is not unreachable; it carries a 70 px catchment. Four
probes had been measuring against a floor borrowed from Apple's HIG that this
code does not use.

**5 — then the pull-back must cause tap _theft_.** Wrong, and wrong in a way
worth naming: the fallback resolves to the _nearest_ target, which is a Voronoi
rule. Deterministic, not arbitrary. Nothing is stolen.

**6 through 9 — the crowding charge, in four increasingly careful forms.** That
the scene stages distinct tappable props closer together on screen than
`PROXIMITY_PX` can separate; that the pull-back triples the count on phones; that
restaging sixteen props would fix it. Four solver iterations went into this.
Along the way the probe was corrected twice for real bugs — `__propCenters` was
sweeping in three system roots all sitting at the world origin (reporting an
impossible 0.0 px closest gap), and the grouping was merging the five mushrooms
and then the fourteen fireflies into single targets.

**10 and 11 — and then the whole crowding frame collapsed.** Reading
`interactionController.ts` properly killed both of its load-bearing assumptions:

- `onPointerUp` **raycasts first**. `pickRegistered` returned on any hit and
  `fire()` ran immediately; `pickByProximity` was reached only under the comment
  "Missed every mesh". Centre-to-centre distance therefore never arbitrates a tap
  that lands on geometry — the mesh under the finger wins, which is the correct
  answer. Pairwise centre separation is not the rule the app enforces, so
  `.probe/nature-density.mjs`'s hexagonal packing bound priced a constraint that
  does not exist.
- What is registered is not what the round assumed. `createTapInteraction`
  registers a single **mesh** — `mushroom.tapTarget` is the cap, not the mushroom;
  `flower.tapTarget` is the 0.12-unit centre. A census of the live registry found
  **65 entries in 46–52 groups**, not the 26 the round had been solving for.

Both corrections came from reading what the controller _does_ instead of
modelling what it should do. That is also where the real defect was sitting.

## The three charges that survived

All three are the same failure — soul.md §6, _"Every tap — whether it lands on a
designated interaction or on empty space — must produce a response"_ — and none
of them is visible at a call site.

### A. The ground disables small-target forgiveness

`wireFloorTap` registers the ground: one **28 × 32** plane, tappable, that flies
the owl to the tapped point. Combined with first-hit-wins, a tap aimed at a
mushroom and landing a finger-width off does **not** "miss every mesh" — it hits
the FLOOR. The owl flies, and the forgiveness rule that `gestureRules.ts`
documents as a core child-UX guarantee is never consulted. It was unreachable
except on sky.

`.probe/render/nature-tap-reach.mjs`, sampling every 3 px at nine viewports and
re-running the controller's own decision at each sample:

```
  viewport                 props   invisible   p(hit)@24 below 50%   median p@24
  landscape 1280x720          40           2                   33          3.5%
  tablet 1024x768             51           6                   43          3.5%
  square 900x900              51           7                   40          5.5%
  iPad portrait 768x1024      51          11                   41          5.0%
  viewport 480x854            51          30                   44          0.0%
  iPhone SE 375x667           51          30                   44          0.0%
  iPhone 15 393x852           51          32                   48          0.0%
  Pixel 8 412x915             51          33                   49          0.0%
  extreme 360x900             45          30                   43          0.0%
```

The ground answered **52.1%–61.6%** of the canvas. A flower's entire catchment
was its own **36 px²** silhouette; a steady-handed child reaching for it got it
**2%** of the time. On five of nine viewports the _median_ prop was unreachable.

### B. A transparent registered surface drowns everything under it

A raycast reads geometry, not appearance. Two of the three leaves are staged in
the stream at y = 0.02, under `water-surface` at y = 0.038 — transparent,
`depthWrite: false`, and registered. `intersects[0]` was the water every single
time, and both leaves measured **zero tappable pixels at every viewport**. Not
hard to hit. Impossible.

### C. Nothing in the scene made a sound, and nothing answered a miss

`grep -rn 'playSound|Sfx|sfx_' naturescene/` returns **nothing**. Not one of ~51
registered tap targets plays a sound. The controller's own no-dead-tap fallback
cannot cover for them either, because `createWorldTapDispatcher` called
`createInteractionController(canvas, camera, scope)` with **no audio argument**,
and its only other caller — `buildScene` — has zero call sites in the repo. The
controller's header advertises "No dead tap" as one of the two reasons it exists;
it was wired to nothing in every world scene, for the whole life of the scene.
Separately, 20.7%–25.9% of the canvas (sky and treeline) fired nothing at all:
`onPointerUp` simply returned.

Pirate Cove is the control that makes this a Nature defect rather than a
framework one: same factory, same dispatcher, **8** sound call sites against
Nature's 0.

## The fix

One flag, one hook, one omitted argument.

1. **`TapOptions.background`** — an environment-scale surface that still fires but
   must never take a tap a small target could plausibly have been meant to
   receive. `pickRegistered` now keeps the nearest ordinary hit and the nearest
   background hit **separately**; `onPointerUp` prefers foreground, then
   proximity, then background, then acknowledgement. `pickByProximity` skips
   background surfaces outright — a ground plane's origin is the middle of the
   world, so leaving it in a nearest-centre contest would re-create exactly the
   problem the flag exists to solve. Applied by `wireFloorTap` (every world and
   room scene) and by the Nature stream (which is both environment-scale _and_ a
   lid). This fixes A and B with the same three lines: walking past the background
   hit is what un-drowns the leaves.
2. **`setMissHandler(ray)`** — `worldSceneFactory` emits a sparkle 12 units along
   the camera ray for a tap that matched nothing. The visual half is the half that
   still arrives on a muted device, which is how these are actually played.
3. **The fourth argument.** `sceneBridge` now counts sound _requests_ and
   `worldTapDispatcher` passes `{ soundCount, playFallback }`. The counter
   deliberately ticks even when audio is unarmed or muted: the question it answers
   is "did this interaction try to speak", not "was anything heard".
4. **`TAP_BACKGROUND_KEY` mirrored onto `userData`** at register time, so the
   scene graph is self-describing. This is the direct lesson of falsifications 10
   and 11: the registry being private meant the single most consequential property
   of a registration was invisible to every tool that inspects the graph, and this
   round spent four iterations measuring a rule the controller does not apply
   because of it.

## Evaluating the fix against the "suck"

Two instruments, one predictive and one that refuses to model.

**Tapped for real.** `.probe/render/nature-ack.mjs` dispatches genuine pointer
events on a 20 px grid at all nine viewports — fresh page each time, so no
sweep's side effects carry into the next — and counts sound requests per tap. The
taps are real, so leaves flip and stones slide and the owl flies, which makes the
measurement harder rather than easier.

```
                              HEAD              after
  taps                      12500              12500
  answered                    742              12500
  SILENT                    11758                  0
  worst run of silent taps   1108                  0
```

**Predicted, per prop.** Median p(hit) for a steady hand (24 px), before → after:

```
  landscape 1280x720       3.5% -> 82.2%    props below 50%:  33 -> 3
  tablet 1024x768          3.5% -> 67.9%                      43 -> 12
  square 900x900           5.5% -> 81.2%                      40 -> 11
  iPad portrait 768x1024   5.0% -> 80.4%                      41 -> 16
  viewport 480x854         0.0% -> 67.9%                      44 -> 23
  iPhone SE 375x667        0.0% -> 70.0%                      44 -> 18
  iPhone 15 393x852        0.0% -> 62.0%                      48 -> 18
  Pixel 8 412x915          0.0% -> 51.4%                      49 -> 19
  extreme 360x900          0.0% ->  0.0%                      43 -> 25
```

Ground catchment 61.6% → 45.4% (landscape) and 52.1% → 31.1% (iPad portrait); the
stream from 47547 px² to 3.6% of the canvas. The drowned leaf goes from a
**0 px²** silhouette to 684 px² and from 0.0% to 82.2%.

**Pinned.** `tests/framework/tapArbitration.test.mjs`, 13 tests. Mutation-tested
by reverting the production change: 7 fail, and the six that still pass are the
controls and the over-correction guards — open ground must still fire the owl, a
handler with its own voice must not be talked over. Each "the prop wins"
assertion is paired with a control that registers only the environment surface,
because without it the test would pass equally if the tap point had been over
empty sky.

## Where the fix does not suffice, stated plainly

**`extreme 360x900` is unchanged at 0.0%, and it is a different defect.** Its
detail table shows **27 of 44 props with zero silhouette _and_ zero catchment** —
all four portals, the log, all three stones, mushroom #5, three flowers, a leaf,
two butterflies, six fireflies. Zero on both columns means neither
raycast-reachable nor proximity-reachable: they are not being out-arbitrated,
they are **not in the frame at all**. That is charge 1/3 territory (framing and
pull-back), not dispatch. The two formerly-drowned leaves are the
best-performing props on that viewport at 100.0%, which is the tell — the fix
works there; there is simply nothing else on screen to reach for. Iterating
dispatch further would be tuning the wrong knob.

**The fireflies are now legitimate tap thieves.** Fourteen moving targets hold
large proximity catchments after the fix (firefly_13#1: 12168 px², 100.0%), and
they are the main remaining competitor for the worst-performing static props
(stone#3 30.4%, leaf#3 47.5% on landscape). Nothing is _stolen_ in the Voronoi
sense, but the nearest target moving under the finger between frames is a
different question from the one this round answered.

**Room scenes get the audible acknowledgement but not the visible one.**
`roomSceneFactory` shares the dispatcher, so `playFallback` is live there, but it
sets no miss handler — a fixed-depth sparkle indoors can land inside a wall.
Worth doing properly by raycasting the room shell, not worth guessing at now.

**`resize()` still does not re-apply the pull-back** (charge 1). Real, measured,
and untouched: the harness reported radius 16.191 at _both_ 393×852 and 360×900,
because the second was reached by resizing rather than opening fresh.

**The density question is not answered, only re-scoped.** vision.md asks for 4–7
obvious tappable interaction points; the registry census found 46–52 groups. The
crowding charge was wrong about the _mechanism_ and may still be right about the
_number_. That is a staging conversation, not a patch.

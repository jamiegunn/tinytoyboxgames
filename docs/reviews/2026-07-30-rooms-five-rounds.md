# The rooms — five rounds of indictment, fix, and evaluation

A review of Playroom, Living Room and Kitchen, conducted under the same standing instruction as
the scene review and the Little Shark review that preceded it: _do not trust your confidence —
prove it, then test your proof._ Every charge below carries a measured number rather than an
adjective, and every fix is evaluated against the number that produced the charge. Where the
evaluation refuted the fix, the round says so and the next arm is the iteration.

Normative documents: `docs/ai-guidance/soul.md` and `docs/ai-guidance/vision.md`. A defect is a
departure from those, not from my taste, and each round names the clause it is prosecuting.

The instrument for Round 1 is `src/.probe/render/room.ts` plus its runner
`src/.probe/render/rooms-ack-visible.mjs`. It boots each room's own `createScene` in headless
Chromium through the real Vite dev server — never a re-implementation — dispatches genuine
`pointerdown`/`pointerup` pairs on a pixel grid across the canvas, and records for every sample
what arbitration fired, whether a particle burst was emitted, and whether that burst was
reachable from the camera. Nature is run alongside the three rooms as a control, because it is
the scene that already had the feature under test.

Rounds 6 onward leave the rooms and turn on the apparatus itself — the pre-commit gate (6), the
reachability guard's blind spot (7), and the migration register (8) — because by Round 5 the
instruments had produced more wrong verdicts than the product had defects, and the register at the
foot of this document is the reason that shift was not optional.

---

## Round 1 — The answer that was emitted and could not be seen

### The charge

**soul.md#6, Every Tap Matters:** _"A dead tap is a broken promise... Every tap — whether it lands
on a designated interaction or on empty space — must produce a response."_ **soul.md, The Sound
World:** _"Sound is never required for comprehension. A muted experience must be fully playable
and emotionally complete."_

Read together, those two clauses decide which half of the response is load-bearing. The sparkle is
the contract. The sound is the garnish.

The charge has three layers, and each one was found only because the layer above it was tested
rather than trusted.

**Layer one: the rooms had no visual half at all.** `interactionController.ts`'s `acknowledgeMiss`
(renamed `acknowledgeTap` later in this same round, once Round 2 made it answer hits as well as
misses — the old name is kept in this paragraph because it is what the function was called at the
time being described) gates the visual acknowledgement on `if (missHandler)`. `setMissHandler` had exactly one call site
in the whole repository — `worldSceneFactory.ts` — and `roomSceneFactory.ts` had none. So a tap in
Playroom, Living Room or Kitchen that reached arbitration branch 4 ran `audio?.playFallback()` and
nothing else. This is a deduction from control flow, not an inference from a frequency: there was
no code path by which a room could draw an answer to a missed tap. The repository's own
`architecture-standards.md` said so in prose — _"Room scenes have the audible half but not yet the
visual one"_ — which is corroboration, not proof, but it does mean the gap was known and had been
left standing.

Measured magnitude, at a 32 px grid across five shipping viewports per room: between **26.2%**
(Living Room, iPad portrait) and **49.7%** (Kitchen, Pixel 8) of the canvas produced no answer a
muted child could see. The silent-tap fraction over the same grid was **0.0%** — every one of
those taps made a sound. That is precisely why the earlier sound-counting probe passed all three
rooms: it was measuring the half that worked.

**Layer two: the obvious repair is also wrong.** Copying Nature's handler verbatim —
`ray.at(MISS_SPARKLE_DISTANCE = 12, point)` and emit — installs a burst on 100% of missed room
taps and would satisfy any count-based probe completely. Graded geometrically instead, by
raycasting from the camera to each emitted burst and asking whether opaque mesh lies between, it
was invisible over up to **22.0%** of the Living Room's landscape frame. A room's shell is side
walls at |x| ≤ 5.4–6.0 with a ceiling slab at y = 6.2–6.75, and the camera orbits at radius 14.
Twelve units along a tap ray aimed at a wall is _through_ that wall. Blame was evenly split
between the two side walls at 42.3% each, plus the ceiling.

**Layer three, and this is the layer that makes the charge general rather than a room bug:** the
same measurement, applied to the control, convicted the shipped outdoor scene too. Nature's
already-live handler was invisible over **11.6%** of its own landscape frame, blocked by its own
geometry — `tree_5.2_-1.0` at 41.8% of the blocked bursts, `treeTrunk` at 10.3%. Its constant's
docblock argued that _the sky has no geometry, so nothing can come between_. The sky has no
geometry; the trees do, and a ray aimed at the horizon passes through them on the way to 12 units.

So the defect is not "the rooms lacked the fix". The defect is that **the acknowledgement's depth
was chosen without reference to the geometry it must be seen against, and that flaw shipped in
Nature too.** The rooms merely made it impossible to miss.

### Why this is a real defect and not a matter of taste

Because the soul document makes the visual half the one that must survive a muted device, and
because "emitted" and "seen" are different predicates that the existing instrument could not
distinguish. A tap that plays a chime and draws a sparkle inside a wall satisfies every counter in
the codebase and breaks the promise as written. On a tablet with the volume down — which is how a
great many children use a great many tablets — up to 22.0% of the frame answered nothing at all,
and the child has no way to learn that the rule is "the top-left of the room is dead".

The 5% floor for layer one and the 1.0% bar for layer two were both committed to in the probe's
source **before** the measurement that used them, so neither is a bar drawn around a result.

### The anticipated defence, and why I reject it

_"A child does not tap the wall; they tap the toys."_ This is the defence that would excuse the
whole round, and it fails on its own terms. The unanswered region is not a thin margin: it is a
quarter to a half of the canvas, and its centre of mass is the upper third of the frame — the
ceiling, the back wall, the sky above the shelf. That is exactly where a child looks when they are
deciding what to try next. The promise in soul.md is unconditional by construction — _"whether it
lands on a designated interaction or on empty space"_ — because the whole point of it is that
exploration is never punished. A world that goes quiet when you look up teaches you not to look up.

_"Nature ships with this and nobody complained."_ Nature ships with **11.6%** of its landscape
frame answering invisibly, which is not a licence, it is the second half of the charge.

### The fix

One shared handler, `src/src/utils/interaction/missAcknowledgement.ts`, installed by both
`roomSceneFactory` and `worldSceneFactory`. The depth is **found rather than chosen**: the handler
raycasts the tap ray into the scene, anchors the burst on `hit.point`, and lifts it clear along the
world-space face normal. The chosen constant survives only in the branch where the ray hits
nothing at all — which is a true premise by construction of that branch, unlike the sky argument
it replaces.

Three details are load-bearing and each one is there because of something measured:

**Only opaque, actually-rendered meshes count as surfaces.** `Raycaster` does not test `visible`,
so a hidden prop would otherwise be a hit; and Nature's registered water plane is a _transparent_
mesh at y = 0.038 spanning the pond, so treating it as a surface would make the pond answer
differently from the grass beside it for no reason a child could perceive.

**The normal is flipped toward the camera when it points away.** A room's walls are boxes seen
from inside, and some authored geometry is wound the other way, so lifting "along the normal"
without that check would push half the bursts _into_ the plaster.

**The lift is bounded on both sides, and getting only one bound right is what made the first
attempt fail.** The upper bound is the world equivalent of the interaction slack the codebase has
already committed to: `PROXIMITY_PX = 70` says 70 px is "the child meant this", which at the
rooms' 14-unit orbit and `SCENE_CAMERA_FOV = 50` is 1.269 world units. The lower bound is the
burst's own lateral reach: `SCENE_SPARKLE` throws particles in a cone of half-angle 0.82 rad, so a
particle at the graded core radius of 0.5 sits 0.5 · sin(0.82) = **0.366** units to the side of the
anchor, and on a wall — whose normal is horizontal — "to the side" means straight into the
plaster. Window **[0.366, 1.269]**; the shipped value is **0.45**, the smallest value that clears
the floor with margin, so the sparkle reads as belonging to the surface rather than floating in
front of it.

### Evaluating the fix against the charge — and the first two arms failing

The grading probe was extended before any arm was measured, because the instrument that produced
the charge **could not have graded the fix**: every arm emits a burst on every missed tap, so an
emit counter would have returned a perfect score for all three. That question — _can my instrument
detect the failure I am about to dismiss?_ — is what produced the two geometric observables the
round actually turned on.

**Arm A — literal copy of `ray.at(12)` into the rooms. FAILED.** Worst room viewport 22.0%, 810
bursts emitted-but-hidden, 0 emitting nothing. Bar was 1.0%. This is the arm that also convicted
Nature at 11.6%, and it is the reason the fix is shared rather than copied.

**Arm B — anchor on the hit point, standoff 0.25. FAILED, on a bar added between arms.** The
anchor problem was cured completely: worst room viewport fell from 22.0% to **0.5%** and Nature
from 11.6% to 0.3%. But a fix that lifts the burst off the surface by an epsilon makes the _anchor_
visible while leaving the _sparkle_ inside the plaster, and an anchor-only test would score that
perfect. So a second bar was committed before arm B was measured: the mean visible share of the
burst core — the origin plus nine points at 0.5 units along the preset's own emission cone — must
stay at or above **0.50** at every viewport in every room. Arm B measured **0.464** in Playroom at
375×667. Published as a failure rather than retuned into a pass.

The second bar is strictly harder than the first, which is the only direction a bar may move
between arms, and arm A's failure stands on the 1.0% bar it was actually graded against.

**Arm B was then re-graded at the finer grid, because 0.464 against a 0.50 bar is a margin of
0.036 and grid density could plausibly have accounted for it.** At 16 px it measures **0.488** —
still below the bar, at the same viewport of the same room, with the same verdict. The margin
narrowed and the conclusion did not, so arm B's published failure is a property of the standoff
and not of the sampling. This is the check that would have overturned the round if it had come out
the other way, which is why it was run before the round was written rather than after.

Arm B's failure was then diagnosed by deduction rather than by search: 0.25 had been chosen from
the upper bound alone, and the lower bound — 0.366 — had never been computed. Below it, part of
every wall burst is buried by construction.

**Arm C — standoff 0.45. PASSES both bars.** Graded at a 32 px grid across five viewports per
scene, then re-graded at a **16 px** grid, four times denser, which it also passes:

|                            | worst viewport, no visible answer | thinnest burst core   |
| -------------------------- | --------------------------------- | --------------------- |
| three rooms, arm A (32 px) | 22.0%                             | not yet measured      |
| three rooms, arm B (32 px) | 0.5%                              | **0.464 — below bar** |
| three rooms, arm B (16 px) | 0.2%                              | **0.488 — below bar** |
| three rooms, arm C (32 px) | 0.5%                              | 0.866                 |
| three rooms, arm C (16 px) | 0.5%                              | 0.868                 |
| Nature, before (32 px)     | 11.6%                             | not yet measured      |
| Nature, arm C (16 px)      | 0.3%                              | 0.788                 |

At the 16 px grid, 35 bursts were emitted-but-hidden across 15 room runs of 3072–3600 samples
each, and **0** samples emitted nothing at all. Both structural premises held at all 20 runs: the
emit counter was wired to each scene's own particle engine, and the occlusion test was shown able
to tell a point behind the Playroom rug from a point in front of it, so it can distinguish the two
states it reports.

The probe's sensitivity is not assumed either. The same instrument rejected two distinct real
failures — arm A on the anchor bar, arm B on the core bar — so its pass on arm C is a measurement
rather than a tautology.

**Cost.** The handler adds one full-scene raycast per missed tap. Measured through the probe's own
occlusion hook (three raycasts per call, so a third of the figure is an upper bound on one):
0.553 ms in Playroom, 0.153 ms in Kitchen, 0.945 ms in Nature — worst case 5.7% of a 16.7 ms
frame, once, on a frame where the child touched nothing.

### What the fix does not fix, on the record

**35 residual hidden bursts, and their mechanism is now understood.** The standoff moves the burst
sideways in screen space, so the camera-to-burst ray is not the camera-to-anchor ray, and it can
graze geometry the tap ray missed. The blame list is the proof: Playroom's residuals are dominated
by the hanging mobile's thin parts (`mobileHangString` and `mobileMainBar`, 54.6% between them),
Kitchen's by `fridgeBody` (58.3%) and `fridgeSeam`. These are the concave-and-adjacent cases no
single-normal standoff can cure, and none of them is a see-through mesh — which is how a detector
false positive would have shown up.

**The depth spread widened, exactly as designed, and that is a follow-up defect.** Because depth
now tracks the surface, a burst lands anywhere from 5.61 to 31.04 units from the camera depending
on viewport and aim, against Nature's near-constant 12.00. Apparent sparkle size therefore varies
where before it did not. The probe reports this table unprompted and flags it as legitimate
follow-up work; the visibility bars do not measure it.

**Two scenes have an unnamed and a thinly-named mesh.** `livingRoom_artMoon_canvas` is Living
Room's single residual blocker across all five viewports. Kitchen's `cabinetBacksplash` and
`kitchen_leftWall` account for most of its remaining unanswered samples, which are corner samples.

**The residual unanswered samples cluster in the upper third**, at 100% for six of the ten
viewports that have any — the same region the charge indicted, now down from a quarter of the
frame to at most 0.5% of it.

### What is pinned, so this cannot silently regress

`src/tests/room/miss-acknowledgement.contract.test.mjs`, seven tests, every one of them verified
by mutation — the pin was perturbed and the assertion was confirmed to fire, because a test that
has never failed has not been shown to work:

- both factories install the shared handler (removing either line fails);
- neither factory keeps a sparkle depth of its own, and neither calls `ray.at` directly;
- the controller still calls the visual half as well as the audible one;
- the handler anchors on `hit.point`, and `SKY_SPARKLE_DISTANCE` appears **only** in the no-hit
  branch (moving it into the hit branch fails);
- the occluder filter still checks both opacity and ancestor visibility;
- **the standoff sits inside a window re-derived from four constants in four different files** —
  the sparkle cone, the camera fov, the interaction slack, and the probe's own core radius — so
  changing any of them fails here, at the decision that depends on them. Both bounds and all
  inputs are pinned by value as well as by relation (0.45 inside [0.366, 1.269]), and the probe's
  rounded core radius is asserted to be no _smaller_ than the preset's own arithmetic gives, so
  the instrument can never become more lenient than the physics it stands in for;
- the fallback depth of 12 is pinned and asserted to lie inside the range of camera distances the
  catalog actually ships.

Two arithmetic errors in my own working were caught by that suite on its first run and are
recorded here rather than quietly corrected: the upper bound is **1.269**, not the 1.268 I had
computed by rounding the frame height to 13.05 first; and the burst's core radius from the
preset's own numbers is **0.481**, not the 0.5 I had written — 0.5 is the probe's rounded sampling
radius, which is the stricter of the two and therefore the right one to hold the standoff to, but
the two are not the same number and the docblock had conflated them.

A third error, in the probe rather than the fix, was found by asking why a comment was true rather
than whether it was: `room.ts` justified its mesh-only occluder filter by claiming that particle
`Points` batches would otherwise be returned as occluders of their own sample. They would not.
`utils/particles/engine.ts` sets `points.raycast = () => {}` on every batch it creates, with the
comment _"never intercept gameplay picks"_, so particle batches are already inert to every
raycaster in the process. The filter changes no measured number and is retained for `Sprite`,
`Line` and blame-list readability; the comment now says so, and says that the earlier
justification was false. A probe that claims a mechanism it has not checked is worth less than the
measurement it protects.

---

## Round 2 — The charge that was wrong, and the worse one underneath it

Round 2 is the round where the instrument was the defendant. Its pre-registered charge was
**refuted by measurement**, five separate defects were found in the apparatus built to test it, and
the finding that survived was one my own exclusion rule would have hidden — a finding that Round 1
created. All of that is on the record below in the order it happened, because a review that only
publishes the charges it wins is not a review.

The instrument is the same `src/.probe/render/room.ts`, extended, with a new runner
`src/.probe/render/rooms-reward-legible.mjs`.

### The charge, as pre-registered before any measurement

**soul.md, Delight, Not Content:** _"Five perfect tap reactions in a world are worth more than
fifty mediocre ones."_ **soul.md, What Success Looks Like:** each named reaction must be _distinct
and escalating_. **soul.md, The Promise:** _"Nothing will confuse you."_

Round 1 gave a missed room tap a sparkle. Every authored room reaction already emitted **the same
preset**, `PARTICLES.sceneSparkle`, and `createTapInteraction` is a pure pass-through to
`dispatcher.register`, so nothing between the handler and the screen distinguishes them. The charge
was therefore that Round 1 had **flattened the reward gradient**: that a child tapping the kettle
now sees essentially what a child tapping the plaster sees, because the prop's own tween is a few
pixels of motion against a burst of hundreds, and that this breaks _distinct and escalating_ at the
first rung.

The premise was stated as a claim about **admissibility**, not about absence — the fix exists, so
the question is whether the reward it installed is still legible — and the bar was committed in
source before the run: the pixels a prop's own reaction changes must be **at least as many** as the
pixels the shared burst changes at the same prop, same depth, same frame.

### The refutation

**The charge is false.** At the kitchen, 1280×720, every one of the seven authored props clears the
bar. Three independent runs of that pair, across two different reference constructions, agree on
the direction and disagree only in the third digit:

| kitchen @ 1280×720                          | lowest ratio | highest ratio |
| ------------------------------------------- | ------------ | ------------- |
| run 1, probe-placed reference               | 1.243        | 2.341         |
| run 2, probe-placed reference               | 1.081        | 2.267         |
| run 3, **real miss** as reference (correct) | **0.989**    | 2.364         |

The prop's own motion is not a few pixels against hundreds. It is comparable to, and usually
larger than, the burst it shares with the miss. **The prediction was not merely unconfirmed; it was
inverted**, and the reason is a dimensional error in my own reasoning, not a subtlety of the code.

### The dimensional error behind the prediction

I compared a **displacement** against an **area**. The kettle knob travels 3.8 px; the burst reads
as a blob about 37 px across; 3.8 against 37 looked decisive. It is not a comparison at all. A
silhouette displaced 3.8 px does not repaint 3.8 pixels — it repaints a band 3.8 px wide along its
**entire perimeter**, and a kettle's perimeter is hundreds of pixels long. And the burst is not a
filled 37 px disc: it is 40 sparks of `SIZE = 0.1` scattered across that reach, so most of the
blob's bounding box is untouched background.

Two quantities of different dimension had been set against each other and the one with the larger
number had been believed. That is the failure the discipline _prefer a deduction to a statistic_ is
supposed to prevent, and it slipped through because the statistic felt like a deduction.

Third digit, though, is where the round nearly went wrong in the other direction. `tableFruit2`
measures **0.989** against a pre-committed bar of 1.0 once the reference burst is constructed
correctly, having measured 1.081 and 1.423 against the flawed one. That row is a marginal failure,
it is reported as a failure, and it is a failure that only appeared **because I fixed my own
instrument against my own charge's interest**. See _the reference burst inside the prop_, below.

### Seven defects in the apparatus, found before the charge could be graded

> **Note, 2026-07-30.** This heading counted correctly when it was written and does not any more.
> Rounds 2, 3 and 4 each found further defects in the same instrument and numbered them onward from
> (vii), so the register now runs to **(xiv)**. It is not renumbered in place — the numbers are
> cited by later rounds and by comments in the probe sources, and silently re-indexing them would
> break every reference and hide the growth. The complete register, with each defect's round of
> discovery and where it is described, is consolidated at the end of this document under
> **The apparatus register**. The list below is Round 1's seven, left exactly as Round 1 left it.

**(i) The gsap clock defect, which had already voided a whole scan.** The probe advanced animation
by calling `updateRoot`, whose argument and `globalTimeline.time()` are different frames offset by
`globalTimeline.startTime()`; and `gsap.ticker.sleep()` turned out not to be a latch — creating a
tween **wakes** the ticker, and the wake tick advances from real elapsed wall time. Measured across
a single tap, the timeline jumped 24.237 → 10.826 s. The visible symptom was a **false zero** on
`kettleBody`: the tap's own tween had been finished before its window opened. The first scan was
retracted, not adjusted.

**(ii) Bar (c) was ill-posed, and is amended on the record.** As pre-committed, the ambient bar
compared a reaction against **all** motion anywhere in the crop, which in a room containing a
looping disc means a reaction is graded against a neighbour it never touches. The amended bar,
`ambientInMask`, restricts ambient change to the pixels the prop's own reaction actually changes,
maximised independently. **Both verdicts are printed in every run**, so the amendment is auditable
and so it is on the record that changing the bar changed the answer. The noise floor was measured
rather than assumed, and it justifies the amendment: this renderer is bit-exact deterministic
(frozen and clock-only baselines are **0 changed pixels**, full frame), while the Playroom's idle
motion alone moves **3689** pixels — an order of magnitude more than any prop reaction in it.

**(iii) My own exclusion criterion and this round's finding were the same predicate.** The runner
skipped rows with `emitted === 0` as "navigation targets, not delight targets". Three of the twelve
room handlers emit nothing — **and they emit nothing because they are defective**. All three would
have been filed under "navigates rather than delights" and the run would have reported a clean
sweep with total confidence. An instrument whose blind spot is exactly the failure it exists to
find is worse than no instrument, because it produces a pass.

Navigation is now identified **positively**: `room.ts` records every `nav.navigateTo` /
`launchMiniGame` call and each row carries `navigated` plus the destination it asked for. That is
sound because `navigateTo` is reachable from exactly two places in the entire package — grep finds
it at `interactiveDoorway.ts:189` and `wireToyboxInteractions.ts:137`, and **zero** times in the
rooms' own subplaces.

**(iv) A scene transition was graded as tap delight and passed.** The first run of the positive
test reported `toybox_kitchen-nature_root` as `navigated: false`, with 4248 changed pixels and a
ratio of **48.851** — a door to another scene, scored as an unusually delightful prop. Its
`navigateTo:nature` had in fact fired; it fired after the row was written.
`interactiveDoorway` navigates from a 0.45 s tween, which one 3 s settle covers.
`wireToyboxInteractions` flies the owl to the toybox first and only the flight's callback starts the
two 0.1 s scale tweens whose completion navigates — longer than one settle. The worse hazard is not
the missed exclusion but the **misattribution**: a chain that outlives its own row lands inside the
next row's window and marks an innocent prop as a doorway.

The repair is a bounded quiescence loop advancing **both** clocks, and — this is the part that
matters — the budget is **checked rather than trusted**. The scan asserts at the end that every
recorded navigation call was attributed to some row, and **throws** if any was not. A budget that
verifies itself survives a change to the animation it is waiting for; a budget I merely tuned until
the log looked right would not.

**(v) The reference burst was being emitted inside the prop.** This is the defect I am least
comfortable having written and the one most worth publishing. Removing an `asked.length > 0` guard
was correct — it was defect (iii) in a second location, since a prop that emits nothing got no
reference burst, so the denominator vanished for exactly the rows the round is about, and _a
denominator that vanishes whenever the numerator is interesting is not a denominator_. But the
anchor I replaced it with was the prop's **own world position**, which is inside the prop's
geometry, where the depth test buries the burst. Measured: `sparkleHigh` came back **0** on both
kitchen doorway rows. So an emit-nothing, non-navigating prop would have scored `propHigh / 0` =
`Infinity` and **passed bar (d) for free** — the precise failure the round exists to catch,
reintroduced by the fix for it.

The probe no longer invents an anchor. It casts a ray from the live camera through the prop's own
NDC and hands it to the **shipped** `createMissAcknowledgement`, which finds its own occluder, its
own surface normal and its own standoff. The reference is a miss at the same screen point, produced
by the code that produces misses, restating no constant — not `SURFACE_STANDOFF`, not
`SKY_SPARKLE_DISTANCE`, not the preset. After the change, zero rows have a zero reference, the two
doorway rows measure 134 and 472 reference pixels, and `tableFruit2` fell from 1.081 to 0.989.
**The correction made the round's own case worse, which is the only evidence that it was a
correction and not a tuning.**

**(vi) The scan fired once per pick mesh, and would have reported this round's fix as having
failed — with numbers.** This is the most instructive of the six, because unlike the others it would
not have produced a wrong number or a missing one. It would have produced this round's own charge, in
this round's own words, against the three props whose repair the run existed to confirm.

`__propTargets` returns one row per registered **object**, and a prop is not an object. The Playroom
registers four meshes for the desk lamp — `[base, arm, shade, bulb]`, all assigned the same
`base.userData.onClick` — and three for each toy car. Every one of those handlers opens with a
latch: `if (shining) return;`, `if (driving) return;`. So row one fires the reaction and rows two
through four hit the latch and return, having tweened nothing and emitted nothing. Measured, they
read `propHigh` 0 and `emits: []`; graded, they read **failing bar (d) — "this prop answers a hit
with nothing."** A pass would have been impossible to obtain and the failure would have been
unfalsifiable, because the second reading of a repaired prop is indistinguishable from the first
reading of a broken one _by the numbers alone_.

It was not found by a test. It was found by asking why the first matrix pair had not printed after
fourteen minutes — a question about **cost** that turned out to be a question about **correctness**.
The in-flight run was killed rather than allowed to finish, on the grounds that rows produced by an
instrument known to be wrong are not data to be corrected later.

The first repair was to group targets by **handler identity**, union the group's geometry to build
the crop, and report the group size as a `pickMeshes` column. The union crop is load-bearing and not
merely tidy: the desk lamp's reaction rotates `armPivot`, which `lampBase` knows nothing about, so a
crop taken from the registered mesh alone would clip the reaction and report the clipping as a small
reaction. **The grouping key, however, was wrong, and it was argued for in this document before it
was run.** The argument was that `roomSceneFactory.ts:107` passes `object.userData.onClick` to
`dispatcher.register` unwrapped, so siblings share one function object. That is true and it is not
the identity the probe compares, because `worldTapDispatcher.register` is

```ts
register(target, handler, opts) { return controller.register(target, () => handler(), opts); }
```

— a **fresh closure per registration**. The Map the probe captures is the controller's, so no two
entries can ever compare equal and grouping by that key is a no-op that looks like a fix. It was
refuted by the first Playroom run in a single column: sixteen rows, every one `picks 1`, the desk
lamp still four rows, reading 1.233, 0.670, 0.126 and 0.107. The key is now the object the room
author actually shared — `userData.onClick` — with modern `createTapInteraction` props forming
singletons, which is correct because that API registers one mesh per call.

The lesson is not "use a different key". It is that **an argument from source about what an
identity means is not an observation of that identity**, and this one was published as exact. So the
grouping no longer rests on the argument: the scan takes a census of shared `userData.onClick`
functions, computes how many groups that implies, and **throws** if the grouping did not produce
exactly that many. A key that silently degrades to one-group-per-mesh again cannot produce rows.

**(vii) The rows were not independent, and the check that was supposed to catch it could only
detect the opposite failure.** The same Playroom run reported `lampBulb` as `navigated: true`,
`navigateTo:nature` — five rows after `toybox_animals_root`, which is the prop that actually asked
for it. The end-of-scan assertion passed, because the call **was** attributed: to an innocent prop.
A check that counts attributed calls can detect a **lost** chain and is structurally blind to a
**stolen** one, which is the failure that puts a wrong verdict in the table.

The cause is that the drain after each fire breaks the moment a nav arrives, and spent three draws
per iteration against three gsap seconds. The owl's flight to a toybox is driven by the **frame**
clock, so eight iterations advanced roughly half a second of frame time — the chain simply had not
started. The same gap contaminated pixels, not just navigation: the desk lamp holds its spotlight
for `SHINE_DURATION = 5` s and takes 0.6 s to tilt back, so it was still animating while the next
rows were measured, and that is where 65, 11 and 9 px came from on rows that had fired nothing at
all.

There is now an unconditional **fence** at the end of every row: both clocks drained with enough
frame ticks to finish a frame-driven chain, no readbacks, about two seconds against a row that costs
a minute. Anything arriving in the fence is charged to the row just fired, which is sound because
nothing else has fired since. And the smoke's own latched-row census, which had reported a clean
zero on the run with four desk-lamp rows in it, had `propHigh === 0` removed from its predicate:
**an artefact that is merely small is more dangerous than one that is absent, because only the
absent one trips a zero test.**

### The real charge

**soul.md#6, Every Tap Matters:** _"A dead tap is a broken promise."_ **soul.md, Delight, Not
Content.** **soul.md#1, Wonder Over Achievement.**

Three of the twelve authored room prop handlers — all in the Playroom — emitted **no particle burst
at all** and played **`sfx_shared_tap_fallback`**, which is byte-identical to the cue
`acknowledgeTap` plays for a tap that hit nothing:

- `playroom/bookshelf-items/deskLamp.ts`
- `playroom/bookshelf-items/toyCar.ts`
- `playroom/floorToys/toyCar.ts`

`worldTapDispatcher.ts:47` maps `playFallback` to that cue; `interactionController.acknowledgeTap`
calls `missHandler(raycaster.ray)` and then `audio?.playFallback()`. So **since Round 1, finding the
desk lamp was answered less richly than touching the shelf beside it.** Round 1's own fix created
the inversion: before it, hit and miss were equally bare, and there was nothing to invert.

This is not a frequency, it is a deduction from control flow, and it holds on a muted device by
construction — with sound off, those three taps produced nothing whatsoever while a missed tap
produced a sparkle.

It also cannot be repaired in the audio layer, and that is structural rather than incidental:
`interactionController.fire` **substitutes** `playFallback()` whenever a handler completes without
requesting a sound, so sound is designed not to carry the hit/miss distinction. The visual half is
the only half that can.

### Why this is a real defect and not a matter of taste

Because the gradient runs the wrong way, and a child cannot be told that. soul.md#1 puts wonder
above achievement and _Delight, Not Content_ says five perfect reactions beat fifty mediocre ones —
both of which presuppose that **searching is rewarded more than not searching**. A lamp that
answers a successful search with the failure cue and no picture teaches the opposite lesson, and
teaches it reliably, because the lamp is on the top shelf and finding it is the achievement.

### The anticipated defence, and why I reject it

_"soul.md says Diorama, Not Environment — things in a handcrafted miniature should read as small
and physical, and Round 1's own `SURFACE_STANDOFF` docblock says the sparkle should look like it
belongs to the surface rather than floating in front of it. You are asking for fireworks."_

This is the strongest defence available and it defeats the **pre-registered** charge — which is
part of why that charge was refuted rather than argued down. The diorama clause is a genuine reason
for a prop's reaction to be modest in absolute terms, and the measured ratios show the rooms are
already doing that well: props clear the bar by margins of 1.0–2.4, not 10.

But the diorama clause is an argument about **scale**, and the surviving charge is about **order**.
Nothing in a miniature aesthetic requires that finding the lamp be answered with strictly less than
touching the wall next to it. The three fixed handlers emit the **same** preset the miss emits, at
the same modest scale — the repair adds no fireworks, it removes an inversion.

_"Those three props do a lot: the lamp tilts and shines a spotlight for five seconds, the cars
drive."_ True, and irrelevant to the first 400 ms. The lamp's spotlight turns on in the **`onComplete`
of a 0.4 s tween**, so at the moment of the tap the child gets the fallback cue and a slow tilt. The
answer has to arrive when the finger lands.

### The fix

One added burst and one changed cue per handler, and **no new authored value anywhere**:

`triggerSound('sfx_shared_star_chime')` on the desk lamp is not a fresh choice — it is what the
Living Room's `floorLamp` already plays for the same object class doing the same thing. The two toy
cars take `sfx_shared_whoosh`. All three emit `PARTICLES.sceneSparkle` unmodified, at the moving
part rather than the group origin — the lamp at its bulb, the cars at a small vertical offset above
the body — so the burst is where the eye already is.

Choosing the miss's own preset is deliberate and is the safer fix even though a bespoke preset
would score better on any legibility metric: it makes the three handlers **identical in kind** to
the nine that already work, so this round adds no new thing to maintain and no new tuning to
defend. _Ship the safer fix even when it scores worse._

### Evaluating the fix against the charge

Bar (d) — _a hit must change at least as many pixels as a miss at the same place_ — is decided
**without a fourth rendering pass**, because it is decidable by deduction. `missAcknowledgement.ts`
emits `PARTICLES.sceneSparkle` with no overrides. A prop that emits the same preset unweakened
therefore draws everything the miss draws **and** moves itself: a superset, which no pixel count
can overturn. The two obvious numerators are both wrong — `propHigh + sparkleHigh` double-counts
every pixel the two halves share, and a live unmuted re-fire is barred by five measured handler
latches (`floorToys/toyCar.ts:201`, `floorToys/webSlinger.ts:125`,
`bookshelf-items/toyCar.ts:101`, `bookshelf-items/deskLamp.ts:84`,
`shared/interactiveDoorway.ts:176`).

So the fix passes bar (d) **by construction**, and the honest statement of that is that bar (d) is
now an argument rather than a measurement. Which means its premise has to be measured, and it is:
the miss's preset is **parsed from source with two throws and no fallback**, and independently
**observed** by teeing the real handler's emit at every prop. The run requires the two to agree and
throws if they do not — a source parse cannot see a preset chosen behind a branch this viewport
never takes, and an observation cannot see that the file it credits is the file it read.

Only the rows where the deduction is unavailable — emit nothing, emit something else, or emit the
same preset with `count` turned down — are measured against the real miss. Recording the **overrides**
and not just the preset name is what closes the case a name-only check would pass: `sceneSparkle`
with `{ count: 4 }` draws a tenth of the miss's burst under a matching name.

**Cost.** Readbacks, not draws, are the entire budget: at kitchen 1280×720, `perDrawMs 8.29`,
`perDiffMs 4.24`, and **`perReadMs 1213.95`**. That is why the quiescence loop spends draws freely
and why bar (d) was solved by deduction rather than by a fourth unconditional readback pass. One
kitchen pair costs roughly 12 minutes.

### What the fix does not fix, on the record

**`tableFruit2` measures 0.989 against a bar of 1.0** at kitchen 1280×720. It passes bar (d) by the
superset deduction — the child is not getting less than a miss — but its own motion is
indistinguishable in magnitude from the shared burst, which is the pre-registered charge coming
narrowly true for exactly one prop out of seven in one room. It is not retuned into a pass here.

**One Playroom reaction is structurally slow and is filed rather than claimed as a pass.**
`critters/musicPlayer.ts` answers a tap with `gsap.to(disc.rotation, { duration: 3, repeat: -1 })`
and a second tween at `duration: 10` — an infinite spin whose motion **within the first 400 ms** is
correspondingly tiny. A reaction whose whole content is "this now rotates forever" is answering a
different question than "did something happen when I touched it", and it is filed against bar (d) as
follow-up work.

A second prop was nearly filed alongside it **and should not have been**, which is worth recording
because it is the same error as the round's opening charge in miniature. `floorToys/toyCar.ts`
contains `gsap.to(carOrbitPivot.rotation, { duration: 28, repeat: -1 })`, and I had written that
down as a slow reaction on the strength of the number. Reading the handler rather than the grep
shows the 28 s orbit is a **sustained idle registered after** the answer, and the answer itself is a
1.0 s drive to the track with a 0.3 s turn — among the largest immediate motions in any room. A
duration harvested from a grep is not a reaction time.

**The quiescence budget is empirical.** Eight iterations was chosen because the owl's flight needed
more than one and this covers it with margin. The attribution throw makes an insufficient budget
**loud** rather than silent, which is the property worth having, but the number itself is not derived.

**An ordering constraint in the probe is load-bearing and was undocumented.** Calling
`__freezeIdles()` **before** `settle()` silently prevents the tap's own tweens from ever existing,
so the freeze must be taken after the settle and before the tap. It is now stated where it is relied on.

### What is pinned, so this cannot silently regress

`src/tests/room/prop-reaction-channels.contract.test.mjs`, seven tests, **every one verified by
mutation** — the source was perturbed and each assertion was confirmed to fire:

- the parser finds **12** handlers distributed `{ playroom: 5, kitchen: 3, 'living-room': 4 }`, of
  which 7 register through `createTapInteraction` and 5 through `userData.onClick`, 2 of those via a
  named `const` — pinned **by value**, not just by shape, so a handler silently disappearing fails here;
- every handler runs at least one transform tween;
- every handler emits some `PARTICLES.*` burst;
- **no handler plays `sfx_shared_tap_fallback`** — this is the round's finding, pinned directly;
- `interactionController.fire` still substitutes the fallback when a handler requests no sound, so
  the reason sound cannot carry the distinction stays true or the test fails;
- `createTapInteraction` is still a pure pass-through, which is the premise that lets the two
  registration mechanisms be graded as one;
- the Playroom's legacy `onClick` bridge is still wired, since without
  `registerUserDataClickTargets` five of the twelve props would vanish from the scan rather than fail it.

One pin was itself wrong on first writing and is recorded rather than quietly fixed: the
pass-through test located an **overload docblock** instead of the function body, and passed for the
wrong reason until it was anchored with `lastIndexOf`. A pin that passes for the wrong reason is
indistinguishable from a pin that works, right up until the day it matters.

### The fix behind the fix — closing the floor instead of patching three props

Repairing three handlers repairs three handlers. The charge is not about three handlers: it is that
**a tap which found something can be answered more poorly than a tap which found nothing**, and
nothing in the codebase forbade that. Any prop authored tomorrow with a latch and no burst
reproduces it, and the three source-text pins above would pass while it did — they can see that a
handler _contains_ an emit, not that a tap _reaches_ it.

So the repair moved into `interactionController.fire`, which is the one place that already knows a
handler answered nothing:

```ts
function fire(obj, entry, point, clientX, clientY): void {
  const before = audio && !entry.opts.silent ? audio.soundCount() : 0;
  entry.handler({ object: obj, point });
  if (audio && !entry.opts.silent && audio.soundCount() === before) {
    acknowledgeTap(clientX, clientY);
  }
}
```

`fire` used to call `audio.playFallback()` inline and stop. **That inline call was the defect in
miniature**: it gave the audible half of the acknowledgement and not the visible one, so an
unanswered hit came out strictly poorer than a miss — the exact shape being prosecuted. Delegating
to `acknowledgeTap` supplies both halves from one place, for every scene at once, and it recomputes
the ray from the tap's own screen point rather than reusing the last raycast, so the sparkle lands
where the child touched.

### The defect the fix could not reach, and how it hid

The post-fix census moved `lampBase` and `webSlinger` from a second-tap burst of `(none)` to
`sceneSparkle`. **The three room floors did not move**, and that combination should not have been
constructible: the cue and the sparkle are two halves of one function, and `createMissAcknowledgement`
has no branch that returns without emitting. Hearing the cue is evidence the function ran.

Two observations that cannot both be right cannot be adjudicated by more reasoning about them. I had
already reasoned my way to two wrong mechanisms — particle-pool exhaustion, then a delayed handler
sound — and reading `__tapThroughCanvas` disproved the first outright, since it replaces
`particles.emit` with a recorder and therefore no particle is ever created to exhaust a pool. So
`.probe/render/r2-floor.mjs` put the floor and an ordinary latched prop on **one page, in one run**,
with the instrument guard printed first. Identical in all three rooms:

```
=== playroom
  target             bg?  1st sounds                1st emits     2nd sounds                2nd emits
  empty sky (miss)   -    sfx_shared_tap_fallback   sceneSparkle  sfx_shared_tap_fallback   sceneSparkle
  lampBase           no   sfx_shared_star_chime     sceneSparkle  sfx_shared_tap_fallback   sceneSparkle
  floor              yes  sfx_shared_sparkle_burst  sceneSparkle  sfx_shared_tap_fallback   (none)
```

The guard passes, so the acknowledgement is reachable on the page; `lampBase` proves the choke-point
repair works; the floor is the deviation. `grep -rn "tap_fallback"` then found the cause in one line,
in **four** files — all three rooms **and `templates/room-scene/environment.ts`**, so the generator
would have minted it into every room built after it:

```ts
firstTapSoundId: 'sfx_shared_sparkle_burst',
repeatTapSoundId: 'sfx_shared_tap_fallback',
```

**It defeated the controller's safety net by using it.** `fire` detects an unanswered handler by
counting sounds. A handler that plays the acknowledgement chirp _itself_ ticks that counter, so the
controller concluded the prop had answered for itself and **correctly** withheld the sparkle. The
handler bought the cue at the price of the picture.

That mechanism was written down as prose in `prop-reaction-channels.contract.test.mjs` — _"the
handler buys the cue at the price of the picture, which on a muted device is the whole answer"_ —
**before any instance of it was known**. This round found the instance.

Two things make the floor the worst possible host for it. It is registered `background: true` and is
one plane the size of the whole room, so it is **the likeliest thing a child hits**; and soul.md's
Sound World clause makes the visual half load-bearing — _"a muted experience must be fully playable
and emotionally complete"_. On a muted device the room's largest target did nothing at all,
permanently, after one tap.

**Nature is the control that proves this was a deviation and not a house style.** It sets neither
sound id, has always fallen through to the shared acknowledgement, and is the only floor that was
already right.

The repair deletes the **option**, not the three settings, so the template cannot mint it again.

### Evaluating the repair against the charge — measured, four rooms, same instrument

Bar: _no tap that found something may be answered more poorly than a tap that found nothing._

| room        | before                                                | after                     |
| ----------- | ----------------------------------------------------- | ------------------------- |
| playroom    | `lampBase`, `webSlinger`, `floor` — cue, **no burst** | none answered more poorly |
| living-room | `livingRoom_floor` — cue, **no burst**                | none answered more poorly |
| kitchen     | floor (unnamed `Mesh`) — cue, **no burst**            | none answered more poorly |
| nature      | none                                                  | none answered more poorly |

The instrument self-test passed in all four rooms both times, and the "before" column is a **re-run
of the same probe against a temporarily reverted `fire`** in the same session — so this is a
comparison, not a recollection. The floor rows moved only after the `repeatTapSoundId` removal;
the choke-point repair alone could not reach them, which is the finding.

**The verdict rule had to be corrected before it could deliver a verdict.** The probe originally
flagged any second tap carrying `sfx_shared_tap_fallback` as "DEAD". That was sound when the cue
arrived _without_ a picture, and became over-reporting the moment `fire` started supplying both
halves: it printed the same word for a tap that got nothing and a tap that got the full shared
answer. Those are different, and the round's charge is a **comparison** — cue **and** burst is not
_less_ than a miss, it is _equal_ to one. The grading now splits `DEAD` (strictly less; this is the
charge) from `generic` (equal; standing debt). Keeping the harsher label would have scored the
repair against a rule that could no longer distinguish what it repaired.

### What the repair does not fix, on the record

**Five props are now answered exactly as well as empty space, and no better**: `lampBase`,
`webSlinger` and `floor` in the Playroom, `livingRoom_floor`, and the Kitchen floor. That closes the
charge — nothing is _poorer_ than a miss — but soul.md §6 asks for a real answer, not an absence of
insult. The toy cars got `bounce()`; these five have not been given anything of their own.
`bookshelf-items/deskLamp.ts:84` still opens `if (shining) return;`.

**A handler that answers on a DELAY is misread as silent, and the census shows it at scale.** Every
`portal_*` target reads `sfx_shared_tap_fallback,sfx_hub_toybox_open` with no burst: the portal's own
cue arrives _after_ `fire`'s synchronous `soundCount()` check, so the controller judges it silent and
answers for it. The check is a same-tick comparison and cannot be otherwise without changing what
`soundCount` means. This is a **genuine limitation of the repair's premise**, not a rounding error,
and it is the strongest Round 3 candidate.

> **Correction, 2026-07-30, added by Round 4 rather than edited into the paragraph above.** The
> observation is right and the mechanism is wrong. Round 4 read the pre-fix handler at
> `gamePortal.ts:576-580`, and it was three **synchronous** statements —
> `triggerSound('sfx_shared_tap_fallback'); triggerSound('sfx_hub_toybox_open'); nav.launchMiniGame(gameId);`.
> Nothing arrived late. The counter had ticked by **two** before `fire`'s check ran, so the
> controller judged the portal audible and **correctly** withheld its sparkle. The row reads
> `sfx_shared_tap_fallback,sfx_hub_toybox_open` because the handler literally plays the miss cue
> first — not because a delayed cue was missed by a same-tick comparison.
>
> This makes the defect worse rather than better, which is why it is worth correcting in public. The
> paragraph above excused the reading as _"a genuine limitation of the repair's premise"_ and that
> excuse is **withdrawn**: the instrument was not lying, the portal was. A child tapping the door
> into a game was told, in the app's own vocabulary, that they had touched nothing. Round 4 measured
> the visible half of the same charge and found `propHigh = 0` on all five cove portal meshes — not
> small, zero — so the suppression the controller performed was not merely formally correct, it was
> also the whole of the answer.
>
> What survives of the paragraph is its last clause: this **was** the strongest Round 3 candidate,
> and Round 4 is what it became. The wrong mechanism is left standing above because a review that
> quietly repairs its own reasoning cannot be audited, and because the error is instructive — it was
> produced by explaining a measurement from source I had not yet read.

**Every Nature prop answers its first tap with `sfx_shared_tap_fallback`** — meaning not one of them
plays a sound of its own. Nature passes the comparison bar trivially and fails the spirit of it.

**`toybox_creative_root` is the single anomaly** in the census: its first tap uniquely reads
`sfx_hub_toybox_tap,sfx_shared_sparkle_burst`. Unexplained, filed.

> **Resolved, 2026-07-30, by Round 4.** It is not an anomaly. It is **the one site in the census
> doing it correctly**, and it read as strange only because everything it was being compared against
> was broken. `wireToyboxInteractions.ts:104-144` plays a toybox-specific cue and then, on the
> flight's completion, a `sfx_shared_sparkle_burst` — a distinct voice at the tap and an earned
> second cue at the moment the destination is committed to. Every other navigation site in the
> census opened with the miss cue, so the census's modal row was the defect and the outlier was the
> control. That inversion is the reason this sat filed as "unexplained" for a round: I had read the
> shape of the distribution as evidence about the outlier instead of evidence about the mode.
>
> It also supplied Round 4's fix its precedent. The repaired portal is the same two-cue grammar —
> `sfx_shared_star_chime` at the tap, `sfx_shared_sparkle_burst` at the completion of the 0.34 s
> flourish, navigation after it — chosen because a pattern already shipping in this codebase is a
> better argument than a pattern I invented while looking at a failure.

**Two pirate-cove props reproduce the floor's exact mechanism and are outside every pin in this
round.** `cannon/interaction.ts:28` and `shipWheel/interaction.ts:25` both call
`triggerSound('sfx_shared_tap_fallback')` as their own answer, which ticks the sound counter and
suppresses the shared sparkle. The cannon still emits `cannonConfetti` so its visible answer
survives — though its own docblock promises _"a 'pop' sound"_ that the code does not play. **The
ship wheel emits nothing**, so its entire answer is a rotation plus the cue that means "you touched
nothing". The room-scoped pin above cannot see either, because it only walks `house/subplaces`.
Filed as the opening of Round 3.

> **Correction, 2026-07-30, added by Round 3 rather than edited into the paragraph above.** The
> sentence _"**The ship wheel emits nothing**, so its entire answer is a rotation plus the cue that
> means 'you touched nothing'"_ is half wrong, and the wrong half is the half that made the charge
> sound worse. "Emits nothing" is true, and it was read off a recorder that **cannot see a
> rotation**. Round 3 measured the wheel in pixels instead: its reaction peaks at **6.18× the
> sparkle it displaces**, the largest reaction of any prop in the cove. The visible half of this
> charge is refuted. Only the audible half — the cue — survived, and that is what Round 3 repaired.
> The original wording is left standing because it is what was believed when it was written, and a
> review that quietly rewrites its own wrong predictions cannot be checked.

### What is pinned, so this cannot silently regress

**The load-bearing pins are the two runtime ones**, in `tests/framework/tapArbitration.test.mjs`,
which drives the real controller over a stub canvas with a real camera and counts what comes out. The
source-text pins in `tests/room` can only see that `fire` _contains_ a delegation; the four convicted
props all satisfied the `/PARTICLES\.\w+/` assertion **while emitting nothing**, because their emit
sat downstream of a latch's early return.

- _a tap that FOUND a prop is never answered with less than a tap that found nothing_ — asserts the
  cue **and** the ray, and that the ray points at the tap rather than at the last raycast;
- _a LATCHED BACKGROUND surface still gets the shared answer on the tap its latch swallows_ — the
  floor's own shape, and it reaches `fire` through `onPointerUp`'s **third** branch, not its first.

**Four mutations, each killing the intended pin and no other:**

| mutation                                                               | killed                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `fire` restores the inline `audio.playFallback()`                      | both runtime pins; the older cue-only test **survives**, which is what proves they discriminate the _visible_ half |
| `acknowledgeTap(0, 0)` instead of the tap point                        | the ray-recomputation assertion                                                                                    |
| `repeatTapSoundId` re-added to `playroom/environment.ts`               | the config pin **alone**                                                                                           |
| the background branch calls `entry.handler` directly, bypassing `fire` | the background pin **alone**                                                                                       |

And a config pin, `no room routes a REPEAT floor tap to the acknowledgement cue`, which strips
comments before matching — deliberately, because `sceneHelpers.ts` now carries a long note **naming**
the removed option, and a pin that forbade the name outright would force the repair to delete its own
explanation. What must not come back is the option, not the memory of it. It also asserts the floor
handler contains **exactly one** `triggerSound(` call, so the option cannot return under another name,
and that `config.firstTapSoundId` is still reached, so it cannot pass by the first-tap block having
been deleted instead.

Full gate green at the close: Prettier, ESLint `--max-warnings=0`, `tsc -b`, the probe tsconfig,
**395/395 tests**, and `vite build`.

### The ship was not verified until the verifier was, and the verifier was lying

The commit went to the laptop, and the suite there came back **104 files, 72 pass, 32 fail**. The
shape of the failure invited a comfortable reading: the red files were `little-shark`, `pirate-cove`,
`audio`, `math`, `disposal` — almost none of which Round 2 touched. The obvious inference was
"environment problem, not mine," and the obvious next move was to say so and carry on.

That inference would have been **right by accident**, and accepting it would have been a mistake
regardless, because one of the 32 was `tapArbitration.test.mjs` — a file this round wrote.

The actual cause: the loader shells out to esbuild, and esbuild ships a **platform-specific native
binary**. The mounted `node_modules` carried `@esbuild/darwin-arm64`, installed on the user's macOS.
The shell that runs the suite over that mount is **aarch64 Linux**. Every suite that reaches the TS
loader dies at the first `esbuild.transformSync`, before a single assertion in the repo executes.

The partition is exact, and that exactness is the proof:

| suites  | count | reach the TS loader? |
| ------- | ----- | -------------------- |
| failing | 32    | **32 of 32**         |
| passing | 72    | **0 of 72**          |

Not one red suite avoided the loader; not one green suite touched it. No defect in shipped source
can produce a partition that clean — a real regression would cut across the loader boundary, not
trace it exactly.

Two checks then closed it, and the first one **failed as a probe and had to be replaced**, which is
worth recording. Importing `_tsload.mjs` and asserting `1 === 1` **passed** — proving nothing,
because esbuild is invoked lazily and a bare import never reaches it. Only calling `loadTs` on
`src/utils/math.ts` — a file Round 2 never touched, confirmed unmodified against the laptop's own
HEAD — reproduced the identical error. The failure is therefore **content-independent**: it predates
the copy, and no file this round shipped could have caused or cured it.

The instrument was then repaired rather than excused. `@esbuild/linux-arm64@0.27.3` was fetched and
written alongside the darwin build; both can coexist, since esbuild selects by platform at runtime,
so the user's own macOS runs are unaffected. The suite on the laptop then returned **395/395** —
identical to the cloud, which also confirms the two trees agree on test count and not merely on
checksums.

Independently, all 14 tracked files were verified **byte-identical** (SHA-256) between the laptop and
commit `a74f5fd`.

**The apparatus defect, stated plainly: a verification harness that cannot run is indistinguishable
from a verification harness that reports failure, and it is far more dangerous, because it produces
a red result that a tired reader will attribute to the code.** The five probe disciplines already
say _interrogate whether your instrument can even detect the failure you are dismissing_. This round
found the mirror image and it needs its own clause: **interrogate whether your instrument is capable
of producing the failure it is reporting.** A green run proves the code; a red run proves nothing at
all until the harness itself is shown to be alive.

---

## Round 3 — The two props that sound like a miss, in the scene no pin was watching

### The charge, pre-registered before it was measured

Six things in the Pirate Cove answer a tap. Four call a sound of their own: the sea
`sfx_shared_splash`, the sail `sfx_shared_whoosh`, the parrot and the treasure chest
`sfx_shared_chime`. Two — `cannon/interaction.ts:28` and `shipWheel/interaction.ts:25` — call
`sfx_shared_tap_fallback`, which `uiSounds.ts` documents as _"a gentle acknowledgement chirp for
tap-fallback feedback"_: the sound the controller plays **when your finger found nothing**.

Three hypotheses, written into `.probe/render/r3-cove.mjs` before the run, each falsifiable by a
column of its output:

- **H1** — the two props sound _exactly_ like a miss. Predicts the cannon row, the wheel row and the
  empty-sky row are indistinguishable in the `sounds` column.
- **H2** — they also **suppress the shared sparkle**, by the floor's exact mechanism: `fire()` decides
  a handler answered for itself by counting sounds across the call, so a handler that plays the
  acknowledgement cue _itself_ ticks that counter and the controller withholds `acknowledgeTap`.
- **H3** — the cost is unequal, and only the wheel pays it in full: the cannon keeps `cannonConfetti`,
  the wheel emits nothing anywhere in its file.

**The scene is its own control, and that is the whole force of the charge.** Nothing here is the
rooms' standard imported into the cove. It is the cove's own standard, met by four of its six answers
and skipped by two — and the two that skipped it are the cannon and the ship's wheel, which on a
pirate ship are the props that most _look_ like controls, and so are the two a child reaches for
first.

Both files' docblocks already promised otherwise. The cannon's says _"On tap: play a 'pop' sound"_;
the wheel's says _"plays a creaking sound"_. Neither was ever a design decision. Both were unkept
promises, and one of them — `sfx_shared_pop` — had been sitting in the shared catalogue the entire
time.

### Why this is a real defect and not a matter of taste

soul.md §6, _Every Tap Matters_: "A dead tap is a broken promise." A tap that answers with the cue
for **not having found anything** is worse than a dead tap, because it is a tap that lies about its
own outcome. The Promise clause — "Nothing will confuse you" — is failed most sharply on the wheel,
where the eyes and the ears then disagree: the wheel visibly spins while the ears report a miss.

The Sound World clause says a muted experience must be fully playable and emotionally complete. The
inverse case is not covered by anything, and it is the one here: a child _not_ muted, whose eyes are
elsewhere, learns from the cove that the cannon and the sky are the same object.

### The anticipated defence, and why I reject it

_"It is an acknowledgement chirp, not a miss cue — `uiSounds.ts` says so."_ True, and Round 2 already
made this correction to itself. It does not help. A cue that **both** outcomes use cannot distinguish
them, and distinguishing them is the entire job at the moment the child's finger lands. The generic
acknowledgement is the right answer when nothing else answered; it is the wrong answer when a cannon
just fired confetti.

_"The rooms' bar does not apply — this is an immersive scene, not a room."_ This is why the charge was
built as an internal comparison. Four of the cove's own six answers set the bar. The remaining two
fall below it, by the cove's standard, in the cove's own folder.

### The instrument lied first, and it lied in the direction that flattered the code

The first run of `r3-cove.mjs` used NDC `(0, 0.92)` as "empty sky", copied from `r2-floor.mjs` where
it _is_ empty. In the Pirate Cove it lands on **the parrot**, which plays `sfx_shared_chime`. So the
baseline row read `sfx_shared_chime`, and the verdict line dutifully reported `H1
sounds-exactly-like-a-miss = false` for both accused props — **an acquittal, produced entirely by
comparing them against a prop instead of against a miss.**

The guard did not catch it because the guard was `sky.emits.length > 0`, and the parrot's tap does
emit a sparkle. **A guard that only asks "did something happen" cannot tell you whether the right
thing happened** — which is the same lesson this round had just learned from a test harness that
could not run.

The repair was a 98-point grid sweep to find a genuine miss, so the coordinate is not a magic number.
Histogram of what the cove's frame actually contains:

| what a tap at that point plays                                 | points |
| -------------------------------------------------------------- | -----: |
| `sfx_shared_splash` (the sea, most of the frame)               |     53 |
| `sfx_shared_tap_fallback` — **a real miss**                    |     37 |
| `sfx_shared_tap_fallback` + `sfx_hub_toybox_open` (the portal) |      4 |
| `sfx_shared_whoosh` (the sail)                                 |      3 |
| `sfx_shared_chime`                                             |      1 |

That single chime is the parrot. It is a one-in-98 target, and the first run picked it. The guard now
asserts the baseline row **is** a miss rather than merely being eventful.

### The visible half of the charge, measured — and refuted

H3 said the wheel emits nothing, so its answer is poorer than a miss's, since a miss at least gets
`sceneSparkle`. That sentence was one keystroke from being published. It is wrong, and the reason it
is wrong is instrumental: **`__tapThroughCanvas` records particle emits, and the wheel does not emit
— it rotates.** A rotation is a large visible answer that an emit-recorder is constitutionally unable
to see.

So it was measured in pixels instead, in `.probe/render/r3-cove-visible.mjs`, with the refutation
condition written into the file _before_ the run: if `propHigh > sparkleHigh`, the charge on the
visible half is refuted and gets published exactly as loudly as the other outcome.

| target               | propHigh | sparkleHigh |     ratio | emits            |
| -------------------- | -------: | ----------: | --------: | ---------------- |
| `chest_body` (guard) |     2179 |         225 | **9.68×** | `treasureGold`   |
| `wheel_ring`         |     3918 |         634 | **6.18×** | (none)           |
| `cannon_barrel`      |     1247 |         179 | **6.97×** | `cannonConfetti` |
| `parrot_prop`        |      111 |         261 | **0.425** | `sceneSparkle`   |

**The wheel produces the largest reaction of any prop in the cove.** `fire()` withholding the sparkle
is _correct_ for both accused props: each already out-answers the sparkle it displaced, by 6.18× and
6.97×. The charge is narrowed to the audible half, and the withdrawal is written into the shipped
source comment in `shipWheel/interaction.ts` under the heading _"A charge this round made against
this prop and then withdrew."_

`parrot_prop`'s 0.425 is unexplained and is **filed, not fixed** — it is the only row where the prop's
own reaction is smaller than the sparkle, and it emits `sceneSparkle` anyway, so it may be a crop
artefact rather than a defect. It is not this round's charge and it is not being folded into it.

### The fix

**Cannon** — `triggerSound('sfx_shared_pop')`. Nothing had to be authored. The docblock named this
sound, and `sfx_shared_pop` was already registered. `sfx_cannonball_fire` was the other candidate and
was rejected deliberately: it belongs to the cannonball-splash minigame's louder register, and this
cannon's own docblock asks for _"playful, not violent"_.

**Ship wheel** — `triggerSound('sfx_pirate_cove_wheel_creak')`, newly authored in
`assets/audio/pirateCove/index.ts`: a low sine for the axle taking the load, two sines a few Hz apart
so they beat against each other into a squeak, and a dry filtered-noise grain underneath. Nothing in
the shared catalogue creaks. `sfx_shared_whoosh` was the nearest fit and was rejected **twice over** —
the sail already answers with it a few metres away, so the wheel would have spoken in another prop's
voice; and a whoosh is moving air, not wood under load. It is deliberately quieter than the chest's
chime, because the chest is a reward and the wheel is a control being turned.

### Evaluating the fix against the charge — same instrument, both guards passing

```
  target                     role     sounds                       emits
  empty sky (miss)           guard    sfx_shared_tap_fallback      sceneSparkle
  chest_body                 guard    sfx_shared_chime             treasureGold
  cannon_barrel              accused  sfx_shared_pop               cannonConfetti
  wheel_ring                 accused  sfx_pirate_cove_wheel_creak  (none)

  INSTRUMENT: both guards passed -- rows below are interpretable
  cannon_barrel: H1 sounds-exactly-like-a-miss = false | H2 sparkle-suppressed = true
  wheel_ring:    H1 sounds-exactly-like-a-miss = false | H2 sparkle-suppressed = true
```

H1 is now false for both, against a baseline that is a _verified_ miss rather than a parrot. H2 is
still true for both and that is the correct outcome, established by measurement rather than assumed:
both props out-answer the sparkle they displace by more than six times.

**Verdict: the charge is met.** No iteration needed on the repair itself.

### What the fix does not fix, on the record

**`triggerSound(soundId: string)` takes a bare `string`.** So does
`MiniGameContext.audio.playSound`. `AudioProvider` resolves the id against `SFX_REGISTRY` and, on a
miss, warns — but only `if (import.meta.env.DEV)`. **In a shipped build an unknown id is a silent tap
and nothing anywhere reports it.** A one-character typo, or a rename of a registry key, mutes a prop
for good. This is the deeper version of the defect this round repaired and it is now pinned.

**37 of the 51 registered sound ids are never reached by any call site.** Not a defect on its own —
several are reached through the celebration sound map rather than by literal — but it is a large
unexamined surface and it is filed.

**The pin's reach is source text, not runtime.** It grades what a handler _contains_, not what it
_executes_. Round 2 recorded four props satisfying a `/PARTICLES\.\w+/` assertion while emitting
nothing, because the emit sat downstream of a latch's early return. Nothing about that limitation is
repaired here.

### What is pinned, so this cannot silently regress

New suite, `tests/audio/tap-answer-vocabulary.contract.test.mjs`, five tests, all five
mutation-verified.

**Why a new suite when one already existed.** `room/prop-reaction-channels.contract.test.mjs` has
pinned exactly this rule since Round 2. It walks `scenes/world/places/house/subplaces` plus three room
names. The Pirate Cove lives under `scenes/immersive-toybox-scenes`, so it was **never opened**. That
pin is not wrong — it grades a room contract — but **a rule about what a tap may sound like has no
business being scoped to a directory**, because a child does not know which folder a prop was authored
in. The new suite is the same rule, unscoped: all 552 shipped `.ts`/`.tsx` files.

- _no successful tap anywhere answers with the cue that means "you touched nothing"_ — three sites are
  allowlisted, each with its reason: `worldTapDispatcher.ts` (the original caller — this _is_ the miss
  path), `gamePortal.ts` (allowed **only** because the chirp is paired with `sfx_hub_toybox_open`, and
  the comment above it records a rival helper being deleted precisely for playing the chirp alone),
  and `star-catcher/rules/scoring.ts` (the enclosing function is literally `applyMissTap`).
- _every allowlisted use still exists and still has its reason_ — an allowlist nobody checks is a list
  of rules that quietly stopped applying. Deleting gamePortal's pairing fails **this** test while the
  test above it passes, which is the point: an allowlist entry has to be able to expire.
- _every sound id a call site names is registered_ — the regression guard for the `bare string`
  problem above.
- _the repaired props still say what their docblocks promise_ — the narrow half. The pins above would
  accept any non-miss cue; these two files each promised a _particular_ one in prose, and the round's
  argument was that the prose was right and the code was wrong.
- _the literal scanner finds the call sites it claims to grade_ — counts pinned by value, so adding an
  unscanned call site fails too.

**Every one was killed by mutation before being trusted**, and one of them earned its keep before it
was ever committed: the site count was first written as 47, hand-summed from a `grep` over `.ts`
files. The first run reported **52**. The five it had missed were in `.tsx` — the transition whooshes
in `SceneFrame.tsx` and the button presses in `UIOverlay.tsx`. The scanner was right where the grep
that "confirmed" it was wrong.

The mutation that matters most is the typo: renaming the wheel's id to `sfx_pirate_cove_wheel_creek`
(creek/creak) failed the registry test — and **three of the other four tests passed during that run**.
A typo'd sound id breaks nothing that a grep, a compiler, or any other suite in this repository can
see.

Suite total: **400/400**, up from 395.

---

## Round 4 — The door into the game, and the tap that answered it with nothing

### The charge, pre-registered before it was measured

The pre-registration is `.probe/render/r4-portal.mjs`, written and committed to disk before
the probe was run once. Its hypotheses, their refutation conditions, and the three bars a fix
would have to clear are in its docblock, and none of them were edited afterwards.

A game portal is the highest-stakes tap in this application. Every other tap is an ornament:
the cannon pops, the parrot squawks, the kettle rocks, and if any of them answers poorly the
child stays exactly where they were. A portal is the door. `naturescene/environment.ts:68`
says so in the scene's own words — the four portals are the only things in that scene a child
can tap to start a game — and the whole of vision.md's Promise is spent on the moment it is used.

`minigames/framework/gamePortal.ts:576-580` was that moment, entire:

```ts
const launchGame = () => {
  triggerSound("sfx_shared_tap_fallback");
  triggerSound("sfx_hub_toybox_open");
  nav.launchMiniGame(gameId);
};
```

Three statements, all synchronous. No tween, no burst, no flash, no latch. The charge had two
halves. **Visibly**, nothing in the portal moves because it was touched, so on a muted device
the door into a game is indistinguishable from a tap on empty air. **Audibly**, the first cue
a child hears on that tap is `sfx_shared_tap_fallback` — the cue for a tap that found nothing —
and the second is `sfx_hub_toybox_open`, whose own docblock at `hub/hubSfx.ts:39-54` calls it a
"creaky wooden thunk", fired at the instant of the tap by a glowing pedestal that has no hinge
and does not open.

### This round opened by putting Round 3's own product on trial

Round 3 allowlisted `gamePortal.ts` in `tests/audio/tap-answer-vocabulary.contract.test.mjs`,
on the reasoning that the portal "is not answering with the miss cue; it is answering with the
toybox opening and chirping underneath it." That was an argument from reading two adjacent
lines, granted by me one round ago, in the round whose whole subject was props answering with
the miss's cue. If the charge held, the entry was to be **deleted along with the line it
excused**, not re-argued. It has been.

### A hypothesis I formed and refuted before it reached the probe

I suspected that launching a game would stack `sfx_shared_transition_whoosh` on top of the two
cues, making three simultaneous sounds, and I was about to write that into the charge.
`SceneFrame.tsx:154,193` keys both transition cues on `currentScene`; `SceneRouter.tsx:104-108`
shows `launchMiniGame` calling only `setActiveMiniGame`, `gameRef.current = gameId` and
`writeHash(...)` — it never touches `currentScene` and never sets `isTransitioning`, unlike
`navigateTo`, which does both plus a 600 ms timer. **There is no transition whoosh on a game
launch.** The hypothesis was dropped before it was published rather than after.

It turned out to be evidence for the charge rather than against it, from the other side: a
game launch is the one navigation in this application that departs with no departure cue at all.

### Why this is a real defect and not a matter of taste

Because the application is its own control, and an unusually good one. There is exactly one
other affordance in this codebase shaped _tap a thing → it opens → it takes you somewhere_, and
it is the toybox. `toyboxes/framework/wireToyboxInteractions.ts:104-144` does it like this: latch
against a double-tap; play `tapSoundId` immediately; fly the owl to the lid; run the open
animation; pulse the box out and back; and only in the innermost `onComplete` play `openSoundId`
and navigate. `framework/defaults.ts:6-7` sets those to `sfx_hub_toybox_tap` and
`sfx_hub_toybox_open`. The toybox has a tap voice of its own, a visible opening, and an open cue
that arrives **when the thing opens**.

Against that control the portal substituted the miss cue where the toybox has a voice, fired the
toybox's opening sound at the instant of the tap with no opening to hear, and had no latch. This
is not a preference between two defensible designs. It is the same job, done three ways worse,
twenty files away, on the tap that matters most.

soul.md §6 is the clause: _"A dead tap is a broken promise."_ The Sound World clause is why the
visible half is the load-bearing one: _"A muted experience must be fully playable and emotionally
complete."_

### The anticipated defence, and why I reject it

The strongest defence was already written into the repository, at
`interactionController.ts:343-351`, and it has two limbs. First, that `sfx_shared_tap_fallback`
is not the miss's private cue — `uiSounds.ts` calls it "a gentle acknowledgement chirp for
tap-fallback feedback", the generic acknowledgement, which the miss merely also uses. Second,
that "the two events are the same event as the child experiences it: in both cases there was
nothing more here."

**The first limb stands and I accept it.** The second is false at a portal by construction:
there is a whole game here. That is precisely what makes the portal the one site in the
application where the shared chirp cannot be the answer, and it is why this round's charge is
narrower than Round 3's. Round 3 charged two props with sounding _identical to a miss_. That
charge would fail here, because the second cue is loud and unmistakable. The charge that
survives is narrower and worse: the **first** thing heard on the most important tap in the app
is the cue for a tap that found nothing.

### The apparatus defect this round found, before it could grade anything

Run 1 threw. The audible half returned immediately and cleanly, the scan printed nine rows, and
then `__reactionScan` raised _"1 navigation call(s) of 6 were not attributed to the row that
caused them"_ — which reads as a tap-to-navigate chain outliving the quiescence budget, and was
nothing of the kind.

The cause was the probe, not the application. The probe taps a real portal through the canvas
with `__tapThroughCanvas` to read the controller's cue and sparkle, and that is a **real tap**:
it called `nav.launchMiniGame` and left a permanent entry in the harness's recorder. The
attribution guard then compared its per-row tally against the **lifetime** nav count and charged
the scan with a call made before the scan began. The guard was right to fire on the discrepancy
and wrong about its cause: it was measuring a total where it meant a delta.

**Apparatus defect (xiv): a lifetime-count assertion inside a routine meant to compose with the
other hooks.** Fixed in `room.ts` by taking a baseline at scan start and comparing the delta.
Nothing about how a row is _measured_ changed, and the proof of that is on the record rather
than asserted: run 1's nine rows and run 2's nine rows agree to the pixel on every prop row
(`parrot_prop` 127, `cannon_barrel` 1247, `chest_body` 2179, `wheel_ring` 3918, and 0 for all
five portal meshes), differing only in the miss column, which resamples a stochastic burst.

### The hazard that could have produced a false PASS, and why it did not

Every previous round's hazard was an instrument that under-reports a reaction. This round's was
the inverse, and it deserved naming before the run rather than after. A portal is the only prop
in these scenes that **animates while idle**: `gamePortal.ts:546-560` runs a `repeat: -1` bob on
`icon.position` and a `repeat: -1` spin on `icon.rotation`. A pixel-difference instrument
sampling a crop over 1.5 s would see that motion whether or not the tap did anything, and would
report a healthy `propHigh` for a handler that does nothing at all — **a false pass**.

`__reactionScan` is safe from it only because it calls `__freezeIdles()` at `room.ts:1693`
_before_ firing, so the freeze is taken before the tween the tap would create, and the tap's own
tween is then the only thing still moving. That is checked rather than trusted: the probe prints
`ambientInMask` beside `propHigh` on every row.

### The measurement

Pirate Cove, `__reactionScan(1.5, 0.15)`, the same call as Round 3 so the rows are comparable,
with Round 3's own three props carried as the guard:

| target                              | propHigh | sparkleHigh | ratio                          |
| ----------------------------------- | -------- | ----------- | ------------------------------ |
| `chest_body` (control)              | 2179     | 207         | **10.53×** — Round 3 saw 9.68× |
| `cannon_barrel` (control)           | 1247     | 200         | **6.24×** — Round 3 saw 6.97×  |
| `wheel_ring` (control)              | 3918     | 593         | **6.61×** — Round 3 saw 6.18×  |
| `portal_cannonball-splash_pedestal` | **0**    | 132         | **0.000**                      |
| `portal_cannonball-splash_ball`     | **0**    | 299         | **0.000**                      |
| `portal_cannonball-splash_drop0`    | **0**    | 230         | **0.000**                      |
| `portal_cannonball-splash_drop1`    | **0**    | 279         | **0.000**                      |
| `portal_cannonball-splash_drop2`    | **0**    | 2           | **0.000**                      |

The three guards reproduced, so the instrument had not drifted and the rows are readable. In the
same run, on the same clock, with the same freeze, the portal scored **zero**. Not small — no
change to the picture whatsoever, at or below the ambient floor, which is to say literally
indistinguishable from doing nothing.

`__tapThroughCanvas` on the portal returned exactly `[sfx_shared_tap_fallback,
sfx_hub_toybox_open]` and **no particles**, against a miss baseline verified positively in the
same scene (miss cue _and_ a sparkle, searched for rather than quoted from Round 3's hard-coded
coordinates). So the second half of the audible charge also holds, and with it the mechanism:
`sceneHelpers.ts:245-253` describes it in the repository's own words — a handler that makes
sound ticks the counter `fire` uses to decide whether the prop answered for itself, so the
controller concludes the prop answered and correctly withholds the shared sparkle. The portal
bought two cues at the price of the picture, and one of the two cues was the miss's.

**H1 stands. H2 stands. H3 stands. H4 — the guard — passed.**

### Nature, four more instances, so the defect is a function and not an anecdote

The audible half was read at all four of Nature's portals before the fix, and all four
returned the same first cue. One of the four rows was very nearly published as a
refutation of my own hypothesis H2, and it is worth recording why it was not.

`portal_bubble-pop` came back answering with `sfx_shared_tap_fallback` **alone**, plus a
`sceneSparkle` — which reads exactly like "the controller supplied its acknowledgement
after all, H2 refuted". It is nothing of the kind. A bare miss cue accompanied by a
sparkle is the **signature of a tap that hit nothing**: the aim point taken from
`__propTargets` was occluded or off-prop, so the ray never reached the portal, and a row
is only evidence about a portal if the portal fired. The probe's refutation condition as
written — "refuted if a tap at a portal returns any emit" — was under-specified, and it
was under-specified in the direction that would have let me _drop_ a charge I had already
convinced myself of, which is the dangerous direction. The evaluation probe now aims at
each of a portal's pick meshes in turn and keeps the first aim that actually fired,
labelling any portal it never reached rather than scoring it.

### The fix

`gamePortal.ts` now does what the toybox does, in a portal's own vocabulary rather than a
toybox's, and with the latch the toybox has and the portal did not:

```ts
let launching = false;
const launchGame = () => {
  if (launching) return;
  launching = true;
  triggerSound("sfx_shared_star_chime");
  // flare the pedestal, swell the whole portal, settle it back
  gsap.to(pedestalMat, {
    emissiveIntensity: flareFrom + 1.6,
    duration: 0.14,
    ease: "power2.out",
  });
  gsap.to(root.scale, {
    x: 1.22,
    y: 1.22,
    z: 1.22,
    duration: 0.14,
    ease: "back.out(2.6)",
    onComplete: () => {
      gsap.to(root.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          triggerSound("sfx_shared_sparkle_burst");
          nav.launchMiniGame(gameId); /* reset, unlatch */
        },
      });
    },
  });
};
```

Four choices in it are worth defending, because three of them were nearly made differently.

**The tap voice is `sfx_shared_star_chime`, not `sfx_hub_toybox_tap`.** Copying the
toybox's tap cue was the obvious move and it is wrong for the same reason the borrowed
open cue was: `playSfxHubToyboxTap` is a filtered noise burst at 800/900 Hz with a 400 Hz
sine under it — a knock on wood. A portal is a glowing pedestal. `sfx_shared_star_chime`
is a triangle-wave bell drawn from a C major triad so it harmonises with whatever bed is
playing, and it is not a fresh invention either: it is what a lamp plays when it lights up
(`floorLamp.ts:61`, `deskLamp.ts:97`) and what Star Catcher twinkles with. A glowing thing
brightening under a hand is already speaking it.

**The launch cue is `sfx_shared_sparkle_burst`, and it is placed where the toybox places
its open cue** — in the innermost `onComplete`, on the same tick as the navigation it
announces. It is the application's established "something wonderful just happened" voice
(`CelebrationSystem.ts:125`, the rooms' `firstTapSoundId`, the toybox's own reveal), it
cascades **upward** through a pentatonic pool, and it is earned by a swell the child
watched rather than fired at a tap with nothing having happened.

**`sfx_shared_transition_whoosh` was considered and rejected**, which matters because the
research had made a case for it: a game launch is the one navigation in this application
with no departure cue, and the whoosh is the app's own word for departing. It was rejected
because the whoosh sweeps **downward** (400→100 Hz, 2000→200 Hz bandpass) and exists as
half of a pair — `SceneFrame.tsx` plays it on leaving and `sfx_shared_transition_arrive` on
landing. A game launch has no arrival counterpart, so adopting the whoosh alone would have
imported half a grammar and left the other half missing. That is a real inconsistency and
it is filed below rather than papered over.

**Scale is taken on `root` and emissive on the pedestal, deliberately.** The idle bob and
spin own `icon.position` and `icon.rotation` and are `repeat: -1`; animating those would
have been a tween fighting a tween forever. `dispose` kills all four now, because a finite
tween taken in the frame before a teardown is a smaller version of the same leak the two
infinite ones were already killed for.

### Evaluating the fix against the charge — same instrument, both scenes, guard passing

The Pirate Cove was re-run **unfiltered**, so one scene is graded whole against Round 3's
published numbers:

| target                  | before | after    | displaced sparkle | ratio                     |
| ----------------------- | ------ | -------- | ----------------- | ------------------------- |
| `chest_body` (guard)    | 2179   | 2179     | 227               | 9.60× — Round 3 saw 9.68× |
| `cannon_barrel` (guard) | 1247   | 1247     | 189               | 6.60× — Round 3 saw 6.97× |
| `wheel_ring` (guard)    | 3918   | 3920     | 588               | 6.67× — Round 3 saw 6.18× |
| `portal_..._pedestal`   | **0**  | **4672** | 93                | **50.24×**                |
| `portal_..._ball`       | **0**  | **4790** | 282               | **16.99×**                |
| `portal_..._drop0`      | **0**  | **4758** | 287               | **16.58×**                |
| `portal_..._drop1`      | **0**  | **4682** | 207               | **22.62×**                |
| `portal_..._drop2`      | **0**  | **4767** | 231               | **20.64×**                |

Nature, four portals, the round's second scene:

| target                         | after | displaced sparkle | ratio  |
| ------------------------------ | ----- | ----------------- | ------ |
| `portal_bubble-pop_pedestal`   | 9255  | 690               | 13.41× |
| `portal_little-shark_pedestal` | 8863  | 317               | 27.96× |
| `portal_fireflies_pedestal`    | 17985 | 395               | 45.53× |
| `portal_star-catcher_pedestal` | 18845 | 404               | 46.65× |

Against the bars as written, and they were not moved:

- **(a) `propHigh > sparkleHigh` on every portal row** — passes on all nine rows, at
  13× to 50×. The three unrelated guard props reproduced Round 3's ratios in the same
  run, so the instrument had not drifted and the comparison is real. The portal now
  out-draws every other prop in the Pirate Cove.
- **(b) the first cue must not be the miss cue** — passes at all five portals across
  both scenes; the first cue is `sfx_shared_star_chime`.
- **(c) it must survive a muted device** — this is bar (a), which is why bar (a) was
  declared load-bearing in advance. The answer a muted child gets went from **literally
  nothing** to the largest visible reaction in its scene.

The controller still withholds its shared sparkle at a portal, because the handler still
makes sound and `fire` still counts sounds. That is now the **correct** trade rather than
a loss — `sceneHelpers.ts:245-253` describes the bargain, and Round 4's whole complaint
was that the portal was paying the price of the picture and getting the miss's chirp in
exchange. It is now paying that price for a swell 20× the size of the sparkle it declined.

### The probe defect the fix created, and what it caught

Run 1 of the evaluation probe came back with `parrot_prop ... nav=launchMiniGame:cannonball-splash`.
The parrot does not launch a game. It was simply the row being measured when somebody
else's `onComplete` landed — because **the fix itself** converted a synchronous launch
into a deferred one, so the probe's own pre-scan canvas taps left a launch in flight that
resolved inside the scan.

Two things are worth taking from that. First, the harness's attribution guard caught it,
one round after that same guard was repaired for over-firing, which is the better outcome
than a guard that had been loosened into silence. Second, it is a general rule and it is
written into the probe: **any probe that taps a deferred-navigation prop and then measures
something else owes a drain.** A probe that had only asked "do the numbers look plausible"
would have shipped a nav column attributing a game launch to a parrot.

### What the fix does not fix, on the record

- **A game launch is still the only navigation in this application with no departure
  cue.** `SceneRouter.launchMiniGame` never touches `currentScene`, so `SceneFrame`'s
  whoosh/arrive pair never runs; the portal now announces itself, but the _journey_ is
  still silent where every scene change is not. Adopting the whoosh alone would import
  half a pair, so the honest fix is a launch pair, and that is a round of its own.
- **`ambientInMask` at the portal rows rose from 0 before the fix to 350–3617 after.**
  This is unexplained and is recorded rather than explained away. The comparison the bars
  turn on is unaffected — `propHigh` beats `ambientInMask` by 5× to 11× on every row, and
  the pre-fix `propHigh = 0` against a _frozen_ crop is what convicted the old handler —
  but "the ambient column moved when the handler changed" is a loose thread in the
  instrument, not in the application, and it should be pulled before the ambient column
  is used as a bar in its own right.
- **The idle-animated false-pass hazard is now live in a way it was not before.** Before
  the fix a portal had nothing to confuse with its idle motion; now it has a swell. The
  freeze at `room.ts:1693` is what separates them, and every future portal measurement
  depends on it being taken before the tap rather than after.
- **The five portals were graded at one pick mesh each in Nature.** The cove's five
  meshes were graded individually and agree to within 3%, so the handler is plainly not
  mesh-dependent, but this run cannot show that the portals are the worst props in
  Nature — only the cove was scanned whole.

### What is pinned, so this cannot silently regress

Two new tests in `tests/audio/tap-answer-vocabulary.contract.test.mjs`, and one deletion.

**The deletion is the important one.** Round 3's `gamePortal.ts` allowlist entry is gone,
along with the line it excused. It was not re-argued and it was not narrowed. Removing it
means the existing Round 3 pin — _no successful tap anywhere answers with the cue that
means "you touched nothing"_ — now covers the portal like everything else.

- _the game portal answers in its own voice, and its launch cue is earned rather than
  fired at the tap_ — asserts the tap cue precedes the launch cue, the launch cue
  precedes the navigation, a `gsap.to` and an `onComplete` sit between the tap and the
  launch, and the latch exists. This is a **source-text pin**, which is apparatus defect
  (xi): it can prove a file contains a line, never that a running body reaches it. The
  runtime evidence is the table above. What this pin is actually for is the one way the
  defect returns — somebody "simplifying" the chain back into three synchronous
  statements, which is precisely the shape the deleted allowlist entry used to bless.
- _the portal flourish cannot outlive the scene that owns it_ — all four tweened targets
  must be killed in `dispose`.

**Four mutations, all killed, and three of them informative about what the OTHER tests
cannot see.** Collapsing the chain back to three synchronous statements — keeping both new
sounds, so the vocabulary tests have nothing to object to — passed tests 1–5 and 7 and
failed only the new test 6. Restoring `triggerSound('sfx_shared_tap_fallback')` failed
tests 1, 2 and 6 together, test 1 because the site count is pinned by value and went 52→53.
Deleting `gsap.killTweensOf(root.scale)` from `dispose` failed only test 7. Removing the
latch failed only test 6.

Suite total: **402/402**, up from 400.

---

## Round 5 — The scene whose only sound was the sound for failure

### The charge, pre-registered before it was measured

`.probe/render/r5-nature-voice.mjs` was written and committed before any number existed, because
four rounds have now produced two published refutations of my own charges and both were only
survivable because the bars were fixed in advance.

The Nature scene has eight interactive props, and they are among the best-authored tap reactions
in the app. Tap a mushroom and it squashes, stretches and glows. Tap a flower and its petals
stagger open. Tap a leaf and it **flips over to reveal a ladybug**, which then crawls away.

Every one of those was answered, audibly, with `sfx_shared_tap_fallback` — the cue
`interactionController.acknowledgeTap` plays for a tap that hit **nothing**.

The source half was flatly countable and needed no instrument: **zero** calls to `triggerSound`
anywhere under `naturescene/`, against twelve under `pirate-cove/`. The runtime half is the table
below.

### Why this is a real defect and not a matter of taste

soul.md §6, _Every Tap Matters_: "A dead tap is a broken promise." soul.md, _The Promise_:
"Nothing will confuse you." A child taps a leaf, watches a ladybug walk out from under it, and
hears the noise the app uses to mean _there was nothing there_. The same app is telling them two
contradictory things about the same event at the same moment, and the one they can hear is the
one that is wrong.

vision.md's _Sound World_ requires that a muted experience be fully playable and emotionally
complete. That clause is sometimes read as licence to under-invest in audio. It says the opposite
of what this scene did: it asks that sound be **redundant with** the picture, not **contradictory
to** it.

### The aggravating fact, which is why this is the round

The sounds already existed. `assets/audio/nature/index.ts` defined four one-shot effects and
`assets/audio/index.ts` registered all four:

| id                             | described as                    | call sites before Round 5 |
| ------------------------------ | ------------------------------- | ------------------------- |
| `sfx_nature_mushroom_bounce`   | springy, rubbery bounce (boing) | **0**                     |
| `sfx_nature_leaf_flip`         | papery leaf flip                | **0**                     |
| `sfx_nature_stream_splash`     | gentle stream splash            | **0**                     |
| `sfx_nature_butterfly_flutter` | airy wingbeat flutter           | **0**                     |

They are named after the exact props that exist, and they are not sketches. The mushroom boing is
a 600→200 Hz sine sweep **with a second, softer re-trigger at +0.15 s** — a sound written for a
two-stage squash-and-stretch. The mushroom's animation is exactly two stages: `BOUNCE_WIDE_FRAME =
8`, `BOUNCE_TALL_FRAME = 16`, `BOUNCE_RESET_FRAME = 24`. Somebody designed the picture and the
sound together, against the same curve, and then the wire between them was never run.

Correcting a number carried in from an earlier round: `SFX_REGISTRY` held **45** ids, of which
**11** were unreached — not the "37 of 51" an earlier summary asserted. Four of the eleven were
Nature's, and Nature was the only scene in the app where **100%** of its bespoke sounds were
stranded.

### The anticipated defence, and why I reject it

This round has a real defendant, not a straw man, and the defence is written into the codebase in
so many words. `utils/worldTapDispatcher.ts:36-44` carries a docblock from an **earlier round**
that already states the finding:

> not one of the Nature scene's ~51 registered tap targets plays any sound, so a child taps a
> mushroom, watches it bounce, and hears silence.

So the fallback is not an oversight. It is a **deliberate prior fix** — a choke-point repair that
closed a scene-wide hole without touching a single prop, and the round that shipped it was right
to. The defence is therefore: this was already found, already fixed, and Round 5 is relitigating
settled work.

I reject it on one narrow ground. The choke-point fix was **correct as a floor and wrong as an
answer**. It gave all eight props the _same_ cue, and the cue it gave them is the one that means
_you touched nothing_. A floor that says "at least make a noise" is worth having; a floor that
says "make the noise for failure" converts a silence into a false statement. Silence is
ambiguous — a child can read it as the app being quiet. `sfx_shared_tap_fallback` is not
ambiguous: it is a specific, learned signal, and by the time a child has played for ten minutes
they have learned it means _nothing there_. The prior round upgraded a gap into a contradiction.

There is a second, sharper reason it cannot stand. The four bespoke sounds were **already
written** when the choke-point fix shipped. The floor was installed over the top of the real
answer without anyone noticing the real answer was sitting in the next directory.

### The apparatus lied first, and it lied in the direction that flattered the code

Run 1 of the voice probe printed **`H2 REFUTED`** — that is, it declared my charge false — and it
was wrong.

Its predicate for "this tap hit nothing" was: exactly one sound, that sound is the miss cue, and a
sparkle was emitted. That is a true description of a genuine miss. It is **also** a true
description of every voiceless Nature prop, which is precisely the finding. The exclusion
criterion and the charge were the same predicate — apparatus defect (iii) recurring, four rounds
after it was first written down. The run discarded 34 of its 35 rows as misses and graded the
survivor.

It was repaired by adding **positive identification** rather than by patching the predicate:
`__tapThroughCanvas` now wraps every live-registry handler for the duration of the tap and returns
`hit: string | null`, so `hit === null` means the controller picked nothing and can mean nothing
else, and a non-null `hit` that is not the aimed-at prop is an **aim artefact** rather than
evidence. That is registered below as **(xv)**.

Run 2, with positive identification, reported `gradeable rows: 34 of 35 (0 real misses, 1 aim
drift)`, `rows whose FIRST cue is the miss cue: 34 of 34`, `rows that produced ANY non-miss cue: 0
of 34` — **`H2 CONFIRMED`**.

### The mechanism that shaped the fix, found before it could be walked into

Three findings during reconnaissance changed the fix's design, and each of them would have
produced a defective repair if assumed instead of read.

**One: `fire` withholds the sparkle from anything that speaks.**

```ts
const before = audio && !entry.opts.silent ? audio.soundCount() : 0;
entry.handler({ object: obj, point });
if (audio && !entry.opts.silent && audio.soundCount() === before)
  acknowledgeTap(clientX, clientY);
```

This is correct and deliberate — a handler that answered for itself should not also get the
generic acknowledgement. But it means **every prop that gains a voice loses the shared sparkle**,
so a repair that only added sounds could silently subtract pictures. That is what bar (b) exists
for.

**Two: the reveal props pay off on a delay.** `createRevealInteraction` spawns its creature inside
`playAnimation(...).onEnd`, hundreds of milliseconds after the tap. A single tap-time cue would
have announced a creature that does not exist yet — **Round 4's exact crime**, re-committed inside
the round that cites it. Hence two fields, `tapSoundId` and `revealSoundId`, on two different
frames.

**Three: the flowers did not need a new sound.** `sfx_shared_sparkle_burst` is four tones from a
C-pentatonic pool, staggered 50 ms apart, always cascading upward. The bloom staggers its petals
the same way — `BLOOM_FRAME_BASE + i * BLOOM_FRAME_STAGGER`. Same structure, n discrete events
each later and higher than the last. Writing a fifth synth there would have been craftsmanship for
its own sake.

### The three bars, fixed in advance

**(a)** Every interactive Nature prop's **first** cue on a real canvas tap is not
`sfx_shared_tap_fallback`.
**(b)** The prop's **visible** answer must not regress — re-measured in **pixels**, still clearing
`propHigh > sparkleHigh`.
**(c)** The sound must be the sound written **for that prop** where one exists. Wiring
`sfx_shared_pop` to all eight would clear (a) and (b) and be a worse app.

### The fix

All eight props given a voice, and every choice argued in place at the call site.

| prop      | cue                                                  | authored?                | the alternative, and why it was refused                                                                                                                                                                                                |
| --------- | ---------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mushroom  | `sfx_nature_mushroom_bounce`                         | existed, stranded        | —                                                                                                                                                                                                                                      |
| leaf      | `sfx_nature_leaf_flip` + `sfx_shared_critter_scurry` | existed, stranded        | —                                                                                                                                                                                                                                      |
| stream    | `sfx_nature_stream_splash`                           | existed, stranded        | —                                                                                                                                                                                                                                      |
| butterfly | `sfx_nature_butterfly_flutter`                       | existed, stranded        | —                                                                                                                                                                                                                                      |
| flower    | `sfx_shared_sparkle_burst`                           | **shared, deliberately** | nothing refused; the shared cue is structurally right (see above)                                                                                                                                                                      |
| stone     | `sfx_nature_stone_shift`                             | **new**                  | `sfx_shared_chomp` is the shared celebration cue for **eating**; a stone that says "chomp" in the source is a trap for the next reader. `sfx_shared_pop` refused because stones do not chirp.                                          |
| log       | `sfx_nature_log_knock`                               | **new**                  | `sfx_hub_toybox_tap` is a close enough knock — refused **on identity, not timbre**. It is a named prop's voice and it is in use. A child who taps the toybox and the log and hears the same thing has been taught the log is a toybox. |
| firefly   | `sfx_nature_firefly_twinkle`                         | **new**                  | `sfx_shared_chime` is a near-twin of `sfx_shared_star_chime`, and that is the voice Round 4 gave the **game portals**. A firefly that sounds like the door into a minigame is exactly the confusion The Promise forbids.               |

The firefly cue is deliberately the quietest in the bank (peak 0.07, octave 0.02). There are
fourteen fireflies and they drift within reach of one another, so it is the one prop a child can
plausibly fire five times in two seconds; at normal level it would have stacked into noise.

**One rename, gated on a proof rather than an assumption.** The leaf's ladybug and the stone's grub
both needed "small creature feet", and a function for it already existed as
`playSfxHubAmbientScurry` / `sfx_hub_ambient_scurry` — called, in its whole life, zero times.
Leaving a `hub_` prefix on a cue whose only two callers are in the forest would have planted
exactly the kind of misleading source this review keeps finding. It was safe to rename because it
was **provably** unreferenced: a grep across `.ts`, `.tsx`, `.mjs` and `.md` returned the registry
line and nothing else. It moved to `shared/critterSounds.ts` as `sfx_shared_critter_scurry`, with
its body byte-identical and a comment recording that it was deliberately **not** retuned in the
same commit that gave it its first callers. `sfx_hub_ambient_hop` remains stranded and was
deliberately left alone.

Both reveal props share that one scurry on purpose: the forest should say the same thing whenever
a small thing runs out from under something, and a rule is worth more here than two separately
clever choices.

### Evaluating the fix against bar (a) — measured, same instrument

`.probe/render/r5-nature-voice.mjs`, post-fix:

```
  gradeable rows: 34 of 35 (0 real misses, 1 aim drift)
  distinct props reached: mush_cap, flower_center, leaf_cover, stone_cover, bfly_body, firefly
  rows whose FIRST cue is the miss cue: 0 of 34      (was 34 of 34)
  rows that produced ANY non-miss cue:  34 of 34     (was 0 of 34)
```

The probe printed `H2 REFUTED`, and that is the correct and intended reading rather than an
embarrassment: **H2 was the charge**, the fix landed, so the charge is now false. A probe whose
verdict flips when the defect is repaired is a probe that works.

### Two props the census structurally could not reach, and the round nearly claimed them anyway

The run above grades six distinct props, not eight. Left there, Round 5 would have claimed eight
props on six props' worth of evidence. Both gaps are instrument defects and both are registered.

**(xvi)** The `log` row aimed at the log's centroid and hit `portal_bubble-pop_b`, which sits in
front of it. Both runs produced the identical drift, so this is geometry, not noise. The pass
correctly refused to grade the row — but **"ungraded" was silently doing duty for "untested"**, and
the log is one of the three props this round authored a new synth for.

**(xvii)** The census filters out `background: true`, which is right for every purpose it was built
for and wrong for this one. The stream is marked background precisely so raycasts read **past** it
to the leaves staged underneath, so it is excluded by construction — but it has a tap handler and a
voice, and "excluded from the census" must not read as "has no answer".

A dated addendum was **appended** to the probe rather than edited into it; nothing above its line
was touched. It rings out from each centroid until an aim positively lands on the prop, and reports
`UNREACHABLE` as an honest third answer rather than as a pass:

```
  log                  reached at centroid+(0.02, 0.00) — sounds=[sfx_nature_log_knock] emits=[sceneSparkle]
  stream               reached at centroid+(0.00, 0.15) — sounds=[sfx_nature_stream_splash] emits=[waterRipple]

  BAR (a), WHOLE SCENE: 0 of 36 graded rows still answer a real tap with the miss cue,
  across 8 distinct props.
```

**Bar (a) cleared, all eight props, 0 of 36.**

### I named the wrong prop as the risk, and the measurement said so

The pre-registration named the **butterfly** as the round's single highest bar-(b) exposure, on the
stated ground that it "emits no particles of its own: its whole visible answer is the flee". Its
docblock said so in the committed source before any number existed.

That premise was false. `butterflies/animation.ts` hands
`particleFn: (s, p) => emit(PARTICLES.sceneSparkle, p)` to the idle-interruptible, and
`fleeHandle.trigger()` fires it. All four `bfly_body` rows in the voice run emit `sceneSparkle`.
Nothing was traded away there at all.

The error is an ordinary and repeatable one, and it is recorded rather than quietly deleted: **I
named the at-risk prop from reading the file I was editing, and the risk lived in the sibling file
I had not opened.** The docblock has been corrected in place to state the overturn.

The props actually at risk are the **leaf** and the **stone** — the two `createRevealInteraction`
props, whose own particles are deferred into `onEnd` and which are consequently the only two graded
rows in the voice run reading `emits (none)` at tap time. They are what bar (b) measures.

### Evaluating the fix against bar (b) — measured in pixels

The bar, as pre-registered and quoted in the butterfly's own committed docblock before any number
existed:

> (b) The prop's VISIBLE answer must not regress. Round 3 nearly shipped a fix that bought a cue at
> the price of the picture: a handler that plays any sound ticks `fire`'s counter and the controller
> then correctly withholds its shared sparkle. So every prop that gains a voice must be re-measured
> in PIXELS, and must still clear `propHigh > sparkleHigh`.

**It failed.** `.probe/render/r5-nature-picture.mjs`, run against the fixed scene:

```
  rows measured: 15 (expected 4)
  rows clearing propHigh > sparkleHigh: 6 of 15
  BAR (b) FAILED for mush_cap ×5, leaf_cover, stone_cover, bfly_body ×2
```

That output is printed above the addendum in the probe file and is left there, unedited, because the
standing rule is that a pre-registered failure is published as loudly as a confirmation and a probe's
stated premise is never back-edited. What follows is not a defence of the code against the bar. It is
two separate findings: **seven of those nine rows were my instrument failing, and two were the app
failing** — and the app's two are exactly the pair this round had named as at risk after correcting
its earlier butterfly error.

### Seven of the nine failures were mine, and the harness had already said so in writing

`propHigh` is measured **with the particle engine muted**. `room.ts` documents the consequence at
length, and it was written before I wrote the probe that ignored it:

> A prop that emits `sceneSparkle` with no overrides draws the miss's own burst and then moves itself
> as well, so its answer contains the miss's answer and cannot be smaller than it — no framebuffer
> required. The rows where that deduction is unavailable are exactly the rows that emit nothing, or
> emit something else, or emit the same preset with the count turned down, and for those the
> numerator really is `propHigh` alone against `sparkleHigh`.

So for a sparkle-emitting prop the ratio compares the prop's **tween alone** against a **whole
burst**, while the thing the child sees is the tween _and_ that same burst. It is not a strict test,
it is a **malformed** one: the numerator is missing a term the denominator has. `mush_cap` at 0.20
does not mean the mushroom's bounce moves a fifth of a sparkle's worth of pixels. It means the bounce
alone does, on top of the sparkle it also draws.

This is filed as apparatus defect **(xviii)**, and it is filed as a defect rather than a typo because
of what it would have done had the fix been perfect. A corrected run in which every prop passed would
_still_ have printed FAILED for the sparkle-emitting majority — and the natural response to a bar
that fails on props nobody touched is to conclude the bar is too strict and relax it. The failure
mode is not a wrong number; it is **a wrong number aimed at the bar itself**. The noise ran three and
a half times louder than the signal it sat on.

### And one place the harness's own scope was genuinely too narrow

Applying the documented rule correctly still left the **stone** graded on the ratio, because the
stone answers with `sceneDust` and the deduction as written covers only the miss's own preset. That
is not bookkeeping either. With `propHigh` particle-muted, the stone's shift was being compared
against a whole burst while the dust it actually draws counted for nothing — a bar shaped so that it
could be satisfied by **drawing fairy sparkle over soil**. An instrument that pushes the app toward a
worse-fitting frame in order to be measurable is worse than no instrument, because it is persuasive.

So `__reactionScan` grew a **fourth pass** in this round. `__replayAsked` re-emits the captured
`particles.emit` argument tuples into the live engine under the miss pass's own frozen conditions,
yielding `ownHigh`, and the deduction generalises from "draws the miss's burst" to "draws a burst no
smaller than the miss's". It is a **replay and not a re-fire** on purpose: re-firing is barred by the
handler latches — a reveal reveals once — and would re-run the tween, mixing the two terms the
decomposition exists to separate. What it still cannot say is stated where it is used: it shows the
burst the prop **asked for** is at least as large as the miss's, not that the prop drew it on the tap
frame. That the handler asked at all is the muted pass's finding, and the two together are the claim.
Filed as **(xix)**.

### The two real failures, and the fix they forced

```
  run 1 — after the voice, before any tap-time burst
  row               ratio   edge   emits
  leaf_cover         0.89      0   (none)
  stone_cover        0.27      0   (none)
```

(Ratios only. This run predates the fourth pass; its two ratios are the numbers quoted in the
committed docblock in `revealInteraction.ts`, and the pixel columns behind them are not reproduced
here rather than reconstructed from memory.)

`leaf_cover` and `stone_cover` were the **only two graded rows in the entire voice run reading
`emits (none)`**, and that is not a coincidence — it is the mechanism. Both are
`createRevealInteraction` props. Their particles live inside `playAnimation(...).onEnd`, hundreds of
milliseconds after the finger lands. Round 5 gave them a voice; `interactionController.fire` therefore
stopped drawing its shared acknowledgement sparkle; and nothing replaced it. **For one round, the
frame the child's finger landed on answered in nothing at all.** That is the exact trade bar (b)
exists to forbid, pre-registered before the fix was written, and it caught it.

The fix is in `revealInteraction.ts`: a `tapParticleFn`, emitted on the same frame as `tapSoundId`,
defaulting to the miss's own `sceneSparkle` — the burst the controller stopped drawing. Three things
about it are deliberate and each is defended in the source:

- **It is gated on `tapSoundId`, and the gate is the whole argument.** A cue at tap time is exactly
  when the controller stops paying. A cover configured with no tap cue is silent on that frame, still
  gets `fire`'s sparkle, and must not be paid twice — which is why the emit sits _inside_ the `if`
  rather than beside it.
- **It is not `particleFn`.** That one is the creature's arrival burst. Drawing it at tap time would
  announce the payoff before the payoff — the precise defect Round 4 found in the portal's audio, and
  the last thing Round 5 should reintroduce in pixels.
- **The stone overrides it, and the leaf does not override it at all.** A leaf turning over does not
  raise dust the way a stone grinding through soil does, and inventing a leaf-specific burst to look
  thorough would be decorating a frame instead of answering it.

### The first fix was measured and refuted, by the pass built to grade it

The stone's override was, at first, **dust alone** — on exactly the reasoning in the bullet above,
which reads well and was wrong. Run 2 is the first run with the fourth pass in it, and the fourth
pass is what caught it:

```
  run 2 — leaf at the default sparkle; stone overriding with dust ALONE
  exempt — draw a burst no smaller than the miss's AND move as well: 12
  graded on the ratio: 3
      stone_cover         1389 /     454 = 3.06   own  50 px (1 replayed)   PASS
      stone_cover          918 /     506 = 1.81   own  47 px (1 replayed)   PASS
      stone_cover          387 /     417 = 0.93   own  42 px (1 replayed)   FAIL

  BAR (b) FAILED for stone_cover
```

**The leaf half of the fix is proven by this run**: `leaf_cover` moved from `emits (none)` to
`emits sceneSparkle` and is exempt by deduction on all three of its rows. The stone half is refuted
by it, and the refutation is more interesting than the ratio that reports it.

Read the `own` column against the `sparkleHigh` column: the stone's dust burst moves **42–50 px**
where the sparkle it displaced moved **417–506 px**. A tenth. And the preset source predicts the
same factor without touching a framebuffer — `SCENE_SPARKLE` is `count: 40`, `opacity: [0.8, 1]`,
**additive**, bright yellow; `SCENE_DUST` is `count: 12`, `opacity: [0.25, 0.4]`, **normal**-blended,
brown, on a brown forest floor. Two independent methods agreeing is worth more than either alone.

That measurement also reframes what the failure _is_. `propHigh` — the stone's shift — sits on
**both sides** of the before/after comparison, because the shift happened before this round too.
What Round 5 changed at tap time is which burst is drawn. So the honest statement of the regression
is not "one stone instance scored 0.93 and two scored above 1" but **"every stone traded a
460-pixel answer for a 45-pixel one"**. The instance split in the ratio was an artefact of how far
each stone happens to slide, and reading the pass/fail column instead of the pixels would have
shipped two thirds of a regression as a pass.

So the stone now draws **both**: the acknowledgement it would have been given, and its own dust on
top. Keep what you had, add what you earned. The argument is that `fire`'s `soundCount` check is a
**proxy** — it takes "answered somehow" for "answered enough" — and for a prop whose own burst is a
tenth of what it displaced, the proxy is simply wrong and the prop has to pay the difference itself.
Rejected on the way: brightening `sceneDust`. `EmitOverrides` accepts only `colors` and `count`,
`count` is silently capped by `capacity: 24`, and opacity and blending are not overridable at all —
so "make the dust louder" means authoring a second dust preset to satisfy an instrument, which is
the tail wagging the dog.

### Run 3: the bar clears, and it clears without needing the ratio at all

```
  row               propHigh  sparkleHigh    ratio  edge   emits
  mush_cap               233          295     0.79     0   sceneSparkle
  mush_cap               127          331     0.38     0   sceneSparkle
  mush_cap                92          375     0.25     0   sceneSparkle
  mush_cap                63          265     0.24     0   sceneSparkle
  mush_cap               170          247     0.69     0   sceneSparkle
  leaf_cover             105          141     0.74     0   sceneSparkle
  leaf_cover             480          351     1.37     0   sceneSparkle
  leaf_cover             568          335     1.70     0   sceneSparkle
  stone_cover           1142          484     2.36     0   sceneSparkle,sceneDust
  stone_cover            916          498     1.84     0   sceneSparkle,sceneDust
  stone_cover            330          424     0.78     0   sceneSparkle,sceneDust
  bfly_body              181          165     1.10     0   sceneSparkle
  bfly_body              168          118     1.42     0   sceneSparkle
  bfly_body              246          227     1.08     0   sceneSparkle
  bfly_body              213          226     0.94     0   sceneSparkle

  exempt — draw a burst no smaller than the miss's AND move as well: 15
  graded on the ratio — draw nothing the miss's burst can be deduced from: 0

  BAR (b) CLEARED BY DEDUCTION ALONE
```

**Every one of the fifteen rows is exempt, and zero rows are graded on the ratio.** That is a
stronger result than fifteen passing ratios would have been, and it is worth being precise about
why, because the raw `ratio` column still shows eight rows below 1.00 and a careless reading of this
table says the round failed.

The exemption is a deduction, not a dispensation. `propHigh` is measured with the particle engine
**muted**. A row that emits the miss's own preset unmodified draws the miss's burst _and then moves
itself as well_, so its answer **contains** the miss's answer and cannot be smaller than it — no
framebuffer required, and no ratio required either. `mush_cap` at 0.24 does not mean the mushroom's
bounce is a quarter of an acknowledgement; it means the bounce **alone** is, on top of the sparkle
the same row also draws. The eight sub-1.00 ratios are not near-misses. They are the numerator of a
comparison the harness's own documentation says not to make.

The three `stone_cover` rows are the ones this round had to earn: they read `sceneSparkle,sceneDust`
and are exempt on the sparkle, with the dust as the thing the stone added rather than the thing it
substituted. `edge` is 0 on every row, so nothing was clipped by the crop.

One honest note on coverage. Because every row exempted on the deduction path, the fourth pass's
`ownHigh` was **not consulted in this run** — it did its work in run 2, where it refuted the fix, and
sat idle here. A pass that only ever speaks when something is wrong is easy to leave broken; it
should be exercised deliberately in a later round rather than assumed still sound because the run it
sat out came back green.

### What the fix does not fix, on the record

- **The flower's repeat tap over-promises.** The bloom happens once; every later tap only puffs
  pollen but hears the same full cue. The honest repair is a second, smaller cue for the puff, and
  that is a sound to author and defend on its own rather than guess at. Filed, not patched.
- **The leaf's post-reveal tap falls to the controller floor by design.** A flipped leaf has
  nothing left to give, so `repeatOnTap: false` keeps it silent and it takes the shared
  acknowledgement. That is the honest answer for a prop that genuinely did nothing, and it is the
  one place in the scene where the fallback is still correct.
- **`sfx_hub_ambient_hop` is still stranded**, and was deliberately not touched in this round.
- **The three new synths have never been heard by a human.** They are defended on structure —
  frequency content, envelope, and their relationship to the animation curve — not on taste. That
  is the strongest claim a text-only process can make and it is weaker than listening.

### What is pinned, so this cannot silently regress

One new test in `tests/audio/tap-answer-vocabulary.contract.test.mjs`, plus two updated counts.

**The counts moved 52 → 58, and the delta is itself the evidence.** Six new `triggerSound` sites,
every one in the Nature scene, because before this round that scene contained **zero** literal
sound call sites. It is six and not eight because the leaf and stone name their cues as
`tapSoundId` / `revealSoundId` config fields rather than as calls, which the literal scanner cannot
see — so the new pin reads those two files directly.

- _every interactive Nature prop answers in a voice of its own, and four of them use the sound
  written for them_ — for all eight props: the cue is named in **code** and not only in prose, the
  miss cue appears nowhere in the file, and the id is **registered**. Plus: exactly one prop may use
  a shared cue (so a future round cannot quietly turn the flower's argued exception into a default);
  both reveal props name the shared scurry; the reveal cue's **single** call site is ordered after
  `onEnd` and after `scene.add(creature)`; the cover cue is ordered before the cover animation; and
  all three new synth functions actually exist rather than merely being named by a registry line.

And a second pin, added after bar (b) failed, because the fix bar (b) forced is exactly the kind of
thing a later tidy-up deletes as redundant:

- _the tap-time burst is paired to the tap-time cue_ — `tapFn(scene, …)` must exist; it must sit
  **after** `triggerSound(config.tapSoundId)` and **before** `playAnimation(config.coverMesh…)`,
  which is how a source-text pin says "inside the branch that creates the debt" without writing a
  second, worse copy of the compiler; the default must be the miss's own `sceneSparkle`, since that
  default is what makes "no regression" a deduction rather than a hope; and the stone's override
  must draw **both** `sceneSparkle` and `sceneDust`, read from a slice of the file that excludes
  `particleFn` — the reveal burst is also dust, and a whole-file regex would pass on the strength of
  the wrong emit.

**That last assertion is a pin that was wrong once, and the wrongness is left standing in its own
comment.** Its first version read `tapParticleFn: (s, p) => …emit(PARTICLES.sceneDust, p)` and was
defended in prose about stones raising dust and leaves not. It was pinning a regression — and
nothing in the source could have said so. Only the harness's fourth pass could, which is the
concrete argument for why a source-text pin is the junior partner here and never the evidence.

This is a **source-text pin** — apparatus defect (xi) — and it says so where it is used. The runtime
evidence is the tables above; the pin's job is to stop a specific known-bad refactor.

**A first draft of the pin failed on correct code, twice, and both failures were informative.** It
matched `'sfx_nature_log_knock'` against the registry source and failed on all eight props, because
the registry writes its keys **bare**; the fix was to use the same `registeredIds()` parser every
other test here uses instead of a hand-rolled second one. And it asserted the reveal cue appeared
within 400 characters of `onEnd`, which is a pin on formatting pretending to be a pin on behaviour;
it was replaced with an **ordering** assertion.

**Four mutations, all killed.** Deleting the log's `triggerSound` call failed with "the log must
name `sfx_nature_log_knock` in code, not only in prose". Handing the butterfly `sfx_shared_pop`
instead of its own cue failed the same way. Restoring the **miss cue** to the mushroom failed _two
independent tests_ — the Round 3 vocabulary pin and this one. And moving the reveal cue from `onEnd`
up to the tap — Round 4's exact defect, reintroduced — failed with "a payoff cue before the payoff
is the defect Round 4 found".

**And four more against the tap-burst pin, all killed**, chosen to be the four ways the fix could
decay rather than four ways to break the file: dropping the stone's sparkle emit (the regression
this round measured, restored); dropping its dust emit (fairy sparkle over soil, the shape defect
(xix) was filed against); collapsing the whole override back to the one-line sparkle-only arrow;
and deleting the override entirely so the stone falls to the default. Each failed on its own
message.

**The suite is 403 tests, all passing** — the same count as before this round, because the two new pins are assertions inside an existing test rather than new cases, and every one of them was mutation-verified before being counted. `tsc -b` and the probe tsconfig are both clean.

---

---

## Round 6 — The gate that was supposed to enforce all of it

Five rounds of review produced, among other things, a body of contract pins: assertions that the
Nature stone speaks in its own voice, that the portal's cue does not announce the payoff before the
payoff, that no interactive prop falls back to the shared miss sound. Each was written deliberately,
most were mutation-verified, and every one of them is checked into `src/tests/`.

Before writing a line of Round 6's fix, the obvious question was the one nobody had asked in five
rounds: **what runs them?**

### The finding

`src/scripts/precommit-check.cjs` opens like this, and the first sentence is the defect:

> Pre-commit quality gate. A commit is blocked unless ALL of these pass:
>
> 1. Prettier --check on staged source files
> 2. ESLint --max-warnings 0 on staged source files
> 3. ESLint on the whole package
> 4. tsc -b
> 5. vite build

`node --test` is not on that list. Neither is the probe harness's type-check — `src/tsconfig.json`
references only `tsconfig.app.json` and `tsconfig.node.json`, so `.probe/tsconfig.probe.json` is
invisible to `tsc -b`, and the instrument that grades every round of this review was the one body of
code in the repository that nothing type-checked at all.

### Defending it — two mutations, because a reading of the source is not a finding

The standing rule from Round 1 onward is that a claim about what code does is worth what its
verification is worth, and reading a file is not verification. Both halves were therefore proven by
mutation against the real gate:

```
Mutation A — const __gateProbe: number = 'this is a string, not a number';   in .probe/render/room.ts
  tsc -p .probe/tsconfig.probe.json --noEmit  →  error TS2322: Type 'string' is not assignable to type 'number'.
  precommit-check.cjs, that file staged       →  "pre-commit: all gates passed."   GATE_EXIT=0

Mutation B — tapSoundId: 'sfx_shared_tap_fallback'   in the Nature stone's interaction.ts
  npm test                                    →  not ok 20 — every interactive Nature prop answers
                                                 in a voice of its own…      402 pass / 1 fail
  precommit-check.cjs, that file staged       →  "pre-commit: all gates passed."   GATE_EXIT=0
```

Mutation B is chosen rather than invented. It is the **exact Round 3 defect** — the stone answering
in the sound written for a miss — that this review spent a round diagnosing, a round fixing, and a
pin preventing. The gate let it through wearing a pass.

So the honest statement of the suck is not "the gate is missing a step". It is: **every pin written
across five rounds was enforced by my remembering to type `npm test`.** Including the pins written to
catch the failures I had already made once. A pin nobody runs is a comment with heavier syntax.

And the docblock is not incidental to that — it is the mechanism. A list that reads as exhaustive is
how a missing gate stays missing, because every reader who checks the documentation comes away
reassured. Five rounds of reviewers, all of them me, all reassured.

### The fix

`scripts/precommit-check.cjs` grows two gates, placed after `tsc -b` and before `vite build` — tests
are fast and by far the most informative failure a commit can get, while the bundle build is the
slowest gate and the least likely to be the broken thing, so a failing test no longer pays for it:

```js
runCheck("TypeScript (probe project)", tscBin, [
  "-p",
  PROBE_TSCONFIG_REL,
  "--noEmit",
]);
runNode("Tests (node --test)", ["--test", TEST_GLOB]);
```

Three smaller things travel with it, and each is a defect in its own right rather than tidying:

- **`package.json`'s `test` script stopped enumerating directories.** It listed eight test
  directories by name. There are exactly eight, so it had no live gap — it had a latent one, of the
  family this review has now filed four times: an exclusion criterion doing unchecked work. A ninth
  directory would have been silently untested. It is now the same `tests/**/*.test.mjs` glob the gate
  runs, so the two cannot drift.
- **`result.status !== 0` rather than `> 0`.** `spawnSync` reports `status === null` for a process
  killed by a signal. An out-of-memory `tsc` would otherwise have waved a commit through wearing a
  pass — the same false-pass shape as the finding itself, one layer down.
- **A missing `.probe/tsconfig.probe.json` now blocks the commit by name.** Otherwise deleting the
  probe project turns a gate into a confusing tooling error, and the tempting repair for a confusing
  tooling error is to delete the gate.

### Evaluating the fix against the suck

The fix is not proven by the file containing the new lines. That is apparatus defect (xi) exactly: a
source-text claim cannot tell whether a body is reached. It is proven only when the same two
mutations that walked straight through are stopped **by name**:

```
Mutation A, re-run against the fixed gate:
  == pre-commit: TypeScript (tsc -b) ==            (passes — tsc -b still cannot see the probe)
  == pre-commit: TypeScript (probe project) ==
  .probe/render/room.ts(2249,7): error TS2322: Type 'string' is not assignable to type 'number'.
  pre-commit failed during TypeScript (probe project).      GATE_EXIT=1

Mutation B, re-run against the fixed gate:
  == pre-commit: Tests (node --test) ==
  not ok 20 - every interactive Nature prop answers in a voice of its own, and four of them use
              the sound written for them
  # pass 402   # fail 1
  pre-commit failed during Tests (node --test).             GATE_EXIT=1
```

Both blocked, each at the gate added for it. Mutation A's run is doubly informative: `tsc -b` printed
and passed immediately before the probe gate caught the error, which is the third independent
confirmation that the build project genuinely cannot reach the harness.

Clean-tree baseline, with everything restored: **7 gates, 403 tests, 0 failures, GATE_EXIT=0.**

**Cost.** The two new gates add **~30s** to every commit — 4.9s for the probe type-check, 25.3s for
the suite — taking the gate from roughly 74s to a measured **104s**. That is a real 40% tax on every
commit and it is worth naming rather than burying, because the argument for paying it is not "tests
are good". It is that the alternative was measured: the untaxed gate shipped the Round 3 defect back
into the tree without comment.

### And a pin on the gate, with its limits stated

`tests/framework/precommitGate.test.mjs` pins five things: the test gate exists, the probe gate
exists, the gate's glob and `package.json`'s agree and neither enumerates, the exit check is
`!== 0`, and — the assertion aimed most precisely at the actual defect — **the docblock's numbered
list has exactly as many entries as the file has gate invocations.** That last one looks like
pedantry about a comment and is not: overclaiming prose is the mechanism by which the two missing
gates stayed missing for months.

All five were mutation-verified individually, each killed by its own targeted mutation and by no
other:

```
delete the tests gate           → not ok 1  (and not ok 4, the count)
delete the probe gate           → not ok 2  (and not ok 4)
restore the enumerated script   → not ok 3
add a gate, not the doc line    → not ok 4
weaken !== 0 to > 0             → not ok 5
restored                        → 5 pass, 0 fail
```

The file states its own ceiling in its docblock, because it has one: it is a source-text pin, so
every assertion in it would still pass if the whole gate list were wrapped in `if (false)`. The pin
is not the proof — the two mutations are. What the pin adds is the thing a one-time mutation run
cannot give: it notices the day someone quietly deletes a line. Neither half is sufficient alone,
which is itself the lesson Round 1 learned about `propHigh` and the muted pass, arriving again in
different clothes.

### (xx) — filed against this round's own instrument

The docblock-count assertion failed on its first run, reporting **eight gates against seven claimed**.
There are seven. The regex `run(Check|Node)\(` also matched `runNode(label, ...)` inside `runCheck`'s
own body — the delegation between the two helpers — so the instrument counted plumbing as coverage.
Requiring a quoted literal label fixed it.

It is a one-character fix and it is filed anyway, because of its direction: the miscount said
**"you have more coverage than you do."** That is the same sentence as the finding this entire round
is about, produced by the test written to prevent it, within a minute of writing it. Twenty
instrument defects now, against roughly a dozen product ones.

## Round 7 — The guard that watched the door while the house filled up

### The finding

`tests/framework/noUnreachableModules.test.mjs` is the best instrument in this repo. It was written
after a static sweep found 2,000+ lines nothing loads, and its founding story is the little-shark
species roster: 963 lines, five species, complete, documented, internally consistent, answering a
complaint the game had actually received, and loaded by nothing. Every signal said _finished
feature, someone forgot the wire_. The guard exists so that can never sit unnoticed again.

It asks one question. **Does the app reach this FILE?**

`src/minigames/shared/animalBuilder.ts` answers yes. The app reaches it, honestly and continuously:
`buildShark` and `buildFish` are live, called by the little-shark game every session. Behind that
yes, in the same file, sat nine complete cartoon animal builders — bunny, kitten, puppy, panda,
hamster, frog, bear, cat, elephant. Each one built, named, documented, given default colours to
three decimal places. **About 920 lines. Nothing anywhere calls one of them.**

That is the same shape, the same quality of finish, and within five percent of the same size as the
roster whose deletion motivated the guard — hiding in the one place the guard structurally cannot
look, and passing CI in silence ever since.

### The defence

The obvious objection is that this is tidiness dressed up as a defect. Dead code costs nothing at
runtime; the bundler drops it; a child never sees it. Why is this worth a round?

Because the cost was never runtime. It is the same cost the module guard's own docblock names and
then fails to collect: _unused code that READS AS SHIPPED, so the next reader concludes the app does
something it does not, or worse, helpfully connects it._ Every word of that applies here and lands
harder, because these nine sat next to two functions that genuinely ship. The roster at least had
the decency to live in files nothing imported. These had a live neighbour vouching for them.

And the "helpfully connects it" half is not hypothetical. The measured lesson from the roster was
that wiring it in would have cost **72% of the reef's worst-case legibility** — the obviously-good
connection was the expensive one. A future reader reaching for `buildPanda` because the playroom
"needs an animal" would be making that same trade blind: the playroom's critters are built
elsewhere, independently, because they answer to scene lighting and idle-animation conventions these
builders never knew about. `buildPanda` would give you a panda that ignores every one of them.

The second half of the defence is the one that generalises. The module guard is not weak — it is
**precisely scoped, and its scope is invisible from its output.** A green run says "no module is
unreachable." A reader hears "no dead code." Lines 20–31 of that file say plainly that it does not
check unused exports, and I had read those lines in an earlier round and still did not go looking.
Prose disclosing a limit does not defend against it. Only a second instrument does.

### The fix

`tests/framework/noUnusedExports.test.mjs`, built on `tests/framework/_moduleGraph.mjs` — the
resolver lifted out of the module guard and now shared by both, because two guards that disagree
about what the app loads are worse than one: whichever is wrong is the one you will believe. The
module guard was refactored onto it in the same commit, and **its twelve-entry allowlist passing
unchanged in both directions is the evidence the lift changed no verdict.**

The new guard flags exports that (a) live in a module the app reaches, (b) no other module imports
by name, and (c) are not referenced inside their own file either. Same ADMISSIONS convention, same
both-direction staleness check.

### Evaluating the fix against the "suck" — the part that mattered

The first run returned **263 names**, including `createScene` for the kitchen, the living room and
the playroom. Three scenes the game ships and a child can walk into.

The length was the tell. A guard whose output is too long to check by hand is a guard nobody checks,
and the instrument was wrong in the worst possible direction — **condemning live code**. Acting on
that verdict would have deleted three working scenes, and `tsc` would have stayed green, because the
only reference to them is a string. Three defects, all found by running it rather than by reasoning
about it:

**(xxii)** A literal `import('x')` resolves to a **namespace**, naming no export in any brace list.
`sceneCatalog.ts` lazy-loads every scene exactly that way. Fixed by `opaqueTargetsOf`, which treats
`import()`, `import * as ns`, and `export * from` alike: whole surface consumed, no names written
down. Mutating that pattern back out breaks three of the four tests, so the fix is load-bearing, not
decorative.

**(xxiii)** `tests/room/scene-sky-fog-contract.test.mjs` writes a synthetic entry module as a
**template literal** and bundles it. Its `export {...} from './src/utils/cameraPresets'` inside that
string resolves against the test's own directory, hits nothing, and the usage vanished — condemning
two live camera helpers. Fixed by refusing to resolve on the test side at all: any exported name
appearing as a whole word anywhere in the test/probe corpus counts as used. A deliberate
over-approximation, wrong only in the direction that spares a symbol.

**(xxiv)** And then the one worth the round on its own. With those fixed, the staleness check failed
on all four allowlist entries at once — each naming a symbol it declared dead, and each therefore
**marking that symbol as used**, because the allowlist keys are string literals inside a file that is
itself part of the test corpus. An allowlist that self-destructs on contact. The symptom is comic;
the general form is not: **any dead symbol named in the guard that reports it would have been
silently spared, and the guard would have grown quieter the more debt it recorded.** Direction:
flattering. Fixed by excluding the guard's own source from its own corpus, in writing, with the
reason.

Three instrument defects, in one instrument, before it caught a single thing it was built for. The
final list was **32 names** — and it matched, name for name, an independent audit run earlier by a
separate agent through a completely different method. Two instruments, no shared code, same answer.
That convergence is the only reason I believed the number.

### What was deleted, and what it cost to delete it

Twenty-eight of the 32 went, with NOT-HERE-DELIBERATELY blocks: nine animal builders (~970 lines
with their private helpers), five mesh builders, six materials, `getGamesForScene` and `SCENE_IDS`,
four audio-engine exports including a fully-tuned `duck()` that was never once audible, two synth
helpers, one owl `jitter`. Four remain allowlisted as genuine judgement calls, named with reasons.

**1,551 lines deleted against 108 added.**

Three things happened during the deletion that are worth more than the line count:

The cutter **over-ate**, silently swallowing `isSceneId` — a live function — along with `SCENE_IDS`
above it. `tsc` caught it immediately. The gate Round 6 fixed did its job on the very next round,
against a defect introduced by the person who fixed it.

**Dead code hides dead code.** Removing the nine animals orphaned three material factories whose
only callers they had been. A single sweep finds one layer; the guard has to be re-run to fixpoint,
which is how `createFurMaterial`, `createInnerEarMaterial` and `createAccessoryMaterial` were caught
on the second pass.

And `readme-citations.test.mjs` — an instrument from an earlier round, unprompted — failed on
`buildSkyGradient`, still cited in backticks in bubble-pop's README. A guard nobody was thinking
about caught documentation drift caused by a deletion nobody had told it about. That is what the
apparatus is supposed to feel like when it is working.

### What this round does NOT claim

The docblock states the two tiers it does not enforce, with counts measured the same day: **69 dead
re-export lines** (a barrel exporting `x` that nothing imports through it, while live code imports
the deep path — the line is dead, `x` is alive) and an unmeasured **exported-but-internal** tier
where the `export` keyword is superfluous but the code runs every frame. Enforcing one tier and
naming the other two is the whole discipline, because the failure this suite keeps rediscovering is
prose that reads as exhaustive when the code beneath it is not. **Nobody should read a green run
here as "no dead exports."**

### The clause this round adds

Round 6 ended with _after you have proven the instrument, prove that something other than your own
memory runs it._ Round 7 found the next gap in that sentence. Something did run this instrument. It
ran on every commit, it passed, and it was answering a narrower question than anyone reading its
output believed.

**A guard's blind spot is invisible from its output — a pass looks identical whether the question
was broad or narrow.** So the rule takes one more clause: **state what an instrument does not check,
in the instrument, next to the count of what it is missing.** A limit disclosed in prose that carries
no number is a limit nobody will act on. I had read this guard's disclosure of exactly this gap in an
earlier round, and it did not send me looking, because it did not say _920 lines._

## Round 8 — The migrations that looked abandoned because they had succeeded

### The finding, as first charged

Round 7 left the reachability allowlist at thirteen entries and 862 lines, and the round opened by
reading it as a whole rather than entry by entry. Read whole it said something none of its thirteen
entries said: **this repo starts unifications and does not finish them.** Four `utils/*` barrels at
zero. A descriptor-driven scene builder at zero. A `scatterDecoratives` helper at zero. An
`animationPresets` module at zero next to an `animationRunners` module that eleven files import. A
Pirate Cove parent-scene stub. A spring-physics module inside bubble-pop that the bubbles do not use.

The opening thesis was therefore: **the repo's dead code is about seven abandoned migrations, and
their safety mechanism is their concealment mechanism** — every one had been left in place _so that
nothing broke_, and being left in place is exactly what made each of them read as a live alternative
to whatever ships. Thirteen specific true sentences, each individually unarguable, averaging out to
no claim at all.

### The measurement that falsified most of it

The thesis was testable and I tested it, and it was mostly wrong.

The instrument was the wrong one first. The prior round's tables had been built on `grep -c`, and
Round 7 had already logged what that costs — "duck" matching 36 rubber ducks, "lifecycle" matching a
docblock sentence. So this round rebuilt the count on **import edges** out of
`tests/framework/_moduleGraph.mjs`: for every file under `src/`, every named import, resolved to a
target module, so that "17 files import X" means seventeen `import { … } from 'X'` statements and
cannot mean seventeen files that happen to mention the word.

The edges said this:

| seam                                      | live importers                | old API                  | its callers | state                    |
| ----------------------------------------- | ----------------------------- | ------------------------ | ----------- | ------------------------ |
| `lightingRig.createLightingRig`           | 2                             | `createGameLighting`     | 3           | **inverted**             |
| `disposal.createDisposalScope`            | 17                            | `createDisposeCollector` | 5           | **inverted**             |
| `interaction.createInteractionController` | 2                             | `createTapInteraction`   | 15          | **inverted**             |
| `camera.cameraDescriptor`                 | 3 (all `minigames/framework`) | `createSceneCamera`      | 2           | **split**                |
| `scene.buildScene`                        | **0**, live or dead           | `createWorldScene`       | 2           | **abandoned**            |
| `SceneLifecycle` 4th argument             | n/a — an arity, not an edge   | —                        | —           | **abandoned, 0 of 5**    |
| the barrels (five, not four)              | 0                             | —                        | —           | **resolved by deletion** |

Two importers for the lighting rig looks like an unadopted migration. It is not one.
`minigames/shared/sceneSetup.ts:47` opens with `const rig = createLightingRig(` — **inside
`createGameLighting`**, the very function the rig was written to replace. The old name stayed, the
old signature stayed, all three callers kept the import they already had, and the new engine ended up
with two importers while running 100% of the lighting in the app. `utils/sceneHelpers.ts:351` does
the same for disposal (`const scope = createDisposalScope();` inside `createDisposeCollector`), and
`utils/interaction/worldTapDispatcher.ts:45` does it for interaction, describing itself in its own
docblock as "a thin adapter over the unified `createInteractionController`".

**This codebase completes migrations by inversion.** The old function keeps its name and its
signature and its body is rewritten onto the new engine. It is a good pattern — no call-site churn,
no flag day — and it has one cost, which is that it makes a finished migration look stillborn from
the outside. Three of the seven "abandoned migrations" I opened the round with were finished.

So the round's real finding is not about dead code at all. It is an instrument finding:
**an importer count is evidence of nothing on its own.** It is only meaningful next to the answer to
_"and does the old API call the new one?"_

### The defence

The first objection is that this makes the round's opening charge a false alarm and the whole thing a
wash. It does not, for two reasons.

The first is that the falsification was itself the deliverable. Six months of this document's
reasoning about `utils/` had been built on counts nobody had checked the meaning of, and the
correction is not "three numbers were off" but **"the quantity we were reasoning with does not
measure the thing we were reasoning about."** Every future reader of this repo who sees a
two-importer module in `utils/` is one grep away from concluding it is dead. That is exactly what I
concluded, in writing, three times in one afternoon (see (xxvii)).

The second is that stripping the six false alarms out left the two real ones **isolated and much
sharper than they were inside a list of thirteen**. `buildScene` is at zero by every path. And the
`SceneLifecycle` fourth argument is worse than dead — it is _passed_. `SceneFrame.tsx:186` calls
`module.createScene(scene, canvas, nav, { clock, disposal })` on every single scene load, and all
five exported `createScene` functions take **three** parameters. A lifecycle object is constructed
and dropped on the floor five times. It type-checks because `sceneCatalog.ts:88` types its loaders
`() => Promise<unknown>`, `SceneFrame.tsx:145` casts, and the parameter is declared optional with the
comment _"scenes that ignore it keep working."_ Six green instruments cannot see a 0%-adopted
optional parameter, and the comment that makes it safe is the sentence that guarantees the next scene
written will omit it too.

The third and sharpest item was not a migration at all. `playroom/toyboxes/pirate-cove/parent-scene-stubs/`
held a manifest stub in which **every field differed from the live Pirate Cove manifest**, including a
`z: -6.88` sitting deep in −z where the frustum is narrowest. It was not inert documentation. It was
a live instruction to undo tuned work, sitting one obedient copy-paste away from doing it.

### The fix

Two halves, and the split between them is the point.

**Deleted, each with a NOT-HERE-DELIBERATELY block:** the five `utils/*` barrels
(`camera`, `lighting`, `interaction`, `idle`, `scene`), `bubble-pop/animation/{spring,index}.ts`,
`utils/animationPresets.ts`, `utils/scatterDecoratives.ts`, and the Pirate Cove parent-scene stub.
About 399 lines. Each block states what the module claimed, what is true instead, and — where it
applies — why adopting it would have been a regression rather than an improvement.
`scatterDecoratives` is the one to read: it claimed to replace naturescene's placement loops, and
those loops use `seededRng(placementSeed(position, tag))` while the helper used bare `Math.random()`,
so adopting it would have made decor twitch between reloads. A tidying that ships a visual
regression.

**Kept, and moved to a different instrument:** `utils/scene/{buildScene,sceneDescriptor,sceneDescriptors}.ts`.
Deleting these three is the cheapest way to empty the allowlist, and it would delete the only written
statement of the intended scene composition while leaving both imperative roots, every disposal
mechanism and the unused `SceneLifecycle` parameter exactly where they are — **measurably tidier and
strictly less honest.** That argument is now written in the allowlist next to the entries, so the
next reader reaching for the cheap win meets it first.

The new instrument is `tests/framework/noAbandonedMigrations.test.mjs`. It holds the same subject
matter **aggregated by migration rather than by file**, which is the format change the thirteen-entry
list needed; every claim carries a number a test recomputes from import edges; and — the part that
matters most — **it asserts the delegation edges themselves**, because that is the one failure an
importer count cannot see. Pasting the light-building back into `createGameLighting` would leave
every importer number in this repo correct and every other test green. Five tests: adoption counts,
old-API caller counts, delegation edges, the two-imperative-roots composition, and the `createScene`
arity at 0 of 5. Both load-bearing assertions were mutation-verified — broken deliberately, confirmed
to fire, confirmed to name the exact site.

The reachability allowlist went from **thirteen entries to three**.

### Evaluating the fix against the "suck"

The charge was that the repo leaves unfinished migrations lying around and that the per-file allowlist
format made that invisible. After the fix: six of the seven were not unfinished, and the two that are
now sit in a file whose whole shape is _one row per migration, with recomputed numbers_ — the exact
format whose absence let thirteen true sentences add up to nothing. That is answered.

What is **not** answered, and is stated in the instrument rather than here: two of the seven seams
are unguarded by any behavioural contract. Disposal has one. Lighting and camera do not. So the
delegation assertion for lighting is a source-level edge check — an import edge, which is stronger
than the source-text pins of defect (xi), but still not a proof that the running body reaches the
call. And the camera seam is worse: it is the one migration that did **not** invert, so the two
conventions are both live, and inverting it today would be unpinned at precisely the seam that
matters. That is now item 1 of the open-work list in `architecture-standards.md`, with the
prerequisite stated: **write the contract test before inverting, not after.**

### What this round does NOT claim

It does not claim the three `utils/scene/` files should be wired in. It claims they should not be
deleted **silently**, which is a different and much weaker claim, and the register entry states what
wiring them in would have to prove.

It does not claim the delegation edges are behaviourally correct — only that they exist. An edge says
`createGameLighting` imports and names `createLightingRig`. It does not say the rig it builds is the
rig the games used to get.

And it does not claim the migration register is complete. Seven seams are named; the repo has more
duplications than that (`lerp` is still defined four times, `disposeMeshDeep` still has 23 call
sites). Two of seven are unguarded by a behavioural contract, and that gap is stated in the
instrument **next to its size**, per Round 7's clause.

### The clause this round adds

Round 7's clause was _state what an instrument does not check, next to a number._ Round 8 found the
failure that survives it: I stated numbers, and the numbers measured the wrong quantity, and being
numbers is what made them persuasive.

Every wrong claim this round produced had a figure attached. "All 17 consumers import
`utils/idle/idleAnimator` directly" shipped inside the allowlist and was false — one file imports it,
sixteen mention it. My own three doctrine blocks were written from remembered counts before I
measured, and measurement falsified all three. The register's own first draft filled its
`oldApiCallers` fields with **module** importer counts instead of **symbol** caller counts, and its
own second test rejected all three checkable entries on the first run.

So the clause: **a number is not a measurement until you can say what would have to be true of the
world for it to come out differently.** An importer count of 2 and an importer count of 17 are the
same evidence about adoption — which is to say, none — until the delegation question is answered. The
quantity has to be tied to the claim, and "it is a number, and I measured it" is precisely the form of
confidence that got three doctrine blocks written wrong and one falsehood shipped into a guard.

## Round 9 — The guard that was defeated by the exact habit it existed to punish

Round 7 built `noUnusedExports.test.mjs` to catch a dead symbol hiding inside a live file. Round 8
found a fabricated count inside a neighbouring guard. Round 9 charged the thing both rounds walked
past: **the tiers that guard discloses but does not enforce, and the four judgement calls parked in
its allowlist.** The docblock names three populations of unconsumed export, enforces one, and states
the size of the other two. Stating the size of what you do not check is the discipline this whole
review has been converging on, so the guard looked like the safest file in the repository.

It was the file with the most unchecked prose in it.

### The finding, as first charged

The allowlist held four entries. Each was a sentence explaining why a dead export was allowed to
stay dead. The charge was narrow and mechanical: **an allowlist reason is a hypothesis with nothing
checking it, so resolve all four.** Not "some of these are probably stale" — the specific claim that
prose sitting next to a passing test acquires the authority of the test without acquiring any of its
verification, and that four sentences written at four different times could not all still be true.

### The measurement, which falsified three of the four in their MECHANISM

Not their verdicts. Every one of the four symbols really was dead. What measurement destroyed was the
stated reason, and all three failures leaned the same way — toward the codebase being better organised
than it is.

`getManifest` was parked as _"callers read the exported array directly"_. `MiniGameManifest.ts:6`
declares `const manifest`, not `export const`. **No caller could ever have read it directly.** The
sentence describes a program that has never existed. Both importers of that module
(`SceneRouter.tsx:4`, `MiniGameRouter.tsx:2`) take `getGameEntry`, and neither wants the catalogue.

`INACTIVE_ICON_BUILDERS` was parked as serving _"portals in the inactive state, which no portal
currently enters"_. **There is no inactive state.** Before the deletion, the string `inactive`
appeared exactly once in `minigames/framework/` — in the constant's own name. The real
unregistered-game path is one line, `ICON_BUILDERS[gameId] ?? buildFallbackSparkIcon`, and it does not
consult the map. Worse, the map's own docblock said it kept eight icon builders _"while still
satisfying the repo's unused-symbol checks"_ — which is a written confession. Eight individually
reportable dead functions were bundled behind one exported name so the guard counted one instead of
eight, and that one name was then allowlisted so it counted none. 237 lines, laundered through a
wrapper whose stated purpose was to beat the check, in the same repository where ~920 lines of
finished animal builders once hid the same way.

`HIT_RADIUS` was parked as _"suspected genuine tuning drift"_ — the honest-sounding entry, the one
that admits uncertainty. It was not drift. It was the losing half of a **completed** world-space to
screen-space migration, labelled `(world-space, legacy)` three lines above the live `HIT_RADIUS_PX =
80` that `fireflies/index.ts:787` seeds `nearestDist` from and that `index.ts:57` derives
`SCENERY_HIT_RADIUS_PX = 95` from. That is architecture-standards.md §11 applied to hit-testing: a
radius in world units shrinks on a phone exactly where a small finger needs it most. Admitting
uncertainty is not the same as having none of the wrong kind.

`MEAN_TRAVEL_DISTANCE` was the only entry whose facts held.

Then the tiers themselves. Measured across the 543 modules reachable from `main.tsx`:

| tier                  | docblock claimed        | measured     |
| --------------------- | ----------------------- | ------------ |
| DEAD (enforced)       | **32**                  | **4**, now 0 |
| DEAD RE-EXPORT        | **69**                  | **86**       |
| EXPORTED-BUT-INTERNAL | _no number_             | **136**      |
| spared-by-corpus      | _tier not named at all_ | **3**        |

The 32 is self-refuting and always was. If 32 dead exports existed, the test three lines below the
sentence claiming it would have failed on 28 undeclared names, and the suite ran green. **A number
was sitting inside the one file in the repository best equipped to disprove it, and the file
disproved it every single run without anybody reading the output.**

The 69 is the more interesting one, because it was not simply wrong. A scratch script written this
round to check it reproduced 69 exactly — and the guard's own counter, once the tiering was made
countable, says 86. Both are right. `testWords` used to be consulted **first**, so any name appearing
anywhere in the test corpus was excluded before the re-export and internal tiers were counted at all.
Those two tiers were silently reporting _"…and not named in any test"_, a qualifier nobody had
written down and nobody could have inferred from the docblock. Moving the corpus check last leaves the
DEAD set bit-identical and grows the other two by 17 and 23. Neither count was a mistake. **The pair
of them without a stated ordering was.**

### The defect underneath all of it

The guard spares any export whose **name** appears anywhere in the test/probe corpus. The docblock
discloses this, and discloses it well: _"a deliberate over-approximation, wrong only in the direction
that spares a symbol, never the direction that condemns one."_ That sentence is true. Round 7 earned
it the hard way — resolving specifiers on the test side had just condemned two live camera helpers,
because a room test writes its entry module as a template literal.

It is true and it is not enough, and the gap between those is this round's contribution.

**Stating which way an over-approximation errs says nothing about what sets it off.** This one's
trigger population is not random. The likeliest way for a name to appear in the corpus without being
imported is a probe hand-copying a tuning constant — `const VISIBLE_BAND_HEIGHT = 7.08; // types.ts`.
And a duplicated tuning number is the **single strongest available evidence that the original has no
readers**. The thing that fires the exemption is anti-correlated with the risk the guard measures. A
guard against unused tuning constants was being switched off, one symbol at a time, by copies of
unused tuning constants.

Verified by mutation, both halves. Renaming that probe's local to `BAND_H`, touching nothing under
`src/`, flipped the real export into the enforced dead list. Changing the probe's literal `7.08` to
`99.99` left **all 24 framework test files at zero failures** — so the copied name is load-bearing for
the guard and the copied value is pinned by nothing at all.

### The fix, and why it is small

53 top-level declarations across `tests/` and `.probe/` shadow a `src` export. That number invites a
53-site migration, which would be the wrong fix: most are coincidental collisions on generic helper
names — `clamp`, `pick`, `seeded`, `rand`, `smooth01` — that are spared by real imports anyway.
**Exactly one of the 53 was load-bearing.** So the fix is not a migration, it is a new enforced tier
plus a standing hazard: a symbol is condemned only when a bare redeclaration is the _sole_ reason it
was spared.

The evidence used is brace-list membership — does any `import {…} from` or `export {…} from` anywhere
in the corpus take this name from anywhere — and it stays **text-matched rather than resolved on
purpose**, because resolving is precisely what produced Round 7's false condemnation, and the
template-literal cases are the ones that must keep being spared. A brace list is the weakest evidence
that is still evidence of an _edge_.

The four parked entries were then resolved for real rather than re-parked: three deletions carrying
NOT-HERE-DELIBERATELY blocks, and `MEAN_TRAVEL_DISTANCE` resolved by converting the prose derivation
under it into arithmetic the program performs — `MIN_FLOAT_SPEED` and `MAX_FLOAT_SPEED` now divide
`VISIBLE_BAND_HEIGHT` by named crossing times instead of asserting in a comment that they came from
it. All three resulting values proved bit-identical to the literals they replaced: 0.6, 1.2, 0.77.
`ALLOWED` is now `{}`, and the enforced DEAD tier is 0.

### Evaluating the fix against the "suck"

The first attempt to prove the new check fires **failed**, and the failure is the most useful thing in
this round.

The plan was to reproduce the original mutation: restore the probe's hand-copied
`VISIBLE_BAND_HEIGHT` and watch the new tier catch it. All six tests passed. Not because the check is
broken — because the _other_ repair in the same round retired the symbol. Making the derivation
executable gave `VISIBLE_BAND_HEIGHT` a reader inside its own module, moving it from the laundered
tier into the internal tier, which nothing enforces. The mutation was true of the tree it was run
against and false of the tree ninety minutes later, and **the thing that invalidated it was my own
fix, in the same round, in a different file.**

So the check had to be proved a different way. `classifyExport` was extracted as a pure function of
five facts, a synthetic canary — `export const R9_LAUNDER_CANARY` appended to a live module, a bare
`const R9_LAUNDER_CANARY` appended to a probe — was confirmed against the repository to make the check
fail naming that exact symbol, and then confirmed to pass again when the probe's copy was changed to a
brace list. Both mutations were reverted. Because that experiment is not repeatable in CI, its shape
is preserved as a test that drives the real classifier over one input per tier, including the two
orderings that are load-bearing: a real import must beat a shadowing redeclaration, and an in-file use
must beat one too. Without those two lines, 52 harmless collisions become 52 false condemnations.

And the tier counts are no longer prose. They are asserted — `{ consumed: 1737, reexport: 86,
internal: 136, spared: 3, laundered: 0, dead: 0 }` — exactly rather than as bounds, so that movement
has to be read by a human. That is the direct answer to the 32: the docblock cannot be wrong about a
number it no longer states.

### What this round does NOT claim

It does not claim the repository has no dead exports. It claims two tiers of six are enforced and the
other four are counted. `internal` at 136 is not audited at all, and `reexport` at 86 is 86 barrel
lines nobody has read.

It does not claim the 53 shadowing declarations are fine. It claims 52 of them are currently harmless
_for this guard_, which is a different sentence. `PROXIMITY_PX` is hand-copied 13 times across the
probes and **nothing pins any copy to `gestureRules.ts`** — every one can drift silently, and the new
tier will not say a word, because `PROXIMITY_PX` has real importers.

> **Correction, added by Round 11; the sentence above is left standing per the rule against
> back-editing a premise.** The number 13 is right and the words around it are not. It counts the
> probe files that obtain `PROXIMITY_PX` **locally** — 6 literals plus 7 regex resolvers — and
> "hand-copied" unions two mechanisms that need opposite fixes. It also **undercounts the population
> by four**: it misses `render/frame-census.mjs`, which binds the same value as `READABLE_PX` and is
> invisible to a name scan; the IIFE in `tests/framework/pirateCoveInteraction.test.mjs`, which is not
> under `.probe/`; and the two sites that were already importing correctly. The true population was
> seventeen sites across four mechanisms. See Round 11 and register entry (xxxix).

It does not claim the brace-list test is sound in general. It is a text match; a name inside a string
that merely looks like an import will spare a symbol. That is deliberate, it is the same
over-approximation as before, and it is now the _smaller_ one.

### The clause this round adds

Round 7 learned to state what an instrument does not check, next to a number. Round 8 learned that a
number is not a measurement until you can say what would have to be true of the world for it to come
out differently. Round 9 turns the instrument on those two rules and finds them insufficient in the
same way: the 32 was a number, attached to a limit, disclosed honestly, and false; the corpus-word
exemption was a limit, disclosed honestly, with the safe direction correctly named, and it was the
hole through which the round's largest deletion was hiding.

What both missed is **population**. So: **for every approximation, name not only which way it errs
but what kind of thing sets it off — because an exemption whose trigger correlates with the defect
is not a limitation, it is a blind spot pointed at the target.**

And a second, smaller clause, earned by the mutation that stopped reproducing: **a mutation is a
statement about a tree, and a tree edited by the same round can stop being the tree the statement was
about.** Evidence that lives in the repository expires when the repository is edited. Evidence that
lives in a test does not. That is why the canary's shape is now a test and not a paragraph — including
this one.

## Round 10 — The copies the new tier could not see, and the digit that hid inside a rounding

Round 9 built the `laundered` tier to catch a hand-copy that had silenced the dead-export guard.
It works, and its reach is exactly one population: copies of exports **nothing else uses**. A copy of
a *live* export is structurally invisible to it, because the original has real importers and the guard
has nothing to complain about.

That is the dangerous population, not the safe one. A dead constant copied into a probe is a nuisance.
A **live** constant copied into a probe is a probe reporting on the running game from a number the
running game does not have — with full confidence, on every run, forever. Round 10 charged that:
**find whether any hand-copied constant in the tests or probes has already drifted from its source.**

### The measurement, which came back split

Two scans, both over `tests/` and `.probe/`.

Scan A looked for the obvious shape: a `SCREAMING_CASE` const bound to a numeric literal whose name
matches an export under `src/`. **Eight hits, zero drift.** Seven are `PROXIMITY_PX = 70`; one is
`PULLBACK_REFERENCE_ASPECT = 0.75` in `render/frame-census`.
**[Correction, added by Round 11; original left standing.** Scan A's stated predicate returns **six**
`PROXIMITY_PX = 70` literals, not seven, and seven hits, not eight. The seven counted here are the
files carrying a bespoke `shippedProximityPx()` **regex resolver** — which are neither `= 70` nor
literals. The count is of one population and the sentence describes another, and because the sentence
is what the next round reads, Round 11 was briefed to fix six literals and found seventeen sites
across four mechanisms. See (xxxix).**]** And the *sources* are genuinely pinned —
mutating `gestureRules.ts` from 70 to 31 fails the suite four times over, starting with
`not ok 60 - thresholds are the documented 10 / 28 / 70 px`. What is pinned by nothing is the copies:
every one can drift silently in the other direction, and the round found none that had. Filed, not
fixed.

Scan B looked for the honest shape instead — any literal whose trailing comment *names a `.ts` file*,
which is what a careful author writes when there is nothing to import. **Six hits, all in one block**,
`.probe/render/r8-species-palette.mjs:66-72`, under the header:

```
// ── The rig, verbatim from the live scene ───
```

Three of the six cite a **docblock**, not code. Their values exist nowhere in the program:
`IRRADIANCE // types.ts:16`, `FISH_DEPTH // types.ts:24`, `SAND_RENDERED // types.ts:25`. And the
first of those was wrong.

### The chain, and the arithmetic that took two attempts to get right

The reef's rig irradiance is the input to every colour decision in the game — the fish palette, the
sand albedo, the water. Until this round it was **derived in a comment** and existed nowhere else:

```
setup.ts   exposure-budget table                 (0.2226, 0.2540, 0.2883)
types.ts   fish-palette docblock                 (0.2225, 0.2540, 0.2889)   hand transcription
.probe/render/r8-species-palette.mjs             cites `// types.ts:16`     copied the copy
```

Three hops, corruption at hop two, a probe treating hop three as source. That much was right on the
first pass. **The mechanism I wrote down was not**, and it had already been written into two source
files before anything checked it. The claim was that the blue had drifted 0.00067 and the red 0.0001,
"in opposite directions, which is what hand-copying looks like and what no rounding rule produces."

The test written to pin the table refuted it, on its first run, before it shipped:

```
    the exposure budget table no longer adds up to the total it states
    + actual - expected
      [ '0.2226', + '0.2540', - '0.2541', '0.2883' ]
```

Computing everything exactly:

```
|dir.y| exact                          = 0.7367094686837572   (the table labelled it 0.737)
key row at full precision              = 0.1688, 0.1621, 0.1486   <- matches the printed row
key row at the LABEL 0.737             = 0.1689, 0.1622, 0.1486   <- does not
hemi row                               = 0.0095, 0.0477, 0.0955
env  0.012 * 3.68                      = 0.0442 flat

full precision, rounded once at the end  ->  0.2226, 0.2540, 0.2882
the printed rows, added as printed       ->  0.2225, 0.2540, 0.2883
what the total row actually said         ->  0.2226, 0.2540, 0.2883
```

**The total row took its red from the first method and its blue from the second.** One method per
channel. Both methods are individually correct; taking one digit from each is not, and no reader could
possibly have caught it, because the table never said which addition it meant.

Which changes the verdict on `types.ts`. Its red, 0.2225, is the **honest row-sum reading** — a
careful reader arrives at it correctly. It never drifted. Its blue is the entire defect: 0.2889
against a table saying 0.2883 and an expression saying 0.2882. **One hand-changed digit, worth
0.00067, hiding inside exactly the last-place ambiguity the mixed-method total had opened up.**

### The defence — why this is an apparatus defect and not a typo

Two things, neither of which is the size of the error.

First, **the probe had been reporting this on every run and nobody could tell.** It prints a
self-check — `worst channel error across 18 recorded values` — which read **1 level**. That is the
probe disclosing its own contamination, honestly, in its own output, and **attributing it to its own
model**. The fitted `LIGHT_GAIN = 1.66` had quietly absorbed most of the rest. A residual credited to
the wrong cause is not a disclosure; it is a number that makes a reader feel informed.

Second, **the probe's header was the actual defect**, not the seven literals under it. `The rig,
verbatim from the live scene` covered two kinds of number that must be handled in *opposite* ways:

- **Program constants** — things the running game reads. A copy is a fork with no merge. These must be
  imported, always.
- **Recorded observations** — numbers read off a real rendered frame. These are **data** and must
  **stay literals**, because a measurement that recomputes itself from current code is a tautology. The
  probe's entire claim to be trusted is that two fitted terms reproduce eighteen recorded values to
  within a level; recompute the eighteen and it reproduces nothing.

One heading over both is what let a program constant sit as a literal without anyone flinching. And
hand-copying was, at the time, **the only honest option available** — every one of those constants was
an inline literal inside a function body. There was nothing to import.

### The fix

Make the constants importable, make the derivation an expression, and split the header.

`environment/setup.ts` gains `REEF_RIG` (key direction, intensities, the four colours, environment
intensity, and the fitted environment radiance — flagged as the one fitted term) and `REEF_WATER`
(background colour and fog density, previously inline literals unreachable by anything wanting to check
a colour). `utils/rendererFactory.ts` gains `TONE_MAPPING_EXPOSURE = 1.15`, named because it is the
last term in the colour chain and therefore every rendered figure recorded anywhere in this repository
is a measurement taken *through* it.

And `reefIrradiance()`, which performs the derivation the comment used to. It is **not consumed at
runtime** — three.js does the shading, not us — and that is the point: it exists so the number the
docs and probes quote is *produced* rather than transcribed.

It takes the rig **as a parameter**, with a default, though there is only ever one rig. That is
Round 9's lesson applied before it could bite: a pin on a returned number cannot tell you whether the
expression behind it is the expression you think it is, and Round 9's mutation-based evidence expired
the moment the tree was edited. With the rig as an argument, a test perturbs one field at a time and
proves every term load-bearing — including the negative case, that swapping x and z in the key
direction must be **invisible** to nine decimal places, or the cosine is being taken from the wrong
quantity.

The probe's copies become an import; its seven literals become four imported constants and three
literals under a second heading that says they are **recorded observations** and must not be
recomputed. The exposure-budget table stays, as the derivation's *shape*, with the mixed-method
history stated inside it rather than quietly corrected away.

### Evaluating the fix against the "suck"

The materiality verdict does not move: 72% palette loss either way, 10.04 → 10.06 dE2000. If that were
the whole measurement the honest conclusion would be that this was bookkeeping.

It is not, because **the probe's own self-check moved from 1 level to 0**. Predicted during the
measurement phase, then confirmed by running the fixed probe. The residual was never the model's. It
was the input's, and the fit had been eating it.

Five tests pin the result. Four passed as written. The fifth is the one that matters, and it is
described below.

### What this round does NOT claim

It does not claim the hand-copy problem is solved. `PROXIMITY_PX` is still copied into seven probes
with **nothing pinning any copy** — the source is pinned, every copy is free to drift, and the
`laundered` tier cannot see it because `PROXIMITY_PX` has real importers. Same for
`PULLBACK_REFERENCE_ASPECT`. This round fixed the copies it caught drifting, and named the population
it did not fix.

It does not claim `reefIrradiance()` models the light. It states, next to the number, that it is flat
sand only — any tilted surface takes a different key cosine and a blend of sky and ground — and that it
omits the accent point light entirely.

It does not claim the environment radiance is derived. `3.68` is **fitted** against measured pixels of
a shipped build. It is the least certain term in the rig and is labelled as such where it lives.

### The clause this round adds

Round 8: a number is not a measurement until you can say what would have to be true of the world for it
to come out differently. Round 9: for every approximation, name not only which way it errs but what
kind of thing sets it off.

Round 10 adds the one it learned about **precision**: **a rounded retelling of a computation is not a
record of it, because a rounded table admits more than one correct last digit, and every extra correct
answer is a place a wrong one can hide unchallenged.** The corrupted blue was worth 0.00067 and
survived three hops and several readings precisely because the table's own last place was ambiguous by
about that much. The repair is not "round more carefully" — it is that the derivation must exist as an
expression somewhere, so the prose becomes a *claim about* a computation with something enforcing it,
rather than the only copy of it.

And a second clause, earned the hard way and the best thing this round produced: **write the check
before you believe your own account of the defect.** The mechanism above was reasoned out, found
convincing, and written into two source files — and it was wrong. The test built to pin the table
refuted it within a minute of first running. Not the verdict; the *story*. Which is the same failure
this review has now recorded at four scales — doctrine blocks (xxvii), allowlist reasons (xxx),
docblock counts (xxviii), and now a round's own freshly-written correction. **Prose written next to a
check inherits the check's authority without inheriting any of its verification, and that remains true
when the prose is mine and five minutes old.**

## Round 11 — One constant, four mechanisms, and a migration that stopped at two

### The charge

Round 10 found the copies its new tier could not see, fixed the one that had drifted, and filed the
rest: `PROXIMITY_PX` and `PULLBACK_REFERENCE_ASPECT`, restated by hand across the probes, with the
sources pinned by the suite and the copies pinned by nothing. "Filed, not fixed" is a promissory note.
Round 11 is the round that pays it.

### The contradiction noticed before anything was measured

Reading back for the charge, the review states the size of this population **twice, in two rounds, and
the two numbers disagree**:

> Round 9, _What this round does NOT claim_: "`PROXIMITY_PX` is hand-copied **13 times** across the
> probes"

> Round 10, _The measurement, which came back split_: "**Eight hits**, zero drift. **Seven** are
> `PROXIMITY_PX = 70`"

Thirteen against seven, in the same document, about the same constant, three hundred lines apart, and
nothing in the repository checks either. So this round opened by writing down what it expected to find,
in `/tmp/r11/hypothesis.md`, before running anything — because a round that measures a contradiction it
has already decided the meaning of will find that meaning:

> **H1.** The two counts measure DIFFERENT THINGS and both are right. […] If so the defect is not
> arithmetic, it is that the review reuses one phrase — "hand-copied N times" — for two different
> predicates. **H2.** One of them is simply wrong. *I expect H1. I expect it strongly enough that I am
> writing it down, which is the point.*

And a second prediction, about the fix rather than the finding:

> The guard above can only see copies that KEPT THE NAME. A copy that renames — `const NEAR = 70;` —
> is invisible to it, and renaming is what a careful probe author does when the local meaning differs
> slightly. So I expect the guard to be a partial instrument, and I expect the honest version of this
> round to be the one that measures HOW partial.

Both of those turned out to matter, in opposite directions. The first was half right. The second was
right, and a real instance of it was sitting in the tree.

### The measurement — four mechanisms for one number

A census over `src/` and over the **191** files under `tests/` and `.probe/` matching
`/\.(mjs|js|tsx?)$/`, classifying every binding by **mechanism** rather than by name. The `src/` side
needs three numbers, not one, and the difference between them is a finding in its own right:

| count | predicate |
| --- | --- |
| **530** | export **sites** binding a SHOUT_CASE name to a numeric literal |
| **488** | distinct **names** among those sites |
| **460** | of those names exported with a single agreed value |
| **28** | exported by two or more modules with values that **disagree** |

The first draft of this section said "488 numeric-literal exports", which is the name count wearing the
site count's sentence. Both numbers were right; the noun between them was not. What the gap turned out
to conceal is in entry (xlii). `PROXIMITY_PX`
(`src/utils/interaction/gestureRules.ts`, `= 70`, the radius the tap controller treats as "near
enough") was obtained **four different ways across seventeen sites**:

| mechanism | what it is | sites |
| --- | --- | --- |
| MODULE | a real import through `bundleEntry` | 2 |
| REGEX-BESPOKE | a 6-line `shippedProximityPx()` resolver, duplicated **verbatim** | 7 |
| REGEX-GENERIC | a local `shipped(file, name)` reader | 1 |
| REGEX-INLINE | an IIFE doing the same thing | 1 |
| LITERAL | `const PROXIMITY_PX = 70;` | 6 |

**Zero had drifted.** Every one of the seventeen said 70.

That is the uncomfortable result, and it is worth being precise about why it is not a clean bill of
health. Seventeen copies agreeing is not seventeen copies being correct; it is seventeen copies that
have not yet been asked a hard question. The question gets asked the first time somebody changes 70,
and on that day fifteen of them are silently wrong and six of them do not even have the decency to
throw.

### The finding that actually matters, which is not "copies drifted"

The right instrument **already existed**. `bundleEntry`, in `tests/framework/_tsload.mjs`, esbuild-
bundles a string of re-exports with `resolveDir` at the package root, so it resolves the `@app`,
`@scenes` and `@game` aliases and hands back a real module namespace. It works. It is documented. Two
sites out of seventeen use it.

So this is not a repository that lacks a way to do the thing properly. It is a repository that **built
the right instrument and then stopped migrating at 12%**, and the fifteen sites left behind did not
merely fail to improve — they became the majority convention. A newcomer reading the probes to learn
how one fetches a shipped constant finds a `shippedProximityPx()` resolver seven times before finding
an import once, and copies the resolver. That is how the population grew to seventeen.

Which is Round 8's lesson running backwards. Round 8 found migrations that **looked** abandoned and had
actually completed, and drew from it that a migration completes by **inversion** — the old way has to
become unavailable, not merely discouraged. Round 11 is the other half of that sentence: a migration
that never inverts does not sit still at 12%, it **loses ground**, because every new site copies what
it sees and what it sees is the old way.

### The defence — why each of the three wrong mechanisms is wrong

**The literal is indefensible and needs no argument.** `const PROXIMITY_PX = 70;` in a probe that then
reports on how the shipped controller behaves is a probe grading the code against a number the code no
longer has to agree with.

**The regex resolvers are the interesting case, because they are careful.** Here is the shape,
duplicated verbatim seven times:

```js
const shippedProximityPx = () => {
  const src = readFileSync(path.join(packageRoot, 'src/utils/interaction/gestureRules.ts'), 'utf8');
  const m = /export const PROXIMITY_PX = (\d+(?:\.\d+)?)/.exec(src);
  if (!m) throw new Error('PROXIMITY_PX not found in gestureRules.ts -- fix this probe, do not guess');
  return Number(m[1]);
};
```

This round predicted, in writing, that these would have a silent fallback — that a miss would default
to 70 and the probe would sail on. **That prediction was false.** Every one of them throws, and the
error message is better than most error messages in this repository: it names the file, tells you what
to do, and explicitly forbids the thing an author under time pressure would do next. Whoever wrote it
was thinking about exactly the right failure.

It is still the wrong mechanism, and for a reason the author could not have designed around: **a regex
over source text cannot survive the constant becoming an expression.** The day someone writes
`export const PROXIMITY_PX = BASE_TOUCH_PX * 2;` — a perfectly ordinary refactor — all seven resolvers
throw simultaneously, in seven probes, and the failure is not "the constant moved" but "seven probes
are broken", which is a much worse thing to read on a Tuesday. An import resolves the expression
because an import runs the program. The resolver is a careful implementation of a mechanism that has a
ceiling; the import has no ceiling.

**And the resolvers cost something else that only showed up when counting.** Six lines duplicated
seven times is forty-two lines whose only job is to avoid one import statement, and — this is the part
the census made visible — because they are seven *separate* copies, nothing was keeping them the same.
They happened to be identical. Nothing checked.

### What the two contradictory counts turned out to be

Both numbers are real counts. Neither counts what its sentence says it counts, and the decomposition
is exact:

```
17 sites obtaining PROXIMITY_PX     =  6 LITERAL
                                    +  7 REGEX-BESPOKE
                                    +  1 REGEX-GENERIC
                                    +  1 REGEX-INLINE   (tests/, not .probe/)
                                    +  2 MODULE

Round 9's "13"  = 6 LITERAL + 6 REGEX-BESPOKE + 1 REGEX-GENERIC
                = the probe files that obtain it LOCALLY, minus the one that renames
Round 10's "7"  = the REGEX-BESPOKE files
```

So **H1 was right about Round 9 and wrong about Round 10.**

Round 9's thirteen is reproducible to the file: `git grep -lE "(const|let) +PROXIMITY_PX *= *([0-9]|shipped)"`
over `.probe/` at `6e58b5b` returns exactly those thirteen paths. The number is correct. What is loose
is the word: "**hand-copied** 13 times" spans two mechanisms that need opposite fixes — six literals
that are simply wrong, and seven resolvers that are careful and merely capped. Calling them one thing
is what let the whole population be filed as one problem.

Round 10's seven is where it goes properly wrong. It reports "Seven are `PROXIMITY_PX = 70`", and only
**six** are; the seven it counted are the *resolvers*, which are not `= 70` and are not literals. Its
stated predicate — "a `SCREAMING_CASE` const bound to a numeric literal" — returns six, not seven, and
its headline "eight hits" returns seven. **The count was of one population and the description was of
another**, and because the description is what the next round reads, Round 11 was charged with fixing
"seven hand-copied literals" and found seventeen sites across four mechanisms.

And Round 9's thirteen misses `frame-census.mjs` for **precisely the reason this round wrote down
before measuring**: that file binds the same constant as `READABLE_PX`, a different name for the same
number, and is invisible to every name-matching scan. It surfaced only because it happened to share a
regex resolver with six siblings — that is, by luck. The predicted blind spot was not hypothetical; it
was already occupied.

### The fix

**All fifteen non-MODULE sites migrated to `bundleEntry`.** Thirteen probes, `frame-census.mjs` (whose
`PULLBACK_REFERENCE_ASPECT` literal was folded into the same bundle), and
`tests/framework/pirateCoveInteraction.test.mjs`, where the IIFE was replaced by appending one line to
the `bundleEntry` call the file **already made** for six other symbols. Seventeen of seventeen now
import. Forty-two lines of duplicated resolver, and the six literals, are gone.

**And the old way made unavailable** — `tests/framework/noCopiedConstants.test.mjs`, three tests, which
fails when any file under `tests/` or `.probe/` binds a SHOUT_CASE name to a numeric literal where
`src/` exports that same name. It fails on **existence, not on disagreement**, because this round's
whole finding is that agreement today is not protection: the message says so in as many words, and
tells you what to write instead.

It is an **AST walk over `ts.createSourceFile`**, not a regex, and that decision was forced by this
round's own instrument failing three times:

1. it matched `PROXIMITY_PX = (\d+)` inside **the resolvers' own regex literals**, inventing eight
   copies that were the *search for* copies;
2. it matched `VISIBLE_BAND_HEIGHT = 7.08` inside a **template literal** — the error message in
   `noUnusedExports.test.mjs` that warns against this exact practice;
3. it matched `GOLDEN_DODGE_DURATION = 0.3` inside a **docblock** in `little-shark-dodge.test.mjs`,
   which quotes the declaration it documents and imports the real one on line 42.

Three false positives, every one from source that was *discussing* a constant rather than binding one.
A guard with a 100% false-positive rate on its first run acquires an allowlist within a week, and this
review already knows what lives in allowlists — see (xxx), three entries describing programs that never
existed. A comment is not a node and a string is not an initializer, so `ts` cannot make any of the
three mistakes by construction.

### Evaluating the fix against the "suck"

Not by reading it. By breaking it.

**The guard was mutation-tested.** Two copies were appended to `.probe/render/r6-band.mjs` — one
agreeing, one drifted — and it caught both, named both, and distinguished them:

```
not ok 1 - no test or probe restates a constant that src/ exports
  .probe/render/r6-band.mjs:125  const PROXIMITY_PX = 70;      (…gestureRules.ts — agrees today)
  .probe/render/r6-band.mjs:126  const VISIBLE_BAND_HEIGHT = 99.9;  (…bubble-pop/types.ts — ALREADY DRIFTED, src says 7.08)
```

**The guard has a test against being vacuously green**, because Round 9's lesson is that a green
assertion over an empty set is indistinguishable from a green assertion over a set that was never
populated: it asserts `src/` yields more than a hundred constants, that `PROXIMITY_PX` is still among
them, and that the walk finds synthesised copies both at top level and nested inside a function. And a
third test pins the three false-positive shapes above as fixtures that must stay invisible.

**A migrated probe was run end-to-end**, not merely parsed — `.probe/render/r6-band.mjs` under
playwright, printing `proximity radius 70px (shipped)` from the imported value and completing its full
census. `node --check` proves a file parses; it does not prove `bundleEntry` survives a probe's
top-level await, and the difference between those two claims is the whole point of this round.

**The temporal-dead-zone bug this predicted, it had.** `frame-census.mjs` ended up destructuring
`RULES` seven lines *before* `const RULES = await bundleEntry(...)` declared it — a `ReferenceError` at
load that `node --check` passes cheerfully, because it is a scoping error and not a syntax error.
Caught by reading the diff for it specifically, having written down that it was the likely failure.

Full suite **428 pass, 0 fail** (was 425; the guard adds three). `tsc -b` clean, ESLint clean, Prettier
clean.

### What this round does NOT claim

It does not claim the corpus no longer restates shipped constants. The guard has four blind spots, and
they are written into the file next to it rather than left to be discovered:

- **Renamed copies.** `const READABLE_PX = 70;` is invisible to it. This is not a hypothetical — it is
  the exact shape of `frame-census.mjs`, which escaped every scan in this round and surfaced by luck.
  A probe author renames when the local meaning differs slightly, which is *good practice*, so this
  blind spot sits precisely where careful people work.
- **Bare inline literals.** `if (distance < 70)` binds nothing. Measured at **42** lines, under this
  predicate and no other:

  ```
  grep -rInE '(^|[^A-Za-z0-9_.])70([^0-9.]|$)' tests .probe \
    --include='*.mjs' --include='*.js' --include='*.ts' --include='*.tsx' --include='*.cjs' \
    | grep -v PROXIMITY_PX | wc -l
  ```

  The predicate is written out because the first attempt returned **85**, and the 43-line difference
  was 48 PNGs and 10 probe `.txt` logs under `.probe/*/out/` — grep matching bytes inside binaries,
  and matching a probe's **recorded output** as though it were source. A probe log reading
  `within 70?` is an observation *of* the program, not a copy of a constant, and the distinction is
  the same one Round 10 drew between a program constant and a recorded observation. Of the 42, ten are
  in `gestureRules.test.mjs` — which tests the function, so passing it 70 is a *pin*, not a copy —
  three are in the guard's own footer, which is to say the measurement counts its own documentation,
  and most of the rest are docblock prose and `console.log` column headers. A value-based scan cannot
  tell a copy from a coincidence. That is not a threshold to tune; it is what a bare number **is**.
  Hence a fix that makes copying unnecessary rather than a better detector.
- **Exports that are expressions.** `export const X = BASE * 2;` is not collected, so a copy of X's
  value is not flagged. Self-limiting in a useful direction: an expression is exactly what a resolver
  could never have read either.
- **Anything outside `tests/` and `.probe/`.**
- **Names that are not constants.** Added after the guard was written, green, and believed finished:
  **28** SHOUT_CASE names are exported by more than one module with *different* values — `CEILING_Y`,
  `FLOOR_WIDTH`, `ROOM_DEPTH` and six more across the three room layouts; `BODY_HEIGHT`, `CAP_RADIUS`,
  `STEM_Y` and a dozen more across sibling prop folders. For these, "the value `src/` exports" does not
  exist, so the guard declines to have an opinion and a probe copying the kitchen's `CEILING_Y` is not
  caught. That is the honest trade, and it is better than what the guard did before: see (xlii).

It does not claim `PULLBACK_REFERENCE_ASPECT` received the same treatment. Its one literal was folded
into `frame-census.mjs`'s bundle; nobody surveyed it the way `PROXIMITY_PX` was surveyed.

It does not claim the census that produced the four-mechanism table is sound as a general instrument.
It was wrong three times in one afternoon and has been retired in favour of the AST walk.

### The clause this round adds

Round 8: a number is not a measurement until you can say what would have to be true of the world for it
to come out differently. Round 9: for every approximation, name not only which way it errs but what
kind of thing sets it off. Round 10: a rounded retelling of a computation is not a record of it; and
write the check before you believe your own account of the defect.

Round 11 adds the one about **counts**: **a count is a predicate plus a number, and shipping the number
without the predicate is shipping nothing, because the next reader will supply a predicate of their
own and it will not be yours.** Round 9's thirteen and Round 10's seven were both *correct*. Both were
described in words that named a different population than the one counted, and the cost was not a wrong
figure in a document — it was that Round 11 was dispatched to fix six literals and found seventeen sites
across four mechanisms. **The prose around a number is not commentary on the measurement. For every
subsequent reader, it *is* the measurement.**

And a second clause, which this round earned by committing the offence it was in the middle of
diagnosing. Mid-migration, "for consistency", thirteen probes were switched from the `./src/…`
specifier form to the `@app/…` alias — a form used by **37 of 510** specifiers in the corpus, against
473 for the one being abandoned. A round whose entire subject is *migrations that stop partway leave
two conventions and hand the majority to the wrong one* had just moved thirteen files to the 10%
convention and would have shipped it. It was caught by a grep for leftovers that returned the
leftovers as the **majority**. **Before changing a convention, count both conventions; "for
consistency" is a claim about a distribution and is worthless until the distribution is on the
screen.**

And a third, which arrived last and nearly did not arrive at all. The sweep run to verify this
section's own numbers reported three of them wrong. Two were. The third — 488 — was correct, and the
sweep had reached its contradiction by silently counting export *sites* where the text counted
*names*. The first clause above, applied to the instrument enforcing the first clause above. Had the
correction been applied as reported, a right number would have been replaced with a wrong one under
the banner of verification. But the useful part is what happened when the disagreement was
investigated rather than resolved by seniority: the 42-declaration gap between the two counts turned
out to be twenty-eight names that `src/` exports with *conflicting values*, which meant the guard —
already written, already green, already mutation-tested — was resolving `CEILING_Y` by directory-walk
order and stood ready to accuse a probe of drifting from a room it had never referenced. So:
**a disagreement between two measurements is itself a measurement, and the first question is never
which one is right, it is which predicate each one used.** The corollary, from the defect it turned
up: **an anti-vacuity check proves the instrument is looking at something; it does not prove the
instrument's data structure can represent what it is looking at.** `shipped.size > 100` was a real
check that a `Map` was populated, and it could not notice that keying by name had encoded the
assumption that a name identifies a thing — an assumption already false twenty-eight times before the
first assertion ran.

## The apparatus register

Every defect this review found **in its own instrument**, in discovery order, with the round that
found it. It is kept as one list because the single most repeated lesson across four rounds is that
the probe was wrong more often than the code was, and a reader who only sees each round's local
account will not feel the size of that. Numbers are stable and are cited from probe sources; they
are never re-indexed.

Round 1's (i)–(vii) are described in full under _Seven defects in the apparatus_ above and are only
named here.

**(i)** The gsap clock defect — `updateRoot`'s frame and `globalTimeline.time()` differ by
`startTime()`, and `ticker.sleep()` is not a latch. Produced a false zero; voided a whole scan.
**(ii)** Bar (c) was ill-posed; amended to `ambientInMask`, with both verdicts printed forever.
**(iii)** The exclusion criterion and the finding were the same predicate — skipping `emitted === 0`
rows would have skipped exactly the broken handlers and reported a clean sweep.
**(iv)** A scene transition graded as tap delight and passed, because its navigation fired after its
row was written; repaired by a quiescence loop that asserts its own budget.
**(v)** The reference burst was emitted **inside** the prop, so `sparkleHigh` came back 0 and an
emit-nothing prop would have scored `Infinity` and passed for free.
**(vi)** The scan fired once per **pick mesh**, so rows two-through-four of a latched prop read
`propHigh 0` — this round's own charge, in this round's own words, against the props it had just
repaired.
**(vii)** Rows were not independent, and the end-of-scan assertion could detect a **lost** navigation
chain while being structurally blind to a **stolen** one.

> **Correction owed and now stated, 2026-07-30.** (vii)'s explanation says the owl's flight to the
> toybox is driven by the **frame** clock. That is wrong: `flyTo` is built on a gsap timeline, so it
> runs on the gsap clock like everything else. The **observation** — `lampBulb` reading
> `navigateTo:nature` five rows after the prop that asked for it — is unaffected, and so is the
> repair, because the fence advances **both** clocks unconditionally. What is retracted is the
> diagnosis of which clock was starved. The honest version is that I did not determine why eight
> iterations failed to complete the chain, and the fence works because it stopped asking.

**(viii) The deferred-draw cost artefact.** _(Round 2.)_ Reading pixels back from the GPU per step
dominates the scan's cost, so a scan's runtime is a function of how often it looks, not of what it
is looking at. Relevant because it is what made a full Nature scan ~2.5 h and therefore what forced
the `only` filter in (xiii); recorded so that nobody later reads a step-size change as a fidelity
change.

**(ix) Direct-handler instrument blindness.** _(Round 2.)_ `__firePropMuted` calls the registry's
handler **directly**, bypassing `interactionController.fire`. It is therefore structurally incapable
of observing `fire`'s own contribution — the miss cue, the shared sparkle, the sound-count
suppression. Every claim in this review about what a child _hears first_ rests on
`__tapThroughCanvas` instead, and any row sourced from `__firePropMuted` is evidence about a handler,
never about a tap.

**(x) The sixty-second retap window.** _(Round 2.)_ Several props gate their full reaction behind a
cooldown, so a prop measured twice inside that window returns its degraded answer the second time.
Scans are ordered and budgeted so no prop is fired twice within it; a probe that re-aims at a prop
(as Round 4's evaluation does, retrying pick meshes) must treat a second aim at the **same** prop as
suspect rather than as a fresh sample.

**(xi) Source-text pins.** _(Round 3.)_ A test that greps a source file can prove the file contains
a line. It cannot prove a running body **reaches** that line. Several pins in this review are of that
kind and each one says so where it is used. They are worth keeping only as regression fences against
a specific known-bad refactor, never as evidence that behaviour is correct now — the runtime tables
are that evidence.

**(xii) `__missSweep`'s artefact reaching `emits`.** _(Round 3.)_ The sweep's own probing taps
deposited particle presets into the recorded `emits` list, so a prop could appear to have emitted
something it never emitted. Isolated by clearing the recorder between the sweep and the measurement;
noted because it is the second time (after (v)) that the reference machinery contaminated the thing
it was a reference for.

**(xiii) The `only` filter, and what a sampled run cannot say.** _(Round 4.)_ `__reactionScan` now
takes a third argument, a RegExp source, applied **after** grouping and **after** the pre-fire census
prints — so skipping a group can never change how the remaining groups are grouped, named or
measured. It is a **sampling** tool and not a cheaper scan: a filtered run cannot show that the
graded props are the worst props in their scene, and cannot catch a regression in a prop it did not
fire. Any round that uses it owes an unfiltered whole-scene run somewhere; in Round 4 the Pirate Cove
was that run, and the two cove runs — one filtered, one not — agree on the control props, which is
the evidence that the filter is the no-op it claims to be.

**The false-PASS-on-an-idle-animated-prop hazard.** _(Round 4, a hazard rather than a defect: it was
found before it produced a wrong number.)_ A portal idles with `repeat: -1` bob and spin. A pixel
instrument pointed at a continuously animating prop reads motion whether or not the tap did
anything, so a broken portal could have passed bar (a) on its idle alone. Neutralised by the freeze
at `room.ts:1693`: `__freezeIdles` (`room.ts:2011-2015`) pauses every **currently running** tween and
returns a resume thunk — and the "currently running" qualifier is exactly what makes it correct here,
because the tween the tap creates _after_ the freeze still animates and is still measured.

**(xiv) A lifetime-count assertion inside a routine meant to compose.** _(Round 4; described in full
under *The apparatus defect this round found*.)_ The attribution guard from (iv) compared its per-row
tally against `__navCalls()`'s **lifetime** length, so any real tap taken before the scan started —
such as the evaluation probe's own bar-(b) taps — made it throw. Repaired by capturing `navAtStart`
and comparing the delta. Two things are worth keeping from it. First, the repair is what made the
guard survive being **used**, rather than only being run in the one order its author happened to
test. Second, that repaired guard immediately earned itself: it caught the deferred-launch
misattribution the fix itself created, one round after being fixed. The general rule the round wrote
down is broader than the bug — **any probe that taps a deferred-navigation prop and then measures
something else owes a drain.**

**(xv) The exclusion criterion and the finding were the same predicate — again, four rounds after
(iii).** _(Round 5.)_ `r5-nature-voice.mjs` run 1 printed **`H2 REFUTED`** when the charge was true.
Its test for "this tap hit nothing" was: exactly one sound, that sound is the miss cue, a sparkle
was emitted. That is a true description of a genuine miss — and **also** a true description of every
voiceless Nature prop, which was the entire finding. The run discarded 34 of its 35 rows as misses
and graded the survivor. Repaired not by patching the predicate but by adding **positive
identification**: `__tapThroughCanvas` now wraps every live-registry handler for the duration of the
tap and returns `hit: string | null`, so `hit === null` means the controller picked nothing and can
mean nothing else, and a non-null `hit` that is not the aimed-at prop is an **aim artefact**. The
general form is worth more than the instance: **whenever a probe infers "nothing happened" from a
signature, check that a broken prop does not produce the same signature.** This is (iii) wearing a
different coat, and it was written down in Round 1.

**(xvi) A single centroid aim cannot reach an occluded prop, and reports it as DRIFTED rather than
as UNREACHABLE.** _(Round 5.)_ The `log` row aimed at the log's centroid and hit
`portal_bubble-pop_b`, which sits in front of it; both runs produced the identical drift, so it is
geometry and not noise. The census then **correctly** refused to grade the row — the failure is one
level up, in the reader: "ungraded" was silently doing duty for "untested", and the round would have
claimed a prop it never fired. Repaired by an appended pass that rings out from the centroid until an
aim positively lands, and that reports `UNREACHABLE` as an honest third answer. The general rule:
**a count of graded rows is not a count of covered props, and a probe that cannot say which props it
failed to reach is not reporting its own coverage.**

**(xvii) The census filter that is right everywhere else and wrong here.** _(Round 5.)_
`__propTargets` consumers filter out `background: true`. That is correct for every purpose the
filter was built for — background props exist so raycasts read **past** them — but the stream is
marked background and still has a tap handler and a voice of its own, so it was excluded from the
voice census **by construction** and its answer was never measured. Recorded because it is the
mirror image of (iii): not an exclusion that swallows the finding, but an exclusion that swallows a
subject, silently, on a criterion that has nothing to do with the question being asked.

**(xviii) I read a number the harness reports without reading the scope the harness documents for
it, and nine rows failed a bar that applies to two.** _(Round 5.)_ `r5-nature-picture.mjs` graded
every measured row on `propHigh > sparkleHigh` and printed **`BAR (b) FAILED for mush_cap ×5,
leaf_cover, stone_cover, bfly_body ×2`**. `room.ts` had already documented, before that file was
written, why the ratio is not universal: `propHigh` is measured **with the particle engine muted**,
so for a prop that draws the miss's own burst the ratio compares the prop's tween _alone_ against a
whole burst, while what the child sees is the tween **and** that burst. "A prop that emits
`sceneSparkle` with no overrides… contains the miss's answer and cannot be smaller than it — no
framebuffer required. The rows where that deduction is unavailable are exactly the rows that emit
nothing." Seven of the nine reported failures were that malformed comparison; `mush_cap` at 0.20 does
not mean the bounce moves a fifth of a sparkle's pixels, it means the bounce _alone_ does, on top of
the sparkle it also draws. **The two survivors were real**, and were the two the round had predicted
after correcting its earlier butterfly error.

It is filed as an apparatus defect rather than a typo because of what it would have done had the fix
been good. A corrected run in which every prop passed would still have printed FAILED for the
sparkle-emitting majority, and the natural response to a bar that fails on props nobody touched is to
conclude the bar is too strict and relax it. The failure mode is not a wrong number but **a wrong
number aimed at the bar itself**, and the noise ran three and a half times louder than the signal it
sat on. It joins (iii) and (xv) as a third instance of one family: the predicate deciding _who is
graded_ doing work it was never checked to be capable of. The rule worth keeping: **when a harness
documents the scope of its own verdict, the scope is part of the measurement** — reading the number
without the scope is not a shortcut, it is a different experiment.

**(xix) The deduction was genuinely too narrow, and fixing my reading of it exposed that.** _(Round
5.)_ Applying (xviii)'s corrected rule left the **stone** still graded on the ratio, because it
answers with `sceneDust` and the documented deduction covers only the miss's own preset. That is not
bookkeeping. `propHigh` is particle-muted, so the stone's shift was being compared against a whole
burst while the dust it actually draws counted for nothing — a bar shaped to be satisfied by
**drawing fairy sparkle over soil**. An instrument that pushes the app toward a worse-fitting frame
in order to be measurable is worse than no instrument, because it is persuasive. Repaired by growing
`__reactionScan` a **fourth pass**: `__replayAsked` re-emits the captured `particles.emit` argument
tuples into the live engine under the miss pass's own frozen conditions, giving `ownHigh`, and the
deduction generalises from "draws the miss's burst" to "draws a burst no smaller than the miss's". It
is a replay and not a re-fire on purpose — re-firing is barred by the handler latches (a reveal
reveals once) and would re-run the tween, mixing the two terms the decomposition exists to separate.
What it still cannot say is stated where it is used: it shows the burst the prop **asked for** is at
least as large as the miss's, not that the prop drew it on the tap frame; that the handler asked at
all is the muted pass's finding, and the two together are the claim.

**(xx) The test written to prevent overclaiming overclaimed, within a minute of being written.**
_(Round 6.)_ `precommitGate.test.mjs`'s docblock-count assertion failed on its first run, reporting
**eight gates against seven claimed**. There are seven. The regex `run(Check|Node)\(` also matched
`runNode(label, ...)` inside `runCheck`'s own body — the delegation between the two helpers — so the
instrument counted plumbing as coverage. Requiring a quoted literal label (`run(Check|Node)\('`)
fixed it. A one-character repair, filed anyway because of its **direction**: the miscount said _"you
have more coverage than you do"_, which is the same sentence as the finding the whole round is about,
reproduced by the pin built to prevent it. The generalisation is uncomfortable and worth keeping: a
test that counts things is itself a measuring instrument and inherits every hazard in this register —
including the one it was written to close.

**(xxi) A repo-wide grep counted generated bundles as evidence, and reported dead code as live.**
Round 7, verifying a subagent's audit. My own sweep grepped `src/` and appeared to contradict it on
`getMasterGain`, `getMusicGain`, `getAmbientGain` and `SCENE_IDS`, showing live references. Every hit
was inside `src/.tstest-tmp/` — a gitignored directory of generated test bundles. The subagent was
right and my instrument was the defective one. Direction: **flattering** — a sweep that includes
build artifacts reports "nothing to do here."

**(xxii) The export guard called three shipping scenes dead.** Round 7, first run. A literal
`import('x')` resolves to a namespace object and names no export in any brace list; `sceneCatalog.ts`
lazy-loads every scene that way, so `createScene` for the kitchen, living room and playroom all read
as unreferenced. Direction: **condemning** — acting on it would have deleted three scenes a child can
walk into, with a green build, because the only reference is a string.

**(xxiii) A test that bundles source from a template literal is invisible to a resolver.**
Round 7. `tests/room/scene-sky-fog-contract.test.mjs` builds a synthetic entry module as a string;
its `export {...} from './src/utils/cameraPresets'` resolves against the test's own directory, hits
nothing, and the usage disappears — condemning two live camera helpers. Direction: **condemning**.
Fixed by refusing to resolve on the test side and over-approximating instead.

**(xxiv) The allowlist marked its own subjects as alive.** Round 7, and the one worth the entry on
its own. The new guard treats any name appearing in the test corpus as used; its own ALLOWED keys are
string literals in a file inside that corpus. Every entry therefore declared a symbol dead and, by
declaring it, made it look alive — failing the staleness check on all four at once. The symptom is
comic. The general form is not: **any dead symbol named in the guard that reports it would be
silently spared, and the guard would grow quieter the more debt it recorded.** Direction:
**flattering**. Fixed by excluding the guard's own source from its own corpus, with the reason
written next to the exclusion.

**(xxv) A grep count shipped inside a guard, dressed as an import count, and stood for months.**
_(Round 8.)_ The reachability allowlist's `utils/idle/idleAnimator.ts` entry read _"all 17 consumers
import `utils/idle/idleAnimator` directly"_ — offered as the reason the `utils/idle/index.ts` barrel
was unnecessary. **Exactly one file imports it.** The other sixteen mention it, and reach the animator
through `utils/idle/registry.ts`, which is already the public surface — which is the real reason a
second one had nothing to offer. The conclusion was right and the evidence for it was fabricated by
the instrument. What makes this an apparatus defect rather than a typo is where it lived: inside a
list of thirteen sentences that **nothing checks**, so a false sentence and a true one are
typographically identical and no reader can tell them apart. Direction: **flattering** — it made the
codebase's routing look better understood than it was. Fixed by moving the subject matter into
`noAbandonedMigrations.test.mjs`, where every claim carries a number a test recomputes from import
edges. This is the third wrong verdict grep has produced in this review (after Round 7's rubber ducks
and the `lifecycle` docblock match) and the first one that shipped.

**(xxvi) The new register made the exact substitution it was built to prevent, on its first run.**
_(Round 8.)_ `noAbandonedMigrations.test.mjs` exists to keep module-importer counts and symbol-caller
counts apart, because conflating them is what produced (xxv). Its own first draft filled the
`oldApiCallers` fields with **module** counts — 5, 3, 4 — and its second test rejected all three
checkable entries immediately: `createGameLighting` has 3 callers not 5, `createSceneCamera` 2 not 3,
`createWorldScene` 2 not 4. The instrument caught its author inside sixty seconds. Filed for the same
reason (xx) was: **a test that counts things inherits every hazard in this register, including the one
it was written to close**, and the only thing that separated this instance from (xxv) is that this
one recomputes. The distinction has now cost this review two wrong tables, so it is asserted in the
file rather than trusted. Direction: **condemning**, and caught by design.

**(xxvii) I wrote three doctrine blocks from remembered numbers, before measuring, and measurement
falsified all three.** _(Round 8.)_ The NOT-HERE-DELIBERATELY blocks for the idle, interaction and
lighting barrels were written first, each explaining a deletion in terms of an adoption count I was
confident of (idle 0-vs-17, interaction 0-vs-7, lighting 0-vs-1). Every one was wrong, and the
lighting and interaction ones were wrong in a way that _inverted the conclusion_ — I had written them
as evidence of unadopted migrations, and they are finished migrations that completed by inversion.
Each block was rewritten, and the falsehood recorded **inside** the corrected text rather than
quietly replaced, per the standing rule against back-editing a stated premise. Direction:
**flattering** — a doctrine block is written to be believed by the next reader precisely because
nothing checks it, which is the same structural defect as (xxv) at the scale of a single file.
The rule this one earns is the round's own clause: **state the suspected mechanism before measuring,
so that measurement can embarrass you** — which it did, three times, on paper, which is the only place
it is cheap.

**(xxviii) The guard stated a dead-export count that its own green run disproved, every run, for
months.** _(Round 9.)_ `noUnusedExports.test.mjs`'s docblock read _"DEAD (32 names, ENFORCED
BELOW)"_ while `ALLOWED` held four entries and the suite passed. Those two facts cannot both be true:
32 dead exports with 4 declared would have failed the test on 28 undeclared names. The measured count
was 4. What makes this an apparatus defect rather than a stale comment is **where** it sat — inside
the one file in the repository best equipped to refute it, being refuted on every CI run, with nobody
reading the refutation, because a passing test prints nothing. Direction: **flattering** — it made the
enforced tier look eight times larger and therefore eight times more diligent than it was. Fixed by
deleting every number from the docblock and asserting the six tier populations in a test instead.

**(xxix) An over-approximation disclosed its safe direction and concealed its trigger, and the
trigger was the defect.** _(Round 9, and the one worth the entry on its own.)_ Round 7 fixed (xxiii)
by refusing to resolve specifiers on the test side: any exported name appearing as a whole word
anywhere in the test/probe corpus counts as used. The docblock says so plainly — _"wrong only in the
direction that spares a symbol, never the direction that condemns one."_ True, and useless, because
the population it spares is not random. **The likeliest way for a name to enter that corpus without
an import is a probe hand-copying a tuning constant, and a duplicated tuning number is the strongest
available evidence that the original has no readers.** A guard against unused constants was being
silenced by copies of unused constants. Verified by two mutations: renaming a probe's local
`VISIBLE_BAND_HEIGHT`, touching nothing under `src/`, flips the real export into the enforced dead
list; changing that same local's value from `7.08` to `99.99` leaves all 24 framework test files at
zero failures, so the name is load-bearing and the value is pinned by nothing. Direction:
**flattering**. Fixed by a new enforced tier that fires only when a bare redeclaration is the sole
reason a symbol was spared — 53 declarations shadow a `src` export, exactly one was load-bearing,
which is why the repair is 30 lines and not a 53-site migration.

**(xxx) Three of four allowlist reasons named mechanisms that do not exist in the codebase.**
_(Round 9.)_ `getManifest` — _"callers read the exported array directly"_; the array is `const`, not
`export const`, so no caller ever could. `INACTIVE_ICON_BUILDERS` — _"portals in the inactive
state"_; before the deletion the word `inactive` appeared exactly once in `minigames/framework/`, in
the constant's own name. `HIT_RADIUS` — _"suspected genuine tuning drift"_; it was the losing half of
a finished world-space to screen-space migration, doc-labelled `legacy` three lines above its live
replacement. Only `MEAN_TRAVEL_DISTANCE` held. All three failures leaned the same way. This is (xxv)
and (xxvii) at a third scale — an allowlist reason is a doctrine block with an even better disguise,
because it sits inside a test file, and the reader's eye grants it the test's authority without the
test granting it any verification. Direction: **flattering**. Fixed by resolving all four for real
and emptying `ALLOWED`, with the falsified mechanisms recorded in the file rather than deleted.

**(xxxi) A wrapper existed for the stated purpose of defeating the check, and said so in its own
docblock.** _(Round 9.)_ `INACTIVE_ICON_BUILDERS` bundled eight dead icon builders — 237 lines —
behind one exported name, and its docblock explained that this kept them _"while still satisfying the
repo's unused-symbol checks"_. Eight individually reportable symbols became one; that one was then
allowlisted and became none. Not a measurement error and not a false verdict: **a structure whose
function is to reduce a guard's reported count without reducing what the guard exists to find.** It is
listed here because the register is for things that make the apparatus lie, and a laundering step
makes it lie more efficiently than any bug in it could. It is also the exact shape of the ~920 lines
of animal builders that motivated the guard in the first place, which means the defect class survived
its own countermeasure by wrapping itself. Direction: **flattering**. Fixed by deleting all 237 lines,
with the recovery route recorded; `tsc` then found `createBox`, a second-order dead helper one level
away that no reviewer had looked for.

**(xxxii) The round's own fix retired the round's own mutation, and the mutation still passed.**
_(Round 9.)_ (xxix) was proved by a mutation on the r8 bubble probe. Re-run at the end of the round to
confirm the new check fires, it passed — the check did not catch the restored hand-copy. The check was
correct: a _different_ repair in the same round had made `VISIBLE_BAND_HEIGHT` readable inside its own
module, moving it into the unenforced internal tier before the new check could see it. Filed because
the failure mode is invisible in exactly the wrong circumstance: **a green run of a check that cannot
fire is indistinguishable from a green run of a check that can**, and the thing that had disabled it
was my own commit an hour earlier. Direction: **flattering** — it would have licensed shipping an
unverified guard while believing it verified. Fixed by extracting `classifyExport` as a pure function
and proving all six tiers reachable in a test, after first confirming the two enforcing tiers against
the live repository with a planted-and-removed canary.

**(xxxiii) The probe reported the defect on every run, as a residual it credited to its own model.**
_(Round 10, and the one that would have been caught soonest by anyone actually reading output.)_
`.probe/render/r8-species-palette.mjs` prints a self-check — _"worst channel error across 18 recorded
values"_ — and it read **1 level** for as long as its rig block was a hand-copy. That single level was
not model error. It was the copy: the probe's `IRRADIANCE` was transcribed from `types.ts:16`, whose
blue channel is wrong by 0.00067, and the fitted `LIGHT_GAIN = 1.66` had absorbed most of the rest of
the discrepancy into itself. Importing the real value drops the self-check to **0 levels** —
predicted before the fix, confirmed after. Direction: **flattering**, in the subtlest available way:
the probe was disclosing its own contamination, honestly, in its own printed output, while
**attributing it to the wrong cause**. A residual credited to the wrong term is not a disclosure; it
is a number that makes a reader feel informed. The rule: **a self-check is only a check if you can say
what would have to be true for its residual to be zero.**

**(xxxiv) A four-decimal table took one channel from one rounding method and another channel from a
different one, and nothing in the repository could disagree.** _(Round 10.)_ The exposure budget in
`environment/setup.ts` printed three rows and a total. Computing at full precision and rounding once
gives `0.2226, 0.2540, 0.2882`; adding the printed rows as printed gives `0.2225, 0.2540, 0.2883`.
The total row said `0.2226, 0.2540, 0.2883` — **red from the first method, blue from the second**.
Both methods are correct, the table never said which it meant, and no reader could have caught the
mix. That is the entry: not the inconsistency itself, which is worth 0.0001, but that it opened a
**last-place ambiguity of about 0.00067 in every channel**, and the one genuinely hand-corrupted digit
downstream — `types.ts`'s blue, `0.2889` — is worth exactly 0.00067 and hid inside it. The tidy
diagnosis, that `types.ts` had drifted in *both* red and blue, is false; its red is an honest row-sum
reading. Direction: **flattering** — a derivation stated to four places reads as more rigorous than a
derivation stated to one, and the extra digits were doing the opposite of rigour. Fixed by making the
derivation an expression (`reefIrradiance()`) and asserting every printed row against it.

**(xxxv) One header covered two kinds of number that must be handled in opposite ways.** _(Round 10.)_
`// ── The rig, verbatim from the live scene ───` sat over seven literals. Four were **program
constants** — things the running game reads, where a copy is a fork with no merge and the only correct
handling is to import. Three were **recorded observations** — values read off a real rendered frame,
which are data and must **stay** literals, because a measurement that recomputes itself from current
code is a tautology, and this probe's entire claim to be trusted is that two fitted terms reproduce
eighteen recorded values to within a level. Mixing them under one heading is what let a program
constant sit as a literal for months without anyone flinching, and it is why the fix is a *split
header* rather than "import everything". Not a wrong number and not a wrong verdict: **a category
error in the apparatus's own labelling, which made the right handling of each kind unavailable to the
reader.** Aggravating circumstance, and the reason this is filed against the apparatus rather than the
author: hand-copying was the only honest option available at the time — every one of the four
constants was an inline literal inside a function body, and there was nothing to import.

**(xxxvi) The round's own correction was falsified by the round's own test, after being written into
two source files.** _(Round 10.)_ The mechanism of (xxxiv) was reasoned out, found convincing, and
committed to prose in `setup.ts` and `types.ts`: that the blue had drifted 0.00067 and the red 0.0001
"in opposite directions, which is what hand-copying looks like and what no rounding rule produces."
Then test 5 of `little-shark-rig.test.mjs` ran for the first time and returned
`expected '0.2541', actual '0.2540'`, and the exact recomputation that followed showed the red had
never drifted at all. Nothing was wrong with the *verdict* — the blue really was hand-changed — and
everything was wrong with the *story*, which is the more durable of the two, because it is what the
next reader inherits. Direction: **flattering**, and specifically flattering to the round writing it.
Filed because it is the fourth scale at which this review has now recorded one mechanism: doctrine
blocks (xxvii), allowlist reasons (xxx), a guard's own docblock count (xxviii), and now a correction
five minutes old. **Prose next to a check inherits the check's authority without inheriting its
verification, and that stays true when the prose is yours and you have just finished reasoning it
out.** Fixed by rewriting the prose in all three files, recording the falsification *inside* the
corrected text per the standing rule against back-editing a stated premise, and rewriting the test to
check the table against the **expression** rather than against itself.

**(xxxvii) The round's own census was a regex, and it was wrong three times, in three different
ways, all of them the same way.** _(Round 11.)_ The instrument built to measure how the corpus obtains
shipped constants matched `(?:const|let) +([A-Z][A-Z0-9_]*) *= *(...)` over raw source, and therefore
counted: eight bindings inside **the resolvers' own regex literals** (`/export const PROXIMITY_PX = (\d+)/`
— i.e. it counted the search for copies as copies); one inside a **template-literal error message** in
`noUnusedExports.test.mjs`, which is the string warning authors not to do this; and one inside a
**docblock** in `little-shark-dodge.test.mjs` that quotes the declaration it documents while importing
the real one nine lines later. Direction: **inflating**, and inflating in favour of the round — a
larger population is a better finding. Corrected by hand mid-round (16 real bindings, not 24), and
then structurally: the guard that shipped is an AST walk over `ts.createSourceFile`, which cannot make
any of the three mistakes, **because a comment is not a node and a string is not an initializer.** The
sharpest thing about this entry is its subject: the round arguing that source must be *imported rather
than pattern-matched* was pattern-matching source to make the argument.

**(xxxviii) The round's stated hypothesis about the resolvers was falsified, in the flattering
direction, by the code being better than predicted.** _(Round 11.)_ Written down before measuring: that
the seven duplicated `shippedProximityPx()` readers would carry a silent fallback, defaulting to 70 on
a miss and sailing on. Every one of them throws, with a message that names the file, says what to do,
and explicitly forbids guessing. Filed as an instrument defect and not as a happy surprise, because the
prediction was doing work: it was the reason the resolvers were classed as *dangerous* rather than as
*capped*, and a round that had not written the prediction down would have quietly inherited its
conclusion while believing it had measured one. The real objection to a resolver survived — a regex
cannot read a constant that becomes an expression — but it is a **ceiling**, not a trap, and those
warrant different urgency. Recorded per the standing discipline of stating the suspected mechanism
before measuring **so that measurement retains the ability to embarrass you.**

**(xxxix) Two rounds counted this population, both counts were right, and both sentences described a
different population than the one counted.** _(Round 11, against Rounds 9 and 10.)_ Round 9:
"`PROXIMITY_PX` is hand-copied **13 times** across the probes." Round 10: "**Eight hits** […] **Seven**
are `PROXIMITY_PX = 70`." Both numbers reproduce exactly — 13 is the probe files that obtain the
constant locally (6 literals + 7 resolvers), 7 is the bespoke-resolver files. Neither sentence is true
of what it counted: Round 9's "hand-copied" silently unions two mechanisms needing opposite fixes, and
Round 10's seven are resolvers, not `= 70` literals, of which there are six — its own stated predicate
returns 6 and its headline returns 7, not 8. Direction: **flattering**, by making a four-mechanism
seventeen-site population read as a handful of sloppy literals — which is why it was *filed* rather
than fixed, and why the round dispatched to fix it was briefed wrong. Neither number was checked by
anything, in a document that by then contained thirty-six entries about numbers not being checked by
anything. Fixed by decomposing the population exactly, in the round text, and by leaving both original
sentences standing with the correction beside them, per the rule against back-editing a stated premise.

**(xl) The round committed, mid-flight, the exact defect it was written to diagnose.** _(Round 11.)_
Having migrated fifteen sites to `bundleEntry`, and "for consistency", thirteen of them were switched
from the `./src/…` specifier form to the `@app/…` alias. The corpus uses `./src/…` **473 times** and
the aliases **37**; inside `.probe/` it is 420 against 31. So a round whose central finding is *a
migration that stops partway leaves two conventions and gives the majority to the wrong one* had just
moved thirteen files onto the 10% convention, and was one commit from shipping it under the word
"consistency". It was caught only because a grep for stragglers returned the stragglers as **the
majority**. Direction: **flattering** — it would have shipped as tidying. Reverted; the thirteen probes
match their 420-strong local convention and the one test file keeps `@app`, matching the six sibling
specifiers in its own `bundleEntry` call. **And there is a tail to this entry, which is the entry
again.** The first counts written into this paragraph were 460 and 50, taken from a grep run while the
thirteen edited files were still edited — a distribution measured on the mutated tree and quoted as
the baseline. Reverting first and re-measuring gives 473 and 37. So the sentence demanding the
distribution be on the screen was, in its first draft, reporting a distribution that included the
change it was arguing against. The lesson is not "pick a convention", it is that
**"for consistency" is a claim about a distribution, and it is worthless until the distribution is on
the screen.**

**(xli) The round's closing verification sweep falsified three of the round's own freshly-written
numbers, and was itself wrong about one of them.** _(Round 11.)_ The write-up was finished and about to
be committed when a sweep re-ran its figures. It reported 530 SHOUT_CASE numeric exports against the
stated 488, 191 corpus files against 190, and 85 bare-`70` lines against 44. Two of the three were
straightforward: 190 was measured before this round's own guard file existed and 44 came from a grep
that was reading 48 PNGs and 10 probe `.txt` logs as source — the round about instruments counting
their own reflection had counted a probe's recorded output as a copy of the constant that probe was
measuring. The third was not straightforward, and matters more: **488 was never wrong.** It is the
distinct-name count, exactly what the guard consults; 530 is the export-site count. The sweep sent to
falsify a number under-specified predicate had itself supplied a different predicate and reported a
contradiction. Direction: **inflating the error** — the correction was more wrong than the text it
corrected, and had it been applied as instructed, a correct number would have been replaced by a
number that did not describe the guard's behaviour. Fixed by publishing all three counts as a table
with a predicate on each row rather than choosing between them. Recorded here rather than as a
correction-beside, because unlike the Round 9 and 10 corrections this text had never been committed
and so was never a record anyone relied on — but the register is where the episode survives, and
deleting a wrong number from a draft is not the same as never having written it.

**(xlii) Chasing the discrepancy in (xli) found a real defect in the guard that had already passed
mutation testing, an anti-vacuity test, and a full-suite run.** _(Round 11.)_ The 530-vs-488 gap is 42
repeat declarations, and asking what happened to them exposed that `shippedConstants` was a plain
`found.set(name, …)` Map: when two modules export the same name with different values, **the last one
the directory walk reached silently won**. Twenty-eight names are in that state. `CEILING_Y` is 6.2 in
the kitchen and living room and 6.75 in the playroom; `BODY_HEIGHT` is 0.15 on a butterfly and 0.18 on
a parrot. A probe binding `const CEILING_Y = 6.2` would have been reported as
`ALREADY DRIFTED, src says 6.75`, citing the playroom — **a false accusation of drift, about a file the
author never touched, with the cited authority chosen by filesystem ordering.** The guard was green
only because no corpus file happens to bind one of the twenty-eight today; the second test asserted
`shipped.size > 100` and never asked what `.size` had collapsed. Direction: **flattering** — it shipped
as a working guard. Fixed by splitting the map into `shipped` and `ambiguous`, declining to judge the
ambiguous, adding a fourth test that fails if the collision path is ever unexercised, and stating the
blind spot in the footer. The mutation test confirms the fourth test catches the original behaviour.
The lesson this one adds: **an anti-vacuity check proves the instrument is looking at something; it
does not prove the instrument's data structure can represent what it is looking at.** A `Map` keyed by
name encodes the assumption that a name identifies a thing, and that assumption was false 28 times
before the first assertion ran.

### What the register is for

Forty-two instrument defects against roughly a dozen product defects. Thirty-five of the
forty-two — (i), (iii), (iv), (v), (vi), (vii), (xii), the idle hazard, (xiv), all five of Round
5's, (xx), all four of Round 7's, (xxv), (xxvii), all five of Round 9's, all four of Round 10's, and
five of Round 11's six — could have produced a **confident wrong verdict**, and twenty-six of those
thirty-five would have produced a wrong verdict _in the direction that flattered the round_: a pass.

Round 11's exceptions are instructive about why the others are the rule. (xxxviii) and (xli) are the
only two entries in forty-two where the instrument erred in the direction that made things look
**worse** than they were — a prediction that the resolvers hid a silent fallback, refuted by seven
resolvers that all throw; and a verification sweep that reported a correct number as wrong because it
had quietly substituted its own predicate. They are also the only two that were caught **before** they
could reach a verdict, and the mechanism is the same in both: the claim was written down where
something else could reach it. (xxxviii) was a prediction recorded before measuring, so measurement
could embarrass it. (xli) was a sweep whose *output was read* rather than applied, so the text could
embarrass the sweep. Everything in this register that reached a verdict got there by being the last
word on itself.

And (xlii) is the reason (xli) belongs here at all. A wrong correction is normally just noise to be
discarded; this one was noise that, when its own discrepancy was chased instead of dismissed, exposed
a live defect in a guard that had already passed a mutation test, an anti-vacuity test, and a
428-test suite. Two of the three numbers the sweep challenged were genuinely wrong, one was not, and
**the one it was wrong about was the one worth investigating.** The discipline this argues for is not
"trust the sweep" and not "trust the text" — it is that a disagreement between two measurements is
itself a measurement, and the cheapest thing to do with it is the thing that gets done least: find out
which predicate each one used before deciding who was right.

Round 9 did not move that ratio so much as explain it. All five of its entries are flattering, and
four of the five share one mechanism: **a true sentence written next to a check, inheriting the
check's authority without inheriting any of its verification.** A docblock count the test refutes on
every run. An over-approximation that names its safe direction and not its trigger. Three allowlist
reasons describing programs that never existed. The prose is not decoration around the instrument —
in this repository it is load-bearing, and it is the only part of the instrument that nothing runs.

Round 10 supplies the case that closes the argument, because in it the unverified prose is **mine, and
five minutes old**. (xxxvi) is a correction to a defect, written by the round that found the defect,
reasoned carefully, committed to two source files, and false — refuted by the first run of the test the
same round wrote to pin it. No amount of care in the writing substitutes for something that runs. That
is also why (xxxiii) belongs beside it: the probe was printing its own contamination as a number, every
run, and the number was believed to mean something else. **Between an honest disclosure and an
enforced one, only the second survives contact with an author who is confident.**

That ratio is the single most useful
thing this review has learned, and it is the reason the standing rule is not "measure before you
claim" but the stricter one: **interrogate whether your instrument can produce the failure it
reports — and the false pass it could produce.**

Round 7 is the first to contribute defects in the OTHER direction that were not merely harmless.
(xxii) and (xxiii) each condemned code that ships — three scenes and two camera helpers — and unlike
the wrong-fail of (xviii), acting on them would have left the build green. A wrong fail that deletes
a working feature and passes CI is not the safe direction; it is the same false confidence pointed at
the product instead of the verdict.

Round 5 added a second direction the earlier tally had no room for, and it is worth stating on its
own because the instinct it defeats is a good one. **(xviii) produced a confident wrong FAIL** —
nine rows failing a bar that applied to two — and a wrong fail looks harmless beside a wrong pass,
since nobody ships on the strength of one. But the natural response to a bar that fails on props
nobody touched is to conclude the bar is too strict and relax it, and a relaxed bar is a false pass
with the evidence removed. **(xix)** is the same hazard one turn further on: a bar whose scope was
too narrow did not merely mismeasure the stone, it applied _pressure toward a worse fix_, because the
cheapest way to satisfy it was to draw fairy sparkle over soil. An instrument that can be satisfied
by making the product worse is more dangerous than one that is merely wrong, because it is
persuasive. So the standing rule grows a clause: **ask what the cheapest way to satisfy your bar
would do to the product, and whether a failing bar's most natural repair is a repair to the bar.**

Round 6 adds the clause that the previous nineteen entries could not have produced, because they all
assume the instrument runs. **An instrument nobody invokes has no defects, and no value either.**
Every hazard in this register — false pass, false fail, malformed scope, pressure toward a worse fix
— presupposes a measurement actually taken. Five rounds were spent making the measurements
trustworthy and none on making them unavoidable, and the gap between those two was wide enough for
the Round 3 defect to walk back through wearing a pass. So the standing rule takes a final clause:
**after you have proven the instrument, prove that something other than your own memory runs it.**

Round 7 closes the loop that clause opened, and the closing is uncomfortable. Something _did_ run the
module-reachability guard. It ran on every commit, it passed every time, and roughly 920 lines of
finished, uncalled animal builders sat inside a file it had just certified as live. The guard was not
broken and was not skipped. It was answering a narrower question than its green tick appeared to
answer, and **a pass looks identical whether the question was broad or narrow.**

That is the last blind spot the previous clauses leave open. Proving an instrument works, and proving
something runs it, together still say nothing about what it declines to ask. The scope of a check is
invisible from its output, and it is invisible precisely at the moment of success — which is the
moment nobody is looking. So the standing rule takes its last clause: **state what an instrument does
not check, inside the instrument, next to a NUMBER for what it is missing.**

The number is the whole of it. This guard already disclosed this exact gap in prose, at lines 20–31,
and I had read those lines in an earlier round and did not go looking. A disclosed limit carrying no
magnitude reads as a footnote. `920 lines` would have read as an alarm.

Round 8 takes that clause and turns it over. If a number is what makes a limit legible, a number is
also what makes a wrong claim credible — and every wrong claim of Round 8 arrived with one attached.
`17 consumers` sat inside a guard for months and was false. `5, 3, 4` were the register's own first
draft, and were module counts wearing symbol counts' clothes. Three doctrine blocks were written from
remembered figures and all three were falsified within the hour.

The common defect is not carelessness, it is that **the quantity was never tied to the claim.** An
importer count of 2 and an importer count of 17 say the same thing about whether a migration was
adopted — nothing — because this repo finishes migrations by rewriting the old function's body onto
the new engine and leaving its name alone, so the module that runs everything keeps the two importers
it started with. Six of seven seams read as abandoned and were finished. The count was real; it
answered a question nobody had asked.

So the standing rule's last clause needs one behind it: **a number is not a measurement until you can
say what would have to be true of the world for it to come out differently.** For an adoption count,
that is the delegation question — _does the old API call the new one?_ — and it is the one thing an
importer count structurally cannot answer, which is why the register asserts the delegation edges
themselves rather than inferring them. `920 lines` reads as an alarm. `17 consumers` read as an alarm
too, and there was no fire.

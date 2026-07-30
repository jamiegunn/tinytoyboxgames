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

### What the register is for

Fourteen instrument defects against roughly a dozen product defects. Nine of the fourteen — (i),
(iii), (iv), (v), (vi), (vii), (xii), the idle hazard, and (xiv) — could have produced a **confident
wrong verdict**, and four of those nine would have produced a wrong verdict _in the direction that
flattered the round_: a pass. That ratio is the single most useful thing this review has learned, and
it is the reason the standing rule is not "measure before you claim" but the stricter one:
**interrogate whether your instrument can produce the failure it reports — and the false pass it
could produce.**

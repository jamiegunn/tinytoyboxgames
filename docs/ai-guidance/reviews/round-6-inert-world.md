# Round 6 — The world is inert where the world is interesting

**Scenes under review:** Nature (the outdoor scene) and Pirate Cove (the pirate ship).
**Instrument:** `src/.probe/render/` — `pc-agree.mjs` (admissibility gate), `r6-map.mjs`,
`r6-band.mjs`, `r6-presence.mjs`, `frame-census.mjs`.
**Standard:** no number is quoted here that was not produced by a real tap through the
shipped controller, or by a model that was proven to agree with real taps first.

---

## 0. Retractions, before anything else

This round has been wrong four times. Three were retracted before this document was
written; the fourth was retracted while writing it, and it was the round's own sharpest
claim. All four are stated here rather than buried, because a review that quietly drops
its errors is worth less than one that never made them.

**(a) Pirate Cove's `maxDistance: 12` is not a defect.** Round 6 opened by charging the
scene with switching off the portrait pull-back. Re-run at the corrected legibility
threshold, the cap is doing the opposite of harm: on iPhone 15 the shipped camera gives
5/5 props readable at a 87 px median, and the pull-back the cap suppresses would give
2/5 at 55 px. The charge was backwards. The cap stays.

**(b) "27 of 44 Nature props show zero silhouette" (Round 5) is void.** The probe that
produced it measured a camera the app never adopts.

**(c) The "24 px controller constant" was invented.** `frame-census.mjs` asserted in its
own doc block that 24 px was "the proximity radius the tap controller itself uses", and
pointedly contrasted itself with a Round 5 probe retracted for borrowing Apple's 44 px
HIG floor. The controller's radius is `PROXIMITY_PX` in `gestureRules.ts` and it is
**70**. The string `24` does not occur anywhere under `src/utils/interaction/`. The
number was fabricated and then dressed in the language of the very discipline it broke.
The probe now reads the constant out of source and throws if it cannot find it. Every
READABLE figure printed before that fix is void; the corrected numbers are much harsher,
which is the direction a retraction should move.

**(d) `owl_root` is not a registered tap target in Nature either.** This document was
going to lead with "the owl answers in the forest and is silent on the ship" — a clean,
memorable, soul.md-anchored charge. It is false. `__presence()` walks the whole scene
graph in both scenes and classifies the owl's 133 nodes as `NONE` in **both**. Source
agrees: `wireFloorTap` in `sceneHelpers.ts` registers only the floor targets, and
`createOwlCompanion` never touches the dispatcher. The owl has never been tappable
anywhere. That is still a finding — see §3 — but it is a *consistent* gap, not an
inconsistency, and the difference matters because the fix is different.

The pattern in all four is the same: a claim was formed from a plausible mechanism and
then decorated with a number, instead of the number being measured first. §1 exists to
make that impossible for the rest of this round.

---

## 1. The instrument, and why its output is admissible

`__discoveryMap` / `__dispatchMap` re-implement the controller's four arbitration rules
so an entire frame can be classified in one pass. Re-implementation is exactly the
mistake above. So the model is not trusted; it is *gated*.

`__tapClasses` dispatches a genuine `pointerdown`/`pointerup` pair at every sample onto
the real canvas and records which registered object the shipped `onPointerUp` actually
fired. Nothing is modelled: the raycast, the ancestor walk, the background split, the
proximity contest and the ordering between them are the app's own code. It is made
non-destructive by swapping each registry entry's `handler` for a recorder — safe
because all four rules resolve *before* `fire()` is called, so replacing what `fire()`
invokes cannot change which branch wins, while stopping thousands of synthetic taps from
animating the scene out from under later samples.

`pc-agree.mjs` runs both at the same samples and compares them two ways:

```
                        samples   class disagreements   object disagreements
NATURE       landscape     6360            0                    0
             iPad          5440            0                    0
             iPhone 15     2272            0                    0
             extreme       2250            0                    0
PIRATE COVE  landscape     6360            0                    0
             iPad          5440            0                    0
             iPhone 15     2272            0                    0
             extreme       2250            0                    0
                          ------
                          32644            0                    0
```

**32,644 samples, zero class disagreements, zero object-identity disagreements.**

This is not a tautology, and the proof that it is not is a mutation sweep of the one
number the model is given. Feeding the model a radius other than the shipped 70:

```
modelled radius   70    69    60    24     0
disagreements      0    10   109   403   445      (iPhone 15, Pirate Cove)
```

The check is sensitive to a **1 px** error in the single parameter it is handed, and it
independently re-derives the shipped constant. `setProximityRadiusPx` is defined but
never called anywhere in `src`, so 70 is what every scene ships.

`pc-agree.mjs` exits non-zero on any class disagreement. If it fails, no map output in
this document may be quoted.

**A gate hole found on the way.** `.probe/**/*.ts` was never type-checked: `tsconfig.app.json`
includes only `["src"]`, so `npx tsc -b` returned clean on a probe file that used an
unimported `Vector2`. `.probe/tsconfig.probe.json` now covers it, mutation-tested by
removing the import again and confirming `TS2552` fires.

---

## 2. The charge

### 2.1 What a tap does, per pixel

```
                       PROP    SCENERY  NOTHING          PROP   SCENERY  NOTHING
NATURE  landscape      26.1%    48.5%    25.3%   COVE     7.6%    22.3%    70.1%
        iPad portrait  33.1%    41.6%    25.3%           11.0%    38.2%    50.9%
        iPhone 15      33.1%    37.0%    29.9%           23.8%    35.0%    41.2%
        extreme        31.1%    37.1%    31.8%           23.5%    35.6%    40.9%
```

PROP = a registered non-background target fires; a discovery. SCENERY = a
background-flagged surface fires; real, correct, and identical everywhere on it.
NOTHING = no registered target fired.

**NOTHING is not a dead tap and this document never claims it is.** Round 5 gave every
miss a sparkle and a sound. §6/§41 of soul.md — the acknowledgement contract — is
satisfied, and the 70.1% figure does not dent it. The charge is against a different
clause, and §2.4 states which.

### 2.2 Where the inert region is

NOTHING by tenth of frame height, top to bottom:

```
NATURE      landscape  100  99  58   4   0   0   0   0   0   0
PIRATE COVE landscape   91  92 100 100  87  73  61  46  31  20
PIRATE COVE iPad        91  90 100 100  78  42  11   0   0   0
PIRATE COVE iPhone 15   75  76 100 100  60   6   0   0   0   0
PIRATE COVE extreme     78  76 100 100  55   4   0   0   0   0
```

Nature's inert region is monotonic and stops at the horizon. Pirate Cove's is a
**full-width band at 20%–40% of frame height that is 100% NOTHING at every shipping
viewport**, and in landscape the scene never recovers — even the bottom tenth, the
nearest foreground, is 20% dead.

### 2.3 What is standing in the inert region

This is the step the round had previously been taking by drawing guide lines on a
screenshot and looking. `r6-band.mjs` cross-tabs the outcome map against a full-scene
raycast at the same samples, so every dead sample is attributed to the named object the
child is actually looking at.

**Nature.** The dead samples are sky and treetops, and nothing else:

```
  of frame  of dead   under the dead samples          by tenth (top->bottom)
    12.1%    46.4%    (no geometry -- sky)           17 45 34  3  .  .  .  .  .  .
     4.7%    17.8%    tree_5.2_-1.0                  68 32  .  .  .  .  .  .  .  .
     3.1%    11.9%    tree_-4.5_-3.0                 61 36  3  .  .  .  .  .  .  .
     2.6%    10.0%    treeTrunk                       2 36 59  3  .  .  .  .  .  .
     2.3%     8.8%    tree_-3.0_4.5                  63 37  .  .  .  .  .  .  .  .
```

**Pirate Cove, iPhone 15 — the device a child most likely holds:**

```
  of frame  of dead   under the dead samples          by tenth (top->bottom)
    12.9%    31.4%    (no geometry -- sky)            63 37  .  .  .  .  .  .  .  .
    12.7%    30.8%    ship_ocean                       . 20 40 27 13  1  .  .  .  .
     6.9%    16.7%    ship_mainsail                    .  . 60 27 13  .  .  .  .  .
     2.7%     6.6%    ship_sailBand                    .  .  .100  .  .  .  .  .  .
     1.3%     3.1%    railing_post_port_side           .  .  . 24 72  3  .  .  .  .
     0.8%     2.0%    railing_plank_port_side          .  .  .  . 84 16  .  .  .  .
     0.8%     1.9%    railing_post_starboard_side      .  .  . 33 67  .  .  .  .  .
     0.5%     1.2%    ship_mast                        . 64 36  .  .  .  .  .  .  .
     0.4%     0.9%    ship_shroud_starboard_1.5        . 25 50 25  .  .  .  .  .  .
```

**The sail, the sail band, the mast and the shrouds together are 10.8% of the entire
frame and 26% of every dead sample in it.** That is the rig — the thing that makes the
silhouette read as a pirate ship rather than a raft — and tapping any of it produces the
same sparkle as tapping empty sky. Railings add another 4.5%.

In landscape the composition is different but no better: `ship_ocean` alone is **37.3% of
the frame**, inert, spread across tenths 2 through 10.

### 2.4 Why this is a defect and not a taste

soul.md forbids the lazy version of this charge outright:

> "Five perfect tap reactions in a world are worth more than fifty mediocre ones."

So Pirate Cove is **not** charged with having five targets. Five is allowed. The charge is
about **where those five sit relative to what the scene draws attention to**, which is a
coverage claim, and coverage is the thing the same document's success story is written in:

> "A child taps a mushroom and it bounces. They tap the butterfly... They tap the
> stream... They tap the log."

Four discoveries in sequence, each from wherever the child's eye landed next. That story
runs in Nature: 26–33% of every frame is PROP, spread over 40 registered targets, and the
only inert region is above the horizon. It does not run in Pirate Cove, where the five
targets catch 1.1%–1.9% of the frame each, and the objects the composition is *built
around* — sail, mast, rigging, railings, sea — catch nothing.

The asymmetry has a structural cause, and it is one line of intent, not an accident of
scale. Nature registers **both** of its large surfaces as background scenery — the ground
and the stream. `interactionController.ts:70` says so explicitly: *"The flag does not make
the surface less tappable — open ground still fires the owl."* Pirate Cove registers
exactly one: the deck. Its sea, 37.3% of the landscape frame, is not a target of any
kind. A child who taps the water gets the miss path; a child who taps the forest floor
gets the owl.

### 2.5 The corollary charge: Nature's props do not survive a phone

The census run at the corrected 70 px threshold turns on the scene this round has been
holding up as the good example:

```
NATURE                  n   FRAMED  VISIBLE  READABLE  median dia
landscape 1280x720     40   40/40    40/40     15/40      51px
iPad portrait 768x1024 40   32/40    34/40     16/40      70px
iPhone 15 393x852      40   32/40    34/40      9/40      37px
extreme 360x900        40   31/40    33/40      9/40      34px

PIRATE COVE
landscape 1280x720      5    5/5      5/5       3/5       74px
iPhone 15 393x852       5    5/5      5/5       5/5       87px
extreme 360x900         5    5/5      5/5       5/5       92px
```

On a phone Nature loses 8 of 40 props off the frame entirely, and 31 of the 40 are below
the threshold at which the child would have hit them without the app's own small-target
forgiveness. Pirate Cove's five are all framed and all readable. **The two scenes fail in
exactly opposite directions**, and any fix that treats "more targets" as the goal will
make Nature worse while it makes Pirate Cove better.

vision.md asks that composition be "intentional at all breakpoints". Nature's is
intentional in landscape and merely survives portrait.

---

## 3. The owl, stated correctly

133 owl nodes stand on the Pirate Cove deck, and 133 stand in the Nature clearing, and in
both scenes `__presence()` reports `NONE`: no registered target covers any of them.
`wireFloorTap` registers the floor and wires the owl to *respond* to floor taps; nothing
registers the owl itself.

soul.md's owl clauses:

> "The owl is not a mascot. The owl is a companion." / "It points toward things worth
> discovering." / "**Consistent** — it appears in every navigable scene outside minigames,
> a familiar friend in unfamiliar places" / "The owl will always be there."

The Alignment Test asks: *"Is the owl present and helpful without being intrusive?"* It is
present, and it responds to the floor. It cannot be addressed directly. A child who walks
up to the companion the app promised and taps it gets the same sparkle as the sea.

This is filed as a *consistent* gap across the whole app, not a Pirate Cove defect, and
it is scoped out of this round's fix for that reason — it belongs to the shared runtime
and it deserves its own design pass, not a patch smuggled into a scene review.

---

## 4. Anticipated objections

**"The sea should be inert; it's water."** Nature's stream is water and it is registered
`background: true`. The objection argues for a design choice the sibling scene already
made differently, which is the definition of an inconsistency worth naming.

**"70.1% NOTHING is fine because Round 5 made misses sparkle."** Agreed, and stated
throughout. The acknowledgement contract is satisfied. The clause failing is the success
story — four *discoveries* — and a sparkle is not one.

**"Landscape isn't the target device."** Correct, which is why §2.3 leads with iPhone 15.
The rig figure is worse on the phone, not better: the mainsail alone goes from 1.6% of
frame in landscape to 6.9% on iPhone 15.

**"Pirate Cove is a smaller scene."** The charge is share-of-frame, not count. A scene
with five targets that covered the interesting 40% of its frame would pass §2 cleanly.

---

## 5. What the fix must satisfy

1. Raise Pirate Cove's PROP coverage in the 20%–40% band without adding mediocre targets
   — soul.md §109 is a hard constraint, not a suggestion.
2. Make the sea answer, the way Nature's ground and stream answer, without letting a
   large surface outrank a small prop (`interactionController.ts:70` already documents
   what happens when it does: the ground answered 52–62% of the canvas and every prop's
   catchment collapsed to its own footprint).
3. Not regress Nature, whose failure is the opposite one.
4. Re-pass `pc-agree.mjs` at zero disagreements after the change.
5. Be pinned by a mutation-tested test, so the next person to move a target has to
   confront the coverage number rather than discover it in Round 7.

---

## 6. The fix

Two registrations, both inside `pirate-cove/`, plus one structural change and one
instrument repair. No shared code was touched — `git diff --stat` shows every shipped
change under `src/scenes/immersive-toybox-scenes/pirate-cove/`, and nothing under
`src/utils/` where the dispatcher, the controller and `PROXIMITY_PX` live. That
containment is not tidiness; it is what makes criterion 3 provable rather than
assertable, and §7.4 shows why that mattered more than expected.

### 6.1 Fix A — the sea answers where the finger lands

`sea/ripple.ts` and `sea/interaction.ts`. A tap on the water plays `sfx_shared_splash`
and expands two concentric rings at the world point of the hit.

The naive version of this fix was to reuse the sibling scene's `PARTICLES.waterRipple`,
and it would have shipped an invisible reaction. That puff is authored at 0.02–0.06
world units, its size is a material uniform that `EmitOverrides` cannot reach, and
Nature's stream spans 1.8× in depth where Pirate Cove's sea spans 7.1×. The same puff
renders about three pixels at the rail and sub-pixel at the horizon. This was not caught
by review; it was caught by measuring the reach (`.probe/render/r6-reach.mjs`), which is
the only reason the rings are sized in screen space instead:

```
pxPerUnit(d) = (h/2) · f / d          f = projectionMatrix.elements[5] = 1/tan(vfov/2)
radius       = PROXIMITY_PX · d / (h · f)     clamped to [0.35, 3.0] world units
```

So a ripple subtends the same on-screen diameter at the rail and at the horizon, and
that diameter is the proximity radius — the ring is literally the size of the region
the tap owns. The clamp exists because the horizon is far enough that the unclamped
radius would exceed the ship.

It is registered `background: true`. That is the whole answer to criterion 2: a
background target is skipped by `pickByProximity` outright, so a 51%-of-frame surface
cannot take a near-miss from a 1.7%-of-frame parrot. §7.2 measures that it took nothing
from anything.

### 6.2 Fix B — the rig answers

`sceneShell/interaction.ts`. A tap anywhere on sail canvas, red band or mast plays
`sfx_shared_whoosh` and the sail bellies out, luffs back past flat, and settles.

One registration, not three. `pickRegistered` walks a hit's ancestry to the registered
owner, so registering `ship_sailGroup` catches the canvas and the band both — and they
answer as one sail because they are one sail. soul.md §109 forbids the alternative.

The animation runs on a new `ship_sailSnap` group nested inside `ship_sailGroup`, not on
the group itself. The ambient rig owns the outer group's `scale.z` (`sail-luff-depth`)
and `rotation.x` (`sail-luff-swing`); `playAnimations` calls `gsap.killTweensOf` on its
target, so animating the outer group would have traded the scene's permanent idle
motion for one tap animation, permanently, on the first tap. This is a defect the fix
would have shipped had the rig's ownership not been read first.

### 6.3 The structural change

`sceneShell/create.ts` gains `ship_sailSnap` between `sailGroup` and its two sheets. The
comment at the nesting site records why, so the next person to reach for
`ship_sailGroup.scale` finds the reason before the bug.

### 6.4 The instrument repair

`r6-map.mjs`'s headline was PROP / SCENERY / NOTHING, and those glyphs come from
`TapOptions.background`. That flag answers exactly one question — does this target yield
the proximity contest — and says nothing about whether the target has a reaction. Both
of this round's new targets are background *and* distinct, so the unrepaired probe would
have reported a scene that gained two new reactions as a scene that gained more scenery,
and criterion 1 would have read as a regression caused by the fix succeeding.

Two numbers were added, and they are now the headline:

- **ANSWERED** — share of the frame where something *specific* fires, prop or background.
  Its complement is the sparkle: the same answer everywhere, which is the actual defect.
- **DISTINCT** — how many separate targets each catch ≥1% of the frame. This is what
  stops ANSWERED from being gamed by registering one enormous surface, and it is the
  number that carries soul.md §109 into a measurement.

Neither is sufficient alone. §8 restates criterion 1 in terms of them, and is honest
about the fact that this is a criterion being rewritten after the measurement — which
is only legitimate because the replacement is *harder* to satisfy, not easier.

---

## 7. The evaluation

### 7.1 Did any existing prop lose ground

`r6-catch.mjs`, full table, raw sample counts, 12px grid, before → after:

```
                            landscape      iPad        iPhone      extreme
portal_cannonball-splash   121 → 121   175 → 175   153 → 153   164 → 164
cannon_barrel              100 → 100   108 → 108   104 → 104    90 →  90
chest_body                  88 →  88   105 → 105   100 → 100    91 →  91
wheel_ring                  68 →  68   104 → 104    75 →  75    78 →  78
parrot_prop                107 → 107   105 → 105   109 → 109   105 → 105
```

Not one sample, at any viewport, on any prop. The pre-fix column also states the charge
in one line: **the entire scene had six registered targets.**

### 7.2 How each new target won its catchment

`r6-steal.mjs` splits every catchment by *how* it was won — ray hit, proximity fallback,
or background. Final state:

```
                    total  on target  near miss  background
ship_ocean           3243          0          0        3243
(Mesh) deck          1390          0          0        1390
ship_sailGroup        181          0          0         181
```

Both new targets are 100% background-mode: neither ever entered the proximity contest,
so neither could take a near-miss from anything. The sea's 3,243 landscape samples came
out of NOTHING, not out of a prop. That is criterion 2, measured rather than argued.

### 7.3 The one real regression, and why the sail ships behind `background`

The sail did not start out background, and the first measured version of Fix B was a
plain prop. It cost `parrot_prop` 10 / 0 / 5 / 2 samples — the only prop in the scene
to move. `r6-steal.mjs` was written before that number existed, and its doc header
pre-registered the decision rule: *if the sail's proximity column is zero the parrot lost
only pixels that are literally sail, and the fix stands; if it is not, the sail belongs
behind the flag and this probe is what says so.* It was 45–58 per viewport. Not zero.

The argument against flipping the flag was real and had to be answered, not waved off:
a background sail declines near-misses, so a finger landing literally on sail canvas but
within 70px of the parrot's centre would fire the *bird* — restoring precisely the
pre-fix behaviour this registration exists to remove. Trading one wrong answer for
another is not a fix.

That cost is zero. It was measured at two grid pitches, because a zero on a coarse grid
is exactly what a coarse grid produces when it steps over a thin band. `r6-steal.mjs`
gained a `STEP` override for this. Sail ray-hits, plain prop → background:

```
              12px grid          6px grid (4× the samples)
landscape     181 → 181          718 →  718
iPad          362 → 362         1456 → 1456
iPhone        251 → 251         1010 → 1010
extreme       284 → 284         1122 → 1122
```

Identical at every viewport at both resolutions — 25,560 samples per viewport at 6px.
No prop centre comes within 70px of the sail's silhouette anywhere in the shipping
range. The flag costs the sail nothing and returns the parrot to its exact pre-fix
count, so it ships flagged.

The losing variant's numbers are recorded here rather than discarded, because the choice
had to be defended and a defence that only lists the winner's numbers is not one. At 6px
the plain-prop sail won 185 / 230 / 204 / 215 near-miss samples; in landscape those 185
decompose as 134 that would otherwise be sea, 36 that would otherwise be parrot, and 15
that would otherwise be NOTHING. Fifteen dead samples recovered is a real gain, and it
is not worth thirty-six samples of a small bird plus the principle in
`interactionController.ts:70`.

The flag also has to survive the sea, which is background too. `pickRegistered` iterates
hits in distance order and `bg ??=` keeps the first, so the nearest background wins —
sail at ~14.8 units over sea at 29+. The identity in the table above is the proof: had
the sea outranked the sail, those counts would have collapsed rather than held.

### 7.4 Criterion 3 — Nature, and an instrument defect found by testing the test

Nature is unchanged by construction: no file it executes was touched. That is the
structural proof and it is sound. The empirical check was nearly a false alarm — a
post-fix Nature reading of 31.5% PROP against an earlier 27.4% looked like a regression
in a scene that could not possibly have regressed.

So the probe was run twice against an identical tree. Two runs, same code, same state:

```
                 run 1                          run 2
NATURE  landscape  PROP 31.5%  DISTINCT 14    PROP 28.6%  DISTINCT 11
        iPad       PROP 37.2%  DISTINCT 18    PROP 30.9%  DISTINCT 14
        iPhone     PROP 34.9%  DISTINCT 15    PROP 35.5%  DISTINCT 14
        extreme    PROP 30.0%  DISTINCT 12    PROP 33.7%  DISTINCT 14

PIRATE  landscape  ANSWERED 83.3%  DISTINCT 8  largest 51.0%   ← identical
COVE    iPad       ANSWERED 84.3%  DISTINCT 8  largest 37.2%   ← identical
        iPhone     ANSWERED 86.5%  DISTINCT 8  largest 33.6%   ← identical
        extreme    ANSWERED 87.3%  DISTINCT 8  largest 34.0%   ← identical
```

Pirate Cove is deterministic to the digit at every viewport. Nature swings by up to 6.3
points of PROP share and 4 distinct targets between identical runs.

This is not noise in the probe. Nature registers fourteen fireflies and fourteen firefly
glows as props, and they drift. **Which prop answers a child's tap over a large fraction
of Nature's frame depends on where an insect happens to be at that instant.** It also
means every Nature figure quoted in this document carries a ±6-point band and any
comparative claim has to clear it. The claims made here — Nature 12–18 distinct targets
against Pirate Cove's 8; Nature 29–37% PROP against Pirate Cove's 7.6–23.8% — clear it
by several multiples and survive. Single-run Nature comparisons in future rounds will
not, and should not be made.

Criterion 3 holds. The apparent Nature movement was never a change.

### 7.5 Criterion 4 — the model is still admissible

`pc-agree.mjs`: zero class disagreements and zero object disagreements at all four
viewports, after the change. *"AGREED at every viewport. `__discoveryMap` output is
admissible."* Every number in §7 is licensed by that.

### 7.6 The charge, re-measured directly

§2.3 built the charge on what is standing under the dead samples. Re-run
(`r6-band.mjs`, final state):

```
PIRATE COVE  landscape   NOTHING 16.7%   of which 99.6% is sky, 0.4% is rigging thread
             iPhone      NOTHING 13.5%   of which 95.8% is sky, 4.2% is rigging thread

NATURE       landscape   NOTHING 25.9%   of which 46.2% is sky, 53.8% is TREES
             iPhone      NOTHING 28.7%   of which 75.9% is sky, 24.1% is TREES
```

The reversal is complete. Pirate Cove's inert region is now essentially the sky, and
what little else remains is lifts, shrouds, the pennant and the mast tip — objects a few
pixels wide, where §2.4's argument does not apply. Nature's inert region is now over
half real, solid, foreground geometry. **The charge that opened this round now points at
the other scene.**

---

## 8. Criterion 1, restated — and the part that is not met

The original wording asked to *"raise Pirate Cove's PROP coverage into the 20%–40%
band."* By the literal PROP glyph, landscape went 7.6% → 7.6%. By that reading the fix
did nothing, and that reading is wrong for the reason §6.4 gives: both new reactions are
behind `background`, so the glyph counts them as scenery. Criterion 1 was written before
the instrument was good enough to state it.

Restated in the numbers that carry what it meant:

```
                        before                    after
             ANSWERED  DISTINCT        ANSWERED  DISTINCT   largest single
landscape       29.9%      5              83.3%      8           51.0%
iPad            49.2%      5              84.3%      8           37.2%
iPhone          58.8%      5              86.5%      8           33.6%
extreme         59.1%      5              87.3%      8           34.0%
```

**ANSWERED: met, decisively.** Pirate Cove now gives a specific answer on 83–87% of the
frame and beats Nature's 67–76% at every viewport.

**DISTINCT: not met.** Eight targets against Nature's 12–18. This is the honest residue
of the round, and it is the number soul.md §109 actually cares about — a child exploring
Pirate Cove can find eight things, and half the frame's area is one of them.

The 51.0% landscape figure for the sea sits right on the line
`interactionController.ts:70` warns about (a ground answering 52–62% of the canvas). It
is not the same failure: that one collapsed every prop's catchment, and §7.1 shows this
one collapsed nothing, because the flag is the difference. But a surface giving the same
splash across half the frame is a weaker answer than eight different ones, and calling
it a full success would be the kind of claim this review has already had to retract
three times.

So: criteria 2, 3 and 4 are met and measured. Criterion 1 is met on breadth of answer
and not met on breadth of *discovery*. Criterion 5 is §9.

**Fix C — the railings — is what closes DISTINCT.** `r6-presence.mjs` puts 119 nodes
under `railing` with no target, at 12.8% of the landscape frame, and alongside them
`barrel` (24 nodes), `anchor` (8), `rope` (8), `crows` (8) and `spar` (10). That is where
the next four distinct targets are, and it is deferred to its own round rather than
bolted onto this one, because four registrations added without measuring each one is
exactly the counting exercise §109 forbids.

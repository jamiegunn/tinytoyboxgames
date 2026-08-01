# Fix H — the clock again, and the instrument that was never pointed at it

**Committed before the change is built or rendered.** Same rule as `0bfe3ce`,
`604b39c`, `c3cec3c` and `1f4be04`: this commit touches only this file.

Fix G was scored 4 PASS / 2 FAIL. Both failures were mine, not the render's, and
correcting them changes what the clock's defect _is_.

## K6 did not fail. My instrument did.

K6's registered baseline, "130 × 52", came from `clock_gate.py`'s H1: a **tight**
box — the clock's four projected extreme points ± **pad 14**, the outer 14-px
border as the plaster reference, **3.0σ** on both the pale and the red rule.
`fixg_judge.py` used `clock_gate2.py`'s box instead — 120-px pad, 40-px ring,
2.5σ — and returned **185 × 147 for the unchanged Fix E2 image**, where the
registered instrument returns 130 × 52. A gate whose instrument cannot reproduce
its own baseline measures nothing.

`clock_bbox.py` reimplements H1 rule-for-rule and was required, before it read
Fix G at all, to return 130 × 52 on Fix E2. It does.

```
Fix E2, its own box (RIM_R 0.44)    130 x 52     baseline REPRODUCED
Fix G,  its own box (RIM_R 0.49)    140 x 58
predicted 0.49/0.44 x (130 x 52) =  145 x 58     3.4% / 0.0%
K6 band: 132-150 tall, 51-62 wide            ->  PASS
```

So the projection model holds a third time, and **K6 passes**. It was scored FAIL
by a mask I substituted without checking it against the number it was replacing.

## K3 was measuring an object that is not the clock

`clock_gate2.py` selects the dial with `is_face = lum > plaster + 2.5σ`, i.e.
L > 160.2. The geometric dial — built by projecting the clock's own local polar
grid, which cannot select on brightness — is 3431 px, and **3% of it clears that
rule**. So most of `is_face` is not on the dial. Registered as G2 and measured:

```
                is_face px in the K3 crop   on the clock   off the clock
  Fix E2                    1957                236 (12%)     1721 (88%)
  Fix G                     1796                 75 ( 4%)     1721 (96%)
```

**1721 px, identical in both renders** — a fixed bright object elsewhere in the
240 × 240 crop, unmoved because nothing I did touches it. K3's "0.101 → 0.103"
was the correct answer about that object. K4, the runaway guard, guarded it too,
which is why it passed at "dial L +57 over plaster" while the dial is in fact
_darker_ than the plaster.

This reaches back further than Fix G. **H4 and H5 used this mask**, so the
grey-dial defect that Fix G part 3 was written to fix was measured on the wrong
pixels. Measured geometrically, the dial's chroma was never 0.33× the plaster's:

|              | chroma/L | vs plaster | median L | vs plaster |
| ------------ | -------- | ---------- | -------- | ---------- |
| plaster      | 0.308    | —          | 120.5    | —          |
| dial, Fix E2 | 0.225    | 0.73×      | 117.9    | −2.6       |
| dial, Fix G  | 0.275    | **0.89×**  | 116.3    | **−4.1**   |

Against K3's own threshold of ≥ 0.55× plaster, **Fix G passes that too** — and
Fix E2 already did. Fix G part 3 was prescribed against a defect that was
overstated by a broken instrument. It was not harmful (0.73× → 0.89×), but it
was not needed at that magnitude, and it **cost 1.6 points of value**: albedo L
went 0.9485 → 0.927 warming the dial, and the render lost 1.4% of dial luminance
to match. I predicted none of that because I could not see it.

The corrected Fix G scoreboard is **5 of 6**, and the one true failure is K4 —
inverted. The dial is not a runaway white. It is darker than the wall it hangs on.

## The two defects that are real

**1. The bezel is fighting the wall, and always has been.** `BEZEL_FRONT_Z = 0.0`
puts the bezel's front cap at local z 0.000, which _is_ the wall face plane at
world x = 5.275. Exactly-coplanar surfaces fight at any depth precision. G1 was
registered to tell this apart from facet shading — z-fighting leaves
**plaster-coloured** gaps, uneven facet shading leaves **dark red** ones:

```
                annulus    red     not-red   gap mean vs plaster   vs bezel red
  Fix E2         1205 px   25.6%    74.4%          7.0                61.2
  Fix G          2213 px   51.1%    48.9%          7.3                62.1
```

Distance 7 to the plaster against 62 to the bezel's own red. The gaps are the
wall. This is why the ring reads as blocks, it predates Fix G, and it is not what
Fix G was aimed at — though widening the annulus did take it from 74% wall to
49% wall, which is the honest part of that fix.

It also retires the explanation I have shipped twice. "The ring cannot close
because it is 2.7 px at the sides" is true arithmetic and it is the _second_
term. The first is that half the ring is not being drawn.

**2. The dial is dark because of its clearcoat, and the number was predicted
before it was looked up.** Per-albedo throughput, measured as luminance ÷ albedo
luminance, against the plaster on the same plane under the same light:

```
  plaster   MeshStandardMaterial, no clearcoat          139.5    1.000
  dial      MeshPhysicalMaterial, clearcoat 0.7         125.5    0.899
  bezel     MeshPhysicalMaterial, clearcoat 0.7         156.0    1.118  (contaminated)
```

`createGlossyPaintMaterial` is the only material difference — the procedural
`paint` and `plastic` presets differ by ≤ 0.005 in every parameter and cannot do
this. Clearcoat Fresnel at this wall's 68.2° incidence, Schlick with F₀ = 0.04:

```
F = 0.04 + 0.96 x (1 - cos 68.2)^5 = 0.04 + 0.96 x 0.629^5 = 0.1345
attenuation of the base layer = 1 - 0.7 x 0.1345 = 0.906
measured                                            0.899
```

0.8% apart. And the clearcoat gives nothing back: this wall receives **zero key
light** — `max(0, dot((-1,0,0), (0.45, 0.82, -0.35))) = 0` — and
`environmentIntensity` is 0.08, so the clear layer has almost nothing to reflect.
It is pure loss. The bezel's 1.118 is not a counter-example; it is the z-fight,
which mixes bright plaster into a dark red albedo and inflates the ratio.

The dial's albedo is only 7% brighter than the plaster's in luminance (0.927 vs
0.866), so even a perfect render puts it barely above the wall. Losing 10% to the
clearcoat puts it below. **That is the whole of "the dial reads as a hole."**

## The change

**1. `polygonOffset` on `kitchen_clockRimMat`** — `true`, factor **−1**, units
**−1**, following `src/entities/owl/head.ts:105-114`, which already does exactly
this for the owl's iris over its eyeball and pupil over iris. It moves no vertex,
so it cannot change the silhouette, the bbox, or the waist-band counts that
K1/K2/K6 measure. It changes only which of two coplanar surfaces wins.

**2. The dial loses its clearcoat** — `createGlossyPaintMaterial` →
`createPlasticMaterial` for `kitchen_clockFaceMat`, colour unchanged at
(0.97, 0.925, 0.82). The bezel **keeps** its clearcoat, deliberately: two
surfaces on the same plane under the same light, one material property differing,
with opposite predicted destinations. That is the experiment, not a leftover.

Fix G's warmed albedo is **held**, not reverted. It was prescribed for a bad
reason and it still moved the dial 0.73× → 0.89× of the plaster's relative
chroma, which is the right direction; and the 1.6 points of value it cost are
returned three times over by part 2.

**No albedo change.** The value deficit is being fixed at its measured cause. If
that is not enough, the albedo lever is derived in advance below rather than
invented after the fact.

## Gates, registered now

Kitchen, fresh render, same camera. Masks are **geometric** — the clock's own
local polar grid projected at z = 0 — validated by M1 (red runs 0% inside r 0.35,
then 27.8% / 54.0% / 48.8% across 0.35–0.47, then 14.7%, then 0%, exactly where
the geometry says) and by looking at the annotated crop.

| gate   | claim                                                                                                  | now                   |
| ------ | ------------------------------------------------------------------------------------------------------ | --------------------- |
| **L1** | annulus 0.39–0.47 is **≥ 85% red**                                                                     | 51.1%                 |
| **L2** | what is left is **not the wall** — non-red ≤ 12%, and its mean > 25 RGB from plaster                   | 48.9% at distance 7.3 |
| **L3** | dial **median** L ≥ plaster + **5**                                                                    | −4.1                  |
| **L4** | _attribution_ — dial throughput ≥ **0.97**, bezel throughput ≤ **0.97**                                | 0.899 / 1.118         |
| **L5** | _runaway guard_ — dial chroma/L ≥ **0.70×** plaster, dial median L ≤ plaster + **35**                  | 0.89× / −4.1          |
| **L6** | _silhouette unchanged_ — bbox in Fix G's **fixed** box (827, 909, 315, 487) stays **140 ± 4 × 58 ± 3** | 140 × 58              |
| **L7** | _negative control_ — peg-rail cloths, 5.5 units away on the same wall, move < 2%                       | 0.00% / 0.00%         |

L3's prediction is arithmetic, not hope: 116.3 ÷ 0.899 = **129.4**, which is
plaster + 8.9. L6 uses a fixed box, not each image's own, so that the only thing
that can move is pixels.

L5 is the guard that matters most here. Removing a clearcoat and _then_ finding
the dial too bright would be a fix that overshot, and L5 catches it at +35.

## Sufficiency, called in advance

**L4's bezel half is the gate I expect to fail.** The annulus mask runs to r 0.47
against a bezel outer radius of 0.49, and at the sides the annulus is 2.7 px wide,
so the bezel's measured mean stays blended with plaster at the silhouette no
matter how completely `polygonOffset` fixes the interior. If L1 and L2 pass while
L4's bezel half sits between 0.97 and 1.05, that is edge antialiasing at 2.7 px
and not a surviving z-fight — and the way to tell is L2's distance term, which
antialiasing cannot pass and a z-fight cannot fail.

**If L3 fails**, the clearcoat was not the whole 10%, and the derived remedy is
albedo, not another material: (0.97, 0.925, 0.82) → **(1.00, 0.955, 0.85)**,
albedo L 0.927 → 0.957, chroma/L 0.157 so Fix G's warmth is held within 3%. That
is +3.2% of value, which closes a shortfall of up to 4 L units and no more. A
larger shortfall than that would mean the cause is neither clearcoat nor albedo,
and the next thing to measure is the shadow map — `rim.castShadow = true` on a
cylinder embedded 0.09 into the wall it shadows.

**What this fix still does not do.** The Kitchen's left wall holds 12 of 88 band
tiles against the right wall's 40; `side_L` is 68.2% against `side_R`'s 51.1% and
the Playroom's 32.3%; the peg rail is 2.2 long against the plate rack's 3.4 and
jammed into the corner behind the door; the upper expanse is bare. This has been
owed since Fix B and three registrations have now named it. A correctly-drawn
clock 0.98 across does not touch it.

**And a standing correction to how I gate.** Three of the failures in this
sequence — H2b, K6, K3/K4 — were instruments, not renders, and each one was a
mask I swapped in without first requiring it to reproduce the number it replaced.
That check costs one line and it is now the rule: _a new instrument must
reproduce the old instrument's baseline on the old image before it is allowed to
score a new one._

If the numbers disagree with the picture, the picture wins.

---

# Fix H, measured — 4 of 7, and the picture settles it in one look

```
L1  annulus >= 85% red                                     99.2%   PASS
L2  gaps <= 12% AND > 25 RGB from plaster           0.8% at 47.5   PASS
L3  dial median L >= plaster + 5         -45.1  (predicted +8.9)   FAIL
L4  dial tp >= 0.97 AND bezel tp <= 0.97           0.583 / 1.104   FAIL
L5  GUARD chroma >= 0.70x, dial L <= plaster+35    2.40x / -45.1   PASS
L6  bbox 140 +/- 4 x 58 +/- 3 (frozen box)              145 x 58   FAIL
L7  NEG CTRL cloths move < 2%                      0.00% / 0.00%   PASS
```

**L1 and L2 are the diagnosis confirmed, completely.** The annulus went from
51.1% red to **99.2%**, and the surviving 0.8% sits **47.5 RGB from the plaster**
where Fix G's gaps sat at 7.3. The gaps were the wall, the wall is no longer
winning, and the ring closes. The z-fight was real and `polygonOffset` killed it.

**And then it killed the dial too.** L3 at −45.1 and L4's 0.583 are not a
shortfall, they are the wrong object: the dial mask now measures chroma/L
**0.739** against the bezel's own 0.782. Look at `fixh_clock_now.png` — the clock
is a solid red disc with ticks and hands floating on it. The dial is not dark.
The dial is _gone_.

## Why, in arithmetic I should have done before shipping it

`polygonOffset` biases by `factor × m + units × r`, where `m` is the polygon's
**maximum depth slope per pixel**. I copied `−1 / −1` from `owl/head.ts` without
noticing that the owl's iris is viewed near-normal, where `m ≈ 0` and the factor
term costs nothing. This wall is seen at **68.2°**, where `m` is the largest it
gets. With near 0.1 / far 100 at the clock's depth 12.829:

```
dd/dz                          6.082e-4 window depth per world unit
1 ULP (24-bit)                 9.80e-5 world units          <- the units term
depth change per pixel         (1/144.26) x tan(68.2) = 0.01733 world units
                               and tan(68.2) = 2.500, which IS the registered
                               2.51 occlusion constant -- same trig, third use

factor -1 alone                0.01733 world units of bias
units  -1 alone                0.000098
shipped (-1, -1)               0.01743   vs the dial's 0.004 clearance  = 4.4x
```

The bezel was biased **4.4× past the dial it sits behind**. One term of a
two-term formula, and the term I never thought about is the one this wall
maximises. The owl precedent was sound for the owl and worthless here.

**L6's 145 × 58 is the same story read from the other end and it is not a
silhouette change.** `CLOCK_RADIUS` is untouched at 0.49, so no vertex moved.
145 × 58 is _exactly_ what H1's projection model predicts for RIM_R 0.49
(0.49/0.44 × 130 × 52 = 145 × 58) — the number the registration itself printed.
Fix G's 140 was 5 px short because the bezel's outermost pixels were losing to
the wall. The band was centred on the contaminated measurement. I am recording
that rather than widening the band: **L6 stands as FAIL**, and the reason it
fails is that the fix made the render agree with the model.

## Fix H2 — one number, derived, not tuned

`polygonOffsetFactor` **−1 → 0**, `polygonOffsetUnits` **−1 → −4**.

The factor term is for slope-induced fighting between surfaces at _different_
angles. That is not this defect. This is an exact tie between two surfaces on
the identical plane, and the units term — a fixed number of depth ULPs — is the
instrument for exactly that. Dropping the factor removes the 0.01733 and leaves
a bias that can be placed between the two clearances that matter:

```
coplanar with the wall        0.000        must be beaten
units -4                      0.000392     4 ULP above it, 10.2x below the dial
dial standoff                 0.004        must NOT be beaten
```

−4 rather than −1 because a single ULP is within the noise of two different
primitives rasterising the same plane; four is deterministic and still an order
of magnitude clear of the dial. It sits near the log-centre of the window.

**Gates are unchanged.** L1–L7 as registered above, same thresholds, same
instrument. The predictions for H2: **L1 and L2 hold** (nothing about the
wall-vs-bezel tie changes — 0.000392 beats 0.000 as surely as 0.01743 did), and
**L3/L4 now read the dial**, which after losing its clearcoat should land at
116.3 ÷ 0.899 = **129.4**, plaster + 8.9. **L6 will stay at 145 × 58** and stay
a FAIL, for the reason given above.

**If L1 or L2 regress at −4**, the tie is not being broken reliably at 4 ULP and
the answer is not more units — it is that `BEZEL_FRONT_Z` should never have been
exactly 0.0, and the fix is geometry: 0.0 → 0.002, half the dial's clearance,
which removes the tie instead of arbitrating it.

---

# Fix H2, measured — 3 of 7, and every one of the three failures is now sourced

```
L1  annulus >= 85% red                                     94.9%   PASS
L2  gaps <= 12% AND > 25 RGB from plaster            5.1% at 17.5   FAIL
L3  dial median L >= plaster + 5           +1.8  (predicted +8.9)   FAIL
L4  dial tp >= 0.97 AND bezel tp <= 0.97           0.945 / 1.107   FAIL
L5  GUARD chroma >= 0.70x, dial L <= plaster+35     0.88x / +1.8   PASS
L6  bbox 140 +/- 4 x 58 +/- 3 (frozen box)              145 x 58   FAIL
L7  NEG CTRL cloths move < 2%                      0.00% / 0.00%   PASS
```

The pass count went **down** and the clock got **much** better, which is worth
saying plainly: L2 now fails on a residual a fifth the size of the one it was
written against, and L4 fails on a dial that is finally the dial.

## L2 — 4 ULP breaks the tie over 70% of the ring and not the top

The gaps are not spread. They are **11 to 2 o'clock, and exactly 0.0% from 3
through 10**. That histogram separates the three candidates registered as P1/P2/P3
by itself: antialiasing at the mask's outer edge would be uniform in angle, and
so would a surviving tie of the ordinary kind. So Q1 read _the same samples_
across all three offsets:

```
                   11-2 red   3-10 red   11-2 gap mean vs plaster
  Fix G  (none)        9.1%      65.2%             6.9
  Fix H  (-1/-1)     100.0%      99.9%            32.6
  Fix H2 (0/-4)       84.8%      99.9%            13.3
```

An occluding object does not care what `polygonOffset` is set to. This arc goes
9.1% → 84.8% → 100.0% as the bias grows, so it is **depth**, and the gap colour
at Fix G's d = 6.9 is the plaster signature. The top of the ring needs more than
4 ULP and the bottom does not — which is what you get when a 24-triangle fan and
a two-triangle wall interpolate the same plane and their rounding does not agree
uniformly across it.

**This is the case I registered a remedy for, so I am taking that remedy and not
inventing a bigger number.** `BEZEL_FRONT_Z` **0.0 → 0.002**. It removes the tie
rather than arbitrating it: 0.002 is ~20 ULP of separation, 5× what the offset
was buying, and because `FACE_FRONT_Z` is defined as `BEZEL_FRONT_Z + 0.004` the
dial's clearance is preserved untouched by construction. The visible cost is
0.002 × 2.51 × 53.5 = **0.27 px** of standoff on the near side, which is below
anything this render resolves. The `0 / −4` offset is **kept** as a guard, at 10×
below the dial clearance so it cannot repeat Fix H.

## L3 and L4 — the clearcoat was half of it, and the other half is not the shadow

Dropping the clearcoat moved dial throughput **0.899 → 0.945**. Predicted 0.906
→ 1.000. So the Schlick arithmetic was right about the mechanism and right about
its own term, and there is **5.5% unattributed**. The registration named the
shadow map as the next thing to measure — `rim.castShadow = true` on a cylinder
embedded 0.09 into the wall it shadows — so S1 measured plaster luminance in
rings 0.6 to 2.0 world units out from the clock:

```
  0.60-0.80   118.38      1.00-1.30   118.68      1.60-2.00   118.42
  0.80-1.00   117.27      1.30-1.60   117.79
```

Spread **1.41 L**, non-monotonic, i.e. noise. **No halo. The shadow is ruled
out**, the "zero key light" claim holds, and chasing the residual further is not
licensed by anything I have registered.

So the move is the albedo lever, derived in the registration above before any of
this was measured, at exactly the size it was derived to be:

```
(0.97, 0.925, 0.82) -> (1.00, 0.955, 0.85)
albedo L 0.927 -> 0.957   = +3.2%      chroma/L 0.162 -> 0.157  (Fix G's warmth held)
predicted dial L 122.2 x 1.032 = 126.2 = plaster + 5.7
```

L3 needs +5. This clears it by 0.7 and by nothing else. **L4 will still fail**,
and it should: throughput is per-albedo, so the albedo lever cannot move it, and
5.5% of this dial's brightness remains unexplained. Recording that as an open
number is more useful than a gate I quietly retire.

## Fix H3 — the two changes, and what I predict

`BEZEL_FRONT_Z` 0.0 → 0.002. Dial albedo → (1.00, 0.955, 0.85). Gates L1–L7
unchanged, same instrument, same frozen box.

**Predicted: L1 ≥ 99%, L2 passes on count and I still expect it to fail on
distance**, because with the tie gone the only non-red left in the annulus is
the 2.7-px blend at the silhouette, and blended edge pixels sit near d ≈ 15 by
construction — a distance threshold of 25 cannot be met by a mask whose outer
radius is 0.47 against a bezel at 0.49. That is a flaw in **L2 as written**,
which I am naming now, before the render, rather than after it: the correct
discriminator is the one Q1 used — does the arc respond to depth bias — and L2's
distance term cannot distinguish "z-fight" from "antialiased edge" at this width.
**L3 passes at +5.7. L4 fails at ~0.945. L6 stays 145 × 58 and stays a fail.**

If L1 and L2's _count_ both hold and only the distance term fails, the clock is
done and the remaining L-gate failures are three known, sourced, recorded facts
rather than three defects.

---

# Fix H3, measured — 4 of 7, and the clock is done

```
L1  annulus >= 85% red                                     99.7%   PASS
L2  gaps <= 12% AND > 25 RGB from plaster           0.3% at 106.7   PASS
L3  dial median L >= plaster + 5           +3.9  (predicted +5.7)   FAIL
L4  dial tp >= 0.97 AND bezel tp <= 0.97           0.961 / 1.102   FAIL
L5  GUARD chroma >= 0.70x, dial L <= plaster+35     0.86x / +3.9   PASS
L6  bbox 140 +/- 4 x 58 +/- 3 (frozen box)              145 x 58   FAIL
L7  NEG CTRL cloths move < 2%                      0.00% / 0.00%   PASS
```

**L2 passed, and it passed the term I predicted it would fail.** I called the
distance term unmeetable at a 2.7-px annulus and it came back at **106.7**,
because with the tie gone the only non-red left in the annulus is not blended
plaster at all — it is the dark tick marks. Being wrong in the direction of the
render is the good direction, and the prediction is left standing above rather
than edited.

Journey of the ring, one number: **51.1% → 94.9% → 99.7% red**, with the gaps'
distance from plaster going 7.3 → 17.5 → 106.7. It is a closed ring.

## L4 was the wrong statistic, and I am not rescoring it on that account

The bezel measuring **1.102** — brighter per albedo than plaster while carrying
the clearcoat that costs 10% — cannot be true, so C1/C2 read throughput per
channel instead of on luminance:

```
             rendered RGB          R/aR    G/aG    B/aB
  plaster  (132.0, 117.0,  92.0)   141.9   136.0   131.4
  dial     (138.0, 124.0, 104.0)   138.0   129.8   122.4
  bezel    (115.0,  66.0,  52.0)   135.3   165.0   152.9

  dial  vs plaster   R 0.972  G 0.954  B 0.931    spread 0.041
  bezel vs plaster   R 0.953  G 1.213  B 1.164    spread 0.260
```

The bezel's albedo is (0.85, **0.40, 0.34**). Dividing a rendered value by 0.34
turns every additive term in the shader — ambient, bounce — into a huge ratio,
which is the entire 1.213 / 1.164 and therefore the entire 1.102. On the **one
channel where the bezel's albedo is large enough for the ratio to mean anything**,
R, it reads **0.953** — a loss, of the size and sign the Schlick derivation
predicted. The clearcoat story is confirmed on the bezel too.

Per channel L4 passes both halves (dial R 0.972 ≥ 0.97; bezel R 0.953 ≤ 0.97).
**It is still recorded as a FAIL.** The rule this document set two sections ago
is that an instrument may not be swapped in to change a verdict, and swapping one
in to change a verdict _in my own favour_ is the version of that mistake worth
guarding hardest. L4′ — per-channel throughput on the channel with the largest
albedo — is registered here for future work and is not applied retroactively.

## L3, and why the last 1.1 L units are not worth having

The albedo lever delivered +2.1 L where it predicted +3.9, and the dial sits at
**plaster + 3.9** against a threshold of +5. The channel table says why there is
no material loss left to recover: the dial's deficit is a **gradient** (0.972 /
0.954 / 0.931), not a flat attenuation. C2 registered flatness as the signature
of a material cause — roughness 0.35 against the wall's 0.55 was the candidate —
and the spread of 0.041 rules it out. What is left is chromatic: the room's
bounce is (1.0, 0.76, 0.47), and a dial that is _less warm_ than the plaster has
more blue albedo to fill from a light that has little blue in it.

So L3 can only be met by raising G and B, and that makes the dial colder in a
warm room to win a threshold I chose before I knew the light was warm or that the
red channel was already at its 1.0 ceiling. **The defect L3 existed to catch was
"the dial reads as a hole in the wall." In Fix G the dial was 4.1 L BELOW the
plaster. It is now 3.9 above — a swing of 8.0.** The hole is closed. The gate is
left failed and un-tuned, because moving it after the fact is the thing this
document exists to stop.

## Verdict

Three defects were named and all three are gone: the ring is unbroken, the dial
is above the wall, and the silhouette is where the projection model says it
should be. Three gates stand failed — L3 by 1.1 L units, L4 on a statistic proven
invalid for saturated albedos, L6 because the fix made the render agree with the
model the band was not centred on. None of them is a defect in the render, and
none of them has been edited to say otherwise.

**What remains owed is not the clock.** It is the wall: 12 of 88 band tiles
against the right wall's 40, `side_L` 68.2% against `side_R`'s 51.1% and the
Playroom's 32.3%, a peg rail 2.2 long against the plate rack's 3.4 and jammed in
the corner behind the door, and the whole upper expanse bare. Five registrations
have now named it. A correctly-drawn clock 0.98 across is worth less than any one
of those, and that is where this goes next.

# Fix G — the wall clock, and three of my six diagnostic gates failing

**Committed before the change is built or rendered.** Same rule as `0bfe3ce`,
`604b39c` and `c3cec3c`: this commit touches only this file.

Fix E2 landed as `3a7bb03`, all six gates passing. Both of its registrations named
the wall clock as owed next, so this is that.

## The projection model, and the gate that caught me holding it wrong

Everything below depends on knowing how many pixels a world dimension is worth on
the Kitchen's left wall, so `clock_gate.py` registered **H1** first: *predict the
clock's on-screen bounding box from source geometry alone, and fail everything if
it misses the render by more than 15% on either axis.*

It failed on the first run — predicted 58×23 px against a measured 24×20. The
cause was mine and it was stupid: I hardcoded `W, H = 1280, 800` from
`tools/capture.mjs`, but every render in `/root/design` is **3260×1726**. Every
px-per-unit figure was 2.16× too small and the projected centre landed 580 px away
from the clock, on bare plaster. Corrected:

```
camera                   (0, 5.703, -12.997)      clock (5.275, 3.9, 0.1)
incidence on the wall    68.2 deg off-normal  ->  in-plane squash x0.371
scale at that depth      144.26 px per world unit
1 unit of DEPTH costs    2.51 units of lateral occlusion

H1  predicted 126 x 50 px ellipse, measured 130 x 52     PASS  (3.2% / 4.6%)
```

The model is good to 5%, so the rest is admissible. Two numbers from it are worth
more than this clock and will be reused for everything else on these walls:

- **26.2 px per world unit** across the foreshortened axis of a Kitchen side wall,
  against 143 px along the unforeshortened one. A feature's readability depends
  entirely on which way it is turned.
- **2.51 units of lateral occlusion per unit of depth.** Side-wall props must be
  shallow, or they eat themselves.

## What I said was wrong with the clock, and what is actually wrong

I have been writing "the `face` cylinder swallows the `rim`, so only a crescent of
red shows" into registration docs for two commits. The first half is true as
arithmetic: `face` (r 0.37, len 0.10, centre z −0.03) spans local z [−0.08, +0.02]
and `rim` (r 0.44, len 0.09, centre −0.045) spans [−0.09, 0.00], so **the face
front stands 0.020 proud of the rim front**, and at 2.51 units of shift per unit
of depth that slides the face's silhouette 0.050 across the annulus:

```
rim annulus authored 0.070 wide all the way round
  visible +Z side   0.0203 world    1.15 px
  visible -Z side   0.1197 world    6.76 px      -> 5.9x asymmetry
  visible top       0.0768 world   11.00 px
  visible bottom    0.0632 world    9.04 px
```

But the conclusion I drew from it does not survive its own gates.

```
H2a PREDICTED +Z < 1.0 px AND -Z > 2.5 px AND ratio > 2.5    1.15 / 6.76   FAIL
H2b MEASURED red asymmetry about the centre > 2.0x                  1.19x   FAIL
H2c MEASURED red asymmetry at the waist > 2.5x            2.00x (1 vs 2)   FAIL
H3  smallest authored detail < 3.0 px                            1.15 px   PASS
H4  face saturation <= plaster - 4.0                       11.5 vs 16.2    PASS
H5  NEG CTRL rim saturation >= plaster + 15                35.7 vs 16.2    PASS
```

Each failure says something different and none of them is a threshold to move.

**H2a** fails only on its absolute component. The 5.9× ratio and the 6.76 px are
both clear; "+Z under 1.0 px, therefore gone" was written while `px_per_unit` was
wrong by 2.16×. The asymmetry claim survives. The *vanishing* claim does not, and
the render agrees — there is a thin red line on that side, not nothing.

**H2b** is an instrument error and it is mine. It counted red pixels either side of
the clock's projected centre, but the ring's top and bottom arcs straddle that line
and contribute almost equally to both counts. It measured the wrong thing. **H2c**
is what it should have been — red only in a ±10 px band through the waist, where
the ring can only be its left and right sides — and H2c fails too, at 2.00×.

It fails because **there is almost no red at the waist on either side**: 1 px and
2 px. And that is the actual finding. Look at what the model says without the
occlusion term at all: a 0.070 annulus is 11.0 px at the top and 10.0 px at the
bottom but **only 2.7 px at each side**, because the top and bottom of the ring are
measured along world +Y, which is not foreshortened, and the sides are measured
along world +Z, which is squashed to 0.371. The ring cannot close. It reads as two
arcs, top and bottom, with fragments at the sides.

**So "a crescent of red" was never occlusion. It was projection.** The face
standing proud makes an already-broken ring lopsided — 1.15 against 6.76 — but the
ring was broken before the face touched it. If I had fixed only what I said was
wrong, I would have moved the sides to 2.7 px each, called the asymmetry cured, and
shipped a clock that still reads as a chipped plate.

**H3** passes at 1.15 px, but it is carried by the rim alone and the render
disqualifies the interpretation I had ready for it. Ticks measure **2.54 px** and
hands **2.15 px** and *both read clearly*. There is no 3-px legibility floor. The
smallest feature on this wall that observably reads at all is the hands at 2.15 px,
and the smallest **ring** width that observably reads is the −Z side at 6.76 px.
That gap is the whole design lesson: an isolated dark bar on a pale dial survives
2 px, and a thin band pressed against a high-contrast silhouette does not.

**H4 and H5** turned up a second defect I was not looking for. The dial reads
*grey* on a warm wall. HLS saturation 11.5 against plaster's 16.2 — but HLS
saturation shrinks with lightness for fixed chroma, and the dial is much brighter
(L 179 vs 120), so that comparison is rigged. Restated luminance-independently:

| | RGB | L | chroma | **chroma / L** | hue |
| --- | --- | --- | --- | --- | --- |
| plaster | 132.9, 119.2, 95.8 | 120.5 | 37.1 | **0.308** | 37.9° |
| clock face | 185.3, 178.9, 167.1 | 179.4 | 18.2 | **0.102** | 39.0° |
| red rim | 116.1, 69.2, 55.0 | 78.2 | 61.1 | **0.782** | 14.0° |

The dial carries **33% of the plaster's relative chroma**. H5 is the control that
makes this mean something: the red rim, same surface, same depth, same light, sits
at 254% of it. The wall is not dim there. The dial is genuinely a grey hole, and
the reason is in the source — its albedo is `(0.96, 0.95, 0.90)`, chroma/L 0.063,
against plaster's `(0.93, 0.86, 0.70)` at 0.266. **24% in albedo, 33% measured.**
The render is just showing me what I authored.

## The change

Three parts, each derived from a number above rather than chosen.

**1. The bezel is widened to the one width that observably works.** `CLOCK_RADIUS`
0.44 → **0.49**, with the face radius held at **0.37**, so the annulus goes 0.070 →
**0.120**. 0.120 is not a taste: it is the −Z side of the current render, 6.76 px,
the only ring width in this image that reads, applied the whole way round. At the
sides it gives 6.8 px where there are now 1.15 and 6.76; at top and bottom, 17.2 px.

The face radius is *held*, not scaled, because the dial's contents — ticks at 2.54
px, hands at 2.15 px — measurably read and there is no reason to disturb them. The
clock grows 0.88 → 0.98 in diameter, +11%.

**2. The face is recessed behind the bezel, which is what a bezel is.** Bezel front
at local z **+0.04** (0.04 proud of the wall), face front at **+0.01**. The bezel
is then in front of the face everywhere and cannot be occluded by it at any angle.
It instead occludes 0.03 × 2.51 = **0.075** of dial on the near side — 10% of the
dial's diameter — which is a bezel casting over its own face, and is depth on a
wall that has none. Ticks and hands are re-anchored to the face front rather than
to absolute local z, so they stay bedded in the dial instead of floating 0.06 off
it, and nothing pokes through the bezel plane.

**3. The dial is warmed to a derived cream.** Target: chroma/L at **60%** of the
plaster's 0.266 in albedo, at the plaster's own hue, staying clearly the palest
thing on the wall.

```
hue 41.7deg  =>  (G-B)/(R-B) = 0.695
chroma = 0.60 x 0.266 x L,  solved at L ~ 0.927
  ->  (0.970, 0.925, 0.820)     chroma 0.150   chroma/L 0.162   =  61% of plaster
      vs authored (0.96, 0.95, 0.90)  chroma 0.060  chroma/L 0.063  =  24%
```

It stays 7 points of albedo-L brighter than the plaster, so it is still a pale dial
and not a beige one.

## Gates, registered now

Kitchen, fresh render, same camera, same masks, same thresholds as the diagnosis.

| gate | claim | now |
| --- | --- | --- |
| **K1** | waist-band red ≥ **3 px on each side** | 1 and 2 |
| **K2** | waist-band red side ratio **≤ 1.6×** | 2.00× |
| **K3** | dial chroma/L ≥ **0.55 ×** plaster's | 0.33× |
| **K4** | *runaway guard* — dial L ≥ plaster L **+ 40**, dial hue within **8°** of plaster | 179 vs 120, 39.0° vs 37.9° |
| **K5** | *negative control* — the peg-rail cloths, 5.5 units away on the same wall, move **< 2%** in bbox and mean RGB | untouched by this change |
| **K6** | measured non-plaster bbox in **132–150 px tall, 51–62 px wide** | 130 × 52 |

K6 is the guard against fixing legibility by inflation. The prediction is 140.2 ×
55.4 and the band is tight around it; a clock that comes back at 200 px has been
made readable by being made a dinner plate, and that is not a fix.

## Sufficiency, called in advance

**K1 is the gate I expect to fail.** Its instrument counts pixels whose redness
clears plaster + 4σ, and that same instrument scored the −Z side at **2 px when the
model predicts 6.76** — antialiasing and the fact that the +Z-facing half of the
bezel's cylinder wall receives zero key light (`dot((0,0,1), -keyDir) = -0.35`)
between them eat most of it. If K1 fails while K2 passes, the ring has been made
symmetric and the instrument still cannot see it, and the tiebreak is the picture,
not a threshold moved after the fact.

I expect K2, K3, K4 and K6 to pass. K5 should pass trivially and exists so that a
render which moves the cloths tells me the build, not the edit, is what changed.

**What this fix does not do.** The Kitchen's left wall still holds 12 of 88 band
tiles against the right wall's 40, `side_L` is 68.2% against `side_R`'s 51.1% and
the Playroom's 32.3%, the peg rail is 2.2 long against the plate rack's 3.4 and
jammed into the corner behind the door, and the entire upper expanse is bare. A
correctly-built clock 0.98 across changes none of that. It has been owed since Fix
B and it is still owed after this. `soul.md` asks that every surface feel like
something a child could touch, and one clock and three tea towels on a wall 20 long
is not that.

If the numbers disagree with the picture, the picture wins.

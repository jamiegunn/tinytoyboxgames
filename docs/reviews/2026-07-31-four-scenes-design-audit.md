# Four scenes, measured: a design audit that spent most of its effort disqualifying itself

**Charge.** _"Now do the same exercise on these items, but using a designers eye and scoring
mathematically. I propose these scenes / rooms still suck and suck hard. Agree, Disagree, I don't
care - just defend your choice rationally and mathematically and then don't trust yourself - test
your conclusions."_

**Subjects.** Four capture frames: Nature (3344×1762), Pirate Cove (3232×1708), Living Room
(3180×1706), Kitchen (3260×1726). All statistics below mask the UI chrome — the top 8% of frame
height across the left 12% and right 12% of width — so the back/home pills and the settings pill are
excluded from every number.

**Verdict, stated first so it can be checked against what follows.** Partial agreement, and the
partial matters more than the agreement. The two rooms are indefensible and I can say by how much.
The Pirate Cove is defensible on colour and tone and indefensible on content density and symmetry.
**Nature does not suck**, and every attempt I made to prove it did was defeated by my own controls.
The single most important sentence in this document is that last one, because it is the one the
instrument produced against my expectation.

**Status, added after the fact.** Fix C has been built, measured and shipped (`bc4d01f`) — the
kitchen's colour reservoir went from 1.2% of pixels to 31.8% with no albedo edited, which was this
document's own falsifiable prediction. Its _prescription_ was wrong in a way worth reading before
trusting the remaining fixes, and §Fix C now carries both the original text and the correction, along
with a finding about the playroom that neither confirms nor refutes this audit but independently
corroborates Fix B. Fixes A, B and D remain unrendered predictions.

---

## 1. The instrument, and the four times it was wrong before it was allowed to say anything

The charge asks for mathematics and then asks me not to trust it. The order that actually protects
against self-deception is the reverse: falsify the instrument first, and only then let it speak. Four
metrics were built, run, and found defective before any verdict was written. Recording them is not
throat-clearing — three of the four defects would have produced a _published number that sounded
right_.

### 1.1 A metric that returned the same value for every input

The first battery included a "low-frequency energy fraction": the share of radially-averaged spectral
power in the lowest sixteenth of the frequency range, offered as "the squint test made quantitative."
It returned 99.4%, 99.1%, 99.5%, 99.6% for the four scenes.

A metric that cannot discriminate is not measuring its input. The cause was arithmetic, not
photography: natural-image power falls as roughly 1/f², so the lowest band holds essentially all the
energy **regardless of content**. The number was a property of the integration limits.

Replaced by octave-band decomposition, which normalises the falloff away. The replacement
discriminates, and the discrimination is the finding:

```
share of spectral energy per octave, coarse -> fine
  nature        12.9%  14.0%  18.6%  23.4%  11.9%   8.4%   6.1%   3.9%   0.8%
  pirate        21.0%  15.6%   7.2%   7.9%  12.8%  18.6%   9.1%   6.5%   1.2%
  living_room   21.5%  21.9%  13.0%  14.5%   9.6%   7.4%   6.1%   5.1%   0.9%
  kitchen       31.0%  21.6%  12.5%   9.2%   7.9%   6.7%   6.0%   4.4%   0.7%
```

Nature peaks in the middle octaves — detail at the scale of objects. The kitchen is monotonically
front-loaded: 31.0% of its energy is in the coarsest octave, 2.4× nature's 12.9%. The kitchen frame
is built out of large undifferentiated masses.

### 1.2 A symmetry index that returned values symmetry cannot have

Bilateral symmetry, computed as the correlation of the frame with its own mirror, came out
**negative** for the living room (−0.168) and the kitchen (−0.298). A picture cannot be
anti-correlated with its own reflection by composition; that number had to be an artifact.

It was. Both rooms carry a large horizontal luminance ramp, and a ramp correlates _negatively_ with
its own mirror image, swamping everything else. Removing a fitted linear ramp first:

```
scene          raw    detrended   ramp across frame
nature        0.315     0.325        -15.5 L
pirate        0.551     0.560        +12.0 L
living_room  -0.168     0.205        +48.8 L
kitchen      -0.298     0.233        +53.2 L
```

The artifact was worth more than the metric. A 48.8 and 53.2 luminance-unit gradient across the frame
is enormous — it is a third of the usable range — and it is a real property of these two rooms that
nothing in the original battery would have reported. It reappears in §4.

### 1.3 A control set drawn from the wrong distribution

Three synthetic controls were rendered to test whether the instrument could rank a known-good
composition above a known-bad one, including a deliberate false-positive trap: a _good minimal_
composition that is mostly empty. Written into the script before running, verbatim: _"If the
instrument scores this as badly as ctrl_bad, then 'percent flat' is measuring emptiness rather than
quality and every dead-space claim I make about the four scenes is unsupported."_

Result: the known-good control scored 91.2% flat, the known-bad 94.8%, the minimal 97.9% — and every
real scene scored better than all three. The controls were flat-shaded vector art with no shading
gradients, no texture, no anti-aliased micro-detail. A 3D render is a different distribution and the
comparison was meaningless in both directions.

Rebuilt from the real distribution: crops cut from the four renders themselves, at regions any viewer
can verify by eye as dense or empty, composited into frames with a known ordering.

### 1.4 My own rebuilt control had a scale confound, in the direction that flattered me

The first rebuild composited at 1200×800 while the scenes are ~3260×1726, then compared 32-pixel-tile
statistics directly. A 32px tile spans 2.7% of a 1200px frame and 0.98% of a 3260px frame — the
control's tiles cover 2.7× more picture and are correspondingly more likely to contain an edge,
biasing the controls toward looking _less_ flat. That is the direction that makes the kitchen look
worse by comparison. I noticed only after reading a result I liked.

Rebuilt at native scale, no resampling anywhere:

```
                colourful   %grey    Lstd    dyn   %flat
REAL-DENSE           26.0   47.4%    73.0  0.847   14.7%
REAL-SPARSE          30.0   31.7%    45.2  0.903   45.8%
REAL-MINIMAL         30.4   32.4%    45.8  0.903   44.8%     <- subject = 5.5% of frame
```

Both pre-registered hypotheses resolved, and the second one cost me the headline:

- **H1 confirmed.** Dense 14.7% vs sparse 45.8% — a 3.1× separation. Flat-tile fraction does respond
  to content density within the actual rendering distribution, so comparing the four scenes _against
  each other_ is licensed.
- **H2 confirmed, and it is the expensive one.** REAL-MINIMAL sits at 44.8%, essentially on top of
  REAL-SPARSE's 45.8%. A defensible composition with a real subject on a thirds intersection is
  indistinguishable from a frame of pure nothing. **Percent-flat measures emptiness and nothing
  else.** It cannot tell good minimalism from bad vacancy, and therefore **no dead-space number can
  carry a quality verdict on its own.**

That retires my original thesis in the form I had written it. What survives of it is narrower and has
to be earned elsewhere. One comparison does survive intact, because it is like-for-like: **the
kitchen's full frame, furniture and all, is 51.7% flat — emptier than REAL-SPARSE's 45.8%, which is a
collage made by tiling the four scenes' own hand-picked emptiest corners.** The other three scenes
sit below it (nature 30.9%, living room 37.8%, pirate 42.6%).

---

## 2. The battery, after repair

```
scene         colourful  %grey   Lstd    dyn   %flat  symm*  coarse8ve  <L120
nature             30.9   6.8%   52.8  0.787  30.9%  0.325      12.9%  23.8%
pirate             36.8  35.5%   44.8  0.679  42.6%  0.560      21.0%  15.2%
living_room        20.1  33.7%   25.1  0.479  37.8%  0.205      21.5%   1.8%
kitchen            14.8  71.7%   23.2  0.364  51.7%  0.233      31.0%   1.2%
```

\* detrended. `%grey` is HSV saturation below 0.15. `dyn` is the 1–99 percentile luminance range over 255. `<L120` is the share of pixels below luminance 120 — see §4.

Colourfulness is Hasler & Süsstrunk's metric M3, used because its bands come from _their_ twenty
human observers rather than from me: below 15 "not colourful", 15–33 "slightly", 33–45 "moderately",
45–59 "averagely". The kitchen at **14.8 falls below the bottom of a published scale that starts at
"not colourful."**

That number needed its own check, because a metric could easily be an emptiness proxy in disguise. It
is not: REAL-DENSE scores 26.0 and REAL-SPARSE scores 30.0 — the _emptier_ control is _more_
colourful. Colourfulness carries no ordering with density, so the kitchen's 14.8 is a fact about
colour and not a restatement of its flatness.

---

## 3. The independent instrument: project the game onto the frame

Every number so far is a pixel statistic, and §1.3 established that pixel statistics cannot separate
dead space that matters from dead space that does not. So the frames were computed from the other
end — from source. Camera presets were read out of `cameraPresets.ts` and `sceneCatalog.ts`, every
tappable prop's world position was traced to its `dispatcher.register` / `createTapInteraction` call
site, and the props were projected onto the frame. **No pixel is read to place a prop**, so agreement
between the two instruments is not circular.

**Self-check first, because a wrong camera model would void everything.** Large non-interactive
landmarks were projected and compared against the images by eye. Kitchen: fridge predicted at 38%,33%
of frame — the fridge is at 38.5%,32%. Stove predicted 62%,35% — it is at 63%,35%. Window 46%,21% —
it is at 46%,21%. Living room: fireplace 43%,32%, window 59%,19%, both doorways, both toyboxes, all
within about a percent. The camera model reproduces the renders.

```
scene         taps  hull % frame  %flat IN hull  %flat OUTSIDE    gap
nature          26        13.6%          18.1%          32.9%   14.8%
pirate           6         5.5%          26.4%          43.5%   17.2%
living_room     12        17.4%           9.1%          44.0%   34.9%
kitchen         10         9.2%          12.7%          55.8%   43.0%
```

**The convex hull of every tappable thing in the picture covers 5.5% to 17.4% of the picture.** That
is a source-derived number with no aesthetic content, and it is an _over_-estimate of interactive
area, because the hull is drawn around point positions and swallows all the empty floor between them.

### 3.1 The null test, which killed half the finding

The gap column invites the reading "the frame's information is not where the game is." There is a
boring rival: _any_ central region of _any_ rendered frame is less flat than its periphery, because
renderers put the subject in the middle and the sky and floor at the edges. If a same-sized blob
dropped anywhere central gives the same gap, the word "interactive" is doing no work.

So the hull's shape and area were held fixed and it was moved — 400 random placements per scene, plus
one centred on the frame.

```
scene         real gap  centred  null mean  null sd     z   beats
nature           14.4%    14.5%       9.9%   11.1%  0.41   56.5%
pirate           18.3%    18.7%       8.5%   23.1%  0.42   57.5%
living_room      35.1%    34.9%      21.1%   13.5%  1.04   98.8%
kitchen          43.0%    39.7%      15.5%   24.7%  1.12   90.8%
```

Two things happen here and both are against me.

**Nature and Pirate fail outright.** Their hulls beat 56.5% and 57.5% of random placements — the
middle of the null. Whatever their gaps mean, it is not that these scenes misallocate detail relative
to their interaction. I withdraw that claim for both, and specifically I withdraw the pre-test
assertion I had formed about Nature spending its detail budget on untouchable background.

**The rooms survive the significance test and lose the causal one.** Living room at the 98.8th
percentile and kitchen at the 90.8th are real outliers. But look at the `centred` column: 34.9 versus
real 35.1, 39.7 versus real 43.0. **A blob of the same size placed at the dead centre of the frame
reproduces the result.** The interactive hull is not specially placed; it is simply _central_. So the
honest statement is two separate facts rather than one causal claim: the periphery of these two
frames is drastically emptier than their centres (44.0% and 55.8% of peripheral tiles carry no
information), and all the interactive content is confined to the centre. Their conjunction is the
design problem. The gap statistic on its own does not prove misallocation and I will not report it as
though it does.

---

## 4. What survived, and it is worse than what did not

Two findings passed every control and every null test. Neither is a pixel statistic in the sense that
got the others killed.

### 4.1 Geometry: half the picture is two walls holding nothing

Computed from `layout.ts` constants and the camera preset, with no pixels involved at all:

```
                side walls   back wall   ratio
living_room          47.6%        9.7%   4.90:1
kitchen              47.9%        9.6%   4.99:1
```

Set against the source inventory of what is _on_ those walls. In the kitchen: the cabinet run,
backsplash, window and curtains, fridge, stove, open shelf, pot rail and its three pots, sample
counter — **every one on the back wall.** The left wall carries a doorway. The right wall (x = −5.4)
carries nothing at all, not one object. In the living room: fireplace, mantel, firebox, window,
curtains, both pictures — **every one on the back wall**, and both pictures on the +X half of it, so
even the back wall is half-used. The side walls carry doorways and continuous shell trim.

**These rooms give 48% of the frame to surfaces holding 0% of the content and 10% of the frame to the
surface holding 100% of it.** No judgement of taste is required to state that, and it is not
recoverable by lighting, palette, or better props.

### 4.2 Tone: the rooms are grey because they are bright, not because they are grey

The source palette is not desaturated. Kitchen floor albedo is (0.67, 0.50, 0.34) — HSV saturation
0.49. Walls 0.25. The living room's couch is a full teal, its fireplace terracotta, the kitchen's
kettle a saturated yellow, its fruit red, orange and green. And yet 71.7% of the kitchen's pixels
render at saturation below 0.15.

Those two facts cannot both describe the same thing, so the discrepancy localises the defect. My
first hypothesis was exposure clipping — key intensity 1.40 against a 0.93 red channel should drive
past 1.0 and clip, and clipping destroys saturation. **That hypothesis is refuted:** 0.0% of the lit
wall reaches 250, and its mean renders at (198, 193, 179). Nothing is blowing out.

What is actually happening is visible in saturation as a function of luminance:

```
scene          L 40-80  L 80-120  L 120-160  L 160-200  L 200-240
nature           0.599     0.318      0.244      0.248      0.100
pirate           0.391     0.407      0.285      0.219      0.072
living_room      0.383     0.327      0.167      0.169      0.086
kitchen          0.193     0.235      0.114      0.131      0.109
```

Saturation collapses with luminance in **every** scene, nature included. Colour lives in the shadows.
And then:

```
scene          mean L   sd L   <L80   <L120
nature          134.3   52.8  20.1%   23.8%
pirate          174.0   44.8   5.4%   15.2%
living_room     170.0   25.1   0.4%    1.8%
kitchen         177.2   23.2   0.1%    1.2%
```

**The kitchen has 1.2% of its pixels below luminance 120, and 0.1% below 80.** It has no shadows. It
therefore has no reservoir of saturated pixels, and no amount of repainting will give it one, because
the paint is already saturated and is being rendered into the top of the tone curve where channel
differences compress. Nature's 23.8% is why nature has colour. The corroborating measurement is the
same wall material lit and shaded: kitchen wall albedo saturation 0.247 renders at 0.114 on the shaded
side and 0.097 on the lit side — the shaded side keeps more colour, which is the signature.

This is also where §1.2's discarded artifact comes back. The +53.0 and +48.8 luminance ramps are a
real lighting asymmetry: a single key at world x = +4.51 aimed at the origin, against a flat
hemisphere fill at 0.30 (key:fill of 4.7:1), lighting a room whose walls sit at x = ±5.4. Screen-right
measures 192.3 against screen-left's 154.3. Worth recording that the source cross-check predicted the
_opposite_ direction by reasoning from the light's position rather than from which surface normals it
faces; the pixels settle it, and the images confirm it by eye.

---

## 5. The fixes, one of which failed its own evaluation

### Fix A — reframe the camera. **Rejected.**

The obvious move against a 4.99:1 side-to-back ratio is to raise and tilt the camera. A sweep over
polar, distance and target height, requiring all tap targets to stay on screen, found polar 0.95 /
distance 12.5, taking the side walls from 47.9% to **11.1%** and the kitchen's interactive hull from
9.2% to 16.9%.

**That pose does not exist.** `resolveSceneCameraPose` clamps camera Y to `ceilingY`, default 6.0, and
the proposed pose sits at y = 7.77 — above the clamp and above the rooms' own `CEILING_Y` of 6.2, i.e.
outside the room looking in through the lid. The engine would silently drag it back and I would have
shipped a preset that does not do what the sweep said.

Re-swept under the real constraint `targetY + distance·cos(polar) ≤ 6.0`:

```
kitchen      SHIPPED                          side 47.9%  back  9.6%  floor 22.2%  hull  9.2%
             polar 1.16 dist 12.5 targetY 1.0  side 47.4%  back 11.1%  floor 29.7%  hull 12.7%
living_room  SHIPPED                          side 47.6%  back  9.7%  floor 22.5%  hull 17.4%
             polar 1.24 dist 12.0 targetY 2.0  side 46.8%  back 10.8%  floor 30.6%  hull 26.4%
```

The best reachable pose moves the side walls by **eight tenths of one point.** At distance 14 the
clamp forces polar ≥ 1.167, so the shipped 1.19 is _already pinned against the ceiling_ and cannot be
improved by tilting at all. The camera is not the broken thing. What the reachable poses do buy is
worth taking on its own terms — the kitchen's hull goes 9.2% → 12.7% and the living room's 17.4% →
26.4% — but note what pays for it: the floor share rises 22.2% → 29.7%. Dead wall becomes floor, and
the kitchen floor is itself 67%/31%/48% flat by thirds. **Fix A alone moves the dead space rather
than removing it, so it is a companion to a fix and not a fix.**

### Fix D — the room plan. **The actual knob.**

An interior 10.55 wide × 20 deep × 6.2 high, viewed head-on from just outside its front edge, is a
corridor, and looking down a corridor puts its two long walls across most of the picture as a matter
of perspective and not of taste. Sweeping the plan with the camera held at its shipped pose:

```
half-width  depth  plan ratio   side %   back %  side:back
      5.28   20.0        0.53    47.7%     9.6%     4.98:1   <- SHIPPED
      5.28   16.0        0.66    45.0%     9.6%     4.69:1
      5.28   12.0        0.88    18.7%     9.6%     1.95:1
      8.00   12.0        1.33    25.9%    14.5%     1.78:1
      8.00   10.0        1.60    17.5%    14.5%     1.21:1
      9.00    8.0        2.25    12.3%    16.4%     0.75:1
```

**Depth is the dominant term.** Shortening the room from 20 to 12 with no other change takes the side
walls from 47.7% to 18.7% and the ratio from 4.98:1 to 1.95:1. Widening then raises the back wall's
share, which is what puts content on screen: at 16 wide × 10 deep the ratio is 1.21:1 and the back
wall has grown by half.

Evaluated honestly, the fix has a cost and here it is: the kitchen toybox sits at z = −5.70 and the
living room's two at z = −5.20 and −5.50, all outside a depth-12 room. They would have to move
forward. That is three constants, and the room-layout constants are already known to be triplicated
across kitchen, living-room and playroom with 28 names carrying conflicting values, so this change
lands squarely in work already queued.

### Fix B — dress the side walls. **Complementary, and cheap.**

If the plan is not touched, the side walls remain 47.6%/47.9% of the frame. At the back wall's
content density — 7 decor groups over 9.6% of frame in the kitchen — matching it across the side walls
would take 35 groups. Reaching even a quarter of the back wall's density takes **9 groups, five and
four, one per wall pair.** Nine objects to bring half the frame from zero content to a quarter of the
room's own established density is the best content-per-unit-effort available anywhere in this audit.

### Fix C — restore a dark end. **The colour fix, and it is not a palette fix.** — BUILT AND SHIPPED

Because saturation only exists below roughly L 120–160 and the kitchen has 1.2% of its pixels there,
the instruction is to _build a shadow_, not to repaint. The testable target: bring `<L120` from 1.2%
toward nature's 23.8%, and lift `sd L` from 23.2 toward nature's 52.8, without a single albedo being
edited.

**This section is retained above the correction because the prescription it gave was wrong, and the
way it was wrong is the finding.** As first written it named the hemisphere fill — "currently 0.30
with `fillGroundColor` omitted, which degenerates it to a uniform ambient" — as the term to cut. Two
errors in one sentence. `fillGroundColor` was never a field this document needed to add; it already
existed on `RoomEnvironmentConfig` and was simply never set by any room, so no type widening was
required. And the fill was not the dominant term. Ablating one term at a time found that
`scene.environmentIntensity = 0.24` — a PMREM of three.js's stock `RoomEnvironment`, which is a white
studio box — was carrying **73% of the kitchen's luminance**, flat in every channel. I had diagnosed
the second-largest flat term while the largest one was applied globally in a renderer utility, out of
sight of every file that owns lighting. Two minigames had already noticed the symptom and responded
by hand-copying a local override rather than importing anything.

What shipped (`bc4d01f`): `environmentIntensity` promoted to `LightingConfig` so a room can own it,
cut 0.24 → 0.08 in the kitchen and living room; key raised to hold the sunlit side where it was; fill
trimmed; and a dark ground half given to the hemisphere, which previously degenerated to
sky === ground and so could shade nothing. Measured on the shipped build with every tuning hook
removed:

```
scene            sd L  mean L   <L120  %flat  colour  satmid  shadow L  shdw tex   lit L
kitchen          45.7   139.2  31.8%  32.6%    23.2   0.218      75.2      0.64   168.8
living_room      44.3   132.4  34.3%  27.4%    29.3   0.283      72.7      0.64   164.7
playroom         41.3   152.8  27.3%  21.9%    34.4   0.205     103.3      0.80   174.3

baselines:  kitchen sd 23.0 / flat 51.7% / <L120 1.2%     living room sd 24.6 / flat 40.6%
```

The kitchen's colour reservoir went from 1.2% of pixels to 31.8%, past nature's 23.8%, with no albedo
touched — which is the specific claim this section made and the one worth checking hardest. Every
number above was reproduced to within 0.04 by a test that pre-registered its predictions before
rendering, because the entire tuning loop had run through a query-param hook and nothing had yet
proven the hook and the shipped configuration render the same room.

**The playroom refutes something this document implied.** All three rooms shipped an identical
lighting config, so I recorded that all three had the same defect. Rendered, they did not:

```
                sd L   %flat   <L120  colour  wall texture
  kitchen base  23.0   51.7%    1.2%    17.5      0.46
  playroom      32.6   27.3%    8.2%    33.3      2.15
```

The playroom beat the _fixed_ kitchen on flat-region coverage, with nearly double the colourfulness
and 4.7× the wall texture, **before anything was done to it.** A defect inferred from a configuration
similarity is not a defect. What differs is visible in the picture: the playroom's side walls carry
windows, a pinboard, a chalkboard, a door and wainscoting, where the kitchen's carry nothing — and
the side walls are ~48% of the frame. **That is Fix B already built, in a room I did not design as an
experiment and could not have fitted to the result.** It is the strongest evidence in this audit for
the fix that has not been built yet, and it arrived by accident. The playroom accordingly received a
deliberately weaker version of the change (environment 0.24 → 0.16, not 0.08): pushed to 0.08 its
shadow wall fell below the pre-registered floor that keeps a wall in shade reading as a wall rather
than an absence, and a room that was already working does not get the strong medicine.

Two further corrections to the record. The ground colour `0x5c4530` was documented in the source as
"warm bounce off the floorboards"; the floors were then sampled and it sits 8–10° of hue from every
floor in the building, and substituting the floor-derived colour moved `sd L` by 0.04 against a
same-build noise floor of 0.20. The hue is close to inert — the _darkness_ is what shapes the room.
The constant stays, because it cleared a pre-registered gate and was chosen by eye, but it is a
preference and the comments that claimed a derivation have been retired. And every variant here was
scored against a **dim-only negative control**, which is what stops "less flat" from being satisfied
by "darker": on the playroom that control passed the naive flatness gate outright, and failed only on
mid-tone saturation moving the wrong way. A gate the negative control also passes is measuring
nothing.

### Pirate Cove and Nature

The Pirate Cove is not a tone problem — colourfulness 36.8 is the highest of the four, comfortably
"moderately colourful", and its colour reservoir at 15.2% is healthy. Its two problems are content and
symmetry. Flatness by horizontal band runs **81% / 51% / 53% / 20% / 12%** top to bottom: the upper
40% of the frame — sky and sea — is close to empty, and the deck below is the only part carrying
detail. And the detrended symmetry of 0.560 is the highest measured, with a raw left-versus-mirrored-
right correlation of 0.569: mast dead centre, two identical rail runs, two mirrored spars, mirrored
ring coils. A ship photographed down its own centreline is a diagram of a ship. With six tap targets
in a hull covering 5.5% of the frame — the least interactive of the four by a factor of two — the
fixes are to break the centreline (offset the wheel, stagger the barrels, put something on one rail
that is not on the other) and to give the sky and sea something to be.

Nature comes out of this audit intact and I want to be explicit that I expected otherwise. It has the
best colour reservoir (23.8%), the widest luminance range (sd 52.8), the lowest near-grey share
(6.8%), mid-octave-dominant spectral structure, 26 tap targets, and it failed my null test in the
direction that exonerates it. Its one defensible weakness is the foreground: flatness by band runs
23% / 19% / 19% / 36% / **57%**, so the bottom fifth of the frame — the nearest ground, where a
child's hand rests — is bare. That is a single, small, local fix, and it is the only thing I am
willing to say against this scene.

---

## 6. Blind spots this audit does not cover

1. **The interactive hull treats props as points.** Nature's four game portals are large discs — among
   the biggest elements in the frame — and contribute a point each. Nature's 13.6% is therefore an
   _under_-estimate while the rooms' 9.2%/17.4%, whose props are small objects, are closer to fair.
   The comparison across scenes is biased against nature, which is the direction that makes my
   exoneration of it conservative but makes any cross-scene hull ranking unsafe.

2. **The captures are of the default camera pose only.** Every scene permits pan and orbit within
   constraints. Everything here describes the frame the child is _first_ given, which is the frame
   worth arguing about, but is not the only frame that exists.

3. **`%flat` is an emptiness measure and nothing more** (§1.4). It is used here only for within-scene
   band comparisons and for the one like-for-like comparison against REAL-SPARSE.

4. **The null test's `beats` column is not a p-value.** The 400 placements are translations of one
   fixed hull shape, so they are not independent draws from any well-defined population. It supports
   "this placement is unremarkable within its own translation family" and no stronger statement — and
   that is the direction in which it was used, to _reject_ two findings rather than to license one.

5. **Fix D's numbers assume the camera and prop set stay put.** Moving three toyboxes is priced above;
   whether a 16×10 room still reads as the same room is a judgement no measurement here makes.

6. **Nothing here was rendered — _no longer true of Fix C, and it cost the prescription._** Every fix
   was originally evaluated against predicted numbers from geometry and tone, not against a
   re-capture. The predictions were stated so a re-capture could falsify them: side walls 47.9% →
   17.5%, `<L120` 1.2% → toward 23.8%, kitchen hull 9.2% → 12.7%. Fix C has since been rendered.
   The `<L120` target was met and passed (1.2% → 31.8%); the _prescription_ for how to get there was
   wrong, naming the hemisphere fill when `environmentIntensity` was carrying 73% of the luminance
   (§Fix C). Ranking a fix from an unrendered model got the target right and the mechanism wrong.
   Fixes A, B and D remain unrendered and their numbers should be read with that in mind.

7. **A defect was assigned to the playroom from its config file, not its picture.** Corrected in
   §Fix C, and left visible here because the correction is the more useful artifact than the claim.

---

## 7. Register

**(xliii) A metric returning the same value for every input was nearly published as a finding.**
"99.4% of energy is low-frequency" reads like a measurement of a soft, low-detail image. It was a
property of the integration limits and would have been true of any photograph ever taken. _A metric
that does not discriminate between your inputs has not looked at them, and the tell is available
before you interpret a single value: check the spread across inputs before checking the values._

**(xliv) The artifact was worth more than the metric it broke.** Negative symmetry was impossible, and
chasing why produced the 48.8/53.2-unit luminance ramps — a first-order fact about both rooms that
the working battery had no channel for. _An impossible reading is a channel to something real; the
question is never only "what is wrong with the number" but "what is the number accidentally
measuring."_

**(xlv) A control drawn from the wrong distribution is worse than no control, because it produces a
verdict.** The synthetic controls ranked known-good above known-bad by 3.6 points and scored every
real scene better than all three. Had I read that as "the instrument works, and the scenes are fine",
or as "the instrument is broken, discard it", both would have been wrong. _A control must come from
the same distribution as the thing controlled, or it tests your renderer rather than your metric._

**(xlvi) I found the scale confound in my own control only after it gave me the answer I wanted.**
The 1200px-versus-3260px tile mismatch biased the controls in exactly the direction that made the
kitchen look worse. It was found on re-reading, not on writing. _The moment a result confirms you is
the moment to re-derive it; agreement suppresses the audit that disagreement triggers automatically._

**(xlvii) A significance test and a causal test are different tests, and passing the first is
routinely reported as passing the second.** The rooms' gaps sit at the 98.8th and 90.8th percentile of
the null — real outliers. And a blob of the same size at the dead centre of the frame reproduces them
(34.9 vs 35.1; 39.7 vs 43.0). The effect is real _and_ the proposed cause is not established. _"Not
explained by chance" and "explained by my mechanism" are independent claims; the null distribution
tests the first, and only a second null built from the rival mechanism tests the second._

**(xlviii) The fix that survived scrutiny is the one I did not propose first.** Fix A was proposed,
swept, optimised, and found to recommend a camera position the engine clamps away — an 11.1% result
that would have been shipped as fact and silently delivered 47.1%. _An optimiser searching a space
wider than the system's constraints will return its answer from the part of the space that does not
exist, and it will not tell you; encode the constraint in the search, not in the review afterwards._

**(xlix) Two instruments sharing no input is the only agreement worth anything here.** The pixel
battery and the source projection agreed on where content is, and the camera model reproduced the
renders to within a percent on landmarks it was never fitted to. That agreement is load-bearing in a
way that none of the within-battery consistency was. _Cross-instrument agreement is evidence in
proportion to how little the instruments share; agreement between two statistics of the same pixels
is close to free._

**(l) The finding I was most confident of is the one that died.** Before any control ran I had written
that across all four scenes "the frame's detail budget is spent on the parts the child cannot interact
with." It survives for the two rooms in a weakened, decomposed form and is refuted for nature and
pirate at the 56th percentile of a null distribution. _A thesis that fits every case in the set is
usually a thesis fitted to the set; the case that breaks it is the one that tells you what it was
actually about._

---

The entries below were produced by building Fix C rather than by writing this document. They are kept
in the same register because they are the same failure repeating under better lighting.

**(li) A check that holds the suspect variable fixed cannot convict it.** The first ablation swept
every lighting term while `environmentIntensity` stayed at its global default in all arms, so the
term carrying 73% of the room was constant across the entire experiment and therefore invisible to
it. _A variable that does not vary in your test is not being tested by it, however many arms it has;
list what is being held fixed before reading what moved._

**(lii) Correlating unregistered images ranks them by detail frequency, not by the thing you meant.**
_If the comparison was not pre-registered, the ranking will find whatever the images differ in most,
and that is rarely the property you named._

**(liii) When a fix moves a metric a fifth of the way and the sweep flattens, stop tuning and start
subtracting.** Two sweeps of key/fill got the kitchen from 23.0 to about 27 and then stalled. The
remaining distance was not in the terms being tuned; it was in a term nobody was tuning. _A plateau
under tuning is evidence about the model, not about the step size._

**(liv) `<L120` is knife-edge for these rooms and `sd L` is not.** A room can move from 1.2% to 8%
on a change that barely alters its appearance, because the whole distribution sits just above the
threshold. _Prefer a metric measuring the shape of a distribution over one counting how much of it
falls past an arbitrary line, unless the line means something._

**(lv) A guard against a failure mode must be able to tell that mode from success.** _The tell is
cheap: run the failure mode deliberately as a control and check that your gate rejects it._

**(lvi) A measurement window placed by guessing fractions must be checked against the picture before
its verdict is believed.** The first playroom shadow window straddled a pinboard batten and a
wainscot rail; per-channel standard deviations of 10.9/13.4/19.9 were being read as wall texture.
Tightened until it sampled bare paint, it read 0.9/1.1/2.0. _An 11× error in the direction that
flatters your fix, from a window nobody looked at._

**(lvii) Global `sd L` rewards deleting half the image.** Any change that pushes a large region toward
black raises luminance spread while destroying detail. _A contrast metric needs a local-variation
floor beside it, or "more contrast" and "more darkness" are the same reading._

**(lviii) A defect inferred from configuration similarity is not a defect.** Three rooms shared one
lighting config, so I recorded one defect three times. Rendered, the third room beat the _fixed_
first one on the headline metric before anything was done to it, because its walls carry content the
others' do not. _Configuration is an input to the picture, not a summary of it; a claim about how
something looks is only settled by looking._

**(lix) A comment that dresses a preference as a physical derivation is worse than no comment.**
`0x5c4530` was documented as "warm bounce off the floorboards" and is 8–10° of hue from every floor
in the building; sampling them showed the hue moves the result by 0.04 against a 0.20 noise floor.
The number was chosen by eye and the physics was written afterwards to justify it. _No comment leaves
a reader free to test the value; a false derivation tells them it has already been tested. Sample the
thing the comment claims to model, and if the story does not survive, keep the value and retire the
story._

**(lx) A gate the negative control also passes is measuring nothing.** The playroom's dim-only control
cleared the flatness gate outright — better than the untouched baseline — because dimming a room does
reduce flat-region coverage. It failed only on mid-tone saturation, which moved the wrong way. _The
gate that carries a claim is the one the control fails, and until you have run the control you do not
know which of your gates that is._

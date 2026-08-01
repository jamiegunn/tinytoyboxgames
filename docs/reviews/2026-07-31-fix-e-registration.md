# Fix E — the left wall of every room in the house is unlit

**This document is committed before Fix E is built or rendered.** Same rule as
`2026-07-31-fix-b-registration.md`: this commit touches only this file, and the
commit that follows it contains the change. The ordering is checkable in `git
log`, not merely asserted here.

## Where this came from

Fix B (`adfe838`, registered in `0bfe3ce`) put a plate rack and a chalk menu
board on the Kitchen's right wall and a peg rail with cloths and a clock on the
left. Measured against gates committed before the render existed:

```
region        before    after    delta   tiles
side_L         80.7%    72.7%     -8.0      88
side_R         95.5%    51.1%    -44.4      88
side_both      88.1%    61.9%    -26.2     176
back           39.6%    39.6%     -0.0     139
```

Four gates passed. B4 — `side_R` was registered to stay above 55% — failed by
overshoot at 51.1%, and a follow-up gate written before its arrays were read
(`fixb_why.py`, C1) found 93.5% of the newly-detailed tiles inside the predicted
bounding boxes: the geometry was right, the fill discounts were too harsh.
Plaster showing between plates is not blank, it is framed by edges on all sides.

But the two walls got the same treatment and one moved five times as far as the
other. Two gates in that same file asked why, and both cleared their registered
threshold of 25% by more than double:

```
side_L   mean L   76.5   colourfulness   8.2
side_R   mean L  154.7   colourfulness  20.5

C2  left wall >= 25% darker than right      50.5%   PASS
C3  left wall >= 25% less colourful         59.9%   PASS
```

## The cause is arithmetic, not a mystery

`lightingRig.ts:42` documents `direction` as _"the direction the light
travels"_. Every room in the house sets:

| room        | keyDirection           | keyIntensity |
| ----------- | ---------------------- | ------------ |
| kitchen     | `(-0.45, -0.82, 0.35)` | 1.70         |
| living-room | `(-0.45, -0.82, 0.35)` | 1.65         |
| playroom    | `(-0.5, -0.8, 0.3)`    | 1.50         |

The key travels toward −X. `LEFT_WALL_FACE_X` is **positive** in all three
rooms, so the left wall's inward normal is −X and its Lambert term is

```
max(0, dot((-1,0,0), -normalize(-0.45,-0.82,0.35))) = max(0, -0.4506) = 0
```

against the right wall's +0.4506. **The left wall of every room in the house
receives exactly zero key light.** It is lit by the hemisphere fill (0.2) and
the PMREM environment (0.08) and by nothing else. Both accent lights sit at
negative X as well, on the right wall's side.

Measured in the linear domain, where light actually adds up rather than in the
sRGB bytes where it does not, the left wall of the Kitchen is at **23% of the
right wall's luminance** — 0.0781 against 0.3444. The 2.02× ratio visible in
the encoded pixels understates it by more than half.

This is not a Kitchen problem and it is not a Fix B problem. It is one sign in
one vector, shared by three rooms.

## What the darkness is and is not responsible for

It is tempting to stop here and say the 8-versus-44 split is explained. It is
not, and `leftwall_gate.py` was written to stop me saying so. It undoes the sRGB
encoding, multiplies the left wall's **linear** values by the ratio needed to
match the right, re-encodes, and recounts flat tiles — a simulation of the key
light arriving, rather than a gain applied to bytes, which would have overstated
the effect about 2.2× in the mid-range.

```
D0  reproduces sidewalls.py  72.7%/51.1%    got 72.7%/51.1%   PASS
D1  gained side_L <= 60.0%                  got 63.6%         FAIL
D2  gained PRE-FIX side_L > 65.0%           got 71.6%         PASS
```

D0 says the reimplementation is the same instrument, to the digit. D1 says I
was wrong about how much the darkness costs: crediting it in full is worth 9.1
points, not the 12.7 I registered, and the left wall would still sit at 63.6%
against the right's 51.1%.

D2 is the one that matters most and it is the one I could least afford to lose.
The same treatment applied to the **pre-Fix-B** left wall — a wall that really
was close to bare — moves it by **the same 9.1 points**, from 80.7% to 71.6%.
Brightening is a near-constant offset in this metric, identical on a furnished
wall and an empty one. So the metric is not reading exposure, the six-face dose
curve is not contaminated, and Fix B's rationale stands.

Which leaves the split with a duller and more embarrassing explanation. Fix B's
own projection put **40 of 88 band tiles** under the right wall's two pieces and
**12 of 88** under the left wall's two. The peg rail is 2.2 long against the
rack's 3.4; the clock is a 0.88 disc against a 1.5×1.9 board. The left wall
moved less because it was given a third as much, and each unit of it counted for
less because the light is not there. Both are true; the first is the larger term
and it is mine.

## The change

Add an optional second directional light — a **bounce** — to
`LightingDescriptor` and `LightingConfig`, with the key's X and Z components
negated and its Y kept downward:

```
key     (-0.45, -0.82,  0.35)
bounce  ( 0.45, -0.82, -0.35)
```

That construction is chosen so it can be checked rather than trusted. The
bounce's Lambert term is **exactly zero** on both faces the key already lights:
the right wall (normal +X, dot = −0.45) and the back wall (normal −Z, dot =
−0.35). It lights precisely the faces the key misses. Intensity is 35% of each
room's key, the ordinary ratio for a bounce card, and it casts no shadow —
a second shadow-caster is expensive and reads as two suns.

This does not undo `bc4d01f`, which cut the _flat_ terms (environment 0.24 →
0.08, fill 0.3 → 0.2) because they carried 73% of the room's luminance with no
direction in them at all. A bounce has a direction. It shades.

## Gates, registered now

Measured on a fresh render of the Kitchen at the shared camera preset, in-band
`y >= 2.2`, same masks that produced `side_L` and `side_R`.

| gate   | claim                                                                           | now    |
| ------ | ------------------------------------------------------------------------------- | ------ |
| **E1** | left wall linear luminance lands in **0.140–0.210** (41–61% of the right's)     | 0.0781 |
| **E2** | _negative control_ — right wall linear luminance stays within **±8%** of 0.3444 | 0.3444 |
| **E3** | _negative control_ — back wall flat share stays **39.6% ± 1.5 pts**             | 39.6%  |
| **E4** | `side_L` flat share lands in **65.0–70.5%**                                     | 72.7%  |
| **E5** | left wall colourfulness reaches **≥ 13.0**                                      | 8.2    |

E2 and E3 are the construction's own claim about itself. Both Lambert terms are
zero by the arithmetic above; if either wall moves, the direction is wrong and
nothing else in this document is worth reading.

E4 is the interesting one, because it is not a prediction about the room — it is
a prediction about `leftwall_gate.py`. The band is read straight off that
script's measured gain sweep (gain 1.5 → 70.5%, gain 2.5 → 67.0%) at the ~2.2×
this fix targets. **If the real relight lands outside that band, the simulation
is not a good model of lighting a wall** — most likely because relighting
changes how every object on the wall is shaded, not merely how it is exposed,
and a per-pixel gain cannot produce that. That would be worth more than the fix.

## Sufficiency, called in advance

I expect E1, E2, E3 and E5 to pass and E4 to pass near the top of its band. I do
**not** expect this to make the left wall good. Six points is six points; the
wall will still be at roughly 67% against the right wall's 51% and the Playroom
reference's 32.3%, and the reason will still be that Fix B gave it a third as
much to be about. **Fix E is a lighting correction, not the fix for the left
wall**, and the content follow-up is owed regardless of how green these gates
come back. Written down now so it cannot be retold afterwards as a triumph.

And, as in the Fix B registration: the measurement is the servant here. The
argument for this change that would survive every gate above coming back red is
`soul.md` — _"every surface must feel like something a child could touch."_ A
wall that renders a red clock rim and three coloured cloths at a colourfulness
of 8.2 is not a mood, it is a wall that eats whatever you put on it. If the
numbers disagree with the picture, the picture wins.

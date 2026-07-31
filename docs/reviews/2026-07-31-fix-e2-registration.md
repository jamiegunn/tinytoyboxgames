# Fix E2 — the bounce is the wrong colour, and I chose it by taste

**Committed before the change is built or rendered.** Same rule as `0bfe3ce` and
`604b39c`: this commit touches only this file.

## Fix E's result

Registered in `604b39c`, measured on a render made afterwards:

```
quantity                              before     after     delta
left wall linear luminance            0.0781    0.1821   +0.1040
right wall linear luminance           0.3444    0.3455   +0.0011
left wall colourfulness                  8.2       9.5      +1.3
side_L flat share                      72.7%     68.2%      -4.5
back flat share                        39.6%     39.6%      -0.0

E1  left linear in 0.140-0.210            0.1821   PASS
E2  right linear +/-8% of 0.3444          0.3455   PASS
E3  back 39.6% +/- 1.5 pts                 39.6%   PASS
E4  side_L in 65.0-70.5%                   68.2%   PASS
E5  left colourfulness >= 13.0               9.5   FAIL
```

Two of those passes are the construction proving its own claim about itself. The
bounce travels `(0.45, -0.82, -0.35)`, so its Lambert term is *exactly* zero on
the right wall (normal +X, dot −0.45) and on the back wall (normal −Z, dot
−0.35). Predicted zero, measured **+0.3%** and **−0.0 points**. The bounce went
where the arithmetic said it would go and nowhere else.

E4 is worth more than the fix it graded. Its band was not a guess about the room
— it was read straight off `leftwall_gate.py`'s simulated gain sweep, which
undoes the sRGB encoding, multiplies the left wall's *linear* values, and
re-encodes. That simulation predicted 67–70.5% at this fix's ~2.2× and the real
relight landed at 68.2%. **A per-pixel linear gain is a good model of actually
lighting a wall**, at least for this metric, which makes the simulation reusable
for the living room without another render.

## E5 failed, and the follow-up says it is my fault specifically

The left wall took 2.33× the light and its colourfulness moved 8.2 → 9.5, +16%.
Pure exposure through the sRGB curve should have given about
`2.33^(1/2.4) = 1.42×`, so 11.6. It did not manage even that.

`fixe_why.py` registered a gate before reading anything, separating two causes
by *where* they would show up:

```
region                                   before    after   change
inside pegRail + wallClock boxes           12.9     15.7   +21.5%
outside them (bare plaster)                 6.5      7.1    +9.0%

F1  inside the boxes >= +30%             +21.5%   FAIL
F2  bare plaster < +15%                   +9.0%   PASS
```

F2 passing means the two regions really are separated, so F1 decides. F1 fails:
colour is held down **even where there is colour to reveal**. The wall is not
merely empty — the light itself has no colour in it.

I chose `bounceColor (0.86, 0.88, 0.95)` and wrote *"cooler than the key on
purpose … it should not arrive warmer than the sun did"* into three source
files. That sentence sounds like physics and is the opposite of it. Bounced
light takes the colour of **what it bounced off**, and everything it bounces off
in the Kitchen is warm: the wall is `(0.93, 0.86, 0.70)` and the floor is
`(0.67, 0.50, 0.34)`. I had a reason-shaped sentence for a number I picked by
eye — the exact failure the `fillGroundColor` comment in these same files
already confesses to, three rooms and one audit ago.

Looking at the render says it faster than any of this. The left wall went from
warm and dark to **cold concrete grey**. Measured in HLS on the same masks:

| | hue | saturation |
| --- | --- | --- |
| left wall, no bounce | 41.0° | **10.3** |
| left wall, cool bounce | 42.0° | **6.8** |
| right wall | 41.6° | **15.1** |

The hue was never the problem — all three sit within a degree. **Fix E
desaturated a wall that was already undersaturated**, by a third. It made the
one thing it was aimed at worse while passing four of its five gates. That is
what E5 was in the list for.

## The change, derived rather than chosen

```
bounceColor = normalize( keyColor × mean(albedo of the surfaces the key lights) )
bounceIntensity = old × luminance(old colour) / luminance(new colour)
```

The renormalisation is not decoration: it makes this a **purely chromatic**
change, so anything that moves in luminance is an error in the arithmetic rather
than a second edit smuggled in beside the first.

| room | key-lit surfaces | mean albedo | bounceColor | intensity |
| --- | --- | --- | --- | --- |
| kitchen | wall `(.93,.86,.70)`, floor `(.67,.50,.34)` | `(.800,.680,.520)` | `(1.00, 0.76, 0.47)` | 0.60 → 0.67 |
| living-room | wall `(.95,.84,.64)`, floor `(.62,.44,.29)` | `(.785,.640,.465)` | `(1.00, 0.72, 0.39)` | 0.58 → 0.68 |
| playroom | wall `(.60,.82,.88)`, floor `(.72,.55,.35)` | `(.660,.685,.615)` | `(1.00, 0.93, 0.67)` | 0.53 → 0.50 |

The playroom is the reason to trust the formula rather than my eye. Its walls
are a cool blue `(0.60, 0.82, 0.88)`, so the same derivation hands it a bounce
that is *nearly neutral* — the thing I applied to all three rooms by taste, and
which is correct in exactly one of them. I would not have got that by choosing.

## Gates, registered now

Kitchen, fresh render, same camera and same masks.

| gate | claim | now |
| --- | --- | --- |
| **G1** | left wall colourfulness **≥ 13.0** | 9.5 |
| **G2** | inside the two boxes, colourfulness **≥ +30%** over the Fix-B image | +21.5% |
| **G3** | left wall HLS saturation **≥ 12.5** (right wall is 15.1) | 6.8 |
| **G4** | *runaway guard* — saturation **≤ 18.0** AND hue within **8°** of 41.6° | 42.0° |
| **G5** | *negative control* — right wall linear luminance ±8% of 0.3444, back wall 39.6% ±1.5 | 0.3455 / 39.6% |
| **G6** | left wall linear luminance stays in E1's band **0.140–0.210** | 0.1821 |

G1 and G2 are E5's and F1's thresholds **unchanged**. They were set before this
fix was conceived and moving them now, having seen them fail, is the one thing
this whole audit exists to not do.

G4 is the gate against my own correction. Saturation can be reached by making
the wall orange, and a wall that clears G3 at 20 with a hue 15° off its
neighbour has not been fixed, it has been repainted. G6 is the same guard in
luminance: the intensity compensation above claims this is chromatic only, and
G6 is where that claim is checkable.

## Sufficiency, called in advance

I expect G3, G4, G5 and G6 to pass and I am **not confident about G1 and G2**.
Hasler-Susstrunk colourfulness is dominated by the spread and offset of two
opponent channels across the whole masked region, and 86% of this region is
plaster. It is possible for the wall to look right, for saturation to reach its
neighbour's, and for colourfulness to still sit under 13 because there is
nothing there to be colourful. **If G3 and G4 pass while G1 fails, that is not
a licence to declare victory on the saturation number** — it means the two
instruments disagree, the tiebreak is the picture, and the wall still needs
things on it. Which is what the Fix E registration already said would be owed,
and is still owed, and has been owed since Fix B put 40 tiles of content on one
wall and 12 on the other.

Two known defects are **deliberately not** in this change, so that this render
attributes to colour alone: the wall clock's `face` cylinder (radius 0.37,
length 0.10) swallows its `rim` (radius 0.44, length 0.09) so only a crescent of
red shows — visible in the render, and the clock is one of the two boxes G2
measures; and the left wall's whole upper expanse is still bare. Both are next.

# Fix B — pre-registration

**This document is committed before Fix B is built, rendered or measured.** That
ordering is the whole point of it and it is checkable in the git history: this commit
touches only this file, and the commit that follows it contains the fix.

## Why a registration at all

The four-scene audit proposed Fix B — the side walls are roughly 48% of the frame and
carry no authored decor, so putting content there is the cheapest content-per-effort
available — and then supported it by pointing at the Playroom, which renders better
than the Kitchen with no lighting change. That support was produced the same way defect
(lviii) was: by reading source files and inferring what the picture looks like. Reading
them properly cost one claim (the Playroom's "chalkboard" is a freestanding easel, not a
wall item) and reversed another (the Living Room's side walls are not bare — `walls.ts`
builds four wainscot segments on them and `room.ts` puts a door on each).

So the premise was measured instead, in `/root/design/sidewalls.py`, with gates written
before any pixel was read. It did not go well for the argument as stated:

```
scene                   side %flat   tiles  back %flat   tiles   gap (pts)
kitchen      BASE           89.2%     176      66.2%     139      +23.0
living_room  BASE           82.4%     176      51.8%     139      +30.6
kitchen      FIXED          88.1%     176      39.6%     139      +48.5
living_room  FIXED          80.1%     176      28.1%     139      +52.1
playroom     FIXED          54.4%     316      37.4%     171      +17.0

W1  kitchen side flat >= 80%              89.2%            PASS
W2  kitchen gap >= +25 pts                +23.0            FAIL
W3a playroom side flat <= 55%             54.4%            PASS
W3b playroom gap < kitchen gap    +17.0 vs +23.0           PASS
W4  living room BETWEEN     54.4% < 82.4% < 89.2%          PASS
```

W2 failed, and so did the pre-registered negative control: the criterion was
`playroom_gap < kitchen_gap - 10` and the playroom's gap is only six points smaller, so
**by my own registered standard the side-versus-back gap is largely geometry** — grazing
angle and screen compression — not content. That line of support is withdrawn.

What survived is an instrument I did not register: the **within-room left-versus-right
split**. Same room, same image, same lighting, same grazing geometry:

```
playroom FIXED    L  32.3%   R  76.6%     44 points: corkboard + window  vs  door only
kitchen  FIXED    L  80.7%   R  95.5%     17 points: one doorway         vs  nothing
living_room BASE  L  80.7%   R  84.1%
```

Geometry cannot explain a 44-point gap between two walls in one photograph. But this
split was found after looking at the numbers, and this loop's register of defects is
largely a list of times a post-hoc number was believed. The repair is not to argue for
it harder. It is to make Fix B its prospective test.

## The measured dose curve Fix B was designed against

Six real wall faces, one camera preset (`sceneCatalog.ts` 133/141/149: azimuth π, polar
1.19, distance 14, target `[0, 0.5, 0]`), in-band means world `y >= 2.2`:

```
bare plaster (kitchen right)                    97.7% flat
plaster + part of a doorway (kitchen left)      80.7%
+ patterned cloud wallpaper (playroom right)    76.6%
+ large corkboard with pinned art (playroom L)  32.3%
```

What moved that number was broad, high-contrast, rectilinear content at wall scale — not
a scatter of small objects. That is why Fix B is a plate rack and a slate menu board on
the right wall and a peg rail and a clock on the left, all sitting above `y = 2.2`.

## The prediction

Computed from geometry alone by `/root/design/fixb_predict.py`, which projects each
piece's bounding box with `sidewalls.py`'s own projector, dilates by half a tile (a tile
partly covered by a high-contrast edge still gains variance), counts band tiles covered
at least 50%, and predicts those flip and nothing else does. A bounding box is not solid,
so each piece also carries a `fill` estimate — written down in that file before the
render existed — giving a ceiling and a realistic figure.

```
piece         wall  band tiles  tiles hit    share   fill  discounted
pegRail          L          88          4     4.5%   0.55       2.5%
wallClock        L          88          8     9.1%   0.75       6.8%
plateRack        R          88         20    22.7%   0.70      15.9%
menuBoard        R          88         20    22.7%   0.95      21.6%

              base     ceiling   realistic
side_L       80.7%       67.1%       71.4%
side_R       95.5%       50.0%       58.0%
side_both    88.1%       58.6%       64.7%
```

**Gates, judged against the render without reinterpretation:**

- **B1** — `side_R` falls from 95.5% to **≤ 62.0%**
- **B2** — `side_L` falls from 80.7% to **≤ 75.4%**
- **B3** — `side_both` falls from 88.1% to **≤ 68.7%**
- **B4** — `side_R` does **not** reach the Playroom-left band: it stays **> 55%**. B1 and
  B4 together register a *window*, 55–62%, and the fix can miss it in either direction.
  Below 55% the fill discounts are too harsh; above 62% the halo model is crediting edges
  that do not carry enough contrast to push a tile past sd 6.0.
- **B5, negative control** — the **back** wall stays at 39.6% ± 1.5 points. Nothing in
  Fix B touches the back wall. If it moves, something else did, and the side-wall delta is
  not attributable to this fix.

**Sufficiency, called in advance.** On these numbers Fix B as built does not bring the
Kitchen to the Playroom. I expect to pass B1–B3 and to still be looking at a wall that is
more than half empty tiles — a real but partial move, with a second iteration owed. That
is written down now so it cannot be retold afterwards as either a triumph or as a planned
two-parter.

**And the measurement is the servant here, not the master.** A wall of flat dark panels
would pass every gate above and fail `soul.md` — *"every surface must feel like something
a child could touch."* The cloths are felt and they hang; the mugs swing when tapped; the
clock is the only circle on a wall of rectangles. If the numbers come back green and the
picture is still cold, the picture wins.

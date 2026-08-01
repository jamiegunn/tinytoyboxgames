# Nature and Pirate Cove — five rounds of indictment, fix, and evaluation

A review of the two immersive toybox scenes, `nature` and `pirate-cove`, conducted under a
standing instruction that outranks my own judgement: _do not trust your confidence — prove it,
then test your proof._ Every charge below carries a measured number rather than an adjective,
and every fix is evaluated against the number that produced the charge, not against my opinion
of the fix.

Normative documents: `docs/ai-guidance/soul.md` and `docs/ai-guidance/vision.md`.

The instruments are recorded so the numbers can be re-taken. Screenshots are captured through
Playwright against the running dev server at `localhost:5199`, viewport 1280×720 landscape and
480×854 portrait, with a 16-second settle because swiftshader renders this scene at roughly
1.5 fps. Pixel statistics are computed with Python and PIL. Scene-graph facts are established
headlessly by bundling the real TypeScript modules and executing them, never by grepping source.

---

## Round 1 — Pirate Cove is a photograph

### The charge

Pirate Cove contained no ambient motion of its own. Not "too little"; none.

I established this three ways, because a single grep is the kind of evidence that feels
conclusive and is not. A census of animation call sites across the entire `pirate-cove` tree —
matching `gsap.`, `getIdleAnimator`, `.stream(` and `.burst(` — returned three hits, all three
of them inside one file, `factory/props/simple/parrot/interaction.ts`. One is a `gsap.timeline`
constructed inside a tap handler; the other two are `killTweensOf` calls that clean it up. A
search for per-frame update hooks of any kind — `onBeforeRender`, `requestAnimationFrame`,
`registerUpdate`, `useFrame`, `.tick(`, `onTick` — returned nothing. `getIdleAnimator`, the
project's own vocabulary for exactly this problem, was called zero times by either immersive
scene, although Playroom decor uses it extensively.

Then I measured the rendered result rather than the source, because source can lie in both
directions. Six frames of the live scene, 3.5 seconds apart, no input:

| region of frame             | tiles showing any change, first frame vs last |
| --------------------------- | --------------------------------------------- |
| sky (y < 160)               | **0 of 128**                                  |
| middle band (160 ≤ y < 400) | 12 of 256                                     |
| deck (y ≥ 400)              | **0 of 192**                                  |
| whole frame                 | 12 of 576 = **2.08%**                         |

Aggregate pixel change across the widest-separated pair was 0.209% of pixels, mean absolute
channel delta 0.079/255.

I then cropped the two moving patches and looked at them. One is the owl. The other is the
sparkle above the cannon's portal. **Neither is authored by Pirate Cove.** The owl arrives via
the shared world-scene runtime (ADR-0011) and the portal glint via `worldSceneFactory`. Strip
out what the framework supplies for free and the scene's own contribution to motion is exactly
zero — a ship at sea where the sea does not move, under clouds that do not drift, with a sail
that does not know there is any wind.

### Why this is a real defect and not a matter of taste

`vision.md` states as a core UX rule that "at least 2 interactions should animate or react even
before the player taps, to invite exploration", and requires of every world that it "feel alive
with idle motion and ambient sound cues". `soul.md` §5 opens with "The toybox world is never
static — but it is never frantic." The scene satisfied neither. It was not close to satisfying
either. This is a binary failure against a written requirement, which is why I chose it as the
first round: it cannot be argued away as a difference of aesthetic opinion.

The child-facing consequence is sharper than the rule. A three-year-old does not read a scene
and decide what is interactive; they notice what moves and reach for it. Motion _is_ the
affordance at this age. A still frame communicates "picture", and a child's response to a
picture is to look at it and then look away. The scene was asking to be dismissed within a
second of arriving, before any of its seven prop composers got a chance to be discovered.

### The anticipated defence, and why I reject it

The obvious rebuttal is that the scene is not actually inert, because the owl moves and the
portal sparkles, so a child does have something to look at. I measured exactly that and it is
2.08% of the frame, concentrated in two small patches in the middle band. More to the point,
those two things are identical in every scene in the app — they are the chrome, not the world.
A pirate ship whose only motion is the same owl the kitchen has is not a pirate ship that is
alive; it is a still life with a shared mascot standing in front of it.

A second rebuttal is that soul.md's emphasis on calm argues against adding motion. It does not.
The document's phrase is "never static — but never frantic", and it sets the pace explicitly:
"Ambient animations breathe at the pace of a sleeping cat." That is a floor and a ceiling, and
the scene was below the floor.

### The fix

Ten ambient sources where there were zero, all started through the scene's registered
`IdleAnimator` so that the scene's disposal scope kills every one of them on teardown and none
can outlive a scene switch. The new module is
`factory/scaffold/ambientMotion/create.ts`; the ocean was extracted out of `sceneShell` into
`factory/scaffold/sea/create.ts` so it could be moved independently of the hull.

The central design decision is that **the deck does not move.** The obvious implementation —
rock the ship — is wrong twice over. It slides every tap target sideways while a three-year-old
is aiming at it, and a child that age commits to a reach early and cannot correct mid-motion, so
a moving target is a miss they have no way to understand. It is also not what a person standing
on a boat sees: from the deck, the deck is the still thing and the horizon is what tilts. So a
new `sea_and_sky` group holds the ocean, the skydome, the sun and the clouds, and _that_ is
rolled and heaved around a rigid hull. The waterline tips, the clouds ride with it, and the ship
reads as under way without a single tappable prop moving a pixel.

The ten sources are the sea roll (±0.02 rad about the view axis, 7.3 s), the sea heave (0.14
units vertically, 4.9 s), three cloud drifts (34 s, 41 s, 29 s), the sun's glow (11.7 s), the
sail's two luffs — the belly deepening and slackening on a 4.3 s cycle while the whole sheet
swings about its head on a 6.7 s one — and the parrot's bob and head-turn.

Two details are load-bearing. The periods share no small common multiple, so the composite never
settles into a loop a child can memorise; with 7.3 and 4.9 seconds against 34, 41 and 29, the
pattern does not visibly repeat for minutes. And the amplitudes are deliberately small: 0.02 rad
tips the horizon by 1.15°, about 26 px across a 1280 px frame. A larger roll is how you make a
small child feel unwell, and it would also break soul.md's "alive, not demanding". The sail and
band were additionally reparented into a shared `ship_sailGroup` pivoted at the sail's head,
because they are two coplanar sheets a centimetre apart and anything that moves one must move the
other by exactly the same amount or the red stripe slides off the canvas.

The parrot's idle uses its head's _rotation_ channel on purpose. The tap handler animates the
head's _position_ and kills tweens of that channel when it finishes, so an idle on rotation
cannot be cancelled by a tap and a tap cannot be fought by the idle.

### Evaluating the fix against the charge

The charge was a measurement, so the evaluation is the same measurement retaken. Same harness,
same viewport, same settle, same spacing:

| region of frame                | before            | after                   |
| ------------------------------ | ----------------- | ----------------------- |
| sky (y < 160)                  | 0 of 128 tiles    | **68 of 128**           |
| middle band                    | 12 of 256         | 103 of 256              |
| deck (y ≥ 400)                 | 0 of 192          | 8 of 192                |
| whole frame                    | 12 of 576 = 2.08% | **179 of 576 = 31.08%** |
| pixels changed, widest pair    | 0.209%            | **8.513%**              |
| mean absolute delta            | 0.079/255         | **2.415/255**           |
| worst consecutive-frame change | 0.176%            | 2.400%                  |

The sky went from perfectly still to two thirds of its tiles in motion. The deck's eight moving
tiles are the sail's shadow and the parrot, which is correct — the deck itself is not among them.

That is the rendered evidence. The scene-graph evidence is a new contract suite,
`tests/room/pirate-cove-ambient-motion.test.mjs`, which builds the real shell, the real parrot
and the real sky rig, registers a real animator on a real disposal scope, runs the rig, and then
asks GSAP which objects actually have tweens attached. It asserts the started source ids match
the published list, that each named source owns a tween on the channel its name claims, that
every ambient tween has `repeat() === -1`, that `scope.dispose()` kills all of them, that
removing the sail group removes exactly the two sail sources (so the id list is discovered rather
than hardcoded), that the cloud sources scale with the cloud count, that the roll's peak
excursion sits between 0.008 and 0.05 rad, and that the mast's **world** transform is invariant
while everything else moves.

### Testing the proof, which is where the round actually earned its keep

Two of my own instruments were wrong, and I only found out by attacking them.

The first: I had recorded, as an established fact, that the pre-fix motion baseline was
"definitionally 0%". It is not. It is 2.08% of tiles, and when I reverted the scene to `HEAD`
and re-shot it rather than assuming, I found the owl and the portal glint. The charge survived —
it got _more_ precise, because "the scene's own contribution is zero while the framework's is
not" is a stronger and more specific claim than "nothing moves". But I had been about to publish
a number I had never measured.

The second: I mutated the implementation to check the suite would notice, and it did not. I
changed the sea roll to roll the hull instead — precisely the regression the "deck never moves"
test exists to catch — and that test passed. Twice, for two different reasons. First it read
`mast.position`, the mast's _local_ transform, which a parent rotation leaves entirely untouched;
it needed world space. Then, after that repair, it still passed, because it drove a hand-written
list of sea-and-sky tweens, and a mutation that moves the roll onto the hull simply is not in
that list — the test was driving nothing and asserting that nothing had changed. The fix was to
traverse the scene graph and drive _every_ tween attached to _any_ transform channel, so the
test cannot be blind to where a regression chooses to put itself.

Only after both repairs does the mutation matrix come out right:

| mutation                                | suite result                                      |
| --------------------------------------- | ------------------------------------------------- |
| unmodified                              | 7 pass, 0 fail                                    |
| roll the hull instead of the sea        | 3 fail (channels, deck-never-moves, swell)        |
| heave the hull instead of the sea       | 2 fail (channels, deck-never-moves)               |
| delete the sail luff sources            | 2 fail (id list, channels)                        |
| raise roll amplitude to 0.2 rad         | 1 fail (swell is gentle)                          |
| no animator registered (no-op fallback) | 5 fail (warning spy, plus every behavioural test) |

That last row is the one that makes the rest meaningful. `idle/registry.ts` keeps a
module-private `WeakMap`, and the test framework's `bundleTs` produces a separate module graph
per call — so a test that bundled the rig and the registry separately could never register an
animator the rig would find. `getIdleAnimator` would fall back to the no-op animator, which
returns a well-formed handle for every preset, and every id assertion in the suite would pass
with not one real tween in existence. I added `bundleEntry(name, source)` to
`tests/framework/_tsload.mjs`, which compiles a synthetic entry module from a string so both
sides land in one graph and share the singleton, and the suite spies on `console.warn` so that
taking the fallback path fails the run outright.

### Verdict

**Sufficient.** The charge was "the scene contributes no ambient motion"; the scene now
contributes ten sources, the rendered frame's moving area is up fifteenfold, the sky is no longer
inert, and the deck — which must not move — is proven not to move by a test that has been shown
to fail when it does. Full suite: 257 tests passing, up from 250. `tsc -b` and
`eslint --max-warnings 0` clean.

What this round did **not** address, and what the remaining rounds must: the scene still looks
wrong. Motion does not fix a sun that reads as a hole punched in the sky, clouds that float below
the waterline, a sail shaped like a paper cup, a treasure chest that ships already open with its
gems spilled, or a bottom half of the frame that is bare plank. Round 1 made the photograph move.
It is still a photograph of the wrong thing.

---

## Round 2 — Nature has no floor, and both scenes fog toward a colour nothing ever renders

### The charge

Three defects that look unrelated and are not. Each is a rule applied outside the domain it was
written for, and in each case the source comment describes behaviour the code does not have.

**(a) The Nature scene has no floor.** Its ground plane was 16×32 — no: 16 wide by 14 deep, the
default an interior room gets. Nature is not an interior room; it is the one scene whose camera
pulls back hardest on a phone, and a 16×14 rectangle is simply not big enough to reach the bottom
of the frame from there. The consequences are measurable three separate ways, and they agree.

In the 1280×720 landscape frame, **17.93% of all pixels** were violet felt — the toybox wall,
standing in for a horizon. In the 480×854 portrait frame, the bottom **54 rows (800–853)** were
not ground at all but skydome, and the boundary sat at exactly row 800 in all 480 columns: a
dead-straight edge, which is what the far side of a rectangle looks like when you are standing
past its near edge. Geometrically, of **39,366 audited camera rays** — every combination of the
nine shipping viewport aspects with the reachable pan, tilt, zoom and orbit envelope, sampled
across the frame — **4,327 landed short of, or beside, the ground plane without anything in the
way.** One ray in nine hit nothing.

**(b) Both scenes fog toward a colour that is never rasterised.** Each scene's `scene.fog` was
constructed from that scene's `clearColor`. The skydome is built with `fog: false` and is opaque
(`skyRig.ts`), so it paints over the clear colour every frame before anything reaches the canvas.
The clear colour is not a dark version of the horizon; it is a value with no pixels.

In Pirate Cove this produced the single largest colour edge in the frame. Across eight pixel rows
at the left edge (row 87) and the right edge (row 103), the frame stepped **213.2 RGB units** —
from sky (217, 224, 228) to sea (63, 108, 137). No material boundary anywhere on the ship comes
close. Worse, the aerial perspective ran _backwards_: sampling the left edge top to bottom gave
sky luminance **223.4**, far sea **100.5**, mid sea **104.2**, near sea **136.6**. Distance made
the water _darker_ while the sky above it stayed bright. That is the opposite of how haze works,
and it is why the horizon read as a painted line rather than a distance.

**(c) The shared portrait pull-back rule is not a pull-back over a third of its domain.** Both
scenes depend on `radiusForAspect` to move the camera back when the viewport narrows. The rule was
`(a) => a < 1 ? (1.0 / a) * 0.75 : 1`. It has three defects. For every aspect in (0.75, 1.0) it
returns a value **below 1** — it pushes the camera _in_, by up to 25%, exactly when the frame is
getting narrower. At `a = 1.0` it **jumps 33.2%** discontinuously. And at exactly `a = 0.75` it is
the **identity** — an iPad in portrait, which is the device class the rule exists to serve, gets no
pull-back at all.

### Why this is a real defect and not a matter of taste

Charge (a) is not an aesthetic complaint about the colour purple. `vision.md:226` says opening a
box "should feel like diving into a miniature world," and `vision.md:375` describes Nature as
"a tiny forest floor diorama with moss, mushrooms, leaves, pebbles, flowers, bugs, and a shallow
stream." A player standing in that diorama on a phone was looking at the bottom half of the screen
and seeing _sky_. Not a distant horizon — sky **below the grass**, because the ground ran out. There
is no reading of any normative document under which the floor of a forest ends in mid-air.

Charge (b) is falsifiable and was falsified. The claim "the clear colour is never on screen" is not
an opinion; the skydome's material is `MeshBasicMaterial({ side: BackSide, depthWrite: false,
fog: false })` and its geometry encloses the camera. And the 213-unit step is not a judgement about
whether the horizon looks nice — it is the largest first-derivative in the image, measured the same
way at both edges of the frame, reproducing to one decimal place.

Charge (c) is arithmetic. `f(0.9) = 0.833 < 1` is a pull-_in_. `lim f(a) as a → 1⁻ = 0.75` against
`f(1) = 1` is a 33.2% discontinuity. `f(0.75) = 1.0` is the identity. None of these require a
screenshot to establish and none of them are debatable.

### The anticipated defence, and why I reject it

**"Nature is supposed to be purple — `vision.md:221` says so."** It does: _"Nature box: purple,
leaves, moss, mushrooms, bugs, forest discovery."_ But that line is in the section describing the
**boxes on the landing screen**, and five lines later the same document says opening one should feel
like diving into a miniature world. Purple is the lid. It is not the sky you see once you are
inside, and it is certainly not the ground under your feet.

**"It's a diorama — a diorama has edges, and 16×14 world units is the authored scale."** World units
are invisible to a player. Apparent scale is set by the props — the mushrooms, the snail, the owl,
the stream — and not one of them changed size. What changed is how much floor exists beyond the
props, which the player reads as _how far the forest goes_, not as _how big the mushrooms are_.

**"The dark band at Pirate Cove's horizon reads as deep water; it's deliberate."** It is not, and
the code says so in its own voice. The old source comment claimed the fog was matched to the clear
colour and "softens the sunset backdrop into the ocean haze." The backdrop it claims to soften is
built `fog: false` and is therefore untouched by fog, by construction. The comment describes an
effect the code cannot produce. That is the defining symptom of this entire round: **the code and
its own documentation disagreed, and the documentation was the more confident of the two.**

### The fix

**Nature gets a real floor and a real horizon.** The ground goes from 16×14 to **28×32**. The felt
toybox walls are deleted outright and replaced by a `treeline` scaffold: three receding rows of
conifers at z = 13.5, 17 and 20.5 (heights 4.4, 4.85, 5.3) plus side columns at |x| = 13.8 and 15.2,
so the frame's edges are closed by forest rather than by a wall. All four portals were repositioned
to stay framed once the camera pulls back.

**Fog becomes structurally incapable of the defect.** A new type, `SceneSkyFogConfig`, carries the
sky gradient and the fog distances as one object — and it has **no `fog.color` field at all**. The
only constructor is `createSkyMatchedFog(config)`, which reads `config.sky.horizonColor`. There is
no parameter to pass the wrong colour to. Both scenes' fog is now, by the shape of the type, the
colour their own skydome renders at the horizon.

This matters more than the colour change itself. The first version of this fix extracted a shared
colour constant so the fog and the dome referenced one literal. That would have shipped, and it was
insufficient: while hunting for a mutation target I found Nature still wrote the same colour as a
literal in _two_ files. **Removing one instance of duplication is not the same as removing the
possibility of it.**

**The pull-back rule becomes monotone.** `Math.max(1, PULLBACK_REFERENCE_ASPECT / aspectRatio)` with
`PULLBACK_REFERENCE_ASPECT = 0.75`. It never returns less than 1, is continuous everywhere, and is
strictly increasing as the frame narrows.

### Evaluating the fix against the charge

Every number below was re-taken with the same instrument that produced the charge.

| metric                                            | before         | after                  |
| ------------------------------------------------- | -------------- | ---------------------- |
| Nature violet/magenta frame area, landscape       | 17.93%         | **0.00%**              |
| Nature violet/magenta frame area, portrait        | 10.35%         | **0.00%**              |
| Nature non-ground rows at frame bottom, portrait  | 54 of 854      | **0**                  |
| Nature non-ground rows at frame bottom, landscape | 0              | **0**                  |
| Nature defective camera rays                      | 4,327 / 39,366 | **0 / 39,366**         |
| Nature portals framed, worst of 9 aspects         | —              | **4 of 4 at all nine** |
| Pirate worst backdrop colour step, landscape      | 213.2 units    | **43.2 units**         |
| Pirate worst backdrop colour step, portrait       | 153.6 units    | **51.1 units**         |
| Pirate fogged far-sea band area, landscape        | 7.02%          | **0.19%**              |
| Pirate fogged far-sea band area, portrait         | 1.59%          | **0.59%**              |

The aerial-perspective ladder, sampled identically before and after at the left edge of the
landscape frame:

```
                        before            after
  sky above horizon     lum 223.4         lum 223.2
  sea, far              lum 100.5         lum 228.9
  sea, mid              lum 104.2         lum 191.7
  sea, near             lum 136.6         lum 164.7
```

Before, the sequence went 223 → 100 → 104 → 137: a cliff, then a climb. After, it is
223 → 229 → 192 → 165: monotone from the viewer outward, with the far water meeting the sky within
**5.7 luminance units** of it. The horizon is no longer an edge, because there is no longer a step
there to be one.

One instrument had to be rebuilt to say this honestly. `pc-seam.py` finds the steepest eight-row
colour step in the top 45% of the frame and calls it the horizon. Re-run after the fix, it reported
**209.8 units** — apparently no improvement at all. It was not measuring the horizon. With the water
line smoothed, the steepest step in the same window became a **wooden railing post against the sky**
(200,194,183) → (88,74,52), which is a legitimate object boundary and not an aerial-perspective
failure. I wrote `pc-horizon.py`, which restricts the profile to backdrop pixels only (blue channel
≥ red channel, which sky, sea and cloud all satisfy and ship timber decisively does not) and stops
each column band at the row where the ship occludes it. That is where 213.2 → 43.2 comes from — and
the surviving 43.2 is a **cloud edge at row 7**, not the waterline.

Had I reported the first number I would have declared my own fix a failure. Had I not checked what
the number was made of, I might have "fixed" the railing.

### Testing the proof, which is where the round actually earned its keep

Three suites were added — `scene-ground-coverage`, `camera-pullback-rule`, `scene-sky-fog-contract`
— taking the package from 257 to **285 tests, all passing**, with `tsc -b` and
`eslint --max-warnings 0` clean. But a passing suite proves nothing about whether it would notice a
regression, so **16 mutations** were introduced one at a time, each into the real source, with the
suite re-run and the source restored.

| #   | mutation                                             | result                                                                         |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| M1  | Nature ground 28×32 → 16×14                          | killed — _"outside the ground plane"_, 4 failures                              |
| M2  | drop Nature's `panRangeX: 3.0` and `maxTargetY: 1.0` | **survived** — a real finding, below                                           |
| M3  | move Nature's `fireflies` portal to (3.5, 0, −4)     | killed — portal framing                                                        |
| M4  | move Pirate's portal back to (4.0, 0, 1.0)           | killed — _"0.962 NDC outside the frame at extreme 360×900"_                    |
| M5  | restore the old pull-back rule                       | killed — _"the pull-back never pulls the camera in"_, 4 failures               |
| M6  | `OCEAN_HALF_EXTENT` 200 → 5                          | killed — _"outside the ocean"_                                                 |
| M7  | Pirate `ground.depth` 14 → 8                         | killed — _"the near half of the opening frame is playable surface"_            |
| M8  | Pirate `horizonColor` → (0.20, 0.30, 0.40)           | **survived — correctly**, see below                                            |
| M9  | Nature `horizonSharpness` 1.0 → 40.0                 | killed, 2 failures                                                             |
| M10 | Nature `fog.near` 17 → 30                            | killed — _"the backdrop recedes into the sky"_                                 |
| M11 | Nature `fog.near` 17 → 6                             | killed — _"fog never reaches the props a child is meant to touch"_, 2 failures |
| M12 | Pirate `fog.far` 55 → 90, past the dome              | killed — _"ends inside the sky"_                                               |
| M13 | `createSkyMatchedFog` reads `topColor`               | killed, 2 failures                                                             |
| M14 | skydome lerps from `bottomColor` above the horizon   | killed, 4 failures                                                             |
| M15 | `TREELINE_CANOPY_RADIUS` 1.05 → 0.6                  | killed — _"does not span half the spacing"_                                    |
| M16 | `TREELINE_SPACING` 1.5 → 3.0                         | killed — same assertion, from the other side                                   |

**M8 survived and that is the strongest single line in the table.** Changing Pirate Cove's horizon
colour moves the dome and the fog _together_, because `SceneSkyFogConfig` has no `fog.color` to
desynchronise. There is no mutation that can express the original defect. A mutation that cannot be
killed because the type makes the bug unrepresentable is better evidence than a mutation that gets
caught by an assertion. Surviving mutations must be triaged, not counted. (The mutations that _do_
kill the colour contract, M13 and M14, target `skyRig.ts` itself, which is where the contract lives.)

Six baseline corrections came out of this round, and five of them corrected **me**, not the code.

**One — the ray audit was wrong by 3.5×.** The inherited figure for Nature's defective rays was
15,127. Re-deriving it with a proper SHORT / SIDE / OVER classification — rays that land short of
the ground, beside it, or above the treeline into legitimate sky — gives **4,327**. The old number
counted sky as a defect. The corrected number is the one that appears above, and it is smaller and
less flattering to the charge, which is why it is the one I am publishing.

**Two — the portal overshoot was wrong by 19×, and the reason generalises.** The old ground-coverage
suite reported Pirate Cove's portal as 0.05 NDC off-frame. M4 re-ran the real defect against the
rewritten suite and got **0.962 NDC at 360×900**. The old suite used `assert.ok` inside a loop over
aspects, so it threw on the _first_ aspect that failed — the iPad, the mildest case — and never
reached the phone. **A per-item assertion inside a loop does not report the worst case; it reports
the first case.** The rewritten suites compute the worst over all nine aspects and assert once.

**Three — my own scoping judgement was refuted twice** before a 405-position grid search over the
deck found that the bow centre is the only open, centred spot that clears all nine aspects. I had
twice concluded by inspection that a smaller search would do.

**Four — the first fog fix was insufficient and I would have shipped it.** Covered above: sharing one
colour constant still left Nature writing the colour as a literal in two files.

**Five — the sky/fog suite's own fourth assertion was the defect.** I wrote
`assert(fog.near >= hypot(ground.width / 2, ground.depth / 2))` — "fog must begin past the scene's
own geometry" — predicted it would fail for Nature, and it failed for Nature: `near` 17 against a
21.3-unit half-diagonal. Being right about _which_ assertion would fail told me nothing about
_which side_ was wrong. Before touching anything I wrote `.probe/fog-depths.mjs` to measure what the
fog actually touches. Two things came back. First, three.js fogs on **view-space depth**
(`vFogDepth = -mvPosition.z`), a camera-relative quantity; a world-origin half-diagonal is not
comparable to it at all, so the assertion was a category error. Second — and much worse — satisfying
it would have _destroyed_ the thing the fog exists for. Nature's ground is 28×32, so its far corners
sit **behind** the first treeline row at z = 13.5. They are backdrop. Pushing fog past them would
have switched off the aerial perspective and left the ground's far edge rendering as a hard
rectangular shelf. The measured reality, across all nine aspects and the full camera envelope:

```
  scene         portals (envelope)   play centre   near backdrop   far backdrop
  nature              0.137             0.160      0.288 - 0.802   0.662 - 1.000
  pirate-cove         0.000             0.000      0.522           1.000
```

Props a child touches are ≤ 0.137 fogged; the treeline goes from a quarter hazed to fully hazed.
The assertion was replaced by two measured properties — _fog never reaches the props_ and _the
backdrop recedes into the sky_ — and M10 and M11 prove both are live from both directions.

The probe also surfaced a benefit of the ground enlargement I had not claimed and had not earned:
Nature's far play corners at z = ±16 sit at 0.982–1.000 fogged. The fog is hiding the enlarged
ground's own far edge. That was not the plan; it is a consequence I only noticed because I measured
before I asserted.

**Six — M2 refuted a justification I had written one round earlier.** `sceneCatalog.ts` said of
Nature's camera constraints: _"`panRangeX` and `maxTargetY` are the only two the ground-coverage
audit needs."_ Removing **both** fails no assertion in either suite. So I measured what they
actually buy (`.probe/nature-constraint-value.mjs`):

```
  Fraction of frame height above the near treeline canopy (1.0 = all sky)
  aspect                    maxTargetY=1.0   maxTargetY=2.0   panX=3.0   panX=3.5
  landscape 1280x720                0.166           0.216        0.114      0.114
  iPad portrait 768x1024            0.166           0.216        0.114      0.114
  Pixel 8 412x915                   0.243           0.281        0.204      0.204
  extreme 360x900                   0.261           0.296        0.225      0.225

  Portals still framed at the pan extreme (of 4), worst over aspects:
    panRangeX 3.0: 2/4    panRangeX 3.5: 2/4    panRangeX 4.5: 1/4
```

`maxTargetY: 1.0` is worth about five percentage points of bare sky at the top of the frame. It
stays, now documented as the framing choice it is rather than as an audit requirement.
`panRangeX: 3.0` is **indistinguishable from the shared 3.5 default on every instrumented metric** —
identical sky fraction to three decimals, identical portal framing; only 4.5 degrades anything. It
is gone. A comment asserting that a constant is load-bearing is a testable claim, and until it is
mutated it is only a claim — which is the same defect, in the same round, as the fog comment that
described an effect the code could not produce.

Removing it invalidated every prior ray audit, because `.probe/treeline-fit.mjs` passed a hardcoded
`{ maxTargetY: 1.0, panRangeX: 3.0 }` override rather than reading the catalog. I appended an audit
that passes `{}` — so the constraints come from `sceneCatalog.ts` itself — and re-ran at the
envelope that actually ships:

```
  RAY AUDIT SHIPPED (constraints read from sceneCatalog), ground 28x32
    CLEAN: 0/39366 rays land short of or beside the ground unblocked
  ENVELOPE SHIPPED
    worst reach |z| 12.20 (vs 16)  |x| 9.75 (vs 14)  PASS
  VISIBILITY SHIPPED
    all four portals visible at all nine aspects
```

Appending it also uncovered a small instance of the same disease: `.probe/treeline-fit.mjs` had a
`process.exit(0)` sitting above its own tail, so my new audit ran zero times and printed nothing
while the script exited 0. I only caught it because I grepped for the label I expected and found no
match. A script that exits successfully having skipped the work looks exactly like a script that
did the work.

### Verdict

**Sufficient**, on all three charges, with one honest cost.

Nature's floor reaches the bottom of the frame at every shipping aspect and across the whole camera
envelope — 0 defective rays of 39,366, 0 violet pixels, 0 rows of sky below the grass — and all four
portals stay framed. Pirate Cove's horizon is no longer the largest edge in its own frame; it is no
longer an edge at all, and the water finally gets paler as it recedes. The pull-back rule is
monotone and continuous, and the old one is held out by a suite that fails four ways when it comes
back. The fog defect is not merely fixed but unrepresentable.

**The cost, which belongs to Round 4 and is stated here so it cannot be quietly dropped:** the new
floor is bare. Featureless-tile fraction over the bottom half of the frame is now **58.5% landscape
and 59.4% portrait**. I enlarged the ground and did not populate it. The charge this round brought
is closed; the emptiness the fix exposed is a fair charge against me, and it is the next one.

Commit `ab189fc`. 285 tests, `tsc -b` and `eslint --max-warnings 0` clean, `vite build` green.

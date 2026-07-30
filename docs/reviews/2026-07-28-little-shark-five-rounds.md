# Little Shark — five rounds of indictment, fix, and evaluation

A review of the `little-shark` minigame, conducted under the same standing instruction as the
scene review that preceded it: _do not trust your confidence — prove it, then test your proof._
Every charge below carries a measured number rather than an adjective, and every fix is
evaluated against the number that produced the charge. Where the evaluation refuted the fix, the
round says so and the next round is the iteration.

Normative documents: `docs/ai-guidance/soul.md` and `docs/ai-guidance/vision.md`.

The instrument is `src/.probe/gameplay/r11-after-the-fix.mjs`. It bundles the real TypeScript
modules and runs the actual shark movement, hunt FSM, fish lifecycle and effects code at a fixed
60 Hz against a seeded PRNG — never a re-implementation of them, and never a grep standing in
for behaviour. The headline runs are 180 seconds × 8 seeds, seed base 20260728.

Two disciplines are worth stating up front because they changed the conclusions.

**A probe may not restate the tuning it validates.** `constFromSource` parses
`AUTO_HUNT_MIN_RANGE`, `AUTO_HUNT_COOLDOWN`, `MISS_DURATION` and `CELEBRATE_DURATION` out of the
shipped source and _throws_ if they are absent — no default, no fallback. A probe that hardcodes
its constants prints a beautiful table for a build that was never shipped. This is not
hypothetical: the Round 2 staging was silently wrong for exactly this reason, and fixing it
overturned the round's verdict.

**Twenty-seven structural premises gate every number.** Before any measurement is reported, the
probe asserts against the real source that the properties it believes it is measuring are the
ones the game has — that the FSM branches on `caught`, that the harvest gate still carries both
its terms, that contact no longer cancels a hunt, that the tap picker still offers the golden.
If any premise fails the numbers below describe the probe's imagination rather than the game.
All 27 hold on the shipped build. Round 5 uses a second probe, `r13-the-ramp-only-goes-up.mjs`, with ten
premises of its own; it is described where it is used.

---

## Round 1 — The thrash

### The charge

Left alone for three minutes, the shark started **838 hunts per minute** and finished none of
them. Not "few": zero, out of 2,513 hunts, in every seed.

|                                    | before | after |
| ---------------------------------- | ------ | ----- |
| hunts started per minute           | 838    | 10    |
| hunts that reached a terminal beat | 0      | 30    |
| …as a share of hunts started       | 0%     | 100%  |
| mean hunt lifetime (s)             | 0.06   | 1.18  |
| mean acquisition distance (u)      | 1.60   | 6.44  |
| ended by contact                   | 2,513  | 0     |
| turn reversals per second          | 5.8    | 1.3   |
| nose swing (rad/s)                 | 2.12   | 1.07  |
| fish squirted clear per minute     | 1,118  | 50    |
| fish-units of shoving              | 5,326  | 250   |
| % of frames in `celebrate`         | 0.0%   | 0.0%  |
| % of frames in `miss`              | 0.0%   | 7.8%  |

Three separate defects produce that table, and each is provable from the constants rather than
from the statistics.

**The acquisition range was unbounded below.** Mean acquisition distance was 1.60 units, and
`STRIKE_RANGE` is 1.5. The shark was overwhelmingly "hunting" fish that were already inside
striking distance — a bump, not a stalk. There was no approach to watch because the target was
already under its nose when the hunt began.

**Contact cancelled the hunt.** `FISH_HIT_RADIUS` is 1.0 and `STRIKE_RANGE` is 1.5, so contact
_always_ precedes the strike timer expiring. The `cancelHunt` on contact was written as the rare
interruption — the fish squirmed away mid-lunge — but arithmetic makes it the universal
terminator. 2,513 of 2,513 hunts ended there. `celebrate` had 0.0% frame occupancy: the ending
the animator wrote had never been seen by anybody.

**There was no rest between hunts.** With no cooldown, the frame after a cancelled hunt was
eligible to start another one, which is how 838 hunts per minute is arithmetically reachable at
all.

### Why this is a real defect and not a matter of taste

`soul.md` §5 is titled "Alive, Not Demanding" and its first sentence is "The toybox world is
never static — but it is never frantic. Ambient animations breathe at the pace of a sleeping
cat." A shark reversing its heading 5.8 times per second and travelling 36 times its own net
displacement is not a sleeping cat. It is the failure mode the document names explicitly, which
is why this is a binary failure against a written requirement rather than a preference about
pacing.

The child-facing consequence is sharper. A three-year-old reads intent from motion. A creature
that lunges, aborts, lunges, aborts — never arriving anywhere, never reacting to arriving — is
not legible as an animal with a purpose. It reads as broken. And the 1,118 fish per minute the
thrash squirted out of the way meant the reef the child was invited to look at was continually
being emptied of the thing they were looking at.

### The anticipated defence, and why I reject it

The obvious rebuttal is that the shark _looked_ busy, and busy reads as alive. It did not read
as alive; it read as fast. The distinction is in the terminal-beat row: 0 barrel rolls in 2,513
hunts before the fix. Every one of those hunts was an unresolved gesture. Motion without
resolution is the definition of the frantic thing soul.md forbids, and the animator's own
celebration — already written, already wired — had never once played.

A second rebuttal is that the fix is just an off switch, and a quieter shark is a duller one.
This is the serious objection and the probe was built to answer it, which is the next section.

### The fix

Three changes, one per defect:

1. `AUTO_HUNT_MIN_RANGE = 6.0`, enforced as `if (d < minRangeSq) return;` in the candidate loop.
   A hunt now has an approach.
2. Contact no longer cancels. The fish is still squirted clear — the shark must not be allowed
   to sit inside a fish it was not entitled to eat — but the FSM is left running so it can reach
   its own ending.
3. `AUTO_HUNT_COOLDOWN = 4.0`, armed **only** in the branch that knows the finished hunt was the
   shark's own idea. Armed unconditionally it would also delay the shark's response to the
   child, which is the one thing the auto-hunt may never do.

A fourth change follows from (2): once hunts can reach their ending, the ending has to be
honest. The FSM gained a `caught` flag, `notifyHuntCatch`, and a distinct `miss` phase
(`MISS_DURATION = 0.45` against `CELEBRATE_DURATION = 0.25`), with `onMiss` wired to the
head-look the child already gets from an empty lunge and `onCelebrate` to the barrel roll. A
shark that barrel-rolls over a fish it did not catch is a shark that is lying, and once hunts
could finish, every single finish would have been that lie.

### Evaluating the fix against the charge

Every charged number moved, and the ending exists now: 30 head-looks per session where there
were zero terminal beats of any kind, and **zero unearned celebrations** — of the terminal beats
played, none was a barrel roll over a fish the shark did not catch.

The counter-charge — is this just an off switch? — is answered against the child, not against
the shark. `AUTO_HUNT_IDLE_DELAY` is 3.5 s and **every tap resets it**, so a child tapping faster
than that never meets the auto-hunt at all and must see literally no change. They don't:

| tap every | score before | score after | escapes before | escapes after | rev/s before | rev/s after |
| --------- | ------------ | ----------- | -------------- | ------------- | ------------ | ----------- |
| 2 s       | 164          | 164         | 24             | 24            | 0.9          | 0.9         |
| 3.5 s     | 91           | 91          | 25             | 25            | 0.5          | 0.5         |
| 5 s       | 98           | 82          | 218            | 81            | 2.5          | 1.2         |
| 8 s       | 65           | 53          | 450            | 57            | 4.1          | 0.9         |
| 12 s      | 44           | 35          | 680            | 56            | 4.9          | 1.0         |
| never     | 0            | 0           | 1,118          | 50            | 5.8          | 1.3         |

At an engaged cadence the two builds are bit-identical. There is a real score loss at the slow
cadences, and it is attributed rather than waved at, because `soul.md` §2 says "Every tap is a
good tap" and a fix that made taps fail would be dead on arrival:

| tap every | taps | landed before | landed after | whiffed before | whiffed after | per tap before | per tap after |
| --------- | ---- | ------------- | ------------ | -------------- | ------------- | -------------- | ------------- |
| 5 s       | 36   | 35.0          | 35.0         | 0.0            | 0.0           | 2.21           | 1.79          |
| 8 s       | 23   | 22.0          | 22.0         | 0.0            | 0.0           | 2.34           | 1.65          |
| 12 s      | 15   | 15.0          | 15.0         | 0.0            | 0.0           | 2.33           | 1.54          |

**Zero whiffs in both arms, identical landed-tap counts.** Not one tap that used to work stopped
working. The entire delta is per-tap yield: the thrash used to pile bystander fish under the
shark's nose, so a slow child's occasional tap swept up a crowd the shark had assembled for
them. That is the shark playing the game on the child's behalf, and losing it is the fix
working, not the fix costing.

Idle frame occupancy went from 2% to 69% and mean visible fish from 10.9 to 20.8 — the reef the
child came to look at is now roughly twice as populated, because nothing is shoving it apart.

**The charge is answered.** Round 1 stands as fixed.

---

## Round 2 — The golden latch

### The charge

The golden fish is the game's one prize, and it is meant to have a small game of its own: it
dodges the shark up to `GOLDEN_MAX_DODGES = 2` times before it can be caught. That near-miss is
the whole of its drama.

The dodge was gated on an `isTargeted` flag, and the flag had two writers meaning different
things. Once the auto-hunt had targeted the golden, the flag latched and the dodge was disarmed.
A staged encounter — 200 trials, the child given 8 seconds of dragging the shark at the golden:

|                                             | dodges the child gets | 0-dodge trials | caught |
| ------------------------------------------- | --------------------- | -------------- | ------ |
| control (child engages an untouched golden) | 1.00                  | 0 / 200        | 100.0% |
| shipped (auto-hunt looked at it first)      | 0.00                  | **200 / 200**  | 100.0% |

In 200 of 200 trials, a golden the shark had glanced at while the child was not looking gave the
child no dodge at all. The prize fish was silently downgraded to an ordinary one before the
child arrived.

### Why this is a real defect and not a matter of taste

This is not a difficulty question. `soul.md` §1 is "Wonder Over Achievement" — the golden's
dodge is not a gate to be beaten, it is the moment the fish becomes a character rather than a
score token. Deleting it deletes the character.

What makes it a defect rather than a tuning choice is that **the child cannot perceive the
cause**. Two visually identical golden fish behave differently, and the difference is determined
by whether an off-screen AI happened to look at one of them minutes earlier. There is no signal,
no tell, nothing to learn. `soul.md` §4 — "Touch Everywhere, Read Nowhere" — rests on the world
teaching itself; a rule the child has no possible access to is not a rule, it is noise.

### The fix (as first attempted)

`isTargeted` was deleted from the game entirely — from `types.ts`, `fish/lifecycle.ts`,
`fish/effects.ts` and `index.ts` — and the dodge re-gated on distance alone. The flag had two
writers meaning different things and one reader, and its only reachable effect was this bug. A
test now asserts that no fish anywhere in the game carries a claimed-by-the-child flag, so if it
returns it returns with a test saying which meaning it carries.

### Evaluating the fix against the charge — and the fix failing

The first staging of this evaluation parked the shark 4 units from the golden and force-started
a hunt. `AUTO_HUNT_MIN_RANGE` is 6.0. The probe was staging an acquisition the fixed game
refuses to make, and reporting a pass. This is precisely what the "a probe may not restate the
tuning it validates" discipline exists to catch, and it is why the constants are now parsed out
of source with a throw rather than a default.

Restaged honestly — standoff derived from the real constant, phase 1 run to the hunt's actual
terminal beat rather than an arbitrary 2-second cutoff — the fix failed:

|                       | dodges the child gets | 0-dodge trials | spent by the AI first | budget left at handover |
| --------------------- | --------------------- | -------------- | --------------------- | ----------------------- |
| control               | 1.00                  | 0 / 200        | 0.00                  | 2.00                    |
| before                | 0.00                  | 200 / 200      | 0.00                  | 2.00                    |
| after (first attempt) | **0.00**              | **200 / 200**  | **2.00**              | **0.00**                |

The child still got zero dodges in 200 of 200 trials. The fix had restored the dodge and then
handed it to the wrong party: `dodgeCount` is a **lifetime** budget, not a per-encounter one, and
the auto-hunt now spent both of them before the child's finger ever touched the screen. The
outcome for the child was bit-identical to the bug.

The standing instruction is _evaluate the fix against the "suck" — fix if it suffices, otherwise
iterate._ It did not suffice. Round 3 is the iteration.

---

## Round 3 — The errand the rules forbid

_This round exists because the Round 2 fix failed its own test. It is recorded as a separate
round rather than folded into Round 2 because the failure is the most useful thing in this
document: the fix was designed by the same reasoning that wrote the charge, and only a probe run
against the changed source caught that it had moved the defect instead of removing it._

### The charge

The auto-hunt could target the golden fish. It should never have been able to.

This is a deduction, not a statistic, and the deduction is what carries the round. The harvest
gate in `index.ts` is:

```ts
const canHarvest = isPlayerDriven(sharkMove) && !autoHuntActive;
```

`autoHuntActive` is true for **every frame** from `triggerHunt` until the phase returns to idle.
So an auto-hunt on the golden **cannot end in a catch — not rarely, but never, by
construction.** There is no tuning under which it succeeds. Its only two possible effects are to
spend the prize fish's lifetime dodge budget and to shove it across the reef.

The statistical case is deliberately _not_ the argument here, and it is worth showing why:

|                            | goldens seen | auto-hunts on it | dodges spent | of a budget of |
| -------------------------- | ------------ | ---------------- | ------------ | -------------- |
| unattended, before Round 1 | 11.8         | 14.0             | 0.25         | 2              |
| unattended, after Round 1  | 3.3          | 0.9              | 0.25         | 2              |
| played (3.5 s), either     | 6.3          | 0.0              | 0.00         | 2              |

Post-Round-1 the shark starts an auto-hunt on a golden roughly **0.9 times per three unattended
minutes, and never once during actual play**. On frequency alone this would be indefensible to
fix. But rarity is not the measure. When it does happen it costs the child the entire game of
the one prize fish in the reef, and it costs it for a hunt that the game's own rules guarantee
will be fruitless. A rare total loss for zero possible gain does not need a frequency argument.

### The fix

`consider(goldenFish);` is deleted from `maintainAutoHunt`'s candidate loop, with the deduction
recorded in the source beside it so the next reader does not restore it as an oversight.

The half of this fix that matters as much is what was _not_ changed: `findFishNearTap` still
contains `consider(goldenFish);` and must. That is the tap picker. Removing the golden from the
AI's acquisition list must not remove it from the child's, or the prize fish becomes scenery.

This distinction nearly went wrong. `index.ts` holds two `consider(fish)` closures over a
`best`/`bestDistSq` pair, and the first premise written to check this fix matched the tap picker
instead of the auto-hunt and reported the wrong answer with total confidence. Both the probe and
the regression test now brace-match the function body before searching it, and both directions
are pinned: the auto-hunt must not offer the golden, and the tap picker must.

### Evaluating the fix against the charge

|                                               | dodges the child gets | 0-dodge trials | caught     | spent by the AI first | budget left |
| --------------------------------------------- | --------------------- | -------------- | ---------- | --------------------- | ----------- |
| control (child engages an untouched golden)   | 1.00                  | 0 / 200        | 100.0%     | 0.00                  | 2.00        |
| before (auto-hunt looked at it first)         | 0.00                  | 200 / 200      | 100.0%     | 0.00                  | 2.00        |
| **after (auto-hunt cannot engage it at all)** | **1.00**              | **0 / 200**    | **100.0%** | **0.00**              | **2.00**    |

The auto-hunt declined the golden in 200 of 200 trials — not by the probe's choice, but because
the shipped acquisition list does not contain it, so there is no phase 1 to survive. Compared
trial by trial on the same seed, the "after" arm and the control produced **200/200 identical
dodge counts**.

A golden is now the same fish whether the shark has been near it or not. That is the whole
claim, and it is now true by construction rather than by a number landing in the right place.

**The charge is answered.** Rounds 2 and 3 together stand as fixed.

---

## Round 4 — The reward nobody can see

_The instrument for this round is `src/.probe/gameplay/r12-does-the-payoff-arrive.mjs`: 300 s x 8
seeds x three tap cadences (2 s, 3.5 s, 5 s), seed base 20260728, tracing frenzy phase, visible
population, spawn target, score and catches every frame. Unattended sessions are deliberately not
run — after Round 3 an unattended shark cannot harvest at all, so it banks no catches and the
frenzy never fires. The frenzy is a played-session feature and is measured as one._

### The charge

`frenzy.ts` exists because an earlier round measured the session as having no temporal shape:
minute nine was statistically indistinguishable from minute one. Its answer is a build-and-payoff
cycle, and the payoff's headline is a single line in `updateSpawning`:

```ts
const targetNearby = getTargetFishCount(level) * (frenzyOn ? 2 : 1) * regionFishMultiplier(...);
```

The reef target doubles for the fourteen seconds of the frenzy. **This is the only channel of the
payoff that lasts longer than a moment.** The audio sting, the vignette, the colour flash, the
screen shake and the surprise nudge all fire once on the phase transition and are over inside
half a second; the HUD meter reads full and then drains. Fourteen seconds is a long time for a
three-year-old to be told that something wonderful is happening. Something has to actually be
happening.

It largely is not, and the reason is that **the spawner has an appetite but no digestion.** It
fills toward `targetNearby` every frame and nothing anywhere gives a fish back for being surplus
to it. The only two exits are being eaten and drifting past `CULL_DISTANCE`, which is 22 against
a `CAMERA_VIEW_RADIUS` of 11. So the target is a floor that the population is pushed up to and
never a ceiling it is brought down to, and the reef ratchets:

| tap every | calm target | calm reef | reef is over its own target by |
| --------- | ----------- | --------- | ------------------------------ |
| 2 s       | 19.0        | 32.6      | **1.72x**                      |
| 3.5 s     | 17.6        | 31.4      | **1.78x**                      |
| 5 s       | 16.7        | 30.0      | **1.80x**                      |

The game computes a number every frame and then holds nearly twice it. A reef already sitting at
1.8x target has nowhere to double into, so the frenzy spends itself paying off a debt that is
already settled:

| tap every | cycle | reef before | during | 5-15 s after | after / before |
| --------- | ----- | ----------- | ------ | ------------ | -------------- |
| 2 s       | 1     | 14.4        | 30.6   | 31.3         | **2.18x**      |
|           | 2     | 30.4        | 40.4   | 39.0         | 1.28x          |
|           | 3     | 38.3        | 45.2   | 33.0         | **0.86x**      |
|           | 4     | 33.3        | 39.8   | 32.5         | 0.98x          |
|           | 5     | 29.7        | 40.3   | 33.2         | 1.12x          |
| 5 s       | 1     | 18.0        | 32.3   | 33.8         | **1.87x**      |
|           | 3     | 36.1        | 43.2   | 35.7         | 0.99x          |
|           | 5     | 34.3        | 46.2   | 41.1         | 1.20x          |

The first frenzy of a session more than doubles the reef and it **never comes back down** — the
"before" column climbs 14.4 → 30.4 → 38.3 and stays there. Every subsequent frenzy is bidding
against its own predecessor's leftovers.

Now hold that against what a three-year-old can actually perceive. Past three or four items a
child does not count, they estimate, and the approximate number system has a _ratio_ limit rather
than a difference limit. Halberda & Feigenson (2008) put three-year-olds at reliable
discrimination around 3:4 and at chance below it, so a reef must grow by **≥1.33x** to read as
"more fish" — the same literature `frenzy.ts` already cites for never rendering the goal as a
numeral.

| tap every | frenzies | target asked for | realised  | frenzies the child could actually see |
| --------- | -------- | ---------------- | --------- | ------------------------------------- |
| 2 s       | 69       | 2.04x            | **1.49x** | **39 of 69**                          |
| 3.5 s     | 50       | 2.04x            | **1.60x** | 41 of 50                              |
| 5 s       | 49       | 2.10x            | **1.49x** | **28 of 49**                          |

The game promises 2.04x and delivers 1.49x. At the fastest and slowest cadences, **more than
four in ten frenzies produce a change the child is measurably unable to notice.** The reward was
firing on schedule, correctly, and was invisible.

### Why this is a real defect and not a matter of taste

Because a reward the child cannot perceive is not a reward, and because the game asserts the
opposite at that moment across five separate channels. The vignette blooms, the music surges, the
screen shakes, and the reef stays as it was. Three-year-olds are extremely good at noticing that
a promise did not land, and the thing being taught here is precisely that the world responds to
them in ways worth attending to. A ceremony with nothing behind it teaches the opposite, and it
teaches it about the game's most emphatic moment.

There is a documentation half to this, too. `isFrenzyActive`'s docstring claims the frenzy enables
"extra-generous frenzy spawning **and scoring**." `frenzyOn` is read at exactly one site in
`index.ts` and does not touch points. The scoring half was never implemented, which is defensible
as a design position but not as a comment.

### The anticipated defence, and why I reject it

_"The reef is bigger during the frenzy. 42 fish against 31 is more fish. The measurement agrees."_

It is more fish and it is not a perceptible difference, and for this player those are different
claims rather than degrees of the same one. 31 → 42 is a ratio of 1.35, which sits a hair over
the discrimination threshold under laboratory conditions — a still display, an attentive child,
a two-alternative forced choice. This is a moving reef, glimpsed peripherally, by a child whose
attention is on their own finger. Treating a marginal laboratory ratio as a delivered payoff in
those conditions is not conservative.

_"Then raise the multiplier from 2 to 3."_

This is the tempting fix and it is the wrong one. It scales the numerator while leaving the
ratchet intact, so it buys one or two more perceptible cycles and then saturates at a higher
level, with a permanently crowded reef as the cost. The defect is not that the multiplier is too
small. It is that the target does not mean anything on the way down.

### The fix

Retire a surplus fish when the reef holds more than the target asks for — at a bounded rate, so
the reef ebbs rather than snapping back. `SURPLUS_RETIRE_INTERVAL = 0.25` s is a rate _cap_, not a
rate: at four fish per second a doubling drains over roughly the afterglow, so the crowd thins as
the moment closes instead of being confiscated the instant the meter empties.

**Two arms were measured, and the one that scored worse was shipped.** This is the most important
thing in this round.

| arm                  | frenzies | reef before | during | realised  | child could see | nearest fish retired |
| -------------------- | -------- | ----------- | ------ | --------- | --------------- | -------------------- |
| visible-edge, 2 s    | 69       | 19.5        | 37.9   | **1.96x** | **69 of 69**    | **4.5 u**            |
| visible-edge, 3.5 s  | 55       | 18.5        | 35.9   | **1.94x** | **55 of 55**    | **4.6 u**            |
| visible-edge, 5 s    | 48       | 19.8        | 39.7   | **2.04x** | **48 of 48**    | **5.5 u**            |
| **reservoir, 2 s**   | 69       | 21.7        | 37.9   | 1.79x     | 66 of 69        | **11.0 u**           |
| **reservoir, 3.5 s** | 54       | 22.4        | 39.9   | 1.82x     | 52 of 54        | **11.0 u**           |
| **reservoir, 5 s**   | 47       | 20.3        | 38.4   | 1.91x     | 47 of 47        | **11.0 u**           |

The `visible-edge` arm retires the outermost fish _inside_ the band the child can see. It is
better on every gameplay number — it recovers essentially the full promised 2x and makes every
single frenzy perceptible. It was rejected because of the last column. The nearest fish it was
ever observed retiring sat **4.5 units from the shark against a view radius of 11** — not the far
edge at all but the middle of the screen, because when the outer reef is thin the "outermost fish
inside the view" can be very close indeed. A fish dissolving under a three-year-old's finger is a
worse defect than the imperceptible frenzy it was fixing.

**And no probe in this file could have exonerated it.** The tap model always picks the fish
nearest the shark, so it structurally _cannot_ tap the fish that arm retires. Any "no fish was
ever taken from under a finger" statistic it produced would have been an artefact of the
instrument rather than a property of the game — absence of evidence, manufactured. That
realisation, not any measurement, is what decided this round.

So the shipped arm takes fish only from the offscreen 11-to-22 shell
(`SURPLUS_RETIRE_MIN_DISTANCE = CAMERA_VIEW_RADIUS`), starving the inflow instead of editing the
view. Slower, weaker, and impossible to see. Two further guards: never the hunt target, which
would dissolve a fish mid-chase and hand the child a pursuit that resolves into nothing — Round 1's
defect wearing a hat — and never the golden, which is safe because it is not a member of
`fishArray`, recorded in the source so a future refactor that adds it knows to add an exclusion.

### Evaluating the fix against the charge

The charge had three parts. All three move.

**The ratchet is broken.** The calm reef sat at 1.72x-1.80x of its own target; the reef before a
frenzy now sits at 20.3-22.4 against a calm target of 16.7-19.0. The reef obeys the number the
game already computes — brought down _to_ target, not below it, which is the difference between a
fix and a nerf and is the reason the absolute figures are reported here alongside the ratios.

**The payoff arrives.** Realised 1.49x/1.60x/1.49x → **1.79x/1.82x/1.91x**, against an ask of
~2.04x. Perceptible cycles: 108 of 168 → **165 of 170**. Five cycles still fall short, all at the
two faster cadences, and they are recorded rather than rounded away.

**The cost is small and not systematically negative.** Score 288 → 282, 166 → 178, 156 → 152;
catches 237 → 244, 133 → 146, 118 → 112. Two cadences up, one down a few percent, no whiffs
introduced. The child catches no less for the reef being the size the game asked for.

**The charge is answered.** The frenzy now pays a reward at roughly 1.85x — a ratio a
three-year-old can see — in 97% of cycles rather than 64%, without a fish ever vanishing in front
of them.

---

## Round 5 — The ratchet

Instrument: `src/.probe/gameplay/r13-the-ramp-only-goes-up.mjs`, 300 seconds × 24 seeds, seed base
20260729, ten structural premises, all holding.

Twenty-four seeds and not six, because six lied. At six seeds the `damped` arm measured −6.3 points
of dead taps at the middle cadence and I was ready to ship it. At twenty-four it measures −2.0,
inside its own standard error. The standard errors in this round run 0.6 to 1.1 points, so a paired
difference below about 2.4 points is not a finding, and the probe now prints a `+/- se` column so
that this cannot be forgotten again. Nothing in Round 5 would have been true if I had trusted the
first table I produced.

### The charge

`context.difficulty.level` is a ratchet. It only ever goes up, it reaches the top inside the first
minute or two, the session then lives there, and living there costs the child real contingency.

The one-way property is a deduction, not a frequency. Three facts compose:

1. `level = clamp((score - rampStart) / (rampEnd - rampStart), 0, 1)` — monotone in the score.
2. The score only rises: `score.addPoints` has exactly one call site, every value in `FISH_POINTS`
   is positive, and `reset()` is not on the frame path.
3. The shell drives difficulty from the score and from nothing else.

A monotone function of a quantity that never falls never falls. No amount of measurement is needed
and none is offered: the level cannot come down inside a session, by construction. The probe
records this as `drawdown` — the furthest the level ever gets below its own high-water mark — and
for the shipped game it is exactly **0.000** at every cadence.

Where does that put a real session? `soul.md` describes a session of about a minute.

| tap every | score | reaches level 1 at | % of session at ≥0.9 | mean level |
| --------- | ----- | ------------------ | -------------------- | ---------- |
| 2 s       | 252   | 56 s (24/24)       | 83%                  | 0.89       |
| 3.5 s     | 145   | 89 s (24/24)       | 73%                  | 0.82       |
| 5 s       | 107   | 118 s (24/24)      | 64%                  | 0.76       |

The ramp is spent inside the first minute at the fastest cadence and inside two at the slowest, in
24 of 24 seeds every time. Whatever the top of the ramp is, it is not an endgame; it is the game.

And the top costs taps. Pinning the level at each of the ramp's own endpoints for a whole session —
these are not candidate fixes, they are the ramp's two ends — at a 0.6 s reaction time:

| tap every | level | dead taps | caught the one aimed at | catches/min | goldens | reef seen |
| --------- | ----- | --------- | ----------------------- | ----------- | ------- | --------- |
| 2 s       | 0.0   | 15.2%     | 64.5%                   | 41.1        | 9.9     | 25.2      |
| 2 s       | 1.0   | 25.9%     | 45.4%                   | 42.3        | 9.6     | 31.4      |
| 3.5 s     | 0.0   | 15.5%     | 65.6%                   | 22.9        | 6.2     | 23.3      |
| 3.5 s     | 1.0   | 23.8%     | 47.9%                   | 25.8        | 7.4     | 29.8      |
| 5 s       | 0.0   | 24.4%     | 56.8%                   | 15.8        | 6.5     | 22.4      |
| 5 s       | 1.0   | 31.7%     | 40.1%                   | 17.7        | 6.8     | 27.8      |

So the charge is: **the game answers a three-year-old's success by making their finger less
effective, permanently, within the first minute, and there is no mechanism by which it can ever
relent.** One tap in four does nothing at the top of the ramp, against one in six or seven at the
bottom, and barely half of the taps that do land catch the fish the child was pointing at.

### Why this is a real defect and not a matter of taste

Because `soul.md`'s invariant is contingency — _I touch it, it happens_ — and this is a measured
14-to-19-point regression in exactly that, delivered as a consequence of playing well. Rounds 1, 2
and 3 each found the child's input being made decorative by a different mechanism. This is the same
defect arriving on a schedule, wearing the costume of a difficulty curve.

The distinction that makes it a defect rather than a preference is _who chose it_. A difficulty
ramp the child can push back against is a conversation. A ramp with drawdown 0.000 is a verdict. A
three-year-old cannot infer "I should tap sooner" from a fish that left before their finger
arrived; what is available to be learned is that touching the screen used to work and now does not.

### The anticipated defence, and why I reject it

_Games get harder. That is what difficulty means, and Round 1 deliberately added the liveliness the
fast fish provide._

I accept both clauses and they do not defend this. Getting harder is not the charge; being
**irreversible, early, and paid for in dead taps** is. The reef also grows on the same ramp — 14 to
18 fish — so the ramp is not uniformly hostile, and I have not charged it with being so. I have
charged one specific consequence: that the mechanism by which the game gets harder happens to be
the mechanism that decides whether a tap resolves.

_Then cap or damp the ramp._ This is the serious version of the defence, and it is why this round
took three tables rather than one. It was tried, four ways, and it failed. See below.

### The failure of the obvious fix

Four arms tried to make the ramp two-way: a hard cap at 0.5; bubble-pop's own accuracy-EMA damper
(`adaptive.ts`, `score × (0.5 + 0.5 × profile)` over a 30 s tap window) at both of its plausible
time constants; and that damper applied to the motor dials only, leaving the reef on the raw ramp.
A fifth lowered `MAX_SPEED_MULTIPLIER`. At 24 seeds, against standard errors of 0.6–1.1:

| arm                      | dead taps @3.5 s | vs flat  | mean level | % at ≥0.9 | drawdown |
| ------------------------ | ---------------- | -------- | ---------- | --------- | -------- |
| flat (pre-round-5)       | 22.8% ± 0.83     | —        | 0.82       | 73%       | 0.000    |
| capped at 0.5            | 18.2% ± 0.86     | −4.6 pts | 0.44       | 0%        | 0.000    |
| damped (1 s EMA)         | 20.8% ± 1.10     | −2.0 pts | 0.70       | 21%       | 0.219    |
| damped (per-frame EMA)   | 20.2% ± 0.87     | −2.5 pts | 0.70       | 31%       | 0.392    |
| damped, motor dials only | 20.9% ± 0.73     | −1.9 pts | 0.70       | 21%       | 0.232    |
| speed ceiling ×1.00      | 21.7% ± 0.93     | −1.1 pts | 0.83       | 73%       | 0.000    |

Every one of them buys 1–5 points, most of it inside noise, and the two that buy the most do it by
deleting the ramp rather than damping it: `capped` spends its whole session at level 0.44 and never
once reaches 0.9. The damper family does at least make the ramp two-way — drawdowns of 0.2 to 0.4,
the only arms in this document that give anything back — and it is still not enough, because the
dead taps were never really about the level.

_A note on how the damper arms were built._ I first reasoned my way to a once-per-second EMA step
for bubble-pop's profile, then read `index.ts:401` and found it steps every frame — a ~20 s time
constant against a ~0.33 s one. Rather than defend the number I had chosen, both run as arms. The
mistake is recorded in the probe at the point where it would have mattered.

### Why the fix had to be re-aimed

The ramp drives two hostile dials at once, and "+8.3 points of dead taps" does not say which one
spends them. Pinning the reef at the top and moving one dial at a time, at 3.5 s and 0.6 s:

| speed | evasion | dead taps | ± se | vs both off | caught the one aimed at |
| ----- | ------- | --------- | ---- | ----------- | ----------------------- |
| 0     | 0       | 15.5%     | 0.59 | —           | 65.6%                   |
| 1     | 0       | 20.5%     | 0.77 | +5.0 pts    | 51.2%                   |
| 0     | 1       | 16.7%     | 0.97 | +1.2 pts    | 59.7%                   |
| 1     | 1       | 23.8%     | 0.69 | +8.3 pts    | 47.9%                   |

**Speed spends the taps.** Evasion's +1.2 points sits inside its own standard error; the remaining
~2.1 points are superadditive interaction. A fix aimed at evasion — or at the level in general —
would have measured as a partial success and shipped as a whole one. That is precisely what the
damper family was doing.

And once the dial is named, the mechanism is arithmetic rather than statistics. A tap lands only if
the fish is still inside the snap circle when the finger **arrives**, which is not when the child
decided:

- snap radius 1.34 world units; mean fish base drift (1.0 + 1.8)/2 = 1.40 units/second
- at level 0, ×0.55: the fish covers 0.46 u in a 0.6 s reaction = **34% of the snap radius**
- at level 1, ×1.45: the fish covers 1.22 u = **91% of the snap radius**

At the top of the ramp the fish very nearly clears the entire forgiveness circle inside the child's
reaction time. The tap does not miss by bad luck. It misses by arithmetic.

That also disposes of the fifth arm. If speed is the problem, cap speed — so the ceiling was swept
with everything else pinned at the top:

| ceiling         | travel ÷ snap | dead taps | ± se | vs the speed floor |
| --------------- | ------------- | --------- | ---- | ------------------ |
| ×0.55 (floor)   | 34%           | 16.7%     | 0.97 | — (target)         |
| ×1.45 (shipped) | 91%           | 23.8%     | 0.69 | +7.2 pts           |
| ×1.15           | 72%           | 21.0%     | 0.85 | +4.3 pts           |
| ×1.00           | 63%           | 23.1%     | 0.76 | +6.4 pts           |
| ×0.70           | 44%           | 19.7%     | 0.82 | +3.0 pts           |

Non-monotone within noise, and even ×0.70 — which is very nearly no speed ramp at all — still
leaves +3.0 points. Capping speed cannot restore contingency, and it pays for its failure in the
visible liveliness Round 1 deliberately added.

### The fix

Leave every fish exactly as it is. Grow the forgiveness circle by exactly the extra distance a
faster fish covers inside the child's reaction time — the miss arithmetic above, run backwards.

```ts
const ASSUMED_TOUCH_LATENCY_S = 0.6;
const MEAN_FISH_BASE_SPEED = (FISH_BASE_SPEED_MIN + FISH_BASE_SPEED_MAX) / 2;
const PX_PER_WORLD_UNIT_AT_SHARK_DEPTH = 224 / 2.5;

function tapSnapRadiusPx(): number {
  const extraUnitsPerSecond =
    Math.max(
      0,
      getSpeedMultiplier(context.difficulty.level) - MIN_SPEED_MULTIPLIER,
    ) * MEAN_FISH_BASE_SPEED;
  return (
    FISH_TAP_SNAP_RADIUS_PX +
    extraUnitsPerSecond *
      ASSUMED_TOUCH_LATENCY_S *
      PX_PER_WORLD_UNIT_AT_SHARK_DEPTH
  );
}
```

Nothing in it is chosen. 120 px at the bottom of the ramp, where the sweep that chose 120 px was
run; 188 px at the top, and every value between is the displacement arithmetic. The ratchet is
deliberately left standing — which also avoids undoing Round 3's fix, the one that wired the ramp
up in the first place.

**One flaw in my own instrument nearly shipped with it.** The first version of this line sized the
circle from the session's _observed_ reaction time. Every number it produced was inflated, because
it granted the fix perfect knowledge of the child in front of it. The shipped game cannot measure a
child's reaction time; it can only assume one, and then be judged on what happens when the
assumption is wrong. So the constant is fixed, the probe sweeps the child's real reaction time
_independently_ of it, and the assumption itself is anchored: ECITT (PMC8638877) reports mean median
reaction times on prepotent trials of 1,038 ms at 30 months and 1,089 ms at 24 months on a
**stationary** iPad target. 0.6 s is deliberately below that floor, because over-assuming is paid
for in the random-poke column and under-assuming is paid for in a currency the child already has.

### Evaluating the fix against the charge

| arm       | tap every | dead taps | ± se | vs flat | caught the one aimed at | random poke hits | catches/min | reef seen | mean level | drawdown |
| --------- | --------- | --------- | ---- | ------- | ----------------------- | ---------------- | ----------- | --------- | ---------- | -------- |
| flat      | 2 s       | 24.5%     | 0.85 | —       | 46.9%                   | 31.3%            | 42.5        | 30.0      | 0.89       | 0.000    |
| snap-comp | 2 s       | 4.6%      | 0.33 | −20.0   | 57.5%                   | 50.5%            | 53.2        | 31.4      | 0.90       | 0.000    |
| flat      | 3.5 s     | 22.8%     | 0.83 | —       | 51.0%                   | 28.0%            | 24.2        | 28.8      | 0.82       | 0.000    |
| snap-comp | 3.5 s     | 4.3%      | 0.45 | −18.5   | 61.3%                   | 46.3%            | 30.1        | 28.7      | 0.84       | 0.000    |
| flat      | 5 s       | 29.8%     | 0.86 | —       | 46.1%                   | 25.7%            | 16.9        | 25.7      | 0.76       | 0.000    |
| snap-comp | 5 s       | 11.3%     | 0.91 | −18.5   | 52.6%                   | 41.6%            | 22.2        | 27.6      | 0.77       | 0.000    |

Dead taps fall by 18–20 points against standard errors under 1.0 — the only effect in this round
large enough to be a finding rather than a coin toss. **At the top of the ramp the child now
misses less often than they did at the bottom of it** (2.9% at level 1 with the fix, against 15.5%
at level 0 without). Aim fidelity rises rather than falls, 51.0% → 61.3%, which is the answer to the
obvious worry that a wider circle would start grabbing the wrong fish. The mean level is untouched
at 0.82 → 0.84 and the reef is unchanged: the whole ramp survives.

**The price, and index.ts's own criterion for judging it.** A wider circle means a poke at nothing
lands more often, and that is the same defect seen from the other side — a snap so generous that
aiming stops mattering. `index.ts` chose 120 px over 220 px for exactly this reason (a random poke
landed 72% of the time at 220 px), and its criterion is the **gap**: aimed hits minus random hits.
So the gap is re-measured at every reaction time a three-year-old might plausibly have, with the
fix holding its assumed 0.6 s throughout — every row but the middle one is the fix being _wrong_
about the child:

| child's real RT | dead taps @1 | @1 + fix | random poke @1 | + fix | gap @1 | gap + fix |
| --------------- | ------------ | -------- | -------------- | ----- | ------ | --------- |
| 0.3 s           | 17.5%        | 2.0%     | 29.4%          | 51.1% | 53.0   | 46.9      |
| 0.6 s (assumed) | 23.8%        | 2.9%     | 29.7%          | 50.8% | 46.5   | 46.3      |
| 1.0 s           | 34.2%        | 6.6%     | 29.6%          | 50.8% | 36.3   | 42.6      |

At the assumed latency the gap is preserved outright, 46.5 → 46.3. Away from it the error is
**asymmetric in the safe direction**: for a slow child the fix _improves_ the gap by 6.3 points,
and what it costs, it costs the fast child who was already succeeding. The single row where the gap
regresses describes a three-year-old faster than the developmental literature reports existing.
Fully widened the circle reaches 188 px, inside the 220 px this file measured and rejected, and only
ever at the top of the ramp.

**What the fix does not do, stated plainly.** Drawdown is still 0.000. The ramp is still a ratchet
and this fix does not make it two-way; the damper arms are the only thing in this document that
did, and they bought 1–3 points for it. The defensible position is narrower than the charge and I
would rather say so than round it up: the ratchet's harm ran almost entirely through one channel,
that channel is now closed, and a ratchet that no longer costs the child taps is a difficulty curve
rather than a verdict. **The charge is answered; the charge's framing was wrong.** I opened this
round intending to make the ramp come back down, and the measurement refused that fix five times
before pointing at a better one.

---

## What is pinned, so this cannot silently regress

`tests/minigames/little-shark-agency.test.mjs` (23 tests, part of the 368-test suite) holds the
contract: both terms of the harvest gate, the auto-hunt's provenance flag and that a tap clears
it, the cooldown being armed only for the shark's own hunts and actually gating acquisition, the
minimum acquisition range and a non-empty acquisition band, contact no longer cancelling, the
split terminal beat, the absence of `isTargeted` anywhere outside a comment, and — from Round 3
— that `maintainAutoHunt` does not consider the golden while `findFishNearTap` still does.

Round 4 adds four, and they exist for a specific reason: **`r12` reimplements the session loop and
models the drain itself, so its numbers vouch for the design and cannot vouch for the shipped
implementation.** Everything the design's safety rests on is therefore pinned directly against
`index.ts` and `waves.ts`: that surplus retirement exists at all in `updateSpawning`, that it
consults the distance floor, that it excludes the hunt target, that it plays the despawn
animation rather than popping the fish — and, separately, that
`SURPLUS_RETIRE_MIN_DISTANCE >= CAMERA_VIEW_RADIUS` with a positive interval, because a guard that
consults a constant proves nothing if the constant can be set to 2. Values, not just shapes.

Round 5 adds seven, taking the file to 30 tests inside a 375-test suite, and they are values almost
all the way down because every structural assertion about this fix would also pass on a version of
it widened by 3 px, or widened to 400 px, or one that quietly measured the child instead of
assuming. What is pinned: that `findFishNearTap` resolves against `tapSnapRadiusPx()` and no longer
squares the flat constant, so the widening cannot be computed and then ignored; that the widening
follows `context.difficulty.level` and contains no clock and no observed reaction time, which is the
instrument flaw that nearly shipped; that it is exactly zero at the bottom of the ramp, where the
sweep that chose 120 px was run; that it is monotone across the ramp, since a snap radius that fell
as the child succeeded would recreate the defect inside the fix; that at the top it equals the
displacement arithmetic to within 0.01 px, is more than 40 px, and keeps the total under the 220 px
this file measured at a 72% random-poke rate; that `ASSUMED_TOUCH_LATENCY_S` stays positive and
below the 1.038 s ECITT floor, which pins the _direction_ of the error rather than merely its
presence; and that `MEAN_FISH_BASE_SPEED` is still derived from the fish's own speed constants
rather than frozen into a literal that could drift away from how fast the fish actually swim.

Each of those seven was verified by mutation: the tap picker reverted to the flat radius, the
assumed latency set to 1.5 s and to 0.05 s, the mean speed replaced by the literal 1.4, the widening
re-sized from `Date.now()`, and the `Math.max(0, …)` clamp removed. Six mutations, six failures,
each in the test written for it — and the suite back to 30 passing when reverted. A pin that has
never been seen to fail is not yet a pin.

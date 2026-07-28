# Little Shark — five rounds of indictment, fix, and evaluation

A review of the `little-shark` minigame, conducted under the same standing instruction as the
scene review that preceded it: *do not trust your confidence — prove it, then test your proof.*
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
shipped source and *throws* if they are absent — no default, no fallback. A probe that hardcodes
its constants prints a beautiful table for a build that was never shipped. This is not
hypothetical: the Round 2 staging was silently wrong for exactly this reason, and fixing it
overturned the round's verdict.

**Twenty-seven structural premises gate every number.** Before any measurement is reported, the
probe asserts against the real source that the properties it believes it is measuring are the
ones the game has — that the FSM branches on `caught`, that the harvest gate still carries both
its terms, that contact no longer cancels a hunt, that the tap picker still offers the golden.
If any premise fails the numbers below describe the probe's imagination rather than the game.
All 27 hold on the shipped build.

---

## Round 1 — The thrash

### The charge

Left alone for three minutes, the shark started **838 hunts per minute** and finished none of
them. Not "few": zero, out of 2,513 hunts, in every seed.

| | before | after |
|---|---|---|
| hunts started per minute | 838 | 10 |
| hunts that reached a terminal beat | 0 | 30 |
| …as a share of hunts started | 0% | 100% |
| mean hunt lifetime (s) | 0.06 | 1.18 |
| mean acquisition distance (u) | 1.60 | 6.44 |
| ended by contact | 2,513 | 0 |
| turn reversals per second | 5.8 | 1.3 |
| nose swing (rad/s) | 2.12 | 1.07 |
| fish squirted clear per minute | 1,118 | 50 |
| fish-units of shoving | 5,326 | 250 |
| % of frames in `celebrate` | 0.0% | 0.0% |
| % of frames in `miss` | 0.0% | 7.8% |

Three separate defects produce that table, and each is provable from the constants rather than
from the statistics.

**The acquisition range was unbounded below.** Mean acquisition distance was 1.60 units, and
`STRIKE_RANGE` is 1.5. The shark was overwhelmingly "hunting" fish that were already inside
striking distance — a bump, not a stalk. There was no approach to watch because the target was
already under its nose when the hunt began.

**Contact cancelled the hunt.** `FISH_HIT_RADIUS` is 1.0 and `STRIKE_RANGE` is 1.5, so contact
*always* precedes the strike timer expiring. The `cancelHunt` on contact was written as the rare
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

The obvious rebuttal is that the shark *looked* busy, and busy reads as alive. It did not read
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
|---|---|---|---|---|---|---|
| 2 s | 164 | 164 | 24 | 24 | 0.9 | 0.9 |
| 3.5 s | 91 | 91 | 25 | 25 | 0.5 | 0.5 |
| 5 s | 98 | 82 | 218 | 81 | 2.5 | 1.2 |
| 8 s | 65 | 53 | 450 | 57 | 4.1 | 0.9 |
| 12 s | 44 | 35 | 680 | 56 | 4.9 | 1.0 |
| never | 0 | 0 | 1,118 | 50 | 5.8 | 1.3 |

At an engaged cadence the two builds are bit-identical. There is a real score loss at the slow
cadences, and it is attributed rather than waved at, because `soul.md` §2 says "Every tap is a
good tap" and a fix that made taps fail would be dead on arrival:

| tap every | taps | landed before | landed after | whiffed before | whiffed after | per tap before | per tap after |
|---|---|---|---|---|---|---|---|
| 5 s | 36 | 35.0 | 35.0 | 0.0 | 0.0 | 2.21 | 1.79 |
| 8 s | 23 | 22.0 | 22.0 | 0.0 | 0.0 | 2.34 | 1.65 |
| 12 s | 15 | 15.0 | 15.0 | 0.0 | 0.0 | 2.33 | 1.54 |

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

| | dodges the child gets | 0-dodge trials | caught |
|---|---|---|---|
| control (child engages an untouched golden) | 1.00 | 0 / 200 | 100.0% |
| shipped (auto-hunt looked at it first) | 0.00 | **200 / 200** | 100.0% |

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

| | dodges the child gets | 0-dodge trials | spent by the AI first | budget left at handover |
|---|---|---|---|---|
| control | 1.00 | 0 / 200 | 0.00 | 2.00 |
| before | 0.00 | 200 / 200 | 0.00 | 2.00 |
| after (first attempt) | **0.00** | **200 / 200** | **2.00** | **0.00** |

The child still got zero dodges in 200 of 200 trials. The fix had restored the dodge and then
handed it to the wrong party: `dodgeCount` is a **lifetime** budget, not a per-encounter one, and
the auto-hunt now spent both of them before the child's finger ever touched the screen. The
outcome for the child was bit-identical to the bug.

The standing instruction is *evaluate the fix against the "suck" — fix if it suffices, otherwise
iterate.* It did not suffice. Round 3 is the iteration.

---

## Round 3 — The errand the rules forbid

*This round exists because the Round 2 fix failed its own test. It is recorded as a separate
round rather than folded into Round 2 because the failure is the most useful thing in this
document: the fix was designed by the same reasoning that wrote the charge, and only a probe run
against the changed source caught that it had moved the defect instead of removing it.*

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

The statistical case is deliberately *not* the argument here, and it is worth showing why:

| | goldens seen | auto-hunts on it | dodges spent | of a budget of |
|---|---|---|---|---|
| unattended, before Round 1 | 11.8 | 14.0 | 0.25 | 2 |
| unattended, after Round 1 | 3.3 | 0.9 | 0.25 | 2 |
| played (3.5 s), either | 6.3 | 0.0 | 0.00 | 2 |

Post-Round-1 the shark starts an auto-hunt on a golden roughly **0.9 times per three unattended
minutes, and never once during actual play**. On frequency alone this would be indefensible to
fix. But rarity is not the measure. When it does happen it costs the child the entire game of
the one prize fish in the reef, and it costs it for a hunt that the game's own rules guarantee
will be fruitless. A rare total loss for zero possible gain does not need a frequency argument.

### The fix

`consider(goldenFish);` is deleted from `maintainAutoHunt`'s candidate loop, with the deduction
recorded in the source beside it so the next reader does not restore it as an oversight.

The half of this fix that matters as much is what was *not* changed: `findFishNearTap` still
contains `consider(goldenFish);` and must. That is the tap picker. Removing the golden from the
AI's acquisition list must not remove it from the child's, or the prize fish becomes scenery.

This distinction nearly went wrong. `index.ts` holds two `consider(fish)` closures over a
`best`/`bestDistSq` pair, and the first premise written to check this fix matched the tap picker
instead of the auto-hunt and reported the wrong answer with total confidence. Both the probe and
the regression test now brace-match the function body before searching it, and both directions
are pinned: the auto-hunt must not offer the golden, and the tap picker must.

### Evaluating the fix against the charge

| | dodges the child gets | 0-dodge trials | caught | spent by the AI first | budget left |
|---|---|---|---|---|---|
| control (child engages an untouched golden) | 1.00 | 0 / 200 | 100.0% | 0.00 | 2.00 |
| before (auto-hunt looked at it first) | 0.00 | 200 / 200 | 100.0% | 0.00 | 2.00 |
| **after (auto-hunt cannot engage it at all)** | **1.00** | **0 / 200** | **100.0%** | **0.00** | **2.00** |

The auto-hunt declined the golden in 200 of 200 trials — not by the probe's choice, but because
the shipped acquisition list does not contain it, so there is no phase 1 to survive. Compared
trial by trial on the same seed, the "after" arm and the control produced **200/200 identical
dodge counts**.

A golden is now the same fish whether the shark has been near it or not. That is the whole
claim, and it is now true by construction rather than by a number landing in the right place.

**The charge is answered.** Rounds 2 and 3 together stand as fixed.

---

## What is pinned, so this cannot silently regress

`tests/minigames/little-shark-agency.test.mjs` (19 tests, part of the 364-test suite) holds the
contract: both terms of the harvest gate, the auto-hunt's provenance flag and that a tap clears
it, the cooldown being armed only for the shark's own hunts and actually gating acquisition, the
minimum acquisition range and a non-empty acquisition band, contact no longer cancelling, the
split terminal beat, the absence of `isTargeted` anywhere outside a comment, and — from Round 3
— that `maintainAutoHunt` does not consider the golden while `findFishNearTap` still does.

Rounds 4 and 5 follow.

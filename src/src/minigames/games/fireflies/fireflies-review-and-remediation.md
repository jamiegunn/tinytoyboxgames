# Fireflies — UX Review & Remediation Plan

**Date:** 2026-03-08  
**Scope:** Interaction design, fun factor, emotional alignment, UX compliance, soul adherence, sensory richness, play depth  
**Status:** Major remediation required  

---

## Executive Summary

Fireflies has the most magical premise of any game in the suite — a night garden alive with glowing lights, a child painting paths of luminance through the darkness with their fingertips — and it squanders all of it. What should feel like catching tiny falling stars in a mason jar instead feels like a clinical tap-the-dot exercise wrapped in a dark room.

The concept document promises "drag trails," "groups of lights gathering," and "calm, magical" motion. The implementation delivers: tap sphere, watch sphere arc to jar, repeat. There is no drag interaction. There are no trails the player creates. There are no gathering behaviors. There is no magic. The game has one interaction: tap a glowing ball. That's it. The exact same tap-to-catch mechanic that every other game already does, minus the personality.

Compare to Bubble Pop — same basic input mode (tap things), but Bubble Pop has: iridescent color-shifting materials, chain-pop reactions, golden burst bubbles, rainbow chain-pop bubbles, giant multi-tap bubbles, an emotional arc that escalates through calm → crescendo → shower phases, twinkling stars that pulse when you pop nearby, a moon that breathes, size-aware pop sounds, background music, a first-tap fallback sparkle, and cascading wobble chains. Bubble Pop is what happens when you take a simple tap mechanic and layer magic on top of it.

Fireflies is what happens when you implement the minimum viable interaction and ship it.

This document identifies **21 specific failures** across interaction poverty, emotional flatness, UX violations, visual sterility, audio emptiness, and engagement dead-ends. It then provides a **detailed, actionable remediation plan** organized into implementation phases that another engineer can execute without ambiguity.

---

## Part 1 — Findings

### Category A: Soul Violations (Critical)

These failures directly contradict the emotional contract defined in `soul.md`.

#### A1. Dead Taps — No First-Tap Fallback

**The problem:** Tapping empty space — the sky, the ground, the trees, the moon, the grass, the flowers, the jar — produces zero response. The `onTap` handler calls `scene.pick()`, checks for the nearest firefly within `HIT_RADIUS`, and if nothing is found, returns silently. Nothing happens. No sparkle. No ripple. No sound. Nothing.

The soul document's language on this is absolute:

> *"A dead tap is a broken promise. If a child touches the screen and nothing happens, the magic breaks."*  
> *"Every tap — whether it lands on a designated interaction or on empty space — must produce a response. A sparkle, a ripple, a soft sound."*

This is a night garden. When a child taps the dark meadow, firefly particles should bloom where they touched. When they tap the moon, it should softly pulse. When they tap the jar, it should shimmer. The darkness itself should respond to touch — that's the entire emotional promise of this scene.

Bubble Pop solved this: every missed tap creates a sparkle burst and plays a twinkle sound. This game doesn't even try.

**Severity:** Critical. Violates the foundational emotional contract.

#### A2. The World Is Not Alive — It's a Still Image

**The problem:** The environment contains: a flat ground plane, a sky gradient, three static trees, eight static grass tufts, four static flowers, a static moon, and a static jar. Nothing moves. Nothing breathes. Nothing responds. Nothing changes. The trees don't sway. The grass doesn't rustle. The flowers don't bob. The moon doesn't pulse. The jar doesn't shimmer. There are no crickets, no wind, no distant sounds, no ambient particles of any kind.

The soul document says:

> *"Ambient animations breathe at the pace of a sleeping cat."*  
> *"Motion communicates life and invitation, not urgency."*  
> *"The world waits patiently for the child to engage."*

A night garden should be the *most* atmospherically alive scene in the entire product. Fireflies drifting is not enough — that's game entities, not environment. The ground should have faint mist. The trees should gently sway. The grass should rustle as if touched by soft wind. The moon should have a gentle luminous haze. Stars should twinkle in the sky. The flowers should have faint bioluminescent pulses. The jar should glow warmly with collected light.

Compare to Bubble Pop's environment: twinkling stars, pulsing moon, caustic light animations, environmental reactions to gameplay. Compare to Elephant Splash: water ripple animations, butterfly spawning, floating toy drift. Fireflies' environment is a painted backdrop — a dead image that happens to have some spheres floating in front of it.

**Severity:** Critical. A night garden that doesn't feel alive is a fundamental betrayal of the concept.

#### A3. No Warmth in the Interaction

**The problem:** Catching a firefly produces: a brief white flash, a linear arc to the jar, and a small confetti burst. That's the entire reward loop. The flash is a technical indicator, not a moment of delight. The arc is a transit animation, not a celebration. The confetti is the same generic burst used everywhere.

The soul says:

> *"When the world feels tactile, the child reaches out and touches."*  
> *"Fireflies leave trails of golden light."* (This is literally in the soul's opening imagery.)

When a child catches a firefly, it should feel like holding a tiny star. The light should linger on their fingertip. The firefly should spiral gently in a celebratory dance before drifting to the jar. The jar should visibly brighten with each addition, building a warm, growing lantern. Nearby fireflies should be attracted to the glow, creating a momentary gathering. The entire scene should get fractionally warmer and brighter — the child is literally filling the night with light.

Instead, the firefly freezes white, teleports along an arc, and vanishes. It's a deletion animation, not a celebration.

**Severity:** Critical. The moment of catch — the entire point of the game — feels empty.

---

### Category B: Interaction Poverty (Critical)

These issues render the game boring, one-dimensional, and absent of the depth promised by the concept.

#### B1. The Concept's Core Mechanic — Drag Trails — Is Not Implemented

**The problem:** The concept document says:

> *"Dragging through the air suggests a path for nearby lights."*

This is the game's signature mechanic. No other game in the suite does this. It transforms fireflies from "tap-the-dot" into a unique, expressive, magical interaction where the child paints with light.

The implementation has no `onDrag` handler. No `onDragEnd` handler. No drag trail rendering. No guide-path behavior. The most interesting and differentiating mechanic in the concept was simply... not built.

The manifest entry (`MiniGameManifest.ts`) should list `inputModes: ['tap', 'drag']` for this game. Currently, without `onDrag`/`onDragEnd` handlers, the framework won't deliver drag events even if the manifest says 'drag'.

**Severity:** Critical. The game's unique identity was amputated.

#### B2. No Gathering Behavior

**The problem:** The concept document says:

> *"Groups of lights gather briefly and then drift apart again."*

This suggests emergent, flocking behavior — fireflies that are attracted to each other, to the player's touch, or to light sources. Brief clusters that form and dissolve organically, creating moments of beauty that the child witnesses and participates in.

The implementation has each firefly drifting independently with sinusoidal oscillation. They never interact with each other. They never cluster. They never flock. They are completely isolated particles moving in independent sine waves. There is zero emergent behavior.

**Severity:** High. The concept's emotional centerpiece — witnessing and causing gatherings of light — doesn't exist.

#### B3. One Interaction, No Variation

**The problem:** The game has exactly one thing to do: tap a firefly. Every firefly behaves identically (the golden firefly is just worth more points). Every catch plays the same animation. Every respawn is the same. There are no surprise events, no environmental discoveries, no evolving behaviors, no "oh!" moments.

Compare to Bubble Pop: 4 bubble types (normal, golden, rainbow, giant), each with unique mechanics. Chain-pop cascading. Shower spawn events. Emotional arc phases. Moon pulses. Star twinkles. A child playing Bubble Pop for 3 minutes encounters roughly 8 distinct types of "things that happen." A child playing Fireflies for 3 minutes encounters 1.

**Severity:** Critical. The game has no replay depth. A child will be bored in 30 seconds.

#### B4. No Environmental Interactivity

**The problem:** The environment has trees, grass, flowers, a moon, and a jar. None of them are interactive. The trees could rustle and release hidden fireflies. The flowers could glow when tapped. The moon could create a beam of light that attracts fireflies. The jar could be tapped to release a burst of stored light. The grass could have hidden crickets or tiny creatures that peek out.

Every tappable environmental element is a free delight. Other games use this: Elephant Splash has tappable toys, tappable elephant, tappable water. Bubble Pop has stars that react to nearby pops. Even Hide and Seek has rustling bushes when you tap empty spots.

Fireflies has a rich environment with zero interactivity.

**Severity:** High. Missed delight opportunities everywhere.

---

### Category C: UX Spec Violations

These failures violate specific requirements in the age-appropriate UX spec or the product and UX spec.

#### C1. Firefly Hit Targets May Be Too Small on Mobile

**The problem:** Each firefly is a sphere with `diameter: 0.3` (radius 0.15) for standard, `0.6` for golden. The `HIT_RADIUS` is a generous 1.5 scene units, which provides adequate touch area, but the *visual* size of the firefly is tiny — a 0.3 unit sphere at a camera distance of 9.0 units with FOV 0.9 will project to roughly 12-15 CSS pixels on a 375px mobile viewport.

The UX spec (§5.1) says:

> *"All interactive elements across all mini-games must meet a minimum effective hit area of 48 x 48 CSS pixels."*

The hit detection radius is generous (1.5 units), which technically creates a large enough interaction zone. But the *visual feedback* is too small — a child can't see what they're supposed to tap. The glow trail helps, but the core mesh is tiny. A 3-year-old looking at a dark screen with small moving dots won't understand what to do.

**Severity:** Medium-High. The interaction zone is technically adequate but the visual affordance fails.

#### C2. No `onResize` Implementation

**The problem:** The `onResize` method is empty with a comment: "Camera FOV and positioning are fixed; no resize adjustments needed." The UX spec (§5.2) requires:

> *"During `onResize()`, project each entity's bounding sphere to screen space. If the projected diameter falls below 48 px, scale the entity's hit radius multiplier until it meets the minimum."*

This is not optional. Orientation changes and viewport resizes happen on mobile constantly. The game must verify hit target adequacy on every resize.

**Severity:** Medium. Spec violation.

#### C3. No Score Icon Prefix

**The problem:** The UX spec (§4.3) says:

> *"Each game may display a small thematic icon before the number to give the number contextual meaning for pre-literate children."*

The game uses the score system but provides no thematic icon. A firefly or jar icon next to the score number would help pre-literate children understand "this number counts my fireflies."

**Severity:** Low-Medium. Guideline, not hard requirement.

#### C4. No Difficulty Controller Integration

**The problem:** The game has its own `getDifficultyTier()` function that hardcodes tiers based on raw score. `context.difficulty` (the shared `DifficultyController`) is never used. This means the game doesn't benefit from the framework's unified difficulty curve, doesn't participate in cross-game difficulty normalization, and duplicates tier logic that exists in the shared system.

**Severity:** Medium. Architectural misalignment.

#### C5. No SpawnScheduler Integration

**The problem:** `context.spawner` is never used. Fireflies appear at fixed locations with simple respawn timers. The shared `SpawnScheduler` provides rhythm-based spawning, wave patterns, and difficulty-scaled intervals that create flow and pacing. Without it, fireflies just... appear randomly.

**Severity:** Medium. Missed pacing opportunity.

---

### Category D: Audio Emptiness

These issues render the game sonically dead in a scene that should be acoustically magical.

#### D1. No Ambient Audio

**The problem:** A night garden should sound like a night garden. Soft cricket chirps. Distant frog croaks. The whisper of wind through grass. A faint, dreamy melody. The game has zero ambient audio. The only sounds are the catch celebrations (chime + confetti pop). Between catches, the game is silent.

The soul says:

> *"Rustles that sound like tiny creatures moving."*  
> *"Music that feels like a lullaby hummed by a caring presence."*

**Severity:** High. Audio is a primary atmosphere lever and it's completely absent.

#### D2. No Background Music

**The problem:** Of all 12 games, Fireflies is perhaps the one that most desperately needs background music. A gentle, dreamy lullaby — arpeggiated chimes over a warm pad, with pentatonic melodic fragments — would transform the emotional character of the scene entirely. Bubble Pop has background music. Fireflies — the most atmospheric, mood-dependent game in the suite — does not.

**Severity:** High. The game is playing in silence.

#### D3. No Interaction Sound Feedback

**The problem:** The catch sequence produces a celebration `'chime'` sound. But:
- Tapping empty space produces no sound
- A firefly pulsing near you produces no sound
- The golden firefly appearing produces no sound
- Fireflies drifting near each other produce no sound
- The jar gaining light produces no sound
- The milestone celebration relies solely on the shared celebration system

Each firefly should have a faint, unique pitch. When they drift close, their pitches should harmonize. When you catch one, its pitch should ring out brightly. When the jar fills, it should hum. The soundscape should be reactive and alive, not silent with occasional chimes.

**Severity:** High. Massive missed opportunity for a uniquely musical game.

#### D4. No Firefly "Voice"

**The problem:** Each firefly is sonically identical. In a truly magical version of this game, each firefly would carry a faint musical tone — a different note in a pentatonic scale. Catching fireflies would build a chord. Groups gathering would create momentary harmonies. The jar would hum with the accumulated notes. The game would, without any deliberate composition, generate music through play.

This is the kind of design that makes Steve Jobs promote people.

**Severity:** High. This is the single biggest missed creative opportunity in the entire product.

---

### Category E: Visual and Atmospheric Failures

These issues render the scene flat, dark, and devoid of the "cinematic polish" required by the art direction spec.

#### E1. The Night Sky Is a Flat Gradient

**The problem:** The sky is a `buildSkyGradient()` call — a flat plane with a dark blue gradient. No stars. No clouds. No atmospheric depth. The moon is a bare sphere with emissive material — no halo, no glow, no moonbeams, no volumetric light.

A night sky in a children's storybook has: twinkling stars of various sizes, a moon with a soft halo, perhaps faint wisps of cloud drifting across, maybe constellations that form friendly shapes. Bubble Pop has twinkling stars. Fireflies — the game that takes place under the night sky — has none.

**Severity:** High. The sky is half the viewport and it's empty.

#### E2. No Mist or Atmospheric Particles

**The problem:** A night meadow has ground mist. Faint, luminous wisps that drift at ankle height, catching the moonlight. This is standard atmosphere for any nighttime scene. It adds depth, mood, and the sense that the air itself is alive.

The particle system infrastructure exists (the game already creates `createFireflyGlow` trails). Adding low-lying mist particles is straightforward and would dramatically improve atmosphere.

**Severity:** Medium. Atmospheric depth is a primary fidelity lever.

#### E3. The Jar Doesn't Tell a Story

**The problem:** The jar is the game's emotional anchor — the tangible result of the child's play. As they catch fireflies, the jar should transform from a dark, empty vessel into a glowing lantern that illuminates the entire scene. It should be the most visually interesting object in the scene.

Current implementation: the jar's emissive color slightly increases based on `collectedCount / MILESTONE_COUNT`. The jar itself is a `CreateCylinder` with a glass material. No internal glow particles. No visible fireflies inside. No light cast onto the surrounding environment. No warmth radiating outward.

The jar should have point lights inside that grow brighter. Tiny firefly particle sprites should be visible through the glass, bobbing gently. The jar's glow should cast warm light on the nearby ground and grass. At milestone counts, the jar should pulse with radiance, briefly illuminating the entire garden.

**Severity:** High. The jar is the emotional arc of the game and it's nearly invisible.

#### E4. The Catch Animation Has No Grace

**The problem:** When caught, a firefly: flashes white for 0.2s (harsh, clinical), then linearly arcs to the jar over 0.6s with a parabolic height offset. It then vanishes (`setEnabled(false)`).

This should be one of the most beautiful moments in the entire product. The firefly should spiral gently, leaving a luminous trail. It should drift toward the jar in a lazy spiral, not a ballistic arc. As it approaches the jar, it should shrink and brighten. When it enters the jar, there should be a soft pulse from inside the glass. The trail should linger for a moment, then fade like a comet's tail.

Instead, it teleports along a math curve and disappears.

**Severity:** High. This is the core "delight moment" and it's flat.

#### E5. Firefly Glow Lacks Warmth

**The problem:** The firefly color is `#AAFF44` — a bright chartreuse green. Real-world fireflies glow in warm yellows and ambers. The chosen green is technically accurate for some species but feels cold and artificial in the context of a warm, cozy children's experience.

The art direction spec says:

> *"Lighting is warm, not harsh."*  
> *"Emotional clarity. Every scene should communicate its mood within the first second: cozy, playful, magical, safe."*

A warm amber-gold (`#FFD35C` or similar) would read as magical and warm. The current green reads as "LED indicator."

**Severity:** Medium. Color palette affects emotional tone.

---

### Category F: Engagement Dead-Ends

#### F1. No Emotional Arc

**The problem:** Bubble Pop has an emotional arc: calm → crescendo → shower → calm. The pace changes. The density changes. The rewards escalate. Events happen. The game breathes.

Fireflies is a flat line. Minute 1 and minute 5 are identical except there are slightly more fireflies drifting slightly faster. There's no crescendo, no climax, no breathing, no surprise, no "oh, something new happened!" moment.

**Severity:** High. No arc means no engagement curve means no retention.

#### F2. The Golden Firefly Is Underwhelming

**The problem:** The golden firefly is the game's only surprise mechanic. It appears every 25 seconds after score reaches 10. It is visually just a larger, yellow version of a regular firefly. It is worth 5 points instead of 1. That's it.

A golden firefly should be an *event*. It should arrive with a faint chiming sound. Other fireflies should turn to look at it. It should leave a more prominent trail. Catching it should trigger a special celebration — maybe all fireflies briefly cluster around the jar, or the jar pulses with golden light, or a shower of tiny stars rains down. It should feel like finding a treasure, not like tapping a yellow dot instead of a green one.

**Severity:** Medium-High. The only variety mechanic is bland.

#### F3. The Milestone Is Anticlimactic

**The problem:** The milestone triggers at `MILESTONE_COUNT = 25` collected fireflies. It calls `context.celebration.milestone()` at screen center. That's it. One celebration event for reaching 25. The jar doesn't do anything special. The garden doesn't change. It's over in half a second.

At 25 fireflies, the jar should be blazing. The garden should be visibly brighter. Perhaps a constellation appears briefly in the sky. Perhaps all fireflies in the scene swirl together in a spiral dance. Perhaps the moon brightens and moonbeams sweep across the meadow. The milestone should be a *scene transformation*, not a single particle burst.

**Severity:** High. The payoff for sustained play is negligible.

#### F4. No Progressive Scene Transformation

**The problem:** As the child catches fireflies, nothing changes in the world. The ground stays dark. The sky stays empty. The trees stay black. The jar barely brightens. The game provides zero sense of "I'm making a difference." The child is not transforming the garden — they're just incrementing a counter.

The most powerful version of this game would progressively illuminate the garden. At 5 fireflies, faint bioluminescent dots appear on the ground. At 10, the flowers begin to glow softly. At 15, the tree canopies develop faint luminous edges. At 20, the grass shimmers. At 25, the entire garden is a warm, glowing wonderland — transformed from dark meadow to magical garden by the child's actions.

This is the narrative arc. This is the "story" the child tells by playing. Without it, the game is purposeless.

**Severity:** Critical. This is THE fix that transforms the game from forgettable to magical.

---

## Part 2 — Remediation Plan

### Implementation Philosophy

This plan transforms Fireflies from a repetitive tap-the-dot exercise into a magical nighttime garden where a child paints light, gathers glowing creatures, and progressively illuminates an entire world through the simple act of touching the screen.

The target experience: **a child drags their finger through a dark garden, leaving a trail of golden light. Fireflies are drawn to the trail. The child taps to catch them, and each one adds warmth and light to a glass jar. As the jar fills, the garden itself awakens — flowers glow, mist shimmers, stars appear, and the night becomes enchanted. Every tap, every drag, every moment produces beauty.**

Each task below includes the exact file(s) to modify, the specific change to make, implementation details, and enough context for another engineer to implement without ambiguity.

---

### Phase 1: Soul & Safety Fixes (Do First — These Are Critical)

#### Task 1.1: Add First-Tap Fallback for Empty Space

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** `onTap` method, after the `if (!nearestFd) return;` early return  
**Current behavior:** Returns silently when no firefly is within hit radius.

**Change:** Replace the early return with a fallback effect:

```typescript
if (!nearestFd) {
  // First-tap fallback: every tap produces golden sparkles and a soft chime
  const fallbackPos = pickResult.pickedPoint ?? new Vector3(
    (event.screenX / context.viewport.width - 0.5) * 10,
    (1.0 - event.screenY / context.viewport.height) * 6,
    0,
  );
  createSparkleBurst(scene, fallbackPos, new Color3(1.0, 0.9, 0.5), 8);
  context.celebration.celebrationSound('chime');
  return;
}
```

**Also add:** If `pickResult.pickedMesh` is the moon, trigger a special moon pulse effect (see Task 3.5). If it's a flower, trigger a flower glow pulse (see Task 3.6).

**Rationale:** The soul document mandates every tap produces a response. In a night garden, the response should be light blooming where you touched — like pressing a finger against a window and watching condensation glow.

---

#### Task 1.2: Add Environmental Tap Responses

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** `onTap` method, within the no-firefly-hit branch

**Change:** Before the generic fallback, check `pickResult.pickedMesh?.name` for specific environmental meshes:

| Mesh name pattern | Response |
|---|---|
| `nature_moon` | Moon pulse: scale to 1.1× over 200ms, increase emissive to white for 300ms, scale back. Emit 20 tiny star particles radially. Play a soft, high-pitched tone. |
| `nature_jar_body` or `nature_jar_cap` | Jar shimmer: pulse emissive brightness +50% for 400ms. If `collectedCount > 0`, emit tiny firefly-colored particles inside the jar (3-5 particles, confined to jar bounds). Play a soft glass "ting" sound. |
| `meadow_floor` | Ground glow: Create a brief emissive decal/particle ring at the tap point (warm gold, ~1.0 radius, fades over 0.8s). As if bioluminescent moss responds to touch. |
| Flower mesh names | Flower pulse: Scale flower to 1.15× and back over 400ms. Increase petal emissive for 500ms. Emit 3-5 tiny pollen particles. |
| Tree mesh names | Tree rustle: Subtle shake animation (position.x ±0.05 over 300ms, two oscillations). 1-2 firefly-sized particles fall from the canopy. |

**Implementation:** Add mesh name checks in the `onTap` handler. Each response should be a small helper function in `helpers.ts` or a new `interactions.ts` file.

**Rationale:** Every environmental element should respond to touch. This is a night garden — everything should seem alive and responsive.

---

### Phase 2: The Signature Mechanic — Drag Trails

#### Task 2.1: Add Drag Trail Rendering

**File:** `src/src/minigames/games/fireflies/index.ts`  
**New methods:** `onDrag(event: MiniGameDragEvent)` and `onDragEnd(event: MiniGameDragEndEvent)`

**File:** `src/src/minigames/games/fireflies/types.ts`  
**New data:** Trail point buffer type

**Implementation:**

1. **Trail data structure:** Add a circular buffer of trail points (max 30 points). Each point stores `{ position: Vector3, age: number, intensity: number }`.

2. **`onDrag` handler:**
   - Unproject `event.screenX`/`event.screenY` onto a plane at z=0 (or use `scene.pick` to find the world-space position).
   - Push the world-space position into the trail buffer with `age = 0`, `intensity = 1.0`.
   - At the drag position, emit 2-3 warm golden particles (`createSparkleBurst` with 2-3 count, warm amber color) per drag event (throttled to every ~50ms via distance check: only add a point if distance from last point > 0.3 units).
   - Play a very faint, soft, continuous sparkle sound (or trigger a per-point sparkle micro-sound at very low volume).

3. **Trail rendering in `update`:**
   - Each frame, age all trail points by `deltaTime`.
   - Remove points older than 3.0 seconds.
   - For each active trail point, maintain a small emissive sphere (pooled, ~0.1 radius, warm gold material, alpha = `1.0 - age/3.0`). These form the visible trail.
   - Alternative: Use a `Ribbon` mesh or a `TrailMesh` attached to an invisible emitter that follows the drag path. This would create a smooth, glowing ribbon of light. The `TrailMesh` from `@babylonjs/core` is ideal here.

4. **`onDragEnd` handler:**
   - Mark the trail as "releasing" — points continue to age and fade but no new points are added.
   - Optional: On release, emit a final burst of sparkle particles along the trail path.

5. **Manifest update:** In `MiniGameManifest.ts`, ensure the fireflies entry includes `inputModes: ['tap', 'drag']`.

**Visual target:** The trail should look like a child painting with liquid moonlight. Warm gold, softly glowing, gently fading. Not a hard geometric line — a luminous, slightly irregular ribbon of particles that lingers and dissolves.

---

#### Task 2.2: Firefly Attraction to Drag Trails

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** `update` method, in the normal drift movement section

**Implementation:**

1. For each active, non-catching firefly, check distance to the nearest active trail point (points younger than 2.0 seconds).
2. If a trail point is within **attraction radius** (3.0 scene units):
   - Add a gentle force vector toward the nearest trail point: `attractionForce = normalize(trailPoint - fireflyPos) * attraction_strength * (1.0 - distance/3.0)`.
   - `attraction_strength = 0.02` (very gentle — the firefly should drift toward the trail, not snap to it).
   - The firefly's glow should intensify slightly when attracted (emissive × 1.2).
3. If 3+ fireflies are within 2.0 units of each other (whether because of trail attraction or natural drift), trigger a brief **gathering shimmer**: all nearby fireflies pulse brighter for 0.5s and emit a soft harmonic chime. This is the "groups of lights gather briefly" behavior from the concept.

**Tuning:** The attraction should feel organic, not mechanical. Fireflies should meander toward the trail as if curious, not beeline. Add slight random perpendicular offset to the attraction vector (±15% of the attraction magnitude as a perpendicular component).

**Rationale:** This is the concept's core mechanic: "Dragging through the air suggests a path for nearby lights." The child paints a path of light, and the fireflies are drawn to it. This is magical. This is the game.

---

#### Task 2.3: Trail-Based Catch Mechanic (Bonus)

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** `update` method

**Implementation:** When a firefly drifts within 0.5 units of an active trail point (attracted by the trail), it should have a 30% chance per second of being "charmed" — entering a catch state where it follows the trail path toward the jar. This provides an alternative catch method beyond tapping: the child can paint a path from the firefly to the jar.

If a charmed firefly reaches within 1.5 units of the jar, it automatically enters the catch arc animation.

**Scoring:** Trail-charmed catches award 2 points instead of 1 (rewarding the more expressive input method). A combo window of 3 seconds applies across both tap and trail catches.

**Rationale:** This creates mastery depth. Young children will tap. Older children will discover they can paint paths to guide fireflies to the jar. Expert players will paint sweeping trails that charm multiple fireflies at once.

---

### Phase 3: Atmospheric Transformation — Making the Garden Alive

#### Task 3.1: Add Twinkling Stars to the Night Sky

**File:** `src/src/minigames/games/fireflies/environment.ts`  
**Location:** After sky mesh creation

**Implementation:**

1. Create 30-40 tiny emissive spheres (diameter 0.04-0.1, random) scattered across the sky backdrop, at z positions between -9 and -10 (behind the sky gradient plane but with brighter emissive to show through, or placed just in front at z = -9.5).
2. Each star gets: random position in upper 60% of sky area, random `twinklePhase` and `twinkleSpeed` (0.5 - 2.0).
3. In the `update` loop, pulse each star's emissive intensity: `intensity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(elapsedTime * twinkleSpeed + twinklePhase))`.
4. Stars should use a shared `PBRMetallicRoughnessMaterial` with `emissiveColor` set to a warm white-gold.
5. Every ~15 seconds, one random star should do a "shooting star" animation: a brief bright streak (trail mesh or particle line) across a small arc of the sky, lasting 0.4 seconds.

**Store star data:** Add a `StarData` interface to `types.ts`: `{ mesh: Mesh, twinklePhase: number, twinkleSpeed: number }`. Return the star array from `createEnvironment`.

---

#### Task 3.2: Add Ground Mist Particle System

**File:** `src/src/minigames/games/fireflies/environment.ts` (exported) or `index.ts` (managed in update loop)  
**Location:** After environment creation in `setup`

**Implementation:**

1. Create a `ParticleSystem` with 40-60 particles.
2. Emitter: a box emitter spanning the ground area (x: -6 to 6, y: 0 to 0.3, z: -2 to 2).
3. Particle lifetime: 4-8 seconds.
4. Particle size: 1.5 to 3.0 (large, soft, diffuse).
5. Particle color: `Color4(0.6, 0.7, 0.9, 0.08)` → `Color4(0.7, 0.8, 1.0, 0.0)`. Extremely low alpha — barely visible, atmospheric.
6. Particle velocity: very low horizontal drift (x: -0.05 to 0.05, y: 0.01 to 0.05, z: -0.02 to 0.02).
7. Use the circle texture from the shared `particleFx.ts` helpers.
8. Blend mode: additive (so it glows softly against the dark ground).
9. Emit rate: 8-10 particles/second.

**Rationale:** Ground mist is the single cheapest atmospheric element that transforms a flat ground plane into a living meadow. It adds depth, softness, and mystery.

---

#### Task 3.3: Add Ambient Tree Sway

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** `update` method, new section after firefly updates

**Implementation:**

1. Store references to tree meshes (returned from `createEnvironment`).
2. Each frame, apply gentle sinusoidal rotation to each tree: `tree.rotation.z = 0.02 * Math.sin(elapsedTime * 0.3 + treeIndex * 1.5)`.
3. Amplitude is very small (0.02 radians ≈ 1.1°) — barely perceptible but enough to feel alive.

---

#### Task 3.4: Add Ambient Grass Movement

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** `update` method, alongside tree sway

**Implementation:**

1. Store references to grass tuft meshes.
2. Each frame: `tuft.rotation.z = 0.03 * Math.sin(elapsedTime * 0.5 + tuffIndex * 2.0)`.
3. Also add gentle y-scale pulsing: `tuft.scaling.y = 1.0 + 0.02 * Math.sin(elapsedTime * 0.4 + tuffIndex)`.

---

#### Task 3.5: Moon Glow Halo and Pulse

**File:** `src/src/minigames/games/fireflies/environment.ts`  
**Location:** After moon mesh creation

**Implementation:**

1. Create a larger, transparent sphere behind the moon (diameter 3.0, alpha 0.15) with warm white emissive. This is the moon's halo/glow.
2. In the `update` loop, gently pulse the halo's alpha: `haloAlpha = 0.12 + 0.04 * Math.sin(elapsedTime * 0.2)`.
3. The moon tap response (Task 1.2) should scale this halo to 1.3× briefly and brighten it.

**Add moon data:** Return moon halo mesh reference from environment.

---

#### Task 3.6: Flower Bioluminescence

**File:** `src/src/minigames/games/fireflies/environment.ts`  
**Location:** In flower creation loop

**Implementation:**

1. Give each flower a faint emissive color (10-15% intensity of its base petal color).
2. In the `update` loop, pulse each flower's emissive in a slow, offset sine wave: `flower.material.emissiveColor = baseEmissive.scale(0.5 + 0.5 * Math.sin(elapsedTime * 0.4 + flowerPhase))`.
3. When tapped (Task 1.2), surge the emissive to 100% for 0.5s, then decay back to idle pulse.

**Store flower data:** Add flower references with `emissivePhase` to the environment return type.

---

### Phase 4: Progressive Scene Illumination — The Narrative Arc

This is the single most important remediation. It transforms the game from purposeless tapping into a story: **the child fills the garden with light.**

#### Task 4.1: Define Illumination Tiers

**File:** `src/src/minigames/games/fireflies/types.ts`  
**New constant:**

```typescript
export const ILLUMINATION_TIERS = [
  { threshold: 0,  name: 'dark',       groundEmissive: 0.0,  skyBrightness: 0.0,  starCount: 5,  mistAlpha: 0.04, flowerGlow: 0.0,  treeEdge: 0.0  },
  { threshold: 3,  name: 'dim',        groundEmissive: 0.01, skyBrightness: 0.02, starCount: 10, mistAlpha: 0.05, flowerGlow: 0.05, treeEdge: 0.0  },
  { threshold: 8,  name: 'awakening',  groundEmissive: 0.03, skyBrightness: 0.05, starCount: 18, mistAlpha: 0.06, flowerGlow: 0.15, treeEdge: 0.02 },
  { threshold: 15, name: 'glowing',    groundEmissive: 0.06, skyBrightness: 0.08, starCount: 28, mistAlpha: 0.07, flowerGlow: 0.3,  treeEdge: 0.05 },
  { threshold: 22, name: 'radiant',    groundEmissive: 0.10, skyBrightness: 0.12, starCount: 40, mistAlpha: 0.08, flowerGlow: 0.5,  treeEdge: 0.1  },
  { threshold: 30, name: 'enchanted',  groundEmissive: 0.15, skyBrightness: 0.15, starCount: 50, mistAlpha: 0.10, flowerGlow: 0.7,  treeEdge: 0.15 },
] as const;
```

#### Task 4.2: Implement Progressive Illumination System

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** New function called on every catch, and smoothly interpolated in `update`

**Implementation:**

1. Track `currentTier` index and `targetTier` index based on `collectedCount`.
2. When a catch increments `collectedCount` past a tier threshold, begin transitioning to the new tier.
3. The transition happens over 2.0 seconds (smooth interpolation, not instant):
   - **Ground emissive:** Lerp the ground material's emissive from current to target. The ground subtly glows warmer as more fireflies are caught.
   - **Sky brightness:** Lerp the sky gradient's colors toward slightly brighter values. Not daylight — just less pure black. More "deep twilight" than "midnight."
   - **Star visibility:** Progressively enable star meshes. Start with 5 barely visible stars. At max tier, 50 stars are twinkling.
   - **Mist alpha:** Slightly increase mist visibility. The mist catches more light as the scene brightens.
   - **Flower glow:** Increase flower emissive intensity. Flowers "wake up" as the garden fills with light.
   - **Tree edge glow:** Add faint emissive edges to tree canopy materials. As if the collected light is leaking into the foliage.
4. On each tier transition, play a unique "tier-up" chime sound — a soft, ascending tone. Each tier's tone should be higher than the last, building a progression.

**Visual intent:** The child starts in a dark meadow with a few lonely fireflies. As they play, the garden slowly comes alive with their collected light. By the end, they've transformed a dark, quiet field into a glowing fairy garden. This is the story. This is the reason to keep playing.

---

#### Task 4.3: Enhanced Jar Visual Feedback

**File:** `src/src/minigames/games/fireflies/index.ts` and `environment.ts`  

**Implementation:**

1. **Interior glow light:** Add a `PointLight` inside the jar (position at jar center). Initial intensity 0. As `collectedCount` increases, intensity increases: `jarLight.intensity = Math.min(collectedCount / 30, 1.0) * 0.8`. Range: 4.0. Color: warm amber `Color3(1.0, 0.85, 0.5)`. This light illuminates the ground, grass, and nearby elements — the jar becomes a lantern.

2. **Internal firefly particles:** Create a `ParticleSystem` attached to the jar mesh with:
   - Emitter: small box inside jar bounds (0.3 × 0.8 × 0.3).
   - Particle count: `collectedCount * 2` (capped at 50).
   - Particle size: 0.03 - 0.08.
   - Particle color: warm amber to gold, alpha 0.4 - 0.8.
   - Particle velocity: very gentle random drift (confined, as if trapped in the jar).
   - Lifetime: 1.5 - 3.0 seconds.
   - Update emit rate when `collectedCount` changes.

3. **Jar glass tint:** As `collectedCount` increases, shift the jar material's base color from cool glass blue (`Color3(0.6, 0.8, 0.9)`) toward warm amber (`Color3(0.9, 0.8, 0.5)`). Lerp based on `collectedCount / 30`.

4. **Catch arrival pulse:** When a firefly's arc reaches the jar (catch complete), pulse the jar's emissive to 200% for 0.3s, then decay back. Also pulse the interior `PointLight` to 150% for 0.3s. This creates a visible "absorption" moment.

---

#### Task 4.4: Milestone Celebrations per Tier

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** Replace the single milestone check with per-tier milestone events

**Implementation:**

Instead of one milestone at 25, trigger a celebration at each illumination tier transition:

| Tier | Threshold | Celebration |
|---|---|---|
| `dim` | 3 | Soft sparkle burst at jar. 3 stars appear in sky. Gentle ascending chime. |
| `awakening` | 8 | Flowers begin to glow. Ground mist brightens. Medium confetti at jar. Two-note ascending chime. |
| `glowing` | 15 | Tree edges begin to glow. All active fireflies swirl briefly toward the jar then return to their paths (1.5-second gathering). Three-note ascending chime. `context.celebration.confetti()` at screen center, 'medium'. |
| `radiant` | 22 | A shooting star crosses the sky. Moon halo brightens. Jar casts visible light pool on ground. Four-note ascending chime. `context.celebration.confetti()` at screen center, 'medium'. |
| `enchanted` | 30 | Full milestone: `context.celebration.milestone()` at screen center, 'large'. All fireflies in scene perform a spiral dance around the jar for 3 seconds. The entire garden pulses with warm golden light. Five-note ascending arpeggio (pentatonic). The sky gains a faint aurora shimmer at the top edge. |

Each tier transition should feel earned, magical, and surprising. The child should gasp.

---

### Phase 5: Audio Landscape

#### Task 5.1: Background Music — Night Garden Lullaby

**File:** New file `src/src/minigames/games/fireflies/audio.ts`  
**Integration:** Play on game `start()`, stop on `teardown()`.

**Implementation:**

Create a procedural ambient music generator using Web Audio API:

1. **Base pad:** A warm, sustained chord played with a soft sawtooth oscillator through a low-pass filter (cutoff ~800Hz). Chord: pentatonic root + fifth (e.g., C4 + G4), with very slow LFO on filter cutoff for gentle movement. Volume: -24 dB (barely there).

2. **Arpeggiated chimes:** Every 2-4 seconds (random interval), play a single pentatonic note using a triangle oscillator with a short attack (10ms) and long release (2s). Notes: C5, D5, E5, G5, A5. Random selection. Volume: -18 dB. Pan: random L/R within ±0.3.

3. **As `collectedCount` increases:** Gradually increase the base pad cutoff frequency (800 → 1600 Hz) and add a second pad voice a major third above. The music gets gently warmer and richer as the garden fills with light.

4. **On tier transitions:** Brief melodic ascent — play the current tier's note (one note per tier in the pentatonic scale: C, D, E, G, A) with a brighter timbre (shorter LP filter envelope) and slightly louder volume.

**Rationale:** The music should feel like it's emerging from the garden itself — not a composed track but natural, ambient, generative tones that shift with the player's progress.

---

#### Task 5.2: Ambient Night Sounds

**File:** `src/src/minigames/games/fireflies/audio.ts`  
**Integration:** Start in `setup()` or `start()`, stop in `teardown()`.

**Implementation:**

1. **Cricket chirps:** Every 0.8-2.0 seconds (random), play a brief burst of 2-4 quick triangle oscillator pulses at ~4000 Hz (very short attack/release, ~20ms each, with ~50ms gaps). Pan: random. Volume: -26 dB. This mimics a simple cricket chirp.

2. **Occasional owl hoot:** Every 20-40 seconds, play two low-frequency sine tones (~300 Hz, then ~250 Hz) with 200ms attack and 800ms release. Very soft (-28 dB). This is a gentle, distant owl — not the companion owl, but ambient wildlife.

3. **Gentle wind:** Continuous filtered white noise at very low volume (-30 dB), through a bandpass filter at 200-500 Hz with slow LFO on the center frequency. Creates a faint, warm wind presence.

---

#### Task 5.3: Firefly Musical Tones

**File:** `src/src/minigames/games/fireflies/audio.ts`  
**Integration:** Called from entity creation and catch events.

**Implementation:**

1. **Assign each firefly a pitch:** From the pentatonic scale (C4=261.6, D4=293.7, E4=329.6, G4=392.0, A4=440.0). Assign randomly on creation. Store as `pitch: number` in `FireflyData`.

2. **Proximity hum:** When a firefly is within 3.0 units of the camera center (player's attention area), play a faint sustained sine tone at its assigned pitch. Volume scales with proximity: `volume = -24 - (distance / 3.0) * 12` dB. This creates a natural chord as multiple fireflies drift near the center.

3. **Catch tone:** On catch, play the firefly's pitch as a bright, bell-like tone (sine + slight frequency vibrato) with 50ms attack, 100ms sustain, 1.5s release. Volume: -12 dB (clearly audible). This creates a satisfying "ding" at a pitch that matches the firefly's hum.

4. **Gathering harmony:** When 3+ fireflies are within 2.0 units of each other (gathering behavior from Task 2.2), play their pitches simultaneously as a chord for 1 second. This creates accidental music — the game generates harmonies through play.

5. **Jar accumulation hum:** The jar emits a continuous, very soft hum at the root note (C4). As `collectedCount` increases, add harmonics: at 8, add the fifth (G4). At 15, add the major third (E4). At 22, add the octave (C5). The jar literally sings with accumulated light.

**Add field to `FireflyData`:** `pitch: number` in `types.ts`.

---

### Phase 6: Enhanced Catch Choreography

#### Task 6.1: Spiral Catch Animation

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** Replace the linear arc in the catch animation section of `update`

**Current:** Linear lerp with parabolic height: `Vector3.Lerp(startPos, JAR_POS, t)` + `arcHeight`.

**New implementation:**

```typescript
// Spiral catch path
const t = fd.catchProgress;
const easeT = t * t * (3 - 2 * t); // smoothstep easing
const spiralAngle = t * Math.PI * 3; // 1.5 full rotations
const spiralRadius = (1.0 - easeT) * 1.2; // shrinking spiral
const basePos = Vector3.Lerp(fd.catchStartPos, JAR_POS.add(new Vector3(0, 1.0, 0)), easeT);
basePos.x += Math.cos(spiralAngle) * spiralRadius;
basePos.z += Math.sin(spiralAngle) * spiralRadius;
basePos.y += Math.sin(t * Math.PI) * 1.5 * (1.0 - t); // upward arc that flattens toward end
fd.mesh.position.copyFrom(basePos);
fd.light.position.copyFrom(basePos);
```

**Duration:** Increase `ARC_DURATION` from 0.6 to 1.2 seconds. The spiral should feel graceful, not rushed.

**Trail during arc:** Keep the `glowTrail` particle system running during the catch arc (currently it's stopped). The trail creates a beautiful spiral of particles as the firefly corkscrews toward the jar.

**Scaling:** During the arc, scale the firefly mesh from 1.0 to 0.5 (shrinking as it approaches the jar). Increase emissive brightness from 1.0 to 2.0 (brightening as it concentrates).

---

#### Task 6.2: Remove Harsh White Flash

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** Flash phase handling in `update`

**Current:** On catch, firefly flashes pure white (`Color3.White()`) at intensity 1.5 for 0.2s. This is harsh and clinical.

**Replace with:** A warm golden bloom. Instead of snapping to white:

```typescript
// Warm catch bloom instead of harsh white flash
const flashProgress = 1.0 - (fd.flashTimer / FLASH_DURATION);
const bloomColor = Color3.Lerp(
  fd.isGolden ? GOLDEN_COLOR : FIREFLY_COLOR,
  new Color3(1.0, 0.95, 0.8), // warm white, not pure white
  flashProgress,
);
fd.material.emissiveColor = bloomColor;
fd.light.intensity = (fd.isGolden ? 0.6 : 0.35) + flashProgress * 1.0;
fd.light.range = (fd.isGolden ? 3.0 : 2.0) + flashProgress * 2.0;
```

Also increase `FLASH_DURATION` from 0.2 to 0.35 seconds. The bloom should be visible and satisfying, not a flicker.

---

#### Task 6.3: Catch Arrival Celebration at Jar

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** Where `fd.catchProgress >= 1.0` (catch complete)

**After existing catch-complete logic, add:**

1. Emit a burst of 10-15 tiny particles at the jar mouth (top of jar cylinder), using the caught firefly's color. Particles drift gently downward into the jar (negative Y velocity), simulating the firefly entering.
2. Flash the jar's `PointLight` (from Task 4.3) to 200% intensity for 0.3s.
3. Play the firefly's musical pitch (Task 5.3) as a bell tone.
4. If this catch pushes `collectedCount` past a tier threshold, trigger the tier celebration (Task 4.4).

---

### Phase 7: Enhanced Entities and Variety

#### Task 7.1: Warm Firefly Color Palette

**File:** `src/src/minigames/games/fireflies/types.ts`

**Change:** Replace `FIREFLY_COLOR = Color3.FromHexString('#AAFF44')` (cold chartreuse) with a warm palette:

```typescript
/** Firefly color palette — warm ambers and golds for magical warmth. */
export const FIREFLY_COLORS = [
  Color3.FromHexString('#FFD35C'), // warm amber
  Color3.FromHexString('#FFE08A'), // soft gold
  Color3.FromHexString('#FFBE45'), // deeper amber
  Color3.FromHexString('#FFC966'), // honey gold
  Color3.FromHexString('#FFD700'), // classic gold
] as const;
```

On creation, each firefly randomly selects from this palette. This adds visual variety and warmth.

**Update `createFirefly`:** Replace the single `FIREFLY_COLOR` with `FIREFLY_COLORS[Math.floor(Math.random() * FIREFLY_COLORS.length)]`.

---

#### Task 7.2: Firefly Size Variation

**File:** `src/src/minigames/games/fireflies/entities.ts`

**Change:** Instead of a fixed `radius = 0.15`, use a random range:

```typescript
const radius = isGolden ? 0.3 : randomRange(0.1, 0.22);
```

Smaller fireflies are slightly faster (`speed = randomRange(1.2, 2.2)`). Larger fireflies are slightly slower (`speed = randomRange(0.8, 1.5)`). This creates natural visual hierarchy and variety.

---

#### Task 7.3: Firefly Personality — Organic Drift Patterns

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** Normal drift movement in `update`

**Current:** Simple additive sinusoidal drift: `position.x += Math.sin(t * 0.7 + offset) * 0.02`.

**Change:** Replace with more organic Perlin-like drift using layered sine waves with different frequencies:

```typescript
// Multi-frequency organic drift
const drift = fd.speed * speedMult * deltaTime;
fd.mesh.position.x += (
  Math.sin(t * 0.7 + fd.driftOffsetX) * 0.6 +
  Math.sin(t * 1.3 + fd.driftOffsetX * 2.1) * 0.3 +
  Math.sin(t * 2.1 + fd.driftOffsetX * 0.7) * 0.1
) * 0.02 * drift;

fd.mesh.position.y += (
  Math.cos(t * 0.5 + fd.driftOffsetY) * 0.5 +
  Math.cos(t * 0.9 + fd.driftOffsetY * 1.3) * 0.3 +
  Math.sin(t * 1.7 + fd.driftOffsetY * 2.5) * 0.2
) * 0.015 * drift;

fd.mesh.position.z += (
  Math.sin(t * 0.3 + fd.driftOffsetZ) * 0.5 +
  Math.cos(t * 0.8 + fd.driftOffsetZ * 1.7) * 0.3 +
  Math.sin(t * 1.5 + fd.driftOffsetZ * 0.4) * 0.2
) * 0.01 * drift;
```

This creates more naturalistic, less predictable movement that feels like real insects, not oscillating dots.

---

#### Task 7.4: Firefly Flash/Blink Behavior

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** Glow pulse section in `update`

**Current:** Smooth sine wave pulse: `intensity = 0.6 + 0.4 * Math.sin(...)`.

**Change:** Real fireflies blink — they flash on and off rhythmically, not in smooth sine waves. Replace with a blink pattern:

```typescript
// Blink pattern: sharp on, slow fade
const blinkCycle = (elapsedTime * fd.blinkRate + fd.glowPhase) % 1.0;
const blinkShape = blinkCycle < 0.15 
  ? blinkCycle / 0.15  // quick rise (0.15 of cycle)
  : Math.max(0.2, 1.0 - (blinkCycle - 0.15) / 0.55); // slow fade (0.55 of cycle), floor at 0.2
const intensity = 0.3 + 0.7 * blinkShape;
```

Add `blinkRate: number` to `FireflyData` (random 0.3 - 0.8). This creates realistic firefly blink patterns where the flash is quick and the fade is slow, with each firefly on its own timing.

---

#### Task 7.5: Enhanced Golden Firefly as Event

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** `trySpawnGolden` function and golden firefly handling throughout

**Implementation:**

1. **Arrival fanfare:** When a golden firefly spawns, play a soft, ascending three-note chime (`context.celebration.celebrationSound('chime')`). All regular fireflies should briefly turn to "look at" the golden one (rotate to face it for 1 second, then resume normal drift).

2. **Visual distinction:** The golden firefly should have a larger glow trail (2× particle emit rate), a visible point light with range 4.0 (vs 2.0), and a subtle pulsating halo mesh (a transparent sphere at 1.5× radius, emissive gold, alpha pulsing 0.1-0.3).

3. **Catch reward:** Catching the golden firefly triggers:
   - A larger sparkle burst (30 particles, not 15)
   - A `'medium'` confetti celebration (not `'small'`)
   - A brief golden flash across the entire scene (jar pulses, ground flashes gold for 0.5s)
   - The jar emits a burst of golden particles
   - If musical tones are implemented (Task 5.3), play a full ascending arpeggio chord

4. **Movement:** The golden firefly should move in a distinctive pattern — slower, more graceful, with wider arcs. It should occasionally pause and hover, pulsing brighter, as if waiting to be noticed.

---

### Phase 8: Technical Corrections

#### Task 8.1: Implement `onResize`

**File:** `src/src/minigames/games/fireflies/index.ts`  
**Location:** `onResize` method

**Implementation:**

```typescript
onResize(viewport: ViewportInfo): void {
  // Update context viewport reference
  context.viewport = viewport;
  
  // Verify hit target adequacy — project firefly size to screen space
  if (camera) {
    const testPos = new Vector3(0, 2, 0);
    const projectedSize = getProjectedDiameter(camera, testPos, 0.15, viewport.width, viewport.height);
    
    // If projected visual size is too small, scale up the glow trail
    // (hit radius is already generous at 1.5 units)
    if (projectedSize < 48) {
      const scaleFactor = 48 / projectedSize;
      for (const fd of fireflies) {
        if (!fd.isGolden) {
          fd.light.range = 2.0 * scaleFactor;
        }
      }
    }
  }
}
```

Add a `getProjectedDiameter` helper to `helpers.ts` that uses `Vector3.Project` to calculate screen-space diameter.

---

#### Task 8.2: Use Shared DifficultyController

**File:** `src/src/minigames/games/fireflies/index.ts`  

**Change:** Replace the custom `getDifficultyTier()` with `context.difficulty`. Wire the difficulty controller's level to control `maxFireflies` and `speedMultiplier`. Remove `getDifficultyTier` from `helpers.ts`.

---

#### Task 8.3: Use Shared SpawnScheduler  

**File:** `src/src/minigames/games/fireflies/index.ts`

**Change:** Wire `context.spawner` to control firefly respawn timing instead of manual `respawnTimer` countdowns. The SpawnScheduler provides rhythm-based intervals that create natural pacing.

---

#### Task 8.4: Update Manifest Entry

**File:** `src/src/minigames/framework/MiniGameManifest.ts`

**Ensure the fireflies entry includes:**
- `inputModes: ['tap', 'drag']`  
- `comboWindowSeconds: 3`
- `hasSpecialItems: true` (golden firefly)
- Appropriate `themeColor` (warm amber, e.g., `'#FFD35C'`, not green)

---

### Phase 9: Owl Companion Integration

#### Task 9.1: Owl Presence in Scene

**File:** `src/src/minigames/games/fireflies/environment.ts`

**Implementation:**

1. Position the owl on the jar cap or on a nearby stump/branch (create a small stump mesh at `Vector3(-4, 0, 0.5)`).
2. The owl should have a gentle idle animation (breathing + slow blink) as in all other scenes.
3. The owl should occasionally look toward the nearest firefly (rotate head toward nearest active firefly, one look every 5-10 seconds, hold for 2 seconds, then return to forward).
4. When the child catches a firefly, the owl does a small "delighted hop" animation (position.y += 0.15 over 0.15s, then back over 0.15s).
5. At tier transitions (Task 4.4), the owl looks at the jar and does a wing-spread animation (if available) or a more excited hop sequence (3 small hops).

**Rationale:** The soul document says the owl appears in every world as "a familiar friend in unfamiliar places." It is conspicuously absent from this game.

---

## Implementation Ordering

The phases should be implemented in this order for maximum incremental impact:

| Order | Phase | Impact | Effort |
|---|---|---|---|
| 1 | Phase 1: Soul & Safety | Critical foundation | Small |
| 2 | Phase 4: Progressive Illumination | Transforms the game's reason to exist | Medium |
| 3 | Phase 6: Enhanced Catch Choreography | Core delight moment | Small-Medium |
| 4 | Phase 3: Atmospheric Transformation | Ambient beauty | Medium |
| 5 | Phase 5: Audio Landscape | Emotional texture | Medium |
| 6 | Phase 2: Drag Trails | Signature mechanic | Large |
| 7 | Phase 7: Enhanced Entities | Polish and variety | Medium |
| 8 | Phase 8: Technical Corrections | Spec compliance | Small |
| 9 | Phase 9: Owl Integration | Soul compliance | Small-Medium |

**Rationale for ordering:** Phase 1 must be first (soul violations). Phase 4 before Phase 2 because progressive illumination transforms the game more than any other single change — it gives the game a *purpose*. Phase 6 makes the core mechanic feel good. Phase 3 makes the scene feel alive. Phase 5 makes it sound alive. Phase 2 (drag trails) is the largest effort but adds the most depth. Phase 7-9 are polish.

---

## Success Criteria

After remediation, the Fireflies game should pass every question in the soul alignment test:

| Question | Target Answer |
|---|---|
| Would a 3-year-old understand what to do without help? | Yes — glowing things invite tapping, trails invite dragging, every touch produces light. |
| Does the first tap produce genuine delight? | Yes — golden sparkles bloom wherever you touch, even empty space. |
| Is there any way a child could feel punished or confused? | No — every interaction produces warmth and beauty. |
| Does the visual quality feel handcrafted and warm? | Yes — warm amber glow, soft mist, twinkling stars, bioluminescent flowers. |
| Does the sound feel gentle and celebratory? | Yes — lullaby music, cricket chirps, musical firefly tones, ascending chimes. |
| Can a child leave and return without friction? | Yes — standard exit button, no progress to lose. |
| Is the owl present and helpful without being intrusive? | Yes — sits by the jar, watches fireflies, hops with delight. |
| Does this feel like a toy, not a test? | Yes — painting with light, filling a jar, transforming a garden. |

**The ultimate test:** A child taps the dark meadow and golden light blooms. They drag their finger and a luminous trail follows. Fireflies drift toward the trail. They tap one and it spirals into the jar in a graceful dance of light. The jar glows brighter. A flower nearby begins to pulse with faint color. Stars appear in the sky. The garden is waking up. The child keeps playing — not because there's a score to chase, but because they are painting a night garden with starlight, and every touch makes the world more beautiful.

That is a game Steve Jobs gives a promotion for.

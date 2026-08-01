# Visual Design Review — All Rooms, Scenes, and Games

**Date:** July 18, 2026
**Method:** headless-browser captures of every route at 1024x768 on the current build, reviewed against the vision docs' bar ("Pixar-like warmth, storybook diorama, premium real-time rendering").

## Scorecard

| Route             | Grade | Verdict                                                                                                                                                                              |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Playroom          | A     | The gold standard: layered depth (rug focal point, wainscoting, art wall, window, shelves), disciplined pastel palette, readable toy silhouettes everywhere.                         |
| Nature            | A-    | Rich tabletop, lively fireflies (new sprite glows read beautifully), stream anchors the composition. Purple backdrop still reads as "wall" rather than sky.                          |
| Fireflies (game)  | B+    | Night mood works: moon, trees, jar focal point, warm glows. Trees slightly flat; ground plane plain but acceptable at night.                                                         |
| Living Room       | B     | Good bones (fireplace, couch, doors, rug) but walls are washed-out and flat — no wainscoting/trim rhythm like the playroom, front floor area empty, wall art too small to read.      |
| Pirate Cove       | B     | Strong composition (deck, mast, rails, barrels, parrot) but the sky is a single flat blue — no clouds, sun, or sea beyond the rails; wheel/anchor read as gray plastic.              |
| Little Shark      | B-    | Underwater wash is intentional but currently reads as fog-on-everything; fine at motion, pale in stills. Acceptable; revisit with reef instancing.                                   |
| Bubble Pop        | C+    | The bubbles themselves are lovely (iridescent shader) but composition fails: most of the frame is empty darkness, moon/stars often out of frame, bubbles cluster at the bottom edge. |
| Kitchen           | D     | Nearly empty: bare walls, one counter, one toybox, a door. No window, cabinets, table, or charm. Reads as an unfinished level.                                                       |
| Star Catcher      | D     | Flat pale-blue ground plane, near-starless dark sky, targets are white blobs, one beige pillar. Farthest from the quality bar.                                                       |
| Cannonball Splash | D     | Two flat color rectangles (gray sky, blue ocean wall), pea-sized targets, silhouette-black cannon. No sun, clouds, waves, or island.                                                 |

## What was done this pass

1. **Kitchen — full decoration pass (done).** Lower cabinets + countertop with kettle/bowl/jars, an open shelf of cups, a curtained window, a stove, a fridge, a small dining table with two chairs and a fruit bowl, and a rug — brought from a D ("unfinished level") to a warm, furnished B. Tappable delights wired through the shared dispatcher.
2. **Living Room — wall treatment (done).** Wainscoting panels + baseboard trim matching the playroom, enlarged wall art, and a larger rug so the floor reads full. Now a cozy B+/A-.
3. **Cannonball Splash — seascape (done).** Warm gradient day sky, puffy toy clouds, a sun, palm-tree islands on the horizon, ocean depth, and a warm bronze cannon replacing the black silhouette. D → B+.
4. **Star Catcher — the night (done).** Deep-indigo-to-warm-glow gradient sky, a dense starfield, a glowing moon with a halo, distant hills framing the horizon, and catchable stars rebuilt as glowing five-point star shapes (warm cream; brighter gold for the bonus). D → A-.
5. **Bubble Pop — night backdrop (done, second pass).** Root cause found: the moon/starfield were authored at positive z for a camera pose the game never applies, so the whole backdrop sat behind the shell's −Z-facing camera and had been invisible for the game's entire life. Rebuilt on the new shared **sky rig** (`utils/skyRig`): a deep-indigo gradient skydome centred on the camera, a warm haloed moon, and a starfield — all placed in screen space via `projectToView`, so no world-coordinate guessing. Combined with the earlier spawn bias. Now a proper night dreamscape.
6. **Pirate Cove — sky pass (done, second pass).** Replaced the flat single-colour plastic sky plane with a sky-rig skydome (afternoon blue → hazy horizon → sea-teal, so it supplies sky _and_ sea), a warm sun with a modest glow, drifting clouds, and warmed the anchor/cannon metal from grey toward bronze.

The two fixes above also produced a durable win: a shared, camera-agnostic **sky rig** and a written standard (`docs/ai-guidance/scene-rendering-standards.md`) so future scenes place backdrops in screen space instead of each inventing its own camera math.

## Deferred / known issues (recommended next)

- **Star Catcher** should migrate its hand-rolled sky/moon/starfield to the shared `utils/skyRig` for consistency (it works and looks good today; low priority).
- Nature backdrop: gradient sky + distant tree silhouettes behind the wall plane (a good `skyRig` candidate).
- Little Shark: tune fog curve; reef instancing (perf) will allow denser, prettier coral.
- Selective bloom postprocessing behind the quality tier — would lift every glow at once (fireflies, portals, moon, fireplace, the new star-catcher stars).
- A shared gradient-sky-dome builder to replace the remaining flat/banded sky planes everywhere (Star Catcher's vertex-gradient sky is the reference).

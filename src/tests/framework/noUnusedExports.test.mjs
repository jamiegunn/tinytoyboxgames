/**
 * No LIVE module may carry a dead public symbol without saying so out loud.
 *
 * See architecture-standards.md#nothinginert — this file is the second
 * enforcing half of that section, and it exists because the first half has a
 * hole big enough to hide the thing it was built to catch.
 *
 * THE HOLE
 * --------
 * `noUnreachableModules.test.mjs` guards MODULES. Its founding story is the
 * 963-line little-shark species roster: complete, documented, internally
 * consistent, and loaded by nothing. The guard written in response asks one
 * question — does the app reach this FILE?
 *
 * `minigames/shared/animalBuilder.ts` answers yes. The app reaches it, because
 * `buildShark` and `buildFish` are live. Sitting in the same file, behind that
 * yes, were nine complete animal builders — bunny, kitten, puppy, panda,
 * hamster, frog, bear, cat, elephant — that nothing anywhere calls. Roughly 920
 * lines. The same shape, the same quality of finish, and very nearly the same
 * size as the roster whose deletion motivated the module guard, hiding inside a
 * live file where that guard cannot see it, passing CI in silence for months.
 *
 * That is the defect class. Not "unused exports are untidy" — a dead export
 * that READS AS SHIPPED, in a file the app demonstrably loads, so every signal
 * available to the next reader says the feature is wired in.
 *
 * WHY THIS DOES NOT REPLACE THE MODULE GUARD
 * ------------------------------------------
 * It cannot, and the reason is recorded in that file: file A imports a symbol
 * from file B, so B's export is used — but nothing imports A either. The
 * reference is real and both are dead. An export check alone would have missed
 * the species roster entirely. The two guards are complementary and neither
 * subsumes the other, which is exactly why they now share `_moduleGraph.mjs`:
 * two hand-maintained copies of a resolver drift, and when they disagree about
 * what the app loads, the one you believe is the one that is wrong.
 *
 * WHAT THIS CHECKS, AND THE FOUR TIERS IT DELIBERATELY DOES NOT
 * ------------------------------------------------------------
 * Every export reachable from `main.tsx` — 543 modules — lands in exactly one
 * of six tiers, assigned by `classifyExport` below. Two are enforced. The sizes
 * are NOT stated here: they are asserted in the first test, because the version
 * of this paragraph that stated them got the only enforced one wrong by 32.
 * Read the numbers there; read what they MEAN here.
 *
 *   consumed. Some other module imports it by name. Nothing to say.
 *
 *   DEAD (ENFORCED). Defined here, imported by no other module, not referenced
 *   inside its own file, and not named anywhere in tests or probes. Nothing runs
 *   it. This is the animalBuilder class.
 *
 *   LAUNDERED (ENFORCED, added after the tier below was found to be hiding
 *   things). Dead by every test above, except that its NAME appears in the
 *   test/probe corpus while no brace list anywhere in that corpus takes it from
 *   anywhere. The "use" is a collision — in every case so far, a hand-copied
 *   tuning constant. See the check itself for why that is the worst possible
 *   trigger for an over-approximation.
 *
 *   spared. Same as above but a brace list DOES take the name. That is evidence
 *   of an edge a resolver cannot follow (limit 2 below), so it is honoured.
 *
 *   DEAD RE-EXPORT (NOT enforced). `export { x } from './y'` in a barrel nobody
 *   imports x through, while live code imports './y' directly. The line is dead;
 *   `x` is alive and well. The fix is deleting one line of a barrel, and
 *   confusing it with DEAD is how a reader talks themselves into deleting a
 *   working function.
 *
 *   EXPORTED-BUT-INTERNAL (NOT enforced). Used inside its own module and
 *   nowhere else, so the `export` keyword is superfluous but the code runs on
 *   every frame. `utils/qualityTier.ts`'s `getQualityTier` is one.
 *
 * THE ORDER OF THOSE TESTS IS PART OF THE MEASUREMENT, which is not obvious and
 * cost a wrong number to learn. `testWords` used to be consulted FIRST, so any
 * name appearing in the corpus was excluded before the re-export and internal
 * tiers were counted at all — those two were silently reporting "…and not named
 * in any test", a qualifier nobody had written down. Moving it last leaves the
 * DEAD set identical (a corpus name that is also re-exported or self-referenced
 * was skipped either way) but it grew the other two tiers by 17 and 23. Neither
 * count was a mistake; the pair of them without a stated ordering was.
 *
 * Enforcing two tiers of six is a choice, and counting the other four is the
 * whole of the discipline: the failure this suite keeps rediscovering is prose
 * that reads as exhaustive when the code beneath it is not. This docblock says
 * what is checked, says what is not, and the test below gives the size of what
 * is not, so that nobody reads a green run as "no dead exports".
 *
 * WHAT IT CANNOT PROVE
 * --------------------
 * Regexes, not a TypeScript parser (see `_moduleGraph.mjs`). Two limits were
 * found by running it rather than by reasoning about it, and both reported LIVE
 * code as dead — the direction that gets working features deleted:
 *
 *   1. A literal `import('x')` resolves to a NAMESPACE, naming no export in any
 *      brace list. sceneCatalog.ts loads every scene that way, so the first run
 *      called the kitchen, living-room and playroom `createScene` dead. Three
 *      scenes the game ships. Fixed by `opaqueTargetsOf`.
 *   2. `tests/room/scene-sky-fog-contract.test.mjs` writes a synthetic entry
 *      module as a TEMPLATE LITERAL and bundles it, so its `export {...} from
 *      './src/utils/cameraPresets'` resolves against the wrong base directory
 *      and vanished — condemning two live camera helpers. Fixed by refusing to
 *      resolve at all on the test side: any exported name appearing as a whole
 *      word anywhere in the test/probe corpus counts as used. That is a
 *      deliberate over-approximation, wrong only in the direction that spares a
 *      symbol, never the direction that condemns one.
 *
 *      That sentence was true and it was not enough, which is the more useful
 *      half of the lesson. Stating the SAFE DIRECTION of an over-approximation
 *      says nothing about its POPULATION, and this one's population is not
 *      random: the likeliest way to make a name appear in the corpus without
 *      importing it is a probe hand-copying a tuning constant, and a duplicated
 *      tuning number is the strongest available evidence that the original has
 *      no readers. The trigger was anti-correlated with the risk. 53 top-level
 *      declarations across tests/ and .probe/ shadow a src export; exactly one
 *      was load-bearing, which is why the repair is the LAUNDERED tier rather
 *      than a 53-site migration. Ask of every over-approximation not only
 *      "which way does it err" but "what kind of thing sets it off".
 *
 * Both were found because the first list this produced was 263 names long and
 * contained things that were obviously alive. A guard whose output is too large
 * to check by hand is a guard nobody checks; the length was the tell.
 *
 * THE CONVENTION THIS DEPENDS ON
 * ------------------------------
 * ALLOWED is a list of ADMISSIONS, not permissions, and is checked in BOTH
 * directions — an undeclared dead export fails, and an entry naming a symbol
 * that is no longer dead ALSO fails. Without the second check the list rots into
 * a graveyard asserting a state the codebase has already left.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, SRC, walk, stripComments, reachFrom, resolve, namedImportsOf, exportsOf, opaqueTargetsOf, reexportedNames } from './_moduleGraph.mjs';

/**
 * Dead exports that are staying for now, each with the reason.
 *
 * Key is `path/from/src.ts  symbolName` (two spaces). Keep the reason specific
 * enough to act on without re-deriving the analysis.
 */
// EMPTY, and that is a measurement rather than an achievement: it means the
// enforced tier is at zero, not that the file has nothing left to say. The
// other three tiers are counted in the docblock above and two of them are large.
//
// It held four entries, each written as a suspicion rather than a finding, and
// resolving them falsified three of the four suspicions — not the verdicts, the
// stated MECHANISMS. That is the pattern worth keeping when the next entry goes
// in: an allowlist reason is a hypothesis with nothing checking it, so it drifts
// exactly like any other unchecked prose, and it drifts while wearing the
// authority of a thing written next to a passing test.
//
//   getManifest            "callers read the exported array directly" — the
//                          array is `const`, not `export const`. No caller
//                          could have. Deleted.
//   INACTIVE_ICON_BUILDERS "portals in the inactive state" — no such state
//                          existed; the word appeared once in the framework, in
//                          the constant's own name. Deleted with 237 lines.
//   HIT_RADIUS             "suspected genuine tuning drift" — it was the losing
//                          half of a finished world-space to screen-space
//                          migration, labelled `legacy` three lines above its
//                          live replacement. Deleted.
//   MEAN_TRAVEL_DISTANCE   the only entry whose facts held. Resolved by making
//                          the derivation below it executable instead of prose.
const ALLOWED = {};

const appReach = reachFrom([path.join(SRC, 'main.tsx'), path.join(SRC, 'main.ts')]);
const testFiles = [...walk(path.join(ROOT, 'tests')), ...walk(path.join(ROOT, '.probe'))];

/**
 * Every identifier-shaped word anywhere in tests and probes. See limit 2 above.
 *
 * THIS FILE IS EXCLUDED FROM ITS OWN CORPUS, and that is not tidiness. The
 * ALLOWED keys below are string literals containing the very symbol names being
 * declared dead. Left in, every entry marked its own subject as used, which made
 * the entry stale, which failed the staleness check — an allowlist that
 * self-destructs on contact. The general form is worse than the symptom: any
 * dead symbol NAMED IN THE GUARD THAT REPORTS IT would be silently spared, and
 * the guard would grow quieter the more debt it recorded.
 */
const CORPUS_EXCLUDED = new Set([path.join(ROOT, 'tests', 'framework', 'noUnusedExports.test.mjs'), path.join(ROOT, 'tests', 'framework', '_moduleGraph.mjs')]);
const corpusFiles = testFiles.filter((f) => !CORPUS_EXCLUDED.has(f));
const testWords = new Set(
  corpusFiles
    .map((f) => stripComments(readFileSync(f, 'utf8')))
    .join('\n')
    .match(/[A-Za-z_$][\w$]*/g) ?? [],
);

/** absolute path -> names some other live module takes from it. */
const usedByApp = new Map();
/** Modules whose whole surface is consumed opaquely; every export counts as used. */
const opaque = new Set();

for (const file of appReach) {
  const src = readFileSync(file, 'utf8');
  for (const { spec, name } of namedImportsOf(src).named) {
    const target = resolve(spec, file);
    if (!target) continue;
    if (!usedByApp.has(target)) usedByApp.set(target, new Set());
    usedByApp.get(target).add(name);
  }
  for (const spec of opaqueTargetsOf(src)) {
    const target = resolve(spec, file);
    if (target) opaque.add(target);
  }
}

/**
 * Every name the corpus takes through a BRACE LIST — `import { x } from` or
 * `export { x } from` — anywhere in tests and probes, including inside template
 * literals.
 *
 * This is the difference between a use and a coincidence, and it is the whole
 * subject of the `laundered` check below. The word corpus above deliberately
 * cannot resolve a specifier (limit 2 in the docblock), so it accepts any
 * occurrence of the name. A brace list is the weakest evidence that is still
 * evidence of an EDGE: something is being taken FROM somewhere. It stays
 * text-matched rather than resolved on purpose — resolving is exactly what
 * broke on the bundled template-literal entries, and those are the cases this
 * has to keep sparing.
 */
const corpusBraceNames = new Set();
for (const file of corpusFiles) {
  const text = stripComments(readFileSync(file, 'utf8'));
  for (const m of text.matchAll(/(?:^|[\s({[=,;`])(?:import|export)\s*{([^}]*)}\s*from\b/g)) {
    for (const piece of m[1].split(',')) {
      const name = piece
        .trim()
        .split(/\s+as\s+/)[0]
        .trim();
      if (name) corpusBraceNames.add(name);
    }
  }
}

/**
 * The whole verdict for one export, as a pure function of five facts about it.
 *
 * Extracted from the loop below so that the tiering can be driven by a test
 * rather than only by the repository. That distinction earned itself: the
 * laundering tier's original evidence was a mutation of a real probe, and a
 * later repair in the same round moved the symbol involved into the `internal`
 * tier, which silently retired the mutation. Evidence that lives in the tree
 * expires when the tree is edited; evidence that lives here does not.
 *
 * @param name       - the exported identifier.
 * @param consumed   - names this module's importers actually take from it.
 * @param reexported - names this module forwards from elsewhere.
 * @param occurrences - times the name appears in this module's own comment-stripped body,
 *                      declaration included, so 1 means "declared and never touched again".
 * @param words      - every identifier-shaped word in the test/probe corpus.
 * @param braceNames - names any test or probe takes via an `import {…} from` / `export {…} from`.
 * @returns which tier this export belongs to. Only `dead` and `laundered` are enforced.
 */
function classifyExport({ name, consumed, reexported, occurrences, words, braceNames }) {
  if (consumed.has(name)) return 'consumed';
  // A re-export is the barrel tier, not this one.
  if (reexported.has(name)) return 'reexport';
  // Referenced inside its own file is the internal tier: the `export` is
  // superfluous but the code runs. One occurrence is the declaration itself.
  if (occurrences > 1) return 'internal';
  // Spared only by the word corpus. If no brace list anywhere in tests or
  // probes takes this name from anywhere, the "use" is a name collision —
  // most often a hand-copied constant. See the laundering check below.
  if (words.has(name)) return braceNames.has(name) ? 'spared' : 'laundered';
  return 'dead';
}

const dead = [];
const laundered = [];
/**
 * How many exports land in each tier. Counted rather than described, because the
 * previous version of the docblock above described them and was wrong about the
 * only number it enforced. See the test that asserts these.
 */
const TIER_COUNTS = { consumed: 0, reexport: 0, internal: 0, spared: 0, laundered: 0, dead: 0 };
for (const file of [...appReach].sort()) {
  if (opaque.has(file)) continue;
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  const src = readFileSync(file, 'utf8');
  const body = stripComments(src);
  const consumed = usedByApp.get(file) ?? new Set();
  const reexported = reexportedNames(src);

  for (const name of exportsOf(src)) {
    const occurrences = (body.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g')) ?? []).length;
    const tier = classifyExport({ name, consumed, reexported, occurrences, words: testWords, braceNames: corpusBraceNames });
    TIER_COUNTS[tier] += 1;
    if (tier === 'laundered') laundered.push(`${rel}  ${name}`);
    else if (tier === 'dead') dead.push(`${rel}  ${name}`);
  }
}

test('the unenforced tiers are still the size this file says they are', () => {
  // The docblock used to state these as prose and was wrong about the only one
  // it enforced: it claimed 32 dead exports while the suite ran green, which is
  // self-refuting — 32 undeclared dead names would have failed the test three
  // lines of code away. A number in a comment is a claim nothing checks, and
  // this file's entire subject is symbols that nothing checks.
  //
  // These are (file, name) pairs, not distinct names; the two differ by one, in
  // `internal`. They are asserted exactly rather than as bounds so that any
  // movement is read by a human. Moving one is fine — updating the number
  // without being able to say which symbol moved and why is not.
  //
  // 2026-07, round 10, +3 internal and +1 spared. Four new exports, all of them
  // constants that used to be inline literals inside function bodies and were
  // therefore being hand-copied into probes because there was nothing to import:
  //
  //   REEF_RIG, REEF_WATER          little-shark/environment/setup.ts  -> internal
  //   TONE_MAPPING_EXPOSURE         utils/rendererFactory.ts           -> internal
  //   reefIrradiance()              little-shark/environment/setup.ts  -> spared
  //
  // The three internals are read in their own file (that is what makes them
  // internal — the export exists for the probes and the tests, not for the app).
  // `reefIrradiance` occurs once in setup.ts, has no app importer at all, and
  // lands in `spared` only because it appears in the brace list of the
  // `bundleEntry` template literal in `.probe/render/r8-species-palette.mjs`.
  // That is the corpus-word rule doing exactly its job: the probe is the
  // consumer, and a function whose whole purpose is to stop documentation from
  // transcribing a number by hand has no runtime caller by design.
  //
  // 2026-07, the room lighting round, +1 consumed:
  //
  //   DEFAULT_ENV_INTENSITY         utils/rendererFactory.ts           -> consumed
  //
  // It was already the default argument of `applyDefaultEnvironment` in that
  // file; the export is new because `createSceneLighting` in utils/sceneHelpers
  // now imports it to restore the shared baseline for any scene that does not
  // override `environmentIntensity`. It lands in `consumed` rather than
  // `internal` for exactly that reason — a real app importer, not a probe.
  //
  // Why it needed exporting is the finding of that round. This constant was
  // measured to carry 73% of the kitchen's luminance while being invisible from
  // every file that owns lighting, and two minigames had already responded by
  // hand-copying a local override rather than importing anything. That is the
  // same failure `TONE_MAPPING_EXPOSURE` was exported to stop, three entries
  // above, in the same file.
  //
  // 2026-07, Fix B (the Kitchen's side walls), +10 consumed and nothing else:
  //
  //   PLATE_RACK_Z, PLATE_RACK_Y, MENU_BOARD_Z, MENU_BOARD_Y,
  //   PEG_RAIL_Z, PEG_RAIL_Y, WALL_CLOCK_Z, WALL_CLOCK_Y   kitchen/layout.ts
  //   createPlateRack                        kitchen/decor/plateRack.ts
  //   createWallPegs                         kitchen/decor/wallPegs.ts
  //
  // Every one lands in `consumed` because it has a real app importer: the eight
  // slot constants are read by the two new decor files, and the two factories by
  // `kitchen/decor/index.ts`. That all ten are consumed and none internal is the
  // check that matters here — a new decor file that exported a factory nothing
  // composed would show up as `dead`, which is precisely how a piece of scenery
  // gets built, measured on paper, and never actually rendered.
  // 2026-08-01, the documentation-accuracy round, +4 consumed and -3 internal:
  //
  //   CannonBuildOptions, CannonCreateResult             cannon/types/
  //   ShipWheelBuildOptions, ShipWheelCreateResult       shipWheel/types/
  //   TreasureChestBuildOptions, TreasureChestCreateResult  treasureChest/types/
  //   CEILING_DEPTH_OFFSET                               living-room/layout.ts
  //
  // The six prop types were declared inline in each `create.ts`; skills.md's
  // interactive-prop contract requires a `types/` folder, which all five Nature
  // props already had and none of the three Pirate Cove ones did. Extracting
  // them moves each name from one file to two — declared in `types/X.ts` and
  // re-exported from `create.ts` for existing importers — so three names that
  // only ever occurred inside their own file (`internal`) now have a real
  // cross-file importer (`consumed`). Net: internal 139 -> 136, consumed
  // 1748 -> 1752, with `CEILING_DEPTH_OFFSET` making up the fourth.
  //
  // `CEILING_DEPTH_OFFSET` was a local `WALL_DEPTH_OFFSET` inside
  // `living-room/room/ceiling.ts`. That room's own README forbids exactly that
  // — "do not invent local sizes that drift from the layout" — and it was the
  // only dimension in the room that did.
  // 2026-08-01, the scene-placement round, +1 consumed:
  //
  //   onFloor                       utils/scene/placement.ts   -> consumed
  //   ScreenSide                    utils/scene/placement.ts   -> internal
  //   FloorPlacement                utils/scene/placement.ts   -> internal
  //
  // The two types land in `internal` rather than `consumed` because both
  // consumers import only the function and let the option object be inferred —
  // the types are named in their own file and nowhere else. That is the tier
  // working as designed, not a smell: they are the function's published shape,
  // and an author who wants to hold one in a variable can import it.
  //
  // Both immersive scenes now express portal positions as
  // `onFloor({ side: 'left', across, depth })` instead of raw `Vector3(x, 0, z)`,
  // because +X is screen LEFT in every scene and hand-authored literals were
  // being written by authors who had to remember that. `sceneAxes.test.mjs`
  // pins the convention the helper encodes.
  //
  // A second export, `sharesViewRay`, was written in the same change and then
  // removed before commit: its only intended consumer is an occlusion test that
  // does not exist yet, and this guard correctly reported it as `dead: 1`. That
  // is §5's animationPresets.ts story exactly — seven exports, zero importers —
  // caught this time before it landed rather than a round later.
  //
  // 2026-08-02, the Kitchen's left wall, +7 consumed and nothing else:
  //
  //   LEFT_DRESSER_Z, LEFT_DRESSER_WIDTH, DRESSER_HUTCH_TOP_Y,
  //   LEFT_BASE_CABINET_Z, LEFT_BASE_CABINET_WIDTH, LEFT_CABINET_DEPTH
  //                                          kitchen/layout.ts
  //   createLeftWallCabinets                 kitchen/decor/leftWallCabinets.ts
  //
  // Same shape as Fix B eight entries above, and the same thing worth checking:
  // all seven land in `consumed`, so the six constants have a real reader and
  // the factory has a real composer. A `dead` here would mean a dresser that was
  // authored, type-checked, and never added to any scene — which is the exact
  // failure mode of adding scenery, because nothing about the file itself tells
  // you whether `decor/index.ts` calls it.
  //
  // 2026-08-02, the owl perch-surface framework, +4 consumed and +6 internal:
  //
  //   collectPerchSurfaces' four app-facing names   utils/scene/perchSurfaces.ts
  //     collectPerchSolids, surfaceYAt   -> read by utils/sceneHelpers
  //     resolvePerchTarget               -> read by entities/owl/actions
  //     PerchSolid                       -> the type sceneHelpers memoises
  //
  //   classifyPerchRoots, PerchClassification, PerchRejection,
  //   FLOOR_CONTACT_Y, STACK_CONTACT_Y, MIN_SOLID_HEIGHT
  //                                                 -> internal
  //
  // The split is the interesting part and it is the right way round. The app
  // needs to ASK what is standing at a point; only the test needs to see WHY
  // each root was or was not counted, which is what `classifyPerchRoots` returns
  // and what `tests/room/owl-perch-surfaces.test.mjs` pins as the per-room
  // inventory. Six symbols whose only readers are tests is exactly the `internal`
  // tier's purpose, and none of them is `spared`: each is genuinely imported.
  //
  // 2026-08-02, the owl perch REWRITE, +3 internal and +1 spared, consumed flat.
  //
  // The surface model was rebuilt from bounding boxes to a triangle-stamped
  // height field after a child reported the owl getting stuck in mid-air, so the
  // module's exported surface turned over rather than grew:
  //
  //   gone     surfaceYAt, collectPerchParts, PerchPart      (all consumed)
  //   new      standingYAt, buildPerchField, PerchField      (all consumed)
  //
  // Three in, three out, which is why `consumed` does not move. The rest:
  //
  //   STACK_CONTACT_Y      perchSurfaces.ts   -> internal
  //   PerchSpan            perchSurfaces.ts   -> internal
  //   deriveOwlFlightBounds  sceneHelpers.ts  -> internal
  //   spansAt              perchSurfaces.ts   -> spared
  //
  // `deriveOwlFlightBounds` was extracted from the body of `wireFloorTap`
  // because Nature and Pirate Cove author no flight bounds — theirs exist only
  // as the result of that arithmetic — and a test that sweeps those scenes
  // cannot re-derive the reachable area without becoming a second copy of the
  // rule. It is `internal` because only the test imports it; the app reaches it
  // through the function it was cut out of.
  //
  // `spansAt` is the one worth justifying, since `spared` is the tier nearest to
  // laundering. It returns a cell's raw spans, and it exists because
  // `standingYAt` cannot answer the question the suite needs: "are the owl's feet
  // ON something" and "is anything THROUGH the owl" both come back from
  // `standingYAt` as a height, so a bird standing on a shelf and a bird standing
  // on nothing are indistinguishable through it. It lands in `spared` rather than
  // `internal` only because the classifier sees the name in a brace list; it is
  // genuinely imported and genuinely asserted on.
  //
  // 2026-08-02, rotation range becomes derived: +2 consumed, +5 internal, +1 spared.
  //
  //   resolveRotationRange, clampAzimuth      utils/scene/rotationRange.ts -> consumed
  //     Both called by `createSceneCamera`, which no longer reads a per-scene
  //     `maxAzimuthRange` off the catalog — that field is gone, along with the
  //     Playroom bug it was hiding: authored at ±14.3° against walls that allow
  //     ±10.7°.
  //
  //   RoomShell, OrbitEnvelope, cameraPassesThroughWall, orbitPositionsAt,
  //   largestSafeRotation                                              -> internal
  //   SHARED_ROTATION_RANGE                                            -> spared
  //
  // Five internal is the whole geometric derivation, and it is test-only ON
  // PURPOSE. The app needs one number; only the guard needs to recompute where
  // that number came from, which it does from each room's own layout constants
  // rather than trusting the constant. A limit the app computed at runtime would
  // be the same arithmetic done twice a second for an answer that cannot change
  // between frames.
  //
  // 2026-08-02, panning removed: +1 internal. Net of three edits to the same
  // module, all in `utils/scene/rotationRange.ts`:
  //
  //   cameraPassesThroughWall  -> deleted. It asked whether the CAMERA had swung
  //     outboard of a side wall, which is neither necessary nor sufficient: the
  //     portrait pull-back legitimately stands the camera outside the room
  //     looking in, and a camera safely between the walls can still be pointed
  //     so a corner of the frame sweeps past the end of one.
  //   rayMissesTheRoom         -> new internal. The replacement rule, per ray.
  //   frameSeesPastWalls       -> new internal. The same rule over four corners.
  //
  // Two names where there was one, because the per-ray answer and the per-frame
  // answer are separately worth asserting: the pure-geometry tests drive the ray
  // with hand-made directions, which is the only way to state what "shows the
  // void" means without a scene in the way.
  //
  // 2026-08-02, the stage is letterboxed: +2 consumed, +3 internal, +1 spared.
  // All six are `utils/scene/stageRect.ts`, and the split is the point of the
  // module:
  //
  //   resolveStageRect, resolveChromeBand                          -> consumed
  //     The two the app calls. SceneFrame sizes the canvas from the first;
  //     UIOverlay lays the HUD out in the band the second reports.
  //   MIN_STAGE_ASPECT, MAX_STAGE_ASPECT, StageRect                -> internal
  //   stageAspectFor                                               -> spared
  //     Test-only, and deliberately: the app never needs the aspect as a bare
  //     number because it always has a rect in hand, but every framing guard
  //     needs to know which aspects the camera can actually be given. Before
  //     this existed those suites listed nine raw device aspects, five of which
  //     the camera can no longer be handed at all.
  //
  //   MIN_CHROME_BAND                                              -> consumed
  //     Added a step later, by mutation: dropping the HUD's control floor from
  //     56 to 24 changed nothing, because a near-square window was the only
  //     shape where either floor binds and no test used one. `UIOverlay` reads
  //     this to decide whether the band it has been given is a band at all.
  //
  // 2026-08-02, the Kitchen and Living Room shortened by 25%: +3 consumed. All
  // three are constants that were LOCAL LITERALS inside shell files and are now
  // in the layout where a rescale can see them:
  //
  //   SIDE_WALL_CENTER_Z   kitchen + living-room layout.ts
  //     Was `const SIDE_WALL_CENTER_Z = -1.2;` at the top of each room's
  //     `room/walls.ts`, which that folder's own README forbids in as many
  //     words. It had already drifted — the walls sat 0.8 forward of where the
  //     ceiling did — and a local copy is also a number a depth rescale silently
  //     misses, which is how a shortened room ends up with full-length walls.
  //   CEILING_DEPTH_OFFSET  kitchen layout.ts
  //     Same defect, same file pattern: a local `WALL_DEPTH_OFFSET` in
  //     `room/ceiling.ts`. The rescale left the Kitchen's ceiling 0.3 out of
  //     place because it could not see a constant that was not in layout.ts.
  assert.deepEqual(
    TIER_COUNTS,
    { consumed: 1772, reexport: 86, internal: 156, spared: 7, laundered: 0, dead: 0 },
    'the tier populations moved; say which symbol moved and why, then update this',
  );
});

test('the export graph is built on the same module graph as the reachability guard', () => {
  // Not decoration. If these two ever disagree about what the app loads, one of
  // them is asserting a codebase state that does not exist, and the whole point
  // of sharing _moduleGraph.mjs is that neither can drift alone.
  assert.ok(appReach.size > 400, `expected the app to reach 400+ modules, reached ${appReach.size} — the graph is broken, not the codebase`);
  assert.ok(testWords.size > 1000, `expected a substantial test corpus, found ${testWords.size} distinct words`);
});

test('the codebase still has the shape this parser assumes', () => {
  // _moduleGraph.mjs parses with regexes and cannot notice a form it does not
  // know. Rather than trust it to stay lucky, assert the shape it depends on,
  // so the day someone writes `export default` this fails HERE with an
  // explanation instead of somewhere downstream as a wrong verdict.
  const offenders = [];
  for (const file of walk(SRC)) {
    const body = stripComments(readFileSync(file, 'utf8'));
    if (/(?:^|\n)\s*export\s+default\b/.test(body)) offenders.push(`${path.relative(SRC, file)}  export default`);
  }
  assert.deepEqual(
    offenders,
    [],
    `A module form this parser does not handle has appeared:\n` +
      offenders.map((o) => `   ${o}`).join('\n') +
      `\n\nexportsOf() in _moduleGraph.mjs does not recognise it, so its export is invisible and\n` +
      `every verdict about that file is unreliable. Teach the parser first; do NOT allowlist\n` +
      `the symbol, because the parser will be just as wrong about the next one.\n`,
  );
});

test('no live module carries a dead export without an allowlist entry explaining why', () => {
  const undeclared = dead.filter((d) => !(d in ALLOWED));
  assert.deepEqual(
    undeclared,
    [],
    `These symbols are exported from modules the app DOES load, and nothing — no module, no\n` +
      `test, no probe — ever names them:\n` +
      undeclared.map((d) => `   ${d}`).join('\n') +
      `\n\nBeing inside a live file is not evidence of being alive. That is the whole defect: the\n` +
      `module reachability guard says yes to the file and stops there, which is how ~920 lines\n` +
      `of finished animal builders sat next to buildShark for months.\n\n` +
      `Three fixes, and they are not interchangeable:\n` +
      `  1. It was meant to be called and never was. MEASURE whether calling it helps before\n` +
      `     wiring it in — the last cluster that looked obviously good would have cost 72% of\n` +
      `     the reef's headline metric.\n` +
      `  2. It was superseded. Delete it, and leave a NOT-HERE-DELIBERATELY block saying what\n` +
      `     it claimed and what is true instead.\n` +
      `  3. It is knowingly parked. Add it to ALLOWED with a reason specific enough to act on.\n`,
  );
});

test('every allowlist entry still names an export that is actually dead', () => {
  const live = new Set(dead);
  const stale = Object.keys(ALLOWED).filter((d) => !live.has(d));
  assert.deepEqual(
    stale,
    [],
    `These allowlist entries no longer describe reality — each names a symbol that is now\n` +
      `either consumed or deleted:\n` +
      stale.map((d) => `   ${d}`).join('\n') +
      `\n\nRemove them. An allowlist that outlives its subjects stops being a record of known debt\n` +
      `and becomes a document asserting a state the codebase has already left.\n`,
  );
});

test('no dead export is spared by a test or probe that merely REDECLARES its name', () => {
  assert.deepEqual(
    laundered,
    [],
    `These exports are imported by no module and referenced nowhere in their own file. The only\n` +
      `thing keeping them off the dead list above is that their NAME appears somewhere in tests or\n` +
      `probes — and no brace list anywhere in that corpus takes them from anywhere, so it is not a\n` +
      `use:\n` +
      laundered.map((d) => `   ${d}`).join('\n') +
      `\n\nIn every case seen so far the mechanism was a hand-copied constant: a probe writing\n` +
      `\`const VISIBLE_BAND_HEIGHT = 7.08; // types.ts\` instead of importing it. That is worse than\n` +
      `it looks in two independent ways, and fixing only one of them leaves the defect:\n\n` +
      `  1. The copy SILENCES THIS GUARD. A duplicated tuning number is the single strongest\n` +
      `     signal that the original has no readers — and it is precisely what makes the original\n` +
      `     look read. The over-approximation this file relies on (docblock, limit 2) is safe in\n` +
      `     the sense it claims, never condemning live code; what it did not say is that the\n` +
      `     thing which triggers it is anti-correlated with the risk it is measuring.\n` +
      `  2. The copy CANNOT DRIFT LOUDLY. Nothing compares it to its source. The value can be\n` +
      `     edited to anything at all and every test in this suite still passes.\n\n` +
      `The fix is to import it. \`tests/framework/_tsload.mjs\`'s \`bundleEntry\` takes a template\n` +
      `literal of re-exports and hands back the real values, which is how the room tests read\n` +
      `cameraPresets — those are the cases this check deliberately spares, because the name does\n` +
      `appear in a brace list there even though no resolver can follow it.\n\n` +
      `If the value genuinely cannot be imported because nothing exports it, say so at the copy.\n` +
      `That is a finding about the source module, not an exemption from this one.\n`,
  );
});

test('every tier this file can assign is reachable, including the two it enforces', () => {
  // Written because both enforced lists are currently EMPTY, and an assertion
  // that has never produced its own failure is an assertion nobody has tested.
  // A green run of a check that cannot fire looks exactly like a green run of a
  // check that can.
  //
  // This drives the real `classifyExport` — not a paraphrase of its condition —
  // with a synthetic canary, one input per tier. The canary was first confirmed
  // against the repository itself: appending `export const R9_LAUNDER_CANARY`
  // to a live module plus a bare `const R9_LAUNDER_CANARY` to a probe made the
  // check above fail naming that symbol, and changing the probe's copy to a
  // brace list made it pass again. That experiment is not repeatable in CI, so
  // its shape is preserved here.
  const NAME = 'CANARY_SYMBOL';
  const none = new Set();
  const has = new Set([NAME]);
  const base = { name: NAME, consumed: none, reexported: none, occurrences: 1, words: none, braceNames: none };

  assert.equal(classifyExport({ ...base, consumed: has }), 'consumed', 'an importer taking the name must outrank every later tier');
  assert.equal(classifyExport({ ...base, reexported: has }), 'reexport', 'a forwarded name is the barrel tier');
  assert.equal(classifyExport({ ...base, occurrences: 2 }), 'internal', 'a second occurrence in its own body means the code runs');
  assert.equal(classifyExport({ ...base, words: has, braceNames: has }), 'spared', 'a brace list anywhere in the corpus is evidence of an edge');
  assert.equal(classifyExport({ ...base, words: has }), 'laundered', 'the word corpus alone is a name collision, not a use');
  assert.equal(classifyExport(base), 'dead', 'nothing at all references it');

  // The ordering is load-bearing, not incidental: a real import must win over a
  // bare redeclaration of the same name, or a genuinely-used export gets
  // condemned the moment some probe happens to shadow it. 53 declarations in
  // this corpus shadow a src export; all but a handful are generic helper names
  // like `clamp` and `pick`, and this line is why they stay harmless.
  assert.equal(classifyExport({ ...base, consumed: has, words: has }), 'consumed', 'a real import must beat a shadowing redeclaration');
  assert.equal(classifyExport({ ...base, occurrences: 2, words: has }), 'internal', 'in-file use must beat a shadowing redeclaration');
});

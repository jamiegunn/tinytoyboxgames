import { Scene, Vector3, Color, FogExp2, type Mesh, type Object3D } from 'three';
import { createGameLighting } from '@app/minigames/shared/sceneSetup';
import type { GameLights } from '@app/minigames/shared/sceneSetup';
import type { DisposalScope } from '@app/utils/disposal';
import { buildOceanSurface, buildAnemones, buildRocks, buildTreasureChest, buildCausticLights } from './scenery';
import type { CausticLight } from './scenery';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import { buildReefTerrain, getTerrainHeight } from './terrain';
import { placePropsByDensity, createSeededRandom } from './placement';
import { REEF_REGIONS } from './regions';
import { buildCoral, buildPlant, type CoralType, type PlantType } from './coralFactory';
import { buildReefLitter, disposeReefLitter, type ReefLitter } from './reefLitter';

/**
 * Scene-level assembly: camera, lighting rig, and environment meshes.
 * Orchestrates scenery constructors and returns handles for teardown.
 */

/** All disposable resources created during scene setup. */
export interface SceneEnvironment {
  lights: GameLights;
  causticLights: CausticLight[];
  /** Static floor light patches, kept only so teardown can dispose them. */
  causticPatches: Object3D;
  reefFloor: Mesh;
  waterSurface: Object3D;
  corals: Object3D[];
  seaweeds: Object3D[];
  anemones: Mesh[];
  rocks: Object3D[];
  treasureChest: Mesh;
  /** Dense instanced seabed scatter — two draw calls for the whole reef. */
  reefLitter: ReefLitter;
}

/**
 * The reef's light rig, as data rather than as five literals inside a call.
 *
 * WHY THIS IS A CONSTANT AND NOT JUST ARGUMENTS. The exposure budget further
 * down derives the irradiance this rig lands on flat sand, and that derived
 * triple is the input to every colour decision in this game — the fish palette
 * in `types.ts`, the sand albedo in `terrain.ts`, the water colour above. It
 * was derived in a COMMENT. A number that lives only in a comment can be read
 * by a human and copied by a human, and it was: `types.ts:16` transcribes this
 * triple, `.probe/render/r8-species-palette.mjs` copied that transcription, and
 * the copy is wrong in the blue channel. Nothing could have caught that,
 * because there was no expression anywhere in the program to disagree with.
 *
 * So the rig is data and the irradiance is a function. `reefIrradiance()` is
 * not consumed at runtime — the shading is done by three.js, not by us — and
 * that is the point: it exists so that the number the documentation and the
 * probes quote is PRODUCED rather than transcribed, and so that a test can pin
 * it. See `tests/minigames/little-shark-rig.test.mjs`.
 */
export const REEF_RIG = {
  /**
   * Unnormalised. `createGameLighting` is handed the normalised copy; the
   * irradiance derivation takes |y| of the same normalisation, so the two can
   * never disagree about which way the key points.
   */
  keyDirection: new Vector3(0.8, -1, 0.45),
  keyIntensity: 0.72,
  hemiIntensity: 0.5,
  pointIntensity: 1.0,
  /**
   * All three colours are authored in the working (linear) space, the space
   * `new Color(r, g, b)` writes to. `createGameLighting` hard-codes white, so
   * these are applied to the returned light objects afterwards.
   */
  keyColor: new Color(1.0, 0.96, 0.88),
  hemiSkyColor: new Color(0.06, 0.3, 0.6),
  hemiGroundColor: new Color(0.3, 0.26, 0.18),
  pointColor: new Color(0.55, 0.8, 1.0),
  /** Dialled down from the project default 0.24 and restored on teardown. */
  environmentIntensity: 0.012,
  /**
   * Average environment radiance E, FITTED against measured pixels of a shipped
   * build rather than derived. It is the one term here that is not a rig
   * setting, and it is the least certain: see the sensitivity note in the
   * exposure budget below.
   */
  environmentRadiance: 3.68,
} as const;

/**
 * The water the reef is seen through: background colour and fog density.
 *
 * Same reason as REEF_RIG. These two are the OTHER half of every rendered
 * figure in this game — the display-space fog lerp is the last step of the
 * chain, after tone mapping and sRGB encode — and they were inline literals
 * inside `setupSceneEnvironment`, unreachable by anything that wanted to check
 * a colour. `.probe/render/r8-species-palette.mjs` consequently carried
 * `const WATER = [0.004, 0.107, 0.2961]` and `const FOG_DENSITY = 0.058` by
 * hand, and the value of a hand-copy is pinned by nothing.
 *
 * Linear space, like every colour in this file.
 */
export const REEF_WATER = {
  color: new Color(0.004, 0.107, 0.2961),
  fogDensity: 0.058,
} as const;

/**
 * Irradiance this rig lands on flat, upward-facing sand, per linear channel.
 *
 * Three.js shades Lambert diffuse as `albedo * irradiance / PI` for punctual
 * lights plus `albedo * environmentIntensity * E` for the PMREM ambient, so:
 *
 *   key   colour * intensity * |dir.y| / PI     (|dir.y| is the cosine for an
 *                                                up-facing surface)
 *   hemi  skyColour * intensity / PI            (an up-facing surface sees the
 *                                                sky half, never the ground)
 *   env   environmentIntensity * E              flat in every channel
 *
 * WHAT THIS DOES NOT MODEL, stated next to the number because it is the kind of
 * number that gets quoted: it is flat sand only — any tilted surface takes a
 * different key cosine and a blend of sky and ground — and it omits the accent
 * point light entirely, which contributes about 1.0 / 3.7^2 = 0.07 before the
 * 1/PI near the shark and nothing at all on the seabed.
 *
 * WHY IT TAKES THE RIG AS A PARAMETER when there is only ever one rig: so that
 * the derivation can be driven by a test rather than only by this module. Round
 * 9 learned that the hard way — a check whose only evidence was a mutation of
 * the live tree stopped being verifiable the moment the tree was edited. With
 * the rig as an argument a test can perturb one field at a time and prove every
 * term is load-bearing, which is the difference between pinning a number and
 * pinning the expression that produces it.
 *
 * @param rig - The rig to derive from; defaults to the reef's own.
 * @returns Linear irradiance as `[r, g, b]`.
 */
export function reefIrradiance(
  rig: {
    keyDirection: Vector3;
    keyIntensity: number;
    hemiIntensity: number;
    keyColor: Color;
    hemiSkyColor: Color;
    environmentIntensity: number;
    environmentRadiance: number;
  } = REEF_RIG,
): [number, number, number] {
  const keyCosine = Math.abs(rig.keyDirection.clone().normalize().y);
  const environment = rig.environmentIntensity * rig.environmentRadiance;
  const channel = (key: number, sky: number): number => (key * rig.keyIntensity * keyCosine) / Math.PI + (sky * rig.hemiIntensity) / Math.PI + environment;
  return [channel(rig.keyColor.r, rig.hemiSkyColor.r), channel(rig.keyColor.g, rig.hemiSkyColor.g), channel(rig.keyColor.b, rig.hemiSkyColor.b)];
}

// Thickens the reef inside each coloured region.
//
// THESE PROPS DO NOT CARRY REGION LEGIBILITY, AND THAT IS MEASURED. A 49-site
// lattice was captured three times with the same 24x14 block instrument: with no
// regions at all, with floor colour but this function ablated, and as shipped.
// r^2(region-field distance, frame difference) went 0.001 -> 0.815 -> 0.806, and
// max frame dE 11.01 -> 26.45 -> 25.93. The floor colour alone produces the
// entire frame-scale effect; adding the thickets moves it very slightly the
// WRONG way, because they add prop content that region and non-region frames
// have in common. See the ablation table in regions.ts.
//
// So the justification is close range only, and it is a design claim rather than
// a measured one: standing inside a region, it should look like a place rather
// than a tinted patch of the same empty sand. If that ever has to be defended,
// it needs its own measurement at close range — the frame-scale numbers above
// are evidence AGAINST a distance role, not for one.
//
// 30 props inside the region core (radius 0.45 * 18 = 8.1, area 206 square
// units) = 0.146 per square unit, against the 290 props spread over the
// radius-55 disc = 0.031 per square unit. 4.8x the open reef's density.
//
// Cost: 90 extra props at the 1-2 draw calls `collapseByMaterial` leaves each
// one, so up to +180 draws on top of the ~580 the existing scatter already
// spends. Every one of them sits inside a region core, which is 3 x 206 = 618 of
// the arena's 10,000 square units, so at most one thicket is ever in shot.
//
// Nothing here is taller than about two units, and that is a measured ceiling,
// not a style choice. The follow camera is pitched 37.3 degrees down with a
// 24.4-degree half fov, so the greatest world height still inside the frame is
// 3.37 units at 5 ahead, 2.22 at 10, 1.08 at 15 and below the floor at 20. The
// props keep their factory colours: the floor is the measured channel (see
// regions.ts), and tinting props per region would be an unmeasured claim laid on
// top of a measured one.
function buildRegionThickets(scene: Scene, corals: Object3D[], seaweeds: Object3D[]): void {
  const rand = createSeededRandom(20260726);
  // Natural heights at scale 1.0, measured off the factory: brain 0.70,
  // staghorn 0.94, fan 1.02, tube 0.78, mushroom 0.50, kelp 1.36, seaGrass 0.74,
  // fern 0.63. The scale ranges below keep every one of them under 2.1.
  const coralKinds: CoralType[] = ['brain', 'staghorn', 'fan', 'tube', 'mushroom'];
  const plantKinds: PlantType[] = ['kelp', 'seaGrass', 'fern'];

  for (const region of REEF_REGIONS) {
    // Placed inside the core (0.45 of the radius), where the floor colour is at
    // full strength, so the thicket and the colour mark the same spot.
    const core = region.radius * 0.45;
    for (let i = 0; i < 30; i++) {
      // sqrt of a uniform draw spreads the points evenly by area rather than
      // piling them at the centre.
      const r = Math.sqrt(rand()) * core;
      const a = rand() * Math.PI * 2;
      const px = region.x + Math.cos(a) * r;
      const pz = region.z + Math.sin(a) * r;

      const isCoral = rand() < 0.55;
      const group: Object3D = isCoral
        ? buildCoral(coralKinds[Math.floor(rand() * coralKinds.length)], undefined, 1.3 + rand() * 0.7)
        : buildPlant(plantKinds[Math.floor(rand() * plantKinds.length)], undefined, 1.2 + rand() * 0.35);
      group.position.set(px, getTerrainHeight(px, pz), pz);
      group.rotation.y = rand() * Math.PI * 2;
      scene.add(group);
      (isCoral ? corals : seaweeds).push(group);
    }
  }
}

/**
 * Sets up the full underwater scene: camera, lighting, and all environment meshes.
 * @param scene - The Three.js scene.
 * @param scope - Disposal scope that frees the lighting rig on teardown.
 * @returns All environment handles for update/teardown.
 */
export function setupScene(scene: Scene, scope: DisposalScope): SceneEnvironment {
  // ── Frame geometry: what is actually on screen ──────────────────────
  //
  // Everything below depends on this, so it is stated first and it is measured,
  // not assumed.
  //
  // CORRECTION (this pass). This block used to quote the MANIFEST camera — an
  // orbit descriptor at polar 0.95, distance 10 about (0, 0.5, 0), giving eye
  // (0, 6.317, -8.134) and a pitch of 35.6 degrees. That camera never renders.
  // `camera/followCamera.ts` overwrites both position and orientation every
  // frame: it springs the eye toward the shark plus LEAD_OFFSET and then calls
  // `camera.lookAt(lookAtX, LOOK_TARGET_Y = 0.35, lookAtZ)`. The steady state
  // an idle shark settles into is eye (0.300, 6.3168, -7.8342) looking at
  // (0, 0.35, 0), i.e. along (-0.030, -0.606, 0.795) once normalised —
  // pitched 37.3 degrees BELOW horizontal, not 35.6. The vertical FOV is
  // 0.85 rad, a 24.4-degree half-angle.
  //
  // 37.3 > 24.4, so the TOP of the frame still points 12.9 degrees below the
  // horizon. There is no horizon, no water column and no surface anywhere in
  // shot: every pixel is reef floor. Raycasting the twelve horizontal twelfths
  // of the frame through the real scene graph hits terrain_reef_floor in all of
  // them, at view depths
  //
  //   top    27.6  22.8  20.7  18.4  16.9  15.6  14.1  12.8  11.7  10.8  10.1  9.4   bottom
  //
  // The vertical gradient in this game is therefore a DISTANCE ramp, not a
  // depth ramp. The bottom of the frame is the near sand and the top is the far
  // sand; "brighter toward the surface at the top of frame" is not achievable
  // without changing the camera, and trying to invert the ramp by lighting can
  // only be done by making the near sand darker than the far haze, which is
  // what a silt cloud looks like, not a reef. What the frame can and should do
  // is go warm and lit at the near end and deep blue at the far end.

  // ── Water colour ────────────────────────────────────────────────────
  //
  // scene.background and the fog colour are NOT tone-mapped. Both go through
  // getUnlitUniformColorSpace (WebGLMaterials.refreshFogUniforms /
  // WebGLBackground), so a linear triple here is sRGB-encoded and written
  // straight to the framebuffer.
  //
  // In meshphysical.glsl the chunk order is opaque_fragment -> tonemapping ->
  // colorspace -> fog_fragment, so fog is a lerp in *display* space between the
  // shaded floor and this colour, and every pixel of the frame lies on the
  // straight line between those two endpoints. That line is the whole image, so
  // both of its ends have to be worth looking at.
  //
  // The previous value, linear (0.0006, 0.007, 0.026), encodes to rgb(2, 20,
  // 45): display luminance 18 and chroma 43. Paired with a floor that rendered
  // at rgb(223, 220, 211) it gave a 200-level ramp from near-white to near-
  // black whose every intermediate value passes through neutral grey — which is
  // exactly what the shipped frame measured as (chroma 3 to 6 across the bottom
  // two thirds).
  //
  // Linear (0.0040, 0.1070, 0.2961) encodes to rgb(13, 92, 148): display
  // luminance 79 and chroma 135, a real tropical blue rather than a black hole.
  // The floor is brought down to meet it (see the exposure budget below), so
  // the ramp is now 79 -> 144 in luminance and 135 -> 26 in chroma instead of
  // 18 -> 220 and 43 -> 13.
  // Cloned, not aliased: REEF_WATER.color is module state and the scene must
  // not be able to reach back and edit the constant every other reader trusts.
  const WATER_COLOR = REEF_WATER.color.clone();
  scene.background = WATER_COLOR.clone();

  // Underwater haze — shares the background colour exactly so there is no seam
  // where the terrain rim ends.
  //
  // FogExp2 gives 1 - exp(-(d * density)^2). At 0.058 the half-fade lands at
  // sqrt(ln 2) / 0.058 = 14.4 units, which against the measured band depths
  // above works out as:
  //   9.4 units  (bottom of frame, the shark's own neighbourhood): 26% water
  //   15.6 units (mid frame):                                      55%
  //   20.7 units:                                                  76%
  //   27.6 units (top of frame):                                   92%
  //
  // Density is the single control over how much of the frame is water colour
  // and how much is sand colour, and it trades the two off directly. Modelled
  // per-band chroma at 0.058 runs 123 (top) to 19 (bottom); at 0.045 it runs
  // 105 to 16 and the frame loses its blue, and at 0.070 the near sand is 40%
  // water and the orange fish stop reading as orange.
  scene.fog = new FogExp2(WATER_COLOR.getHex(), REEF_WATER.fogDensity);

  // Camera comes from the manifest (an orbit descriptor) applied to the shell
  // camera; the follow cam drives it thereafter. See architecture-standards.md#cameradescriptor.

  // ── Exposure budget ─────────────────────────────────────────────────
  //
  // The renderer is ACES filmic at exposure 1.15 (utils/rendererFactory.ts) and
  // three.js shades Lambert diffuse as albedo * irradiance / PI for punctual
  // lights, plus albedo * environmentIntensity * E for the PMREM ambient the
  // shell installs (minigames/framework/MiniGameShell.tsx:110, RoomEnvironment
  // at the project default scene.environmentIntensity = 0.24).
  //
  // Fitting the real pipeline — ACES at 1.15, sRGB encode, then the display-
  // space fog lerp — against measured pixels of a shipped build gives an average
  // environment radiance E of 3.68.
  //
  // The previous rig here put the whole budget on a white key:
  //     key  2.60 * 0.941 / PI = 0.779  (88%)
  //     hemi 0.12 / PI         = 0.038  ( 4%)
  //     env  0.02 * 3.68       = 0.074  ( 8%)
  //     total                    0.888  in every channel
  // and 0.888 is far too much light. Sand at albedo (0.90, 0.82, 0.62) becomes
  // linear (0.80, 0.73, 0.55), and ACES at 1.15 maps that to rgb(223, 220, 211)
  // — display luminance 220 and chroma 13. (The figure of rgb(196, 189, 168)
  // this comment used to quote was simply arithmetically wrong.) Two things
  // follow, and together they are the defect this scene had:
  //
  //   1. ACES is a strong desaturator near the top of its curve. The sand's own
  //      albedo has 38 levels of sRGB chroma; at an irradiance of 0.888 only 13
  //      survive. Sweeping the irradiance shows this albedo peaks at about 24
  //      levels of retained chroma around 0.20-0.30 and falls monotonically
  //      after that, so no choice of light colour recovers it at 0.888.
  //   2. There is no headroom left above the floor. Caustics, coral highlights
  //      and lit fish all clip into the same near-white, and the difference
  //      between a +15-degree and a -15-degree sand slope is 6.4 display levels
  //      — which is why the seabed had no visible texture or shape.
  //
  // So the budget comes down by a factor of four and gets a colour. Sunlight
  // that has been through several metres of water is barely warm; the ambient
  // it scatters back down is strongly blue. Splitting it that way:
  //     key  (1.00, 0.96, 0.88) * 0.72 * 0.7367 / PI = (0.1688, 0.1621, 0.1486)
  //     hemi (0.06, 0.30, 0.60) * 0.50 / PI          = (0.0095, 0.0477, 0.0955)
  //     env  0.012 * 3.68                            =  0.0442 flat
  //     total                                         (0.2226, 0.2540, 0.2882)
  //
  // THAT ARITHMETIC IS NOW PERFORMED BY `reefIrradiance()` ABOVE. The rows are
  // kept as the derivation's SHAPE — which term is which, and how big each one
  // is — and every figure in them is now checked against the expression by
  // `tests/minigames/little-shark-rig.test.mjs`, including the total. What
  // follows is why that check exists, and it is worth reading before quoting any
  // number out of this block again.
  //
  // THE TOTAL ROW USED TO READ (0.2226, 0.2540, 0.2883), AND IT WAS NOT A
  // ROUNDING OF ANYTHING. A four-decimal table admits two different correct
  // last digits, and this one silently used one method per channel:
  //
  //     computed at full precision, then rounded    0.2226, 0.2540, 0.2882
  //     the printed rows above, added as printed    0.2225, 0.2540, 0.2883
  //     what the total row actually said            0.2226, 0.2540, 0.2883
  //
  // Red came from the first method and blue from the second. Both methods are
  // defensible; taking one digit from each is not, and nothing could have said
  // so, because there was no expression anywhere in the program to disagree
  // with a comment. (The cosine label was part of the same softness: the rows
  // are computed at |direction.y| = 0.7367094687 and were labelled 0.737, at
  // which they would read 0.1689 and 0.1622. It now says 0.7367.)
  //
  // AND THAT AMBIGUITY IS THE COVER THE REAL DEFECT HID UNDER. `types.ts:16`
  // transcribed this total as (0.2225, 0.2540, 0.2889). Its red is the honest
  // row-sum reading of the table — a reader could arrive at it correctly — but
  // its blue is 0.2889 against a table that says 0.2883 and an expression that
  // says 0.2882. That is one hand-changed digit, worth 0.00067, and it is the
  // only one. `.probe/render/r8-species-palette.mjs` then copied THAT and cited
  // it as `// types.ts:16`: three hops from this expression, corruption at hop
  // two, a probe treating hop three as source.
  //
  // The first draft of this correction claimed the red had drifted too, "in the
  // opposite direction, which no rounding rule produces". The test written to
  // pin this table refuted that before it shipped. Round 10 is written up in
  // docs/reviews/2026-07-30-rooms-five-rounds.md, including that.
  //
  // The key is 76% of it, the hemisphere 4-33% depending on channel, and the
  // ambient 15-20%, so the scene still has one dominant direction and things
  // still have a lit side and a shaded side.
  //
  // 0.737 is |direction.y| after normalising (0.8, -1, 0.45), which puts the key
  // 42.5 degrees off vertical instead of the old (0.3, -1, 0.2)'s 19.8. That is
  // deliberate and it is close to the physical limit: refraction at a flat
  // surface compresses the whole sky into Snell's window, a cone of half-angle
  // asin(1/1.333) = 48.6 degrees, so no underwater sun can rake harder than
  // that. The reason to go to the edge of it is that the measured seafloor is
  // shallow — raycasting the visible wedge gives face normals with a median
  // tilt of 6.7 degrees and a maximum of 19.9 — and how much a 7-degree slope
  // changes the shading depends entirely on where on the cosine curve the key
  // sits. At 19.8 degrees off vertical, +/-7 degrees moves dotNL from 0.99 to
  // 0.87 (a 12% swing); at 42.5 degrees it moves from 0.81 to 0.65 (a 25%
  // swing). Measured on a rendered frame, that doubling raises the standard
  // deviation of the luminance residual after the per-row mean is subtracted —
  // a texture score that a vertical gradient cannot inflate — by 23%.
  //
  // Reef sand at albedo (0.93, 0.80, 0.48) now renders linear
  // (0.208, 0.204, 0.139) -> rgb(147, 145, 121): luminance 144 against a water
  // colour of luminance 79, and 26 levels of chroma instead of 13. The
  // +/-15-degree slope test now spans 15.5 display levels rather than 6.4.
  //
  // Sensitivity: the environment term is 15-20% of the total, so even a 40%
  // error in the E = 3.68 fit moves the floor by under 8% (about 5 display
  // levels). The result is dominated by the key and the water colour, both of
  // which are set here exactly.
  //
  // The accent point light sits at the rig default (0, 4, -1) with inverse-square
  // decay, so around the shark it contributes 1.0 / 3.7^2 = 0.07 before the 1/PI
  // — a soft top-light on whatever swims up near the surface, not a budget item.
  //
  // 0.24 is the project-wide default for a scene lit like a room; this one is
  // lit like the sea, so it is dialled down here and put back on teardown.
  const previousEnvIntensity = scene.environmentIntensity;
  scene.environmentIntensity = REEF_RIG.environmentIntensity;
  scope.add(() => {
    scene.environmentIntensity = previousEnvIntensity;
  });

  const lights = createGameLighting(
    scene,
    {
      name: 'shark',
      direction: REEF_RIG.keyDirection.clone().normalize(),
      directionalIntensity: REEF_RIG.keyIntensity,
      hemisphericIntensity: REEF_RIG.hemiIntensity,
      pointIntensity: REEF_RIG.pointIntensity,
    },
    scope,
  );

  // createGameLighting hard-codes white for all three lights, which is right for
  // a game lit like a room and wrong for one lit through six metres of seawater.
  // It returns the light objects, so the colours are set here rather than by
  // widening the shared rig's options — this scene is the only caller that wants
  // them. All three are authored in the working (linear) colour space, the same
  // space `new Color(r, g, b)` writes to.
  //
  // Key: filtered sunlight, only slightly warm — most of the red is already gone
  // by this depth, and taking more out would leave the orange and yellow fish
  // with no red channel to render.
  lights.directionalLight.color.copy(REEF_RIG.keyColor);
  // Fill: sky is the blue column overhead, ground is warm light bounced off the
  // sand. A hemisphere with sky !== ground is what makes an upward-facing sand
  // slope read as a different colour from a downward-facing one.
  lights.ambientLight.color.copy(REEF_RIG.hemiSkyColor);
  lights.ambientLight.groundColor.copy(REEF_RIG.hemiGroundColor);
  // Accent: a cool pool of light where the shark surfaces.
  lights.pointLight.color.copy(REEF_RIG.pointColor);

  // Nothing in this scene sets castShadow: the reef floor, all 290 props, the
  // shark and the fish are built without it, so the shadow map renders an empty
  // depth pass every frame and samples it for every lit fragment.
  // configureKeyShadow (utils/lighting/lightingRig.ts) turns it on
  // unconditionally for every game, which is the right default when there are
  // casters; here it is a whole extra scene traversal and a 2048-square depth
  // target for a result that is uniformly "unshadowed".
  lights.directionalLight.castShadow = false;

  // Build environment meshes — no ocean walls for infinite reef
  const reefFloor = buildReefTerrain(scene, 60.0);
  const waterSurface = buildOceanSurface(scene);

  // Poisson-placed corals and plants across the large reef
  const placedProps = placePropsByDensity({
    radius: 55.0,
    seed: 12345,
    props: [
      { type: 'coral_brain', count: 30, minSpacing: 4.0, zone: 'middle' },
      { type: 'coral_staghorn', count: 35, minSpacing: 3.5, zone: 'middle' },
      { type: 'coral_fan', count: 25, minSpacing: 4.0, zone: 'outer' },
      { type: 'coral_tube', count: 25, minSpacing: 3.5, zone: 'inner' },
      { type: 'coral_mushroom', count: 20, minSpacing: 4.0, zone: 'outer' },
      { type: 'plant_kelp', count: 40, minSpacing: 3.0, zone: 'middle' },
      { type: 'plant_seaGrass', count: 50, minSpacing: 2.5, zone: 'any' },
      { type: 'plant_fern', count: 30, minSpacing: 3.0, zone: 'outer' },
      { type: 'plant_moss', count: 35, minSpacing: 2.5, zone: 'inner' },
    ],
  });

  const corals: Object3D[] = [];
  const seaweeds: Object3D[] = [];

  for (const prop of placedProps) {
    const y = getTerrainHeight(prop.x, prop.z);
    let group: Object3D;

    if (prop.type.startsWith('coral_')) {
      const coralType = prop.type.replace('coral_', '') as CoralType;
      group = buildCoral(coralType, undefined, prop.scaleFactor);
      corals.push(group);
    } else {
      const plantType = prop.type.replace('plant_', '') as PlantType;
      group = buildPlant(plantType, undefined, prop.scaleFactor);
      seaweeds.push(group);
    }

    group.position.set(prop.x, y, prop.z);
    group.rotation.y = prop.rotationY;
    scene.add(group);
  }

  buildRegionThickets(scene, corals, seaweeds);

  // Small-scale scatter. This is what makes the seabed read as a reef floor
  // rather than a sand-coloured gradient: the 290 placed props above are spread
  // uniformly by area, which puts 71% of the ones in shot into the far bands
  // where fog has taken 77-91% of their contrast. See reefLitter.ts for the
  // measured ground-area-per-frame-band table that sets its density.
  const reefLitter = buildReefLitter(scene);

  const anemones = buildAnemones(scene);
  const rocks = buildRocks(scene);
  const treasureChest = buildTreasureChest(scene);
  const { lights: causticLights, patches: causticPatches } = buildCausticLights(scene);

  return {
    lights,
    causticLights,
    causticPatches,
    reefFloor,
    waterSurface,
    corals,
    seaweeds,
    anemones,
    rocks,
    treasureChest,
    reefLitter,
  };
}

/**
 * Disposes all environment resources created by setupScene.
 * @param env - The scene environment to tear down.
 */
export function teardownScene(env: SceneEnvironment): void {
  // Dispose the static floor caustic patches, which used to leak entirely
  disposeMeshDeep(env.causticPatches);

  // Dispose caustic lights
  for (const cl of env.causticLights) {
    cl.mesh.geometry?.dispose();
    (cl.mesh.material as import('three').Material)?.dispose();
    cl.mesh.removeFromParent();
  }

  // Dispose corals
  for (const c of env.corals) {
    disposeMeshDeep(c);
  }

  // Dispose seaweeds
  for (const w of env.seaweeds) {
    disposeMeshDeep(w);
  }

  // Dispose anemones
  for (const a of env.anemones) {
    disposeMeshDeep(a);
  }

  // Dispose rocks
  for (const r of env.rocks) {
    disposeMeshDeep(r);
  }

  // Dispose treasure chest
  disposeMeshDeep(env.treasureChest);

  // Dispose the instanced litter. InstancedMesh owns a GPU-side instance buffer
  // that geometry.dispose() does not touch, so it needs its own dispose() too.
  disposeReefLitter(env.reefLitter);

  // Dispose water surface
  disposeMeshDeep(env.waterSurface);

  // Dispose reef floor
  disposeMeshDeep(env.reefFloor);

  // Lights are freed by the shell's disposal scope; the camera is the shell's.
}

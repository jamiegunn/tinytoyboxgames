import gsap from 'gsap';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, PlaneGeometry, TorusGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial, createToyMetalMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { LEFT_WALL_FACE_X, PEG_RAIL_Y, PEG_RAIL_Z, WALL_CLOCK_Y, WALL_CLOCK_Z } from '../layout';

/**
 * Left-wall dressing: a peg rail of hanging cloths, and a wall clock.
 *
 * The left wall measured 80.7% flat above the furniture line — better than the
 * right wall's 97.7% only because the doorway to the Living Room interrupts it.
 * The doorway is at z = 2.4, so these two pieces sit either side of it rather
 * than fighting it: the rail behind, the clock forward.
 *
 * The cloths are felt and they HANG, which is the point of choosing them over
 * another framed rectangle. Soul: every surface must feel like something a
 * child could touch. A wall of flat panels passes the flatness measurement and
 * fails that, and the measurement is the servant here, not the master.
 */

/** Peg rail length along Z. */
const RAIL_LENGTH = 2.2;

/** One hanging cloth: offset along the rail, size, colour. */
interface ClothSpec {
  z: number;
  width: number;
  height: number;
  color: Color;
}

const CLOTHS: ClothSpec[] = [
  { z: -0.72, width: 0.46, height: 0.86, color: new Color(0.86, 0.42, 0.36) },
  { z: -0.04, width: 0.52, height: 1.06, color: new Color(0.95, 0.93, 0.86) },
  { z: 0.68, width: 0.44, height: 0.78, color: new Color(0.5, 0.66, 0.72) },
];

/**
 * Creates the left-wall peg rail with three hanging cloths and the round wall
 * clock forward of the doorway. Tapping a cloth makes it sway on its peg with
 * a soft rustle and a sparkle.
 *
 * @param scene - The Three.js scene that receives the groups.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup that unregisters the cloth taps and kills their tweens.
 */
export function createWallPegs(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'kitchen_wallPegs';
  // Inward from the left wall face is -X.
  root.position.set(LEFT_WALL_FACE_X, PEG_RAIL_Y, PEG_RAIL_Z);
  scene.add(root);

  const woodMat = createWoodMaterial('kitchen_pegRailMat', new Color(0.7, 0.52, 0.33));

  const board = new Mesh(new BoxGeometry(0.07, 0.26, RAIL_LENGTH), woodMat);
  board.name = 'pegRailBoard';
  board.position.set(-0.035, 0, 0);
  board.castShadow = true;
  root.add(board);

  const cleanups: (() => void)[] = [];

  CLOTHS.forEach((spec, index) => {
    const peg = new Mesh(new CylinderGeometry(0.028, 0.036, 0.16, 8), woodMat);
    peg.name = `pegKnob${index}`;
    peg.position.set(-0.14, 0, spec.z);
    peg.rotation.z = Math.PI / 2;
    root.add(peg);

    const pivot = new Group();
    pivot.name = `clothPivot${index}`;
    pivot.position.set(-0.16, -0.04, spec.z);
    root.add(pivot);

    const cloth = new Mesh(new PlaneGeometry(spec.width, spec.height), createFeltMaterial(`kitchen_cloth${index}Mat`, spec.color));
    cloth.name = `cloth${index}`;
    cloth.position.set(0, -spec.height / 2, 0);
    cloth.rotation.y = -Math.PI / 2;
    cloth.castShadow = true;
    pivot.add(cloth);

    // A contrasting hem band, so the cloth is not one flat rectangle of colour.
    const hem = new Mesh(new PlaneGeometry(spec.width, 0.12), createFeltMaterial(`kitchen_clothHem${index}Mat`, spec.color.clone().multiplyScalar(0.72)));
    hem.name = `clothHem${index}`;
    hem.position.set(-0.004, -spec.height + 0.09, 0);
    hem.rotation.y = -Math.PI / 2;
    pivot.add(hem);

    cleanups.push(
      createTapInteraction(dispatcher, cloth, () => {
        triggerSound('sfx_hub_toybox_tap');
        getParticleEngine(scene).emit(PARTICLES.sceneSparkle, cloth.getWorldPosition(new Vector3()).add(new Vector3(0, 0.1, 0)));

        gsap.killTweensOf(pivot.rotation);
        pivot.rotation.x = 0;
        gsap.fromTo(pivot.rotation, { x: 0.4 }, { x: 0, duration: 1.3, ease: 'elastic.out(1, 0.3)' });
      }),
    );
  });

  createWallClock(scene);

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    CLOTHS.forEach((_, index) => {
      const pivot = root.getObjectByName(`clothPivot${index}`);
      if (pivot) {
        gsap.killTweensOf(pivot.rotation);
      }
    });
  };
}

/**
 * Outer radius of the painted bezel. 0.44 → 0.49, so that the bezel annulus is
 * 0.120 wide rather than 0.070. See `CLOCK_FACE_RADIUS` and the docblock below;
 * derivation in `docs/reviews/2026-07-31-fix-g-clock-registration.md`.
 */
const CLOCK_RADIUS = 0.49;

/**
 * Radius of the pale dial. HELD at its previous value while the bezel grew,
 * because the dial's contents measurably read at their current size — ticks at
 * 2.54 px and hands at 2.15 px, both legible in the render — and there was no
 * reason to disturb them. Note `CLOCK_FACE_RADIUS - 0.08` is 0.29, which is
 * exactly the old `CLOCK_RADIUS - 0.15`, so the tick ring does not move at all;
 * only what it is anchored TO changes, so it stays put the next time the bezel
 * is touched.
 */
const CLOCK_FACE_RADIUS = 0.37;

/**
 * Local z of the bezel's front plane. Flush with the wall face, which is where
 * it already was — see the docblock below for why it is deliberately NOT pushed
 * proud of the wall.
 *
 * NOT flush — 0.002 proud, and the 0.002 is the whole point. At exactly 0.000
 * the bezel's front cap is exactly the wall face plane at world x = 5.275, and
 * two exactly-coplanar surfaces fight the depth buffer at any precision. It was
 * measured losing 49% of the bezel annulus to the wall.
 *
 * `polygonOffset` on the bezel material arbitrates that tie; 0.002 removes it.
 * At 4 depth ULPs the offset broke the tie over 3–10 o'clock and NOT over 11–2,
 * because a 24-triangle cap and a two-triangle wall do not round the same plane
 * identically across it. 0.002 is ~20 ULP of real separation, and it costs
 * 0.002 × 2.51 × 53.5 = 0.27 px of visible standoff, which is below anything
 * this render resolves.
 */
const BEZEL_FRONT_Z = 0.002;

/**
 * Local z of the dial's front plane. 0.020 proud of the bezel → **0.004**. This
 * single number is what was actually breaking the clock; see below.
 */
const FACE_FRONT_Z = BEZEL_FRONT_Z + 0.004;

/**
 * Creates the round wall clock forward of the doorway: a painted bezel, a pale
 * dial, four tick marks and two hands.
 *
 * Its previous docblock claimed the clock "is the only circle on a wall of
 * rectangles, and it reads instantly as a kitchen." Measured, it did not read as
 * a circle at all. This wall is seen at **68.2° off-normal**, which squashes
 * every world +Z dimension by **0.371** while leaving world +Y alone, and at
 * that incidence the authored 0.070 bezel is 11.0 px at the top and bottom but
 * only **2.7 px at each side**. A ring that is four times thinner at its waist
 * than at its crown does not read as a ring. It reads as a chipped plate.
 *
 * Three numbers govern everything here, all validated against the render to
 * 3–5% by gate H1:
 *
 * ```
 * 144.26 px per world unit at the clock's depth (12.83 along the view axis)
 *   0.371 in-plane squash across world +Z  ->  53.5 px per world unit sideways
 *   2.51  units of lateral occlusion per unit of DEPTH
 * ```
 *
 * **1. The bezel is widened to the one width that observably works.** 0.070 →
 * **0.120**, by `CLOCK_RADIUS` 0.44 → 0.49 with the dial held at 0.37. 0.120 is
 * not a taste: 6.76 px was the widest slice of bezel in the previous render and
 * the only one that visibly read, and 0.120 is the width that puts 6.76 px on
 * both sides instead of one. Top and bottom go to 17.3 px.
 *
 * **2. The dial stops standing proud of its own bezel.** `face` used to span
 * local z [−0.08, +0.02] against `rim`'s [−0.09, 0.00], so the dial front stood
 * **0.020 proud** — and at 2.51 units of lateral shift per unit of depth, that
 * slid the dial's silhouette **0.050** across a 0.070 annulus, leaving 1.15 px
 * of bezel on the far side against 6.76 px on the near one, a 5.9× lopsidedness.
 * Proud-standing is cut 0.020 → **0.004**, which drops the shift to 0.010 and
 * the predicted side widths to 5.88 px and 6.96 px, a ratio of 1.18×.
 *
 * This is NOT what `docs/reviews/2026-07-31-fix-g-clock-registration.md`
 * registered, and the difference is recorded rather than quietly built. That doc
 * asked for the dial to be *recessed behind* the bezel — bezel front at +0.04,
 * dial front at +0.01 — so that "the bezel is in front of the face everywhere
 * and cannot be occluded by it at any angle." **That cannot be built from these
 * two primitives.** Both are solid `CylinderGeometry`; a solid bezel whose front
 * cap sits in front of the dial hides the dial completely. A true rebate needs a
 * hollow bezel — an open-ended cylinder plus a `RingGeometry` front plus an
 * inward-facing rebate wall, or a `LatheGeometry` profile — and a `Torus` was
 * checked and rejected outright, because at 68° incidence its tube presents
 * nearly end-on and projects ~22 px wide, which reads as a wheel and would fail
 * K6 on its own. The buildable form of the same intent is the line above: the
 * proud-standing is what caused the asymmetry, and shrinking it is what cures it.
 *
 * The registration also wanted the whole clock pushed 0.04 off the wall for
 * depth. That was dropped on its own arithmetic: the visible standoff would be
 * the bezel's outer wall on the near side only, which ADDS 0.04 × 2.51 × 53.5 =
 * 5.4 px of red to one side and none to the other — pushing the side ratio to
 * 1.70× and failing K2, to buy a lip that at a 0.01 standoff would be 1.34 px
 * wide, below anything this render has been shown to resolve. It cost a gate and
 * bought nothing visible.
 *
 * **3. The dial is warmed off grey.** Albedo (0.96, 0.95, 0.90) → (0.97, 0.925,
 * 0.82), solving chroma/L to 60% of plaster's at plaster's own hue (41.7°).
 *
 * **Part 3's stated reason was wrong, and is retracted here rather than left
 * standing.** It claimed the dial carried 33% of the wall's relative chroma. It
 * did not. That number came from a mask that selected the dial by brightness —
 * `lum > plaster + 2.5σ` — and 88% of the pixels it selected are not on the
 * clock at all; they are a fixed bright object elsewhere in the same crop, the
 * identical 1721 px in every render because nothing done here touches it.
 * Measured with a mask built from the clock's own projected polar grid, the
 * dial was already at **0.73×** the plaster's relative chroma before part 3,
 * and is at **0.89×** after. The warming was not harmful and it is HELD, but it
 * was prescribed against a defect overstated ~2×, and it cost 1.6 points of
 * dial value (albedo L 0.9485 → 0.927). The same broken mask produced gates H4,
 * H5, K3 and K4; all four measured that other object.
 *
 * **What was actually wrong with the dial is its material, and the number was
 * predicted before it was looked up.** `createGlossyPaintMaterial` adds
 * `clearcoat: 0.7`; the wall it hangs on is `createPlasticMaterial` and has
 * none. Schlick with F₀ = 0.04 at this wall's 68.2° incidence gives F = 0.1345,
 * so the base layer is attenuated to 1 − 0.7 × 0.1345 = **0.906**, and the dial
 * measured **0.899** of the plaster's per-albedo throughput — 0.8% apart. The
 * clear layer returns nothing, because this wall receives zero key light
 * (`dot((-1,0,0), (0.45,0.82,-0.35))` clamps to 0) and `environmentIntensity`
 * is 0.08. The dial's albedo is only 7% brighter than the plaster's in
 * luminance, so a 10% loss puts it BELOW the wall — measured at 4.1 L units
 * below. That is the whole of "the dial reads as a hole," and dropping the
 * clearcoat is the fix.
 *
 * **And the bezel was fighting the wall the entire time.** `BEZEL_FRONT_Z` is
 * exactly 0.0, i.e. exactly the wall face plane, and exactly-coplanar surfaces
 * fight at any depth precision. In the annulus, 48.9% of pixels were the wall
 * showing through — and they are the WALL, not shaded bezel: their mean sits
 * 7.3 RGB from the plaster and 62.1 from the bezel's own red, which is the test
 * that tells z-fighting apart from uneven facet shading. So "the ring cannot
 * close because it is only 2.7 px at the sides" is true arithmetic but it is
 * the *second* term; the first is that half the ring was not being drawn.
 * `polygonOffset` −1/−1 on the bezel material settles it, moves no vertex, and
 * therefore cannot change the silhouette that K1/K2/K6 measure.
 *
 * Known residual, measured and left: the tick on the near side stands 0.019
 * proud of the bezel plane, so its silhouette slides 0.048 outward and overhangs
 * the bezel by 0.023 world ≈ **1.2 px** of the 6.96 px annulus there. That is
 * down from 3.4 px, and pulling the tick ring in to close it would be an
 * unregistered edit to contents that demonstrably read.
 *
 * @param scene - The Three.js scene that receives the clock group.
 */
function createWallClock(scene: Scene): void {
  const root = new Group();
  root.name = 'kitchen_wallClock';
  root.position.set(LEFT_WALL_FACE_X, WALL_CLOCK_Y, WALL_CLOCK_Z);
  root.rotation.y = -Math.PI / 2;
  scene.add(root);

  // The bezel's front cap is exactly coplanar with the wall face, so it must win
  // that tie explicitly — measured, the wall was taking 49% of the annulus.
  //
  // UNITS ONLY, factor deliberately 0. `src/entities/owl/head.ts` uses −1/−1 for
  // the same job, but the owl's iris is viewed near-normal where the factor term
  // (factor × the polygon's max depth slope per pixel) costs nothing. This wall
  // is seen at 68.2°, where that slope is maximal: (1/144.26) × tan(68.2°) =
  // 0.0173 world units of bias, which is 4.4× the dial's 0.004 clearance. Shipped
  // once with −1/−1 and it pulled the bezel in front of its own dial; the clock
  // rendered as a solid red disc.
  //
  // Units are depth ULPs. At this depth one ULP is 9.8e-5 world units, so −4 is
  // 0.00039 — four above coplanar, 10× below the dial standoff.
  const rimMat = createGlossyPaintMaterial('kitchen_clockRimMat', new Color(0.85, 0.4, 0.34));
  rimMat.polygonOffset = true;
  rimMat.polygonOffsetFactor = 0;
  rimMat.polygonOffsetUnits = -4;

  const rim = new Mesh(new CylinderGeometry(CLOCK_RADIUS, CLOCK_RADIUS, 0.09, 24), rimMat);
  rim.name = 'clockRim';
  rim.position.set(0, 0, BEZEL_FRONT_Z - 0.045);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  root.add(rim);

  // Plastic, NOT glossy paint. This wall receives zero key light, so a clearcoat
  // here has nothing to reflect and only costs: Schlick at the wall's 68.2°
  // incidence predicts the base layer is attenuated to 0.906, and the dial
  // measured 0.899 of the plaster's per-albedo throughput. Dropping it moved
  // that to 0.945. The bezel KEEPS its clearcoat on purpose — same plane, same
  // light, one property differing, opposite predicted outcomes.
  //
  // 5.5% of the dial's brightness is still unexplained and is deliberately left
  // as an open number rather than tuned away. The cast shadow was the named
  // suspect and was measured out: plaster luminance in rings 0.6–2.0 units from
  // the clock varies by 1.41 L, non-monotonic, so there is no halo.
  //
  // Albedo (0.97, 0.925, 0.82) → (1.00, 0.955, 0.85): albedo L 0.927 → 0.957,
  // +3.2%, which is sized to close the last 4 L units of the value deficit and
  // nothing more. chroma/L 0.162 → 0.157, so Fix G's warmth is held within 3%.
  const face = new Mesh(
    new CylinderGeometry(CLOCK_FACE_RADIUS, CLOCK_FACE_RADIUS, 0.1, 24),
    createPlasticMaterial('kitchen_clockFaceMat', new Color(1.0, 0.955, 0.85)),
  );
  face.name = 'clockFace';
  face.position.set(0, 0, FACE_FRONT_Z - 0.05);
  face.rotation.x = Math.PI / 2;
  root.add(face);

  // Everything on the dial is anchored to FACE_FRONT_Z at the standoff it
  // already had, rather than to an absolute local z, so that moving the dial
  // moves its contents with it instead of leaving them floating or buried.
  const markMat = createToyMetalMaterial('kitchen_clockMarkMat', new Color(0.32, 0.3, 0.28));
  [0, 1, 2, 3].forEach((quarter) => {
    const angle = (quarter * Math.PI) / 2;
    const mark = new Mesh(new BoxGeometry(0.045, 0.11, 0.02), markMat);
    mark.name = `clockMark${quarter}`;
    mark.position.set(Math.sin(angle) * (CLOCK_FACE_RADIUS - 0.08), Math.cos(angle) * (CLOCK_FACE_RADIUS - 0.08), FACE_FRONT_Z + 0.005);
    mark.rotation.z = -angle;
    root.add(mark);
  });

  // Hands parked at ten past ten, which is where clocks are drawn.
  const hands: { length: number; angle: number; width: number }[] = [
    { length: 0.2, angle: -Math.PI / 3, width: 0.05 },
    { length: 0.28, angle: Math.PI / 6, width: 0.038 },
  ];
  hands.forEach((hand, index) => {
    const bar = new Mesh(new BoxGeometry(hand.width, hand.length, 0.02), markMat);
    bar.name = `clockHand${index}`;
    bar.position.set((Math.sin(hand.angle) * hand.length) / 2, (Math.cos(hand.angle) * hand.length) / 2, FACE_FRONT_Z + 0.01);
    bar.rotation.z = -hand.angle;
    root.add(bar);
  });

  const pin = new Mesh(new TorusGeometry(0.028, 0.012, 6, 10), markMat);
  pin.name = 'clockPin';
  pin.position.set(0, 0, FACE_FRONT_Z + 0.015);
  root.add(pin);
}

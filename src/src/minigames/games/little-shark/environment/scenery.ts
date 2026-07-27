import {
  Scene,
  Mesh,
  Group,
  Color,
  Vector3,
  BufferAttribute,
  DoubleSide,
  SphereGeometry,
  CylinderGeometry,
  BoxGeometry,
  CircleGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
} from 'three';
import { createCoralMaterial, createMetalMaterial } from '@app/minigames/shared/materials';
import { buildDetailedRock } from '@app/minigames/shared/meshBuilders';
import { randomRange } from '../helpers';
import { CAUSTIC_LIGHT_COUNT } from '../types';
import { getTerrainHeight, smoothstep } from './terrain';

/**
 * Baseline floor Y the hand-authored prop positions in this file were written
 * against, back when the terrain was effectively a flat plane.
 *
 * Defect 11 gave the seafloor real relief (basins up to 1.8 units deep), so
 * anything still pinned to this constant would hang in open water over a hollow.
 * `floorOffset` converts an authored Y into one that rides the terrain.
 */
const AUTHORED_FLOOR_Y = -0.5;

// Vertical shift needed at (x, z) to keep an authored-for-flat prop on the sand
function floorOffset(x: number, z: number): number {
  return getTerrainHeight(x, z) - AUTHORED_FLOOR_Y;
}

/**
 * Low-level mesh and light constructors for the underwater environment.
 * Pure constructors — take a Scene and return positioned meshes.
 */

/** A caustic light represented as a small emissive sphere. */
export interface CausticLight {
  mesh: Mesh;
  intensity: number;
}

/** Everything `buildCausticLights` creates, so teardown can free all of it. */
export interface CausticBuild {
  /** The moving emissive spheres, animated by `updateCausticLights`. */
  lights: CausticLight[];
  /**
   * Static floor light patches, grouped so they can be disposed.
   *
   * These used to be loose `scene.add` calls with no handle kept anywhere, so
   * they leaked their geometry and materials on every teardown.
   */
  patches: Group;
}
/**
 * Total additive-overlay alpha budget for the underwater scene.
 *
 * Every translucent, depth-write-disabled, emissive layer in this file paints
 * over whatever the opaque pass already drew — the shark, the fish, the reef.
 * Stack enough of them and the frame washes to white regardless of how the
 * lighting rig is tuned, which is exactly what happened: the water veil alone
 * ran at 0.45 over 100% of the pixels.
 *
 * The budget is expressed as expected alpha over a typical pixel, and as the
 * worst case where every layer happens to overlap:
 *
 *   layer            alpha   screen coverage   contribution
 *   god-ray core     0.20     ~10%             0.020
 *   caustic sphere   0.12      ~1%             0.001
 *   floor patch      0.20      ~4%             0.008
 *                                              ------
 *   expected                                    0.029
 *
 *   The god-ray figure is its centre-line peak; the alpha gradient in
 *   buildLightShaftGeometry averages 0.5 across the shaft and 0.7 along it, so
 *   a ray's mean alpha is only 0.20 * 0.35 = 0.070.
 *
 *   worst realistic stack. It is NOT all three at once: a shaft's `along`
 *   profile is faded to near zero over its bottom 55%, which is precisely the
 *   part that overlaps the sand, so a ray and a floor patch never both
 *   contribute meaningful alpha to the same pixel. The two real stacks are
 *     ray + sphere:   1 - (1-0.20)(1-0.12) = 0.296
 *     patch + sphere: 1 - (1-0.20)(1-0.12) = 0.296
 *
 * The 100%-coverage water veil that used to head this table is gone — see
 * buildOceanSurface. It was both the largest single entry in the budget and
 * the most expensive fragment shader in the scene.
 *
 * Targets: ~0.12 typical, 0.25 acceptable, 0.35 ceiling for a realistic
 * overlap. That leaves at least 65% of every pixel showing the shaded scene,
 * so the shark and the fish stay the highest-contrast things on screen and the
 * atmosphere stays subordinate.
 *
 * The patch and ray alphas were both 0.12/0.16 while the reef floor was
 * rendering at display luminance 220 — against that there was nothing for a
 * bright overlay to add, and the sand read as a featureless wash. The floor now
 * lands at 144 (environment/terrain.ts), so a 0.20 overlay of the near-white
 * these unlit materials tone-map to lifts it by about 19 display levels: a
 * caustic that is actually visible, still inside the budget above.
 *
 * The three numbers below are the only places these alphas are set; the caustic
 * pulse in environment/effects.ts modulates around the same values.
 */
const GOD_RAY_ALPHA = 0.2;

/** Alpha of a floating caustic sphere. */
const CAUSTIC_SPHERE_ALPHA = 0.12;

/** Alpha of a static caustic patch painted on the sand. */
const CAUSTIC_PATCH_ALPHA = 0.2;

// Builds a light-shaft plane whose alpha fades to zero at every geometry edge.
//
// A flat PlaneGeometry with a uniform material alpha is a rectangle, and at
// 1.4 x 5.5 units (~125 x 490 px at this camera) that is exactly what the eye
// saw: hard-edged lighter panels, not shafts of light.
//
// The fix is per-vertex alpha. three.js switches on USE_COLOR_ALPHA when
// `vertexColors` is set and the color attribute has itemSize 4, then multiplies
// diffuseColor (rgb *and* alpha) by it, so the material opacity below becomes
// the peak and the profile does the rest:
//
//   across (u in [0,1], 0.5 = centre-line):  cos(|u - 0.5| * PI)^2
//     -> 1 at the centre, 0 at both side edges, with a soft shoulder.
//   along  (v in [0,1], 1 = top, at the surface):
//     bright where it leaves the water and fading out before it reaches the
//     sand, so neither the top nor the bottom edge is ever a visible line.
//
// Segment counts 6 across x 14 along: the gradient is interpolated between
// vertices, so it needs enough of them to look smooth. 14 rows over 5 units is
// a band every ~32 px at this camera — below the point where Gouraud banding
// is visible.
function buildLightShaftGeometry(width: number, height: number): PlaneGeometry {
  const geo = new PlaneGeometry(width, height, 6, 14);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 4);

  for (let i = 0; i < pos.count; i++) {
    // PlaneGeometry is centred on the origin, so map local x/y back to [0,1].
    const u = pos.getX(i) / width + 0.5;
    const v = pos.getY(i) / height + 0.5;

    const across = Math.cos(Math.abs(u - 0.5) * Math.PI) ** 2;
    // Fade in over the top 15% and out over the bottom 55%.
    const along = smoothstep(0, 0.55, v) * (1 - smoothstep(0.85, 1, v) * 0.55);

    colors[i * 4] = 1;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 1;
    colors[i * 4 + 3] = across * along;
  }

  geo.setAttribute('color', new BufferAttribute(colors, 4));
  return geo;
}

/**
 * Builds the ocean surface with gentle shimmer.
 * @param scene - The Three.js scene.
 * @returns The water surface group.
 */
export function buildOceanSurface(scene: Scene): Group {
  const parent = new Group();
  parent.name = 'water_parent';
  parent.position.set(0, 2.5, 0);

  // There is no surface plane here any more.
  //
  // The follow camera's Y is frozen at the manifest orbit height,
  // 0.5 + 10*cos(0.95) = 6.32 (camera/followCamera.ts), and this group sits at
  // y = 2.5 — so a 260-unit plane on it was always BETWEEN the camera and the
  // entire scene. It was not a ceiling you look up at; it was a full-screen
  // colour veil over every pixel of the frame, every frame, and it cost twice
  // over:
  //
  //   Colour. At WATER_VEIL_ALPHA it pulled 10% of every pixel toward one
  //   constant, which is 10% of the frame's contrast removed uniformly. The
  //   frame model puts whole-frame luminance sigma 0.9 higher without it and,
  //   more to the point, the shark-versus-water delta 0.2 higher — the veil
  //   sits in front of both, so it compresses exactly the comparison that
  //   matters.
  //
  //   Cost. It was a MeshStandardMaterial at metalness 0.15 / roughness 0.1,
  //   which is the most expensive fragment path three.js ships: a full PMREM
  //   IBL specular evaluation, over 100% of the pixels, in addition to whatever
  //   was already drawn there. On a software rasteriser that alone is a whole
  //   extra frame's worth of shading, and on a tablet it is a full-screen
  //   overdraw of the heaviest shader in the build.
  //
  // The haze it was standing in for is what scene.fog is for, and the fog
  // already runs at the same colour (setup.ts).

  // Light rays from the surface — translucent vertical planes, billboarded
  // about Y toward the camera every frame by updateGodRays (effects.ts).
  //
  // 12 rays, not 18: at this camera (~89 px per world unit at 1200x810) a
  // 0.9-unit shaft is ~80 px wide, so 12 of them scattered over the ±48 the
  // shark roams still puts two or three in frame at any time without the
  // screen turning into a picket fence.
  //
  // Height 5.0 with the mesh at local y = -2.5 puts the top edge exactly at the
  // parent's y = 2.5 water plane, so the shafts appear to come *from* the
  // surface rather than hanging in mid-water.
  //
  // MeshBasicMaterial, not MeshStandardMaterial: a shaft of light is emissive
  // by definition and the old material's diffuse term was multiplied by a rig
  // it should never have been subject to. Basic skips lights, IBL and the whole
  // BRDF, which for a double-sided transparent plane that overdraws a large
  // part of the frame is the single cheapest change in this file. It still
  // respects fog and vertexColors, so the soft-edge alpha profile is unchanged.
  for (let ray = 0; ray < 12; ray++) {
    const rayGeo = buildLightShaftGeometry(0.9, 5.0);
    const rayMat = new MeshBasicMaterial({
      color: new Color(0.62, 0.82, 1.0),
      transparent: true,
      opacity: GOD_RAY_ALPHA,
      vertexColors: true, // Drives the soft-edge alpha profile — see above
      depthWrite: false, // Overlapping rays must not punch holes in each other
      side: DoubleSide,
    });
    rayMat.name = `lightRayMat_${ray}`;
    const rayMesh = new Mesh(rayGeo, rayMat);
    rayMesh.name = `lightRay_${ray}`;
    rayMesh.position.set(randomRange(-48, 48), -2.5, randomRange(-48, 48));
    rayMesh.scale.set(0.7 + Math.random() * 0.8, 1, 1);
    rayMesh.raycast = () => {}; // Don't intercept taps
    parent.add(rayMesh);
  }

  scene.add(parent);
  return parent;
}
/**
 * Builds sea anemones with waving tentacles.
 * @param scene - The Three.js scene.
 * @returns Array of anemone meshes.
 */
export function buildAnemones(scene: Scene): Mesh[] {
  const anemones: Mesh[] = [];
  const anemonePositions: [number, number][] = [
    [-8, -15],
    [12, 8],
    [-20, 10],
    [5, -22],
    [-15, 25],
    [25, -10],
    [0, 30],
    [-30, -5],
  ];
  const anemoneColors = [
    new Color(0.9, 0.3, 0.5),
    new Color(0.4, 0.9, 0.7),
    new Color(1.0, 0.6, 0.2),
    new Color(0.6, 0.3, 0.9),
    new Color(0.9, 0.3, 0.5),
    new Color(0.4, 0.9, 0.7),
    new Color(1.0, 0.6, 0.2),
    new Color(0.6, 0.3, 0.9),
  ];

  for (let a = 0; a < anemonePositions.length; a++) {
    const [ax, az] = anemonePositions[a];
    const ay = floorOffset(ax, az);
    const color = anemoneColors[a];
    const aMat = createCoralMaterial(`anemoneMat_${a}`, color);
    const aTipMat = createCoralMaterial(`anemoneTipMat_${a}`, color.clone().add(new Color(0.2, 0.2, 0.2)));

    // Base disc
    const baseGeo = new CylinderGeometry(0.2, 0.25, 0.12, 12);
    const base = new Mesh(baseGeo, aMat);
    base.name = `anemone_base_${a}`;
    base.position.set(ax, -0.38 + ay, az);
    scene.add(base);
    anemones.push(base);

    // Tentacles
    const tentacleCount = 8 + Math.floor(Math.random() * 4);
    for (let t = 0; t < tentacleCount; t++) {
      const angle = (t / tentacleCount) * Math.PI * 2;
      const tentacleH = 0.25 + Math.random() * 0.2;
      const tentGeo = new CylinderGeometry(0.008, 0.018, tentacleH, 6);
      const tent = new Mesh(tentGeo, aMat);
      tent.name = `anemone_tent_${a}_${t}`;
      const radius = 0.1 + Math.random() * 0.08;
      tent.position.set(ax + Math.cos(angle) * radius, tentacleH / 2 - 0.3 + ay, az + Math.sin(angle) * radius);
      tent.rotation.z = (Math.random() - 0.5) * 0.3;
      scene.add(tent);
      anemones.push(tent);

      // Glowing tip
      const tipGeo = new SphereGeometry(0.015, 6, 6);
      const tip = new Mesh(tipGeo, aTipMat);
      tip.name = `anemone_tip_${a}_${t}`;
      tip.position.set(tent.position.x, tent.position.y + tentacleH / 2, tent.position.z);
      scene.add(tip);
      anemones.push(tip);
    }
  }

  return anemones;
}

/**
 * Builds underwater rock formations.
 * @param scene - The Three.js scene.
 * @returns Array of rock groups.
 */
export function buildRocks(scene: Scene): Group[] {
  const rocks: Group[] = [];
  const rockPositions: [number, number, number][] = [
    [-18, -0.4, -12],
    [20, -0.4, 8],
    [-10, -0.4, -25],
    [15, -0.4, 22],
    [-25, -0.4, 15],
    [28, -0.4, -5],
    [-30, -0.4, -20],
    [8, -0.4, 35],
    [-35, -0.4, 5],
    [22, -0.4, -28],
    [-5, -0.4, -38],
    [38, -0.4, 12],
  ];

  for (const [rx, ry, rz] of rockPositions) {
    const rock = buildDetailedRock(
      // Sink slightly into the sand so the seam is hidden on a sloped basin wall
      new Vector3(rx, ry + floorOffset(rx, rz) - 0.1, rz),
      0.6 + Math.random() * 0.5,
      new Color(0.3 + Math.random() * 0.1, 0.33 + Math.random() * 0.08, 0.35 + Math.random() * 0.1),
    );
    scene.add(rock);
    rocks.push(rock);
  }

  return rocks;
}

/**
 * Builds a detailed treasure chest with lid, bands, keyhole, and spilling coins.
 * @param scene - The Three.js scene.
 * @returns The treasure chest root mesh (the body box).
 */
export function buildTreasureChest(scene: Scene): Mesh {
  const chestX = 4.5;
  const chestZ = -4.5;
  const chestY = floorOffset(chestX, chestZ);

  // Body
  const bodyGeo = new BoxGeometry(0.7, 0.4, 0.45);
  const woodMat = createMetalMaterial('treasureWoodMat', new Color(0.5, 0.3, 0.08));
  const body = new Mesh(bodyGeo, woodMat);
  body.name = 'treasure_chest';
  body.position.set(chestX, -0.28 + chestY, chestZ);
  scene.add(body);

  // Rounded lid (half cylinder)
  const lidGeo = new CylinderGeometry(0.225, 0.225, 0.7, 12, 1, false, 0, Math.PI);
  const lid = new Mesh(lidGeo, woodMat);
  lid.name = 'treasure_lid';
  lid.position.set(chestX, -0.08 + chestY, chestZ);
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  scene.add(lid);

  // Metal bands
  const bandMat = createMetalMaterial('treasureBandMat', new Color(0.3, 0.28, 0.25));
  for (let b = 0; b < 3; b++) {
    const bandGeo = new BoxGeometry(0.05, 0.42, 0.48);
    const band = new Mesh(bandGeo, bandMat);
    band.name = `treasure_band_${b}`;
    band.position.set(chestX + (b - 1) * 0.25, -0.27 + chestY, chestZ);
    scene.add(band);
  }

  // Keyhole
  const keyGeo = new CylinderGeometry(0.025, 0.025, 0.02, 8);
  const keyMat = createMetalMaterial('treasureKeyMat', new Color(0.7, 0.6, 0.1));
  const keyhole = new Mesh(keyGeo, keyMat);
  keyhole.name = 'treasure_keyhole';
  keyhole.position.set(chestX, -0.15 + chestY, chestZ + 0.23);
  keyhole.rotation.x = Math.PI / 2;
  scene.add(keyhole);

  // Gold coins spilling out
  const coinMat = createMetalMaterial('treasureCoinMat', new Color(0.95, 0.8, 0.15));
  for (let c = 0; c < 6; c++) {
    const coinGeo = new CylinderGeometry(0.05, 0.05, 0.015, 10);
    const coin = new Mesh(coinGeo, coinMat);
    coin.name = `treasure_coin_${c}`;
    coin.position.set(chestX + randomRange(-0.4, 0.4), -0.47 + chestY + Math.random() * 0.02, chestZ + randomRange(-0.3, 0.3));
    coin.rotation.x = Math.PI / 2 + randomRange(-0.3, 0.3);
    coin.rotation.z = Math.random() * Math.PI;
    scene.add(coin);
  }

  return body;
}

/**
 * Creates caustic-simulating emissive spheres and static floor light patches.
 * @param scene - The Three.js scene.
 * @returns The animated lights plus the disposable patch group.
 */
export function buildCausticLights(scene: Scene): CausticBuild {
  const causticLights: CausticLight[] = [];
  for (let i = 0; i < CAUSTIC_LIGHT_COUNT; i++) {
    const angle = (i / CAUSTIC_LIGHT_COUNT) * Math.PI * 2;
    const cx = Math.cos(angle) * 15;
    const cz = Math.sin(angle) * 15;
    // These orbit the shark (updateCausticLights) at head height, so they cross
    // in front of it constantly. At 0.55 radius / 0.55 opacity they were a
    // near-solid pale disc, ~98 px across at this camera, repeatedly wiping out
    // the most important silhouette on screen. 0.35 radius is ~63 px, and at
    // CAUSTIC_SPHERE_ALPHA it is a glow the shark swims through, not behind.
    //
    // MeshBasicMaterial: this is a glow, so its diffuse and IBL terms were
    // always multiplied by a lighting rig it had no business reacting to, and
    // it is transparent with depthWrite off — the most overdraw-prone class of
    // mesh in the scene. Basic drops the whole BRDF and keeps fog.
    const geo = new SphereGeometry(0.35, 12, 12);
    const mat = new MeshBasicMaterial({
      color: new Color(0.6, 0.82, 1.0),
      transparent: true,
      opacity: CAUSTIC_SPHERE_ALPHA,
      depthWrite: false,
    });
    mat.name = `caustic_mat_${i}`;
    const mesh = new Mesh(geo, mat);
    mesh.name = `caustic_${i}`;
    mesh.position.set(cx, 0.9, cz);
    mesh.raycast = () => {}; // Purely decorative — must not swallow taps
    scene.add(mesh);
    // Matches the opacity above and the pulse floor in updateCausticLights
    // (environment/effects.ts), which now modulates opacity rather than the
    // emissiveIntensity an unlit material does not have.
    causticLights.push({ mesh, intensity: CAUSTIC_SPHERE_ALPHA });
  }

  // Extra floor caustic patches — flat bright spots on the sand.
  //
  // 32, not 40: the patches average ~1.05 units radius = ~3.5 sq units each, so
  // 32 of them cover 112 sq units of the 8,100-unit (±45) area they are
  // scattered over — about 1.4%, rising to ~4% of the *screen* because the
  // camera only sees the near field. That is the coverage the alpha budget above
  // assumes. At 40 patches and 0.4 opacity they were merging into continuous
  // pale sheets.
  const patches = new Group();
  patches.name = 'caustic_patches';
  for (let i = 0; i < 32; i++) {
    const patchGeo = new CircleGeometry(0.6 + Math.random() * 0.9, 14);
    patchGeo.rotateX(-Math.PI / 2);
    // Unlit for the same reason as the spheres above — a patch of focused
    // sunlight on sand is emission, not reflection.
    const patchMat = new MeshBasicMaterial({
      color: new Color(0.7, 0.88, 1.0),
      transparent: true,
      opacity: CAUSTIC_PATCH_ALPHA,
      depthWrite: false,
    });
    patchMat.name = `caustic_patch_mat_${i}`;
    const patch = new Mesh(patchGeo, patchMat);
    patch.name = `caustic_patch_${i}`;
    const px = randomRange(-45, 45);
    const pz = randomRange(-45, 45);
    // Ride the terrain (defect 11) or these vanish inside every basin wall
    patch.position.set(px, -0.48 + floorOffset(px, pz) + 0.04, pz);
    patch.raycast = () => {}; // Purely decorative — must not swallow taps
    patches.add(patch);
  }
  scene.add(patches);

  return { lights: causticLights, patches };
}

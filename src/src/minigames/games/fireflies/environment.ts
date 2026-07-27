import {
  type Scene,
  Mesh,
  type Object3D,
  SphereGeometry,
  CylinderGeometry,
  LatheGeometry,
  ShapeGeometry,
  Shape,
  Group,
  RingGeometry,
  MeshStandardMaterial,
  Color,
  Vector2,
  Vector3,
  DoubleSide,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  AdditiveBlending,
  CanvasTexture,
  PlaneGeometry,
  MeshBasicMaterial,
  SRGBColorSpace,
} from 'three';
import { createLeafMaterial, createWoodMaterial } from '@app/minigames/shared/materials';
import { buildDetailedTree, buildGrassTuft, buildDetailedFlower } from '@app/minigames/shared/meshBuilders';
import { JAR_POS, JAR_SCALE } from './types';

export interface EnvironmentResult {
  skyMesh: Object3D;
  groundMesh: Mesh;
  groundMaterial: MeshStandardMaterial;
  jarBody: Mesh;
  jarCap: Mesh;
  jarMaterial: MeshStandardMaterial;
  moonMesh: Mesh;
  moonMaterial: MeshStandardMaterial;
  /** Saturn group (planet + ring) — tappable and slowly spinning. */
  saturnGroup: Group;
  /** Saturn's ring mesh, spun independently of the planet. */
  saturnRing: Mesh;
  /** Star field points for twinkling animation. */
  starField: Points;
  starSizes: Float32Array;
  starPhases: Float32Array;
  /** Resting Y of each star, so the twinkle shimmers around it. */
  starBaseY: Float32Array;
  /** Flower root meshes for traversal by illumination controller. */
  flowerMeshes: Object3D[];
  /** Tree roots, for idle breeze sway. */
  treeMeshes: Object3D[];
  /** Grass tuft roots, for idle breeze sway. */
  grassMeshes: Object3D[];
  environmentMeshes: Object3D[];
  allMaterials: MeshStandardMaterial[];
}

// ── Night sky ───────────────────────────────────────────────────────────────
//
// The shared `buildSkyGradient` builder makes four opaque MeshBasicMaterial
// strips of flat colour. That is fine as the back wall of a box where the
// banding is hidden, but here the sky is the largest continuous surface in the
// shot and the seams read as three hard horizontal stripes across the top of
// the frame. This builds the same two-colour ramp as a single plane with a
// 256-tap vertical gradient texture instead, so there are no seams at all.
//
// Extent, from the fixed camera at (0,2,5) / 60 deg vertical fov. For a point
// at z = -14: depth = 18.383843 - 0.371391*y, yc = 0.928477*y + 5.199474, and
// ndcY = yc / (depth * tan(30 deg)).
//   ndcY = +1 (frame top)          -> y =  4.74
//   ndcY = 0.352 (ground back edge -> y = -1.46
//    at z=-6, i.e. the lowest point of visible sky)
// So 8 units of height centred at y = 1.5 (spanning -2.5 .. 5.5) covers the
// whole visible sky with margin at both ends. Width 60 covers ndcX = +/-1 out
// to a 2.5:1 ultrawide viewport (2.5 * tan(30 deg) * 17.8 depth = 25.7 half,
// i.e. 51.4 needed).
const SKY_WIDTH = 60;
const SKY_HEIGHT = 8;
const SKY_CENTER_Y = 1.5;
const SKY_Z = -14;

// Gradient resolution. 256 rows over the ~6.2 visible units of sky is finer
// than one row per rendered pixel at any sane viewport height, so the ramp is
// smooth by construction rather than by luck.
const SKY_TEX_ROWS = 256;

/**
 * Resting height of the moon.
 *
 * y = 4 put its centre at ndcY = 0.997 — dead on the top edge of the frame,
 * with half the 0.8-radius sphere clipped away, which is why the "moon" was
 * never identifiable in a screenshot. Solving for ndcY = 0.80 at z = -9
 * (0.928477y + 3.342519 = 0.8*tan(30 deg)*(13.7414578 - 0.371391y)) gives
 * y = 2.731; at that depth the moon's own radius is 0.113 ndc, so the whole
 * disc sits inside the frame with room for the +/-0.14 idle bob.
 *
 * Exported because `updateScenery` in index.ts writes position.y every frame —
 * a divergent literal there would snap the moon straight back to the top edge.
 */
export const MOON_BASE_Y = 2.7;

/**
 * Resting height of the Saturn group.
 *
 * y = 3.6 put the group centre at ndcY = 0.933 and the 0.65-radius ring reaches
 * ~0.09 ndc above that, so the top of the ring was clipped. Solving for
 * ndcY = 0.86 at z = -9 gives y = 3.127, which keeps the ring's top at 0.95 —
 * above the moon (0.80) so the two do not read as a pair, and still inside the
 * frame with the +/-0.16 idle bob.
 */
export const SATURN_BASE_Y = 3.13;

function buildNightSky(): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = SKY_TEX_ROWS;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, SKY_TEX_ROWS);
  // Canvas row 0 becomes the top of the plane (Texture.flipY defaults to true).
  // Deep zenith -> a slightly lifted, still-cold horizon. These are the same
  // endpoints the old strip gradient used, just interpolated continuously.
  grad.addColorStop(0.0, 'rgb(5, 5, 20)');
  grad.addColorStop(0.55, 'rgb(11, 16, 38)');
  grad.addColorStop(1.0, 'rgb(20, 31, 51)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, SKY_TEX_ROWS);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  const material = new MeshBasicMaterial({ name: 'nature_sky_mat', map: texture, depthWrite: false, fog: false });
  const mesh = new Mesh(new PlaneGeometry(SKY_WIDTH, SKY_HEIGHT), material);
  mesh.name = 'nature_sky';
  mesh.position.set(0, SKY_CENTER_Y, SKY_Z);
  // Behind everything: stars reach z = -12, moon and Saturn sit at z = -9.
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * Creates the environment: sky gradient, ground, jar, trees, grass, flowers, and moon.
 * @param scene - The Three.js scene.
 * @returns Environment result with all mesh references and materials.
 */
export function createEnvironment(scene: Scene): EnvironmentResult {
  const environmentMeshes: Object3D[] = [];
  const allMaterials: MeshStandardMaterial[] = [];

  // Night sky gradient backdrop.
  const skyMesh = buildNightSky();
  scene.add(skyMesh);

  // Ground plane with rounded back corners
  const groundShape = new Shape();
  const gw = 10; // half-width
  const gd = 6; // half-depth
  const cr = 3; // corner radius for back corners
  // All four corners rounded, clockwise (in XZ, mapped to XY for shape)
  groundShape.moveTo(-gw + cr, gd); // front edge start
  groundShape.lineTo(gw - cr, gd); // front edge
  groundShape.quadraticCurveTo(gw, gd, gw, gd - cr); // front-right rounded
  groundShape.lineTo(gw, -gd + cr); // right edge
  groundShape.quadraticCurveTo(gw, -gd, gw - cr, -gd); // back-right rounded
  groundShape.lineTo(-gw + cr, -gd); // back edge
  groundShape.quadraticCurveTo(-gw, -gd, -gw, -gd + cr); // back-left rounded
  groundShape.lineTo(-gw, gd - cr); // left edge
  groundShape.quadraticCurveTo(-gw, gd, -gw + cr, gd); // front-left rounded
  const groundGeo = new ShapeGeometry(groundShape, 8);
  groundGeo.rotateX(-Math.PI / 2);
  // Meadow albedo. Was (0.15, 0.25, 0.08) — a warm spring green. The meadow
  // floor is the single largest surface in the shot, so its albedo is what
  // decides whether tier 0 reads as night. Estimating the tier-0 pixel with
  // irradiance ~= envIntensity * 1.24 (PMREM RoomEnvironment) + ~0.067 from the
  // tier-0 rig, then ACES at exposure 1.15 and sRGB encode, (0.15, 0.25, 0.08)
  // landed around rgb(82, 102, 66) — mid green, brighter than a firefly's
  // fringe. (0.11, 0.19, 0.15) with the tier-0 env intensity lands around
  // rgb(36, 47, 43): a deep blue-green the glow sits on top of. Blue is raised
  // relative to red so the hue is cold rather than merely dark.
  const groundMat = createLeafMaterial('meadow_floor_mat', new Color(0.11, 0.19, 0.15));
  // Overwritten on the controller's first applyState (tier 0 ground emissive),
  // set here only so the very first rendered frame is not pitch black.
  groundMat.emissive = new Color(0.006, 0.014, 0.011);
  const groundMesh = new Mesh(groundGeo, groundMat);
  groundMesh.name = 'meadow_floor';
  scene.add(groundMesh);
  allMaterials.push(groundMat);

  // Mason jar body — LatheGeometry with a proper jar silhouette
  const jarProfile = [
    new Vector2(0.0, 0.0), // center bottom
    new Vector2(0.5, 0.0), // base edge
    new Vector2(0.55, 0.08), // base curve
    new Vector2(0.55, 1.1), // body wall
    new Vector2(0.52, 1.25), // shoulder curve inward
    new Vector2(0.42, 1.4), // shoulder to neck
    new Vector2(0.32, 1.55), // neck
    new Vector2(0.32, 1.7), // neck top
    new Vector2(0.38, 1.72), // lip flare out
    new Vector2(0.38, 1.78), // lip top outer
    new Vector2(0.3, 1.78), // lip top inner
    new Vector2(0.3, 1.72), // lip inner edge
    new Vector2(0.0, 1.72), // close inner top
  ];
  const jarBodyGeo = new LatheGeometry(jarProfile, 24);
  const jarMaterial = new MeshStandardMaterial({
    name: 'nature_jar_mat',
    color: new Color(0.7, 0.85, 0.9),
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.65,
    side: DoubleSide,
    emissive: new Color(0.16, 0.22, 0.28),
  });
  // Glass must not write depth: it is transparent and sits at almost exactly
  // the same distance as the glowing fill dots inside it, so with depthWrite on
  // the front wall silently discarded roughly half the swarm.
  jarMaterial.depthWrite = false;
  const jarBody = new Mesh(jarBodyGeo, jarMaterial);
  jarBody.name = 'nature_jar_body';
  jarBody.position.set(JAR_POS.x, JAR_POS.y, JAR_POS.z);
  jarBody.scale.setScalar(JAR_SCALE);
  jarBody.renderOrder = 1;
  scene.add(jarBody);
  allMaterials.push(jarMaterial);

  // Cork lid — squat cylinder sitting on the jar lip, scaled to match jar
  const jarCapGeo = new CylinderGeometry(0.34, 0.36, 0.2, 16);
  const capMat = createWoodMaterial('nature_jar_cap_mat', new Color(0.55, 0.42, 0.28));
  const jarCap = new Mesh(jarCapGeo, capMat);
  jarCap.name = 'nature_jar_cap';
  jarCap.position.set(JAR_POS.x, JAR_POS.y + 1.88 * JAR_SCALE, JAR_POS.z);
  jarCap.scale.setScalar(JAR_SCALE);
  scene.add(jarCap);
  allMaterials.push(capMat);

  // Detailed storybook trees as backdrop (dark canopies for nighttime)
  const treeMeshes: Object3D[] = [];
  const treePositions = [new Vector3(4, 0, -4), new Vector3(6, 0, -3), new Vector3(-5, 0, -5)];
  for (const treePos of treePositions) {
    // Canopy albedo cooled from (0.25, 0.4, 0.18). `buildDetailedTree` bakes
    // emissive = leafColor * 0.08, so the leaf colour sets both the lit and the
    // self-lit contribution; a warm green here made the trees glow spring-green
    // in a scene that is supposed to be moonlit.
    const tree = buildDetailedTree(treePos, 3.0, new Color(0.12, 0.21, 0.19));
    scene.add(tree);
    environmentMeshes.push(tree);
    treeMeshes.push(tree);
  }

  // Grass tufts scattered across the meadow.
  //
  // Colour cooled from (0.3, 0.6, 0.2) for the same reason as the trees:
  // `buildGrassTuft` bakes emissive = (r*0.1, g*0.12, b*0.05) off this colour,
  // so a saturated green here is self-lit and survives any amount of dimming.
  const GRASS_COLOR = new Color(0.16, 0.34, 0.27);
  const grassPositions = [
    new Vector3(-1, 0, 1),
    new Vector3(2, 0, -1),
    new Vector3(-4, 0, 0.5),
    new Vector3(3, 0, 2),
    new Vector3(0, 0, -1.5),
    new Vector3(-2, 0, -0.5),
    new Vector3(5, 0, 0),
    new Vector3(-6, 0, -1),
  ];
  const grassMeshes: Object3D[] = [];
  for (const gp of grassPositions) {
    const tuft = buildGrassTuft(gp, GRASS_COLOR);
    scene.add(tuft);
    environmentMeshes.push(tuft);
    grassMeshes.push(tuft);
  }

  // Foreground grass, in front of the play area.
  //
  // The whole bottom third of the frame used to be bare ground, which is why a
  // delta-pixel band profile measured literally zero motion there no matter how
  // hard the breeze was cranked: nothing was drawn in that band to move. The
  // bottom edge of the frame meets the ground plane at z = 3.4263 (solving
  // ndcY = -1 for y = 0: -0.371391z = -tan(30 deg)*(5.3851648 - 0.928477z)),
  // and the previously furthest-forward tuft was at z = 2, x = 3, which
  // projects to ndcX = 1.01 — just off the side. So this band gets its own row.
  //
  // Placement rules: z in [2.1, 3.15] so they sit in the bottom quarter
  // (z = 3.0 -> ndcY = -0.742, i.e. 87% down the frame); |x| under the frustum
  // half-width at that depth (aspect*tan(30 deg)*depth = 2.22 at z = 3.0, 2.86
  // at z = 2.2 for 3:2); and clear of x in [0.4, 0.85] near z >= 2.8 so they do
  // not stand in front of the jar.
  //
  // Scale 1.8 turns the builder's ~0.30-unit tuft into 0.54 units, which at
  // z = 3.0 is 0.334 ndc — 17% of frame height, i.e. foreground-sized. At the
  // 0.22 rad sway amplitude the tips travel 0.54*sin(0.22) = 0.118 units, or
  // 0.053 ndc = 32 px on a 1200 px frame: unmistakable movement.
  const FOREGROUND_GRASS_SCALE = 1.8;
  const foregroundGrassPositions = [
    new Vector3(-2.45, 0, 2.15),
    new Vector3(-1.55, 0, 2.95),
    new Vector3(-0.55, 0, 2.45),
    new Vector3(1.45, 0, 2.35),
    new Vector3(1.95, 0, 3.05),
    new Vector3(2.6, 0, 2.15),
  ];
  for (const gp of foregroundGrassPositions) {
    const tuft = buildGrassTuft(gp, GRASS_COLOR);
    tuft.scale.setScalar(FOREGROUND_GRASS_SCALE);
    scene.add(tuft);
    environmentMeshes.push(tuft);
    grassMeshes.push(tuft);
  }

  // Wildflowers dotted among the grass
  const flowerConfigs = [
    { pos: new Vector3(-1.5, 0, 0.8), color: new Color(0.9, 0.3, 0.5) },
    { pos: new Vector3(1.5, 0, -0.5), color: new Color(0.6, 0.4, 0.9) },
    { pos: new Vector3(3.5, 0, 1.5), color: new Color(0.95, 0.75, 0.2) },
    { pos: new Vector3(-3.5, 0, -1.2), color: new Color(0.4, 0.6, 0.95) },
  ];
  // Collected by reference as they are built. The old code recovered them
  // afterwards with `environmentMeshes.length - flowerCount`, but Saturn was
  // pushed onto the same array in between, so the slice was off by one and
  // handed the game flowers 2, 3, 4 and *Saturn* — a planet then swayed in the
  // breeze and lit up when a firefly flew past it.
  const flowerMeshes: Object3D[] = [];
  for (const fc of flowerConfigs) {
    const flower = buildDetailedFlower(fc.pos, fc.color, 0.35);
    scene.add(flower);
    environmentMeshes.push(flower);
    flowerMeshes.push(flower);
  }

  // Star field — scattered across the sky backdrop.
  //
  // The Y range was 2..12. At the star plane (z = -8..-12) the top of the frame
  // is at y = 3.87 (z = -8) to 4.45 (z = -12), solving ndcY = 1, so roughly
  // three quarters of every star was above the viewport. The lower limit is set
  // by the meadow: the ground's back edge (z = -6) projects to ndcY = 0.352 and
  // the ground writes depth, so a star below that is hidden behind it — at
  // z = -10, y = 0.6 is ndcY = 0.485, comfortably clear. Hence 0.6 .. 3.8.
  const starCount = 120;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhases = new Float32Array(starCount);
  // The twinkle in index.ts needs the resting Y to shimmer *around*. It used to
  // re-derive it from the star's phase (`2 + phase/(2*PI)*10`), which is an
  // unrelated number, so on the first animated frame the whole sky rearranged
  // itself into a phase-sorted band and then stayed there.
  const starBaseY = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    starBaseY[i] = 0.6 + Math.random() * 3.2;
    starPositions[i * 3] = (Math.random() - 0.5) * 24; // x: spread across sky
    starPositions[i * 3 + 1] = starBaseY[i];
    starPositions[i * 3 + 2] = -8 - Math.random() * 4; // z: behind scene
    starSizes[i] = 0.03 + Math.random() * 0.06;
    starPhases[i] = Math.random() * Math.PI * 2;
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(starPositions, 3));

  // Soft dot texture for stars
  const starTexCanvas = document.createElement('canvas');
  starTexCanvas.width = 32;
  starTexCanvas.height = 32;
  const starCtx = starTexCanvas.getContext('2d')!;
  const starGrad = starCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  starGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  starGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
  starGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  starCtx.fillStyle = starGrad;
  starCtx.fillRect(0, 0, 32, 32);
  const starTexture = new CanvasTexture(starTexCanvas);

  const starMat = new PointsMaterial({
    map: starTexture,
    size: 0.12,
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
    depthWrite: false,
    color: new Color(0.6, 0.7, 1.0),
    sizeAttenuation: true,
  });
  const starField = new Points(starGeo, starMat);
  starField.name = 'nature_starfield';
  scene.add(starField);

  // Moon — starts very dim (Tier 0), illumination controller will brighten it
  const moonGeo = new SphereGeometry(0.8, 16, 16);
  const moonMat = new MeshStandardMaterial({
    color: new Color(1.0, 0.95, 0.75),
    emissive: new Color(0.4, 0.38, 0.2), // Visible moon glow
    metalness: 0.0,
    roughness: 0.6,
  });
  moonMat.name = 'nature_moon_mat';
  const moonMesh = new Mesh(moonGeo, moonMat);
  moonMesh.name = 'nature_moon';
  moonMesh.position.set(3, MOON_BASE_Y, -9);
  scene.add(moonMesh);
  allMaterials.push(moonMat);

  // Saturn — above and offset from the front-left tree (-5, 0, -5)
  const saturn = new Group();
  let saturnRing: Mesh;
  {
    saturn.name = 'nature_saturn';

    // Planet body — muted golden, not too bright
    const planetGeo = new SphereGeometry(0.3, 16, 16);
    const planetMat = new MeshStandardMaterial({
      color: new Color(0.75, 0.65, 0.4),
      emissive: new Color(0.2, 0.18, 0.1),
      metalness: 0.0,
      roughness: 0.8,
    });
    const planetMesh = new Mesh(planetGeo, planetMat);
    saturn.add(planetMesh);
    allMaterials.push(planetMat);

    // Ring — flat disc tilted to read as Saturn's ring
    const ringGeo = new RingGeometry(0.42, 0.65, 48);
    const ringMat = new MeshStandardMaterial({
      color: new Color(0.7, 0.6, 0.4),
      emissive: new Color(0.15, 0.12, 0.08),
      side: DoubleSide,
      transparent: true,
      opacity: 0.6,
      metalness: 0.0,
      roughness: 0.6,
    });
    const ringMesh = new Mesh(ringGeo, ringMat);
    ringMesh.name = 'nature_saturn_ring';
    ringMesh.rotation.x = -Math.PI * 0.35;
    ringMesh.rotation.z = 0.15;
    saturn.add(ringMesh);
    allMaterials.push(ringMat);
    saturnRing = ringMesh;

    // Place in the gap between the left tree (-5) and right trees (4,6), above
    // the treeline. This is what the comment always claimed, but the position
    // was x=-10.5 — from the fixed camera at (0,2,5) with a 60 deg fov that is
    // outside the frustum at any aspect narrower than ~2.6:1, so on a phone or
    // tablet Saturn was simply never on screen (and so could never be tapped).
    saturn.position.set(-3.2, SATURN_BASE_Y, -9);
    scene.add(saturn);
    environmentMeshes.push(saturn);
  }

  return {
    skyMesh,
    groundMesh,
    groundMaterial: groundMat,
    jarBody,
    jarCap,
    jarMaterial,
    moonMesh,
    moonMaterial: moonMat,
    saturnGroup: saturn,
    saturnRing,
    starField,
    starSizes,
    starPhases,
    starBaseY,
    flowerMeshes,
    treeMeshes,
    grassMeshes,
    environmentMeshes,
    allMaterials,
  };
}

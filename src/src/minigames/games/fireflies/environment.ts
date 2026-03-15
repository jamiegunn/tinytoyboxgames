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
} from 'three';
import { createLeafMaterial, createWoodMaterial } from '@app/minigames/shared/materials';
import { buildSkyGradient, buildDetailedTree, buildGrassTuft, buildDetailedFlower } from '@app/minigames/shared/meshBuilders';
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
  /** Star field points for twinkling animation. */
  starField: Points;
  starSizes: Float32Array;
  starPhases: Float32Array;
  /** Flower root meshes for traversal by illumination controller. */
  flowerMeshes: Object3D[];
  environmentMeshes: Object3D[];
  allMaterials: MeshStandardMaterial[];
}

/**
 * Creates the environment: sky gradient, ground, jar, trees, grass, flowers, and moon.
 * @param scene - The Three.js scene.
 * @returns Environment result with all mesh references and materials.
 */
export function createEnvironment(scene: Scene): EnvironmentResult {
  const environmentMeshes: Object3D[] = [];
  const allMaterials: MeshStandardMaterial[] = [];

  // Night sky gradient backdrop
  const skyMesh = buildSkyGradient(new Color(0.02, 0.02, 0.08), new Color(0.08, 0.12, 0.2), 30);
  scene.add(skyMesh);
  skyMesh.position.set(0, 4, -10);

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
  const groundMat = createLeafMaterial('meadow_floor_mat', new Color(0.15, 0.25, 0.08));
  groundMat.emissive = new Color(0.05, 0.08, 0.03); // Tier 0: visible ground
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
  const jarBody = new Mesh(jarBodyGeo, jarMaterial);
  jarBody.name = 'nature_jar_body';
  jarBody.position.set(JAR_POS.x, JAR_POS.y, JAR_POS.z);
  jarBody.scale.setScalar(JAR_SCALE);
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
  const treePositions = [new Vector3(4, 0, -4), new Vector3(6, 0, -3), new Vector3(-5, 0, -5)];
  for (const treePos of treePositions) {
    const tree = buildDetailedTree(treePos, 3.0, new Color(0.25, 0.4, 0.18));
    scene.add(tree);
    environmentMeshes.push(tree);
  }

  // Grass tufts scattered across the meadow
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
  for (const gp of grassPositions) {
    const tuft = buildGrassTuft(gp, new Color(0.3, 0.6, 0.2));
    scene.add(tuft);
    environmentMeshes.push(tuft);
  }

  // Wildflowers dotted among the grass
  const flowerConfigs = [
    { pos: new Vector3(-1.5, 0, 0.8), color: new Color(0.9, 0.3, 0.5) },
    { pos: new Vector3(1.5, 0, -0.5), color: new Color(0.6, 0.4, 0.9) },
    { pos: new Vector3(3.5, 0, 1.5), color: new Color(0.95, 0.75, 0.2) },
    { pos: new Vector3(-3.5, 0, -1.2), color: new Color(0.4, 0.6, 0.95) },
  ];
  for (const fc of flowerConfigs) {
    const flower = buildDetailedFlower(fc.pos, fc.color, 0.35);
    scene.add(flower);
    environmentMeshes.push(flower);
  }

  // Star field — scattered across the sky backdrop
  const starCount = 120;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhases = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 24; // x: spread across sky
    starPositions[i * 3 + 1] = 2 + Math.random() * 10; // y: above ground
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
  moonMesh.position.set(3, 4, -9);
  scene.add(moonMesh);
  allMaterials.push(moonMat);

  // Saturn — above and offset from the front-left tree (-5, 0, -5)
  {
    const saturn = new Group();
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
    ringMesh.rotation.x = -Math.PI * 0.35;
    ringMesh.rotation.z = 0.15;
    saturn.add(ringMesh);
    allMaterials.push(ringMat);

    // Place in the gap between the left tree (-5) and right trees (4,6), above treeline
    saturn.position.set(-10.5, 3.2, -9);
    scene.add(saturn);
    environmentMeshes.push(saturn);
  }

  // Collect flower meshes separately for illumination control.
  // Flowers are the last N entries added to environmentMeshes.
  const flowerMeshes: Object3D[] = [];
  const flowerCount = flowerConfigs.length;
  const flowerStart = environmentMeshes.length - flowerCount;
  for (let i = flowerStart; i < environmentMeshes.length; i++) {
    flowerMeshes.push(environmentMeshes[i]);
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
    starField,
    starSizes,
    starPhases,
    flowerMeshes,
    environmentMeshes,
    allMaterials,
  };
}

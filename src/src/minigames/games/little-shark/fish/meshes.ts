import { Group, Mesh, Color, SphereGeometry, CylinderGeometry, BoxGeometry, ConeGeometry, MeshStandardMaterial } from 'three';
import type { FishSpeciesId } from './species';

// ---------------------------------------------------------------------------
// Material helpers
// ---------------------------------------------------------------------------

/**
 * Create a standard body material for a fish species.
 * @param prefix - Naming prefix for the material.
 * @param color - Body color.
 * @returns A MeshStandardMaterial configured for a fish body.
 */
function bodyMaterial(prefix: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name: `${prefix}_bodyMat`,
    color,
    roughness: 0.6,
    metalness: 0.1,
  });
}

/**
 * Create a fin material — slightly lighter tint of the body color.
 * @param prefix - Naming prefix for the material.
 * @param color - Base body color to lighten.
 * @returns A MeshStandardMaterial configured for fish fins.
 */
function finMaterial(prefix: string, color: Color): MeshStandardMaterial {
  const lighter = color.clone().lerp(new Color(1, 1, 1), 0.2);
  return new MeshStandardMaterial({
    name: `${prefix}_finMat`,
    color: lighter,
    roughness: 0.7,
    metalness: 0.1,
  });
}

/**
 * Create a white eye sclera material.
 * @param prefix - Naming prefix for the material.
 * @returns A white MeshStandardMaterial for the eye sclera.
 */
function eyeWhiteMaterial(prefix: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name: `${prefix}_eyeWhiteMat`,
    color: new Color(1, 1, 1),
    roughness: 0.3,
    metalness: 0,
  });
}

/**
 * Create a black pupil material.
 * @param prefix - Naming prefix for the material.
 * @returns A dark MeshStandardMaterial for the eye pupil.
 */
function pupilMaterial(prefix: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name: `${prefix}_pupilMat`,
    color: new Color(0.02, 0.02, 0.02),
    roughness: 0.3,
    metalness: 0,
  });
}

// ---------------------------------------------------------------------------
// Shared eye builder
// ---------------------------------------------------------------------------

/**
 * Build a pair of eyes (sclera + pupil) and add them to the parent group.
 *
 * @param group - Parent group to attach eyes to.
 * @param prefix - Naming prefix for mesh names.
 * @param yOffset - Vertical offset from center.
 * @param zOffset - Forward offset from center.
 * @param xSpread - Horizontal spread between the two eyes.
 * @param scleraRadius - Radius of the white eye sphere.
 * @param pupilRadius - Radius of the black pupil sphere.
 */
function addEyes(group: Group, prefix: string, yOffset: number, zOffset: number, xSpread: number, scleraRadius: number, pupilRadius: number): void {
  const eyeWhite = eyeWhiteMaterial(prefix);
  const pupil = pupilMaterial(prefix);

  for (const side of [-1, 1] as const) {
    const sclera = new Mesh(new SphereGeometry(scleraRadius, 12, 8), eyeWhite);
    sclera.name = `${prefix}_eye_${side === -1 ? 'L' : 'R'}`;
    sclera.position.set(side * xSpread, yOffset, zOffset);
    group.add(sclera);

    const pupilMesh = new Mesh(new SphereGeometry(pupilRadius, 8, 6), pupil);
    pupilMesh.name = `${prefix}_pupil_${side === -1 ? 'L' : 'R'}`;
    pupilMesh.position.set(side * xSpread, yOffset, zOffset + scleraRadius * 0.6);
    group.add(pupilMesh);
  }
}

// ---------------------------------------------------------------------------
// Species builders
// ---------------------------------------------------------------------------

/**
 * Build a clownfish mesh — orange/white striped body with a cone tail and dorsal fins.
 *
 * @param color - Base body color.
 * @returns A Group containing all child meshes for the clownfish.
 */
export function buildClownfish(color: Color): Group {
  const prefix = 'fish_clownfish';
  const group = new Group();
  group.name = `${prefix}_root`;

  // Body — slightly elongated sphere
  const body = new Mesh(new SphereGeometry(0.25, 16, 12), bodyMaterial(prefix, color));
  body.name = `${prefix}_body`;
  body.scale.set(1, 1, 1.3);
  group.add(body);

  // White stripes — thin cylinder rings
  const stripeMat = new MeshStandardMaterial({
    name: `${prefix}_stripeMat`,
    color: new Color(1, 1, 1),
    roughness: 0.6,
    metalness: 0.1,
  });

  for (let i = 0; i < 2; i++) {
    const stripe = new Mesh(new CylinderGeometry(0.26, 0.26, 0.02, 16), stripeMat);
    stripe.name = `${prefix}_stripe_${i}`;
    stripe.rotation.x = Math.PI / 2;
    stripe.position.z = -0.08 + i * 0.16;
    group.add(stripe);
  }

  // Tail — flattened cone
  const finMat = finMaterial(prefix, color);
  const tail = new Mesh(new ConeGeometry(0.12, 0.2, 8), finMat);
  tail.name = `${prefix}_tail`;
  tail.rotation.x = Math.PI / 2;
  tail.scale.set(1, 0.4, 1);
  tail.position.z = -0.38;
  group.add(tail);

  // Dorsal fins — small boxes on top
  for (let i = 0; i < 2; i++) {
    const fin = new Mesh(new BoxGeometry(0.02, 0.08, 0.06), finMat);
    fin.name = `${prefix}_dorsalFin_${i}`;
    fin.position.set(0, 0.22, -0.05 + i * 0.1);
    group.add(fin);
  }

  // Eyes
  addEyes(group, prefix, 0.06, 0.22, 0.12, 0.045, 0.025);

  return group;
}

/**
 * Build a blue tang mesh — sleek tropical fish with a prominent dorsal fin and forked tail.
 *
 * @param color - Base body color.
 * @returns A Group containing all child meshes for the blue tang.
 */
export function buildBlueTang(color: Color): Group {
  const prefix = 'fish_blueTang';
  const group = new Group();
  group.name = `${prefix}_root`;

  // Body — elongated and slightly compressed vertically
  const body = new Mesh(new SphereGeometry(0.25, 16, 12), bodyMaterial(prefix, color));
  body.name = `${prefix}_body`;
  body.scale.set(1, 0.8, 1.5);
  group.add(body);

  // Prominent dorsal fin — rotated cone on top
  const finMat = finMaterial(prefix, color);
  const dorsal = new Mesh(new ConeGeometry(0.08, 0.22, 6), finMat);
  dorsal.name = `${prefix}_dorsalFin`;
  dorsal.position.set(0, 0.24, -0.04);
  group.add(dorsal);

  // Forked tail — two thin cones angled apart
  for (let i = 0; i < 2; i++) {
    const fork = new Mesh(new ConeGeometry(0.04, 0.18, 6), finMat);
    fork.name = `${prefix}_tailFork_${i}`;
    fork.rotation.x = Math.PI / 2;
    fork.rotation.z = (i === 0 ? 1 : -1) * 0.4;
    fork.position.set(0, i === 0 ? 0.06 : -0.06, -0.4);
    group.add(fork);
  }

  // Eyes
  addEyes(group, prefix, 0.04, 0.28, 0.13, 0.04, 0.022);

  return group;
}

/**
 * Build a pufferfish mesh — round spiky body with big cute eyes.
 *
 * @param color - Base body color.
 * @returns A Group containing all child meshes for the pufferfish.
 */
export function buildPufferfish(color: Color): Group {
  const prefix = 'fish_pufferfish';
  const group = new Group();
  group.name = `${prefix}_root`;

  // Body — round sphere
  const body = new Mesh(new SphereGeometry(0.28, 16, 12), bodyMaterial(prefix, color));
  body.name = `${prefix}_body`;
  group.add(body);

  // Spike bumps — 12 small cones distributed on the surface
  const spikeMat = finMaterial(prefix, color);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 12; i++) {
    const theta = goldenAngle * i;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / 12);
    const r = 0.28;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    const spike = new Mesh(new ConeGeometry(0.025, 0.07, 5), spikeMat);
    spike.name = `${prefix}_spike_${i}`;
    spike.position.set(x, y, z);
    spike.lookAt(x * 2, y * 2, z * 2);
    group.add(spike);
  }

  // Small side fins
  const finMat = finMaterial(prefix, color);
  for (const side of [-1, 1] as const) {
    const fin = new Mesh(new BoxGeometry(0.04, 0.06, 0.08), finMat);
    fin.name = `${prefix}_sideFin_${side === -1 ? 'L' : 'R'}`;
    fin.position.set(side * 0.28, 0, 0.05);
    group.add(fin);
  }

  // Big cute eyes — larger than other species
  addEyes(group, prefix, 0.1, 0.22, 0.14, 0.065, 0.04);

  // Mouth — tiny sphere
  const mouthMat = new MeshStandardMaterial({
    name: `${prefix}_mouthMat`,
    color: new Color(0.8, 0.3, 0.3),
    roughness: 0.5,
    metalness: 0,
  });
  const mouth = new Mesh(new SphereGeometry(0.025, 8, 6), mouthMat);
  mouth.name = `${prefix}_mouth`;
  mouth.position.set(0, -0.06, 0.27);
  group.add(mouth);

  return group;
}

/**
 * Build a seahorse mesh — curved upright body made of stacked spheres with a curled tail.
 *
 * @param color - Base body color.
 * @returns A Group containing all child meshes for the seahorse.
 */
export function buildSeahorse(color: Color): Group {
  const prefix = 'fish_seahorse';
  const group = new Group();
  group.name = `${prefix}_root`;

  const bMat = bodyMaterial(prefix, color);

  // Body — stack of 5 small spheres along an S-curve
  const curvePoints: [number, number, number][] = [
    [0, 0.24, 0.04],
    [0, 0.12, 0.08],
    [0, 0.0, 0.04],
    [0, -0.12, -0.02],
    [0, -0.24, -0.06],
  ];

  for (let i = 0; i < curvePoints.length; i++) {
    const radius = 0.07 - i * 0.006;
    const seg = new Mesh(new SphereGeometry(radius, 10, 8), bMat);
    seg.name = `${prefix}_bodySegment_${i}`;
    seg.position.set(curvePoints[i][0], curvePoints[i][1], curvePoints[i][2]);
    group.add(seg);
  }

  // Curled tail — 3 tiny spheres curling inward at bottom
  const tailPoints: [number, number, number][] = [
    [0, -0.33, -0.04],
    [0, -0.38, 0.01],
    [0, -0.4, 0.06],
  ];

  for (let i = 0; i < tailPoints.length; i++) {
    const radius = 0.03 - i * 0.005;
    const seg = new Mesh(new SphereGeometry(radius, 8, 6), bMat);
    seg.name = `${prefix}_tail_${i}`;
    seg.position.set(tailPoints[i][0], tailPoints[i][1], tailPoints[i][2]);
    group.add(seg);
  }

  // Tiny dorsal fin on back
  const finMat = finMaterial(prefix, color);
  const dorsalFin = new Mesh(new BoxGeometry(0.015, 0.1, 0.04), finMat);
  dorsalFin.name = `${prefix}_dorsalFin`;
  dorsalFin.position.set(0, 0.06, -0.06);
  group.add(dorsalFin);

  // Snout — elongated cone pointing forward
  const snout = new Mesh(new ConeGeometry(0.025, 0.12, 6), bMat);
  snout.name = `${prefix}_snout`;
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, 0.2, 0.12);
  group.add(snout);

  // Crown bumps on head
  for (let i = 0; i < 3; i++) {
    const bump = new Mesh(new SphereGeometry(0.018, 6, 4), bMat);
    bump.name = `${prefix}_crown_${i}`;
    bump.position.set(-0.025 + i * 0.025, 0.32, 0.03);
    group.add(bump);
  }

  // Eyes
  addEyes(group, prefix, 0.24, 0.08, 0.06, 0.03, 0.016);

  return group;
}

/**
 * Build a golden angelfish mesh — flat diamond-shaped body with trailing fins and emissive glow.
 *
 * @param color - Base body color.
 * @returns A Group containing all child meshes for the golden angelfish.
 */
export function buildGoldenAngelfish(color: Color): Group {
  const prefix = 'fish_goldenAngelfish';
  const group = new Group();
  group.name = `${prefix}_root`;

  // Body — sphere scaled flat into a diamond shape
  const bMat = bodyMaterial(prefix, color);
  bMat.emissive = new Color(0.3, 0.25, 0.05);
  bMat.emissiveIntensity = 0.4;

  const body = new Mesh(new SphereGeometry(0.3, 16, 12), bMat);
  body.name = `${prefix}_body`;
  body.scale.set(0.4, 1.0, 1.2);
  group.add(body);

  // Trailing fins — long thin cones, top and bottom, extended backward
  const finMat = finMaterial(prefix, color);
  finMat.emissive = new Color(0.2, 0.16, 0.03);
  finMat.emissiveIntensity = 0.3;

  const topFin = new Mesh(new ConeGeometry(0.03, 0.3, 6), finMat);
  topFin.name = `${prefix}_trailingFin_top`;
  topFin.rotation.x = Math.PI * 0.6;
  topFin.position.set(0, 0.2, -0.2);
  group.add(topFin);

  const bottomFin = new Mesh(new ConeGeometry(0.03, 0.3, 6), finMat);
  bottomFin.name = `${prefix}_trailingFin_bottom`;
  bottomFin.rotation.x = -Math.PI * 0.6;
  bottomFin.position.set(0, -0.2, -0.2);
  group.add(bottomFin);

  // Eyes
  addEyes(group, prefix, 0.04, 0.28, 0.1, 0.04, 0.022);

  return group;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/** Map of species ID to its mesh builder function. */
const BUILDERS: Record<FishSpeciesId, (color: Color) => Group> = {
  clownfish: buildClownfish,
  blueTang: buildBlueTang,
  pufferfish: buildPufferfish,
  seahorse: buildSeahorse,
  goldenAngelfish: buildGoldenAngelfish,
};

/**
 * Build the procedural mesh for a fish species, dispatching to the appropriate species-specific builder.
 *
 * @param speciesId - The species identifier to build a mesh for.
 * @param color - Base body color to apply.
 * @returns A named Group containing all child meshes for the given species.
 */
export function buildSpeciesMesh(speciesId: FishSpeciesId, color: Color): Group {
  return BUILDERS[speciesId](color);
}

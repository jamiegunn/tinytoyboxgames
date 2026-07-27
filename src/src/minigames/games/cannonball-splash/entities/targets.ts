/**
 * Target geometry builders for Cannonball Splash.
 *
 * Each builder returns a Group plus the materials that group owns. Materials are
 * *cloned per target instance*: the edge warning tints a target's own emissive,
 * and when those materials were module-level singletons one barrel nearing the
 * edge turned every barrel, bottle and duck in the scene red. Per-instance
 * clones also make disposal on recycle safe.
 */

import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry } from 'three';
import type { TargetKind } from '../types';

// ── Material templates (cloned per instance) ────────────────────────────────

function mat(
  name: string,
  color: [number, number, number],
  opts: { metalness?: number; roughness?: number; transparent?: boolean; opacity?: number; emissive?: [number, number, number] } = {},
): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(...color),
    metalness: opts.metalness ?? 0,
    roughness: opts.roughness ?? 0.7,
  });
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 1;
  }
  if (opts.emissive) m.emissive = new Color(...opts.emissive);
  m.name = name;
  // The edge warning overwrites emissive, so every material carries the colour
  // it must be restored to — including the golden barrel's glow, which had no
  // reset branch at all and stayed red for the rest of its life once warned.
  m.userData.baseEmissive = m.emissive.getHex();
  return m;
}

const barrelWoodMat = mat('barrel_wood', [0.78, 0.45, 0.16], { roughness: 0.65 });
const barrelBandMat = mat('barrel_band', [0.85, 0.2, 0.16], { metalness: 0.2, roughness: 0.35 });
const barrelRimMat = mat('barrel_rim', [0.95, 0.8, 0.5], { roughness: 0.55 });
const bottleGlassMat = mat('bottle_glass', [0.1, 0.78, 0.45], { metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.85 });
const bottleCorkMat = mat('bottle_cork', [0.8, 0.6, 0.35], { roughness: 0.8 });
const duckBodyMat = mat('duck_body', [1.0, 0.82, 0.1], { roughness: 0.3 });
const duckBeakMat = mat('duck_beak', [1.0, 0.5, 0.08], { roughness: 0.35 });
const duckEyeMat = mat('duck_eye', [0.05, 0.05, 0.05], { roughness: 0.5 });
const goldenBarrelMat = mat('golden_barrel', [1.0, 0.8, 0.2], { metalness: 0.6, roughness: 0.2, emissive: [0.35, 0.26, 0.06] });
const goldenBandMat = mat('golden_band', [0.85, 0.62, 0.12], { metalness: 0.6, roughness: 0.25 });
const rainbowBottleMat = mat('rainbow_bottle', [1, 0.2, 0.2], { metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.8 });

const materialTemplates = [
  barrelWoodMat,
  barrelBandMat,
  barrelRimMat,
  bottleGlassMat,
  bottleCorkMat,
  duckBodyMat,
  duckBeakMat,
  duckEyeMat,
  goldenBarrelMat,
  goldenBandMat,
  rainbowBottleMat,
];

/** A built target: its scene graph plus the materials only it owns. */
export interface TargetMeshes {
  root: Group;
  materials: MeshStandardMaterial[];
}

// Collects per-instance clones so each builder can hand ownership to the caller.
function instanceMaterials(...templates: MeshStandardMaterial[]): MeshStandardMaterial[] {
  return templates.map((t) => t.clone());
}

// ── Barrel ──────────────────────────────────────────────────────────────────

/**
 * Builds a floating wooden barrel target.
 * @returns The barrel group with body, bulge, rim and metal bands.
 */
export function createBarrelMeshes(): TargetMeshes {
  const root = new Group();
  root.name = 'target_barrel';
  const [woodMat, rimMat, bandMat] = instanceMaterials(barrelWoodMat, barrelRimMat, barrelBandMat);

  const body = new Mesh(new CylinderGeometry(0.5, 0.5, 0.9, 12), woodMat);
  body.name = 'barrel_body';
  body.castShadow = true;
  root.add(body);

  const bulge = new Mesh(new CylinderGeometry(0.57, 0.57, 0.45, 12), woodMat);
  bulge.name = 'barrel_bulge';
  root.add(bulge);

  const rim = new Mesh(new CylinderGeometry(0.48, 0.48, 0.08, 12), rimMat);
  rim.name = 'barrel_rim';
  rim.position.y = 0.45;
  root.add(rim);

  for (let i = 0; i < 2; i++) {
    const band = new Mesh(new TorusGeometry(0.53, 0.045, 6, 18), bandMat);
    band.name = `barrel_band_${i}`;
    band.rotation.x = Math.PI / 2;
    band.position.y = i === 0 ? 0.2 : -0.2;
    root.add(band);
  }

  return { root, materials: [woodMat, rimMat, bandMat] };
}

// ── Bottle ──────────────────────────────────────────────────────────────────

/**
 * Builds a floating glass bottle target lying on its side.
 * @returns The bottle group with body, neck and cork.
 */
export function createBottleMeshes(): TargetMeshes {
  const root = new Group();
  root.name = 'target_bottle';
  const [glassMat, corkMat] = instanceMaterials(bottleGlassMat, bottleCorkMat);

  const body = new Mesh(new CylinderGeometry(0.2, 0.2, 0.8, 10), glassMat);
  body.name = 'bottle_body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  root.add(body);

  const neck = new Mesh(new CylinderGeometry(0.08, 0.13, 0.25, 8), glassMat);
  neck.name = 'bottle_neck';
  neck.rotation.z = Math.PI / 2;
  neck.position.x = 0.52;
  root.add(neck);

  const cork = new Mesh(new CylinderGeometry(0.07, 0.07, 0.1, 8), corkMat);
  cork.name = 'bottle_cork';
  cork.rotation.z = Math.PI / 2;
  cork.position.x = 0.66;
  root.add(cork);

  return { root, materials: [glassMat, corkMat] };
}

// ── Duck ────────────────────────────────────────────────────────────────────

/**
 * Builds a rubber duck target.
 * @returns The duck group with body, head, beak, eyes and wings.
 */
export function createDuckMeshes(): TargetMeshes {
  const root = new Group();
  root.name = 'target_duck';
  const [bodyMat, beakMat, eyeMat] = instanceMaterials(duckBodyMat, duckBeakMat, duckEyeMat);

  const body = new Mesh(new SphereGeometry(0.36, 12, 10), bodyMat);
  body.name = 'duck_body';
  body.scale.set(1, 0.75, 1.1);
  body.castShadow = true;
  root.add(body);

  const head = new Mesh(new SphereGeometry(0.26, 10, 8), bodyMat);
  head.name = 'duck_head';
  head.position.set(0, 0.36, 0.12);
  root.add(head);

  const beak = new Mesh(new CylinderGeometry(0.03, 0.09, 0.18, 6), beakMat);
  beak.name = 'duck_beak';
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.32, 0.37);
  root.add(beak);

  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.045, 6, 4), eyeMat);
    eye.name = `duck_eye_${side}`;
    eye.position.set(side * 0.11, 0.43, 0.27);
    root.add(eye);
  }

  for (const side of [-1, 1]) {
    const wing = new Mesh(new SphereGeometry(0.12, 6, 4), bodyMat);
    wing.name = `duck_wing_${side}`;
    wing.scale.set(0.3, 0.6, 1);
    wing.position.set(side * 0.3, 0, 0.04);
    root.add(wing);
  }

  return { root, materials: [bodyMat, beakMat, eyeMat] };
}

// ── Golden Barrel ───────────────────────────────────────────────────────────

/**
 * Builds the bonus golden barrel target with a pulsing emissive glow.
 * @returns The golden barrel group with body, bulge, rim and bands.
 */
export function createGoldenBarrelMeshes(): TargetMeshes {
  const root = new Group();
  root.name = 'target_golden_barrel';
  const [goldMat, bandMat] = instanceMaterials(goldenBarrelMat, goldenBandMat);

  const body = new Mesh(new CylinderGeometry(0.5, 0.5, 0.9, 12), goldMat);
  body.name = 'golden_body';
  body.castShadow = true;
  root.add(body);

  const bulge = new Mesh(new CylinderGeometry(0.57, 0.57, 0.45, 12), goldMat);
  bulge.name = 'golden_bulge';
  root.add(bulge);

  const rim = new Mesh(new CylinderGeometry(0.48, 0.48, 0.08, 12), bandMat);
  rim.name = 'golden_rim';
  rim.position.y = 0.45;
  root.add(rim);

  for (let i = 0; i < 2; i++) {
    const band = new Mesh(new TorusGeometry(0.53, 0.045, 6, 18), bandMat);
    band.name = `golden_band_${i}`;
    band.rotation.x = Math.PI / 2;
    band.position.y = i === 0 ? 0.2 : -0.2;
    root.add(band);
  }

  return { root, materials: [goldMat, bandMat] };
}

// ── Rainbow Bottle ──────────────────────────────────────────────────────────

/**
 * Builds the bonus rainbow bottle target with a hue-cycling material.
 * @returns The rainbow bottle group with body, neck and cork.
 */
export function createRainbowBottleMeshes(): TargetMeshes {
  const root = new Group();
  root.name = 'target_rainbow_bottle';
  const [rainbowMat, corkMat] = instanceMaterials(rainbowBottleMat, bottleCorkMat);

  const body = new Mesh(new CylinderGeometry(0.2, 0.2, 0.8, 10), rainbowMat);
  body.name = 'rainbow_body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  root.add(body);

  const neck = new Mesh(new CylinderGeometry(0.08, 0.13, 0.25, 8), rainbowMat);
  neck.name = 'rainbow_neck';
  neck.rotation.z = Math.PI / 2;
  neck.position.x = 0.52;
  root.add(neck);

  const cork = new Mesh(new CylinderGeometry(0.07, 0.07, 0.1, 8), corkMat);
  cork.name = 'rainbow_cork';
  cork.rotation.z = Math.PI / 2;
  cork.position.x = 0.66;
  root.add(cork);

  return { root, materials: [rainbowMat, corkMat] };
}

// ── Factory dispatch ────────────────────────────────────────────────────────

/**
 * Builds the mesh group for the given target kind.
 * @param kind - The target kind to build.
 * @returns The created mesh group plus the materials it owns.
 */
export function createTargetByKind(kind: TargetKind): TargetMeshes {
  switch (kind) {
    case 'barrel':
      return createBarrelMeshes();
    case 'bottle':
      return createBottleMeshes();
    case 'duck':
      return createDuckMeshes();
    case 'golden-barrel':
      return createGoldenBarrelMeshes();
    case 'rainbow-bottle':
      return createRainbowBottleMeshes();
  }
}

/**
 * Disposes the shared material templates. Call once, at teardown — per-target
 * clones are disposed with their target; the templates outlive every instance.
 */
export function disposeTargetMaterials(): void {
  for (const m of materialTemplates) m.dispose();
}

/**
 * Updates special target visual effects (golden pulse, rainbow hue cycle).
 * @param root - The target's root group.
 * @param kind - The target kind being animated.
 * @param time - Total elapsed game time in seconds.
 */
export function updateSpecialTargetVisuals(root: Group, kind: TargetKind, time: number): void {
  if (kind === 'golden-barrel') {
    root.traverse((child) => {
      if (child.name === 'golden_body' || child.name === 'golden_bulge') {
        const m = (child as Mesh).material as MeshStandardMaterial;
        m.emissiveIntensity = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(time * 3));
      }
    });
  } else if (kind === 'rainbow-bottle') {
    root.traverse((child) => {
      if (child.name === 'rainbow_body' || child.name === 'rainbow_neck') {
        const m = (child as Mesh).material as MeshStandardMaterial;
        m.color.setHSL((time * 0.15) % 1, 0.8, 0.55);
      }
    });
  }
}

/**
 * Returns the primary color associated with a target kind (for fragment effects).
 * @param kind - The target kind to look up.
 * @returns A new Color matching the kind's primary material.
 */
export function getTargetColor(kind: TargetKind): Color {
  switch (kind) {
    case 'barrel':
      return new Color(0.78, 0.45, 0.16);
    case 'bottle':
      return new Color(0.1, 0.78, 0.45);
    case 'duck':
      return new Color(1.0, 0.82, 0.1);
    case 'golden-barrel':
      return new Color(1.0, 0.8, 0.2);
    case 'rainbow-bottle':
      return new Color(0.7, 0.3, 1.0);
  }
}

/**
 * Collects all tappable meshes from a target group.
 * @param root - The target's root group to traverse.
 * @returns Every Mesh found under the root.
 */
export function collectTargetMeshes(root: Group): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child);
  });
  return meshes;
}

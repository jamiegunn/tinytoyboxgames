/**
 * Target geometry builders for Cannonball Splash.
 *
 * Each builder returns a Group with all sub-meshes. Materials are cached
 * at module scope for reuse across pooled instances.
 */

import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry } from 'three';
import type { TargetKind } from '../types';

// ── Cached materials (created once) ─────────────────────────────────────────

function mat(
  name: string,
  color: [number, number, number],
  opts: { metalness?: number; roughness?: number; transparent?: boolean; opacity?: number } = {},
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
  m.name = name;
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
const goldenBarrelMat = mat('golden_barrel', [1.0, 0.8, 0.2], { metalness: 0.6, roughness: 0.2 });
const goldenBandMat = mat('golden_band', [0.85, 0.62, 0.12], { metalness: 0.6, roughness: 0.25 });

// Rainbow bottle gets per-instance material since hue cycles
function createRainbowBottleMat(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color().setHSL(0, 0.8, 0.55),
    metalness: 0.1,
    roughness: 0.15,
    transparent: true,
    opacity: 0.8,
  });
  m.name = 'rainbow_bottle';
  return m;
}

// ── Barrel ──────────────────────────────────────────────────────────────────

/**
 * Builds a floating wooden barrel target.
 * @returns The barrel group with body, bulge, rim and metal bands.
 */
export function createBarrelMeshes(): Group {
  const root = new Group();
  root.name = 'target_barrel';

  const body = new Mesh(new CylinderGeometry(0.5, 0.5, 0.9, 12), barrelWoodMat);
  body.name = 'barrel_body';
  body.castShadow = true;
  root.add(body);

  const bulge = new Mesh(new CylinderGeometry(0.57, 0.57, 0.45, 12), barrelWoodMat);
  bulge.name = 'barrel_bulge';
  root.add(bulge);

  const rim = new Mesh(new CylinderGeometry(0.48, 0.48, 0.08, 12), barrelRimMat);
  rim.name = 'barrel_rim';
  rim.position.y = 0.45;
  root.add(rim);

  for (let i = 0; i < 2; i++) {
    const band = new Mesh(new TorusGeometry(0.53, 0.045, 6, 18), barrelBandMat);
    band.name = `barrel_band_${i}`;
    band.rotation.x = Math.PI / 2;
    band.position.y = i === 0 ? 0.2 : -0.2;
    root.add(band);
  }

  root.position.y = -0.28;
  return root;
}

// ── Bottle ──────────────────────────────────────────────────────────────────

/**
 * Builds a floating glass bottle target lying on its side.
 * @returns The bottle group with body, neck and cork.
 */
export function createBottleMeshes(): Group {
  const root = new Group();
  root.name = 'target_bottle';

  const body = new Mesh(new CylinderGeometry(0.2, 0.2, 0.8, 10), bottleGlassMat);
  body.name = 'bottle_body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  root.add(body);

  const neck = new Mesh(new CylinderGeometry(0.08, 0.13, 0.25, 8), bottleGlassMat);
  neck.name = 'bottle_neck';
  neck.rotation.z = Math.PI / 2;
  neck.position.x = 0.52;
  root.add(neck);

  const cork = new Mesh(new CylinderGeometry(0.07, 0.07, 0.1, 8), bottleCorkMat);
  cork.name = 'bottle_cork';
  cork.rotation.z = Math.PI / 2;
  cork.position.x = 0.66;
  root.add(cork);

  root.position.y = -0.02;
  return root;
}

// ── Duck ────────────────────────────────────────────────────────────────────

/**
 * Builds a rubber duck target.
 * @returns The duck group with body, head, beak, eyes and wings.
 */
export function createDuckMeshes(): Group {
  const root = new Group();
  root.name = 'target_duck';

  const body = new Mesh(new SphereGeometry(0.36, 12, 10), duckBodyMat);
  body.name = 'duck_body';
  body.scale.set(1, 0.75, 1.1);
  body.castShadow = true;
  root.add(body);

  const head = new Mesh(new SphereGeometry(0.26, 10, 8), duckBodyMat);
  head.name = 'duck_head';
  head.position.set(0, 0.36, 0.12);
  root.add(head);

  const beak = new Mesh(new CylinderGeometry(0.03, 0.09, 0.18, 6), duckBeakMat);
  beak.name = 'duck_beak';
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.32, 0.37);
  root.add(beak);

  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.045, 6, 4), duckEyeMat);
    eye.name = `duck_eye_${side}`;
    eye.position.set(side * 0.11, 0.43, 0.27);
    root.add(eye);
  }

  for (const side of [-1, 1]) {
    const wing = new Mesh(new SphereGeometry(0.12, 6, 4), duckBodyMat);
    wing.name = `duck_wing_${side}`;
    wing.scale.set(0.3, 0.6, 1);
    wing.position.set(side * 0.3, 0, 0.04);
    root.add(wing);
  }

  root.position.y = -0.08;
  return root;
}

// ── Golden Barrel ───────────────────────────────────────────────────────────

/**
 * Builds the bonus golden barrel target with a pulsing emissive glow.
 * @returns The golden barrel group with body, bulge, rim and bands.
 */
export function createGoldenBarrelMeshes(): Group {
  const root = new Group();
  root.name = 'target_golden_barrel';

  const body = new Mesh(new CylinderGeometry(0.5, 0.5, 0.9, 12), goldenBarrelMat);
  body.name = 'golden_body';
  body.castShadow = true;
  root.add(body);

  const bulge = new Mesh(new CylinderGeometry(0.57, 0.57, 0.45, 12), goldenBarrelMat);
  bulge.name = 'golden_bulge';
  root.add(bulge);

  const rim = new Mesh(new CylinderGeometry(0.48, 0.48, 0.08, 12), goldenBandMat);
  rim.name = 'golden_rim';
  rim.position.y = 0.45;
  root.add(rim);

  for (let i = 0; i < 2; i++) {
    const band = new Mesh(new TorusGeometry(0.53, 0.045, 6, 18), goldenBandMat);
    band.name = `golden_band_${i}`;
    band.rotation.x = Math.PI / 2;
    band.position.y = i === 0 ? 0.2 : -0.2;
    root.add(band);
  }

  // Pulsing emissive
  goldenBarrelMat.emissive = new Color(0.35, 0.26, 0.06);

  root.position.y = -0.28;
  return root;
}

// ── Rainbow Bottle ──────────────────────────────────────────────────────────

/**
 * Builds the bonus rainbow bottle target with a hue-cycling material.
 * @returns The rainbow bottle group with body, neck and cork.
 */
export function createRainbowBottleMeshes(): Group {
  const root = new Group();
  root.name = 'target_rainbow_bottle';
  const rainbowMat = createRainbowBottleMat();

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

  const cork = new Mesh(new CylinderGeometry(0.07, 0.07, 0.1, 8), bottleCorkMat);
  cork.name = 'rainbow_cork';
  cork.rotation.z = Math.PI / 2;
  cork.position.x = 0.66;
  root.add(cork);

  root.position.y = -0.02;
  return root;
}

// ── Factory dispatch ────────────────────────────────────────────────────────

/**
 * Builds the mesh group for the given target kind.
 * @param kind - The target kind to build.
 * @returns The created mesh group for that kind.
 */
export function createTargetByKind(kind: TargetKind): Group {
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
 * Updates special target visual effects (golden pulse, rainbow hue cycle).
 * @param root
 * @param kind
 * @param time
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

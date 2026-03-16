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

const barrelWoodMat = mat('barrel_wood', [0.55, 0.35, 0.18], { roughness: 0.7 });
const barrelBandMat = mat('barrel_band', [0.3, 0.3, 0.32], { metalness: 0.6, roughness: 0.4 });
const barrelRimMat = mat('barrel_rim', [0.6, 0.4, 0.22], { roughness: 0.6 });
const bottleGlassMat = mat('bottle_glass', [0.2, 0.65, 0.4], { metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.7 });
const bottleCorkMat = mat('bottle_cork', [0.7, 0.55, 0.35], { roughness: 0.8 });
const duckBodyMat = mat('duck_body', [0.95, 0.85, 0.15], { roughness: 0.35 });
const duckBeakMat = mat('duck_beak', [0.95, 0.55, 0.1], { roughness: 0.4 });
const duckEyeMat = mat('duck_eye', [0.05, 0.05, 0.05], { roughness: 0.5 });
const goldenBarrelMat = mat('golden_barrel', [0.95, 0.78, 0.2], { metalness: 0.8, roughness: 0.2 });
const goldenBandMat = mat('golden_band', [0.7, 0.55, 0.1], { metalness: 0.7, roughness: 0.3 });

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

export function createBarrelMeshes(): Group {
  const root = new Group();
  root.name = 'target_barrel';

  const body = new Mesh(new CylinderGeometry(0.4, 0.4, 0.7, 10), barrelWoodMat);
  body.name = 'barrel_body';
  body.castShadow = true;
  root.add(body);

  const bulge = new Mesh(new CylinderGeometry(0.45, 0.45, 0.35, 10), barrelWoodMat);
  bulge.name = 'barrel_bulge';
  root.add(bulge);

  const rim = new Mesh(new CylinderGeometry(0.38, 0.38, 0.06, 10), barrelRimMat);
  rim.name = 'barrel_rim';
  rim.position.y = 0.35;
  root.add(rim);

  for (let i = 0; i < 2; i++) {
    const band = new Mesh(new TorusGeometry(0.42, 0.03, 6, 16), barrelBandMat);
    band.name = `barrel_band_${i}`;
    band.rotation.x = Math.PI / 2;
    band.position.y = i === 0 ? 0.15 : -0.15;
    root.add(band);
  }

  root.position.y = -0.25;
  return root;
}

// ── Bottle ──────────────────────────────────────────────────────────────────

export function createBottleMeshes(): Group {
  const root = new Group();
  root.name = 'target_bottle';

  const body = new Mesh(new CylinderGeometry(0.12, 0.12, 0.5, 8), bottleGlassMat);
  body.name = 'bottle_body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  root.add(body);

  const neck = new Mesh(new CylinderGeometry(0.05, 0.08, 0.15, 6), bottleGlassMat);
  neck.name = 'bottle_neck';
  neck.rotation.z = Math.PI / 2;
  neck.position.x = 0.32;
  root.add(neck);

  const cork = new Mesh(new CylinderGeometry(0.04, 0.04, 0.06, 6), bottleCorkMat);
  cork.name = 'bottle_cork';
  cork.rotation.z = Math.PI / 2;
  cork.position.x = 0.4;
  root.add(cork);

  root.position.y = -0.05;
  return root;
}

// ── Duck ────────────────────────────────────────────────────────────────────

export function createDuckMeshes(): Group {
  const root = new Group();
  root.name = 'target_duck';

  const body = new Mesh(new SphereGeometry(0.25, 10, 8), duckBodyMat);
  body.name = 'duck_body';
  body.scale.set(1, 0.75, 1.1);
  body.castShadow = true;
  root.add(body);

  const head = new Mesh(new SphereGeometry(0.18, 8, 6), duckBodyMat);
  head.name = 'duck_head';
  head.position.set(0, 0.25, 0.08);
  root.add(head);

  const beak = new Mesh(new CylinderGeometry(0.02, 0.06, 0.12, 4), duckBeakMat);
  beak.name = 'duck_beak';
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.22, 0.25);
  root.add(beak);

  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.03, 6, 4), duckEyeMat);
    eye.name = `duck_eye_${side}`;
    eye.position.set(side * 0.08, 0.3, 0.18);
    root.add(eye);
  }

  for (const side of [-1, 1]) {
    const wing = new Mesh(new SphereGeometry(0.08, 6, 4), duckBodyMat);
    wing.name = `duck_wing_${side}`;
    wing.scale.set(0.3, 0.6, 1);
    wing.position.set(side * 0.2, 0, 0.03);
    root.add(wing);
  }

  root.position.y = -0.1;
  return root;
}

// ── Golden Barrel ───────────────────────────────────────────────────────────

export function createGoldenBarrelMeshes(): Group {
  const root = new Group();
  root.name = 'target_golden_barrel';

  const body = new Mesh(new CylinderGeometry(0.4, 0.4, 0.7, 10), goldenBarrelMat);
  body.name = 'golden_body';
  body.castShadow = true;
  root.add(body);

  const bulge = new Mesh(new CylinderGeometry(0.45, 0.45, 0.35, 10), goldenBarrelMat);
  bulge.name = 'golden_bulge';
  root.add(bulge);

  const rim = new Mesh(new CylinderGeometry(0.38, 0.38, 0.06, 10), goldenBandMat);
  rim.name = 'golden_rim';
  rim.position.y = 0.35;
  root.add(rim);

  for (let i = 0; i < 2; i++) {
    const band = new Mesh(new TorusGeometry(0.42, 0.03, 6, 16), goldenBandMat);
    band.name = `golden_band_${i}`;
    band.rotation.x = Math.PI / 2;
    band.position.y = i === 0 ? 0.15 : -0.15;
    root.add(band);
  }

  // Pulsing emissive
  goldenBarrelMat.emissive = new Color(0.3, 0.22, 0.05);

  root.position.y = -0.25;
  return root;
}

// ── Rainbow Bottle ──────────────────────────────────────────────────────────

export function createRainbowBottleMeshes(): Group {
  const root = new Group();
  root.name = 'target_rainbow_bottle';
  const rainbowMat = createRainbowBottleMat();

  const body = new Mesh(new CylinderGeometry(0.12, 0.12, 0.5, 8), rainbowMat);
  body.name = 'rainbow_body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  root.add(body);

  const neck = new Mesh(new CylinderGeometry(0.05, 0.08, 0.15, 6), rainbowMat);
  neck.name = 'rainbow_neck';
  neck.rotation.z = Math.PI / 2;
  neck.position.x = 0.32;
  root.add(neck);

  const cork = new Mesh(new CylinderGeometry(0.04, 0.04, 0.06, 6), bottleCorkMat);
  cork.name = 'rainbow_cork';
  cork.rotation.z = Math.PI / 2;
  cork.position.x = 0.4;
  root.add(cork);

  root.position.y = -0.05;
  return root;
}

// ── Factory dispatch ────────────────────────────────────────────────────────

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

/** Returns the primary color associated with a target kind (for fragment effects). */
export function getTargetColor(kind: TargetKind): Color {
  switch (kind) {
    case 'barrel':
      return new Color(0.55, 0.35, 0.18);
    case 'bottle':
      return new Color(0.2, 0.65, 0.4);
    case 'duck':
      return new Color(0.95, 0.85, 0.15);
    case 'golden-barrel':
      return new Color(0.95, 0.78, 0.2);
    case 'rainbow-bottle':
      return new Color(0.7, 0.3, 1.0);
  }
}

/**
 * Collects all tappable meshes from a target group.
 */
export function collectTargetMeshes(root: Group): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child);
  });
  return meshes;
}

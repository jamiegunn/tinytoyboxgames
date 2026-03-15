/**
 * Builds the main log body mesh with layered bark detail:
 * secondary bark shell, longitudinal ridges, circumferential rings,
 * bark-texture bumps, and knots.
 */
import { Mesh, Group, SphereGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { createSeededHelpers, type RandomHelpers } from '@app/utils/randomHelpers';
import { L, Rtop, Rbot, radiusAt, tFromY } from './constants';
import type { LogMaterials } from './types';

/* ── Helper: secondary bark shell ──────────────────────────────────── */

/** Adds a darker, slightly larger partial cylinder around the body.
 * @param body - The log body mesh.
 * @param mats - Shared log materials.
 */
function addBarkShell(body: Mesh, mats: LogMaterials): void {
  const barkShell = new Mesh(new CylinderGeometry(Rtop + 0.008, Rbot + 0.01, L * 0.82, 12, 1, true), mats.barkDark);
  barkShell.position.y = L * 0.04;
  body.add(barkShell);
}

/* ── Helper: longitudinal bark ridges ──────────────────────────────── */

/** Adds thin cylinders running along the log surface.
 * @param body - The log body mesh.
 * @param mats - Shared log materials.
 * @param r - Seeded random helpers.
 */
function addBarkRidges(body: Mesh, mats: LogMaterials, r: RandomHelpers): void {
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2 + r.bipolar(0.2);
    const stripLen = L * r.range(0.2, 0.75);
    const yCenter = r.bipolar((L - stripLen) * 0.7);
    const t = tFromY(yCenter);
    const rad = radiusAt(t) + 0.004;
    const strip = new Mesh(new CylinderGeometry(r.range(0.005, 0.015), r.range(0.007, 0.017), stripLen, 3, 1), mats.barkMats[i % 3]);
    strip.position.set(Math.cos(angle) * rad, yCenter, Math.sin(angle) * rad);
    body.add(strip);
  }
}

/* ── Helper: circumferential bark rings ────────────────────────────── */

/** Adds torus rings around the log at evenly spaced intervals.
 * @param body - The log body mesh.
 * @param mats - Shared log materials.
 * @param r - Seeded random helpers.
 */
function addBarkRings(body: Mesh, mats: LogMaterials, r: RandomHelpers): void {
  for (let i = 0; i < 10; i++) {
    const yy = ((i + 0.5) / 10 - 0.5) * L * 0.9;
    const t = tFromY(yy);
    const lr = radiusAt(t) + 0.006;
    const ring = new Mesh(new TorusGeometry(lr, r.range(0.004, 0.012), 5, 20), mats.barkMats[i % 3]);
    ring.position.y = yy;
    body.add(ring);
  }
}

/* ── Helper: bark-texture bumps ────────────────────────────────────── */

/** Adds flattened spheres pressed against the bark surface.
 * @param body - The log body mesh.
 * @param mats - Shared log materials.
 * @param r - Seeded random helpers.
 */
function addBarkBumps(body: Mesh, mats: LogMaterials, r: RandomHelpers): void {
  for (let i = 0; i < 16; i++) {
    const angle = r.range(0, Math.PI * 2);
    const yy = r.bipolar(L * 0.85);
    const t = tFromY(yy);
    const rad = radiusAt(t) + 0.003;
    const bump = new Mesh(new SphereGeometry(r.range(0.02, 0.045), 5, 4), r.pick(mats.barkMats));
    bump.position.set(Math.cos(angle) * rad, yy, Math.sin(angle) * rad);
    bump.scale.set(1.3, 0.25, 1.3);
    body.add(bump);
  }
}

/* ── Helper: knots with concentric swell ───────────────────────────── */

/** Adds raised knot bumps with a surrounding concentric swell.
 * @param body - The log body mesh.
 * @param mats - Shared log materials.
 */
function addKnots(body: Mesh, mats: LogMaterials): void {
  [
    { y: -0.35, a: 1.0 },
    { y: 0.15, a: 3.2 },
    { y: 0.55, a: 5.1 },
  ].forEach((k) => {
    const t = tFromY(k.y);
    const r = radiusAt(t) + 0.005;
    const kx = Math.cos(k.a) * r;
    const kz = Math.sin(k.a) * r;

    const bump = new Mesh(new SphereGeometry(0.03, 7, 5), mats.barkDark);
    bump.scale.set(1, 0.5, 1);
    bump.position.set(kx, k.y, kz);
    body.add(bump);

    const swell = new Mesh(new SphereGeometry(0.048, 5, 4), mats.barkLight);
    swell.scale.set(1, 0.35, 1);
    swell.position.set(kx, k.y, kz);
    body.add(swell);
  });
}

/* ── Main orchestrator ─────────────────────────────────────────────── */

/**
 * Creates the main log body mesh, attaches bark detail, and adds it
 * to the provided root group.
 *
 * @param root - The root group to parent the body to.
 * @param mats - Shared log materials.
 * @returns The body mesh (used as tap target and parent for hollow / end-grain / foliage).
 */
export function createLogBody(root: Group, mats: LogMaterials): Mesh {
  const r = createSeededHelpers(7001);
  const body = new Mesh(new CylinderGeometry(Rtop, Rbot, L, 18, 6), mats.barkMid);
  body.name = 'log';
  body.rotation.z = Math.PI / 2;
  body.rotation.y = 0.3;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  addBarkShell(body, mats);
  addBarkRidges(body, mats, r);
  addBarkRings(body, mats, r);
  addBarkBumps(body, mats, r);
  addKnots(body, mats);

  return body;
}

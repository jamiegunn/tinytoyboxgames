/**
 * Adds a clearly visible hollow opening at the stream-facing end of
 * the log (body-local Y = −L/2).
 *
 * The body CylinderGeometry has solid end-caps, so the dark interior
 * is invisible from outside unless we place a dark disc **on top of**
 * the end face.  That disc, plus a prominent heartwood rim and bark
 * lip, produces the visual impression of a deep hole.
 */
import { Mesh, Color, SphereGeometry, CylinderGeometry, CircleGeometry, DoubleSide } from 'three';
import { createWoodMaterial } from '@app/utils/materialFactory';
import { createSeededHelpers } from '@app/utils/randomHelpers';
import { L } from './constants';
import type { LogMaterials } from './types';

/** Radius of the visible dark opening on the end face. */
const OPENING_R = 0.145;

/**
 * Attaches hollow-opening geometry to the log body.
 *
 * @param body - The main log body mesh.
 * @param mats - Shared log materials.
 */
export function addHollow(body: Mesh, mats: LogMaterials): void {
  const r = createSeededHelpers(7003);
  const hollowMat = createWoodMaterial('hollowDarkMat', new Color(0.025, 0.015, 0.008));
  hollowMat.side = DoubleSide;

  /* ── Dark disc ON the end face — the visible opening ───────────── */
  const openingDisc = new Mesh(new CircleGeometry(OPENING_R, 20), hollowMat);
  // Place just outside the body's end cap so it renders on top.
  openingDisc.position.y = -L / 2 - 0.004;
  // Rotate so the disc's +Z normal → body −Y (faces outward).
  openingDisc.rotation.x = Math.PI / 2;
  body.add(openingDisc);

  /* ── Dark interior tunnel (adds depth when viewed at an angle) ─── */
  const hollowTunnel = new Mesh(new CylinderGeometry(0.14, 0.155, 0.32, 12, 1, true), hollowMat);
  hollowTunnel.position.y = -L / 2 + 0.16;
  body.add(hollowTunnel);

  /* ── Back wall — hemisphere cap ────────────────────────────────── */
  const hollowCap = new Mesh(new SphereGeometry(0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), hollowMat);
  hollowCap.position.y = -L / 2 + 0.32;
  hollowCap.rotation.x = Math.PI; // dome faces −Y (inward)
  body.add(hollowCap);

  /* ── Heartwood rim — arc of bumps framing the opening ────────────
   *    Replaces a full torus ring to avoid clipping the raccoon.
   * ─────────────────────────────────────────────────────────────── */
  const rimCount = 14;
  for (let i = 0; i < rimCount; i++) {
    const angle = (i / rimCount) * Math.PI * 2;
    // Skip the zone where the raccoon peeks out (body +X ≈ angle 0).
    if (angle < Math.PI * 0.18 || angle > Math.PI * 1.82) continue;

    const bump = new Mesh(new SphereGeometry(r.range(0.02, 0.028), 5, 4), mats.heartWood);
    bump.position.set(Math.cos(angle) * (OPENING_R + 0.02), -L / 2 + 0.003, Math.sin(angle) * (OPENING_R + 0.02));
    bump.scale.set(1.2, 0.5, 1.2);
    body.add(bump);
  }

  /* ── Outer bark lip — arc of bumps ─────────────────────────────── */
  const lipCount = 16;
  for (let i = 0; i < lipCount; i++) {
    const angle = (i / lipCount) * Math.PI * 2;
    if (angle < Math.PI * 0.18 || angle > Math.PI * 1.82) continue;

    const lip = new Mesh(new SphereGeometry(r.range(0.014, 0.02), 5, 4), mats.barkDark);
    lip.position.set(Math.cos(angle) * (OPENING_R + 0.055), -L / 2 - 0.002, Math.sin(angle) * (OPENING_R + 0.055));
    lip.scale.set(1.3, 0.4, 1.0);
    body.add(lip);
  }

  /* ── Broken / splintered wood chips around the rim ─────────────── */
  const chipCount = 8;
  for (let i = 0; i < chipCount; i++) {
    const angle = (i / chipCount) * Math.PI * 2 + r.bipolar(0.3);

    // Skip the bottom zone where the raccoon's paws sit.
    if (angle > Math.PI * 0.7 && angle < Math.PI * 1.3) continue;

    const chipR = OPENING_R + r.range(0.015, 0.04);
    const chip = new Mesh(new SphereGeometry(r.range(0.013, 0.022), 5, 4), r.coin() ? mats.heartWood : mats.barkDark);
    chip.position.set(Math.cos(angle) * chipR, -L / 2 - 0.005 + r.range(0, 0.015), Math.sin(angle) * chipR);
    chip.scale.set(r.range(0.6, 1.1), 0.4, r.range(0.8, 1.2));
    chip.rotation.y = angle;
    body.add(chip);
  }
}

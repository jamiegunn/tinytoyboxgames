import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { createWoodMaterial, createGlossyPaintMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import { buildToyboxEmblem } from './emblem';
import type { ToyboxSpec, ToyboxRuntime } from '@app/toyboxes/framework';

/** Dresser width — twice a normal toybox. */
const BODY_W = 3.6;
const BODY_H = 1.2;
const BODY_D = 1.4;
const DRAWER_COUNT = 4;
const DRAWER_GAP = 0.04;

/**
 * Creates a dresser-style toybox with 4 drawers and round knobs.
 * @param spec - Toybox configuration and destination metadata
 * @returns The toybox runtime
 */
export function buildDresserToybox(spec: ToyboxSpec): ToyboxRuntime {
  const baseColor = new Color(spec.palette.base);
  const accentColor = new Color(spec.palette.accent);
  const root = new Group();
  root.name = `toybox_${spec.id}_root`;
  root.position.y += 0.7;
  root.rotation.y = 0;

  const bodyMat = createGlossyPaintMaterial(`toybox_${spec.id}_mat`, baseColor);
  const darkerMat = createGlossyPaintMaterial(`toybox_${spec.id}_darkerMat`, baseColor.clone().multiplyScalar(0.85));
  const knobMat = createToyMetalMaterial(`toybox_${spec.id}_knobMat`, new Color(0.75, 0.65, 0.4));
  const footMat = createWoodMaterial(`toybox_${spec.id}_footMat`, new Color(0.5, 0.35, 0.2));

  // ── Main body (frame) ──
  const body = new Mesh(new BoxGeometry(BODY_W, BODY_H, BODY_D), bodyMat);
  body.name = `toybox_${spec.id}_body`;
  body.castShadow = true;
  root.add(body);

  // ── Top surface ──
  const top = new Mesh(
    new BoxGeometry(BODY_W + 0.1, 0.08, BODY_D + 0.1),
    createGlossyPaintMaterial(`toybox_${spec.id}_topMat`, baseColor.clone().multiplyScalar(0.9)),
  );
  top.name = `toybox_${spec.id}_top`;
  top.position.y = BODY_H / 2 + 0.04;
  top.castShadow = true;
  root.add(top);

  // ── Bottom trim ──
  const trim = new Mesh(new BoxGeometry(BODY_W + 0.05, 0.1, BODY_D + 0.05), createGlossyPaintMaterial(`toybox_${spec.id}_trimMat`, accentColor));
  trim.name = `toybox_${spec.id}_trim`;
  trim.position.y = -BODY_H / 2 - 0.02;
  root.add(trim);

  // ── Feet ──
  const footOffX = BODY_W / 2 - 0.15;
  const footOffZ = BODY_D / 2 - 0.15;
  const footY = -BODY_H / 2 - 0.12;
  [
    new Vector3(-footOffX, footY, footOffZ),
    new Vector3(footOffX, footY, footOffZ),
    new Vector3(-footOffX, footY, -footOffZ),
    new Vector3(footOffX, footY, -footOffZ),
  ].forEach((fp, fi) => {
    const foot = new Mesh(new CylinderGeometry(0.08, 0.06, 0.14, 8), footMat);
    foot.name = `toybox_${spec.id}_foot${fi}`;
    foot.position.copy(fp);
    root.add(foot);
  });

  // ── 4 Drawers — stacked vertically ──
  const totalGap = (DRAWER_COUNT + 1) * DRAWER_GAP;
  const drawerH = (BODY_H - totalGap) / DRAWER_COUNT;
  const drawerW = BODY_W - 0.12;
  const drawerD = 0.04;
  const drawerFrontZ = BODY_D / 2 + 0.005;

  const drawerMeshes: Mesh[] = [];

  for (let di = 0; di < DRAWER_COUNT; di++) {
    const drawerY = -BODY_H / 2 + DRAWER_GAP + drawerH / 2 + di * (drawerH + DRAWER_GAP);

    // Drawer face
    const drawer = new Mesh(new BoxGeometry(drawerW, drawerH - 0.02, drawerD), darkerMat);
    drawer.name = `toybox_${spec.id}_drawer${di}`;
    drawer.position.set(0, drawerY, drawerFrontZ);
    root.add(drawer);
    drawerMeshes.push(drawer);

    // Round knobs — two per drawer
    [-0.4, 0.4].forEach((kx, ki) => {
      const knob = new Mesh(new SphereGeometry(0.045, 8, 8), knobMat);
      knob.name = `toybox_${spec.id}_knob${di}_${ki}`;
      knob.position.set(kx, 0, drawerD / 2 + 0.03);
      drawer.add(knob);
    });
  }

  // ── Side panels — subtle accent stripe ──
  [-1, 1].forEach((side, si) => {
    const panel = new Mesh(new BoxGeometry(0.02, BODY_H - 0.1, BODY_D - 0.2), createGlossyPaintMaterial(`toybox_${spec.id}_sidePanel${si}`, accentColor));
    panel.name = `toybox_${spec.id}_sidePanel${si}`;
    panel.position.set(side * (BODY_W / 2 + 0.005), 0, 0);
    root.add(panel);
  });

  if (spec.emblem) {
    buildToyboxEmblem(root, spec.id, spec.emblem, accentColor);
  }

  return {
    root,
    hoverMaterials: [bodyMat],
    pickMeshes: [body, ...drawerMeshes],
    openAnimations: drawerMeshes.map((mesh, i) => ({
      object: mesh,
      propertyPath: 'position.z',
      peakValue: drawerFrontZ + 0.3 + i * 0.05,
      settleValue: drawerFrontZ + 0.15,
    })),
  };
}

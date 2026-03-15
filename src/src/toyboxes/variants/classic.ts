import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { createWoodMaterial, createGlossyPaintMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import type { ToyboxSpec, ToyboxRuntime } from '@app/toyboxes/framework';
import { buildToyboxEmblem } from './emblem';

/**
 * Creates a classic painted-chest toybox with lid, hinges, clasp, and emblem.
 * @param spec - Toybox configuration and destination metadata
 * @returns The toybox runtime
 */
export function buildClassicToybox(spec: ToyboxSpec): ToyboxRuntime {
  const baseColor = new Color(spec.palette.base);
  const accentColor = new Color(spec.palette.accent);
  const root = new Group();
  root.name = `toybox_${spec.id}_root`;
  root.position.y += 0.7;
  root.rotation.y = 0;

  const bodyMat = createGlossyPaintMaterial(`toybox_${spec.id}_mat`, baseColor);

  const body = new Mesh(new BoxGeometry(1.8, 1.2, 1.4), bodyMat);
  body.name = `toybox_${spec.id}_body`;
  body.castShadow = true;
  root.add(body);

  const cornerMat = createGlossyPaintMaterial(`toybox_${spec.id}_cornerMat`, baseColor.clone().multiplyScalar(0.9));
  const cornerPositions = [new Vector3(-0.88, 0, 0.68), new Vector3(0.88, 0, 0.68), new Vector3(-0.88, 0, -0.68), new Vector3(0.88, 0, -0.68)];
  for (let ci = 0; ci < cornerPositions.length; ci++) {
    const corner = new Mesh(new CylinderGeometry(0.06, 0.06, 1.18, 8), cornerMat);
    corner.name = `toybox_${spec.id}_corner${ci}`;
    corner.position.copy(cornerPositions[ci]);
    root.add(corner);
  }

  const lid = new Mesh(new BoxGeometry(2.0, 0.3, 1.6), createGlossyPaintMaterial(`toybox_${spec.id}_lidMat`, baseColor.clone().multiplyScalar(0.85)));
  lid.name = `toybox_${spec.id}_lid`;
  lid.position.y = 0.75;
  lid.castShadow = true;
  root.add(lid);

  const ridge = new Mesh(new BoxGeometry(2.04, 0.06, 1.64), createGlossyPaintMaterial(`toybox_${spec.id}_ridgeMat`, baseColor.clone().multiplyScalar(0.7)));
  ridge.name = `toybox_${spec.id}_ridge`;
  ridge.position.y = 0.93;
  root.add(ridge);

  const trim = new Mesh(new BoxGeometry(1.85, 0.12, 1.45), createGlossyPaintMaterial(`toybox_${spec.id}_trimMat`, accentColor));
  trim.name = `toybox_${spec.id}_trim`;
  trim.position.y = -0.56;
  root.add(trim);

  const footMat = createWoodMaterial(`toybox_${spec.id}_footMat`, new Color(0.5, 0.35, 0.2));
  const footPositions = [new Vector3(-0.75, -0.68, 0.55), new Vector3(0.75, -0.68, 0.55), new Vector3(-0.75, -0.68, -0.55), new Vector3(0.75, -0.68, -0.55)];
  for (let fi = 0; fi < footPositions.length; fi++) {
    const foot = new Mesh(new CylinderGeometry(0.07, 0.07, 0.1, 8), footMat);
    foot.name = `toybox_${spec.id}_foot${fi}`;
    foot.position.copy(footPositions[fi]);
    root.add(foot);
  }

  const hingeMat = createToyMetalMaterial(`toybox_${spec.id}_hingeMat`, new Color(0.7, 0.65, 0.5));
  [-0.5, 0.5].forEach((xOff, hi) => {
    const hinge = new Mesh(new CylinderGeometry(0.04, 0.04, 0.15, 8), hingeMat);
    hinge.name = `hinge_${spec.id}_${hi}`;
    hinge.position.set(xOff, 0.6, -0.72);
    hinge.rotation.x = Math.PI / 2;
    root.add(hinge);

    const plate = new Mesh(new BoxGeometry(0.18, 0.22, 0.02), hingeMat);
    plate.name = `plate_${spec.id}_${hi}`;
    plate.position.set(xOff, 0.55, -0.71);
    root.add(plate);
  });

  const clasp = new Mesh(new BoxGeometry(0.12, 0.18, 0.03), hingeMat);
  clasp.name = `clasp_${spec.id}`;
  clasp.position.set(0, -0.05, 0.72);
  root.add(clasp);

  const claspRing = new Mesh(new TorusGeometry(0.05, 0.0075, 16, 12), hingeMat);
  claspRing.name = `claspRing_${spec.id}`;
  claspRing.position.set(0, -0.12, 0.74);
  claspRing.rotation.x = Math.PI / 2;
  root.add(claspRing);

  const stripe = new Mesh(new BoxGeometry(1.82, 0.08, 0.02), createGlossyPaintMaterial(`toybox_${spec.id}_stripeMat`, accentColor));
  stripe.name = `toybox_${spec.id}_stripe`;
  stripe.position.set(0, 0.0, 0.72);
  root.add(stripe);

  if (spec.emblem) {
    buildToyboxEmblem(root, spec.id, spec.emblem, accentColor);
  }

  return {
    root,
    hoverMaterials: [bodyMat],
    pickMeshes: [body],
    openAnimations: [{ object: lid, propertyPath: 'rotation.x', peakValue: -0.6, settleValue: -0.5 }],
  };
}

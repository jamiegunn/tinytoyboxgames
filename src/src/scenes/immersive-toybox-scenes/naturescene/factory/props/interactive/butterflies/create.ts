import { Scene, Color, Mesh, Group, SphereGeometry, CylinderGeometry, type Material } from 'three';
import { createGlossyPaintMaterial, createTranslucentMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { animateWingFlutter, setupDriftAndFlee } from './animation';
import type { ButterflyBuildOptions, ButterflyCreateResult } from './types';
import {
  BODY_TOP_RADIUS,
  BODY_BOTTOM_RADIUS,
  BODY_HEIGHT,
  BODY_COLOR,
  WING_SPHERE_RADIUS,
  WING_SCALE_X,
  WING_SCALE_Y,
  WING_SCALE_Z,
  WING_X_OFFSET,
  WING_OPACITY,
} from './constants';

function createWing(name: string, posX: number, material: Material, parent: Group): Mesh {
  const wing = new Mesh(new SphereGeometry(WING_SPHERE_RADIUS, 6, 6), material);
  wing.name = name;
  wing.scale.set(WING_SCALE_X, WING_SCALE_Y, WING_SCALE_Z);
  wing.position.set(posX, 0, 0);
  parent.add(wing);
  return wing;
}

function addBody(parent: Group): Mesh {
  const mat = getOrCreateMaterial('bflyBodyMat', () => createGlossyPaintMaterial('bflyBodyMat', BODY_COLOR));
  const body = new Mesh(new CylinderGeometry(BODY_TOP_RADIUS, BODY_BOTTOM_RADIUS, BODY_HEIGHT, 6), mat);
  body.name = 'bfly_body';
  body.rotation.x = Math.PI / 2;
  parent.add(body);
  return body;
}

function addWings(wingColor: Color, parent: Group): { left: Mesh; right: Mesh } {
  const matName = `bflyWingMat_#${wingColor.getHexString()}`;
  const wingMat = getOrCreateMaterial(matName, () => createTranslucentMaterial(matName, wingColor, WING_OPACITY));
  return {
    left: createWing('bfly_wingL', -WING_X_OFFSET, wingMat, parent),
    right: createWing('bfly_wingR', WING_X_OFFSET, wingMat, parent),
  };
}

/**
 * Creates a butterfly with a body, two translucent wings with flutter animation,
 * and an idle drift path. Returns typed handles for interaction wiring.
 *
 * @param scene - The Three.js scene to add the butterfly to.
 * @param placement - World-space placement for the butterfly root.
 * @param options - Build options for the butterfly factory.
 * @returns Typed result with root, body mesh, and flee handle.
 */
export function createButterfly(scene: Scene, placement: EntityPlacement, options: ButterflyBuildOptions): ButterflyCreateResult {
  const { config } = options;
  const root = createEntityRoot('butterfly_root', placement, scene);

  const body = addBody(root);
  const wings = addWings(config.wingColor, root);
  const killFlutter = animateWingFlutter(wings.left, wings.right);
  const fleeHandle = setupDriftAndFlee(root, placement.position.clone(), scene);

  const killAnimations = () => {
    killFlutter();
    fleeHandle.idle.stop();
  };

  return { root, body, fleeHandle, killAnimations };
}

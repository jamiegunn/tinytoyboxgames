import { Scene, Mesh, Group, CylinderGeometry, SphereGeometry, TorusGeometry, type Material } from 'three';
import { createGlossyPaintMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { startEyeStalkSway, startCrawlLoop } from './animation';
import {
  BODY_COLOR,
  SHELL_COLOR,
  SHELL_STRIPE_COLOR,
  EYE_COLOR,
  BODY_SPHERE_RADIUS,
  BODY_SCALE_X,
  BODY_SCALE_Y,
  BODY_SCALE_Z,
  STALK_X,
  STALK_Y,
  STALK_Z_PER_SIDE,
  STALK_ROTATION_Z,
  STALK_TOP_RADIUS,
  STALK_BOTTOM_RADIUS,
  STALK_HEIGHT,
  STALK_MESH_Y,
  EYE_RADIUS,
  EYE_Y,
  SHELL_X,
  SHELL_Y,
  SHELL_DOME_RADIUS,
  SHELL_DOME_SCALE_Y,
  SHELL_RING_COUNT,
  SHELL_RING_BASE_RADIUS,
  SHELL_RING_RADIUS_STEP,
  SHELL_RING_TUBE_RADIUS,
  SHELL_RING_Y_SPACING,
  SHELL_APEX_RADIUS,
  SHELL_APEX_Y,
} from './constants';

function addEyeStalk(side: number, bodyMat: Material, parent: Group): () => void {
  const stalkGroup = new Group();
  stalkGroup.name = `eyeStalk_${side}`;
  stalkGroup.position.set(STALK_X, STALK_Y, side * STALK_Z_PER_SIDE);
  stalkGroup.rotation.z = side * STALK_ROTATION_Z;
  parent.add(stalkGroup);

  const stalk = new Mesh(new CylinderGeometry(STALK_TOP_RADIUS, STALK_BOTTOM_RADIUS, STALK_HEIGHT, 4), bodyMat);
  stalk.name = `stalk_${side}`;
  stalk.position.y = STALK_MESH_Y;
  stalkGroup.add(stalk);

  const eyeMat = getOrCreateMaterial('snailEyeMat', () => createGlossyPaintMaterial('snailEyeMat', EYE_COLOR));
  const eyeBall = new Mesh(new SphereGeometry(EYE_RADIUS, 6, 6), eyeMat);
  eyeBall.name = `snailEye_${side}`;
  eyeBall.position.y = EYE_Y;
  stalkGroup.add(eyeBall);

  return startEyeStalkSway(stalkGroup, side);
}

function createSnailMaterials() {
  return {
    body: getOrCreateMaterial('snailBodyMat', () => createGlossyPaintMaterial('snailBodyMat', BODY_COLOR)),
    shell: getOrCreateMaterial('snailShellMat', () => createGlossyPaintMaterial('snailShellMat', SHELL_COLOR)),
    shellStripe: getOrCreateMaterial('snailStripeMat', () => createGlossyPaintMaterial('snailStripeMat', SHELL_STRIPE_COLOR)),
  };
}

function addBody(bodyMat: Material, parent: Group): void {
  const body = new Mesh(new SphereGeometry(BODY_SPHERE_RADIUS, 10, 8), bodyMat);
  body.name = 'snail_body';
  body.scale.set(BODY_SCALE_X, BODY_SCALE_Y, BODY_SCALE_Z);
  body.castShadow = true;
  parent.add(body);
}

function addShellDome(shellMat: Material, shellGroup: Group): void {
  const shellDome = new Mesh(new SphereGeometry(SHELL_DOME_RADIUS, 10, 8), shellMat);
  shellDome.name = 'snail_shellDome';
  shellDome.scale.set(1, SHELL_DOME_SCALE_Y, 1);
  shellGroup.add(shellDome);
}

function addShellRings(shellMat: Material, shellStripeMat: Material, shellGroup: Group): void {
  for (let s = 0; s < SHELL_RING_COUNT; s++) {
    const ringRadius = SHELL_RING_BASE_RADIUS - s * SHELL_RING_RADIUS_STEP;
    const ring = new Mesh(new TorusGeometry(ringRadius, SHELL_RING_TUBE_RADIUS, 6, 12), s % 2 === 0 ? shellStripeMat : shellMat);
    ring.name = `snailRing_${s}`;
    ring.position.y = s * SHELL_RING_Y_SPACING;
    ring.rotation.x = Math.PI / 2;
    shellGroup.add(ring);
  }
}

function addShellApex(shellStripeMat: Material, shellGroup: Group): void {
  const apex = new Mesh(new SphereGeometry(SHELL_APEX_RADIUS, 6, 6), shellStripeMat);
  apex.name = 'snail_apex';
  apex.position.y = SHELL_APEX_Y;
  shellGroup.add(apex);
}

function addShell(shellMat: Material, shellStripeMat: Material, parent: Group): void {
  const shellGroup = new Group();
  shellGroup.name = 'snail_shellGroup';
  shellGroup.position.set(SHELL_X, SHELL_Y, 0);
  parent.add(shellGroup);

  addShellDome(shellMat, shellGroup);
  addShellRings(shellMat, shellStripeMat, shellGroup);
  addShellApex(shellStripeMat, shellGroup);
}

function addEyeStalks(bodyMat: Material, parent: Group): (() => void)[] {
  return [-1, 1].map((side) => addEyeStalk(side, bodyMat, parent));
}

export interface SnailCreateResult {
  root: Group;
  killAnimations: () => void;
}

/**
 * Creates a detailed snail with a coiled spiral shell, eye stalks, and a slimy trail.
 *
 * @param scene - The Three.js scene to add the snail to.
 * @param placement - World-space placement for the snail root.
 * @returns Typed result with root group and animation cleanup handle.
 */
export function createSnail(scene: Scene, placement: EntityPlacement): SnailCreateResult {
  const root = createEntityRoot('snail_root', placement, scene);
  const mats = createSnailMaterials();

  addBody(mats.body, root);
  addShell(mats.shell, mats.shellStripe, root);
  const stalkKills = addEyeStalks(mats.body, root);
  const crawlKill = startCrawlLoop(root, placement.position.clone());

  const killAnimations = () => {
    stalkKills.forEach((kill) => kill());
    crawlKill();
  };

  return { root, killAnimations };
}

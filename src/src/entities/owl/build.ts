import { Group, type Scene, type Vector3 } from 'three';
import { FACING_CAMERA_Y } from './palette';
import { buildBody, buildWing, buildLeg, buildTail } from './body';
import { buildHead, buildEye, buildBeak } from './head';
import { enableMeshShadows } from './geometry';
import type { OwlBuildParts } from './types';

const OWL_SCALE = 0.5;

/**
 * Builds the full owl scene graph and returns handles needed by the runtime.
 *
 * @param scene - The Three.js scene to build the owl in.
 * @param startPosition - Initial world-space position for the owl.
 * @param restFacingY - Scene-authored facing used when the owl returns to perch.
 * @returns The assembled owl parts and animation handles.
 */
export function buildOwl(scene: Scene, startPosition: Vector3, restFacingY = FACING_CAMERA_Y): OwlBuildParts {
  const root = new Group();
  root.name = 'owl_root';
  scene.add(root);
  root.position.copy(startPosition);
  root.rotation.y = restFacingY;
  root.scale.setScalar(OWL_SCALE);

  const body = buildBody(root);
  const head = buildHead(root);
  const leftEye = buildEye(head, -1);
  const rightEye = buildEye(head, 1);
  buildBeak(head);
  const wingL = buildWing(root, -1);
  const wingR = buildWing(root, 1);
  buildTail(root);
  const legL = buildLeg(root, -1);
  const legR = buildLeg(root, 1);

  enableMeshShadows(root);

  return {
    root,
    body,
    head,
    leftEye,
    rightEye,
    wingL,
    wingR,
    legL,
    legR,
  };
}

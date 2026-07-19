import { Scene, Color, Mesh, Group, SphereGeometry, Vector3 } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { createGradientSkydome } from '@app/utils/skyRig';
import { seededRng } from '@app/utils/seededRng';
import { animateCloudDrift } from './animation';

// ── Sky Backdrop ───────────────────────────────────────────────────────────────

export interface SkyBackdropCreateResult {
  root: Group;
  killAnimations: () => void;
}

/**
 * Creates a gentle sky gradient backdrop behind the scene.
 *
 * @param scene - The Three.js scene to add the sky backdrop to.
 * @returns Typed result with root group and animation cleanup handle.
 */
export function createSkyBackdrop(scene: Scene): SkyBackdropCreateResult {
  const root = new Group();
  root.name = 'sky_backdrop_root';
  scene.add(root);

  // Gradient skydome via the shared sky rig (retires the old flat sky plane).
  // Origin-centred for the orbit scene camera; radius comfortably exceeds the
  // ~14u camera distance. See scene-rendering-standards.md and #scenedescriptor.
  const sky = createGradientSkydome({
    radius: 40,
    center: new Vector3(0, 0, 0),
    topColor: new Color(0.28, 0.48, 0.68),
    horizonColor: new Color(0.4, 0.6, 0.72),
    bottomColor: new Color(0.35, 0.5, 0.62),
    horizonSharpness: 1.0,
  });
  sky.name = 'skyBackdrop';
  root.add(sky);

  // Soft clouds
  const cloudMat = createPlasticMaterial('cloudMat', new Color(0.9, 0.92, 0.95));
  cloudMat.emissive = new Color(0.3, 0.32, 0.35);
  const cloudPositions = [
    { x: -4, y: 7.5, z: -5.5, s: 1.2 },
    { x: 2, y: 8, z: -5.8, s: 1.5 },
    { x: 6, y: 7.2, z: -5.3, s: 1.0 },
    { x: -1, y: 8.5, z: -5.6, s: 0.8 },
  ];
  const rand = seededRng(4217); // fixed seed for deterministic cloud shapes
  const cloudEntries: { group: Group; homeX: number; index: number }[] = [];

  cloudPositions.forEach((cp, ci) => {
    const cloudGroup = new Group();
    cloudGroup.name = `cloud_${ci}`;
    cloudGroup.position.set(cp.x, cp.y, cp.z);
    root.add(cloudGroup);

    // Each cloud is 3-4 overlapping soft spheres
    const blobCount = 3 + Math.floor(rand() * 2);
    for (let b = 0; b < blobCount; b++) {
      const blob = new Mesh(new SphereGeometry(0.5 * cp.s, 8, 6), cloudMat);
      blob.name = `cloudBlob_${ci}_${b}`;
      blob.position.set((b - blobCount / 2) * 0.4 * cp.s, (rand() - 0.5) * 0.2 * cp.s, 0);
      blob.scale.set(1.2, 0.6, 0.8);
      cloudGroup.add(blob);
    }

    cloudEntries.push({ group: cloudGroup, homeX: cp.x, index: ci });
  });

  const killAnimations = animateCloudDrift(cloudEntries);

  return { root, killAnimations };
}

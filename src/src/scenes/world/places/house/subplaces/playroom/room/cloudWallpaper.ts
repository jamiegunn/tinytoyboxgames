import { CircleGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { CEILING_Y, BACK_WALL_FACE_Z, RIGHT_WALL_FACE_X, LEFT_WALL_FACE_X } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/** Cloud wallpaper covers the upper third of all three walls. */
const CLOUD_ZONE_BOTTOM = CEILING_Y * (2 / 3); // Y=6.0
const CLOUD_ZONE_TOP = CEILING_Y - 0.3; // leave room for crown molding

/**
 * Creates repeating cloud pattern on the upper third of all three walls.
 * @param scene - The Three.js scene to add the cloud wallpaper to
 */
export function createCloudWallpaper(scene: Scene): void {
  const cloudMat = createPlasticMaterial('hub_wpCloudMat', new Color(0.95, 0.96, 1.0));
  cloudMat.emissive = new Color(0.04, 0.04, 0.05);

  // Cloud shape: cluster of 3-4 overlapping circles
  function addCloud(name: string, cx: number, cy: number, cz: number, scale: number, rotY: number): void {
    const puffs = [
      { dx: 0, dy: 0, r: 0.28 },
      { dx: -0.22, dy: -0.04, r: 0.2 },
      { dx: 0.2, dy: -0.02, r: 0.22 },
      { dx: 0.08, dy: 0.1, r: 0.16 },
    ];
    for (let pi = 0; pi < puffs.length; pi++) {
      const p = puffs[pi];
      const puff = new Mesh(new CircleGeometry(p.r * scale, 12), cloudMat);
      puff.name = `${name}_p${pi}`;
      if (Math.abs(rotY) < 0.01) {
        // Back wall — face camera (-Z)
        puff.position.set(cx + p.dx * scale, cy + p.dy * scale, cz);
        puff.rotation.y = Math.PI;
      } else if (rotY > 0) {
        // Right wall — facing +X
        puff.position.set(cz, cy + p.dy * scale, cx + p.dx * scale * -1);
        puff.rotation.y = Math.PI / 2;
      } else {
        // Left wall — facing -X
        puff.position.set(cz, cy + p.dy * scale, cx + p.dx * scale);
        puff.rotation.y = -Math.PI / 2;
      }
      scene.add(puff);
    }
  }

  // ── Back wall clouds ──
  const backZ = BACK_WALL_FACE_Z - 0.02;
  const backCloudPositions = [
    { x: -4.5, y: 7.2, s: 1.0 },
    { x: -2.0, y: 6.8, s: 1.3 },
    { x: 0.5, y: 7.5, s: 0.9 },
    { x: 2.5, y: 6.5, s: 1.1 },
    { x: 4.8, y: 7.0, s: 0.8 },
    { x: -0.8, y: 8.0, s: 0.7 },
    { x: 3.5, y: 7.8, s: 0.9 },
    { x: -3.5, y: 8.2, s: 0.6 },
  ];
  for (let i = 0; i < backCloudPositions.length; i++) {
    const c = backCloudPositions[i];
    if (c.y >= CLOUD_ZONE_BOTTOM && c.y <= CLOUD_ZONE_TOP) {
      addCloud(`wpCloudBack${i}`, c.x, c.y, backZ, c.s, 0);
    }
  }

  // ── Right wall clouds ──
  const rightX = RIGHT_WALL_FACE_X + 0.02;
  const sideCloudPositions = [
    { z: -8, y: 7.0, s: 1.1 },
    { z: -4, y: 7.5, s: 0.9 },
    { z: -1, y: 6.8, s: 1.2 },
    { z: 2, y: 7.3, s: 0.8 },
    { z: 5, y: 7.8, s: 1.0 },
    { z: 7, y: 6.5, s: 0.7 },
    { z: -6, y: 8.0, s: 0.6 },
    { z: 3.5, y: 8.2, s: 0.8 },
  ];
  for (let i = 0; i < sideCloudPositions.length; i++) {
    const c = sideCloudPositions[i];
    if (c.y >= CLOUD_ZONE_BOTTOM && c.y <= CLOUD_ZONE_TOP) {
      addCloud(`wpCloudRight${i}`, c.z, c.y, rightX, c.s, 1);
    }
  }

  // ── Left wall clouds ──
  const leftX = LEFT_WALL_FACE_X - 0.02;
  for (let i = 0; i < sideCloudPositions.length; i++) {
    const c = sideCloudPositions[i];
    if (c.y >= CLOUD_ZONE_BOTTOM && c.y <= CLOUD_ZONE_TOP) {
      addCloud(`wpCloudLeft${i}`, c.z, c.y, leftX, c.s, -1);
    }
  }
}

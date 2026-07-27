// Visible axis-aligned bounds in shark-relative coordinates, over the whole
// range of heights ambient creatures occupy. Everything outside this box is
// provably invisible, which is what makes an off-camera wrap safe.
import { PerspectiveCamera, Frustum, Matrix4, Vector3 } from 'three';
const FOV_DEG = (0.85 * 180) / Math.PI,
  POLAR = 0.95,
  DIST = 10;
const cam = new PerspectiveCamera(FOV_DEG, 1200 / 800, 0.1, 2000);
cam.position.set(0, 0.5 + Math.cos(POLAR) * DIST, -Math.sin(POLAR) * DIST);
cam.lookAt(0, 0.35, 0);
cam.updateMatrixWorld();
cam.updateProjectionMatrix();
const f = new Frustum();
f.setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
// Creatures live between the seafloor and the top of a bobbing jellyfish.
const YS = [];
for (let y = -0.6; y <= 2.6; y += 0.05) YS.push(y);
let minZ = Infinity,
  maxZ = -Infinity,
  maxAbsX = 0,
  LIM = Number(process.env.LIM || 400);
const v = new Vector3();
for (const y of YS)
  for (let z = -60; z <= LIM; z += 0.25)
    for (let x = -LIM; x <= LIM; x += 0.25) {
      v.set(x, y, z);
      if (!f.containsPoint(v)) continue;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      if (Math.abs(x) > maxAbsX) maxAbsX = Math.abs(x);
    }
console.log(JSON.stringify({ searchLimit: LIM, minRelZ: +minZ.toFixed(2), maxRelZ: +maxZ.toFixed(2), maxAbsX: +maxAbsX.toFixed(2) }));

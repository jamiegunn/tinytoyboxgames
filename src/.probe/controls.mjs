// Controls for INSTRUMENT C. Three instruments already died by being trusted
// before their controls were run, so this one gets its controls first.
//
//   null      every creature moved to (900, 900) -- the count MUST be 0
//   crowd     every creature pinned on the shark -- the count MUST saturate
//   backonly  every creature pinned BEHIND the camera at the same distance a
//             creature 12 units in front would be -- the count MUST be 0, which
//             is the test that this is a view test and not a radius test
import { Scene, PerspectiveCamera, Frustum, Matrix4, Vector3 } from 'three';
import { bundleTs } from '../tests/framework/_tsload.mjs';
const amb = await bundleTs('src/minigames/games/little-shark/environment/ambientLife.ts');
const scene = new Scene();
const c = amb.createAmbientCreatures(scene);
const tracked = [...c.jellyfish, ...c.squids, ...c.crabs, ...c.octopuses].map((x) => x.group ?? x);
const FOV_DEG = (0.85 * 180) / Math.PI,
  POLAR = 0.95,
  DIST = 10;
const CAM_DY = 0.5 + Math.cos(POLAR) * DIST,
  CAM_DZ = -Math.sin(POLAR) * DIST;
const cam = new PerspectiveCamera(FOV_DEG, 1200 / 800, 0.1, 2000);
const frustum = new Frustum(),
  mat = new Matrix4();
function count(place) {
  let tot = 0,
    steps = 200;
  for (let i = 0; i < steps; i += 1) {
    place(i);
    cam.position.set(0, CAM_DY, CAM_DZ);
    cam.lookAt(0, 0.35, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(mat);
    tot += tracked.filter((g) => frustum.containsPoint(g.position)).length;
  }
  return +(tot / steps).toFixed(2);
}
const r = {
  null: count(() => tracked.forEach((g) => g.position.set(900, 0, 900))),
  crowd: count(() => tracked.forEach((g, k) => g.position.set(((k % 5) - 2) * 1.2, 0.5, 8 + Math.floor(k / 5) * 2))),
  backonly: count(() => tracked.forEach((g) => g.position.set(0, 0.5, -12))),
};
console.log(JSON.stringify(r));
console.log('null    expect 0      ->', r.null, r.null === 0 ? 'PASS' : 'FAIL');
console.log('crowd   expect ~21    ->', r.crowd, r.crowd >= 18 ? 'PASS' : 'FAIL');
console.log('backonly expect 0     ->', r.backonly, r.backonly === 0 ? 'PASS' : 'FAIL');

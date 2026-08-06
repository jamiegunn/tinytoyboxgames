// SCRATCH PROBE. The front-floor pieces were placed at z -3.5 on the strength of
// "the bottom third of the frame lands on z [-4.3, -1.3]" — and rendered with
// their bases below the frame edge, so only their tops showed. That figure came
// from rays at the bottom CORNERS of a narrow frame, which reach nearer than the
// bottom centre does. This asks the direct question instead: for a point on the
// floor at (x, z), where in the frame does it land, and where does a 0.9-tall
// object standing there reach?
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry('bottom', `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
`);
for (const [label, aspect] of [['phone 0.46', 0.46], ['laptop 1.60', 1.6]]) {
  const pose = M.resolveSceneCameraPose('kitchen', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 400);
  cam.position.copy(pose.position); cam.lookAt(pose.target); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  console.log(`\n=== ${label}   camera (${pose.position.x.toFixed(1)}, ${pose.position.y.toFixed(1)}, ${pose.position.z.toFixed(1)})`);
  console.log('   z     floor NDC y   top of a 0.9-tall object   verdict');
  for (let z = -5.5; z <= 1.01; z += 0.5) {
    const base = new Vector3(0, 0, z).project(cam);
    const top = new Vector3(0, 0.9, z).project(cam);
    const visible = base.y > -1 ? (top.y < 1 ? 'fully in frame' : 'top cropped') : 'BASE BELOW FRAME';
    console.log(`  ${z.toFixed(1).padStart(5)}   ${base.y.toFixed(3).padStart(7)}       ${top.y.toFixed(3).padStart(7)}            ${visible}`);
  }
  // Same sweep along x at a couple of depths, since a narrow frame is narrow.
  for (const z of [-3.0, -2.0]) {
    const row = [];
    for (let x = -5; x <= 5.01; x += 1) {
      const p = new Vector3(x, 0, z).project(cam);
      row.push(`${x.toFixed(0)}:${Math.abs(p.x) <= 1 && p.y >= -1 ? 'in' : 'out'}`);
    }
    console.log(`  floor at z ${z}: ` + row.join(' '));
  }
}
process.exit(0);

// M2 refuted the stated reason for nature's `panRangeX: 3.0, maxTargetY: 1.0`:
// the ground-coverage audit passes without them. Do they do anything at all?
// Measure the framing they actually buy — how much of the frame is above the
// treeline (i.e. bare sky) at the extremes of each constraint.
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const { resolveSceneCameraPose, sceneCameraMaxDistance, getSceneCameraPreset, SCENE_CAMERA_FOV, TREELINE_BACK_ROWS, NATURE_ENVIRONMENT } = await bundleEntry(
  'nature-constraint-value',
  `
  export { resolveSceneCameraPose, sceneCameraMaxDistance, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { TREELINE_BACK_ROWS } from './src/scenes/immersive-toybox-scenes/naturescene/factory/scaffold/treeline';
  export { NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
`,
);

const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['iPad portrait 768x1024', 768 / 1024],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];

const camAt = (position, target, aspect) => {
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return cam;
};

const preset = getSceneCameraPreset('nature');
const row0 = TREELINE_BACK_ROWS[0];
// The top of the nearest treeline row, dead ahead. Everything above this in the
// frame is sky.
const canopyTop = new Vector3(0, row0.height, row0.z);

console.log('Fraction of frame height above the near treeline canopy (1.0 = all sky)\n');
console.log('aspect                    maxTargetY=1.0   maxTargetY=2.0   panX=3.0        panX=3.5');
for (const [label, aspect] of ASPECTS) {
  const maxDistance = sceneCameraMaxDistance('nature', aspect);
  const maxPolar = preset.constraints?.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  const row = [];
  for (const [ty, tx] of [
    [1.0, 0],
    [2.0, 0],
    [0, 3.0],
    [0, 3.5],
  ]) {
    const target = new Vector3(tx, ty, preset.target[2]);
    const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(maxDistance, maxPolar, preset.azimuth)));
    const ndc = canopyTop.clone().project(camAt(position, target, aspect));
    // NDC y of the canopy top; sky fraction is everything above it.
    row.push(Math.min(1, Math.max(0, (1 - ndc.y) / 2)));
  }
  console.log(`${label.padEnd(26)}${row.map((v) => v.toFixed(3).padStart(13)).join('   ')}`);
}
console.log(`\nground ${NATURE_ENVIRONMENT.ground.width}x${NATURE_ENVIRONMENT.ground.depth}, near treeline row z=${row0.z} height=${row0.height}`);

// Does panRangeX buy anything? At the pan extremes, how many of the four portals
// are still inside NDC?
console.log('\nPortals still framed at the pan extreme (of 4), worst over aspects:');
for (const panX of [3.0, 3.5, 4.5]) {
  let worstIn = 4;
  let worstLabel = '';
  for (const [label, aspect] of ASPECTS) {
    const maxDistance = sceneCameraMaxDistance('nature', aspect);
    for (const tx of [-panX, panX]) {
      const target = new Vector3(tx, 0, preset.target[2]);
      const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(maxDistance, preset.polar, preset.azimuth)));
      const cam = camAt(position, target, aspect);
      const inside = NATURE_ENVIRONMENT.portals.filter((p) => {
        const ndc = new Vector3(p.position.x, 0.3, p.position.z).project(cam);
        return Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
      }).length;
      if (inside < worstIn) {
        worstIn = inside;
        worstLabel = `${label} tx=${tx}`;
      }
    }
  }
  console.log(`  panRangeX ${panX.toFixed(1)}: worst ${worstIn}/4 framed  (${worstLabel})`);
}

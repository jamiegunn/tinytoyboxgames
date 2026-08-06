// SCRATCH PROBE. At the aspects where per-aspect-pose.mjs returned "none",
// WHICH constraint is doing the killing, and by how much?
//
// per-aspect-pose applied three filters in series and only printed survivors.
// "none" is not a diagnosis. This one counts survivors after each filter and,
// for the poses that clear the first two, reports how far the third misses —
// so the answer is a number, not a shrug.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'narrow-binding',
  `
  export { frameSeesPastWalls, orbitPositionsAt } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);

const ASPECTS = [0.4, 0.46, 0.56, 0.62, 0.7, 0.75, 0.85, 1.0];
const CLAMP = 6.0;
const noop = () => {};
const stubCanvas = () => ({
  width: 1280,
  height: 720,
  clientWidth: 1280,
  clientHeight: 720,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  addEventListener: noop,
  removeEventListener: noop,
  style: {},
});
const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 400);
const aim = (p, t, a) => {
  cam.aspect = a;
  cam.position.copy(p);
  cam.lookAt(t);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const corners = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, y]) => new Vector3(x, y, 1).unproject(cam).sub(cam.position).normalize());
const ndcOf = (pts) => {
  let w = 0;
  const v = new Vector3();
  for (const p of pts) {
    v.copy(p).project(cam);
    const d = v.z > 1 ? Infinity : Math.max(Math.abs(v.x), Math.abs(v.y));
    if (d > w) w = d;
  }
  return w;
};
const seesCeiling = (pos, shell) => {
  const d4 = corners();
  for (const d of [d4[2], d4[3]]) {
    if (d.y <= 0) continue;
    const tC = (shell.ceilingY - pos.y) / d.y;
    const tB = d.z > 1e-6 ? (shell.backZ - pos.z) / d.z : Infinity;
    if (tC > 0 && tC < tB) return true;
  }
  return false;
};

for (const [id, fn, L] of [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
]) {
  const scene = new Scene();
  const tap = [];
  const contents = fn({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: {
      register: (t) => {
        tap.push(t);
        return noop;
      },
      registerWithPoint: (t) => {
        tap.push(t);
        return noop;
      },
      setMissHandler: noop,
      dispose: noop,
    },
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);
  const ground = contents.floorTargets?.[0];
  const props = [];
  const seen = new Set();
  for (const t of tap) {
    if (t === ground || seen.has(t)) continue;
    seen.add(t);
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) continue;
    const pts = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
    props.push({ name: t.name || '?', pts });
  }
  const isExit = (n) => n.startsWith('toybox_') || n.includes('_doorway');
  const exitProps = props.filter((p) => isExit(p.name));
  const exits = exitProps.flatMap((p) => p.pts);
  const preset = M.getSceneCameraPreset(id);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };

  console.log(
    `\n=== ${id}   room ${(2 * L.LEFT_WALL_X).toFixed(1)} wide x ${L.CEILING_Y.toFixed(2)} tall x ${L.ROOM_DEPTH.toFixed(1)} deep   exits: ${exitProps.map((p) => p.name).join(', ')}`,
  );
  console.log('  aspect  candidates  no-void  +no-ceiling  +exits<=.97   best exits ndc (pose)');
  for (const aspect of ASPECTS) {
    let n = 0,
      noVoid = 0,
      noCeil = 0,
      ok = 0,
      bestE = Infinity,
      bestPose = null;
    for (let d = 4; d <= 20.1; d += 0.5)
      for (let polar = 0.8; polar <= 1.501; polar += 0.02)
        for (let ty = 0; ty <= 3.51; ty += 0.25)
          for (let tz = shell.frontZ + 1; tz <= shell.backZ - 1.01; tz += 1) {
            n++;
            const pivot = new Vector3(0, ty, tz);
            const orbit = {
              azimuth: preset.azimuth,
              pivot,
              radii: [d],
              polars: [Math.max(0.75, polar - 0.1), polar, Math.min(1.5, polar + 0.1)],
              ceilingClamp: CLAMP,
            };
            let dirty = false;
            for (const pos of M.orbitPositionsAt(0, orbit)) {
              aim(pos, pivot, aspect);
              if (M.frameSeesPastWalls(pos, corners(), shell)) {
                dirty = true;
                break;
              }
            }
            if (dirty) continue;
            noVoid++;
            const rest = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, preset.azimuth)));
            if (rest.y > CLAMP) rest.y = CLAMP;
            aim(rest, pivot, aspect);
            if (seesCeiling(rest, shell)) continue;
            noCeil++;
            const e = ndcOf(exits);
            if (e < bestE) {
              bestE = e;
              bestPose = { d, polar, ty, tz };
            }
            if (e <= 0.97) ok++;
          }
    const pose = bestPose
      ? `d ${bestPose.d.toFixed(1)} polar ${bestPose.polar.toFixed(2)} target [0, ${bestPose.ty.toFixed(2)}, ${bestPose.tz.toFixed(1)}]`
      : '-';
    console.log(
      `  ${aspect.toFixed(2)}    ${String(n).padStart(7)}  ${String(noVoid).padStart(7)}  ${String(noCeil).padStart(11)}  ${String(ok).padStart(12)}   ${bestE === Infinity ? '   -  ' : bestE.toFixed(2)}  ${pose}`,
    );
  }
  contents?.cleanup?.();
}
process.exit(0);

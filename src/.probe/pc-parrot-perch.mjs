// Does the parrot fit on the crow's nest rim without touching the pennant?
//
// `pc-stage-solve.mjs` derives the parrot's perch from `MAST.nestRailTopY` so the
// "sitting on the rim" claim is true by construction, and it prints one warning:
// the bird's box tops out at 6.56 against a mast truck of 6.50. The root bounding
// box is far too coarse to say whether that is a collision or just a head beside
// a pole, and the masthead pennant flies from the truck at x +0.14..+1.24 — the
// same side the solver put the bird on.
//
// So measure it. The pennant is a single triangle, so it can be sampled exactly.
// The parrot is built from small primitives, so its PER-MESH world boxes are
// tight (unlike the union box, which is mostly empty space). A pennant sample
// inside any per-mesh box is a real intersection.
//
// The output is a clearance in world units for every candidate seat around the
// rim, so the seat is chosen by measurement rather than by which one I typed
// first.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-parrot-perch',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { MAST } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell/create';
   export { createParrot } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/parrot/create';`,
);

const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 768 / 1024],
  ['viewport 480x854', 480 / 854],
  ['iPhone SE 375x667', 375 / 667],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];

const cameras = ASPECTS.map(([label, aspect]) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return { label, cam };
});

const materials = M.createPirateCoveMaterials();

// ---------------------------------------------------------------- the pennant
const shellScene = new Scene();
const shell = M.createSceneShell(shellScene, { wallHeight: 2, materials });
shell.updateMatrixWorld(true);
const pennant = shell.getObjectByName('ship_pennant');
if (!pennant) throw new Error('ship_pennant not found — the shell changed shape');

// Sample the pennant triangle on a barycentric grid. One triangle, so this is
// the whole flag, not an approximation of it.
const pos = pennant.geometry.getAttribute('position');
const triLocal = [0, 1, 2].map((i) => new Vector3().fromBufferAttribute(pos, i));
const tri = triLocal.map((v) => v.clone().applyMatrix4(pennant.matrixWorld));
const PENNANT_SAMPLES = [];
const N = 40;
for (let i = 0; i <= N; i++) {
  for (let j = 0; i + j <= N; j++) {
    const a = i / N;
    const b = j / N;
    const c = 1 - a - b;
    PENNANT_SAMPLES.push(tri[0].clone().multiplyScalar(a).addScaledVector(tri[1], b).addScaledVector(tri[2], c));
  }
}
console.log(`pennant triangle world verts:`);
for (const v of tri) console.log(`   (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`);
console.log(`   ${PENNANT_SAMPLES.length} samples across the flag\n`);

// Also the crow's nest hoop and the upper mast, which the bird must equally not
// grow through — a perch that intersects its own perch is not a perch.
const NEST_PARTS = ['crows_nest_rail', 'crows_nest', 'ship_mast'].map((n) => shell.getObjectByName(n)).filter(Boolean);
console.log(`nest/mast parts found: ${NEST_PARTS.map((o) => o.name).join(', ') || '(none)'}\n`);

// ---------------------------------------------------------------- the parrot
// Per-mesh boxes. The union box of a parrot is mostly air; a beak and a tail at
// opposite corners make a box that claims the whole volume between them.
const parrotMeshBoxes = (position, rotY, scale) => {
  const scene = new Scene();
  const root = M.createParrot(scene, { position, rotY, scale });
  root.updateMatrixWorld(true);
  const boxes = [];
  root.traverse((o) => {
    if (o.isMesh) boxes.push({ name: o.name || '(unnamed)', box: new Box3().setFromObject(o) });
  });
  return boxes;
};

// Signed clearance from a point to a box: negative inside, positive outside.
const clearance = (p, b) => {
  const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
  const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
  const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
  const outside = Math.hypot(dx, dy, dz);
  if (outside > 0) return outside;
  return -Math.min(p.x - b.min.x, b.max.x - p.x, p.y - b.min.y, b.max.y - p.y, p.z - b.min.z, b.max.z - p.z);
};

const RIM = M.MAST.nestRadius * 1.02;

console.log("==== SEAT SEARCH AROUND THE CROW'S NEST RIM\n");
console.log('   seat = angle about the mast; 0 is dead forward (+z), PI is dead aft.');
console.log('   pennant clearance = smallest distance from any flag sample to any parrot mesh box.');
console.log('   Negative means the flag passes through the bird.\n');

// How far the bird's silhouette sits from the mast's on screen, worst aspect. A
// bird directly in front of or behind the mast is a lump on a pole; one offset
// to the side reads as a bird. Measured in NDC-x, at the opening pose.
const mastOffset = (boxes) => {
  let worst = Infinity;
  for (const { cam } of cameras) {
    const mast = new Vector3(0, M.MAST.nestRailTopY, M.MAST.z).project(cam);
    let best = 0;
    for (const { box } of boxes) {
      const c = box.getCenter(new Vector3()).project(cam);
      best = Math.max(best, Math.abs(c.x - mast.x));
    }
    worst = Math.min(worst, best);
  }
  return worst;
};

const framed = (boxes) => {
  for (const { label, cam } of cameras) {
    for (const { box } of boxes) {
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            const n = new Vector3(x, y, z).project(cam);
            if (Math.abs(n.x) > 1 || Math.abs(n.y) > 1) return label;
          }
    }
  }
  return null;
};

const results = [];
for (let k = 0; k < 16; k++) {
  const a = (k / 16) * Math.PI * 2;
  const p = new Vector3(Math.sin(a) * RIM, M.MAST.nestRailTopY, M.MAST.z + Math.cos(a) * RIM);
  // The bird faces outward from the mast, so it is silhouetted rather than
  // seen end-on: outward is the +a direction, and rotY 0 faces -z.
  const rotY = a + Math.PI;
  const boxes = parrotMeshBoxes(p, rotY, 1.2);
  let worst = Infinity;
  for (const s of PENNANT_SAMPLES) for (const { box } of boxes) worst = Math.min(worst, clearance(s, box));
  const top = boxes.reduce((m, b) => Math.max(m, b.box.max.y), -Infinity);
  const off = mastOffset(boxes);
  const bad = framed(boxes);
  results.push({ k, a, p, rotY, worst, top, off, bad });
  console.log(
    `   seat ${String(k).padStart(2)}  a ${(a / Math.PI).toFixed(3)}PI  pos (${p.x.toFixed(2)}, ${p.y.toFixed(3)}, ${p.z.toFixed(2)})  ` +
      `pennant ${worst >= 0 ? ' ' : ''}${worst.toFixed(3)}  top y ${top.toFixed(2)}  ` +
      `off-mast ${off.toFixed(4)} NDC  ${bad === null ? 'in frame' : `OFF at ${bad}`}`,
  );
}

console.log('\n==== VERDICT\n');
console.log('   A seat qualifies if it clears the pennant by > 0.02 and is in frame at all nine.');
console.log('   Among those, the best is the one whose silhouette stands furthest off the mast.\n');
const clear = results.filter((r) => r.worst > 0.02 && r.bad === null).sort((a, b) => b.off - a.off);
console.log(`   ${clear.length} of 16 seats qualify.`);
for (const r of clear.slice(0, 4))
  console.log(`      seat ${r.k} (${(r.a / Math.PI).toFixed(3)}PI)  off-mast ${r.off.toFixed(4)}  pennant ${r.worst.toFixed(3)}`);
const shipped = results.find((r) => Math.abs(r.a - Math.PI * 0.75) < 1e-6);
if (shipped) console.log(`\n   the seat the stage solver used (0.750PI): pennant ${shipped.worst.toFixed(3)}, off-mast ${shipped.off.toFixed(4)}`);
if (clear.length) {
  const best = clear[0];
  console.log(
    `\n   CHOSEN: a = ${(best.a / Math.PI).toFixed(3)}PI -> position (${best.p.x.toFixed(3)}, ${best.p.y.toFixed(3)}, ${best.p.z.toFixed(3)}), rotY ${best.rotY.toFixed(3)}`,
  );
}

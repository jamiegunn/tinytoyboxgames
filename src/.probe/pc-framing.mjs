// Does opening the camera out to distance 13 frame the whole ship, or just make
// it small? Reports the NDC bounding box of the ship silhouette (hull outline
// corners plus the mast top) as a fraction of the frame, per aspect, for the
// current preset and each candidate. A fix that frames everything by making the
// ship a postage stamp has traded one defect for another.
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const { SCENE_CAMERA_FOV, PIRATE_COVE_ENVIRONMENT } = await bundleEntry(
  'pc-framing',
  `export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';`,
);

const halfW = PIRATE_COVE_ENVIRONMENT.ground.width / 2 - 0.5;
const halfD = PIRATE_COVE_ENVIRONMENT.ground.depth / 2 - 0.5;
const sternCut = halfW * 0.35;
const bowNarrow = halfW * 0.5;

// Hull outline (world x, z) at deck level, plus railing tops and the mast tip.
const SILHOUETTE = [
  [-(halfW - sternCut), 0, halfD],
  [halfW - sternCut, 0, halfD],
  [halfW, 0, halfD - sternCut],
  [halfW - bowNarrow, 0, -halfD],
  [-(halfW - bowNarrow), 0, -halfD],
  [-halfW, 0, halfD - sternCut],
  [-(halfW - sternCut), 2, halfD],
  [halfW - sternCut, 2, halfD],
  [halfW, 2, halfD - sternCut],
  [-halfW, 2, halfD - sternCut],
  [0, 5.4, halfD * 0.6],
];

const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 768 / 1024],
  ['viewport 480x854', 480 / 854],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];
const mult = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);

function frame(distance, maxDistance, ceilingY, aspect) {
  const radius = MathUtils.clamp(distance * mult(aspect), 9, maxDistance ?? Infinity);
  const target = new Vector3(0, 0.3, 0);
  const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, 1.2, Math.PI)));
  if (position.y > ceilingY) position.y = ceilingY;
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [x, y, z] of SILHOUETTE) {
    const n = new Vector3(x, y, z).project(cam);
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  // Fraction of the frame the silhouette spans, and how much sticks out.
  return { w: (x1 - x0) / 2, h: (y1 - y0) / 2, clipped: Math.max(-x0 - 1, x1 - 1, -y0 - 1, y1 - 1), radius };
}

const CONFIGS = [
  ['current  d=10 max=10 ceil=4.8', 10, 10, 4.8],
  ['fix      d=13 max=-  ceil=4.8', 13, undefined, 4.8],
  ['alt      d=12 max=-  ceil=4.8', 12, undefined, 4.8],
  ['alt      d=13 max=-  ceil=6.0', 13, undefined, 6.0],
];

for (const [name, d, maxD, ceil] of CONFIGS) {
  console.log(`\n### ${name}`);
  for (const [label, aspect] of ASPECTS) {
    const f = frame(d, maxD, ceil, aspect);
    console.log(
      `  ${label.padEnd(22)} r=${f.radius.toFixed(1).padStart(4)}  ship spans ${(f.w * 100).toFixed(0).padStart(3)}% of frame width, ` +
        `${(f.h * 100).toFixed(0).padStart(3)}% of height   ${f.clipped > 0 ? `CLIPPED +${f.clipped.toFixed(2)}` : 'fully framed'}`,
    );
  }
}
process.exit(0);

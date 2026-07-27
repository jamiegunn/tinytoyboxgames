/**
 * ROUND 5, THE TWO TOOLCHAINS CHECKED AGAINST EACH OTHER.
 *
 * This round now measures the same quantity two ways: through the live renderer
 * (`nature-classes.mjs`, which reads the real camera's projection matrix out of
 * the page) and offline (`nature-portal-solve.mjs`, which builds a camera from
 * `resolveSceneCameraPose` and projects world points with three.js directly).
 * The solve is only worth anything if those two agree, because the offline one
 * is what the fix is chosen with and the rendered one is what ships.
 *
 * They did NOT agree when this was first run, and that disagreement was a real
 * bug in the harness: `__setRadius` was scaling the camera's current direction
 * instead of rebuilding the pose from the preset, so it ignored the `ceilingY`
 * clamp that the app applies at every portrait radius. See the comment on
 * `__setRadius` in nature.ts.
 *
 * This prints the per-portal screen-position disagreement in CSS px. Anything
 * above a pixel or so means the two toolchains are describing different cameras
 * and nothing measured with either can be trusted.
 */

import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'nature-agree',
  `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
`,
);

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['extreme 360x900', 360, 900],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

const project = (pos, m, w, h) => {
  const [x, y, z] = pos;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [((cx / cw) * 0.5 + 0.5) * w, (0.5 - (cy / cw) * 0.5) * h];
};

console.log('==== RENDERED CAMERA vs OFFLINE CAMERA, SAME WORLD POINTS\n');
console.log('  viewport                 portal            rendered px        offline px      delta');

let worst = 0;
for (const [vname, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(80);

  const pose = M.resolveSceneCameraPose('nature', w / h);
  const s = await page.evaluate((r) => {
    window.__setRadius(r);
    return { m: window.__projView(), radius: window.__setRadius(r) };
  }, pose.radius);

  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, w / h, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  for (const portal of M.NATURE_ENVIRONMENT.portals) {
    const p = new Vector3(portal.position.x, 0.3, portal.position.z);
    const a = project([p.x, p.y, p.z], s.m, w, h);
    const n = p.clone().project(cam);
    const b = [((n.x + 1) / 2) * w, ((1 - n.y) / 2) * h];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d > worst) worst = d;
    console.log(
      `  ${vname.padEnd(24)} ${portal.gameId.padEnd(14)} ${a[0].toFixed(1).padStart(7)},${a[1].toFixed(1).padStart(7)}   ${b[0].toFixed(1).padStart(7)},${b[1].toFixed(1).padStart(7)}   ${d.toFixed(2).padStart(6)} px`,
    );
  }
  console.log('');
}

console.log(`  worst disagreement: ${worst.toFixed(2)} px`);
console.log(
  worst < 1.5 ? '  VERDICT: the two toolchains describe the same camera.' : '  VERDICT: THEY DO NOT AGREE. Nothing measured with either is trustworthy.',
);

await browser.close();

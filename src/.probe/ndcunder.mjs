// What `playroom-toybox-framing.test.mjs` sees: the worst-corner NDC of every
// Playroom toybox at both aspect ratios, using the real camera preset, the real
// variant builders and the real placement transform.
//
// Two uses. When moving a toybox, this gives the margin directly rather than a
// pass/fail. And when a mutation of the camera or of a placement fails to turn
// the suite red, this says whether that is a hole in the test or a mutation
// that genuinely leaves everything on screen — lowering the preset's polar from
// 1.19 to 1.34 does not kill the suite because it moves the camera down AND
// back, improving every margin (adventure 0.898 -> 0.873), so passing is right.
//
// Run from the package root: `node .probe/ndcunder.mjs`
import { Box3, Vector3 } from 'three';
import esbuild from 'esbuild';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const ROOT = path.resolve('.');
async function bundleTs(rel, tag) {
  mkdirSync(path.join(ROOT, '.tstest-tmp'), { recursive: true });
  const out = path.join(ROOT, '.tstest-tmp', rel.replace(/[\\/]/g, '_').replace(/\.ts$/, `.${tag}.mjs`));
  await esbuild.build({
    entryPoints: [path.join(ROOT, rel)],
    outfile: out,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'neutral',
    external: ['three'],
    alias: { '@app': path.join(ROOT, 'src'), '@scenes': path.join(ROOT, 'src/scenes'), '@game': path.join(ROOT, 'src/minigames') },
    plugins: [
      {
        name: 's',
        setup(b) {
          b.onResolve({ filter: /\.glsl(\?raw)?$/ }, (a) => ({ path: a.path, namespace: 'g' }));
          b.onLoad({ filter: /.*/, namespace: 'g' }, () => ({ contents: 'export default ""', loader: 'js' }));
        },
      },
    ],
    logLevel: 'silent',
  });
  return import(pathToFileURL(out).href);
}
globalThis.window = { addEventListener() {}, removeEventListener() {} };
const canvas = (w, h) => ({
  clientWidth: w,
  clientHeight: h,
  addEventListener() {},
  removeEventListener() {},
  style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
  setPointerCapture() {},
  releasePointerCapture() {},
});
const tag = process.argv[2] ?? 'x';
const presets = await bundleTs('src/utils/cameraPresets.ts', tag);
const manifest = await bundleTs('src/scenes/world/places/house/subplaces/playroom/toyboxes/manifest.ts', tag);
const variants = await bundleTs('src/toyboxes/variants/index.ts', tag);
const runtime = await bundleTs('src/toyboxes/framework/runtime.ts', tag);
for (const [label, w, h] of [
  ['portrait', 405, 720],
  ['landscape', 1280, 720],
]) {
  const hnd = presets.createSceneCamera(canvas(w, h), 'playroom');
  const cam = hnd.camera;
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  const parts = [];
  for (const spec of manifest.PLAYROOM_TOYBOXES) {
    const built = variants.buildToyboxVariant(spec);
    runtime.applyToyboxPlacement(built.root, spec.placement);
    built.root.updateMatrixWorld(true);
    const bb = new Box3().setFromObject(built.root);
    let worst = 0;
    for (let i = 0; i < 8; i++) {
      const p = new Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).project(cam);
      worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
    }
    parts.push(`${spec.id} ${worst.toFixed(3)}`);
  }
  console.log(`  ${label.padEnd(10)} ${parts.join('  ')}   (limit 0.96)`);
  hnd.dispose();
}

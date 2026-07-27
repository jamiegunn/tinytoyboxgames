// Treeline / ground fitting probe.
//
// Given a candidate camera constraint set and ground size for the Nature scene,
// report for every realistic viewport:
//   - where the bottom edge of the frame meets the ground (the Round 2 charge)
//   - the screen row of the ground's far edge, and of each candidate treeline
//     band's base, so we can prove no sky gap opens between them
//   - the screen row of each band's top, and of the horizon, so we can prove
//     sky is still visible above the treeline
//   - how wide the back band and how deep the side bands must be to fill the
//     frame's corners
//
// Run: node .probe/treeline-fit.mjs
import { PerspectiveCamera, Vector3, Spherical, MathUtils } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const { getSceneCameraPreset, SCENE_CAMERA_FOV } = await bundleEntry(
  'treeline-fit',
  `
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
`,
);

const ASPECTS = [
  ['landscape 1280x720', 1280 / 720, 720],
  ['tablet 1024x768', 1024 / 768, 768],
  ['square 1x1', 1, 800],
  ['iPad portrait', 768 / 1024, 1024],
  ['viewport 480x854', 480 / 854, 854],
  ['iPhone SE 375x667', 375 / 667, 667],
  ['iPhone 15 393x852', 393 / 852, 852],
  ['Pixel 8 412x915', 412 / 915, 915],
  ['extreme 360x900', 0.4, 900],
];

const multiplier = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);

// Rebuild the pose from the live preset, overriding only the fields a candidate
// constraint block would supply. Mirrors resolveSceneCameraPose exactly.
function pose(preset, aspect, override) {
  const c = { ...(preset.constraints ?? {}), ...override };
  const target = new Vector3(...preset.target);
  const minDistance = c.minDistance ?? preset.distance * 0.2;
  const maxDistance = c.maxDistance ?? preset.distance * multiplier(aspect);
  const radius = MathUtils.clamp(preset.distance * multiplier(aspect), minDistance, maxDistance);
  const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
  const ceilingY = c.ceilingY ?? 6.0;
  if (position.y > ceilingY) position.y = ceilingY;
  return { position, target, radius };
}

function makeCam(p, aspect) {
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(p.position);
  cam.lookAt(p.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

const row = (cam, v, h) => ((1 - v.clone().project(cam).y) / 2) * h;

// Ground-plane hit of the view ray through a given NDC point.
function groundHit(cam, ndcX, ndcY) {
  const dir = new Vector3(ndcX, ndcY, 0.5).unproject(cam).sub(cam.position).normalize();
  if (dir.y >= -1e-6) return null;
  return cam.position.clone().addScaledVector(dir, -cam.position.y / dir.y);
}

// Where the view ray through an NDC point crosses a vertical plane z = zPlane.
function planeHitZ(cam, ndcX, ndcY, zPlane) {
  const dir = new Vector3(ndcX, ndcY, 0.5).unproject(cam).sub(cam.position).normalize();
  const t = (zPlane - cam.position.z) / dir.z;
  if (!isFinite(t) || t <= 0) return null;
  return cam.position.clone().addScaledVector(dir, t);
}

function evaluate(label, override, ground, bands) {
  const preset = getSceneCameraPreset('nature');
  const halfW = ground.width / 2;
  const halfD = ground.depth / 2;
  console.log(`\n======== ${label}`);
  console.log(`  ground ${ground.width}x${ground.depth} (|x|<=${halfW}, |z|<=${halfD})   override ${JSON.stringify(override)}`);
  console.log(`  bands ${bands.map((b) => `z=${b.z}/h=${b.h}`).join('  ')}`);
  let worstNear = 0;
  let anyGap = false;
  let anyNoSky = false;
  let needBackHalfW = 0;
  for (const [name, aspect, h] of ASPECTS) {
    const p = pose(preset, aspect, override);
    const cam = makeCam(p, aspect);

    const near = groundHit(cam, 0, -1);
    const nearL = groundHit(cam, -1, -1);
    const nearWorst = Math.max(Math.abs(near?.z ?? Infinity), Math.abs(nearL?.z ?? Infinity));
    worstNear = Math.max(worstNear, nearWorst);
    const nearFail = nearWorst > halfD + 1e-6;

    // Far edge of the authored ground, and each band base, as screen rows.
    const farRow = row(cam, new Vector3(0, 0, halfD), h);
    const horizonRow = row(cam, new Vector3(0, 0, 1e5), h);

    const bandRows = bands.map((b) => ({
      base: row(cam, new Vector3(0, 0, b.z), h),
      top: row(cam, new Vector3(0, b.h, b.z), h),
    }));

    // A sky gap opens if the nearest band's base sits ABOVE (smaller row than)
    // the ground's far edge -- i.e. the band starts higher up the screen than
    // the ground stops, leaving skydome between them.
    const gap = bandRows[0].base < farRow - 0.5;
    if (gap) anyGap = true;

    // Sky is visible only if the tallest band's top is below the frame top.
    const highestTop = Math.min(...bandRows.map((b) => b.top));
    const noSky = highestTop <= 0;
    if (noSky) anyNoSky = true;

    // How wide the back band must be to fill the frame at its own plane: only
    // the x extent within the band's own height range matters, because above
    // the band we intend to show sky anyway.
    for (const ndcX of [-1, 1]) {
      for (const ndcY of [-1, -0.5, 0, 0.5, 1]) {
        const hit = planeHitZ(cam, ndcX, ndcY, bands[0].z);
        if (hit && hit.y >= -0.5 && hit.y <= bands[0].h) {
          needBackHalfW = Math.max(needBackHalfW, Math.abs(hit.x));
        }
      }
    }

    // Does the tallest band break the horizon line? A treeline entirely below
    // the horizon reads as a pit rather than as a forest edge surrounding you.
    const breaksHorizon = highestTop < horizonRow;

    // Visible ground half-width at the scene centre plane and at the far edge:
    // if either exceeds the authored half-width the side of the ground is on
    // screen and needs masking.
    let seenX = 0;
    for (const zp of [0, halfD]) {
      for (const ndcX of [-1, 1]) {
        const hit = planeHitZ(cam, ndcX, -1, zp);
        if (hit) seenX = Math.max(seenX, Math.abs(hit.x));
      }
    }

    console.log(
      `  ${nearFail ? 'FAIL' : 'ok  '} ${name.padEnd(20)} r=${p.radius.toFixed(2)} camY=${p.position.y.toFixed(2)} ` +
        `nearZ=${nearWorst.toFixed(2)} | farEdgeRow=${farRow.toFixed(0)} b1base=${bandRows[0].base.toFixed(0)}${gap ? ' GAP' : ''} ` +
        `tops=${bandRows.map((b) => b.top.toFixed(0)).join(',')} horizon=${horizonRow.toFixed(0)}${noSky ? ' NOSKY' : ''}` +
        ` ${breaksHorizon ? 'breaksHorizon' : 'below-horizon'} seenX=${seenX.toFixed(2)}` +
        `\n         bases=${bandRows.map((b) => b.base.toFixed(0)).join(',')}` +
        // Each band behind the first must have its base hidden behind the band
        // in front of it, or the player sees it standing on nothing.
        bandRows
          .slice(1)
          .map((b, i) => (b.base > bandRows[i].top ? '' : ` BASE${i + 2}-EXPOSED`))
          .join(''),
    );
  }
  console.log(
    `  => worst near |z| ${worstNear.toFixed(2)} vs halfD ${halfD}  ${worstNear > halfD ? 'FAIL' : 'PASS'}` +
      `   sky gap: ${anyGap ? 'YES' : 'none'}   sky above treeline: ${anyNoSky ? 'LOST somewhere' : 'kept'}` +
      `   back band needs half-width >= ${needBackHalfW.toFixed(2)}`,
  );
}

// The opening pose is not the worst case: the player can pan, tilt and zoom
// within the preset's constraints. The bottom edge reaches furthest when the
// camera is at max radius, at the most level tilt (maxPolar), looking at the
// highest permitted target. Ground coverage must hold across that whole
// envelope, not just at t=0.
function envelope(label, override, ground) {
  const preset = getSceneCameraPreset('nature');
  const c = { ...(preset.constraints ?? {}), ...override };
  const halfW = ground.width / 2;
  const halfD = ground.depth / 2;
  const panRangeX = c.panRangeX ?? 3.5;
  const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
  const maxTargetY = c.maxTargetY ?? 2.0;
  const ceilingY = c.ceilingY ?? 6.0;
  const maxAz = c.maxAzimuthRange ?? 0.25;
  console.log(`\n-------- ENVELOPE ${label}   ground ${ground.width}x${ground.depth}`);
  console.log(`  polar ${minPolar.toFixed(2)}..${maxPolar.toFixed(2)}  panX +-${panRangeX}  targetY <=${maxTargetY}  az +-${maxAz}  ceilingY ${ceilingY}`);
  let worstZ = 0;
  let worstX = 0;
  let worstCase = '';
  for (const [name, aspect] of ASPECTS) {
    const maxDistance = c.maxDistance ?? preset.distance * multiplier(aspect);
    for (const polar of [minPolar, preset.polar, maxPolar]) {
      for (const tx of [-panRangeX, 0, panRangeX]) {
        for (const ty of [0, maxTargetY]) {
          for (const az of [preset.azimuth - maxAz, preset.azimuth, preset.azimuth + maxAz]) {
            const target = new Vector3(tx, ty, preset.target[2]);
            const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(maxDistance, polar, az)));
            if (position.y > ceilingY) position.y = ceilingY;
            if (position.y <= 0.05) continue;
            const cam = makeCam({ position, target }, aspect);
            for (const ndcX of [-1, 0, 1]) {
              const hit = groundHit(cam, ndcX, -1);
              if (!hit) {
                worstZ = Infinity;
                worstCase = `${name} UNBOUNDED polar=${polar.toFixed(2)}`;
                continue;
              }
              if (Math.abs(hit.z) > worstZ) {
                worstZ = Math.abs(hit.z);
                worstCase = `${name} polar=${polar.toFixed(2)} tx=${tx} ty=${ty} az=${(az - preset.azimuth).toFixed(2)}`;
              }
              worstX = Math.max(worstX, Math.abs(hit.x));
            }
          }
        }
      }
    }
  }
  const pass = worstZ <= halfD + 1e-6 && worstX <= halfW + 1e-6;
  console.log(`  worst reach |z|=${worstZ.toFixed(2)} (vs ${halfD})  |x|=${worstX.toFixed(2)} (vs ${halfW})  ${pass ? 'PASS' : 'FAIL'}   at ${worstCase}`);
  return { worstZ, worstX };
}

const BANDS = [
  { z: 9.5, h: 3.5 },
  { z: 13, h: 4.2 },
  { z: 16, h: 4.5 },
];

const G = { maxDistance: 12, minPolar: 1.12, maxPolar: 1.3, panRangeX: 3.0, maxTargetY: 1.0, maxAzimuthRange: 0.2 };
const TALL = [
  { z: 9.5, h: 3.8 },
  { z: 13, h: 4.9 },
  { z: 16.5, h: 5.8 },
];

// The definitive check. Sweep a grid of view rays across the frame for every
// camera in the interaction envelope and classify each one:
//
//   - hits the authored ground rectangle           -> forest floor, correct
//   - blocked by a treeline band first             -> foliage, correct
//   - never descends to y = 0                      -> sky above the treeline, correct
//   - descends to y = 0 OUTSIDE the rectangle      -> DEFECT: the player is
//     looking at the floor of the world and seeing the inside of the skydome
//
// The last case is the Round 2 charge stated as a ray test, and it subsumes both
// the near-edge overrun and any side-edge overrun without needing separate
// metrics for each.
function rayAudit(label, override, ground, bands, sideX, sideZNear, backHalfW = sideX, sideZFar = null) {
  const preset = getSceneCameraPreset('nature');
  const c = { ...(preset.constraints ?? {}), ...override };
  const halfW = ground.width / 2;
  const halfD = ground.depth / 2;
  const panRangeX = c.panRangeX ?? 3.5;
  const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
  const maxTargetY = c.maxTargetY ?? 2.0;
  const ceilingY = c.ceilingY ?? 6.0;
  const maxAz = c.maxAzimuthRange ?? 0.25;
  const backZ = bands.length ? bands[0].z : -Infinity;
  const backH = bands.length ? Math.max(...bands.map((b) => b.h)) : 0;

  // Nearest blocking hit among the treeline surfaces, as a ray parameter.
  const bandBlock = (origin, dir) => {
    let best = Infinity;
    for (const b of bands) {
      const t = (b.z - origin.z) / dir.z;
      if (t > 0) {
        const p = origin.clone().addScaledVector(dir, t);
        if (Math.abs(p.x) <= backHalfW && p.y >= 0 && p.y <= b.h) best = Math.min(best, t);
      }
    }
    const zFar = sideZFar ?? backZ;
    for (const sx of [-sideX, sideX]) {
      const t = (sx - origin.x) / dir.x;
      if (t > 0) {
        const p = origin.clone().addScaledVector(dir, t);
        if (p.z >= sideZNear && p.z <= zFar && p.y >= 0 && p.y <= backH) best = Math.min(best, t);
      }
    }
    return best;
  };

  let total = 0;
  let defects = 0;
  let shortHits = 0;
  let sideHits = 0;
  let overHits = 0;
  let worst = null;
  for (const [name, aspect] of ASPECTS) {
    const maxDistance = c.maxDistance ?? preset.distance * multiplier(aspect);
    for (const polar of [minPolar, preset.polar, maxPolar]) {
      for (const tx of [-panRangeX, 0, panRangeX]) {
        for (const ty of [0, maxTargetY]) {
          for (const az of [preset.azimuth - maxAz, preset.azimuth, preset.azimuth + maxAz]) {
            const target = new Vector3(tx, ty, preset.target[2]);
            const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(maxDistance, polar, az)));
            if (position.y > ceilingY) position.y = ceilingY;
            const cam = makeCam({ position, target }, aspect);
            for (let iy = 0; iy <= 8; iy++) {
              for (let ix = 0; ix <= 8; ix++) {
                const ndcX = -1 + (ix / 8) * 2;
                const ndcY = -1 + (iy / 8) * 2;
                const dir = new Vector3(ndcX, ndcY, 0.5).unproject(cam).sub(cam.position).normalize();
                total++;
                if (dir.y >= -1e-6) continue;
                const tGround = -cam.position.y / dir.y;
                const hit = cam.position.clone().addScaledVector(dir, tGround);
                const inside = Math.abs(hit.x) <= halfW + 1e-6 && Math.abs(hit.z) <= halfD + 1e-6;
                if (inside) continue;
                if (bandBlock(cam.position, dir) < tGround) continue;
                // Three different things can be true of an unblocked ray, and
                // only two of them are the charge. SHORT lands nearer than the
                // ground's near edge -- that is sky under the player's feet.
                // SIDE lands beside the ground within its depth -- sky beside
                // the grass. OVER lands past the far edge, having cleared the
                // whole treeline, which is where the skydome legitimately is:
                // that is what looking over a forest at the sky looks like.
                if (hit.z < -halfD - 1e-6) shortHits++;
                else if (hit.z <= halfD + 1e-6) sideHits++;
                else {
                  overHits++;
                  continue;
                }
                defects++;
                if (!worst || Math.abs(hit.z) > Math.abs(worst.z)) {
                  worst = { ...hit, name, polar, tx, ty, az, ndcX, ndcY };
                }
              }
            }
          }
        }
      }
    }
  }
  console.log(`\n~~~~ RAY AUDIT ${label}`);
  console.log(`  ground ${ground.width}x${ground.depth}  bands ${bands.map((b) => `z${b.z}/h${b.h}`).join(' ')}  side |x|=${sideX} from z=${sideZNear}`);
  console.log(
    `  ${defects === 0 ? 'CLEAN' : 'DEFECT'}: ${defects}/${total} rays land short of or beside the ground unblocked` +
      `  (short ${shortHits}, side ${sideHits}; over-the-treeline ${overHits} = sky, not counted)` +
      (worst
        ? `\n  worst: (${worst.x.toFixed(1)}, ${worst.z.toFixed(1)}) at ${worst.name} polar=${worst.polar.toFixed(2)} tx=${worst.tx} ty=${worst.ty} ndc=(${worst.ndcX.toFixed(2)},${worst.ndcY.toFixed(2)})`
        : ''),
  );
  return defects;
}

const MID = [
  { z: 9.5, h: 3.9 },
  { z: 12.5, h: 4.6 },
  { z: 15.5, h: 5.1 },
];

evaluate('G + short bands, ground 22x20', G, { width: 22, depth: 20 }, BANDS);
evaluate('G + tall bands, ground 22x20', G, { width: 22, depth: 20 }, TALL);
evaluate('G + mid bands, ground 22x20', G, { width: 22, depth: 20 }, MID);

envelope('A: today (no constraints)', {}, { width: 16, depth: 14 });
envelope('C: maxDistance 12, 20x20', { maxDistance: 12 }, { width: 20, depth: 20 });
envelope(
  'C+: maxDistance 12, 20x20, tightened like pirate-cove',
  { maxDistance: 12, minPolar: 1.14, maxPolar: 1.26, panRangeX: 2.2, maxTargetY: 0.9, maxAzimuthRange: 0.18 },
  { width: 20, depth: 20 },
);
envelope(
  'F: looser pan 3.0, ground 22x20',
  { maxDistance: 12, minPolar: 1.14, maxPolar: 1.26, panRangeX: 3.0, maxTargetY: 0.9, maxAzimuthRange: 0.18 },
  { width: 22, depth: 20 },
);
envelope('G: chosen, ground 22x20', G, { width: 22, depth: 20 });

rayAudit('today: no bands, no constraints, 16x14', {}, { width: 16, depth: 14 }, [], 999, 0);
rayAudit('G + mid bands, back only (no side bands)', G, { width: 22, depth: 20 }, MID, 11.5, 9.4);
rayAudit('G + mid bands + side bands from z=-10', G, { width: 22, depth: 20 }, MID, 11.5, -10);
rayAudit('+ sides run past the back band to z=15.5', G, { width: 22, depth: 20 }, MID, 11.5, -10, 11.5, 15.5);
rayAudit('+ back band widened to |x|<=15', G, { width: 22, depth: 20 }, MID, 11.5, -10, 15, 15.5);
rayAudit('ground 24x20, sides at |x|=11.8 inside the ground edge', G, { width: 24, depth: 20 }, MID, 11.8, -10, 12, 15.5);
rayAudit('ground 24x22, sides |x|=11.8 from z=-11', G, { width: 24, depth: 22 }, MID, 11.8, -11, 12, 15.5);
// A tighter diorama: pull the camera in harder so the ground can stay closer to
// the 16x14 the scene's props were authored around.
// Tightening the camera is only free if the things a child must be able to tap
// stay on screen at the opening pose. The portals are the scene's entire reason
// to exist; a constraint that frames them off the edge of a phone trades one
// defect for a worse one.
const MUST_SEE = [
  ['portal bubble-pop', new Vector3(-3, 0.3, -2)],
  ['portal little-shark', new Vector3(3, 0.3, -1)],
  ['portal fireflies', new Vector3(3.5, 0.3, -4)],
  ['portal star-catcher', new Vector3(-2.2, 0.3, -4.8)],
];

function visibility(label, override, points = MUST_SEE) {
  const preset = getSceneCameraPreset('nature');
  console.log(`\n**** VISIBILITY ${label}`);
  for (const [name, aspect] of ASPECTS) {
    const p = pose(preset, aspect, override);
    const cam = makeCam(p, aspect);
    // Report how far outside the frame each miss lands, in NDC units, so a
    // near-miss can be told apart from a portal that is nowhere near the frame.
    const off = points
      .map(([n, v]) => {
        const q = v.clone().project(cam);
        const overX = Math.abs(q.x) - 1;
        const overY = Math.abs(q.y) - 1;
        const over = Math.max(overX, overY);
        const axis = overX > overY ? (q.x > 0 ? 'right' : 'left') : q.y > 0 ? 'top' : 'bottom';
        return over > 0 ? `${n.replace('portal ', '')}+${over.toFixed(2)}(${axis})` : null;
      })
      .filter(Boolean);
    console.log(`  ${off.length ? 'OFFSCREEN' : 'all visible'} ${name.padEnd(20)} ${off.join(', ')}`);
  }
}

const TIGHT = { maxDistance: 10, minPolar: 1.14, maxPolar: 1.26, panRangeX: 2.2, maxTargetY: 0.8, maxAzimuthRange: 0.15 };
const TIGHT_BANDS = [
  { z: 8.0, h: 3.6 },
  { z: 10.5, h: 4.3 },
  { z: 13.0, h: 4.8 },
];
envelope('TIGHT: maxDistance 10, ground 20x18', TIGHT, { width: 20, depth: 18 });
rayAudit('TIGHT + bands, ground 20x18, sides |x|=9.8', TIGHT, { width: 20, depth: 18 }, TIGHT_BANDS, 9.8, -9, 10, 13);
rayAudit('TIGHT + bands, ground 20x16, sides |x|=9.8', TIGHT, { width: 20, depth: 16 }, TIGHT_BANDS, 9.8, -8, 10, 13);
rayAudit('TIGHT + bands, ground 18x16, sides |x|=8.8', TIGHT, { width: 18, depth: 16 }, TIGHT_BANDS, 8.8, -8, 9, 13);

visibility('today (no constraints)', {});
visibility('TIGHT (maxDistance 10)', TIGHT);
visibility('G (maxDistance 12)', G);

// Keeping the pull-back means the world has to be as big as the pull-back can
// see. Only the ceiling-clamped extreme aspect is capped, and only to stop the
// ground having to grow without bound.
const WIDE = { maxDistance: 17, maxTargetY: 1.0, panRangeX: 3.0 };
const WIDE_BANDS = [
  { z: 13.5, h: 5.2 },
  { z: 17.0, h: 6.2 },
  { z: 20.5, h: 7.0 },
];
visibility('WIDE (maxDistance 17)', WIDE);
envelope('WIDE, ground 26x30', WIDE, { width: 26, depth: 30 });
rayAudit('WIDE + bands, ground 26x30, sides |x|=12.8', WIDE, { width: 26, depth: 30 }, WIDE_BANDS, 12.8, -16, 13, 20.5);
rayAudit('WIDE + bands, ground 26x32, sides |x|=12.8', WIDE, { width: 26, depth: 32 }, WIDE_BANDS, 12.8, -17, 13, 20.5);
evaluate('WIDE + bands, ground 26x32', WIDE, { width: 26, depth: 32 }, WIDE_BANDS);

// WIDE_BANDS keeps every ray off the floor plane but is too tall: at landscape
// the second and third bands project above row 0, so the frame has no sky left.
// Heights re-solved from the measured rows-per-unit at each band depth to land
// the tops near rows 40 / 25 / 15 in landscape -- above the horizon, so the
// treeline still reads as standing in front of the sky, but not through the top
// of the frame.
const WIDE_BANDS_2 = [
  { z: 13.5, h: 4.4 },
  { z: 17.0, h: 4.85 },
  { z: 20.5, h: 5.3 },
];
evaluate('WIDE + shorter bands, ground 26x28', WIDE, { width: 26, depth: 28 }, WIDE_BANDS_2);
envelope('WIDE, ground 26x28', WIDE, { width: 26, depth: 28 });
rayAudit('WIDE + shorter bands, ground 26x28, sides |x|=12.8', WIDE, { width: 26, depth: 28 }, WIDE_BANDS_2, 12.8, -15, 13, 20.5);
rayAudit('WIDE + shorter bands, ground 26x26, sides |x|=12.8', WIDE, { width: 26, depth: 26 }, WIDE_BANDS_2, 12.8, -14, 13, 20.5);

// The fireflies portal is framed off every phone today, before any change in
// this round. Enlarging the world does not move it back on. Test whether
// pulling the two outermost portals in towards the owl does.
const MUST_SEE_MOVED = [
  ['portal bubble-pop', new Vector3(-2.6, 0.3, -1.8)],
  ['portal little-shark', new Vector3(2.6, 0.3, -1.0)],
  ['portal fireflies', new Vector3(2.9, 0.3, -3.2)],
  ['portal star-catcher', new Vector3(-2.0, 0.3, -3.8)],
];
visibility('WIDE, portals pulled in', WIDE, MUST_SEE_MOVED);

// The extreme aspect is the one place WIDE frames less than today does, because
// today's uncapped portrait pull-back reaches r=18.75 there. If the world is big
// enough for the uncapped pull-back, the cap buys nothing and costs framing.
const OPEN = { maxTargetY: 1.0, panRangeX: 3.0 };
const MUST_SEE_MOVED_2 = [
  ['portal bubble-pop', new Vector3(-2.6, 0.3, -1.8)],
  ['portal little-shark', new Vector3(2.6, 0.3, -1.0)],
  ['portal fireflies', new Vector3(2.5, 0.3, -2.8)],
  ['portal star-catcher', new Vector3(-2.0, 0.3, -3.8)],
];
visibility('OPEN (no distance cap), portals pulled in', OPEN, MUST_SEE_MOVED_2);
envelope('OPEN, ground 26x28', OPEN, { width: 26, depth: 28 });
envelope('OPEN, ground 28x32', OPEN, { width: 28, depth: 32 });
rayAudit('OPEN + shorter bands, ground 28x32, sides |x|=13.8', OPEN, { width: 28, depth: 32 }, WIDE_BANDS_2, 13.8, -17, 14, 20.5);
evaluate('OPEN + shorter bands, ground 28x32', OPEN, { width: 28, depth: 32 }, WIDE_BANDS_2);

// How much of the occlusion is load-bearing? Real trees are scalloped cones with
// gaps between the canopies, so only a continuous low undergrowth skirt can be
// claimed as solid. Re-run the audit with every band cut to skirt height: if it
// is still clean, the canopies are free to be as gappy as they like and the
// contract test can assert the skirt alone.
const SKIRT_ONLY = WIDE_BANDS_2.map((b) => ({ z: b.z, h: 1.2 }));
rayAudit('OPEN + skirt only (h=1.2), ground 28x32, sides |x|=13.8', OPEN, { width: 28, depth: 32 }, SKIRT_ONLY, 13.8, -17, 14, 20.5);
rayAudit('OPEN + NO treeline at all, ground 28x32', OPEN, { width: 28, depth: 32 }, [], 999, 0);

// ---------------------------------------------------------------------------
// SHIPPED envelope, read from the scene catalog rather than from an override.
//
// Every audit above passes `OPEN = { maxTargetY: 1.0, panRangeX: 3.0 }`. When
// mutation M2 showed `panRangeX: 3.0` was indistinguishable from the shared 3.5
// default on every instrumented metric, it was removed from the catalog — which
// silently invalidated every "CLEAN 0/39366" line above, because they audit an
// envelope 0.5 units narrower than the one that now ships. Passing `{}` merges
// nothing, so the constraints come from `sceneCatalog.ts` itself.
rayAudit('SHIPPED (constraints read from sceneCatalog), ground 28x32, sides |x|=13.8', {}, { width: 28, depth: 32 }, WIDE_BANDS_2, 13.8, -17, 14, 20.5);
envelope('SHIPPED (constraints read from sceneCatalog), ground 28x32', {}, { width: 28, depth: 32 });
visibility('SHIPPED (constraints read from sceneCatalog), portals', {}, MUST_SEE_MOVED_2);

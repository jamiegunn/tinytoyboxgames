/**
 * Sky and fog must agree — a scene may only fog toward a colour that is
 * actually on screen, it must not fog the things a child is meant to touch, and
 * it must genuinely haze the backdrop.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * `createGradientSkydome` builds its material with `fog: false`,
 * `side: BackSide` and `depthWrite: false` (skyRig.ts:101). It is an opaque
 * sphere drawn around the camera that the fog cannot touch. Consequently the
 * renderer's clear colour is painted over before a single pixel reaches the
 * canvas: `environment.clearColor` is, in both immersive scenes, a value that is
 * never rasterised.
 *
 * Both scenes fogged toward it anyway.
 *
 * In Pirate Cove that meant the ocean receded toward a dark navy while the sky
 * it meets was pale blue. Measured off a real 1280x720 render
 * (`.probe/pc-seam.py`):
 *
 *   band                   rgb              luminance
 *   ---------------------  ---------------  ---------
 *   sky above the horizon  (219, 224, 228)      223.4
 *   sea, far               ( 63, 108, 137)      100.5
 *   sea, mid               ( 67, 112, 140)      104.2
 *   sea, near              (105, 144, 157)      136.6
 *
 * The sea got DARKER as it receded while the sky above it stayed bright. That is
 * aerial perspective run backwards, and it rendered as a 213.2-RGB-unit step
 * across eight pixel rows at both the left and right edges of the frame — the
 * largest colour edge anywhere in the image, larger than any material boundary
 * on the ship itself.
 *
 * Nothing caught it because the source said the opposite of what it did. The
 * comment above the fog line claimed it was "matched to the clear colour...
 * softens the sunset backdrop into the ocean haze". The backdrop it claims to
 * soften is `fog: false` and therefore untouched. The code and its own
 * documentation disagreed, and the documentation was the thing a reader trusted.
 *
 * WHY THIS SUITE RASTERISES THE GRADIENT
 * --------------------------------------
 * Asserting `fog.color.equals(sky.horizonColor)` compares two config fields and
 * proves only that two literals match. It would not notice if
 * `createGradientSkydome` stopped honouring `horizonColor`, or if
 * `horizonSharpness` were set so steeply that the band a viewer actually sees at
 * eye level is nowhere near it.
 *
 * So this suite builds the REAL dome from each scene's REAL config, reads the
 * per-vertex colours the shader will interpolate, and averages the band within
 * one degree of the horizon — the pixels adjacent to the seam. The fog colour
 * must match THAT.
 *
 * WHY THE DISTANCE TESTS MEASURE VIEW DEPTH AND NOT WORLD DISTANCE
 * ---------------------------------------------------------------
 * The first draft of this suite asserted
 * `fog.near >= hypot(ground.width / 2, ground.depth / 2)` — "fog must start
 * beyond the scene's own geometry" — and failed Nature (near 17 against a
 * 21.3-unit half-diagonal). The failure was in the assertion, not the scene.
 *
 * Two things were wrong with it. First, three.js fogs on VIEW-SPACE DEPTH
 * (`vFogDepth = -mvPosition.z`), a camera-relative quantity; the half-diagonal is
 * measured from the world origin, so the two are not comparable at all. Second,
 * and worse, the assertion demanded the opposite of what Nature wants. Nature's
 * ground is 28x32 and its treeline stands at z = 13.5, 17 and 20.5 — the far
 * corners of the ground are BEHIND the first row of trees. They are backdrop.
 * Requiring fog to begin past them would have switched off the aerial
 * perspective the fog exists to provide, and left the ground's own far edge
 * rendering as a hard rectangular shelf.
 *
 * `.probe/fog-depths.mjs` measured what the fog actually touches, at every
 * shipping aspect, at the opening pose and across the reachable camera envelope.
 * The two properties below are what that measurement supports:
 *
 *   scene         portals (envelope)   play centre   near backdrop   far backdrop
 *   ------------  ------------------   -----------   -------------   ------------
 *   nature              0.137             0.160      0.288 - 0.802   0.662 - 1.000
 *   pirate-cove         0.000             0.000      0.522           1.000
 *
 * So: nothing a child taps is more than 16% hazed anywhere the camera can go,
 * and the backdrop is between 29% and 100% hazed with the far band always
 * meaningfully hazier than the near one. That second property is what "aerial
 * perspective" means, stated as a number.
 *
 * WHAT MAKES THE COLOUR DEFECT UNREPRESENTABLE NOW
 * -----------------------------------------------
 * `SceneSkyFogConfig` has no `fog.color` field and `createSkyMatchedFog` is the
 * only constructor, so the colour cannot be supplied. The tests below still
 * matter: they guard the rasterisation assumption, the near/far distances, and
 * the claim that `clearColor` is not what a scene should be converging on.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

const {
  createGradientSkydome,
  createSkyMatchedFog,
  resolveSceneCameraPose,
  sceneCameraMaxDistance,
  getSceneCameraPreset,
  SCENE_CAMERA_FOV,
  NATURE_SKY_FOG,
  NATURE_ENVIRONMENT,
  PIRATE_COVE_SKY_FOG,
  PIRATE_COVE_ENVIRONMENT,
  OCEAN_Y,
  TREELINE_BACK_ROWS,
} = await bundleEntry(
  'scene-sky-fog-contract',
  `
  export { createGradientSkydome, createSkyMatchedFog } from './src/utils/skyRig';
  export { resolveSceneCameraPose, sceneCameraMaxDistance, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { NATURE_SKY_FOG, NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
  export { PIRATE_COVE_SKY_FOG, PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
  export { OCEAN_Y } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sea';
  export { TREELINE_BACK_ROWS } from './src/scenes/immersive-toybox-scenes/naturescene/factory/scaffold/treeline';
`,
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

const LAST_ROW = TREELINE_BACK_ROWS[TREELINE_BACK_ROWS.length - 1];

// Each scene names its own backdrop, the way scene-ground-coverage.test.mjs makes
// each scene name its own floor. Nature's backdrop is a treeline standing on the
// ground; Pirate Cove's is open water running out to the skydome. A shared guess
// about where "the backdrop" is would be wrong for one of them.
const SCENES = [
  [
    'nature',
    NATURE_SKY_FOG,
    NATURE_ENVIRONMENT,
    {
      nearName: 'the first treeline row',
      near: new Vector3(0, TREELINE_BACK_ROWS[0].height / 2, TREELINE_BACK_ROWS[0].z),
      farName: 'the last treeline row',
      far: new Vector3(0, LAST_ROW.height / 2, LAST_ROW.z),
    },
  ],
  [
    'pirate-cove',
    PIRATE_COVE_SKY_FOG,
    PIRATE_COVE_ENVIRONMENT,
    {
      nearName: 'open sea at half the skydome radius',
      near: new Vector3(0, OCEAN_Y, PIRATE_COVE_SKY_FOG.sky.radius / 2),
      farName: 'open sea at the skydome radius',
      far: new Vector3(0, OCEAN_Y, PIRATE_COVE_SKY_FOG.sky.radius),
    },
  ],
];

// Perceptual-ish distance in 0-255 RGB units, the same scale the render
// measurements in the header are quoted in, so a failure here is directly
// comparable to the 213.2 figure that motivated the fix.
const rgbDistance = (a, b) => {
  const dr = (a.r - b.r) * 255;
  const dg = (a.g - b.g) * 255;
  const db = (a.b - b.b) * 255;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

// The colour a viewer actually sees at eye level: the mean of every dome vertex
// whose normalised altitude is within `band` of the horizon.
const rasterisedHorizonBand = (skyConfig, band = 0.02) => {
  const dome = createGradientSkydome(skyConfig);
  const position = dome.geometry.getAttribute('position');
  const color = dome.geometry.getAttribute('color');
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < position.count; i += 1) {
    const ny = position.getY(i) / skyConfig.radius;
    if (Math.abs(ny) <= band) {
      r += color.getX(i);
      g += color.getY(i);
      b += color.getZ(i);
      n += 1;
    }
  }
  dome.geometry.dispose();
  dome.material.dispose();
  assert.ok(n > 0, 'no dome vertices fell in the horizon band — the sampling assumption is broken, not the scene');
  return { r: r / n, g: g / n, b: b / n, sampleCount: n };
};

const camAt = (position, target, aspect) => {
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return cam;
};

// `-mvPosition.z`, exactly the quantity three.js's fog chunk feeds the fog
// factor. Not distance from the camera, and emphatically not distance from the
// world origin.
const viewDepth = (cam, worldPoint) => -worldPoint.clone().applyMatrix4(cam.matrixWorldInverse).z;

const fogFraction = (depth, fog) => Math.min(1, Math.max(0, (depth - fog.near) / (fog.far - fog.near)));

// Every camera the player can drag to, not just the opening one. A prop that is
// clear on load and hazed after a pan is still a hazed prop.
const envelopePoses = (sceneId, aspect) => {
  const preset = getSceneCameraPreset(sceneId);
  const c = preset.constraints ?? {};
  const panRangeX = c.panRangeX ?? 3.5;
  const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
  const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  const maxTargetY = c.maxTargetY ?? 2.0;
  const maxAz = c.maxAzimuthRange ?? 0.25;
  const ceilingY = c.ceilingY ?? 6.0;
  const minDistance = c.minDistance ?? preset.distance * 0.2;
  const maxDistance = sceneCameraMaxDistance(sceneId, aspect);
  const out = [];
  for (const dist of [minDistance, preset.distance, maxDistance]) {
    for (const polar of [minPolar, preset.polar, maxPolar]) {
      for (const tx of [-panRangeX, 0, panRangeX]) {
        for (const ty of [0, maxTargetY]) {
          for (const az of [preset.azimuth - maxAz, preset.azimuth, preset.azimuth + maxAz]) {
            const target = new Vector3(tx, ty, preset.target[2]);
            const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(dist, polar, az)));
            if (position.y > ceilingY) position.y = ceilingY;
            out.push({ position, target });
          }
        }
      }
    }
  }
  return out;
};

for (const [sceneId, skyFog, env, backdrop] of SCENES) {
  test(`${sceneId}: the fog colour is the colour the sky actually renders at the horizon`, () => {
    const horizon = rasterisedHorizonBand(skyFog.sky);
    const fog = createSkyMatchedFog(skyFog);
    const distance = rgbDistance(fog.color, horizon);
    assert.ok(
      distance < 1,
      `${sceneId}: fog converges on rgb(${(fog.color.r * 255).toFixed(0)}, ${(fog.color.g * 255).toFixed(0)}, ${(fog.color.b * 255).toFixed(0)}) but the sky renders rgb(${(horizon.r * 255).toFixed(0)}, ${(horizon.g * 255).toFixed(0)}, ${(horizon.b * 255).toFixed(0)}) at eye level — a ${distance.toFixed(1)}-unit seam where the fogged world meets the unfogged dome`,
    );
  });

  test(`${sceneId}: the fog does not converge on the clear colour, which is never rasterised`, () => {
    // The specific bug, pinned by name. The skydome is opaque and unfogged, so
    // `clearColor` is painted over every frame; a scene that fogs toward it is
    // fogging toward a colour no player has ever seen.
    const fog = createSkyMatchedFog(skyFog);
    const distance = rgbDistance(fog.color, env.clearColor);
    assert.ok(
      distance > 20,
      `${sceneId}: fog colour is within ${distance.toFixed(1)} RGB units of clearColor — the skydome paints over the clear colour, so this fogs the world toward something that is never on screen`,
    );
  });

  test(`${sceneId}: the sky is brighter than nothing and the gradient actually varies`, () => {
    // Guards the rasterisation assumption the first test depends on. If
    // `createGradientSkydome` stopped writing vertex colours, or wrote a flat
    // dome, the horizon band would still return *a* colour and the fog match
    // would still pass — vacuously.
    const horizon = rasterisedHorizonBand(skyFog.sky);
    const zenith = (() => {
      const dome = createGradientSkydome(skyFog.sky);
      const position = dome.geometry.getAttribute('position');
      const color = dome.geometry.getAttribute('color');
      let best = -Infinity;
      let out = null;
      for (let i = 0; i < position.count; i += 1) {
        const ny = position.getY(i) / skyFog.sky.radius;
        if (ny > best) {
          best = ny;
          out = { r: color.getX(i), g: color.getY(i), b: color.getZ(i) };
        }
      }
      dome.geometry.dispose();
      dome.material.dispose();
      return out;
    })();
    assert.ok(horizon.sampleCount >= 8, `${sceneId}: only ${horizon.sampleCount} vertices in the horizon band — too few to average meaningfully`);
    assert.ok(
      rgbDistance(horizon, zenith) > 10,
      `${sceneId}: the dome renders effectively flat (horizon to zenith is ${rgbDistance(horizon, zenith).toFixed(1)} RGB units) — a gradient test against it would pass vacuously`,
    );
    assert.ok(rgbDistance(horizon, skyFog.sky.horizonColor) < 1, `${sceneId}: the dome does not render its own configured horizonColor at the horizon`);
  });

  test(`${sceneId}: the fog is structurally a gradient, not a step, and ends inside the sky`, () => {
    const { near, far } = skyFog.fog;
    assert.ok(far > near, `${sceneId}: fog far ${far} is not beyond near ${near} — that is a step function, not a gradient`);
    assert.ok(
      far <= skyFog.sky.radius,
      `${sceneId}: fog saturates at ${far}, beyond the skydome radius ${skyFog.sky.radius} — nothing in the scene is ever fully fogged, so the backdrop never reaches the sky colour`,
    );
  });

  test(`${sceneId}: fog never reaches the props a child is meant to touch`, () => {
    // Portals are the only affordance a pre-reading child has, and a hazed
    // portal is a portal that has lost its contrast against the ground. Checked
    // across the whole reachable camera envelope, because a prop that is clear on
    // load and hazed after a pan is still a hazed prop.
    //
    // Measured when written (`.probe/fog-depths.mjs`): worst portal fraction is
    // 0.137 in nature and 0.000 in pirate-cove; worst play-centre fraction is
    // 0.160 and 0.000.
    const LIMIT = 0.25;
    const probes = [
      ...env.portals.map((p) => [`portal '${p.gameId}'`, new Vector3(p.position.x, 0.3, p.position.z)]),
      ['the centre of the play area', new Vector3(0, 0, 0)],
    ];
    let worst = null;
    for (const [label, aspect] of ASPECTS) {
      for (const pose of envelopePoses(sceneId, aspect)) {
        const cam = camAt(pose.position, pose.target, aspect);
        for (const [name, point] of probes) {
          const f = fogFraction(viewDepth(cam, point), skyFog.fog);
          if (f > LIMIT && (!worst || f > worst.f)) worst = { label, name, f };
        }
      }
    }
    assert.equal(
      worst,
      null,
      worst && `${sceneId}: ${worst.name} is ${(worst.f * 100).toFixed(1)}% fogged at ${worst.label} — over the ${LIMIT * 100}% ceiling`,
    );
  });

  test(`${sceneId}: the backdrop recedes into the sky instead of sitting flat against it`, () => {
    // The vacuity guard for the whole fix. A fog whose `near` is past everything
    // in the scene passes every other test in this file and does nothing at all.
    // Aerial perspective is a LADDER: at one and the same pose, the far band of
    // the backdrop must be measurably hazier than the near band.
    //
    // Measured when written, worst of nine aspects: nature near 0.288, far 0.662,
    // delta 0.198; pirate-cove near 0.522, far 1.000, delta 0.478.
    const MIN_NEAR = 0.1;
    const MIN_FAR = 0.6;
    const MIN_DELTA = 0.15;
    for (const [label, aspect] of ASPECTS) {
      const pose = resolveSceneCameraPose(sceneId, aspect);
      const cam = camAt(pose.position, pose.target, aspect);
      const fNear = fogFraction(viewDepth(cam, backdrop.near), skyFog.fog);
      const fFar = fogFraction(viewDepth(cam, backdrop.far), skyFog.fog);
      assert.ok(
        fNear > MIN_NEAR,
        `${sceneId} ${label}: ${backdrop.nearName} is only ${(fNear * 100).toFixed(1)}% fogged — the fog begins past the backdrop and is doing nothing`,
      );
      assert.ok(
        fFar > MIN_FAR,
        `${sceneId} ${label}: ${backdrop.farName} is only ${(fFar * 100).toFixed(1)}% fogged — the far backdrop never converges on the sky it meets`,
      );
      assert.ok(
        fFar - fNear > MIN_DELTA,
        `${sceneId} ${label}: ${backdrop.farName} is only ${((fFar - fNear) * 100).toFixed(1)} points hazier than ${backdrop.nearName} — the backdrop reads as one flat card, not as depth`,
      );
    }
  });
}

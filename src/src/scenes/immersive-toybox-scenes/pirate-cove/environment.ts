/**
 * Scene-owned environment configuration for Pirate Cove.
 *
 * A friendly, whimsical pirate ship deck surrounded by ocean. The lighting
 * evokes a warm afternoon sun with cool ocean reflections and a lantern accent.
 */

import { Color, Vector3 } from 'three';
import type { WorldPortalDef } from '@app/utils/worldSceneFactory';
import type { FloorTapConfig, LightingConfig } from '@app/utils/sceneHelpers';
import type { SceneSkyFogConfig } from '@app/utils/skyRig';

/**
 * The Pirate Cove sky gradient and the depth fog derived from it.
 *
 * The skydome is drawn with `fog: false` and is opaque (see `skyRig.ts`), so
 * anything the renderer clears to is painted over before the frame lands. The
 * scene used to fog toward `clearColor` (0.05, 0.15, 0.25), a value provably
 * never rasterised: the sea therefore darkened as it receded (near luminance
 * 136.6, far 100.5) while the sky above it sat at 223.4, and the horizon
 * rendered as a 213-RGB-unit step across eight pixel rows — the largest colour
 * edge anywhere in the frame, larger than any material boundary on the ship.
 * Aerial perspective was running backwards.
 *
 * `SceneSkyFogConfig` has no `fog.color` field, so the fog can only be the
 * dome's own `horizonColor`. See `.probe/pc-seam.py` and
 * `tests/room/scene-sky-fog-contract.test.mjs`.
 *
 * `fog.near` clears the ship, and the number is re-derived here whenever the
 * hull or the camera moves — which is the whole reason this paragraph is worth
 * reading. It used to say: "the camera is pinned at radius 10 by `maxDistance`,
 * and the furthest point of the hull from it is the stern rail at ~17.6 units,
 * ~19 with the pan and zoom envelope applied", under `near: 20`. Every figure in
 * that sentence described a 15.3 x 13.3 deck seen from radius 10. The hull is now
 * 24 long with a stem at z = +12 and the eye stands at z = -11.39, so the ship's
 * own bow sits at a view-space depth of 24.07 — past where the fog started. The
 * commit that fixed "this does not read as a ship" would otherwise have shipped a
 * hazed bow.
 *
 * `near: 26` clears that 24.07 wall by 1.93 units, measured over the full pan,
 * zoom and polar envelope at all nine shipping aspects rather than at the opening
 * pose only. `far: 55` stays inside the 60-unit skydome so the open sea reaches
 * the sky colour before the dome edge. At those values the near backdrop band
 * (sea at z 30) is 52.2% hazed and the far band (z 60) is fully hazed — the
 * ladder the contract suite's vacuity guard requires, with a 47.8-point rise.
 * See `.probe/pc-fog-solve.mjs`, which prints the walls and scores candidates.
 */
export const PIRATE_COVE_SKY_FOG: SceneSkyFogConfig = {
  sky: {
    radius: 60,
    center: new Vector3(0, 0, 0),
    topColor: new Color(0.26, 0.48, 0.82),
    horizonColor: new Color(0.66, 0.82, 0.93),
    bottomColor: new Color(0.13, 0.36, 0.48),
    horizonSharpness: 1.5,
  },
  fog: { near: 26, far: 55 },
};

/** Typed contract describing the scene's authored environment values. */
interface PirateCoveEnvironmentConfig {
  clearColor: Color;
  lighting: LightingConfig;
  floorTap: FloorTapConfig;
  portals: WorldPortalDef[];
  ground: {
    color: Color;
    width: number;
    depth: number;
  };
}

/**
 * Pirate Cove environment: deep ocean blue-teal background, warm golden key
 * light (afternoon sun), cool blue fill (ocean reflection), and a warm orange
 * lantern accent. The ground is a warm brown wooden ship deck.
 */
export const PIRATE_COVE_ENVIRONMENT: PirateCoveEnvironmentConfig = {
  clearColor: new Color(0.05, 0.15, 0.25),
  lighting: {
    keyDirection: new Vector3(-0.4, -1, 0.5),
    keyIntensity: 1.3,
    keyColor: new Color(1.0, 0.9, 0.62),
    fillIntensity: 0.26,
    fillColor: new Color(0.4, 0.6, 0.85),
    fillGroundColor: new Color(0.12, 0.1, 0.08),
    accentPosition: new Vector3(-2.0, 2.8, -1.5),
    accentIntensity: 0.28,
    accentColor: new Color(1.0, 0.7, 0.35),
  },
  floorTap: {
    owlPosition: new Vector3(0, 0.35, -0.5),
    owlBoundsMargin: 0.5,
    ceilingY: 4.8,
  },
  // Solved, not chosen. At (4.0, 0, 1.0) the only game in this scene was framed
  // off the edge on six of nine viewport aspects -- 0.05 NDC outside on an iPad
  // in portrait, 0.74 on a Pixel 8, 0.96 at 360x900. A player who cannot read
  // had nothing on screen to tap. A grid search over the deck found the
  // centreline is the only open, centred position that clears all nine.
  // See `.probe/pc-portal-solve2.mjs` and tests/room/scene-ground-coverage.test.mjs.
  //
  // The z moved from -4.2 to -1.5 when the hull and camera were re-solved. The
  // bottom edge of the frame is a fixed line on the deck: the camera pitches
  // 18.4 degrees below horizontal and the vertical FOV is 50 degrees, so the
  // bottom ray leaves the eye 43.4 degrees down and meets the deck 5.28 /
  // tan(43.4) = 5.59 units ahead of it, at z = -5.80. Vertical FOV does not vary
  // with aspect, so that line is the same on every device. At -4.2 the portal
  // cleared it by 1.6 units and sat in the very bottom sliver of the frame; -1.5
  // puts it 4.3 units clear, on open deck forward of the wheel.
  portals: [
    {
      gameId: 'cannonball-splash',
      position: new Vector3(0, 0, -1.5),
      color: new Color(0.16, 0.44, 0.66),
    },
  ],
  // The deck's own shape is NOT here — it is `HULL_PLAN` in `./hullPlan.ts`, and
  // the deck plane, the plank seams and the rails are all cut from it. These two
  // numbers are the hull's bounding box, kept only because the shared floor
  // audits (`tests/room/scene-ground-coverage.test.mjs`) describe every scene's
  // floor as a width and a depth. Anything that needs the real outline must read
  // `HULL_OUTLINE`, which is narrower than this box everywhere except at the two
  // maximum-beam stations.
  ground: {
    color: new Color(0.55, 0.38, 0.22),
    width: 10,
    depth: 24,
  },
};

import { Color } from 'three';

/**
 * One row of background conifers. `depth` is the row's z (back rows) or |x|
 * (side columns); `height` is the full tree height including the trunk.
 */
export interface TreelineRow {
  height: number;
  /** Blend toward the skydome horizon colour, for hand-authored aerial perspective. */
  haze: number;
}

/**
 * Row placement was solved against the real scene camera rather than chosen by
 * eye. See `.probe/treeline-fit.mjs`: these depths and heights are the set that,
 * across nine viewport aspects and the whole interaction envelope, leaves no gap
 * between the ground's far edge and the first row of trees, still shows sky
 * above the treeline, and blocks every camera ray that would otherwise reach the
 * floor plane beside the ground rectangle.
 */
export const TREELINE_BACK_ROWS: Array<TreelineRow & { z: number }> = [
  { z: 13.5, height: 4.4, haze: 0.2 },
  { z: 17.0, height: 4.85, haze: 0.4 },
  { z: 20.5, height: 5.3, haze: 0.55 },
];

/**
 * The side columns are the load-bearing half of the treeline. The ray audit is
 * clean without any back-row canopy above the undergrowth (gaps there show sky,
 * which is correct), but drops 48 rays through the sides if the side trees are
 * short. Both columns therefore run the full row-3 height.
 */
export const TREELINE_SIDE_COLUMNS: Array<TreelineRow & { x: number }> = [
  { x: 13.8, height: 5.3, haze: 0.35 },
  { x: 15.2, height: 5.3, haze: 0.5 },
];

/** Back rows span this half-width in x. */
export const TREELINE_BACK_HALF_WIDTH = 15;

/** Side columns run from this z to the far back row. */
export const TREELINE_SIDE_Z_NEAR = -17;

/** Centre-to-centre spacing along a row. Kept below the canopy radius so the silhouette is continuous. */
export const TREELINE_SPACING = 1.5;

/** Widest canopy radius, at the base of the lowest cone. Must exceed `TREELINE_SPACING` so rows overlap. */
export const TREELINE_CANOPY_RADIUS = 1.05;

/** Base needle colour before haze, and the skydome horizon colour hazed toward. */
export const TREELINE_NEEDLE_COLOR = new Color(0.16, 0.34, 0.2);
export const TREELINE_TRUNK_COLOR = new Color(0.24, 0.18, 0.13);
export const TREELINE_HAZE_COLOR = new Color(0.4, 0.6, 0.72);

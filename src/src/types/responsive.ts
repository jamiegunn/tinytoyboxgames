/** Device orientation derived from viewport aspect ratio. */
export type Orientation = 'portrait' | 'landscape';

/** Viewport and device state used for responsive layout decisions. */
export interface ResponsiveState {
  /** Current viewport width in CSS pixels. */
  viewportWidth: number;
  /** Current viewport height in CSS pixels. */
  viewportHeight: number;
  /** Derived orientation based on width vs height comparison. */
  orientation: Orientation;
  /** Ratio of current width to reference width (1440px), clamped to [0, 1]. */
  scaleFactor: number;
  /** True when viewport width is below the mobile breakpoint (768px). */
  isMobile: boolean;
}

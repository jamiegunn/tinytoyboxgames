// The build meter for the feeding frenzy.
//
// WHY THIS EXISTS. The frenzy arc in `frenzy.ts` gives the loop a build, a
// payoff and a reset, but until this module the only readout of the build was
// the score numeral in the shell HUD. At 3;0-3;6 a child is a two- or
// three-knower (Sarnecka & Carey 2008): a rising numeral is not a progress
// signal to them, it is decoration. Containing and filling, by contrast, is a
// schema children have long before they have number, which is why this is a bar
// that fills rather than a count that rises.
//
// WHY IT IS A CAMERA CHILD. The playfield is an orbit camera that tracks the
// shark, so anything staged in the world would slide out of frame. The vignette
// and speed-line effects in `effects/screenFx.ts` already solve this by
// parenting an overlay plane to the camera; this module copies that technique.
// It does NOT import the fireflies game's `jarFill.ts`, whose containing-and-
// filling idea this borrows, because every game in this repo has to stay
// independently deletable.
//
// WHY IT CHANGES COLOUR RATHER THAN ONLY LENGTH. Length alone says "more"; it
// does not say "nearly". The amber-and-pulse state maps onto the `brewing`
// phase, which is the entire anticipation window -- the stretch a flat loop can
// never have. Colour and motion are two extra channels a pre-numerate child can
// read at a glance, and the measurement that motivated the frenzy found the
// game's problem was never too few things happening, it was nothing to
// anticipate.

import { type PerspectiveCamera, Mesh, MeshBasicMaterial, PlaneGeometry, Color, DoubleSide } from 'three';
import type { FrenzyPhase } from './frenzy';

/**
 * Meter width in camera-local units at the overlay plane.
 *
 * The overlay sits 0.5 units in front of the lens and the manifest fov is 0.85
 * rad, so the visible half-height there is 0.5 * tan(0.425) = 0.226 and the
 * half-width is that times the aspect. 0.19 wide (0.095 either side of centre)
 * still fits inside the frame at an aspect as narrow as 0.46, which is a phone
 * held upright -- the worst case this game can be handed.
 */
const METER_W = 0.13;
const METER_H = 0.016;
const METER_Y = 0.185;
const METER_Z = -0.5;
/** Padding of the dark backing plate around the track, in the same units. */
const PLATE_PAD = 0.005;

const COLOR_BUILDING = new Color(0x37e0c8);
const COLOR_BREWING = new Color(0xffb020);
const COLOR_FRENZY = new Color(0xffd54a);

/** Live meshes and animation state for the build meter. */
export interface FrenzyHud {
  plate: Mesh;
  track: Mesh;
  fill: Mesh;
  /** Smoothed fill fraction, so a catch eases the bar instead of snapping it. */
  shown: number;
  /** Free-running pulse clock, seconds. */
  pulse: number;
}

// A camera-parented overlay plane. `depthTest: false` plus a high renderOrder
// keeps it in front of the water surface, and the empty raycast keeps it out of
// the tap picker -- a HUD that swallowed taps would break the one control the
// game has.
function overlay(camera: PerspectiveCamera, w: number, h: number, color: number, opacity: number, order: number, anchorLeft: boolean): Mesh {
  const geometry = new PlaneGeometry(w, h);
  if (anchorLeft) geometry.translate(w / 2, 0, 0);
  const material = new MeshBasicMaterial({ color, transparent: true, opacity, side: DoubleSide, depthTest: false, depthWrite: false });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = order;
  mesh.position.set(anchorLeft ? -METER_W / 2 : 0, METER_Y, METER_Z);
  mesh.raycast = () => {};
  camera.add(mesh);
  return mesh;
}

/**
 * Builds the build meter and parents it to the camera.
 *
 * @param camera - The shell camera the overlay is parented to.
 * @returns The meter handle to pass to {@link updateFrenzyHud}.
 */
export function createFrenzyHud(camera: PerspectiveCamera): FrenzyHud {
  // Sized and weighted by screenshot, not by taste. The first attempt was 0.19
  // wide and 0.024 tall at opacity 0.5/0.75 and rendered as a black slab across
  // the top sixth of the frame -- legible, but it took the reef's place rather
  // than sitting on top of it. These values put a ~230x28 px bar at the top of a
  // 1200x800 canvas: comfortably above the 12 mm legibility floor this project
  // uses for anything a three-year-old has to read, without competing for the
  // attention the fish are supposed to have.
  const plate = overlay(camera, METER_W + PLATE_PAD * 2, METER_H + PLATE_PAD * 2, 0x06222c, 0.3, 990, false);
  const track = overlay(camera, METER_W, METER_H, 0x0d3b48, 0.5, 991, false);
  const fill = overlay(camera, METER_W, METER_H, COLOR_BUILDING.getHex(), 0.95, 992, true);
  fill.scale.x = 0.0001;
  return { plate, track, fill, shown: 0, pulse: 0 };
}

/**
 * Advances the meter one frame.
 *
 * @param hud - The meter handle from {@link createFrenzyHud}.
 * @param intensity - Fill fraction in [0, 1], from `frenzyIntensity`.
 * @param phase - Current frenzy phase, which selects colour and pulse.
 * @param dt - Seconds since the last frame.
 */
export function updateFrenzyHud(hud: FrenzyHud, intensity: number, phase: FrenzyPhase, dt: number): void {
  hud.pulse += dt;
  // Ease toward the target rather than jumping. A catch moves the bar by 1/goal
  // instantly otherwise, which reads as a glitch rather than as progress; the
  // ~0.15 s glide is well inside the 2.5-3 s ceiling for a reward animation and
  // comfortably above the 100 ms floor for the acknowledgement itself, which the
  // gulp sound and the confetti already cover.
  hud.shown += (intensity - hud.shown) * Math.min(1, dt * 7);
  hud.fill.scale.x = Math.max(0.0001, hud.shown);

  const mat = hud.fill.material as MeshBasicMaterial;
  if (phase === 'frenzy' || phase === 'afterglow') {
    mat.color.copy(COLOR_FRENZY);
    mat.opacity = phase === 'frenzy' ? 0.8 + Math.sin(hud.pulse * 14) * 0.2 : 0.95;
  } else if (phase === 'brewing') {
    mat.color.copy(COLOR_BREWING);
    mat.opacity = 0.75 + Math.sin(hud.pulse * 7) * 0.25;
  } else {
    mat.color.copy(COLOR_BUILDING);
    mat.opacity = 0.95;
  }
}

/**
 * Removes the meter from the camera and frees its geometries and materials.
 *
 * @param hud - The meter handle from {@link createFrenzyHud}.
 */
export function disposeFrenzyHud(hud: FrenzyHud): void {
  for (const mesh of [hud.plate, hud.track, hud.fill]) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    (mesh.material as MeshBasicMaterial).dispose();
  }
}

import {
  Scene,
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type PerspectiveCamera,
} from 'three';
import { projectToView } from '@app/utils/skyRig';
import type { StarMesh } from '../types';

/**
 * Low-level mesh builders for the night sky environment.
 * Pure constructors — no state, no per-frame updates, no orchestration.
 */

/**
 * Core radius of the moon disc in world units, at MOON_DISTANCE.
 * Angular diameter = 2 * atan(1.05 / 15) = 8.0 deg, which on a 60 deg vertical
 * fov / 810 px frame is 8.0 / 60 * 810 = 108 px across — a moon you notice
 * without it dominating the sky.
 */
const MOON_RADIUS = 1.05;

/** Distance from the camera at which the moon is placed, in world units. */
const MOON_DISTANCE = 15;

/** Screen-space placement: upper-left of frame, clear of the HUD buttons. */
const MOON_SCREEN_X = 0.26;
const MOON_SCREEN_Y = 0.28;

/**
 * Glow quad half-extent as a multiple of MOON_RADIUS.
 *
 * The frame half-height at MOON_DISTANCE is 15 * tan(30 deg) = 8.66 units, so
 * a 2.8x glow spans 1.05 * 2.8 / 8.66 = 34% of the frame half-height and has
 * room to reach zero alpha well inside the frame. The old halo was a solid
 * additive *sphere* at 1.9x with a single flat opacity, which is exactly why
 * it read as a second hard-edged circle around the disc.
 */
const MOON_GLOW_SCALE = 2.8;

/**
 * Canvas resolution for both moon textures. The disc is ~108 px across on an
 * 810 px frame, so 256 is better than 2x coverage even at DPR 2, and the pair
 * costs two 256 KB RGBA uploads once per session.
 */
const MOON_TEX_SIZE = 256;

/** Cached moon textures — rebuilt on demand, released by disposeMoonTextures. */
let moonDiscTex: CanvasTexture | null = null;
let moonGlowTex: CanvasTexture | null = null;

// Soft crater field as [centreX, centreY, radius, alpha], all in units of the
// disc radius and measured from the disc centre. Six overlapping blots are
// enough to break up the flat fill at a 108 px on-screen size; anything more
// disappears into the tone-mapped highlight, and geometry would be far more
// expensive than a texture the moon needs anyway.
const MOON_CRATERS: readonly (readonly [number, number, number, number])[] = [
  [-0.3, -0.22, 0.3, 0.2],
  [0.2, -0.4, 0.18, 0.15],
  [0.3, 0.24, 0.34, 0.17],
  [-0.18, 0.36, 0.22, 0.14],
  [0.02, 0.04, 0.14, 0.1],
  [-0.48, 0.14, 0.15, 0.12],
];

// Paints the moon face into a canvas: a warm-to-cool body gradient lit from the
// upper left (so the falloff reads as a terminator on a sphere, not a
// bullseye), a handful of soft craters, and an alpha mask that feathers the
// limb so the disc never shows a hard cut-out edge.
//
// The body peaks at 206/255 rather than pure white deliberately: the renderer
// uses ACES filmic tone mapping at exposure 1.15, which compresses everything
// near 1.0 into the same output, so a white-peaked texture would flatten the
// craters AND leave no headroom for the pop pulse.
function createMoonDiscTexture(): CanvasTexture {
  const size = MOON_TEX_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('bubble-pop: 2D canvas context unavailable for the moon texture');

  const c = size / 2;
  // 2 px of margin so the feathered limb is not clipped by the canvas edge.
  const r = c - 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.clip();

  // Body. Bright point offset up and left by ~1/3 of the radius; the outer
  // circle overshoots the limb (1.3r) so the darkest stop lands just past the
  // edge and the visible falloff stays gradual all the way to the rim.
  const body = ctx.createRadialGradient(c - r * 0.34, c - r * 0.3, 0, c, c, r * 1.3);
  body.addColorStop(0.0, 'rgb(206, 199, 184)'); // warm ivory
  body.addColorStop(0.32, 'rgb(196, 187, 170)');
  body.addColorStop(0.58, 'rgb(174, 165, 152)');
  body.addColorStop(0.8, 'rgb(146, 140, 143)');
  body.addColorStop(1.0, 'rgb(112, 110, 134)'); // cool blue-violet limb
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, size, size);

  // Craters — cool grey-violet, so they read as shadow against the warm body.
  for (const [cx, cy, cr, alpha] of MOON_CRATERS) {
    const px = c + cx * r;
    const py = c + cy * r;
    const pr = cr * r;
    const crater = ctx.createRadialGradient(px, py, 0, px, py, pr);
    crater.addColorStop(0.0, `rgba(96, 92, 120, ${alpha})`);
    crater.addColorStop(0.55, `rgba(96, 92, 120, ${alpha * 0.55})`);
    crater.addColorStop(1.0, 'rgba(96, 92, 120, 0)');
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Feather the limb. `destination-in` multiplies the existing alpha by this
  // mask, so the outer 10% of the radius fades out instead of terminating on
  // the aliased edge left by clip().
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(c, c, 0, c, c, r);
  mask.addColorStop(0.0, 'rgba(0, 0, 0, 1)');
  mask.addColorStop(0.9, 'rgba(0, 0, 0, 1)');
  mask.addColorStop(0.97, 'rgba(0, 0, 0, 0.6)');
  mask.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Paints the moon's glow: a single radial gradient whose alpha decays through
// six stops to exactly zero at the quad edge, so there is no radius at which
// the halo stops abruptly. Alpha roughly follows (1 - t)^4 — 0.50, 0.34, 0.19,
// 0.085, 0.032, 0.009, 0 — which is what a real bloom falls off like and what
// the old single-opacity sphere could not do. The colour drifts warm at the
// core to cool at the fringe, matching the disc's own tint.
function createMoonGlowTexture(): CanvasTexture {
  const size = MOON_TEX_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('bubble-pop: 2D canvas context unavailable for the moon glow texture');

  const c = size / 2;
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0.0, 'rgba(255, 246, 226, 0.5)');
  glow.addColorStop(0.22, 'rgba(255, 241, 214, 0.34)');
  glow.addColorStop(0.34, 'rgba(250, 232, 208, 0.19)');
  glow.addColorStop(0.48, 'rgba(226, 219, 226, 0.085)');
  glow.addColorStop(0.66, 'rgba(206, 206, 238, 0.032)');
  glow.addColorStop(0.84, 'rgba(198, 200, 240, 0.009)');
  glow.addColorStop(1.0, 'rgba(196, 198, 240, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** The moon rig returned by {@link buildMoon}. */
export interface MoonRig {
  /** Group holding the glow quad and the disc quad. Already positioned. */
  root: Group;
  /** Disc material — `color` is a plain brightness multiplier for the pulse. */
  discMat: MeshBasicMaterial;
  /** Glow material — pulsed alongside the disc. */
  glowMat: MeshBasicMaterial;
}

/**
 * Builds the moon: a camera-facing textured disc with a soft multi-stop glow
 * behind it, both unlit and both raycast-disabled so they can never intercept
 * a tap meant for a bubble.
 *
 * Replaces the shared sky rig's `createCelestialBody`, which produced a flat
 * emissive sphere inside a solid additive sphere at a single opacity — two
 * concentric flat circles with a hard edge where the halo stopped. Everything
 * that makes this read as a moon (shading, craters, warm-to-cool tint, a glow
 * that decays to nothing) lives in two canvas textures, so it stays background
 * art: two quads, two draw calls, no per-frame work.
 *
 * @param scene - The Three.js scene.
 * @param camera - The active shell camera, for screen-space placement and billboarding.
 * @returns The moon group plus the two materials the pop pulse drives.
 */
export function buildMoon(scene: Scene, camera: PerspectiveCamera): MoonRig {
  moonDiscTex ??= createMoonDiscTexture();
  moonGlowTex ??= createMoonGlowTexture();

  const root = new Group();
  root.name = 'bubble_pop_mesh_moon';

  // The painted disc stops 2 px short of the canvas edge (see
  // createMoonDiscTexture), so the quad has to be scaled up by
  // 128 / (128 - 2) = 1.016 for the moon itself to render at MOON_RADIUS.
  const half = MOON_TEX_SIZE / 2;
  const discHalfExtent = (MOON_RADIUS * half) / (half - 2);

  const glowMat = new MeshBasicMaterial({
    map: moonGlowTex,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  glowMat.name = 'bubble_pop_moon_glow_mat';
  const glowHalfExtent = MOON_RADIUS * MOON_GLOW_SCALE;
  const glow = new Mesh(new PlaneGeometry(glowHalfExtent * 2, glowHalfExtent * 2), glowMat);
  glow.name = 'bubble_pop_mesh_moon_glow';
  glow.raycast = () => {};
  // The moon is the furthest transparent thing in the scene; ordering it below
  // the stars and bubbles keeps it painted first no matter how the depth sort
  // resolves two quads that share a centre.
  glow.renderOrder = -3;
  root.add(glow);

  const discMat = new MeshBasicMaterial({
    map: moonDiscTex,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  discMat.name = 'bubble_pop_moon_disc_mat';
  const disc = new Mesh(new PlaneGeometry(discHalfExtent * 2, discHalfExtent * 2), discMat);
  disc.name = 'bubble_pop_mesh_moon_disc';
  disc.raycast = () => {};
  disc.renderOrder = -2;
  root.add(disc);

  root.position.copy(projectToView(camera, MOON_SCREEN_X, MOON_SCREEN_Y, MOON_DISTANCE));
  // Billboard once: the shell camera is fixed for the whole session, so this
  // costs nothing per frame.
  root.lookAt(camera.position);
  scene.add(root);

  return { root, discMat, glowMat };
}

/**
 * Releases the cached moon textures. Call during teardown — `disposeMeshDeep`
 * disposes geometries and materials but not the textures they reference.
 */
export function disposeMoonTextures(): void {
  moonDiscTex?.dispose();
  moonDiscTex = null;
  moonGlowTex?.dispose();
  moonGlowTex = null;
}

/**
 * Builds a single twinkling star mesh with randomised twinkle parameters.
 * @param scene - The Three.js scene.
 * @param index - Star index for naming.
 * @returns A StarMesh with twinkle parameters.
 */
export function buildStar(scene: Scene, index: number): StarMesh {
  // Sized for the sky-rig depth (~14-20 units) so stars stay visible as dots.
  const size = 0.12 + Math.random() * 0.18;
  const geo = new SphereGeometry(size / 2, 8, 8);

  const warmth = Math.random();
  const coldColor = new Color(0.8, 0.85, 1.0);
  const warmColor = new Color(1.0, 0.95, 0.7);
  const color = coldColor.clone().lerp(warmColor, warmth);
  const baseIntensity = 0.6 + Math.random() * 0.5;

  const mat = new MeshStandardMaterial({
    color: color.clone(),
    emissive: color.clone().multiplyScalar(baseIntensity),
    opacity: 0.6 + Math.random() * 0.4,
    transparent: true,
  });
  mat.name = `starMat_${index}`;

  const mesh = new Mesh(geo, mat);
  mesh.name = `bubble_pop_mesh_star_${String(index).padStart(2, '0')}`;
  scene.add(mesh);

  return {
    mesh,
    mat,
    color,
    baseIntensity,
    twinkleSpeed: 1.0 + Math.random() * 3.0,
    twinklePhase: Math.random() * Math.PI * 2,
  };
}

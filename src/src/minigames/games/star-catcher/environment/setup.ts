/**
 * Environment setup for the Star Catcher minigame.
 *
 * Builds the night: a graded sky anchored on the visible horizon, a glowing
 * moon, a starfield placed by where it lands on screen, two distant ridges that
 * turn the hill's bowed silhouette into a level skyline, and a grassy hilltop
 * with glowing night flowers in the foreground. Gameplay (spawning, scoring)
 * lives elsewhere.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { createGameLighting } from '@app/minigames/shared/sceneSetup';
import type { DisposalScope } from '@app/utils/disposal';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import { projectToScreen, smoothstep } from '../helpers';
import { HILL_RADIUS, unprojectNdcToHill, unprojectNdcToPlaneZ } from '../view';
import type { AmbientTwinklePoint, CanvasRect, TemplateEnvironmentRig } from '../types';

/**
 * Sky plane placement and extent.
 *
 * Defect 6: the sky was a 36x22 plane whose visible slice was tiny, and whose
 * glow ramp (`max(0, 1 - 4t)`) was authored against the plane's *own* height
 * rather than against the part of it the camera can see. On screen that put a
 * narrow mauve band just above the horizon and then flat `#080A1F` for the
 * remaining ~87% of the sky — a wall, not a night. It is now big enough that
 * its edges cannot enter frame at any aspect ratio, its lower edge is buried
 * inside the hill sphere so no gap can open at the join, and it carries enough
 * segments for a smooth ramp.
 */
const SKY_Z = 11;
const SKY_CENTRE_Y = 8;
const SKY_WIDTH = 80;
const SKY_HEIGHT = 48;
const SKY_HEIGHT_SEGMENTS = 48;

/**
 * World Y at which the hill's silhouette crosses the sky plane — the visible
 * horizon line, and therefore where the glow must peak.
 *
 * The hill sphere (radius 42, centre y = -42) meets z = 11 at
 * `sqrt(42^2 - 11^2) - 42 = -1.466`. The previous value, -2.1, was solved for
 * the old radius of 30 and is 0.63 units low, which pushed the warm band down
 * behind the hill where none of it could be seen.
 */
const SKY_HORIZON_Y = -1.47;

/**
 * World Y treated as the top of the authored gradient.
 *
 * This used to be 12 while the top of the frame crosses the sky plane at
 * y = 4.303, so the gradient parameter never exceeded
 * `(4.303 + 2.1) / (12 + 2.1) = 0.454` anywhere on screen: the authored zenith
 * colour was literally unreachable and the whole visible sky was the bottom
 * half of a ramp. Anchoring on the real top of the visible window means the
 * full gradient is spent on the part the child sees.
 */
const SKY_ZENITH_Y = 4.4;

/** Horizontal NDC half-span the ridge ribbons are built across. */
const RIDGE_NDC_HALF_WIDTH = 1.06;

/** Segments per ridge ribbon; 64 keeps the crest smooth at ~18 px per segment. */
const RIDGE_SEGMENTS = 64;

/** Deterministic pseudo-random so the scenery is stable across builds. */
let seed = 20260718;

/** Reused by the ambient tap search so a tap allocates nothing. */
const projectedPoint = new Vector3();

/** Scratch state reused while building and animating instanced scenery. */
const scratchMatrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchScale = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchEuler = new Euler();
const scratchRay = new Vector3();
const scratchColor = new Color();

// Per-instance data the grass sway needs each frame, parked on the mesh's
// userData so the rig type does not have to grow a field for it.
interface GrassSwayState {
  basePosition: Float32Array;
  phase: Float32Array;
  scale: Float32Array;
}

/**
 * Returns the next deterministic pseudo-random float in [0, 1).
 *
 * @returns A pseudo-random value.
 */
function nextRandom(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

/**
 * Disables raycasting on a decorative object so it never intercepts taps meant
 * for the catchable stars.
 *
 * @param object - The decorative object to make tap-transparent.
 * @returns The same object, for chaining.
 */
function makeDecorative<T extends Object3D>(object: T): T {
  object.raycast = () => {};
  return object;
}

// World point a fixed distance along the camera ray through an NDC coordinate.
// Because the distance is constant, the point re-projects to exactly the NDC it
// was built from — which is what lets a mesh be authored as a screen-space
// shape while still being a real, depth-sorted object in the scene.
function pointAtCameraDistance(camera: PerspectiveCamera, ndcX: number, ndcY: number, distance: number, out: Vector3): Vector3 {
  scratchRay.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
  return out.copy(scratchRay).multiplyScalar(distance).add(camera.position);
}

/**
 * Builds the night-sky backdrop: a wide plane carrying a three-stop vertical
 * gradient anchored on the visible horizon.
 *
 * @returns The unlit gradient sky mesh.
 */
function buildSkyGradient(): Mesh {
  const geometry = new PlaneGeometry(SKY_WIDTH, SKY_HEIGHT, 1, SKY_HEIGHT_SEGMENTS);
  // Authored as scene-linear radiance, because an unlit MeshBasicMaterial is
  // the one place where the value written here is the value tone mapping sees.
  // Solved by inverting ACES (three's /0.6 variant) at exposure 1.15 followed
  // by the sRGB transfer, so each stop hits a chosen screen colour exactly:
  // zenith #0a0f26, mid-sky #1a2444, horizon #6b5a7d. The previous stops solved
  // to #395d9f and #d9bfd6 — a bright cornflower sky with a pale mauve band,
  // which is the washed grey-blue the harness photographed.
  const zenith = new Color(0.0103, 0.0133, 0.0346);
  const midSky = new Color(0.022, 0.0302, 0.0677);
  const horizonGlow = new Color(0.1204, 0.0908, 0.1578);

  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const worldY = SKY_CENTRE_Y + position.getY(i);
    const t = Math.max(0, Math.min(1, (worldY - SKY_HORIZON_Y) / (SKY_ZENITH_Y - SKY_HORIZON_Y)));

    // Two overlapping ramps rather than one clipped one. The base grades
    // mid-sky to zenith across the whole visible window (so no part of the sky
    // is ever a single flat value), then the horizon glow is mixed back in with
    // a soft power falloff so it thins out gradually instead of stopping dead.
    scratchColor.copy(midSky).lerp(zenith, smoothstep(t));
    scratchColor.lerp(horizonGlow, Math.pow(1 - t, 2.2));

    colors[i * 3] = scratchColor.r;
    colors[i * 3 + 1] = scratchColor.g;
    colors[i * 3 + 2] = scratchColor.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  material.name = 'star-catcher_skyMat';
  const mesh = new Mesh(geometry, material);
  mesh.name = 'star-catcher_sky';
  // +Z is far from the camera (which sits at z ~= -6.8 looking toward +Z), so
  // the sky sits well behind the play area.
  mesh.position.set(0, SKY_CENTRE_Y, SKY_Z);
  return makeDecorative(mesh);
}

/**
 * Builds one distant ridge as a screen-space ribbon held at a constant distance
 * from the camera.
 *
 * The user's long-standing complaint — "a weird flat surface that drops off on
 * the sides" — is the hill sphere's own limb. Every tangent point of a sphere
 * lies at `sqrt(|oc|^2 - R^2)` from the eye, which for this camera and R = 42
 * is 19.02 units, so *any* surface nearer than that occludes the limb along
 * every ray. A flat plane does not work (at the frame edges the limb is only
 * ~7.5 units deep), but a ribbon at fixed camera distance does, and it is also
 * the only construction whose crest is a straight line on screen.
 *
 * @param camera - The shell camera.
 * @param distance - Constant camera distance the ribbon is held at.
 * @param topNdcY - NDC row of the ridge crest.
 * @param bottomNdcY - NDC row of the ribbon's lower edge (occluded by the hill).
 * @param crestAmplitude - Crest wobble, in NDC.
 * @param crestColor - Scene-linear colour at the crest.
 * @param baseColor - Scene-linear colour at the lower edge.
 * @returns The unlit ridge mesh.
 */
function buildRidge(
  camera: PerspectiveCamera,
  distance: number,
  topNdcY: number,
  bottomNdcY: number,
  crestAmplitude: number,
  crestColor: Color,
  baseColor: Color,
): Mesh {
  // Row 0 of a 1-segment-tall plane is its top edge and row 1 its bottom, so
  // vertex i is the crest above vertex (RIDGE_SEGMENTS + 1) + i.
  const geometry = new PlaneGeometry(1, 1, RIDGE_SEGMENTS, 1);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const bottomOffset = RIDGE_SEGMENTS + 1;
  const wobbleA = nextRandom() * Math.PI * 2;
  const wobbleB = nextRandom() * Math.PI * 2;

  for (let i = 0; i <= RIDGE_SEGMENTS; i += 1) {
    const u = i / RIDGE_SEGMENTS;
    const ndcX = -RIDGE_NDC_HALF_WIDTH + 2 * RIDGE_NDC_HALF_WIDTH * u;
    const wobble = (Math.sin(u * 7.3 + wobbleA) * 0.62 + Math.sin(u * 17.1 + wobbleB) * 0.38) * crestAmplitude;

    pointAtCameraDistance(camera, ndcX, topNdcY + wobble, distance, scratchPosition);
    position.setXYZ(i, scratchPosition.x, scratchPosition.y, scratchPosition.z);
    colors[i * 3] = crestColor.r;
    colors[i * 3 + 1] = crestColor.g;
    colors[i * 3 + 2] = crestColor.b;

    pointAtCameraDistance(camera, ndcX, bottomNdcY, distance, scratchPosition);
    position.setXYZ(bottomOffset + i, scratchPosition.x, scratchPosition.y, scratchPosition.z);
    colors[(bottomOffset + i) * 3] = baseColor.r;
    colors[(bottomOffset + i) * 3 + 1] = baseColor.g;
    colors[(bottomOffset + i) * 3 + 2] = baseColor.b;
  }

  position.needsUpdate = true;
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  // DoubleSide because the rewritten vertices no longer respect the source
  // plane's winding, and unlit because a ridge this far away has no business
  // reacting to the key light.
  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  material.name = 'star-catcher_ridgeMat';
  const mesh = new Mesh(geometry, material);
  mesh.name = 'star-catcher_ridge';
  return makeDecorative(mesh);
}

/**
 * Screen position the moon is pinned to, in NDC.
 *
 * These are exactly where the old emissive sphere at world (2.9, 2.4, 10)
 * projected — screen (447, 109) of 1200x810 — so the moon does not move and the
 * ambient tap target keeps working. They are authored in NDC rather than world
 * space because the disc is now a screen-space-sized quad: its pixel diameter is
 * what the design is about, and that is a function of NDC plus view depth.
 */
const MOON_NDC_X = -0.2554;
const MOON_NDC_Y = 0.7303;

/**
 * World Z of the plane the moon quads sit on.
 *
 * Not 10, where the sphere used to be. The glow quad billboards to the camera,
 * and the camera is pitched 23.5 deg down (up = (0, 0.9168, 0.39934)), so the
 * quad tips *away* from the viewer: its far corner sits
 * `halfExtent * (0.06955 + 0.17027) = 0.240 * halfExtent` further along +Z than
 * its centre. At z = 10 with a 2.28-unit half-extent that corner reaches
 * z = 10.55 against the opaque sky plane at {@link SKY_Z} = 11 — a 0.45-unit
 * margin that any later size tweak would eat, and being sliced by the sky is
 * exactly the failure mode that produced a hard-edged rectangle around
 * cannonball-splash's sun. At 9.4 the corner reaches 9.95 and the margin is
 * 1.05 units. Holding the NDC above while changing Z keeps the moon in place.
 */
const MOON_PLANE_Z = 9.4;

/**
 * Radius of the moon disc in world units, at {@link MOON_PLANE_Z}.
 *
 * The quad's view depth there is 15.302 (camera at (0, 3.6051, -6.7843), forward
 * (0, -0.39934, 0.9168)), and `tanHalfV` is 0.48306, so one world unit spans
 * `810 / (2 * 0.48306 * 15.302) = 54.80` px on an 810 px frame. A radius of
 * 0.9126 is therefore a **100 px disc** — near enough the 106 px the old sphere
 * covered that the composition is unchanged, but sized deliberately rather than
 * inherited.
 */
const MOON_RADIUS = 0.9126;

/**
 * Glow quad half-extent as a multiple of {@link MOON_RADIUS}.
 *
 * 2.5 puts the half-extent at 2.2815 units = 125 px, and the alpha ramp is
 * effectively spent by 84% of that (see {@link MOON_GLOW_STOPS}), so the visible
 * halo reaches ~105 px from a centre at screen row 109 — it fades out just
 * inside the top edge of the frame instead of being cropped mid-gradient.
 * bubble-pop uses 2.8, but its moon sits at screen Y 0.28 with more headroom.
 */
const MOON_GLOW_SCALE = 2.5;

/**
 * Canvas resolution for both moon textures. The disc covers ~100 px on an 810 px
 * frame, so 256 is over 2x coverage even at DPR 2.
 */
const MOON_TEX_SIZE = 256;

// Soft crater field as [centreX, centreY, radius, alpha], in units of the disc
// radius and measured from the disc centre. Adapted from bubble-pop's table:
// same six blots, mirrored in X so the two games' moons are not the same face.
const MOON_CRATERS: readonly (readonly [number, number, number, number])[] = [
  [0.3, -0.22, 0.3, 0.22],
  [-0.2, -0.4, 0.18, 0.17],
  [-0.3, 0.24, 0.34, 0.19],
  [0.18, 0.36, 0.22, 0.15],
  [-0.02, 0.04, 0.14, 0.11],
  [0.48, 0.14, 0.15, 0.13],
];

// Alpha/colour ramp for the moon's halo. Alpha follows bubble-pop's (1 - t)^4
// bloom shape scaled to a 0.40 peak (it used 0.50), and the tint is lavender
// rather than warm ivory so the halo sits in the same family as the #0B0F26
// night sky instead of competing with the amber catchable stars.
const MOON_GLOW_STOPS: readonly (readonly [number, string, number])[] = [
  [0.0, '196, 198, 226', 0.4],
  [0.22, '190, 193, 226', 0.27],
  [0.34, '180, 185, 224', 0.15],
  [0.48, '168, 175, 220', 0.068],
  [0.66, '154, 162, 212', 0.026],
  [0.84, '144, 152, 206', 0.007],
  [1.0, '140, 148, 204', 0],
];

// Paints the moon face: a body gradient lit from the upper right (so the
// falloff reads as a terminator on a sphere rather than a bullseye), soft
// craters, and a `destination-in` alpha mask that feathers the limb so the disc
// never shows a hard cut-out edge.
//
// The palette peaks at rgb(182, 180, 190), well below bubble-pop's 206, because
// this moon must not out-shine the catchable stars. Through ACES filmic at
// exposure 1.15 the five stops land on screen at (201,200,205), (194,193,200),
// (175,174,187), (144,142,165) and (94,94,132); the catchable stars measure
// (222,217,196) to (234,230,216). The moon is therefore both dimmer and cooler
// than every target, which is the whole point — it was previously a literal
// (255,255,255), i.e. past the top of the tone curve with no surface left.
function createMoonDiscTexture(): CanvasTexture {
  const size = MOON_TEX_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('star-catcher: 2D canvas context unavailable for the moon texture');

  const c = size / 2;
  // 2 px of margin so the feathered limb is not clipped by the canvas edge.
  const r = c - 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.clip();

  // Bright point offset up and right by ~1/3 of the radius, toward the scene's
  // key light. The outer circle overshoots the limb (1.3r) so the darkest stop
  // lands just past the edge and the falloff stays gradual all the way to it.
  const body = ctx.createRadialGradient(c + r * 0.34, c - r * 0.3, 0, c, c, r * 1.3);
  body.addColorStop(0.0, 'rgb(182, 180, 190)');
  body.addColorStop(0.32, 'rgb(172, 170, 182)');
  body.addColorStop(0.58, 'rgb(150, 148, 164)');
  body.addColorStop(0.8, 'rgb(122, 121, 142)');
  body.addColorStop(1.0, 'rgb(88, 88, 116)');
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, size, size);

  for (const [cx, cy, cr, alpha] of MOON_CRATERS) {
    const px = c + cx * r;
    const py = c + cy * r;
    const pr = cr * r;
    const crater = ctx.createRadialGradient(px, py, 0, px, py, pr);
    crater.addColorStop(0.0, `rgba(70, 68, 98, ${alpha})`);
    crater.addColorStop(0.55, `rgba(70, 68, 98, ${alpha * 0.55})`);
    crater.addColorStop(1.0, 'rgba(70, 68, 98, 0)');
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // `destination-in` multiplies the existing alpha by this mask, so the outer
  // 10% of the radius fades out instead of terminating on the aliased edge left
  // by clip(). At 100 px on screen that is a 5 px feather.
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

// Paints the moon's halo from MOON_GLOW_STOPS. Alpha decays to exactly zero at
// the quad edge, so there is no radius at which the halo stops abruptly — the
// old halo was a solid additive *sphere* at a single 0.28 opacity, which is
// precisely a second hard-edged circle around the disc.
function createMoonGlowTexture(): CanvasTexture {
  const size = MOON_TEX_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('star-catcher: 2D canvas context unavailable for the moon glow texture');

  const c = size / 2;
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [stop, rgb, alpha] of MOON_GLOW_STOPS) {
    glow.addColorStop(stop, `rgba(${rgb}, ${alpha})`);
  }
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** The two quads and two textures {@link buildMoon} allocates. */
interface MoonParts {
  /** Glow quad then disc quad, in draw order. Kept as separate meshes (not a
   * group) because teardown only deep-disposes accents that are Meshes. */
  meshes: Mesh[];
  /** Canvas textures, which `disposeMeshDeep` does not free. */
  textures: CanvasTexture[];
}

/**
 * Builds the moon as two camera-facing textured quads — a shaded disc over a
 * soft multi-stop halo — and attaches both to the scene.
 *
 * Replaces an emissive `MeshStandardMaterial` sphere inside a flat additive
 * sphere. That combination had no way to be anything but a sticker: an emissive
 * of (1, 0.95, 0.82) at intensity 0.85 *plus* the scene's key, fill, ambient and
 * point contributions puts linear radiance above 1.0 across the whole lit face,
 * and ACES at exposure 1.15 already maps a plain linear 1.0 to 230 — so the disc
 * clipped to (255, 255, 255) with no terminator, no craters and no limb. All the
 * shading now lives in a canvas texture on an unlit material, where the tone
 * curve cannot flatten it.
 *
 * @param scene - The scene to add the moon parts to.
 * @param camera - The shell camera, for screen-space placement and billboarding.
 * @param twinklePoints - Ambient tap targets to append the moon to.
 * @returns The moon meshes and textures, for disposal tracking.
 */
function buildMoon(scene: Scene, camera: PerspectiveCamera, twinklePoints: AmbientTwinklePoint[]): MoonParts {
  const discTex = createMoonDiscTexture();
  const glowTex = createMoonGlowTexture();

  const position = unprojectNdcToPlaneZ(camera, MOON_NDC_X, MOON_NDC_Y, MOON_PLANE_Z, new Vector3());

  const glowMat = new MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  glowMat.name = 'star-catcher_moonHaloMat';
  const glowHalfExtent = MOON_RADIUS * MOON_GLOW_SCALE;
  const glow = makeDecorative(new Mesh(new PlaneGeometry(glowHalfExtent * 2, glowHalfExtent * 2), glowMat));
  glow.name = 'star-catcher_moonHalo';
  // The moon is the furthest transparent thing in the sky; ordering it below the
  // starfield keeps it painted first however the depth sort resolves two quads
  // that share a centre.
  glow.renderOrder = -3;

  // The painted disc stops 2 px short of the canvas edge, so the quad is scaled
  // by 128 / (128 - 2) = 1.0159 for the moon itself to render at MOON_RADIUS.
  const half = MOON_TEX_SIZE / 2;
  const discHalfExtent = (MOON_RADIUS * half) / (half - 2);

  const discMat = new MeshBasicMaterial({
    map: discTex,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  discMat.name = 'star-catcher_moonMat';
  const disc = makeDecorative(new Mesh(new PlaneGeometry(discHalfExtent * 2, discHalfExtent * 2), discMat));
  disc.name = 'star-catcher_moon';
  disc.renderOrder = -2;

  for (const mesh of [glow, disc]) {
    mesh.position.copy(position);
    // Billboard once: the shell camera is fixed for the whole session.
    mesh.lookAt(camera.position);
    scene.add(mesh);
  }

  // The biggest, most inviting thing in the sky gets the biggest tap radius and
  // the fullest twinkle.
  twinklePoints.push({ position: position.clone(), radiusPx: 120, sparkleCount: 18 });

  return { meshes: [glow, disc], textures: [glowTex, discTex] };
}

/**
 * Builds the starfield as a single instanced mesh of tiny glowing points,
 * placed by the screen rows they land on rather than by a world-space box.
 *
 * @param camera - The shell camera.
 * @param twinklePoints - Ambient tap targets to append each background star to.
 * @returns The instanced starfield.
 */
function buildStarfield(camera: PerspectiveCamera, twinklePoints: AmbientTwinklePoint[]): InstancedMesh {
  const count = 90;
  const geometry = new SphereGeometry(0.03, 6, 6);
  const material = new MeshBasicMaterial({ color: new Color(0.58, 0.6, 0.66) });
  material.name = 'star-catcher_starMat';
  const stars = new InstancedMesh(geometry, material, count);
  stars.name = 'star-catcher_stars';

  for (let i = 0; i < count; i += 1) {
    // The old box was `y = 1.8 + rand * 8` at `z = 4 + rand * 6`, where the top
    // of the frame is y = 4.15 — about 71% of the 110 instances were above the
    // picture and 39 tap targets sat off-screen. Rows are now chosen in NDC,
    // above the ridge crest (0.40) and below the frame edge (0.99), and the
    // depth planes stay in front of the sky at z = 11 so nothing is swallowed.
    const ndcX = nextRandom() * 2 - 1;
    const ndcY = 0.4 + nextRandom() * 0.59;
    const planeZ = 8 + nextRandom() * 2.5;
    unprojectNdcToPlaneZ(camera, ndcX, ndcY, planeZ, scratchPosition);

    const s = 0.6 + nextRandom() * 1.8;
    scratchScale.set(s, s, s);
    scratchQuaternion.identity();
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
    stars.setMatrixAt(i, scratchMatrix);
    // Recorded in world space. The starfield's authored drift is a <= 0.008 rad
    // roll about the origin, which moves the outermost instance by ~0.15 units
    // (well under 10px on screen) — far inside the tap radius below, so the
    // stored point never needs re-projecting through the mesh's world matrix.
    twinklePoints.push({ position: scratchPosition.clone(), radiusPx: 60, sparkleCount: 7 });
  }
  stars.instanceMatrix.needsUpdate = true;
  return makeDecorative(stars);
}

/**
 * Builds the foreground grass as one instanced mesh of small tufts, placed by
 * raycasting screen rows onto the hill.
 *
 * The bottom 60% of the frame previously contained nothing but flat ground: the
 * measured motion profile across six horizontal bands was
 * `[18.8, 2.9, 0.25, 0.04, 0, 0]`. Grass is the cheapest thing that gives that
 * region texture and life, and it is raycast-transparent so it can never take a
 * tap away from a star resting in it.
 *
 * @param camera - The shell camera.
 * @returns The instanced grass field.
 */
function buildGrassField(camera: PerspectiveCamera): InstancedMesh {
  const count = 108;
  const bladeHeight = 0.22;
  const geometry = new ConeGeometry(0.055, bladeHeight, 4, 1);
  // Pivot at the base, so the sway rotates a tuft about its root instead of
  // about its middle (which would sink it into the hill on every stroke).
  geometry.translate(0, bladeHeight * 0.5, 0);
  const material = new MeshStandardMaterial({
    // Albedo, not a screen colour. With the retuned irradiance of 0.50-0.56 per
    // channel this leaves the tufts at scene-linear (0.035, 0.056, 0.048),
    // i.e. #2a3d33 — a green that is legible against the hill without competing
    // with the stars.
    color: new Color(0.22, 0.34, 0.27),
    roughness: 1,
    metalness: 0,
  });
  material.name = 'star-catcher_grassMat';
  const grass = new InstancedMesh(geometry, material, count);
  grass.name = 'star-catcher_grass';

  const basePosition = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const scale = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    // Slightly past both edges so the field does not stop inside the frame.
    const ndcX = -1.05 + nextRandom() * 2.1;
    const ndcY = -1.02 + nextRandom() * 1.0;
    unprojectNdcToHill(camera, ndcX, ndcY, scratchPosition);
    basePosition[i * 3] = scratchPosition.x;
    basePosition[i * 3 + 1] = scratchPosition.y;
    basePosition[i * 3 + 2] = scratchPosition.z;
    phase[i] = nextRandom() * Math.PI * 2;
    scale[i] = 0.7 + nextRandom() * 0.8;

    scratchScale.setScalar(scale[i]);
    scratchQuaternion.identity();
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
    grass.setMatrixAt(i, scratchMatrix);
  }
  grass.instanceMatrix.needsUpdate = true;
  grass.userData.sway = { basePosition, phase, scale } satisfies GrassSwayState;
  return makeDecorative(grass);
}

/**
 * Builds the glowing night flowers scattered through the grass and registers
 * each one as an ambient tap target.
 *
 * @param camera - The shell camera.
 * @param twinklePoints - Ambient tap targets to append each flower to.
 * @returns The instanced flower field.
 */
function buildFlowerField(camera: PerspectiveCamera, twinklePoints: AmbientTwinklePoint[]): InstancedMesh {
  const count = 14;
  const geometry = new SphereGeometry(0.055, 8, 6);
  const material = new MeshBasicMaterial({ color: new Color(0.13, 0.38, 0.3) });
  material.name = 'star-catcher_flowerMat';
  const flowers = new InstancedMesh(geometry, material, count);
  flowers.name = 'star-catcher_flowers';

  for (let i = 0; i < count; i += 1) {
    const ndcX = -0.9 + nextRandom() * 1.8;
    const ndcY = -0.92 + nextRandom() * 0.82;
    unprojectNdcToHill(camera, ndcX, ndcY, scratchPosition);
    scratchPosition.y += 0.07;
    const s = 0.8 + nextRandom() * 0.7;
    scratchScale.setScalar(s);
    scratchQuaternion.identity();
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
    flowers.setMatrixAt(i, scratchMatrix);
    twinklePoints.push({ position: scratchPosition.clone(), radiusPx: 55, sparkleCount: 6 });
  }
  flowers.instanceMatrix.needsUpdate = true;
  return makeDecorative(flowers);
}

/**
 * Grades the hill's vertex colours from near to far so distance reads as
 * distance rather than as a uniform slab.
 *
 * @param floor - The hill mesh whose geometry receives the colour attribute.
 */
function applyHillRecession(floor: Mesh): void {
  const position = floor.geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    // Sphere is offset in Y only, so local Z is world Z. The visible ground
    // spans z = -3.56 at the bottom edge to the silhouette out past z = 8.
    const t = smoothstep(Math.max(0, Math.min(1, (position.getZ(i) + 4) / 16)));
    const shade = 1 - 0.5 * t;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  floor.geometry.setAttribute('color', new BufferAttribute(colors, 3));
}

/**
 * Creates the Star Catcher night environment.
 *
 * @param scene - The shell-owned Three.js scene.
 * @param camera - The shell camera; scenery is placed against its frustum.
 * @param scope - Disposal scope that frees the lighting rig on teardown.
 * @returns The authored environment rig for later update and teardown.
 */
export function setupTemplateEnvironment(scene: Scene, camera: PerspectiveCamera, scope: DisposalScope): TemplateEnvironmentRig {
  seed = 20260718;

  // Camera comes from the manifest (an orbit descriptor) applied to the shell
  // camera. See architecture-standards.md#cameradescriptor.
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  // The project-wide default of 0.24 spends 0.24 * 1.17 * PI = 0.882 of
  // irradiance on image-based light from a *room* probe — 47% of this scene's
  // entire 1.876 light budget, which is why a moonlit hilltop rendered as
  // #7d8b99 daylight grey. At 0.06 it contributes 0.221 and behaves like sky
  // bounce instead of a ceiling. Restored on teardown, per little-shark.
  const previousEnvIntensity = scene.environmentIntensity;
  scene.environmentIntensity = 0.06;
  scope.add(() => {
    scene.environmentIntensity = previousEnvIntensity;
  });

  // The rig adds the lights to the scene and scope-owns them.
  //
  // Total irradiance on the hilltop is now
  //   key  0.30 * 0.788 (N.L) = 0.236
  // + fill 0.10                = 0.100
  // + IBL  0.06 * 1.17 * PI    = 0.221
  // + point 0.35 / d^2         = 0.019
  //                            = 0.576, against 1.876 before.
  const lights = createGameLighting(
    scene,
    {
      name: 'star-catcher',
      direction: new Vector3(-0.6, -1, 0.5),
      directionalIntensity: 0.3,
      hemisphericIntensity: 0.1,
      pointPosition: new Vector3(-1.9, 3.2, 1.0),
      pointIntensity: 0.35,
    },
    scope,
  );
  // `createGameLighting` builds all three lights white; moonlight is not white,
  // and the tint is what stops a dim scene from reading as merely underexposed.
  lights.directionalLight.color.setRGB(0.86, 0.91, 1);
  lights.ambientLight.color.setRGB(0.55, 0.62, 0.85);
  lights.ambientLight.groundColor.setRGB(0.3, 0.32, 0.28);
  lights.pointLight.color.setRGB(1, 0.92, 0.78);

  // Hilltop floor — muted moonlit grass.
  const floorMaterial = new MeshStandardMaterial({
    color: new Color(0.12, 0.17, 0.2),
    // Was (0.045, 0.055, 0.085), which was tuned against the old 1.876
    // irradiance. Emissive does not scale with the lights, so leaving it there
    // would have made it 2.3x the reflected term and turned the hill into a
    // self-lit blue card. At (0.018, 0.024, 0.030) reflected and emissive are
    // roughly balanced and the hill renders near #2f3d45.
    emissive: new Color(0.018, 0.024, 0.03),
    roughness: 0.95,
    metalness: 0.02,
    vertexColors: true,
  });
  floorMaterial.name = 'star-catcher_floorMat';
  // A big rounded hilltop (a large sphere whose crown is the play surface) so
  // the ground curves gently down on every side and fills the frame. Radius is
  // owned by `view.ts` because the spawn math raycasts against this same
  // sphere; it moved 30 -> 42 to flatten the silhouette (screen rows 317/346/428
  // at the centre/half/edge of the frame, versus 293/317/383 now).
  const floor = new Mesh(new SphereGeometry(HILL_RADIUS, 64, 40), floorMaterial);
  floor.name = 'star-catcher_floor';
  floor.position.y = -HILL_RADIUS;
  floor.receiveShadow = true;
  applyHillRecession(floor);
  scene.add(floor);

  // Sky backdrop (kept in the rig's backdrop slot).
  const backdrop = buildSkyGradient();
  scene.add(backdrop);

  // Decorative accents: moon, halo, starfield, ridges, grass and flowers.
  const twinklePoints: AmbientTwinklePoint[] = [];
  const moon = buildMoon(scene, camera, twinklePoints);
  const stars = buildStarfield(camera, twinklePoints);
  scene.add(stars);

  // Two ribbons at 16 and 11 units, both nearer than the 19.02-unit limb, so
  // each fully occludes the dome edge behind it. Crests sit at NDC 0.363 and
  // 0.299 (screen rows 258 and 284) — above the highest point of the limb
  // (row 293), so the horizon reads as a level skyline at every column.
  const ridges = [
    buildRidge(camera, 16, 0.363, -0.1, 0.03, new Color(0.0473, 0.0413, 0.0796), new Color(0.0271, 0.024, 0.0471)),
    buildRidge(camera, 11, 0.299, -0.2, 0.045, new Color(0.0239, 0.0294, 0.0467), new Color(0.0139, 0.017, 0.027)),
  ];
  for (const ridge of ridges) {
    scene.add(ridge);
  }

  const grass = buildGrassField(camera);
  scene.add(grass);
  const flowers = buildFlowerField(camera, twinklePoints);
  scene.add(flowers);

  const accents: Object3D[] = [...moon.meshes, stars, ...ridges, grass, flowers];

  return {
    lights,
    floor,
    backdrop,
    accents,
    textures: moon.textures,
    twinklePoints,
  };
}

/**
 * Finds the decorative night-sky object nearest a tap, or null when the tap
 * landed on empty sky.
 *
 * Defect 4: the moon and the instanced starfield were `makeDecorative()`, so in
 * a game called Star Catcher the most star-looking things on screen answered a
 * child's tap with nothing at all. They stay raycast-transparent on purpose — a
 * 0.03-unit instanced point is not something a toddler's raycast will ever hit,
 * and un-hiding the backdrop would let it steal taps aimed at real targets — so
 * the acknowledgement is resolved in screen space instead, the same way the
 * catch forgiveness in `rules/` is. These points never score; they twinkle.
 *
 * @param rig - The authored environment returned from setup.
 * @param camera - The shell camera.
 * @param rect - The canvas bounding rectangle.
 * @param tapX - Tap X in the shell's tap coordinate space (pixels).
 * @param tapY - Tap Y in the shell's tap coordinate space (pixels).
 * @returns The nearest qualifying twinkle point, or null.
 */
export function findTappedTwinklePoint(
  rig: TemplateEnvironmentRig,
  camera: PerspectiveCamera,
  rect: CanvasRect,
  tapX: number,
  tapY: number,
): AmbientTwinklePoint | null {
  let best: AmbientTwinklePoint | null = null;
  let bestDistanceSq = Infinity;

  for (const point of rig.twinklePoints) {
    projectToScreen(point.position, camera, rect, projectedPoint);
    if (projectedPoint.z > 1) continue;

    const dx = projectedPoint.x - tapX;
    const dy = projectedPoint.y - tapY;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > point.radiusPx * point.radiusPx || distanceSq >= bestDistanceSq) continue;

    bestDistanceSq = distanceSq;
    best = point;
  }

  return best;
}

// Re-tilts every grass tuft about its root. 108 instances is ~1.7 kB of matrix
// upload per frame, which is the cheapest way to put motion in the bottom of
// the frame that does not add a draw call.
function updateGrassSway(grass: InstancedMesh, elapsedTime: number): void {
  const state = grass.userData.sway as GrassSwayState | undefined;
  if (!state) return;

  for (let i = 0; i < grass.count; i += 1) {
    const phase = state.phase[i];
    const tilt = Math.sin(elapsedTime * 1.15 + phase) * 0.13;
    scratchEuler.set(tilt * 0.55, phase, tilt);
    scratchQuaternion.setFromEuler(scratchEuler);
    scratchPosition.fromArray(state.basePosition, i * 3);
    scratchScale.setScalar(state.scale[i]);
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
    grass.setMatrixAt(i, scratchMatrix);
  }
  grass.instanceMatrix.needsUpdate = true;
}

/**
 * Applies gentle authored-only motion: the starfield drifts almost
 * imperceptibly, the grass sways, and the night flowers breathe. Nothing
 * competes with gameplay readability.
 *
 * @param rig - The authored environment returned from setup.
 * @param elapsedTime - Seconds since the current run started.
 */
export function updateTemplateEnvironment(rig: TemplateEnvironmentRig, elapsedTime: number): void {
  for (const accent of rig.accents) {
    if (accent.name === 'star-catcher_stars') {
      // Halved from 0.02 so the drift stays well inside the tap tolerance of the
      // twinkle points recorded in buildStarfield.
      accent.rotation.z = Math.sin(elapsedTime * 0.05) * 0.008;
    } else if (accent.name === 'star-catcher_grass') {
      updateGrassSway(accent as InstancedMesh, elapsedTime);
    } else if (accent.name === 'star-catcher_flowers') {
      const breathe = Math.sin(elapsedTime * 1.4) * 0.5 + 0.5;
      const material = (accent as InstancedMesh).material as MeshBasicMaterial;
      material.color.setRGB(0.1 + breathe * 0.08, 0.3 + breathe * 0.22, 0.24 + breathe * 0.17);
    }
  }
}

/**
 * Tears down the authored environment and disposes all environment-owned
 * resources.
 *
 * @param rig - Environment created during setup.
 */
export function teardownTemplateEnvironment(rig: TemplateEnvironmentRig | null): void {
  if (!rig) return;

  for (const accent of rig.accents) {
    if (accent instanceof Mesh) {
      disposeMeshDeep(accent);
    } else {
      accent.removeFromParent();
    }
  }
  disposeMeshDeep(rig.floor);
  disposeMeshDeep(rig.backdrop);
  // `disposeMeshDeep` frees geometries and materials but never the textures the
  // materials reference, so the moon's two canvas textures — the only textures
  // this environment allocates — are released explicitly. The scene's
  // environment intensity is restored by the disposal scope registered in
  // setup. Lights are freed by that same scope, and the camera is the shell's.
  for (const texture of rig.textures) {
    texture.dispose();
  }
  rig.textures.length = 0;
  rig.twinklePoints.length = 0;
}

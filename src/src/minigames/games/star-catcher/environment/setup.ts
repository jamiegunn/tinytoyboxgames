/**
 * Environment setup for the Star Catcher minigame.
 *
 * Builds the night: a graded sky, a glowing moon, a dense starfield, soft
 * moonlit cloud mounds for foreground depth, and a hilltop floor — the stage
 * for catching falling stars. Gameplay (spawning, scoring) lives elsewhere.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
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
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { createGameLighting } from '@app/minigames/shared/sceneSetup';
import type { DisposalScope } from '@app/utils/disposal';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import { projectToScreen, smoothstep } from '../helpers';
import type { AmbientTwinklePoint, CanvasRect, TemplateEnvironmentRig } from '../types';

/** Radius of the sphere whose crown is the hilltop play surface. */
const HILL_RADIUS = 30;

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
 * The hill sphere (radius 30, centre y = -30) meets z = 11 at y = -2.09, and
 * the camera sees its silhouette essentially on that row. Anchoring the
 * gradient here rather than at the plane's bottom edge is the whole fix: the
 * warm band now sits exactly behind the skyline, and at the sides of the frame
 * where the hill's silhouette curves down, the newly-exposed sky below is warm
 * horizon glow instead of the flat near-black that read as a drop-off.
 */
const SKY_HORIZON_Y = -2.1;

/** World Y treated as the top of the authored gradient. */
const SKY_ZENITH_Y = 12;

/** Vertical bob applied to the cloud mounds each frame. */
const MOUND_BOB_AMPLITUDE = 0.05;

/**
 * How far a cloud mound's crown must clear the hill surface beneath it.
 *
 * Defect 7: mound 3 at (-0.6, 4.4) sat 0.030 units *below* the hill surface —
 * completely buried — and mound 4 cleared by only 0.067, which the 0.05 bob
 * then swallowed on every down-stroke. Clearance is now computed from the hill
 * sphere per mound instead of guessed, so all four sit 0.220 above their own
 * patch of ground, or 0.170 at the bottom of the bob.
 */
const MOUND_CLEARANCE = 0.22;

/** Deterministic pseudo-random so the starfield is stable across builds. */
let seed = 20260718;

/** Reused by the ambient tap search so a tap allocates nothing. */
const projectedPoint = new Vector3();

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

// World Y of the hilltop surface directly under (x, z). The play field is the
// crown of a sphere of radius HILL_RADIUS centred at (0, -HILL_RADIUS, 0).
function hillSurfaceY(x: number, z: number): number {
  const inside = HILL_RADIUS * HILL_RADIUS - x * x - z * z;
  return Math.sqrt(Math.max(0, inside)) - HILL_RADIUS;
}

/**
 * Builds the night-sky backdrop: a wide plane carrying a three-stop vertical
 * gradient anchored on the visible horizon.
 *
 * @returns The unlit gradient sky mesh.
 */
function buildSkyGradient(): Mesh {
  const geometry = new PlaneGeometry(SKY_WIDTH, SKY_HEIGHT, 1, SKY_HEIGHT_SEGMENTS);
  const zenith = new Color(0.015, 0.025, 0.09);
  const midSky = new Color(0.06, 0.085, 0.21);
  const horizonGlow = new Color(0.36, 0.25, 0.42);

  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const tmp = new Color();
  for (let i = 0; i < position.count; i += 1) {
    const worldY = SKY_CENTRE_Y + position.getY(i);
    const t = Math.max(0, Math.min(1, (worldY - SKY_HORIZON_Y) / (SKY_ZENITH_Y - SKY_HORIZON_Y)));

    // Two overlapping ramps rather than one clipped one. The base grades
    // mid-sky to zenith across the whole visible window (so no part of the sky
    // is ever a single flat value), then the horizon glow is mixed back in with
    // a soft power falloff so it thins out gradually instead of stopping dead.
    tmp.copy(midSky).lerp(zenith, smoothstep(t));
    tmp.lerp(horizonGlow, Math.pow(1 - t, 2.2));

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
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
 * Builds the glowing moon (emissive core plus an additive halo) and attaches
 * both parts to the scene.
 *
 * @param scene - The scene to add the moon parts to.
 * @param twinklePoints - Ambient tap targets to append the moon to.
 * @returns The moon parts, for disposal tracking.
 */
function buildMoon(scene: Scene, twinklePoints: AmbientTwinklePoint[]): Object3D[] {
  const coreMat = new MeshStandardMaterial({
    color: new Color(1, 0.97, 0.86),
    emissive: new Color(1, 0.95, 0.82),
    emissiveIntensity: 1.8,
    roughness: 0.9,
    metalness: 0,
  });
  coreMat.name = 'star-catcher_moonMat';
  const core = makeDecorative(new Mesh(new SphereGeometry(1.0, 28, 28), coreMat));
  core.name = 'star-catcher_moon';
  // Far background, upper-left of frame (screen-left is +X for this camera).
  core.position.set(2.9, 4.0, 10);

  const haloMat = new MeshBasicMaterial({
    color: new Color(1, 0.94, 0.78),
    transparent: true,
    opacity: 0.16,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  haloMat.name = 'star-catcher_moonHaloMat';
  const halo = makeDecorative(new Mesh(new SphereGeometry(1.7, 20, 20), haloMat));
  halo.name = 'star-catcher_moonHalo';
  halo.position.copy(core.position);

  // The biggest, most inviting thing in the sky gets the biggest tap radius and
  // the fullest twinkle.
  twinklePoints.push({ position: core.position.clone(), radiusPx: 120, sparkleCount: 18 });

  scene.add(halo);
  scene.add(core);
  return [halo, core];
}

/**
 * Builds a dense starfield as a single instanced mesh of tiny glowing points.
 *
 * @param twinklePoints - Ambient tap targets to append each background star to.
 * @returns The instanced starfield.
 */
function buildStarfield(twinklePoints: AmbientTwinklePoint[]): InstancedMesh {
  const count = 110;
  const geometry = new SphereGeometry(0.03, 6, 6);
  const material = new MeshBasicMaterial({ color: new Color(1, 0.98, 0.9) });
  material.name = 'star-catcher_starMat';
  const stars = new InstancedMesh(geometry, material, count);
  stars.name = 'star-catcher_stars';
  const matrix = new Matrix4();
  const scaleVec = new Vector3();
  const posVec = new Vector3();
  const quat = new Quaternion();
  for (let i = 0; i < count; i += 1) {
    posVec.set(nextRandom() * 32 - 16, 1.8 + nextRandom() * 8, 4 + nextRandom() * 6);
    const s = 0.6 + nextRandom() * 1.8;
    scaleVec.set(s, s, s);
    matrix.compose(posVec, quat, scaleVec);
    stars.setMatrixAt(i, matrix);
    // Recorded in world space. The starfield's authored drift is a <= 0.008 rad
    // roll about the origin, which moves the outermost instance by ~0.15 units
    // (well under 10px on screen) — far inside the tap radius below, so the
    // stored point never needs re-projecting through the mesh's world matrix.
    twinklePoints.push({ position: posVec.clone(), radiusPx: 80, sparkleCount: 7 });
  }
  stars.instanceMatrix.needsUpdate = true;
  return makeDecorative(stars);
}

/**
 * Builds one soft moonlit cloud mound (a flattened, tinted sphere) for
 * foreground depth, tagged with a bob baseline in userData.
 *
 * @param x - World X position.
 * @param z - World Z position.
 * @param scale - Overall mound scale.
 * @param tint - Base colour of the mound.
 * @returns The mound mesh.
 */
function buildCloudMound(x: number, z: number, scale: number, tint: Color): Mesh {
  const material = new MeshStandardMaterial({
    color: tint,
    emissive: tint.clone().multiplyScalar(0.25),
    roughness: 1,
    metalness: 0,
  });
  material.name = 'star-catcher_moundMat';
  const mesh = makeDecorative(new Mesh(new SphereGeometry(1, 18, 14), material));
  mesh.name = 'star-catcher_mound';
  // Distant rolling hills: mostly sunk below the hilltop so only rounded tops
  // poke up along the horizon. The mound is a unit sphere scaled to half height,
  // so its crown sits `scale * 0.5` above its centre — solve that back from the
  // hill surface under this exact (x, z) so the crown clears it by
  // MOUND_CLEARANCE. Guessing a shared offset is what buried mound 3 (defect 7).
  const baseY = hillSurfaceY(x, z) + MOUND_CLEARANCE - scale * 0.5;
  mesh.position.set(x, baseY, z);
  mesh.scale.set(scale, scale * 0.5, scale);
  mesh.userData.baseY = baseY;
  mesh.userData.phase = nextRandom() * Math.PI * 2;
  return mesh;
}

/**
 * Creates the Star Catcher night environment.
 *
 * @param scene - The shell-owned Three.js scene.
 * @param scope - Disposal scope that frees the lighting rig on teardown.
 * @returns The authored environment rig for later update and teardown.
 */
export function setupTemplateEnvironment(scene: Scene, scope: DisposalScope): TemplateEnvironmentRig {
  seed = 20260718;

  // Camera comes from the manifest (an orbit descriptor) applied to the shell
  // camera. See architecture-standards.md#cameradescriptor.

  // The rig adds the lights to the scene and scope-owns them.
  const lights = createGameLighting(
    scene,
    {
      name: 'star-catcher',
      direction: new Vector3(-0.6, -1, 0.5),
      directionalIntensity: 0.7,
      hemisphericIntensity: 0.42,
      pointPosition: new Vector3(-1.9, 3.2, 1.0),
      pointIntensity: 0.4,
    },
    scope,
  );

  // Hilltop floor — muted moonlit grass.
  const floorMaterial = new MeshStandardMaterial({
    color: new Color(0.12, 0.17, 0.2),
    // Lifted from (0.02, 0.03, 0.05) as part of the horizon join (defect 6):
    // against the warm glow now sitting directly behind the skyline, the old
    // value made the hill a black paper cut-out, which is what read as the
    // ground "dropping off" rather than receding.
    emissive: new Color(0.045, 0.055, 0.085),
    roughness: 0.95,
    metalness: 0.02,
  });
  floorMaterial.name = 'star-catcher_floorMat';
  // A big rounded hilltop (a large sphere whose crown is the play surface) so
  // the ground curves gently down on every side and fills the frame — the old
  // flat 11x9 plane read as a slab floating in the sky with hard drop-off edges.
  const floor = new Mesh(new SphereGeometry(HILL_RADIUS, 64, 40), floorMaterial);
  floor.name = 'star-catcher_floor';
  floor.position.y = -HILL_RADIUS;
  floor.receiveShadow = true;
  scene.add(floor);

  // Sky backdrop (kept in the rig's backdrop slot).
  const backdrop = buildSkyGradient();
  scene.add(backdrop);

  // Decorative accents: moon, halo, starfield, and foreground cloud mounds.
  const twinklePoints: AmbientTwinklePoint[] = [];
  const moonParts = buildMoon(scene, twinklePoints);
  const stars = buildStarfield(twinklePoints);
  scene.add(stars);
  const mounds = [
    buildCloudMound(-4.8, 4.2, 3.6, new Color(0.2, 0.24, 0.36)),
    buildCloudMound(4.6, 4.3, 3.9, new Color(0.17, 0.21, 0.33)),
    buildCloudMound(-0.6, 4.4, 3.0, new Color(0.24, 0.28, 0.4)),
    buildCloudMound(2.4, 4.1, 2.6, new Color(0.26, 0.3, 0.42)),
  ];
  for (const mound of mounds) {
    scene.add(mound);
  }

  const accents: Object3D[] = [...moonParts, stars, ...mounds];

  return {
    lights,
    floor,
    backdrop,
    accents,
    twinklePoints,
  };
}

/**
 * Finds the decorative night-sky object nearest a tap, or null when the tap
 * landed on empty sky.
 *
 * Defect 4: the moon and the 110-instance starfield were `makeDecorative()`, so
 * in a game called Star Catcher the most star-looking things on screen answered
 * a child's tap with nothing at all. They stay raycast-transparent on purpose —
 * a 0.03-unit instanced point is not something a toddler's raycast will ever
 * hit, and un-hiding the backdrop would let it steal taps aimed at real targets
 * — so the acknowledgement is resolved in screen space instead, the same way
 * the catch forgiveness in `rules/` is. These points never score; they twinkle.
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

/**
 * Applies gentle authored-only motion: cloud mounds bob, the starfield drifts
 * almost imperceptibly. Nothing competes with gameplay readability.
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
    } else if (accent.name === 'star-catcher_mound') {
      const baseY = (accent.userData.baseY as number) ?? accent.position.y;
      const phase = (accent.userData.phase as number) ?? 0;
      accent.position.y = baseY + Math.sin(elapsedTime * 0.5 + phase) * MOUND_BOB_AMPLITUDE;
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
  rig.twinklePoints.length = 0;
  // Lights are freed by the shell's disposal scope; the camera is the shell's.
}

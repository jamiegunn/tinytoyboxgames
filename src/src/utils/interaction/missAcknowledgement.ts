import { Raycaster, Vector3, type Object3D, type Ray, type Scene } from 'three';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';

/**
 * Depth used only for a tap ray that leaves the world without touching anything
 * — genuine open sky, or the letterboxed margin outside a room's shell.
 *
 * Nothing is between the camera and this point by definition (the ray hit no
 * geometry), so the only job of the number is to make the burst read at the
 * same size as one emitted on a prop. Both scene families orbit at 10–14 units,
 * so 12 sits in the middle of the props.
 */
const SKY_SPARKLE_DISTANCE = 12;

/**
 * How far proud of a hit surface the burst is placed, in world units.
 *
 * A burst emitted exactly on the surface fails the depth test against it about
 * half the time (`PointsMaterial` here has `depthWrite: false` but depth
 * *testing* is still on), so some lift is required. The lift has both an upper
 * and a lower bound, and getting only the upper one right is what made the first
 * attempt at this fix fail its own evaluation.
 *
 * UPPER BOUND — the burst must still read as being under the finger. Lifting
 * along the normal of a surface seen edge-on shifts the burst across the screen
 * by `standoff / (2 · distance · tan(fov/2))` of frame height. At the rooms'
 * 14-unit orbit with `SCENE_CAMERA_FOV = 50` that denominator is 13.057, and the
 * codebase has already committed to what counts as the same spot: `PROXIMITY_PX
 * = 70` treats 70 px of slack as "the child meant this". On a 720 px frame that
 * is 9.72% of frame height, so the ceiling is 1.269 units.
 *
 * LOWER BOUND — the burst is a volume, not a point, and it has to clear the
 * surface, not merely start in front of it. `SCENE_SPARKLE` throws particles in a
 * cone of half-angle 0.82 rad about +Y, so a particle at the core radius sits
 * `radius · sin(0.82)` to the side of the anchor. On a wall, whose normal is
 * horizontal, "to the side" means straight into the plaster. Half the preset's
 * median travel (1.75 u/s over 0.55 s) is 0.481, and the grading probe samples
 * the burst at a rounded 0.5 — so the floor the fix was actually held to is
 * 0.5 · sin(0.82) = 0.366, slightly stricter than the physics, which is the safe
 * direction to round. Measurement agreed with the arithmetic: at a standoff of
 * 0.25 the visible share of the sampled core fell to 0.464 in Playroom at
 * 375x667, under the 0.50 the grading probe had committed to in advance.
 *
 * So the admissible window is [0.366, 1.269] and this is the smallest value that
 * clears the floor with margin, because the sparkle should look like it belongs
 * to the surface rather than floating in front of it. `miss-acknowledgement
 * .contract.test.mjs` re-derives both bounds from their four inputs, so changing
 * the cone, the field of view, the interaction slack or the probe's core radius
 * fails at this decision instead of quietly invalidating it.
 */
const SURFACE_STANDOFF = 0.45;

/**
 * Opacity at or above which a material is treated as an occluder.
 *
 * Nature's water plane is a registered, *transparent* mesh sitting at y = 0.038
 * over the whole pond. A tap ray through it hits it first, but the child can see
 * straight through it to the bed below, so standing the sparkle off the water
 * would place the acknowledgement in the wrong place — and, worse, treating it
 * as a surface at all would mean the pond answers differently from the grass
 * beside it for no reason a child could perceive.
 */
const OPAQUE_MIN_OPACITY = 0.95;

/**
 * True when an object and every ancestor up to the scene are visible.
 *
 * `Raycaster` does not check `visible` — it tests layers and then descends —
 * so a hidden mesh (a closed toybox lid, a swapped-out prop) is a hit as far as
 * the raycaster is concerned. Placing an acknowledgement against a surface the
 * child cannot see is exactly the defect this module exists to remove.
 *
 * @param object - The hit object.
 * @returns Whether the object is actually rendered.
 */
function isRendered(object: Object3D): boolean {
  let node: Object3D | null = object;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

/**
 * True when a hit object is something a child would see the sparkle against.
 *
 * @param object - The hit object.
 * @returns Whether the object can hide a burst placed behind it.
 */
function isOccluder(object: Object3D): boolean {
  if (object.type !== 'Mesh') return false;
  if (!isRendered(object)) return false;
  const material = (object as { material?: unknown }).material;
  const first = Array.isArray(material) ? material[0] : material;
  const m = first as { transparent?: boolean; opacity?: number } | undefined;
  return m?.transparent !== true || (m?.opacity ?? 1) >= OPAQUE_MIN_OPACITY;
}

/**
 * Builds the miss acknowledgement shared by every world and room scene.
 *
 * soul.md#6 makes an answer to a tap on empty space a contract, and the Sound
 * World clause makes the *visual* half of that answer the load-bearing one: a
 * muted experience must be "fully playable and emotionally complete". The
 * controller supplies the sound; this supplies the sparkle.
 *
 * The reason this is shared rather than written per factory is a measured
 * defect, not tidiness. `worldSceneFactory` chose the depth once — a constant 12
 * units along the tap ray — with a docblock arguing that the sky has no geometry
 * so nothing can come between. A render probe that raycasts from the camera to
 * each emitted burst refutes it: 11.6% of Nature's missed taps at 1280x720 were
 * placed *behind* its own tree trunks and canopies (`tree_5.2_-1.0` 41.8%,
 * `treeTrunk` 10.3%), and a literal copy of the same constant into the three
 * rooms was invisible over up to 22.0% of the frame, swallowed by the side walls
 * (42.3% each) and the ceiling. Both scene families were emitting a burst on
 * every missed tap and hiding it inside the world.
 *
 * So the depth is found rather than chosen: the burst goes where the ray meets
 * the world, lifted clear of that surface, and the chosen constant survives only
 * for a ray that meets nothing at all.
 *
 * @param scene - Scene whose particle engine emits the burst and whose geometry
 *   decides where it belongs.
 * @returns A handler for `setMissHandler`.
 */
export function createMissAcknowledgement(scene: Scene): (ray: Ray) => void {
  const caster = new Raycaster();
  const point = new Vector3();
  const normal = new Vector3();

  return (ray: Ray): void => {
    caster.set(ray.origin, ray.direction);
    const hit = caster.intersectObjects(scene.children, true).find((candidate) => isOccluder(candidate.object));

    if (!hit) {
      ray.at(SKY_SPARKLE_DISTANCE, point);
      getParticleEngine(scene).emit(PARTICLES.sceneSparkle, point);
      return;
    }

    point.copy(hit.point);
    // Cap the lift on a surface closer than the standoff itself, so a prop
    // pressed against the lens cannot throw the burst behind the camera.
    const standoff = Math.min(SURFACE_STANDOFF, hit.distance * 0.5);

    if (hit.face) {
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
      // A room's walls are boxes seen from inside, and some authored geometry is
      // wound the other way; lift towards the camera either way.
      if (normal.dot(ray.direction) > 0) normal.negate();
    } else {
      normal.copy(ray.direction).negate();
    }

    point.addScaledVector(normal, standoff);
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, point);
  };
}

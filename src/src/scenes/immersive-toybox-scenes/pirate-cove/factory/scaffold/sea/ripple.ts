/**
 * The splash the sea makes when a child taps it.
 *
 * See architecture-standards.md#screenspace — the general rule was written from
 * this file, so the two should be changed together.
 *
 * WHY THIS IS NOT A PARTICLE BURST, WHICH IS WHAT THE SIBLING SCENE USES.
 * Nature's stream answers a tap with `PARTICLES.waterRipple`, and the obvious
 * fix here was to copy that line. It was measured before it was written
 * (`.probe/render/r6-reach.mjs`) and it does not survive the measurement:
 *
 *   - `waterRipple` is authored at 0.02–0.06 WORLD UNITS, and a particle
 *     preset's size is a material uniform, so `EmitOverrides` can change the
 *     colour and the count but cannot change the size.
 *   - Nature's stream spans distances 5.8–10.6 from the camera: a 1.8x range,
 *     essentially one depth. A fixed world size is legitimate there.
 *   - Pirate Cove's sea spans 14.2–101.4 in landscape and 23.0–142.5 on a
 *     phone: a 7.1x range. One world unit subtends 54 px at the rail and 7.6 px
 *     at the far edge of the visible water.
 *
 * So the same 0.06-unit puff renders around 3 px at the rail and well under one
 * pixel at the horizon. Copying the sibling scene would have shipped a tap
 * handler that fires, plays a sound, and shows the child nothing — which is a
 * worse failure than the inert sea it was meant to fix, because it looks fixed.
 *
 * WHERE THE SIZE COMES FROM. Not from taste. `PROXIMITY_PX` (gestureRules.ts)
 * is the radius within which this app's own controller will hand a near-miss to
 * a small target; it is the codebase's single existing assertion that "this many
 * pixels is a thing a small child can aim at and see". A ripple is sized to span
 * exactly that many pixels at the depth it was struck:
 *
 *     pxPerUnit(d) = (h / 2) * f / d,   f = projectionMatrix.elements[5]
 *     radius       = (PROXIMITY_PX / 2) / pxPerUnit(d)
 *                  = PROXIMITY_PX * d / (h * f)
 *
 * where `d` is the point's DEPTH ALONG THE VIEW AXIS — see the comment at the
 * reading site for why the distance from the eye is a different number and the
 * wrong one.
 *
 * `f` is `1 / tan(vfov / 2)` read straight off the LIVE projection matrix, and
 * `h` off the live canvas, for the same reason the probe reads them there: the
 * scene's authored camera preset is what the scene asks for, and `resize` is
 * free to give it something else per viewport. Round 5 of this review produced a
 * retracted finding by measuring a camera the app never adopts, and a separate
 * retracted finding by typing a pixel constant in from memory. Both mistakes are
 * unavailable here.
 *
 * WHY THERE IS A CAP. Past ~65 units the honest radius exceeds three world units
 * and the ring starts to read as a crop circle rather than a splash. It is
 * clamped to 0.6 of the hull's beam, which at the far edge of the sea still
 * leaves roughly 45 px of ring — smaller than a ripple at the rail, which is
 * correct, because it IS further away.
 *
 * WHY THE RINGS HANG OFF `seaAndSky` AND NOT THE SCENE ROOT. The ambient rig
 * rolls and heaves that group and deliberately leaves the deck rigid (see
 * `../ambientMotion`). A ripple parented to the scene root would sit still while
 * the water tilted underneath it, and the illusion the whole rig exists to
 * create — that the ship is the still thing and the sea is not — would break at
 * exactly the moment the child is looking hardest at the water.
 */

import gsap from 'gsap';
import { Color, Mesh, MeshBasicMaterial, type Object3D, type PerspectiveCamera, RingGeometry, Vector3 } from 'three';
import { playAnimations } from '@app/utils/animationHelpers';
import { PROXIMITY_PX } from '@app/utils/interaction/gestureRules';
import { OCEAN_Y } from './create';

/** Rings drawn per splash. Two, staggered, reads as water rather than as a UI pulse. */
const RINGS_PER_SPLASH = 2;

/** Concurrent splashes the pool can hold before the oldest is recycled. */
const CONCURRENT_SPLASHES = 3;

/** Frames per second for the ripple timelines. */
const FPS = 60;

/** Frame at which a ring has finished expanding and faded out. */
const LIFETIME_FRAMES = 54;

/** Frames the second ring waits before it starts. */
const STAGGER_FRAMES = 13;

/** Fraction of final radius a ring starts at. */
const START_SCALE = 0.25;

/** Peak opacity of the leading ring. */
const PEAK_OPACITY = 0.6;

/** Height above the waterline, in world units — enough to clear z-fighting. */
const RIPPLE_LIFT = 0.02;

/** Smallest ripple radius allowed, in world units. */
const MIN_RADIUS = 0.35;

/**
 * Largest ripple radius allowed, in world units: 0.6 of `HULL_PLAN.beam`. Not
 * imported from the hull plan, because the hull is not what constrains this —
 * the ring stops growing where it stops reading as a splash, and tying the two
 * together would make a future change to the ship's beam silently resize the sea.
 */
const MAX_RADIUS = 3.0;

/** A live ripple ring: the mesh and its own material, so opacity is per-ring. */
interface Ring {
  mesh: Mesh;
  material: MeshBasicMaterial;
  /**
   * Bumped by every `launch`. The launch that owns the ring is the one whose
   * generation still matches when its `onEnd` finally runs — see `launch`.
   */
  generation: number;
}

/** What {@link createSeaRipples} hands back to the tap wiring. */
export interface SeaRipples {
  /** Draws a distance-scaled splash at a world-space point on the water. */
  splash(worldPoint: Vector3): void;
  /** Stops every tween, unparents every ring, and frees the GPU resources. */
  dispose(): void;
}

/**
 * Builds a pooled set of expanding ripple rings on the water.
 *
 * @param parent - The group the ocean itself hangs off, so ripples ride the swell.
 * @param camera - The live scene camera, read per splash for its projection.
 * @param canvas - The live canvas, read per splash for its pixel height.
 * @returns A {@link SeaRipples} handle. The caller owns disposal.
 */
export function createSeaRipples(parent: Object3D, camera: PerspectiveCamera, canvas: HTMLCanvasElement): SeaRipples {
  // One geometry for the whole pool, laid flat at construction rather than by
  // rotating each mesh. A ring rotated on the mesh would have its in-plane axes
  // on `scale.x`/`scale.y`, which reads as a bug every time somebody edits this
  // file; rotating the geometry puts them on `scale.x`/`scale.z`, where "the
  // horizontal axes of a thing lying on the water" belong. Outer radius is 1, so
  // scale IS the world radius and no second constant has to agree with the first.
  const geometry = new RingGeometry(0.78, 1, 44);
  geometry.rotateX(-Math.PI / 2);

  const foam = new Color(0.86, 0.95, 1.0);
  const pool: Ring[] = [];
  for (let i = 0; i < CONCURRENT_SPLASHES * RINGS_PER_SPLASH; i++) {
    const material = new MeshBasicMaterial({ color: foam, transparent: true, opacity: 0, depthWrite: false });
    material.name = 'ship_seaRippleMat';
    const mesh = new Mesh(geometry, material);
    mesh.name = `ship_seaRipple_${i}`;
    mesh.visible = false;
    // Ripples are decoration on top of the water, not scene geometry, so they
    // decline the raycast. This is defence in depth and the comment used to
    // overstate it: `pickRegistered` raycasts `[...registry.keys()]`, and these
    // rings hang off the sea-and-sky GROUP as siblings of the registered ocean
    // mesh, so today they are outside the picked set entirely and could not
    // shadow it whatever this line said. It earns its place against the obvious
    // future refactor — parenting the pool to the water it draws on — which is
    // one token away and would otherwise put a growing ring in front of the tap
    // target it exists to acknowledge. `pirateCoveInteraction.test.mjs` C3 pins
    // the membership property and says so in its own header; the mutation pass
    // showed THIS line survives deletion, which is what defence in depth looks
    // like and is not a reason to keep a false comment above it.
    mesh.raycast = () => {};
    parent.add(mesh);
    pool.push({ mesh, material, generation: 0 });
  }

  let next = 0;
  const local = new Vector3();
  const view = new Vector3();

  const radiusFor = (worldPoint: Vector3): number => {
    const h = canvas.clientHeight || canvas.height || 1;
    // elements[5] of a perspective projection is 1 / tan(vfov / 2). Read live:
    // see the file header for why the authored preset is not admissible here.
    const f = camera.projectionMatrix.elements[5];
    // DEPTH ALONG THE VIEW AXIS, NOT DISTANCE FROM THE EYE. A perspective divide
    // divides by view-space z, so those two differ by 1 / cos(angle off axis) and
    // a radial reading over-sizes every ripple that is not straight ahead. The
    // first draft used `getWorldPosition(eye).distanceTo(worldPoint)` and the test
    // that pins this caught it: a splash 16 degrees off axis came out 72.9 px
    // against the 70 px it is sized to, and at the corner of a 50-degree frame
    // the same error is about 13%. `matrixWorldInverse` is maintained by
    // `Camera.updateMatrixWorld`, so it is the matrix the last rendered frame
    // used — which is the frame the child was looking at when they tapped.
    const d = -view.copy(worldPoint).applyMatrix4(camera.matrixWorldInverse).z;
    if (!(f > 0) || !(d > 0)) return MIN_RADIUS;
    const radius = (PROXIMITY_PX * d) / (h * f);
    return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radius));
  };

  const launch = (ring: Ring, radius: number, delayFrames: number): void => {
    // WHY THIS COUNTER EXISTS, AND WHY DELETING IT MAKES RAPID TAPS INVISIBLE.
    //
    // Relaunching a ring kills every tween its previous timeline owned: the two
    // `killTweensOf` calls inside `playAnimations` take the mesh and its scale,
    // and the explicit one below takes the material. A gsap timeline whose
    // children have all been killed reports zero remaining duration and fires
    // its `onComplete` on the NEXT TICK — by which point this launch has already
    // set `visible = true`. So the previous launch's `onEnd` runs against the
    // ring the current launch just lit, and hides it.
    //
    // The pool is 6 rings consumed 2 at a time, so the FOURTH tap inside one
    // 0.9s lifetime recycles rings 0 and 1 mid-flight. Measured before this
    // guard existed (`.probe/render/r7-recycle.mjs`): both relaunched rings sat
    // at `visible = false` while still animating — at 350ms they were at opacity
    // 0.41 and 0.57 and scale 0.67, a fully-running, fully-invisible splash. A
    // child slapping the water — the exact gesture this whole file exists to
    // answer — got nothing back on every fourth tap.
    //
    // A generation stamp rather than a captured tween handle, because the thing
    // that must be identified is "did anyone else claim this ring since", and a
    // handle to a timeline that gsap has already emptied cannot answer that.
    const generation = ++ring.generation;
    const from = radius * START_SCALE;
    // `playAnimations` tweens FROM whatever the property currently holds — its
    // first keyframe is a timing anchor, not an assignment — so the start state
    // is set here rather than trusted to the keys.
    ring.mesh.scale.set(from, 1, from);
    ring.material.opacity = 0;
    ring.mesh.visible = true;

    // `stopCurrent` kills tweens on the target and on its position/rotation/
    // scale. The material is none of those, so a ring recycled mid-flight would
    // otherwise keep fading under its own replacement's tween.
    gsap.killTweensOf(ring.material);

    // The stagger is leading keyframes rather than a gsap delay so the whole
    // ripple is one timeline the disposal path can kill by target.
    const hold = delayFrames;
    playAnimations(
      ring.mesh,
      [
        {
          property: 'scale.x',
          keys: [
            { frame: 0, value: from },
            { frame: hold, value: from },
            { frame: LIFETIME_FRAMES, value: radius },
          ],
        },
        {
          property: 'scale.z',
          keys: [
            { frame: 0, value: from },
            { frame: hold, value: from },
            { frame: LIFETIME_FRAMES, value: radius },
          ],
        },
        {
          property: 'material.opacity',
          keys: [
            { frame: 0, value: 0 },
            { frame: hold, value: 0 },
            { frame: hold + 6, value: PEAK_OPACITY },
            { frame: LIFETIME_FRAMES, value: 0 },
          ],
        },
      ],
      {
        fps: FPS,
        onEnd: () => {
          // Only the launch that still owns this ring may hide it.
          if (ring.generation !== generation) return;
          ring.mesh.visible = false;
        },
      },
    );
  };

  return {
    splash(worldPoint: Vector3): void {
      const radius = radiusFor(worldPoint);
      local.copy(worldPoint);
      parent.worldToLocal(local);
      for (let i = 0; i < RINGS_PER_SPLASH; i++) {
        const ring = pool[next];
        next = (next + 1) % pool.length;
        ring.mesh.position.set(local.x, OCEAN_Y + RIPPLE_LIFT, local.z);
        // The trailing ring is a touch wider, so the pair reads as one spreading
        // disturbance instead of two copies of the same circle.
        launch(ring, radius * (1 + i * 0.35), i * STAGGER_FRAMES);
      }
    },
    dispose(): void {
      for (const ring of pool) {
        gsap.killTweensOf(ring.mesh);
        gsap.killTweensOf(ring.mesh.scale);
        gsap.killTweensOf(ring.material);
        ring.mesh.removeFromParent();
        ring.material.dispose();
      }
      geometry.dispose();
      pool.length = 0;
    },
  };
}

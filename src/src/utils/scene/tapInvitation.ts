import { Box3, CanvasTexture, Color, NormalBlending, Sprite, SpriteMaterial, Vector3, type Object3D, type Scene } from 'three';
import gsap from 'gsap';
import { getIdleAnimator } from '@app/utils/idle/registry';

/**
 * A soft halo that hangs above a tappable destination and breathes, so a child
 * who cannot read knows where to put a finger.
 *
 * WHY IT LOOKS LIKE THIS, AND NOT LIKE AN ARROW. soul.md#3: "A three-year-old
 * who cannot read a single letter must be able to play this entire experience
 * through tapping alone. Visual affordance, ambient motion, and the owl's gentle
 * guidance replace every instruction manual. Icons replace text. GLOWING OBJECTS
 * REPLACE LABELS." And soul.md#4 sets the tempo: "Ambient animations breathe at
 * the pace of a sleeping cat... Motion communicates life and invitation, not
 * urgency." A halo that swells and fades over three and a half seconds is that
 * sentence; a bouncing arrow is not.
 *
 * WHAT WAS LEARNED SOMEWHERE ELSE FIRST. `minigames/games/fireflies/tapHint.ts`
 * is the same idea over a firefly, and it carries three findings this reuses
 * rather than rediscovers:
 *
 *   1. A SOFT ANNULUS, never a stroked circle. Two hard-edged strokes blown up
 *      to a quarter of the frame read as a debug wireframe overlay. Alpha here
 *      is 0 at the centre, rises to a peak and returns to exactly 0 before the
 *      quad's edge, so no border can ever show.
 *   2. SIZE IT TO THE THING IT POINTS AT, and check the result in PIXELS. That
 *      hint was 281px across on a 1280-wide frame before anyone measured it.
 *      This one is a fraction of the toybox's own footprint, so a big chest gets
 *      a big halo and a small one a small halo.
 *   3. DO NOT SWALLOW THE TAP. The halo hangs directly over the thing it is
 *      asking to be tapped, so `raycast` is a no-op.
 *
 * WHERE IT DIFFERS, which is why the texture is not shared. That hint centres on
 * its target because a firefly is smaller than the ring — over a toybox the same
 * choice would bury the halo inside the lid. This one hangs above, and the gap
 * is load-bearing for a reason that has nothing to do with looks: see GAP_Y. It
 * also renders over a lit daytime room rather than a night sky, so it cannot use
 * additive blending alone. Merging the two would mean one texture with two
 * parameter sets and two disposal stories (that one owns a per-instance texture
 * so `dispose` can release it; this one caches a single upload for every halo in
 * the app). Worth doing when a third caller appears, not before.
 */

/**
 * Soft annulus stops as `[fraction of the half-extent, alpha]`.
 *
 * Wider and softer than the fireflies ring, which peaks at 0.55 alpha over a
 * night sky. This one has to read against a lit wall, so it carries more of its
 * weight in the middle of the band and returns to zero well inside the quad.
 */
const RING_STOPS: readonly (readonly [number, number])[] = [
  [0.0, 0],
  [0.3, 0],
  [0.44, 0.2],
  [0.58, 1],
  [0.72, 0.2],
  [0.86, 0],
  [1.0, 0],
];

/**
 * How far the halo's lower edge clears the top of what it points at, in world
 * units.
 *
 * THIS IS NOT A LOOKS NUMBER, it is the one that keeps the owl out of the halo.
 * `perchSurfaces.ts` promotes any root whose underside is within
 * `STACK_CONTACT_Y` (0.12) of a surface below it into something the owl can land
 * ON — so a halo hung 0.1 above a toybox lid becomes furniture, and the owl
 * perches on a ring of light. At 0.22 the halo is classified `airborne` instead,
 * which is the same bucket as the wall clock and the curtains: never stamped
 * into the perch field, never landed on, and invisible to the two sweeps in
 * `owl-perch-surfaces.test.mjs` that ask whether the owl is standing inside
 * something or on nothing.
 *
 * It is also small enough that the halo still reads as belonging to the box. The
 * fireflies hint learned the other end of this: a hint floating far enough above
 * its target frames empty air and stops meaning anything.
 */
const GAP_Y = 0.22;

/**
 * Halo diameter as a fraction of the target's smaller floor dimension.
 *
 * SMALL, BECAUSE THE QUAD'S SIZE IS ALSO ITS DISTANCE. The sprite hangs by its
 * lower edge (`GAP_Y` above the lid), so its CENTRE — where the light actually
 * is — sits `GAP_Y + diameter / 2` up. At the first pass, 0.85 of a 1.35-wide
 * toybox gave a 1.15 quad and put the ring 0.88 above the lid, level with the
 * wainscoting and reading as an unattached blob hanging in the room rather than
 * as something belonging to the box. Halving the quad halves that lever arm.
 */
const DIAMETER_RATIO = 0.5;

/** Diameter clamps, so neither a doll's house nor a chest gets an absurd halo. */
const MIN_DIAMETER = 0.42;
const MAX_DIAMETER = 0.7;

/**
 * Peak opacity of the halo at the top of a breath.
 *
 * THIS NUMBER AND THE COLOUR BELOW WERE BOTH CHOSEN BY SQUINTING FIRST, AND THE
 * SQUINT WAS WRONG. The first ring was near-white cream at 0.62. It read fine in
 * the Living Room, whose floor is mid-tone boards, and all but vanished in the
 * Playroom, whose floor is pale cream — so it was changed to amber at 0.72 on the
 * theory that the problem was HUE, and the amber version did look better in a
 * screenshot.
 *
 * `.probe/render/halo-contrast.mjs` then rendered every room twice, once with the
 * halos and once without, and measured the pixels that actually changed. On the
 * binding case — the Playroom's pale floor, 393x852 phone — Weber contrast
 * against the floor and the pixels that move across one breath came out:
 *
 *     amber 0.72   (the "fix")          9.8%    94 px moving
 *     cream 0.62   (what it replaced)  11.0%   262 px
 *     warm white 0.85                  14.9%   358 px
 *     warm white 0.95                  16.5%   393 px
 *     warm white 1.00                  17.4%   399 px
 *     pale gold 0.95                   15.8%   356 px
 *
 * The amber "fix" was a REGRESSION on both counts, and a deeper, more saturated
 * orange measured worse still (11.8% in the same room on a laptop). Hue was never
 * the lever. The eye weights luminance far above chroma, and amber's luminance is
 * almost exactly a pale wooden floor's — changing the hue moved the colour
 * without moving the thing that makes an edge visible at all.
 *
 * 0.95 rather than 1.00 because the last 0.05 buys 0.9 of a point in the pale
 * room and costs the Kitchen, whose floor is dark and where the same ring already
 * measures 277%. Past some point a soft halo there stops being soft.
 */
const PEAK_OPACITY = 0.95;

/**
 * How much of the halo's brightness the breath carries (the rest is steady).
 *
 * THE LEVER STILL CONNECTED AFTER CONTRAST RAN OUT. Still contrast tops out near
 * 17% in the pale room whatever colour is used, but a still frame is not what a
 * child sees, and motion beats contrast for catching an eye. Measured as the
 * share of the halo's own disc whose pixels move between the trough and the peak
 * of one breath, in that same worst room:
 *
 *     depth 0.35 (first pass)  21% of the disc
 *     depth 0.55               26%
 *     depth 0.75               30%
 *
 * 0.55 and not 0.75 because 0.75 leaves the trough at a quarter of peak, which
 * stops reading as breathing and starts reading as blinking — and soul.md#4 is
 * explicit that ambient motion means "life and invitation, not urgency". 0.55
 * holds the trough at 0.43 opacity: always present, visibly swelling.
 */
const BREATH_DEPTH = 0.55;

/** Scale swing across a breath, as a fraction. */
const BREATH_SCALE = 0.09;

/** Seconds per breath. soul.md#4: "the pace of a sleeping cat". */
const BREATH_PERIOD = 3.5;

/** Seconds after the room opens before the first invitation appears. */
const APPEAR_DELAY = 2.5;

/** Seconds of no touching at all before the invitation comes back. */
const IDLE_RETURN = 12;

/** Seconds the halo takes to fade in or out. */
const FADE = 0.7;

let cachedTexture: CanvasTexture | null = null;

/**
 * The soft ring, built once for the whole app.
 *
 * Module-cached rather than per-instance: every halo in every room is the same
 * image, and the alternative is one GPU upload per toybox per room entry.
 *
 * NULL WITHOUT A DOM, which is not a browser case — it is the test one. Six
 * suites build all three rooms under `node --test` to measure framing, perches
 * and mesh names, and there is no `document` there to draw a canvas on. A room
 * that cannot be built headlessly cannot be measured, and every guard this
 * repository has over these scenes depends on being able to build them. The
 * material takes `map: null` happily; nothing renders in that environment, so
 * nothing is lost. In a browser `document` always exists and this always returns
 * a texture — the same shape of guard as `utils/qualityTier.ts`.
 *
 * @returns The shared annulus texture, or null where there is no DOM to build it in.
 */
function ringTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedTexture) return cachedTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const centre = size / 2;
  const gradient = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre);
  for (const [stop, alpha] of RING_STOPS) {
    gradient.addColorStop(stop, `rgba(255, 246, 219, ${alpha})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  cachedTexture = new CanvasTexture(canvas);
  return cachedTexture;
}

/** A live invitation, owned by whoever created the thing it points at. */
export interface TapInvitation {
  /** Removes the halo and stops every tween and timer it owns. */
  dispose(): void;
}

/**
 * Hangs a breathing halo above `target` and manages when it shows itself.
 *
 * THE SHOW/HIDE RULE IS ABOUT ATTENTION, NOT ABOUT SUCCESS. It appears a couple
 * of seconds after the room opens, disappears the moment the child touches the
 * screen at all — a drag to look around counts, because a child turning the room
 * is engaged and does not need pointing at — and comes back only after a long
 * quiet. Tying it to "has this toybox been opened" instead would be wrong twice:
 * opening one navigates away and unmounts the room, so the flag would have
 * nowhere to live, and a child who has opened a box before can still arrive back
 * in the room and not know what to do.
 *
 * `pointerdown` on the canvas is the signal rather than the tap dispatcher,
 * because the dispatcher only reports taps that LANDED on something. A child
 * prodding the floor is engaged too.
 *
 * @param scene - Scene the halo is added to, and whose idle animator scopes its tweens.
 * @param canvas - Canvas whose pointer activity decides when the halo hides.
 * @param target - The object the halo hangs above; measured, never moved.
 * @returns A handle whose `dispose` removes the halo and its listeners.
 */
export function createTapInvitation(scene: Scene, canvas: HTMLCanvasElement, target: Object3D): TapInvitation {
  target.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(target);
  if (bounds.isEmpty()) {
    return { dispose: () => {} };
  }
  const size = bounds.getSize(new Vector3());
  const diameter = Math.min(MAX_DIAMETER, Math.max(MIN_DIAMETER, Math.min(size.x, size.z) * DIAMETER_RATIO));

  const material = new SpriteMaterial({
    map: ringTexture(),
    // Warm white — barely tinted. This is the measured winner, not the pretty
    // one; see PEAK_OPACITY for the table, and for the amber that lost to the
    // cream it was meant to improve on. The small amount of warmth left is what
    // keeps it belonging to a lamplit house rather than looking like a cursor.
    color: new Color(1, 0.95, 0.78),
    transparent: true,
    opacity: 0,
    // NOT additive. The fireflies hint can be, because it glows against a night
    // sky; these rooms are lit and pale, and additive cream on a beige wall is
    // invisible. Normal blending with a warm tint reads on every surface in the
    // house. `depthWrite` stays off so the halo never carves a hole in what is
    // behind it, but `depthTest` stays ON so a nearer prop can occlude it.
    blending: NormalBlending,
    depthWrite: false,
  });

  const sprite = new Sprite(material);
  sprite.name = `tapInvitation_${target.name || 'target'}`;
  sprite.scale.setScalar(diameter);
  sprite.position.set((bounds.min.x + bounds.max.x) / 2, bounds.max.y + GAP_Y + diameter / 2, (bounds.min.z + bounds.max.z) / 2);
  // The halo hangs over the very thing it is asking to be tapped. Without this
  // it would eat the tap it exists to invite.
  sprite.raycast = () => {};
  sprite.renderOrder = 2;
  scene.add(sprite);

  // `breath` yoyos forever and `presence` is tweened by the show/hide rule; the
  // breath's own onUpdate applies both, so nothing here needs a frame loop of
  // its own. Registering the tween with the scene's idle animator is what makes
  // it die with the scene — a raw `repeat: -1` gsap tween would outlive the room
  // and keep animating a detached sprite. See utils/idle/idleAnimator.
  // TWO OBJECTS, NOT ONE, and the reason is a bug that shipped invisible halos.
  // These were fields of a single `wave` object, and the show/hide tween used
  // `overwrite: true` to cancel a fade already in flight. `overwrite: true` kills
  // every other tween of the SAME TARGET — which was the breathing tween, the
  // one whose `onUpdate` is the only thing that ever writes to the material. The
  // first fade-in silently killed the renderer of the effect and no halo was
  // ever drawn in any room. Separate targets keep `overwrite` pointed at the
  // thing it is meant to overwrite.
  const breath = { t: 0 };
  const presence = { v: 0 };
  const animator = getIdleAnimator(scene);
  const breathing = gsap.to(breath, {
    t: 1,
    duration: BREATH_PERIOD / 2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      sprite.scale.setScalar(diameter * (1 + BREATH_SCALE * breath.t));
      material.opacity = PEAK_OPACITY * presence.v * (1 - BREATH_DEPTH + BREATH_DEPTH * breath.t);
      sprite.visible = material.opacity > 0.002;
    },
  });
  animator.register(breathing);

  // THE WAITS ARE GSAP DELAYS, NOT `setTimeout`, and that is not a style choice.
  // A bare `setTimeout` is a handle on Node's event loop, and six suites here
  // build these rooms headlessly and deliberately do NOT tear some of them down
  // (`room-opening-framing` keeps the scene alive to rasterise it). Two pending
  // timers per toybox meant `node --test` finished its assertions and then sat
  // there forever with nothing left to do. Every other repeating thing in these
  // scenes goes through GSAP precisely so the suites' `gsap.ticker.sleep()` can
  // stop the world, and these belong in the same place.
  let pending: gsap.core.Tween | null = null;
  const showAfter = (seconds: number): void => {
    pending?.kill();
    pending = gsap.delayedCall(seconds, () => {
      gsap.to(presence, { v: 1, duration: FADE, ease: 'sine.out', overwrite: true });
    });
    animator.register(pending);
  };
  const onPointerDown = (): void => {
    gsap.to(presence, { v: 0, duration: FADE, ease: 'sine.in', overwrite: true });
    showAfter(IDLE_RETURN);
  };

  showAfter(APPEAR_DELAY);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    dispose(): void {
      pending?.kill();
      canvas.removeEventListener('pointerdown', onPointerDown);
      breathing.kill();
      gsap.killTweensOf(breath);
      gsap.killTweensOf(presence);
      sprite.removeFromParent();
      material.dispose();
    },
  };
}

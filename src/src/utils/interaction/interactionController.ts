/**
 * InteractionController — one tappable-object registry per surface.
 *
 * See architecture-standards.md#interactioncontroller. Subsumes the five ways a
 * thing was made tappable (`createWorldTapDispatcher`, `createInputDispatcher`,
 * `createTapInteraction`, `wireToyboxInteractions`, the room `userData.onClick`
 * scan) behind one `register(obj, handler)` API, and — crucially — makes the two
 * child-UX rules apply everywhere:
 *
 * - **Smear-tap forgiveness** and **proximity fallback** come from the shared
 *   pure {@link classifyGesture} / {@link nearestPointWithin} in `gestureRules`.
 * - **No dead tap**: if a fired handler emits no audio, the controller answers
 *   the tap itself — with the same cue AND the same sparkle a tap on empty space
 *   gets — so the "every tap acknowledges" rule no longer has to be remembered
 *   at every call site, and no tap is ever answered with less than empty space.
 *
 * One canvas listener, one raycast per gesture, gesture state reset on
 * `pointercancel` (iPadOS system gestures). Torn down via the DisposalScope.
 */

import { Raycaster, Vector2, Vector3, type Object3D, type Camera, type Ray } from 'three';
import type { DisposalScope } from '@app/utils/disposal';
import { classifyGesture, nearestPointWithin, PROXIMITY_PX, type ScreenPoint } from './gestureRules';

/**
 * `userData` key mirroring {@link TapOptions.background} onto a registered
 * object, so the scene graph is inspectable without reaching into the registry.
 */
export const TAP_BACKGROUND_KEY = 'tapBackground';

/** What a fired tap handler receives. */
export interface TapHit {
  /** The registered object that was tapped (or matched by proximity). */
  object: Object3D;
  /** World-space hit point, or null when matched by the proximity fallback. */
  point: Vector3 | null;
}

/** Per-registration options. */
export interface TapOptions {
  /**
   * The target participates in dragging, so a gesture past the drag threshold is
   * a drag, not a forgiven wobble-tap. Defaults to false.
   */
  supportsDrag?: boolean;
  /**
   * The handler intentionally makes no sound (e.g. a silent reveal), so the
   * no-dead-tap fallback should be suppressed for it. Defaults to false.
   */
  silent?: boolean;
  /**
   * An environment-scale surface — the ground, a stream — that is tappable but
   * must never take a tap a small target could plausibly have been meant to
   * receive. Defaults to false.
   *
   * WHY THIS EXISTS. `pickRegistered` runs first and returns on any hit, so a
   * registered target that spans the whole frame silently disables the
   * small-target forgiveness below it: a tap aimed at a mushroom and landing a
   * finger-width off never "misses every mesh", it hits the FLOOR, and
   * `pickByProximity` — the rule `gestureRules` documents as a core child-UX
   * guarantee — is never consulted. Measured in Nature before this flag existed:
   * the ground took 52-62% of the canvas at every shipping viewport, a flower's
   * whole catchment was its own 36 px^2 silhouette, and a steady-handed child
   * reaching for one hit it 2% of the time. Two leaves staged in the stream were
   * literally untappable, because the transparent water plane above them is
   * registered and the raycast does not care about transparency.
   *
   * The flag does not make the surface less tappable — open ground still fires
   * the owl. It only moves it to the back of the queue, so it wins a tap that
   * nothing smaller wanted.
   */
  background?: boolean;
}

/** Audio hooks that let the controller enforce the no-dead-tap rule. */
export interface InteractionAudio {
  /** A monotonic count of sound-effects played so far (to detect handler audio). */
  soundCount(): number;
  /** Plays the shared tap-acknowledgement fallback sound. */
  playFallback(): void;
}

/** A per-surface tappable-object controller. */
export interface InteractionController {
  /**
   * Registers an object as tappable.
   *
   * @param obj - The object (or an ancestor of hit meshes) to fire for.
   * @param handler - Called with the {@link TapHit} on a tap.
   * @param opts - Optional per-registration behaviour.
   * @returns An unregister function.
   */
  register(obj: Object3D, handler: (hit: TapHit) => void, opts?: TapOptions): () => void;
  /** Overrides the proximity fallback radius (px). */
  setProximityRadiusPx(px: number): void;
  /**
   * Sets the visual half of the shared tap acknowledgement — see
   * {@link acknowledgeTap}, which is what this handler is called from.
   *
   * soul.md#6 makes this a contract, not an optimisation: "Every tap — whether
   * it lands on a designated interaction or on empty space — must produce a
   * response." The controller supplies the sound half itself; this is how a
   * surface adds the visual half, which is the half that still works on a muted
   * device. Receives the camera ray through the tap so the scene can place the
   * acknowledgement at whatever depth suits it.
   *
   * The setter keeps the name it was wired under, but the handler now answers
   * two cases, not one: a tap that matched nothing at all, and a tap that
   * matched a prop whose handler made no sound. A surface that installs this is
   * covered for both; a surface that does not is left exactly where it was.
   */
  setMissHandler(fn: ((ray: Ray) => void) | null): void;
  /** Pauses or resumes tap delivery. */
  setPaused(paused: boolean): void;
}

interface Entry {
  handler: (hit: TapHit) => void;
  opts: TapOptions;
}

/**
 * Creates an interaction controller bound to a canvas + camera, torn down by the
 * scope.
 *
 * @param canvas - The canvas to listen on.
 * @param camera - The camera used for raycasting and screen projection.
 * @param scope - Disposal scope that removes the listeners on teardown.
 * @param audio - Optional audio hooks enabling the no-dead-tap fallback.
 * @returns An {@link InteractionController}.
 */
export function createInteractionController(canvas: HTMLCanvasElement, camera: Camera, scope: DisposalScope, audio?: InteractionAudio): InteractionController {
  const registry = new Map<Object3D, Entry>();
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const worldPos = new Vector3();
  const projected = new Vector3();

  let paused = false;
  let isDown = false;
  let lastX = 0;
  let lastY = 0;
  let totalDistance = 0;
  let proximityRadius = PROXIMITY_PX;
  let missHandler: ((ray: Ray) => void) | null = null;

  /**
   * Fires an entry's handler and enforces the no-dead-tap rule.
   *
   * AN UNANSWERED HIT USED TO BE ANSWERED WITH LESS THAN A MISS. This function's
   * "handler made no sound" branch called `audio.playFallback()` and stopped
   * there, while {@link acknowledgeTap}'s other caller — a tap that matched
   * nothing at all — got the same cue AND a `sceneSparkle` from the scene's
   * acknowledgement handler. So the two outcomes were not symmetric in the
   * direction anyone would guess: FINDING a prop that had nothing left to give
   * produced strictly less than touching the wall behind it. On a muted device,
   * which the Sound World clause names as the case that must still be "fully
   * playable and emotionally complete", it produced *nothing at all*.
   *
   * That is not hypothetical and it is not rare. Measured through the canvas in
   * `.probe/render/r2-second-tap.mjs`, four Playroom targets answered an
   * immediate second tap this way — `lampBase`, `webSlinger`, `floor`, and both
   * toy cars before their own repair — because each guards its handler with a
   * latch and returns early while the latch is held. A child taps a thing twice;
   * that is what a child does.
   *
   * THE FIX IS THE CHOKE POINT, NOT THE PROPS. Patching props one at a time is
   * what let this survive a round of review: `prop-reaction-channels.contract
   * .test.mjs` asserts every reaction body mentions a `PARTICLES.*` preset, and
   * every one of the four above passes that assertion — the emit is simply
   * downstream of a `return`. A source-text pin cannot tell whether a body
   * REACHES the line it contains. Answering here covers every prop, including
   * the ones nobody has thought to look at yet.
   *
   * The floor this raises is a floor, not a delight: a prop that has more to
   * give should still give it (see the toy cars' `bounce()`). What this
   * guarantees is only that no tap is ever answered with less than empty space.
   *
   * @param obj - The registered object that was tapped.
   * @param entry - Its registry entry.
   * @param point - World hit point, or null for a proximity match.
   * @param clientX - Pointer client X, so the acknowledgement lands under the finger.
   * @param clientY - Pointer client Y.
   */
  function fire(obj: Object3D, entry: Entry, point: Vector3 | null, clientX: number, clientY: number): void {
    const before = audio && !entry.opts.silent ? audio.soundCount() : 0;
    entry.handler({ object: obj, point });
    if (audio && !entry.opts.silent && audio.soundCount() === before) {
      acknowledgeTap(clientX, clientY);
    }
  }

  /** One resolved raycast match. */
  interface Pick {
    obj: Object3D;
    entry: Entry;
    point: Vector3;
  }

  /**
   * Raycasts the registry at a screen point, keeping the nearest ordinary match
   * and the nearest background match separately.
   *
   * Splitting them is what un-drowns a small prop that sits under an
   * environment-scale surface. Two leaves in the Nature stream are staged at
   * y = 0.02 beneath a transparent water plane at y = 0.038; the plane is
   * registered and the raycast does not care about transparency, so taking
   * `intersects[0]` gave the water every single time and both leaves measured
   * ZERO tappable pixels at every shipping viewport. Reading past the background
   * surface returns the thing the child can actually see themselves aiming at.
   *
   * @param clientX - Pointer client X.
   * @param clientY - Pointer client Y.
   * @returns The nearest foreground and background matches (either may be null).
   */
  function pickRegistered(clientX: number, clientY: number): { fg: Pick | null; bg: Pick | null } {
    if (registry.size === 0) return { fg: null, bg: null };
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const intersects = raycaster.intersectObjects([...registry.keys()], true);
    let fg: Pick | null = null;
    let bg: Pick | null = null;
    for (const intersect of intersects) {
      // Walk ancestry of this hit to the registered object that owns it.
      let obj: Object3D | null = intersect.object;
      while (obj) {
        const entry = registry.get(obj);
        if (entry) {
          if (entry.opts.background) {
            bg ??= { obj, entry, point: intersect.point };
          } else {
            fg = { obj, entry, point: intersect.point };
          }
          break;
        }
        obj = obj.parent;
      }
      if (fg) break;
    }
    return { fg, bg };
  }

  /**
   * Screen-space proximity fallback: nearest registered target within the radius.
   *
   * @param clientX - Pointer client X.
   * @param clientY - Pointer client Y.
   * @returns The nearest object + entry within the radius, or null.
   */
  function pickByProximity(clientX: number, clientY: number): { obj: Object3D; entry: Entry } | null {
    if (registry.size === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const tapX = clientX - rect.left;
    const tapY = clientY - rect.top;
    const objs: Object3D[] = [];
    const points: ScreenPoint[] = [];
    for (const [obj, entry] of registry) {
      // A background surface has no meaningful "centre" to be near — the ground
      // plane's origin is the middle of the world, so leaving it in this contest
      // would let it win taps near the centre of the frame and re-create exactly
      // the problem `background` exists to solve.
      if (entry.opts.background) continue;
      obj.getWorldPosition(worldPos);
      projected.copy(worldPos).project(camera);
      // Behind the camera → skip.
      if (projected.z > 1) continue;
      objs.push(obj);
      points.push({ x: ((projected.x + 1) / 2) * rect.width, y: ((1 - projected.y) / 2) * rect.height });
    }
    const idx = nearestPointWithin(tapX, tapY, points, proximityRadius);
    if (idx < 0) return null;
    const obj = objs[idx];
    return { obj, entry: registry.get(obj)! };
  }

  function onPointerDown(e: PointerEvent): void {
    if (paused) return;
    isDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    totalDistance = 0;
  }

  function onPointerMove(e: PointerEvent): void {
    if (paused || !isDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    totalDistance += Math.hypot(dx, dy);
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onPointerUp(e: PointerEvent): void {
    if (!isDown) return;
    isDown = false;
    if (paused) return;

    // Raycast first: if we hit a registered target, its own drag-support setting
    // decides tap-vs-drag. On a miss, treat as a non-draggable tap for wobble.
    const { fg, bg } = pickRegistered(e.clientX, e.clientY);
    const supportsDrag = (fg ?? bg)?.entry.opts.supportsDrag ?? false;
    if (classifyGesture(totalDistance, supportsDrag) !== 'tap') return;

    // The order below IS the child-UX policy, so it is written out plainly:
    //   1. a mesh the child could see themselves aiming at wins outright;
    //   2. otherwise a small target near the finger wins, because that is what
    //      the tap was for even though it landed beside the thing;
    //   3. otherwise the environment surface under the finger wins, so open
    //      ground and open water are still tappable;
    //   4. otherwise nothing was hit at all, and soul.md#6 still owes the child
    //      an answer.
    if (fg) {
      fire(fg.obj, fg.entry, fg.point, e.clientX, e.clientY);
      return;
    }
    const near = pickByProximity(e.clientX, e.clientY);
    if (near) {
      fire(near.obj, near.entry, null, e.clientX, e.clientY);
      return;
    }
    if (bg) {
      fire(bg.obj, bg.entry, bg.point, e.clientX, e.clientY);
      return;
    }
    acknowledgeTap(e.clientX, e.clientY);
  }

  /**
   * The shared answer to a tap nothing else answered.
   *
   * TWO CALLERS, ONE ANSWER, and the name says `Tap` rather than `Miss` because
   * of the second one. The original caller is a tap that matched nothing — sky,
   * treeline, the empty margins; before it existed a fifth to a quarter of the
   * Nature canvas was inert at every shipping viewport (20.7%-25.9% measured),
   * which soul.md#6 names as the one thing that breaks the spell: "A dead tap is
   * a broken promise... Every tap — whether it lands on a designated interaction
   * or on empty space — must produce a response. A sparkle, a ripple, a soft
   * sound." The second caller is {@link fire}, for a tap that DID find a prop
   * whose handler then did nothing; the reasoning is written out there.
   *
   * WHY THE TWO GET THE SAME ANSWER RATHER THAN DIFFERENT ONES. The tempting
   * design is a distinct "you found something" cue, and it is wrong twice over.
   * First, `sfx_shared_tap_fallback` is not the miss's private cue — `uiSounds
   * .ts` calls it "a gentle acknowledgement chirp for tap-fallback feedback",
   * the generic acknowledgement, which the miss merely also uses. Second, the
   * two events are the same event as the child experiences it: in both cases
   * there was nothing more here. Inventing a distinction the fiction does not
   * contain is how "Nothing will confuse you" gets broken by a fix meant to keep
   * it.
   *
   * The ray is recomputed from the client coordinates rather than reused from
   * whatever `pickRegistered` last left in the shared `raycaster`. That is
   * deliberate: the proximity path does not touch the raycaster, so reuse would
   * work only by the accident that `pickRegistered` always runs first, and a
   * later reordering would move the sparkle somewhere silently wrong instead of
   * failing.
   *
   * @param clientX - Pointer client X.
   * @param clientY - Pointer client Y.
   */
  function acknowledgeTap(clientX: number, clientY: number): void {
    if (missHandler) {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      missHandler(raycaster.ray);
    }
    audio?.playFallback();
  }

  function onPointerCancel(): void {
    isDown = false;
    totalDistance = 0;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  scope.listener(canvas, 'pointerdown', onPointerDown as EventListener);
  scope.listener(canvas, 'pointermove', onPointerMove as EventListener);
  scope.listener(canvas, 'pointerup', onPointerUp as EventListener);
  scope.listener(canvas, 'pointercancel', onPointerCancel as EventListener);
  scope.add(() => registry.clear());

  return {
    register(obj, handler, opts): () => void {
      registry.set(obj, { handler, opts: opts ?? {} });
      // Mirror the flag onto the object so the scene graph tells the whole
      // truth about what is tappable and how. The registry is private, which is
      // right, but it meant the single most consequential property of a
      // registration was invisible to every tool that inspects the graph —
      // tests, probes, the debug traversals — and a review spent four iterations
      // measuring a rule the controller does not apply because of it. One
      // documented key is a cheap price for making the graph self-describing.
      obj.userData[TAP_BACKGROUND_KEY] = opts?.background === true;
      return () => {
        registry.delete(obj);
        delete obj.userData[TAP_BACKGROUND_KEY];
      };
    },
    setProximityRadiusPx(px: number): void {
      proximityRadius = px;
    },
    setMissHandler(fn): void {
      missHandler = fn;
    },
    setPaused(p: boolean): void {
      paused = p;
      if (p) {
        isDown = false;
        totalDistance = 0;
      }
    },
  };
}

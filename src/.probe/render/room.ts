/**
 * Headless render harness for the HOUSE ROOMS -- Playroom, Living Room, Kitchen --
 * with the outdoor Nature scene mountable through the same code as a CONTROL.
 *
 * WHY THIS ONE IS PARAMETERISED WHEN `nature.ts` REFUSED TO BE
 * ------------------------------------------------------------
 * `nature.ts` opens by saying it is "deliberately a sibling of `shot.ts` rather
 * than a generalisation of it", because one harness quietly doing the wrong thing
 * for one of two dissimilar scenes is how Round 4 lost its budget. That warning
 * is about scenes with different props, different targets and different ways of
 * being wrong. It does not apply here, and the opposite warning does. The same
 * two harnesses later note, twice, that "a comparative charge measured by two
 * different instruments is not a comparison" -- and the charge this harness
 * exists to test is comparative by construction: three rooms and one outdoor
 * scene run through the SAME `interactionController`, and the claim is that one
 * of the two factories that wrap it installs a visual answer to a missed tap and
 * the other does not. Measuring the rooms with a new instrument and quoting
 * Nature's number from a probe written months earlier would prove nothing.
 *
 * So the scene id is a query parameter, every scene is mounted by its own real
 * `createScene`, and the four differ in nothing this file does to them.
 *
 * THE PARTICLE ENGINE IS REGISTERED HERE, AND THAT IS LOAD-BEARING
 * ---------------------------------------------------------------
 * `getParticleEngine(scene)` returns a NO-OP engine, with a console warning, for
 * any scene that never called `setSceneParticleEngine`. `nature.ts` never calls
 * it -- which is exactly why `nature-ack.mjs` had to use a SOUND counter as its
 * observable and could not ask about sparkles at all. A probe measuring "was
 * there a visible acknowledgement" on a harness with a no-op particle engine
 * would report zero everywhere, in the control as well as the subject, and would
 * therefore manufacture the very finding it was built to test. This harness
 * mirrors `SceneFrame`'s setup order instead: clock, disposal scope, particle
 * engine, idle animator, scene runtime, and only then `createScene`.
 */
import gsap from 'gsap';
import { Box3, Object3D, Raycaster, Scene, Sphere, Vector2, Vector3 } from 'three';
import { createConfiguredRenderer, applyDefaultEnvironment } from '@app/utils/rendererFactory';
import { createFrameClock } from '@app/utils/frameClock';
import { createDisposalScope } from '@app/utils/disposal';
import { setSceneParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { setSceneIdleAnimator } from '@app/utils/idle/registry';
import { setSceneRuntime } from '@app/utils/sceneRuntime';
import { soundsRequested, registerSoundHandler, unregisterSoundHandler } from '@app/assets/audio/sceneBridge';
import { createMissAcknowledgement } from '@app/utils/interaction/missAcknowledgement';
import type { NavigationActions } from '@app/types/scenes';
import type { CameraHandle } from '@app/utils/cameraPresets';

type SceneModule = { createScene: (scene: Scene, canvas: HTMLCanvasElement, nav: NavigationActions) => { cameraHandle: CameraHandle; dispose: () => void } };

/**
 * The mountable scenes, each by its own shipped entry point.
 *
 * `nature` is present as a CONTROL, not as a subject. It is the scene whose
 * measured 20.7%-25.9% inert canvas is quoted in `interactionController.ts` as
 * the reason the miss acknowledgement was built, so it is the one scene where a
 * working instrument must report no unanswered taps. If it does not, the
 * instrument is broken and the rooms' numbers mean nothing.
 *
 * `pirate-cove` WAS ADDED IN ROUND 3, AND THE HEADER ABOVE IS THE REASON, NOT AN
 * EXCEPTION TO IT. The header says this file is parameterised where `nature.ts`
 * refused to be, because "a comparative charge measured by two different
 * instruments is not a comparison". Round 3's charge is comparative inside a
 * single scene: six taps in the pirate cove reach the same `interactionController`
 * through the same `worldTapDispatcher`, four answer with a sound of their own,
 * and two answer with the cue that means "you touched nothing". Writing a second
 * harness for the cove would have made the cove's numbers unquotable beside the
 * rooms' — and worse, would have let a difference in the harness masquerade as a
 * difference in the scene. The cove is mounted by its own real `createScene`,
 * with the same signature, and this file does nothing to it that it does not do
 * to the other four.
 */
const LOADERS: Record<string, () => Promise<SceneModule>> = {
  playroom: () => import('@scenes/world/places/house/subplaces/playroom'),
  'living-room': () => import('@scenes/world/places/house/subplaces/living-room'),
  kitchen: () => import('@scenes/world/places/house/subplaces/kitchen'),
  nature: () => import('@scenes/immersive-toybox-scenes/naturescene'),
  'pirate-cove': () => import('@scenes/immersive-toybox-scenes/pirate-cove'),
};

const which = new URLSearchParams(location.search).get('room') ?? 'playroom';
const loader = LOADERS[which];
if (!loader) throw new Error(`unknown scene "${which}" -- expected one of ${Object.keys(LOADERS).join(', ')}`);

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = createConfiguredRenderer(canvas, { stencil: true });
const scene = new Scene();
applyDefaultEnvironment(renderer, scene);

/**
 * EVERY LEAVE-THE-ROOM CALL, RECORDED, BECAUSE THE ALTERNATIVE WAS INFERENCE AND
 * THE INFERENCE WOULD HAVE HIDDEN THIS ROUND'S ACTUAL FINDING.
 *
 * `__reactionScan` grades a tap by how much of the picture it changes, and some
 * registered targets are not props at all: a doorway answers a tap by swinging and
 * then changing scene, so grading its 0.4 s window against a prop's bar is
 * meaningless. The first version of the runner excluded those rows by the cheapest
 * available proxy — `emitted === 0`, "a target that asks for no burst must be a
 * navigation target."
 *
 * That proxy is this round's finding wearing a disguise. Three of the twelve room
 * handlers emit no burst either, and they emit none BECAUSE they are defective; the
 * exclusion criterion and the defect are the same predicate, so the runner would
 * have filed all three as doorways and reported a clean sweep. An instrument whose
 * blind spot is exactly the failure it exists to find reports "nothing here" with
 * perfect confidence, which is the worst thing an instrument can do.
 *
 * So navigation is identified POSITIVELY: the stub records the call. `navigateTo`
 * is reached from exactly one place a room can touch — `interactiveDoorway.ts:189`
 * — and it is reached from inside the door tween's `onComplete` at 0.45 s, which is
 * PAST the 0.4 s scan window. The flag is therefore read after the settle that
 * follows the prop pass, not after the sweep; a scan that checked it earlier would
 * see zero for every doorway and re-acquire the bug it was written to remove.
 *
 * Recording rather than acting is also what keeps the pass safe. A real
 * `navigateTo` would tear the scene down mid-scan and every later row in the room
 * would be graded against a room that is dissolving. That hazard is latent in any
 * probe that fires real handlers; the only reason it is not live here is that these
 * three functions do nothing but push a string.
 */
const navCalls: string[] = [];
const nav: NavigationActions = {
  navigateTo: (scene) => {
    navCalls.push(`navigateTo:${scene}`);
  },
  launchMiniGame: (gameId) => {
    navCalls.push(`launchMiniGame:${gameId}`);
  },
  exitMiniGame: () => {
    navCalls.push('exitMiniGame');
  },
};
(window as unknown as { __navCalls?: () => string[] }).__navCalls = () => [...navCalls];

/**
 * THE LIVE REGISTRY MAP ITSELF, captured the way `nature.ts` and `shot.ts`
 * document at length, and deliberately the same code as both.
 *
 * `captureRegistry()` below recovers the registry KEYS from a raycast; only the
 * Map itself carries the handlers, and without the handlers a probe can predict
 * arbitration but never observe it.
 */
type RegEntry = { handler: (hit: { object: Object3D; point: unknown }) => void; opts: { background?: boolean } };
let liveRegistry: Map<Object3D, RegEntry> | null = null;
const originalMapSet = Map.prototype.set;
Map.prototype.set = function (this: Map<unknown, unknown>, k: unknown, v: unknown) {
  if (!liveRegistry && k instanceof Object3D && typeof (v as RegEntry)?.handler === 'function' && typeof (v as RegEntry)?.opts === 'object') {
    liveRegistry = this as Map<Object3D, RegEntry>;
  }
  return originalMapSet.call(this, k, v) as Map<unknown, unknown>;
};

const clock = createFrameClock();
const scope = createDisposalScope();
// Same order as `SceneFrame.loadScene` -- engine before `createScene`, so any
// effect wired during the build can resolve `getParticleEngine(scene)`.
const particles = setSceneParticleEngine(scene, clock, scope);
setSceneIdleAnimator(scene, scope);
setSceneRuntime(scene, clock, scope);

/**
 * Particle emissions counted at the ENGINE, so no call site has to be trusted.
 *
 * The visible half of a miss acknowledgement is a particle burst, and the only
 * place every burst in the app passes through is the scene's own engine. Wrapping
 * `emit` here therefore observes the acknowledgement wherever it is installed
 * from -- `worldSceneFactory`'s miss handler, `wireFloorTap`'s first-tap sparkle,
 * or a prop's own reaction -- without this file knowing any of their names.
 *
 * WHAT THIS INSTRUMENT CANNOT SEE, stated plainly because a probe that hides its
 * blind spot is worse than one with none: an acknowledgement that is NOT a
 * particle emission -- a tween on an existing mesh, a material flash, a shader
 * uniform -- is invisible to this counter and would be reported as no visible
 * answer at all. Two consequences follow and both are honoured elsewhere. The
 * control run is what proves the counter can see a real acknowledgement when one
 * exists. And any fix measured through this harness must be a particle
 * acknowledgement, or the harness must be extended before it can grade it.
 */
let emitCount = 0;
/**
 * World positions of the emissions seen since {@link resetEmitPoints}.
 *
 * WHY POSITIONS AND NOT JUST A COUNT. The count above answers "was an
 * acknowledgement requested". It cannot answer "could the child see it", and in a
 * ROOM those are different questions in a way they are not outdoors. Nature's miss
 * sparkle is placed at a chosen depth along the tap ray because the sky it answers
 * has no geometry and nothing can come between the sparkle and the camera. A room
 * is a closed box whose interior is much smaller than that depth: the shell is
 * |x| <= 5.4-6.0 with a ceiling slab at y = 6.2-6.75, while the camera orbits at
 * radius 14. A point placed far along the ray can therefore land OUTSIDE the shell
 * -- above the ceiling, or beyond a side wall -- and be occluded by the very
 * surface the child tapped. It still emits. It still increments the counter. It is
 * still an invisible answer, which is the defect, not the fix.
 *
 * So the grading observable has to be geometric, and the positions are what make
 * it possible.
 */
const emitPoints: Vector3[] = [];
const originalEmit = particles.emit.bind(particles);
particles.emit = (preset, position, overrides) => {
  emitCount += 1;
  emitPoints.push(position.clone());
  originalEmit(preset, position, overrides);
};
const resetEmitPoints = (): void => {
  emitPoints.length = 0;
};

/**
 * Slack allowed between an emitted point and the nearest geometry in front of it.
 *
 * A fix that places the sparkle ON the surface the ray hit must not be scored as
 * occluded by that same surface. Any such fix has to stand the sparkle slightly
 * proud of the wall anyway or the burst renders half-buried in it, so the test
 * asks only that the nearest occluder be no nearer than this. 0.02 world units is
 * about a fiftieth of the smallest room prop and far below any pull-back a fix
 * would plausibly choose, so it forgives float error and nothing else.
 */
const OCCLUSION_TOLERANCE = 0.02;

let cameraHandle: CameraHandle;
try {
  ({ cameraHandle } = (await loader()).createScene(scene, canvas, nav));
} finally {
  Map.prototype.set = originalMapSet;
}

const draw = () => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  cameraHandle.resize(w, h);
  clock.tick(1 / 60);
  renderer.render(scene, cameraHandle.camera);
};
draw();
requestAnimationFrame(() => {
  draw();
  (window as unknown as { __shotReady?: boolean }).__shotReady = true;
});
(window as unknown as { __redraw?: () => void }).__redraw = draw;
/**
 * Advances the frame clock without rendering, for probes that need time to pass but
 * no pixels. A draw costs 2478.80 ms on this room and a tick costs 0.0133 ms, so a
 * probe that only needs the clock to move must not spend draws to move it.
 *
 * @param frames - Number of 1/60 s frames to advance.
 */
(window as unknown as { __advanceFrames?: (frames: number) => void }).__advanceFrames = (frames) => {
  for (let i = 0; i < frames; i += 1) clock.tick(1 / 60);
};
(window as unknown as { __sceneName?: () => string }).__sceneName = () => which;

/**
 * THE TAP REGISTRY, TAKEN OUT OF THE LIVE CONTROLLER RATHER THAN GUESSED.
 *
 * Same code and same reasoning as `nature.ts`: patch
 * `Raycaster.prototype.intersectObjects` to record its argument and throw, fire
 * one synthetic tap, restore. The throw unwinds `onPointerUp` before `fire()`, so
 * nothing in the scene moves. The sentinel is swallowed by a capture-phase error
 * listener installed for the duration.
 *
 * A room adds a failure mode Nature does not have. Playroom registers its props
 * through `roomSceneFactory`'s `registerUserDataClickTargets`, a one-shot
 * `scene.traverse` for `userData.onClick` that runs AFTER `buildContents`. So the
 * registry is complete only for objects that existed at build time, and a probe
 * that captured it earlier would under-report what is tappable. Capturing lazily,
 * on first use, after the page has settled, is what avoids that.
 */
const occluderCaster = new Raycaster();
const occluderOrigin = new Vector3();
const occluderDir = new Vector3();

/**
 * Is a world point actually visible from the camera, or is opaque scene geometry
 * in front of it?
 *
 * Cast from the camera toward the point and stop short of it. Anything found is
 * between the child's eye and the acknowledgement.
 *
 * ONLY MESHES COUNT AS OCCLUDERS. An earlier revision of this comment justified
 * that as a correctness requirement, on the grounds that the engine adds each
 * preset to the scene as a `Points` batch and `Raycaster` intersects `Points`
 * against a default one-unit threshold, so a sample's own sparkles would be
 * returned as occluders of themselves. THAT JUSTIFICATION IS FALSE and the source
 * says so: `utils/particles/engine.ts` sets `points.raycast = () => {}` on every
 * batch it creates, with the comment "never intercept gameplay picks". Particle
 * batches are already inert to every raycaster in the process, this one included.
 * The filter is retained because `Sprite` and `Line` renderables do intersect and
 * neither can hide a burst, and because it makes the blame list read in terms of
 * surfaces a child could point at -- but it changes no number here, and a probe
 * that claims a mechanism it has not checked is worth less than the measurement
 * it protects.
 *
 * A TRANSPARENT MESH IS NOT AN OCCLUDER, and finding that out cost this round a
 * whole iteration. The first version of this test counted any visible `Mesh`, and
 * the Nature CONTROL -- an open outdoor scene whose acknowledgement is the shipped
 * one -- came back 11.6% hidden at landscape, which is not credible for a scene
 * with no ceiling and no side walls. `interactionController.ts` documents why: the
 * Nature stream is a transparent water plane at y = 0.038, and the controller's own
 * comment notes "the raycast does not care about transparency". You can see a
 * sparkle through water. So an occluder must be opaque as well as present, and the
 * verdict now names the mesh it blames so a false positive is visible as one rather
 * than arriving as a finding.
 *
 * @param point - World-space point to test.
 * @returns The blocking mesh's name and opacity, or null when the point is visible.
 */
const occlusionOf = (point: Vector3): { name: string; opaque: boolean } | null => {
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  cam.getWorldPosition(occluderOrigin);
  occluderDir.copy(point).sub(occluderOrigin);
  const distance = occluderDir.length();
  if (distance <= OCCLUSION_TOLERANCE) return null;
  occluderDir.divideScalar(distance);
  occluderCaster.set(occluderOrigin, occluderDir);
  occluderCaster.near = 0;
  occluderCaster.far = distance - OCCLUSION_TOLERANCE;
  for (const hit of occluderCaster.intersectObjects(scene.children, true)) {
    if (hit.object.type !== 'Mesh' || !hit.object.visible) continue;
    const material = (hit.object as { material?: unknown }).material;
    const first = Array.isArray(material) ? material[0] : material;
    const m = first as { transparent?: boolean; opacity?: number } | undefined;
    const opaque = m?.transparent !== true || (m?.opacity ?? 1) >= 0.95;
    if (!opaque) continue;
    let named: Object3D | null = hit.object;
    let name = '';
    while (named && !name) {
      if (named.name) name = named.name;
      named = named.parent;
    }
    return { name: name || `(unnamed ${hit.object.type})`, opaque };
  }
  return null;
};

/**
 * Boolean form of {@link occlusionOf}, for the premise self-test.
 *
 * @param point - World-space point to test.
 * @returns True when an opaque mesh sits between the camera and the point.
 */
const isHiddenFromCamera = (point: Vector3): boolean => occlusionOf(point) !== null;

/**
 * Radius of the sampled sparkle CORE, in world units.
 *
 * Testing the emission origin alone is not enough to grade a fix, and admitting
 * that is what this constant is for. Any fix that offsets the burst off the
 * surface by an epsilon makes the origin visible and would score perfect on an
 * origin-only test while the burst itself stayed inside the wall. So the shape of
 * the burst has to be sampled, and its size has to come from the preset rather
 * than from taste: `SCENE_SPARKLE` is `speed: [1, 2.5]`, `lifetime: [0.3, 0.8]`,
 * `cone: [0, 0.82]` about +Y. Median speed 1.75 u/s over median lifetime 0.55 s
 * is 0.96 units of travel, so half of the median travel -- where the burst still
 * has most of its brightness -- is 0.48. Rounded to 0.5.
 */
const CORE_RADIUS = 0.5;

/**
 * Offsets sampled around an emission point, as multiples of {@link CORE_RADIUS}.
 *
 * Straight up the cone axis plus eight azimuths on the cone's outer edge
 * (phiMax = 0.82 rad), which is where the preset actually throws particles.
 */
const CORE_OFFSETS: Vector3[] = (() => {
  const phi = 0.82;
  const offsets = [new Vector3(0, 1, 0)];
  for (let i = 0; i < 8; i += 1) {
    const theta = (i / 8) * Math.PI * 2;
    offsets.push(new Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)));
  }
  return offsets;
})();

const coreSample = new Vector3();

/**
 * How much of a burst's core is visible from the camera.
 *
 * @param point - The emission origin.
 * @returns Visible and total sample counts, origin included.
 */
const coreVisibility = (point: Vector3): { seen: number; total: number } => {
  let seen = occlusionOf(point) === null ? 1 : 0;
  for (const offset of CORE_OFFSETS) {
    coreSample.copy(point).addScaledVector(offset, CORE_RADIUS);
    if (occlusionOf(coreSample) === null) seen += 1;
  }
  return { seen, total: CORE_OFFSETS.length + 1 };
};

const REGISTRY_SENTINEL = { probeAbort: true };
let tapRegistry: Object3D[] | null = null;
const captureRegistry = (): Object3D[] => {
  if (tapRegistry) return tapRegistry;
  const proto = Raycaster.prototype as unknown as { intersectObjects: unknown };
  const original = proto.intersectObjects;
  let seen: Object3D[] | null = null;
  proto.intersectObjects = function (objects: Object3D[]) {
    seen = objects;
    throw REGISTRY_SENTINEL;
  };
  const swallow = (e: ErrorEvent): void => {
    if (e.error === REGISTRY_SENTINEL) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('error', swallow, true);
  const at: PointerEventInit = { clientX: 1, clientY: 1, bubbles: true, pointerId: 1 };
  canvas.dispatchEvent(new PointerEvent('pointerdown', at));
  canvas.dispatchEvent(new PointerEvent('pointerup', at));
  window.removeEventListener('error', swallow, true);
  proto.intersectObjects = original;
  tapRegistry = seen ?? [];
  return tapRegistry;
};

/**
 * DOES A MISSED TAP GET A VISIBLE ANSWER? -- ASKED BY TAPPING, NOT BY READING.
 *
 * This is the whole instrument. It dispatches REAL pointer events over a grid
 * covering the canvas, lets the shipped `onPointerUp` run to completion, and
 * records three things per sample:
 *
 *   fired   the registry index whose handler ran, or -1 when arbitration fell
 *           all the way through to `acknowledgeTap`
 *   emits   particle bursts the tap produced, counted at the engine
 *   sounds  sound requests the tap produced, from `sceneBridge`'s own counter
 *
 * Registered handlers are swapped for recorders and restored in a `finally`, so
 * a sweep of thousands of samples does not destroy the scene as it measures it.
 * That swap is safe for the question being asked and it is worth being explicit
 * about why: arbitration completes before `fire()` is called, so nothing about
 * WHICH branch wins can depend on what the handler does; and `acknowledgeTap` is
 * not a registered handler, so the miss acknowledgement -- the thing under test --
 * still runs, still emits, and is still counted.
 *
 * The consequence is that `emits` is trustworthy on MISS samples and meaningless
 * on samples where a handler fired, because this file suppressed that handler.
 * The reader must therefore not treat `fired >= 0 && emits === 0` as a dead tap.
 * It is not measured here and no claim is made about it.
 *
 * THAT LAST PARAGRAPH GOT MORE IMPORTANT, NOT LESS, and the reason is a change to
 * the shipped controller made in Round 2. `fire()` now routes an unanswered hit
 * through the SAME `acknowledgeTap` a miss uses, so it emits a sparkle as well as
 * playing the cue. The recorder handlers this sweep installs make no sound by
 * construction, so EVERY `fired >= 0` sample now trips that branch: it will read
 * `emits >= 1, sounds >= 1` whatever the real prop would have done. Before the
 * change the artefact was confined to `sounds`; it now reaches `emits`, `hidden`,
 * `ackDist` and the two `core*` columns too. Filter to `fired === -1` before
 * reading any of them, which is what the miss-acknowledgement runners already do
 * and what any new reader of this sweep must also do. To ask what a real prop
 * answers with, use `__tapThroughCanvas`, which swaps nothing.
 *
 * FOUR MORE ARRAYS, ADDED WITHOUT DISTURBING THE THREE ABOVE:
 *
 *   hidden  of the bursts this sample emitted, how many were behind opaque mesh
 *           geometry as seen from the camera -- i.e. emitted but not visible
 *   ackDist how far the first burst was from the camera, in world units, or -1
 *   coreSeen / coreTotal visible and sampled points of the burst CORE, summed over
 *           this sample's bursts. `hidden` grades the anchor; these grade the
 *           BODY, and they exist because an anchor-only test cannot tell a fix
 *           that stands the burst clear of a wall from one that lifts it by an
 *           epsilon and leaves the sparkle inside the plaster. See
 *           {@link CORE_RADIUS}.
 *
 * These exist because `emits > 0` is the wrong bar for GRADING a fix even though
 * it is the right bar for stating the charge. The charge is that a missed room tap
 * produces no visual answer at all, and a burst count settles that. But every
 * candidate fix emits by construction, so a count cannot rank two of them, and the
 * cheapest fix available -- copying the outdoor scene's chosen sparkle depth --
 * is precisely the one whose bursts land outside a room's shell. Grading on the
 * count would score that fix perfect. Grading on visibility is what makes the
 * evaluation able to fail.
 *
 * The fields are appended rather than folded into `emits` so the run that
 * established the charge remains reproducible from the same hook.
 *
 * @param step - Sample spacing in CSS px.
 * @returns Grid dimensions and the per-sample outcome arrays.
 */
(
  window as unknown as {
    __missSweep?: (step: number) => {
      cols: number;
      rows: number;
      step: number;
      w: number;
      h: number;
      fired: number[];
      emits: number[];
      sounds: number[];
      hidden: number[];
      ackDist: number[];
      coreSeen: number[];
      coreTotal: number[];
      blockedBy: Record<string, number>;
      background: boolean[];
    };
  }
).__missSweep = (step) => {
  const reg = captureRegistry();
  if (!liveRegistry) throw new Error('registry Map was never captured -- the Map.prototype.set patch missed it');
  const keys = [...liveRegistry.keys()];
  if (keys.length !== reg.length || keys.some((k, i) => k !== reg[i])) {
    throw new Error(`captured Map (${keys.length}) does not match the raycast-recovered registry (${reg.length})`);
  }
  const index = new Map<Object3D, number>();
  reg.forEach((o, i) => index.set(o, i));
  let hitIndex = -1;
  const saved = reg.map((o) => liveRegistry!.get(o)!.handler);
  reg.forEach((o) => {
    liveRegistry!.get(o)!.handler = () => {
      hitIndex = index.get(o)!;
    };
  });

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cols = Math.floor(w / step);
  const rows = Math.floor(h / step);
  const n = cols * rows;
  const fired: number[] = new Array(n);
  const emits: number[] = new Array(n);
  const sounds: number[] = new Array(n);
  const hidden: number[] = new Array(n);
  const ackDist: number[] = new Array(n);
  const coreSeen: number[] = new Array(n);
  const coreTotal: number[] = new Array(n);
  const blockedBy: Record<string, number> = {};
  const rect = canvas.getBoundingClientRect();
  const camPos = new Vector3();
  try {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const at: PointerEventInit = { clientX: rect.left + i * step + step / 2, clientY: rect.top + j * step + step / 2, bubbles: true, pointerId: 1 };
        hitIndex = -1;
        const e0 = emitCount;
        const s0 = soundsRequested();
        resetEmitPoints();
        canvas.dispatchEvent(new PointerEvent('pointerdown', at));
        canvas.dispatchEvent(new PointerEvent('pointerup', at));
        const k = j * cols + i;
        fired[k] = hitIndex;
        emits[k] = emitCount - e0;
        sounds[k] = soundsRequested() - s0;
        // Resolved AFTER the tap, from the recorded points, so the occlusion
        // raycasts cannot perturb the arbitration they are measuring.
        let hiddenHere = 0;
        let coreSeenHere = 0;
        let coreTotalHere = 0;
        for (const p of emitPoints) {
          const core = coreVisibility(p);
          coreSeenHere += core.seen;
          coreTotalHere += core.total;
          const blocker = occlusionOf(p);
          if (!blocker) continue;
          hiddenHere += 1;
          blockedBy[blocker.name] = (blockedBy[blocker.name] ?? 0) + 1;
        }
        hidden[k] = hiddenHere;
        coreSeen[k] = coreSeenHere;
        coreTotal[k] = coreTotalHere;
        if (emitPoints.length > 0) {
          cameraHandle.camera.getWorldPosition(camPos);
          ackDist[k] = camPos.distanceTo(emitPoints[0]);
        } else {
          ackDist[k] = -1;
        }
      }
    }
  } finally {
    reg.forEach((o, i) => {
      liveRegistry!.get(o)!.handler = saved[i];
    });
  }
  return {
    cols,
    rows,
    step,
    w,
    h,
    fired,
    emits,
    sounds,
    hidden,
    ackDist,
    coreSeen,
    coreTotal,
    blockedBy,
    background: reg.map((o) => o.userData.tapBackground === true),
  };
};

/**
 * WHAT THE CHILD IS LOOKING AT, sample by sample -- independent of what taps do.
 *
 * Same hook and same code as `nature.ts`'s `__underNames`, because the value of a
 * cross-tab is that the outcome grid and the scenery grid are the same grid. A
 * band of the frame coming back unanswered is a number; the same band coming back
 * unanswered AND containing the back wall, the wainscoting and the window is an
 * argument.
 *
 * @param step - Sample spacing in CSS px. Match `__missSweep`'s to cross-tab.
 * @returns Grid dimensions and the nearest named object under each sample.
 */
(window as unknown as { __underNames?: (step: number) => { cols: number; rows: number; names: string[] } }).__underNames = (step) => {
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const rc = new Raycaster();
  const ndc = new Vector2();
  const cols = Math.floor(w / step);
  const rows = Math.floor(h / step);
  const names: string[] = new Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      ndc.x = ((i * step + step / 2) / w) * 2 - 1;
      ndc.y = -((j * step + step / 2) / h) * 2 + 1;
      rc.setFromCamera(ndc, cam);
      const hits = rc.intersectObjects(scene.children, true);
      let name = '';
      if (hits.length > 0) {
        let o: Object3D | null = hits[0].object;
        while (o && !name) {
          if (o.name) name = o.name;
          o = o.parent;
        }
        if (!name) name = `(unnamed ${hits[0].object.type})`;
      }
      names[j * cols + i] = name || '(no geometry)';
    }
  }
  return { cols, rows, names };
};

/**
 * Proof that the emit counter is wired to the engine the scene actually uses.
 *
 * A premise, not a measurement. If this returns 0 the harness is holding a
 * different engine than the scene resolves through `getParticleEngine`, and every
 * "no visible answer" row in the report is an artefact.
 *
 * @returns The emit delta produced by one direct emission through the registry lookup.
 */
/**
 * Proof that the occlusion test can tell hidden from visible AT ALL.
 *
 * A premise, not a measurement, and the one this round most needs. The whole
 * comparison between the two candidate fixes rests on `isHiddenFromCamera`, and a
 * detector that answered "visible" to everything would silently certify a fix that
 * emits every sparkle inside a wall. So: find the first mesh the centre of the
 * frame hits, then ask about a point one unit BEYOND it and a point one unit in
 * FRONT of it. The first must read hidden and the second must read visible. Both
 * points lie on the same ray through the same geometry, so nothing but the
 * detector's ordering logic distinguishes them.
 *
 * @returns The two verdicts, plus the name of the mesh used, for the runner to assert on.
 */
(window as unknown as { __occlusionProbe?: () => { beyondIsHidden: boolean; nearerIsVisible: boolean; via: string } }).__occlusionProbe = () => {
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  const rc = new Raycaster();
  rc.setFromCamera(new Vector2(0, 0), cam);
  const hit = rc.intersectObjects(scene.children, true).find((h) => h.object.type === 'Mesh' && h.object.visible);
  if (!hit) throw new Error('nothing in the centre of frame to test occlusion against');
  const dir = rc.ray.direction.clone();
  const origin = rc.ray.origin.clone();
  const beyond = origin.clone().addScaledVector(dir, hit.distance + 1);
  const nearer = origin.clone().addScaledVector(dir, Math.max(hit.distance - 1, hit.distance * 0.5));
  return { beyondIsHidden: isHiddenFromCamera(beyond), nearerIsVisible: !isHiddenFromCamera(nearer), via: hit.object.name || `(unnamed ${hit.object.type})` };
};

(window as unknown as { __emitProbe?: () => number }).__emitProbe = () => {
  const before = emitCount;
  // The app's own sparkle preset, one particle, so the check exercises the same
  // preset path the acknowledgement under test uses rather than a synthetic one.
  particles.emit(PARTICLES.sceneSparkle, new Vector3(0, 1, 0), { count: 1 });
  return emitCount - before;
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 2 ADDITIONS — GRADING THE *REWARD*, NOT THE FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The registered, non-background tap targets, with the depth each one sits at.
 *
 * Read out of the live dispatcher registry captured above, not from a list of
 * names in this file. Round 1 needed only "which index fired"; Round 2 needs to
 * fire ONE chosen target repeatedly and watch what it does, so it needs the
 * identity and the depth as well.
 *
 * `background` is reported rather than filtered because the caller's question
 * decides whether a floor is a prop. A room's floor and rug are registered with
 * `background: true` and answer a tap by flying the owl across the room, which is
 * a reaction of a completely different scale from a cushion squashing; lumping
 * them together would flatter every result.
 *
 * `depth` is distance along the VIEW AXIS, not distance from the eye —
 * architecture-standards.md#screenspace is explicit that these are different
 * numbers and that the second one is the wrong one for sizing anything.
 *
 * `ndcX`/`ndcY` are reported so the framebuffer readback can be cropped to the
 * neighbourhood of the prop instead of the whole frame. That is a pure cost
 * measure — `readPixels` on this software renderer costs 1214 ms for a 1280x720
 * buffer against 8 ms for the draw that filled it, so the readback, not the
 * rendering, is what made the first attempt at this scan a 166-minute run.
 *
 * @returns One entry per registered target, in registry order.
 */
(
  window as unknown as {
    __propTargets?: () => Array<{
      index: number;
      name: string;
      type: string;
      background: boolean;
      depth: number;
      onScreen: boolean;
      ndcX: number;
      ndcY: number;
    }>;
  }
).__propTargets = () => {
  captureRegistry();
  const registry = liveRegistry;
  if (!registry) throw new Error('no live dispatcher registry was captured, so no target can be fired by identity');
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  const axis = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
  const eye = cam.getWorldPosition(new Vector3());
  const here = new Vector3();
  const ndc = new Vector3();
  return [...registry.keys()].map((object, index) => {
    object.getWorldPosition(here);
    ndc.copy(here).project(cam);
    return {
      index,
      name: object.name || `(unnamed ${object.type})`,
      type: object.type,
      background: registry.get(object)?.opts.background === true,
      depth: here.clone().sub(eye).dot(axis),
      onScreen: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
      ndcX: ndc.x,
      ndcY: ndc.y,
    };
  });
};

/**
 * A STABLE NAME FOR "THE PROP THIS MESH BELONGS TO", USABLE FROM A PAGE SCRIPT.
 *
 * Three meshes hanging off one `driveHandler` are ONE prop, and a census that walked
 * the registry would tap that prop six times while believing it had tapped three props
 * twice — so the second tap of prop A would be scored as the first tap of prop B, and
 * a dead second tap would be reported as a healthy first one. That is not a rounding
 * error; it inverts the answer.
 *
 * The key must be `object.userData.onClick`, NOT the registry's handler:
 * `worldTapDispatcher.ts:52` registers `() => handler()`, a fresh closure per
 * registration, so registry handler identities are never equal and grouping on them
 * groups nothing. That was argued from source and published as exact before it was
 * ever run; it is pinned now in `tests/room/prop-reaction-channels.contract.test.mjs`.
 *
 * Identity cannot cross into a page script, so functions are numbered on first sight
 * and the number is returned. A target with no shared `onClick` is its own group
 * rather than being lumped with the other targets that lack one.
 *
 * @param index - Registry index from `__propTargets`.
 * @returns A string equal for two meshes iff they share a room-authored handler.
 */
const handlerKeys = new Map<unknown, number>();
(window as unknown as { __handlerKeyOf?: (index: number) => string }).__handlerKeyOf = (index) => {
  const registry = liveRegistry;
  if (!registry) throw new Error('no live dispatcher registry');
  const object = [...registry.keys()][index];
  if (!object) throw new Error(`no registered target at index ${index}`);
  const shared = (object.userData as { onClick?: unknown }).onClick;
  if (typeof shared !== 'function') return `solo:${index}`;
  let key = handlerKeys.get(shared);
  if (key === undefined) {
    key = handlerKeys.size;
    handlerKeys.set(shared, key);
  }
  return `h:${key}`;
};

/**
 * Hands gsap's clock to this probe so a tween can be observed at a chosen instant.
 *
 * Every room prop reaction is a gsap tween with `yoyo` and a short duration. Under
 * gsap's own rAF ticker the peak of a 0.09 s half-cycle falls between two frames
 * that Playwright cannot aim at, so "the biggest change this reaction makes" would
 * be sampled wherever the screenshot happened to land. Sleeping the ticker and
 * driving `updateRoot` makes the sample time an input instead of an accident.
 *
 * This is a change to the SCENE'S OWN animation clock and therefore has to be
 * undone; `__gsapWake` restores the ticker, and the runner calls it in a `finally`.
 *
 * WHY THE STEP IS RELATIVE, AND WHY IT RE-SLEEPS TWICE PER CALL.
 *
 * The obvious implementation — keep a probe-local accumulator seeded from
 * `globalTimeline.time()` at sleep, add the step, hand the sum to `updateRoot` —
 * silently produced flat transforms for some props on some page loads, which read as
 * "this reaction changes zero pixels" and nearly became a finding. Two facts make it
 * wrong, and both were measured rather than assumed:
 *
 *   1. `updateRoot`'s argument and `globalTimeline.time()` are DIFFERENT frames,
 *      offset by `globalTimeline.startTime()`, which is not zero here. Seeding an
 *      accumulator from one and feeding it to the other mixes the two.
 *   2. `gsap.ticker.sleep()` is not a latch. Creating a tween — which is exactly
 *      what a tap handler does — wakes the ticker, and the wake ticks immediately
 *      from REAL elapsed time, so the root clock jumps back to wherever wall time
 *      says it should be. Measured on the kitchen kettle: the clock read 24.237
 *      after a 3 s settle and 10.826 one statement later, on the far side of the
 *      tap. The tween the tap created was stamped with the rewound time, so the very
 *      next 0.05 s step landed 13 s past the tween's end, its `onComplete` restored
 *      the rest pose, and the prop read as motionless while animating perfectly.
 *      Whether the wake lands before or after the settle's render is a race with page
 *      load timing, which is why the same prop moved on one run and not the next.
 *
 * So the step is taken RELATIVE to wherever gsap actually is, converted into
 * `updateRoot`'s frame through `startTime()`, and the ticker is put back to sleep on
 * both sides of the render: before, to undo a wake caused by tween creation since the
 * last call, and after, because `updateRoot` wakes it too. A rewind can then still
 * happen at the moment of the tap, but it can no longer break the measurement — the
 * next step advances from the rewound clock by the same 0.05 s, and the prop pass
 * freezes the room's idles beforehand, so a paused timeline does not re-render at the
 * rewound time and the pre-tap framebuffer stays a valid baseline.
 */
(window as unknown as { __gsapSleep?: () => void }).__gsapSleep = () => {
  gsap.ticker.sleep();
};
(window as unknown as { __gsapWake?: () => void }).__gsapWake = () => {
  gsap.ticker.wake();
};
(window as unknown as { __gsapAdvance?: (seconds: number) => void }).__gsapAdvance = (seconds) => {
  gsap.ticker.sleep();
  const root = gsap.globalTimeline;
  gsap.updateRoot(root.time() + seconds + root.startTime());
  gsap.ticker.sleep();
};

/**
 * COST PROFILE FOR **THIS** ROOM. The scan's loop sizes were chosen against a cost
 * profile measured on the kitchen — `perDrawMs 8.29`, `perReadMs 1213.95` — and the
 * fence's own comment then asserted, in prose, that "the whole fence costs about two
 * seconds against a row that costs a minute". The instrumented Playroom run refuted
 * that: it printed its grouping census at +14 s and had produced no row at all seven
 * minutes later. A cost profile measured in one room is a premise about that room; a
 * loop count sized from it in another room is an unchecked assumption, which is the
 * exact species of error this review keeps punishing. So the profile is measured per
 * room, per run, before any row is graded, and printed with the rows it justifies.
 *
 * @param w - Crop width to time a readback against, in device pixels.
 * @param h - Crop height to time a readback against, in device pixels.
 * @returns Milliseconds per draw, per crop read, per full-frame read, per gsap settle
 *   and per frame-clock tick, each averaged over its own sample.
 */
(
  window as unknown as {
    __costProbe?: (
      w: number,
      h: number,
    ) => {
      perDrawMs: number;
      perSyncedDrawMs: number;
      perPumpMs: number;
      perCropReadMs: number;
      perFullReadMs: number;
      fullBefore: number;
      fullAfter: number;
      perSettleMs: number;
      perTickMs: number;
      frame: { w: number; h: number };
      sink: number;
    };
  }
).__costProbe = (w, h) => {
  const frame = { w: canvas.width, h: canvas.height };
  const timed = (n: number, fn: () => void): number => {
    const t = performance.now();
    for (let i = 0; i < n; i += 1) fn();
    return (performance.now() - t) / n;
  };
  const crop = { x: 0, y: 0, w: Math.min(w, frame.w), h: Math.min(h, frame.h) };
  const perDrawMs = timed(10, () => draw());
  // Interleaved and checksummed. The first version of this probe timed the crop reads
  // and then the full reads, and reported 4949 ms for a 240x240 crop against 10 ms for
  // the whole 1280x720 frame — an inversion big enough that the ORDER of the two
  // measurements is a live suspect and cannot be ruled out by staring at it.
  let sink = 0;
  const readOnce = (b: Box): void => {
    const g = grab(b);
    sink += g.px[0] + g.px[g.px.length - 1];
  };
  const full = { x: 0, y: 0, w: frame.w, h: frame.h };
  const fullA = timed(3, () => readOnce(full));
  const perCropReadMs = timed(3, () => readOnce(crop));
  const fullB = timed(3, () => readOnce(full));
  const perFullReadMs = (fullA + fullB) / 2;
  const perSettleMs = timed(5, () => (window as unknown as { __gsapAdvance: (s: number) => void }).__gsapAdvance(3));
  const perTickMs = timed(60, () => clock.tick(1 / 60));
  // A DRAW ON THIS RENDERER DOES NOT COST WHAT TIMING A DRAW SAYS IT COSTS.
  // `perDrawMs` above times the ENQUEUE, and SwiftShader executes later; the bill
  // arrives at the next readback, which is why a read appeared to cost seconds and a
  // draw milliseconds. Forcing a one-pixel sync after each draw moves the cost back
  // onto the line that incurs it. `perPumpMs` isolates how much of that is the
  // per-frame `setSize` + `resize` the draw does whether or not the size changed.
  const oneP = { x: 0, y: 0, w: 1, h: 1 };
  const perSyncedDrawMs = timed(3, () => {
    draw();
    readOnce(oneP);
  });
  const perPumpMs = timed(3, () => {
    clock.tick(1 / 60);
    renderer.render(scene, cameraHandle.camera);
    readOnce(oneP);
  });
  return { perDrawMs, perSyncedDrawMs, perPumpMs, perCropReadMs, perFullReadMs, fullBefore: fullA, fullAfter: fullB, perSettleMs, perTickMs, frame, sink };
};

/**
 * Runs one registered target's real handler with the particle engine muted, and
 * reports where it WOULD have emitted.
 *
 * MUTING IS THE POINT, not a convenience. The charge under test in Round 2 is that
 * a prop's reaction and the universal miss acknowledgement are the same particle
 * burst, so the burst is common to both events and can therefore carry none of the
 * difference between them. A frame containing the burst measures what the two
 * events SHARE; the difference lives entirely in the prop's own tween. Separating
 * them at the engine is the only way to attribute changed pixels to one or the
 * other, and the engine is the one place every burst in the app passes through.
 *
 * The recorded positions are returned so the sparkle can afterwards be replayed at
 * exactly the point this prop chose, rather than at a point this probe invents.
 *
 * WHAT WAS ASKED FOR IS RECORDED, NOT JUST WHERE. Bar (d) — "a hit must change at
 * least as many pixels as a miss at the same place" — turns on whether a prop's
 * burst is the same burst the miss draws. `missAcknowledgement.ts:139,158` emits
 * `PARTICLES.sceneSparkle` with NO overrides, so a prop that emits the same preset
 * with no overrides satisfies bar (d) by construction: its answer is the miss's
 * answer plus its own tween, a superset, and no measurement can make a superset
 * smaller than the set it contains. That is a deduction, and §"prefer a deduction
 * to a statistic" says to take it.
 *
 * Which leaves exactly two ways to fail bar (d), and both are readable here rather
 * than in a framebuffer: emit nothing, or emit something weaker. So the preset is
 * resolved to its `PARTICLES` key and any `EmitOverrides` count is captured — a
 * handler emitting `sceneSparkle` with `{ count: 4 }` passes a preset-identity check
 * while drawing a tenth of the miss's burst, and an instrument that recorded only
 * the preset name would call that clean.
 *
 * A LIVE UNMUTED SECOND FIRE IS NOT AVAILABLE, and it is worth writing down why,
 * because it was the first design and it would have produced false zeroes. Five room
 * handlers latch on a boolean their first invocation sets — `floorToys/toyCar.ts:201`
 * and `bookshelf-items/toyCar.ts:101` on `driving`, `floorToys/webSlinger.ts:125` on
 * `hopping`, `bookshelf-items/deskLamp.ts:84` on `shining`, and
 * `shared/interactiveDoorway.ts:176` on `pendingNav`, three of which hold the latch
 * for seconds or until a scene change. The muted fire trips the latch, so a second
 * fire in the same page
 * load returns immediately and the "live" pass would measure a handler that
 * declined to run — reporting zero changed pixels for a prop that answers perfectly,
 * which is precisely the false zero the gsap-clock defect already produced once this
 * round. One page load per prop would avoid it and costs 8.4 s per row. The
 * deduction above costs nothing and is stronger, so the live pass was abandoned.
 *
 * @param index - Registry index from `__propTargets`.
 * @returns One record per emit the muted handler attempted.
 */
const PRESET_KEYS: ReadonlyMap<unknown, string> = new Map(Object.entries(PARTICLES).map(([key, preset]) => [preset as unknown, key]));

(
  window as unknown as {
    __firePropMuted?: (index: number) => Array<{ at: [number, number, number]; preset: string; count: number | null; tinted: boolean }>;
  }
).__firePropMuted = (index) => {
  const registry = liveRegistry;
  if (!registry) throw new Error('no live dispatcher registry');
  const entry = [...registry.entries()][index];
  if (!entry) throw new Error(`no registered target at index ${index}`);
  const [object, { handler }] = entry;
  const asked: Array<{ at: [number, number, number]; preset: string; count: number | null; tinted: boolean }> = [];
  const saved = particles.emit;
  particles.emit = (preset, position, overrides) => {
    asked.push({
      at: [position.x, position.y, position.z],
      // An unrecognised preset is named, not silently coerced to a known one: a
      // room emitting a locally-authored preset is a real possibility and it must
      // read as "not the miss's burst" rather than as a missing lookup.
      preset: PRESET_KEYS.get(preset as unknown) ?? 'unregistered',
      count: overrides?.count ?? null,
      tinted: (overrides?.colors?.length ?? 0) > 0,
    });
  };
  try {
    handler({ object, point: object.getWorldPosition(new Vector3()) });
  } finally {
    particles.emit = saved;
  }
  return asked;
};

/**
 * WATCHES THE ENGINE ACROSS A STRETCH OF TIME RATHER THAN ACROSS ONE CALL.
 *
 * `__firePropMuted` brackets a single handler invocation, which makes it blind to
 * every effect a room produces WITHOUT being tapped — and the Playroom produces
 * several, because both toy cars end their builders with a fifteen-second
 * `gsap.delayedCall` that taps them on the child's behalf. An instrument that can
 * only see emits it asked for cannot tell "the autoplay never ran" from "the autoplay
 * ran and left the handler willing", and those two answers demand opposite fixes.
 *
 * The patch is installed until `stop()` and returns preset KEYS, so an autoplay's
 * burst is distinguishable from a tap's rather than merely countable.
 *
 * @returns A handle whose `stop()` restores the engine and returns what it saw.
 */
(
  window as unknown as {
    __watchEmits?: () => { stop: () => string[] };
  }
).__watchEmits = () => {
  const seen: string[] = [];
  const saved = particles.emit;
  particles.emit = (preset, _position, _overrides) => {
    seen.push(PRESET_KEYS.get(preset as unknown) ?? 'unregistered');
  };
  return {
    stop: () => {
      particles.emit = saved;
      return seen;
    },
  };
};

/**
 * WHAT A CHILD ACTUALLY HEARS WHEN THEY TAP, INCLUDING THE CUE NO PROP ASKS FOR.
 *
 * `__firePropMuted` calls the registry's handler directly, and that makes it
 * STRUCTURALLY BLIND to the cue this round is about. `interactionController.ts:147`
 * reads `soundsRequested()` before the handler and again after, and plays
 * `sfx_shared_tap_fallback` — the miss's own cue — when the handler asked for
 * nothing. Nobody's handler contains that string, so no amount of reading prop source
 * can find it; it is emitted BY THE CONTROLLER, on behalf of a prop that stayed
 * silent. Round 2's charge was about exactly that cue and this instrument had never
 * once observed it.
 *
 * So this taps through the canvas: a real `pointerdown`/`pointerup` pair at the
 * prop's projected screen position, through the same raycast a child's finger goes
 * through, with a sound handler registered to record every cue that results. The
 * alternative — re-deriving the fallback's condition from `soundsRequested()` inside
 * the probe — would be the probe restating the behaviour it exists to check, and
 * would agree with the source by construction whether or not the shipped code did.
 *
 * `pointermove` is deliberately omitted between down and up. The controller treats
 * movement past a threshold as a drag rather than a tap, and a probe that jittered
 * the pointer would measure the drag path instead of the tap path.
 *
 * @param ndcX - Prop centre, normalised device X, from `__propTargets`.
 * @param ndcY - Prop centre, normalised device Y.
 * @returns Every sound id triggered, in order, and every burst emitted.
 */
(
  window as unknown as {
    __tapThroughCanvas?: (ndcX: number, ndcY: number) => { sounds: string[]; emits: string[] };
  }
).__tapThroughCanvas = (ndcX, ndcY) => {
  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + ((ndcX + 1) / 2) * rect.width;
  const clientY = rect.top + ((1 - ndcY) / 2) * rect.height;
  const sounds: string[] = [];
  const emits: string[] = [];
  const savedEmit = particles.emit;
  particles.emit = (preset, _position, _overrides) => {
    emits.push(PRESET_KEYS.get(preset as unknown) ?? 'unregistered');
  };
  registerSoundHandler((id: string) => {
    sounds.push(id);
  });
  const opts = { clientX, clientY, pointerId: 1, isPrimary: true, bubbles: true, button: 0 };
  try {
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
    canvas.dispatchEvent(new PointerEvent('pointerup', opts));
  } finally {
    unregisterSoundHandler();
    particles.emit = savedEmit;
  }
  return { sounds, emits };
};

/**
 * The shipped miss acknowledgement, constructed exactly as `SceneFrame` constructs it.
 *
 * Bar (d) compares a hit's answer against A MISS AT THE SAME PLACE, so the reference
 * burst has to BE the miss, not a burst the probe places where it guesses the miss
 * would go. The earlier version guessed, and guessed wrong in the one direction that
 * matters: it emitted at the prop's own `getWorldPosition`, which is INSIDE the prop's
 * geometry, where the depth test buries it. Measured on the kitchen at 1280x720, that
 * put `sparkleHigh` at 0 on both doorway rows — so any prop whose own reaction was
 * absent would have divided by zero and been graded `Infinity`, i.e. passed for free,
 * which is the exact failure this round exists to catch, reintroduced by the fix for it.
 */
const acknowledgeMiss = createMissAcknowledgement(scene);

/**
 * Fires the real miss acknowledgement through a given screen point and reports what it asked for.
 *
 * The counterpart to `__firePropMuted`: together they decompose one tap into the half
 * a child could use to tell "I found something" from "I touched the wall", and the half
 * that is identical in both cases. Both halves are now produced by shipped code, so the
 * comparison restates no constant — not `SURFACE_STANDOFF`, not `SKY_SPARKLE_DISTANCE`,
 * not the preset. Whatever `missAcknowledgement.ts` does about depth, surface normals
 * and standoff is what the denominator gets, because it is what a child gets.
 *
 * The ray is built from the LIVE camera through the prop's own NDC, which is the same
 * construction `interactionController` performs on a pointer event, so "a miss at the
 * same place" means the same place on screen — the thing a child could actually compare.
 *
 * The emit is TEED, not replaced: the burst really draws (the pass needs its pixels) and
 * its arguments are recorded on the way past. That is what lets the runner check its
 * source-parsed assumption about the miss's preset against the miss's observed behaviour
 * instead of trusting either one alone.
 *
 * @param ndcX - Screen point, normalised device X.
 * @param ndcY - Screen point, normalised device Y.
 * @returns One record per burst the miss handler emitted.
 */
(
  window as unknown as {
    __missBurst?: (ndcX: number, ndcY: number) => Array<{ at: [number, number, number]; preset: string; count: number | null; tinted: boolean }>;
  }
).__missBurst = (ndcX, ndcY) => {
  const caster = new Raycaster();
  caster.setFromCamera(new Vector2(ndcX, ndcY), cameraHandle.camera);
  const asked: Array<{ at: [number, number, number]; preset: string; count: number | null; tinted: boolean }> = [];
  const saved = particles.emit;
  particles.emit = (p, position, overrides) => {
    asked.push({
      at: [position.x, position.y, position.z],
      preset: PRESET_KEYS.get(p as unknown) ?? 'unregistered',
      count: overrides?.count ?? null,
      tinted: (overrides?.colors?.length ?? 0) > 0,
    });
    saved(p, position, overrides);
  };
  try {
    acknowledgeMiss(caster.ray);
  } finally {
    particles.emit = saved;
  }
  return asked;
};

/**
 * The live projection's vertical focal term and the live canvas height.
 *
 * §11 requires both to be read off the projection matrix and the canvas rather
 * than off the authored preset, because `resize` is free to give a viewport
 * something other than what the preset asked for, and a previous round of this
 * review produced a retracted finding by measuring a camera the app never adopts.
 *
 * @returns `f = projectionMatrix.elements[5]` and the canvas client height.
 */
(window as unknown as { __projection?: () => { f: number; h: number; w: number } }).__projection = () => {
  const cam = cameraHandle.camera;
  return { f: cam.projectionMatrix.elements[5], h: canvas.clientHeight, w: canvas.clientWidth };
};

/**
 * The burst-core radius Round 1 graded against, exposed so the runner need not restate it.
 *
 * @returns `CORE_RADIUS`, in world units.
 */
(window as unknown as { __coreRadius?: () => number }).__coreRadius = () => CORE_RADIUS;

/**
 * Pixel-delta threshold, out of 255, for calling a pixel "changed".
 *
 * Two are reported rather than one. 8/255 is above SwiftShader's own frame-to-
 * frame variation (the ambient control run below measures that variation directly,
 * so the claim is checked rather than asserted) and catches a sub-pixel slide that
 * only shifts an antialiased edge. 24/255 is roughly the point at which a delta on
 * a mid-tone surface is a difference a person would notice rather than an
 * instrument would. A reaction that only clears the low threshold has moved the
 * buffer without moving the picture, and saying so requires both numbers.
 */
const DELTA_LOW = 8;
const DELTA_HIGH = 24;

/**
 * A rectangle of the drawing buffer, in buffer pixels, origin bottom-left.
 */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The whole drawing buffer as a `Box`.
 *
 * @returns The full-frame rectangle.
 */
const fullFrame = (): Box => {
  const gl = renderer.getContext();
  return { x: 0, y: 0, w: gl.drawingBufferWidth, h: gl.drawingBufferHeight };
};

/**
 * Reads a rectangle of the drawing buffer. Called immediately after `draw()`, in
 * the same task, so the buffer has not yet been composited away.
 *
 * THE REASON THIS DOCBLOCK USED TO GIVE FOR THE RECTANGLE WAS A MEASUREMENT
 * ARTEFACT, AND THE ARTEFACT COST A THREE-HUNDRED-MINUTE RUN. It said "a full-frame
 * `readPixels` costs 1214 ms against 8 ms for the draw", and concluded the readback
 * was 99% of the scan. Both halves are wrong for the same reason: SwiftShader
 * executes draws lazily, so timing a `draw()` times the ENQUEUE and the bill for the
 * work arrives at the next readback, whichever readback that happens to be. Measured
 * on the Playroom by `__costProbe`: ten draws timed 20.46 ms each, and the next three
 * full-frame reads timed 8309 ms each — 3 x 8309 = 24 927 against 10 x 2478.80 =
 * 24 788, i.e. the reads were billed for the draws to within 0.6%. A draw plus a
 * one-pixel sync costs 2478.80 ms; a 240x240 read after the queue has drained costs
 * 0.77 ms. The draw is 99% of the scan and the readback is free.
 *
 * The rectangle is kept anyway — it bounds `changed`'s per-pixel work and defines
 * the mask the ambient pass is scored against, both of which are real. But the cut
 * that actually matters is now known to be the draw count, which is why the drain,
 * the fence and the burst tail advance the clocks WITHOUT rendering.
 *
 * The cut a naive version of this probe would make instead — sampling every Nth
 * pixel — is still the one cut that must not be made, because a stride blinds the
 * instrument to precisely the small, thin reactions this round exists to find.
 * Cropping loses nothing as long as the reaction lies inside the crop, and
 * `changed` proves that per measurement rather than assuming it.
 *
 * @param box - Rectangle to read.
 * @returns RGBA bytes plus the rectangle they came from.
 */
const grab = (box: Box): { px: Uint8Array; box: Box } => {
  const gl = renderer.getContext();
  const px = new Uint8Array(box.w * box.h * 4);
  gl.readPixels(box.x, box.y, box.w, box.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { px, box };
};

/**
 * Compares two grabs and reports how much of the picture moved.
 *
 * `low`/`high` are counts of changed pixels at the two thresholds. `bbox` is the
 * diagonal, in buffer pixels, of the axis-aligned box containing every pixel that
 * cleared the HIGH threshold — a count alone cannot distinguish a thin bright
 * sliver from a compact blob, and "can a child see that something happened over
 * there" is partly a question about spatial extent.
 *
 * `edge` is what makes a cropped readback admissible. It counts HIGH-threshold
 * changed pixels lying on the crop's own boundary, EXCLUDING any boundary that is
 * also the edge of the frame — a reaction running off the side of the screen is a
 * fact about the room, not an artefact of the crop. `edge === 0` therefore proves
 * the change was fully contained and the crop discarded nothing; a non-zero `edge`
 * means the number below it is a floor rather than a measurement and the caller
 * must widen the box or say so. Without this the crop would be a convenience I
 * had merely asserted was harmless.
 *
 * `score` and the returned `mask` are two ends of the same wire, and they exist
 * because the first version of Round 2's third bar was ill-posed. That bar asked
 * whether a tap's reaction moves several times more pixels than the room moves on its
 * own over the same window — but "the room" was every pixel in the crop, and the crop
 * is sized to a burst's reach, so a breathing owl on the far side of a doorway counted
 * as competition for a tap on a kettle. It competes for neither the same pixels nor
 * the same attention. Handing the prop pass's own HIGH mask back as `score` asks the
 * defensible question instead: at the pixels this reaction actually changes, how much
 * do those same pixels change anyway? `score` never filters — the unrestricted counts
 * are still returned beside it, so the ill-posed number stays visible next to the one
 * that replaced it rather than being quietly deleted.
 *
 * @param a - Reference grab.
 * @param b - Later grab of the same rectangle.
 * @param score - Optional per-pixel mask; HIGH pixels inside it are counted separately.
 * @returns Changed-pixel counts at both thresholds, the high-threshold extent, the
 *   count of high pixels touching a non-frame crop boundary, the high-threshold mask
 *   itself for use as a later call's `score`, and the count of high pixels falling
 *   inside `score`.
 */
const changed = (
  a: { px: Uint8Array },
  b: { px: Uint8Array; box: Box },
  score?: Uint8Array | null,
): { low: number; high: number; bbox: number; edge: number; mask: Uint8Array; scored: number } => {
  const { px: A } = a;
  const { px: B, box } = b;
  const { w, h } = box;
  const frame = fullFrame();
  const openLeft = box.x > 0;
  const openRight = box.x + box.w < frame.w;
  const openBottom = box.y > 0;
  const openTop = box.y + box.h < frame.h;
  let low = 0;
  let high = 0;
  let edge = 0;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  const mask = new Uint8Array(w * h);
  let scored = 0;
  for (let i = 0, p = 0; i < B.length; i += 4, p += 1) {
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    if (d < DELTA_LOW) continue;
    low += 1;
    if (d < DELTA_HIGH) continue;
    high += 1;
    mask[p] = 1;
    if (score && score[p] === 1) scored += 1;
    const x = p % w;
    const y = (p - x) / w;
    if ((x === 0 && openLeft) || (x === w - 1 && openRight) || (y === 0 && openBottom) || (y === h - 1 && openTop)) edge += 1;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const bbox = x1 < 0 ? 0 : Math.hypot(x1 - x0 + 1, y1 - y0 + 1);
  return { low, high, bbox, edge, mask, scored };
};

/**
 * DOES FINDING SOMETHING LOOK DIFFERENT FROM TOUCHING THE WALL?
 *
 * For each registered, on-screen, non-background target this decomposes one tap
 * into its two halves and measures each against the same observable — pixels of
 * this frame that differ from the frame before the tap.
 *
 *   prop     the target's own gsap reaction, with the particle engine muted
 *   sparkle  the shared `SCENE_SPARKLE` burst at the point the prop itself chose,
 *            with no tween running
 *   ambient  the change produced by advancing the same tween window with NO tap at
 *            all, which is the floor any reaction has to clear to be a reaction
 *
 * The third is the control that makes the other two mean anything. Every one of
 * these rooms has looping idle motion — a breathing cat, a guttering flame, a
 * turning disc — so some pixels change over any 0.6 s window whether the child
 * taps or not. Without measuring that, a reaction that does nothing would still
 * score above zero and could be read as working.
 *
 * Each prop is measured from whatever state the scene is in when its turn comes,
 * and its window is closed by advancing well past the tween's duration before the
 * next one begins, so a reaction cannot be credited with its predecessor's motion.
 *
 * All three passes for a given prop read the SAME cropped rectangle, sized from the
 * burst's own reach and the prop's own bounding sphere (see `cropFor`). Reading the
 * same box for all three is what keeps the primary verdict — the prop/sparkle ratio
 * — immune to the crop: a box too small would suppress both numerators equally
 * only by luck, so the ratio is trusted only where `edge` reports zero clipping on
 * both, and the runner is told which rows those are.
 *
 * BAR (d) IS ANSWERED IN THIS FUNCTION BUT NOT BY A FOURTH PASS. "A hit must change
 * at least as many pixels as a miss at the same place" needs the hit's WHOLE answer
 * as its numerator, and the two obvious ways to get it are both wrong: adding
 * `propHigh + sparkleHigh` double-counts every pixel both halves touch, and a live
 * unmuted re-fire is barred by the handler latches documented on `__firePropMuted`.
 * The third way is a deduction. A prop that emits `sceneSparkle` with no overrides
 * draws the miss's own burst and then moves itself as well, so its answer contains
 * the miss's answer and cannot be smaller than it — no framebuffer required. The
 * rows where that deduction is unavailable are exactly the rows that emit nothing,
 * or emit something else, or emit the same preset with the count turned down, and
 * for those the numerator really is `propHigh` alone against `sparkleHigh`, which
 * this function already measures. So bar (d) needs no new pass — it needs the emit
 * arguments, which is why `emits` is now reported alongside the counts.
 *
 * The deduction rests on a premise about shipped code — that the miss emits one
 * unmodified preset — so that premise is MEASURED rather than assumed. `missEmits`
 * reports what the real `createMissAcknowledgement` asked for at this very prop, and
 * the runner cross-checks it against what it parsed out of `missAcknowledgement.ts`.
 * A source parse and an observation agreeing is worth more than either alone; the
 * parse catches a preset changed behind a branch this viewport never takes, and the
 * observation catches a parse that read the wrong file.
 *
 * 2026-07-30, Round 4 — THE `only` FILTER, AND THE HONEST COST OF ADDING IT.
 * Nature registers 65 gradeable groups and costs roughly two minutes a row on this
 * software renderer, so a full scan of it is a two-and-a-half hour run — long enough
 * that Round 4 would have been graded on the Pirate Cove's single portal alone, and
 * long enough that any post-fix re-measurement is unaffordable. `only` restricts
 * which groups are FIRED; it changes nothing about how a fired row is measured, and
 * the census printed before firing still reports every target in the scene, so a
 * reader can always see what was skipped. Two things are given up by using it and
 * both are stated wherever it appears in a probe: the run can no longer show that
 * the filtered props are the worst in their scene, and it can no longer catch a
 * regression in a prop nobody thought to name. It is a sampling tool, not a cheaper
 * scan, and a round that uses it owes an unfiltered run somewhere.
 *
 * @param maxSeconds - How far to follow a reaction, in gsap seconds.
 * @param stepSeconds - Sampling interval within that window.
 * @param only - Optional RegExp source. When given, only groups whose row name
 *   matches are fired and returned; the pre-fire census is unaffected.
 * @returns One record per measured target.
 */
(
  window as unknown as {
    __reactionScan?: (
      maxSeconds: number,
      stepSeconds: number,
      only?: string,
    ) => Array<{
      name: string;
      depth: number;
      pickMeshes: number;
      emitted: number;
      emits: Array<{ preset: string; count: number | null; tinted: boolean }>;
      missEmits: Array<{ preset: string; count: number | null; tinted: boolean }>;
      navigated: boolean;
      navVia: string;
      cropW: number;
      cropH: number;
      propLow: number;
      propHigh: number;
      propBbox: number;
      propEdge: number;
      peakAt: number;
      ambientLow: number;
      ambientHigh: number;
      ambientBbox: number;
      ambientInMask: number;
      sparkleLow: number;
      sparkleHigh: number;
      sparkleBbox: number;
      sparkleEdge: number;
    }>;
  }
).__reactionScan = (maxSeconds, stepSeconds, only) => {
  const targets = (
    window as unknown as {
      __propTargets: () => Array<{
        index: number;
        name: string;
        background: boolean;
        depth: number;
        onScreen: boolean;
        ndcX: number;
        ndcY: number;
      }>;
    }
  ).__propTargets();
  const registry = liveRegistry;
  if (!registry) throw new Error('no live dispatcher registry, so no crop can be sized to a prop');
  const objects = [...registry.keys()];
  const steps = Math.round(maxSeconds / stepSeconds);
  const preset = PARTICLES.sceneSparkle;

  /**
   * The rectangle that must contain everything either half of a tap can change.
   *
   * Two radii, in world units, and the larger wins. The burst's is deduced from the
   * preset rather than guessed: a particle leaves at up to `speed[1]` for up to
   * `lifetime[1]` seconds, and gravity adds `g·t²/2` of sag over the same window, so
   * nothing it draws can be further from the emission point than that sum. The
   * prop's is its own bounding sphere, because a tween may move any part of a mesh
   * and a couch is much wider than a burst. World units become buffer pixels through
   * the §11 relation `pxPerUnit(d) = (h/2)·f/d`, read off the LIVE projection matrix,
   * and the result is doubled — a burst is centred near the prop but not exactly on
   * it, since every room reaction offsets its emission point by up to 0.45 u.
   *
   * The prop's radius is taken from the UNION of every pick mesh that shares this
   * prop's handler, not from one of them. A prop registered as four sibling meshes
   * moves parts that no single sibling's bounding sphere contains — the desk lamp's
   * reaction rotates `armPivot`, which `lampBase` knows nothing about — so cropping to
   * one member would clip the reaction and the clip would be reported as a small one.
   *
   * @param indices - Registry indices of every pick mesh sharing one handler.
   * @param ndcX - Prop centre, normalised device X.
   * @param ndcY - Prop centre, normalised device Y.
   * @param depth - Prop depth along the view axis.
   * @returns A rectangle clamped to the drawing buffer.
   */
  const cropFor = (indices: readonly number[], ndcX: number, ndcY: number, depth: number): Box => {
    const frame = fullFrame();
    const maxLife = preset.lifetime[1];
    const burstReach = preset.speed[1] * maxLife + (Math.abs(preset.gravity) * maxLife * maxLife) / 2 + CORE_RADIUS;
    const union = new Box3();
    for (const i of indices) union.union(new Box3().setFromObject(objects[i]));
    const sphere = union.getBoundingSphere(new Sphere());
    const reachUnits = Math.max(burstReach, sphere.radius);
    const f = cameraHandle.camera.projectionMatrix.elements[5];
    const pxPerUnit = ((frame.h / 2) * f) / Math.max(depth, 0.001);
    const half = Math.ceil(reachUnits * pxPerUnit * 3);
    const cx = ((ndcX + 1) / 2) * frame.w;
    const cy = ((ndcY + 1) / 2) * frame.h;
    const x = Math.max(0, Math.min(frame.w - 1, Math.round(cx - half)));
    const y = Math.max(0, Math.min(frame.h - 1, Math.round(cy - half)));
    return {
      x,
      y,
      w: Math.max(1, Math.min(frame.w - x, Math.round(cx + half) - x)),
      h: Math.max(1, Math.min(frame.h - y, Math.round(cy + half) - y)),
    };
  };

  /**
   * Advances the gsap clock by three seconds and the frame clock by one frame,
   * WITHOUT rendering.
   *
   * It used to end in `draw()`. Every one of the three places that settles before a
   * measurement already draws again on the next line before it grabs — `settle();
   * draw(); grab(box)` — so that render was redundant where pixels were wanted and
   * pure cost in the twenty places where they were not. At 2478.80 ms a draw, the 23
   * settles in a row were 57 s of the row on their own.
   */
  const settle = () => {
    (window as unknown as { __gsapAdvance: (s: number) => void }).__gsapAdvance(3);
    clock.tick(1 / 60);
  };
  /**
   * Advances the frame clock without rendering.
   *
   * WHY THIS EXISTS RATHER THAN A LOOP OF `draw()`. The drain and the fence spend
   * their draws to make TIME PASS, not to make pixels: nothing between them reads the
   * framebuffer. A draw on this renderer costs 2478.80 ms (Playroom) or 1368.83 ms
   * (kitchen) once the deferred queue is billed — see `grab` — so the 408 draws the
   * drain and fence used to spend were roughly seventeen minutes per row, against
   * about a minute and a half of measurement. That is what made a Playroom pair
   * project to 344 minutes.
   *
   * A tick costs 0.0133 ms and is sufficient, which is a claim about what a render
   * does rather than a hope: nothing in `src/` implements `onBeforeRender` or
   * `onAfterRender` (one comment in `pirate-cove/.../ambientMotion/create.ts` exists
   * only to say so), and exactly three modules subscribe to the frame clock — the
   * particle engine, the little-shark effects and the nature stream surface. Every
   * one of them mutates state inside its subscriber. `renderer.render` reads that
   * state; no callback in the app is reachable only through it. So a chain that would
   * complete under 20 draws completes under 20 ticks, and the fence's whole purpose —
   * letting this row's chain finish before the next row fires — is unaffected.
   *
   * This is checked, not assumed: the doorway rows must still come back
   * `navigated: true` and the end-of-scan attribution throw must still stay silent.
   *
   * @param frames - Number of 1/60 s frames to advance.
   */
  const advance = (frames: number) => {
    for (let i = 0; i < frames; i += 1) clock.tick(1 / 60);
  };
  /**
   * Walks the window one step at a time and keeps the frame that moved the most.
   *
   * `scoredMax` is tracked SEPARATELY from `best` rather than read off it. The frame
   * where the whole crop moves most is not in general the frame where the prop's own
   * pixels move most, and taking the second number from the first frame would report
   * a smaller competitor than the window actually contains. Maximising each over the
   * window independently is the reading least favourable to the thing under test,
   * which is the reading a bar should be measured against.
   *
   * @param base - The pre-event framebuffer to diff every step against.
   * @param box - The rectangle all three passes for this prop share.
   * @param advanceGsap - Whether to step the gsap clock; false for the burst pass,
   *   which runs off the frame clock `draw()` ticks instead.
   * @param score - Optional mask restricting the separately-tracked `scoredMax`.
   * @returns The window's peak frame, plus `scoredMax` maximised independently.
   */
  const sweep = (
    base: { px: Uint8Array },
    box: Box,
    advanceGsap: boolean,
    score?: Uint8Array | null,
  ): { low: number; high: number; bbox: number; edge: number; at: number; mask: Uint8Array; scoredMax: number } => {
    let best: { low: number; high: number; bbox: number; edge: number; at: number; mask: Uint8Array } = {
      low: 0,
      high: 0,
      bbox: 0,
      edge: 0,
      at: 0,
      mask: new Uint8Array(box.w * box.h),
    };
    let scoredMax = 0;
    for (let s = 1; s <= steps; s += 1) {
      if (advanceGsap) (window as unknown as { __gsapAdvance: (n: number) => void }).__gsapAdvance(stepSeconds);
      draw();
      const d = changed(base, grab(box), score);
      if (d.scored > scoredMax) scoredMax = d.scored;
      if (d.high > best.high || (d.high === best.high && d.low > best.low)) best = { ...d, at: s * stepSeconds };
    }
    return { ...best, scoredMax };
  };

  // ONE ROW PER HANDLER, NOT ONE ROW PER PICK MESH — AND THE DIFFERENCE IS THE
  // DIFFERENCE BETWEEN THIS ROUND'S FINDING AND ITS EXACT OPPOSITE.
  //
  // The Playroom registers several meshes per prop so that a child can tap any part of
  // it: the desk lamp registers `base`, `arm`, `shade` and `bulb`, all four assigned the
  // SAME handler function, and the two toy cars register three each. The dispatcher
  // registry is keyed by object, so a naive scan produces four desk-lamp rows.
  //
  // That is not merely redundant, it is actively wrong, because every one of these
  // handlers opens with a latch — `if (shining) return;`, `if (driving) return;`. The
  // first row fires the reaction; rows two through four hit the latch and return without
  // tweening or emitting anything. They would be measured as `propHigh ≈ 0`, `emits: []`,
  // and therefore reported as FAILING bar (d) — "this prop answers a hit with nothing" —
  // which is precisely this round's charge, manufactured by the instrument, against the
  // three props whose repair this run exists to confirm. A run that fired once per mesh
  // would have reported the fix as having failed, in the fix's own words, with numbers.
  //
  // GROUPING BY THE REGISTRY'S HANDLER IDENTITY WAS TRIED FIRST AND IS WRONG. It was
  // argued from `roomSceneFactory.ts:107` passing `userData.onClick` to
  // `dispatcher.register` unwrapped — which is true, and which is not the identity this
  // registry holds. `worldTapDispatcher.register` is
  //
  //     register(target, handler, opts) { return controller.register(target, () => handler(), opts); }
  //
  // so the controller — whose Map this probe captures — stores a FRESH closure per
  // registration and no two entries can ever compare equal. Grouping by it is a no-op
  // that looks like a fix. It was published as exact, and the first Playroom run
  // refuted it in one column: sixteen rows, every one `picks 1`, `lampBase` `lampArm`
  // `lampShade` `lampBulb` still four rows, with ratios 1.233, 0.670, 0.126, 0.107 —
  // the last three being the desk lamp's own leftover motion measured through a latch.
  //
  // The shared object is the one the room author actually shared: `userData.onClick`,
  // which the legacy bridge reads and which stays on every pick mesh. Modern
  // `createTapInteraction` props have none, so each keys on its own registry entry and
  // forms a singleton — correct, since that API registers one mesh per call.
  const byHandler = new Map<unknown, { indices: number[]; members: typeof targets }>();
  for (const t of targets) {
    const entry = registry.get(objects[t.index]);
    if (!entry) continue;
    const shared = (objects[t.index] as Object3D).userData.onClick as unknown;
    const key = typeof shared === 'function' ? shared : entry.handler;
    const group = byHandler.get(key);
    if (group) {
      group.indices.push(t.index);
      group.members.push(t);
    } else {
      byHandler.set(key, { indices: [t.index], members: [t] });
    }
  }
  // The refutation above is the reason this is checked rather than asserted in prose: a
  // key that silently degrades to one-group-per-mesh produces a full, plausible report.
  // Every registered object carrying a shared `userData.onClick` must land in the same
  // group as its siblings, by construction — so if the collapse did not happen, the key
  // is wrong again and the run must not produce rows.
  const shares = new Map<unknown, number>();
  for (const t of targets) {
    const fn = (objects[t.index] as Object3D).userData.onClick as unknown;
    if (typeof fn === 'function') shares.set(fn, (shares.get(fn) ?? 0) + 1);
  }
  const expectedGroups = targets.length - [...shares.values()].reduce((n, c) => n + (c - 1), 0);
  if (byHandler.size !== expectedGroups) {
    throw new Error(
      `grouping produced ${byHandler.size} groups from ${targets.length} targets, but the shared-handler census expects ${expectedGroups}; ` +
        `the grouping key is not the object the room author shared, and rows 2..n of a latched prop would be graded as that prop answering with nothing`,
    );
  }

  // A SCAN THAT PRINTS NOTHING UNTIL IT FINISHES CANNOT BE DEBUGGED, ONLY WAITED ON.
  //
  // Two runs of this scan were spent blind — 50 minutes and 97 minutes on one room at one
  // viewport — and in the first of them the answer to "is the grouping working?" was
  // decided in the first second and not readable for the rest of the hour. The census
  // below is printed BEFORE any firing, so a grouping regression is visible immediately;
  // each row prints as it lands, so cost per row is measurable while it is being paid.
  // The runner forwards these to its own stdout.
  const say = (m: string) => console.log(`[scan] ${m}`);
  say(
    `${targets.length} targets -> ${byHandler.size} groups; collapsed: ${
      [...byHandler.values()]
        .filter((g) => g.indices.length > 1)
        .map((g) => `${g.members[0].name}(${g.indices.length})`)
        .join(', ') || '(none)'
    }`,
  );

  // 2026-07-30, Round 4. The attribution guard below used to compare `attributed`
  // against the LIFETIME nav count, which silently assumed nothing had navigated
  // before the scan began. Round 4's probe taps a portal through the canvas with
  // `__tapThroughCanvas` to read the controller's cue and sparkle, and that tap is
  // a real tap: it calls `nav.launchMiniGame` and leaves a permanent +1 in the
  // recorder. The scan then threw with "1 navigation call(s) of 6 were not
  // attributed", diagnosing a slow tap-to-navigate chain that did not exist. The
  // guard was right to fire on a discrepancy and wrong about its cause, because it
  // was measuring a total where it meant a delta. Nothing about how a row is
  // MEASURED changes here — only which calls the guard holds the scan responsible for.
  const navAtStart = (window as unknown as { __navCalls: () => string[] }).__navCalls().length;
  const out = [];
  let attributed = 0;
  for (const group of byHandler.values()) {
    // A group is graded if ANY member is a foreground on-screen target. Off-screen and
    // background siblings still contribute their geometry to the crop — they are parts
    // of the same prop — but they cannot disqualify a prop the child can see and touch.
    const gradeable = group.members.filter((m) => !m.background && m.onScreen);
    if (gradeable.length === 0) continue;
    // The `only` filter is applied HERE, after grouping and after the census has
    // printed, so skipping a group can never change how the remaining groups are
    // grouped, named or measured.
    if (only && !new RegExp(only).test(gradeable[0].name)) continue;
    const centre = new Box3();
    for (const i of group.indices) centre.union(new Box3().setFromObject(objects[i]));
    const mid = centre.getCenter(new Vector3());
    const cam = cameraHandle.camera;
    cam.updateMatrixWorld(true);
    const eye = cam.getWorldPosition(new Vector3());
    const axis = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    const ndc = mid.clone().project(cam);
    const target = {
      index: group.indices[0],
      // The `+n` is not decoration: it is the only way a reader of the output can see
      // that four registered meshes became one row, and therefore the only way the
      // collapse above is auditable from the report rather than from this comment.
      name: group.indices.length > 1 ? `${gradeable[0].name}+${group.indices.length - 1}` : gradeable[0].name,
      depth: mid.clone().sub(eye).dot(axis),
      ndcX: ndc.x,
      ndcY: ndc.y,
    };
    const box = cropFor(group.indices, target.ndcX, target.ndcY, target.depth);
    settle();

    draw();
    const beforeProp = grab(box);
    // Freeze the room's own idles for the duration of this pass, so `propHigh` is
    // the tap's reaction and not the tap's reaction plus a breathing owl. The
    // freeze is taken BEFORE the tap fires, so the tween the tap creates is not in
    // the frozen set and is the only thing still moving.
    const thaw = (window as unknown as { __freezeIdles: () => () => void }).__freezeIdles();
    const navBefore = (window as unknown as { __navCalls: () => string[] }).__navCalls().length;
    const asked = (
      window as unknown as {
        __firePropMuted: (i: number) => Array<{ at: [number, number, number]; preset: string; count: number | null; tinted: boolean }>;
      }
    ).__firePropMuted(target.index);
    const prop = sweep(beforeProp, box, true);
    thaw();
    // WAIT FOR THE TAP'S WHOLE CHAIN, NOT JUST ITS FIRST TWEEN, BEFORE ASKING WHETHER
    // IT NAVIGATED — AND ATTRIBUTION IS ONLY SOUND IF THE WAIT IS LONG ENOUGH.
    //
    // A tap-to-navigate chain can be much longer than the 0.4 s scan window.
    // `interactiveDoorway.ts:189` calls `navigateTo` from a 0.45 s tween's
    // `onComplete`, which one 3 s settle covers. `wireToyboxInteractions.ts:137` does
    // not: it flies the owl to the toybox first, and only the flight's callback starts
    // the two 0.1 s scale tweens whose completion navigates. Measured on the kitchen
    // at 1280x720, one settle was not enough — `toybox_kitchen-nature_root` came back
    // `navigated: false` with 4250 changed pixels and a ratio of 48.851, i.e. a scene
    // transition graded as tap delight and passed, which is precisely the row the
    // exclusion exists to remove. Its `navigateTo:nature` did arrive; it arrived after
    // the row had already been written.
    //
    // Worse than the missed exclusion is the misattribution: a chain that outlives its
    // own row lands inside the NEXT row's window and marks an innocent prop as a
    // doorway. So the wait is bounded but generous, and it advances BOTH clocks — the
    // owl's flight is not necessarily gsap-driven, and a settle that only moves gsap
    // cannot finish it.
    //
    // THE COST CLAIM THIS COMMENT USED TO CARRY WAS FALSE AND EXPENSIVE. It read
    // "draws are ~8 ms and readbacks are the expensive part, so spending draws here is
    // close to free", which is the inversion `grab`'s docblock now documents: a draw is
    // 2478.80 ms on the Playroom and a read is 0.77 ms. Spending draws here was the
    // single most expensive thing the scan did. It advances the frame clock instead.
    //
    // The budget is not trusted, it is CHECKED — but only against LOSS, which is the
    // weaker half. See the fence at the end of this row for the half it cannot check
    // and for the measured leak that proved it: three draws per iteration against three
    // gsap seconds is a wait for a gsap chain, and the owl's flight is not one.
    const navSeen = () => (window as unknown as { __navCalls: () => string[] }).__navCalls();
    for (let q = 0; q < 8; q += 1) {
      settle();
      advance(20);
      if (navSeen().length > navBefore) break;
    }
    const navAfter = navSeen();
    attributed += navAfter.length - navBefore;

    draw();
    const beforeAmbient = grab(box);
    // Scored against the prop pass's own HIGH mask, so `ambientInMask` answers "how
    // much do the pixels this reaction moves move anyway" rather than "how much does
    // anything anywhere in this rectangle move".
    const ambient = sweep(beforeAmbient, box, true, prop.mask);
    settle();

    draw();
    const beforeSparkle = grab(box);
    // THE REFERENCE BURST IS THE REAL MISS, AND IT IS FIRED FOR EVERY PROP —
    // INCLUDING, ESPECIALLY, THE ONES THAT ASKED FOR NONE.
    //
    // Two defects were fixed here, in that order. First, the pass used to be guarded
    // on `asked.length > 0`, which is the runner's `emitted === 0` blind spot in a
    // second place: a prop that emits nothing got no reference burst, so `sparkleHigh`
    // came back 0, so the ratio and bar (d) were both undefined for exactly the rows
    // this round is about. A denominator that vanishes whenever the numerator is
    // interesting is not a denominator.
    //
    // Second, the anchor that replaced the guard was worse than useless. It emitted at
    // the prop's own world position, which is inside the prop, where the depth test
    // buries the burst: `sparkleHigh` measured 0 on both kitchen doorway rows, so an
    // emit-nothing prop would have scored `propHigh / 0` and passed. So the probe stops
    // inventing an anchor. `__missBurst` casts a ray from the live camera through this
    // prop's own NDC and hands it to the SHIPPED `createMissAcknowledgement`, which
    // finds its own occluder, its own surface normal and its own standoff. The reference
    // is a miss at the same screen point, produced by the code that produces misses.
    const missAsked = (
      window as unknown as {
        __missBurst: (x: number, y: number) => Array<{ at: [number, number, number]; preset: string; count: number | null; tinted: boolean }>;
      }
    ).__missBurst(target.ndcX, target.ndcY);
    // gsap is NOT advanced here: the particle engine runs off the frame clock
    // that `draw()` ticks, so the burst plays with the scene otherwise frozen
    // and the changed pixels are the burst and nothing else.
    const sparkle = sweep(beforeSparkle, box, false);
    advance(steps * 2);

    // THE FENCE. A ROW MAY NOT INHERIT THE PREVIOUS ROW'S REACTION, AND THE PREVIOUS
    // ROW'S NAVIGATION MAY NOT BE CHARGED TO IT.
    //
    // The drain above breaks the moment a nav call arrives, so it is a wait for THIS
    // row's chain, not a guarantee the stage is quiet before the next one is fired. Both
    // halves of that gap were observed on the Playroom, and neither is theoretical:
    //
    //   - `toybox_animals_root`'s `navigateTo:nature` was charged to `lampBulb`, five
    //     rows later. The owl's flight to the toybox is driven by the FRAME clock, and
    //     the drain spent three draws per iteration against three gsap seconds, so it
    //     advanced roughly half a second of frame time in eight tries. The end-of-scan
    //     check passed, because the call WAS attributed — to an innocent prop. A check
    //     that can only detect a lost call cannot detect a stolen one.
    //   - the desk lamp holds its spotlight for `SHINE_DURATION = 5` s and then takes
    //     0.6 s to tilt back, so it was still animating while its own siblings were
    //     measured, which is why the latched rows read 65 and 11 px instead of 0 and
    //     the "rows that look LATCHED" census reported a clean zero. An artefact that
    //     is merely small is more dangerous than one that is absent.
    //
    // So the stage is drained unconditionally before the next fire, on BOTH clocks and
    // with enough frame ticks to finish a frame-driven chain. Anything that arrives here
    // is charged to the row just fired, which is sound because nothing else has fired
    // since.
    //
    // THE SENTENCE THAT USED TO END THIS COMMENT — "the whole fence costs about two
    // seconds against a row that costs a minute" — was wrong by three orders of
    // magnitude and was written, like the claim it borrowed from, without measuring the
    // room it was about. 252 draws at 2478.80 ms is ten and a half minutes per row. The
    // fence is the same length in frames; it now costs 0.24 s of ticks and three
    // hundredths of a second of gsap, and no pixels are read here for it to affect.
    for (let q = 0; q < 12; q += 1) {
      settle();
      advance(20);
    }
    const navFenced = navSeen();
    attributed += navFenced.length - navAfter.length;
    const navAll = navFenced.slice(navBefore);

    out.push({
      name: target.name,
      depth: target.depth,
      pickMeshes: group.indices.length,
      emitted: asked.length,
      emits: asked.map((a) => ({ preset: a.preset, count: a.count, tinted: a.tinted })),
      missEmits: missAsked.map((a) => ({ preset: a.preset, count: a.count, tinted: a.tinted })),
      navigated: navAll.length > 0,
      navVia: navAll.join(','),
      cropW: box.w,
      cropH: box.h,
      propLow: prop.low,
      propHigh: prop.high,
      propBbox: prop.bbox,
      propEdge: prop.edge,
      peakAt: prop.at,
      ambientLow: ambient.low,
      ambientHigh: ambient.high,
      ambientBbox: ambient.bbox,
      ambientInMask: ambient.scoredMax,
      sparkleLow: sparkle.low,
      sparkleHigh: sparkle.high,
      sparkleBbox: sparkle.bbox,
      sparkleEdge: sparkle.edge,
    });
    say(
      `${out.length}/${byHandler.size} ${target.name} picks=${group.indices.length} prop=${prop.high} miss=${sparkle.high} ` +
        `emits=${asked.map((a) => a.preset).join(',') || 'none'} nav=${navAll.join(',') || '-'}`,
    );
  }
  // THE BUDGET ABOVE IS CHECKED, NOT TRUSTED. Every `navigateTo` reached during this
  // scan was started by some row's tap, so if the count of calls attributed to rows
  // is short of the count recorded, at least one chain outlived its own row and was
  // either dropped or — worse — charged to whichever prop happened to be measured
  // next. There is no reading of that scan worth having, so it throws.
  const allNav = (window as unknown as { __navCalls: () => string[] }).__navCalls().slice(navAtStart);
  if (allNav.length !== attributed) {
    throw new Error(
      `${allNav.length - attributed} navigation call(s) of ${allNav.length} during this scan were not attributed to the row that caused them ` +
        `(${allNav.join(', ')}); a tap-to-navigate chain is slower than the quiescence budget, so raise it before believing any row`,
    );
  }
  return out;
};

/**
 * THE THREE BASELINES THAT DECIDE WHETHER THE AMBIENT COLUMN MEANS ANYTHING.
 *
 * `__reactionScan` grades a reaction against the same window with no tap in it,
 * and reported a kitchen kettle whose reaction moves only 1.1x as many pixels as
 * its own room does unprompted. Before that becomes a finding it has to survive
 * the boring explanation: that this software renderer does not draw the same
 * frame twice, so the "ambient" count is instrument noise wearing a room's name.
 *
 * `frozen` advances nothing between the two grabs. It is the noise floor, and it
 * is the number that decides whether any other number in this round is readable
 * at all. `clock` ticks only `draw()`, which is what the particle engine and the
 * idle animator run off; `gsap` additionally advances the tween clock, which is
 * what the authored idles run off. Separating the last two matters because the
 * two clocks are fixed by different code and a defect in one is not a defect in
 * the other.
 *
 * Full frame, deliberately: a noise floor measured through the scan's crop would
 * be a smaller number for a reason that has nothing to do with noise.
 *
 * @param maxSeconds - Window length, matching the scan's.
 * @param stepSeconds - Sampling interval, matching the scan's.
 * @returns Changed-pixel counts at both thresholds for each baseline.
 */
(
  window as unknown as {
    __noiseFloor?: (
      maxSeconds: number,
      stepSeconds: number,
    ) => {
      frozenLow: number;
      frozenHigh: number;
      clockLow: number;
      clockHigh: number;
      gsapLow: number;
      gsapHigh: number;
    };
  }
).__noiseFloor = (maxSeconds, stepSeconds) => {
  const steps = Math.round(maxSeconds / stepSeconds);
  const box = fullFrame();
  const w = window as unknown as {
    __gsapSleep: () => void;
    __gsapWake: () => void;
    __gsapAdvance: (s: number) => void;
  };

  w.__gsapSleep();
  try {
    w.__gsapAdvance(3);
    draw();

    // FROZEN: no clock of any kind moves. `draw()` is called once to fill the
    // buffer and then not again, so the second grab re-reads the same frame.
    const a = grab(box);
    const frozen = changed(a, grab(box));

    // CLOCK: only the frame clock ticks.
    draw();
    const b = grab(box);
    let clock = { low: 0, high: 0 };
    for (let s = 0; s < steps; s += 1) {
      draw();
      const d = changed(b, grab(box));
      if (d.high > clock.high) clock = d;
    }

    // GSAP: both clocks tick, exactly as the scan's ambient pass runs.
    w.__gsapAdvance(3);
    draw();
    const c = grab(box);
    let gsapWorst = { low: 0, high: 0 };
    for (let s = 0; s < steps; s += 1) {
      w.__gsapAdvance(stepSeconds);
      draw();
      const d = changed(c, grab(box));
      if (d.high > gsapWorst.high) gsapWorst = d;
    }

    return {
      frozenLow: frozen.low,
      frozenHigh: frozen.high,
      clockLow: clock.low,
      clockHigh: clock.high,
      gsapLow: gsapWorst.low,
      gsapHigh: gsapWorst.high,
    };
  } finally {
    w.__gsapWake();
  }
};

/**
 * PAUSES EVERYTHING GSAP IS ALREADY ANIMATING, SO A TAP CAN BE MEASURED ALONE.
 *
 * The first Round 2 scan could not tell a prop's reaction from its room's idle,
 * because both run on the same clock and advancing it advances both. The kettle's
 * pass reported 306 changed pixels while the same window with no tap reported 272
 * — and since the tap's window CONTAINS the idle, 306 was an upper bound on the
 * tween and might have been almost entirely owl. A verdict cannot rest on a
 * number that might be 90% something else.
 *
 * Every room inherits a breathing owl from `roomSceneFactory` (`entities/owl/idle
 * .ts` builds two `repeat: -1` timelines), the Living Room adds a guttering flame,
 * and the Playroom adds a car, a train, a music player, visiting animals, a chick
 * and a wind-up mouse. Full-frame, over 0.4 s, those move 162, 209 and 3689 pixels
 * respectively. In the Playroom that is an order of magnitude more than any tap
 * reaction, so without this the Playroom's rows would have been unreadable.
 *
 * The children of the global timeline are captured BEFORE the tap fires, so the
 * tween the tap creates is not in the list and is the only thing left running.
 * Paused tweens hold their current values, so the idles freeze mid-pose rather
 * than snapping home — the reaction is measured against the picture the child was
 * actually looking at.
 *
 * @returns A function that resumes exactly what was paused, and nothing else.
 */
(window as unknown as { __freezeIdles?: () => () => void }).__freezeIdles = () => {
  const running = gsap.globalTimeline.getChildren(true, true, true).filter((t) => !t.paused());
  running.forEach((t) => t.pause());
  return () => running.forEach((t) => t.resume());
};

/**
 * The live transform of a registered target and of its parent.
 *
 * A tap handler tweens whatever object its closure captured, which is often a
 * GROUP the registered mesh hangs from — the kitchen kettle registers `kettleBody`
 * but rocks `kettle` — so reading the mesh alone can show a tween as absent when
 * it is merely one level up. Both levels are reported so a zero pixel-count can be
 * traced to a still transform or convicted as a moving one that draws nothing.
 *
 * @param index - Registry index from `__propTargets`.
 * @returns Rotation and scale of the target and of its parent.
 */
(
  window as unknown as {
    __transformOf?: (index: number) => {
      rotZ: number;
      scaleX: number;
      scaleY: number;
      parentRotZ: number;
      parentScaleX: number;
      worldY: number;
    };
  }
).__transformOf = (index) => {
  const registry = liveRegistry;
  if (!registry) throw new Error('no live dispatcher registry');
  const object = [...registry.keys()][index];
  const parent = object.parent;
  return {
    rotZ: object.rotation.z,
    scaleX: object.scale.x,
    scaleY: object.scale.y,
    parentRotZ: parent ? parent.rotation.z : Number.NaN,
    parentScaleX: parent ? parent.scale.x : Number.NaN,
    worldY: object.getWorldPosition(new Vector3()).y,
  };
};

/**
 * A census of everything gsap is currently animating, by target and state.
 *
 * Needed because "the transform did not move" has two causes that look identical
 * from outside: no tween was created, or a tween was created and is not being
 * advanced. Only the second is this probe's fault, and only this census tells them
 * apart.
 *
 * `startTime` and the root clock are reported alongside progress because there is a
 * THIRD cause that also looks identical from outside, and it is the one that bit
 * this probe: a tween created while `gsap.ticker` is asleep can be given a start
 * time taken from the sleeping ticker rather than from the root time this probe has
 * been driving forward with `updateRoot`. Such a tween is neither absent nor paused
 * — it is already past its own end on the very first sample, so its `onComplete` has
 * restored the rest pose and the transform reads exactly flat. `startTime` against
 * `__gsapRootTime()` is what distinguishes that from a reaction that does nothing.
 *
 * @returns One entry per live tween: its targets' names, whether it is paused, its
 *   progress, its total duration including repeats, and its start and local time on
 *   the root timeline.
 */
(window as unknown as { __gsapRootTime?: () => number }).__gsapRootTime = () => gsap.globalTimeline.time();
(
  window as unknown as {
    __gsapTweenCensus?: () => Array<{ targets: string; paused: boolean; progress: number; totalDuration: number; startTime: number; time: number }>;
  }
).__gsapTweenCensus = () =>
  gsap.globalTimeline.getChildren(true, true, true).map((t) => ({
    targets: ((t as unknown as { targets?: () => unknown[] }).targets?.() ?? [])
      .map((o) => {
        const named = o as { name?: string };
        if (typeof named.name === 'string' && named.name.length > 0) return named.name;
        // Tweens on `.rotation`/`.scale`/`.position` target a bare Euler or
        // Vector3, which has no name; the constructor is the only handle.
        return (o as object).constructor.name;
      })
      .join(','),
    paused: t.paused(),
    progress: t.progress(),
    totalDuration: t.totalDuration(),
    startTime: t.startTime(),
    time: t.time(),
  }));

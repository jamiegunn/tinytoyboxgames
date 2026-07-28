import { Scene, Vector3, Vector2, Color, Plane, Raycaster, PerspectiveCamera, type Object3D } from 'three';
import type { Mesh } from 'three';
import type { IMiniGame, MiniGameContext, MiniGameTapEvent, MiniGameDragEvent, MiniGameDragEndEvent, ViewportInfo } from '../../framework/types';
import { clamp, getSpeedMultiplier, getTargetFishCount, getFishEvasiveness } from './helpers';
import {
  buildSharkEntity,
  createFish,
  resetFishForSpawn,
  deactivateFish,
  disposeFish,
  resetMeshIndex,
  updateFishDrift,
  updateGoldenDodge,
  escapeFromShark,
  updateDespawnAnimation,
  updateEatAnimation,
} from './fish';
import {
  setupScene,
  teardownScene,
  updateCausticLights,
  updateGodRays,
  updateSeaweedSway,
  updateAnemoneSway,
  updateEnvironmentReactions,
  createAmbientCreatures,
  updateAmbientCreatures,
  disposeAmbientCreatures,
  regionFishMultiplier,
  type SceneEnvironment,
  type AmbientCreatures,
} from './environment';
import {
  BOUNDS,
  FISH_HIT_RADIUS,
  GOLDEN_HIT_RADIUS,
  EAT_ANIM_DURATION,
  FISH_DESPAWN_SCALE_DURATION,
  FISH_POINTS,
  GOLDEN_SPAWN_RING,
  MILESTONE_SCHEDULE,
  MILESTONE_REPEAT_INTERVAL,
  type FishState,
  type FishKind,
} from './types';
import {
  createSharkAnimState,
  updateTailWag,
  updateBodyWobble,
  updateBreathing,
  updateEyeBlink,
  updateBarrelRoll,
  updateHeadLook,
  triggerHeadLook,
  triggerBarrelRoll,
  type SharkAnimState,
  createSharkMoveState,
  updateSpringFollow,
  updateIdleDrift,
  updateSwim,
  startLunge,
  updateRotation,
  releaseDrag,
  steerTowardAngle,
  TURN_RATE_HUNT,
  getSpeed,
  isPlayerDriven,
  applyToMesh,
  type SharkMoveState,
  // Hunt FSM
  createHuntFSMState,
  updateHuntFSM,
  triggerHunt,
  cancelHunt,
  notifyHuntCatch,
  getHuntPhase,
  type HuntFSMState,
  // Expressions
  createExpressionState,
  updateExpressions,
  setMood,
  getMoodParams,
  getMoodForPhase,
  type ExpressionState,
} from './shark';
import {
  classifyPickedMesh,
  handleWaterTap,
  handleRockTap,
  handleSharkTap,
  handleMissedTap,
  createInteractionState,
  type InteractionState,
} from './interactions';
import { createCelebrationQueue } from './celebrations';
import {
  createProximitySpawnState,
  updateProximitySpawning,
  notifyFishEaten,
  notifyGoldenLost,
  CAMERA_VIEW_RADIUS,
  CULL_DISTANCE,
  FISH_HARD_CEILING,
  type ProximitySpawnState,
} from './waves';
import { createSurpriseState, updateSurprises, nudgeSurpriseSoon, type SurpriseState } from './surprises';
import {
  createFrenzyState,
  registerFrenzyCatch,
  updateFrenzy,
  frenzyGather,
  frenzyIntensity,
  isFrenzyActive,
  type FrenzyState,
  type FrenzyEvent,
} from './frenzy';
import { createFrenzyHud, updateFrenzyHud, disposeFrenzyHud, type FrenzyHud } from './frenzyHud';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import type { StreamHandle } from '@app/utils/particles/engine';

// Phase 6 — Camera, VFX, Screen effects
import { createCameraState, updateFollowCamera, triggerCatchZoom, triggerScreenShake, resetCamera, type CameraState } from './camera/followCamera';
import { createBubbleTrail, createCatchExplosion, type BubbleTrail } from './effects/particles';
import {
  createVignette,
  updateVignette,
  triggerVignette,
  createSpeedLines,
  updateSpeedLines,
  triggerSpeedLines,
  createColorFlash,
  updateColorFlash,
  triggerColorFlash,
  disposeScreenFx,
  type VignetteState,
  type SpeedLineState,
  type ColorFlashState,
} from './effects/screenFx';

/**
 * Checks if a mesh is a descendant of (or is) a root object.
 * @param child - The object to check.
 * @param root - The potential ancestor object.
 * @returns True if child is root or a descendant of root.
 */
function isDescendantOf(child: Object3D, root: Object3D): boolean {
  let current: Object3D | null = child;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Creates the Little Shark mini-game.
 * @param context - Shell-provided context with shared systems.
 * @returns An IMiniGame implementation for the little-shark game.
 */
export function createGame(context: MiniGameContext): IMiniGame {
  const scene = context.scene as Scene;
  const shellCam = context.camera as PerspectiveCamera;
  let env: SceneEnvironment | null = null;
  let ambientCreatures: AmbientCreatures | null = null;
  let sharkRoot: Mesh | null = null;
  let sharkBody: Object3D | null = null;
  let sharkGlowTrail: StreamHandle | null = null;
  let tailMeshes: Object3D[] = [];
  let eyeMeshes: Object3D[] = [];
  let sharkAnim: SharkAnimState = createSharkAnimState();
  let sharkMove: SharkMoveState = createSharkMoveState();
  const sharkPos = new Vector3(0, 0, 0);
  let paused = false;
  let elapsedTime = 0;
  let eatAnimTimer = -1;
  let firstCatchDone = false;
  const fishArray: FishState[] = [];
  let goldenFish: FishState | null = null;
  let spawnState: ProximitySpawnState | null = null;
  let surpriseState: SurpriseState | null = null;
  let frenzyState: FrenzyState | null = null;
  let frenzyHud: FrenzyHud | null = null;
  let unsubScore: (() => void) | null = null;
  const celebrations = createCelebrationQueue();
  let interactionState: InteractionState = createInteractionState();

  // Phase 3 — Hunt FSM, Expressions
  let huntState: HuntFSMState = createHuntFSMState();
  let expressionState: ExpressionState = createExpressionState();

  // Phase 6 — Camera, VFX, Screen effects
  let cameraState: CameraState | null = null;
  let vignetteState: VignetteState | null = null;
  let speedLineState: SpeedLineState | null = null;
  let colorFlashState: ColorFlashState | null = null;
  const activeBubbleTrails: BubbleTrail[] = [];

  // Scratch objects for turning a missed tap into a world point (defect 5).
  // Allocated once — onTap runs on every touch and must not churn the heap.
  const tapRaycaster = new Raycaster();
  const tapNdc = new Vector2();
  const tapWorldPoint = new Vector3();
  const swimPlane = new Plane(new Vector3(0, 1, 0), 0);

  // Aims tapRaycaster down the tap. Returns false if the canvas has no size yet.
  function aimTapRay(screenX: number, screenY: number): boolean {
    const rect = context.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    tapNdc.set(((screenX - rect.left) / rect.width) * 2 - 1, -(((screenY - rect.top) / rect.height) * 2 - 1));
    tapRaycaster.setFromCamera(tapNdc, shellCam);
    return true;
  }

  // Projects a client-space tap onto the shark's swim plane (y = 0). Only used
  // when the pick hit nothing, so there is no pickedPoint to reuse.
  function tapToWaterPoint(screenX: number, screenY: number): Vector3 | null {
    if (!aimTapRay(screenX, screenY)) return null;
    return tapRaycaster.ray.intersectPlane(swimPlane, tapWorldPoint);
  }

  // How far from the tap, in SCREEN PIXELS, a fish may be and still count as the
  // thing the child meant to point at.
  //
  // This was a world-space radius: 2.5 units, measured perpendicular to the tap
  // ray. Its own comment justified the number by converting it to pixels —
  // "2.5 world units = 224 px = ~4 cm of slack" — using the scale that holds at
  // the shark's depth. That conversion is only valid there. The camera pitches
  // ~36 degrees down over a 24.35-degree half-fov, so the reef runs from about
  // 8 units from the lens at the bottom of the frame to about 33 at the top,
  // and one world unit is ~110 px down there against ~27 px up here. A fixed
  // world radius therefore gave the child several times more on-screen slack on
  // a fish swimming towards the camera than on one swimming away, for exactly
  // the same aiming error, and delivered the author's intended 224 px at
  // precisely one depth.
  //
  // Screen space was the right space. 220 was the wrong number, and the way it
  // is wrong is only visible once you ask what a MISS is worth.
  //
  // At 220 px the snap covers 18% of the canvas width. Against the 14-18 fish
  // round 1 introduced, a tap aimed at nothing in particular lands within 220 px
  // of some fish 72% of the time. That is not slack, it is a guarantee: the
  // child pokes the glass anywhere and the reef feeds them. The rule learnable
  // from that is "touch the screen", not "touch the fish" — which is round 2's
  // defect wearing a different coat. Round 2 stopped the shark scoring while
  // nobody was touching it; this stops it scoring when the touch meant nothing.
  //
  // Measured, not assumed. A probe tapping uniformly random points scored 70%
  // (14/20). A geometric model built from the fish positions actually on screen
  // — obtained by rendering the reef with props and litter switched off, so that
  // every salient blob in frame is provably a fish — predicts 71.9% for that
  // same experiment. Model and game agree to within two points, so the model is
  // entitled to choose this constant.
  //
  // What it optimises is the GAP: P(hit | the child aimed at a fish) minus
  // P(hit | the child poked an arbitrary spot). The gap is the whole learnable
  // signal in the game — if poking anywhere works as well as poking a fish,
  // there is nothing there to discover. Aiming error is a Gaussian with
  // sigma = 65 px, the 12 mm that preschool touch accuracy runs to at this
  // canvas scale (1200 px / 22 cm = 5.45 px/mm); 15 mm was checked and moves
  // nothing that matters.
  //
  //   snap   aimed   random    gap
  //    220   0.999    0.719   0.280   <- was
  //    170   0.991    0.600   0.391
  //    140   0.965    0.474   0.481
  //    120   0.906    0.384   0.522   <- here
  //    100   0.818    0.302   0.515
  //     80   0.656    0.207   0.449
  //
  // The gap turns over just under 120: below it the child starts failing taps
  // they meant to make faster than the random rate falls. 120 doubles the
  // learnable signal (0.28 -> 0.52) while still catching nine aimed taps in ten,
  // and its radius is 22 mm — at the 23-25 mm floor for a preschool hit target,
  // which is to say as small as this is permitted to go on ergonomic grounds
  // whatever the gap curve wants.
  //
  // One thing this deliberately does NOT fix: about 30% of successful taps eat a
  // fish other than the one aimed at, and the sweep shows that fraction is flat
  // in the snap radius — it is set by fish spacing against aiming error, so no
  // radius moves it, and the density causing it is round 1's cure for sparsity.
  // It is also very likely imperceptible: two fish 100 px apart, the child
  // pokes, one bursts under their finger. The reward still lands a median 60 px
  // from the fingertip. Left alone on purpose, not overlooked.
  const FISH_TAP_SNAP_RADIUS_PX = 120;

  // Scratch for projecting a fish to screen space. See the note on tapRaycaster.
  const tapProjected = new Vector3();

  // Finds the fish whose screen position is closest to the tap, within
  // FISH_TAP_SNAP_RADIUS_PX. Fish behind the camera are skipped: `project`
  // mirrors those through the origin, so without the z guard a fish directly
  // behind the child's view would read as a near-perfect hit.
  function findFishNearTap(screenX: number, screenY: number): FishState | null {
    const rect = context.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    let best: FishState | null = null;
    let bestDistSq = FISH_TAP_SNAP_RADIUS_PX * FISH_TAP_SNAP_RADIUS_PX;
    const consider = (fish: FishState | null): void => {
      if (!fish || !fish.active) return;
      tapProjected.copy(fish.root.position).project(shellCam);
      if (tapProjected.z > 1) return;
      const px = rect.left + ((tapProjected.x + 1) / 2) * rect.width;
      const py = rect.top + ((1 - tapProjected.y) / 2) * rect.height;
      const dx = px - screenX;
      const dy = py - screenY;
      const d = dx * dx + dy * dy;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = fish;
      }
    };
    for (const f of fishArray) consider(f);
    consider(goldenFish);
    return best;
  }

  // Catches the fish the child pointed at.
  //
  // This used to only set a hunt target, and that was the whole scoring defect.
  // `eatFishAction` is the one place `score.addPoints` is called, and its only
  // caller was the per-frame collision test at FISH_HIT_RADIUS = 1.0 — so a tap
  // never scored, it merely asked the simulation to try. Whether the child got
  // a point then depended on how many frames the shark got to close a gap of up
  // to 15 units at 3-8 units/second, i.e. on the frame rate. Measured on the
  // shipped build: a 24-tap grid sweep scored 0, and an 8-tap burst scored 0.
  //
  // Every sibling game scores in the tap handler — bubble-pop pops in
  // `popBubble` from `onTap`, fireflies adds points inline in `onTap`,
  // star-catcher in `rules/scoring.ts` off the pick. little-shark was the only
  // one that made the reward conditional on physics, and it is also the only
  // one that does not score.
  //
  // So the tap resolves the catch. The shark still lunges at the fish, so the
  // pounce reads on screen and the celebration plays where the fish was, but
  // the point is credited at the moment the child touched it. Swimming the
  // shark into a fish by dragging still eats it through the collision path
  // below — that half of the toy is unchanged.
  function chaseFish(fish: FishState): void {
    // This used to open `fish.isTargeted = true`, and the write could never be
    // observed: `eatFishAction` two lines down sets `fish.active = false`, and
    // the flag's only reader opens with `if (!fish.active ...) return`. Removed
    // with the flag itself — see the NOT-HERE-DELIBERATELY note in types.ts.
    //
    // The child has spoken, so whatever the shark had decided to do on its own
    // no longer owns the next catch.
    autoHuntActive = false;
    setMood(expressionState, fish.kind === 'golden' ? 'excited' : 'curious');
    // Point the shark at the kill so the lunge animation reads, then clear the
    // hunt: there is nothing left to hunt once the fish is eaten, and leaving a
    // stale target makes the FSM drive the shark at a despawning mesh.
    cancelHunt(huntState);
    startLunge(sharkMove, fish.root.position.x, fish.root.position.z, 6.0);
    eatFishAction(fish);
  }

  function eatFishAction(fish: FishState): void {
    fish.active = false;
    // If this is the fish the hunt was after, the hunt earned its flourish. The
    // FSM integrates positions and cannot see a collision, so the outcome has to
    // be told to it from here or the terminal beat cannot tell a catch from a
    // miss — which is how the shipped game came to barrel-roll over both.
    if (huntState.targetFishRoot === fish.root) notifyHuntCatch(huntState);
    // A fish can now be caught mid-arrival, so clear the inbound flag or the
    // despawn/pool path would still treat it as flying in.
    fish.spawning = false;
    fish.despawnTimer = FISH_DESPAWN_SCALE_DURATION;
    context.score.addPoints(FISH_POINTS[fish.kind]);
    context.combo.registerHit();
    // The build is a count of CATCHES, not a timer, so the child causes the
    // frenzy. A timer would have produced the same phase structure on the
    // instrument while teaching the child that waiting is what makes things
    // happen. See frenzy.ts.
    if (frenzyState) applyFrenzyEvent(registerFrenzyCatch(frenzyState));
    celebrations.playEatCelebration({
      scene,
      fishPos: fish.root.position.clone(),
      // Was `FISH_COLORS[0]`. Every standard fish in the game, whatever colour
      // the child had just been looking at, burst into orange confetti — so the
      // one moment in the loop that is supposed to say "yes, THAT one" said it
      // in the wrong colour four times out of five.
      fishColor: fish.color,
      fishKind: fish.kind,
      sharkBody,
      sharkRoot,
      sharkAnim,
      comboStreak: context.combo.streak,
      isFirstCatch: !firstCatchDone,
      context,
    });
    if (!firstCatchDone) firstCatchDone = true;
    eatAnimTimer = EAT_ANIM_DURATION;

    // Camera catch zoom + screen shake
    if (cameraState) {
      triggerCatchZoom(cameraState, fish.kind === 'golden' ? 5.0 : 3.0);
      triggerScreenShake(cameraState, 0.12, fish.kind === 'golden' ? 0.06 : 0.03);
    }

    // Catch explosion VFX scaled by combo
    createCatchExplosion(scene, fish.root.position.clone(), fish.color, context.combo.streak);

    // Golden catch: vignette + color flash
    if (fish.kind === 'golden') {
      if (vignetteState) triggerVignette(vignetteState, 0.4, 0.2);
      if (colorFlashState) triggerColorFlash(colorFlashState, new Color(1.0, 0.85, 0.2), 0.3, 0.12);
    }

    // Cancel hunt if we ate the hunted fish
    if (huntState.targetFishRoot === fish.root) {
      cancelHunt(huntState);
    }

    // Notify proximity spawner to queue replacements
    if (spawnState) notifyFishEaten(spawnState, fish.kind === 'golden');
  }

  // ── Entity pool helpers ─────────────────────────────────────────────

  /**
   * Counts the fish currently alive in the reef, inbound ones included.
   * @returns The number of active fish.
   */
  function countActiveFish(): number {
    let count = 0;
    for (const f of fishArray) if (f.active) count++;
    return count;
  }

  /**
   * Acquires a fish from the pool or creates a new one.
   * Reuses inactive fish of matching kind before allocating.
   * @param kind - The fish kind to acquire.
   * @returns A ready-to-use FishState.
   */
  function acquireFish(kind: FishKind): FishState {
    const pooled = fishArray.find((f) => !f.active && f.despawnTimer <= 0 && f.kind === kind);
    if (pooled) {
      resetFishForSpawn(pooled, sharkPos);
      return pooled;
    }
    const fish = createFish(scene, sharkPos, kind);
    fishArray.push(fish);
    return fish;
  }

  // How long a replacement fish takes to swim in from SPAWN_DISTANCE (18 units
  // off-screen) to its drift target.
  //
  // 1.5s at the 4-8 units the drift target sits from the shark meant a fish
  // covered ~12 units in that window: fast enough to see, but combined with the
  // spawner's post-eat grace period it was the second half of a 3.5-second gap
  // with nothing catchable on screen. 0.9s puts it in frame in about half a
  // second while still reading as a fish swimming in rather than appearing.
  const FISH_ARRIVAL_DURATION = 0.9;

  // ── Autonomous hunting ──────────────────────────────────────────────

  // How close a fish has to drift before the shark decides to go for it by
  // itself. CAMERA_VIEW_RADIUS is 11 (waves.ts), so 9 keeps the target
  // comfortably on screen for the whole stalk instead of having the shark
  // charge off toward something the child cannot see.
  //
  // This comment said 15 until the sweep caught it. 9 was still inside the real
  // radius, so the code was right and only the justification was wrong — which
  // is the dangerous version: the next person to retune this reads a headroom
  // of 6 units that is actually 2, and raises the number.
  const AUTO_HUNT_RADIUS = 9.0;

  // How long the shark waits, after the last time the child touched anything,
  // before it starts hunting on its own.
  //
  // WHY THIS EXISTS. Without it the auto-hunt is not a fallback, it is the
  // game. `maintainAutoHunt` runs as the first statement of every frame and
  // re-acquires the instant the FSM goes idle, against a reef the spawner holds
  // at 14-18 fish inside a 15-unit camera radius; a fish is essentially always
  // within 9 units, so idle never survives a frame. A probe that loaded the
  // game and touched nothing for a minute measured `autoHuntActive` on 100.0%
  // of frames and scored 0 — the shark hunted continuously and none of it
  // counted. That is the whole of "the shark auto hunts, it takes no input from
  // the user": a child watching a toy play itself, badly, while their own taps
  // arrive at an animal already busy with something else.
  //
  // 3.5 s is long enough that a child tapping at any sort of pace keeps the
  // shark theirs for the whole session, and short enough that a toy set down on
  // the sofa comes back to life before it looks broken.
  const AUTO_HUNT_IDLE_DELAY = 3.5;

  // The nearest a fish may be for the shark to decide to hunt it, and how long
  // the shark rests between its own hunts.
  //
  // WHY THESE EXIST. The delay above fixed *when* the auto-hunt runs; it did
  // nothing about what the auto-hunt does once it starts, and what it did was
  // not a stalk. Instrumented over three unattended minutes it started 2,472
  // hunts (824/min) at a mean acquisition distance of 1.56 units — already
  // inside STRIKE_RANGE, and a third of the way inside FISH_HIT_RADIUS from the
  // first frame. Mean hunt lifetime was 0.055s against the FSM's own designed
  // 0.71s cycle, `celebrate` and `recovery` had 0.0% frame occupancy (the FSM
  // never once reached its ending), and the loop closed on itself: contact
  // squirted the fish clear, the squirt cancelled the hunt, and the next frame
  // re-acquired the same fish. What a child who set the toy down actually saw
  // was a shark swinging its nose 2.11 rad/s with 5.8 direction reversals a
  // second, covering 1,683 units of ground to move 56, batting ~19 fish a
  // second aside. That is the opposite of `soul.md` §5 — "never frantic...
  // ambient animations breathe at the pace of a sleeping cat... the world waits
  // patiently for the child to engage."
  //
  // Both numbers were swept rather than guessed (minRange 3-6 x cooldown
  // 1.5-4.0, then the shortlist re-run over 8 seeds and judged on the WORST
  // seed against criteria fixed in advance: acquisition >= 3u, lifetime >= the
  // designed 0.71s, <= 2.0 reversals/s, <= 20 hunts/min, idle <= 75% so the fix
  // is not just an off switch). All four finalists passed; 6.0/4.0 won on the
  // one axis that separated them, fish displaced per minute — 58 against 82-127
  // for the others, and 1,116 for the shipped game.
  //
  // 6.0 is chosen against AUTO_HUNT_RADIUS 9.0, so the shark hunts out of a
  // 6-9 unit band and every hunt has an approach long enough to read.
  const AUTO_HUNT_MIN_RANGE = 6.0;
  const AUTO_HUNT_COOLDOWN = 4.0;

  // Seconds since the child last touched the screen. Starts at 0, so the first
  // few seconds of a session belong to the player rather than to the shark.
  let secondsSinceInput = 0;

  // Called by every input entry point. A tap on coral is not a movement command
  // but it is still the child playing, so it counts: the shark should not wander
  // off to hunt while they are poking the reef.
  function noteInput(): void {
    secondsSinceInput = 0;
  }

  // Returns the fish that owns a root object, or null if it has been pooled.
  function fishForRoot(root: Object3D | null): FishState | null {
    if (!root) return null;
    if (goldenFish && goldenFish.root === root) return goldenFish;
    for (const f of fishArray) if (f.root === root) return f;
    return null;
  }

  // True while the shark is chasing a fish it picked out for itself.
  //
  // This is the flag that decides whether a catch belongs to the child, and it
  // has to be provenance rather than kinematics. The first attempt at this gate
  // asked whether the shark was moving fast enough to be under a finger, and it
  // changed the measured idle score rate by nothing at all (72 -> 81 points a
  // minute, i.e. noise) — because an auto-hunt looks exactly like a lunge from
  // the outside. Same speeds, same animation, same everything. The only thing
  // that distinguishes them is who started it, so that is what gets recorded.
  let autoHuntActive = false;

  // Seconds left before the shark is allowed to pick its own next target.
  let autoHuntCooldown = 0;

  // Keeps the shark hunting on its own.
  //
  // Taps now resolve their own catch (see `chaseFish`), so without this the
  // hunt FSM would only ever sit idle and the shark would do nothing unless
  // touched. A shark that stalks and lunges at whatever swims past is the
  // behaviour that makes the toy worth watching between taps, and it is also
  // what the collision test at FISH_HIT_RADIUS exists to resolve.
  //
  // Deliberately yields to the child: no auto-hunt while a drag or a lunge is
  // in flight, because those are direct instructions about where to go.
  function maintainAutoHunt(dt: number): void {
    // Drop a target that has been eaten, culled or recycled out from under us —
    // the FSM would otherwise steer at a pooled root sitting at the last
    // position it happened to be left in.
    if (huntState.targetFishRoot) {
      const target = fishForRoot(huntState.targetFishRoot);
      if (!target || !target.active || target.spawning) cancelHunt(huntState);
    }
    // No hunt in flight means nothing the shark decided for itself is pending,
    // so the flag must drop here rather than only when a new hunt starts —
    // otherwise it latches true after the first auto-hunt and permanently
    // disables the drag-into-fish catch the child is entitled to.
    if (getHuntPhase(huntState) === 'idle') {
      // A hunt of the shark's own that has just ended buys the rest. Set here
      // rather than in the FSM because only this function knows whether the
      // hunt that ended was the shark's idea or the child's — a tap-driven hunt
      // must never leave the shark unable to respond to the next tap.
      if (autoHuntActive) autoHuntCooldown = AUTO_HUNT_COOLDOWN;
      autoHuntActive = false;
    }
    if (getHuntPhase(huntState) !== 'idle') return;
    if (sharkMove.isBeingDragged || sharkMove.isLunging) return;
    // The attention gate. Everything below this line is attract behaviour for a
    // shark nobody is currently playing with.
    if (secondsSinceInput < AUTO_HUNT_IDLE_DELAY) return;
    if (autoHuntCooldown > 0) {
      autoHuntCooldown -= dt;
      return;
    }

    let best: FishState | null = null;
    let bestDistSq = AUTO_HUNT_RADIUS * AUTO_HUNT_RADIUS;
    const minRangeSq = AUTO_HUNT_MIN_RANGE * AUTO_HUNT_MIN_RANGE;
    const consider = (fish: FishState | null): void => {
      if (!fish || !fish.active || fish.spawning) return;
      const dx = fish.root.position.x - sharkPos.x;
      const dz = fish.root.position.z - sharkPos.z;
      const d = dx * dx + dz * dz;
      // A fish already under the shark's nose cannot be stalked, only bumped.
      // Refusing it here is what turns the acquisition distance from 1.56 units
      // into 6.4 and gives the hunt an approach the eye can follow.
      if (d < minRangeSq) return;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = fish;
      }
    };
    for (const f of fishArray) consider(f);
    // The golden is deliberately NOT considered.
    //
    // This is a deduction, not a tuning preference. The harvest gate below is
    // `isPlayerDriven(sharkMove) && !autoHuntActive`, and `autoHuntActive` is
    // true for every frame from `triggerHunt` until the phase returns to idle.
    // So an auto-hunt on the golden cannot end in a catch — not rarely, but
    // never, by construction. What it CAN do is arrive, fail, and spend the
    // fish: `dodgeCount` is a lifetime budget capped at `GOLDEN_MAX_DODGES`,
    // and a staged encounter measured the shark burning all 2 of them before
    // the child's finger ever touched the screen (200/200 trials, mean budget
    // remaining at handover 0.00 against a control of 2.00).
    //
    // That is the whole of the golden fish's game handed to nobody. The prize
    // fish belongs to the child; the shark may not spend it on an errand the
    // rules forbid it from completing.
    if (!best) return;
    const target: FishState = best;
    // Deliberately does NOT mark the target. This used to write
    // `target.isTargeted = true`, a flag meaning "the child has claimed this
    // fish" whose only reader was the golden fish's dodge gate. The shark
    // noticing a fish is not the child claiming it, and writing it here
    // permanently disarmed the prize fish — over 200 seeded encounters, a golden
    // the auto-hunt had glanced at dodged 0.00 times against a control of 1.00,
    // in 200/200 trials. The flag is gone; see the note in types.ts.
    autoHuntActive = true;
    triggerHunt(huntState, target.root);
  }

  // ── Update subsystems ───────────────────────────────────────────────

  /**
   * Updates shark movement, rotation, hunt FSM, and applies to mesh.
   *
   * @param dt - Frame delta time in seconds.
   */
  function updateSharkMovement(dt: number): void {
    secondsSinceInput += dt;
    maintainAutoHunt(dt);
    const huntPhase = getHuntPhase(huntState);

    // Hunt FSM drives movement when not idle
    if (huntPhase !== 'idle') {
      updateHuntFSM(huntState, sharkMove, dt, {
        onStrike: () => {
          // Speed lines on strike
          if (speedLineState) triggerSpeedLines(speedLineState, 0.25);
        },
        onCelebrate: () => {
          triggerBarrelRoll(sharkAnim);
        },
        // The miss beat reuses the gesture the game already plays when the
        // child's own lunge comes up empty (see the `wasLunging` branch below),
        // so a shark that misses looks the same whoever was driving.
        onMiss: () => {
          triggerHeadLook(sharkAnim);
        },
      });
      // Face the direction of travel during the hunt.
      //
      // Defect 6: this used to snap rotY straight to the velocity heading — an
      // effectively infinite turn rate, against 1.05 rad/s while idle and 7.85
      // rad/s mid-lunge. The shark would pivot like a compass needle the instant
      // a hunt began and then crawl around when it ended. All three now go
      // through steerTowardAngle with the same two rates (see movement.ts).
      if (Math.abs(sharkMove.velX) > 0.01 || Math.abs(sharkMove.velZ) > 0.01) {
        sharkMove.rotY = steerTowardAngle(sharkMove.rotY, Math.atan2(-sharkMove.velZ, sharkMove.velX), TURN_RATE_HUNT, dt);
      }
      // Apply position from hunt FSM
      if (sharkRoot) applyToMesh(sharkMove, sharkRoot);
      sharkPos.x = sharkMove.posX;
      sharkPos.z = sharkMove.posZ;
    } else {
      // Normal movement when not hunting
      const wasLunging = sharkMove.isLunging;
      if (sharkMove.swimPhase !== 'idle') {
        updateSwim(sharkMove, dt);
      } else if (!sharkMove.isBeingDragged) {
        updateIdleDrift(sharkMove, dt);
      } else {
        updateSpringFollow(sharkMove, dt);
      }
      updateRotation(sharkMove, dt);
      if (sharkRoot) applyToMesh(sharkMove, sharkRoot);
      sharkPos.x = sharkMove.posX;
      sharkPos.z = sharkMove.posZ;

      if (!sharkMove.isLunging && wasLunging) {
        const near = fishArray.some((f) => f.active && Math.hypot(sharkMove.posX - f.root.position.x, sharkMove.posZ - f.root.position.z) < 2.0);
        if (!near) triggerHeadLook(sharkAnim);
      }
    }

    // Update expression mood based on hunt phase
    const targetMood = getMoodForPhase(huntPhase);
    setMood(expressionState, targetMood);
    updateExpressions(expressionState, dt);
  }

  /**
   * Updates all shark animations driven by mood and speed.
   * @param dt - Frame delta time in seconds.
   */
  function updateSharkAnimations(dt: number): void {
    const speed = getSpeed(sharkMove);
    const mood = getMoodParams(expressionState);

    // Tail wag modulated by mood
    if (tailMeshes.length > 0) {
      // Temporarily scale animation params by mood multipliers
      const origTailPhase = sharkAnim.tailPhase;
      updateTailWag(tailMeshes, sharkAnim, speed * mood.tailFreqMult, dt);
      // Apply amplitude modulation by scaling the result
      for (const tail of tailMeshes) {
        tail.rotation.y *= mood.tailAmpMult;
      }
      void origTailPhase; // used for type-checking only
    }

    if (sharkBody) {
      updateBodyWobble(sharkBody, elapsedTime, speed * mood.bodyWobbleMult);
      updateBreathing(sharkBody, elapsedTime);
    }

    // Eye scale driven by mood
    if (eyeMeshes.length > 0) {
      updateEyeBlink(eyeMeshes, sharkAnim, dt);
      for (const eye of eyeMeshes) {
        eye.scale.y *= mood.eyeScaleY;
      }
    }

    if (sharkRoot) {
      updateBarrelRoll(sharkRoot, sharkAnim, dt);
      updateHeadLook(sharkRoot, sharkAnim, dt);
    }
  }

  /**
   * Updates proximity-based spawning and culls distant fish.
   * @param dt - Frame delta time in seconds.
   */
  function updateSpawning(dt: number): void {
    if (!spawnState) return;

    // Defect 3: the spawner used to hold a hard-coded 2 fish near the shark for
    // the entire session. The reef now fills up as the child gets better.
    //
    // During the frenzy the target doubles. This is the payoff itself, not a
    // difficulty change: Ronimus et al. (2014) found difficulty ramps buy no
    // engagement even at age seven, whereas an escalating REWARD is a different
    // lever, and there is no fail state for it to make harsher.
    //
    // ...and again by up to half inside a coloured region, which is what makes a
    // region a destination rather than a paint job: the reef really is richer
    // there. `updateProximitySpawning` rounds this, and the cap it measures the
    // replenish burst against is derived from the same target, so enrichment
    // cannot push the population past the ceiling arithmetic in waves.ts.
    const frenzyOn = frenzyState !== null && isFrenzyActive(frenzyState);
    const targetNearby = getTargetFishCount(context.difficulty.level) * (frenzyOn ? 2 : 1) * regionFishMultiplier(sharkPos.x, sharkPos.z);

    updateProximitySpawning(
      spawnState,
      dt,
      sharkPos.x,
      sharkPos.z,
      {
        spawnFish: (edgeX: number, edgeZ: number, targetX: number, targetZ: number) => {
          // Hard ceiling, independent of the spawner's arithmetic.
          //
          // THIS LINE WAS THE BUG THE WHOLE TIME, and the comment that used to
          // sit here was the reason nobody looked at it. It said that anything
          // beyond 3x MAX_FISH_COUNT "has drifted out of the camera radius and
          // is waiting to be culled" — an assumption, never checked, and false,
          // because CULL_DISTANCE was 35 against a camera radius of 11, so a
          // fish in that 11-to-35 shell was neither counted nor reclaimed.
          //
          // A watched 200-second playthrough shows `active` climbing to exactly
          // 54 by t=46 s and pinning there. Pinned, this early return fires on
          // every spawn request for the rest of the session: the reef cannot
          // place another fish, and the school the child can actually see decays
          // from 47 to 0 as the shark swims away from its own abandoned stock.
          // Nine sessions of headless statistics missed it because the probe's
          // shark never eats, so it never drives the replenish burst that runs
          // the population up here in the first place.
          //
          // It stays, as a genuine safety valve rather than a load-bearing one:
          // the burst is now capped against the target (REPLENISH_HEADROOM), the
          // cull radius is inside the fog wall (CULL_DISTANCE), and the number
          // itself is derived from what the spawner can legitimately want rather
          // than from a round multiple (FISH_HARD_CEILING, waves.ts).
          if (countActiveFish() >= FISH_HARD_CEILING) return;
          const fish = acquireFish('standard');
          fish.root.position.set(edgeX, 0, edgeZ);
          fish.spawning = true;
          fish.spawnTimer = FISH_ARRIVAL_DURATION;
          fish.spawnEdgeX = edgeX;
          fish.spawnEdgeZ = edgeZ;
          fish.driftCenterX = targetX;
          fish.driftCenterZ = targetZ;
        },
        spawnGoldenFish: () => {
          // Placed on a ring around the shark rather than anywhere in the
          // 100x100 reef. Uniform placement in a square that large puts the
          // median golden 40 units out, and legibility is gone past 20 (see
          // CAMERA_VIEW_RADIUS in waves.ts), so the reward fish spent almost
          // all of its life invisible. GOLDEN_SPAWN_RING is inside the fog
          // wall but outside the shark's immediate reach, so it arrives as
          // something the child can see coming.
          if (goldenFish) return;
          const angle = Math.random() * Math.PI * 2;
          goldenFish = createFish(scene, sharkPos, 'golden', [
            clamp(sharkPos.x + Math.cos(angle) * GOLDEN_SPAWN_RING, -BOUNDS, BOUNDS),
            clamp(sharkPos.z + Math.sin(angle) * GOLDEN_SPAWN_RING, -BOUNDS, BOUNDS),
          ]);
        },
        countNearbyFish: () => {
          let count = 0;
          for (const f of fishArray) {
            if (!f.active) continue;
            // An inbound fish counts as nearby even though it is still outside
            // CAMERA_VIEW_RADIUS: it was spawned specifically to arrive next to
            // the shark, so it is already on order.
            //
            // Skipping them here was the whole bug. `updateProximitySpawning`
            // fills `target - nearbyCount` EVERY frame, and the arrival
            // animation runs for 1.5s, so a fish in flight never counted
            // against the target it was ordered to satisfy: 60fps x 1.5s x a
            // target of 3 = ~270 fish before the first one became catchable —
            // and until it landed, nothing was edible or tappable at all.
            if (f.spawning) {
              count++;
              continue;
            }
            const dx = f.root.position.x - sharkPos.x;
            const dz = f.root.position.z - sharkPos.z;
            if (dx * dx + dz * dz < CAMERA_VIEW_RADIUS * CAMERA_VIEW_RADIUS) count++;
          }
          return count;
        },
      },
      targetNearby,
    );

    // Recycle fish that have fallen behind the shark, back into the pool.
    //
    // Through the despawn animation rather than `deactivateFish` directly. The
    // direct call switched `visible` off on the frame the threshold was crossed;
    // at CULL_DISTANCE 22 that is provably below the fog's just-noticeable
    // difference (see waves.ts), but a 0.2 s scale-to-zero costs nothing and
    // means the margin does not have to be exactly right. The existing despawn
    // branch in updateFishAndCollisions runs the animation and calls
    // `deactivateFish` when it completes, which is what returns the fish to the
    // pool `acquireFish` searches.
    for (const fish of fishArray) {
      if (!fish.active || fish.spawning) continue;
      const dx = fish.root.position.x - sharkPos.x;
      const dz = fish.root.position.z - sharkPos.z;
      if (dx * dx + dz * dz > CULL_DISTANCE * CULL_DISTANCE) {
        fish.active = false;
        fish.despawnTimer = FISH_DESPAWN_SCALE_DURATION;
      }
    }

    // The golden fish is not in `fishArray`, so the loop above never saw it and
    // it was the one fish in the game that could never be culled. An uncaught
    // golden therefore drifted away and stayed alive at the far end of the reef
    // holding `goldenActive` true forever, which meant no second golden for the
    // rest of the session.
    if (goldenFish && goldenFish.active && !goldenFish.spawning) {
      const gdx = goldenFish.root.position.x - sharkPos.x;
      const gdz = goldenFish.root.position.z - sharkPos.z;
      if (gdx * gdx + gdz * gdz > CULL_DISTANCE * CULL_DISTANCE) {
        disposeFish(goldenFish);
        goldenFish = null;
        if (spawnState) notifyGoldenLost(spawnState);
      }
    }
  }

  /**
   * Updates all environment systems (caustics, sway, reactions, ambient, surprises).
   * @param dt - Frame delta time in seconds.
   * @param seaweedBoosts - Tapped-seaweed boost timers from the interaction state.
   */
  function updateEnvironmentSystems(dt: number, seaweedBoosts: ReadonlyMap<Object3D, number>): void {
    if (env) {
      // Defect 10: caustics orbited the origin and the god rays never turned to
      // face anything. Both now track the shark and the live camera.
      updateCausticLights(env.causticLights, elapsedTime, sharkPos.x, sharkPos.z);
      updateGodRays(env.waterSurface, shellCam);
      // Defect 4: `seaweedBoosts` is the map that used to be discarded, so a
      // tapped plant made a rustle and stood perfectly still.
      updateSeaweedSway(env.seaweeds, elapsedTime, seaweedBoosts);
      updateAnemoneSway(env.anemones, elapsedTime);
      updateEnvironmentReactions(sharkPos.x, sharkPos.z, env, dt, elapsedTime);
      env.waterSurface.position.y = 2.5 + Math.sin(elapsedTime * 0.15) * 0.03;
    }
    // The reef converges on the shark as the frenzy builds. Measured reason:
    // .probe/session-phase.mjs showed the frenzy on its own changed only ~6% of
    // the salient event stream while ambient traffic, over half of it, carried
    // on unchanged — and the detection threshold for temporal structure sits at
    // 8-10%. A payoff the world does not react to is not a payoff.
    if (ambientCreatures) updateAmbientCreatures(ambientCreatures, dt, elapsedTime, sharkPos.x, sharkPos.z, frenzyState ? frenzyGather(frenzyState) : 0);
    // Defect 9: surprises are staged around the shark, not the world origin.
    // F3: they used to be the only silent events in the game; `context.audio`
    // is threaded in so each one announces itself.
    if (surpriseState && env) updateSurprises(surpriseState, elapsedTime, dt, env, scene, sharkPos.x, sharkPos.z, context.audio);
  }

  // Reacts once to a frenzy phase transition. Kept beside the environment
  // systems because everything it touches is presentation: the arc itself lives
  // in the pure `frenzy.ts` so the probe can drive the real logic headlessly.
  function applyFrenzyEvent(event: FrenzyEvent | null): void {
    if (!event) return;
    if (event.phase === 'brewing') {
      // Anticipation is most of the value, and it is the one thing a flat loop
      // can never have. This is the cue that says "something is about to
      // happen" without requiring a numeral to be read.
      context.audio.playSound('seaweed-rustle');
      if (colorFlashState) triggerColorFlash(colorFlashState, new Color(1.0, 0.72, 0.15), 0.5, 0.1);
    } else if (event.phase === 'frenzy') {
      context.audio.playSound('shark-happy');
      context.audio.playSound('golden-catch');
      if (vignetteState) triggerVignette(vignetteState, 0.5, 0.18);
      if (colorFlashState) triggerColorFlash(colorFlashState, new Color(1.0, 0.85, 0.3), 0.5, 0.18);
      if (cameraState) triggerScreenShake(cameraState, 0.25, 0.05);
      // Pull a surprise into the payoff window, so the biggest moment in the
      // loop is also the moment something new shows up.
      //
      // THIS LINE WAS WRITTEN AS A FIX AND IT FIXED NOTHING. It was aimed at a
      // measured regression -- with the reef gathering, `monotonousFrac` at the
      // pessimistic arm rose from 0.074 to about 0.13 -- and at N=8 over 600 s it
      // moved that number from 0.121 +- 0.040 to 0.128 +- 0.039, which is to say
      // not at all, and left every other statistic identical. The arithmetic I
      // should have done first: this fires at most once per frenzy cycle, about
      // ten times in a ten-minute session against ~665 events, so ~1.5% of the
      // stream, against a detection threshold of 8-10%.
      //
      // The regression it was chasing then turned out not to be a regression.
      // Relabelling ambient arrivals by species -- jellyfish, squid, crab,
      // octopus, four animals the game already renders differently -- drops
      // `monotonousFrac` to 0.000 in BOTH arms, while the label-free `burstZ` is
      // unchanged either way (3.456 vs 3.443). A statistic that reads 0.13 under
      // one naming and 0.000 under another was measuring my naming.
      //
      // It stays because a surprise inside the payoff window is right on its own
      // terms, not because it earned its place on the instrument.
      if (surpriseState) nudgeSurpriseSoon(surpriseState);
    } else if (event.phase === 'afterglow') {
      context.audio.playSound('treasure-jingle');
    }
  }

  /**
   * Updates all fish (drift, dodge, spawn, despawn) and checks collisions.
   * @param dt - Frame delta time in seconds.
   * @param speedMultiplier - Difficulty-driven speed multiplier.
   * @param evasiveness - Difficulty-driven fish evasion strength in [0, 1].
   */
  function updateFishAndCollisions(dt: number, speedMultiplier: number, evasiveness: number): void {
    const allFish: FishState[] = [...fishArray];
    if (goldenFish) allFish.push(goldenFish);
    for (const fish of allFish) {
      if (!fish.active) {
        if (fish.despawnTimer > 0) {
          const done = updateDespawnAnimation(fish, dt);
          if (done) {
            if (fish === goldenFish) {
              disposeFish(fish);
              goldenFish = null;
            } else {
              deactivateFish(fish);
            }
          }
        }
        continue;
      }
      if (fish.spawning) {
        fish.spawnTimer -= dt;
        const t = clamp(1.0 - fish.spawnTimer / FISH_ARRIVAL_DURATION, 0, 1);
        const eased = t * t * (3 - 2 * t);
        fish.root.position.x = fish.spawnEdgeX + (fish.driftCenterX - fish.spawnEdgeX) * eased;
        fish.root.position.z = fish.spawnEdgeZ + (fish.driftCenterZ - fish.spawnEdgeZ) * eased;
        if (fish.spawnTimer <= 0) fish.spawning = false;
        continue;
      }
      updateFishDrift(fish, dt, speedMultiplier, sharkPos.x, sharkPos.z, evasiveness);
      if (fish.kind === 'golden') updateGoldenDodge(fish, sharkPos.x, sharkPos.z, dt, evasiveness);
    }

    // Collision detection — standard fish.
    //
    // Inbound fish are included: they are fully drawn and swimming through the
    // play area for 1.5s, so a shark that runs into one must eat it. Excluding
    // them meant nothing on screen was edible during the arrival window.
    //
    // Contact only counts when the child put the shark there. It used to count
    // unconditionally, and an unconditional mouth on an animal that drifts in a
    // figure-eight AND stalks on its own, through water the spawner keeps aiming
    // fish into, is a machine for playing itself: a probe that loaded the game
    // and then touched nothing scored 24 out of 24 slots and 72 points a minute,
    // scoring in 49% of all one-second intervals.
    //
    // Both clauses are load-bearing and neither is sufficient. `isPlayerDriven`
    // alone leaves the auto-hunt, which moves at lunge speed and so reads as
    // player-driven; `!autoHuntActive` alone leaves the idle drift, which is
    // slow but still sweeps up fish the spawner delivers to it.
    //
    // Fish that survive on this rule are pushed clear rather than left standing
    // inside the shark. That is not a consolation prize: the shark visibly
    // stalking a fish and having it slip away is a better thing for a three-year
    // -old to watch than the shark quietly eating the reef, and it leaves the
    // fish on screen for the child to claim.
    //
    // That defence was written about a stalk the game did not actually perform.
    // The squirt used to cancel the hunt as well, and because STRIKE_RANGE (1.5)
    // is larger than FISH_HIT_RADIUS (1.0), contact ALWAYS arrived before the
    // 0.2s strike timer could expire — so the cancel was not an edge case, it
    // was the universal terminator. Measured: 2,471 of 2,472 unattended hunts
    // ended on contact and 0 ever reached `celebrate`. The shark never slipped;
    // it was interrupted mid-swing, every time, by design it did not intend.
    // The squirt now stands on its own and the hunt is allowed to finish.
    const canHarvest = isPlayerDriven(sharkMove) && !autoHuntActive;
    for (let i = fishArray.length - 1; i >= 0; i--) {
      const fish = fishArray[i];
      if (!fish.active) continue;
      const ex = sharkPos.x - fish.root.position.x;
      const ez = sharkPos.z - fish.root.position.z;
      if (Math.sqrt(ex * ex + ez * ez) >= FISH_HIT_RADIUS) continue;
      if (canHarvest) {
        eatFishAction(fish);
      } else {
        escapeFromShark(fish, sharkPos.x, sharkPos.z);
      }
    }
    // Collision detection — golden fish
    if (goldenFish && goldenFish.active && !goldenFish.spawning && !canHarvest) {
      const gx = sharkPos.x - goldenFish.root.position.x;
      const gz = sharkPos.z - goldenFish.root.position.z;
      if (Math.sqrt(gx * gx + gz * gz) < GOLDEN_HIT_RADIUS) {
        escapeFromShark(goldenFish, sharkPos.x, sharkPos.z);
      }
    }
    if (canHarvest && goldenFish && goldenFish.active && !goldenFish.spawning) {
      const gx = sharkPos.x - goldenFish.root.position.x;
      const gz = sharkPos.z - goldenFish.root.position.z;
      if (Math.sqrt(gx * gx + gz * gz) < GOLDEN_HIT_RADIUS) {
        // `eatFishAction` → `playCatchCelebration` already fires the golden
        // milestone (see celebrations.ts). Firing a second one here made every
        // golden catch play the fanfare twice.
        eatFishAction(goldenFish);
      }
    }
  }

  /**
   * Updates camera follow, VFX, and screen effects.
   * @param dt - Frame delta time in seconds.
   */
  function updateCameraAndEffects(dt: number): void {
    // Follow camera
    if (cameraState) {
      updateFollowCamera(cameraState, shellCam, sharkPos.x, sharkPos.z, dt);
    }

    // Screen effects
    if (vignetteState) updateVignette(vignetteState, dt);
    if (speedLineState) updateSpeedLines(speedLineState, dt);
    if (colorFlashState) updateColorFlash(colorFlashState, dt);

    // Bubble trails — tick active trails, remove expired
    for (let i = activeBubbleTrails.length - 1; i >= 0; i--) {
      const alive = activeBubbleTrails[i].update(dt);
      if (!alive) {
        activeBubbleTrails[i].dispose();
        activeBubbleTrails.splice(i, 1);
      }
    }

    // Spawn bubble trail behind swimming shark periodically
    if (getSpeed(sharkMove) > 1.0 && sharkRoot && Math.random() < dt * 3.0) {
      const dir = new Vector3(-Math.sin(sharkMove.rotY) * 0.5, 0.3, -Math.cos(sharkMove.rotY) * 0.5);
      const trail = createBubbleTrail(scene, sharkRoot.position.clone(), dir);
      activeBubbleTrails.push(trail);
    }
  }

  // ── Game implementation ─────────────────────────────────────────────

  const game: IMiniGame = {
    id: 'little-shark',

    async setup(): Promise<void> {
      env = setupScene(scene, context.disposal);

      // The shell already positioned shellCam from the manifest camera
      // descriptor; the follow cam (createCameraState below) drives it from here.
      // Lights are added to the scene by the lighting rig (see setupScene).

      ambientCreatures = createAmbientCreatures(scene);
      const sharkResult = buildSharkEntity(scene, sharkPos);
      sharkRoot = sharkResult.sharkRoot;
      sharkBody = sharkResult.sharkBody;
      sharkGlowTrail = sharkResult.sharkGlowTrail;
      tailMeshes = sharkResult.tailFins;
      eyeMeshes = sharkResult.eyes;

      // Initialize camera system
      cameraState = createCameraState(shellCam);

      // THE SHELL CAMERA HAS TO BE IN THE SCENE GRAPH OR NOTHING PARENTED TO IT
      // IS EVER DRAWN.
      //
      // This was found by screenshot, not by reading: the new build meter was
      // wired, compiled, positioned by trigonometry that checked out, and
      // completely absent from the render. `WebGLRenderer.render` walks `scene`
      // to build the render list — `projectObject(scene, ...)` — and the shell
      // (MiniGameShell.tsx:116) creates the camera but never adds it to the
      // scene. Camera children therefore get correct world matrices (the
      // renderer does call `camera.updateMatrixWorld()`, which recurses) and are
      // then never visited by the render list walk.
      //
      // The meter is not the only casualty. The vignette, the speed lines and
      // the colour flash below have used `camera.add` since they were written,
      // which means three of this game's screen-feedback channels have been
      // firing into a void for their entire existence — the golden-catch flash,
      // the lunge speed lines and the catch vignette all did nothing on screen.
      // Adding the camera to the scene is one line and repairs all four at once.
      scene.add(shellCam);

      // Initialize screen effects (parented to camera)
      vignetteState = createVignette(shellCam);
      speedLineState = createSpeedLines(shellCam);
      colorFlashState = createColorFlash(shellCam);
      frenzyHud = createFrenzyHud(shellCam);
    },

    start(): void {
      paused = false;
      elapsedTime = 0;
      eatAnimTimer = -1;
      firstCatchDone = false;
      sharkAnim = createSharkAnimState();
      sharkMove = createSharkMoveState();
      sharkPos.set(0, 0, 0);
      secondsSinceInput = 0;
      context.score.reset();
      context.combo.reset();
      for (const f of fishArray) disposeFish(f);
      fishArray.length = 0;
      if (goldenFish) {
        disposeFish(goldenFish);
        goldenFish = null;
      }
      spawnState = createProximitySpawnState();
      surpriseState = createSurpriseState();
      frenzyState = createFrenzyState();
      if (frenzyHud) updateFrenzyHud(frenzyHud, 0, 'calm', 1);
      celebrations.clear();
      interactionState.clear();
      interactionState = createInteractionState();

      // Reset Phase 3 systems
      huntState = createHuntFSMState();
      expressionState = createExpressionState();

      // Reset camera
      if (cameraState) resetCamera(cameraState, shellCam);

      let lastMilestoneScore = 0;
      const maxScheduled = MILESTONE_SCHEDULE.length > 0 ? MILESTONE_SCHEDULE[MILESTONE_SCHEDULE.length - 1].score : 0;
      // Score milestones belong to no single fish, so they play at the middle
      // of the view. They used to pass (0, 0) — now that celebrations actually
      // render, that would have fired every burst off in the top-left corner.
      const midX = (): number => context.viewport.width / 2;
      const midY = (): number => context.viewport.height / 2;
      unsubScore = context.score.onScoreChanged((newScore: number) => {
        for (const ms of MILESTONE_SCHEDULE) {
          if (newScore >= ms.score && lastMilestoneScore < ms.score) {
            context.celebration.milestone(midX(), midY(), ms.size);
            lastMilestoneScore = ms.score;
          }
        }
        if (newScore > maxScheduled) {
          const rm = maxScheduled + Math.floor((newScore - maxScheduled) / MILESTONE_REPEAT_INTERVAL) * MILESTONE_REPEAT_INTERVAL;
          if (rm > lastMilestoneScore) {
            context.celebration.milestone(midX(), midY(), 'medium');
            lastMilestoneScore = rm;
          }
        }
      });
    },

    update(deltaTime: number): void {
      if (paused) return;
      const dt = deltaTime;
      elapsedTime += dt;
      // Defect 3: `speedMultiplier` was halved right here, which cancelled most
      // of the ramp; `evasiveness` did not exist at all. Both now reach the fish.
      const speedMultiplier = getSpeedMultiplier(context.difficulty.level);
      const evasiveness = getFishEvasiveness(context.difficulty.level);

      if (eatAnimTimer > 0 && sharkBody) eatAnimTimer = updateEatAnimation(sharkBody, eatAnimTimer, dt);

      // Ticked before spawning and the environment so both read the same phase
      // this frame as the meter does.
      if (frenzyState) {
        applyFrenzyEvent(updateFrenzy(frenzyState, dt));
        if (frenzyHud) updateFrenzyHud(frenzyHud, frenzyIntensity(frenzyState), frenzyState.phase, dt);
      }

      updateSharkMovement(dt);
      updateSharkAnimations(dt);
      updateSpawning(dt);
      // Defect 4: tick interactions BEFORE the environment so the boost map is
      // current for this frame's sway, and so the return value is actually used.
      const seaweedBoosts = interactionState.update(dt);
      updateEnvironmentSystems(dt, seaweedBoosts);
      updateFishAndCollisions(dt, speedMultiplier, evasiveness);
      celebrations.update(dt);
      updateCameraAndEffects(dt);
    },

    pause(): void {
      paused = true;
    },

    resume(): void {
      paused = false;
    },

    teardown(): void {
      unsubScore?.();
      unsubScore = null;
      celebrations.clear();
      interactionState.clear();
      context.audio.stopMusic();

      // Dispose bubble trails
      for (const trail of activeBubbleTrails) trail.dispose();
      activeBubbleTrails.length = 0;

      // Dispose screen effects
      if (vignetteState && speedLineState && colorFlashState) {
        disposeScreenFx(vignetteState, speedLineState, colorFlashState);
        vignetteState = null;
        speedLineState = null;
        colorFlashState = null;
      }

      cameraState = null;

      if (sharkGlowTrail) {
        // Stop the stream; the shared glow batch is freed by the shell's
        // disposal scope. See architecture-standards.md#particleengine.
        sharkGlowTrail.stop();
        sharkGlowTrail = null;
      }
      for (const f of fishArray) disposeFish(f);
      fishArray.length = 0;
      if (goldenFish) {
        disposeFish(goldenFish);
        goldenFish = null;
      }
      if (sharkRoot) {
        disposeMeshDeep(sharkRoot);
        sharkRoot = null;
        sharkBody = null;
        tailMeshes = [];
        eyeMeshes = [];
      }
      if (ambientCreatures) {
        disposeAmbientCreatures(ambientCreatures);
        ambientCreatures = null;
      }
      if (env) {
        teardownScene(env);
        env = null;
      }
      // Undo the setup-time parenting. The shell owns the camera and outlives
      // this game, so leaving it attached to a torn-down scene would leak the
      // whole graph through one reference.
      scene.remove(shellCam);
      spawnState = null;
      surpriseState = null;
      frenzyState = null;
      if (frenzyHud) {
        disposeFrenzyHud(frenzyHud);
        frenzyHud = null;
      }
      huntState = createHuntFSMState();
      expressionState = createExpressionState();
      resetMeshIndex();
    },

    onResize(_viewport: ViewportInfo): void {
      if (!env) return;
    },

    onTap(event: MiniGameTapEvent): void {
      if (paused) return;
      noteInput();
      const pick = event.pickResult;
      if (!pick || !pick.hit || !pick.pickedMesh) {
        // Aim assist first. The raycast missing everything is a statement about
        // the reef geometry, not about the child's intent: a fish swimming over
        // open water above the floor's silhouette produces exactly this pick,
        // and until now it was the one branch of this handler that did not run
        // `findFishNearTap`. A tap two pixels either side of the floor's edge
        // therefore either caught a fish or did nothing, depending on scenery.
        const aimedMiss = findFishNearTap(event.screenX, event.screenY);
        if (aimedMiss) {
          chaseFish(aimedMiss);
          return;
        }
        // Defect 5: this used to be a bare `return`. A tap that hits nothing now
        // gets a bubble puff wherever the child actually touched, so the game
        // never looks frozen.
        const missPoint = tapToWaterPoint(event.screenX, event.screenY);
        if (missPoint) {
          handleMissedTap(scene, new Vector3(clamp(missPoint.x, -BOUNDS, BOUNDS), 0, clamp(missPoint.z, -BOUNDS, BOUNDS)), context.audio);
        }
        return;
      }
      const pickedMesh = pick.pickedMesh as Object3D;
      const kind = classifyPickedMesh(pickedMesh.name);
      switch (kind) {
        case 'fish': {
          // A visible fish is a tappable fish — the `!f.spawning` guard that
          // used to be here silently dropped every tap on a fish still swimming
          // in from the edge, which for the first 1.5s of a session is all of them.
          const fish = fishArray.find((f) => f.active && isDescendantOf(pickedMesh, f.root));
          if (fish) chaseFish(fish);
          break;
        }
        case 'golden': {
          if (goldenFish && goldenFish.active && isDescendantOf(pickedMesh, goldenFish.root)) {
            chaseFish(goldenFish);
          }
          break;
        }
        case 'shark': {
          if (sharkRoot) {
            handleSharkTap(sharkAnim, scene, sharkRoot, context.audio);
            setMood(expressionState, 'playful');
          }
          break;
        }
        case 'coral': {
          interactionState.handleCoralTap(pickedMesh, scene, context.audio);
          break;
        }
        case 'anemone': {
          // Defect 8: anemones matched no prefix and fell through to 'water',
          // so tapping one sent the shark diving at the seabed.
          interactionState.handleAnemoneTap(pickedMesh, scene, context.audio);
          break;
        }
        case 'seaweed': {
          interactionState.handleSeaweedTap(pickedMesh, context.audio);
          break;
        }
        case 'treasure': {
          interactionState.handleTreasureChestTap(pickedMesh, scene, context.audio);
          break;
        }
        case 'rock': {
          handleRockTap(pickedMesh, scene, context.audio);
          break;
        }
        case 'water':
        default: {
          // Aim assist. Measured: a 6x4 grid of 24 taps spread over the play
          // area landed on `terrain_reef_floor` 23 times and on a blade of
          // seaweed once — not one of them on a fish — and scored nothing,
          // because a water tap only ever steered the shark to that spot and
          // nothing in the game targets a fish on the child's behalf.
          //
          // A tap now snaps to the nearest fish within FISH_TAP_SNAP_RADIUS_PX
          // of the touch point and catches it. Taps in genuinely open water
          // still steer the shark, so the free-swimming half of the toy is
          // unchanged.
          const aimed = findFishNearTap(event.screenX, event.screenY);
          if (aimed) {
            chaseFish(aimed);
            break;
          }
          const wp = pick.pickedPoint;
          if (wp) {
            // Cancel any active hunt so the shark goes where you tap
            if (getHuntPhase(huntState) !== 'idle') {
              cancelHunt(huntState);
              sharkMove.velX = 0;
              sharkMove.velZ = 0;
            }
            const cx = clamp(wp.x, -BOUNDS, BOUNDS);
            const cz = clamp(wp.z, -BOUNDS, BOUNDS);
            startLunge(sharkMove, cx, cz, BOUNDS * 3);
            handleWaterTap(scene, new Vector3(cx, 0, cz), context.audio);
          }
          break;
        }
      }
    },

    onDrag(event: MiniGameDragEvent): void {
      if (paused) return;
      noteInput();
      // Cancel hunt when player drags — they want manual control
      if (getHuntPhase(huntState) !== 'idle') {
        cancelHunt(huntState);
        sharkMove.velX = 0;
        sharkMove.velZ = 0;
      }
      sharkMove.isBeingDragged = true;
      const pick = event.pickResult;
      if (pick && pick.hit && pick.pickedPoint) {
        sharkMove.targetX = clamp(pick.pickedPoint.x, -BOUNDS, BOUNDS);
        sharkMove.targetZ = clamp(pick.pickedPoint.z, -BOUNDS, BOUNDS);
      }
    },

    onDragEnd(_event: MiniGameDragEndEvent): void {
      noteInput();
      // Defect 7: this used to just clear the flag, so the shark stopped dead
      // the instant a finger lifted. releaseDrag keeps (and slightly boosts) the
      // velocity the drag built up and re-anchors idle drift ahead of the shark,
      // so a flick coasts out instead of hitting a wall.
      releaseDrag(sharkMove);
    },
  };

  return game;
}

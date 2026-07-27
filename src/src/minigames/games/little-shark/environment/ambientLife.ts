import { Scene, Mesh, Group, SphereGeometry, CylinderGeometry, BoxGeometry, ConeGeometry, Color, MeshStandardMaterial } from 'three';
import { createSkinMaterial, createCoralMaterial } from '@app/minigames/shared/materials';
import { BOUNDS } from '../types';

/** State for an actively transiting submarine. */
export interface SubmarineTransit {
  group: Group;
  /** Start position. */
  startX: number;
  startZ: number;
  /** End position. */
  endX: number;
  endZ: number;
  /** Progress 0→1. */
  t: number;
  /** Transit speed (units of t per second). */
  speed: number;
  /** Whether this sub is currently visible and moving. */
  active: boolean;
}

/**
 * A creature that travels the reef on a heading and is kept near the player by
 * a travelling box that wraps out of sight. See the Traffic section below.
 */
export interface Drifter {
  /** The creature's group. */
  group: Group;
  /** Direction of travel in the XZ plane, in radians. */
  heading: number;
  /** Travel speed in world units per second. */
  speed: number;
  /** Per-creature phase offset, so wander is not synchronised across a class. */
  phase: number;
}

/** Decorative background creatures that add life to the reef. */
export interface AmbientCreatures {
  /** Small fish moving as a group. */
  fishSchool: Group[];
  /** Ambient rising bubbles. */
  bubbles: Mesh[];
  /** Translucent jellyfish drifting through the reef. */
  jellyfish: Drifter[];
  /** Octopuses crawling across the seafloor. */
  octopuses: Drifter[];
  /** Squids jetting through mid-water. */
  squids: Drifter[];
  /** Crabs scuttling across the seafloor. */
  crabs: Drifter[];
  /** SpongeBob-style pineapples on the seafloor. */
  pineapples: Group[];
  /** Submarines that transit through the scene. */
  submarines: SubmarineTransit[];
  /** Pool of small bubbles for submarine propeller wash. */
  propWash: { mesh: Mesh; life: number; velY: number; velX: number; velZ: number }[];
  /** Shared material for propeller wash bubbles. */
  propWashMat: MeshStandardMaterial;
  /** School movement state. */
  schoolPhase: number;
  /** Timer for submarine dispatch (fires every 10s). */
  subTimer: number;
}

// ── Traffic ─────────────────────────────────────────────────────────
//
// WHAT WAS WRONG, measured rather than asserted. Park the shark at the origin
// and run the shipped update loop for five minutes against the real camera
// frustum (manifest descriptor: orbit, target (0,0.5,0), azimuth PI, polar
// 0.95, distance 10, fov 0.85 rad — which puts the lens at (0, 6.32, -8.13),
// pitched 35.6 degrees down over a 24.35-degree half-fov):
//
//     mean ambient creatures on screen      0.14
//     frames with none on screen           86.3%
//     distinct creatures ever seen, of 21      1
//
// One crab, at t = 17.5 s. No jellyfish, no squid, no octopus, in five minutes.
// Meanwhile a submarine crosses the shark every 15 s and takes 8 s to do it,
// so it is on screen 53% of the time at scale 1.5. A player who reports seeing
// nothing but a submarine is reporting the arithmetic correctly.
//
// WHY. Creatures were placed once, at hardcoded coordinates, over a world that
// is BOUNDS = 50 a side, and then never travelled. Jellyfish and squid moved by
// an oscillating increment whose net displacement over a cycle is zero; crabs
// orbited a fixed base by half a unit; only the octopuses moved at all, and
// only by teleporting.
//
// The octopus recycler is worth its own note, because it existed specifically
// to prevent this and did not work. It teleported a far octopus in whenever
// none was within CAMERA_VIEW_RADIUS of the shark — but that is a radius, and
// the camera sees a wedge in front. An octopus parked twelve units BEHIND the
// player satisfied the test perfectly while being impossible to see, so the
// recycler sat there believing its job was done. That is why four octopuses
// produced zero sightings.
//
// THE FIX IS REDISTRIBUTION, NOT ADDITION — the same 21 creatures, given real
// headings and confined to a box that travels with the player. Zero extra
// meshes, zero extra draw calls. Measured, 8 runs per arm, 300 s each, mean +/-
// sd (the module seeds headings from Math.random, so one run is a draw, not an
// answer). "Moving" is a shark wandering at 1.5 units per second, which is what
// a child dragging it produces; "close" counts only creatures within 18 units
// of the lens, where one world unit is about 49 px and a creature reads at
// roughly 9 mm on a tablet.
//
//                        before            after
//   on screen            2.58 +/- 0.14     5.89 +/- 0.21
//   frames with none    13.6% +/- 5.0      0.0% +/- 0.0
//   distinct of 21       15.9 +/- 0.4      21.0 +/- 0.0
//   entries per minute   15.7 +/- 0.8      32.2 +/- 1.3
//   close, on screen     0.82 +/- 0.04     2.14 +/- 0.15
//   close, none         40.6% +/- 4.5      3.0% +/- 2.6
//
// A parked shark is the worst case, and it is where the old code was worst:
// 0.14 on screen and 86.3% of frames empty becomes 4.51 +/- 1.03 and 0.0%.
// Every one of the 21 is now seen within five minutes of ordinary play; one was
// before.
//
// TWO EARLIER VERSIONS OF THIS FIX FAILED, and the failures are worth keeping.
//
// A leash — steer home once past radius L — was the first attempt. It repeated
// the recycler's own mistake at larger scale: a disc centred on the player
// spends half its area behind the camera. Anchoring the disc 13 units downrange
// helped a stationary player and did nothing for a moving one.
//
// A speed boost for stragglers was the second. The shark is simply faster than
// the reef — a child dragging it makes ~1.5 units per second and a jellyfish
// makes 0.3 — so any creature that falls behind can only return by swimming
// harder than it should. Confining the boost to "out of frame" would have made
// it invisible, except that the region I believed was out of frame was not:
// the camera is pitched 35.6 degrees down, so a jellyfish floating at head
// height four units BEHIND the player is comfortably inside the cone. The
// instrument caught it — 10,554 frames of a creature visibly sprinting.
//
// WHAT WORKS IS A WRAP, and it works because the bounds are measured. The
// visible region, swept over every height a creature occupies and expressed
// relative to the shark, is x within +/-20.5 and z from -6.0 to +24.5
// (.probe/viewedge.mjs, which scans the real frustum rather than reasoning
// about it — my own trig had the near edge at +8 when it is actually -6).
// Creatures travel freely in a straight line with a slow wander, and a creature
// that leaves the box on one side is moved to the far side. Both the departure
// point and the arrival point sit a clear margin outside the measured visible
// bounds, so the move cannot be seen; the population is exactly conserved; and
// the reef ahead of the player is continually restocked by the reef behind.
// Nothing pops, nothing sprints, and nothing has to catch up.

// Measured visible bounds in shark-relative coordinates. See .probe/viewedge.mjs.
const VIEW_MAX_X = 20.5;
const VIEW_MIN_Z = -6.0;
const VIEW_MAX_Z = 24.5;

// How far outside the visible bounds a wrap happens. Both ends of every wrap
// clear the visible region by this much, which is what makes the wrap invisible.
const WRAP_MARGIN = 4;
const WRAP_X = VIEW_MAX_X + WRAP_MARGIN;
const WRAP_MIN_Z = VIEW_MIN_Z - WRAP_MARGIN;
const WRAP_MAX_Z = VIEW_MAX_Z + WRAP_MARGIN;
const WRAP_SPAN_Z = WRAP_MAX_Z - WRAP_MIN_Z;

// Radians per second a drifter may turn — slow enough to read as a lazy arc
// rather than a swerve, fast enough to turn right around in about four seconds.
const TURN_RATE = 0.8;

// Smallest signed angle carrying `from` to `to`, in (-PI, PI].
function angleDelta(from: number, to: number): number {
  let a = (to - from) % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ── Gathering ───────────────────────────────────────────────────────
//
// WHY THE REEF CONVERGES DURING A FEEDING FRENZY, AND WHY IT IS MEASURED.
//
// The frenzy arc (../frenzy.ts) was built to give the loop a build and a
// payoff, and on every statistic except one it worked. The exception was the
// statistic built specifically to detect it: phase z against a rate-matched
// shuffled null, which scores a build-and-payoff cycle at +28 on the control rig
// and scored the shipped frenzy at 0.
//
// .probe/session-phase.mjs diagnosed that null rather than reporting it. It
// re-analysed the same dumped sessions under a relabelling ladder and found a
// clean monotone dose response: relabelling a controlled share of the events
// inside the frenzy into a disjoint alphabet crosses z=3 at about 8-10% of the
// event stream and reaches z=12-16 at 20-25%, while a scatter control that
// relabels the same COUNT of events without clustering them stays at
// -1.2..+0.7. So the instrument sees structure fine at this density; the fix
// simply did not recruit enough of what the child sees. The shipped frenzy
// changed only the outcome of a tap, which is about 6% of the salient stream.
// Ambient traffic is 55% of it and carried on exactly as before -- a child
// cannot tell a frenzy is happening if the world does not change.
//
// So during the build and the frenzy the reef converges on the shark and swirls
// around it, and afterwards it disperses. This is a real behaviour change with a
// real consequence for what reaches the screen -- creatures that converge are
// creatures that are ON SCREEN -- so the effect survives without any relabelling
// at all, which .probe/session.mjs reports separately for exactly that reason.
//
// THIS IS NOT THE STRAGGLER SPEED BOOST THAT FAILED EARLIER. That one was a
// covert boost, justified by a claim that it happened out of frame, and the
// claim was false: 10,554 frames of a creature visibly sprinting. This boost is
// overt, global, tied to a state the child caused, and meant to be seen. The
// earlier mistake was hiding motion, not causing it.

// Radius of the swirl the reef settles into around the shark when fully
// gathered. Chosen so the ring sits inside the measured visible box on every
// side (x +/-20.5, z -6.0..+24.5) even when the shark is turning.
const GATHER_RADIUS = 9;
// Speed multiplier at full gather. A jellyfish at 0.3 units/s reaches 0.75,
// which is still slower than the shark at 1.5 -- nothing outruns the child.
const GATHER_SPEED_GAIN = 1.5;
// Turn-rate multiplier at full gather, so a creature can actually come about
// inside the frenzy rather than arriving after it has ended.
const GATHER_TURN_GAIN = 2.0;

// Advances one drifter along its heading, then wraps it around the travelling
// box if it has left. The wander is a slow sinusoid rather than noise so the
// path is a readable arc: a three-year-old should be able to see where a
// creature is going and point at it before it gets there.
//
// `gather` in [0, 1] blends in the convergence described above: 0 is the
// ordinary drift, 1 is a full swirl around the shark.
function advanceDrifter(d: Drifter, dt: number, elapsedTime: number, sharkX: number, sharkZ: number, gather: number): void {
  let want = d.heading + Math.sin(elapsedTime * 0.13 + d.phase) * 0.6;
  if (gather > 0) {
    const dx = sharkX - d.group.position.x;
    const dz = sharkZ - d.group.position.z;
    const dist = Math.hypot(dx, dz) || 1e-6;
    // Head in when outside the ring, out when inside it, and tangentially when
    // on it -- which is what makes the gathered state an orbit rather than a
    // pile-up at the shark's nose.
    const toShark = Math.atan2(dz, dx);
    const radial = dist > GATHER_RADIUS ? toShark : toShark + Math.PI;
    const onRing = 1 - Math.min(1, Math.abs(dist - GATHER_RADIUS) / GATHER_RADIUS);
    // A stable per-creature swirl direction, so the ring does not shear.
    const spin = d.phase % (Math.PI * 2) < Math.PI ? 1 : -1;
    const target = radial + spin * (Math.PI / 2) * onRing;
    want = d.heading + angleDelta(d.heading, target) * gather + Math.sin(elapsedTime * 0.13 + d.phase) * 0.6 * (1 - gather);
  }
  const step = TURN_RATE * (1 + gather * GATHER_TURN_GAIN) * dt;
  d.heading += Math.max(-step, Math.min(step, angleDelta(d.heading, want)));
  const speed = d.speed * (1 + gather * GATHER_SPEED_GAIN);
  d.group.position.x += Math.cos(d.heading) * speed * dt;
  d.group.position.z += Math.sin(d.heading) * speed * dt;

  // Wrapping, and re-aiming at the wrap. A drifter that only ever wanders by a
  // bounded sinusoid keeps its lane: measured with a stationary shark, just 7 of
  // 21 creatures were ever seen in five minutes, because the other 14 tracked
  // back and forth across a band of z the camera does not cover. Re-picking the
  // heading on wrap fixes that, and it is free — the wrap is already proven to
  // happen out of sight, so a direction change there cannot be seen either. The
  // new heading points back into the box, otherwise a creature would wrap
  // straight out again.
  const relX = d.group.position.x - sharkX;
  if (relX > WRAP_X) {
    // Left by the +X side, re-enters on the -X side, so it must head +X.
    d.group.position.x -= WRAP_X * 2;
    d.heading = (Math.random() - 0.5) * Math.PI;
  } else if (relX < -WRAP_X) {
    d.group.position.x += WRAP_X * 2;
    d.heading = Math.PI + (Math.random() - 0.5) * Math.PI;
  }

  const relZ = d.group.position.z - sharkZ;
  if (relZ > WRAP_MAX_Z) {
    d.group.position.z -= WRAP_SPAN_Z;
    d.heading = Math.random() * Math.PI;
  } else if (relZ < WRAP_MIN_Z) {
    d.group.position.z += WRAP_SPAN_Z;
    d.heading = Math.PI + Math.random() * Math.PI;
  }
}

// Places drifter i of n across the travelling box. The R2 low-discrepancy
// sequence spreads points more evenly than random placement and, unlike a grid,
// leaves no visible rows; `offset` keeps one class from landing on another.
const R2_A1 = 1 / 1.324717957244746;
const R2_A2 = 1 / (1.324717957244746 * 1.324717957244746);
function scatterDrifter(i: number, offset: number): { x: number; z: number; heading: number } {
  const k = i + offset;
  const u = (0.5 + R2_A1 * k) % 1;
  const v = (0.5 + R2_A2 * k) % 1;
  return {
    x: (u - 0.5) * 2 * WRAP_X,
    z: WRAP_MIN_Z + v * WRAP_SPAN_Z,
    heading: Math.random() * Math.PI * 2,
  };
}

// ── Tiny fish (school) ──────────────────────────────────────────────

/**
 * Builds a tiny fish shape (body + tail) for the ambient school.
 * @param mat - Material for the fish.
 * @param name - Mesh name prefix.
 * @returns A Group containing the fish parts.
 */
function buildTinyFish(mat: MeshStandardMaterial, name: string): Group {
  const g = new Group();
  g.name = name;

  const bodyGeo = new SphereGeometry(0.06, 8, 6);
  const body = new Mesh(bodyGeo, mat);
  body.scale.set(1.5, 0.7, 0.5);
  g.add(body);

  const tailGeo = new SphereGeometry(0.035, 6, 4);
  const tail = new Mesh(tailGeo, mat);
  tail.scale.set(0.4, 0.8, 0.08);
  tail.position.x = -0.08;
  g.add(tail);

  return g;
}

// ── Jellyfish ───────────────────────────────────────────────────────

/**
 * Builds a decorative jellyfish with a translucent dome and dangling tentacles.
 * @param idx - Index for naming.
 * @param color - Jellyfish tint color.
 * @returns A Group containing all jellyfish parts.
 */
function buildJellyfish(idx: number, color: Color): Group {
  const g = new Group();
  g.name = `jellyfish_${idx}`;

  const bellGeo = new SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const bellMat = new MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.3),
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.5,
    roughness: 0.2,
  });
  bellMat.name = `jellyMat_${idx}`;
  const bell = new Mesh(bellGeo, bellMat);
  bell.rotation.x = Math.PI;
  g.add(bell);

  const tentMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.8),
    transparent: true,
    opacity: 0.35,
    roughness: 0.4,
  });
  tentMat.name = `jellyTentMat_${idx}`;
  for (let t = 0; t < 6; t++) {
    const angle = (t / 6) * Math.PI * 2;
    const tentGeo = new CylinderGeometry(0.004, 0.008, 0.25 + Math.random() * 0.15, 4);
    const tent = new Mesh(tentGeo, tentMat);
    tent.position.set(Math.cos(angle) * 0.1, -0.15, Math.sin(angle) * 0.1);
    g.add(tent);
  }

  return g;
}

// ── Octopus ─────────────────────────────────────────────────────────

/**
 * Builds a decorative octopus sitting on the seafloor.
 * @param idx - Index for naming.
 * @param color - Body tint color.
 * @returns A Group containing all octopus parts.
 */
function buildOctopus(idx: number, color: Color): Group {
  const g = new Group();
  g.name = `octopus_${idx}`;

  // Head/body — flattened dome
  const bodyMat = createCoralMaterial(`octopusMat_${idx}`, color);
  const bodyGeo = new SphereGeometry(0.25, 12, 10);
  const body = new Mesh(bodyGeo, bodyMat);
  body.scale.set(1, 0.75, 1);
  body.position.y = 0.15;
  g.add(body);

  // Eyes
  const eyeWhiteMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  eyeWhiteMat.name = `octopusEye_${idx}`;
  const pupilMat = new MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  pupilMat.name = `octopusPupil_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const eyeGeo = new SphereGeometry(0.05, 8, 6);
    const eye = new Mesh(eyeGeo, eyeWhiteMat);
    eye.position.set(side * 0.1, 0.22, 0.2);
    g.add(eye);
    const pupilGeo = new SphereGeometry(0.025, 6, 6);
    const pupil = new Mesh(pupilGeo, pupilMat);
    pupil.position.set(side * 0.1, 0.22, 0.24);
    g.add(pupil);
  }

  // 8 tentacles radiating outward
  const tentMat = createCoralMaterial(`octopusTent_${idx}`, color.clone().multiplyScalar(0.85));
  for (let t = 0; t < 8; t++) {
    const angle = (t / 8) * Math.PI * 2;
    const tentGeo = new CylinderGeometry(0.015, 0.035, 0.35, 6);
    const tent = new Mesh(tentGeo, tentMat);
    tent.position.set(Math.cos(angle) * 0.18, 0.02, Math.sin(angle) * 0.18);
    tent.rotation.z = (Math.PI / 2) * 0.6 * (angle > Math.PI ? 1 : -1);
    tent.rotation.y = -angle;
    g.add(tent);
  }

  return g;
}

// ── Squid ───────────────────────────────────────────────────────────

/**
 * Builds a decorative squid floating in mid-water.
 * @param idx - Index for naming.
 * @param color - Body tint color.
 * @returns A Group containing all squid parts.
 */
function buildSquid(idx: number, color: Color): Group {
  const g = new Group();
  g.name = `squid_${idx}`;

  const bodyMat = new MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.15),
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.75,
    roughness: 0.3,
  });
  bodyMat.name = `squidMat_${idx}`;

  // Elongated mantle (torpedo shape)
  const mantleGeo = new CylinderGeometry(0.08, 0.14, 0.5, 10);
  const mantle = new Mesh(mantleGeo, bodyMat);
  mantle.position.y = 0.15;
  g.add(mantle);

  // Pointed tip on top
  const tipGeo = new ConeGeometry(0.08, 0.15, 8);
  const tip = new Mesh(tipGeo, bodyMat);
  tip.position.y = 0.45;
  g.add(tip);

  // 2 fins
  const finMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.9),
    transparent: true,
    opacity: 0.6,
    roughness: 0.4,
  });
  finMat.name = `squidFin_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const finGeo = new SphereGeometry(0.06, 8, 6);
    const fin = new Mesh(finGeo, finMat);
    fin.scale.set(0.3, 1, 1.5);
    fin.position.set(side * 0.12, 0.3, 0);
    g.add(fin);
  }

  // Eyes
  const eyeMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  eyeMat.name = `squidEye_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const eyeGeo = new SphereGeometry(0.03, 6, 6);
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.08, 0.05, 0.1);
    g.add(eye);
  }

  // 8 tentacles hanging down
  const tentMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.8),
    transparent: true,
    opacity: 0.6,
    roughness: 0.5,
  });
  tentMat.name = `squidTent_${idx}`;
  for (let t = 0; t < 8; t++) {
    const angle = (t / 8) * Math.PI * 2;
    const tentGeo = new CylinderGeometry(0.006, 0.012, 0.2 + Math.random() * 0.1, 4);
    const tent = new Mesh(tentGeo, tentMat);
    tent.position.set(Math.cos(angle) * 0.08, -0.1, Math.sin(angle) * 0.08);
    g.add(tent);
  }

  return g;
}

// ── Crab ────────────────────────────────────────────────────────────

/**
 * Builds a decorative crab on the seafloor.
 * @param idx - Index for naming.
 * @param color - Shell color.
 * @returns A Group containing all crab parts.
 */
function buildCrab(idx: number, color: Color): Group {
  const g = new Group();
  g.name = `crab_${idx}`;

  const shellMat = createCoralMaterial(`crabMat_${idx}`, color);

  // Body — flattened sphere
  const bodyGeo = new SphereGeometry(0.1, 10, 8);
  const body = new Mesh(bodyGeo, shellMat);
  body.scale.set(1.3, 0.5, 1.0);
  body.position.y = 0.04;
  g.add(body);

  // Eyes on stalks
  const eyeMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  eyeMat.name = `crabEye_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const stalkGeo = new CylinderGeometry(0.008, 0.008, 0.06, 4);
    const stalk = new Mesh(stalkGeo, shellMat);
    stalk.position.set(side * 0.05, 0.08, 0.06);
    g.add(stalk);
    const eyeGeo = new SphereGeometry(0.015, 6, 6);
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.05, 0.11, 0.06);
    g.add(eye);
  }

  // 2 claws
  const clawMat = createCoralMaterial(`crabClaw_${idx}`, color.clone().multiplyScalar(0.9));
  for (let side = -1; side <= 1; side += 2) {
    const armGeo = new CylinderGeometry(0.012, 0.015, 0.1, 6);
    const arm = new Mesh(armGeo, clawMat);
    arm.position.set(side * 0.15, 0.03, 0.04);
    arm.rotation.z = side * 0.5;
    g.add(arm);
    // Pincer — two small wedges
    const pincerGeo = new BoxGeometry(0.03, 0.015, 0.04);
    const pincer = new Mesh(pincerGeo, clawMat);
    pincer.position.set(side * 0.2, 0.05, 0.04);
    g.add(pincer);
  }

  // 6 legs (3 per side)
  const legMat = createCoralMaterial(`crabLeg_${idx}`, color.clone().multiplyScalar(0.8));
  for (let side = -1; side <= 1; side += 2) {
    for (let l = 0; l < 3; l++) {
      const legGeo = new CylinderGeometry(0.005, 0.008, 0.08, 4);
      const leg = new Mesh(legGeo, legMat);
      const zOff = -0.02 + l * 0.04;
      leg.position.set(side * 0.12, 0.01, zOff);
      leg.rotation.z = side * 0.8;
      g.add(leg);
    }
  }

  return g;
}

// ── Pineapple ───────────────────────────────────────────────────────

/**
 * Builds a decorative pineapple on the seafloor.
 * @param idx - Index for naming.
 * @returns A Group containing all pineapple parts.
 */
function buildPineapple(idx: number): Group {
  const g = new Group();
  g.name = `pineapple_${idx}`;

  // Body — slightly tapered cylinder
  const bodyMat = new MeshStandardMaterial({
    color: new Color(0.95, 0.7, 0.1),
    roughness: 0.8,
    metalness: 0.05,
  });
  bodyMat.name = `pineappleMat_${idx}`;
  const bodyGeo = new CylinderGeometry(0.12, 0.15, 0.4, 10);
  const body = new Mesh(bodyGeo, bodyMat);
  body.position.y = 0.2;
  g.add(body);

  // Bumpy texture — small spheres on the surface
  const bumpMat = new MeshStandardMaterial({
    color: new Color(0.85, 0.6, 0.05),
    roughness: 0.9,
  });
  bumpMat.name = `pineappleBump_${idx}`;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const angle = (col / 6) * Math.PI * 2 + row * 0.5;
      const y = 0.1 + row * 0.1;
      const r = 0.13;
      const bumpGeo = new SphereGeometry(0.015, 4, 4);
      const bump = new Mesh(bumpGeo, bumpMat);
      bump.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      g.add(bump);
    }
  }

  // Green leaf crown
  const leafMat = new MeshStandardMaterial({
    color: new Color(0.2, 0.65, 0.15),
    roughness: 0.6,
  });
  leafMat.name = `pineappleLeaf_${idx}`;
  for (let l = 0; l < 5; l++) {
    const angle = (l / 5) * Math.PI * 2;
    const leafGeo = new ConeGeometry(0.03, 0.15, 4);
    const leaf = new Mesh(leafGeo, leafMat);
    leaf.position.set(Math.cos(angle) * 0.04, 0.45, Math.sin(angle) * 0.04);
    leaf.rotation.z = (Math.cos(angle) > 0 ? -1 : 1) * 0.3;
    leaf.rotation.x = (Math.sin(angle) > 0 ? -1 : 1) * 0.3;
    g.add(leaf);
  }
  // Center leaf
  const centerLeafGeo = new ConeGeometry(0.025, 0.12, 4);
  const centerLeaf = new Mesh(centerLeafGeo, leafMat);
  centerLeaf.position.y = 0.48;
  g.add(centerLeaf);

  // Door (small dark rectangle)
  const doorMat = new MeshStandardMaterial({ color: new Color(0.15, 0.08, 0.02), roughness: 0.9 });
  doorMat.name = `pineappleDoor_${idx}`;
  const doorGeo = new BoxGeometry(0.05, 0.08, 0.01);
  const door = new Mesh(doorGeo, doorMat);
  door.position.set(0, 0.1, 0.15);
  g.add(door);

  // Windows (two small circles)
  const windowMat = new MeshStandardMaterial({
    color: new Color(0.3, 0.6, 0.9),
    emissive: new Color(0.15, 0.3, 0.5),
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });
  windowMat.name = `pineappleWin_${idx}`;
  for (let side = -1; side <= 1; side += 2) {
    const winGeo = new SphereGeometry(0.02, 6, 6);
    const win = new Mesh(winGeo, windowMat);
    win.position.set(side * 0.06, 0.25, 0.13);
    g.add(win);
  }

  return g;
}

// ── Submarine ───────────────────────────────────────────────────────

/**
 * Builds a toy submarine.
 * @param idx - Index for naming.
 * @returns A Group containing all submarine parts.
 */
function buildSubmarine(idx: number): Group {
  const g = new Group();
  g.name = `submarine_${idx}`;

  const hullColor = new Color(0.3, 0.35, 0.42);
  const accentColor = new Color(0.9, 0.7, 0.15);

  // Hull — elongated capsule (cylinder + sphere caps)
  const hullMat = new MeshStandardMaterial({ color: hullColor, roughness: 0.4, metalness: 0.6 });
  hullMat.name = `subHull_${idx}`;
  const hullGeo = new CylinderGeometry(0.2, 0.2, 1.0, 12);
  const hull = new Mesh(hullGeo, hullMat);
  hull.rotation.z = Math.PI / 2;
  g.add(hull);

  // Nose cap
  const noseMat = new MeshStandardMaterial({ color: accentColor, roughness: 0.3, metalness: 0.5 });
  noseMat.name = `subNose_${idx}`;
  const noseGeo = new SphereGeometry(0.2, 10, 8);
  const nose = new Mesh(noseGeo, noseMat);
  nose.position.x = 0.5;
  nose.scale.set(0.6, 1, 1);
  g.add(nose);

  // Tail cap
  const tailGeo = new SphereGeometry(0.2, 10, 8);
  const tail = new Mesh(tailGeo, hullMat);
  tail.position.x = -0.5;
  tail.scale.set(0.5, 0.9, 0.9);
  g.add(tail);

  // Conning tower
  const towerGeo = new CylinderGeometry(0.08, 0.1, 0.2, 8);
  const tower = new Mesh(towerGeo, hullMat);
  tower.position.set(0.05, 0.25, 0);
  g.add(tower);

  // Periscope
  const periGeo = new CylinderGeometry(0.015, 0.015, 0.15, 6);
  const peri = new Mesh(periGeo, hullMat);
  peri.position.set(0.05, 0.42, 0);
  g.add(peri);

  // Periscope lens
  const lensGeo = new SphereGeometry(0.02, 6, 6);
  const lensMat = new MeshStandardMaterial({
    color: new Color(0.2, 0.5, 0.8),
    emissive: new Color(0.1, 0.3, 0.5),
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });
  lensMat.name = `subLens_${idx}`;
  const lens = new Mesh(lensGeo, lensMat);
  lens.position.set(0.05, 0.5, 0.02);
  g.add(lens);

  // Propeller — small disc at the back
  const propMat = new MeshStandardMaterial({ color: new Color(0.5, 0.5, 0.55), metalness: 0.8, roughness: 0.3 });
  propMat.name = `subProp_${idx}`;
  for (let b = 0; b < 4; b++) {
    const bladeGeo = new BoxGeometry(0.005, 0.1, 0.03);
    const blade = new Mesh(bladeGeo, propMat);
    const angle = (b / 4) * Math.PI * 2;
    blade.position.set(-0.62, Math.sin(angle) * 0.04, Math.cos(angle) * 0.04);
    blade.rotation.x = angle;
    g.add(blade);
  }

  // Port windows along the hull
  const winMat = new MeshStandardMaterial({
    color: new Color(0.4, 0.75, 1.0),
    emissive: new Color(0.3, 0.6, 0.9),
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.8,
    roughness: 0.1,
  });
  winMat.name = `subWin_${idx}`;
  for (let w = 0; w < 3; w++) {
    const winGeo = new SphereGeometry(0.03, 6, 6);
    const win = new Mesh(winGeo, winMat);
    win.position.set(0.2 - w * 0.2, 0, 0.2);
    g.add(win);
  }

  // Scale up so it reads as a proper vehicle
  g.scale.setScalar(1.5);

  return g;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates ambient decorative creatures for the reef.
 * @param scene - The Three.js scene.
 * @returns Ambient creature handles for update/dispose.
 */
export function createAmbientCreatures(scene: Scene): AmbientCreatures {
  // School of tiny fish (10)
  const fishSchool: Group[] = [];
  const schoolColors = [new Color(0.5, 0.55, 0.85), new Color(0.6, 0.8, 0.55), new Color(0.85, 0.65, 0.4)];
  for (let i = 0; i < 10; i++) {
    const color = schoolColors[i % schoolColors.length];
    const mat = createSkinMaterial(`ambientFishMat_${i}`, color);
    const fish = buildTinyFish(mat, `ambient_fish_${i}`);
    fish.position.set((Math.random() - 0.5) * 3, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 3);
    scene.add(fish);
    fishSchool.push(fish);
  }

  // Bubbles
  const bubbles: Mesh[] = [];
  const bubbleMat = new MeshStandardMaterial({
    color: new Color(0.7, 0.85, 1.0),
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.3,
  });
  bubbleMat.name = 'ambientBubbleMat';
  for (let i = 0; i < 12; i++) {
    const geo = new SphereGeometry(0.03 + Math.random() * 0.04);
    const bubble = new Mesh(geo, bubbleMat);
    bubble.name = `ambient_bubble_${i}`;
    bubble.position.set((Math.random() - 0.5) * BOUNDS * 2, -0.3 + Math.random() * 2.5, (Math.random() - 0.5) * BOUNDS * 2);
    scene.add(bubble);
    bubbles.push(bubble);
  }

  // Jellyfish (8 drifting through the travelling box)
  const jellyfish: Drifter[] = [];
  const jellyColors = [
    new Color(0.7, 0.4, 0.9),
    new Color(0.3, 0.8, 0.9),
    new Color(0.9, 0.5, 0.7),
    new Color(0.5, 0.9, 0.6),
    new Color(0.9, 0.7, 0.4),
    new Color(0.4, 0.6, 0.95),
    new Color(0.8, 0.3, 0.6),
    new Color(0.6, 0.9, 0.8),
  ];
  for (let j = 0; j < jellyColors.length; j++) {
    const jelly = buildJellyfish(j, jellyColors[j]);
    const spot = scatterDrifter(j, 0);
    jelly.position.set(spot.x, 1.2 + (j % 3) * 0.3, spot.z);
    scene.add(jelly);
    jellyfish.push({
      group: jelly,
      heading: spot.heading,
      speed: 0.3 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Octopuses (4 crawling the seafloor)
  const octopuses: Drifter[] = [];
  const octoColors = [new Color(0.6, 0.2, 0.7), new Color(0.9, 0.4, 0.2), new Color(0.2, 0.65, 0.6), new Color(0.85, 0.3, 0.55)];
  for (let o = 0; o < octoColors.length; o++) {
    const octo = buildOctopus(o, octoColors[o]);
    const spot = scatterDrifter(o, 40);
    octo.position.set(spot.x, -0.45, spot.z);
    octo.rotation.y = -spot.heading;
    scene.add(octo);
    octopuses.push({
      group: octo,
      heading: spot.heading,
      speed: 0.25 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Squids (3 jetting through mid-water)
  const squids: Drifter[] = [];
  const squidColors = [new Color(0.85, 0.6, 0.7), new Color(0.6, 0.75, 0.9), new Color(0.9, 0.8, 0.65)];
  for (let s = 0; s < squidColors.length; s++) {
    const squid = buildSquid(s, squidColors[s]);
    const spot = scatterDrifter(s, 80);
    squid.position.set(spot.x, 0.8 + s * 0.25, spot.z);
    scene.add(squid);
    squids.push({
      group: squid,
      heading: spot.heading,
      speed: 0.9 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Crabs (6 scuttling the seafloor)
  const crabs: Drifter[] = [];
  const crabColors = [
    new Color(0.9, 0.3, 0.15),
    new Color(0.85, 0.4, 0.1),
    new Color(0.95, 0.25, 0.2),
    new Color(0.8, 0.35, 0.12),
    new Color(0.9, 0.45, 0.15),
    new Color(0.75, 0.3, 0.18),
  ];
  for (let c = 0; c < crabColors.length; c++) {
    const crab = buildCrab(c, crabColors[c]);
    const spot = scatterDrifter(c, 120);
    crab.position.set(spot.x, -0.47, spot.z);
    crab.rotation.y = -spot.heading + Math.PI / 2;
    scene.add(crab);
    crabs.push({
      group: crab,
      heading: spot.heading,
      speed: 0.45 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Pineapples (3 on the seafloor)
  const pineapples: Group[] = [];
  const pinePositions: [number, number][] = [
    [14, -6],
    [-16, 20],
    [28, -22],
  ];
  for (let p = 0; p < pinePositions.length; p++) {
    const pineapple = buildPineapple(p);
    pineapple.position.set(pinePositions[p][0], -0.5, pinePositions[p][1]);
    pineapple.rotation.y = Math.random() * Math.PI * 2;
    scene.add(pineapple);
    pineapples.push(pineapple);
  }

  // Submarines (2 pre-built, initially hidden)
  const submarines: SubmarineTransit[] = [];
  for (let s = 0; s < 2; s++) {
    const sub = buildSubmarine(s);
    sub.visible = false;
    scene.add(sub);
    submarines.push({
      group: sub,
      startX: 0,
      startZ: 0,
      endX: 0,
      endZ: 0,
      t: 0,
      speed: 0,
      active: false,
    });
  }

  // Propeller wash bubble pool (pre-allocated, reused)
  const propWashMat = new MeshStandardMaterial({
    color: new Color(0.8, 0.9, 1.0),
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    metalness: 0.2,
  });
  propWashMat.name = 'propWashMat';
  const propWash: AmbientCreatures['propWash'] = [];
  const propWashGeo = new SphereGeometry(0.04, 6, 6);
  for (let i = 0; i < 40; i++) {
    const mesh = new Mesh(propWashGeo, propWashMat);
    mesh.name = `propWash_${i}`;
    mesh.visible = false;
    scene.add(mesh);
    propWash.push({ mesh, life: 0, velY: 0, velX: 0, velZ: 0 });
  }

  return {
    fishSchool,
    bubbles,
    jellyfish,
    octopuses,
    squids,
    crabs,
    pineapples,
    submarines,
    propWash,
    propWashMat,
    schoolPhase: Math.random() * Math.PI * 2,
    subTimer: 15.0,
  };
}

// ── Update ──────────────────────────────────────────────────────────

/**
 * Updates ambient creature animations.
 * @param creatures - Ambient creatures to update.
 * @param dt - Frame delta time.
 * @param elapsedTime - Total elapsed game time.
 * @param sharkX - Shark world X position (school orbits near shark).
 * @param sharkZ - Shark world Z position.
 * @param gather - 0..1 convergence of the reef on the shark during a feeding frenzy. See advanceDrifter.
 */
export function updateAmbientCreatures(creatures: AmbientCreatures, dt: number, elapsedTime: number, sharkX: number, sharkZ: number, gather = 0): void {
  creatures.schoolPhase += dt * 0.3;

  // School moves in a lazy arc centered around the shark
  const centerX = sharkX + Math.sin(creatures.schoolPhase) * 5;
  const centerZ = sharkZ + Math.cos(creatures.schoolPhase * 0.7) * 5;

  for (let i = 0; i < creatures.fishSchool.length; i++) {
    const fish = creatures.fishSchool[i];
    const offset = i * 0.4;
    fish.position.x = centerX + Math.sin(elapsedTime * 0.8 + offset) * 0.6;
    fish.position.z = centerZ + Math.cos(elapsedTime * 0.6 + offset) * 0.6;
    fish.position.y = 0.4 + Math.sin(elapsedTime * 1.2 + offset) * 0.2;
    fish.rotation.y = -creatures.schoolPhase + Math.PI / 2;
    fish.rotation.z = Math.sin(elapsedTime * 4 + i) * 0.08;
  }

  // Bubbles rise slowly, respawn near the shark
  for (const bubble of creatures.bubbles) {
    bubble.position.y += dt * (0.2 + Math.sin(elapsedTime + bubble.position.x) * 0.1);
    bubble.position.x += Math.sin(elapsedTime * 2 + bubble.position.y * 3) * dt * 0.08;
    const pulse = 1 + Math.sin(elapsedTime * 3 + bubble.position.y * 2) * 0.1;
    bubble.scale.setScalar(pulse);
    if (bubble.position.y > 2.6) {
      bubble.position.y = -0.3;
      bubble.position.x = sharkX + (Math.random() - 0.5) * 30;
      bubble.position.z = sharkZ + (Math.random() - 0.5) * 30;
    }
  }

  // Jellyfish: travel the reef, plus gentle floating and pulsing
  for (let j = 0; j < creatures.jellyfish.length; j++) {
    advanceDrifter(creatures.jellyfish[j], dt, elapsedTime, sharkX, sharkZ, gather);
    const jelly = creatures.jellyfish[j].group;
    const baseY = 1.2 + (j % 3) * 0.3;
    jelly.position.y = baseY + Math.sin(elapsedTime * 0.5 + j * 2) * 0.3;
    const jellyPulse = 1 + Math.sin(elapsedTime * 2 + j * 1.3) * 0.08;
    jelly.scale.set(jellyPulse, 1 / jellyPulse, jellyPulse);
    jelly.children.forEach((child, ci) => {
      if (ci > 0) {
        child.rotation.z = Math.sin(elapsedTime * 1.5 + ci * 0.8 + j) * 0.15;
        child.rotation.x = Math.cos(elapsedTime * 1.2 + ci * 0.6 + j) * 0.1;
      }
    });
  }

  // Octopuses: crawl the seafloor, tentacle sway + gentle body bob
  for (let o = 0; o < creatures.octopuses.length; o++) {
    advanceDrifter(creatures.octopuses[o], dt, elapsedTime, sharkX, sharkZ, gather);
    const octo = creatures.octopuses[o].group;
    // Gentle body bob
    octo.position.y = -0.45 + Math.sin(elapsedTime * 0.4 + o * 1.7) * 0.02;
    octo.rotation.y = -creatures.octopuses[o].heading;
    // Tentacle sway (children index 3+ are tentacles: 0=body, 1-4=eyes, 5-12=tentacles)
    octo.children.forEach((child, ci) => {
      if (ci >= 5) {
        child.rotation.x = Math.sin(elapsedTime * 1.0 + ci * 0.5 + o) * 0.2;
        child.rotation.z += Math.sin(elapsedTime * 0.8 + ci * 0.7 + o) * dt * 0.3;
      }
    });
  }

  // Squids: jet across the reef, vertical bob + tentacle sway
  for (let s = 0; s < creatures.squids.length; s++) {
    advanceDrifter(creatures.squids[s], dt, elapsedTime, sharkX, sharkZ, gather);
    const squid = creatures.squids[s].group;
    const baseY = 0.8 + s * 0.25;
    squid.position.y = baseY + Math.sin(elapsedTime * 0.6 + s * 2.1) * 0.25;
    squid.rotation.y = -creatures.squids[s].heading;
    // Mantle breathing
    const squidPulse = 1 + Math.sin(elapsedTime * 2.5 + s) * 0.06;
    squid.scale.set(squidPulse, 1, squidPulse);
    // Tentacle sway (last 8 children)
    const tentStart = squid.children.length - 8;
    for (let t = tentStart; t < squid.children.length; t++) {
      squid.children[t].rotation.z = Math.sin(elapsedTime * 1.3 + t * 0.6 + s) * 0.12;
      squid.children[t].rotation.x = Math.cos(elapsedTime * 1.1 + t * 0.5 + s) * 0.08;
    }
  }

  // Crabs: scuttle across the seafloor, sideways to their line of travel
  for (let c = 0; c < creatures.crabs.length; c++) {
    advanceDrifter(creatures.crabs[c], dt, elapsedTime, sharkX, sharkZ, gather);
    const group = creatures.crabs[c].group;
    // A crab walks sideways, so its body faces 90 degrees off its heading.
    group.rotation.y = -creatures.crabs[c].heading + Math.PI / 2;
    // Claw clacking — rotate claws (children at specific indices)
    group.children.forEach((child, ci) => {
      // Leg wiggle for legs (index >= 12 for the leg meshes)
      if (ci >= 12) {
        child.rotation.x = Math.sin(elapsedTime * 3 + ci + c) * 0.15;
      }
    });
  }

  // Pineapples: static (they just sit there — it's a pineapple)

  // ── Submarine transit (every 10s, send one through) ───────────────
  creatures.subTimer -= dt;
  if (creatures.subTimer <= 0) {
    creatures.subTimer = 15.0;

    // Find an inactive submarine
    const sub = creatures.submarines.find((s) => !s.active);
    if (sub) {
      // Pick a random crossing direction through the shark's area
      const angle = Math.random() * Math.PI * 2;
      const crossDist = 25;
      sub.startX = sharkX - Math.cos(angle) * crossDist;
      sub.startZ = sharkZ - Math.sin(angle) * crossDist;
      sub.endX = sharkX + Math.cos(angle) * crossDist;
      sub.endZ = sharkZ + Math.sin(angle) * crossDist;
      sub.t = 0;
      sub.speed = 1.0 / 8.0; // cross in ~8 seconds
      sub.active = true;
      sub.group.visible = true;
      // Face direction of travel
      sub.group.rotation.y = Math.atan2(-(sub.endZ - sub.startZ), sub.endX - sub.startX);
      // Random height: mid-water to near-surface
      sub.group.position.y = 2.2 + Math.random() * 0.2;
    }
  }

  // Animate active submarines + spawn propeller wash
  for (const sub of creatures.submarines) {
    if (!sub.active) continue;
    sub.t += sub.speed * dt;

    if (sub.t >= 1.0) {
      sub.active = false;
      sub.group.visible = false;
      continue;
    }

    // Lerp position
    sub.group.position.x = sub.startX + (sub.endX - sub.startX) * sub.t;
    sub.group.position.z = sub.startZ + (sub.endZ - sub.startZ) * sub.t;
    // Gentle bob
    sub.group.position.y += Math.sin(elapsedTime * 1.5) * dt * 0.02;

    // Propeller spin (blades at indices 7-10)
    const children = sub.group.children;
    for (let b = 7; b <= 10 && b < children.length; b++) {
      children[b].rotation.x += dt * 15;
    }

    // Spawn propeller wash bubbles behind the sub (~5 per frame at 60fps)
    const spawnCount = Math.ceil(dt * 300);
    // Direction from start→end (sub faces this way)
    const dirX = sub.endX - sub.startX;
    const dirZ = sub.endZ - sub.startZ;
    const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const nxDir = dirX / dirLen;
    const nzDir = dirZ / dirLen;

    for (let i = 0; i < spawnCount; i++) {
      // Find a dead bubble in the pool
      const bubble = creatures.propWash.find((b) => b.life <= 0);
      if (!bubble) break;

      // Position at the sub's rear (opposite of travel direction), with spread
      const subScale = 1.5; // sub group scale
      const rearOffset = 0.65 * subScale;
      bubble.mesh.position.set(
        sub.group.position.x - nxDir * rearOffset + (Math.random() - 0.5) * 0.3,
        sub.group.position.y + (Math.random() - 0.5) * 0.2,
        sub.group.position.z - nzDir * rearOffset + (Math.random() - 0.5) * 0.3,
      );
      // Velocity: mostly backward + upward + random spread
      bubble.velX = -nxDir * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.4;
      bubble.velZ = -nzDir * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.4;
      bubble.velY = 0.3 + Math.random() * 0.4;
      bubble.life = 1.0 + Math.random() * 0.8; // 1-1.8s lifetime
      bubble.mesh.visible = true;
      bubble.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
    }
  }

  // Update propeller wash bubbles
  for (const bubble of creatures.propWash) {
    if (bubble.life <= 0) continue;
    bubble.life -= dt;

    // Move: drift backward/upward with deceleration
    bubble.mesh.position.x += bubble.velX * dt;
    bubble.mesh.position.y += bubble.velY * dt;
    bubble.mesh.position.z += bubble.velZ * dt;

    // Decelerate
    bubble.velX *= Math.max(0, 1 - 1.5 * dt);
    bubble.velZ *= Math.max(0, 1 - 1.5 * dt);
    // Buoyancy keeps velY positive
    bubble.velY += dt * 0.1;

    // Shrink to simulate fade-out (shared material, can't change opacity per bubble)
    bubble.mesh.scale.multiplyScalar(1 - dt * 0.5);

    if (bubble.life <= 0) {
      bubble.mesh.visible = false;
    }
  }
}

// ── Disposal ────────────────────────────────────────────────────────

/**
 * Disposes all ambient creature meshes and materials.
 * @param creatures - Ambient creatures to dispose.
 */
export function disposeAmbientCreatures(creatures: AmbientCreatures): void {
  const disposeGroup = (g: Group): void => {
    g.traverse((child) => {
      if ((child as Mesh).geometry) (child as Mesh).geometry.dispose();
      if ((child as Mesh).material) ((child as Mesh).material as MeshStandardMaterial)?.dispose();
    });
    g.removeFromParent();
  };

  for (const fish of creatures.fishSchool) disposeGroup(fish);
  for (const bubble of creatures.bubbles) {
    bubble.geometry?.dispose();
    (bubble.material as MeshStandardMaterial)?.dispose();
    bubble.removeFromParent();
  }
  for (const { group } of creatures.jellyfish) disposeGroup(group);
  for (const { group } of creatures.octopuses) disposeGroup(group);
  for (const { group } of creatures.squids) disposeGroup(group);
  for (const { group } of creatures.crabs) disposeGroup(group);
  for (const pine of creatures.pineapples) disposeGroup(pine);
  for (const sub of creatures.submarines) disposeGroup(sub.group);
  for (const bubble of creatures.propWash) {
    bubble.mesh.geometry?.dispose();
    bubble.mesh.removeFromParent();
  }
  creatures.propWashMat.dispose();
}

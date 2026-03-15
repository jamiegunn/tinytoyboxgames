import { Color, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3, type Scene } from 'three';
import { createPlasticMaterial, createFeltMaterial } from '@app/utils/materialFactory';
import gsap from 'gsap';

// ── Positions ──
// The door crack is at the knob/free edge: X ≈ -5.7 (just inside wall), Z ≈ +0.9
const DOOR_CRACK_INSIDE = new Vector3(-5.4, 0, 0.9);
const DOOR_CRACK_OUTSIDE = new Vector3(-6.3, 0, 0.9);
const PURPLE_TOYBOX = new Vector3(3.67, 0.01, -6.88);
const RED_TOYBOX = new Vector3(5.25, 0.01, 1.5);
const ANDY_POS = new Vector3(-3.6, 1.02, 7.78);

/**
 * Builds a soft, rounded orange tabby cat.
 * @returns The kitty group
 */
function buildKitty(): Group {
  const root = new Group();
  root.name = 'visitor_kitty_root';
  root.scale.setScalar(0.7);

  const orangeMat = createFeltMaterial('visitor_kittyOrangeMat', new Color(0.95, 0.6, 0.2));
  const darkOrangeMat = createFeltMaterial('visitor_kittyDarkOrangeMat', new Color(0.8, 0.48, 0.15));
  const whiteMat = createPlasticMaterial('visitor_kittyWhiteMat', new Color(0.98, 0.96, 0.93));
  const eyeMat = createPlasticMaterial('visitor_kittyEyeMat', new Color(0.15, 0.55, 0.2));
  const pupilMat = createPlasticMaterial('visitor_kittyPupilMat', new Color(0.05, 0.05, 0.08));
  const noseMat = createPlasticMaterial('visitor_kittyNoseMat', new Color(0.9, 0.55, 0.55));

  // Body — round and soft
  const body = new Mesh(new SphereGeometry(0.2, 12, 12), orangeMat);
  body.name = 'kitty_body';
  body.position.y = 0.22;
  body.scale.set(1.3, 0.85, 0.9);
  body.castShadow = true;
  root.add(body);

  // White tummy
  const tummy = new Mesh(new SphereGeometry(0.14, 10, 10), whiteMat);
  tummy.name = 'kitty_tummy';
  tummy.position.set(0.06, -0.04, 0);
  tummy.scale.set(0.8, 0.7, 0.6);
  body.add(tummy);

  // Tabby stripes on back
  [-0.04, 0.02, 0.08].forEach((x, i) => {
    const stripe = new Mesh(new SphereGeometry(0.04, 6, 6), darkOrangeMat);
    stripe.name = `kitty_stripe${i}`;
    stripe.position.set(x, 0.18, 0);
    stripe.scale.set(0.3, 0.15, 1.2);
    body.add(stripe);
  });

  // Head — round
  const head = new Mesh(new SphereGeometry(0.15, 12, 12), orangeMat);
  head.name = 'kitty_head';
  head.position.set(0.3, 0.35, 0);
  head.castShadow = true;
  root.add(head);

  // White muzzle area
  const muzzle = new Mesh(new SphereGeometry(0.08, 10, 10), whiteMat);
  muzzle.name = 'kitty_muzzle';
  muzzle.position.set(0.1, -0.04, 0);
  muzzle.scale.set(0.7, 0.6, 0.8);
  head.add(muzzle);

  // Nose — tiny pink triangle
  const nose = new Mesh(new SphereGeometry(0.018, 6, 6), noseMat);
  nose.name = 'kitty_nose';
  nose.position.set(0.14, -0.01, 0);
  head.add(nose);

  // Eyes — big and round for a cute look
  [-1, 1].forEach((side) => {
    const eyeW = new Mesh(new SphereGeometry(0.038, 10, 10), whiteMat);
    eyeW.name = `kitty_eyeW${side}`;
    eyeW.position.set(0.1, 0.04, side * 0.07);
    head.add(eyeW);

    const eyeP = new Mesh(new SphereGeometry(0.025, 10, 10), eyeMat);
    eyeP.name = `kitty_eyeP${side}`;
    eyeP.position.set(0.12, 0.04, side * 0.07);
    head.add(eyeP);

    const pupil = new Mesh(new SphereGeometry(0.013, 8, 8), pupilMat);
    pupil.name = `kitty_pupil${side}`;
    pupil.position.set(0.13, 0.04, side * 0.072);
    head.add(pupil);
  });

  // Ears — pointed, with inner pink
  [-1, 1].forEach((side) => {
    const ear = new Mesh(new CylinderGeometry(0, 0.055, 0.1, 4), orangeMat);
    ear.name = `kitty_ear${side}`;
    ear.position.set(0.27, 0.48, side * 0.08);
    ear.rotation.z = side * 0.15;
    root.add(ear);

    const innerEar = new Mesh(new CylinderGeometry(0, 0.03, 0.07, 4), noseMat);
    innerEar.name = `kitty_innerEar${side}`;
    innerEar.position.y = 0.01;
    ear.add(innerEar);
  });

  // Legs — rounded cylinders
  const legPos: [number, number][] = [
    [0.12, 0.07],
    [0.12, -0.07],
    [-0.12, 0.07],
    [-0.12, -0.07],
  ];
  legPos.forEach(([lx, lz], i) => {
    const leg = new Mesh(new CylinderGeometry(0.035, 0.04, 0.16, 8), orangeMat);
    leg.name = `kitty_leg${i}`;
    leg.position.set(lx, 0.09, lz);
    root.add(leg);

    // White paw tips
    const paw = new Mesh(new SphereGeometry(0.04, 8, 8), whiteMat);
    paw.name = `kitty_paw${i}`;
    paw.position.y = -0.08;
    paw.scale.y = 0.5;
    leg.add(paw);
  });

  // Tail — long, curved upward, with orange tip
  const tail = new Mesh(new CylinderGeometry(0.018, 0.028, 0.35, 8), orangeMat);
  tail.name = 'kitty_tail';
  tail.position.set(-0.28, 0.32, 0);
  tail.rotation.z = 0.5;
  root.add(tail);

  const tailTip = new Mesh(new SphereGeometry(0.025, 8, 8), darkOrangeMat);
  tailTip.name = 'kitty_tailTip';
  tailTip.position.y = 0.18;
  tail.add(tailTip);

  return root;
}

/**
 * Builds a soft, rounded golden retriever dog.
 * @returns The dog group
 */
function buildDog(): Group {
  const root = new Group();
  root.name = 'visitor_dog_root';
  root.scale.setScalar(1.0); // 2x the original 0.5

  const goldenMat = createFeltMaterial('visitor_dogGoldenMat', new Color(0.85, 0.65, 0.3));
  const lightGoldenMat = createFeltMaterial('visitor_dogLightGoldenMat', new Color(0.92, 0.78, 0.45));
  const darkGoldenMat = createFeltMaterial('visitor_dogDarkGoldenMat', new Color(0.7, 0.5, 0.2));
  const noseMat = createPlasticMaterial('visitor_dogNoseMat', new Color(0.15, 0.12, 0.1));
  const eyeMat = createPlasticMaterial('visitor_dogEyeMat', new Color(0.2, 0.15, 0.08));
  const whiteMat = createPlasticMaterial('visitor_dogWhiteMat', new Color(0.95, 0.93, 0.88));
  const tongueMat = createPlasticMaterial('visitor_dogTongueMat', new Color(0.9, 0.45, 0.5));

  // Body — rounded, soft shape
  const body = new Mesh(new SphereGeometry(0.22, 14, 14), goldenMat);
  body.name = 'dog_body';
  body.position.y = 0.3;
  body.scale.set(1.6, 0.85, 0.9);
  body.castShadow = true;
  root.add(body);

  // Light chest/belly
  const chest = new Mesh(new SphereGeometry(0.15, 10, 10), lightGoldenMat);
  chest.name = 'dog_chest';
  chest.position.set(0.08, -0.06, 0);
  chest.scale.set(1.0, 0.7, 0.8);
  body.add(chest);

  // Head — round with slight elongation
  const head = new Mesh(new SphereGeometry(0.15, 12, 12), goldenMat);
  head.name = 'dog_head';
  head.position.set(0.38, 0.4, 0);
  head.castShadow = true;
  root.add(head);

  // Snout — rounded box
  const snout = new Mesh(new SphereGeometry(0.07, 10, 10), lightGoldenMat);
  snout.name = 'dog_snout';
  snout.position.set(0.12, -0.04, 0);
  snout.scale.set(1.2, 0.7, 0.8);
  head.add(snout);

  // Nose — big wet nose
  const nose = new Mesh(new SphereGeometry(0.028, 8, 8), noseMat);
  nose.name = 'dog_nose';
  nose.position.set(0.18, -0.02, 0);
  head.add(nose);

  // Tongue hanging out — happy dog!
  const tongue = new Mesh(new SphereGeometry(0.025, 8, 8), tongueMat);
  tongue.name = 'dog_tongue';
  tongue.position.set(0.14, -0.1, 0);
  tongue.scale.set(0.7, 1.2, 0.8);
  head.add(tongue);

  // Eyes — warm brown
  [-1, 1].forEach((side) => {
    const eyeW = new Mesh(new SphereGeometry(0.028, 10, 10), whiteMat);
    eyeW.name = `dog_eyeW${side}`;
    eyeW.position.set(0.1, 0.05, side * 0.08);
    head.add(eyeW);

    const eyeP = new Mesh(new SphereGeometry(0.018, 10, 10), eyeMat);
    eyeP.name = `dog_eyeP${side}`;
    eyeP.position.set(0.12, 0.05, side * 0.08);
    head.add(eyeP);
  });

  // Floppy ears — rounded, hanging down
  [-1, 1].forEach((side) => {
    const ear = new Mesh(new SphereGeometry(0.06, 8, 8), darkGoldenMat);
    ear.name = `dog_ear${side}`;
    ear.position.set(0.32, 0.38, side * 0.14);
    ear.scale.set(0.5, 1.2, 0.6);
    root.add(ear);
  });

  // Legs — rounded
  const legPositions: [number, number][] = [
    [0.16, 0.08],
    [0.16, -0.08],
    [-0.16, 0.08],
    [-0.16, -0.08],
  ];
  legPositions.forEach(([lx, lz], i) => {
    const leg = new Mesh(new CylinderGeometry(0.035, 0.04, 0.25, 10), goldenMat);
    leg.name = `dog_leg${i}`;
    leg.position.set(lx, 0.12, lz);
    root.add(leg);

    const paw = new Mesh(new SphereGeometry(0.04, 8, 8), lightGoldenMat);
    paw.name = `dog_paw${i}`;
    paw.position.y = -0.13;
    paw.scale.y = 0.5;
    leg.add(paw);
  });

  // Fluffy tail — wagging upward, with feathery tip
  const tail = new Mesh(new CylinderGeometry(0.02, 0.035, 0.28, 8), goldenMat);
  tail.name = 'dog_tail';
  tail.position.set(-0.36, 0.42, 0);
  tail.rotation.z = 0.7;
  root.add(tail);

  const tailFluff = new Mesh(new SphereGeometry(0.03, 8, 8), lightGoldenMat);
  tailFluff.name = 'dog_tailFluff';
  tailFluff.position.y = 0.14;
  tailFluff.scale.set(0.8, 1.5, 0.8);
  tail.add(tailFluff);

  // Tail wag animation
  gsap.to(tail.rotation, { z: 1.0, duration: 0.3, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  return root;
}

// ── Movement helpers ──

/**
 * Facing angle for animal whose local forward is +X.
 * @param from - Start position
 * @param to - Target position
 * @returns Rotation angle in radians
 */
function facingAngle(from: Vector3, to: Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z) - Math.PI / 2;
}

/**
 * Face a target, then walk straight to it.
 * @param root - The group to move
 * @param target - Destination position
 * @param speed - Movement speed in units per second
 * @returns Promise that resolves when movement completes
 */
function walkStraight(root: Group, target: Vector3, speed: number): Promise<void> {
  return new Promise((resolve) => {
    const dx = target.x - root.position.x;
    const dz = target.z - root.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const dur = Math.max(dist / speed, 0.1);

    gsap.to(root.rotation, { y: facingAngle(root.position, target), duration: 0.25, ease: 'power2.out' });
    gsap.to(root.position, { x: target.x, z: target.z, duration: dur, ease: 'none', onComplete: resolve });
  });
}

/**
 * Graceful arc hop — smooth sine curve for Y while moving forward in XZ.
 * @param root - The group to animate
 * @param landTarget - Landing position
 * @param peakY - Peak height of the arc
 * @param duration - Duration of the hop in seconds
 * @returns Promise that resolves when the hop completes
 */
function hop(root: Group, landTarget: Vector3, peakY: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    // Face landing spot
    gsap.to(root.rotation, { y: facingAngle(root.position, landTarget), duration: 0.15, ease: 'power2.out' });

    const startX = root.position.x;
    const startZ = root.position.z;
    const startY = root.position.y;
    const endY = landTarget.y ?? 0;

    // Single tween drives everything via onUpdate for smooth coordination
    gsap.to(
      { t: 0 },
      {
        t: 1,
        duration,
        ease: 'power2.inOut',
        onUpdate() {
          const t = (this.targets()[0] as { t: number }).t;
          // Linear XZ interpolation
          root.position.x = startX + (landTarget.x - startX) * t;
          root.position.z = startZ + (landTarget.z - startZ) * t;
          // Smooth sine arc for Y
          const arc = Math.sin(t * Math.PI);
          root.position.y = startY + (endY - startY) * t + arc * peakY;
        },
        onComplete: resolve,
      },
    );
  });
}

/**
 * Pause.
 * @param seconds - Duration in seconds
 * @returns Promise that resolves after the delay
 */
function wait(seconds: number): Promise<void> {
  return new Promise((resolve) => gsap.delayedCall(seconds, resolve));
}

// ── Obstacle-aware path helpers ──

const TRACK_RADIUS = 3.95;

/** Known floor obstacles: [x, z, radius]. The cat hops over any it would cross. */
const FLOOR_OBSTACLES: [number, number, number][] = [
  // Small floor toys
  [-0.5, -0.5, 0.5], // stacking rings
  [-1.8, 1.0, 0.4], // block A
  [1.0, -2.8, 0.4], // block B
  [-3.8, -4.2, 0.4], // block C
  [0.8, -4.5, 0.3], // toy ball
  [4.0, -3.5, 0.5], // toy car
  [3.0, -2.0, 0.3], // spinning top
  [-1.2, -0.5, 0.5], // pull toy
  [-4.5, -3.5, 0.7], // beanbag
  [1.5, 2.5, 0.3], // rubber duck
  [-1.5, 2.0, 0.3], // stuffed star
  // Baskets
  [-5.0, 3.0, 0.45], // basket (left side)
  [4.8, -1.5, 0.45], // basket (right side)
  // Pillows
  [4.2, 3.5, 0.45], // pillow (right-back)
  [-4.5, 4.0, 0.45], // pillow (left-back)
  // Floor books
  [-4.2, 5.5, 0.5], // floor books
  // Toyboxes (large obstacles)
  [5.25, 1.5, 0.8], // adventure toybox (red)
  [-1.6, -6.5, 0.8], // animals toybox (blue)
  [-2.8, 8.25, 0.8], // creative toybox (green)
  [3.67, -6.88, 0.8], // nature toybox (purple)
];

/**
 * Find where a line segment (from→to on XZ plane) crosses the circular train track.
 * Returns crossing points sorted by distance from `from`.
 * @param from - Start of the line segment
 * @param to - End of the line segment
 * @returns Crossing points sorted by distance from `from`
 */
function findTrackCrossings(from: Vector3, to: Vector3): Vector3[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const fx = from.x;
  const fz = from.z;
  // Solve |from + t*(to-from)|² = R² for t
  const a = dx * dx + dz * dz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - TRACK_RADIUS * TRACK_RADIUS;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return [];

  const sqrtDisc = Math.sqrt(disc);
  const results: Vector3[] = [];
  for (const sign of [-1, 1]) {
    const t = (-b + sign * sqrtDisc) / (2 * a);
    if (t > 0.05 && t < 0.95) {
      results.push(new Vector3(fx + t * dx, 0, fz + t * dz));
    }
  }
  return results.sort((pa, pb) => pa.distanceToSquared(from) - pb.distanceToSquared(from));
}

/**
 * Find floor obstacles that the straight-line path would clip.
 * Returns them sorted by distance from `from`.
 * @param from - Start position of the path
 * @param to - End position of the path
 * @returns Obstacle center positions sorted by distance from `from`
 */
function findObstaclesCrossed(from: Vector3, to: Vector3): Vector3[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len === 0) return [];
  const nx = dx / len;
  const nz = dz / len;

  const hits: { point: Vector3; dist: number }[] = [];
  for (const [ox, oz, or] of FLOOR_OBSTACLES) {
    // Project obstacle center onto the line
    const relX = ox - from.x;
    const relZ = oz - from.z;
    const proj = relX * nx + relZ * nz;
    if (proj < 0 || proj > len) continue;
    // Perpendicular distance
    const perpX = from.x + proj * nx - ox;
    const perpZ = from.z + proj * nz - oz;
    const perpDist = Math.sqrt(perpX * perpX + perpZ * perpZ);
    if (perpDist < or + 0.15) {
      hits.push({ point: new Vector3(ox, 0, oz), dist: proj });
    }
  }
  return hits.sort((a, b) => a.dist - b.dist).map((h) => h.point);
}

/**
 * Walk from current position to target, hopping over train tracks and floor obstacles.
 * Does NOT walk into the target — stops at `stopShort` distance.
 * @param root - The group to move
 * @param target - Destination position
 * @param speed - Movement speed in units per second
 * @param stopShort - Distance from target to stop at
 */
async function smartWalk(root: Group, target: Vector3, speed: number, stopShort = 0): Promise<void> {
  const effectiveTarget =
    stopShort > 0
      ? (() => {
          const dx = target.x - root.position.x;
          const dz = target.z - root.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const frac = Math.max(0, (dist - stopShort) / dist);
          return new Vector3(root.position.x + dx * frac, 0, root.position.z + dz * frac);
        })()
      : target.clone();
  effectiveTarget.y = 0;

  // Collect all hop points along the path
  const trackCrossings = findTrackCrossings(root.position, effectiveTarget);
  const obstacleCrossings = findObstaclesCrossed(root.position, effectiveTarget);

  // Merge and sort by distance from current position
  const allHops = [...trackCrossings, ...obstacleCrossings].sort((a, b) => a.distanceToSquared(root.position) - b.distanceToSquared(root.position));

  // Deduplicate hops that are close together (< 1 unit)
  const hops: Vector3[] = [];
  for (const h of allHops) {
    if (hops.length === 0 || h.distanceTo(hops[hops.length - 1]) > 1.0) {
      hops.push(h);
    }
  }

  // Walk to each hop point, hop over it, then continue
  const dir = new Vector3().subVectors(effectiveTarget, root.position).normalize();
  for (const hopCenter of hops) {
    // Walk to 0.6 units before the obstacle
    const approachDist = Math.max(0, new Vector3(hopCenter.x - root.position.x, 0, hopCenter.z - root.position.z).dot(dir) - 0.6);
    if (approachDist > 0.2) {
      const approach = new Vector3(root.position.x + dir.x * approachDist, 0, root.position.z + dir.z * approachDist);
      await walkStraight(root, approach, speed);
    }

    // Hop over (land 0.6 units past the obstacle center)
    const landPoint = new Vector3(hopCenter.x + dir.x * 0.6, 0, hopCenter.z + dir.z * 0.6);
    await hop(root, landPoint, 0.5, 0.4);
  }

  // Walk remaining distance to effective target
  const remaining = root.position.distanceTo(effectiveTarget);
  if (remaining > 0.1) {
    await walkStraight(root, effectiveTarget, speed);
  }
}

/**
 * Arc-jump from current position onto the top of a toybox.
 * The animal leaps forward and up simultaneously.
 * @param root - The animal group to animate
 * @param toyboxPos - Toybox world position
 * @param topY - Y coordinate of the toybox top
 * @returns Promise that resolves when the leap completes
 */
function leapOnto(root: Group, toyboxPos: Vector3, topY: number): Promise<void> {
  const landPos = new Vector3(toyboxPos.x, topY, toyboxPos.z);
  return hop(root, landPos, topY * 0.6, 0.5);
}

/** Toybox top Y — classic toyboxes at scale 0.75: root offset 0.7*0.75=0.525, ridge 0.93*0.75=0.7 → ~1.25 */
const TOYBOX_TOP_Y = 1.3;

/**
 * Spawns ambient animal visitors after a delay:
 * 1. A kitty enters through the door, visits the purple and red toyboxes, then exits.
 * 2. A golden retriever enters, grabs Andy, and runs out.
 * @param scene - The Three.js scene to add visitors to
 * @returns A cleanup function to cancel all visitor animations
 */
export function spawnAnimalVisitors(scene: Scene): () => void {
  const cleanups: (() => void)[] = [];

  // ── Kitty sequence (repeats every 20 seconds) ──
  let kittyRunning = false;
  let kittyCancelled = false;

  async function runKittySequence(): Promise<void> {
    if (kittyRunning || kittyCancelled) return;
    kittyRunning = true;

    const kitty = buildKitty();
    kitty.position.copy(DOOR_CRACK_OUTSIDE);
    kitty.position.y = 0;
    scene.add(kitty);

    // Enter through door crack
    await walkStraight(kitty, DOOR_CRACK_INSIDE, 2);

    // Walk toward purple toybox, stopping 1.2 units short
    await smartWalk(kitty, new Vector3(PURPLE_TOYBOX.x, 0, PURPLE_TOYBOX.z), 3, 1.2);

    // Leap onto the top of purple toybox
    await leapOnto(kitty, PURPLE_TOYBOX, TOYBOX_TOP_Y);

    // Sit and look around
    await wait(0.3);
    await new Promise<void>((r) => gsap.to(kitty.rotation, { y: '+=0.6', duration: 0.5, ease: 'sine.inOut', onComplete: r }));
    await new Promise<void>((r) => gsap.to(kitty.rotation, { y: '-=0.9', duration: 0.6, ease: 'sine.inOut', onComplete: r }));
    await wait(0.3);

    // Jump down
    await hop(kitty, new Vector3(kitty.position.x + 0.8, 0, kitty.position.z + 0.8), 0.3, 0.35);

    // Walk toward red toybox, stopping 1.2 units short
    await smartWalk(kitty, new Vector3(RED_TOYBOX.x, 0, RED_TOYBOX.z), 3, 1.2);

    // Leap onto red toybox
    await leapOnto(kitty, RED_TOYBOX, TOYBOX_TOP_Y);

    // Sit briefly
    await wait(1.0);

    // Jump down
    await hop(kitty, new Vector3(kitty.position.x - 0.8, 0, kitty.position.z), 0.3, 0.35);

    // Sprint to door crack and exit
    await smartWalk(kitty, DOOR_CRACK_INSIDE.clone(), 5);
    await walkStraight(kitty, DOOR_CRACK_OUTSIDE, 4);
    scene.remove(kitty);

    kittyRunning = false;
  }

  // First appearance after 3 seconds, then every 20 seconds
  const kittyInitDelay = gsap.delayedCall(3, () => runKittySequence());
  const kittyRepeat = gsap.to(
    {},
    {
      duration: 20,
      repeat: -1,
      onRepeat: () => {
        runKittySequence();
      },
    },
  );
  kittyRepeat.delay(3);
  cleanups.push(() => {
    kittyCancelled = true;
    kittyInitDelay.kill();
    kittyRepeat.kill();
  });

  // ── Golden retriever sequence (5 seconds after kitty exits, ~22s total) ──
  const dogDelay = gsap.delayedCall(22, async () => {
    const dog = buildDog();
    dog.position.copy(DOOR_CRACK_OUTSIDE);
    dog.position.y = 0;
    scene.add(dog);

    // Nudge the door open wider
    const doorPivot = scene.getObjectByName('doorPivot');
    if (doorPivot) {
      await new Promise<void>((r) => gsap.to(doorPivot.rotation, { y: 0.6, duration: 0.5, ease: 'power2.out', onComplete: r }));
    }

    // Enter through door
    await walkStraight(dog, DOOR_CRACK_INSIDE, 2.5);

    // Walk to Andy's position (smart-walk hops over obstacles)
    await smartWalk(dog, new Vector3(ANDY_POS.x, 0, ANDY_POS.z), 2.5);

    // Look up at Andy
    await new Promise<void>((r) => gsap.to(dog.rotation, { x: -0.3, duration: 0.3, ease: 'power2.out', onComplete: r }));

    // Jump up to grab Andy
    await new Promise<void>((r) => gsap.to(dog.position, { y: 0.5, duration: 0.3, ease: 'power2.out', onComplete: r }));

    // Grab Andy — reparent him to the dog's mouth, dragging on ground
    const andy = scene.getObjectByName('raggedyAndy_root');
    if (andy) {
      scene.remove(andy);
      // Position Andy hanging from mouth, dragging along the floor
      andy.position.set(0.3, -0.15, 0); // low, near ground level
      andy.rotation.set(0, 0, -Math.PI / 3); // limp, dangling
      andy.scale.setScalar(1); // dog scale is 1.0 now
      dog.add(andy);
    }

    // Land back down
    await new Promise<void>((r) => {
      gsap.to(dog.position, { y: 0, duration: 0.2, ease: 'power2.in' });
      gsap.to(dog.rotation, { x: 0, duration: 0.2, onComplete: r });
    });

    // Run to door crack and exit (smart-walk avoids obstacles)
    await smartWalk(dog, DOOR_CRACK_INSIDE.clone(), 4);
    await walkStraight(dog, DOOR_CRACK_OUTSIDE, 4);

    // Close door back to ajar
    if (doorPivot) {
      gsap.to(doorPivot.rotation, { y: 0.12, duration: 0.8, ease: 'power2.inOut' });
    }

    scene.remove(dog);
  });
  cleanups.push(() => dogDelay.kill());

  return () => {
    cleanups.forEach((fn) => fn());
  };
}

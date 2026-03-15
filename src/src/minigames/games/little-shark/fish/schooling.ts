import type { Object3D } from 'three';

/** A single member of a fish school. */
export interface SchoolMember {
  root: Object3D;
  posX: number;
  posZ: number;
  velX: number;
  velZ: number;
  active: boolean;
}

/** State for a school of fish moving together. */
export interface SchoolState {
  members: SchoolMember[];
  centerX: number;
  centerZ: number;
  driftPhase: number;
}

/**
 * Normalize a 2D vector in place, returning its original length.
 * If the length is near zero the vector is left unchanged.
 * @param x - The X component.
 * @param z - The Z component.
 * @returns The normalized vector and its original length.
 */
const normalize2D = (x: number, z: number): { x: number; z: number; len: number } => {
  const len = Math.sqrt(x * x + z * z);
  if (len < 0.0001) return { x: 0, z: 0, len: 0 };
  return { x: x / len, z: z / len, len };
};

/**
 * Create a school from the given members, computing the initial center
 * from their current positions.
 *
 * @param members - The fish that belong to this school.
 * @returns A new SchoolState ready for simulation.
 */
export const createSchool = (members: SchoolMember[]): SchoolState => {
  const center = computeCenter(members);
  return {
    members: [...members],
    centerX: center.x,
    centerZ: center.z,
    driftPhase: 0,
  };
};

/**
 * Advance the school simulation by one frame, applying simplified boids
 * rules plus drift, shark avoidance, and boundary forces.
 *
 * @param school - The school state to mutate.
 * @param dt - Delta time in seconds.
 * @param bounds - Half-extent of the rectangular play area.
 * @param sharkPosX - Current shark X position.
 * @param sharkPosZ - Current shark Z position.
 * @param speedMult - Multiplier applied to base speed.
 */
export const updateSchool = (school: SchoolState, dt: number, bounds: number, sharkPosX: number, sharkPosZ: number, speedMult: number): void => {
  const BASE_SPEED = 1.2;
  const MAX_SPEED = 3.0;

  const SEPARATION_WEIGHT = 1.5;
  const ALIGNMENT_WEIGHT = 1.0;
  const COHESION_WEIGHT = 0.8;
  const DRIFT_WEIGHT = 0.5;
  const SHARK_WEIGHT = 2.0;
  const BOUNDS_WEIGHT = 3.0;

  const SEPARATION_RADIUS = 1.0;
  const SHARK_RADIUS = 3.0;

  // Advance drift phase and compute drift target
  school.driftPhase += dt * 0.3;
  const driftTargetX = Math.sin(school.driftPhase) * 2.0;
  const driftTargetZ = Math.sin(school.driftPhase * 2) * 2.0;

  const active = school.members.filter((m) => m.active);
  if (active.length === 0) return;

  const soloMode = active.length === 1;

  // Compute school center from active members
  const center = computeCenter(active);
  school.centerX = center.x;
  school.centerZ = center.z;

  const speed = BASE_SPEED * speedMult;

  for (const member of active) {
    let forceX = 0;
    let forceZ = 0;

    // --- Boids forces (skipped in solo mode) ---
    if (!soloMode) {
      // Separation: steer away from nearby school members
      let sepX = 0;
      let sepZ = 0;
      for (const other of active) {
        if (other === member) continue;
        const dx = member.posX - other.posX;
        const dz = member.posZ - other.posZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < SEPARATION_RADIUS && dist > 0.0001) {
          sepX += dx / dist;
          sepZ += dz / dist;
        }
      }
      const sepNorm = normalize2D(sepX, sepZ);
      forceX += sepNorm.x * SEPARATION_WEIGHT;
      forceZ += sepNorm.z * SEPARATION_WEIGHT;

      // Alignment: match average velocity direction of neighbors
      let alignX = 0;
      let alignZ = 0;
      let alignCount = 0;
      for (const other of active) {
        if (other === member) continue;
        alignX += other.velX;
        alignZ += other.velZ;
        alignCount++;
      }
      if (alignCount > 0) {
        const aN = normalize2D(alignX / alignCount, alignZ / alignCount);
        forceX += aN.x * ALIGNMENT_WEIGHT;
        forceZ += aN.z * ALIGNMENT_WEIGHT;
      }

      // Cohesion: steer toward school center
      const cohX = center.x - member.posX;
      const cohZ = center.z - member.posZ;
      const cohNorm = normalize2D(cohX, cohZ);
      forceX += cohNorm.x * COHESION_WEIGHT;
      forceZ += cohNorm.z * COHESION_WEIGHT;
    }

    // --- Drift: figure-eight pattern ---
    const driftDx = driftTargetX - member.posX;
    const driftDz = driftTargetZ - member.posZ;
    const driftNorm = normalize2D(driftDx, driftDz);
    forceX += driftNorm.x * DRIFT_WEIGHT;
    forceZ += driftNorm.z * DRIFT_WEIGHT;

    // --- Shark avoidance ---
    const sharkDx = member.posX - sharkPosX;
    const sharkDz = member.posZ - sharkPosZ;
    const sharkDist = Math.sqrt(sharkDx * sharkDx + sharkDz * sharkDz);
    if (sharkDist < SHARK_RADIUS && sharkDist > 0.0001) {
      const sharkNorm = normalize2D(sharkDx, sharkDz);
      forceX += sharkNorm.x * SHARK_WEIGHT;
      forceZ += sharkNorm.z * SHARK_WEIGHT;
    }

    // --- Bounds enforcement ---
    if (Math.abs(member.posX) > bounds || Math.abs(member.posZ) > bounds) {
      const boundsNorm = normalize2D(-member.posX, -member.posZ);
      forceX += boundsNorm.x * BOUNDS_WEIGHT;
      forceZ += boundsNorm.z * BOUNDS_WEIGHT;
    }

    // Apply forces to velocity
    member.velX += forceX * dt;
    member.velZ += forceZ * dt;

    // Clamp speed
    const currentSpeed = Math.sqrt(member.velX * member.velX + member.velZ * member.velZ);
    const clampedMax = Math.min(MAX_SPEED, speed + MAX_SPEED);
    if (currentSpeed > clampedMax) {
      const scale = clampedMax / currentSpeed;
      member.velX *= scale;
      member.velZ *= scale;
    }

    // Nudge toward base speed if too slow
    if (currentSpeed < speed * 0.5 && currentSpeed > 0.0001) {
      const nudge = (speed * 0.5) / currentSpeed;
      member.velX *= nudge;
      member.velZ *= nudge;
    }

    // Update position
    member.posX += member.velX * dt;
    member.posZ += member.velZ * dt;

    // Update mesh transform
    member.root.rotation.y = Math.atan2(member.velZ, member.velX);
    member.root.position.x = member.posX;
    member.root.position.z = member.posZ;
  }
};

/**
 * Return the average position of all active members in the school.
 *
 * @param school - The school to query.
 * @returns An object with the x and z coordinates of the school center.
 */
export const getSchoolCenter = (school: SchoolState): { x: number; z: number } => {
  return computeCenter(school.members.filter((m) => m.active));
};

/**
 * Mark a member as inactive and remove it from the school's member list.
 *
 * @param school - The school to modify.
 * @param member - The member to remove.
 */
export const removeFromSchool = (school: SchoolState, member: SchoolMember): void => {
  member.active = false;
  const idx = school.members.indexOf(member);
  if (idx !== -1) {
    school.members.splice(idx, 1);
  }
};

// Compute the average position of a list of members (active assumed).
const computeCenter = (members: SchoolMember[]): { x: number; z: number } => {
  const activeMembers = members.filter((m) => m.active);
  if (activeMembers.length === 0) return { x: 0, z: 0 };
  let sumX = 0;
  let sumZ = 0;
  for (const m of activeMembers) {
    sumX += m.posX;
    sumZ += m.posZ;
  }
  return { x: sumX / activeMembers.length, z: sumZ / activeMembers.length };
};

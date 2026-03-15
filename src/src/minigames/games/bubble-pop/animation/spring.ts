import { Vector3 } from 'three';

/**
 * State for a single scalar damped harmonic oscillator.
 * Use `createSpring` to create and `tickSpring` to advance.
 */
export interface SpringState {
  /** Current value. */
  value: number;
  /** Current velocity. */
  velocity: number;
  /** Target value the spring pulls toward. */
  target: number;
  /** Angular frequency — controls speed of oscillation. Higher = snappier. */
  omega: number;
  /** Damping ratio. 1.0 = critically damped, <1 = bouncy, >1 = overdamped. */
  zeta: number;
}

/**
 * Creates a new scalar spring in resting state.
 * @param value - Initial resting value.
 * @param omega - Angular frequency (stiffness). Default 12.
 * @param zeta - Damping ratio. Default 0.7 (slightly underdamped / bouncy).
 * @returns A SpringState struct.
 */
export function createSpring(value: number, omega = 12, zeta = 0.7): SpringState {
  return { value, velocity: 0, target: value, omega, zeta };
}

/**
 * Advances a scalar spring by dt seconds using semi-implicit Euler integration.
 * Mutates the spring state in-place. Returns the current value for convenience.
 * @param s - The spring to advance.
 * @param dt - Time step in seconds.
 * @returns The updated value.
 */
export function tickSpring(s: SpringState, dt: number): number {
  const diff = s.value - s.target;
  const accel = -s.omega * s.omega * diff - 2 * s.zeta * s.omega * s.velocity;
  s.velocity += accel * dt;
  s.value += s.velocity * dt;
  return s.value;
}

/**
 * Returns true if the spring is close enough to its target to be considered at rest.
 * @param s - The spring to check.
 * @param threshold - Position threshold. Default 0.001.
 * @param velThreshold - Velocity threshold. Default 0.01.
 * @returns True if the spring is at rest.
 */
export function isSpringAtRest(s: SpringState, threshold = 0.001, velThreshold = 0.01): boolean {
  return Math.abs(s.value - s.target) < threshold && Math.abs(s.velocity) < velThreshold;
}

/**
 * Snaps a spring to its target, zeroing velocity.
 * @param s - The spring to snap.
 */
export function snapSpring(s: SpringState): void {
  s.value = s.target;
  s.velocity = 0;
}

/**
 * State for a 3D spring (three independent scalar springs).
 */
export interface Spring3State {
  x: SpringState;
  y: SpringState;
  z: SpringState;
}

/**
 * Creates a 3D spring from a Vector3 initial value.
 * @param v - Initial position.
 * @param omega - Angular frequency. Default 12.
 * @param zeta - Damping ratio. Default 0.7.
 * @returns A Spring3State with independent x, y, z springs.
 */
export function createSpring3(v: Vector3, omega = 12, zeta = 0.7): Spring3State {
  return {
    x: createSpring(v.x, omega, zeta),
    y: createSpring(v.y, omega, zeta),
    z: createSpring(v.z, omega, zeta),
  };
}

/**
 * Advances a 3D spring and writes the result into a Vector3 (no allocation).
 * @param s - The 3D spring to advance.
 * @param dt - Time step in seconds.
 * @param out - Vector3 to write the result into.
 */
export function tickSpring3(s: Spring3State, dt: number, out: Vector3): void {
  out.x = tickSpring(s.x, dt);
  out.y = tickSpring(s.y, dt);
  out.z = tickSpring(s.z, dt);
}

/**
 * Sets the target of a 3D spring from a Vector3.
 * @param s - The 3D spring.
 * @param target - New target position.
 */
export function setSpring3Target(s: Spring3State, target: Vector3): void {
  s.x.target = target.x;
  s.y.target = target.y;
  s.z.target = target.z;
}

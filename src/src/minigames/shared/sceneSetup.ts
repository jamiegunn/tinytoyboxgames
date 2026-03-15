import { AmbientLight, DirectionalLight, PerspectiveCamera, PointLight, Vector3 } from 'three';

/** Configuration for a mini-game camera. */
export interface GameCameraOptions {
  /** Camera name prefix (e.g. 'fireflies'). */
  name: string;
  /** Vertical angle in radians. Default 1.2. */
  beta?: number;
  /** Distance from target. Default 9.0. */
  radius?: number;
  /** Look-at target. Default (0, 0.5, 0). */
  target?: Vector3;
  /** Field of view in radians. Default 0.85. */
  fov?: number;
}

/**
 * Creates a locked PerspectiveCamera suitable for mini-games.
 * The camera is positioned using spherical coordinates derived from the
 * original ArcRotateCamera parameters (alpha=0, beta, radius) and looks at
 * the target point. No orbit controls are attached.
 *
 * @param opts - Camera configuration.
 * @param aspect - Viewport aspect ratio. Defaults to 16/9.
 * @returns A configured PerspectiveCamera.
 */
export function createGameCamera(opts: GameCameraOptions, aspect = 16 / 9): PerspectiveCamera {
  const beta = opts.beta ?? 1.2;
  const radius = opts.radius ?? 9.0;
  const target = opts.target ?? new Vector3(0, 0.5, 0);
  const fov = opts.fov ?? 0.85;

  // Babylon fov is vertical in radians; Three.js PerspectiveCamera expects degrees.
  const fovDeg = (fov * 180) / Math.PI;

  const camera = new PerspectiveCamera(fovDeg, aspect, 0.1, 100);
  camera.name = `${opts.name}_camera`;

  // Convert Babylon ArcRotateCamera spherical coords (alpha=0, beta, radius) to cartesian.
  // Babylon uses a left-handed system; Three.js is right-handed. Negate Z to compensate.
  const alpha = 0;
  const x = radius * Math.sin(beta) * Math.sin(alpha);
  const y = radius * Math.cos(beta);
  const z = -(radius * Math.sin(beta) * Math.cos(alpha));

  camera.position.set(target.x + x, target.y + y, target.z + z);
  camera.lookAt(target);

  return camera;
}

/** Configuration for the standard three-light mini-game rig. */
export interface GameLightingOptions {
  /** Light name prefix (e.g. 'fireflies'). */
  name: string;
  /** Directional light direction (will be normalized). Default (-1, -3, 2). */
  direction?: Vector3;
  /** Directional light intensity. Default 0.7. */
  directionalIntensity?: number;
  /** Ambient fill intensity. Default 0.5. */
  hemisphericIntensity?: number;
  /** Point light position. Default (0, 4, -1). */
  pointPosition?: Vector3;
  /** Point light intensity. Default 0.3. */
  pointIntensity?: number;
}

/** The three lights returned by createGameLighting. */
export interface GameLightingRig {
  directionalLight: DirectionalLight;
  ambientLight: AmbientLight;
  pointLight: PointLight;
}

/**
 * Creates the standard three-light rig used by all mini-games:
 * directional key, ambient fill, and point accent.
 * The directional light is configured for shadow casting.
 *
 * @param opts - Lighting configuration.
 * @returns The three light instances (caller must add them to the scene).
 */
export function createGameLighting(opts: GameLightingOptions): GameLightingRig {
  const dir = (opts.direction ?? new Vector3(-1, -3, 2)).normalize();

  const directionalLight = new DirectionalLight(0xffffff, opts.directionalIntensity ?? 0.7);
  directionalLight.name = `${opts.name}_dirLight`;
  // Three.js DirectionalLight.position is the source; it shines toward the target (default 0,0,0).
  // Negate direction so light comes from the opposite side.
  directionalLight.position.set(-dir.x * 10, -dir.y * 10, -dir.z * 10);

  // Shadow setup on directional light
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(1024, 1024);
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;

  const ambientLight = new AmbientLight(0xffffff, opts.hemisphericIntensity ?? 0.5);
  ambientLight.name = `${opts.name}_ambientLight`;

  const pointPos = opts.pointPosition ?? new Vector3(0, 4, -1);
  const pointLight = new PointLight(0xffffff, opts.pointIntensity ?? 0.3, 0);
  pointLight.name = `${opts.name}_pointLight`;
  pointLight.position.copy(pointPos);

  return { directionalLight, ambientLight, pointLight };
}

/**
 * Disposes camera and all three lights from a game rig.
 *
 * @param camera - The game camera (may be null).
 * @param lights - The lighting rig (may be null).
 */
export function disposeGameRig(camera: PerspectiveCamera | null, lights: GameLightingRig | null): void {
  if (lights) {
    lights.pointLight.removeFromParent();
    lights.ambientLight.removeFromParent();
    lights.directionalLight.removeFromParent();
  }
  if (camera) camera.removeFromParent();
}

// ── Backward-compat type aliases used by game setup modules ──────────────────
/** @deprecated Use PerspectiveCamera instead. */
export type GameCamera = PerspectiveCamera;
/** @deprecated Use GameLightingRig instead. */
export type GameLights = GameLightingRig;

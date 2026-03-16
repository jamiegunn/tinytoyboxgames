import type { MiniGameId } from '@app/types/scenes';

/** Viewport information provided to mini-games for responsive layout. */
export interface ViewportInfo {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  scaleFactor: number;
  isMobile: boolean;
}

/** Pick result from a Three.js raycaster intersection. */
export interface PickResult {
  hit: boolean;
  pickedMesh?: unknown; // Three.js Object3D
  pickedPoint?: { x: number; y: number; z: number };
  point?: { x: number; y: number; z: number };
}

/** Tap input event delivered to a mini-game. */
export interface MiniGameTapEvent {
  screenX: number;
  screenY: number;
  pickResult: PickResult;
}

/** Drag input event delivered to a mini-game during pointer movement. */
export interface MiniGameDragEvent {
  screenX: number;
  screenY: number;
  deltaX: number;
  deltaY: number;
  totalDistance: number;
  pickResult: PickResult;
}

/** Drag-end input event delivered when the pointer is released after a drag. */
export interface MiniGameDragEndEvent {
  screenX: number;
  screenY: number;
  totalDistance: number;
}

/** Intensity level for celebration visual/audio effects. */
export type CelebrationIntensity = 'small' | 'medium' | 'large';

/** Manifest entry describing a registered mini-game and how to load it. */
export interface MiniGameManifestEntry {
  id: MiniGameId;
  displayName: string;
  description: string;
  inputModes: Array<'tap' | 'drag'>;
  themeColor: string;
  iconAssetId: string;
  comboWindowSeconds: number;
  hasSpecialItems: boolean;
  mode: 'endless' | 'round-based' | 'auto-runner';
  showScore: boolean;
  showProgressBar: boolean;
  ageNotes?: string;
  load: () => Promise<{ createGame: (context: MiniGameContext) => IMiniGame }>;
}

/** Lifecycle interface that every mini-game must implement. */
export interface IMiniGame {
  readonly id: MiniGameId;

  /**
   * Initializes the game's scene graph, assets, and state.
   * @param context - The shell-provided context with shared systems.
   */
  setup(context: MiniGameContext): Promise<void>;

  /** Starts or restarts gameplay after setup completes. */
  start(): void;

  /**
   * Called once per frame by the shell's render loop.
   * @param deltaTime - Seconds elapsed since the previous frame.
   */
  update(deltaTime: number): void;

  /** Pauses all game logic and timers. */
  pause(): void;

  /** Resumes game logic and timers after a pause. */
  resume(): void;

  /** Disposes all game resources and unsubscribes from shared systems. */
  teardown(): void;

  /**
   * Called when the viewport is resized.
   * @param viewport - Updated viewport information.
   */
  onResize(viewport: ViewportInfo): void;

  /**
   * Called when the player taps the game canvas.
   * @param event - Tap event with screen coordinates and pick result.
   */
  onTap(event: MiniGameTapEvent): void;

  /**
   * Called during a drag gesture. Only invoked if the manifest includes 'drag'.
   * @param event - Drag event with deltas and cumulative distance.
   */
  onDrag?(event: MiniGameDragEvent): void;

  /**
   * Called when a drag gesture ends.
   * @param event - Drag-end event with final position and total distance.
   */
  onDragEnd?(event: MiniGameDragEndEvent): void;
}

/** Context object provided to mini-games by the shell, containing shared systems. */
export interface MiniGameContext {
  scene: unknown; // Three.js Scene - kept as unknown to avoid hard dep
  renderer: unknown; // Three.js WebGLRenderer
  camera: unknown; // Three.js PerspectiveCamera
  canvas: HTMLCanvasElement;
  viewport: ViewportInfo;
  score: ScoreManager;
  combo: ComboTracker;
  celebration: CelebrationSystem;
  audio: AudioBridge;
  difficulty: DifficultyController;
  spawner: SpawnScheduler;

  /**
   * Creates a typed entity pool for object recycling.
   * @param config - Pool configuration with create/reset/dispose callbacks.
   * @returns A new entity pool instance.
   */
  createPool: <T>(config: EntityPoolConfig<T>) => EntityPool<T>;
}

/** Tracks and manages the player's score with combo multiplier support. */
export interface ScoreManager {
  readonly score: number;

  /**
   * Adds points to the score, applying the current combo multiplier.
   * @param basePoints - The base point value before multiplier.
   * @returns The actual points added after multiplier.
   */
  addPoints(basePoints: number): number;

  /** Resets the score to zero and notifies listeners. */
  reset(): void;

  /**
   * Subscribes to score changes.
   * @param callback - Called with the new score value whenever it changes.
   * @returns An unsubscribe function.
   */
  onScoreChanged: (callback: (newScore: number) => void) => () => void;
}

/** Tracks consecutive hit streaks and computes a score multiplier. */
export interface ComboTracker {
  readonly streak: number;
  readonly multiplier: number;

  /** Registers a successful hit, incrementing the streak if within the combo window. */
  registerHit(): void;

  /** Breaks the current combo, resetting streak to zero. */
  breakCombo(): void;

  /** Resets streak and multiplier to their initial values. */
  reset(): void;

  /**
   * Subscribes to combo state changes.
   * @param callback - Called with the current streak and multiplier on change.
   * @returns An unsubscribe function.
   */
  onComboChanged: (callback: (streak: number, multiplier: number) => void) => () => void;
}

/** Triggers celebration visual and audio effects during gameplay. */
export interface CelebrationSystem {
  /**
   * Spawns a confetti burst at the given screen coordinates.
   * @param screenX - Horizontal screen position.
   * @param screenY - Vertical screen position.
   * @param intensity - Effect intensity level.
   */
  confetti(screenX: number, screenY: number, intensity?: CelebrationIntensity): void;

  /**
   * Plays a celebration sound effect.
   * @param type - The type of celebration sound to play.
   */
  celebrationSound(type: 'pop' | 'chime' | 'fanfare' | 'whoosh' | 'chomp' | 'splash'): void;

  /**
   * Triggers a milestone celebration combining confetti and a fanfare sound.
   * @param screenX - Horizontal screen position.
   * @param screenY - Vertical screen position.
   * @param intensity - Effect intensity level.
   */
  milestone(screenX: number, screenY: number, intensity?: CelebrationIntensity): void;
}

/** Bridge to the app-level audio system for playing sounds and music. */
export interface AudioBridge {
  /**
   * Plays a one-shot sound effect.
   * @param soundId - The procedural audio module identifier.
   */
  playSound(soundId: string): void;

  /**
   * Starts playing background music.
   * @param musicId - The procedural music module identifier.
   */
  playMusic(musicId: string): void;

  /** Stops the currently playing background music. */
  stopMusic(): void;

  /** Whether audio output is currently muted. */
  readonly isMuted: boolean;
}

/** Controls difficulty scaling based on the player's score progression. */
export interface DifficultyController {
  /** Normalized difficulty level from 0 (easiest) to 1 (hardest). */
  readonly level: number;
  /** Current difficulty thresholds and unlock states. */
  readonly thresholds: DifficultyThresholds;
}

/** Threshold configuration for the difficulty controller. */
export interface DifficultyThresholds {
  rampStart: number;
  rampEnd: number;
  specialItemsUnlocked: boolean;
}

/** Schedules periodic spawn events with jitter and capacity limits. */
export interface SpawnScheduler {
  /**
   * Registers a spawn configuration and starts its timer loop.
   * @param config - Spawn timing and capacity configuration.
   * @returns A unique ID for cancelling this spawn registration.
   */
  register(config: SpawnConfig): string;

  /**
   * Cancels a previously registered spawn configuration.
   * @param id - The registration ID returned by register().
   */
  cancel(id: string): void;

  /** Pauses all active spawn timers. */
  pauseAll(): void;

  /** Resumes all paused spawn timers. */
  resumeAll(): void;

  /** Cancels and removes all spawn registrations. */
  clearAll(): void;
}

/** Configuration for a spawn timer registration. */
export interface SpawnConfig {
  /** The function called to spawn an entity. */
  spawn: () => void;
  /** Base interval between spawns in seconds. */
  intervalSeconds: number;
  /** Random jitter added to the interval in seconds. */
  jitterSeconds?: number;
  /** Maximum number of active entities before spawning is suppressed. */
  maxCount?: number;
  /** Returns the current number of active entities. */
  activeCount?: () => number;
}

/** Object pool for recycling entities to reduce garbage collection. */
export interface EntityPool<T> {
  /**
   * Acquires an entity from the pool, or creates a new one if the pool is empty.
   * @returns An entity ready for use.
   */
  acquire(): T;

  /**
   * Returns an entity to the pool for reuse.
   * @param entity - The entity to release.
   */
  release(entity: T): void;

  /**
   * Pre-creates entities and adds them to the pool.
   * @param count - Number of entities to pre-create.
   */
  prewarm(count: number): void;

  /** Disposes all active and pooled entities and resets the pool. */
  dispose(): void;

  /** Number of entities currently in use. */
  readonly activeCount: number;

  /** Number of entities available in the pool. */
  readonly pooledCount: number;
}

/** Configuration for creating an entity pool. */
export interface EntityPoolConfig<T> {
  /** Factory function to create a new entity. */
  create: () => T;
  /** Resets an entity to its initial state when returned to the pool. */
  reset: (entity: T) => void;
  /** Disposes an entity when it is permanently removed. */
  dispose: (entity: T) => void;
  /** Maximum number of entities to keep in the pool. Defaults to 50. */
  maxPoolSize?: number;
}

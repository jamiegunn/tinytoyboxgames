import { Scene, Mesh, MeshStandardMaterial, Color, Vector3, SphereGeometry, type Material } from 'three';
import { createBubbleMaterial } from '@app/minigames/shared/materials';
import type { BubbleState, BubbleKind } from '../types';
import type { EntityPool } from '../../../framework/types';
import {
  BUBBLE_COLORS,
  GOLDEN_COLOR,
  RAINBOW_COLOR,
  SIZE_VARIANTS,
  GOLDEN_BURST_COUNT,
  MAX_BUBBLES,
  MIN_FLOAT_SPEED,
  MAX_FLOAT_SPEED,
  SPAWN_X_MIN,
  SPAWN_X_MAX,
  SPAWN_Y_BOTTOM,
  SPAWN_X_LEFT_EDGE,
  SPAWN_X_RIGHT_EDGE,
  SPAWN_SIDE_Y_MIN,
  SPAWN_SIDE_Y_MAX,
  SPAWN_BOTTOM_CHANCE,
  WOBBLE_SPEED_MIN,
  WOBBLE_SPEED_MAX,
} from '../types';
import { randomRange } from '../helpers';

/**
 * Bubble entity lifecycle — creation, material assignment, spawn placement,
 * pool reset, disposal, and spawn patterns.
 */

/** Shared PBR material for the white specular shine highlight on each bubble. */
let shineMat: MeshStandardMaterial | null = null;

/** Counter for unique bubble mesh naming. */
let bubbleIndex = 0;

/**
 * Assigns a PBR iridescent soap-bubble material to a bubble mesh.
 * Disposes any existing material on the mesh before applying.
 * @param _scene - The Three.js scene.
 * @param mesh - The bubble mesh to style.
 * @param kind - The bubble kind (determines color).
 * @returns The base color and color index assigned.
 */
export function applyBubbleMaterial(_scene: Scene, mesh: Mesh, kind: BubbleKind): { baseColor: Color; colorIndex: number } {
  if (mesh.material && mesh.material !== shineMat) {
    (mesh.material as Material).dispose();
  }

  let baseColor: Color;
  let colorIndex: number;

  if (kind === 'golden') {
    baseColor = GOLDEN_COLOR;
    colorIndex = 0;
  } else if (kind === 'rainbow') {
    baseColor = RAINBOW_COLOR;
    colorIndex = 0;
  } else {
    colorIndex = Math.floor(Math.random() * BUBBLE_COLORS.length);
    baseColor = BUBBLE_COLORS[colorIndex];
  }

  const alpha = kind === 'giant' ? 0.6 : 0.5;
  const mat = createBubbleMaterial(`bubbleMat_${mesh.name}`, baseColor, alpha);
  mesh.material = mat;

  return { baseColor, colorIndex };
}

/**
 * Positions a bubble at an off-screen edge — bottom (70%) or left/right side (30%).
 * Starts at zero scale with spawning=true for the entrance animation.
 * @param bubble - The bubble state to reposition.
 */
export function positionBubbleAtSpawn(bubble: BubbleState): void {
  if (Math.random() < SPAWN_BOTTOM_CHANCE) {
    // Spawn from bottom edge
    bubble.mesh.position.x = randomRange(SPAWN_X_MIN, SPAWN_X_MAX);
    bubble.mesh.position.y = SPAWN_Y_BOTTOM + randomRange(-0.5, 0);
  } else {
    // Spawn from a side edge
    const fromLeft = Math.random() < 0.5;
    bubble.mesh.position.x = fromLeft ? SPAWN_X_LEFT_EDGE : SPAWN_X_RIGHT_EDGE;
    bubble.mesh.position.y = randomRange(SPAWN_SIDE_Y_MIN, SPAWN_SIDE_Y_MAX);
  }
  bubble.mesh.position.z = randomRange(-1, 1.5);
  bubble.speed = randomRange(MIN_FLOAT_SPEED, MAX_FLOAT_SPEED);
  bubble.phase = Math.random() * Math.PI * 2;
  bubble.wobblePhase = Math.random() * Math.PI * 2;
  bubble.wobbleSpeed = randomRange(WOBBLE_SPEED_MIN, WOBBLE_SPEED_MAX);
  bubble.active = true;
  bubble.age = 0;
  bubble.spawning = true;
  bubble.mesh.visible = true;
  bubble.mesh.scale.setScalar(0);
}

/**
 * Creates a new bubble entity for the pool.
 * @param scene - The Three.js scene.
 * @returns A fresh BubbleState ready for pooling.
 */
export function createBubble(scene: Scene): BubbleState {
  const sizeVariant = Math.floor(Math.random() * SIZE_VARIANTS.length);
  const name = `bubble_${bubbleIndex++}`;
  const geo = new SphereGeometry(0.5, 32, 32);
  const mesh = new Mesh(geo);
  mesh.name = name;
  scene.add(mesh);

  const { baseColor, colorIndex } = applyBubbleMaterial(scene, mesh, 'normal');

  // Shine mesh removed — the custom bubble shader handles specular highlights via Fresnel.
  // We still create a dummy mesh ref so BubbleState.shineMesh stays valid for existing code.
  const shine = new Mesh();
  shine.visible = false;

  return {
    mesh,
    shineMesh: shine,
    speed: randomRange(MIN_FLOAT_SPEED, MAX_FLOAT_SPEED),
    phase: Math.random() * Math.PI * 2,
    sizeVariant,
    active: false,
    baseColor,
    colorIndex,
    kind: 'normal',
    tapsRemaining: 0,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleSpeed: randomRange(WOBBLE_SPEED_MIN, WOBBLE_SPEED_MAX),
    age: 0,
    spawning: false,
  };
}

/**
 * Resets a bubble entity when it is returned to the pool.
 * @param _scene - The Three.js scene (unused in Three.js version).
 * @param bubble - The bubble to reset.
 */
export function resetBubble(_scene: Scene, bubble: BubbleState): void {
  bubble.active = false;
  bubble.spawning = false;
  bubble.mesh.visible = false;
  bubble.mesh.position.set(0, -10, 0);
  bubble.mesh.scale.setScalar(1);
  bubble.kind = 'normal';
  bubble.tapsRemaining = 0;
  bubble.age = 0;
}

/**
 * Spawns a burst of small bubbles radiating outward from a position.
 * @param scene - The Three.js scene.
 * @param pool - The bubble entity pool.
 * @param activeBubbles - The mutable array of active bubbles.
 * @param pos - World position to radiate from.
 */
export function spawnGoldenBurst(scene: Scene, pool: EntityPool<BubbleState>, activeBubbles: BubbleState[], pos: Vector3): void {
  for (let i = 0; i < GOLDEN_BURST_COUNT; i++) {
    if (activeBubbles.length >= MAX_BUBBLES) break;

    const bubble = pool.acquire();
    bubble.kind = 'normal';
    bubble.sizeVariant = 0;
    bubble.tapsRemaining = 1;

    const { baseColor, colorIndex } = applyBubbleMaterial(scene, bubble.mesh, 'normal');
    bubble.baseColor = baseColor;
    bubble.colorIndex = colorIndex;

    const angle = (i / GOLDEN_BURST_COUNT) * Math.PI * 2;
    const dist = 0.5 + Math.random() * 0.8;
    bubble.mesh.position.set(pos.x + Math.cos(angle) * dist, pos.y + Math.sin(angle) * dist * 0.5 + randomRange(-0.3, 0.3), pos.z + randomRange(-0.3, 0.3));
    bubble.speed = randomRange(0.4, 0.9);
    bubble.phase = Math.random() * Math.PI * 2;
    bubble.wobblePhase = Math.random() * Math.PI * 2;
    bubble.wobbleSpeed = randomRange(3.0, 5.0);
    bubble.active = true;
    bubble.age = 0;
    bubble.spawning = true;
    bubble.mesh.visible = true;
    bubble.mesh.scale.setScalar(0);

    activeBubbles.push(bubble);
  }
}

/**
 * Disposes a bubble entity permanently (mesh + shine + material).
 * @param bubble - The bubble to dispose.
 */
export function disposeBubble(bubble: BubbleState): void {
  bubble.shineMesh.geometry?.dispose();
  bubble.shineMesh.removeFromParent();
  if (bubble.mesh.material && bubble.mesh.material !== shineMat) {
    (bubble.mesh.material as Material).dispose();
  }
  bubble.mesh.geometry?.dispose();
  bubble.mesh.removeFromParent();
}

/**
 * Disposes the shared shine material. Call during teardown.
 */
export function disposeSharedShineMat(): void {
  if (shineMat) {
    shineMat.dispose();
    shineMat = null;
  }
}

/**
 * Resets the bubble index counter.
 */
export function resetBubbleIndex(): void {
  bubbleIndex = 0;
}

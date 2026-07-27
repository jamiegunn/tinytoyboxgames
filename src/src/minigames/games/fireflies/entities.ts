import { type Scene, SpriteMaterial, Sprite, Vector3, AdditiveBlending, NormalBlending, CanvasTexture, Color } from 'three';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES, FIREFLY_GLOW_RATE } from '@app/utils/particles/presets';
import type { FireflyData } from './types';
import { FIREFLY_COLOR, GOLDEN_COLOR, FIREFLY_SPRITE_SCALE, GOLDEN_SPRITE_SCALE, FIREFLY_BODY_SCALE } from './types';
import { randomRange } from '@app/minigames/shared/mathUtils';
import { randomSpawnPos, randomBehavior } from './helpers';

// ── Cached glow dot texture ─────────────────────────────────────────────────

let glowDotTexture: CanvasTexture | null = null;

/**
 * Returns a cached 64x64 soft radial glow texture.
 * Bright center fading smoothly to transparent — looks like a point of light.
 * @returns The cached CanvasTexture for glow dots.
 */
function getGlowDotTexture(): CanvasTexture {
  if (glowDotTexture) return glowDotTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowDotTexture = new CanvasTexture(canvas);
  return glowDotTexture;
}

// ── Cached firefly creature textures ────────────────────────────────────────

// The game is named after fireflies, but a firefly used to be nothing but a
// blurry radial gradient — no body, no wings, no eyes. These two cached
// canvases draw a proper little creature (glowing abdomen, thorax, head, eyes,
// antennae and a pair of translucent wings) in a wings-up and a wings-down
// pose. Every firefly shares the same two textures and simply swaps which one
// its material samples, so the whole flock costs two 64x64 textures total and
// zero extra geometry — the glow halo underneath still carries the bloom that
// makes them readable in the dark.

// Orbit radius range for `circle` fireflies, in world units.
//
// Was 0.8-1.5. The play box is only ~3.2 units wide at its near edge (at
// z = SPAWN.zMax = 2.6 and y = 1 the view depth is 2.60, and the usable
// half-width is 0.72 * (1200/810) * tan(30 deg) * 2.60 = 1.60), so an orbit of
// radius 1.5 swept 94% of the half-width and spent most of every revolution
// pinned against the containment wall. 0.4-0.95 is 25-59% of that half-width,
// so a full revolution fits on screen from any reasonable spawn point.
const ORBIT_RADIUS_MIN = 0.4;
const ORBIT_RADIUS_MAX = 0.95;

/** Canvas size for the creature textures. */
const CREATURE_TEX_SIZE = 64;

/** Wing angles (radians, relative to the shoulder) for the two flap frames. */
const WING_SPREAD_UP = -0.5;
const WING_SPREAD_DOWN = 0.38;

let creatureTexUp: CanvasTexture | null = null;
let creatureTexDown: CanvasTexture | null = null;

// Draws one flap frame of the firefly creature into a 2D context.
// `spread` is the wing rotation at the shoulder; negative lifts the wings.
function drawCreature(ctx: CanvasRenderingContext2D, spread: number): void {
  const c = CREATURE_TEX_SIZE / 2;

  // Wings first so the body overlaps them — translucent, faintly outlined.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(c + side * 4, c - 4);
    ctx.rotate(side * spread);
    ctx.beginPath();
    ctx.ellipse(side * 11, 0, 13, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(226, 240, 255, 0.3)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.stroke();
    ctx.restore();
  }

  // Glowing abdomen — the lantern, and the reason the halo sits where it does.
  const glow = ctx.createRadialGradient(c, c + 12, 0, c, c + 12, 13);
  glow.addColorStop(0, 'rgba(255, 250, 215, 1)');
  glow.addColorStop(0.45, 'rgba(255, 208, 95, 0.95)');
  glow.addColorStop(1, 'rgba(255, 170, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c, c + 12, 13, 0, Math.PI * 2);
  ctx.fill();

  // Thorax
  ctx.fillStyle = 'rgba(62, 45, 27, 0.95)';
  ctx.beginPath();
  ctx.ellipse(c, c + 1, 6.5, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = 'rgba(40, 29, 17, 1)';
  ctx.beginPath();
  ctx.arc(c, c - 11, 6, 0, Math.PI * 2);
  ctx.fill();

  // Antennae — two short curved strokes, the cheapest "this is alive" cue.
  ctx.strokeStyle = 'rgba(40, 29, 17, 0.9)';
  ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + side * 3, c - 15);
    ctx.quadraticCurveTo(c + side * 7, c - 21, c + side * 9.5, c - 19);
    ctx.stroke();
  }

  // Eyes — big and friendly, with a highlight, per the toddler art direction.
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.beginPath();
    ctx.arc(c + side * 2.7, c - 12, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(22, 15, 8, 1)';
    ctx.beginPath();
    ctx.arc(c + side * 2.9, c - 11.6, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Builds (once) and returns the two creature flap frames.
function getCreatureTextures(): { up: CanvasTexture; down: CanvasTexture } {
  if (creatureTexUp && creatureTexDown) return { up: creatureTexUp, down: creatureTexDown };

  const make = (spread: number): CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = CREATURE_TEX_SIZE;
    canvas.height = CREATURE_TEX_SIZE;
    const ctx = canvas.getContext('2d')!;
    drawCreature(ctx, spread);
    return new CanvasTexture(canvas);
  };

  creatureTexUp = make(WING_SPREAD_UP);
  creatureTexDown = make(WING_SPREAD_DOWN);
  return { up: creatureTexUp, down: creatureTexDown };
}

/**
 * Returns the shared wings-up / wings-down creature textures.
 * The per-frame flap in the game loop swaps between these two maps.
 * @returns The two cached flap-frame textures.
 */
export function getFireflyCreatureTextures(): { up: CanvasTexture; down: CanvasTexture } {
  return getCreatureTextures();
}

/**
 * Creates a firefly entity: an additive glow halo billboard carrying the bloom,
 * with a small creature billboard (body, head, eyes, flapping wings) parented
 * inside it, plus a particle trail. No 3D mesh and no per-firefly PointLight —
 * two billboards and two shared textures keep the fragment shaders cheap and
 * avoid the shader recompile hitch that adding/removing dynamic lights causes
 * mid-scene, while still looking like the animal the game is named after.
 *
 * @param scene - The Three.js scene.
 * @param index - Index for unique naming.
 * @param isGolden - Whether this is the golden variant.
 * @returns A FireflyData object ready for activation.
 */
export function createFirefly(scene: Scene, index: number, isGolden: boolean): FireflyData {
  const baseColor = isGolden ? GOLDEN_COLOR : FIREFLY_COLOR;

  // ── Glow halo: the bloom that makes a firefly readable in a dark meadow ──
  const spriteSize = isGolden ? GOLDEN_SPRITE_SCALE : FIREFLY_SPRITE_SCALE;
  const spriteMaterial = new SpriteMaterial({
    map: getGlowDotTexture(),
    color: baseColor.clone(),
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new Sprite(spriteMaterial);
  sprite.scale.setScalar(spriteSize);
  sprite.name = `nature_firefly_${isGolden ? 'golden' : 'standard'}_${index}`;
  sprite.raycast = () => {}; // hit detection is screen-space, not raycaster
  scene.add(sprite);

  // ── Creature: parented to the halo so it inherits position and catch pop ──
  // NormalBlending (not additive) so the dark body and eyes actually read as
  // shape rather than dissolving into the glow; renderOrder puts it in front.
  const creature = getCreatureTextures();
  const bodyMaterial = new SpriteMaterial({
    map: creature.up,
    color: isGolden ? new Color(1, 0.94, 0.72) : new Color(1, 1, 1),
    transparent: true,
    opacity: 0.95,
    blending: NormalBlending,
    depthWrite: false,
  });
  const bodySprite = new Sprite(bodyMaterial);
  bodySprite.scale.setScalar(FIREFLY_BODY_SCALE);
  bodySprite.renderOrder = 2;
  bodySprite.name = `${sprite.name}_creature`;
  bodySprite.raycast = () => {};
  sprite.add(bodySprite);

  // ── Position ──
  const pos = randomSpawnPos();
  sprite.position.copy(pos);

  // ── Continuous glow particle trail (follows the sprite each tick) ──
  const glowTrail = getParticleEngine(scene).stream(PARTICLES.fireflyGlow, sprite, FIREFLY_GLOW_RATE, { colors: [baseColor] });

  const behavior = randomBehavior();
  // The orbit centre is the spawn point, not a second independent draw. A
  // `circle` firefly writes its position absolutely from `behaviorCenter` on
  // its very first update, so an unrelated centre made it teleport away from
  // where it was just placed — including away from the deliberately-foreground
  // placements the game makes to keep targets reachable.
  const behaviorCenter = pos.clone();
  const behaviorRadius = randomRange(ORBIT_RADIUS_MIN, ORBIT_RADIUS_MAX);
  const zigzagDir = new Vector3(randomRange(-1, 1), randomRange(-0.5, 0.5), randomRange(-0.5, 0.5)).normalize();

  return {
    sprite,
    spriteMaterial,
    bodySprite,
    bodyMaterial,
    flapPhase: Math.random(),
    lifeTimer: -1,
    glowTrail,
    speed: randomRange(0.25, 0.55),
    glowPhase: Math.random() * Math.PI * 2,
    driftOffsetX: Math.random() * Math.PI * 2,
    driftOffsetY: Math.random() * Math.PI * 2,
    driftOffsetZ: Math.random() * Math.PI * 2,
    time: Math.random() * 100,
    isGolden,
    catching: false,
    catchProgress: 0,
    catchStartPos: new Vector3(0, 0, 0),
    flashing: false,
    flashTimer: 0,
    active: true,
    respawnTimer: 0,
    behavior,
    behaviorCenter,
    behaviorAngle: Math.random() * Math.PI * 2,
    behaviorRadius,
    zigzagTimer: randomRange(1.0, 2.0),
    zigzagDir,
  };
}

/**
 * Resets a firefly to a new random position with new drift parameters.
 *
 * @param fd - The firefly data to reset.
 */
export function resetFirefly(fd: FireflyData): void {
  const pos = randomSpawnPos();
  fd.sprite.position.copy(pos);
  fd.speed = randomRange(0.25, 0.55);
  fd.glowPhase = Math.random() * Math.PI * 2;
  fd.driftOffsetX = Math.random() * Math.PI * 2;
  fd.driftOffsetY = Math.random() * Math.PI * 2;
  fd.driftOffsetZ = Math.random() * Math.PI * 2;
  fd.time = Math.random() * 100;
  fd.catching = false;
  fd.catchProgress = 0;
  fd.flashing = false;
  fd.flashTimer = 0;
  fd.active = true;
  fd.respawnTimer = 0;
  fd.behavior = randomBehavior();
  // Same as createFirefly: orbit around where we just put it, not elsewhere.
  fd.behaviorCenter.copy(pos);
  fd.behaviorAngle = Math.random() * Math.PI * 2;
  fd.behaviorRadius = randomRange(ORBIT_RADIUS_MIN, ORBIT_RADIUS_MAX);
  fd.zigzagTimer = randomRange(1.0, 2.0);
  fd.zigzagDir = new Vector3(randomRange(-1, 1), randomRange(-0.5, 0.5), randomRange(-0.5, 0.5)).normalize();
  fd.sprite.visible = true;
  fd.spriteMaterial.opacity = 0.85;
  fd.bodyMaterial.opacity = 0.95;
  fd.flapPhase = Math.random();
  fd.lifeTimer = -1;
  fd.sprite.scale.setScalar(fd.isGolden ? GOLDEN_SPRITE_SCALE : FIREFLY_SPRITE_SCALE);
  fd.glowTrail.start();
}

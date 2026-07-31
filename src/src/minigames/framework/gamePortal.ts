import {
  Mesh,
  Group,
  Color,
  MeshStandardMaterial,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  CircleGeometry,
  Vector3,
  type Scene,
  type Object3D,
} from 'three';
import gsap from 'gsap';
import type { BuiltInMiniGameId, MiniGameId, NavigationActions } from '@app/types/scenes';
import { triggerSound } from '@app/assets/audio/sceneBridge';

/** Configuration for a single game portal placement. */
export interface GamePortalConfig {
  gameId: MiniGameId;
  position: Vector3;
  color: Color;
}

/** Result of building game portals, including tappable meshes for raycasting. */
export interface GamePortalResult {
  root: Group;
  tappableMeshes: Object3D[];
  /** Kills the portal's infinite GSAP tweens. Must be called on scene disposal. */
  dispose: () => void;
}

// ── Helper: create a colored MeshStandardMaterial ──

function mat(name: string, diffuse: Color, emissive?: Color): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: diffuse,
    emissive: emissive ?? new Color(0, 0, 0),
    roughness: 0.7,
    metalness: 0.05,
  });
  m.name = name;
  return m;
}

// ── Geometry helpers ──

function createSphere(name: string, diameter: number, segments = 16): Mesh {
  const m = new Mesh(new SphereGeometry(diameter / 2, segments, segments));
  m.name = name;
  return m;
}

function createCylinder(name: string, diameterTop: number, diameterBottom: number, height: number, tessellation = 16): Mesh {
  const m = new Mesh(new CylinderGeometry(diameterTop / 2, diameterBottom / 2, height, tessellation));
  m.name = name;
  return m;
}

// `createBox` used to sit here. It went with the truck and blocks icons below —
// no live portal icon is boxy. tsc found it, not a reviewer: deleting a symbol's
// only two callers is what makes a helper dead, and the helper is one level away
// from the thing you edited.

function createTorus(name: string, diameter: number, thickness: number, tessellation = 32): Mesh {
  const m = new Mesh(new TorusGeometry(diameter / 2, thickness / 2, 16, tessellation));
  m.name = name;
  return m;
}

function createDisc(name: string, radius: number, tessellation = 16): Mesh {
  const m = new Mesh(new CircleGeometry(radius, tessellation));
  m.name = name;
  return m;
}

// ════════════════════════════════════════════════════════════════════
// Per-game icon builders — each returns a parent Group with children
// ════════════════════════════════════════════════════════════════════

function buildBubblesIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_bubbles`;
  const bubbleMat = mat(`${id}_bubMat`, new Color(0.7, 0.9, 1), new Color(0.15, 0.25, 0.35));
  bubbleMat.opacity = 0.6;
  bubbleMat.transparent = true;
  // A tighter, smaller bubble cluster — the old one read as giant orbs floating
  // in the air. Kept compact so it reads as a neat bubble bunch portal icon.
  const bubbles = [
    { pos: new Vector3(0, 0.04, 0), size: 0.26 },
    { pos: new Vector3(0.15, 0.18, 0.06), size: 0.18 },
    { pos: new Vector3(-0.13, 0.15, -0.04), size: 0.2 },
    { pos: new Vector3(0.07, -0.09, 0.09), size: 0.14 },
    { pos: new Vector3(-0.06, 0.28, 0.05), size: 0.12 },
  ];
  for (let i = 0; i < bubbles.length; i++) {
    const b = createSphere(`${id}_b${i}`, bubbles[i].size, 10);
    b.position.copy(bubbles[i].pos);
    b.material = bubbleMat;
    root.add(b);
  }
  return root;
}

function buildJarIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_jar`;
  // Glass jar body
  const jarMat = mat(`${id}_jarMat`, new Color(0.7, 0.85, 0.9), new Color(0.1, 0.15, 0.2));
  jarMat.opacity = 0.5;
  jarMat.transparent = true;
  const jar = createCylinder(`${id}_jar`, 0.4, 0.4, 0.5, 16);
  jar.position.y = -0.05;
  jar.material = jarMat;
  root.add(jar);
  // Lid
  const lid = createCylinder(`${id}_lid`, 0.42, 0.42, 0.08, 16);
  lid.position.y = 0.24;
  lid.material = mat(`${id}_lidMat`, new Color(0.5, 0.35, 0.2), new Color(0.08, 0.05, 0.02));
  root.add(lid);
  // Glowing firefly dots inside (3-4 small emissive spheres)
  const glowMat = mat(`${id}_glowMat`, new Color(0.8, 1, 0.3), new Color(0.6, 0.9, 0.2));
  const glowPositions = [new Vector3(0.05, 0.05, 0.05), new Vector3(-0.08, -0.08, -0.03), new Vector3(0.06, 0.12, -0.06), new Vector3(-0.04, -0.02, 0.08)];
  for (let i = 0; i < glowPositions.length; i++) {
    const dot = createSphere(`${id}_glow${i}`, 0.06, 6);
    dot.position.copy(glowPositions[i]);
    dot.material = glowMat;
    root.add(dot);
  }
  return root;
}

function buildSharkFinIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_shark`;
  // Water surface (flat blue disc)
  const water = createDisc(`${id}_water`, 0.35, 16);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.15;
  water.material = mat(`${id}_waterMat`, new Color(0.15, 0.4, 0.7), new Color(0.05, 0.12, 0.25));
  root.add(water);
  // Dorsal fin poking above water
  const fin = createCylinder(`${id}_fin`, 0, 0.25, 0.4, 3);
  fin.position.y = 0.08;
  fin.rotation.z = 0.15; // slight lean
  fin.material = mat(`${id}_finMat`, new Color(0.4, 0.5, 0.6), new Color(0.08, 0.1, 0.14));
  root.add(fin);
  // Small wave ripples (thin toruses)
  const rippleMat = mat(`${id}_ripMat`, new Color(0.5, 0.7, 1), new Color(0.1, 0.15, 0.25));
  rippleMat.opacity = 0.5;
  rippleMat.transparent = true;
  for (let i = 0; i < 2; i++) {
    const ripple = createTorus(`${id}_rip${i}`, 0.3 + i * 0.2, 0.02, 16);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = -0.14;
    ripple.material = rippleMat;
    root.add(ripple);
  }
  // Friendly eye on the fin base
  const eye = createSphere(`${id}_eye`, 0.06, 6);
  eye.position.set(0.06, -0.02, 0.1);
  eye.material = mat(`${id}_eyeMat`, new Color(0.1, 0.1, 0.1));
  root.add(eye);
  // Fish friend (tiny orange fish nearby)
  const fish = createSphere(`${id}_fish`, 0.1, 6);
  fish.scale.set(1.4, 0.8, 0.8);
  fish.position.set(-0.25, -0.1, 0.1);
  const fishMat = mat(`${id}_fishMat`, new Color(1, 0.5, 0.1), new Color(0.25, 0.1, 0.02));
  fish.material = fishMat;
  root.add(fish);
  // Fish tail
  const tail = createCylinder(`${id}_ftail`, 0.08, 0, 0.08, 3);
  tail.position.set(-0.33, -0.1, 0.1);
  tail.rotation.z = Math.PI / 2;
  tail.material = fishMat;
  root.add(tail);
  return root;
}

function buildCannonballIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_cannonball`;
  // Dark iron cannonball
  const ball = createSphere(`${id}_ball`, 0.3, 8);
  ball.material = mat(`${id}_ballMat`, new Color(0.1, 0.1, 0.12), new Color(0.02, 0.02, 0.03));
  (ball.material as MeshStandardMaterial).metalness = 0.8;
  (ball.material as MeshStandardMaterial).roughness = 0.3;
  root.add(ball);
  // 3 splash droplets arcing upward
  const dropMat = mat(`${id}_dropMat`, new Color(0.5, 0.75, 1), new Color(0.12, 0.2, 0.35));
  const dropPositions = [new Vector3(-0.15, 0.25, 0.05), new Vector3(0.05, 0.35, -0.05), new Vector3(0.18, 0.2, 0.08)];
  for (let i = 0; i < 3; i++) {
    const drop = createSphere(`${id}_drop${i}`, 0.1, 6);
    drop.position.copy(dropPositions[i]);
    drop.material = dropMat;
    root.add(drop);
  }
  return root;
}

// ── Icon builder dispatch ──

function buildFallbackSparkIcon(id: string): Group {
  const root = new Group();
  root.name = `${id}_fallback`;

  const core = createSphere(`${id}_core`, 0.28, 10);
  core.material = mat(`${id}_coreMat`, new Color(0.9, 0.86, 0.42), new Color(0.35, 0.25, 0.08));
  root.add(core);

  const halo = createTorus(`${id}_halo`, 0.72, 0.08, 24);
  halo.rotation.x = Math.PI / 2;
  halo.material = mat(`${id}_haloMat`, new Color(0.66, 0.84, 1), new Color(0.18, 0.24, 0.34));
  root.add(halo);

  for (let index = 0; index < 4; index += 1) {
    const ray = createCylinder(`${id}_ray${index}`, 0.04, 0.02, 0.5, 6);
    ray.material = mat(`${id}_rayMat${index}`, new Color(1, 0.95, 0.72), new Color(0.22, 0.18, 0.08));
    ray.position.y = 0.02;
    ray.rotation.z = (Math.PI / 2) * index;
    root.add(ray);
  }

  return root;
}

const ICON_BUILDERS: Record<BuiltInMiniGameId, (id: string) => Group> = {
  'bubble-pop': buildBubblesIcon,
  fireflies: buildJarIcon,
  'little-shark': buildSharkFinIcon,
  'cannonball-splash': buildCannonballIcon,
};

// NOT HERE DELIBERATELY: `INACTIVE_ICON_BUILDERS`, a map of eight icon builders
// — balloon, truck, carrot, ball, elephant, palette, blocks, teddy — and the 237
// lines that built them. Removed in full.
//
// The map's own docblock said it kept the builders "while still satisfying the
// repo's unused-symbol checks", and that is precisely what it did: eight dead
// functions, each individually reportable, bundled behind one exported name so
// the guard counted one symbol instead of eight — and that one symbol was then
// allowlisted, so the guard counted none. A wrapper whose stated purpose is to
// pass a check is not an asset, it is a laundering step, and the check it beat
// exists because ~920 lines of finished animal builders once hid the same way.
//
// The allowlist entry parking it claimed the builders served "portals in the
// inactive state, which no portal currently enters". There is no inactive state.
// Before this deletion the string "inactive" appeared exactly once in
// minigames/framework/, in this constant's own name. The unregistered-game path
// is real, one line long, and does not consult this map: buildGamePortal reads
// `ICON_BUILDERS[gameId] ?? buildFallbackSparkIcon`, so a game with no entry
// gets the fallback spark. Registering a new game means adding to ICON_BUILDERS
// above; nothing reachable could ever have reached a balloon.
//
// Git has the geometry. Recover a builder from history if a game needs it —
// do not re-park authored assets in a live module to keep them warm.

// ════════════════════════════════════════════════════════════════════
// Portal assembly — pedestal + glow ring + game-specific icon
// ════════════════════════════════════════════════════════════════════

/**
 * Builds a glowing, floating game-launch portal and adds it to the scene.
 * Each portal features a game-specific 3D icon (balloon, truck, shark fin, etc.)
 * on a lit pedestal with a pulsing glow ring and gentle float/rotation animations.
 * Returns the root group and an array of tappable meshes for raycaster-based interaction.
 *
 * @param scene - The Three.js scene to add the portal to.
 * @param config - Portal configuration with game ID, position, and theme color.
 * @param nav - Navigation actions providing launchMiniGame.
 * @returns The portal result containing root group and tappable meshes.
 */
export function buildGamePortal(scene: Scene, config: GamePortalConfig, nav: NavigationActions): GamePortalResult {
  const { gameId, position, color } = config;
  const root = new Group();
  root.name = `portal_${gameId}_root`;
  root.position.copy(position);

  const tappableMeshes: Object3D[] = [];

  // ── Pedestal ──
  const pedestal = createCylinder(`portal_${gameId}_pedestal`, 1.4, 1.4, 0.12, 24);
  pedestal.position.y = 0.06;
  const pedestalMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.4),
    emissive: color.clone().multiplyScalar(0.15),
    roughness: 0.7,
    metalness: 0.05,
  });
  pedestalMat.name = `portal_${gameId}_pedestalMat`;
  pedestal.material = pedestalMat;
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  root.add(pedestal);
  tappableMeshes.push(pedestal);

  // ── Game-specific icon ──
  const builder = ICON_BUILDERS[gameId as BuiltInMiniGameId] ?? buildFallbackSparkIcon;
  const icon = builder(`portal_${gameId}`);
  icon.position.y = 0.75;
  root.add(icon);

  // Collect all mesh children of the icon for tapping and shadows
  icon.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      tappableMeshes.push(child);
    }
  });
  pedestal.castShadow = true;

  // ── Float animation (gentle bob) via GSAP ──
  gsap.to(icon.position, {
    y: 0.95,
    duration: 3, // 90 frames at 30fps = 3s
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  // ── Slow rotation on icon via GSAP ──
  gsap.to(icon.rotation, {
    y: '+=6.283185307',
    duration: 8, // 240 frames at 30fps = 8s
    repeat: -1,
    ease: 'none',
  });

  // ── Pick trigger callback (caller wires via raycaster) ──
  //
  // NOT HERE, DELIBERATELY: `setupMiniGameTrigger`, which used to live in
  // `framework/useMiniGameLauncher.ts` and offered to make any mesh launch any
  // game. Nothing imported it. It was not a duplicate of this — it was a
  // SECOND, DIFFERENT mechanism for the same job, which is the more dangerous
  // shape: it registered through `WorldTapDispatcher.register` rather than the
  // `userData.onTap` convention the tap arbitration actually reads, and it
  // played only `sfx_shared_tap_fallback`. A reader who reached for the
  // obviously-named helper would have got a portal that registers down a
  // different path and is silently missing `sfx_hub_toybox_open` — a bug that
  // presents as "the sound is wrong sometimes", not as a crash.
  //
  // Launching a game is this function and the userData convention below it.
  //
  // ROUND 4, 2026-07-30 — WHAT THIS USED TO BE, AND WHY IT IS NOT THAT ANY MORE.
  //
  //     const launchGame = () => {
  //       triggerSound('sfx_shared_tap_fallback');
  //       triggerSound('sfx_hub_toybox_open');
  //       nav.launchMiniGame(gameId);
  //     };
  //
  // Three synchronous statements, and `.probe/render/r4-portal.mjs` measured what
  // they were worth. On the cove's portal, `__reactionScan(1.5, 0.15)` reported
  // `propHigh = 0` against a displaced `sparkleHigh` of 132 — not a small reaction,
  // NO reaction, in the same run where the chest scored 10.53x, the cannon 6.24x and
  // the wheel 6.61x, so the instrument was demonstrably able to see a reaction that
  // day. Nature's four portals returned the same zero. On a muted device the highest-
  // stakes tap in this application changed nothing on screen whatsoever.
  //
  // The audible half was worse than silent. `__tapThroughCanvas` on the portal
  // returned exactly `[sfx_shared_tap_fallback, sfx_hub_toybox_open]` and no
  // particles: the FIRST thing a child heard on the door into a game was the cue
  // for a tap that found nothing, and playing it suppressed the controller's own
  // acknowledgement sparkle (`sceneHelpers.ts:245-253` — a handler that makes sound
  // ticks the counter `fire` uses to decide whether the prop answered for itself).
  // `interactionController.ts:343-351` defends that cue on two limbs: that it is the
  // generic acknowledgement rather than the miss's private property, and that "the
  // two events are the same event as the child experiences it: in both cases there
  // was nothing more here". The first limb stands. The second is false at a portal
  // by construction — there is a whole game here — which is what makes this the one
  // site where the shared chirp cannot be the answer.
  //
  // The second cue was borrowed. `hub/hubSfx.ts:39-54` builds `sfx_hub_toybox_open`
  // out of a 300Hz filtered noise burst and a 150Hz thump — its own docblock calls it
  // a "creaky wooden thunk" — and its only other callers are a wooden toybox lid
  // (`wireToyboxInteractions.ts:136`) and a wooden door (`interactiveDoorway.ts:181`).
  // This is a glowing pedestal with a floating icon and no hinge, and the thunk fired
  // at the instant of the tap with nothing opening.
  //
  // THE APP'S OWN CONTROL SHOWED THE SHAPE. `wireToyboxInteractions.ts:104-144` plays
  // a tap voice immediately, runs a visible opening, and only in the innermost
  // `onComplete` plays the open cue and navigates — the open cue is EARNED by an
  // opening the child watched. That is what is below, in a portal's own vocabulary
  // rather than a toybox's: a bright chime the moment the finger lands, a flare and
  // a swell the child can see with the sound off, and the sparkle cascade at the top
  // of the swell where the launch actually happens.
  //
  // The latch is not incidental. Without it a double-tap fired the pair of cues twice
  // and called `launchMiniGame` twice; now the second tap during a launch is dropped.
  let launching = false;
  const launchGame = () => {
    if (launching) return;
    launching = true;

    // The portal's own voice, on the frame the finger lands. `sfx_shared_star_chime`
    // is not a fresh invention: it is what a lamp plays when it lights up
    // (`floorLamp.ts:61`, `deskLamp.ts:97`) and what Star Catcher twinkles with, so a
    // glowing pedestal brightening under a hand is already speaking it.
    triggerSound('sfx_shared_star_chime');

    // THE HALF THAT SURVIVES A MUTED DEVICE, which is the half soul.md's Sound World
    // clause makes load-bearing. Scale is taken on `root`, and emissive on the
    // pedestal, deliberately: the idle bob and spin own `icon.position` and
    // `icon.rotation`, and animating those would fight tweens that are `repeat: -1`.
    const flareFrom = pedestalMat.emissiveIntensity;
    gsap.killTweensOf(root.scale);
    gsap.killTweensOf(pedestalMat);
    gsap.to(pedestalMat, { emissiveIntensity: flareFrom + 1.6, duration: 0.14, ease: 'power2.out' });
    gsap.to(root.scale, {
      x: 1.22,
      y: 1.22,
      z: 1.22,
      duration: 0.14,
      ease: 'back.out(2.6)',
      onComplete: () => {
        gsap.to(root.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => {
            // Earned, like the toybox's: the cascade lands at the top of the swell,
            // on the same tick as the navigation it is announcing.
            triggerSound('sfx_shared_sparkle_burst');
            nav.launchMiniGame(gameId);
            // The scene is torn down behind us, but a portal that is re-entered
            // without a rebuild must not be left latched shut.
            pedestalMat.emissiveIntensity = flareFrom;
            root.scale.set(1, 1, 1);
            launching = false;
          },
        });
      },
    });
  };

  // Store the launch handler on each tappable mesh via userData
  for (const mesh of tappableMeshes) {
    mesh.userData.onTap = launchGame;
  }

  scene.add(root);

  // The float and rotation tweens above are repeat: -1 — without an explicit
  // kill they outlive the scene and animate detached objects forever.
  const dispose = () => {
    gsap.killTweensOf(icon.position);
    gsap.killTweensOf(icon.rotation);
    // Round 4's launch flourish is finite, but a tap taken in the frame before a
    // teardown leaves a live tween on a detached root and a detached material.
    gsap.killTweensOf(root.scale);
    gsap.killTweensOf(pedestalMat);
  };

  return { root, tappableMeshes, dispose };
}

/**
 * Builds multiple game portals for a world scene.
 *
 * @param scene - The Three.js scene.
 * @param configs - Array of portal configurations.
 * @param nav - Navigation actions.
 * @returns Array of portal results for disposal and interaction tracking.
 */
export function buildGamePortals(scene: Scene, configs: GamePortalConfig[], nav: NavigationActions): GamePortalResult[] {
  return configs.map((config) => buildGamePortal(scene, config, nav));
}

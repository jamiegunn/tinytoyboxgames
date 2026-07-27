/**
 * Ambient motion for Pirate Cove — the things that move before anybody taps.
 *
 * WHY THIS FILE EXISTS. A census of every animation call in the scene found
 * exactly one: a `gsap.timeline` inside `parrot/interaction.ts`, i.e. inside a
 * tap handler. `getIdleAnimator` was called zero times. There was no per-frame
 * update hook of any kind — no `onBeforeRender`, no clock subscription, nothing.
 * Until a child touched something, Pirate Cove was a photograph: a ship at sea
 * where the sea did not move, under clouds that did not drift, with a sail that
 * did not know there was any wind.
 *
 * That contradicts both normative documents. vision.md requires that "at least 2
 * interactions should animate or react even before the player taps, to invite
 * exploration". soul.md §5 says "The toybox world is never static — but it is
 * never frantic."
 *
 * WHY THE DECK DOES NOT MOVE, WHICH IS THE WHOLE DESIGN. The obvious fix — rock
 * the ship — is wrong twice over. It slides every tap target sideways while a
 * three-year-old is aiming at it, which is the one thing a no-fail-state toy
 * must never do; and it is not what a person on a boat sees. From the deck, the
 * deck is the still thing. The horizon is what tilts. So the hull stays rigid
 * and the SEA AND SKY roll and heave around it: the waterline tips, the clouds
 * ride with it, and the ship reads as under way without a single tappable prop
 * moving a pixel.
 *
 * WHY THE NUMBERS ARE ALL COPRIME-ISH. Roll is 7.3 s and heave is 4.9 s. Two
 * oscillators whose periods share no small common multiple do not visibly repeat
 * for minutes, so the swell never settles into a loop a child can memorise. The
 * cloud drifts (34/41/29 s) and the sail luff (4.3 s) are chosen the same way.
 * The amplitudes are deliberately tiny — a 0.02 rad roll tips the horizon by
 * 1.15°, about 26 px across a 1280 px frame — because soul.md's line is "alive,
 * not demanding", and because a rocking horizon at a larger amplitude is how you
 * make a small child feel sick.
 */

import type { Group, Object3D, Scene } from 'three';
import { getIdleAnimator } from '@app/utils/idle/registry';
import type { CelestialBody } from '@app/utils/skyRig';

/** Handles for the things Pirate Cove's ambient rig animates. */
export interface AmbientMotionTargets {
  /** The group holding the ocean, skydome, sun and clouds. Rolled and heaved. */
  seaAndSky: Group;
  /** Cloud puff groups, drifted individually on top of the group motion. */
  clouds: Group[];
  /** The sun, whose glow is pulsed. */
  sun: CelestialBody;
  /** The ship's shell root, searched for the sail group. */
  shellRoot: Object3D;
}

/** One ambient source: what moves, and the handle that stops it. */
export interface AmbientSource {
  /** Stable identifier, used by the contract test to assert coverage. */
  id: string;
  /** Stops this source's tween. */
  stop(): void;
}

// Every ambient source in the scene, so a test can assert the count rather than
// trusting a reviewer's eyes. Order is roughest-to-finest.
const SOURCE_IDS = [
  'sea-roll',
  'sea-heave',
  'cloud-drift-0',
  'cloud-drift-1',
  'cloud-drift-2',
  'sun-glow',
  'sail-luff-depth',
  'sail-luff-swing',
  'parrot-bob',
  'parrot-look',
] as const;

/** The identifiers this rig is expected to produce when every target is present. */
export const AMBIENT_SOURCE_IDS: ReadonlyArray<string> = SOURCE_IDS;

/**
 * Starts every ambient idle in Pirate Cove.
 *
 * Every tween is created through the scene's {@link getIdleAnimator}, so the
 * scene's disposal scope kills all of them on teardown and none of them can
 * outlive a scene switch. See architecture-standards.md#idleanimator.
 *
 * Call this AFTER the prop composers have run — the parrot is staged by a
 * composer, and this function finds it by name.
 *
 * @param scene - The scene, used to resolve the idle animator and find props.
 * @param targets - The sky group, clouds, sun and ship shell to animate.
 * @returns The started sources, newest last. Stopping them is optional; scene
 *   disposal already does it.
 */
export function startAmbientMotion(scene: Scene, targets: AmbientMotionTargets): AmbientSource[] {
  const idle = getIdleAnimator(scene);
  const sources: AmbientSource[] = [];

  // Records a started idle under a known id. Sources whose target is missing are
  // simply absent from the returned list, which is what the contract test reads.
  const add = (id: string, handle: { stop(): void } | null) => {
    if (handle) sources.push({ id, stop: () => handle.stop() });
  };

  // ── The swell ────────────────────────────────────────────────────────────
  // Roll: the world tips about the view axis, so the waterline tilts. Straddles
  // rest, because a boat rolls through level rather than leaning off it — this
  // is exactly what `sway` guarantees and `bob` does not.
  add('sea-roll', idle.sway(targets.seaAndSky, { amplitude: 0.02, period: 7.3, axis: 'z' }));
  // Heave: the world rises and falls. One-sided by construction (`bob` runs base
  // → base + amplitude), which is fine here: the mean waterline just sits 7 cm
  // above the authored one and nothing else in the scene references it.
  add('sea-heave', idle.bob(targets.seaAndSky, { amplitude: 0.14, period: 4.9 }));

  // ── The sky ──────────────────────────────────────────────────────────────
  // Clouds drift sideways on top of the group's roll. Long, unequal periods; the
  // amplitudes are a couple of world units at ~30 units out, which is a slow
  // crawl on screen rather than a slide.
  const driftSpecs: Array<[number, number]> = [
    [2.2, 34],
    [2.8, 41],
    [1.9, 29],
  ];
  targets.clouds.forEach((cloud, i) => {
    const spec = driftSpecs[i % driftSpecs.length];
    add(`cloud-drift-${i}`, idle.bob(cloud, { amplitude: spec[0], period: spec[1], axis: 'x' }));
  });

  // The sun's glow breathes. `flicker` adds its amplitude to the material's base
  // `emissiveIntensity`, so the amplitude is only meaningful as a FRACTION of
  // that base — and the base just changed. 0.35 was authored against 1.2, a 29%
  // swing that reads as haze moving across a bright core. The sun's emissive is
  // now 0.55 (1.2 clipped its modal pixel to pure white, which is a hole in the
  // sky, not a sun), against which 0.35 would swing 64% and read as a light being
  // switched on and off. 0.16 holds the authored 29%.
  add('sun-glow', idle.flicker(targets.sun.coreMaterial, { amplitude: 0.16, period: 11.7 }));

  // ── The rig ──────────────────────────────────────────────────────────────
  // The sail luffs two ways at once: the belly deepens and slackens (scale on the
  // local z, which is the axis the billow was displaced along), and the whole
  // sheet swings a little about its head. Two periods, so the canvas never looks
  // like it is on a metronome.
  const sailGroup = targets.shellRoot.getObjectByName('ship_sailGroup');
  if (sailGroup) {
    add('sail-luff-depth', idle.breathe(sailGroup, { amplitude: 0.28, period: 4.3, axes: ['z'] }));
    add('sail-luff-swing', idle.sway(sailGroup, { amplitude: 0.035, period: 6.7, axis: 'x' }));
  }

  // ── The crew ─────────────────────────────────────────────────────────────
  // The parrot bobs on its perch and turns its head to look around. Its head
  // ROTATION is used on purpose: the tap handler animates the head's POSITION and
  // kills tweens of that channel when it finishes, so an idle on rotation cannot
  // be cancelled by a tap, and a tap cannot be fought by the idle.
  const parrot = findByName(scene, 'parrot_prop');
  if (parrot) {
    add('parrot-bob', idle.bob(parrot, { amplitude: 0.045, period: 3.1 }));
    const head = parrot.getObjectByName('parrot_head');
    if (head) add('parrot-look', idle.sway(head, { amplitude: 0.14, period: 5.3, axis: 'y' }));
  }

  return sources;
}

// Finds the first descendant with an exact name. `Object3D.getObjectByName`
// already does this; the wrapper exists so the null case is spelled out at the
// single place that cares.
function findByName(root: Object3D, name: string): Object3D | null {
  return root.getObjectByName(name) ?? null;
}

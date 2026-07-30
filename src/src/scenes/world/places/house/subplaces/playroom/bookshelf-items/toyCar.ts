import { BoxGeometry, Color, CylinderGeometry, MeshBasicMaterial, Mesh, SphereGeometry, Vector3, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import gsap from 'gsap';
import { getIdleAnimator } from '@app/utils/idle/registry';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';

/**
 * Creates a toy car on the bottom shelf of the bookshelf. Clicks to drive around the back of the room.
 * @param scene - The Three.js scene to add the car to
 */
export function createToyCar(scene: Scene): void {
  const carBodyMat = createGlossyPaintMaterial('hub_carBodyMat', new Color(0.85, 0.15, 0.2));
  const carBody = new Mesh(new BoxGeometry(0.22, 0.08, 0.1), carBodyMat);
  carBody.name = 'shelfCar';
  carBody.position.set(2.5 + 0.6, 0.16, 8.22);
  carBody.scale.setScalar(3);
  scene.add(carBody);

  const carCabin = new Mesh(new BoxGeometry(0.12, 0.06, 0.08), createPlasticMaterial('hub_carCabinMat', new Color(0.6, 0.8, 1.0)));
  carCabin.name = 'shelfCarCabin';
  carCabin.position.set(-0.01, 0.07, 0);
  carBody.add(carCabin);

  const wheelMat = createPlasticMaterial('hub_carWheelMat', new Color(0.15, 0.15, 0.15));
  [
    [-0.07, -0.035, 0.055],
    [-0.07, -0.035, -0.055],
    [0.07, -0.035, 0.055],
    [0.07, -0.035, -0.055],
  ].forEach(([wx, wy, wz], i) => {
    const wheel = new Mesh(new CylinderGeometry(0.02, 0.02, 0.02, 8), wheelMat);
    wheel.name = `shelfCarWheel${i}`;
    wheel.position.set(wx, wy, wz);
    wheel.rotation.x = Math.PI / 2;
    carBody.add(wheel);
  });

  // Exhaust pipe
  const pipeMat = createPlasticMaterial('hub_shelfCarPipeMat', new Color(0.4, 0.4, 0.42));
  const pipe = new Mesh(new CylinderGeometry(0.006, 0.008, 0.02, 6), pipeMat);
  pipe.name = 'shelfCarExhaustPipe';
  pipe.position.set(-0.11, -0.03, 0.03);
  pipe.rotation.z = Math.PI / 2;
  carBody.add(pipe);

  // Exhaust puff pool
  const smokeMat = createPlasticMaterial('hub_shelfCarSmokeMat', new Color(0.85, 0.85, 0.88));
  smokeMat.transparent = true;
  smokeMat.opacity = 0.5;
  const PUFF_COUNT = 5;
  const puffs: Mesh[] = [];
  for (let i = 0; i < PUFF_COUNT; i++) {
    const puff = new Mesh(new SphereGeometry(0.025, 6, 6), smokeMat.clone());
    puff.name = `shelfCarPuff${i}`;
    puff.visible = false;
    scene.add(puff);
    puffs.push(puff);
  }

  let puffIndex = 0;
  let exhaustRunning = false;
  const pipeWorldPos = new Vector3();
  const emitPuff = () => {
    if (!exhaustRunning) return;
    const puff = puffs[puffIndex % PUFF_COUNT];
    puffIndex++;
    pipe.getWorldPosition(pipeWorldPos);
    puff.position.copy(pipeWorldPos);
    puff.scale.setScalar(0.8);
    puff.visible = true;
    const mat = puff.material as typeof smokeMat;
    mat.opacity = 0.5;
    gsap.to(puff.position, { y: pipeWorldPos.y + 0.5, duration: 1.0, ease: 'power1.out' });
    gsap.to(puff.scale, { x: 2.5, y: 2.5, z: 2.5, duration: 1.0, ease: 'power1.out' });
    gsap.to(mat, {
      opacity: 0,
      duration: 1.0,
      ease: 'power1.in',
      onComplete: () => {
        puff.visible = false;
      },
    });
  };

  // Registered so the looping timers/loops are killed on scene teardown (this
  // builder returns void). See architecture-standards.md#idleanimator.
  const idle = getIdleAnimator(scene);
  const exhaustTimer = idle.register(gsap.to({}, { duration: 0.5, repeat: -1, paused: true, onRepeat: emitPuff, onStart: emitPuff }));

  // Invisible hitbox — the car is small, so a larger clickable area helps
  const hitbox = new Mesh(new BoxGeometry(0.3, 0.15, 0.15), new MeshBasicMaterial({ visible: false }));
  hitbox.name = 'shelfCarHitbox';
  carBody.add(hitbox);

  // ── Click interaction — drive to floor and cruise back and forth ──
  let driving = false;
  const baseScale = carBody.scale.x;

  /**
   * The answer a tap gets once the car is already driving.
   *
   * The car cruises on a `repeat: -1` timeline, so "wait for the drive to finish and
   * unlatch" is not available — there is no finish. The tap therefore gets its own
   * answer instead of the drive's: a squash-and-stretch on a channel the drive never
   * touches. `carBody.scale` is written once at build (`setScalar(3)`) and by nothing
   * else, so this cannot fight the position and rotation tweens that are in flight.
   *
   * `killTweensOf` then reset makes a rapid second tap restart the bounce from the
   * base rather than compound onto a half-played one, and the handle is owned by the
   * scene's idle animator for the reason written at the foot of this file: an unowned
   * handle followed a child out of the room once already.
   */
  const bounce = () => {
    gsap.killTweensOf(carBody.scale);
    carBody.scale.setScalar(baseScale);
    idle.register(
      gsap.to(carBody.scale, {
        x: baseScale * 1.15,
        y: baseScale * 1.15,
        z: baseScale * 1.15,
        duration: 0.12,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
      }),
    );
  };

  const driveHandler = () => {
    // EVERY TAP IS ANSWERED. ONLY THE FIRST ONE STARTS THE DRIVE.
    //
    // This used to open `if (driving) return;`, and that early return was a dead tap
    // dressed as a guard. `driving` is set once and NEVER CLEARED — the two
    // assignments in this file are the declaration and the `= true` — so from the
    // first drive to the end of the visit every further tap on this car fell out of
    // the handler before making a sound. `interactionController.fire` then counted
    // zero sounds requested and played `sfx_shared_tap_fallback` — and nothing else.
    //
    // The cue is NOT the miss's private property; `uiSounds.ts` calls it "a gentle
    // acknowledgement chirp for tap-fallback feedback", the generic acknowledgement,
    // which the miss merely also uses. Round 2 first wrote the charge up as "answered
    // with the miss's own cue" and that half is refuted. What survives is a
    // comparison, and it is worse: since Round 1 gave a missed room tap a sparkle, a
    // tap that FOUND the car got the cue and no picture where a tap that found
    // nothing got the cue AND a picture. On a muted device that is nothing at all.
    // Strictly less for finding something than for finding nothing.
    //
    // `interactionController.fire` now closes that floor for every prop at once, so
    // this car can no longer fall below empty space however the guard is edited. The
    // floor is not the point, though — it is what stops a dead tap being a lie. A
    // prop that has more to give should still give it, which is what `bounce()` below
    // is for.
    //
    // AND IT IS THE DEFAULT, NOT AN EDGE CASE. The `gsap.delayedCall` at the foot of
    // this file drives the car for the child, so a child who spends the opening
    // seconds looking around the room — the normal way to enter a room — arrives at
    // a car that can no longer be tapped, having never tapped it. Measured in
    // `.probe/render/r2-latch.mjs`: a fresh tap emits
    // `sceneSparkle`, and a tap after the autoplay emits nothing at all.
    const alreadyDriving = driving;

    // This was `sfx_shared_tap_fallback` — the shared acknowledgement, which the miss
    // path also plays — and this handler emitted no burst either. Since Round 1 gave
    // a missed room tap a sparkle, FINDING the car was answered less than touching the
    // wall behind it. `sfx_shared_whoosh` is this codebase's own motion cue and the
    // burst matches every other room prop. See docs/reviews/2026-07-30-rooms-five-rounds.md.
    // A tap on a car that is already going gets `sfx_shared_pop` instead: the whoosh
    // means "off you go", and replaying it for a car that is already gone would
    // promise a departure that does not happen.
    triggerSound(alreadyDriving ? 'sfx_shared_pop' : 'sfx_shared_whoosh');
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, carBody.getWorldPosition(new Vector3()).add(new Vector3(0, 0.12, 0)));

    if (alreadyDriving) {
      bounce();
      return;
    }
    driving = true;

    // Start exhaust
    exhaustRunning = true;
    exhaustTimer.play();

    const floorY = 0.12;
    const backZ = 7.5;
    const leftX = -4.5;
    const rightX = 4.5;

    const tl = gsap.timeline();

    // Drop down to floor level
    tl.to(carBody.position, { y: floorY, duration: 0.5, ease: 'power2.in' });

    // Turn to face -Z (toward back wall) — car length is along X, so rotate 90°
    tl.to(carBody.rotation, { y: -Math.PI / 2, duration: 0.3, ease: 'power2.out' });

    // Drive to back of room
    tl.to(carBody.position, { z: backZ, duration: 1.5, ease: 'power2.inOut' }, '<0.1');

    // Turn to face -X (left) and start cruising — car length along X means y=Math.PI faces -X
    tl.to(carBody.rotation, { y: Math.PI, duration: 0.3, ease: 'power2.inOut' });

    tl.call(() => {
      const cruiseTl = idle.register(gsap.timeline({ repeat: -1 }));

      // Drive left (-X)
      cruiseTl.to(carBody.position, { x: leftX, duration: 3, ease: 'sine.inOut' });
      // Turn around to face +X
      cruiseTl.to(carBody.rotation, { y: 0, duration: 0.4, ease: 'power2.inOut' });
      // Drive right (+X)
      cruiseTl.to(carBody.position, { x: rightX, duration: 3, ease: 'sine.inOut' });
      // Turn around to face -X
      cruiseTl.to(carBody.rotation, { y: Math.PI, duration: 0.4, ease: 'power2.inOut' });
    });
  };

  // Assign click handler to all car parts
  [carBody, carCabin, hitbox].forEach((mesh) => {
    mesh.userData.onClick = driveHandler;
  });

  // Auto-activate after 15 seconds if not clicked. Owned by the scene's idle
  // animator for the same reason as the floor car — an unowned handle let this
  // car's tap-confirmation sound play in the next scene, from a shelf the child
  // had already walked away from. See `floorToys/toyCar.ts` for the measurement.
  idle.register(
    gsap.delayedCall(15, () => {
      if (!driving) driveHandler();
    }),
  );
}

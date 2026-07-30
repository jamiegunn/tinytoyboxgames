import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import gsap from 'gsap';
import { getIdleAnimator } from '@app/utils/idle/registry';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';

/** Track radius — matches the train track. */
const TRACK_RADIUS = 3.95;
const TRACK_Y = 0.01;

/**
 * Creates a red toy car on the floor. When clicked, it hops onto the train tracks and chases the train.
 * @param scene - The Three.js scene to add the toy car to
 * @param _keyLight - The directional light (unused)
 */
export function createToyCar(scene: Scene, _keyLight: DirectionalLight): void {
  const root = new Group();
  root.name = 'toyCar_root';
  root.position.set(4.0, TRACK_Y + 0.04, -3.5);
  root.rotation.y = 0.6;
  scene.add(root);

  const carMat = createGlossyPaintMaterial('hub_carMat', new Color(0.88, 0.18, 0.15));
  const trimMat = createGlossyPaintMaterial('hub_carTrimMat', new Color(0.78, 0.12, 0.1));
  const windowMat = createPlasticMaterial('hub_carWindowMat', new Color(0.7, 0.85, 1.0));
  const wheelMat = createPlasticMaterial('hub_carWheelMat', new Color(0.15, 0.15, 0.18));
  const hubMat = createPlasticMaterial('hub_carHubMat', new Color(0.8, 0.78, 0.7));
  const bumperMat = createPlasticMaterial('hub_carBumperMat', new Color(0.7, 0.68, 0.6));
  const headlightMat = createPlasticMaterial('hub_carHeadlightMat', new Color(1.0, 0.95, 0.7));

  // Main body — boxy sedan shape
  const body = new Mesh(new BoxGeometry(0.38, 0.1, 0.18), carMat);
  body.name = 'toyCarBody';
  body.position.y = 0.08;
  body.castShadow = true;
  root.add(body);

  // Cabin / roof section
  const cabin = new Mesh(new BoxGeometry(0.2, 0.09, 0.16), carMat);
  cabin.name = 'toyCarCabin';
  cabin.position.set(-0.02, 0.09, 0);
  body.add(cabin);

  // Windows — front and back
  const frontWin = new Mesh(new BoxGeometry(0.005, 0.06, 0.13), windowMat);
  frontWin.name = 'toyCarFrontWindow';
  frontWin.position.set(0.1, 0.0, 0);
  cabin.add(frontWin);

  const rearWin = new Mesh(new BoxGeometry(0.005, 0.06, 0.13), windowMat);
  rearWin.name = 'toyCarRearWindow';
  rearWin.position.set(-0.1, 0.0, 0);
  cabin.add(rearWin);

  // Side windows
  [-1, 1].forEach((side) => {
    const sideWin = new Mesh(new BoxGeometry(0.14, 0.055, 0.005), windowMat);
    sideWin.name = `toyCarSideWindow${side}`;
    sideWin.position.set(0, 0.0, side * 0.081);
    cabin.add(sideWin);
  });

  // Hood scoop
  const hood = new Mesh(new BoxGeometry(0.06, 0.025, 0.08), trimMat);
  hood.name = 'toyCarHood';
  hood.position.set(0.12, 0.05, 0);
  body.add(hood);

  // Bumpers — front and rear
  const frontBumper = new Mesh(new BoxGeometry(0.02, 0.04, 0.18), bumperMat);
  frontBumper.name = 'toyCarFrontBumper';
  frontBumper.position.set(0.2, -0.02, 0);
  body.add(frontBumper);

  const rearBumper = new Mesh(new BoxGeometry(0.02, 0.04, 0.18), bumperMat);
  rearBumper.name = 'toyCarRearBumper';
  rearBumper.position.set(-0.2, -0.02, 0);
  body.add(rearBumper);

  // Headlights
  headlightMat.emissive = new Color(0.12, 0.1, 0.04);
  [-1, 1].forEach((side) => {
    const hl = new Mesh(new CylinderGeometry(0.015, 0.015, 0.01, 8), headlightMat);
    hl.name = `toyCarHeadlight${side}`;
    hl.position.set(0.19, 0.01, side * 0.06);
    hl.rotation.z = Math.PI / 2;
    body.add(hl);
  });

  // Taillights
  const tailMat = createGlossyPaintMaterial('hub_carTailMat', new Color(0.9, 0.15, 0.1));
  [-1, 1].forEach((side) => {
    const tl = new Mesh(new CylinderGeometry(0.012, 0.012, 0.01, 8), tailMat);
    tl.name = `toyCarTaillight${side}`;
    tl.position.set(-0.19, 0.01, side * 0.06);
    tl.rotation.z = Math.PI / 2;
    body.add(tl);
  });

  // Wheels
  const wheelOffsets: [number, number, number][] = [
    [0.12, -0.04, 0.1],
    [0.12, -0.04, -0.1],
    [-0.12, -0.04, 0.1],
    [-0.12, -0.04, -0.1],
  ];
  wheelOffsets.forEach(([wx, wy, wz], i) => {
    const wheel = new Mesh(new CylinderGeometry(0.035, 0.035, 0.025, 12), wheelMat);
    wheel.name = `toyCarWheel${i}`;
    wheel.position.set(wx, wy, wz);
    wheel.rotation.x = Math.PI / 2;
    body.add(wheel);

    const hub = new Mesh(new CylinderGeometry(0.012, 0.012, 0.005, 8), hubMat);
    hub.name = `toyCarHub${i}`;
    hub.position.set(0, 0.013, 0);
    wheel.add(hub);
  });

  // Exhaust pipe
  const pipeMat = createPlasticMaterial('hub_carPipeMat', new Color(0.4, 0.4, 0.42));
  const pipe = new Mesh(new CylinderGeometry(0.012, 0.014, 0.04, 6), pipeMat);
  pipe.name = 'toyCarExhaustPipe';
  pipe.position.set(-0.2, -0.02, 0.06);
  pipe.rotation.z = Math.PI / 2;
  body.add(pipe);

  // Exhaust puff pool
  const smokeMat = createPlasticMaterial('hub_carSmokeMat', new Color(0.85, 0.85, 0.88));
  smokeMat.transparent = true;
  smokeMat.opacity = 0.5;
  const PUFF_COUNT = 5;
  const puffs: Mesh[] = [];
  for (let i = 0; i < PUFF_COUNT; i++) {
    const puff = new Mesh(new SphereGeometry(0.02, 6, 6), smokeMat.clone());
    puff.name = `toyCarPuff${i}`;
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
    gsap.to(puff.position, { y: pipeWorldPos.y + 0.4, duration: 1.0, ease: 'power1.out' });
    gsap.to(puff.scale, { x: 2, y: 2, z: 2, duration: 1.0, ease: 'power1.out' });
    gsap.to(mat, {
      opacity: 0,
      duration: 1.0,
      ease: 'power1.in',
      onComplete: () => {
        puff.visible = false;
      },
    });
  };

  // Registered so every looping tween is killed on scene teardown (createToyCar
  // returns void, so these would otherwise leak). See architecture-standards.md#idleanimator.
  const idle = getIdleAnimator(scene);
  const exhaustTimer = idle.register(gsap.to({}, { duration: 0.5, repeat: -1, paused: true, onRepeat: emitPuff, onStart: emitPuff }));

  // Invisible hitbox for easy clicking
  const hitbox = new Mesh(new BoxGeometry(0.45, 0.25, 0.25), new MeshBasicMaterial({ visible: false }));
  hitbox.name = 'toyCarHitbox';
  hitbox.position.y = 0.08;
  root.add(hitbox);

  // Rocking idle animation
  const rockTween = idle.register(
    gsap.to(root.rotation, {
      z: 0.02,
      duration: 3.75,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    }),
  );

  // ── Click interaction — hop onto tracks and chase the train ──
  let driving = false;
  const baseScale = root.scale.x;

  // Find the train's orbit pivot so the car can follow at an offset
  const findTrainPivot = (): Group | null => {
    const pivot = scene.getObjectByName('trainOrbitPivot');
    return pivot instanceof Group ? pivot : null;
  };

  /**
   * The answer a tap gets once the car is already chasing the train.
   *
   * The chase orbits on a `repeat: -1` tween, so there is no completion to unlatch
   * on. The tap gets its own answer on a channel the chase never writes: `root.scale`
   * is untouched after build, while the chase owns position and rotation. Owned by
   * the scene's idle animator for the reason recorded at the foot of this file — an
   * unowned handle from this very builder followed a child into the next scene.
   */
  const bounce = () => {
    gsap.killTweensOf(root.scale);
    root.scale.setScalar(baseScale);
    idle.register(
      gsap.to(root.scale, {
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
    // EVERY TAP IS ANSWERED. ONLY THE FIRST ONE STARTS THE CHASE.
    //
    // This used to open `if (driving) return;`, and that early return was a dead tap
    // dressed as a guard. `driving` is set once and NEVER CLEARED — the two
    // assignments in this file are the declaration and the `= true` — so from the
    // first chase to the end of the visit every further tap on this car fell out of
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
    // floor beside it. `sfx_shared_whoosh` is this codebase's own motion cue and the
    // burst matches every other room prop. See docs/reviews/2026-07-30-rooms-five-rounds.md.
    // A tap on a car that is already going gets `sfx_shared_pop` instead: the whoosh
    // means "off you go", and replaying it for a car that is already gone would
    // promise a departure that does not happen.
    triggerSound(alreadyDriving ? 'sfx_shared_pop' : 'sfx_shared_whoosh');
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, root.getWorldPosition(new Vector3()).add(new Vector3(0, 0.18, 0)));

    if (alreadyDriving) {
      bounce();
      return;
    }

    // THE PIVOT IS LOOKED UP BEFORE THE LATCH IS SET, NOT AFTER.
    //
    // This lookup used to sit thirty lines further down, past `driving = true` and
    // past the exhaust starting, and `if (!trainPivot) return;` then left the car
    // latched forever having never moved — puffing exhaust, refusing every later tap,
    // for a train that was not in the scene. A guard that cannot succeed must not
    // spend the state that says it did. Failing here instead leaves `driving` false
    // and the tap still answered by the sound and burst above.
    const trainPivot = findTrainPivot();
    if (!trainPivot) {
      bounce();
      return;
    }
    driving = true;

    // Stop idle rocking, start exhaust
    rockTween.pause();
    root.rotation.z = 0;
    exhaustRunning = true;
    exhaustTimer.play();

    // The train sits at angle 0 on the orbit pivot. We'll place the car ~120° behind.
    // Create an orbit pivot for the car, offset behind the train
    const carOrbitPivot = new Group();
    carOrbitPivot.name = 'carOrbitPivot';
    scene.add(carOrbitPivot);

    // Get the train's current rotation so we start offset from it
    const trainAngle = trainPivot.rotation.y;
    const offsetAngle = (2 * Math.PI) / 3; // 120° behind
    carOrbitPivot.rotation.y = trainAngle + offsetAngle;

    // Animate car from current position to track position
    const targetX = TRACK_RADIUS;
    const targetY = TRACK_Y + 0.04;

    // First, reparent car into the orbit pivot at the track position
    const tl = gsap.timeline();

    // Drive to the nearest track point
    const entryAngle = carOrbitPivot.rotation.y;
    const trackX = Math.cos(-entryAngle) * TRACK_RADIUS;
    const trackZ = Math.sin(-entryAngle) * TRACK_RADIUS;

    tl.to(root.position, {
      x: trackX,
      y: targetY,
      z: trackZ,
      duration: 1.0,
      ease: 'power2.inOut',
    });

    // Face tangent direction
    tl.to(
      root.rotation,
      {
        y: -entryAngle - Math.PI / 2,
        duration: 0.3,
        ease: 'power2.out',
      },
      '<',
    );

    tl.call(() => {
      // Reparent car under the orbit pivot
      scene.remove(root);
      root.position.set(targetX, targetY, 0);
      root.rotation.set(0, -Math.PI / 2, 0);
      carOrbitPivot.add(root);

      // Chase the train — orbit at slightly faster speed (28s vs train's 30s)
      idle.register(
        gsap.to(carOrbitPivot.rotation, {
          y: carOrbitPivot.rotation.y - Math.PI * 2,
          duration: 28,
          repeat: -1,
          ease: 'none',
        }),
      );
    });
  };

  // Assign click handler to body, cabin, and hitbox
  [body, cabin, hitbox].forEach((mesh) => {
    mesh.userData.onClick = driveHandler;
  });

  // Auto-activate after 15 seconds if not clicked.
  //
  // OWNED, BECAUSE AN UNOWNED ONE FOLLOWED THE CHILD OUT OF THE ROOM. A child
  // who leaves the playroom inside 15 seconds used to hear this car's
  // `sfx_shared_tap_fallback` — the sound that means "you tapped something" —
  // in whatever scene they had walked into, with nothing tapped and nothing on
  // screen to have made it. Measured in `.probe/render/r7-orphan-timers.mjs`.
  //
  // The orbit tween inside `driveHandler` was already safe: it goes through the
  // scene's idle animator, and registering on a disposed scope kills immediately
  // (`utils/disposal.ts`). So the animation self-cancelled and only the SOUND
  // escaped, which is exactly why this was invisible to anyone reading the file.
  getIdleAnimator(scene).register(
    gsap.delayedCall(15, () => {
      if (!driving) driveHandler();
    }),
  );
}

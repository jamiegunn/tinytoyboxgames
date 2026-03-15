import gsap from 'gsap';
import { MathUtils, Vector3, type Scene } from 'three';
import { spawnAlertBurst, spawnLandingBurst, startFlightTrail } from './effects';
import { BLINK_CLOSE_MS, FACING_CAMERA_Y, FLY_ARC_HEIGHT, FLY_SPEED_FPS, WING_FLAP_RATE, WING_REST_ANGLE } from './palette';
import type { OwlActions, OwlBuildParts, OwlCleanup, OwlCompanionOptions, OwlFlightBounds, OwlIdleHandle, OwlRuntimeDisposer } from './types';

function clampFlightTarget(target: Vector3, perchHeight: number, flightBounds?: OwlFlightBounds): Vector3 {
  const clamped = target.clone();
  clamped.y = perchHeight;

  if (!flightBounds) {
    return clamped;
  }

  clamped.x = MathUtils.clamp(clamped.x, flightBounds.minX, flightBounds.maxX);
  clamped.z = MathUtils.clamp(clamped.z, flightBounds.minZ, flightBounds.maxZ);
  clamped.y = MathUtils.clamp(clamped.y, flightBounds.minY, flightBounds.maxY);
  return clamped;
}

/**
 * Builds the high-priority owl actions that temporarily override the idle
 * runtime without owning the owl's geometry construction.
 *
 * @param scene - The scene that receives owl particle effects.
 * @param startPosition - Original perch position used to preserve perch height.
 * @param parts - Built owl parts used by the action choreography.
 * @param idle - Idle runtime controls for pose and breathing ownership.
 * @param runtime - Runtime cleanup registry for action timers and effects.
 * @param options - Optional scene-owned perch orientation and flight bounds.
 * @returns The public action surface exposed by the owl companion.
 */
export function createOwlActions(
  scene: Scene,
  startPosition: Vector3,
  parts: OwlBuildParts,
  idle: OwlIdleHandle,
  runtime: OwlRuntimeDisposer,
  options: OwlCompanionOptions = {},
): OwlActions {
  let activeTapCleanup: OwlCleanup | null = null;
  let activeFlightCleanup: OwlCleanup | null = null;
  const restFacingY = options.restFacingY ?? FACING_CAMERA_Y;
  const flightBounds = options.flightBounds;

  const setLegsVisible = (visible: boolean): void => {
    parts.legL.traverse((child) => {
      child.visible = visible;
    });
    parts.legR.traverse((child) => {
      child.visible = visible;
    });
  };

  const clearTapReaction = (): void => {
    activeTapCleanup?.();
    activeTapCleanup = null;
  };

  const clearFlight = (): void => {
    activeFlightCleanup?.();
    activeFlightCleanup = null;
  };

  const tapReaction = (): void => {
    if (runtime.isDisposed() || activeFlightCleanup) return;

    clearTapReaction();

    const releasePose = idle.acquirePoseControl();
    const baseY = parts.root.position.y;
    const liftDuration = 26 / FLY_SPEED_FPS;
    const tiltDuration = 24 / FLY_SPEED_FPS;
    const tiltDirection = Math.random() > 0.5 ? 1 : -1;

    gsap.killTweensOf(parts.root.position);
    gsap.killTweensOf(parts.root.rotation);
    gsap.killTweensOf(parts.head.rotation);

    let finished = false;
    let cleanup: OwlCleanup = () => {};

    const finish = (): void => {
      if (finished) return;
      finished = true;
      releasePose();
      runtime.removeCleanup(cleanup);
      if (activeTapCleanup === cleanup) {
        activeTapCleanup = null;
      }
    };

    const tapTimeline = gsap.timeline({ onComplete: finish });
    tapTimeline.add(
      gsap
        .timeline()
        .to(parts.root.position, {
          y: baseY + 0.04,
          duration: liftDuration * (6 / 26),
          ease: 'power2.out',
        })
        .to(parts.root.position, {
          y: baseY + 0.02,
          duration: liftDuration * (8 / 26),
          ease: 'power2.inOut',
        })
        .to(parts.root.position, {
          y: baseY,
          duration: liftDuration * (12 / 26),
          ease: 'power2.inOut',
        }),
      0,
    );
    tapTimeline.add(
      gsap
        .timeline()
        .to(parts.root.rotation, {
          x: -0.08,
          duration: liftDuration * (7 / 26),
          ease: 'power2.out',
        })
        .to(parts.root.rotation, {
          x: -0.05,
          duration: liftDuration * (9 / 26),
          ease: 'power2.inOut',
        })
        .to(parts.root.rotation, {
          x: 0,
          duration: liftDuration * (10 / 26),
          ease: 'power2.inOut',
        }),
      0,
    );
    tapTimeline.add(
      gsap
        .timeline()
        .to(parts.head.rotation, {
          z: tiltDirection * 0.16,
          duration: tiltDuration * (8 / 24),
          ease: 'power2.out',
        })
        .to(parts.head.rotation, {
          z: tiltDirection * 0.12,
          duration: tiltDuration * (8 / 24),
          ease: 'power2.inOut',
        })
        .to(parts.head.rotation, {
          z: 0,
          duration: tiltDuration * (8 / 24),
          ease: 'power2.inOut',
        }),
      0,
    );

    cleanup = () => {
      if (finished) return;
      finished = true;
      tapTimeline.kill();
      releasePose();
      runtime.removeCleanup(cleanup);
      if (activeTapCleanup === cleanup) {
        activeTapCleanup = null;
      }
    };

    activeTapCleanup = cleanup;
    runtime.addCleanup(cleanup);

    idle.doBlink(BLINK_CLOSE_MS * 1.2);

    const burstPosition = parts.root.position.clone();
    burstPosition.y += 1.2;
    spawnAlertBurst(scene, burstPosition, runtime);
  };

  const flyTo = (target: Vector3, onLand?: () => void): void => {
    if (runtime.isDisposed()) return;

    clearTapReaction();
    clearFlight();

    const correctedTarget = clampFlightTarget(target, startPosition.y, flightBounds);
    const start = parts.root.position.clone();
    const distance = start.distanceTo(correctedTarget);
    const flyFrames = Math.max(80, Math.round(distance * 20));
    const flyDuration = flyFrames / FLY_SPEED_FPS;
    const maxArcY = flightBounds?.maxY ?? Math.max(start.y, correctedTarget.y) + FLY_ARC_HEIGHT;
    const midY = Math.min(maxArcY, Math.max(start.y, correctedTarget.y) + FLY_ARC_HEIGHT);

    const liftPos = new Vector3().lerpVectors(start, correctedTarget, 0.25);
    liftPos.y = Math.min(maxArcY, midY * 0.75);

    const apexPos = new Vector3().lerpVectors(start, correctedTarget, 0.5);
    apexPos.y = Math.min(maxArcY, midY);

    const approachPos = new Vector3().lerpVectors(start, correctedTarget, 0.75);
    approachPos.y = Math.min(maxArcY, midY * 0.6);

    const releasePose = idle.acquirePoseControl();
    const releaseBreathing = idle.acquireBreathingPause();

    setLegsVisible(false);
    gsap.killTweensOf(parts.root.position);
    gsap.killTweensOf(parts.root.rotation);
    gsap.killTweensOf(parts.head.rotation);
    gsap.killTweensOf(parts.wingL.rotation);
    gsap.killTweensOf(parts.wingR.rotation);

    const trail = startFlightTrail(scene, () => parts.root.position, flyDuration, runtime);

    let settled = false;
    let landingTimeline: ReturnType<typeof gsap.timeline> | null = null;
    let cleanup: OwlCleanup = () => {};

    const finish = (): void => {
      if (settled) return;
      settled = true;
      releasePose();
      releaseBreathing();
      runtime.removeCleanup(cleanup);
      if (activeFlightCleanup === cleanup) {
        activeFlightCleanup = null;
      }
    };

    const restorePerchPose = (): void => {
      parts.wingL.rotation.z = WING_REST_ANGLE;
      parts.wingR.rotation.z = -WING_REST_ANGLE;
      parts.root.rotation.y = restFacingY;
      parts.root.rotation.x = 0;
      setLegsVisible(true);
    };

    const startLanding = (): void => {
      trail.stop();
      restorePerchPose();
      releaseBreathing();

      const landDuration = 22 / FLY_SPEED_FPS;
      const landY = parts.root.position.y;
      landingTimeline = gsap.timeline({ onComplete: finish });
      landingTimeline.add(
        gsap
          .timeline()
          .to(parts.root.rotation, {
            x: -0.08,
            duration: landDuration * (4 / 22),
            ease: 'power2.out',
          })
          .to(parts.root.rotation, {
            x: 0.02,
            duration: landDuration * (7 / 22),
            ease: 'power2.inOut',
          })
          .to(parts.root.rotation, {
            x: 0,
            duration: landDuration * (11 / 22),
            ease: 'power2.inOut',
          }),
        0,
      );
      landingTimeline.add(
        gsap
          .timeline()
          .to(parts.root.position, {
            y: landY - 0.035,
            duration: landDuration * (4 / 22),
            ease: 'power2.out',
          })
          .to(parts.root.position, {
            y: landY + 0.008,
            duration: landDuration * (8 / 22),
            ease: 'power2.inOut',
          })
          .to(parts.root.position, {
            y: landY,
            duration: landDuration * (10 / 22),
            ease: 'power2.inOut',
          }),
        0,
      );
      landingTimeline.add(
        gsap
          .timeline()
          .to(parts.head.rotation, {
            x: 0.07,
            duration: landDuration * (5 / 22),
            ease: 'power2.out',
          })
          .to(parts.head.rotation, {
            x: -0.015,
            duration: landDuration * (8 / 22),
            ease: 'power2.inOut',
          })
          .to(parts.head.rotation, {
            x: 0,
            duration: landDuration * (9 / 22),
            ease: 'power2.inOut',
          }),
        0,
      );

      const landingBurstOrigin = parts.root.position.clone();
      landingBurstOrigin.y -= 0.25;
      spawnLandingBurst(scene, landingBurstOrigin, runtime);

      onLand?.();
    };

    const positionTimeline = gsap.timeline({ onComplete: startLanding });
    positionTimeline
      .to(parts.root.position, {
        x: liftPos.x,
        y: liftPos.y,
        z: liftPos.z,
        duration: flyDuration * 0.2,
        ease: 'sine.in',
      })
      .to(parts.root.position, {
        x: apexPos.x,
        y: apexPos.y,
        z: apexPos.z,
        duration: flyDuration * 0.3,
        ease: 'sine.inOut',
      })
      .to(parts.root.position, {
        x: approachPos.x,
        y: approachPos.y,
        z: approachPos.z,
        duration: flyDuration * 0.25,
        ease: 'sine.inOut',
      })
      .to(parts.root.position, {
        x: correctedTarget.x,
        y: correctedTarget.y,
        z: correctedTarget.z,
        duration: flyDuration * 0.25,
        ease: 'sine.out',
      });

    const pitchTimeline = gsap.timeline();
    pitchTimeline
      .to(parts.root.rotation, {
        x: -0.15,
        duration: flyDuration * 0.15,
        ease: 'sine.out',
      })
      .to(parts.root.rotation, {
        x: -0.08,
        duration: flyDuration * 0.4,
        ease: 'sine.inOut',
      })
      .to(parts.root.rotation, {
        x: 0.06,
        duration: flyDuration * 0.3,
        ease: 'sine.inOut',
      })
      .to(parts.root.rotation, {
        x: 0,
        duration: flyDuration * 0.15,
        ease: 'sine.inOut',
      });

    const totalFlaps = Math.ceil(flyFrames / WING_FLAP_RATE);
    const flapHalfDuration = WING_FLAP_RATE / FLY_SPEED_FPS;
    const leftFlapTimeline = gsap.timeline();
    const rightFlapTimeline = gsap.timeline();
    for (let flapIndex = 0; flapIndex <= totalFlaps; flapIndex += 1) {
      const angle = flapIndex % 2 === 0 ? 0.65 : -0.2;
      leftFlapTimeline.to(parts.wingL.rotation, {
        z: angle,
        duration: flapHalfDuration,
        ease: 'sine.inOut',
      });
      rightFlapTimeline.to(parts.wingR.rotation, {
        z: -angle,
        duration: flapHalfDuration,
        ease: 'sine.inOut',
      });
    }

    cleanup = () => {
      if (settled) return;
      settled = true;
      positionTimeline.kill();
      pitchTimeline.kill();
      leftFlapTimeline.kill();
      rightFlapTimeline.kill();
      landingTimeline?.kill();
      trail.dispose();
      restorePerchPose();
      releaseBreathing();
      releasePose();
      runtime.removeCleanup(cleanup);
      if (activeFlightCleanup === cleanup) {
        activeFlightCleanup = null;
      }
    };

    activeFlightCleanup = cleanup;
    runtime.addCleanup(cleanup);
  };

  return {
    flyTo,
    tapReaction,
  };
}

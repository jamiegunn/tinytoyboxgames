import gsap from 'gsap';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { randomInterval } from './helpers';
import { BLINK_CLOSE_MS, BLINK_OPEN_MS, BREATH_RATE, FLY_SPEED_FPS } from './palette';
import type { OwlBuildParts, OwlCleanup, OwlIdleHandle, OwlRuntimeDisposer } from './types';

/**
 * Starts the owl's ambient perch behavior and returns narrow controls for
 * higher-priority actions that need to temporarily override idle motion.
 *
 * @param parts - Built owl parts whose transforms are animated by the idle loop.
 * @param runtime - Runtime cleanup registry used for timers and teardown.
 * @returns Idle controls that actions can use to coordinate shared transforms.
 */
export function startOwlIdle(parts: OwlBuildParts, runtime: OwlRuntimeDisposer): OwlIdleHandle {
  const breathDuration = BREATH_RATE / FLY_SPEED_FPS;
  const headBaseY = parts.head.position.y;
  let poseLocks = 0;
  let breathingLocks = 0;

  const setBlinkPose = (): void => {
    parts.leftEye.upperLid.scale.y = 0.5;
    parts.rightEye.upperLid.scale.y = 0.5;
    parts.leftEye.lowerLid.scale.y = 0.25;
    parts.rightEye.lowerLid.scale.y = 0.25;
  };

  const clearBlinkPose = (): void => {
    parts.leftEye.upperLid.scale.y = 0;
    parts.rightEye.upperLid.scale.y = 0;
    parts.leftEye.lowerLid.scale.y = 0;
    parts.rightEye.lowerLid.scale.y = 0;
  };

  const breathBodyTimeline = gsap.timeline({ repeat: -1 });
  breathBodyTimeline
    .to(parts.body.scale, {
      y: 1.014,
      z: 1.01,
      duration: breathDuration * 0.55,
      ease: 'sine.inOut',
    })
    .to(parts.body.scale, {
      y: 1.0,
      z: 1.0,
      duration: breathDuration * 0.45,
      ease: 'sine.inOut',
    });

  const breathHeadTimeline = gsap.timeline({ repeat: -1 });
  breathHeadTimeline
    .to(parts.head.position, {
      y: headBaseY + 0.006,
      duration: breathDuration * 0.65,
      ease: 'sine.inOut',
    })
    .to(parts.head.position, {
      y: headBaseY,
      duration: breathDuration * 0.35,
      ease: 'sine.inOut',
    });

  const doBlink = (closeMs: number): void => {
    if (runtime.isDisposed()) return;

    setBlinkPose();
    runtime.schedule(() => {
      if (!runtime.isDisposed()) {
        clearBlinkPose();
      }
    }, closeMs);
  };

  const scheduleBlink = (): void => {
    if (runtime.isDisposed()) return;

    const roll = Math.random();
    if (roll < 0.1) {
      doBlink(BLINK_CLOSE_MS * 2.0);
    } else if (roll < 0.2) {
      doBlink(BLINK_CLOSE_MS);
      runtime.schedule(
        () => {
          if (!runtime.isDisposed()) {
            doBlink(BLINK_CLOSE_MS * 0.8);
          }
        },
        BLINK_CLOSE_MS + BLINK_OPEN_MS + 100,
      );
    } else {
      doBlink(BLINK_CLOSE_MS);
    }

    runtime.schedule(scheduleBlink, BLINK_CLOSE_MS + BLINK_OPEN_MS + randomInterval(2500, 6500));
  };

  const scheduleHoot = (): void => {
    if (runtime.isDisposed()) return;

    runtime.schedule(
      () => {
        if (runtime.isDisposed()) return;
        triggerSound('sfx_shared_owl_hoot');
        scheduleHoot();
      },
      randomInterval(10000, 25000),
    );
  };

  const scheduleHeadMotion = (): void => {
    if (runtime.isDisposed()) return;

    if (poseLocks === 0) {
      const isSnap = Math.random() < 0.1;
      const turnAngle = (Math.random() - 0.5) * (isSnap ? 0.4 : 0.25);
      const tiltAngle = (Math.random() - 0.5) * 0.1;
      const durationSec = (isSnap ? 14 : 44) / FLY_SPEED_FPS;

      gsap.killTweensOf(parts.head.rotation);

      if (isSnap) {
        gsap
          .timeline()
          .to(parts.head.rotation, {
            y: turnAngle,
            z: tiltAngle,
            duration: 5 / FLY_SPEED_FPS,
            ease: 'power2.out',
          })
          .to(parts.head.rotation, {
            y: turnAngle * 0.95,
            z: tiltAngle * 0.85,
            duration: durationSec - 5 / FLY_SPEED_FPS,
            ease: 'power2.inOut',
          });
      } else {
        gsap.to(parts.head.rotation, {
          y: turnAngle,
          z: tiltAngle,
          duration: durationSec,
          ease: 'power2.inOut',
        });
      }
    }

    runtime.schedule(scheduleHeadMotion, randomInterval(3000, 8000));
  };

  const scheduleFeatherSettle = (): void => {
    if (runtime.isDisposed()) return;

    if (poseLocks === 0) {
      const durationSec = 36 / FLY_SPEED_FPS;
      const wing = Math.random() > 0.5 ? parts.wingL : parts.wingR;
      const sign = wing === parts.wingL ? 1 : -1;
      const baseZ = wing.rotation.z;

      gsap.killTweensOf(wing.rotation);
      gsap
        .timeline()
        .to(wing.rotation, {
          z: baseZ + sign * 0.05,
          duration: durationSec * (10 / 36),
          ease: 'power2.inOut',
        })
        .to(wing.rotation, {
          z: baseZ + sign * 0.02,
          duration: durationSec * (12 / 36),
          ease: 'power2.inOut',
        })
        .to(wing.rotation, {
          z: baseZ,
          duration: durationSec * (14 / 36),
          ease: 'power2.inOut',
        });
    }

    runtime.schedule(scheduleFeatherSettle, randomInterval(8000, 16000));
  };

  runtime.schedule(scheduleBlink, randomInterval(1500, 4000));
  scheduleHoot();
  runtime.schedule(scheduleHeadMotion, randomInterval(2000, 4500));
  runtime.schedule(scheduleFeatherSettle, randomInterval(5000, 9000));

  const acquirePoseControl = (): OwlCleanup => {
    poseLocks += 1;
    gsap.killTweensOf(parts.head.rotation);
    gsap.killTweensOf(parts.wingL.rotation);
    gsap.killTweensOf(parts.wingR.rotation);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      poseLocks = Math.max(0, poseLocks - 1);
    };
  };

  const acquireBreathingPause = (): OwlCleanup => {
    breathingLocks += 1;
    breathBodyTimeline.pause();
    breathHeadTimeline.pause();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      breathingLocks = Math.max(0, breathingLocks - 1);

      if (breathingLocks === 0 && !runtime.isDisposed()) {
        breathBodyTimeline.resume();
        breathHeadTimeline.resume();
      }
    };
  };

  runtime.addCleanup(() => {
    clearBlinkPose();
    gsap.killTweensOf(parts.body.scale);
    gsap.killTweensOf(parts.head.position);
    gsap.killTweensOf(parts.head.rotation);
    gsap.killTweensOf(parts.wingL.rotation);
    gsap.killTweensOf(parts.wingR.rotation);
    breathBodyTimeline.kill();
    breathHeadTimeline.kill();
  });

  return {
    doBlink,
    acquirePoseControl,
    acquireBreathingPause,
  };
}

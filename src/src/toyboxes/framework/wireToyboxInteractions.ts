import gsap from 'gsap';
import { Color, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { OwlCompanion } from '@app/entities/owl';
import type { NavigationActions, SceneId } from '@app/types/scenes';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { ToyboxInteractionOptions, ToyboxRuntime } from './types';

interface WireToyboxInteractionsArgs {
  canvas: HTMLCanvasElement;
  camera: Camera;
  runtime: ToyboxRuntime;
  destination: SceneId | null;
  nav: NavigationActions;
  owl: OwlCompanion;
  options: ToyboxInteractionOptions;
}

/**
 * Wires the default hover, owl fly-to, open animation, and navigation behavior for a toybox.
 *
 * @param args - Canvas, camera, runtime, destination, owl, navigation, and interaction settings.
 * @returns A cleanup function that removes the shared hover and click listeners.
 */
export function wireToyboxInteractions({ canvas, camera, runtime, destination, nav, owl, options }: WireToyboxInteractionsArgs): () => void {
  if (!destination) {
    return () => {};
  }

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const baseScale = runtime.root.scale.clone();

  const setHoverState = (active: boolean) => {
    runtime.hoverMaterials.forEach((material) => {
      material.emissive = active ? material.color.clone().multiplyScalar(options.hoverEmissiveStrength) : new Color(0, 0, 0);
    });
  };

  const playOpenAnimations = () => {
    runtime.openAnimations.forEach((part) => {
      const [channel, prop] = part.propertyPath.split('.');
      const target = channel === 'position' ? part.object.position : part.object.rotation;
      gsap.killTweensOf(target);
      gsap.to(target, {
        [prop]: part.peakValue,
        duration: 10 / 60,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(target, {
            [prop]: part.settleValue,
            duration: 15 / 60,
            ease: 'power2.inOut',
          });
        },
      });
    });
  };

  let pendingNav = false;

  const onClick = (event: PointerEvent) => {
    if (pendingNav) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    if (raycaster.intersectObjects(runtime.pickMeshes, true).length === 0) {
      return;
    }

    pendingNav = true;
    triggerSound(options.tapSoundId);

    const toyboxPosition = new Vector3();
    runtime.root.getWorldPosition(toyboxPosition);

    owl.flyTo(toyboxPosition, () => {
      playOpenAnimations();

      gsap.killTweensOf(runtime.root.scale);
      gsap.to(runtime.root.scale, {
        x: baseScale.x * options.pulseScale,
        y: baseScale.y * options.pulseScale,
        z: baseScale.z * options.pulseScale,
        duration: 6 / 60,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(runtime.root.scale, {
            x: baseScale.x,
            y: baseScale.y,
            z: baseScale.z,
            duration: 6 / 60,
            ease: 'power2.in',
            onComplete: () => {
              triggerSound(options.openSoundId);
              nav.navigateTo(destination);
              pendingNav = false;
            },
          });
        },
      });
    });
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(runtime.pickMeshes, true);
    setHoverState(intersects.length > 0);
  };

  canvas.addEventListener('pointerdown', onClick);
  canvas.addEventListener('pointermove', onPointerMove);

  return () => {
    canvas.removeEventListener('pointerdown', onClick);
    canvas.removeEventListener('pointermove', onPointerMove);
  };
}

import { Color, CylinderGeometry, Group, Mesh, SphereGeometry, SpotLight, Vector3, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { BOOKSHELF_CENTER_X, BOOKSHELF_Z } from '../layout';
import gsap from 'gsap';

/** Scale multiplier — 3x bigger than original. */
const S = 3;

/** Duration in seconds the lamp shines after being clicked. */
const SHINE_DURATION = 5;

/**
 * Creates a large desk lamp on the top shelf of the bookshelf.
 * When clicked, the lamp tilts forward and shines a spotlight toward
 * the front of the room for several seconds before returning to rest.
 * @param scene - The Three.js scene to add the lamp to
 * @param _keyLight - The directional light (unused)
 */
export function createDeskLamp(scene: Scene, _keyLight: DirectionalLight): void {
  const redMat = createGlossyPaintMaterial('hub_lampRedMat', new Color(0.85, 0.12, 0.1));
  const metalMat = createPlasticMaterial('hub_lampMetalMat', new Color(0.3, 0.3, 0.32));

  const root = new Group();
  root.name = 'deskLamp_root';
  root.position.set(BOOKSHELF_CENTER_X + 1.1, 2.54, BOOKSHELF_Z - 0.1);
  scene.add(root);

  // Heavy circular base
  const base = new Mesh(new CylinderGeometry(0.07 * S, 0.08 * S, 0.02 * S, 14), redMat);
  base.name = 'lampBase';
  base.castShadow = true;
  root.add(base);

  // Pivot group for the arm + shade + bulb (tilts when shining)
  const armPivot = new Group();
  armPivot.name = 'lampArmPivot';
  armPivot.position.set(0, 0.01 * S, 0);
  root.add(armPivot);

  // Arm — single pole angled slightly
  const arm = new Mesh(new CylinderGeometry(0.01 * S, 0.01 * S, 0.22 * S, 8), metalMat);
  arm.name = 'lampArm';
  arm.position.set(0.02 * S, 0.11 * S, 0);
  arm.rotation.z = 0.15;
  arm.castShadow = true;
  armPivot.add(arm);

  // Shade — conical, wider at bottom
  const shadeGeo = new CylinderGeometry(0.015 * S, 0.06 * S, 0.06 * S, 12, 1, true);
  const shade = new Mesh(shadeGeo, redMat);
  shade.name = 'lampShade';
  shade.position.set(0.05 * S, 0.23 * S, 0);
  shade.rotation.z = 0.2;
  shade.castShadow = true;
  armPivot.add(shade);

  // Bulb glow inside the shade
  const bulbMat = createPlasticMaterial('hub_lampBulbMat', new Color(1.0, 0.95, 0.8));
  bulbMat.emissive = new Color(0.15, 0.12, 0.06);
  const bulb = new Mesh(new SphereGeometry(0.02 * S, 8, 8), bulbMat);
  bulb.name = 'lampBulb';
  bulb.position.set(0.05 * S, 0.21 * S, 0);
  armPivot.add(bulb);

  // ── SpotLight — hidden until clicked ──
  const spotLight = new SpotLight(new Color(1.0, 0.95, 0.8), 0, 15, Math.PI / 6, 0.5, 1.5);
  spotLight.name = 'lampSpotLight';
  // Position at the bulb in world space (updated dynamically)
  const bulbWorldPos = new Vector3();
  bulb.getWorldPosition(bulbWorldPos);
  spotLight.position.copy(bulbWorldPos);
  // Target toward front of room (negative Z)
  spotLight.target.position.set(bulbWorldPos.x, 0, -5);
  scene.add(spotLight);
  scene.add(spotLight.target);

  // ── Click interaction — tilt forward and shine ──
  let shining = false;

  base.userData.onClick = () => {
    if (shining) return;
    shining = true;

    triggerSound('sfx_shared_tap_fallback');

    // Tilt the arm pivot forward (toward camera / -Z) — enough to fully expose the bulb
    gsap.to(armPivot.rotation, {
      x: 1.1,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: () => {
        // Keep spotlight following the bulb position
        bulb.getWorldPosition(bulbWorldPos);
        spotLight.position.copy(bulbWorldPos);
      },
      onComplete: () => {
        // Turn on the spotlight
        bulbMat.emissive = new Color(0.6, 0.5, 0.3);
        spotLight.intensity = 3;

        // Hold for SHINE_DURATION then return
        gsap.delayedCall(SHINE_DURATION, () => {
          // Fade out the light
          gsap.to(spotLight, {
            intensity: 0,
            duration: 0.5,
            ease: 'power2.in',
          });
          gsap.to(bulbMat.emissive, {
            r: 0.15,
            g: 0.12,
            b: 0.06,
            duration: 0.5,
            ease: 'power2.in',
          });

          // Tilt back to rest
          gsap.to(armPivot.rotation, {
            x: 0,
            duration: 0.6,
            ease: 'power2.inOut',
            onComplete: () => {
              shining = false;
            },
          });
        });
      },
    });
  };

  // Make the whole lamp clickable via raycasting (register pick meshes)
  [base, arm, shade, bulb].forEach((mesh) => {
    mesh.userData.onClick = base.userData.onClick;
  });
}

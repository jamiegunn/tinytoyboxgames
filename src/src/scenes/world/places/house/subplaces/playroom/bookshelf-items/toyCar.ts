import { BoxGeometry, Color, CylinderGeometry, MeshBasicMaterial, Mesh, SphereGeometry, Vector3, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import gsap from 'gsap';

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

  const exhaustTimer = gsap.to({}, { duration: 0.5, repeat: -1, paused: true, onRepeat: emitPuff, onStart: emitPuff });

  // Invisible hitbox — the car is small, so a larger clickable area helps
  const hitbox = new Mesh(new BoxGeometry(0.3, 0.15, 0.15), new MeshBasicMaterial({ visible: false }));
  hitbox.name = 'shelfCarHitbox';
  carBody.add(hitbox);

  // ── Click interaction — drive to floor and cruise back and forth ──
  let driving = false;

  const driveHandler = () => {
    if (driving) return;
    driving = true;

    triggerSound('sfx_shared_tap_fallback');

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
      const cruiseTl = gsap.timeline({ repeat: -1 });

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

  // Auto-activate after 15 seconds if not clicked
  gsap.delayedCall(15, () => {
    if (!driving) driveHandler();
  });
}

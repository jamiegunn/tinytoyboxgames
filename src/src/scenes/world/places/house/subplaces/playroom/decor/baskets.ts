import { Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createWoodMaterial, createWovenMaterial } from '@app/utils/materialFactory';

/**
 * Creates two woven baskets with thick rims, tapered bodies, woven band details,
 * and small toys peeking out from inside.
 * @param scene - The Three.js scene to add the baskets to
 * @param _keyLight - The directional light (unused)
 */
export function createBaskets(scene: Scene, _keyLight: DirectionalLight): void {
  const basketConfigs = [
    { pos: new Vector3(-5.0, 0, 3.0), rotY: 0.2 },
    { pos: new Vector3(4.8, 0, -1.5), rotY: -0.4 },
  ];

  const weaveColor = new Color(0.7, 0.55, 0.35);
  const rimColor = new Color(0.6, 0.45, 0.28);
  const darkWeaveColor = new Color(0.55, 0.4, 0.25);

  for (let i = 0; i < basketConfigs.length; i++) {
    const bc = basketConfigs[i];
    const basketMat = createWovenMaterial(`hub_basketMat${i}`, weaveColor);
    const darkMat = createWovenMaterial(`hub_basketDarkMat${i}`, darkWeaveColor);
    const rimMat = createWovenMaterial(`hub_basketRimMat${i}`, rimColor);

    const root = new Group();
    root.name = `basket${i}_root`;
    root.position.copy(bc.pos);
    root.rotation.y = bc.rotY;
    scene.add(root);

    // Main body — open-top cylinder, wider at top than bottom
    const body = new Mesh(new CylinderGeometry(0.32, 0.22, 0.44, 16, 1, true), basketMat);
    body.name = `basket${i}_body`;
    body.position.y = 0.22;
    body.castShadow = true;
    root.add(body);

    // Floor inside the basket
    const floor = new Mesh(new CylinderGeometry(0.21, 0.21, 0.02, 12), darkMat);
    floor.name = `basket${i}_floor`;
    floor.position.y = 0.02;
    root.add(floor);

    // Thick rolled rim — torus at the top edge
    const rim = new Mesh(new TorusGeometry(0.32, 0.03, 10, 20), rimMat);
    rim.name = `basket${i}_rim`;
    rim.position.y = 0.44;
    rim.rotation.x = Math.PI / 2;
    root.add(rim);

    // Woven band details — two horizontal rings around the body
    [0.15, 0.32].forEach((bandY, bi) => {
      const band = new Mesh(new TorusGeometry(0.22 + bandY * 0.3, 0.012, 8, 20), darkMat);
      band.name = `basket${i}_band${bi}`;
      band.position.y = bandY;
      band.rotation.x = Math.PI / 2;
      root.add(band);
    });

    // Base ring — slight foot at the bottom
    const baseRing = new Mesh(new TorusGeometry(0.22, 0.018, 8, 16), rimMat);
    baseRing.name = `basket${i}_base`;
    baseRing.position.y = 0.01;
    baseRing.rotation.x = Math.PI / 2;
    root.add(baseRing);

    // Handle arcs — two small handles on opposite sides
    [-1, 1].forEach((side, hi) => {
      const handleGeo = new TorusGeometry(0.06, 0.012, 8, 12, Math.PI);
      const handle = new Mesh(handleGeo, rimMat);
      handle.name = `basket${i}_handle${hi}`;
      handle.position.set(side * 0.32, 0.42, 0);
      handle.rotation.y = (side * Math.PI) / 2;
      handle.rotation.z = Math.PI;
      root.add(handle);
    });

    // Peeking toys inside
    // Small colorful ball
    const ball = new Mesh(new SphereGeometry(0.055, 8, 8), createGlossyPaintMaterial(`hub_basketBallMat${i}`, new Color(0.9, 0.3, 0.3)));
    ball.name = `basket${i}_peekBall`;
    ball.position.set(0.08, 0.46, 0.04);
    root.add(ball);

    // Wooden stick/rod poking up at an angle
    const stick = new Mesh(new CylinderGeometry(0.012, 0.012, 0.22, 6), createWoodMaterial(`hub_basketStickMat${i}`, new Color(0.55, 0.4, 0.25)));
    stick.name = `basket${i}_peekStick`;
    stick.position.set(-0.1, 0.48, -0.05);
    stick.rotation.z = 0.35;
    stick.rotation.x = -0.15;
    root.add(stick);

    // Small star shape (another toy peeking out)
    const star = new Mesh(new SphereGeometry(0.035, 6, 6), createGlossyPaintMaterial(`hub_basketStarMat${i}`, new Color(0.95, 0.85, 0.2)));
    star.name = `basket${i}_peekStar`;
    star.position.set(-0.04, 0.47, 0.1);
    root.add(star);
  }
}

import { Color, Group, Mesh, SphereGeometry, BoxGeometry, Vector3, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';

/**
 * Creates two soft felt floor pillows with a puffy, cushion-like shape.
 * Each pillow has a flat base, rounded puffy top, pinched corners, and a center button dimple.
 * @param scene - The Three.js scene to add the pillows to
 * @param _keyLight - The directional light (unused)
 */
export function createPillows(scene: Scene, _keyLight: DirectionalLight): void {
  const pillowConfigs = [
    { pos: new Vector3(4.2, 0, 3.5), color: new Color(0.6, 0.75, 0.9), rotY: -0.5, size: 0.85 },
    { pos: new Vector3(-4.5, 0, 4.0), color: new Color(0.85, 0.85, 0.5), rotY: 0.8, size: 0.7 },
  ];

  for (let i = 0; i < pillowConfigs.length; i++) {
    const cfg = pillowConfigs[i];
    const s = cfg.size;
    const mat = createFeltMaterial(`hub_pillowMat${i}`, cfg.color);
    const darkerMat = createFeltMaterial(`hub_pillowDarkMat${i}`, cfg.color.clone().multiplyScalar(0.8));

    const root = new Group();
    root.name = `pillow${i}_root`;
    root.position.copy(cfg.pos);
    root.rotation.y = cfg.rotY;
    scene.add(root);

    // Main body — a wide, flat rounded box shape (squashed sphere for softness)
    const bodyGeo = new SphereGeometry(1, 12, 8);
    bodyGeo.scale(0.42 * s, 0.1 * s, 0.38 * s);
    const body = new Mesh(bodyGeo, mat);
    body.name = `pillow${i}_body`;
    body.position.y = 0.1 * s;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    // Top puff — slightly smaller, gives a rounded cushion top
    const topGeo = new SphereGeometry(1, 10, 6);
    topGeo.scale(0.36 * s, 0.07 * s, 0.32 * s);
    const top = new Mesh(topGeo, mat);
    top.name = `pillow${i}_top`;
    top.position.y = 0.15 * s;
    root.add(top);

    // Bottom flat — slight base that sits on the floor
    const bottomGeo = new BoxGeometry(0.7 * s, 0.03 * s, 0.6 * s);
    const bottom = new Mesh(bottomGeo, darkerMat);
    bottom.name = `pillow${i}_bottom`;
    bottom.position.y = 0.015 * s;
    bottom.receiveShadow = true;
    root.add(bottom);

    // Four puffy corners — pillow corners that poke out
    const cornerOffsets = [new Vector3(-0.34, 0.08, -0.28), new Vector3(0.34, 0.08, -0.28), new Vector3(-0.34, 0.08, 0.28), new Vector3(0.34, 0.08, 0.28)];
    cornerOffsets.forEach((off, ci) => {
      const cornerGeo = new SphereGeometry(1, 6, 6);
      cornerGeo.scale(0.08 * s, 0.06 * s, 0.08 * s);
      const corner = new Mesh(cornerGeo, mat);
      corner.name = `pillow${i}_corner${ci}`;
      corner.position.set(off.x * s, off.y * s, off.z * s);
      root.add(corner);
    });

    // Center button dimple — small darker disc on top
    const buttonGeo = new SphereGeometry(1, 8, 6);
    buttonGeo.scale(0.04 * s, 0.015 * s, 0.04 * s);
    const button = new Mesh(buttonGeo, darkerMat);
    button.name = `pillow${i}_button`;
    button.position.y = 0.18 * s;
    root.add(button);

    // Edge piping — four subtle ridges along the pillow edges
    const pipingPositions = [
      { pos: new Vector3(0, 0.1, 0.35), scaleX: 0.38, rotY: 0 },
      { pos: new Vector3(0, 0.1, -0.35), scaleX: 0.38, rotY: 0 },
      { pos: new Vector3(0.38, 0.1, 0), scaleX: 0.32, rotY: Math.PI / 2 },
      { pos: new Vector3(-0.38, 0.1, 0), scaleX: 0.32, rotY: Math.PI / 2 },
    ];
    pipingPositions.forEach((p, pi) => {
      const pipeGeo = new SphereGeometry(1, 6, 4);
      pipeGeo.scale(p.scaleX * s, 0.025 * s, 0.02 * s);
      const pipe = new Mesh(pipeGeo, darkerMat);
      pipe.name = `pillow${i}_piping${pi}`;
      pipe.position.set(p.pos.x * s, p.pos.y * s, p.pos.z * s);
      pipe.rotation.y = p.rotY;
      root.add(pipe);
    });
  }
}

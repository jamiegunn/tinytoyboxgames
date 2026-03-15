import { BoxGeometry, CircleGeometry, Color, Mesh, PlaneGeometry, Vector3, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

/**
 * Creates three scattered alphabet blocks (A, B, C) with coloured faces and letter decals.
 * @param scene - The Three.js scene to add the toy blocks to
 * @param _keyLight - The directional light (unused)
 */
export function createToyBlocks(scene: Scene, _keyLight: DirectionalLight): void {
  const configs = [
    { pos: new Vector3(-1.8, 0.18, 1.0), color: new Color(0.88, 0.2, 0.2), rotY: 0.4, letter: 'A' },
    { pos: new Vector3(1.0, 0.18, -2.8), color: new Color(0.22, 0.5, 0.88), rotY: -0.3, letter: 'B' },
    { pos: new Vector3(-3.8, 0.18, -4.2), color: new Color(1.0, 0.82, 0.15), rotY: 0.7, letter: 'C' },
  ];

  for (let i = 0; i < configs.length; i++) {
    const c = configs[i];
    const block = new Mesh(new BoxGeometry(0.36, 0.36, 0.36), createGlossyPaintMaterial(`hub_blockMat${i}`, c.color));
    block.name = `toyBlock${i}`;
    block.position.copy(c.pos);
    block.rotation.y = c.rotY;
    block.castShadow = true;
    scene.add(block);

    const facePanel = new Mesh(new PlaneGeometry(0.28, 0.28), createPlasticMaterial(`hub_blockPanelMat${i}`, new Color(0.95, 0.92, 0.85)));
    facePanel.name = `blockPanel${i}`;
    facePanel.position.z = 0.181;
    block.add(facePanel);

    const letterMat = createGlossyPaintMaterial(`hub_blockLetterMat${i}`, c.color.clone().multiplyScalar(0.65));
    if (c.letter === 'A') {
      const a = new Mesh(new CircleGeometry(0.08, 3), letterMat);
      a.name = `blockLetter${i}`;
      a.position.z = 0.182;
      block.add(a);
    } else if (c.letter === 'B') {
      [-1, 1].forEach((v) => {
        const b = new Mesh(new CircleGeometry(0.045, 10), letterMat);
        b.name = `blockLetter${i}_${v}`;
        b.position.set(0.015, v * 0.04, 0.182);
        block.add(b);
      });
      const bar = new Mesh(new PlaneGeometry(0.02, 0.12), letterMat);
      bar.name = `blockLetterBar${i}`;
      bar.position.set(-0.03, 0, 0.182);
      block.add(bar);
    } else {
      const cShape = new Mesh(new CircleGeometry(0.06, 10, 0, Math.PI * 1.5), letterMat);
      cShape.name = `blockLetter${i}`;
      cShape.position.z = 0.182;
      cShape.rotation.z = 0.4;
      block.add(cShape);
    }

    const sideMat = createGlossyPaintMaterial(`hub_blockSideMat${i}`, c.color.clone().multiplyScalar(0.85));
    const sidePanel = new Mesh(new PlaneGeometry(0.28, 0.28), sideMat);
    sidePanel.name = `blockSide${i}`;
    sidePanel.position.set(0.181, 0, 0);
    sidePanel.rotation.y = Math.PI / 2;
    block.add(sidePanel);
  }
}

import { CircleGeometry, Color, Group, Mesh, PlaneGeometry } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import type { ToyboxEmblemKind } from '@app/toyboxes/framework';

/**
 * Builds a decorative front-face emblem on a toybox (stars, clover, or heart depending on world).
 * @param parent - The parent mesh or group to attach the emblem to
 * @param toyboxId - The toybox identifier used in material names
 * @param emblem - The emblem variant to build
 * @param accent - The accent colour for the emblem
 */
export function buildToyboxEmblem(parent: Mesh | Group, toyboxId: string, emblem: ToyboxEmblemKind, accent: Color): void {
  const emblemMat = createPlasticMaterial(`toybox_${toyboxId}_emblemMat`, accent);
  emblemMat.emissive = accent.clone().multiplyScalar(0.08);

  if (emblem === 'stars') {
    const starMat = createPlasticMaterial(`toybox_${toyboxId}_starMat`, new Color(1.0, 0.95, 0.8));
    starMat.emissive = new Color(0.05, 0.04, 0.02);
    const starPositions = [
      { x: 0, y: 0.2, z: 0.72 },
      { x: -0.65, y: 0.35, z: 0.72 },
      { x: 0.65, y: 0.35, z: 0.72 },
      { x: -0.65, y: -0.25, z: 0.72 },
      { x: 0.65, y: -0.25, z: 0.72 },
    ];
    const starSizes = [0.18, 0.1, 0.1, 0.08, 0.08];
    for (let si = 0; si < starPositions.length; si++) {
      const star = new Mesh(new CircleGeometry(starSizes[si], 5), starMat);
      star.name = `toybox_${toyboxId}_star${si}`;
      star.position.set(starPositions[si].x, starPositions[si].y, starPositions[si].z);
      star.rotation.z = si * 0.4;
      parent.add(star);
    }
  } else if (emblem === 'clover') {
    const leafMat = createPlasticMaterial(`toybox_${toyboxId}_leafMat`, new Color(0.4, 0.7, 0.35));
    const cloverAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
    for (let cli = 0; cli < cloverAngles.length; cli++) {
      const leaf = new Mesh(new CircleGeometry(0.08, 10), leafMat);
      leaf.name = `toybox_${toyboxId}_clover${cli}`;
      const cx = Math.sin(cloverAngles[cli]) * 0.08;
      const cy = Math.cos(cloverAngles[cli]) * 0.08 + 0.25;
      leaf.position.set(cx, cy, 0.72);
      parent.add(leaf);
    }

    const stemMat = createPlasticMaterial(`toybox_${toyboxId}_stemMat`, new Color(0.35, 0.6, 0.3));
    const stem = new Mesh(new PlaneGeometry(0.02, 0.15), stemMat);
    stem.name = `toybox_${toyboxId}_stem`;
    stem.position.set(0, 0.1, 0.72);
    parent.add(stem);

    const borderMat = createPlasticMaterial(`toybox_${toyboxId}_borderMat`, new Color(0.95, 0.92, 0.82));
    const borders = [
      { w: 1.6, h: 0.03, pos: { x: 0, y: 0.5, z: 0.72 } },
      { w: 1.6, h: 0.03, pos: { x: 0, y: -0.4, z: 0.72 } },
    ];
    for (let bi = 0; bi < borders.length; bi++) {
      const border = new Mesh(new PlaneGeometry(borders[bi].w, borders[bi].h), borderMat);
      border.name = `toybox_${toyboxId}_border${bi}`;
      border.position.set(borders[bi].pos.x, borders[bi].pos.y, borders[bi].pos.z);
      parent.add(border);
    }
  } else if (emblem === 'heart') {
    const heartMat = createPlasticMaterial(`toybox_${toyboxId}_heartMat`, new Color(0.9, 0.6, 0.7));
    const hl = new Mesh(new CircleGeometry(0.07, 10), heartMat);
    hl.name = `toybox_${toyboxId}_heartL`;
    hl.position.set(-0.05, 0.25, 0.72);
    parent.add(hl);

    const hr = new Mesh(new CircleGeometry(0.07, 10), heartMat);
    hr.name = `toybox_${toyboxId}_heartR`;
    hr.position.set(0.05, 0.25, 0.72);
    parent.add(hr);

    const hb = new Mesh(new CircleGeometry(0.08, 3), heartMat);
    hb.name = `toybox_${toyboxId}_heartBot`;
    hb.position.set(0, 0.16, 0.72);
    hb.rotation.z = Math.PI;
    parent.add(hb);

    const moonMat = createPlasticMaterial(`toybox_${toyboxId}_moonMat`, new Color(1.0, 0.95, 0.7));
    const moonFull = new Mesh(new CircleGeometry(0.08, 12), moonMat);
    moonFull.name = `toybox_${toyboxId}_moon`;
    moonFull.position.set(0, -0.05, 0.72);
    parent.add(moonFull);
  }
}

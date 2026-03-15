/**
 * Adds organic surface detail to the log body:
 * moss clumps, lichen spots, and shelf fungi.
 */
import { Mesh, Group, Color, SphereGeometry } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';
import { createSeededHelpers } from '@app/utils/randomHelpers';
import { L, radiusAt, tFromY } from './constants';
import type { LogMaterials } from './types';

/**
 * Attaches moss, lichen, and shelf-fungi geometry to the log body.
 *
 * @param body - The main log body mesh.
 * @param mats - Shared log materials.
 */
export function addFoliage(body: Mesh, mats: LogMaterials): void {
  const rand = createSeededHelpers(7002);

  /* Moss clumps on top (+X radial = world sky after rotation). */
  const mossData = [
    { y: -0.4, sz: 0.07 },
    { y: -0.15, sz: 0.1 },
    { y: 0.1, sz: 0.13 },
    { y: 0.35, sz: 0.08 },
    { y: 0.55, sz: 0.06 },
    { y: -0.55, sz: 0.07 },
    { y: 0.0, sz: 0.09 },
    { y: -0.7, sz: 0.065 },
  ];

  mossData.forEach((mp, mi) => {
    const t = tFromY(mp.y);
    const radius = radiusAt(t) + 0.01;
    // Angle near 0 keeps the clump on the upward-facing side.
    const angSpread = rand.bipolar(0.55);
    const cx = Math.cos(angSpread) * radius;
    const cz = Math.sin(angSpread) * radius;

    const clump = new Group();
    clump.position.set(cx, mp.y, cz);
    body.add(clump);

    const blob = new Mesh(new SphereGeometry(mp.sz, 7, 5), mi % 3 === 0 ? mats.mossLight : mats.mossMat);
    blob.scale.set(1.0, 0.35, 1.2);
    clump.add(blob);

    for (let sb = 0; sb < 3; sb++) {
      const sub = new Mesh(new SphereGeometry(mp.sz * rand.range(0.3, 0.65), 5, 4), sb === 0 ? mats.mossLight : mats.mossMat);
      sub.position.set(rand.bipolar(mp.sz * 0.4), rand.bipolar(mp.sz * 0.3), rand.bipolar(mp.sz * 0.8));
      sub.scale.set(1.0, 0.3, 0.9);
      clump.add(sub);
    }
  });

  /* Lichen spots as flattened spheres. */
  for (let li = 0; li < 8; li++) {
    const angle = rand.range(0, Math.PI * 2);
    const yy = rand.bipolar(L * 0.75);
    const t = tFromY(yy);
    const rad = radiusAt(t) + 0.003;
    const lichen = new Mesh(new SphereGeometry(rand.range(0.018, 0.032), 5, 4), mats.lichenMat);
    lichen.position.set(Math.cos(angle) * rad, yy, Math.sin(angle) * rad);
    lichen.scale.set(1.3, 0.25, 1.3);
    body.add(lichen);
  }

  /* Shelf fungi underneath on the shaded side (-X). */
  const fungiMat = createFeltMaterial('shelfFungiMat', new Color(0.6, 0.52, 0.38));
  for (let fi = 0; fi < 3; fi++) {
    const yy = -0.2 + fi * 0.35;
    const t = tFromY(yy);
    const radius = radiusAt(t);
    const angle = Math.PI + (fi - 1) * 0.3;
    const fungus = new Mesh(new SphereGeometry(0.028, 6, 4), fungiMat);
    fungus.position.set(Math.cos(angle) * radius, yy, Math.sin(angle) * radius);
    fungus.scale.set(1.5, 0.3, 1.3);
    body.add(fungus);
  }
}

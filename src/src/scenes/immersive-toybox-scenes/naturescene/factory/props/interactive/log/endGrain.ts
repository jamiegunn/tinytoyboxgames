/**
 * Adds end-grain detail at the far end of the log (Y = +L/2):
 * a thin cap disc, concentric growth rings, and a centre pith dot.
 */
import { Mesh, SphereGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { L, Rtop } from './constants';
import type { LogMaterials } from './types';

/**
 * Attaches end-grain geometry to the log body.
 *
 * @param body - The main log body mesh.
 * @param mats - Shared log materials.
 */
export function addEndGrain(body: Mesh, mats: LogMaterials): void {
  // Thin cap disc
  const endCap = new Mesh(new CylinderGeometry(Rtop - 0.005, Rtop, 0.015, 14, 1), mats.innerWood);
  endCap.position.y = L / 2;
  body.add(endCap);

  // Growth rings (torus in XZ, centred at endCap Y)
  for (let gr = 0; gr < 5; gr++) {
    const grRing = new Mesh(new TorusGeometry(0.025 + gr * 0.04, 0.003, 4, 18), gr % 2 === 0 ? mats.heartWood : mats.innerWood);
    grRing.position.y = L / 2 + 0.003;
    body.add(grRing);
  }

  // Centre pith
  const pith = new Mesh(new SphereGeometry(0.012, 5, 4), mats.barkDark);
  pith.position.y = L / 2 + 0.005;
  pith.scale.set(1, 0.3, 1);
  body.add(pith);
}

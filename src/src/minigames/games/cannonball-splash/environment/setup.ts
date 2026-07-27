/**
 * Scene construction for Cannonball Splash.
 *
 * Builds the ocean, sky, clouds, seagulls, sun, islands, ship, cannon and
 * lighting. The sky is an unlit vertex-colored gradient plane and the ocean is a
 * lit gradient plane whose vertices actually move, so the scene reads as a sunny
 * toy seaside diorama under ACES tone mapping.
 */

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import { C, type CannonRig, type EnvironmentRig } from '../types';

// ── Material factory ────────────────────────────────────────────────────────

function mat(
  name: string,
  color: [number, number, number],
  opts: { metalness?: number; roughness?: number; emissive?: [number, number, number]; transparent?: boolean; opacity?: number } = {},
): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(...color),
    metalness: opts.metalness ?? 0,
    roughness: opts.roughness ?? 0.7,
  });
  if (opts.emissive) m.emissive = new Color(...opts.emissive);
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 1;
  }
  m.name = name;
  return m;
}

// ── Ocean surface ───────────────────────────────────────────────────────────

/** World z the ocean plane is centred on (its local +y runs toward -z). */
const OCEAN_CENTER_Z = -21;

/**
 * Height of the water surface at a world point.
 *
 * The "waves" used to be the whole rigid plane sliding up and down in y, which
 * moves every drop of water in lockstep and reads as a lift, not a sea. Four
 * summed swells rolling toward the camera give the surface real shape.
 *
 * The amplitudes were raised (0.09/0.05/0.03 → 0.13/0.07/0.05, plus a new short
 * swell at 0.045) because sub-pixel motion is invisible motion. One world unit
 * of height is 85 screen pixels at z = -4.5 and 49 at z = -12, so the old
 * ±0.17-unit total swell was a 14-29 px rise spread over a ten-second period —
 * about a fifth of a pixel per frame. The new ±0.295 total is 28-50 px of travel
 * and the fastest term alone (0.045 at 1.9 rad/s) moves 0.085 units/s.
 *
 * The highest wavenumber is deliberately capped at 1.15 rad/unit: the ocean
 * plane samples every 0.78 units, so 1.15 gives 7 vertices per wavelength.
 * Anything faster folds into visible creases instead of water.
 * @param x - World x coordinate.
 * @param z - World z coordinate.
 * @param t - Elapsed time in seconds.
 * @returns Water height in world units.
 */
export function sampleOceanHeight(x: number, z: number, t: number): number {
  return (
    0.13 * Math.sin(0.55 * z + 1.1 * t) + 0.07 * Math.sin(0.31 * z - 0.7 * t + 1.3) + 0.05 * Math.sin(0.23 * x + 0.8 * t) + 0.045 * Math.sin(1.15 * z + 1.9 * t)
  );
}

// Pushes the wave heights into the ocean plane's vertices. The plane is rotated
// -90° about x, so its local +z displaces world +y and its local +y runs toward
// world -z.
function updateOceanSurface(ocean: Mesh, t: number): void {
  const pos = ocean.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, sampleOceanHeight(pos.getX(i), OCEAN_CENTER_Z - pos.getY(i), t));
  }
  pos.needsUpdate = true;
  ocean.geometry.computeVertexNormals();
}

// ── Gradient helpers ────────────────────────────────────────────────────────

/**
 * Writes a vertical color gradient into a plane geometry's vertex colors.
 *
 * Stops are given in the plane's own *local y*, not in a normalized 0-1 range.
 * Normalized stops tie the colors to the plane's size rather than to what the
 * camera sees: the sky plane is 46 units tall but only its lowest 14.4 units are
 * ever on screen, so a 0 → 1 ramp spent most of its range off-frame and the
 * visible band came out flat — it measured (191,203,207) just above the horizon
 * against (189,200,210) at the top of the frame, a two-unit ramp across the
 * entire sky, which is the washed-out sky in the screenshot. Local-y stops put
 * the color changes where they can actually be seen.
 * @param geometry - The PlaneGeometry to write colors into.
 * @param stops - Gradient stops as [localY, color], sorted ascending in y.
 */
function applyVerticalGradient(geometry: PlaneGeometry, stops: Array<[number, Color]>): void {
  const pos = geometry.attributes.position;
  const colors: number[] = [];
  const out = new Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    if (y <= stops[0][0]) {
      lo = stops[0];
      hi = stops[0];
    } else if (y >= hi[0]) {
      lo = hi;
    } else {
      for (let s = 0; s < stops.length - 1; s++) {
        if (y >= stops[s][0] && y <= stops[s + 1][0]) {
          lo = stops[s];
          hi = stops[s + 1];
          break;
        }
      }
    }
    const span = Math.max(1e-6, hi[0] - lo[0]);
    out.copy(lo[1]).lerp(hi[1], Math.max(0, Math.min(1, (y - lo[0]) / span)));
    colors.push(out.r, out.g, out.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
}

/**
 * Alpha ramp for the sun glow, as `[fraction of the half-extent, alpha]`.
 *
 * The shipped ramp was `0.9 -> 0.45 -> 0` over 0 -> 0.35 -> 1.0, i.e. two
 * straight segments. Two things went wrong with that. It only reached zero *at*
 * the inscribed circle, so the quad's corners were transparent but its four
 * edge midpoints sat at exactly the alpha discontinuity, and it arrived there
 * with a non-zero slope (-0.69 alpha per unit t), which Mach-bands into a
 * visible straight edge against a flat sky.
 *
 * These stops sample `alpha(t) = 0.85 * (1 - t/0.90)^2.4`, which reaches
 * **exactly 0 at t = 0.90** — 10% of the half-extent short of the quad's edge —
 * and does so with zero slope, because the derivative carries a factor of
 * `(1 - t/0.90)^1.4`. The outer 10% of the texture is uniformly transparent, so
 * no straight edge exists to be seen at any scale.
 */
const SUN_GLOW_STOPS: readonly (readonly [number, number])[] = [
  [0.0, 0.85],
  [0.18, 0.4975],
  [0.36, 0.2494],
  [0.54, 0.0943],
  [0.72, 0.0179],
  [0.81, 0.0034],
  [0.9, 0],
  [1.0, 0],
];

/**
 * Creates a soft radial glow texture on an offscreen canvas for the sun.
 * @returns A CanvasTexture whose alpha reaches zero at 90% of the half-extent.
 */
function createSunGlowTexture(): CanvasTexture {
  // 256 rather than 128: the quad covers ~242 px of a 1200 px frame, so this is
  // about one texel per pixel and the shallow outer tail does not band.
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    for (const [stop, alpha] of SUN_GLOW_STOPS) {
      grad.addColorStop(stop, `rgba(255, 240, 196, ${alpha})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/**
 * Builds a puffy toy cloud as a cluster of overlapping soft-shaded spheres.
 * @param name - Name assigned to the cloud group.
 * @param material - Shared cloud material.
 * @param blobScale - Overall size multiplier for the cluster.
 * @returns The cloud group ready for placement.
 */
function createPuffyCloud(name: string, material: MeshStandardMaterial, blobScale: number): Group {
  const cloud = new Group();
  cloud.name = name;
  const blobs = [
    { x: 0, y: 0.15, s: 1.0 },
    { x: -0.95, y: -0.1, s: 0.72 },
    { x: 0.95, y: -0.08, s: 0.78 },
    { x: -0.45, y: 0.32, s: 0.6 },
    { x: 0.5, y: 0.3, s: 0.55 },
  ];
  blobs.forEach((b, i) => {
    const blob = new Mesh(new SphereGeometry(1.4 * b.s * blobScale, 10, 8), material);
    blob.name = `${name}_blob_${i}`;
    blob.position.set(b.x * 1.6 * blobScale, b.y * 1.4 * blobScale, 0);
    blob.scale.set(1.15, 0.68, 0.9);
    cloud.add(blob);
  });
  return cloud;
}

/**
 * Builds one seagull: a dart of a body with two flapping wings.
 *
 * The bird is modelled nose-toward -z with its wings spread along x, so the
 * caller only has to yaw the group by ±90° to send it left or right and the
 * flap stays a plain rotation of each wing pivot about z.
 * @param name - Name assigned to the bird group.
 * @param material - Shared seagull material.
 * @returns The bird group; children[0] is the body, [1] and [2] are wing pivots.
 */
function createSeagull(name: string, material: MeshStandardMaterial): Group {
  const bird = new Group();
  bird.name = name;

  const body = new Mesh(new SphereGeometry(0.1, 6, 4), material);
  body.name = `${name}_body`;
  body.scale.set(0.9, 0.8, 2.2);
  bird.add(body);

  // Wing pivots sit just off the centreline so the wing roots meet the body.
  for (const side of [-1, 1]) {
    const pivot = new Group();
    pivot.name = `${name}_wing_${side > 0 ? 'r' : 'l'}`;
    pivot.position.set(side * 0.05, 0.02, 0);
    const wing = new Mesh(new BoxGeometry(0.44, 0.02, 0.18), material);
    wing.name = `${pivot.name}_blade`;
    wing.position.x = side * 0.24;
    pivot.add(wing);
    bird.add(pivot);
  }

  return bird;
}

/**
 * Builds a small stylized palm tree (trunk + leafy canopy) for horizon islands.
 * @param trunkMat - Shared trunk material.
 * @param canopyMat - Shared canopy material.
 * @param height - Trunk height in world units.
 * @param lean - Sideways lean in radians.
 * @returns The palm tree group with its base at local origin.
 */
function createPalmTree(trunkMat: MeshStandardMaterial, canopyMat: MeshStandardMaterial, height: number, lean: number): Group {
  const palm = new Group();
  palm.name = 'cs_palm';

  const trunk = new Mesh(new CylinderGeometry(0.08, 0.14, height, 6), trunkMat);
  trunk.name = 'palm_trunk';
  trunk.position.y = height / 2;
  palm.add(trunk);

  // Canopy: a ring of flattened fronds around a center puff
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const frond = new Mesh(new SphereGeometry(0.45, 6, 4), canopyMat);
    frond.name = `palm_frond_${i}`;
    frond.scale.set(1.4, 0.28, 0.55);
    frond.position.set(Math.cos(angle) * 0.5, height + 0.05, Math.sin(angle) * 0.5);
    frond.rotation.y = -angle;
    frond.rotation.z = 0.35;
    palm.add(frond);
  }
  const centerPuff = new Mesh(new SphereGeometry(0.3, 6, 4), canopyMat);
  centerPuff.name = 'palm_center';
  centerPuff.scale.set(1, 0.6, 1);
  centerPuff.position.y = height + 0.15;
  palm.add(centerPuff);

  palm.rotation.z = lean;
  return palm;
}

// ── Ship builder ────────────────────────────────────────────────────────────

// Deck outline in the ship's own frame as [x, z]: the bow tip is at z = -3, out
// in front of the child, and the stern is behind the camera at z = +2.4.
//
// The winding is load-bearing. Traversed bow → port → stern → starboard, the
// loop is clockwise in the (x, z) plane, which means a triangle fan of
// (centroid, p[i], p[i+1]) has a +y normal — the deck faces up with no
// per-triangle winding tests anywhere below.
const SHIP_OUTLINE: Array<[number, number]> = [
  [0, -3.0],
  [-1.1, -2.2],
  [-1.9, -1.0],
  [-2.3, 0.6],
  [-2.2, 2.4],
  [2.2, 2.4],
  [2.3, 0.6],
  [1.9, -1.0],
  [1.1, -2.2],
];

const DECK_Y = 0.3;
const KEEL_Y = -0.6;
const RAIL_Y = 0.74;

// Scales the outline about the origin. The hull's keel is pulled hard toward the
// centreline and only slightly shortened, which is what gives the boat a V
// section and keeps the bow sharp.
function scaleOutline(xScale: number, zScale: number): Array<[number, number]> {
  return SHIP_OUTLINE.map(([x, z]) => [x * xScale, z * zScale] as [number, number]);
}

// Appends one triangle to a flat position array.
function pushTri(out: number[], a: number[], b: number[], c: number[]): void {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}

// Fan-triangulates a closed ring at a fixed height. faceUp picks the winding and
// therefore which way the cap's normal points.
function ringCap(out: number[], ring: Array<[number, number]>, y: number, faceUp: boolean): void {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of ring) {
    cx += x;
    cz += z;
  }
  cx /= ring.length;
  cz /= ring.length;
  const centre = [cx, y, cz];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const a = [p[0], y, p[1]];
    const b = [q[0], y, q[1]];
    if (faceUp) pushTri(out, centre, a, b);
    else pushTri(out, centre, b, a);
  }
}

// Lofts a wall between two rings at different heights, joining vertex i of the
// top ring to vertex i of the bottom ring. outward picks the winding.
function ringWall(out: number[], top: Array<[number, number]>, yTop: number, bottom: Array<[number, number]>, yBottom: number, outward: boolean): void {
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    const t0 = [top[i][0], yTop, top[i][1]];
    const t1 = [top[j][0], yTop, top[j][1]];
    const b0 = [bottom[i][0], yBottom, bottom[i][1]];
    const b1 = [bottom[j][0], yBottom, bottom[j][1]];
    if (outward) {
      pushTri(out, t0, b0, b1);
      pushTri(out, t0, b1, t1);
    } else {
      pushTri(out, t0, b1, b0);
      pushTri(out, t0, t1, b1);
    }
  }
}

// Fills the flat band between an outer and an inner ring at one height, facing up.
function ringBand(out: number[], outer: Array<[number, number]>, inner: Array<[number, number]>, y: number): void {
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const o0 = [outer[i][0], y, outer[i][1]];
    const o1 = [outer[j][0], y, outer[j][1]];
    const i0 = [inner[i][0], y, inner[i][1]];
    const i1 = [inner[j][0], y, inner[j][1]];
    pushTri(out, o0, i1, i0);
    pushTri(out, o0, o1, i1);
  }
}

// Wraps a flat position array as a mesh with recomputed flat normals.
function meshFromPositions(name: string, positions: number[], material: MeshStandardMaterial): Mesh {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const mesh = new Mesh(geo, material);
  mesh.name = name;
  return mesh;
}

// Makes an object and all its descendants invisible to the raycaster.
//
// The framework picks with intersectObjects(scene.children, true), so any mesh
// between the camera and the water can swallow a tap. The old railing's nine
// posts sat right across the child's view and did exactly that: taps that
// landed on a post produced no shot at all. Scenery must never eat a tap.
function makeNonPickable(object: Object3D): void {
  object.traverse((child) => {
    child.raycast = () => {};
  });
}

/**
 * Builds the ship the child is standing on: a V-sectioned hull, a planked deck,
 * a bulwark to lean over with a gold rail cap, and a little deck cargo.
 *
 * Every surface here is written out as explicit triangles rather than extruded.
 * The previous version built the hull and the bulwark with
 * `new ExtrudeGeometry(shape, { depth, bevelEnabled: false })`, and in three
 * r175 that emits *zero cap faces*: ExtrudeGeometry only fills
 * `contractedContourVertices` inside its `for (b = 0; b < bevelSegments; b++)`
 * loop, so with bevelling off it triangulates an empty contour. The resulting
 * groups are `[{start: 0, count: 0, materialIndex: 0}, {start: 0, count: 54,
 * materialIndex: 1}]` — reproduced here on a plain square. What shipped was
 * therefore an open ribbon of wall whose inner faces are back-face culled, so
 * the child looked straight through the boat to the water and the only ship
 * geometry that rendered at all was the five `cs_seam_*` boxes. That is exactly
 * the "bare tan sawhorse frame with no deck, hull, bow or railing" in the
 * screenshot: the seams *were* the sawhorse.
 * @returns The ship group, already excluded from raycasts.
 */
function createShip(): Group {
  const ship = new Group();
  ship.name = 'cs_ship';

  const deckMat = mat('deck_plank', [0.66, 0.45, 0.26], { roughness: 0.7 });
  const hullMat = mat('hull_paint', [0.42, 0.15, 0.13], { roughness: 0.55 });
  const railMat = mat('rail_cap', [0.72, 0.55, 0.2], { metalness: 0.35, roughness: 0.4 });
  const seamMat = mat('plank_seam', [0.38, 0.25, 0.13], { roughness: 0.8 });
  const ropeMat = mat('deck_rope', [0.78, 0.68, 0.44], { roughness: 0.9 });
  const crateMat = mat('deck_crate', [0.6, 0.42, 0.24], { roughness: 0.8 });

  const keelRing = scaleOutline(0.52, 0.9);
  const innerRing = scaleOutline(0.88, 0.88);

  // Deck: one upward-facing cap. The bulwark stands on its rim and hides the seam.
  const deckPos: number[] = [];
  ringCap(deckPos, SHIP_OUTLINE, DECK_Y, true);
  const deck = meshFromPositions('cs_deck', deckPos, deckMat);
  deck.receiveShadow = true;
  ship.add(deck);

  // Hull: outward-facing sides falling away to a narrow keel, closed underneath.
  const hullPos: number[] = [];
  ringWall(hullPos, SHIP_OUTLINE, DECK_Y, keelRing, KEEL_Y, true);
  ringCap(hullPos, keelRing, KEEL_Y, false);
  const hull = meshFromPositions('cs_hull', hullPos, hullMat);
  hull.castShadow = true;
  ship.add(hull);

  // Bulwark: an outer skin and an inner skin, so it reads as a wall from both
  // sides instead of vanishing when you look at its back face.
  const bulwarkPos: number[] = [];
  ringWall(bulwarkPos, SHIP_OUTLINE, RAIL_Y, SHIP_OUTLINE, DECK_Y, true);
  ringWall(bulwarkPos, innerRing, RAIL_Y, innerRing, DECK_Y, false);
  const bulwark = meshFromPositions('cs_bulwark', bulwarkPos, hullMat);
  bulwark.castShadow = true;
  ship.add(bulwark);

  // Rail cap: the gold band closing the top of the bulwark.
  const railPos: number[] = [];
  ringBand(railPos, SHIP_OUTLINE, innerRing, RAIL_Y);
  ship.add(meshFromPositions('cs_rail', railPos, railMat));

  // Plank seams, fore-and-aft. Only the stretch of deck from the bow tip back to
  // about z = -1.35 is on screen at this camera, so the seams live there; each
  // one is short enough to stay inside the bulwark's inner ring along its length.
  const seams = [
    { x: -0.45, length: 1.6, z: -1.8 },
    { x: 0.45, length: 1.6, z: -1.8 },
    { x: -1.0, length: 1.1, z: -1.55 },
    { x: 1.0, length: 1.1, z: -1.55 },
  ];
  for (let i = 0; i < seams.length; i++) {
    const s = seams[i];
    const seam = new Mesh(new BoxGeometry(0.05, 0.012, s.length), seamMat);
    seam.name = `cs_seam_${i}`;
    seam.position.set(s.x, DECK_Y + 0.007, s.z);
    ship.add(seam);
  }

  // Deck cargo, kept clear of the cannon carriage (which spans x ±0.70,
  // z -2.5 to -1.5) and inside the inner ring at its own z.
  for (const side of [-1, 1]) {
    const coil = new Group();
    coil.name = `cs_rope_${side > 0 ? 'r' : 'l'}`;
    for (let r = 0; r < 2; r++) {
      const ring = new Mesh(new TorusGeometry(0.17 - r * 0.05, 0.045, 5, 12), ropeMat);
      ring.name = `${coil.name}_${r}`;
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.045 + r * 0.075;
      coil.add(ring);
    }
    coil.position.set(side * 1.02, DECK_Y, -1.75);
    ship.add(coil);
  }

  const crate = new Mesh(new BoxGeometry(0.32, 0.28, 0.32), crateMat);
  crate.name = 'cs_crate';
  crate.position.set(1.15, DECK_Y + 0.14, -1.45);
  crate.castShadow = true;
  ship.add(crate);

  const deckBarrel = new Mesh(new CylinderGeometry(0.16, 0.16, 0.3, 10), crateMat);
  deckBarrel.name = 'cs_deck_barrel';
  deckBarrel.position.set(-1.15, DECK_Y + 0.15, -1.45);
  deckBarrel.castShadow = true;
  ship.add(deckBarrel);

  makeNonPickable(ship);
  return ship;
}

// ── Cannon builder ──────────────────────────────────────────────────────────

function createCannon(): CannonRig {
  const root = new Group();
  root.name = 'cannon_root';
  root.position.set(C.CANNON_X, C.CANNON_Y, C.CANNON_Z);

  const woodMat = mat('cannon_wood', [0.58, 0.38, 0.2], { roughness: 0.65 });
  const bronzeMat = mat('cannon_barrel', [0.78, 0.5, 0.23], { metalness: 0.55, roughness: 0.32, emissive: [0.06, 0.03, 0.01] });
  const brassMat = mat('cannon_band', [0.95, 0.74, 0.32], { metalness: 0.65, roughness: 0.25, emissive: [0.08, 0.05, 0.01] });
  const mouthMat = mat('cannon_mouth', [0.28, 0.16, 0.07], { roughness: 0.8 });

  // Base (wood carriage)
  const base = new Mesh(new BoxGeometry(1.2, 0.4, 1.0), woodMat);
  base.name = 'cannon_base';
  base.position.y = -0.2;
  base.castShadow = true;
  root.add(base);

  // Barrel group (rotates to aim)
  const barrelGroup = new Group();
  barrelGroup.name = 'cannon_barrel_group';
  barrelGroup.position.y = 0.1;
  // Turret order: swing left/right first, then tip up. With the default XYZ the
  // pitch tilts the yaw axis and the barrel rolls as it traverses, which is why
  // computeCannonAim solves yaw/pitch in this frame.
  barrelGroup.rotation.order = 'YXZ';

  const barrelBody = new Mesh(new CylinderGeometry(0.25, 0.28, 1.4, 14), bronzeMat);
  barrelBody.name = 'barrel_body';
  barrelBody.rotation.x = Math.PI / 2;
  barrelBody.position.z = -0.5;
  barrelBody.castShadow = true;
  barrelGroup.add(barrelBody);

  // Flared mouth
  const mouth = new Mesh(new CylinderGeometry(0.31, 0.25, 0.16, 14), brassMat);
  mouth.name = 'barrel_mouth';
  mouth.rotation.x = Math.PI / 2;
  mouth.position.z = -1.2;
  barrelGroup.add(mouth);

  // Dark bore so the muzzle reads as an opening
  const bore = new Mesh(new CircleGeometry(0.2, 12), mouthMat);
  bore.name = 'barrel_bore';
  bore.position.z = -1.285;
  bore.rotation.y = Math.PI;
  barrelGroup.add(bore);

  // Decorative brass bands
  for (let i = 0; i < 3; i++) {
    const band = new Mesh(new TorusGeometry(0.27, 0.03, 6, 16), brassMat);
    band.name = `barrel_band_${i}`;
    band.position.z = -0.3 - i * 0.35;
    band.rotation.x = Math.PI / 2;
    barrelGroup.add(band);
  }

  root.add(barrelGroup);

  // Wheels
  for (const side of [-1, 1]) {
    const wheel = new Mesh(new CylinderGeometry(0.3, 0.3, 0.1, 12), woodMat);
    wheel.name = `wheel_${side > 0 ? 'right' : 'left'}`;
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.65, -0.3, 0.1);
    wheel.castShadow = true;
    root.add(wheel);

    const hub = new Mesh(new CylinderGeometry(0.09, 0.09, 0.12, 8), brassMat);
    hub.name = `wheel_hub_${side > 0 ? 'right' : 'left'}`;
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * 0.66, -0.3, 0.1);
    root.add(hub);
  }

  // Nameplate
  const plate = new Mesh(new BoxGeometry(0.4, 0.15, 0.05), brassMat);
  plate.name = 'nameplate';
  plate.position.set(0, -0.05, 0.52);
  root.add(plate);

  return { root, barrelGroup, recoilTimer: 0, idlePhase: 0, aimYaw: 0, aimPitch: 0 };
}

// ── Main environment builder ────────────────────────────────────────────────

/**
 * Creates the full game environment and adds everything to the scene.
 * Configures the camera for the game's perspective.
 * @param scene - Scene to add environment objects to.
 * @param camera - Camera to configure for the game view.
 * @returns The environment rig for per-frame update and disposal.
 */
export function createGameEnvironment(scene: Scene, camera: PerspectiveCamera): EnvironmentRig {
  // ── Camera setup ──
  camera.fov = C.CAMERA_FOV;
  camera.near = C.CAMERA_NEAR;
  camera.far = C.CAMERA_FAR;
  camera.position.set(C.CAMERA_POS_X, C.CAMERA_POS_Y, C.CAMERA_POS_Z);
  camera.lookAt(new Vector3(C.CAMERA_LOOK_X, C.CAMERA_LOOK_Y, C.CAMERA_LOOK_Z));
  camera.updateProjectionMatrix();

  // ── Lighting ──
  //
  // The rig used to sum to a diffuse multiplier of (1.356, 1.354, 1.290) on a
  // surface facing the key light — brighter than a perfect white furnace —
  // before ACES at exposure 1.15 even ran, which is why the sky and sea both
  // clipped toward white. Key 1.0 → 0.62 and hemisphere 0.6 → 0.42 bring that to
  // (0.920, 0.928, 0.905), a 30-32% reduction that leaves the water with real
  // headroom for the foam and the golden barrel to read as bright.
  //
  // The third light — a PointLight at (0, 2.5, 1.5), intensity 0.3, infinite
  // range — was measured out. At the cannon it is 0.3/14.81 = 0.020 against a
  // total of 0.92, i.e. 2.2%; on the water at z = -8 it is 0.3/96.5 × dotNL 0.25
  // = 0.0008, under 0.1%. It cost a light slot in every shader permutation to do
  // nothing visible, so it is gone.
  const keyLight = new DirectionalLight(new Color(1.0, 0.9, 0.68), 0.62);
  keyLight.name = 'cs_keyLight';
  const keyDir = new Vector3(-0.3, -1, -0.5).normalize();
  keyLight.position.set(-keyDir.x * 15, -keyDir.y * 15, -keyDir.z * 15);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.002;
  // The shadow frustum has to cover the whole play trapezoid, which now reaches
  // x = ±11.9 at z = -12; the old ±10 box clipped shadows off the outer third of
  // the water.
  keyLight.shadow.camera.left = -16;
  keyLight.shadow.camera.right = 16;
  keyLight.shadow.camera.top = 18;
  keyLight.shadow.camera.bottom = -18;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 40;
  scene.add(keyLight);

  const fillLight = new HemisphereLight(new Color(0.6, 0.72, 0.9), new Color(0.42, 0.32, 0.22), 0.42);
  fillLight.name = 'cs_fillLight';
  scene.add(fillLight);

  // ── Sky: unlit vertical gradient plane ──
  //
  // Stops are in the plane's local y, and the plane sits at world y = 15, so
  // localY = worldY - 15. Only worldY 0 (the horizon haze, screen row 257) to
  // 14.4 (the top of the frame) is ever visible, which is localY -15 to -0.6 —
  // that is where the ramp lives. Forward-rendered through ACES at exposure
  // 1.15 this reads (189,202,212) at the horizon and (85,137,208) at the top of
  // the frame: a 104-unit ramp in red where the shipped sky managed 2.
  //
  // Segment count went 8 → 32 so the ramp is sampled every 1.44 units rather
  // than every 5.75, which is finer than the 4-unit gaps between the stops.
  const skyGeo = new PlaneGeometry(150, 46, 1, 32);
  applyVerticalGradient(skyGeo, [
    [-23, new Color(0.72, 0.86, 1.0)],
    [-15, new Color(0.6, 0.8, 1.0)],
    [-10.8, new Color(0.4, 0.68, 1.0)],
    [-7, new Color(0.22, 0.5, 1.0)],
    [-3, new Color(0.13, 0.36, 0.94)],
    [0, new Color(0.095, 0.29, 0.88)],
    [23, new Color(0.05, 0.17, 0.7)],
  ]);
  const skyMat = new MeshBasicMaterial({ vertexColors: true });
  skyMat.name = 'sky_gradient';
  const skyBase = new Mesh(skyGeo, skyMat);
  skyBase.name = 'cs_skyBase';
  skyBase.position.set(0, 15, -46);
  makeNonPickable(skyBase);
  scene.add(skyBase);

  // ── Sun: warm disc + soft glow sprite ──
  // Moved from x = -11 to x = +15 so the visible sun is on the same side of the
  // frame as the key light it is supposed to be: the key arrives from
  // (0.259, 0.864, 0.432), i.e. from the child's right. Lowered from y = 13.5 to
  // 10.0 because raising the camera dropped the horizon from screen row 290 to
  // 186 and the old sun projected to row 15, half off the top of the frame.
  const sun = new Group();
  sun.name = 'cs_sun';
  const sunDiscMat = new MeshBasicMaterial({ color: new Color(1.0, 0.9, 0.55) });
  sunDiscMat.name = 'sun_disc';
  const sunDisc = new Mesh(new CircleGeometry(2.6, 24), sunDiscMat);
  sunDisc.name = 'sun_disc_mesh';
  sun.add(sunDisc);

  // The glow used to be a `Sprite`, and that is what produced the hard-edged
  // rectangle of sky around the sun. A sprite billboards to the camera, and this
  // camera is pitched 15.7 deg down (forward (0, -0.27074, -0.96265), so
  // camera-up is (0, 0.96265, -0.27074)). The 14-unit quad therefore tipped its
  // top edge back to world z = -47.10 — *behind* the opaque sky plane at
  // z = -46 — and the sky sliced it along a line projecting to screen row 29.6.
  // A plain quad in the sun group's own XY plane is parallel to the sky, has
  // zero extent in z, and cannot intersect anything.
  const sunGlowGeo = new PlaneGeometry(14, 14);
  const sunGlowTexture = createSunGlowTexture();
  const sunGlowMat = new MeshBasicMaterial({ map: sunGlowTexture, transparent: true, depthWrite: false });
  sunGlowMat.name = 'sun_glow';
  const sunGlow = new Mesh(sunGlowGeo, sunGlowMat);
  sunGlow.name = 'cs_sun_glow';
  // Behind the disc, not in front of it. At local z = +0.3 the glow's 0.85-alpha
  // core was composited over the gold disc and washed it to (231, 227, 212) on
  // screen; the disc is meant to be the brightest, most saturated thing up
  // there. -0.25 also keeps the glow a uniform 0.25 units clear of the sky.
  sunGlow.position.z = -0.25;
  sun.add(sunGlow);
  sun.position.set(15, 10.0, -45.5);
  makeNonPickable(sun);
  scene.add(sun);

  // ── Clouds: puffy toy clusters drifting slowly ──
  // Every cluster's *bottom* is kept above y = 4.6, just clear of the eye height
  // that fixes the horizon at screen row 186. The shipped heights were tuned for
  // a camera whose horizon sat at row 290; at the new pitch the two lowest
  // clouds would have dipped below the skyline and drawn over the sea.
  const cloudMat = mat('cloud', [1, 1, 1], { emissive: [0.42, 0.42, 0.46], roughness: 1 });
  const clouds: Group[] = [];
  const cloudData = [
    { x: -18, y: 7.0, z: -42, s: 1.3 },
    { x: -3, y: 9.5, z: -43, s: 1.6 },
    { x: 9, y: 6.4, z: -41, s: 1.1 },
    { x: 20, y: 8.2, z: -42.5, s: 1.4 },
    { x: 3, y: 6.0, z: -40, s: 0.85 },
  ];
  for (let i = 0; i < cloudData.length; i++) {
    const cd = cloudData[i];
    const cloud = createPuffyCloud(`cs_cloud_${i}`, cloudMat, cd.s);
    cloud.position.set(cd.x, cd.y, cd.z);
    makeNonPickable(cloud);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ── Seagulls: the only thing in the sky that actually moves ──
  // Flown at z = -24 to -30 rather than out with the clouds at -42, because px
  // per world unit scales with 1/depth: the same 2 units/second is 57 px/s at
  // z = -26 and 36 px/s at z = -42.
  const birdMat = mat('seagull', [1, 1, 1], { emissive: [0.35, 0.35, 0.38], roughness: 0.9 });
  const birds: Group[] = [];
  const birdData = [
    { x: -6, y: 7.0, z: -26 },
    { x: 5, y: 8.4, z: -30 },
    { x: 14, y: 6.2, z: -24 },
  ];
  for (let i = 0; i < birdData.length; i++) {
    const bd = birdData[i];
    const bird = createSeagull(`cs_bird_${i}`, birdMat);
    bird.position.set(bd.x, bd.y, bd.z);
    // Odd-numbered birds fly the other way, so the sky never reads as a conveyor.
    bird.rotation.y = i % 2 === 1 ? -Math.PI / 2 : Math.PI / 2;
    makeNonPickable(bird);
    scene.add(bird);
    birds.push(bird);
  }

  // ── Ocean: vertex-gradient plane, deep near → bright aqua at the horizon ──
  //
  // Stops are in the plane's local y, which maps to depth as worldZ = -21 - y.
  // The shipped ramp was normalized 0 → 1 over a 50-unit plane and so put almost
  // no change inside the play band: the whole of z = -4.5 to -12 landed between
  // t = 0.33 and t = 0.48, about 8 sRGB units of separation. Keying on local y
  // puts 65 sRGB units of red across the same band, which is what makes a
  // barrel at z = -12 read as further away than one at z = -5.
  //
  // Forward-rendered under the new rig (albedo × (0.920, 0.928, 0.905), then
  // ACES at exposure 1.15) these give (40,115,160) at the bow, (58,133,175) at
  // the near play edge, (100,165,192) at the far play edge and (150,190,200) at
  // the ocean's far rim, against a sky of (189,202,212) just above it — a soft,
  // readable horizon rather than a seam.
  //
  // Segments went 26x40 → 26x64 so the surface samples every 0.78 units, which
  // is 7 vertices per wavelength for the fastest swell in sampleOceanHeight.
  const oceanGeo = new PlaneGeometry(130, 50, 26, 64);
  applyVerticalGradient(oceanGeo, [
    [-25, new Color(0.045, 0.19, 0.4)],
    [-18.5, new Color(0.061, 0.24, 0.475)],
    [-16.5, new Color(0.08, 0.307, 0.588)],
    [-9, new Color(0.148, 0.474, 0.765)],
    [25, new Color(0.325, 0.695, 0.871)],
  ]);
  const oceanMat = new MeshStandardMaterial({ vertexColors: true, color: new Color(1, 1, 1), metalness: 0.05, roughness: 0.5 });
  oceanMat.name = 'ocean';
  const ocean = new Mesh(oceanGeo, oceanMat);
  ocean.name = 'cs_ocean';
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0, OCEAN_CENTER_Z);
  ocean.receiveShadow = true;
  // The water is picked analytically in resolveTap (ray vs. the y = 0 plane), not
  // through the framework's mesh raycast: the displaced surface would otherwise
  // report a hit on a wave crest and pull every aim point a little short.
  makeNonPickable(ocean);
  scene.add(ocean);

  // Note on what is *not* here any more: eight translucent BoxGeometry "wave
  // bands" and four "foam strips". They were 0.015-0.02 units thick and 0.16-0.27
  // units deep, which at 24.6 screen px per unit of depth at z = -8 is a
  // hard-edged white rectangle four to seven pixels tall — the thin white line
  // artifacts in the screenshot, exactly. Water reads from its own gradient and
  // its own displaced surface now; painting stripes on top of it was covering for
  // a gradient that had no range and a swell that was a fifth of a pixel per frame.

  // ── Islands: sandy mounds with palm trees on the horizon ──
  const sandMat = mat('island_sand', [0.93, 0.82, 0.58], { roughness: 0.85 });
  const grassMat = mat('island_grass', [0.35, 0.66, 0.3], { roughness: 0.8 });
  const trunkMat = mat('palm_trunk', [0.5, 0.34, 0.18], { roughness: 0.8 });
  const canopyMat = mat('palm_canopy', [0.22, 0.58, 0.24], { roughness: 0.7 });
  const islands: Group[] = [];

  // Island 1 — left, larger, two palms
  const island1 = new Group();
  island1.name = 'cs_island_1';
  const islandBody1 = new Mesh(new SphereGeometry(1, 12, 8), sandMat);
  islandBody1.name = 'island1_sand';
  islandBody1.scale.set(5.2, 1.5, 2.4);
  island1.add(islandBody1);
  const grassCap1 = new Mesh(new SphereGeometry(1, 10, 6), grassMat);
  grassCap1.name = 'island1_grass';
  grassCap1.scale.set(3.0, 0.9, 1.5);
  grassCap1.position.set(-0.6, 0.55, 0);
  island1.add(grassCap1);
  const palm1 = createPalmTree(trunkMat, canopyMat, 2.4, 0.12);
  palm1.position.set(-1.2, 1.0, 0);
  island1.add(palm1);
  const palm2 = createPalmTree(trunkMat, canopyMat, 1.9, -0.18);
  palm2.position.set(0.8, 1.1, 0.2);
  island1.add(palm2);
  island1.position.set(-15, -0.4, -37);
  makeNonPickable(island1);
  scene.add(island1);
  islands.push(island1);

  // Island 2 — right, smaller, single palm
  const island2 = new Group();
  island2.name = 'cs_island_2';
  const islandBody2 = new Mesh(new SphereGeometry(1, 12, 8), sandMat);
  islandBody2.name = 'island2_sand';
  islandBody2.scale.set(3.4, 1.1, 1.8);
  island2.add(islandBody2);
  const palm3 = createPalmTree(trunkMat, canopyMat, 2.0, 0.15);
  palm3.position.set(0.2, 0.7, 0);
  island2.add(palm3);
  island2.position.set(14, -0.35, -39);
  makeNonPickable(island2);
  scene.add(island2);
  islands.push(island2);

  // ── Ship ──
  const ship = createShip();
  scene.add(ship);

  // ── Cannon ──
  const cannon = createCannon();
  // Scenery must never swallow a tap (see makeNonPickable): the cannon sits at
  // the bottom of the frame, right where small fingers land.
  makeNonPickable(cannon.root);
  scene.add(cannon.root);

  // ── Dispose function ──
  const allLights = [keyLight, fillLight];

  function dispose(): void {
    for (const light of allLights) light.removeFromParent();
    disposeMeshDeep(ocean);
    disposeMeshDeep(skyBase);
    disposeMeshDeep(sunDisc);
    // disposeMeshDeep covers the quad's geometry and material but never touches
    // textures, so the canvas texture still needs releasing by hand.
    disposeMeshDeep(sunGlow);
    sunGlowTexture.dispose();
    sun.removeFromParent();
    for (const c of clouds) disposeMeshDeep(c);
    for (const b of birds) disposeMeshDeep(b);
    for (const isl of islands) disposeMeshDeep(isl);
    // The seams live under the ship group now, so a deep dispose reaches them;
    // this used to need a scene-wide traverse looking for stray meshes by name.
    disposeMeshDeep(ship);
    disposeMeshDeep(cannon.root);
  }

  return {
    ocean,
    skyBase,
    sun,
    clouds,
    birds,
    islands,
    ship,
    cannon,
    dispose,
  };
}

/** How far out a bird flies before it is wrapped back to the other side. */
const BIRD_RANGE = 30;

/**
 * Updates per-frame environment animations: ocean waves, cloud drift and the
 * seagulls' flight and wingbeat.
 * @param rig - The environment rig to animate.
 * @param elapsedTime - Total elapsed game time in seconds.
 * @param dt - Frame delta time in seconds.
 */
export function updateEnvironment(rig: EnvironmentRig, elapsedTime: number, dt: number): void {
  updateOceanSurface(rig.ocean, elapsedTime);

  // Cloud drift, in units per *second*. This was multiplied by a hardcoded 1/60
  // regardless of the real frame time, so the sky crawled on a 30Hz phone and
  // raced on a 120Hz one. The speed also went 0.05 → 0.45 units/second: at 18 px
  // per unit out at z = -42, 0.05 is 0.9 px/s, which is 0.015 px per frame and
  // measures as a still image.
  for (let i = 0; i < rig.clouds.length; i++) {
    rig.clouds[i].position.x -= 0.45 * dt;
    if (rig.clouds[i].position.x < -30) {
      rig.clouds[i].position.x = 30;
    }
  }

  // Seagulls: steady flight plus a wingbeat. Speed and phase are derived from
  // the index so nothing has to be stored alongside the group.
  for (let i = 0; i < rig.birds.length; i++) {
    const bird = rig.birds[i];
    const heading = i % 2 === 1 ? 1 : -1;
    bird.position.x += heading * (1.8 + 0.4 * i) * dt;
    if (bird.position.x > BIRD_RANGE) bird.position.x = -BIRD_RANGE;
    else if (bird.position.x < -BIRD_RANGE) bird.position.x = BIRD_RANGE;
    // A gentle rise and fall along the flight path, so the birds are not on rails.
    bird.position.y += Math.cos(elapsedTime * 0.6 + i * 2.1) * 0.25 * dt;

    // children[0] is the body; [1] and [2] are the left and right wing pivots.
    const flap = 0.5 * Math.sin(elapsedTime * 4.2 + i * 2.1);
    bird.children[1].rotation.z = -flap;
    bird.children[2].rotation.z = flap;
  }
}

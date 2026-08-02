import { Box3, Vector3, type Object3D } from 'three';

/**
 * The only part of a `Mesh` this file touches.
 *
 * See the note at the traverse below: naming three's own generic `Mesh` here is
 * what made the app project's type-check hang.
 */
interface MeshLike {
  matrixWorld: { elements: ArrayLike<number> };
  geometry?: {
    index?: { count: number; getX(i: number): number } | null;
    attributes?: { position?: { count: number; itemSize: number; array: ArrayLike<number> } };
  };
}
import type { OwlFlightBounds } from '@app/entities/owl/types';

/**
 * Where the owl is allowed to come down, and why it needs to be told.
 *
 * THE DEFECT THIS EXISTS TO FIX
 * -----------------------------
 * A tap flies the owl to `hit.point`, the raycast intersection. The raycaster
 * only tests REGISTERED targets, and the only things registered for this path
 * are the floor meshes — deliberately, and with a long argument behind it in
 * `wireFloorTap`. So the ray passes clean through the fridge, the stove, the
 * dresser, a toybox, a log, and lands on the floor UNDERNEATH them. The owl then
 * flew to that floor point, which put it inside the prop the child had just
 * tapped on. From the outside it read as the owl vanishing into the furniture.
 *
 * `clampFlightTarget` already carried a comment claiming the owl "perches on a
 * toybox/table/log instead of sinking to floor level inside it". That claim was
 * true only when the CALLER supplied a surface height — which exactly one caller
 * did (`wireToyboxInteractions`, using its own `Box3`). Every floor tap supplied
 * y ≈ 0. The comment described a contract nothing enforced.
 *
 * THE RULE IS "DO NOT INTERSECT", NOT "STAND ON THE TALLEST THING HERE"
 * ---------------------------------------------------------------------
 * The first version of this module got that backwards, and Nature is where it
 * showed. It raised the owl to the top of any prop whose footprint contained the
 * landing point. Nature has five trees with roughly 5 x 5 unit footprints and
 * crowns at y 5.6 to 6.5, so a tap on open GRASS anywhere beneath a canopy sent
 * the owl to treetop height — where the flight ceiling at maxY 5.0 caught it and
 * left it hanging in the air with nothing under its feet. Measured over an 81 x
 * 81 sweep of the scene: 18.5% of the ground raised the owl at all and 13.9% of
 * it parked the owl at exactly the ceiling.
 *
 * A bird standing on the grass under a tree is not inside the tree. The question
 * is not "what is the tallest thing whose shadow I am in", it is "is anything
 * occupying the volume my body needs". So {@link standingYAt} lifts the owl only
 * while something actually overlaps the space it would fill, and stops as soon
 * as nothing does.
 *
 * AND IT HAS TO BE THE REAL GEOMETRY, WHICH IS THE OTHER HALF OF THE MISTAKE
 * --------------------------------------------------------------------------
 * A tree's ROOT box runs from the foot of its trunk to the top of its crown over
 * the whole spread of its leaves, so at root level a tree and a solid block are
 * the same object. Dropping to per-MESH boxes fixed the tree and broke on the
 * ship: Pirate Cove's rails are single long bars following the curve of the
 * hull, and the box around one covers half the deck, so every owl aboard was
 * inside a rail and the resolver could find nowhere to put it.
 *
 * Boxes say "somewhere in here" and the question is "here". {@link PerchField}
 * stamps the actual triangles into a 25 cm grid and records the spans genuinely
 * occupied above each cell. Roots are still CLASSIFIED as wholes, because that
 * is the unit a person names; only the measurement is fine-grained.
 *
 * WHY A CLASSIFIER AND NOT A LIST OF PERCHES
 * -------------------------------------------
 * A hand-authored perch list per room is the obvious fix and it is the wrong
 * one: it would be a second copy of where the furniture is, kept in a different
 * file from the code that builds it, and this repo has a test suite
 * (`tests/room/layout-exports-have-readers.test.mjs`) that exists because that
 * exact pattern rotted twice — a rug centre that was not the rug's, a book stack
 * that does not exist. Anything measured off the built scene cannot disagree
 * with the built scene.
 *
 * WHAT COUNTS AS SOMETHING TO STAND ON
 * ------------------------------------
 * Three rules, applied to each top-level ROOT's world `Box3`. No name lists. The
 * root is the unit of classification because it is the unit a person names and
 * reasons about; the parts inside it are the unit of measurement.
 *
 *   1. It is SUPPORTED — its underside rests on the floor, or on something else
 *      already known to be a surface. This is what separates furniture from the
 *      wall clock, the hanging mobile, the curtains and the pot rail: those hang
 *      with nothing beneath them, so the owl standing at floor level under one is
 *      correct, not a bug.
 *
 *      Support is RESOLVED ITERATIVELY, and that is not over-engineering — it is
 *      what the Playroom actually contains. Raggedy Ann and Andy sit on the
 *      creative toybox with their undersides at y 0.73 against a box top of 1.04,
 *      which a "touches the floor" rule rejects, and rejecting them puts the owl
 *      on the floor beside the box with its head inside a doll.
 *   2. It is taller than `MIN_SOLID_HEIGHT`. This separates furniture from floor
 *      dressing: the Kitchen's rug is 0.05 tall and its sun patch is 0.00, and an
 *      owl standing on a rug IS standing on the floor.
 *   3. Its footprint overlaps the owl's flight bounds. This removes the room
 *      shell for free — the ceiling fails rule 1, the floor plane fails rule 2,
 *      and the walls stand outside the bounds by the inset every room authors. No
 *      module here needs to know the word "wall".
 */

/**
 * How far above the floor a prop's underside may start and still count as
 * standing on it.
 *
 * Generous on purpose: props are authored with plinths, feet and slight lifts.
 * Nothing legitimate hangs between 0 and 0.35 — the lowest wall-mounted thing in
 * any room is the Kitchen peg rail's cloths at y 1.95.
 */
export const FLOOR_CONTACT_Y = 0.35;

/**
 * How far above a supporting SURFACE a prop's underside may start and still
 * count as resting on it.
 *
 * Tighter than {@link FLOOR_CONTACT_Y}. The floor gets a generous tolerance
 * because props are authored with plinths and feet; a thing stacked on another
 * thing is either touching it or hanging over it. Measured case: the Kitchen's
 * peg rail begins 0.28 above the left-wall base units' counter, and at the
 * floor's tolerance it would have been promoted to a perch — an owl landing on a
 * rail of tea towels — while the counter beneath it became unreachable.
 */
export const STACK_CONTACT_Y = 0.12;

/**
 * Minimum height for a floor-standing ROOT to be a surface rather than dressing.
 *
 * Set from the two things it must exclude and the shortest thing it must keep:
 * the Kitchen's rug is 0.05 tall and its rug bands 0.04; the shortest real
 * furniture in any room is well over 1.0. 0.12 sits in a gap an order of
 * magnitude wide, so it is not a tuned number.
 *
 * Applied to the ROOT, never to a part. A bookshelf's planks are 0.06 thick and
 * things rest on them; it is the bookshelf that has to be furniture, not each
 * board.
 */
export const MIN_SOLID_HEIGHT = 0.12;

/** A floor-standing prop the owl must land on rather than in. */
export interface PerchSolid {
  /** The prop root's name, for diagnostics and for the pinned inventory. */
  name: string;
  /** The root's own footprint and extent — the inventory's view of it. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  topY: number;
}

/** Why a root was not treated as a perch surface. Used by the inventory test. */
export type PerchRejection = 'empty' | 'airborne' | 'flat' | 'out-of-bounds';

/** One root's classification, kept so the inventory can be read and pinned. */
export interface PerchClassification {
  name: string;
  solid: PerchSolid | null;
  rejection: PerchRejection | null;
  minY: number;
  height: number;
}

/**
 * Classifies every top-level root in a scene as a perch surface or not.
 *
 * Returns the rejections as well as the surfaces, because "which props did the
 * owl's surface map decide to ignore, and on what grounds" is the question worth
 * being able to answer, and a function that returns only the survivors cannot
 * answer it. `tests/room/owl-perch-surfaces.test.mjs` pins the whole table.
 *
 * @param roots - The scene's top-level children.
 * @param bounds - The owl's flight bounds, used by rule 3.
 * @returns One entry per root, in scene order.
 */
export function classifyPerchRoots(roots: readonly Object3D[], bounds: OwlFlightBounds): PerchClassification[] {
  // Measure every root once. `Box3.setFromObject` walks the subtree, so doing
  // this inside the promotion loop below would re-walk the whole scene per pass.
  const measured = roots.map((root) => {
    root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(root);
    return { root, name: root.name || root.type, box, empty: box.isEmpty() || !Number.isFinite(box.min.y) };
  });

  const solids: PerchSolid[] = [];
  const state = measured.map((entry) => {
    if (entry.empty) return { ...entry, rejection: 'empty' as PerchRejection, minY: NaN, height: NaN, solid: null };
    const height = entry.box.max.y - entry.box.min.y;
    const base = { ...entry, minY: entry.box.min.y, height, solid: null as PerchSolid | null, rejection: null as PerchRejection | null };
    // Rule 2 — is it a surface, or is it floor dressing?
    if (height < MIN_SOLID_HEIGHT) return { ...base, rejection: 'flat' as PerchRejection };
    // Rule 3 — can the owl reach it at all?
    if (entry.box.max.x < bounds.minX || entry.box.min.x > bounds.maxX || entry.box.max.z < bounds.minZ || entry.box.min.z > bounds.maxZ) {
      return { ...base, rejection: 'out-of-bounds' as PerchRejection };
    }
    return base;
  });

  const promote = (entry: (typeof state)[number]): void => {
    const { box } = entry;
    entry.solid = {
      name: entry.name,
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z,
      minY: box.min.y,
      topY: box.max.y,
    };
    solids.push(entry.solid);
  };

  // Rule 1, as a fixed point. Pass one takes everything resting on the floor;
  // each pass after it takes whatever is now resting on something promoted in
  // the pass before — dolls on a toybox, a drum in a basket. It terminates
  // because every pass either promotes at least one root or stops, and there are
  // finitely many roots.
  const candidates = state.filter((entry) => entry.rejection === null);
  for (const entry of candidates) {
    if (entry.box.min.y <= FLOOR_CONTACT_Y) promote(entry);
  }
  let promoted = true;
  while (promoted) {
    promoted = false;
    for (const entry of candidates) {
      if (entry.solid) continue;
      const { box } = entry;
      // Sampled at the footprint centre: a prop rests on whatever is under its
      // middle, not under a corner that may overhang.
      const support = supportYAt((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2, solids);
      // SUPPORTED means "not floating above", which is looser than "touching",
      // and the looser test is the correct one: Raggedy Ann and Andy lean INTO
      // the creative toybox, sunk 0.3 below the rim of the thing holding them up.
      if (support > 0 && box.min.y <= support + STACK_CONTACT_Y) {
        promote(entry);
        promoted = true;
      }
    }
  }
  for (const entry of candidates) {
    if (!entry.solid) entry.rejection = 'airborne';
  }

  return state.map((entry) => ({ name: entry.name, solid: entry.solid, rejection: entry.rejection, minY: entry.minY, height: entry.height }));
}

/**
 * The top of the tallest SOLID standing at `(x, z)`, used only when deciding
 * whether one prop is resting on another.
 *
 * Root-level on purpose, and not the same question as {@link standingYAt}. "Is
 * this doll being held up by something" is about the prop as a whole; "may the
 * owl stand here" is about the volume its body needs.
 *
 * @param x - World X.
 * @param z - World Z.
 * @param solids - Perch surfaces resolved so far.
 * @returns World Y of the highest supporting top, or 0 for bare floor.
 */
function supportYAt(x: number, z: number, solids: readonly PerchSolid[]): number {
  let top = 0;
  for (const solid of solids) {
    if (x < solid.minX || x > solid.maxX || z < solid.minZ || z > solid.maxZ) continue;
    if (solid.topY > top) top = solid.topY;
  }
  return top;
}

/** Size of one height-field cell, in world units. */
const CELL = 0.25;

/**
 * A vertical span of solid matter in one cell: `[bottom, top]`.
 */
export type PerchSpan = [number, number];

/**
 * A coarse height field over a scene's solid geometry.
 *
 * WHY NOT BOUNDING BOXES, WHICH IS THE THIRD TIME THIS MODULE HAS LEARNT IT
 * -------------------------------------------------------------------------
 * A box around a prop is a fine model of a fridge and a terrible model of
 * everything else, and each attempt to patch it moved the failure one level
 * down rather than fixing it:
 *
 *   per PROP  — a tree's box runs from the foot of its trunk to the top of its
 *               crown across the whole spread of its leaves, so standing on the
 *               grass beneath one read as standing inside it. That put the owl at
 *               treetop height over 13.9% of Nature, where the flight ceiling
 *               caught it and left it hanging.
 *   per MESH  — better, but Pirate Cove's rails are single long bars following
 *               the curve of the hull, and the box around one covers HALF THE
 *               DECK. Every owl on that deck was inside a rail, and the resolver
 *               could find nowhere on the ship to put it.
 *
 * The common cause is that a box says "somewhere in here" and the question is
 * "here". So this stamps the real triangles into a grid: each cell records the
 * vertical spans actually occupied above it. A rail stamps the cells it runs
 * through and no others; a canopy stamps its own cells from y 2.5 up, leaving
 * the ground beneath free.
 *
 * The grid is coarse (25 cm) and each triangle stamps every cell its footprint
 * touches, so the model is a slight OVER-estimate of solidity. That is the safe
 * direction: it can push the owl somewhere it did not strictly need to move, and
 * it cannot let it stand inside something.
 */
export interface PerchField {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  /** Merged, ascending spans per cell. Empty cells hold `null`. */
  cells: Array<PerchSpan[] | null>;
  /** How many cells hold anything. Diagnostics and a cheap emptiness check. */
  occupied: number;
}

/**
 * Does a triangle's XZ projection actually touch this cell, or does it merely
 * pass through the cell's neighbourhood?
 *
 * THE THIRD TIME A BOUNDING BOX HAS LIED IN THIS FILE, and the smallest scale it
 * has done it at. Pirate Cove's railing planks run the length of the hull at an
 * angle, so each of their eight triangles is a long diagonal sliver — and the
 * axis-aligned box around a diagonal sliver is a square 85 units across. Stamped
 * by bounding box, one plank at y 0.89 covered the entire mid-deck, and since
 * that is 0.21 below a standing owl's head the resolver concluded there was
 * nowhere on the ship a bird could stand.
 *
 * Separating-axis test over the three edge normals plus the two box axes. Exact
 * for convex shapes, and a triangle and a square are both convex.
 *
 * @param ax - First vertex X.
 * @param az - First vertex Z.
 * @param bx - Second vertex X.
 * @param bz - Second vertex Z.
 * @param cx - Third vertex X.
 * @param cz - Third vertex Z.
 * @param x0 - Cell's low X edge.
 * @param x1 - Cell's high X edge.
 * @param z0 - Cell's low Z edge.
 * @param z1 - Cell's high Z edge.
 * @returns True when the two overlap.
 */
function triangleTouchesCell(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, x0: number, x1: number, z0: number, z1: number): boolean {
  if (Math.min(ax, bx, cx) > x1 || Math.max(ax, bx, cx) < x0) return false;
  if (Math.min(az, bz, cz) > z1 || Math.max(az, bz, cz) < z0) return false;

  const px = [ax, bx, cx];
  const pz = [az, bz, cz];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    // Normal to this edge, in the XZ plane.
    const nx = pz[j] - pz[i];
    const nz = -(px[j] - px[i]);
    if (nx === 0 && nz === 0) continue;

    let triMin = Infinity;
    let triMax = -Infinity;
    for (let k = 0; k < 3; k++) {
      const d = nx * px[k] + nz * pz[k];
      if (d < triMin) triMin = d;
      if (d > triMax) triMax = d;
    }

    const d00 = nx * x0 + nz * z0;
    const d10 = nx * x1 + nz * z0;
    const d01 = nx * x0 + nz * z1;
    const d11 = nx * x1 + nz * z1;
    const boxMin = Math.min(d00, d10, d01, d11);
    const boxMax = Math.max(d00, d10, d01, d11);

    if (triMax < boxMin || boxMax < triMin) return false;
  }
  return true;
}

/**
 * Index of the cell containing `(x, z)`, or -1 when outside the field.
 *
 * @param field - The height field.
 * @param x - World X.
 * @param z - World Z.
 * @returns Flat cell index, or -1.
 */
function cellIndex(field: PerchField, x: number, z: number): number {
  const col = Math.floor((x - field.minX) / CELL);
  const row = Math.floor((z - field.minZ) / CELL);
  if (col < 0 || col >= field.cols || row < 0 || row >= field.rows) return -1;
  return row * field.cols + col;
}

/**
 * Stamps every triangle of every perch surface into a height field.
 *
 * ONLY THE `solid` ROOTS ARE STAMPED, and the two rejected categories are both
 * rejected for cause. `flat` roots are floor dressing — an owl on the Living
 * Room rug is an owl on the floor, and a rolling pin lying on the Kitchen tiles
 * is not a wall. `airborne` roots have nothing beneath them, and one of them is
 * the Playroom's `sunRay` shafts: stamping those made LIGHT solid and flew the
 * owl five metres up into a sunbeam. Geometry cannot tell you what is matter;
 * the classification can.
 *
 * @param roots - The scene's top-level children.
 * @param bounds - The owl's flight bounds; the field covers exactly this area.
 * @returns The field {@link standingYAt} reads.
 */
export function buildPerchField(roots: readonly Object3D[], bounds: OwlFlightBounds): PerchField {
  const solidRoots = new Set<Object3D>();
  const classified = classifyPerchRoots(roots, bounds);
  for (let i = 0; i < roots.length; i++) {
    if (classified[i]?.solid) solidRoots.add(roots[i]);
  }
  // One cell of padding so a prop straddling the edge is not clipped mid-stamp.
  const minX = bounds.minX - CELL;
  const minZ = bounds.minZ - CELL;
  const cols = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 2;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / CELL) + 2;
  const raw: Array<PerchSpan[] | null> = new Array(cols * rows).fill(null);
  const field: PerchField = { minX, minZ, cols, rows, cells: raw, occupied: 0 };

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();

  // PER MESH, PER CELL, AND THE "PER MESH" IS LOAD-BEARING.
  //
  // Triangles describe SURFACES, so a closed box stamped triangle by triangle is
  // hollow: over the middle of a fridge the only triangles are the top face and
  // the bottom face, and between them the cell reads as empty air. The first
  // version of this field did exactly that and walked the owl in through the
  // fridge's lid.
  //
  // Taking one mesh's MIN and MAX within a cell brackets its interior and closes
  // the box. It stays per-mesh rather than per-cell-overall so that two separate
  // things above the same 25 cm of floor — a stone at ankle height and a branch
  // four metres up — remain two spans with usable air between them, which is the
  // whole reason a bird can stand under a tree.
  const perMesh = new Map<number, PerchSpan>();

  const stampTriangle = (): void => {
    const x0 = Math.min(a.x, b.x, c.x);
    const x1 = Math.max(a.x, b.x, c.x);
    const z0 = Math.min(a.z, b.z, c.z);
    const z1 = Math.max(a.z, b.z, c.z);
    const y0 = Math.min(a.y, b.y, c.y);
    const y1 = Math.max(a.y, b.y, c.y);

    const colFrom = Math.max(0, Math.floor((x0 - minX) / CELL));
    const colTo = Math.min(cols - 1, Math.floor((x1 - minX) / CELL));
    const rowFrom = Math.max(0, Math.floor((z0 - minZ) / CELL));
    const rowTo = Math.min(rows - 1, Math.floor((z1 - minZ) / CELL));

    // Most triangles in this repo's procedural props are smaller than a cell, so
    // their bounding box IS the answer and the separating-axis test below would
    // only confirm it.
    const single = colFrom === colTo && rowFrom === rowTo;

    for (let row = rowFrom; row <= rowTo; row++) {
      const cz0 = minZ + row * CELL;
      for (let col = colFrom; col <= colTo; col++) {
        const cx0 = minX + col * CELL;
        // The bbox told us which cells to CONSIDER; this decides which of them
        // the triangle is genuinely over. See `triangleTouchesCell`.
        if (!single && !triangleTouchesCell(a.x, a.z, b.x, b.z, c.x, c.z, cx0, cx0 + CELL, cz0, cz0 + CELL)) continue;
        const index = row * cols + col;
        const span = perMesh.get(index);
        if (span) {
          if (y0 < span[0]) span[0] = y0;
          if (y1 > span[1]) span[1] = y1;
        } else {
          perMesh.set(index, [y0, y1]);
        }
      }
    }
  };

  const flushMesh = (): void => {
    for (const [index, span] of perMesh) {
      const list = raw[index];
      if (list) list.push(span);
      else raw[index] = [span];
    }
    perMesh.clear();
  };

  for (const root of roots) {
    if (!solidRoots.has(root)) continue;
    root.traverse((node) => {
      // Structural, not `node as Mesh`. Three's `Mesh` is generic over its
      // geometry, material and event map, and asserting an `Object3D` into it
      // made `tsc -p tsconfig.app.json` stop terminating — it type-checked in
      // ten seconds before this line and had not finished after forty-five
      // after it. Nothing here needs a Mesh; it needs a matrix and a buffer.
      const mesh = node as unknown as MeshLike;
      const geometry = mesh.geometry;
      const position = geometry?.attributes?.position;
      if (!geometry || !position) return;

      // World-transform once per mesh into ONE flat array. The readable version
      // of this allocated a `Vector3` per vertex and cost 350 ms to build
      // Nature — which, since the field is built on the first tap, is a third of
      // a second of frozen screen the first time a child touches the floor.
      const vertexCount = position.count;
      if (position.itemSize !== 3) return;
      const source = position.array;
      const world = new Float64Array(vertexCount * 3);
      const m = mesh.matrixWorld.elements;
      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3;
        // Read the buffer directly. `getX/getY/getZ` are three method calls per
        // vertex across a couple of hundred thousand vertices, and this runs
        // while a child is waiting for the owl to move.
        const vx = source[o];
        const vy = source[o + 1];
        const vz = source[o + 2];
        const w = 1 / (m[3] * vx + m[7] * vy + m[11] * vz + m[15] || 1);
        world[i * 3] = (m[0] * vx + m[4] * vy + m[8] * vz + m[12]) * w;
        world[i * 3 + 1] = (m[1] * vx + m[5] * vy + m[9] * vz + m[13]) * w;
        world[i * 3 + 2] = (m[2] * vx + m[6] * vy + m[10] * vz + m[14]) * w;
      }

      const index = geometry.index;
      const count = index ? index.count : vertexCount;
      for (let i = 0; i + 2 < count; i += 3) {
        const i0 = (index ? index.getX(i) : i) * 3;
        const i1 = (index ? index.getX(i + 1) : i + 1) * 3;
        const i2 = (index ? index.getX(i + 2) : i + 2) * 3;
        a.set(world[i0], world[i0 + 1], world[i0 + 2]);
        b.set(world[i1], world[i1 + 1], world[i1 + 2]);
        c.set(world[i2], world[i2 + 1], world[i2 + 2]);
        stampTriangle();
      }
      flushMesh();
    });
  }

  // Merge each cell's spans so lookups walk a short ascending list rather than
  // every triangle that happened to land there.
  for (let i = 0; i < raw.length; i++) {
    const list = raw[i];
    if (!list) continue;
    list.sort((p, q) => p[0] - q[0]);
    const merged: PerchSpan[] = [list[0]];
    for (let j = 1; j < list.length; j++) {
      const last = merged[merged.length - 1];
      if (list[j][0] <= last[1] + 1e-6) last[1] = Math.max(last[1], list[j][1]);
      else merged.push(list[j]);
    }
    raw[i] = merged;
    field.occupied += 1;
  }

  return field;
}

/**
 * The solid spans above `(x, z)`, or null where nothing is.
 *
 * Exported for measurement rather than for the runtime. `standingYAt` answers
 * "where can the owl stand", and a test that only ever asks that cannot tell a
 * bird standing ON something from a bird standing on nothing — both come back as
 * a height. `tests/room/owl-perch-surfaces.test.mjs` needs the spans themselves
 * to assert that the owl's feet are on top of one.
 *
 * @param field - Height field from {@link buildPerchField}.
 * @param x - World X.
 * @param z - World Z.
 * @returns Merged ascending spans, or null.
 */
export function spansAt(field: PerchField, x: number, z: number): PerchSpan[] | null {
  const index = cellIndex(field, x, z);
  return index < 0 ? null : field.cells[index];
}

/**
 * The height the owl's feet should meet at `(x, z)`, given where the tap landed.
 *
 * Lifts the owl only while something is actually in the way. Standing under a
 * canopy is not standing inside a tree, and the version of this that lifted to
 * the top of any containing box put the owl in mid-air over 13.9% of Nature.
 *
 * The loop terminates because every iteration raises `y` strictly, to the top of
 * some span in a fixed list, and the list is finite. The guard is a backstop.
 *
 * @param x - World X the owl will occupy.
 * @param z - World Z the owl will occupy.
 * @param floorY - Height the tap resolved to, usually the floor at 0.
 * @param bodyHeight - How tall the owl is above its feet.
 * @param field - Height field from {@link buildPerchField}.
 * @returns World Y for the owl's feet.
 */
export function standingYAt(x: number, z: number, floorY: number, bodyHeight: number, field: PerchField): number {
  const index = cellIndex(field, x, z);
  if (index < 0) return floorY;
  const spans = field.cells[index];
  if (!spans) return floorY;

  let y = floorY;
  for (let guard = 0; guard <= spans.length; guard++) {
    let lift: number | null = null;
    for (const [bottom, top] of spans) {
      // Already at or above this span's top: standing ON it, which is the goal.
      if (top <= y + 1e-6) continue;
      // Starts above the owl's head: overhead, not in the way. THIS is the line
      // that lets a bird stand on the grass beneath a tree.
      if (bottom >= y + bodyHeight - 1e-6) continue;
      if (lift === null || top > lift) lift = top;
    }
    if (lift === null) return y;
    y = lift;
  }
  return y;
}

/**
 * Rings of offsets used when a landing spot is blocked and cannot be climbed.
 *
 * Eight compass directions at widening radii, in a fixed order so the choice is
 * deterministic — a bird that picked a random side of the tree each time would
 * look broken in a different way. 2.0 units is a little over the widest thing it
 * has to step around (a ship's rail post and a tree trunk are both under 0.5),
 * and stopping there keeps the owl near where the child pointed.
 */
const NUDGE_RINGS = [0.3, 0.6, 0.9, 1.3, 1.7, 2.1];
const NUDGE_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [0.707, 0.707],
  [-0.707, 0.707],
  [-0.707, -0.707],
  [0.707, -0.707],
];

/**
 * The one place the owl's landing position is decided.
 *
 * ORDER MATTERS AND IT USED TO BE WRONG. The previous version set `y` from the
 * tapped point and THEN clamped `x` and `z` into the flight bounds, so a tap
 * near a wall was slid sideways while keeping the height of a surface it was no
 * longer above. Here the horizontal clamp happens first and the surface is
 * resolved at the position the owl will actually occupy.
 *
 * `Math.max` against the tapped point's own height is what keeps the toybox path
 * working: `wireToyboxInteractions` measures the lid itself and passes that
 * height in, and a caller who has better information than the footprint map
 * should not be overruled by it.
 *
 * IF IT CANNOT GO UP, IT STEPS ASIDE. Some spots have no clear height at all: the
 * foot of a tree trunk, where clearing the trunk only puts the owl in the canopy,
 * and the foot of a ship's rail post under the mainsail. The resolved perch is
 * then above `bounds.maxY` and there are three things to do about it, two of them
 * bad. Clamping to the ceiling leaves the owl hanging in mid-air on nothing —
 * that IS the bug this rewrite exists to fix, and it is what a child sees as the
 * owl getting stuck. Dropping back to the tapped point leaves it standing inside
 * the trunk. So it takes the nearest spot it CAN stand on instead, which is what
 * a bird landing next to a tree does anyway.
 *
 * @param target - Requested landing point, usually a raycast hit.
 * @param perchOffset - The owl's resting centre height above the surface it stands on.
 * @param bodyHeight - How tall the owl is above its feet.
 * @param bounds - Optional flight bounds.
 * @param standAt - Optional surface lookup; without one this behaves as it always did.
 * @returns The position the owl should land at.
 */
export function resolvePerchTarget(
  target: Vector3,
  perchOffset: number,
  bodyHeight: number,
  bounds?: OwlFlightBounds,
  standAt?: (x: number, z: number, floorY: number, bodyHeight: number) => number,
): Vector3 {
  const landed = target.clone();

  if (bounds) {
    landed.x = Math.min(Math.max(landed.x, bounds.minX), bounds.maxX);
    landed.z = Math.min(Math.max(landed.z, bounds.minZ), bounds.maxZ);
  }

  if (!standAt) {
    landed.y = target.y + perchOffset;
    if (bounds) landed.y = Math.min(Math.max(landed.y, bounds.minY), bounds.maxY);
    return landed;
  }

  const settle = (x: number, z: number): number => Math.max(target.y, standAt(x, z, target.y, bodyHeight)) + perchOffset;
  const reachable = (y: number): boolean => !bounds || y <= bounds.maxY + 1e-6;

  let y = settle(landed.x, landed.z);

  if (!reachable(y)) {
    let found = false;
    for (const radius of NUDGE_RINGS) {
      for (const [dx, dz] of NUDGE_DIRECTIONS) {
        let x = landed.x + dx * radius;
        let z = landed.z + dz * radius;
        if (bounds) {
          x = Math.min(Math.max(x, bounds.minX), bounds.maxX);
          z = Math.min(Math.max(z, bounds.minZ), bounds.maxZ);
        }
        const candidate = settle(x, z);
        if (!reachable(candidate)) continue;
        landed.x = x;
        landed.z = z;
        y = candidate;
        found = true;
        break;
      }
      if (found) break;
    }
    // Nowhere within reach was clear. Down beats hovering; see the docblock.
    if (!found) y = target.y + perchOffset;
  }

  landed.y = bounds ? Math.min(Math.max(y, bounds.minY), bounds.maxY) : y;
  return landed;
}

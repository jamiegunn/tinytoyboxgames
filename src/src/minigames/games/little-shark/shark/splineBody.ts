import { Scene, Group, Mesh, SphereGeometry, MeshStandardMaterial, Color, type Object3D, type BufferGeometry, type Material } from 'three';

// ── Types ───────────────────────────────────────────────────────────

/** A single segment of the spline backbone chain. */
interface SplineSegment {
  mesh: Object3D;
  posX: number;
  posZ: number;
  rotY: number;
  velX: number;
  velZ: number;
}

/** Mutable state for the spline body system. */
export interface SplineBodyState {
  segments: SplineSegment[];
  headPosX: number;
  headPosZ: number;
  headRotY: number;
}

// ── Constants ───────────────────────────────────────────────────────

/** Gap between each segment along the body chain. */
const SEGMENT_GAP = 0.5;

/** Spring stiffness for segment follow (snappy). */
const STIFFNESS = 12.0;

/** Critical damping coefficient derived from stiffness. */
const DAMPING = 2.0 * Math.sqrt(STIFFNESS);

/** Cheerful blue-grey shark color. */
const SHARK_COLOR = new Color(0.45, 0.55, 0.65);

// ── Helpers ─────────────────────────────────────────────────────────

// Creates the shared shark skin material.
function createSharkMaterial(name: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color: SHARK_COLOR.clone(),
    metalness: 0,
    roughness: 0.55,
    emissive: SHARK_COLOR.clone().multiplyScalar(0.04),
  });
}

// Creates a segment group with a sphere mesh at the given scale.
function createSegmentGroup(scene: Scene, name: string, scaleX: number, scaleY: number, scaleZ: number, posZ: number): { group: Group; mesh: Mesh } {
  const geometry = new SphereGeometry(1, 16, 12);
  const material = createSharkMaterial(`spline_${name}_mat`);
  const mesh = new Mesh(geometry, material);
  mesh.name = `spline_${name}_mesh`;
  mesh.scale.set(scaleX, scaleY, scaleZ);

  const group = new Group();
  group.name = `spline_${name}`;
  group.position.set(0, 0, posZ);
  group.add(mesh);
  scene.add(group);

  return { group, mesh };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Creates a 5-segment spline body chain for the shark.
 *
 * Segments are spaced along the Z axis with 0.5 unit gaps:
 *   0 (nose) -> 1 (head) -> 2 (body) -> 3 (tail-base) -> 4 (tail-fin)
 *
 * Each segment is a Group containing a scaled sphere mesh with a cheerful
 * blue-grey shark skin material.
 *
 * @param scene - The Three.js scene to add segment meshes to.
 * @returns A fresh SplineBodyState with all segments initialized.
 */
export function createSplineBody(scene: Scene): SplineBodyState {
  const segmentDefs: { name: string; sx: number; sy: number; sz: number }[] = [
    { name: 'nose', sx: 0.3, sy: 0.3, sz: 0.3 },
    { name: 'head', sx: 0.5, sy: 0.5, sz: 0.5 },
    { name: 'body', sx: 0.7, sy: 0.5, sz: 0.9 },
    { name: 'tail_base', sx: 0.4, sy: 0.4, sz: 0.4 },
    { name: 'tail_fin', sx: 0.3, sy: 0.1, sz: 0.5 },
  ];

  const segments: SplineSegment[] = segmentDefs.map((def, i) => {
    const posZ = -i * SEGMENT_GAP;
    const { group } = createSegmentGroup(scene, def.name, def.sx, def.sy, def.sz, posZ);

    return {
      mesh: group,
      posX: 0,
      posZ,
      rotY: 0,
      velX: 0,
      velZ: 0,
    };
  });

  return {
    segments,
    headPosX: 0,
    headPosZ: 0,
    headRotY: 0,
  };
}

/**
 * Advances the spline body simulation by one frame.
 *
 * Segment 0 (nose) snaps directly to the head position. Each subsequent
 * segment follows the one ahead of it using a critically-damped spring,
 * targeting a point 0.5 units behind the previous segment in the direction
 * it faces. This produces a natural trailing undulation when the head turns.
 *
 * @param state - The spline body state to update in place.
 * @param headPosX - Current head X position.
 * @param headPosZ - Current head Z position.
 * @param headRotY - Current head rotation around Y (radians).
 * @param dt - Frame delta time in seconds.
 */
export function updateSplineBody(state: SplineBodyState, headPosX: number, headPosZ: number, headRotY: number, dt: number): void {
  state.headPosX = headPosX;
  state.headPosZ = headPosZ;
  state.headRotY = headRotY;

  const segs = state.segments;

  // Segment 0 (nose) tracks the head directly
  segs[0].posX = headPosX;
  segs[0].posZ = headPosZ;
  segs[0].rotY = headRotY;
  segs[0].velX = 0;
  segs[0].velZ = 0;
  segs[0].mesh.position.x = headPosX;
  segs[0].mesh.position.z = headPosZ;
  segs[0].mesh.rotation.y = headRotY;

  // Each subsequent segment follows the previous via critically-damped spring
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1];
    const seg = segs[i];

    // Target point: 0.5 units behind the previous segment, in the direction it faces
    const targetX = prev.posX - Math.cos(prev.rotY) * SEGMENT_GAP;
    const targetZ = prev.posZ - Math.sin(prev.rotY) * SEGMENT_GAP;

    // Critically-damped spring acceleration
    const dx = targetX - seg.posX;
    const dz = targetZ - seg.posZ;
    const ax = STIFFNESS * dx - DAMPING * seg.velX;
    const az = STIFFNESS * dz - DAMPING * seg.velZ;

    seg.velX += ax * dt;
    seg.velZ += az * dt;
    seg.posX += seg.velX * dt;
    seg.posZ += seg.velZ * dt;

    // Face toward the segment ahead
    const lookDx = prev.posX - seg.posX;
    const lookDz = prev.posZ - seg.posZ;
    if (Math.abs(lookDx) > 0.001 || Math.abs(lookDz) > 0.001) {
      seg.rotY = Math.atan2(lookDz, lookDx);
    }

    // Apply to mesh
    seg.mesh.position.x = seg.posX;
    seg.mesh.position.z = seg.posZ;
    seg.mesh.rotation.y = seg.rotY;
  }
}

/**
 * Disposes all segment meshes, geometries, and materials in the spline body.
 *
 * Removes each segment group from its parent scene and releases GPU resources.
 *
 * @param state - The spline body state to dispose.
 */
export function disposeSplineBody(state: SplineBodyState): void {
  for (const seg of state.segments) {
    const group = seg.mesh as Group;

    // Dispose children (the actual meshes)
    group.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        (mesh.geometry as BufferGeometry).dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          for (const m of mat) (m as Material).dispose();
        } else {
          (mat as Material).dispose();
        }
      }
    });

    // Remove from scene
    if (group.parent) {
      group.parent.remove(group);
    }
  }

  state.segments.length = 0;
}

/**
 * Headless render harness for the Pirate Cove deck.
 *
 * Round 4 produced three geometric proxies for "does a clipped prop read" and
 * they disagreed with each other. A proxy that cannot be checked against the
 * thing it proxies is not evidence, so this page renders the REAL scene through
 * the REAL renderer at whatever viewport Playwright gives it, and the argument
 * gets settled by looking.
 *
 * It drives the scene exactly as `SceneFrame` does -- same renderer factory,
 * same camera handle, same resize call -- so nothing here is a second version
 * of the app's own setup.
 */
import { Box3, Object3D, Raycaster, Scene, Sphere, Spherical, Vector2, Vector3 } from 'three';
import { createConfiguredRenderer, applyDefaultEnvironment } from '@app/utils/rendererFactory';
import { resolveSceneCameraPose } from '@app/utils/cameraPresets';
import { getSceneCameraPreset } from '@app/scenes/sceneCatalog';
import { createScene } from '@scenes/immersive-toybox-scenes/pirate-cove';
import { createPirateCoveMaterials } from '@scenes/immersive-toybox-scenes/pirate-cove/materials';
import { createBarrel } from '@scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
import type { NavigationActions } from '@app/types/scenes';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = createConfiguredRenderer(canvas, { stencil: true });
const scene = new Scene();
applyDefaultEnvironment(renderer, scene);

const nav: NavigationActions = {
  navigateTo: () => {},
  launchMiniGame: () => {},
  exitMiniGame: () => {},
};

/**
 * THE LIVE REGISTRY MAP ITSELF, not a copy of its keys.
 *
 * `captureRegistry()` below recovers the KEYS by patching the raycaster, which
 * is enough to know WHAT is tappable but not enough to know WHAT FIRED: the
 * handlers live in the controller's private `Map` and a probe that cannot see
 * them can only model arbitration, which is the failure this round has already
 * paid for twice.
 *
 * `InteractionController` stores each registration as `registry.set(obj, {
 * handler, opts })`. Patching `Map.prototype.set` for the duration of scene
 * construction hands over the Map instance itself as `this`. It is a broad
 * patch, so it is (a) installed only across `createScene` and removed in a
 * `finally`, (b) filtered to entries that look exactly like a registration, and
 * (c) CHECKED -- `__tapClasses` refuses to run unless the captured Map's key set
 * matches the raycaster-recovered registry exactly. If the two ever disagree the
 * probe fails loudly instead of quietly measuring the wrong population.
 */
let liveRegistry: Map<Object3D, { handler: (hit: { object: Object3D; point: unknown }) => void; opts: { background?: boolean } }> | null = null;
const originalMapSet = Map.prototype.set;
type RegEntry = { handler: (hit: { object: Object3D; point: unknown }) => void; opts: { background?: boolean } };
Map.prototype.set = function (this: Map<unknown, unknown>, k: unknown, v: unknown) {
  if (!liveRegistry && k instanceof Object3D && typeof (v as RegEntry)?.handler === 'function' && typeof (v as RegEntry)?.opts === 'object') {
    liveRegistry = this as Map<Object3D, RegEntry>;
  }
  return originalMapSet.call(this, k, v) as Map<unknown, unknown>;
};
let cameraHandle: ReturnType<typeof createScene>['cameraHandle'];
try {
  ({ cameraHandle } = createScene(scene, canvas, nav));
} finally {
  Map.prototype.set = originalMapSet;
}

// FORBIDDEN control. This is the exact prop the outboard rule bans, standing at
// the exact spot the rail stowage occupies -- the centroid of the starboard run.
// It is hidden by default and only made visible for its own A/B pass, so the
// screenshots above show the shipping scene and nothing else.
const ctrlMaterials = createPirateCoveMaterials();
const ctrlBarrel = createBarrel(scene, { position: new Vector3(3.6, 0, -3.5), rotY: 0, scale: 1 }, { materials: ctrlMaterials });
ctrlBarrel.name = 'ctrl_barrel';
ctrlBarrel.visible = false;

const draw = () => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  cameraHandle.resize(w, h);
  renderer.render(scene, cameraHandle.camera);
};
draw();
// One more frame after layout settles, then flag ready for the screenshotter.
requestAnimationFrame(() => {
  draw();
  (window as unknown as { __shotReady?: boolean }).__shotReady = true;
});
(window as unknown as { __redraw?: () => void }).__redraw = draw;

// A/B toggle. "Does a clipped prop read?" is answerable by rendering the frame
// with and without the prop and counting the pixels that actually change --
// which is the thing every geometric proxy was standing in for.
// `name` is matched as a SUBSTRING: the rails are dozens of separately named
// posts, balls, planks and cap rails (`railing_post_starboard_side_3`), and "the
// starboard rail" is all of them together.
/**
 * The scene's own target, read from the preset rather than hard-coded.
 *
 * @returns the resolved orbit target for the current aspect, in world space.
 */
const targetOf = (): Vector3 => {
  const t = resolveSceneCameraPose('pirate-cove', canvas.clientWidth / canvas.clientHeight).target;
  return new Vector3(t.x, t.y, t.z);
};

/**
 * Places the camera at a given orbit radius, THE WAY THE APP DOES.
 *
 * ROUND 5 found that Pirate Cove pins `maxDistance` to its own `distance`, so
 * the portrait pull-back every other scene gets is clamped away to nothing. To
 * see what the scene WOULD look like with it, the camera is moved along its own
 * orbit -- same target, same azimuth, same polar, distance only. Passing null
 * redraws at whatever the app itself chose.
 *
 * ROUND 6 CORRECTION, and it invalidates any earlier Pirate Cove number taken
 * through this hook. The first version scaled the camera's CURRENT view
 * direction and aimed at a hard-coded (0, 1.5, 0). Both are wrong in the same
 * way `nature.ts` documents: `updateCameraPosition` rebuilds the offset from the
 * preset's spherical angles and then clamps world y to `ceilingY`, which for
 * this scene is 8. At radius 22.5 and polar 1.25 the orbit sphere puts the eye
 * at y 7.11, under the ceiling -- but at the wider radii a portrait pull-back
 * reaches, the clamp engages and the app looks down more steeply than the sphere
 * does. Scaling a previously-clamped direction preserved that clamp and then
 * re-applied it, compounding the error with radius. This reconstructs the pose
 * from the preset each time, so the only difference from `resolveSceneCameraPose`
 * is that the radius is supplied rather than derived from the aspect.
 *
 * @param radius the orbit radius to place the camera at, or null to leave the
 *   camera where the app's own aspect-derived pose put it.
 * @returns the radius actually adopted, measured back from the target after the
 *   ceiling clamp -- which is not the requested radius once the clamp engages.
 */
(window as unknown as { __setRadius?: (radius: number | null) => number }).__setRadius = (radius) => {
  draw(); // let the app place the camera first
  const cam = cameraHandle.camera;
  const target = targetOf();
  if (radius !== null) {
    const preset = getSceneCameraPreset('pirate-cove');
    const ceilingY = preset.constraints?.ceilingY ?? 6.0;
    cam.position.copy(target).add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
    if (cam.position.y > ceilingY) {
      cam.position.y = ceilingY;
    }
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  }
  return cam.position.distanceTo(target);
};

/**
 * The camera's combined projection * view matrix, as a flat 16-array in
 * column-major order, so a probe can project world points itself and show the
 * arithmetic next to the claim rather than hiding it inside the page.
 *
 * @returns the 16 elements of projection * view, column-major.
 */
(window as unknown as { __projView?: () => number[] }).__projView = () => {
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
  return Array.from(m.elements);
};

/**
 * The LIVE lens, after `cameraHandle.resize` has had its say.
 *
 * `__projView` cannot answer this: it is projection * view, and the view half is
 * a rigid transform that leaves no clean way to read the vertical FOV back out
 * of the product. A probe that needs the FOV has two other options and both are
 * wrong -- reading the authored preset measures a camera the app may never
 * adopt (the mistake that voided Round 5's silhouette census), and typing the
 * number in is how Round 5 acquired a "24 px controller constant" that did not
 * exist. So it is taken off the camera the renderer just drew with.
 *
 * `element[5]` of a Three.js perspective projection is `1 / tan(vfov / 2)`,
 * which is exactly the quantity that turns a distance into pixels-per-world-unit
 * and is returned as `f` so no caller has to rediscover that.
 *
 * @returns the vertical FOV in radians, its `1 / tan(vfov / 2)` form, and the aspect.
 */
(window as unknown as { __camLens?: () => { vfov: number; f: number; aspect: number } }).__camLens = () => {
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  const f = cam.projectionMatrix.elements[5];
  return { vfov: 2 * Math.atan(1 / f), f, aspect: cam.projectionMatrix.elements[5] / cam.projectionMatrix.elements[0] };
};

/**
 * THE TAP REGISTRY, TAKEN OUT OF THE LIVE CONTROLLER RATHER THAN GUESSED.
 *
 * The Pirate Cove sibling of the hook `nature.ts` carries, and deliberately the
 * same code, because Round 6's question -- how much of each scene survives a
 * phone frame -- is only answerable if both scenes are measured by one
 * instrument.
 *
 * It matters more here than it did there. Enumerating `*_root` nodes finds
 * exactly TWO objects in this scene (the portal and the owl), because Pirate
 * Cove does not build its props through `createEntityRoot` the way Nature does.
 * A census built on that naming convention would have reported this scene as
 * near-empty and been believed, which is the Round 4 substring-group mistake
 * wearing a different hat. The registry is the population that actually answers
 * a tap, whatever it happens to be called.
 *
 * Method: patch `Raycaster.prototype.intersectObjects` to record its argument
 * and abort, fire one synthetic tap at the canvas corner, restore. The abort is
 * what keeps the probe non-destructive -- the throw unwinds `onPointerUp` before
 * anything fires, so no handler runs and the scene this measures is the scene
 * that was rendered. The sentinel is swallowed by a capture-phase listener
 * installed for the duration.
 */
const REGISTRY_SENTINEL = { probeAbort: true };
let tapRegistry: Object3D[] | null = null;
const captureRegistry = (): Object3D[] => {
  if (tapRegistry) return tapRegistry;
  const proto = Raycaster.prototype as unknown as { intersectObjects: unknown };
  const original = proto.intersectObjects;
  let seen: Object3D[] | null = null;
  proto.intersectObjects = function (objects: Object3D[]) {
    seen = objects;
    throw REGISTRY_SENTINEL;
  };
  const swallow = (e: ErrorEvent): void => {
    if (e.error === REGISTRY_SENTINEL) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('error', swallow, true);
  const at: PointerEventInit = { clientX: 1, clientY: 1, bubbles: true, pointerId: 1 };
  canvas.dispatchEvent(new PointerEvent('pointerdown', at));
  canvas.dispatchEvent(new PointerEvent('pointerup', at));
  window.removeEventListener('error', swallow, true);
  proto.intersectObjects = original;
  tapRegistry = seen ?? [];
  return tapRegistry;
};

/**
 * The `<prop>_root` node an entry belongs to, or the entry itself when it has none.
 *
 * @param o a registry entry, typically a mesh inside a prop's hierarchy.
 * @returns the nearest `_root` ancestor, or `o` when the chain has none.
 */
const propRootOf = (o: Object3D): Object3D => {
  let n: Object3D | null = o;
  while (n) {
    if (n.name.endsWith('_root')) return n;
    n = n.parent;
  }
  return o;
};

/**
 * Every REGISTERED TAP TARGET's world-space bounding sphere, from real geometry.
 *
 * The bounds are taken from the prop root where there is one and from the
 * registered mesh itself where there is not, because the thing a child aims at
 * is the visible prop, not the sub-mesh that happens to carry the handler. A
 * background-flagged surface (the deck, the sea) is excluded: it is scenery that
 * answers a tap, not a thing to discover, and counting it would let a scene
 * score well on "props in frame" while showing a child nothing but planking.
 *
 * @returns one entry per registered target: name, world centre, world radius.
 */
(window as unknown as { __propBounds?: () => { name: string; c: [number, number, number]; r: number }[] }).__propBounds = () => {
  const out: { name: string; c: [number, number, number]; r: number }[] = [];
  const seen = new Set<Object3D>();
  for (const entry of captureRegistry()) {
    if (entry.userData?.tapBackground === true) continue;
    const node = propRootOf(entry);
    if (seen.has(node)) continue;
    seen.add(node);
    if (node.name.startsWith('ctrl_')) continue; // the forbidden-barrel control is not scene content
    const box = new Box3().setFromObject(node);
    if (box.isEmpty()) continue;
    const s = box.getBoundingSphere(new Sphere());
    out.push({ name: node.name || `(${node.type})`, c: [s.center.x, s.center.y, s.center.z], r: s.radius });
  }
  return out;
};

/**
 * DISCOVERY vs CONSOLATION, PER SCREEN SAMPLE.
 *
 * Round 5 established that every tap in these scenes now produces a response.
 * That is the floor, not the ceiling. soul.md draws the distinction itself: #41
 * is the contract that nothing may be dead, but the success story in #117 is a
 * child tapping a mushroom, a butterfly, a stream and a log -- four DISCOVERIES,
 * not four acknowledgements. A scene can satisfy #41 completely and still hand a
 * child the consolation sparkle almost everywhere.
 *
 * So this classifies every sample into exactly one of three outcomes, in the
 * controller's own order (`onPointerUp`, four rules):
 *
 *   PROP    a registered non-background target fires -- by direct raycast, or by
 *           winning the proximity contest within `radiusPx`. This is discovery.
 *   SCENERY a background-flagged surface fires: the deck, the sea. A real
 *           response, and the right one, but the same one everywhere.
 *   NOTHING neither -- the miss handler's sparkle. Round 5 should have driven
 *           this to zero and it is reported so that claim keeps being checked.
 *
 * WHY THE MODEL IS ALLOWED HERE. This re-implements arbitration rather than
 * calling it, which is the mistake Round 5 spent two falsifications on. It is
 * admissible only because it is checked: `pc-agree.mjs` fires REAL taps through
 * the shipped controller at the same samples and compares outcomes, and this
 * number may only be quoted while that check reports zero disagreements. The
 * background flag is read from `userData[TAP_BACKGROUND_KEY]` where the
 * controller wrote it, never inferred from a name.
 *
 * @param step - Sample spacing in CSS px.
 * @param radiusPx - Proximity radius to model (the app ships PROXIMITY_PX).
 * @returns Per-sample outcome codes plus the registry labels they index.
 */
(
  window as unknown as {
    __discoveryMap?: (
      step: number,
      radiusPx: number,
    ) => { labels: string[]; entryLabels: string[]; background: boolean[]; cols: number; rows: number; w: number; h: number; fire: number[]; mode: number[] };
  }
).__discoveryMap = (step, radiusPx) => {
  const reg = captureRegistry();
  const isBg = reg.map((o) => o.userData.tapBackground === true);
  const labels = reg.map((o) => propRootOf(o).name || o.name || `(${o.type})`);
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const index = new Map<Object3D, number>();
  reg.forEach((o, i) => index.set(o, i));

  const wp = new Vector3();
  const pr = new Vector3();
  const centres = reg.map((o) => {
    o.getWorldPosition(wp);
    pr.copy(wp).project(cam);
    if (pr.z > 1) return null;
    return { x: ((pr.x + 1) / 2) * w, y: ((1 - pr.y) / 2) * h };
  });

  const rc = new Raycaster();
  const ndc = new Vector2();
  const cols = Math.floor(w / step);
  const rows = Math.floor(h / step);
  const fire: number[] = new Array(cols * rows);
  // HOW the sample was won, not just by whom. `fire` alone cannot tell a tap
  // that landed ON a target from a tap that landed on nothing and was handed to
  // the nearest centre within the proximity radius, and the difference is the
  // whole argument when a new registration takes samples off an existing prop:
  // winning them by RAYCAST means the child's finger was literally on the new
  // thing and the old answer was the wrong one; winning them by PROXIMITY means
  // two centres competed over empty pixels and the new one happened to be
  // nearer, which is a genuine regression. 0 = raycast foreground,
  // 1 = proximity fallback, 2 = background surface, -1 = nothing fired.
  const mode: number[] = new Array(cols * rows).fill(-1);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * step + step / 2;
      const y = j * step + step / 2;
      ndc.x = (x / w) * 2 - 1;
      ndc.y = -(y / h) * 2 + 1;
      rc.setFromCamera(ndc, cam);
      const hits = rc.intersectObjects(reg, true);
      let fg = -1;
      let bg = -1;
      for (const hit of hits) {
        let o: Object3D | null = hit.object;
        while (o) {
          const found = index.get(o);
          if (found !== undefined) {
            if (isBg[found]) {
              if (bg < 0) bg = found;
            } else {
              fg = found;
            }
            break;
          }
          o = o.parent;
        }
        if (fg >= 0) break;
      }
      const k = j * cols + i;
      if (fg >= 0) {
        fire[k] = fg;
        mode[k] = 0;
        continue;
      }
      let best = -1;
      let bestSq = radiusPx * radiusPx;
      for (let n = 0; n < centres.length; n++) {
        const c = centres[n];
        if (!c || isBg[n]) continue;
        const dx = c.x - x;
        const dy = c.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestSq) {
          bestSq = d2;
          best = n;
        }
      }
      fire[k] = best >= 0 ? best : bg;
      mode[k] = best >= 0 ? 1 : bg >= 0 ? 2 : -1;
    }
  }
  // This scene's `labels` is already per registry entry, so `entryLabels` is the
  // same array. It exists so a reader indexing by `fire[k]` uses one name in
  // both scenes; Nature's `labels` is per GROUP and indexing it that way printed
  // `undefined`. Alias rather than copy: the two really are the same thing here,
  // and a copy would invite them to drift.
  return { labels, entryLabels: labels, background: isBg, cols, rows, w, h, fire, mode };
};

/**
 * THE SAME MAP, MEASURED BY ACTUALLY TAPPING IT.
 *
 * `__discoveryMap` models the four arbitration rules. This does not model
 * anything: it dispatches a real `pointerdown`/`pointerup` pair at each sample
 * onto the real canvas, lets the shipped `onPointerUp` run, and records which
 * registered object the controller chose to fire. The handlers are swapped for
 * recorders across the sweep and restored afterwards -- arbitration happens
 * entirely before `fire()` is called, so replacing what `fire()` invokes cannot
 * change which branch was taken, and it stops several thousand synthetic taps
 * from animating the scene into a state later samples would be read against.
 *
 * The class is read from the object the controller chose, not from the branch:
 *
 *   PROP    a registered target with `tapBackground !== true` fired.
 *   SCENERY a background-flagged surface fired.
 *   NOTHING no handler ran at all -- the miss path.
 *
 * Note what this hook does NOT need: it never asks which of the four rules won.
 * PROP is rule 1 or rule 2 and the charge does not care which, so the one thing
 * that would have required reading controller internals is simply not asked.
 *
 * @param step - Sample spacing in CSS px. Must match `__discoveryMap`'s.
 * @returns Per-sample fired-object indices into the registry, -1 for a miss.
 */
(window as unknown as { __tapClasses?: (step: number) => { cols: number; rows: number; fire: number[] } }).__tapClasses = (step) => {
  const reg = captureRegistry();
  if (!liveRegistry) throw new Error('registry Map was never captured -- the Map.prototype.set patch missed it');
  const keys = [...liveRegistry.keys()];
  if (keys.length !== reg.length || keys.some((k, i) => k !== reg[i])) {
    throw new Error(`captured Map (${keys.length}) does not match the raycast-recovered registry (${reg.length})`);
  }

  const index = new Map<Object3D, number>();
  reg.forEach((o, i) => index.set(o, i));
  let fired = -1;
  const saved = reg.map((o) => liveRegistry!.get(o)!.handler);
  reg.forEach((o) => {
    const entry = liveRegistry!.get(o)!;
    entry.handler = () => {
      fired = index.get(o)!;
    };
  });

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cols = Math.floor(w / step);
  const rows = Math.floor(h / step);
  const fire: number[] = new Array(cols * rows);
  const rect = canvas.getBoundingClientRect();
  try {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const clientX = rect.left + i * step + step / 2;
        const clientY = rect.top + j * step + step / 2;
        const at: PointerEventInit = { clientX, clientY, bubbles: true, pointerId: 1 };
        fired = -1;
        canvas.dispatchEvent(new PointerEvent('pointerdown', at));
        canvas.dispatchEvent(new PointerEvent('pointerup', at));
        fire[j * cols + i] = fired;
      }
    }
  } finally {
    reg.forEach((o, i) => {
      liveRegistry!.get(o)!.handler = saved[i];
    });
  }
  return { cols, rows, fire };
};

(window as unknown as { __setVisible?: (name: string, on: boolean) => number }).__setVisible = (name, on) => {
  let hits = 0;
  scene.traverse((o) => {
    if (o.name.includes(name)) {
      o.visible = on;
      hits++;
    }
  });
  draw();
  return hits;
};

/**
 * WHAT IS IN THE SCENE, AND WHICH OF IT THE CONTROLLER CAN EVER ANSWER FOR.
 *
 * The map probes answer "what does a tap at this pixel do". This answers a
 * different and prior question: for each THING the scene builds, is there any
 * registered target covering it at all? A prop can be beautifully modelled,
 * centred in frame, and completely absent from the registry, and every
 * pixel-based probe will report that honestly as SCENERY or NOTHING without ever
 * naming the thing the child was actually reaching for.
 *
 * NO NAME LIST IS TAKEN AS INPUT, deliberately. A probe that is handed
 * `['owl', 'sail', 'mast']` can only confirm a suspicion it was already given.
 * This walks every named node in the graph and classifies all of them, so the
 * caller sees what it did not think to ask about.
 *
 * THREE STATES, and the middle one is the one that gets miscounted:
 *
 *   PROP     the node, or an ancestor of it, is a registry key that is NOT
 *            background-flagged. Tapping it is a discovery.
 *   SCENERY  the node, or an ancestor, is a background-flagged registry key.
 *            It fires -- the floor moves the owl -- but it gives the same answer
 *            everywhere on it.
 *   NONE     no registered target anywhere up the chain.
 *
 * WHAT `NONE` DOES NOT MEAN. It does not mean a tap there is dead. The
 * controller's proximity rule can still hand the tap to a nearby registered prop
 * up to PROXIMITY_PX away, and the miss path sparkles regardless. `NONE` means
 * precisely: this object has no answer of its own. Whether any pixel over it
 * nonetheless reaches something is a question for `__discoveryMap`, and the two
 * probes are deliberately kept separate so neither can quietly cover for the
 * other.
 *
 * @returns One row per named node: its name and its state.
 */
(window as unknown as { __presence?: () => { name: string; state: 'PROP' | 'SCENERY' | 'NONE' }[] }).__presence = () => {
  const reg = captureRegistry();
  const state = new Map<Object3D, 'PROP' | 'SCENERY'>();
  for (const o of reg) state.set(o, o.userData.tapBackground === true ? 'SCENERY' : 'PROP');
  const rows: { name: string; state: 'PROP' | 'SCENERY' | 'NONE' }[] = [];
  scene.traverse((o) => {
    if (!o.name) return;
    let a: Object3D | null = o;
    let found: 'PROP' | 'SCENERY' | 'NONE' = 'NONE';
    while (a) {
      const s = state.get(a);
      // A background ancestor does not outrank a prop ancestor found lower
      // down, but a prop ancestor is nearer by construction -- the first hit
      // walking up is the innermost registration, which is the one that wins.
      if (s) {
        found = s;
        break;
      }
      a = a.parent;
    }
    rows.push({ name: o.name, state: found });
  });
  return rows;
};

/**
 * WHAT THE CHILD IS LOOKING AT, sample by sample -- independent of what taps do.
 *
 * The map probes classify OUTCOMES. When a band of the frame comes back 100%
 * NOTHING, the outcome map cannot say what is standing there, and a screenshot
 * with a ruler on it is an argument from the reviewer's own eyes. This raycasts
 * the WHOLE SCENE GRAPH -- not the registry -- at the same sample grid and
 * reports the nearest named thing under each pixel. Cross-tabbed against the
 * outcome map it turns "that band is dead" into "that band is dead and it
 * contains the sail, the mast and the rigging", with no eyeballing in between.
 *
 * NEAREST NAMED ANCESTOR, not the mesh itself, because a sail is built from
 * unnamed geometry hung under a named root, and reporting `(Mesh)` 400 times
 * would answer nothing. If nothing named is found up the chain the sample is
 * reported by its type rather than being dropped, so the columns still
 * sum to the sample count and a naming gap cannot hide inside a total.
 *
 * VISIBLE OBJECTS ONLY. `Raycaster` skips `visible === false` subtrees, which is
 * what is wanted: an invisible node is not something the child is looking at.
 *
 * DISTANCE IS RETURNED ALONGSIDE THE NAME, from the same intersection, because
 * a name alone cannot size a reaction. Pirate Cove's sea is a 400 x 400 plane:
 * a splash authored in world units is a different number of pixels at the rail
 * than it is at the horizon, and the only way to choose that number rather than
 * invent it is to know the range of distances the visible water actually spans.
 * `-1` means the ray hit nothing, so a caller cannot mistake "no geometry" for
 * "zero units away".
 *
 * @param step - Sample spacing in CSS px. Match the outcome map's to cross-tab.
 * @returns Grid dimensions, the nearest named object per sample, and its distance.
 */
(window as unknown as { __underNames?: (step: number) => { cols: number; rows: number; names: string[]; dists: number[] } }).__underNames = (step) => {
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const rc = new Raycaster();
  const ndc = new Vector2();
  const cols = Math.floor(w / step);
  const rows = Math.floor(h / step);
  const names: string[] = new Array(cols * rows);
  const dists: number[] = new Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      ndc.x = ((i * step + step / 2) / w) * 2 - 1;
      ndc.y = -((j * step + step / 2) / h) * 2 + 1;
      rc.setFromCamera(ndc, cam);
      const hits = rc.intersectObjects(scene.children, true);
      dists[j * cols + i] = hits.length > 0 ? hits[0].distance : -1;
      // Three outcomes, not two. Collapsing "the ray hit nothing" together with
      // "the ray hit a mesh nobody named" put 20% of Pirate Cove's frame under
      // one label and made the deck -- the scene's only background target --
      // look like empty sky. An unnamed hit is reported by its type so the row
      // is visibly a naming gap in the SCENE rather than a hole in the probe.
      let name = '';
      if (hits.length > 0) {
        let o: Object3D | null = hits[0].object;
        while (o && !name) {
          if (o.name) name = o.name;
          o = o.parent;
        }
        if (!name) name = `(unnamed ${hits[0].object.type})`;
      }
      names[j * cols + i] = name;
    }
  }
  return { cols, rows, names, dists };
};

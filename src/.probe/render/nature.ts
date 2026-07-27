/**
 * Headless render harness for the NATURE forest-floor diorama -- the outdoor
 * scene, and the one place in the catalog where the portrait pull-back is
 * actually live at ship time.
 *
 * Deliberately a sibling of `shot.ts` rather than a generalisation of it. The
 * two scenes have different props, different targets and different ways of
 * being wrong, and one parameterised harness that quietly does the wrong thing
 * for one of them is exactly the kind of shared-proxy mistake Round 4 spent its
 * whole budget unpicking.
 *
 * `__setRadius` moves the camera along its own orbit -- same target, azimuth and
 * polar, distance only -- which is precisely what the pull-back does, so passing
 * the preset's authored distance shows what the scene looks like with the rule
 * switched off, and passing null shows what actually ships.
 */
import { Box3, Object3D, Raycaster, Scene, Sphere, Spherical, Vector2, Vector3 } from 'three';
import { createConfiguredRenderer, applyDefaultEnvironment } from '@app/utils/rendererFactory';
import { createScene } from '@scenes/immersive-toybox-scenes/naturescene';
import { resolveSceneCameraPose } from '@app/utils/cameraPresets';
import { getSceneCameraPreset } from '@app/scenes/sceneCatalog';
import type { NavigationActions } from '@app/types/scenes';
import { soundsRequested } from '@app/assets/audio/sceneBridge';

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
 * THE LIVE REGISTRY MAP ITSELF, captured the way `shot.ts` documents at length.
 *
 * Deliberately the same code in both harnesses: the agreement check compares a
 * modelled classification against real taps, and a comparison whose two scenes
 * are instrumented differently cannot tell a scene difference from a probe
 * difference. `captureRegistry()` recovers the registry KEYS; only the Map
 * itself carries the handlers, and without the handlers a probe can predict
 * arbitration but never observe it.
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

const draw = () => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  cameraHandle.resize(w, h);
  renderer.render(scene, cameraHandle.camera);
};
draw();
requestAnimationFrame(() => {
  draw();
  (window as unknown as { __shotReady?: boolean }).__shotReady = true;
});
(window as unknown as { __redraw?: () => void }).__redraw = draw;

/**
 * The scene's own target, taken from the preset rather than hard-coded.
 *
 * @returns the preset's orbit target for the current aspect, in world space.
 */
const targetOf = () => {
  const t = resolveSceneCameraPose('nature', canvas.clientWidth / canvas.clientHeight).target;
  return new Vector3(t.x, t.y, t.z);
};

/**
 * Places the camera at a given orbit radius, THE WAY THE APP DOES.
 *
 * The first version of this moved the camera along its current view direction:
 * `position = target + normalize(position - target) * radius`. That is wrong in
 * a way that quietly corrupted every portrait measurement taken through this
 * harness. `resolveSceneCameraPose` -- and `createSceneCamera.updateCameraPosition`
 * with it -- rebuilds the offset from the preset's own spherical angles and then
 * CLAMPS the camera's world y to `ceilingY`, so on a phone the shipped camera is
 * not on the orbit sphere at all: at radius 18.75 and polar 1.2 the sphere puts
 * the eye at y 7.09, and the app pins it to 6.0 and looks down more steeply from
 * there. Scaling the old direction preserved whatever clamped direction was left
 * over from the previous call, so this harness was rendering, and reporting prop
 * positions for, a camera the app never adopts -- and the error grew with the
 * pull-back, i.e. exactly where the round's conclusions were being drawn.
 *
 * It now reconstructs the pose from the preset each time, so the only difference
 * from `resolveSceneCameraPose` is that the radius is supplied rather than
 * derived from the aspect. That is the whole point of the hook: it is how the
 * "with the pull-back" and "without it" columns are produced.
 *
 * @param radius the orbit radius to place the camera at, or null to leave the
 *   camera where the app's own aspect-derived pose put it.
 * @returns the radius actually adopted, measured back from the target after the
 *   preset's ceiling clamp -- which is not the requested radius on a phone.
 */
(window as unknown as { __setRadius?: (radius: number | null) => number }).__setRadius = (radius) => {
  draw();
  const cam = cameraHandle.camera;
  const target = targetOf();
  if (radius !== null) {
    const preset = getSceneCameraPreset('nature');
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
 * Every interactive prop's world centre, for the crowding measurement.
 *
 * `createEntityRoot` names each instance `<prop>_root`, one per placement, so
 * this enumerates real instances rather than the substring GROUPS the pixel
 * differential was forced to work with -- which is the flaw that made the
 * earlier per-group sizes untrustworthy.
 *
 * The registered tap target is a child of this root (a mushroom's cap, a
 * flower's centre), sitting a few centimetres above it. That offset is an order
 * of magnitude smaller than the inter-prop spacing this is used to measure, so
 * the root stands in for the target here -- but it is an approximation, and any
 * claim resting on sub-prop distances would need the targets themselves.
 */
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
 * The Pirate Cove sibling of this hook, and deliberately the same code, for the
 * same reason every other paired hook in these two harnesses is: a comparative
 * charge measured by two different instruments is not a comparison.
 *
 * `__projView` cannot answer this: it is projection * view, and the view half is
 * a rigid transform that leaves no clean way to read the vertical FOV back out
 * of the product. Reading the authored preset instead would measure a camera the
 * app may never adopt, which is the defect that voided Round 5's census.
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
 * The camera's own screen-right axis in world space.
 *
 * Needed to measure how wide a prop reads on screen rather than how far its
 * centre is from another centre. A flat disc seen from 21 degrees above does not
 * project to a circle, so its on-screen width has to come from rim points taken
 * along THIS axis; scaling a world radius by depth would silently assume the
 * isotropy that the oblique view removes.
 *
 * @returns the unit screen-right vector, as world-space [x, y, z].
 */
(window as unknown as { __cameraRight?: () => [number, number, number] }).__cameraRight = () => {
  const cam = cameraHandle.camera;
  cam.updateMatrixWorld(true);
  const e = cam.matrixWorld.elements;
  const v = new Vector3(e[0], e[1], e[2]).normalize();
  return [v.x, v.y, v.z];
};

(window as unknown as { __propCenters?: () => { name: string; p: [number, number, number] }[] }).__propCenters = () => {
  const out: { name: string; p: [number, number, number] }[] = [];
  const v = new Vector3();
  scene.traverse((o) => {
    if (!o.name.endsWith('_root')) return;
    o.getWorldPosition(v);
    out.push({ name: o.name, p: [v.x, v.y, v.z] });
  });
  return out;
};

/**
 * Each interactive root's world-space bounding sphere, from the real geometry.
 *
 * Needed because "the prop's centre is off-frame" and "the prop is invisible"
 * are different claims, and only the second one makes the proximity fallback
 * indefensible: a partially visible prop can be aimed at, and a tap that lands
 * on its visible sliver is resolved by the RAYCAST, not by proximity at all.
 * Guessing a radius per family would be the same species of mistake as the
 * substring-group sizes Round 4 had to retract, so this reads it off the meshes.
 *
 * @returns one entry per `<prop>_root`, each with its world centre and radius.
 */
(window as unknown as { __propBounds?: () => { name: string; c: [number, number, number]; r: number }[] }).__propBounds = () => {
  const out: { name: string; c: [number, number, number]; r: number }[] = [];
  scene.traverse((o) => {
    if (!o.name.endsWith('_root')) return;
    const box = new Box3().setFromObject(o);
    if (box.isEmpty()) return;
    const s = box.getBoundingSphere(new Sphere());
    out.push({ name: o.name, c: [s.center.x, s.center.y, s.center.z], r: s.radius });
  });
  return out;
};

/**
 * THE TAP REGISTRY, TAKEN OUT OF THE LIVE CONTROLLER RATHER THAN GUESSED.
 *
 * Round 5 spent four solver versions measuring distances between prop ROOTS,
 * because `__propCenters` enumerates `*_root` nodes and a root is the obvious
 * stand-in for "the thing you tap". It is not the thing you tap.
 * `createTapInteraction` registers a single MESH -- `mushroom.tapTarget`, the
 * cap; `flower.tapTarget`, the centre -- so the raycast set is those meshes and
 * their descendants, and a mushroom's STEM is not in it. A tap on a stem misses
 * every registered mesh and falls through to the proximity fallback exactly as a
 * tap on bare grass does.
 *
 * Nothing may be assumed about which meshes those are, so this takes the list
 * from the controller itself: patch `Raycaster.prototype.intersectObjects` to
 * record its argument and abort, fire one synthetic tap at the canvas corner,
 * restore. The abort is what keeps the probe non-destructive -- the throw
 * unwinds `onPointerUp` before `fire()`, so no handler runs, no leaf flips and
 * no stone slides, and the scene this measures is the scene that was rendered.
 * The thrown sentinel is swallowed by a capture-phase error listener installed
 * for the duration.
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
 * The `<prop>_root` node an entry belongs to, or the entry itself when it has no root.
 *
 * @param o a registry entry, typically a mesh deep inside a prop's hierarchy.
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
 * Groups registry entries by the prop they belong to.
 *
 * A portal registers five to eight separate meshes (pedestal, jar, lid, four
 * glows) and a mushroom registers one; firing any of a portal's entries is the
 * same outcome to the child, so "did the child get the portal" is a question
 * about the GROUP. Root NAMES are not unique -- all five mushrooms are
 * `mushroom_root` -- so grouping is by node identity and the label carries an
 * ordinal.
 *
 * One root must NOT collapse: `fireflies_root` owns fourteen separately
 * registered meshes scattered across the clearing. Those are fourteen things a
 * child reaches for, not one. The split rule is geometric rather than a name
 * check -- a root's entries are one target only if they all sit within
 * {@link CLUSTER_UNITS} of each other, i.e. only if they are parts of a single
 * object you could put a hand over. Portal parts pass; fireflies do not.
 */
const CLUSTER_UNITS = 1.0;
const groupRegistry = (reg: Object3D[]): { group: number[]; labels: string[]; roots: Object3D[] } => {
  const byRoot = new Map<Object3D, number[]>();
  reg.forEach((o, i) => {
    const root = propRootOf(o);
    const list = byRoot.get(root);
    if (list) list.push(i);
    else byRoot.set(root, [i]);
  });
  const pos = reg.map((o) => o.getWorldPosition(new Vector3()));
  const group = new Array<number>(reg.length).fill(-1);
  const roots: Object3D[] = [];
  const bases: string[] = [];
  for (const [root, members] of byRoot) {
    let spread = 0;
    for (const a of members) for (const b of members) spread = Math.max(spread, pos[a].distanceTo(pos[b]));
    const base = (root.name || `(${root.type})`).replace(/_root$/, '');
    if (spread <= CLUSTER_UNITS) {
      const id = roots.length;
      roots.push(root);
      bases.push(base);
      for (const m of members) group[m] = id;
    } else {
      for (const m of members) {
        const id = roots.length;
        roots.push(reg[m]);
        bases.push(reg[m].name || base);
        group[m] = id;
      }
    }
  }
  const seen = new Map<string, number>();
  const labels = bases.map((base) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${n}`;
  });
  return { group, labels, roots };
};

/**
 * Every registry entry with its ancestry and world size, for auditing what is tappable.
 *
 * @returns one row per registered target: its name, its parent chain, and its
 *   world-space bounding-box extents formatted for reading.
 */
(window as unknown as { __registryDetail?: () => { name: string; chain: string; size: string }[] }).__registryDetail = () =>
  captureRegistry().map((o) => {
    const chain: string[] = [];
    let n: Object3D | null = o.parent;
    while (n && chain.length < 4) {
      chain.push(n.name || n.type);
      n = n.parent;
    }
    const b = new Box3().setFromObject(o);
    const s = b.isEmpty() ? new Vector3() : b.getSize(new Vector3());
    return { name: o.name || `(${o.type})`, chain: chain.join(' < '), size: `${s.x.toFixed(2)} x ${s.y.toFixed(2)} x ${s.z.toFixed(2)}` };
  });

/**
 * WHAT THE CONTROLLER WOULD ACTUALLY FIRE, PER SCREEN SAMPLE.
 *
 * This is `onPointerUp` with the pointer bookkeeping removed, in the controller's
 * own order: read the raycast for the nearest ORDINARY registered owner and,
 * separately, the nearest BACKGROUND one; fire the ordinary hit outright;
 * otherwise run the nearest-centre contest over non-background entries with the
 * `projected.z > 1` skip and `nearestPointWithin`'s `<=` tie-break; otherwise
 * fire the background hit; otherwise the tap is dead. Two parallel grids come
 * back: `hit` (which prop's own mesh is under this pixel, or -1) and `fire`
 * (which prop a tap here would actually trigger, or -1 for a dead tap).
 *
 * `background` is read off `userData[TAP_BACKGROUND_KEY]`, which the controller
 * writes at `register` time. That matters: this round has already been wrong
 * twice by modelling a rule instead of reading one, so the probe takes the flag
 * from the same place the controller put it rather than recognising the ground
 * and the water by name.
 *
 * TWO LABEL ARRAYS, BECAUSE THERE ARE TWO INDEX SPACES AND CONFLATING THEM
 * PRINTED `undefined`. `group`, `hit` and `fire` are indexed by REGISTRY ENTRY;
 * `labels` and `rootCentres` are indexed by GROUP, of which there are fewer.
 * `nature-tap-reach.mjs` reads `labels[g]` and is right; a later probe read
 * `labels[fire[k]]` and got `undefined` for the two largest catchment holders in
 * the scene -- the one place a wrong name mattered most. `labels` keeps its
 * group meaning so the existing reader is untouched, and `entryLabels` is added
 * for readers indexing by registry entry.
 *
 * @param step - Sample spacing in CSS px.
 * @param radiusPx - Proximity radius to model (the app ships PROXIMITY_PX).
 * @returns Registry names, both grids, and each entry's projected centre.
 */
(
  window as unknown as {
    __dispatchMap?: (
      step: number,
      radiusPx: number,
    ) => {
      labels: string[];
      entryLabels: string[];
      group: number[];
      cols: number;
      rows: number;
      step: number;
      w: number;
      h: number;
      hit: number[];
      fire: number[];
      centres: ({ x: number; y: number } | null)[];
      rootCentres: ({ x: number; y: number } | null)[];
      background: boolean[];
    };
  }
).__dispatchMap = (step, radiusPx) => {
  const reg = captureRegistry();
  const { group, labels, roots } = groupRegistry(reg);
  const isBg = reg.map((o) => o.userData.tapBackground === true);
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
  const rootCentres = roots.map((o) => {
    o.getWorldPosition(wp);
    pr.copy(wp).project(cam);
    if (pr.z > 1) return null;
    return { x: ((pr.x + 1) / 2) * w, y: ((1 - pr.y) / 2) * h };
  });

  const rc = new Raycaster();
  const ndc = new Vector2();
  const cols = Math.floor(w / step);
  const rows = Math.floor(h / step);
  const hit: number[] = new Array(cols * rows);
  const fire: number[] = new Array(cols * rows);
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
      for (const h2 of hits) {
        let o: Object3D | null = h2.object;
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
      // `hit` stays "whose mesh is literally under this pixel", which for a
      // background surface is still the background surface -- that is what makes
      // the silhouette column mean the same thing before and after the fix.
      hit[k] = fg >= 0 ? fg : bg;
      if (fg >= 0) {
        fire[k] = fg;
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
    }
  }
  // Indexed by registry entry, not by group -- see the doc block. An entry whose
  // group is -1 cannot exist (groupRegistry assigns every member), but the
  // fallback is kept so a future regression prints a visible marker instead of
  // `undefined`.
  const entryLabels = reg.map((o, i) => labels[group[i]] ?? `(ungrouped ${o.name || o.type})`);
  return { labels, entryLabels, group, cols, rows, step, w, h, hit, fire, centres, rootCentres, background: isBg };
};

/**
 * FIRES A REAL TAP AND REPORTS WHETHER THE CHILD GOT AN ANSWER.
 *
 * Everything else in this file predicts what the controller would do. This does
 * not predict: it dispatches genuine pointer events at the canvas, lets the
 * shipped `onPointerUp` run end to end, and reports the delta in the scene
 * bridge's sound-request counter. That counter is the one observable that
 * distinguishes "a handler ran and made a noise", "a handler ran silently and
 * the controller covered for it" and "nothing happened at all", and it is
 * incremented inside `triggerSound` itself, so it cannot drift from the app.
 *
 * It IS destructive -- a leaf really flips, a stone really slides -- so callers
 * must reload the page between batches rather than treat the scene as pristine
 * afterwards.
 *
 * @param x - Canvas x in CSS px.
 * @param y - Canvas y in CSS px.
 * @returns The number of sounds the tap requested.
 */
(window as unknown as { __tapLive?: (x: number, y: number) => number }).__tapLive = (x, y) => {
  const before = soundsRequested();
  const at: PointerEventInit = { clientX: x, clientY: y, bubbles: true, pointerId: 1 };
  canvas.dispatchEvent(new PointerEvent('pointerdown', at));
  canvas.dispatchEvent(new PointerEvent('pointerup', at));
  return soundsRequested() - before;
};

/**
 * THE SAME GRID, MEASURED BY ACTUALLY TAPPING IT. Sibling of `shot.ts`'s hook
 * and the same code, because the whole value of the agreement check is that both
 * scenes are held to one instrument.
 *
 * `__tapLive` above already fires real taps, but it reports a SOUND COUNT, which
 * answers "did the child get an answer" (soul.md#6) and cannot answer "was it a
 * discovery or the consolation sparkle" -- the fallback sound is played on both
 * paths. This records the fired OBJECT instead, so PROP / SCENERY / NOTHING can
 * be read off the registry's own background flag.
 *
 * Handlers are swapped for recorders across the sweep and restored in a
 * `finally`. Arbitration finishes before `fire()` is called, so nothing about
 * which branch wins can depend on what `fire()` invokes -- and unlike
 * `__tapLive` this leaves the scene unmoved, which is what makes a sweep of
 * thousands of samples meaningful rather than a record of the scene destroying
 * itself as it is measured.
 *
 * @param step - Sample spacing in CSS px. Must match `__dispatchMap`'s.
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

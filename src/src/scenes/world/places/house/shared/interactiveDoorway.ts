import gsap from 'gsap';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, PlaneGeometry, SphereGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { NavigationActions, SceneId } from '@app/types/scenes';
import { createToyMetalMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';

/** Palette tints applied to a doorway's wood and metal materials. */
export interface DoorwayPalette {
  /** Door slab wood tint. */
  door: Color;
  /** Frame and casing tint. */
  frame: Color;
  /** Recessed panel tint (slightly darker than the slab reads best). */
  panel: Color;
  /** Knob and escutcheon metal tint. */
  knob: Color;
}

/** Arguments for {@link createInteractiveDoorway}. */
export interface CreateInteractiveDoorwayArgs {
  /** Scene that receives the doorway group. */
  scene: Scene;
  /** Shared room tap dispatcher that owns pointer handling. */
  dispatcher: WorldTapDispatcher;
  /** Navigation actions used to enter the destination scene. */
  nav: NavigationActions;
  /** Scene this door opens into when tapped. */
  destination: SceneId;
  /** Unique id used to namespace cached materials (e.g. `livingRoom_playroomDoor`). */
  id: string;
  /** Floor-level position of the door center on the wall face. */
  position: Vector3;
  /** Y rotation of the doorway. Local +Z faces into the room. */
  rotationY: number;
  /** Wood/metal tints for this door. */
  palette: DoorwayPalette;
  /** Door slab width. @default 2.0 */
  width?: number;
  /** Door slab height. @default 3.5 */
  height?: number;
}

/** Handle returned by {@link createInteractiveDoorway}. */
export interface InteractiveDoorwayHandle {
  /** Root group containing the frame, slab, and knob. */
  root: Group;
  /** Unregisters the tap handler and kills any in-flight door tweens. */
  dispose: () => void;
}

/** Door slab thickness. */
const DOOR_THICKNESS = 0.12;

/** Resting "slightly ajar" hinge angle in radians. */
const DOOR_IDLE_ANGLE = -0.12;

/** Hinge angle the door swings to while opening for navigation. */
const DOOR_OPEN_ANGLE = -0.55;

/**
 * Builds a procedural paneled door (frame, slab, recessed panels, knob) that
 * rests slightly ajar and, when tapped, creaks open a little further before
 * navigating to its destination scene.
 *
 * The door is authored in local space facing +Z (into the room); callers place
 * it on a wall via `position` and `rotationY`. The tap sound is
 * `sfx_hub_toybox_open`, whose creaky wooden thunk doubles as the door creak —
 * there is currently no dedicated door-creak SFX in the registry.
 *
 * @param args - Scene, dispatcher, navigation, placement, and palette options.
 * @returns Handle with the doorway root group and a dispose function.
 */
export function createInteractiveDoorway(args: CreateInteractiveDoorwayArgs): InteractiveDoorwayHandle {
  const { scene, dispatcher, nav, destination, id, position, rotationY, palette } = args;
  const width = args.width ?? 2.0;
  const height = args.height ?? 3.5;

  const doorMat = createWoodMaterial(`${id}_doorMat`, palette.door);
  const frameMat = createWoodMaterial(`${id}_frameMat`, palette.frame);
  const panelMat = createWoodMaterial(`${id}_panelMat`, palette.panel);
  const knobMat = createToyMetalMaterial(`${id}_knobMat`, palette.knob);
  const gapMat = createWoodMaterial(`${id}_gapMat`, new Color(0.07, 0.055, 0.05));

  const root = new Group();
  root.name = `${id}_doorway`;
  root.position.copy(position);
  root.rotation.y = rotationY;
  scene.add(root);

  // ── Frame casing: top bar plus two side bars, proud of the wall face ──
  const frameBar = 0.14;
  const frameDepth = 0.18;

  const topBar = new Mesh(new BoxGeometry(width + 2 * frameBar, frameBar, frameDepth), frameMat);
  topBar.name = `${id}_frameTop`;
  topBar.position.set(0, height + frameBar / 2, frameDepth / 2);
  root.add(topBar);

  [-1, 1].forEach((side, index) => {
    const sideBar = new Mesh(new BoxGeometry(frameBar, height + frameBar, frameDepth), frameMat);
    sideBar.name = `${id}_frameSide${index}`;
    sideBar.position.set(side * (width / 2 + frameBar / 2), (height + frameBar) / 2, frameDepth / 2);
    root.add(sideBar);
  });

  // ── Dark opening behind the ajar slab ──
  const gap = new Mesh(new PlaneGeometry(width, height), gapMat);
  gap.name = `${id}_gap`;
  gap.position.set(0, height / 2, 0.02);
  root.add(gap);

  // ── Door slab on a hinge pivot at the -X edge, swinging into the room ──
  const pivot = new Group();
  pivot.name = `${id}_pivot`;
  pivot.position.set(-width / 2, 0, frameDepth / 2);
  pivot.rotation.y = DOOR_IDLE_ANGLE;
  root.add(pivot);

  const slab = new Mesh(new BoxGeometry(width, height, DOOR_THICKNESS), doorMat);
  slab.name = `${id}_slab`;
  slab.position.set(width / 2, height / 2, 0);
  slab.castShadow = true;
  pivot.add(slab);

  // ── Classic four-panel face: mid rail plus recessed inset boxes ──
  const railThickness = 0.1;
  const midRailY = height * 0.48;
  const midRail = new Mesh(new BoxGeometry(width - 0.3, railThickness, DOOR_THICKNESS + 0.01), panelMat);
  midRail.name = `${id}_midRail`;
  midRail.position.set(0, midRailY - height / 2, 0);
  slab.add(midRail);

  const panelWidth = width - 0.5;
  const panelGap = 0.14;
  const insetDepth = 0.03;
  const topPanelHeight = height - midRailY - railThickness / 2 - 2 * panelGap;
  const bottomPanelHeight = midRailY - railThickness / 2 - 2 * panelGap;
  const panelSlots: Array<{ centerY: number; panelHeight: number }> = [
    { centerY: midRailY + railThickness / 2 + panelGap + topPanelHeight / 2, panelHeight: topPanelHeight },
    { centerY: panelGap + bottomPanelHeight / 2, panelHeight: bottomPanelHeight },
  ];

  panelSlots.forEach((slot, index) => {
    [1, -1].forEach((face) => {
      const inset = new Mesh(new BoxGeometry(panelWidth, slot.panelHeight, insetDepth), panelMat);
      inset.name = `${id}_panel${index}${face > 0 ? 'Front' : 'Back'}`;
      inset.position.set(0, slot.centerY - height / 2, face * (DOOR_THICKNESS / 2 - insetDepth / 2 + 0.004));
      slab.add(inset);
    });
  });

  // ── Knob on the +X edge (opposite the hinge), both faces ──
  const knobY = midRailY - height / 2;
  const plate = new Mesh(new BoxGeometry(0.07, 0.18, 0.01), knobMat);
  plate.name = `${id}_knobPlate`;
  plate.position.set(width * 0.36, knobY, DOOR_THICKNESS / 2 + 0.005);
  slab.add(plate);

  [1, -1].forEach((face) => {
    const knob = new Mesh(new SphereGeometry(0.055, 12, 10), knobMat);
    knob.name = `${id}_knob${face > 0 ? 'Front' : 'Back'}`;
    knob.position.set(width * 0.36, knobY, face * (DOOR_THICKNESS / 2 + 0.045));
    slab.add(knob);

    const stem = new Mesh(new CylinderGeometry(0.016, 0.016, 0.05, 8), knobMat);
    stem.name = `${id}_knobStem${face > 0 ? 'Front' : 'Back'}`;
    stem.position.set(0, 0, -face * 0.03);
    stem.rotation.x = Math.PI / 2;
    knob.add(stem);
  });

  // ── Tap: creaky open sound, swing further ajar, then navigate ──
  let pendingNav = false;
  const onTap = () => {
    if (pendingNav) return;
    pendingNav = true;

    // `sfx_hub_toybox_open` opens with a creaky wooden thunk, so it carries
    // the door-creak role until a dedicated creak SFX exists.
    triggerSound('sfx_hub_toybox_open');

    gsap.killTweensOf(pivot.rotation);
    gsap.to(pivot.rotation, {
      y: DOOR_OPEN_ANGLE,
      duration: 0.45,
      ease: 'power2.inOut',
      onComplete: () => {
        nav.navigateTo(destination);
        pendingNav = false;
        pivot.rotation.y = DOOR_IDLE_ANGLE;
      },
    });
  };

  const unregister = dispatcher.register(root, onTap);

  return {
    root,
    dispose: () => {
      unregister();
      gsap.killTweensOf(pivot.rotation);
    },
  };
}

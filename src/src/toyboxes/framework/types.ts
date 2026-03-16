import type { Camera, ColorRepresentation, Group, Mesh, MeshStandardMaterial, Object3D, Scene } from 'three';
import type { OwlCompanion } from '@app/entities/owl';
import type { NavigationActions, SceneId } from '@app/types/scenes';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';

export type ToyboxVariantId = 'classic' | 'animals-open-box' | 'dresser';
export type ToyboxEmblemKind = 'stars' | 'clover' | 'heart';

export interface ToyboxPlacement {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale?: number;
}

export interface ToyboxPalette {
  base: ColorRepresentation;
  accent: ColorRepresentation;
}

export interface ToyboxInteractionOptions {
  hoverEmissiveStrength: number;
  pulseScale: number;
  tapSoundId: string;
  openSoundId: string;
}

export interface ToyboxSpec {
  id: string;
  destination: SceneId | null;
  variant: ToyboxVariantId;
  placement: ToyboxPlacement;
  palette: ToyboxPalette;
  emblem?: ToyboxEmblemKind | null;
  interaction?: Partial<ToyboxInteractionOptions>;
}

export interface ToyboxAnimationTarget {
  object: Object3D;
  propertyPath: 'rotation.x' | 'rotation.z' | 'position.z';
  peakValue: number;
  settleValue: number;
}

export interface ToyboxRuntime {
  root: Group;
  hoverMaterials: MeshStandardMaterial[];
  pickMeshes: Mesh[];
  openAnimations: ToyboxAnimationTarget[];
}

export interface InteractiveToyboxHandle {
  root: Group;
  dispose: () => void;
}

export interface CreateInteractiveToyboxArgs {
  scene: Scene;
  canvas: HTMLCanvasElement;
  camera: Camera;
  dispatcher: WorldTapDispatcher;
  owl: OwlCompanion;
  nav: NavigationActions;
  spec: ToyboxSpec;
}

export type ToyboxVariantBuilder = (spec: ToyboxSpec) => ToyboxRuntime;

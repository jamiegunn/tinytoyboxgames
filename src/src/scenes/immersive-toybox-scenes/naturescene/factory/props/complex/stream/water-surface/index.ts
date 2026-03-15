import { Color, DoubleSide, Mesh, ShaderMaterial } from 'three';
import waterVert from '../shaders/stream.vert.glsl?raw';
import waterFrag from '../shaders/stream.frag.glsl?raw';
import { createRibbonGeometry } from '../shared/ribbon';
import type { StreamContext, StreamParent } from '../shared/types';

export interface WaterSurfaceResult {
  mesh: Mesh;
  killAnimation: () => void;
}

/**
 * Builds the animated water surface mesh with a custom shader and adds it to the parent.
 * @param parent - The parent object to attach the water mesh to
 * @param context - The stream context providing curve and width data
 * @returns The water surface mesh and a cleanup function for the animation loop.
 */
export function createWaterSurface(parent: StreamParent, context: StreamContext): WaterSurfaceResult {
  const waterUniforms = {
    uTime: { value: 0.0 },
    uDeepColor: { value: new Color(0.05, 0.14, 0.17) },
    uShallowColor: { value: new Color(0.29, 0.44, 0.36) },
    uSpecularColor: { value: new Color(0.98, 0.96, 0.9) },
    uSkyColor: { value: new Color(0.5, 0.68, 0.76) },
    uSubsurfaceColor: { value: new Color(0.12, 0.18, 0.1) },
    uFlowSpeed: { value: 0.32 },
    uOpacity: { value: 0.84 },
  };

  const water = new Mesh(
    createRibbonGeometry(context, {
      lengthSegments: 96,
      widthSegments: 12,
      widthFor: context.getWaterWidth,
      edgeJitter: 0.08,
    }),
    new ShaderMaterial({
      name: 'streamWaterShader',
      uniforms: waterUniforms,
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    }),
  );

  water.name = 'stream';
  water.position.set(0, 0.038, 0);
  water.receiveShadow = true;
  parent.add(water);

  let animFrame = 0;
  const tick = () => {
    animFrame = requestAnimationFrame(tick);
    waterUniforms.uTime.value = performance.now() * 0.001;
  };
  tick();

  return {
    mesh: water,
    killAnimation: () => cancelAnimationFrame(animFrame),
  };
}

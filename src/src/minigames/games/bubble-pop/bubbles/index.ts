export {
  applyBubbleMaterial,
  positionBubbleAtSpawn,
  createBubble,
  resetBubble,
  spawnGoldenBurst,
  disposeBubble,
  disposeSharedShineMat,
  resetBubbleIndex,
} from './lifecycle';

export {
  updateBubbleMotion,
  updateBubbleWobble,
  updateIridescence,
  popBubbleEffect,
  tickPopAnimations,
  clearPopAnimations,
  createTapFallbackSparkle,
  disposePopTexture,
} from './effects';

export { triggerChainPop, triggerWobbleChain, tapGiantBubble } from './rules';

export { createTargetByKind, updateSpecialTargetVisuals, getTargetColor, collectTargetMeshes } from './targets';
export { createCannonballMesh, createCannonballShadow, updateCannonball, createTrailParticle } from './cannonball';
export { aimCannon, fireCannonAnimation, updateCannonIdle, getCannonMouthPosition } from './cannon';
export {
  spawnTargetExplosion,
  spawnWaterSplash,
  spawnMuzzleFlash,
  spawnGoldenSparkle,
  spawnRainbowRing,
  spawnOceanSparkle,
  spawnTrailParticle,
  spawnBonusCoins,
  spawnScoreIndicator,
  updateParticles,
  updateFragments,
  updateCoins,
} from './effects';
export { spawnTarget, recycleTarget, spawnCannonball, recycleCannonball, getAllTargetMeshes } from './lifecycle';

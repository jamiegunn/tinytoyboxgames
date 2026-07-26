export { createTargetByKind, updateSpecialTargetVisuals, getTargetColor, collectTargetMeshes, disposeTargetMaterials } from './targets';
export { createCannonballMesh, createCannonballShadow, updateCannonball, disposeCannonballMaterials } from './cannonball';
export { aimCannon, aimCannonAlong, fireCannonAnimation, updateCannonIdle, getCannonMouthPosition } from './cannon';
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
  disposeEffectMaterials,
} from './effects';
export { spawnTarget, recycleTarget, spawnCannonball, recycleCannonball, getAllTargetMeshes } from './lifecycle';

export { setupScene, teardownScene, type SceneEnvironment } from './setup';
export { updateCausticLights, updateGodRays, updateSeaweedSway, updateAnemoneSway, updateEnvironmentReactions } from './effects';
export { getTerrainHeight } from './terrain';
export { REEF_REGIONS, HOME_SAND, sampleRegion, floorAlbedoAt, regionFishMultiplier, type ReefRegion, type RegionSample, type Albedo } from './regions';
export * from './ambientLife';

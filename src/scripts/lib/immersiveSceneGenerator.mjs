import path from 'node:path';
import { promises as fs } from 'node:fs';

const TEMPLATE_ROOT = path.join('templates', 'immersive-scene');
const OUTPUT_ROOT = path.join('src', 'scenes', 'immersive-toybox-scenes');
const SCENE_CATALOG_PATH = path.join('src', 'scenes', 'sceneCatalog.ts');
const MINI_GAME_MANIFEST_PATH = path.join('src', 'minigames', 'framework', 'MiniGameManifest.ts');
const SCENE_CATALOG_MARKER = '// __IMMERSIVE_SCENE_GENERATOR_ENTRY_MARKER__';
const DEFAULT_PARENT_SCENE_STUB_RELATIVE_PATHS = [path.join('parent-scene-stubs', 'playroom.toybox.stub.ts')];

/**
 * Validates the CLI / generator scene id.
 *
 * The generator only accepts lowercase kebab-case ids because they become
 * folder names, route segments, and object keys in the central scene catalog.
 *
 * @param {string} sceneId - Candidate scene id.
 */
export function validateSceneId(sceneId) {
  if (!/^[a-z][a-z0-9-]*$/.test(sceneId)) {
    throw new Error(`Invalid scene id "${sceneId}". Use lowercase kebab-case like "moonlit-meadow".`);
  }
}

/**
 * Validates the human-readable display name.
 *
 * @param {string} displayName - Scene display name entered by the user.
 */
export function validateDisplayName(displayName) {
  if (!displayName.trim()) {
    throw new Error('Display name is required.');
  }
}

/**
 * Recursively copies the canonical template tree while replacing placeholder
 * tokens in every file.
 *
 * @param {string} sourceDir - Template source directory.
 * @param {string} targetDir - Output directory for the generated scene.
 * @param {Record<string, string>} replacements - Placeholder replacement map.
 * @param {string[]} createdFiles - Mutable list used for reporting.
 */
export async function copyTemplateDirectory(sourceDir, targetDir, replacements, createdFiles) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyTemplateDirectory(sourcePath, targetPath, replacements, createdFiles);
      continue;
    }

    let content = await fs.readFile(sourcePath, 'utf8');
    for (const [token, value] of Object.entries(replacements)) {
      content = content.replaceAll(token, value);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf8');
    createdFiles.push(targetPath);
  }
}

/**
 * Inserts a new scene registration entry into the central scene catalog.
 *
 * @param {string} source - Current contents of `sceneCatalog.ts`.
 * @param {{ sceneId: string, displayName: string }} params - Scene metadata.
 * @returns {string} Updated catalog source.
 */
export function addSceneCatalogEntry(source, { sceneId, displayName }) {
  if (!source.includes(SCENE_CATALOG_MARKER)) {
    throw new Error('Scene catalog marker was not found. Generator cannot update sceneCatalog.ts safely.');
  }

  if (source.includes(`'${sceneId}': {`) || source.includes(`${sceneId}: {`)) {
    throw new Error(`Scene "${sceneId}" is already registered in sceneCatalog.ts.`);
  }

  const escapedDisplayName = displayName.replaceAll("'", "\\'");
  const entry = [
    `  '${sceneId}': {`,
    `    displayName: '${escapedDisplayName}',`,
    `    kind: 'immersive-toybox',`,
    `    loader: () => import('@app/scenes/immersive-toybox-scenes/${sceneId}'),`,
    '    cameraPreset: {',
    '      azimuth: 0,',
    '      polar: 1.2,',
    '      distance: 10,',
    '      target: [0, 0.3, 0],',
    '      constraints: {',
    '        maxAzimuthRange: 0.12,',
    '        minPolar: 1.14,',
    '        maxPolar: 1.24,',
    '        minDistance: 9,',
    '        maxDistance: 10,',
    '        panRangeX: 1.4,',
    '        minTargetY: 0.2,',
    '        maxTargetY: 0.45,',
    '        ceilingY: 4.8,',
    '      },',
    '    },',
    `    audio: null,`,
    '  },',
  ].join('\n');

  return source.replace(SCENE_CATALOG_MARKER, `${entry}\n  ${SCENE_CATALOG_MARKER}`);
}

/**
 * Adds a generated scene to Bubble Pop's `launchableFrom` list.
 *
 * This keeps hash-route validation honest for generated immersive scenes that
 * ship with Bubble Pop by default.
 *
 * @param {string} source - Current contents of `MiniGameManifest.ts`.
 * @param {string} sceneId - Generated scene id.
 * @returns {string} Updated manifest source.
 */
export function addSceneToBubblePopLaunchableFrom(source, sceneId) {
  const pattern = /(id:\s*'bubble-pop'[\s\S]*?launchableFrom:\s*\[)([^\]]*)(\])/m;
  const match = source.match(pattern);

  if (!match) {
    throw new Error('Bubble Pop manifest entry was not found. Generator cannot update MiniGameManifest.ts safely.');
  }

  if (match[2].includes(`'${sceneId}'`)) {
    return source;
  }

  const currentItems = match[2].trim();
  const nextItems = currentItems ? `${currentItems}, '${sceneId}'` : `'${sceneId}'`;
  return source.replace(pattern, `$1${nextItems}$3`);
}

/**
 * Returns the generated parent-scene stub file paths for a new immersive scene.
 *
 * The initial generator contract creates a Playroom toybox stub but keeps the
 * return shape extensible so future parent scenes can be added without a CLI
 * redesign.
 *
 * @param {string} outputDir - Absolute output directory for the generated scene.
 * @returns {string[]} Absolute parent-scene stub file paths.
 */
export function getParentSceneStubPaths(outputDir) {
  return DEFAULT_PARENT_SCENE_STUB_RELATIVE_PATHS.map((relativePath) => path.join(outputDir, relativePath));
}

/**
 * Generates a new immersive scene from the canonical template and updates the
 * central registration surfaces the runtime needs.
 *
 * @param {{
 *   packageRoot: string,
 *   sceneId: string,
 *   displayName: string,
 * }} params - Generator configuration.
 * @returns {Promise<{ outputDir: string, createdFiles: string[], updatedFiles: string[], stubFiles: string[] }>}
 */
export async function generateImmersiveScene({ packageRoot, sceneId, displayName }) {
  validateSceneId(sceneId);
  validateDisplayName(displayName);

  const templateDir = path.join(packageRoot, TEMPLATE_ROOT);
  const outputDir = path.join(packageRoot, OUTPUT_ROOT, sceneId);
  const sceneCatalogPath = path.join(packageRoot, SCENE_CATALOG_PATH);
  const miniGameManifestPath = path.join(packageRoot, MINI_GAME_MANIFEST_PATH);

  const templateStat = await fs.stat(templateDir).catch(() => null);
  if (!templateStat?.isDirectory()) {
    throw new Error(`Template directory was not found: ${templateDir}`);
  }

  const existingOutput = await fs.stat(outputDir).catch(() => null);
  if (existingOutput) {
    throw new Error(`Output directory already exists: ${outputDir}`);
  }

  const replacements = {
    __SCENE_ID__: sceneId,
    __SCENE_DISPLAY_NAME__: displayName,
  };

  const createdFiles = [];
  await copyTemplateDirectory(templateDir, outputDir, replacements, createdFiles);

  const currentSceneCatalog = await fs.readFile(sceneCatalogPath, 'utf8');
  const currentMiniGameManifest = await fs.readFile(miniGameManifestPath, 'utf8');

  const nextSceneCatalog = addSceneCatalogEntry(currentSceneCatalog, { sceneId, displayName });
  const nextMiniGameManifest = addSceneToBubblePopLaunchableFrom(currentMiniGameManifest, sceneId);

  await fs.writeFile(sceneCatalogPath, nextSceneCatalog, 'utf8');
  await fs.writeFile(miniGameManifestPath, nextMiniGameManifest, 'utf8');

  return {
    outputDir,
    createdFiles,
    updatedFiles: [sceneCatalogPath, miniGameManifestPath],
    stubFiles: getParentSceneStubPaths(outputDir),
  };
}

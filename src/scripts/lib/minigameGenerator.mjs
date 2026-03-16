import path from 'node:path';
import { promises as fs } from 'node:fs';
import { copyTemplateDirectory, validateDisplayName, validateSceneId as validateKebabId } from './immersiveSceneGenerator.mjs';

const TEMPLATE_ROOT = path.join('templates', 'minigame');
const OUTPUT_ROOT = path.join('src', 'minigames', 'games');
const MINI_GAME_MANIFEST_PATH = path.join('src', 'minigames', 'framework', 'MiniGameManifest.ts');
const MINI_GAME_MANIFEST_MARKER = '// __MINIGAME_GENERATOR_ENTRY_MARKER__';

/**
 * Validates the CLI / generator minigame id.
 *
 * The generator reuses the same lowercase kebab-case rule as scenes because
 * minigame ids become folder names, route segments, and manifest identifiers.
 *
 * @param {string} gameId - Candidate minigame id.
 */
export function validateGameId(gameId) {
  validateKebabId(gameId);
}

/**
 * Converts a kebab-case identifier into a stable snake_case asset id.
 *
 * @param {string} gameId - Kebab-case minigame id.
 * @returns {string} Snake-case asset identifier.
 */
function toSnakeCase(gameId) {
  return gameId.replaceAll('-', '_');
}

/**
 * Inserts a new minigame manifest entry into the central registry.
 *
 * @param {string} source - Current contents of `MiniGameManifest.ts`.
 * @param {{ gameId: string, displayName: string }} params - Minigame metadata.
 * @returns {string} Updated manifest source.
 */
export function addMiniGameManifestEntry(source, { gameId, displayName }) {
  if (!source.includes(MINI_GAME_MANIFEST_MARKER)) {
    throw new Error('Minigame manifest marker was not found. Generator cannot update MiniGameManifest.ts safely.');
  }

  if (source.includes(`id: '${gameId}'`)) {
    throw new Error(`Mini-game "${gameId}" is already registered in MiniGameManifest.ts.`);
  }

  const escapedDisplayName = displayName.replaceAll("'", "\\'");
  const entry = [
    '  {',
    `    id: '${gameId}',`,
    `    displayName: '${escapedDisplayName}',`,
    `    description: 'Tap glowing targets before they drift away in ${escapedDisplayName}.',`,
    `    launchableFrom: ['nature'],`,
    `    inputModes: ['tap'],`,
    `    themeColor: '#8FD3FF',`,
    `    iconAssetId: '${toSnakeCase(gameId)}_icon',`,
    '    comboWindowSeconds: 3,',
    '    hasSpecialItems: false,',
    `    mode: 'endless',`,
    '    showScore: true,',
    '    showProgressBar: false,',
    `    load: () => import('@app/minigames/games/${gameId}'),`,
    '  },',
  ].join('\n');

  return source.replace(MINI_GAME_MANIFEST_MARKER, `${entry}\n  ${MINI_GAME_MANIFEST_MARKER}`);
}

/**
 * Generates a new minigame from the canonical template and updates the central
 * minigame manifest.
 *
 * @param {{
 *   packageRoot: string,
 *   gameId: string,
 *   displayName: string,
 * }} params - Generator configuration.
 * @returns {Promise<{ outputDir: string, createdFiles: string[], updatedFiles: string[] }>}
 */
export async function generateMiniGame({ packageRoot, gameId, displayName }) {
  validateGameId(gameId);
  validateDisplayName(displayName);

  const templateDir = path.join(packageRoot, TEMPLATE_ROOT);
  const outputDir = path.join(packageRoot, OUTPUT_ROOT, gameId);
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
    __GAME_ID__: gameId,
    __GAME_DISPLAY_NAME__: displayName,
  };

  const createdFiles = [];
  await copyTemplateDirectory(templateDir, outputDir, replacements, createdFiles);

  const currentMiniGameManifest = await fs.readFile(miniGameManifestPath, 'utf8');
  const nextMiniGameManifest = addMiniGameManifestEntry(currentMiniGameManifest, { gameId, displayName });
  await fs.writeFile(miniGameManifestPath, nextMiniGameManifest, 'utf8');

  return {
    outputDir,
    createdFiles,
    updatedFiles: [miniGameManifestPath],
  };
}

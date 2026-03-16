import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { generateRoomScene } from './lib/roomSceneGenerator.mjs';

/**
 * Parses the small CLI surface for room scene generation.
 *
 * Supported flags:
 * - `--scene-id`
 * - `--display-name`
 *
 * @param {string[]} argv - Raw CLI arguments after the script name.
 * @returns {{ sceneId: string | null, displayName: string | null }}
 */
function parseArgs(argv) {
  const result = {
    sceneId: null,
    displayName: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--scene-id') {
      result.sceneId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--display-name') {
      result.displayName = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return result;
}

/**
 * Prints the CLI usage contract.
 */
function printUsage() {
  console.log('Usage: npm run create:room-scene -- --scene-id <kebab-case-id> --display-name "<Display Name>"');
}

const args = parseArgs(process.argv.slice(2));
if (!args.sceneId || !args.displayName) {
  printUsage();
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');

try {
  const result = await generateRoomScene({
    packageRoot,
    sceneId: args.sceneId,
    displayName: args.displayName,
  });

  console.log(`Generated room scene "${args.sceneId}" in ${result.outputDir}`);
  console.log(`Created ${result.createdFiles.length} files and updated ${result.updatedFiles.length} registry files.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[create-room-scene] ${message}`);
  process.exit(1);
}

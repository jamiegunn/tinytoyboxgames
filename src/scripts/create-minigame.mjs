import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { generateMiniGame } from './lib/minigameGenerator.mjs';

/**
 * Parses the small CLI surface for minigame generation.
 *
 * Supported flags:
 * - `--game-id`
 * - `--display-name`
 *
 * @param {string[]} argv - Raw CLI arguments after the script name.
 * @returns {{ gameId: string | null, displayName: string | null }}
 */
function parseArgs(argv) {
  const result = {
    gameId: null,
    displayName: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--game-id') {
      result.gameId = argv[index + 1] ?? null;
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
  console.log('Usage: npm run create:minigame -- --game-id <kebab-case-id> --display-name "<Display Name>"');
}

const args = parseArgs(process.argv.slice(2));
if (!args.gameId || !args.displayName) {
  printUsage();
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');

try {
  const result = await generateMiniGame({
    packageRoot,
    gameId: args.gameId,
    displayName: args.displayName,
  });

  console.log(`Generated minigame "${args.gameId}" in ${result.outputDir}`);
  console.log(`Created ${result.createdFiles.length} files and updated ${result.updatedFiles.length} registry files.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Update the manifest description in src/minigames/framework/MiniGameManifest.ts');
  console.log('  2. Add a portal icon builder for this game in src/minigames/framework/gamePortal.ts');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[create-minigame] ${message}`);
  process.exit(1);
}

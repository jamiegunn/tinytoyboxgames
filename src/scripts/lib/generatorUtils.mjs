import path from 'node:path';
import { promises as fs } from 'node:fs';

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
 * @param {{ skipFiles?: string[], renameMap?: Record<string, string> }} [options] - Optional copy options.
 */
export async function copyTemplateDirectory(sourceDir, targetDir, replacements, createdFiles, options = {}) {
  const { skipFiles = [], renameMap = {} } = options;

  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (skipFiles.includes(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const outputName = renameMap[entry.name] ?? entry.name;
    const targetPath = path.join(targetDir, outputName);

    if (entry.isDirectory()) {
      await copyTemplateDirectory(sourcePath, targetPath, replacements, createdFiles, { renameMap });
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

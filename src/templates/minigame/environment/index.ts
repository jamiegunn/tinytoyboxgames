/**
 * Public environment surface for the generated minigame.
 *
 * Keeping the re-export barrel small makes the orchestration file easier to
 * read while preserving a stable place for environment-specific ownership.
 */

export { setupTemplateEnvironment, teardownTemplateEnvironment, updateTemplateEnvironment } from './setup';

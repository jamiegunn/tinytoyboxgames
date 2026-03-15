import type { MiniGameId } from '@app/types/scenes';
import { getGameEntry } from './MiniGameManifest';
import { MiniGameShell } from './MiniGameShell';

/** Props for the MiniGameRouter component. */
interface MiniGameRouterProps {
  activeGameId: MiniGameId | null;
  onGameExit: () => void;
}

/**
 * Orchestrates the mini-game loading screen and shell mounting.
 * When activeGameId transitions from null to a valid ID, looks up the manifest
 * entry and renders the LoadingScreen and MiniGameShell. Renders nothing when
 * no game is active.
 *
 * @param props - The active game identifier and exit callback.
 * @returns The loading screen and game shell, or null when idle.
 */
export function MiniGameRouter({ activeGameId, onGameExit }: MiniGameRouterProps) {
  console.log(`[MiniGameRouter] render: activeGameId=${activeGameId}`);
  if (activeGameId === null) {
    return null;
  }

  const entry = getGameEntry(activeGameId);
  console.log(`[MiniGameRouter] manifest entry for ${activeGameId}:`, entry ? entry.displayName : 'NOT FOUND');
  if (!entry) {
    // Unknown game ID -- silently exit
    console.error(`[MiniGameRouter] No manifest entry for ${activeGameId} — exiting`);
    onGameExit();
    return null;
  }

  return <MiniGameShell gameId={activeGameId} manifest={entry} onExit={onGameExit} />;
}

import type { SpawnConfig, SpawnScheduler } from './types';

/** Internal state for a registered spawn entry. */
interface SpawnEntry {
  config: SpawnConfig;
  timerId: ReturnType<typeof setTimeout> | null;
  paused: boolean;
}

/** Counter for generating unique spawn registration IDs. */
let nextId = 0;

/**
 * Creates a spawn scheduler that manages periodic entity spawning with jitter and capacity limits.
 * @returns A SpawnScheduler instance.
 */
export function createSpawnScheduler(): SpawnScheduler {
  const entries = new Map<string, SpawnEntry>();
  let globalPaused = false;

  /**
   * Schedules the next spawn cycle for an entry.
   * @param id - The registration ID.
   * @param entry - The spawn entry to schedule.
   */
  function scheduleNext(id: string, entry: SpawnEntry): void {
    if (entry.paused || globalPaused) {
      entry.timerId = null;
      return;
    }

    const jitter = entry.config.jitterSeconds ?? 0;
    const delay = (entry.config.intervalSeconds + Math.random() * jitter) * 1000;

    entry.timerId = setTimeout(() => {
      // Check if entry still exists (may have been cancelled)
      if (!entries.has(id)) return;

      const { maxCount, activeCount, spawn } = entry.config;
      const shouldSpawn = maxCount === undefined || activeCount === undefined || activeCount() < maxCount;

      if (shouldSpawn) {
        spawn();
      }

      // Schedule next cycle
      scheduleNext(id, entry);
    }, delay);
  }

  return {
    register(config: SpawnConfig): string {
      const id = `spawn_${nextId++}`;
      const entry: SpawnEntry = {
        config,
        timerId: null,
        paused: false,
      };
      entries.set(id, entry);
      scheduleNext(id, entry);
      return id;
    },

    cancel(id: string): void {
      const entry = entries.get(id);
      if (entry) {
        if (entry.timerId !== null) {
          clearTimeout(entry.timerId);
        }
        entries.delete(id);
      }
    },

    pauseAll(): void {
      globalPaused = true;
      for (const entry of entries.values()) {
        entry.paused = true;
        if (entry.timerId !== null) {
          clearTimeout(entry.timerId);
          entry.timerId = null;
        }
      }
    },

    resumeAll(): void {
      globalPaused = false;
      for (const [id, entry] of entries) {
        entry.paused = false;
        scheduleNext(id, entry);
      }
    },

    clearAll(): void {
      for (const entry of entries.values()) {
        if (entry.timerId !== null) {
          clearTimeout(entry.timerId);
        }
      }
      entries.clear();
      globalPaused = false;
    },
  };
}

import type { OwlCleanup, OwlRuntimeDisposer } from './types';

/**
 * Tracks timers and ad-hoc cleanup work for the owl runtime so the public entry
 * point can tear everything down with one call.
 *
 * @returns Timer and cleanup controls for the owl runtime.
 */
export function createOwlRuntimeDisposer(): OwlRuntimeDisposer {
  let disposed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const cleanups = new Set<OwlCleanup>();

  const schedule = (fn: OwlCleanup, delayMs: number): void => {
    if (disposed) return;

    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) {
        fn();
      }
    }, delayMs);

    timers.add(timer);
  };

  const addCleanup = (cleanup: OwlCleanup): void => {
    if (disposed) {
      cleanup();
      return;
    }

    cleanups.add(cleanup);
  };

  const removeCleanup = (cleanup: OwlCleanup): void => {
    cleanups.delete(cleanup);
  };

  const disposeAll = (): void => {
    if (disposed) return;
    disposed = true;

    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();

    for (const cleanup of Array.from(cleanups)) {
      cleanup();
    }
    cleanups.clear();
  };

  return {
    isDisposed: () => disposed,
    schedule,
    addCleanup,
    removeCleanup,
    disposeAll,
  };
}

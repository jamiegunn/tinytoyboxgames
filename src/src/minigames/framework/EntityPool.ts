import type { EntityPool, EntityPoolConfig } from './types';

/** Default maximum number of entities to keep in the pool. */
const DEFAULT_MAX_POOL_SIZE = 50;

/**
 * Creates an entity pool for recycling objects to reduce garbage collection pressure.
 * @param config - Pool configuration with create, reset, and dispose callbacks.
 * @returns An EntityPool instance.
 */
export function createEntityPool<T>(config: EntityPoolConfig<T>): EntityPool<T> {
  const { create, reset, dispose, maxPoolSize = DEFAULT_MAX_POOL_SIZE } = config;

  const pool: T[] = [];
  const active = new Set<T>();

  return {
    get activeCount(): number {
      return active.size;
    },

    get pooledCount(): number {
      return pool.length;
    },

    acquire(): T {
      const entity = pool.length > 0 ? pool.pop()! : create();
      active.add(entity);
      return entity;
    },

    release(entity: T): void {
      if (!active.has(entity)) return;
      active.delete(entity);
      reset(entity);

      if (pool.length < maxPoolSize) {
        pool.push(entity);
      } else {
        dispose(entity);
      }
    },

    prewarm(count: number): void {
      for (let i = 0; i < count; i++) {
        const entity = create();
        reset(entity);
        if (pool.length < maxPoolSize) {
          pool.push(entity);
        } else {
          dispose(entity);
        }
      }
    },

    dispose(): void {
      for (const entity of active) {
        dispose(entity);
      }
      active.clear();

      for (const entity of pool) {
        dispose(entity);
      }
      pool.length = 0;
    },
  };
}

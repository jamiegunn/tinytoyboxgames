/**
 * 2D spatial hash grid for O(n) neighbor queries.
 * Used by soft-body repulsion and chain-pop radius checks.
 */

/** An entry in the spatial hash. */
export interface SpatialEntry<T> {
  item: T;
  x: number;
  y: number;
}

/** A spatial hash grid for fast 2D proximity queries. */
export interface SpatialHash<T> {
  /** Clears all entries. Call once per frame before inserting. */
  clear(): void;
  /** Inserts an item at a position. */
  insert(item: T, x: number, y: number): void;
  /** Returns all items within radius of (x, y). Reuses internal result array. */
  queryRadius(x: number, y: number, radius: number): readonly SpatialEntry<T>[];
}

/**
 * Creates a new spatial hash grid.
 * @param cellSize - Grid cell size in world units. Should be >= max query radius.
 * @returns A SpatialHash instance.
 */
export function createSpatialHash<T>(cellSize: number): SpatialHash<T> {
  const cells = new Map<number, SpatialEntry<T>[]>();
  const resultBuffer: SpatialEntry<T>[] = [];
  const entryPool: SpatialEntry<T>[] = [];
  let poolIndex = 0;

  // Pre-allocate entry pool
  for (let i = 0; i < 64; i++) {
    entryPool.push({ item: null as unknown as T, x: 0, y: 0 });
  }

  function key(cx: number, cy: number): number {
    // Cantor pairing with offset to handle negatives
    const a = cx + 1000;
    const b = cy + 1000;
    return a * 3001 + b;
  }

  function cellCoord(v: number): number {
    return Math.floor(v / cellSize);
  }

  return {
    clear(): void {
      cells.clear();
      poolIndex = 0;
    },

    insert(item: T, x: number, y: number): void {
      const cx = cellCoord(x);
      const cy = cellCoord(y);
      const k = key(cx, cy);

      let entry: SpatialEntry<T>;
      if (poolIndex < entryPool.length) {
        entry = entryPool[poolIndex++];
        entry.item = item;
        entry.x = x;
        entry.y = y;
      } else {
        entry = { item, x, y };
        entryPool.push(entry);
        poolIndex++;
      }

      const bucket = cells.get(k);
      if (bucket) {
        bucket.push(entry);
      } else {
        cells.set(k, [entry]);
      }
    },

    queryRadius(x: number, y: number, radius: number): readonly SpatialEntry<T>[] {
      resultBuffer.length = 0;
      const r2 = radius * radius;
      const minCx = cellCoord(x - radius);
      const maxCx = cellCoord(x + radius);
      const minCy = cellCoord(y - radius);
      const maxCy = cellCoord(y + radius);

      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const bucket = cells.get(key(cx, cy));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            const e = bucket[i];
            const dx = e.x - x;
            const dy = e.y - y;
            if (dx * dx + dy * dy <= r2) {
              resultBuffer.push(e);
            }
          }
        }
      }

      return resultBuffer;
    },
  };
}

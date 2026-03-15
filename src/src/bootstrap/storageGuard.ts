/**
 * Storage Guard Bootstrap Module
 *
 * MUST be the first import in main.tsx — runs before React loads.
 * Patches all browser persistence APIs to warn-and-no-op.
 * Ref: 05-app-architecture-spec §5, ADR-0003
 */

const WARN = '[StorageGuard] Blocked persistence API call:';

function patchStorage(storage: Storage, name: string): void {
  Object.defineProperty(storage, 'getItem', {
    value: (_key: string) => null,
    writable: false,
  });
  Object.defineProperty(storage, 'setItem', {
    value: (_key: string, _value: string) => {
      console.warn(`${WARN} ${name}.setItem()`);
    },
    writable: false,
  });
  Object.defineProperty(storage, 'removeItem', {
    value: (_key: string) => {
      console.warn(`${WARN} ${name}.removeItem()`);
    },
    writable: false,
  });
  Object.defineProperty(storage, 'clear', {
    value: () => {
      console.warn(`${WARN} ${name}.clear()`);
    },
    writable: false,
  });
  Object.defineProperty(storage, 'key', {
    value: (_index: number) => null,
    writable: false,
  });
  Object.defineProperty(storage, 'length', {
    get: () => 0,
  });
}

// Patch localStorage and sessionStorage
try {
  patchStorage(window.localStorage, 'localStorage');
} catch {
  /* already frozen */
}
try {
  patchStorage(window.sessionStorage, 'sessionStorage');
} catch {
  /* already frozen */
}

// Patch document.cookie
try {
  Object.defineProperty(document, 'cookie', {
    get: () => '',
    set: () => {
      console.warn(`${WARN} document.cookie setter`);
    },
    configurable: false,
  });
} catch {
  /* already patched */
}

// Patch indexedDB
try {
  Object.defineProperty(indexedDB, 'open', {
    value: (name: string, _version?: number) => {
      console.warn(`${WARN} indexedDB.open("${name}")`);
      // Return a fake IDBOpenDBRequest that fires error
      const fakeRequest = {
        result: null,
        error: new DOMException('Storage blocked by StorageGuard', 'NotAllowedError'),
        readyState: 'done' as IDBRequestReadyState,
        source: null,
        transaction: null,
        onerror: null as ((ev: Event) => void) | null,
        onsuccess: null as ((ev: Event) => void) | null,
        onupgradeneeded: null as ((ev: Event) => void) | null,
        onblocked: null as ((ev: Event) => void) | null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };
      // Fire error asynchronously
      queueMicrotask(() => {
        if (fakeRequest.onerror) {
          fakeRequest.onerror(new Event('error'));
        }
      });
      return fakeRequest as unknown as IDBOpenDBRequest;
    },
    writable: false,
  });
  Object.defineProperty(indexedDB, 'deleteDatabase', {
    value: (name: string) => {
      console.warn(`${WARN} indexedDB.deleteDatabase("${name}")`);
      const fakeRequest = {
        result: undefined,
        error: null,
        readyState: 'done' as IDBRequestReadyState,
        source: null,
        transaction: null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        onupgradeneeded: null as ((ev: Event) => void) | null,
        onblocked: null as ((ev: Event) => void) | null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };
      queueMicrotask(() => {
        if (fakeRequest.onsuccess) {
          fakeRequest.onsuccess(new Event('success'));
        }
      });
      return fakeRequest as unknown as IDBOpenDBRequest;
    },
    writable: false,
  });
} catch {
  /* environment without indexedDB */
}

// Patch Cache API
try {
  if (typeof caches !== 'undefined') {
    Object.defineProperty(window, 'caches', {
      value: {
        open: (_name: string) => {
          console.warn(`${WARN} caches.open()`);
          return Promise.reject(new DOMException('Storage blocked by StorageGuard', 'NotAllowedError'));
        },
        match: () => Promise.resolve(undefined),
        has: () => Promise.resolve(false),
        keys: () => Promise.resolve([]),
        delete: () => Promise.resolve(false),
      },
      writable: false,
      configurable: false,
    });
  }
} catch {
  /* environment without caches */
}

export {};

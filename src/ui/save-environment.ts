import type { SaveStorage } from '../sim/save';

export const RESPONSIVE_PREVIEW_PARAM = 'ti-responsive-preview';
type SaveLocks = Pick<LockManager, 'request'> | null;

interface SaveEnvironmentContext {
  search: string;
  framed: boolean;
  getLocks: () => SaveLocks;
  getLocalStorage: () => SaveStorage;
}

/** The hosted QA frame gets a private save library that dies with that frame. */
export function createSaveEnvironment(context: SaveEnvironmentContext) {
  if (context.framed && new URLSearchParams(context.search).get(RESPONSIVE_PREVIEW_PARAM) === '1') {
    const entries = new Map<string, string>();
    const memory: SaveStorage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => { entries.set(key, value); },
    };
    // Do not even consult the browser's storage or lock getters in this branch.
    return { temporary: true, locks: null, storage: (_readOnly?: boolean): SaveStorage => memory };
  }

  const locks = context.getLocks();
  return {
    temporary: false,
    locks,
    storage(readOnly = !locks): SaveStorage | null {
      try {
        const local = context.getLocalStorage();
        // Browsers without Web Locks can read/export, but must not race writers.
        return !readOnly ? local : {
          getItem: (key: string) => local.getItem(key),
          setItem: () => { throw new Error('Safe local saving is unavailable in this browser. Export your game or use a current browser.'); },
        };
      } catch {
        return null;
      }
    },
  };
}

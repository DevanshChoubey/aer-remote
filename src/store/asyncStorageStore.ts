import type { DispenserStore, SavedDispenser } from './types';

export interface KeyValueStorage {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}

const KEY = 'aer.dispensers.v1';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isSaved = (v: unknown): v is SavedDispenser =>
  isRecord(v) &&
  typeof v.id === 'string' &&
  typeof v.name === 'string' &&
  typeof v.homeTimeZone === 'string';

export function createAsyncStorageStore(storage: KeyValueStorage): DispenserStore {
  const subs = new Set<() => void>();
  let tail: Promise<unknown> = Promise.resolve();

  const read = async (): Promise<SavedDispenser[]> => {
    const raw = await storage.getItem(KEY);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isSaved) : [];
    } catch {
      // Corrupt data: start over rather than lock the user out of the app.
      return [];
    }
  };

  /** Writes read-modify-write the one key, so they run one at a time. */
  const mutate = (change: (all: SavedDispenser[]) => SavedDispenser[]): Promise<void> => {
    const run = tail.then(async () => {
      await storage.setItem(KEY, JSON.stringify(change(await read())));
    });
    tail = run.catch(() => undefined);
    return run.then(() => {
      for (const cb of [...subs]) cb();
    });
  };

  return {
    list: async () => {
      await tail;
      return read();
    },
    get: async (id) => {
      await tail;
      return (await read()).find((d) => d.id === id) ?? null;
    },
    upsert: (d) =>
      mutate((all) =>
        all.some((x) => x.id === d.id) ? all.map((x) => (x.id === d.id ? d : x)) : [...all, d],
      ),
    remove: (id) => mutate((all) => all.filter((x) => x.id !== id)),
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

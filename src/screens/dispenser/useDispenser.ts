import { useCallback, useEffect, useRef, useState } from 'react';

import { useServices, type Interval, type SavedDispenser } from '@/core';
import { errorCopyKey } from '@/screens/errorCopy';

export type Busy = 'refresh' | 'spray' | 'auto' | 'refill' | 'remove' | null;

export interface DispenserView {
  /** null until the first read, and when the dispenser is not saved (`missing`). */
  dispenser: SavedDispenser | null;
  loaded: boolean;
  missing: boolean;
  /** What is running against the dispenser right now. */
  busy: Busy;
  /** errors.* copy key for the last failed action. */
  errorKey: string | null;
  refresh: () => Promise<void>;
  sprayNow: () => Promise<void>;
  setAutoSpray: (interval: Interval | null) => Promise<void>;
  resetRefill: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  /** True when the dispenser was removed from the app. */
  remove: () => Promise<boolean>;
}

/**
 * One saved dispenser: the cached copy straight away, then a refresh over Bluetooth. After any
 * failure the screen shows the stored (read-back) state, never a guess.
 */
export function useDispenser(id: string): DispenserView {
  const { client, store } = useServices();
  const [dispenser, setDispenser] = useState<SavedDispenser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Busy>('refresh');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const alive = useRef(true);

  const reread = useCallback(async (): Promise<void> => {
    try {
      const d = await store.get(id);
      if (alive.current) {
        setDispenser(d);
        setLoaded(true);
      }
    } catch (e) {
      console.error('Could not read the saved dispenser', e);
      if (alive.current) setLoaded(true);
    }
  }, [store, id]);

  useEffect(() => {
    alive.current = true;
    const load = (): void => {
      store
        .get(id)
        .then((d) => {
          if (alive.current) {
            setDispenser(d);
            setLoaded(true);
          }
        })
        .catch((e: unknown) => {
          console.error('Could not read the saved dispenser', e);
          if (alive.current) setLoaded(true);
        });
    };
    load();
    const unsubscribe = store.subscribe(load);
    return () => {
      alive.current = false;
      unsubscribe();
    };
  }, [store, id]);

  const act = useCallback(
    async (kind: Exclude<Busy, null>, fn: () => Promise<unknown>): Promise<boolean> => {
      setBusy(kind);
      setErrorKey(null);
      let ok = true;
      try {
        await fn();
      } catch (e) {
        ok = false;
        if (alive.current) setErrorKey(errorCopyKey(e));
      }
      if (alive.current) setBusy(null);
      await reread();
      return ok;
    },
    [reread],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await act('refresh', () => client.refresh(id));
  }, [act, client, id]);

  // Check the dispenser once on open (busy starts as 'refresh'); cached data is already on screen.
  useEffect(() => {
    client
      .refresh(id)
      .catch((e: unknown) => {
        if (alive.current) setErrorKey(errorCopyKey(e));
      })
      .finally(() => {
        if (alive.current) setBusy(null);
        void reread();
      });
  }, [client, id, reread]);

  return {
    dispenser,
    loaded,
    missing: loaded && dispenser === null,
    busy,
    errorKey,
    refresh,
    sprayNow: async () => {
      await act('spray', () => client.sprayNow(id));
    },
    setAutoSpray: async (interval) => {
      await act('auto', () => client.setAutoSpray(id, interval));
    },
    resetRefill: async () => {
      await act('refill', () => client.resetRefill(id));
    },
    rename: async (name) => {
      try {
        await client.rename(id, name);
      } catch (e) {
        setErrorKey(errorCopyKey(e));
      }
      await reread();
    },
    remove: () => act('remove', () => client.remove(id)),
  };
}

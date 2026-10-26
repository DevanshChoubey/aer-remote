import { useCallback, useEffect, useState } from 'react';

import { useServices, type SavedDispenser } from '@/core';

interface Loaded {
  dispensers: SavedDispenser[];
  loaded: boolean;
  failed: boolean;
}

export interface DispensersState extends Loaded {
  /** Reads the list again, e.g. after a failed load. */
  reload: () => void;
}

/** The saved dispensers, re-read whenever the store changes. Never touches Bluetooth. */
export function useDispensers(): DispensersState {
  const { store } = useServices();
  const [state, setState] = useState<Loaded>({
    dispensers: [],
    loaded: false,
    failed: false,
  });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback((): void => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    let latest = 0;
    const load = (): void => {
      latest += 1;
      const mine = latest;
      store
        .list()
        .then((dispensers) => {
          if (alive && mine === latest) setState({ dispensers, loaded: true, failed: false });
        })
        .catch((e: unknown) => {
          console.error('Could not read saved dispensers', e);
          if (alive && mine === latest) setState((s) => ({ ...s, loaded: true, failed: true }));
        });
    };
    load();
    const unsubscribe = store.subscribe(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [store, attempt]);
  return { ...state, reload };
}

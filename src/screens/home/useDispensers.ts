import { useEffect, useState } from 'react';

import { useServices, type SavedDispenser } from '@/core';

export interface DispensersState {
  dispensers: SavedDispenser[];
  loaded: boolean;
  failed: boolean;
}

/** The saved dispensers, re-read whenever the store changes. Never touches Bluetooth. */
export function useDispensers(): DispensersState {
  const { store } = useServices();
  const [state, setState] = useState<DispensersState>({
    dispensers: [],
    loaded: false,
    failed: false,
  });
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
  }, [store]);
  return state;
}

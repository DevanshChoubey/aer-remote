import { useCallback, useEffect, useRef, useState } from 'react';

import { useServices } from '@/core';

export interface FoundDispenser {
  id: string;
  name: string | null;
  rssi: number | null;
}

export type ScanStatus = 'scanning' | 'done' | 'error';

export interface ScanState {
  /** Unsaved dispensers in range, strongest signal first. */
  devices: FoundDispenser[];
  status: ScanStatus;
  error: unknown;
  /** True once the scan ran long enough with nothing found to suggest what to check. */
  showHelp: boolean;
  start: () => void;
  stop: () => void;
}

export const SCAN_MS = 15000;

const strength = (d: FoundDispenser): number => d.rssi ?? Number.NEGATIVE_INFINITY;

/** Scans for dispensers that are not saved yet; starts on mount, stops on unmount. */
export function useScan(): ScanState {
  const { client, store } = useServices();
  const [devices, setDevices] = useState<FoundDispenser[]>([]);
  const [status, setStatus] = useState<ScanStatus>('scanning');
  const [error, setError] = useState<unknown>(null);
  const [waited, setWaited] = useState(false);
  const active = useRef<{ stop(): void } | null>(null);
  const run = useRef(0);

  const stop = useCallback((): void => {
    run.current += 1;
    active.current?.stop();
    active.current = null;
  }, []);

  /** Starts a scan; state is already in its "scanning, nothing found" shape. */
  const begin = useCallback((): void => {
    stop();
    const mine = run.current;
    const current = (): boolean => run.current === mine;
    store
      .list()
      .then((saved) => {
        if (!current()) return;
        const known = new Set(saved.map((d) => d.id));
        const handle = client.scan((found) => {
          if (!current() || known.has(found.id)) return;
          setDevices((list) =>
            [...list.filter((d) => d.id !== found.id), found].sort(
              (a, b) => strength(b) - strength(a),
            ),
          );
        }, SCAN_MS);
        active.current = handle;
        return handle.done.then(() => {
          if (current()) setStatus('done');
        });
      })
      .catch((e: unknown) => {
        if (!current()) return;
        setError(e);
        setStatus('error');
      });
  }, [client, store, stop]);

  const start = useCallback((): void => {
    setDevices([]);
    setError(null);
    setWaited(false);
    setStatus('scanning');
    begin();
  }, [begin]);

  useEffect(() => {
    begin();
    return stop;
  }, [begin, stop]);

  useEffect(() => {
    if (status !== 'scanning') return undefined;
    const timer = setTimeout(() => setWaited(true), SCAN_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const showHelp = devices.length === 0 && status !== 'error' && (waited || status === 'done');
  return { devices, status, error, showHelp, start, stop };
}

import { useCallback, useEffect, useRef, useState } from 'react';

import { useServices } from '@/core';

export interface FoundDispenser {
  id: string;
  name: string | null;
  rssi: number | null;
  /** 1-based label number, fixed when the device is first seen. */
  n: number;
}

export type ScanStatus = 'scanning' | 'done' | 'error';

export interface ScanState {
  /** Unsaved Bluetooth devices in range, in the order they were first found. */
  devices: FoundDispenser[];
  status: ScanStatus;
  error: unknown;
  /** True once the scan ran long enough with nothing found to suggest what to check. */
  showHelp: boolean;
  start: () => void;
  stop: () => void;
}

export const SCAN_MS = 15000;

/**
 * Scans for devices that are not saved yet; starts on mount, stops on unmount. Every device is
 * listed: a real dispenser does not advertise its service, and adding one checks for it.
 */
export function useScan(): ScanState {
  const { client, store } = useServices();
  const [devices, setDevices] = useState<FoundDispenser[]>([]);
  const [status, setStatus] = useState<ScanStatus>('scanning');
  const [error, setError] = useState<unknown>(null);
  const [waited, setWaited] = useState(false);
  const active = useRef<{ stop(): void } | null>(null);
  const run = useRef(0);
  const labels = useRef(new Map<string, number>());

  /** Ends the running scan without touching state (safe in cleanup). */
  const halt = useCallback((): void => {
    run.current += 1;
    active.current?.stop();
    active.current = null;
  }, []);

  /** Stops scanning and keeps the list on screen. */
  const stop = useCallback((): void => {
    halt();
    setStatus((s) => (s === 'scanning' ? 'done' : s));
  }, [halt]);

  /** Starts a scan; state is already in its "scanning, nothing found" shape. */
  const begin = useCallback((): void => {
    halt();
    const mine = run.current;
    const current = (): boolean => run.current === mine;
    store
      .list()
      .then((saved) => {
        if (!current()) return;
        const known = new Set(saved.map((d) => d.id));
        const handle = client.scan((found) => {
          if (!current() || known.has(found.id)) return;
          let n = labels.current.get(found.id);
          if (n === undefined) {
            n = labels.current.size + 1;
            labels.current.set(found.id, n);
          }
          const seen: FoundDispenser = { ...found, n };
          setDevices((list) =>
            list.some((d) => d.id === found.id)
              ? list.map((d) => (d.id === found.id ? seen : d))
              : [...list, seen],
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
  }, [client, store, halt]);

  const start = useCallback((): void => {
    setDevices([]);
    setError(null);
    setWaited(false);
    setStatus('scanning');
    begin();
  }, [begin]);

  useEffect(() => {
    begin();
    return halt;
  }, [begin, halt]);

  useEffect(() => {
    if (status !== 'scanning') return undefined;
    const timer = setTimeout(() => setWaited(true), SCAN_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const showHelp = devices.length === 0 && status !== 'error' && (waited || status === 'done');
  return { devices, status, error, showHelp, start, stop };
}

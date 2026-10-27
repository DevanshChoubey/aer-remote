import type { KeyValueStorage } from '@/store/asyncStorageStore';

/** When an alert was delivered, and which cycle it was for. */
export interface DeliveredAlert {
  /** ISO time the alert was delivered. */
  at: string;
  /**
   * The cycle the alert belongs to: the sprays since refill for a refill alert, 'set' for a
   * battery alert, the planned-from status time for a check-in.
   */
  cycle: string;
}

/** Delivered alerts, keyed by alert key. */
export type AlertState = Record<string, DeliveredAlert>;

export interface AlertStateStore {
  /** The saved state; {} when nothing valid is saved. */
  load(): Promise<AlertState>;
  save(s: AlertState): Promise<void>;
  /** True unless the user has switched alerts off. */
  enabled(): Promise<boolean>;
  setEnabled(on: boolean): Promise<void>;
}

const STATE_KEY = 'aer.alerts.v1';
const ENABLED_KEY = 'aer.alerts.enabled';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function createAlertStateStore(storage: KeyValueStorage): AlertStateStore {
  return {
    async load() {
      try {
        const raw = await storage.getItem(STATE_KEY);
        if (raw === null) return {};
        const parsed: unknown = JSON.parse(raw);
        return isRecord(parsed) ? (parsed as AlertState) : {};
      } catch (e) {
        // Corrupt data: start over rather than repeat or hide alerts forever.
        console.warn('Could not read the alert state', e);
        return {};
      }
    },
    save: (s) => storage.setItem(STATE_KEY, JSON.stringify(s)),
    async enabled() {
      try {
        return (await storage.getItem(ENABLED_KEY)) !== 'false';
      } catch (e) {
        console.warn('Could not read the alerts switch', e);
        return true;
      }
    },
    setEnabled: (on) => storage.setItem(ENABLED_KEY, on ? 'true' : 'false'),
  };
}

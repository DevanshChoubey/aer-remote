import { t } from '@/i18n';
import { batteryPercent } from '@/protocol/status';
import type { DispenserStore, SavedDispenser } from '@/store/types';
import { planAlerts } from './plan';
import type { AlertKind, PlannedAlert } from './plan';
import type { AlertPermission, AlertScheduler } from './scheduler';
import type { AlertState, AlertStateStore } from './state';

export interface Alerts {
  /** First sync (never asks), then a sync on every store change (may ask). Returns stop. */
  start(): () => void;
  /** Runs one at a time. Never rejects: failures are logged and later syncs still run. */
  sync(opts: { mayAsk: boolean }): Promise<void>;
  enabled(): Promise<boolean>;
  /** Off cancels every pending alert; on syncs, and may ask for permission. */
  setEnabled(on: boolean): Promise<void>;
  permission(): Promise<AlertPermission>;
  pendingKeys(): Promise<string[]>;
  /** Calls back with the tapped dispenser's id, or null when it is no longer saved. */
  onOpen(cb: (dispenserId: string | null) => void): () => void;
}

export interface AlertsDeps {
  store: DispenserStore;
  scheduler: AlertScheduler;
  state: AlertStateStore;
  now?: () => Date;
  phoneTimeZone?: () => string;
}

const BATTERY_CYCLE = 'set';
const BATTERY_REARM_PERCENT = 30;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keeps only entries shaped like a delivered alert; anything else counts as absent. */
function cleanState(raw: unknown): AlertState {
  const clean: AlertState = {};
  if (!isRecord(raw)) return clean;
  for (const [key, v] of Object.entries(raw)) {
    if (!isRecord(v) || typeof v.cycle !== 'string') continue;
    if (typeof v.at !== 'string' && typeof v.at !== 'number') continue;
    const ms = new Date(v.at).getTime();
    if (!Number.isFinite(ms)) continue;
    clean[key] = { at: new Date(ms).toISOString(), cycle: v.cycle };
  }
  return clean;
}

const dispenserIdOf = (key: string): string => key.slice(0, Math.max(key.lastIndexOf(':'), 0));

/** Each severe kind with the milder kind it supersedes. */
const SEVERE_OVER: Partial<Record<AlertKind, AlertKind>> = {
  batteryFlat: 'batteryLow',
  refillOut: 'refillLow',
};

function cycleFor(kind: AlertKind, d: SavedDispenser): string {
  const status = d.lastStatus;
  if (kind === 'refillLow' || kind === 'refillOut') return String(status?.spraysSinceRefill ?? 0);
  if (kind === 'checkIn') return status?.at ?? '';
  return BATTERY_CYCLE;
}

/** A cancelled alert that never fired is not delivered: forget its state. */
function forgetUnfired(delivered: AlertState, key: string, now: Date): boolean {
  const d = delivered[key];
  if (d === undefined || new Date(d.at).getTime() <= now.getTime()) return false;
  delete delivered[key];
  return true;
}

function warn(what: string, e: unknown): void {
  console.warn(what, e);
}

export function createAlerts(deps: AlertsDeps): Alerts {
  const { store, scheduler, state } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const phoneTimeZone =
    deps.phoneTimeZone ?? ((): string => Intl.DateTimeFormat().resolvedOptions().timeZone);
  let tail: Promise<unknown> = Promise.resolve();

  /** Runs `job` after everything queued so far; never rejects and never blocks the next job. */
  const enqueue = (job: () => Promise<void>): Promise<void> => {
    const run = tail.then(job).catch((e: unknown) => warn('Alert sync failed', e));
    tail = run;
    return run;
  };

  const attempt = async (what: string, op: () => Promise<unknown>): Promise<boolean> => {
    try {
      await op();
      return true;
    } catch (e) {
      warn(what, e);
      return false;
    }
  };

  const syncOnce = async (mayAsk: boolean): Promise<void> => {
    if (!(await state.enabled())) return;
    const at = now();
    const dispensers = await store.list();
    const saved = new Set(dispensers.map((d) => d.id));
    const delivered = cleanState(await state.load());
    let changed = false;
    const pending = await scheduler.pendingKeys();

    // Gone dispensers: cancel their pending alerts and forget their state.
    for (const key of pending) {
      if (!saved.has(dispenserIdOf(key)))
        await attempt('Could not cancel an alert', () => scheduler.cancel(key));
    }
    for (const key of Object.keys(delivered)) {
      if (saved.has(dispenserIdOf(key))) continue;
      delete delivered[key];
      changed = true;
    }

    const collapses: { key: string; cycle: string; severeKey: string; severeDone: boolean }[] = [];
    const toSchedule: { alert: PlannedAlert; dispenser: SavedDispenser }[] = [];
    for (const dispenser of dispensers) {
      const status = dispenser.lastStatus;
      const id = dispenser.id;
      const planned = planAlerts({ dispenser, now: at, phoneTimeZone: phoneTimeZone() });
      const byKind = new Map(planned.map((p) => [p.kind, p]));
      const forget = (kind: AlertKind): void => {
        const key = `${id}:${kind}`;
        if (key in delivered) {
          delete delivered[key];
          changed = true;
        }
      };

      // Re-arm: a new can, new batteries or a newer reading start a fresh cycle.
      if (status) {
        for (const kind of ['refillLow', 'refillOut'] as const) {
          const stored = Number(delivered[`${id}:${kind}`]?.cycle);
          if (status.spraysSinceRefill < stored) forget(kind);
        }
        const batteryPct = batteryPercent(status.batteryMv);
        if (batteryPct > BATTERY_REARM_PERCENT) {
          forget('batteryLow');
          forget('batteryFlat');
        }
        if (delivered[`${id}:checkIn`]?.cycle !== status.at) forget('checkIn');
      }

      const isDelivered = (kind: AlertKind): boolean => {
        const d = delivered[`${id}:${kind}`];
        return d !== undefined && new Date(d.at).getTime() <= at.getTime();
      };

      // Severe only: when the worse alert is due with its milder one, announce the worse and
      // count the milder as delivered for this cycle so it does not fire later.
      const dropped = new Set<AlertKind>();
      for (const [severe, milder] of Object.entries(SEVERE_OVER) as [AlertKind, AlertKind][]) {
        const worse = byKind.get(severe);
        const mild = byKind.get(milder);
        if (!worse || !mild || isDelivered(milder) || worse.at.getTime() > mild.at.getTime())
          continue;
        collapses.push({
          key: mild.key,
          cycle: cycleFor(milder, dispenser),
          severeKey: worse.key,
          severeDone: isDelivered(severe),
        });
        dropped.add(milder);
      }
      for (const alert of planned) {
        if (isDelivered(alert.kind) || dropped.has(alert.kind)) continue;
        toSchedule.push({ alert, dispenser });
      }
    }

    // Cancel pending alerts that are no longer planned (or no longer due).
    const wanted = new Set(toSchedule.map((s) => s.alert.key));
    for (const key of pending) {
      if (saved.has(dispenserIdOf(key)) && !wanted.has(key)) {
        await attempt('Could not cancel an alert', () => scheduler.cancel(key));
        if (forgetUnfired(delivered, key, at)) changed = true;
      }
    }

    const scheduledKeys = new Set<string>();
    let permission = await scheduler.permission();
    if (toSchedule.length > 0 && permission === 'undetermined' && mayAsk) {
      permission = await scheduler.requestPermission();
    }
    if (permission === 'granted') {
      for (const { alert, dispenser } of toSchedule) {
        const vars = { name: dispenser.name };
        const ok = await attempt('Could not schedule an alert', () =>
          scheduler.schedule({
            key: alert.key,
            dispenserId: alert.dispenserId,
            at: alert.at,
            title: t(`alerts.${alert.kind}Title`),
            body: t(`alerts.${alert.kind}`, vars),
          }),
        );
        if (!ok) continue;
        scheduledKeys.add(alert.key);
        delivered[alert.key] = {
          at: alert.at.toISOString(),
          cycle: cycleFor(alert.kind, dispenser),
        };
        changed = true;
      }
    }
    // Count the milder alert as delivered only once the worse one is out or already delivered.
    for (const c of collapses) {
      if (!c.severeDone && !scheduledKeys.has(c.severeKey)) continue;
      delivered[c.key] = { at: at.toISOString(), cycle: c.cycle };
      changed = true;
    }
    if (changed) await attempt('Could not save the alert state', () => state.save(delivered));
  };

  const sync = ({ mayAsk }: { mayAsk: boolean }): Promise<void> => enqueue(() => syncOnce(mayAsk));

  return {
    start() {
      void sync({ mayAsk: false });
      return store.subscribe(() => {
        void sync({ mayAsk: true });
      });
    },
    sync,
    enabled: () => state.enabled(),
    setEnabled: (on) =>
      enqueue(async () => {
        await attempt('Could not save the alerts switch', () => state.setEnabled(on));
        if (on) await syncOnce(true);
        else {
          await attempt('Could not cancel alerts', () => scheduler.cancelAll());
          await attempt('Could not save the alert state', async () => {
            const kept = cleanState(await state.load());
            let changed = false;
            for (const key of Object.keys(kept)) {
              if (forgetUnfired(kept, key, now())) changed = true;
            }
            if (changed) await state.save(kept);
          });
        }
      }),
    permission: () => scheduler.permission(),
    pendingKeys: () => scheduler.pendingKeys(),
    onOpen(cb) {
      return scheduler.onOpen((id) => {
        void (async () => {
          try {
            cb((await store.get(id)) ? id : null);
          } catch (e) {
            warn('Could not look up the opened dispenser', e);
            cb(null);
          }
        })();
      });
    },
  };
}

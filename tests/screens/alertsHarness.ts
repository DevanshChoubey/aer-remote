import { createAlerts, createAlertStateStore, type Alerts } from '@/alerts';
import { createFakeScheduler, type FakeScheduler } from '@/alerts/testing/fakeScheduler';
import type { DispenserStore } from '@/store/types';

/** Real alerts engine over a fake scheduler and an in-memory state, so no test loads native code. */
export function fakeAlerts(store: DispenserStore): { alerts: Alerts; scheduler: FakeScheduler } {
  const mem = new Map<string, string>();
  const scheduler = createFakeScheduler(() => new Date());
  const alerts = createAlerts({
    store,
    scheduler,
    state: createAlertStateStore({
      getItem: async (k) => mem.get(k) ?? null,
      setItem: async (k, v) => {
        mem.set(k, v);
      },
    }),
  });
  return { alerts, scheduler };
}

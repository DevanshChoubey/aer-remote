import type { AlertPermission, AlertScheduler, ScheduledAlert } from '../scheduler';

export interface FakeScheduler extends AlertScheduler {
  scheduled: Map<string, ScheduledAlert>;
  setPermission(p: AlertPermission): void;
  requestCount: number;
  tap(dispenserId: string): void;
}

/** In-memory scheduler. A requested permission is granted unless the test set it to denied. */
export function createFakeScheduler(now: () => Date): FakeScheduler {
  const scheduled = new Map<string, ScheduledAlert>();
  const listeners = new Set<(dispenserId: string) => void>();
  let current: AlertPermission = 'undetermined';
  const fake: FakeScheduler = {
    scheduled,
    requestCount: 0,
    setPermission(p) {
      current = p;
    },
    tap(dispenserId) {
      for (const cb of [...listeners]) cb(dispenserId);
    },
    async permission() {
      return current;
    },
    async requestPermission() {
      fake.requestCount += 1;
      if (current === 'undetermined') current = 'granted';
      return current;
    },
    async pendingKeys() {
      return [...scheduled.keys()];
    },
    async schedule(a) {
      // A time that has passed fires now, so it is no longer pending.
      if (a.at.getTime() <= now().getTime()) scheduled.delete(a.key);
      else scheduled.set(a.key, a);
    },
    async cancel(key) {
      scheduled.delete(key);
    },
    async cancelAll() {
      scheduled.clear();
    },
    onOpen(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
  return fake;
}

import { createAlerts } from '@/alerts/engine';
import type { Alerts } from '@/alerts/engine';
import { createAlertStateStore } from '@/alerts/state';
import type { AlertState, AlertStateStore } from '@/alerts/state';
import { createFakeScheduler } from '@/alerts/testing/fakeScheduler';
import type { Schedule } from '@/protocol/schedule';
import type { KeyValueStorage } from '@/store/asyncStorageStore';
import { createMemoryStore } from '@/store/memoryStore';
import type { SavedDispenser } from '@/store/types';

const KOLKATA = 'Asia/Kolkata';
const READING = '2026-11-02T10:00:00+05:30';
const NOW = new Date(READING);
const DAY = 86_400_000;

const everyDay: Schedule = {
  start: { h: 8, m: 0 },
  end: { h: 16, m: 0 },
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  interval: 20,
};

function dispenser(
  over: { spraysSinceRefill?: number; batteryMv?: number; at?: string; name?: string } = {},
  id = 'abc',
): SavedDispenser {
  return {
    id,
    name: over.name ?? 'Hall',
    homeTimeZone: KOLKATA,
    lastStatus: {
      at: over.at ?? READING,
      batteryMv: over.batteryMv ?? 3000,
      firmware: '1',
      autoSpray: null,
      scheduleRunning: false,
      spraysSinceRefill: over.spraysSinceRefill ?? 0,
    },
    schedules: { list: [everyDay], at: over.at ?? READING },
  };
}

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
}

function setup(opts: { now?: Date; state?: AlertStateStore; storage?: KeyValueStorage } = {}) {
  let clock = opts.now ?? NOW;
  const store = createMemoryStore();
  const scheduler = createFakeScheduler(() => clock);
  const state = opts.state ?? createAlertStateStore(opts.storage ?? memoryStorage());
  const alerts: Alerts = createAlerts({
    store,
    scheduler,
    state,
    now: () => clock,
    phoneTimeZone: () => KOLKATA,
  });
  return {
    store,
    scheduler,
    state,
    alerts,
    setNow: (d: Date) => {
      clock = d;
    },
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('alert engine', () => {
  it('schedules refill, battery and check-in alerts after a reading', async () => {
    const { store, scheduler, alerts } = setup();
    scheduler.setPermission('granted');
    alerts.start();
    await store.upsert(dispenser({ spraysSinceRefill: 1900, batteryMv: 2500 }));
    await settle();
    await alerts.sync({ mayAsk: true });
    expect([...scheduler.scheduled.keys()].sort()).toEqual([
      'abc:checkIn',
      'abc:refillLow',
      'abc:refillOut',
    ]);
    expect(scheduler.scheduled.get('abc:refillLow')).toMatchObject({
      dispenserId: 'abc',
      title: 'Refill running low',
      body: 'Hall is almost out of refill.',
    });
    expect(scheduler.scheduled.get('abc:refillOut')).toMatchObject({
      title: 'Out of refill',
      body: 'Hall is out of refill. Put in a new can, then tap I refilled it.',
    });
    expect(scheduler.scheduled.get('abc:checkIn')).toMatchObject({
      title: 'Time for a check',
      body: "It's been a while. Open Aer Remote to check Hall.",
    });
  });

  it('already past fires once, not on the next launch', async () => {
    const storage = memoryStorage();
    const first = setup({ storage });
    first.scheduler.setPermission('granted');
    const spy = jest.spyOn(first.scheduler, 'schedule');
    await first.store.upsert(dispenser({ spraysSinceRefill: 2000 }));
    await first.alerts.sync({ mayAsk: false });
    expect(spy.mock.calls.map((c) => c[0].key)).toContain('abc:refillLow');

    const second = setup({ storage, now: new Date(NOW.getTime() + DAY) });
    second.scheduler.setPermission('granted');
    await second.store.upsert(dispenser({ spraysSinceRefill: 2000 }));
    const spy2 = jest.spyOn(second.scheduler, 'schedule');
    await second.alerts.sync({ mayAsk: false });
    expect(spy2.mock.calls.map((c) => c[0].key)).not.toContain('abc:refillLow');
  });

  it('a passed delivery is not rescheduled', async () => {
    const state = createAlertStateStore(
      memoryStorage({
        'aer.alerts.v1': JSON.stringify({
          'abc:checkIn': { at: '2026-11-16T09:00:00+05:30', cycle: READING },
        }),
      }),
    );
    const t = setup({ state, now: new Date('2026-11-17T10:00:00+05:30') });
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser());
    const spy = jest.spyOn(t.scheduler, 'schedule');
    await t.alerts.sync({ mayAsk: false });
    expect(spy.mock.calls.map((c) => c[0].key)).not.toContain('abc:checkIn');
  });

  it('a refill reset re-arms', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 2000 }));
    await t.alerts.sync({ mayAsk: false });
    expect((await t.state.load())['abc:refillLow']?.cycle).toBe('2000');
    t.setNow(new Date(NOW.getTime() + 60_000));
    await t.store.upsert(
      dispenser({ spraysSinceRefill: 0, at: new Date(NOW.getTime() + 60_000).toISOString() }),
    );
    await t.alerts.sync({ mayAsk: false });
    // The old delivery is forgotten; a new refillLow is scheduled in the future for cycle 0.
    expect((await t.state.load())['abc:refillLow']?.cycle).toBe('0');
    expect(t.scheduler.scheduled.has('abc:refillLow')).toBe(true);
  });

  it('new batteries re-arm the battery alert', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    await t.state.save({ 'abc:batteryLow': { at: NOW.toISOString(), cycle: 'set' } });
    await t.store.upsert(dispenser({ batteryMv: 3000 }));
    await t.alerts.sync({ mayAsk: false });
    expect((await t.state.load())['abc:batteryLow']).toBeUndefined();
    t.setNow(new Date(NOW.getTime() + 60_000));
    await t.store.upsert(dispenser({ batteryMv: 2430 }));
    await t.alerts.sync({ mayAsk: false });
    expect((await t.state.load())['abc:batteryLow']).toBeDefined();
  });

  it('cancels keys of dispensers no longer saved', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.sync({ mayAsk: false });
    await t.scheduler.schedule({
      key: 'gone:refillLow',
      dispenserId: 'gone',
      at: new Date(NOW.getTime() + DAY),
      title: 'x',
      body: 'y',
    });
    await t.state.save({
      ...(await t.state.load()),
      'gone:refillLow': { at: NOW.toISOString(), cycle: '1' },
    });
    await t.store.remove('abc');
    await t.alerts.sync({ mayAsk: false });
    expect([...t.scheduler.scheduled.keys()]).toEqual([]);
    expect(await t.state.load()).toEqual({});
  });

  it('never asks at launch, asks after a store change', async () => {
    const t = setup();
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    const stop = t.alerts.start();
    await settle();
    expect(t.scheduler.requestCount).toBe(0);
    await t.store.upsert(dispenser({ spraysSinceRefill: 1901 }));
    await settle();
    expect(t.scheduler.requestCount).toBe(1);
    expect(t.scheduler.scheduled.size).toBeGreaterThan(0);
    stop();
  });

  it('denied schedules nothing and does not ask again', async () => {
    const t = setup();
    t.scheduler.setPermission('denied');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.sync({ mayAsk: true });
    await t.alerts.sync({ mayAsk: true });
    expect(t.scheduler.scheduled.size).toBe(0);
    expect(t.scheduler.requestCount).toBe(0);
    expect(await t.alerts.permission()).toBe('denied');
  });

  it('asks on its own only once, even when the phone could ask again', async () => {
    const storage = memoryStorage();
    const t = setup({ storage });
    // Refused, but the phone still lets the app ask (Android 13+ after one refusal).
    t.scheduler.answer = 'undetermined';
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.sync({ mayAsk: true });
    await t.alerts.sync({ mayAsk: true });
    expect(t.scheduler.requestCount).toBe(1);
    expect(t.scheduler.scheduled.size).toBe(0);

    // A later launch on the same saved state does not ask either.
    const next = setup({ storage });
    await next.store.upsert(dispenser({ spraysSinceRefill: 1901 }));
    await next.alerts.sync({ mayAsk: true });
    expect(next.scheduler.requestCount).toBe(0);
  });

  it('turning the switch on asks again while the phone allows it', async () => {
    const t = setup();
    t.scheduler.answer = 'undetermined';
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.sync({ mayAsk: true });
    expect(t.scheduler.requestCount).toBe(1);
    await t.alerts.setEnabled(false);
    t.scheduler.answer = 'granted';
    await t.alerts.setEnabled(true);
    expect(t.scheduler.requestCount).toBe(2);
    expect(t.scheduler.scheduled.size).toBeGreaterThan(0);
  });

  it('turning the switch on does not ask when the phone will not', async () => {
    const t = setup();
    t.scheduler.setPermission('denied');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.setEnabled(false);
    await t.alerts.setEnabled(true);
    expect(t.scheduler.requestCount).toBe(0);
    expect(t.scheduler.scheduled.size).toBe(0);
  });

  it('switching off cancels everything; switching on schedules again', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.sync({ mayAsk: false });
    expect(t.scheduler.scheduled.size).toBeGreaterThan(0);
    await t.alerts.setEnabled(false);
    expect(await t.alerts.enabled()).toBe(false);
    expect(t.scheduler.scheduled.size).toBe(0);
    await t.alerts.sync({ mayAsk: true });
    expect(t.scheduler.scheduled.size).toBe(0);
    await t.alerts.setEnabled(true);
    expect(t.scheduler.scheduled.size).toBeGreaterThan(0);
  });

  it('a rename reschedules with the new name', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.sync({ mayAsk: false });
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900, name: 'Study' }));
    await t.alerts.sync({ mayAsk: false });
    expect(t.scheduler.scheduled.get('abc:refillLow')?.body).toBe('Study is almost out of refill.');
  });

  it('schedules only the more severe battery alert and records the low one as delivered', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    const spy = jest.spyOn(t.scheduler, 'schedule');
    await t.store.upsert(dispenser({ batteryMv: 2300 }));
    await t.alerts.sync({ mayAsk: false });
    const keys = spy.mock.calls.map((c) => c[0].key);
    expect(keys).toContain('abc:batteryFlat');
    expect(keys).not.toContain('abc:batteryLow');
    const saved = await t.state.load();
    expect(saved['abc:batteryFlat']?.cycle).toBe('set');
    expect(saved['abc:batteryLow']).toMatchObject({ cycle: 'set' });
    expect(new Date(saved['abc:batteryLow']?.at ?? '').getTime()).toBeLessThanOrEqual(
      NOW.getTime(),
    );
  });

  it('schedules only the more severe refill alert when both are due together', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    const spy = jest.spyOn(t.scheduler, 'schedule');
    await t.store.upsert(dispenser({ spraysSinceRefill: 2200 }));
    await t.alerts.sync({ mayAsk: false });
    const keys = spy.mock.calls.map((c) => c[0].key);
    expect(keys).toContain('abc:refillOut');
    expect(keys).not.toContain('abc:refillLow');
    expect((await t.state.load())['abc:refillLow']?.cycle).toBe('2200');
  });

  it('treats malformed state entries as absent', async () => {
    const state = createAlertStateStore(
      memoryStorage({
        'aer.alerts.v1': JSON.stringify({
          'abc:checkIn': 'nope',
          'abc:refillLow': { at: 'not a date', cycle: '1' },
          'abc:batteryLow': { at: NOW.toISOString(), cycle: 5 },
          'abc:refillOut': null,
        }),
      }),
    );
    const t = setup({ state });
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await expect(t.alerts.sync({ mayAsk: false })).resolves.toBeUndefined();
    expect(t.scheduler.scheduled.has('abc:checkIn')).toBe(true);
    expect(t.scheduler.scheduled.has('abc:refillLow')).toBe(true);
  });

  it('keeps syncing after a failed state save', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const base = createAlertStateStore(memoryStorage());
    let fail = true;
    const state: AlertStateStore = {
      ...base,
      save: async (s: AlertState) => {
        if (fail) {
          fail = false;
          throw new Error('disk full');
        }
        await base.save(s);
      },
    };
    const t = setup({ state });
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await expect(t.alerts.sync({ mayAsk: false })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    await expect(t.alerts.sync({ mayAsk: false })).resolves.toBeUndefined();
    expect(Object.keys(await base.load())).toContain('abc:refillLow');
    warn.mockRestore();
  });

  it('survives a scheduler failure and a failing switch write', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const base = createAlertStateStore(memoryStorage());
    const state: AlertStateStore = {
      ...base,
      setEnabled: async () => {
        throw new Error('nope');
      },
    };
    const t = setup({ state });
    t.scheduler.setPermission('granted');
    const real = t.scheduler.schedule.bind(t.scheduler);
    let boom = true;
    t.scheduler.schedule = async (a) => {
      if (boom) {
        boom = false;
        throw new Error('scheduler down');
      }
      await real(a);
    };
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await expect(t.alerts.sync({ mayAsk: false })).resolves.toBeUndefined();
    expect(t.scheduler.scheduled.size).toBeGreaterThan(0);
    await expect(t.alerts.setEnabled(false)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('forgets a cancelled alert that never fired, so it is scheduled again later', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.sync({ mayAsk: false });
    const due = t.scheduler.scheduled.get('abc:refillLow')?.at;
    expect(due).toBeDefined();
    await t.alerts.setEnabled(false);
    expect((await t.state.load())['abc:refillLow']).toBeUndefined();
    t.setNow(new Date((due?.getTime() ?? 0) + 60_000));
    await t.alerts.setEnabled(true);
    const keys = [...t.scheduler.scheduled.keys()];
    // Due time passed while off: it fires now (not pending) but is recorded, not skipped.
    expect((await t.state.load())['abc:refillLow']).toBeDefined();
    expect(keys).not.toContain('abc:refillLow');
  });

  it('forgets a pending alert cancelled because the plan dropped it', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 1900 }));
    await t.alerts.sync({ mayAsk: false });
    expect((await t.state.load())['abc:refillOut']).toBeDefined();
    await t.store.upsert({
      ...dispenser({ spraysSinceRefill: 1900 }),
      schedules: { list: [], at: READING },
    });
    await t.alerts.sync({ mayAsk: false });
    expect(t.scheduler.scheduled.has('abc:refillOut')).toBe(false);
    expect((await t.state.load())['abc:refillOut']).toBeUndefined();
  });

  it('once per can: a higher count in the same can does not repeat a delivered alert', async () => {
    const t = setup();
    t.scheduler.setPermission('granted');
    await t.store.upsert(dispenser({ spraysSinceRefill: 2000 }));
    await t.alerts.sync({ mayAsk: false });
    t.setNow(new Date(NOW.getTime() + 60_000));
    await t.store.upsert(
      dispenser({ spraysSinceRefill: 2050, at: new Date(NOW.getTime() + 60_000).toISOString() }),
    );
    const spy = jest.spyOn(t.scheduler, 'schedule');
    await t.alerts.sync({ mayAsk: false });
    expect(spy.mock.calls.map((c) => c[0].key)).not.toContain('abc:refillLow');
  });

  it('does not count the milder alert delivered while the worse one could not be scheduled', async () => {
    const t = setup();
    t.scheduler.setPermission('denied');
    await t.store.upsert(dispenser({ batteryMv: 2300 }));
    await t.alerts.sync({ mayAsk: true });
    expect((await t.state.load())['abc:batteryLow']).toBeUndefined();
  });

  it('onOpen maps an unsaved dispenser to null', async () => {
    const t = setup();
    await t.store.upsert(dispenser());
    const seen: (string | null)[] = [];
    const off = t.alerts.onOpen((id) => seen.push(id));
    t.scheduler.tap('abc');
    t.scheduler.tap('gone');
    await settle();
    expect(seen).toEqual(['abc', null]);
    off();
    t.scheduler.tap('abc');
    await settle();
    expect(seen).toHaveLength(2);
  });
});

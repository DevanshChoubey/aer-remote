import { createAsyncStorageStore } from '@/store/asyncStorageStore';
import { createMemoryStore } from '@/store/memoryStore';
import type { DispenserStore, SavedDispenser } from '@/store/types';

const a: SavedDispenser = { id: 'a', name: 'Hall', homeTimeZone: 'Asia/Kolkata' };
const b: SavedDispenser = { id: 'b', name: 'Bedroom', homeTimeZone: 'Asia/Kolkata' };

const fakeStorage = (): {
  data: Map<string, string>;
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
} => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
};

const suites: [string, () => DispenserStore][] = [
  ['memory store', () => createMemoryStore()],
  ['async storage store', () => createAsyncStorageStore(fakeStorage())],
];

describe.each(suites)('%s', (_name, make) => {
  it('round-trips upsert, get, list and remove', async () => {
    const s = make();
    expect(await s.list()).toEqual([]);
    await s.upsert(a);
    await s.upsert(b);
    await s.upsert({ ...a, name: 'Lounge' });
    expect((await s.list()).map((d) => d.name)).toEqual(['Lounge', 'Bedroom']);
    expect(await s.get('b')).toEqual(b);
    expect(await s.get('zzz')).toBeNull();
    await s.remove('a');
    expect((await s.list()).map((d) => d.id)).toEqual(['b']);
  });

  it('notifies subscribers after upsert and remove until unsubscribed', async () => {
    const s = make();
    const cb = jest.fn();
    const off = s.subscribe(cb);
    await s.upsert(a);
    await s.remove('a');
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    await s.upsert(a);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe('async storage store', () => {
  it('survives re-creation on the same storage object', async () => {
    const storage = fakeStorage();
    await createAsyncStorageStore(storage).upsert({
      ...a,
      schedules: { list: [], at: '2026-10-26T10:00:00Z' },
    });
    const again = createAsyncStorageStore(storage);
    expect(await again.get('a')).toEqual({
      ...a,
      schedules: { list: [], at: '2026-10-26T10:00:00Z' },
    });
  });

  it('treats corrupt or malformed stored JSON as an empty list', async () => {
    const storage = fakeStorage();
    const s = createAsyncStorageStore(storage);
    storage.data.set('aer.dispensers.v1', '{not json');
    expect(await s.list()).toEqual([]);
    storage.data.set('aer.dispensers.v1', '{"a":1}');
    expect(await s.list()).toEqual([]);
    await s.upsert(a);
    expect(await s.list()).toEqual([a]);
  });

  it('serialises concurrent upserts so none is lost', async () => {
    const s = createAsyncStorageStore(fakeStorage());
    await Promise.all([s.upsert(a), s.upsert(b)]);
    expect((await s.list()).map((d) => d.id).sort()).toEqual(['a', 'b']);
  });
});

import { parseSchedules, toReply } from '@/protocol/replies';
import { DEFAULT_CHANNELS, SERVICE_UUID, charUuid } from '@/protocol/uuids';

describe('replies', () => {
  it('returns null for non-maps or missing numbers', () => {
    expect(toReply('x')).toBeNull();
    expect(toReply(null)).toBeNull();
    expect(toReply([1])).toBeNull();
    expect(toReply({ mT: 'a', mN: 1 })).toBeNull();
    expect(toReply({ mT: 1 })).toBeNull();
  });

  it('reads mT, mN and ack', () => {
    const r = toReply({ mT: 157, mN: 9, ack: 200, x: 1 });
    expect(r).toEqual({ mT: 157, mN: 9, ack: 200, body: { mT: 157, mN: 9, ack: 200, x: 1 } });
    expect(toReply({ mT: 1, mN: 2 })?.ack).toBe(0);
  });

  it('parses schedules from arrays or bytes', () => {
    const a = toReply({ mT: 159, mN: 1, S: [{ s: [0x7c, 8, 0, 42, 20] }] });
    const b = toReply({ mT: 159, mN: 1, S: [{ s: new Uint8Array([0x03, 9, 30, 3, 10]) }] });
    expect(a && parseSchedules(a)).toHaveLength(1);
    expect(a && parseSchedules(a)[0]?.interval).toBe(20);
    expect(b && parseSchedules(b)[0]?.days).toEqual(['sat', 'sun']);
    const none = toReply({ mT: 159, mN: 1 });
    expect(none && parseSchedules(none)).toEqual([]);
  });

  it('skips malformed schedule entries', () => {
    const r = toReply({
      mT: 159,
      mN: 1,
      S: [{ s: [1, 2, 3] }, { s: [0x7c, 8, 0, 42, 20] }, { s: [0x7c, 8, 0, 42, 15] }],
    });
    const list = r ? parseSchedules(r) : [];
    expect(list).toHaveLength(1);
    expect(list[0]?.interval).toBe(20);
  });

  it('exposes uuids', () => {
    expect(SERVICE_UUID).toBe('6e400000-b5a3-f393-e0a9-e50e24dcca9e');
    expect(charUuid('0003')).toBe('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
    expect(DEFAULT_CHANNELS.schedule).toBe(charUuid('0004'));
  });
});

import {
  decodeScheduleEntry,
  encodeScheduleEntry,
  sprayCount,
  validateSchedule,
  type Schedule,
} from '@/protocol/schedule';

const weekdays: Schedule = {
  start: { h: 8, m: 0 },
  end: { h: 22, m: 0 },
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  interval: 20,
};

describe('schedule', () => {
  it('encodes weekday schedule', () => {
    expect(Array.from(encodeScheduleEntry(weekdays))).toEqual([0x7c, 8, 0, 42, 20]);
  });

  it('decodes back to the same schedule', () => {
    expect(decodeScheduleEntry(new Uint8Array([0x7c, 8, 0, 42, 20]))).toEqual(weekdays);
  });

  it('encodes weekend-only schedule', () => {
    const s: Schedule = {
      start: { h: 9, m: 30 },
      end: { h: 10, m: 0 },
      days: ['sat', 'sun'],
      interval: 10,
    };
    expect(Array.from(encodeScheduleEntry(s))).toEqual([0x03, 9, 30, 3, 10]);
  });

  it('validates problems', () => {
    expect(validateSchedule({ ...weekdays, start: { h: 22, m: 0 }, end: { h: 8, m: 0 } })).toEqual([
      'endNotAfterStart',
    ]);
    expect(validateSchedule({ ...weekdays, days: [] })).toEqual(['noDays']);
    expect(
      validateSchedule({ ...weekdays, start: { h: 8, m: 0 }, end: { h: 8, m: 5 }, interval: 10 }),
    ).toEqual(['noSprays']);
    expect(validateSchedule(weekdays)).toEqual([]);
  });

  it('flags too many sprays', () => {
    const s: Schedule = { ...weekdays, start: { h: 0, m: 0 }, end: { h: 23, m: 59 }, interval: 10 };
    expect(sprayCount(s)).toBe(143);
    expect(validateSchedule(s)).toEqual([]);
  });

  it('decoded end is start plus count times interval', () => {
    const s: Schedule = {
      start: { h: 8, m: 0 },
      end: { h: 8, m: 25 },
      days: ['mon'],
      interval: 10,
    };
    expect(decodeScheduleEntry(encodeScheduleEntry(s)).end).toEqual({ h: 8, m: 20 });
  });

  it('rejects bad entries', () => {
    expect(() => decodeScheduleEntry(new Uint8Array([1, 2, 3]))).toThrow();
    expect(() => encodeScheduleEntry({ ...weekdays, days: [] })).toThrow();
  });
});

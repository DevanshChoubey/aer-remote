import {
  decodeScheduleEntry,
  encodeScheduleEntry,
  nextSprayToday,
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

describe('nextSprayToday', () => {
  // 2026-10-26 is a Monday.
  const at = (iso: string): Date => new Date(iso);
  const morning: Schedule = {
    start: { h: 8, m: 0 },
    end: { h: 9, m: 0 },
    days: ['mon'],
    interval: 20,
  };
  const evening: Schedule = {
    start: { h: 18, m: 0 },
    end: { h: 19, m: 0 },
    days: ['mon', 'tue'],
    interval: 10,
  };

  it('returns the next spray time today in the given zone', () => {
    // 07:40 in Kolkata (UTC+5:30) on Monday.
    expect(nextSprayToday([morning], at('2026-10-26T02:10:00Z'), 'Asia/Kolkata')).toEqual({
      h: 8,
      m: 0,
    });
    // 08:05 -> next is 08:20.
    expect(nextSprayToday([morning], at('2026-10-26T02:35:00Z'), 'Asia/Kolkata')).toEqual({
      h: 8,
      m: 20,
    });
  });

  it('includes a spray exactly now, ignoring seconds', () => {
    expect(nextSprayToday([morning], at('2026-10-26T02:50:45Z'), 'Asia/Kolkata')).toEqual({
      h: 8,
      m: 20,
    });
  });

  it('uses the dispenser zone rather than the phone zone', () => {
    // 2026-10-26T20:00Z is Monday 20:00 UTC but already Tuesday 01:30 in Kolkata.
    expect(nextSprayToday([evening], at('2026-10-26T20:00:00Z'), 'UTC')).toBeNull();
    // Monday 17:00 UTC is Monday 22:30 Kolkata; Monday 12:00 UTC is 17:30 Kolkata -> 18:00.
    expect(nextSprayToday([evening], at('2026-10-26T12:00:00Z'), 'Asia/Kolkata')).toEqual({
      h: 18,
      m: 0,
    });
  });

  it('is null when nothing is left today or the day is not scheduled', () => {
    expect(nextSprayToday([morning], at('2026-10-26T05:00:00Z'), 'Asia/Kolkata')).toBeNull();
    expect(nextSprayToday([morning], at('2026-10-27T02:00:00Z'), 'Asia/Kolkata')).toBeNull();
    expect(nextSprayToday([], at('2026-10-26T02:00:00Z'), 'Asia/Kolkata')).toBeNull();
  });

  it('picks the earliest across schedules', () => {
    expect(nextSprayToday([evening, morning], at('2026-10-26T02:10:00Z'), 'Asia/Kolkata')).toEqual({
      h: 8,
      m: 0,
    });
  });

  it('skips invalid schedules', () => {
    const bad: Schedule = { ...morning, end: { h: 7, m: 0 } };
    expect(nextSprayToday([bad], at('2026-10-26T01:00:00Z'), 'Asia/Kolkata')).toBeNull();
  });

  it('returns null for an unknown time zone', () => {
    expect(nextSprayToday([morning], at('2026-10-26T02:10:00Z'), 'Not/AZone')).toBeNull();
  });
});

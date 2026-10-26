export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type Interval = 10 | 20 | 40;
export interface TimeOfDay {
  h: number;
  m: number;
}
export interface Schedule {
  start: TimeOfDay;
  end: TimeOfDay;
  days: Weekday[];
  interval: Interval;
}
export type ScheduleProblem = 'endNotAfterStart' | 'noDays' | 'noSprays' | 'tooManySprays';

export const MAX_SCHEDULES = 10;

const DAY_BITS: [Weekday, number][] = [
  ['mon', 0x40],
  ['tue', 0x20],
  ['wed', 0x10],
  ['thu', 0x08],
  ['fri', 0x04],
  ['sat', 0x02],
  ['sun', 0x01],
];

const minutes = (t: TimeOfDay): number => t.h * 60 + t.m;

export function sprayCount(s: Schedule): number {
  const window = minutes(s.end) - minutes(s.start);
  return window > 0 ? Math.floor(window / s.interval) : 0;
}

export function validateSchedule(s: Schedule): ScheduleProblem[] {
  const problems: ScheduleProblem[] = [];
  if (minutes(s.end) <= minutes(s.start)) problems.push('endNotAfterStart');
  if (s.days.length === 0) problems.push('noDays');
  if (minutes(s.end) > minutes(s.start)) {
    const count = sprayCount(s);
    if (count === 0) problems.push('noSprays');
    else if (count > 255) problems.push('tooManySprays');
  }
  return problems;
}

export function encodeScheduleEntry(s: Schedule): Uint8Array {
  const problems = validateSchedule(s);
  if (problems.length > 0) throw new Error(`Invalid schedule: ${problems.join(', ')}`);
  let mask = 0;
  for (const [day, bit] of DAY_BITS) if (s.days.includes(day)) mask |= bit;
  return new Uint8Array([mask, s.start.h, s.start.m, sprayCount(s), s.interval]);
}

export function decodeScheduleEntry(b: Uint8Array): Schedule {
  if (b.length !== 5) throw new Error('Schedule entry must be 5 bytes');
  const [mask = 0, h = 0, m = 0, count = 0, interval = 0] = b;
  if (interval !== 10 && interval !== 20 && interval !== 40) {
    throw new Error('Unknown schedule interval');
  }
  const endMin = h * 60 + m + count * interval;
  return {
    start: { h, m },
    end: { h: Math.floor(endMin / 60), m: endMin % 60 },
    days: DAY_BITS.filter(([, bit]) => (mask & bit) !== 0).map(([day]) => day),
    interval,
  };
}

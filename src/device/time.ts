const MS_PER_MIN = 60_000;

/** Offset from UTC, in minutes, that `timeZone` has at the instant `ms`. */
function offsetMinutes(timeZone: string, ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MS_PER_MIN);
}

/**
 * The zone's standard (non-DST) offset east of UTC in minutes, and its DST saving in ms
 * (0 when the zone has no DST that year), judged from the year containing `at`.
 */
export function zoneInfo(
  timeZone: string,
  at: Date,
): { standardOffsetMin: number; dstSavingsMs: number } {
  const year = at.getUTCFullYear();
  const offsets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) =>
    offsetMinutes(timeZone, Date.UTC(year, m, 15, 12)),
  );
  const standardOffsetMin = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);
  return { standardOffsetMin, dstSavingsMs: (maxOffset - standardOffsetMin) * MS_PER_MIN };
}

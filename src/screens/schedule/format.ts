import { t } from '@/i18n';
import type { Schedule, Weekday } from '@/core';

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WORKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
export const WEEKEND: readonly Weekday[] = ['sat', 'sun'];

/** The days in week order, without duplicates. */
export function sortDays(days: readonly Weekday[]): Weekday[] {
  return WEEKDAYS.filter((d) => days.includes(d));
}

const sameDays = (days: readonly Weekday[], set: readonly Weekday[]): boolean =>
  days.length === set.length && set.every((d) => days.includes(d));

/** "Every day", "Weekdays", "Weekends" or a short list such as "Mon, Wed, Fri". */
export function formatDays(days: readonly Weekday[]): string {
  if (sameDays(days, WEEKDAYS)) return t('schedule.everyDay');
  if (sameDays(days, WORKDAYS)) return t('schedule.weekdays');
  if (sameDays(days, WEEKEND)) return t('schedule.weekends');
  return sortDays(days)
    .map((d) => t(`schedule.${d}`))
    .join(', ');
}

/** A time of day in the phone's own 12 or 24 hour style, e.g. "8:20 AM". */
export function formatClock(time: { h: number; m: number }): string {
  return new Date(2000, 0, 1, time.h, time.m).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** One line for a schedule, e.g. "Weekdays, 8:00 AM to 8:00 PM, every 20 min". */
export function formatSchedule(s: Schedule): string {
  return t('schedule.line', {
    days: formatDays(s.days),
    start: formatClock(s.start),
    end: formatClock(s.end),
    minutes: s.interval,
  });
}

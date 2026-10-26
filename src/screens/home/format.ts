import { t } from '@/i18n';

const MINUTE = 60_000;

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function formatWhen(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < MINUTE) return t('home.whenNow');
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 60) return t('home.whenMinutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('home.whenHours', { n: hours });
  return t('home.whenDays', { n: Math.floor(hours / 24) });
}

/** A time of day in the phone's own 12 or 24 hour style, e.g. "8:20 AM". */
export function formatTimeOfDay(time: { h: number; m: number }): string {
  return new Date(2000, 0, 1, time.h, time.m).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

import { useEffect, useRef, useState } from 'react';

import {
  MAX_SCHEDULES,
  repeatCount,
  sprayCount,
  useServices,
  validateSchedule,
  type Interval,
  type SavedDispenser,
  type Schedule,
  type ScheduleProblem,
  type TimeOfDay,
  type Weekday,
} from '@/core';
import { errorCopyKey } from '@/screens/errorCopy';

import { sortDays } from './format';

export const HOUR_STEP = 1;
export const MINUTE_STEP = 5;

const NEW_SCHEDULE: Schedule = {
  start: { h: 8, m: 0 },
  end: { h: 20, m: 0 },
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  interval: 20,
};

const wrap = (n: number, size: number): number => ((n % size) + size) % size;

/** Moves the hour by 1 or the minutes by 5, wrapping round without carrying into the hour. */
export function stepTime(time: TimeOfDay, part: 'h' | 'm', direction: 1 | -1): TimeOfDay {
  return part === 'h'
    ? { h: wrap(time.h + direction * HOUR_STEP, 24), m: time.m }
    : { h: time.h, m: wrap(time.m + direction * MINUTE_STEP, 60) };
}

export type DraftProblem = ScheduleProblem | 'tooMany';

export type SaveOutcome = 'done' | 'rounded' | 'failed';

export interface ScheduleDraft {
  loaded: boolean;
  /** The dispenser is not saved in the app. */
  missing: boolean;
  /** True while the device's schedule list has never been read, so saving could erase unknowns. */
  unknown: boolean;
  /** Editing an index that is not on the device list. */
  stale: boolean;
  isNew: boolean;
  draft: Schedule;
  problems: DraftProblem[];
  sprays: number;
  canSave: boolean;
  saving: boolean;
  refreshing: boolean;
  /** An errors.* or schedule.* copy key. */
  errorKey: string | null;
  /** Set after a save when the device rounded the end time to something else. */
  roundedEnd: TimeOfDay | null;
  setStart: (time: TimeOfDay) => void;
  setEnd: (time: TimeOfDay) => void;
  setDays: (days: readonly Weekday[]) => void;
  toggleDay: (day: Weekday) => void;
  setInterval: (interval: Interval) => void;
  save: () => Promise<SaveOutcome>;
  remove: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const sameTime = (a: TimeOfDay, b: TimeOfDay): boolean => a.h === b.h && a.m === b.m;

const sameSchedule = (a: Schedule, b: Schedule): boolean =>
  sameTime(a.start, b.start) &&
  sameTime(a.end, b.end) &&
  a.interval === b.interval &&
  sortDays(a.days).join() === sortDays(b.days).join();

/** The draft of one schedule (new when `index` is undefined) for dispenser `id`. */
export function useScheduleDraft(id: string, index: number | undefined): ScheduleDraft {
  const { client, store } = useServices();
  const [dispenser, setDispenser] = useState<SavedDispenser | null>(null);
  const [loaded, setLoaded] = useState(false);
  /** The entry being edited, by value, captured once the list is first known. null = adding. */
  const [original, setOriginal] = useState<Schedule | null | undefined>(undefined);
  const [edited, setEdited] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [roundedEnd, setRoundedEnd] = useState<TimeOfDay | null>(null);
  const alive = useRef(true);
  const captured = useRef(false);
  const inflight = useRef(false);

  useEffect(() => {
    alive.current = true;
    const load = (): void => {
      store
        .get(id)
        .then((d) => {
          if (!alive.current) return;
          setDispenser(d);
          setLoaded(true);
          if (!captured.current && d?.schedules) {
            captured.current = true;
            setOriginal(index === undefined ? null : (d.schedules.list[index] ?? null));
          }
        })
        .catch((e: unknown) => {
          console.error('Could not read the saved dispenser', e);
          if (alive.current) setLoaded(true);
        });
    };
    load();
    const unsubscribe = store.subscribe(load);
    return () => {
      alive.current = false;
      unsubscribe();
    };
  }, [store, id, index]);

  const list = dispenser?.schedules?.list;
  const editing = original !== undefined && original !== null;
  const isNew = !editing && index === undefined;

  // The draft is the original entry (or the defaults) until the user changes something.
  const draft: Schedule =
    edited ?? (original ? { ...original, days: sortDays(original.days) } : NEW_SCHEDULE);

  const problems: DraftProblem[] = validateSchedule(draft);
  if (isNew && list && list.length >= MAX_SCHEDULES) problems.push('tooMany');
  const unknown = loaded && dispenser !== null && list === undefined;
  const stale = loaded && index !== undefined && !editing && original === null;
  const ready = loaded && dispenser !== null && list !== undefined && !stale;

  const edit = (change: Partial<Schedule>): void => {
    setRoundedEnd(null);
    setEdited({ ...draft, ...change });
  };

  /**
   * Writes the whole list. The device list is the source of truth: it is read fresh and the
   * entry being edited is found in it by value. If it is gone nothing is written.
   */
  const write = async (
    build: (current: Schedule[], at: number) => Schedule[],
  ): Promise<Schedule[] | null> => {
    setSaving(true);
    setErrorKey(null);
    try {
      const fresh = (await store.get(id))?.schedules?.list ?? list ?? [];
      const at = original ? fresh.findIndex((s) => sameSchedule(s, original)) : -1;
      if (original && at < 0) {
        if (alive.current) setErrorKey('schedule.changed');
        return null;
      }
      return await client.saveSchedules(id, build(fresh, at));
    } catch (e) {
      if (alive.current) setErrorKey(errorCopyKey(e));
      return null;
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const save = async (): Promise<SaveOutcome> => {
    if (!ready || problems.length > 0 || inflight.current) return 'failed';
    inflight.current = true;
    try {
      const entry: Schedule = { ...draft, days: sortDays(draft.days) };
      const readBack = await write((current, at) =>
        at < 0 ? [...current, entry] : current.map((s, i) => (i === at ? entry : s)),
      );
      if (!readBack) return 'failed';
      // The device stores a repeat count, not an end, so it reads back start + count × interval.
      const minutes = entry.start.h * 60 + entry.start.m + repeatCount(entry) * entry.interval;
      const normalized: Schedule = {
        ...entry,
        end: { h: Math.floor(minutes / 60), m: minutes % 60 },
      };
      const stored = readBack.find((s) => sameSchedule(s, normalized));
      if (!stored) {
        if (alive.current) setErrorKey('schedule.notKept');
        return 'failed';
      }
      const rounded = !sameTime(normalized.end, entry.end);
      if (alive.current) {
        // From now on this stored entry is the one being edited, so a second save replaces it.
        setOriginal(stored);
        setEdited(null);
        setRoundedEnd(rounded ? stored.end : null);
      }
      return rounded ? 'rounded' : 'done';
    } finally {
      inflight.current = false;
    }
  };

  const remove = async (): Promise<boolean> => {
    if (!ready || !original || inflight.current) return false;
    inflight.current = true;
    try {
      const readBack = await write((current, at) => current.filter((_, i) => i !== at));
      return readBack !== null;
    } finally {
      inflight.current = false;
    }
  };

  return {
    loaded,
    missing: loaded && dispenser === null,
    unknown,
    stale,
    isNew,
    draft,
    problems,
    sprays: sprayCount(draft),
    canSave: ready && problems.length === 0 && !saving,
    saving,
    refreshing,
    errorKey,
    roundedEnd,
    setStart: (start) => edit({ start }),
    setEnd: (end) => edit({ end }),
    setDays: (days) => edit({ days: sortDays(days) }),
    toggleDay: (day) =>
      edit({
        days: sortDays(
          draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day],
        ),
      }),
    setInterval: (interval) => edit({ interval }),
    save,
    remove,
    refresh: async () => {
      if (refreshing) return;
      setRefreshing(true);
      setErrorKey(null);
      try {
        await client.refresh(id);
      } catch (e) {
        if (alive.current) setErrorKey(errorCopyKey(e));
      }
      if (alive.current) setRefreshing(false);
    },
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  MAX_SCHEDULES,
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
  /** Editing an index that is not on the device list (stale link). */
  stale: boolean;
  isNew: boolean;
  draft: Schedule;
  problems: DraftProblem[];
  sprays: number;
  canSave: boolean;
  saving: boolean;
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

/** The draft of one schedule (new when `index` is undefined) for dispenser `id`. */
export function useScheduleDraft(id: string, index: number | undefined): ScheduleDraft {
  const { client, store } = useServices();
  const [dispenser, setDispenser] = useState<SavedDispenser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [edited, setEdited] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [roundedEnd, setRoundedEnd] = useState<TimeOfDay | null>(null);
  const alive = useRef(true);

  const reread = useCallback(async (): Promise<void> => {
    try {
      const d = await store.get(id);
      if (alive.current) {
        setDispenser(d);
        setLoaded(true);
      }
    } catch (e) {
      console.error('Could not read the saved dispenser', e);
      if (alive.current) setLoaded(true);
    }
  }, [store, id]);

  useEffect(() => {
    alive.current = true;
    store
      .get(id)
      .then((d) => {
        if (alive.current) {
          setDispenser(d);
          setLoaded(true);
        }
      })
      .catch((e: unknown) => {
        console.error('Could not read the saved dispenser', e);
        if (alive.current) setLoaded(true);
      });
    return () => {
      alive.current = false;
    };
  }, [store, id]);

  const list = dispenser?.schedules?.list;
  const existing = index === undefined ? undefined : list?.[index];
  const isNew = index === undefined;

  // The draft is the stored entry (or the defaults) until the user changes something.
  const draft: Schedule =
    edited ?? (existing ? { ...existing, days: sortDays(existing.days) } : NEW_SCHEDULE);

  const problems: DraftProblem[] = validateSchedule(draft);
  if (isNew && list && list.length >= MAX_SCHEDULES) problems.push('tooMany');
  const unknown = loaded && dispenser !== null && list === undefined;
  const stale = loaded && !isNew && list !== undefined && existing === undefined && edited === null;
  const ready = loaded && dispenser !== null && list !== undefined && !stale;

  const edit = (change: Partial<Schedule>): void => {
    setRoundedEnd(null);
    setEdited({ ...draft, ...change });
  };

  /** Writes the whole list; the device list is the source of truth, re-read just before. */
  const write = async (build: (current: Schedule[]) => Schedule[]): Promise<Schedule[] | null> => {
    setSaving(true);
    setErrorKey(null);
    try {
      const fresh = (await store.get(id))?.schedules?.list ?? list ?? [];
      return await client.saveSchedules(id, build(fresh));
    } catch (e) {
      if (alive.current) setErrorKey(errorCopyKey(e));
      return null;
    } finally {
      if (alive.current) setSaving(false);
      await reread();
    }
  };

  const save = async (): Promise<SaveOutcome> => {
    if (!ready || problems.length > 0 || saving) return 'failed';
    const entry: Schedule = { ...draft, days: sortDays(draft.days) };
    const readBack = await write((current) =>
      index === undefined || current[index] === undefined
        ? [...current, entry]
        : current.map((s, i) => (i === index ? entry : s)),
    );
    if (!readBack) return 'failed';
    const stored = readBack.find(
      (s) =>
        sameTime(s.start, entry.start) &&
        s.interval === entry.interval &&
        sortDays(s.days).join() === entry.days.join(),
    );
    if (stored && !sameTime(stored.end, entry.end)) {
      if (alive.current) {
        setEdited({ ...entry, end: stored.end });
        setRoundedEnd(stored.end);
      }
      return 'rounded';
    }
    return 'done';
  };

  const remove = async (): Promise<boolean> => {
    if (!ready || index === undefined || saving) return false;
    const readBack = await write((current) => current.filter((_, i) => i !== index));
    return readBack !== null;
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
      setErrorKey(null);
      try {
        await client.refresh(id);
      } catch (e) {
        if (alive.current) setErrorKey(errorCopyKey(e));
      }
      await reread();
    },
  };
}

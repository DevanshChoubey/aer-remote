import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createFakeTransport, type FakeTransport } from '@/ble/testing/fakeDispenser';
import { ServicesProvider, type Services } from '@/core';
import { DispenserClient } from '@/device/client';
import type { Schedule } from '@/protocol/schedule';
import { ScheduleEditor } from '@/screens/schedule/ScheduleEditor';
import { problemCopy } from '@/screens/schedule/problemCopy';
import { formatDays } from '@/screens/schedule/format';
import { stepTime } from '@/screens/schedule/useScheduleDraft';
import { createMemoryStore } from '@/store/memoryStore';
import type { SavedDispenser } from '@/store/types';
import { ThemeProvider } from '@/theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockBack = jest.fn();
let mockParams: { id: string; index?: string } = { id: 'a' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const AT = '2026-10-26T10:00:00.000Z';
const morning: Schedule = {
  start: { h: 8, m: 0 },
  end: { h: 10, m: 0 },
  days: ['sat', 'sun'],
  interval: 20,
};

async function mount(
  options: {
    schedules?: Schedule[];
    known?: boolean;
    busy?: boolean;
    replyDelayMs?: number;
    prep?: (store: Services['store']) => void;
  } = {},
): Promise<{ fake: FakeTransport; services: Services }> {
  const fake = createFakeTransport({
    a: { busy: options.busy, replyDelayMs: options.replyDelayMs },
  });
  const list = options.schedules ?? [];
  fake.state('a').schedules = list;
  const store = createMemoryStore();
  const saved: SavedDispenser = {
    id: 'a',
    name: 'Kitchen',
    homeTimeZone: 'UTC',
    ...(options.known === false ? {} : { schedules: { list, at: AT } }),
  };
  await store.upsert(saved);
  options.prep?.(store);
  const services: Services = {
    store,
    client: new DispenserClient(fake, store, { scheduleGapMs: 0, connectAttempts: 1 }),
  };
  await render(
    <ServicesProvider services={services}>
      <ThemeProvider scheme="light">
        <ScheduleEditor />
      </ThemeProvider>
    </ServicesProvider>,
  );
  return { fake, services };
}

async function done(services: Services): Promise<void> {
  await act(async () => {
    await services.client.remove('a');
  });
}

describe('ScheduleEditor', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockParams = { id: 'a' };
  });

  it('flags an end time that is not after the start and disables Save', async () => {
    const { services } = await mount();
    await screen.findByLabelText('Save schedule');
    for (let i = 0; i < 14; i += 1)
      await fireEvent.press(screen.getByLabelText(/^Start time .*, hour up$/));
    expect(screen.getByText('The end time must be after the start time.')).toBeTruthy();
    expect(screen.getByLabelText('Save schedule').props.accessibilityState.disabled).toBe(true);
    await done(services);
  });

  it('flags no days and a window shorter than one interval', async () => {
    const { services } = await mount();
    await screen.findByLabelText('Save schedule');
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await fireEvent.press(screen.getByLabelText(day));
    }
    expect(screen.getByText('Pick at least one day.')).toBeTruthy();
    expect(screen.getByLabelText('Save schedule').props.accessibilityState.disabled).toBe(true);
    await done(services);
  });

  it('saves a new Mon to Fri schedule to the dispenser', async () => {
    const { fake, services } = await mount();
    await fireEvent.press(await screen.findByLabelText('Weekdays'));
    expect(screen.getByText('About 36 sprays a day')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(fake.state('a').schedules).toEqual([
      {
        start: { h: 8, m: 0 },
        end: { h: 20, m: 0 },
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        interval: 20,
      },
    ]);
    await done(services);
  });

  it('edits an existing schedule in place', async () => {
    mockParams = { id: 'a', index: '1' };
    const other: Schedule = { ...morning, days: ['mon'], interval: 40 };
    const { fake, services } = await mount({ schedules: [other, morning] });
    await screen.findByText('Edit schedule');
    await fireEvent.press(screen.getByLabelText('10 min'));
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(fake.state('a').schedules).toEqual([other, { ...morning, interval: 10 }]);
    await done(services);
  });

  it('deletes the only schedule, leaving the device list empty', async () => {
    mockParams = { id: 'a', index: '0' };
    const { fake, services } = await mount({ schedules: [morning] });
    await fireEvent.press(await screen.findByLabelText('Delete schedule'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(fake.state('a').schedules).toEqual([]);
    expect((await services.store.get('a'))?.schedules?.list).toEqual([]);
    await done(services);
  });

  it('shows the rounded end time when the device stores a different one', async () => {
    const { fake, services } = await mount();
    // 08:00 to 20:10 every 20 minutes holds 36 sprays, which the device reads back as 20:00.
    await fireEvent.press(await screen.findByLabelText(/^End time .*, minutes up$/));
    await fireEvent.press(screen.getByLabelText(/^End time .*, minutes up$/));
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    expect(await screen.findByText(/^The dispenser rounded the end time to/)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(fake.state('a').schedules[0]?.end).toEqual({ h: 20, m: 0 });
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(mockBack).toHaveBeenCalled();
    await done(services);
  });

  it('refuses to save a new schedule at 10 and explains why', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({
      ...morning,
      start: { h: i, m: 0 },
      end: { h: i + 1, m: 0 },
    }));
    const { services } = await mount({ schedules: ten });
    await screen.findByLabelText('Save schedule');
    expect(screen.getByText(/A dispenser holds up to 10 schedules/)).toBeTruthy();
    expect(screen.getByLabelText('Save schedule').props.accessibilityState.disabled).toBe(true);
    await done(services);
  });

  it('asks to refresh when the device schedules were never read, and never saves blind', async () => {
    const { fake, services } = await mount({ known: false, schedules: [morning] });
    expect(await screen.findByText(/^Refresh to see the dispenser/)).toBeTruthy();
    expect(screen.queryByLabelText('Save schedule')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Refresh'));
    expect(await screen.findByLabelText('Save schedule')).toBeTruthy();
    expect(fake.state('a').schedules).toEqual([morning]);
    await done(services);
  });

  it('shows the unreachable copy and does not leave when saving fails', async () => {
    const { fake, services } = await mount();
    await screen.findByLabelText('Save schedule');
    const connect = jest.spyOn(fake, 'connect').mockRejectedValue(new Error('busy'));
    await fireEvent.press(screen.getByLabelText('Weekends'));
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    expect(await screen.findByText(/^Can't reach the dispenser/)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    // The failed save left the device list unread, so the editor asks for a refresh, never a blind save.
    expect(screen.queryByLabelText('Save schedule')).toBeNull();
    expect(screen.getByLabelText('Refresh')).toBeTruthy();
    connect.mockRestore();
    await done(services);
  });

  it('does not write, and says so, when the edited entry is gone from the device list', async () => {
    mockParams = { id: 'a', index: '0' };
    const other: Schedule = { ...morning, days: ['mon'] };
    const { fake, services } = await mount({ schedules: [morning] });
    await screen.findByText('Edit schedule');
    fake.state('a').schedules = [other];
    await act(async () => {
      await services.store.upsert({
        id: 'a',
        name: 'Kitchen',
        homeTimeZone: 'UTC',
        schedules: { list: [other], at: AT },
      });
    });
    await fireEvent.press(screen.getByLabelText('10 min'));
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    expect(
      await screen.findByText('This schedule changed on the dispenser. Go back and try again.'),
    ).toBeTruthy();
    expect(fake.state('a').schedules).toEqual([other]);
    expect(mockBack).not.toHaveBeenCalled();
    await done(services);
  });

  it('updates the right entry when the list was reordered', async () => {
    mockParams = { id: 'a', index: '0' };
    const other: Schedule = { ...morning, days: ['mon'], interval: 40 };
    const { fake, services } = await mount({ schedules: [morning, other] });
    await screen.findByText('Edit schedule');
    fake.state('a').schedules = [other, morning];
    await act(async () => {
      await services.store.upsert({
        id: 'a',
        name: 'Kitchen',
        homeTimeZone: 'UTC',
        schedules: { list: [other, morning], at: AT },
      });
    });
    await fireEvent.press(screen.getByLabelText('10 min'));
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(fake.state('a').schedules).toEqual([other, { ...morning, interval: 10 }]);
    await done(services);
  });

  it('keeps one entry when a rounded save is saved again', async () => {
    const { fake, services } = await mount();
    await fireEvent.press(await screen.findByLabelText(/^End time .*, minutes up$/));
    await fireEvent.press(screen.getByLabelText(/^End time .*, minutes up$/));
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    await screen.findByText(/^The dispenser rounded the end time to/);
    await fireEvent.press(screen.getByLabelText(/^Start time .*, minutes up$/));
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    await waitFor(() => expect(screen.queryByLabelText('Save schedule')).toBeTruthy());
    await waitFor(() => expect(fake.state('a').schedules[0]?.start).toEqual({ h: 8, m: 5 }));
    expect(fake.state('a').schedules).toHaveLength(1);
    await done(services);
  });

  it('saves once when Save is pressed twice quickly', async () => {
    const { fake, services } = await mount({ replyDelayMs: 10 });
    const save = await screen.findByLabelText('Save schedule');
    await act(async () => {
      fireEvent.press(save);
      fireEvent.press(save);
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(fake.state('a').schedules).toHaveLength(1);
    await done(services);
  });

  it('shows a loading state until the dispenser has been read', async () => {
    let release: () => void = () => undefined;
    const { services } = await mount({
      prep: (store) => {
        const real = store.get.bind(store);
        let first = true;
        jest.spyOn(store, 'get').mockImplementation((id) => {
          if (!first) return real(id);
          first = false;
          return new Promise((resolve) => {
            release = () => void real(id).then(resolve);
          });
        });
      },
    });
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByLabelText('Save schedule')).toBeNull();
    await act(async () => release());
    expect(await screen.findByLabelText('Save schedule')).toBeTruthy();
    await done(services);
  });

  it.each(['abc', '-1', '1.5', '5'])('treats ?index=%s as a missing schedule', async (index) => {
    mockParams = { id: 'a', index };
    const { services } = await mount({ schedules: [morning] });
    expect(await screen.findByText('That schedule is not on the dispenser any more.')).toBeTruthy();
    expect(screen.queryByLabelText('Save schedule')).toBeNull();
    await done(services);
  });

  it('shows progress and blocks a second press while Refresh runs', async () => {
    const { services } = await mount({ known: false, schedules: [morning], replyDelayMs: 30 });
    await fireEvent.press(await screen.findByLabelText('Refresh'));
    expect(screen.getByLabelText('Refresh').props.accessibilityState.disabled).toBe(true);
    expect(await screen.findByLabelText('Save schedule')).toBeTruthy();
    await done(services);
  });

  it('says the window is too short for one interval', async () => {
    const { services } = await mount();
    await screen.findByLabelText('Save schedule');
    await fireEvent.press(screen.getByLabelText('40 min'));
    for (let i = 0; i < 11; i += 1)
      await fireEvent.press(screen.getByLabelText(/^Start time .*, hour up$/));
    for (let i = 0; i < 7; i += 1)
      await fireEvent.press(screen.getByLabelText(/^Start time .*, minutes up$/));
    expect(
      screen.getByText('The window is shorter than one interval. Make it longer.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Save schedule').props.accessibilityState.disabled).toBe(true);
    await done(services);
  });

  it('marks the chosen day preset as selected', async () => {
    const { services } = await mount();
    const selected = (label: string): boolean | undefined =>
      screen.getByLabelText(label).props.accessibilityState.selected;
    await screen.findByLabelText('Save schedule');
    expect(selected('Every day')).toBe(true);
    expect(selected('Weekdays')).toBe(false);
    await fireEvent.press(screen.getByLabelText('Weekdays'));
    expect(selected('Weekdays')).toBe(true);
    expect(selected('Every day')).toBe(false);
    await fireEvent.press(screen.getByLabelText('Weekends'));
    expect(selected('Weekends')).toBe(true);
    await fireEvent.press(screen.getByLabelText('Every day'));
    expect(selected('Every day')).toBe(true);
    expect(selected('Weekends')).toBe(false);
    await done(services);
  });

  it('puts the current time in the stepper button names', async () => {
    const { services } = await mount();
    expect(await screen.findByLabelText('Start time 8:00 am, hour up')).toBeTruthy();
    expect(screen.getByLabelText('End time 8:00 pm, minutes down')).toBeTruthy();
    await done(services);
  });
});

describe('problemCopy', () => {
  it('words every problem, including too many sprays', () => {
    expect(problemCopy('tooManySprays')).toBe(
      'That is too many sprays for one window. Use a longer interval.',
    );
    expect(problemCopy('tooMany')).toMatch(/up to 10 schedules/);
  });
});

describe('time and day helpers', () => {
  it('steps hours by 1 and minutes by 5, wrapping round', () => {
    expect(stepTime({ h: 23, m: 30 }, 'h', 1)).toEqual({ h: 0, m: 30 });
    expect(stepTime({ h: 0, m: 30 }, 'h', -1)).toEqual({ h: 23, m: 30 });
    expect(stepTime({ h: 8, m: 55 }, 'm', 1)).toEqual({ h: 8, m: 0 });
    expect(stepTime({ h: 8, m: 0 }, 'm', -1)).toEqual({ h: 8, m: 55 });
  });

  it('writes day sets the short way', () => {
    expect(formatDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toBe('Every day');
    expect(formatDays(['fri', 'mon', 'tue', 'wed', 'thu'])).toBe('Weekdays');
    expect(formatDays(['sun', 'sat'])).toBe('Weekends');
    expect(formatDays(['fri', 'mon', 'wed'])).toBe('Mon, Wed, Fri');
  });
});

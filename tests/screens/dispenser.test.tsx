import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createFakeTransport, type FakeTransport } from '@/ble/testing/fakeDispenser';
import { ServicesProvider, type Services } from '@/core';
import { DispenserClient } from '@/device/client';
import { DispenserScreen } from '@/screens/dispenser/DispenserScreen';
import { createMemoryStore } from '@/store/memoryStore';
import type { SavedDispenser } from '@/store/types';
import type { Schedule } from '@/protocol/schedule';
import { ThemeProvider } from '@/theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ id: 'a' }),
}));

const weekdays: Schedule = {
  start: { h: 8, m: 0 },
  end: { h: 10, m: 0 },
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  interval: 20,
};
const weekend: Schedule = { ...weekdays, days: ['sat', 'sun'], interval: 40 };

const saved: SavedDispenser = { id: 'a', name: 'Kitchen', homeTimeZone: 'UTC', clockSet: true };

async function mount(
  options: {
    busy?: boolean;
    absent?: boolean;
    spraysSinceRefill?: number;
    replyDelayMs?: number;
    schedules?: Schedule[];
    saved?: Partial<SavedDispenser>;
  } = {},
): Promise<{ fake: FakeTransport; services: Services }> {
  const fake = createFakeTransport({
    a: { busy: options.busy, batteryMv: 2750, replyDelayMs: options.replyDelayMs },
  });
  fake.state('a').schedules = options.schedules ?? [];
  fake.state('a').spraysSinceRefill = options.spraysSinceRefill ?? 0;
  const store = createMemoryStore();
  if (!options.absent) await store.upsert({ ...saved, ...options.saved });
  const services: Services = {
    store,
    client: new DispenserClient(fake, store, { scheduleGapMs: 0, connectAttempts: 1 }),
  };
  await render(
    <ServicesProvider services={services}>
      <ThemeProvider scheme="light">
        <DispenserScreen />
      </ThemeProvider>
    </ServicesProvider>,
  );
  return { fake, services };
}

/** Closes the live session so no idle timer outlives the test. */
async function done(services: Services): Promise<void> {
  await act(async () => {
    await services.client.remove('a');
  });
}

describe('DispenserScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
  });

  it('shows the cached data with "Checking…", then the refreshed battery and schedules', async () => {
    const { services } = await mount({
      schedules: [weekdays, weekend],
      replyDelayMs: 50,
      saved: { schedules: { list: [weekdays], at: '2026-10-26T10:00:00.000Z' } },
    });
    expect(screen.getByText('Checking…')).toBeTruthy();
    expect(screen.getByText(/^Weekdays/)).toBeTruthy(); // the cached copy is already on screen
    expect(screen.queryByText(/^Weekends/)).toBeNull();
    expect(await screen.findByText('Battery 50%')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Checking…')).toBeNull());
    expect(screen.getByText(/^Weekdays, .* every 20 min$/)).toBeTruthy();
    expect(screen.getByText(/^Weekends, .* every 40 min$/)).toBeTruthy();
    expect(screen.getAllByText(/About \d+ sprays a day/)).toHaveLength(2);
    expect(screen.getByText('Firmware 1.0.0')).toBeTruthy();
    await done(services);
  });

  it('shows how old the cached status is when the dispenser is out of reach', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    const { services } = await mount({
      busy: true,
      saved: {
        lastStatus: {
          batteryMv: 3000,
          firmware: '1.0.0',
          autoSpray: null,
          spraysSinceRefill: 0,
          at: threeHoursAgo,
        },
      },
    });
    expect(await screen.findByText('Last checked 3 h ago')).toBeTruthy();
    await done(services);
  });

  it('says the status was just checked after a refresh', async () => {
    const { services } = await mount();
    expect(await screen.findByText('Last checked just now')).toBeTruthy();
    await done(services);
  });

  it('sprays on demand', async () => {
    const { fake, services } = await mount();
    await screen.findByText('Battery 50%');
    expect(fake.state('a').spraysSinceRefill).toBe(0);
    await fireEvent.press(screen.getByLabelText('Spray now'));
    await waitFor(() => expect(fake.state('a').spraysSinceRefill).toBe(1));
    await waitFor(() =>
      expect(screen.getByLabelText('Spray now').props.accessibilityState.disabled).toBe(false),
    );
    await done(services);
  });

  it('turns auto spray on and off, and picks an interval', async () => {
    const { fake, services } = await mount();
    await screen.findByText('Battery 50%');
    await fireEvent.press(screen.getByLabelText('Auto spray'));
    await waitFor(() => expect(fake.state('a').autoSpray).toBe(20));
    await fireEvent.press(screen.getByLabelText('40 min'));
    await waitFor(() => expect(fake.state('a').autoSpray).toBe(40));
    expect(await screen.findByText('Every 40 minutes')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Auto spray'));
    await waitFor(() => expect(fake.state('a').autoSpray).toBeNull());
    await done(services);
  });

  it('shows the unreachable copy and keeps the stored data when the dispenser is out of reach', async () => {
    const { services } = await mount({
      busy: true,
      saved: {
        lastStatus: {
          batteryMv: 2750,
          firmware: '1',
          autoSpray: null,
          spraysSinceRefill: 0,
          at: '2026-10-26T10:00:00.000Z',
        },
        schedules: { list: [weekdays], at: '2026-10-26T10:00:00.000Z' },
      },
    });
    expect(await screen.findByText(/^Can't reach the dispenser/)).toBeTruthy();
    expect(screen.getByText('Battery 50%')).toBeTruthy();
    expect(screen.getByText(/^Weekdays/)).toBeTruthy();
    await done(services);
  });

  it('hides the add button at 10 schedules', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({
      ...weekdays,
      start: { h: i, m: 0 },
      end: { h: i + 1, m: 0 },
    }));
    const { services } = await mount({ schedules: ten });
    await screen.findByText('Battery 50%');
    expect(screen.queryByLabelText('Add schedule')).toBeNull();
    await done(services);
  });

  it('shows the add button below 10 and opens the editor routes', async () => {
    const { services } = await mount({ schedules: [weekdays] });
    await screen.findByText('Battery 50%');
    await fireEvent.press(screen.getByLabelText('Add schedule'));
    expect(mockPush).toHaveBeenCalledWith('/dispenser/a/schedule');
    await fireEvent.press(screen.getByLabelText(/^Edit schedule: Weekdays/));
    expect(mockPush).toHaveBeenCalledWith('/dispenser/a/schedule?index=0');
    await done(services);
  });

  it('asks to refresh instead of guessing when the schedules are unknown', async () => {
    const { services } = await mount({ busy: true });
    expect(await screen.findByText('Refresh to see schedules')).toBeTruthy();
    expect(screen.queryByText('No schedules yet.')).toBeNull();
    expect(screen.getByLabelText('Refresh')).toBeTruthy();
    await done(services);
  });

  it('shows the clock hint when the clock could not be set', async () => {
    const { services } = await mount({ busy: true, saved: { clockSet: false } });
    expect(await screen.findByText('Clock may be off. Open to fix.')).toBeTruthy();
    await screen.findByText(/^Can't reach the dispenser/);
    await done(services);
  });

  it('confirms before resetting the refill', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { fake, services } = await mount({ spraysSinceRefill: 500 });
    await screen.findByText('Battery 50%');
    await fireEvent.press(screen.getByLabelText('I refilled it'));
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(fake.state('a').spraysSinceRefill).toBe(500);
    await act(async () => buttons.find((b) => b.text === 'Reset')?.onPress?.());
    await waitFor(() => expect(fake.state('a').spraysSinceRefill).toBe(0));
    await done(services);
    alert.mockRestore();
  });

  it('renames inline', async () => {
    const { services } = await mount();
    await screen.findByText('Battery 50%');
    await fireEvent.press(screen.getByLabelText('More options'));
    await fireEvent.press(screen.getByLabelText('Rename'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Pantry');
    await fireEvent.press(screen.getByLabelText('Save name'));
    await waitFor(async () => expect((await services.store.get('a'))?.name).toBe('Pantry'));
    expect(await screen.findByText('Pantry')).toBeTruthy();
    await done(services);
  });

  it('confirms before removing, then goes home', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { services } = await mount();
    await screen.findByText('Battery 50%');
    await fireEvent.press(screen.getByLabelText('More options'));
    await fireEvent.press(screen.getByLabelText('Remove dispenser'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(await services.store.get('a')).not.toBeNull();
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((b) => b.text === 'Remove')?.onPress?.());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(await services.store.get('a')).toBeNull();
    alert.mockRestore();
  });

  it('shows a titled not-found state for a dispenser that is not saved', async () => {
    const { services } = await mount({ absent: true });
    expect(await screen.findByText('Dispenser not found')).toBeTruthy();
    expect(screen.getByText('This dispenser is not in the app any more.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
    await done(services);
  });

  it('disables schedule rows, Add and the interval chips while it works', async () => {
    const { services } = await mount({
      schedules: [weekdays],
      replyDelayMs: 50,
      saved: { schedules: { list: [weekdays], at: '2026-10-26T10:00:00.000Z' } },
    });
    expect(screen.getByLabelText('Add schedule').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText(/^Edit schedule/).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('20 min').props.accessibilityState.disabled).toBe(true);
    await waitFor(() =>
      expect(screen.getByLabelText('Add schedule').props.accessibilityState.disabled).toBe(false),
    );
    await done(services);
  });

  it('sprays once when pressed twice quickly', async () => {
    const { fake, services } = await mount({ replyDelayMs: 20 });
    await screen.findByText('Battery 50%');
    await waitFor(() =>
      expect(screen.getByLabelText('Spray now').props.accessibilityState.disabled).toBe(false),
    );
    const spray = screen.getByLabelText('Spray now');
    await Promise.all([fireEvent.press(spray), fireEvent.press(spray)]);
    await waitFor(() => expect(fake.state('a').spraysSinceRefill).toBe(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(fake.state('a').spraysSinceRefill).toBe(1);
    await done(services);
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AppState, Linking, type AppStateStatus } from 'react-native';

import { createFakeTransport, type FakeTransport } from '@/ble/testing/fakeDispenser';
import { ServicesProvider, type AlertPermission, type Services } from '@/core';
import { DispenserClient } from '@/device/client';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { filterZones, listTimeZones, zonesFirst } from '@/screens/settings/zones';
import { createMemoryStore } from '@/store/memoryStore';
import { ThemeProvider } from '@/theme';

import { fakeAlerts } from './alertsHarness';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

// The react-native jest mock returns no subscription; record the listeners instead.
const appStateHandlers: ((s: AppStateStatus) => void)[] = [];
beforeEach(() => {
  appStateHandlers.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, cb) => {
    if (type === 'change') appStateHandlers.push(cb as (s: AppStateStatus) => void);
    return { remove: jest.fn() };
  });
});

async function mount(
  onPreferenceChange = jest.fn(),
  permission?: AlertPermission,
): Promise<{
  fake: FakeTransport;
  services: Services;
  scheduler: ReturnType<typeof fakeAlerts>['scheduler'];
}> {
  const fake = createFakeTransport({ a: {} });
  const store = createMemoryStore();
  await store.upsert({ id: 'a', name: 'Kitchen', homeTimeZone: 'UTC' });
  const { alerts, scheduler } = fakeAlerts(store);
  if (permission) scheduler.setPermission(permission);
  const services: Services = {
    alerts,
    store,
    client: new DispenserClient(fake, store, { scheduleGapMs: 0, connectAttempts: 1 }),
  };
  await render(
    <ServicesProvider services={services}>
      <ThemeProvider scheme="light" onPreferenceChange={onPreferenceChange}>
        <SettingsScreen />
      </ThemeProvider>
    </ServicesProvider>,
  );
  return { fake, services, scheduler };
}

describe('SettingsScreen', () => {
  it('shows the unofficial notice, version, licence and compatibility', async () => {
    await mount();
    expect(await screen.findByText('Unofficial app. Not affiliated with Godrej.')).toBeTruthy();
    expect(screen.getByText('Version 1.0.0')).toBeTruthy();
    expect(screen.getByText('Open source under the MIT licence.')).toBeTruthy();
    expect(screen.getByText('Works with Godrej aer Smart Matic')).toBeTruthy();
  });

  it('reports a theme choice', async () => {
    const onChange = jest.fn();
    await mount(onChange);
    await fireEvent.press(await screen.findByLabelText('Warm dark'));
    expect(onChange).toHaveBeenCalledWith('dark');
    await fireEvent.press(screen.getByLabelText('Night slate'));
    expect(onChange).toHaveBeenCalledWith('slate');
    expect(screen.getByLabelText('Warm light')).toBeTruthy();
    expect(screen.getByLabelText('Match my phone')).toBeTruthy();
  });

  it('goes back', async () => {
    await mount();
    await fireEvent.press(await screen.findByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('changes a dispenser zone; the next refresh sends tZ for that zone', async () => {
    const { fake, services } = await mount();
    await fireEvent.press(await screen.findByLabelText('Kitchen, time zone UTC'));
    await fireEvent.changeText(screen.getByLabelText('Search time zones'), 'kolkata');
    expect(screen.queryByLabelText('Europe/London')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Asia/Kolkata'));
    await waitFor(async () =>
      expect((await services.store.get('a'))?.homeTimeZone).toBe('Asia/Kolkata'),
    );
    expect(await screen.findByLabelText('Kitchen, time zone Asia/Kolkata')).toBeTruthy();
    await act(async () => {
      await services.client.refresh('a');
    });
    expect(fake.state('a').tz).toBe(-330);
    await act(async () => {
      await services.client.remove('a');
    });
  });

  it('puts the current zone first and says when the list is capped', async () => {
    await mount();
    await fireEvent.press(await screen.findByLabelText('Kitchen, time zone UTC'));
    expect(screen.getByText('Showing 50. Search to find yours.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search time zones'), 'kolkata');
    expect(screen.queryByText('Showing 50. Search to find yours.')).toBeNull();
  });

  it('says so when no zone matches', async () => {
    await mount();
    await fireEvent.press(await screen.findByLabelText('Kitchen, time zone UTC'));
    await fireEvent.changeText(screen.getByLabelText('Search time zones'), 'zzzzqq');
    expect(screen.getByText('No matching time zone.')).toBeTruthy();
  });
});

describe('SettingsScreen alerts', () => {
  it('switch turns alerts off and on', async () => {
    const { services } = await mount();
    const setEnabled = jest.spyOn(services.alerts, 'setEnabled');
    const toggle = await screen.findByLabelText('Refill and battery alerts');
    expect(screen.getByText('Refill alerts are estimated from your schedules.')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(true),
    );
    await fireEvent.press(toggle);
    await waitFor(() => expect(setEnabled).toHaveBeenLastCalledWith(false));
    await waitFor(() =>
      expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(false),
    );
    await fireEvent.press(screen.getByLabelText('Refill and battery alerts'));
    await waitFor(() => expect(setEnabled).toHaveBeenLastCalledWith(true));
    await waitFor(() =>
      expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(true),
    );
  });

  it('hides the denied line when notifications are allowed', async () => {
    await mount();
    await screen.findByLabelText('Refill and battery alerts');
    expect(screen.queryByText(/Notifications are off/)).toBeNull();
    expect(screen.queryByLabelText('Open phone settings')).toBeNull();
  });

  it('reads the permission again when the app comes back from the phone settings', async () => {
    const { scheduler } = await mount(jest.fn(), 'denied');
    expect(await screen.findByText(/Notifications are off/)).toBeTruthy();
    scheduler.setPermission('granted');
    await act(async () => {
      for (const h of appStateHandlers) h('active');
    });
    await waitFor(() => expect(screen.queryByText(/Notifications are off/)).toBeNull());
    expect(screen.queryByLabelText('Open phone settings')).toBeNull();
  });

  it('shows no denied line while the phone can still ask', async () => {
    // A refusal Android 13+ will ask about again: turning the switch on asks, so no hint.
    await mount(jest.fn(), 'undetermined');
    await screen.findByLabelText('Refill and battery alerts');
    expect(screen.queryByText(/Notifications are off/)).toBeNull();
    expect(screen.queryByLabelText('Open phone settings')).toBeNull();
  });

  it('denied permission shows the hint and the open-settings button', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    try {
      await mount(jest.fn(), 'denied');
      expect(
        await screen.findByText("Notifications are off for Aer Remote in your phone's settings."),
      ).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Open phone settings'));
      expect(open).toHaveBeenCalledTimes(1);
    } finally {
      open.mockRestore();
    }
  });
});

describe('zones', () => {
  it('orders the given zones first', () => {
    expect(zonesFirst(['A', 'B', 'C'], ['C', '', 'X', 'C'])).toEqual(['C', 'A', 'B']);
  });

  it('lists IANA zones including Asia/Kolkata', () => {
    expect(listTimeZones()).toContain('Asia/Kolkata');
  });

  it('falls back to a short list without Intl.supportedValuesOf', () => {
    const original = Intl.supportedValuesOf;
    // @ts-expect-error simulating an engine without the function
    Intl.supportedValuesOf = undefined;
    try {
      const zones = listTimeZones();
      expect(zones).toEqual(expect.arrayContaining(['Asia/Kolkata', 'UTC', 'Europe/London']));
      expect(zones.length).toBeLessThan(60);
    } finally {
      Intl.supportedValuesOf = original;
    }
  });

  it('filters by case-insensitive substring', () => {
    const zones = ['Asia/Kolkata', 'Europe/London', 'America/New_York'];
    expect(filterZones(zones, 'KOL')).toEqual(['Asia/Kolkata']);
    expect(filterZones(zones, 'new york')).toEqual(['America/New_York']);
    expect(filterZones(zones, '  ')).toEqual(zones);
  });
});

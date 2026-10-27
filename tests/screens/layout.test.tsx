import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { createFakeTransport } from '@/ble/testing/fakeDispenser';
import { createServices, useServices } from '@/core';
import { useAlertOpen } from '@/screens/useAlertOpen';
import { useThemePreference } from '@/theme';
import { AppProviders } from '@/screens/AppProviders';
import { createMemoryStore } from '@/store/memoryStore';
import { Button, Txt } from '@/ui';

import { fakeAlerts } from './alertsHarness';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockHide = jest.fn(() => Promise.resolve(true));
jest.mock('expo-splash-screen', () => ({ hideAsync: () => mockHide() }));

let mockFontsLoaded = false;
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [mockFontsLoaded, null],
}));

function Probe(): React.JSX.Element {
  useServices();
  return <Txt>ready</Txt>;
}

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const store = createMemoryStore();
const { alerts, scheduler } = fakeAlerts(store);
const services = createServices({ transport: createFakeTransport({}), store, alerts });
const tree = (): React.JSX.Element => (
  <AppProviders services={services}>
    <Probe />
  </AppProviders>
);

describe('AppProviders', () => {
  beforeEach(() => {
    mockHide.mockClear();
    mockFontsLoaded = true;
  });

  it('provides services and theme to its children', async () => {
    await render(tree());
    expect(screen.getByText('ready')).toBeTruthy();
  });

  it('keeps the splash up until the fonts are ready', async () => {
    mockFontsLoaded = false;
    const { rerender } = await render(tree());
    expect(mockHide).not.toHaveBeenCalled();
    mockFontsLoaded = true;
    await rerender(tree());
    await waitFor(() => expect(mockHide).toHaveBeenCalledTimes(1));
  });

  // Text laid out in the fallback font keeps those widths on Android and clips once Nunito loads.
  it('renders its children only once the fonts are ready', async () => {
    mockFontsLoaded = false;
    const { rerender } = await render(tree());
    expect(screen.queryByText('ready')).toBeNull();
    mockFontsLoaded = true;
    await rerender(tree());
    expect(screen.getByText('ready')).toBeTruthy();
  });

  it('holds its children until the saved theme preference loads, then uses it', async () => {
    let resolve: (p: 'dark') => void = () => undefined;
    const preferences = {
      load: () => new Promise<'dark'>((r) => (resolve = r)),
      save: jest.fn(() => Promise.resolve()),
    };
    function Pref(): React.JSX.Element {
      const { preference, setPreference } = useThemePreference();
      return <Button label={`pref ${preference}`} onPress={() => setPreference('light')} />;
    }
    await render(
      <AppProviders services={services} preferences={preferences}>
        <Pref />
      </AppProviders>,
    );
    expect(screen.queryByLabelText(/^pref/)).toBeNull();
    expect(mockHide).not.toHaveBeenCalled();
    await act(async () => resolve('dark'));
    expect(await screen.findByLabelText('pref dark')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('pref dark'));
    expect(preferences.save).toHaveBeenCalledWith('light');
  });

  it('falls back to the system theme when the saved preference never loads', async () => {
    jest.useFakeTimers();
    try {
      const preferences = { load: () => new Promise<'dark'>(() => undefined), save: jest.fn() };
      function Pref(): React.JSX.Element {
        return <Txt>{`pref ${useThemePreference().preference}`}</Txt>;
      }
      await render(
        <AppProviders services={services} preferences={preferences}>
          <Pref />
        </AppProviders>,
      );
      expect(screen.queryByText(/^pref/)).toBeNull();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1500);
      });
      expect(screen.getByText('pref system')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
  it('closes every dispenser connection when the app goes to the background', async () => {
    let handler: (s: AppStateStatus) => void = () => undefined;
    const remove = jest.fn();
    const listen = jest.spyOn(AppState, 'addEventListener').mockImplementation((type, cb) => {
      if (type === 'change') handler = cb as (s: AppStateStatus) => void;
      return { remove };
    });
    const closeAll = jest.spyOn(services.client, 'closeAll').mockResolvedValue(undefined);
    try {
      const { unmount } = await render(tree());
      await act(async () => handler('inactive'));
      expect(closeAll).not.toHaveBeenCalled();
      await act(async () => handler('background'));
      expect(closeAll).toHaveBeenCalledTimes(1);
      await act(async () => unmount());
      expect(remove).toHaveBeenCalled();
    } finally {
      listen.mockRestore();
      closeAll.mockRestore();
    }
  });

  it('resyncs alerts, without asking, when the app comes back to the foreground', async () => {
    let handler: (s: AppStateStatus) => void = () => undefined;
    const listen = jest.spyOn(AppState, 'addEventListener').mockImplementation((type, cb) => {
      if (type === 'change') handler = cb as (s: AppStateStatus) => void;
      return { remove: jest.fn() };
    });
    const sync = jest.spyOn(services.alerts, 'sync');
    try {
      await render(tree());
      sync.mockClear();
      await act(async () => handler('background'));
      expect(sync).not.toHaveBeenCalled();
      await act(async () => handler('active'));
      expect(sync).toHaveBeenCalledTimes(1);
      expect(sync).toHaveBeenCalledWith({ mayAsk: false });
    } finally {
      listen.mockRestore();
      sync.mockRestore();
    }
  });

  it('starts alerts once and stops on unmount', async () => {
    const listen = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    const stop = jest.fn();
    const start = jest.spyOn(services.alerts, 'start').mockReturnValue(stop);
    try {
      const { unmount } = await render(tree());
      expect(start).toHaveBeenCalledTimes(1);
      expect(stop).not.toHaveBeenCalled();
      await act(async () => unmount());
      expect(stop).toHaveBeenCalledTimes(1);
    } finally {
      start.mockRestore();
      listen.mockRestore();
    }
  });
});

function Links(): null {
  useAlertOpen();
  return null;
}

describe('useAlertOpen', () => {
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    mockPush.mockClear();
    mockReplace.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('opens the tapped dispenser', async () => {
    await store.upsert({ id: 'kitchen', name: 'Kitchen', homeTimeZone: 'UTC' });
    await render(
      <AppProviders services={services}>
        <Links />
      </AppProviders>,
    );
    await act(async () => scheduler.tap('kitchen'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dispenser/kitchen'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('tap on a removed dispenser goes home', async () => {
    await render(
      <AppProviders services={services}>
        <Links />
      </AppProviders>,
    );
    await act(async () => scheduler.tap('gone'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

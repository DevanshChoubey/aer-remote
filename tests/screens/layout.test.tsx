import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createFakeTransport } from '@/ble/testing/fakeDispenser';
import { createServices, useServices } from '@/core';
import { useThemePreference } from '@/theme';
import { AppProviders } from '@/screens/AppProviders';
import { createMemoryStore } from '@/store/memoryStore';
import { Button, Txt } from '@/ui';

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

const services = createServices({ transport: createFakeTransport({}), store: createMemoryStore() });
const tree = (): React.JSX.Element => (
  <AppProviders services={services}>
    <Probe />
  </AppProviders>
);

describe('AppProviders', () => {
  beforeEach(() => mockHide.mockClear());

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
});

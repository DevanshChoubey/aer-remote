import { render, screen, waitFor } from '@testing-library/react-native';

import { createFakeTransport } from '@/ble/testing/fakeDispenser';
import { createServices, useServices } from '@/core';
import { AppProviders } from '@/screens/AppProviders';
import { createMemoryStore } from '@/store/memoryStore';
import { Txt } from '@/ui';

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
});

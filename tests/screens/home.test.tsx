import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { createFakeTransport } from '@/ble/testing/fakeDispenser';
import { createServices, ServicesProvider, type Services } from '@/core';
import { ThemeProvider } from '@/theme';
import { createMemoryStore } from '@/store/memoryStore';
import type { SavedDispenser } from '@/store/types';
import { HomeScreen } from '@/screens/home/HomeScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));

const NOW = '2026-10-26T10:00:00.000Z';

function rig(): Services {
  return createServices({ transport: createFakeTransport({}), store: createMemoryStore() });
}

function renderHome(services: Services): ReturnType<typeof render> | Promise<unknown> {
  return render(
    <ServicesProvider services={services}>
      <ThemeProvider scheme="light">
        <HomeScreen />
      </ThemeProvider>
    </ServicesProvider>,
  );
}

const kitchen: SavedDispenser = {
  id: 'a',
  name: 'Kitchen',
  homeTimeZone: 'Asia/Kolkata',
  clockSet: true,
  lastStatus: { batteryMv: 2750, firmware: '1', autoSpray: null, spraysSinceRefill: 1100, at: NOW },
  schedules: {
    list: [
      {
        start: { h: 0, m: 0 },
        end: { h: 23, m: 0 },
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        interval: 40,
      },
    ],
    at: NOW,
  },
};

describe('HomeScreen', () => {
  beforeEach(() => mockPush.mockClear());

  it('shows the add button and the empty state with no dispensers', async () => {
    await renderHome(rig());
    expect(await screen.findByText('Add your dispenser')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add dispenser'));
    expect(mockPush).toHaveBeenCalledWith('/add');
  });

  it('shows each saved dispenser with its battery', async () => {
    const services = rig();
    await services.store.upsert(kitchen);
    await services.store.upsert({
      id: 'b',
      name: 'Bedroom',
      homeTimeZone: 'Asia/Kolkata',
      lastStatus: {
        batteryMv: 3100,
        firmware: '1',
        autoSpray: null,
        spraysSinceRefill: 0,
        at: NOW,
      },
    });
    await renderHome(services);
    expect(await screen.findByText('Kitchen')).toBeTruthy();
    expect(screen.getByText('Bedroom')).toBeTruthy();
    expect(screen.getByText('Battery 50%')).toBeTruthy();
    expect(screen.getByText('Battery 100%')).toBeTruthy();
    expect(screen.getByText('Refill 50%')).toBeTruthy();
  });

  it('opens a dispenser when its tile is pressed', async () => {
    const services = rig();
    await services.store.upsert(kitchen);
    await renderHome(services);
    await fireEvent.press(await screen.findByLabelText(/^Open Kitchen/));
    expect(mockPush).toHaveBeenCalledWith('/dispenser/a');
  });

  it('gives the tile a spoken summary', async () => {
    const services = rig();
    await services.store.upsert(kitchen);
    await renderHome(services);
    const tile = await screen.findByLabelText(/^Open Kitchen/);
    expect(tile.props.accessibilityLabel).toMatch(/Battery 50 percent/);
    expect(tile.props.accessibilityLabel).toMatch(/Refill 50 percent/);
    expect(tile.props.accessibilityLabel).toMatch(/Next spray|No schedule today/);
  });

  it('warns about a low battery and a clock that may be off', async () => {
    const services = rig();
    await services.store.upsert({
      ...kitchen,
      clockSet: false,
      lastStatus: { ...(kitchen.lastStatus ?? kitchen.lastStatus!), batteryMv: 2300 },
    });
    await renderHome(services);
    expect(
      await screen.findByText('Battery too low to spray. Replace the batteries.'),
    ).toBeTruthy();
    expect(screen.getByText('Clock may be off. Open to fix.')).toBeTruthy();
  });

  it('says it has not checked a dispenser that was never read', async () => {
    const services = rig();
    await services.store.upsert({ id: 'c', name: 'Hall', homeTimeZone: 'UTC' });
    await renderHome(services);
    expect(await screen.findByText('Not checked yet. Open to check.')).toBeTruthy();
  });

  it('never connects on its own', async () => {
    const fake = createFakeTransport({ a: {} });
    const connect = jest.spyOn(fake, 'connect');
    const scan = jest.spyOn(fake, 'scan');
    const services = createServices({ transport: fake, store: createMemoryStore() });
    await services.store.upsert(kitchen);
    await renderHome(services);
    await screen.findByText('Kitchen');
    expect(connect).not.toHaveBeenCalled();
    expect(scan).not.toHaveBeenCalled();
  });

  it('re-reads when the store changes', async () => {
    const services = rig();
    await renderHome(services);
    await screen.findByText('Add your dispenser');
    await act(async () => {
      await services.store.upsert(kitchen);
    });
    expect(await screen.findByText('Kitchen')).toBeTruthy();
    await act(async () => {
      await services.client.rename('a', 'Pantry');
    });
    expect(await screen.findByText('Pantry')).toBeTruthy();
  });

  it('has a Settings link in the header', async () => {
    await renderHome(rig());
    await fireEvent.press(await screen.findByLabelText('Settings'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('shows the Bluetooth test link in dev builds', async () => {
    await renderHome(rig());
    await fireEvent.press(await screen.findByLabelText('Bluetooth test'));
    expect(mockPush).toHaveBeenCalledWith('/dev/spike');
  });

  it('shows Try again and the Add button when loading fails, and reloads', async () => {
    const services = rig();
    jest.spyOn(services.store, 'list').mockRejectedValueOnce(new Error('disk'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderHome(services);
    expect(await screen.findByText('Could not load your dispensers.')).toBeTruthy();
    expect(screen.getByLabelText('Add dispenser')).toBeTruthy();
    await services.store.upsert(kitchen);
    await fireEvent.press(screen.getByLabelText('Try again'));
    expect(await screen.findByText('Kitchen')).toBeTruthy();
    expect(screen.queryByText('Could not load your dispensers.')).toBeNull();
  });

  it('survives a dispenser with a bad time zone', async () => {
    const services = rig();
    await services.store.upsert({ ...kitchen, homeTimeZone: 'Not/AZone' });
    await renderHome(services);
    expect(await screen.findByText('Kitchen')).toBeTruthy();
    expect(screen.getByText('No schedule today')).toBeTruthy();
  });

  it('refreshes the last-checked time every minute and stops on unmount', async () => {
    jest.useFakeTimers({ now: new Date(NOW) });
    try {
      const services = rig();
      await services.store.upsert(kitchen);
      const clear = jest.spyOn(globalThis, 'clearInterval');
      await renderHome(services);
      expect(await screen.findByText('Last checked just now')).toBeTruthy();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5 * 60_000);
      });
      expect(screen.getByText('Last checked 5 min ago')).toBeTruthy();
      await screen.unmount();
      expect(clear).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createFakeTransport, type FakeTransport } from '@/ble/testing/fakeDispenser';
import type { BleTransport } from '@/ble/transport';
import { createServices, DeviceError, ServicesProvider, type Services } from '@/core';
import { AddScreen } from '@/screens/add/AddScreen';
import { createMemoryStore } from '@/store/memoryStore';
import { ThemeProvider } from '@/theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

async function mount(transport: BleTransport, store = createMemoryStore()): Promise<Services> {
  const services = createServices({ transport, store });
  await render(
    <ServicesProvider services={services}>
      <ThemeProvider scheme="light">
        <AddScreen />
      </ThemeProvider>
    </ServicesProvider>,
  );
  return services;
}

describe('AddScreen', () => {
  beforeEach(() => mockReplace.mockClear());

  it('lists found dispensers and saves the chosen one with the phone zone', async () => {
    const fake: FakeTransport = createFakeTransport({ d1: {}, d2: {} });
    const services = await mount(fake);
    expect(await screen.findByLabelText('Choose Dispenser 1')).toBeTruthy();
    expect(screen.getByLabelText('Choose Dispenser 2')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Choose Dispenser 1'));
    const name = await screen.findByLabelText('Name');
    expect(name.props.value).toBe('Air freshener');
    await fireEvent.changeText(name, 'Hall');
    await fireEvent.press(screen.getByLabelText('Save dispenser'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const saved = await services.store.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('Hall');
    expect(saved[0]?.homeTimeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(mockReplace).toHaveBeenCalledWith(`/dispenser/${saved[0]?.id}`);
    await services.client.remove('d1'); // closes the live session so no idle timer outlives the test
  });

  it('does not list dispensers that are already saved', async () => {
    const fake = createFakeTransport({ d1: {}, d2: {} });
    const store = createMemoryStore();
    await store.upsert({ id: 'd1', name: 'Kitchen', homeTimeZone: 'UTC' });
    await mount(fake, store);
    expect(await screen.findByLabelText('Choose Dispenser 1')).toBeTruthy();
    expect(screen.queryByLabelText('Choose Dispenser 2')).toBeNull();
  });

  it('shows a busy state and an inline error when blinking fails', async () => {
    const fake = createFakeTransport({ d1: {} });
    const services = await mount(fake);
    jest.spyOn(services.client, 'blink').mockRejectedValueOnce(new DeviceError('unreachable'));
    await fireEvent.press(await screen.findByLabelText('Blink the light on Dispenser 1'));
    expect(
      await screen.findByText(
        "Can't reach the dispenser. Move closer, or close the Godrej app or any other phone that's connected to it.",
      ),
    ).toBeTruthy();
  });

  it('blinks the chosen dispenser', async () => {
    const fake = createFakeTransport({ d1: {} });
    const services = await mount(fake);
    const blink = jest.spyOn(services.client, 'blink').mockResolvedValue(undefined);
    await fireEvent.press(await screen.findByLabelText('Blink the light on Dispenser 1'));
    expect(blink).toHaveBeenCalledWith('d1');
  });

  it('explains a denied permission and retries', async () => {
    const denied = createFakeTransport({ d1: {} }, { permissionsGranted: false });
    await mount(denied);
    expect(await screen.findByText(/needs permission to find nearby devices/)).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
  });

  it('shows an inline error when saving fails', async () => {
    const fake = createFakeTransport({ d1: {} });
    const services = await mount(fake);
    jest.spyOn(services.client, 'add').mockRejectedValueOnce(new Error('x'));
    await fireEvent.press(await screen.findByLabelText('Choose Dispenser 1'));
    await fireEvent.press(await screen.findByLabelText('Save dispenser'));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows help when nothing is found, and Try again scans again', async () => {
    const fake = createFakeTransport({});
    const scan = jest.spyOn(fake, 'scan');
    await mount(fake);
    expect(await screen.findByText(/Move closer, close the Godrej app/)).toBeTruthy();
    expect(scan).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Look again'));
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('shows the help line after 15 seconds of scanning with nothing found', async () => {
    jest.useFakeTimers();
    try {
      const fake = createFakeTransport({});
      jest
        .spyOn(fake, 'scan')
        .mockImplementation(() => ({ stop: () => undefined, done: new Promise(() => undefined) }));
      await mount(fake);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });
      expect(screen.queryByText(/Move closer, close the Godrej app/)).toBeNull();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      expect(screen.getByText(/Move closer, close the Godrej app/)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops scanning on unmount and when a dispenser is picked', async () => {
    const stop = jest.fn();
    const fake = createFakeTransport({ d1: {} });
    jest.spyOn(fake, 'scan').mockImplementation((onFound) => {
      onFound({ id: 'd1', name: 'aer', rssi: -50 });
      return { stop, done: new Promise(() => undefined) };
    });
    const services = createServices({ transport: fake, store: createMemoryStore() });
    const view = await render(
      <ServicesProvider services={services}>
        <ThemeProvider scheme="light">
          <AddScreen />
        </ThemeProvider>
      </ServicesProvider>,
    );
    await fireEvent.press(await screen.findByLabelText('Choose Dispenser 1'));
    expect(stop).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(stop.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('sorts the strongest signal first', async () => {
    const fake = createFakeTransport({});
    jest.spyOn(fake, 'scan').mockImplementation((onFound) => {
      onFound({ id: 'far', name: 'aer', rssi: -90 });
      onFound({ id: 'near', name: 'aer', rssi: -40 });
      return { stop: () => undefined, done: Promise.resolve() };
    });
    const services = await mount(fake);
    const blink = jest.spyOn(services.client, 'blink').mockResolvedValue(undefined);
    await fireEvent.press(await screen.findByLabelText('Blink the light on Dispenser 1'));
    expect(blink).toHaveBeenCalledWith('near');
  });
});

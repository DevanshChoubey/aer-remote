import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useSyncExternalStore } from 'react';

import { createFakeTransport } from '@/ble/testing/fakeDispenser';
import { ServicesProvider } from '@/core';
import { DispenserClient } from '@/device/client';
import { AddScreen } from '@/screens/add/AddScreen';
import { DispenserScreen } from '@/screens/dispenser/DispenserScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ScheduleEditor } from '@/screens/schedule/ScheduleEditor';
import { createMemoryStore } from '@/store/memoryStore';
import { ThemeProvider } from '@/theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// A tiny stand-in for the router: a stack of paths, with push, replace and back.
const mockNav = {
  stack: ['/'],
  subs: new Set<() => void>(),
  set(stack: string[]): void {
    this.stack = stack;
    for (const cb of [...this.subs]) cb();
  },
  route(): string {
    return this.stack[this.stack.length - 1] ?? '/';
  },
};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (p: string) => mockNav.set([...mockNav.stack, p]),
    replace: (p: string) => mockNav.set([...mockNav.stack.slice(0, -1), p]),
    back: () => mockNav.set(mockNav.stack.slice(0, -1)),
  }),
  useLocalSearchParams: () => ({ id: mockNav.route().split('/')[2] }),
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));

function Host(): React.JSX.Element {
  const stack = useSyncExternalStore(
    (cb) => {
      mockNav.subs.add(cb);
      return () => mockNav.subs.delete(cb);
    },
    () => mockNav.stack,
  );
  const route = stack[stack.length - 1] ?? '/';
  if (route === '/add') return <AddScreen />;
  if (route.endsWith('/schedule')) return <ScheduleEditor />;
  if (route.startsWith('/dispenser/')) return <DispenserScreen />;
  return <HomeScreen />;
}

describe('add, schedule, spray, home', () => {
  beforeAll(() => {
    // Freeze only the clock, so the next-spray time is fixed while timers stay real.
    jest.useFakeTimers({
      now: new Date('2026-10-26T10:00:00Z'),
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'performance',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'hrtime',
      ],
    });
  });
  afterAll(() => jest.useRealTimers());

  it('shows the next spray time on the home tile', async () => {
    mockNav.stack = ['/'];
    const fake = createFakeTransport({ d1: {} });
    const store = createMemoryStore();
    const client = new DispenserClient(fake, store, { scheduleGapMs: 0, connectAttempts: 1 });
    await render(
      <ServicesProvider services={{ store, client }}>
        <ThemeProvider scheme="light">
          <Host />
        </ThemeProvider>
      </ServicesProvider>,
    );

    // Add
    await fireEvent.press(await screen.findByLabelText('Add dispenser'));
    await fireEvent.press(await screen.findByLabelText('Choose Dispenser 1'));
    await fireEvent.press(await screen.findByLabelText('Save dispenser'));

    // Pin the dispenser to UTC so the expected time does not depend on the machine's zone
    await act(async () => {
      await client.setHomeTimeZone('d1', 'UTC');
    });

    // Open, and add a schedule once the first check is over
    await screen.findByText('Air freshener');
    await waitFor(() =>
      expect(screen.getByLabelText('Add schedule').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(screen.getByLabelText('Add schedule'));
    await fireEvent.press(await screen.findByLabelText('Every day'));
    await fireEvent.press(screen.getByLabelText('Save schedule'));
    await waitFor(() => expect(fake.state('d1').schedules).toHaveLength(1));

    // Spray now
    await waitFor(() =>
      expect(screen.getByLabelText('Spray now').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(screen.getByLabelText('Spray now'));
    await waitFor(() => expect(fake.state('d1').spraysSinceRefill).toBe(1));
    await waitFor(() =>
      expect(screen.getByLabelText('Spray now').props.accessibilityState.disabled).toBe(false),
    );

    // Home
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(await screen.findByText(/^Next spray 10:00/)).toBeTruthy();
    expect(screen.getByText('Air freshener')).toBeTruthy();

    await act(async () => {
      await client.remove('d1');
    });
  });
});

import * as Notifications from 'expo-notifications';

import { createExpoScheduler } from '@/alerts/expoScheduler';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 5 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

const mock = jest.mocked(Notifications);
const alert = (at: Date) => ({ key: 'd1:refillLow', dispenserId: 'd1', at, title: 'T', body: 'B' });

beforeEach(() => jest.clearAllMocks());

describe('createExpoScheduler', () => {
  it('schedule uses the key as identifier and a date trigger', async () => {
    const at = new Date(Date.now() + 3_600_000);
    await createExpoScheduler().schedule(alert(at));
    expect(mock.setNotificationChannelAsync).toHaveBeenCalledWith(
      'alerts',
      expect.objectContaining({ name: 'Refill and battery', importance: 5 }),
    );
    expect(mock.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'd1:refillLow',
      content: { title: 'T', body: 'B', data: { dispenserId: 'd1' } },
      trigger: { type: 'date', date: at, channelId: 'alerts' },
    });
  });

  it('a past time schedules immediately', async () => {
    await createExpoScheduler().schedule(alert(new Date(Date.now() - 1000)));
    const call = mock.scheduleNotificationAsync.mock.calls[0]?.[0];
    expect(call?.trigger).toEqual({ channelId: 'alerts' });
  });

  it('pendingKeys ignores other identifiers', async () => {
    mock.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: 'd1:checkIn' },
      { identifier: 'someone-else' },
    ] as never);
    expect(await createExpoScheduler().pendingKeys()).toEqual(['d1:checkIn']);
  });

  it('onOpen passes the dispenser id', async () => {
    const cb = jest.fn();
    const unsubscribe = createExpoScheduler().onOpen(cb);
    const listener = mock.addNotificationResponseReceivedListener.mock.calls[0]?.[0];
    listener?.({
      notification: { request: { content: { data: { dispenserId: 'd9' } } } },
    } as never);
    expect(cb).toHaveBeenCalledWith('d9');
    unsubscribe();
  });

  it('onOpen also reports the notification that cold-started the app', async () => {
    mock.getLastNotificationResponseAsync.mockResolvedValueOnce({
      notification: { request: { content: { data: { dispenserId: 'd2' } } } },
    } as never);
    const cb = jest.fn();
    createExpoScheduler().onOpen(cb);
    await new Promise((r) => setImmediate(r));
    expect(cb).toHaveBeenCalledWith('d2');
  });

  it('maps permission status', async () => {
    const s = createExpoScheduler();
    expect(await s.permission()).toBe('undetermined');
    expect(await s.requestPermission()).toBe('granted');
  });
});

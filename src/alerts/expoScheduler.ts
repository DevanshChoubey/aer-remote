import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { t } from '@/i18n';

import type { AlertPermission, AlertScheduler, ScheduledAlert } from './scheduler';

const CHANNEL = 'alerts';

let handlerSet = false;
let channelReady: Promise<unknown> | undefined;

function ensureHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  // Show alerts as banners while the app is open too.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function ensureChannel(): Promise<unknown> {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t('alerts.channel'),
    importance: AndroidImportance.DEFAULT,
  });
  return channelReady;
}

function toPermission(status: string): AlertPermission {
  if (status === 'granted') return 'granted';
  return status === 'denied' ? 'denied' : 'undetermined';
}

function dispenserIdOf(response: Notifications.NotificationResponse | null): string | undefined {
  const id: unknown = response?.notification.request.content.data?.dispenserId;
  return typeof id === 'string' ? id : undefined;
}

/** Local notifications through expo-notifications. No push tokens and no exact alarms. */
export function createExpoScheduler(): AlertScheduler {
  ensureHandler();
  return {
    async permission() {
      return toPermission((await Notifications.getPermissionsAsync()).status);
    },
    async requestPermission() {
      return toPermission((await Notifications.requestPermissionsAsync()).status);
    },
    async pendingKeys() {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      return all.map((n) => n.identifier).filter((id) => id.includes(':'));
    },
    async schedule(a: ScheduledAlert) {
      await ensureChannel();
      const future = a.at.getTime() > Date.now();
      await Notifications.scheduleNotificationAsync({
        identifier: a.key,
        content: { title: a.title, body: a.body, data: { dispenserId: a.dispenserId } },
        // Without a type the trigger fires now; the channel id still routes it on Android.
        trigger: future
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: a.at,
              channelId: CHANNEL,
            }
          : { channelId: CHANNEL },
      });
    },
    async cancel(key) {
      await Notifications.cancelScheduledNotificationAsync(key);
    },
    async cancelAll() {
      await Notifications.cancelAllScheduledNotificationsAsync();
    },
    onOpen(cb) {
      let active = true;
      const sub = Notifications.addNotificationResponseReceivedListener((r) => {
        const id = dispenserIdOf(r);
        if (id) cb(id);
      });
      // A tap that launched the app arrives before the listener exists.
      void Notifications.getLastNotificationResponseAsync().then((r) => {
        const id = dispenserIdOf(r);
        if (active && id) cb(id);
      });
      return () => {
        active = false;
        sub.remove();
      };
    },
  };
}

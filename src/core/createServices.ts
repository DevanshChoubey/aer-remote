import AsyncStorage from '@react-native-async-storage/async-storage';

import { createAlerts, createAlertStateStore, type Alerts } from '@/alerts';
import { createExpoScheduler } from '@/alerts/expoScheduler';
import { createRnTransport } from '@/ble/rnTransport';
import type { BleTransport } from '@/ble/transport';
import { DispenserClient } from '@/device/client';
import { createAsyncStorageStore } from '@/store/asyncStorageStore';
import type { DispenserStore } from '@/store/types';

import type { Services } from './services';

export function createServices(
  deps: Partial<{ transport: BleTransport; store: DispenserStore; alerts: Alerts }> = {},
): Services {
  const transport = deps.transport ?? createRnTransport();
  const store = deps.store ?? createAsyncStorageStore(AsyncStorage);
  const alerts =
    deps.alerts ??
    createAlerts({
      store,
      scheduler: createExpoScheduler(),
      state: createAlertStateStore(AsyncStorage),
    });
  return { client: new DispenserClient(transport, store), store, alerts };
}

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createRnTransport } from '@/ble/rnTransport';
import type { BleTransport } from '@/ble/transport';
import { DispenserClient } from '@/device/client';
import { createAsyncStorageStore } from '@/store/asyncStorageStore';
import type { DispenserStore } from '@/store/types';

import type { Services } from './services';

export function createServices(
  deps: Partial<{ transport: BleTransport; store: DispenserStore }> = {},
): Services {
  const transport = deps.transport ?? createRnTransport();
  const store = deps.store ?? createAsyncStorageStore(AsyncStorage);
  return { client: new DispenserClient(transport, store), store };
}

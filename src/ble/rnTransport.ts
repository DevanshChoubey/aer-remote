import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';

import { SERVICE_UUID } from '@/protocol/uuids';

import { base64ToBytes, bytesToBase64 } from './base64';
import type {
  AdapterState,
  BleCharacteristic,
  BleConnection,
  BleTransport,
  FoundDevice,
} from './transport';

const DISCONNECT_TIMEOUT_MS = 3000;
const ANDROID_MTU = 185;
/** A monitor that fails right away (e.g. no CCCD) rejects subscribe(); later errors go to onError. */
const SUBSCRIBE_SETTLE_MS = 250;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

export function mapState(state: State): AdapterState {
  switch (state) {
    case State.PoweredOn:
      return 'on';
    case State.PoweredOff:
      return 'off';
    case State.Unauthorized:
      return 'unauthorized';
    case State.Unsupported:
      return 'unsupported';
    default:
      return 'unknown';
  }
}

async function androidPermissions(): Promise<boolean> {
  const version =
    typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  if (version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      result['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
      result['android.permission.BLUETOOTH_CONNECT'] === 'granted'
    );
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === 'granted';
}

function wrapDevice(manager: BleManager, device: Device): BleConnection {
  const id = device.id;
  return {
    deviceId: id,
    async characteristics(): Promise<BleCharacteristic[]> {
      const list = await device.characteristicsForService(SERVICE_UUID);
      return list.map((c) => ({
        uuid: c.uuid.toLowerCase(),
        writable: c.isWritableWithoutResponse || c.isWritableWithResponse,
        notifiable: c.isNotifiable || c.isIndicatable,
      }));
    },
    async write(charUuid, bytes): Promise<void> {
      await device.writeCharacteristicWithoutResponseForService(
        SERVICE_UUID,
        charUuid,
        bytesToBase64(bytes),
      );
    },
    subscribe(charUuid, onData, onError): Promise<() => void> {
      return new Promise((resolve, reject) => {
        let settled = false;
        let sub: Subscription | null = null;
        const remove = (): void => {
          sub?.remove();
          sub = null;
        };
        const timer = setTimeout(() => {
          settled = true;
          resolve(remove);
        }, SUBSCRIBE_SETTLE_MS);
        sub = device.monitorCharacteristicForService(SERVICE_UUID, charUuid, (error, c) => {
          if (error) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              remove();
              reject(toError(error));
            } else if (onError) {
              onError(toError(error));
            }
            return;
          }
          if (c?.value) onData(base64ToBytes(c.value));
        });
      });
    },
    onDisconnect(cb): () => void {
      const sub = manager.onDeviceDisconnected(id, () => cb());
      return () => sub.remove();
    },
    async disconnect(): Promise<void> {
      // Never hang: the link is released best-effort if the stack does not answer in time.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, DISCONNECT_TIMEOUT_MS);
      });
      try {
        await Promise.race([manager.cancelDeviceConnection(id).then(() => undefined), timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function createRnTransport(): BleTransport {
  let manager: BleManager | null = null;
  const mgr = (): BleManager => {
    manager ??= new BleManager();
    return manager;
  };

  return {
    async adapterState(): Promise<AdapterState> {
      if (Platform.OS === 'android' && !(await androidPermissions())) return 'unauthorized';
      return mapState(await mgr().state());
    },

    requestPermissions(): Promise<boolean> {
      return Platform.OS === 'android' ? androidPermissions() : Promise.resolve(true);
    },

    scan(onFound, timeoutMs): { stop(): void; done: Promise<void> } {
      const m = mgr();
      let finish: () => void = () => undefined;
      let fail: (e: Error) => void = () => undefined;
      const done = new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      let stopped = false;
      const stop = (): void => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        m.stopDeviceScan().then(finish, fail);
      };
      const timer = setTimeout(stop, timeoutMs);
      m.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, async (error, device) => {
        if (error) {
          if (!stopped) {
            stopped = true;
            clearTimeout(timer);
            m.stopDeviceScan().catch(() => undefined);
            fail(toError(error));
          }
          return;
        }
        if (device && !stopped) {
          const found: FoundDevice = {
            id: device.id,
            name: device.name ?? device.localName ?? null,
            rssi: device.rssi,
          };
          onFound(found);
        }
      }).catch((e: unknown) => {
        stopped = true;
        clearTimeout(timer);
        fail(toError(e));
      });
      return { stop, done };
    },

    async connect(deviceId, timeoutMs): Promise<BleConnection> {
      const m = mgr();
      let timedOut = false;
      const attempt = m.connectToDevice(deviceId, { timeout: timeoutMs });
      const timeout = sleep(timeoutMs).then(() => {
        timedOut = true;
        throw new Error('connect timed out');
      });
      // A late success after the timeout must not keep the dispenser's single connection slot.
      attempt.then(
        () => {
          if (timedOut) m.cancelDeviceConnection(deviceId).catch(() => undefined);
        },
        () => undefined,
      );
      try {
        const connected = await Promise.race([attempt, timeout]);
        const ready = await connected.discoverAllServicesAndCharacteristics();
        const device = Platform.OS === 'android' ? await ready.requestMTU(ANDROID_MTU) : ready;
        return wrapDevice(m, device);
      } catch (e) {
        await m.cancelDeviceConnection(deviceId).catch(() => undefined);
        throw toError(e);
      }
    },
  };
}

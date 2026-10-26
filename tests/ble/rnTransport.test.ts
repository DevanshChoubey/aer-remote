import { BleErrorCode, State, type BleManager, type Device } from 'react-native-ble-plx';

import { mapState, settledState, wrapDevice } from '@/ble/rnTransport';

describe('mapState', () => {
  it.each([
    [State.PoweredOn, 'on'],
    [State.PoweredOff, 'off'],
    [State.Unauthorized, 'unauthorized'],
    [State.Unsupported, 'unsupported'],
    [State.Resetting, 'unknown'],
    [State.Unknown, 'unknown'],
  ] as const)('%s -> %s', (state, expected) => {
    expect(mapState(state)).toBe(expected);
  });
});

describe('settledState', () => {
  const fakeManager = (
    initial: State,
    later?: State,
  ): { m: BleManager; removed: () => boolean } => {
    let removed = false;
    const m = {
      state: async () => initial,
      onStateChange: (cb: (s: State) => void) => {
        if (later) setTimeout(() => cb(later), 10);
        return {
          remove: () => {
            removed = true;
          },
        };
      },
    } as unknown as BleManager;
    return { m, removed: () => removed };
  };

  it('returns a settled state immediately', async () => {
    expect(await settledState(fakeManager(State.PoweredOn).m, 50)).toBe(State.PoweredOn);
  });

  it('waits out Unknown and removes the subscription', async () => {
    const { m, removed } = fakeManager(State.Unknown, State.PoweredOn);
    expect(await settledState(m, 500)).toBe(State.PoweredOn);
    expect(removed()).toBe(true);
  });

  it('gives up after the timeout', async () => {
    const { m, removed } = fakeManager(State.Resetting);
    expect(await settledState(m, 30)).toBe(State.Resetting);
    expect(removed()).toBe(true);
  });
});

describe('wrapDevice subscribe', () => {
  type Listener = (e: { errorCode: number } | null, c: { value: string } | null) => void;
  const rig = (): {
    listener: () => Listener;
    removed: () => boolean;
    conn: ReturnType<typeof wrapDevice>;
  } => {
    let listener: Listener = () => undefined;
    let removed = false;
    const device = {
      id: 'd',
      monitorCharacteristicForService: (_s: string, _c: string, l: Listener) => {
        listener = l;
        return {
          remove: () => {
            removed = true;
          },
        };
      },
    } as unknown as Device;
    return {
      listener: () => listener,
      removed: () => removed,
      conn: wrapDevice({} as BleManager, device),
    };
  };

  it('rejects an immediate monitor error', async () => {
    const r = rig();
    const p = r.conn.subscribe('c', () => undefined);
    r.listener()({ errorCode: BleErrorCode.DescriptorNotFound }, null);
    await expect(p).rejects.toBeInstanceOf(Error);
    expect(r.removed()).toBe(true);
  });

  it('reports later errors but not cancel, disconnect or post-close errors', async () => {
    jest.useFakeTimers();
    try {
      const r = rig();
      const onError = jest.fn();
      const p = r.conn.subscribe('c', () => undefined, onError);
      jest.advanceTimersByTime(300);
      const off = await p;
      r.listener()({ errorCode: BleErrorCode.OperationCancelled }, null);
      r.listener()({ errorCode: BleErrorCode.DeviceDisconnected }, null);
      expect(onError).not.toHaveBeenCalled();
      r.listener()({ errorCode: BleErrorCode.CharacteristicReadFailed }, null);
      expect(onError).toHaveBeenCalledTimes(1);
      off();
      r.listener()({ errorCode: BleErrorCode.CharacteristicReadFailed }, null);
      expect(onError).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

import { State } from 'react-native-ble-plx';

import { mapState } from '@/ble/rnTransport';

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

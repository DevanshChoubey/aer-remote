import { DeviceError } from '@/core';
import { t } from '@/i18n';
import { errorCopyKey } from '@/screens/errorCopy';

// @/core imports AsyncStorage for the default store; the native module is absent under Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('errorCopyKey', () => {
  it('maps device error codes to errors.<code>', () => {
    expect(errorCopyKey(new DeviceError('unreachable'))).toBe('errors.unreachable');
    expect(errorCopyKey(new DeviceError('bluetoothOff'))).toBe('errors.bluetoothOff');
    expect(errorCopyKey(new DeviceError('permissionDenied'))).toBe('errors.permissionDenied');
    expect(errorCopyKey(new DeviceError('noReply'))).toBe('errors.noReply');
    expect(errorCopyKey(new DeviceError('disconnected'))).toBe('errors.disconnected');
    expect(errorCopyKey(new DeviceError('timeZone'))).toBe('errors.timeZone');
    expect(t('errors.timeZone')).toBe(
      "This dispenser's time zone isn't valid. Pick it again in Settings.",
    );
  });

  it('maps a battery rejection to the battery copy', () => {
    expect(errorCopyKey(new DeviceError('rejected', 'batteryTooLow'))).toBe('errors.batteryTooLow');
    expect(t('errors.batteryTooLow')).toBe('Battery too low to spray. Replace the batteries.');
  });

  it('keeps other rejections on their own copy', () => {
    expect(errorCopyKey(new DeviceError('rejected', 'invalid schedules'))).toBe('errors.rejected');
  });

  it('falls back to generic for anything else', () => {
    expect(errorCopyKey(new Error('x'))).toBe('errors.generic');
    expect(errorCopyKey('boom')).toBe('errors.generic');
    expect(errorCopyKey(undefined)).toBe('errors.generic');
  });

  it('every key it can return has copy', () => {
    expect(t('errors.unreachable')).toBe(
      "Can't reach the dispenser. Move closer, or close the Godrej app or any other phone that's connected to it.",
    );
    expect(t('errors.generic').length).toBeGreaterThan(5);
  });
});

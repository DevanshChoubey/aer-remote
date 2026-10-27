/** Every failure the app explains to the user; screens map each one to errors.<code> copy. */
export const DEVICE_ERROR_CODES = [
  'bluetoothOff',
  'permissionDenied',
  'unreachable',
  'noReply',
  'rejected',
  'batteryTooLow',
  'disconnected',
  'timeZone',
  'notDispenser',
] as const;

export type DeviceErrorCode = (typeof DEVICE_ERROR_CODES)[number];

export class DeviceError extends Error {
  constructor(
    readonly code: DeviceErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DeviceError';
  }
}

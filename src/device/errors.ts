export type DeviceErrorCode =
  'bluetoothOff' | 'permissionDenied' | 'unreachable' | 'noReply' | 'rejected' | 'disconnected';

export class DeviceError extends Error {
  constructor(
    readonly code: DeviceErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DeviceError';
  }
}

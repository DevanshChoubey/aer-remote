import { DeviceError } from '@/core';

/** The errors.* copy key for a failure; screens never show raw error messages. */
export function errorCopyKey(e: unknown): string {
  if (e instanceof DeviceError) {
    if (e.code === 'rejected' && e.message === 'batteryTooLow') return 'errors.batteryTooLow';
    return `errors.${e.code}`;
  }
  return 'errors.generic';
}

export default {
  bluetoothOff: 'Bluetooth is off. Turn it on in your phone settings, then try again.',
  permissionDenied:
    'This app needs permission to find nearby devices. Allow it in your phone settings, then try again.',
  unreachable:
    'Could not reach the dispenser. Make sure it is switched on and close to you. Another phone or the Godrej app may be connected to it. Close that, then try again.',
  noReply: 'The dispenser did not answer. Move closer and try again.',
  rejected:
    'The dispenser refused that request. It may be busy or have its own limits. Wait a moment, then try again.',
  batteryTooLow: 'The dispenser battery is too low to do that. Replace the batteries first.',
  disconnected: 'The connection to the dispenser was lost. Try again.',
  unknown: 'Something went wrong. Please try again.',
} as const;

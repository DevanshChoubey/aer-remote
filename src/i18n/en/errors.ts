export default {
  bluetoothOff: 'Bluetooth is off. Turn it on in your phone settings, then try again.',
  permissionDenied:
    'This app needs permission to find nearby devices. Allow it in your phone settings, then try again.',
  unreachable:
    "Can't reach the dispenser. Move closer, or close the Godrej app or any other phone that's connected to it.",
  noReply: 'The dispenser did not answer. Move closer and try again.',
  rejected:
    'The dispenser refused that request. It may be busy or have its own limits. Wait a moment, then try again.',
  batteryTooLow: 'Battery too low to spray. Replace the batteries.',
  disconnected: 'The connection to the dispenser was lost. Try again.',
  timeZone: "This dispenser's time zone isn't valid. Pick it again in Settings.",
  generic: 'Something went wrong. Please try again.',
} as const;

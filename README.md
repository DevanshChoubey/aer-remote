# Aer Remote

Aer Remote controls a Godrej aer Smart Matic air freshener from your phone over Bluetooth. You can
spray on demand, turn auto spray on or off, edit the schedules and check the battery and refill level.

Unofficial app. Not affiliated with Godrej.

## Privacy

The app works fully offline. It has no network calls, no account and no analytics. Release builds
hold no network permission at all. It never asks for your location, and the location permission is
blocked. It talks to your dispenser over Bluetooth only, and what it saves (dispenser names, time
zones, the last status) stays on your phone.

## Build for Android (Linux)

Bluetooth needs a real phone: emulators have none. You need Bun, the JDK (17), the Android SDK with
`ANDROID_HOME` set, and an Android 12 or newer phone with USB debugging on, plugged in. Android 12
is the minimum (minSdk 31): older versions will not install the app.

```sh
bun install
bunx expo run:android
```

## Build for iOS (Mac)

Bluetooth needs a real iPhone: the iOS simulator has none. It also needs a development build, so Expo
Go will not work. You need Xcode, CocoaPods, and Developer Mode on the iPhone (Settings, Privacy &
Security).

```sh
git clone https://github.com/DevanshChoubey/aer-remote.git
cd aer-remote
bun install
bunx expo run:ios --device
```

Pick your phone when asked. If signing fails, open the `.xcworkspace` under `ios/` in Xcode, choose
your team under Signing & Capabilities and sign in with a free Apple ID.

## Everyday use

A development build needs Metro running on your computer. For an app that works away from the
computer, install a release build:

```sh
bunx expo run:android --variant release
bunx expo run:ios --device --configuration Release
```

A build signed with a free Apple ID expires after 7 days. Rebuild then.

## Development

```sh
bun run start   # or: bunx expo start --dev-client
```

## Tests

```sh
bun run test
bun run typecheck
bun run lint
```

## More

- Protocol notes: `docs/protocol`
- Hardware test results: `docs/spike/hardware-results.md`
- Engineering rules: `docs/ENGINEERING.md`

## Licence

MIT, see `LICENSE`.

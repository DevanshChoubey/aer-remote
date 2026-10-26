# Aer Remote

Aer Remote controls a Godrej aer Smart Matic air freshener from your phone over Bluetooth. You can
spray on demand, turn auto spray on or off, edit the schedules and check the battery and refill level.

Unofficial app. Not affiliated with Godrej.

## Privacy

The app works fully offline. It has no network calls, no account, no analytics and never asks for
your location. It talks to your dispenser over Bluetooth only, and what it saves (dispenser names,
time zones, the last status) stays on your phone.

## Build for Android (Linux)

Needs Bun, JDK 17 and the Android SDK. Android 12 or newer.

```sh
bun install
bunx expo run:android
```

## Build for iOS (Mac)

Bluetooth needs a development build, so Expo Go will not work.

```sh
git clone https://github.com/DevanshChoubey/aer-remote.git
cd aer-remote
bun install
bunx expo run:ios
```

In Xcode, open the project under `ios/`, pick your team under Signing & Capabilities and sign in
with a free Apple ID. Free signing expires after 7 days, so rebuild to renew it.

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

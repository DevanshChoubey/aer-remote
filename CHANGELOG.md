# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Privacy policy (`PRIVACY.md`) and the Google Play listing text (`docs/store/google-play.md`).

### Changed

- New app icon and splash: a spray can with dotted mist, replacing the rounded dispenser.
- Expo SDK 58 patch updates (expo 58.0.21, React Native 0.88.1 and nine other Expo packages), so
  `expo-doctor` passes again.

## [1.0.0] - 2026-10-27

The first release. Passed the hardware test on one Android phone (10 of 10 connects within 5 s at
about 3 m, firmware 3.0.8-IN). iOS is not tested on hardware yet. The signed APK needs Android 12
or newer.

### Added

- Bluetooth protocol layer in pure TypeScript: a CBOR codec that matches the vendor app's bytes,
  message builders, 5-byte schedule entries, status parsing and reply matching.
- `BleTransport` interface, a `react-native-ble-plx` adapter, and a fake dispenser for tests.
- Dispenser sessions with reply matching on `mT` and `mN`, connect retries with backoff, a channel
  probe for firmware that listens on another characteristic, and the clock set on every connect.
- Dispenser client with a per-device queue and a 10 s idle disconnect.
- Dispenser store with AsyncStorage and in-memory backends.
- Home screen: dispenser tiles with battery, refill, today's next spray and when the status was
  last checked.
- Add dispenser: scan, blink the light to confirm which one, name it and pick its home time zone.
- Dispenser screen: spray now, auto spray (10, 20 or 40 min), status, refill reset, schedules,
  rename and remove.
- Schedule editor: start and end time, days, interval, an estimate of sprays a day, and read-back
  after saving.
- Settings: theme (match the phone, light, dark), each dispenser's time zone, and an about card.
- "Warm & homely" theme with light and dark tokens, Fraunces and Nunito fonts, and AA contrast.
- "Night slate" theme from the design mockup.
- Refill and battery alerts: local notifications planned from the last status, once per can, with
  a switch in Settings. No server and no push.
- Home tiles say "Done for today" once today's sprays have passed.
- App icon and splash screen.
- Release builds are signed with an upload key kept outside the repo, when its variables are set.
- `bun run android` and `bun run ios` build and start the native app.
- Bluetooth test screen for the hardware spike (debug builds only).
- Engineering rules, lint rules for layering and theme, lefthook hooks and CI.
- Docs: README, architecture, protocol notes, contributing guide, security policy, code of
  conduct, issue and pull request templates, and design-preview images.

### Changed

- Schedules are edited by value and matched by their full value, end time included.
- Back sits beside the screen title, and Spray now is pinned to the bottom of the dispenser screen.

### Fixed

- Every connection closes when the app goes to the background.
- A failed connect is cancelled within a bounded time, so it cannot hold the dispenser.
- Scan, permission and time-zone failures become plain-language errors.
- Undecodable schedule lists are rejected instead of dropping entries; a null list reads as no
  schedules.
- Status replies without a battery value are rejected.
- Schedule windows are read back from the dispenser, a window's end-time spray is counted, and the
  refill plan knows that a schedule window stops auto-spray (seen on hardware).
- Alerts resync when the app comes back, ask for permission on Android 13 and later, and tell
  repeat taps apart.
- iOS builds no longer carry the push entitlement that expo-notifications adds.

### Security

- Release builds on Android hold no `INTERNET` permission. Location and other unneeded permissions
  are blocked, and Android 12 (API 31) is the minimum.

[Unreleased]: https://github.com/DevanshChoubey/aer-remote/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/DevanshChoubey/aer-remote/releases/tag/v1.0.0

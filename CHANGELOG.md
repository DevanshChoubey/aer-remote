# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The first version (v1). Not yet tested on a real dispenser. No release has been tagged; the app
reports version 1.0.0 (`app.json`).

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
- App icon and splash screen.
- Bluetooth test screen for the hardware spike (debug builds only).
- Engineering rules, lint rules for layering and theme, lefthook hooks and CI.
- Docs: README, architecture, protocol notes, contributing guide, security policy, code of
  conduct, issue and pull request templates, and design-preview images.

### Changed

- Schedules are edited by value and matched by their full value, end time included.

### Fixed

- Every connection closes when the app goes to the background.
- A failed connect is cancelled within a bounded time, so it cannot hold the dispenser.
- Scan, permission and time-zone failures become plain-language errors.
- Undecodable schedule lists are rejected instead of dropping entries; a null list reads as no
  schedules.
- Status replies without a battery value are rejected.

### Security

- Release builds on Android hold no `INTERNET` permission. Location and other unneeded permissions
  are blocked, and Android 12 (API 31) is the minimum.

[Unreleased]: https://github.com/DevanshChoubey/aer-remote/commits/main

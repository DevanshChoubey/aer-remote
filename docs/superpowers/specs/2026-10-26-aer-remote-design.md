# Aer Remote: Design

_Date: 2026-10-26 · Status: draft for review_

Working name **Aer Remote** _(Claude's call; easy to change)_. Store listing must not use Godrej's
name or logo as the app's name; describe it as "works with Godrej aer Smart Matic" with an
"unofficial, not affiliated with Godrej" note.

## 1. Intent and the why

The Godrej aer Smart Matic is a Bluetooth air-freshener dispenser. The official app drops the
connection often, has a poor UI and is no longer maintained. The household sets a spray schedule once
and leaves it; when they do need to change something, the app should just work.

This app is a **reliable, well-made replacement controller** for the same hardware. It talks to the
dispenser directly over Bluetooth, needs no account and no internet, and is pleasant to use.

The protocol is known: see `docs/protocol/aer-ble-protocol.md` (decoded from the official Android app
and two open-source projects). Every command in v1 is documented there.

## 2. Users

- The author's household, then any Smart Matic owner. Non-technical family members must be able to use
  it unaided, as in Home Inventory.
- Usually one dispenser per home, but a home may have several (one per room).

## 3. Goals

1. **Connect every time.** Finding and talking to the dispenser should succeed reliably. When it can't,
   the app says why in plain words (out of range, another phone or the official app is connected,
   Bluetooth off, battery dead) and what to do.
2. **Set and forget schedules.** Create, edit and delete up to 10 schedules (start time, end time,
   weekdays, interval of 10/20/40 min). They are written to the dispenser and run on it with no phone
   nearby. The app reads them back from the device so it always shows what the device really has.
3. **Quick controls:** spray now; auto-spray on/off with interval (10/20/40 min).
4. **Status at a glance:** battery (%), refill remaining (estimate), firmware, last seen. Refill
   replaced → reset the counter.
5. **Correct clock:** set the dispenser's time on every connection, silently, using the dispenser's
   home time zone (see §6 Schedules).
6. **Several dispensers:** add, rename (local name only, e.g. "Living room"), remove.
7. **Fully offline and private.** No account, no server, no analytics, no network calls at all.

## 4. Non-goals (v1)

- Desktop apps (Windows, macOS, Linux). **Phase 2**, but the architecture must allow them (see §6).
- Store release and payments. Builds are installed directly for now (Android APK; iPhone via a dev
  build). Releasing is a later decision.
- Push notifications for low battery/refill when the app is closed (needs background Bluetooth). v1
  shows warnings when the app is opened.
- Firmware updates (OTA), the vendor's provisioning (mT 101), preset schedules from Godrej's server,
  buying refills, accounts.
- Home Assistant / voice-assistant integration.
- Overnight schedule windows (the device doesn't support end-before-start). The UI may later split
  one into two entries; not in v1.

## 5. Anti-goals

- Holding a long-lived connection that locks other phones out of the dispenser.
- Any network permission, telemetry or account.
- Dated, cluttered or confusing UI; tiny touch targets.
- Showing state the app _thinks_ the device has instead of what it read from the device.

## 6. Decisions

### Stack and engineering rules

Same as Home Inventory: **Expo (latest SDK) + TypeScript, Bun only**, and its `docs/ENGINEERING.md`
copied and adapted (layering, primitives, centralized theme tokens with dark mode, i18n strings,
strict TS, typed errors, TDD, Prettier/ESLint, lefthook, Conventional Commits, CI). Differences:

- Domain modules: `src/protocol` (CBOR encode/decode, message builders, schedule bytes),
  `src/device` (connection manager, command queue, retries, device session), `src/store` (local data),
  `src/ble` (transport interface plus the React Native adapter).
- **`src/protocol` and `src/device` are plain TypeScript with no React Native imports**, enforced by
  ESLint, so a desktop app can reuse them in Phase 2. Bluetooth is reached only through a
  `BleTransport` interface; v1 ships the `react-native-ble-plx` implementation (Expo dev build, config
  plugin). _(Claude's call.)_
- Privacy rule becomes: no `fetch`/network anywhere; Android manifest has no `INTERNET` permission in
  release builds if Expo allows it.

### Connection model (the core of "reliable")

- **Connect on demand, do the work, disconnect** after a short idle (~10 s) so the dispenser is free
  for others. _(Claude's call; tune on hardware.)_
- One command queue per device: commands run one at a time; each waits for its reply (matching
  `mN`, `mT+50`, `ack 200`) with a timeout; retries with backoff on connect failures.
- On every connect: subscribe to `…0001`, set time (mT 102), fetch status (mT 107).
- Channel probe on first connect: try the standard channels; if fetch-status gets no reply, try the
  other writable characteristics and remember the pair that answers (firmware quirk).
- Scan filter: devices advertising the `6E400000-…` service. Remember the device id so later
  connects skip the scan where the OS allows.

### Schedules

- The device is the source of truth: on opening a dispenser, read schedules (mT 109) and status.
- Saving is replace-all, as the vendor app does: remove (mT 108), short wait, set (mT 103) with the
  full list, then read back (mT 109) to confirm.
- Validation in the UI: end after start, at least one weekday, ≤10 schedules, ≤255 sprays per window.
- **No per-schedule pause in v1** _(Claude's call)_: the device keeps no readable paused flag and slot
  numbers shift on replace-all, so pausing can't be shown truthfully. To pause, delete the schedule.
- **Time zone:** each dispenser stores a home time zone, set when it is added (defaults to the
  phone's). On connect the app writes the current time with the dispenser's home zone, not the
  phone's, so a travelling family member doesn't shift the schedule _(Claude's call)_.

### Local data

Small: dispensers (id, local name, last status, discovered channels) and a cache of last-read
schedules for offline display. Builder chooses storage.

### Screens (v1)

1. **Home:** list/tiles of dispensers with name, battery, refill and today's next spray. Empty state:
   "Add your dispenser".
2. **Add dispenser:** scan, pick the found device, "blink LED" (mT 113) to confirm which one, name it.
3. **Dispenser:** big "Spray now", auto-spray switch with 10/20/40, status card, schedules list, refill
   reset, rename/remove.
4. **Schedule editor:** start time, end time, weekday chips, interval chips; shows "about N sprays a
   day".
5. **Settings:** language, theme (system/light/dark), about (unofficial notice, licence).

### Visual design

Modern, calm and friendly, with big touch targets, on the same token system as Home Inventory so it
can change in one place.

- **Direction: "Warm & homely"** (chosen by the author from three directions, 2026-10-26). Home
  Inventory's palette and fonts: cream, terracotta and saffron; Fraunces headings with Nunito body;
  rounded, filled tiles. The two apps look like a family. Dark mode uses Home Inventory's dark tokens.
- Reference mockup (option B): `docs/design/visual-directions-mockup.html`.

### Distribution

GitHub `DevanshChoubey/aer-remote` (the author's personal account), private for now, **MIT** _(Claude's call)_. Own protocol notes are fine to
publish; never commit decompiled vendor code or the APK.

## 7. Constraints

- Test hardware: the author's dispenser, an Android phone and an iPhone. Must work on mid-range
  Android phones.
- Builds: code is written on Linux and pushed to the author's personal GitHub. iPhone builds are made
  locally on the author's Mac with Xcode (clone, `bunx expo run:ios`), not in Expo's cloud. Android
  builds can be made locally on Linux.
- Android 12+ Bluetooth permissions (`BLUETOOTH_SCAN` with `neverForLocation`, `BLUETOOTH_CONNECT`);
  iOS Bluetooth usage string.
- The dispenser accepts one connection at a time; the official app must be closed while testing.

## 8. Risks and the first spike

**Biggest unknown:** the protocol notes are untested on our hardware, and some firmware has no
notification descriptor (CCCD) on the reply channel, which may stop `react-native-ble-plx` from
subscribing.

**Spike first** (throwaway dev build, one screen of buttons): connect, subscribe, fetch status, set
time, spray now, read/remove/set schedules, on both the Android phone and the iPhone. Record firmware
version, which channels answered, whether notifications worked, and connect time.

**If notifications fail on a platform** _(Claude's call)_: write a small native Expo module for that
platform that enables notifications directly (Android: `setCharacteristicNotification` without
writing the CCCD; iOS: CoreBluetooth `setNotifyValue`). It lives behind the same `BleTransport`
interface. A native module is in scope.

**If the pass bar fails** _(Claude's call)_: don't stop. Tune timeouts and retries, then retest. If
only one platform fails, carry on and ship that platform first. Stop and come back to the author only
if neither phone can connect reliably.

**Pass bar** _(Claude's call)_: 10 of 10 connect-and-fetch-status attempts succeed within 5 s each, at
3 m from the dispenser, on both phones.

## 9. Left to the builder

- Local storage, state management, navigation and component libraries.
- CBOR library (or a small hand-written encoder/decoder; must handle the 8-byte integer quirk).
- Exact timeouts, backoff and idle-disconnect values (tuned in the spike).
- Battery-percentage curve and refill estimate details (start from the protocol notes).
- Onboarding copy and empty states.

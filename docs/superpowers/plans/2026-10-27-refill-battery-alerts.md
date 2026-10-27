# Refill and Battery Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local notifications that warn when a dispenser's refill is predicted to drop below 10% or
reach 0%, or a reading shows its battery low or flat, plus a reminder after 14 days without a
reading. Everything runs offline, with no background Bluetooth.

**Architecture:**

- **Planner:** a pure planner (`src/alerts/plan.ts`) turns a saved dispenser into planned alerts:
  keys, kinds and delivery times.
- **Engine:** an engine (`src/alerts/engine.ts`) listens to `DispenserStore.subscribe`. It applies
  the once-only rules, using a small AsyncStorage state, and drives an `AlertScheduler` interface.
  The real scheduler wraps `expo-notifications`; a fake one serves the tests.
- **Wiring:** `createServices` wires the engine into `Services`. Settings gets the on/off switch.
  Release builds strip what `expo-notifications` brings in for Firebase push.

**Tech Stack:** Expo SDK 58, `expo-notifications` `~58.1.6`, AsyncStorage, Jest (jest-expo).

**Spec:** `docs/superpowers/specs/2026-10-27-refill-battery-alerts-design.md`. Read it first. It
also extends `docs/superpowers/specs/2026-10-26-aer-remote-design.md`.

## Global Constraints

- **Rules:** follow `docs/ENGINEERING.md` in full.
  - Layering, and all copy in `src/i18n/en`.
  - No `fetch`.
  - Bun only (`bun add`, `bunx expo install`).
  - Conventional Commits ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Checks:** `bun run test`, `bun run typecheck` and `bun run lint` must pass before every
  commit.
- **Branch:** work on branch `lane/refill-alerts`. Never push to `main` (a pre-push hook blocks
  it). The branch reaches `main` through a pull request.
- **Thresholds:**
  - refill low when `refillPercent(count) < 10`, out when `refillPercent(count) === 0`;
  - battery low when `batteryPercent(mv) < 10`, flat when `isBatteryTooLow(mv)`;
  - battery alerts re-arm when `batteryPercent(mv) > 30`;
  - check-in 14 days after `lastStatus.at`.
- **Rates:** a schedule adds `sprayCount(s)` on each of its weekdays, in the dispenser's
  `homeTimeZone`. Auto-spray adds one spray every `interval` minutes, all day. Both add together.
- **Delivery window:** 09:00–21:00 in the phone's time zone. Anything due outside it moves to the
  next 09:00. A delivery time already in the past means "now", moved into the window.
- **Network:** none. The merged release manifest must have no `INTERNET`, `ACCESS_NETWORK_STATE`,
  `com.google.android.c2dm.permission.RECEIVE` or location permission, and no Firebase messaging
  service or receiver.
- **iOS signing:** iOS must not gain the `aps-environment` entitlement. A free Apple ID can't sign
  it, and local notifications don't need it.
- **Asking for permission:**
  - The app asks only during a sync caused by a store change, never during the first sync at
    launch.
  - If permission is denied, the app schedules nothing and doesn't ask again on its own.
- **Copy (en), exact** (namespace `alerts`):
  - `refillLowTitle` "Refill running low"; `refillLow` "{name} is almost out of refill."
  - `refillOutTitle` "Out of refill"; `refillOut` "{name} is out of refill. Put in a new can, then
    tap I refilled it."
  - `batteryLowTitle` "Batteries low"; `batteryLow` "{name}'s batteries are low. Replace them soon."
  - `batteryFlatTitle` "Batteries flat"; `batteryFlat` "{name}'s batteries are flat, so it can't
    spray. Replace them now."
  - `checkInTitle` "Time for a check"; `checkIn` "It's been a while. Open Aer Remote to check
    {name}."
  - `channel` "Refill and battery".
  - In `settings`: `alerts` "Refill and battery alerts"; `alertsHint` "Refill alerts are estimated
    from your schedules."; `alertsDenied` "Notifications are off for Aer Remote in your phone's
    settings."; `alertsOpenSettings` "Open phone settings".

## Review Focus

1. **A crossing that is already past at the first reading.** For example, a can already below
   10% when the feature ships. This must notify once now, or at 09:00, and never again on later
   launches. Pinned by the Task 4 test "already past fires once, not on the next launch".
2. **Launching the app with an old reading.** The launch sync must not re-fire a check-in or a
   refill alert whose time has passed. Pinned by the Task 4 test "a passed delivery is not
   rescheduled".
3. **A DST change between the reading and the crossing** (`Europe/London`, last Sunday of
   October). The planner must pick the correct calendar day. Pinned by the Task 1 test "crossing
   across a DST change".
4. **Removing a dispenser while its alerts are pending, and keys left from cleared data.** Both
   are cancelled. Pinned by the Task 4 test "cancels keys of dispensers no longer saved".
5. **A notification tap for a removed dispenser.** It opens Home, not a broken screen. Pinned by
   the Task 5 test "tap on a removed dispenser goes home".

---

### Task 1: Pure alert planner

**Files:**
- Create: `src/alerts/plan.ts`
- Modify: `src/device/time.ts`. Export a wall-clock helper; this is the only change there.
- Modify: `eslint.config.js`. Add `'alerts'` to `DOMAIN_FOLDERS`, and add `src/alerts/plan.ts` to
  the pure-TypeScript block that `src/protocol/**` and `src/device/**` use.
- Test: `tests/alerts/plan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AlertKind = 'refillLow' | 'refillOut' | 'batteryLow' | 'batteryFlat' | 'checkIn';
  export interface PlannedAlert {
    key: string;          // `${dispenserId}:${kind}`
    dispenserId: string;
    kind: AlertKind;
    at: Date;             // delivery time, already inside the 09:00–21:00 phone window
  }
  export interface PlanInput {
    dispenser: SavedDispenser;   // from '@/store/types'
    now: Date;
    phoneTimeZone: string;
  }
  export function planAlerts(input: PlanInput): PlannedAlert[];
  export function intoWindow(at: Date, now: Date, phoneTimeZone: string): Date;
  export const alertKey: (dispenserId: string, kind: AlertKind) => string;
  ```
- `planAlerts` returns nothing for a dispenser without `lastStatus`. Refill alerts are left out
  when the spray rate is zero or the crossing is more than 365 days after `lastStatus.at`. Battery
  alerts appear only when the threshold is met at `lastStatus`. Once-only filtering is not done
  here (that is Task 4).
- From `src/device/time.ts`, export `wallClock(ms: number, timeZone: string): { year: number;
  month: number; day: number; weekday: Weekday; minutes: number }` (minutes since local midnight),
  and `fromWallClock(timeZone, year, month, day, minutes): number` (ms). Build both on the existing
  `offsetMinutes`.

- [ ] **Step 1: Write the failing tests** in `tests/alerts/plan.test.ts`. Use fixed dates and zones
  only, never the machine's zone. Build the `SavedDispenser` with `homeTimeZone: 'Asia/Kolkata'` and
  `phoneTimeZone: 'Asia/Kolkata'` unless a test says otherwise.
  - "no reading, no alerts": `planAlerts({dispenser: {id, name, homeTimeZone}, …})` → `[]`.
  - "refill low lands on the morning of the crossing day": a reading at 2026-11-02T10:00+05:30 with
    `spraysSinceRefill: 1900` and one schedule every day 08:00–16:00 every 20 min (24 sprays a
    day). Today's remaining 18 sprays (10:00–16:00) bring the count to 1918, then +24 a day: 1942,
    1966, 1990. `refillPercent(1990) === 10` is not below 10, and 2014 is the first count below 10,
    on 2026-11-06. So `refillLow.at` equals 2026-11-06T09:00+05:30.
  - "refill out follows": same input, `refillOut.at` is on the first day the count makes
    `refillPercent === 0`, at 09:00.
  - "auto-spray only": no schedules, `autoSpray: 40` (36 a day) → a refill low alert exists.
  - "zero rate schedules no refill alert": no schedules, `autoSpray: null` → only `checkIn` is
    planned.
  - "already below 10%": `spraysSinceRefill: 2000`, `now` = 14:00 → `refillLow.at` equals `now`.
    At 23:00 it is the next day 09:00 instead.
  - "battery low and flat": `batteryMv` giving 5% → `batteryLow` at `now` in the window. With
    `batteryMv: 2300` → `batteryFlat`. At 50% → neither.
  - "check-in 14 days after the reading": `checkIn.at` = `lastStatus.at` + 14 days, moved into the
    window.
  - "crossing across a DST change": `homeTimeZone` and `phoneTimeZone` are `Europe/London`, the
    reading is on 2026-10-24, and the crossing falls on 2026-10-26. Assert `at` is 2026-10-26 09:00
    London time (that is, 09:00Z after the change).
  - "beyond 365 days plans nothing": a rate of 1 spray a day with 2000 sprays to go → no refill
    alerts.
  - "keys are stable": `alertKey('abc', 'refillLow') === 'abc:refillLow'`.

- [ ] **Step 2: Run them to verify they fail**
  Run: `bun run test tests/alerts/plan.test.ts`
  Expected: FAIL, "Cannot find module '@/alerts/plan'".

- [ ] **Step 3: Implement `planAlerts`, `intoWindow`, `alertKey` and the time helpers.**
  - Walk calendar days in `homeTimeZone`, starting on the day of `lastStatus.at`.
  - On that first day, count only sprays after `lastStatus.at`: schedule windows from that minute
    on, and auto-spray minutes left in the day divided by the interval.
  - Each later day adds its full count.
  - The first day whose running count meets a threshold is the crossing day. Its delivery is 09:00
    phone time on that calendar date, passed through `intoWindow`.

- [ ] **Step 4: Run the tests and lint**
  Run: `bun run test tests/alerts && bun run lint`
  Expected: PASS. Lint is clean, and an `expo-*` import in `src/alerts/plan.ts` would be an error.

- [ ] **Step 5: Commit**
  `feat(alerts): predict when refill runs low and plan battery and check-in alerts`

### Task 2: Alert state and the on/off preference

**Files:**
- Create: `src/alerts/state.ts`
- Test: `tests/alerts/state.test.ts`

**Interfaces:**
- Consumes: `KeyValueStorage` from `@/store/asyncStorageStore`, and `AlertKind` from Task 1.
- Produces:
  ```ts
  export interface DeliveredAlert { at: string; cycle: string }   // ISO time; see below
  export type AlertState = Record<string, DeliveredAlert>;       // by alert key
  export interface AlertStateStore {
    load(): Promise<AlertState>;            // {} when missing or corrupt
    save(s: AlertState): Promise<void>;
    enabled(): Promise<boolean>;            // true when nothing saved
    setEnabled(on: boolean): Promise<void>;
  }
  export function createAlertStateStore(storage: KeyValueStorage): AlertStateStore;
  ```
  The storage keys are `aer.alerts.v1` and `aer.alerts.enabled`.
- `cycle` says which can, set of batteries or reading an alert was for:
  - **refill:** the `spraysSinceRefill` when it was scheduled;
  - **battery:** `'set'`;
  - **check-in:** the `lastStatus.at` it was planned from.

  Task 4 owns how `cycle` is used.

- [ ] **Step 1: Write the failing tests:**
  - "round-trips state";
  - "corrupt JSON loads as empty";
  - "enabled defaults to true and saves false".

  Use `createMemoryStore`-style in-memory `KeyValueStorage`, like
  `tests/core/themePreference.test.ts`.
- [ ] **Step 2: Run them, expect FAIL:** `bun run test tests/alerts/state.test.ts`
- [ ] **Step 3: Implement `createAlertStateStore`.**
- [ ] **Step 4: Run them, expect PASS:** `bun run test tests/alerts/state.test.ts`
- [ ] **Step 5: Commit**
  `feat(alerts): remember delivered alerts and the alerts switch`

### Task 3: Scheduler interface, expo-notifications adapter and release hardening

**Files:**
- Create:
  - `src/alerts/scheduler.ts` (the interface);
  - `src/alerts/expoScheduler.ts`;
  - `src/alerts/testing/fakeScheduler.ts`;
  - `plugins/withNoPushEntitlement.js`.
- Modify:
  - `package.json` and `bun.lock`, through `bunx expo install expo-notifications`. Don't stage
    the unrelated `android`/`ios` script edits already in the working tree.
  - `app.json`: add `"expo-notifications"` with `{ "color": "#c4502b" }`, and
    `"./plugins/withNoPushEntitlement"` before it in `plugins` (mods run in reverse order, so ours runs last).
  - `plugins/withReleaseNoInternet.js`: `RELEASE_MANIFEST` also removes `ACCESS_NETWORK_STATE`,
    `com.google.android.c2dm.permission.RECEIVE`,
    `expo.modules.notifications.service.ExpoFirebaseMessagingService`,
    `com.google.firebase.messaging.FirebaseMessagingService` and
    `com.google.firebase.iid.FirebaseInstanceIdReceiver`, each with `tools:node="remove"`.
- Test:
  - `tests/config/androidConfig.test.ts` (extend);
  - `tests/config/iosConfig.test.ts` (new);
  - `tests/alerts/expoScheduler.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export type AlertPermission = 'granted' | 'denied' | 'undetermined';
  export interface ScheduledAlert { key: string; dispenserId: string; at: Date; title: string; body: string }
  export interface AlertScheduler {
    permission(): Promise<AlertPermission>;
    requestPermission(): Promise<AlertPermission>;
    pendingKeys(): Promise<string[]>;            // only this app's alert keys
    schedule(a: ScheduledAlert): Promise<void>;  // replaces any pending alert with the same key
    cancel(key: string): Promise<void>;
    cancelAll(): Promise<void>;
    /** Calls back with the dispenser id when the user taps an alert; returns unsubscribe. */
    onOpen(cb: (dispenserId: string) => void): () => void;
  }
  export function createExpoScheduler(): AlertScheduler;          // expoScheduler.ts
  export function createFakeScheduler(now: () => Date): AlertScheduler & {
    scheduled: Map<string, ScheduledAlert>;
    setPermission(p: AlertPermission): void;
    requestCount: number;
    tap(dispenserId: string): void;
  };
  ```
- `createExpoScheduler` works as follows:
  - It uses the alert key as the notification `identifier`, and puts `dispenserId` in `data`.
  - It uses a `DATE` trigger, or `null` (now) when `at <= now`.
  - It sets the Android channel `alerts` (name `t('alerts.channel')`, default importance) before
    the first schedule.
  - `pendingKeys` filters `getAllScheduledNotificationsAsync` to identifiers containing `:`.
  - It calls `setNotificationHandler` once so alerts show while the app is open.
  - `onOpen` wraps `addNotificationResponseReceivedListener`, and also checks
    `getLastNotificationResponseAsync` once for a cold start.
  - It doesn't use push tokens or exact alarms.
- `withNoPushEntitlement.js` exports `removePushEntitlement(entitlements)` and works through
  `withEntitlementsPlist`, deleting `aps-environment`.

- [ ] **Step 1: Write the failing tests:**
  - Extend `androidConfig.test.ts`: "release manifest strips Firebase push" asserts
    `RELEASE_MANIFEST` contains each of the five names above with `tools:node="remove"`.
  - Add `iosConfig.test.ts`: "drops the push entitlement" checks
    `removePushEntitlement({ 'aps-environment': 'development', x: 1 })` → `{ x: 1 }`, and
    that `app.json` lists the plugin after `expo-notifications`.
  - Add `expoScheduler.test.ts`, mocking `expo-notifications`:
    - "schedule uses the key as identifier and a date trigger";
    - "a past time schedules immediately";
    - "pendingKeys ignores other identifiers";
    - "onOpen passes the dispenser id".

- [ ] **Step 2: Run them, expect FAIL:** `bun run test tests/config tests/alerts/expoScheduler.test.ts`
- [ ] **Step 3: Install and implement.**
  - Run `bunx expo install expo-notifications`.
  - Implement the adapter, the fake, the plugin and the manifest additions.
  - The commit body gives the dependency's reason, as ENGINEERING.md asks: local notifications;
    chosen as the most-starred, maintained option; Firebase is stripped from release builds.
- [ ] **Step 4: Run them, expect PASS:** `bun run test && bun run typecheck && bun run lint`
- [ ] **Step 5: Commit**
  `feat(alerts): schedule local notifications through expo-notifications`

### Task 4: Alert engine

**Files:**
- Create: `src/alerts/engine.ts`, `src/alerts/index.ts` (public exports)
- Create: `src/i18n/en/alerts.ts`, and register `alerts` in `src/i18n/index.ts`
- Test: `tests/alerts/engine.test.ts`

**Interfaces:**
- Consumes: `planAlerts` and `alertKey` (Task 1); `AlertStateStore` (Task 2); `AlertScheduler` and
  `createFakeScheduler` (Task 3); `DispenserStore` from `@/store/types`.
- Produces:
  ```ts
  export interface Alerts {
    start(): () => void;                  // first sync (may not ask), then a sync on every store change (may ask); returns stop
    sync(opts: { mayAsk: boolean }): Promise<void>;  // runs one at a time
    enabled(): Promise<boolean>;
    setEnabled(on: boolean): Promise<void>;          // off → cancelAll; on → sync({ mayAsk: true })
    permission(): Promise<AlertPermission>;
    onOpen(cb: (dispenserId: string | null) => void): () => void;  // null when the dispenser is no longer saved
  }
  export function createAlerts(deps: {
    store: DispenserStore; scheduler: AlertScheduler; state: AlertStateStore;
    now?: () => Date; phoneTimeZone?: () => string;
  }): Alerts;
  ```
- Sync rules, in order:
  1. If alerts are disabled, stop.
  2. Load the dispensers. Cancel every `pendingKeys()` entry whose dispenser id is not saved, and
     drop its state.
  3. Plan each dispenser.
  4. **Re-arm:**
     - drop the refill state when the current `spraysSinceRefill` is below the stored `cycle`;
     - drop the battery state when `batteryPercent > 30`;
     - drop the check-in state when `lastStatus.at` differs from its `cycle`.
  5. **Skip delivered alerts:** skip any planned alert whose key has state with `at <= now` and the
     same cycle. Also cancel a pending alert for a kind the plan no longer contains.
  6. **Permission:** if there is something to schedule and the permission is `'undetermined'`,
     request it only when `mayAsk`. Schedule only when it is `'granted'`.
  7. **Schedule:** schedule each planned alert, with title and body from `alerts.*` using the
     dispenser's `name`. Store `{ at, cycle }` for its key.

- [ ] **Step 1: Write the failing tests** with an in-memory `DispenserStore` (`createMemoryStore`),
  the fake scheduler, fixed `now`, and `phoneTimeZone: () => 'Asia/Kolkata'`:
  - "schedules refill, battery and check-in alerts after a reading": after `store.upsert`, the fake
    holds keys `id:refillLow`, `id:refillOut` and `id:checkIn`, with the exact copy.
  - "already past fires once, not on the next launch": with a count at 2000, the first store change
    schedules `refillLow` now. A new `createAlerts` on the same state, at `now + 1 day`, running
    `sync({ mayAsk: false })`, schedules no `refillLow`.
  - "a passed delivery is not rescheduled": the check-in state has `at` in the past with the same
    cycle → no check-in scheduled.
  - "a refill reset re-arms": after `refillLow` is delivered, an upsert with `spraysSinceRefill: 0`
    schedules a new `refillLow` in the future.
  - "new batteries re-arm the battery alert": the state for `batteryLow` plus a reading at 80%,
    followed by a reading at 5% → scheduled again.
  - "cancels keys of dispensers no longer saved": a pending `gone:refillLow` and a `store.remove`
    of a saved dispenser → both are cancelled.
  - "never asks at launch": undetermined permission, `start()` → `requestCount === 0`. After an
    upsert it is `1`.
  - "denied schedules nothing and does not ask again".
  - "switching off cancels everything; switching on schedules again".
  - "a rename reschedules with the new name".

- [ ] **Step 2: Run them, expect FAIL:** `bun run test tests/alerts/engine.test.ts`
- [ ] **Step 3: Implement `createAlerts` and the `alerts` copy.** Chain syncs on a promise tail, the
  way `createAsyncStorageStore` chains writes.
- [ ] **Step 4: Run them, expect PASS:** `bun run test tests/alerts && bun run typecheck`
- [ ] **Step 5: Commit**
  `feat(alerts): keep alerts in step with saved dispensers, once per can`

### Task 5: Wire into the app and Settings

**Files:**
- Modify:
  - `src/core/services.tsx`: `Services` gains `alerts: Alerts`.
  - `src/core/createServices.ts`: build the alerts from `deps.alerts`, or else from
    `createExpoScheduler()` and `createAlertStateStore(AsyncStorage)`.
  - `src/core/index.ts`: re-export `type Alerts` and `type AlertPermission`.
- Modify `src/screens/AppProviders.tsx`: `useEffect(() => services.alerts.start(), [services])`.
- Modify `app/_layout.tsx`: wire `services.alerts.onOpen`. A known id does
  `router.push('/dispenser/<id>')`; `null` does `router.replace('/')`.
- Modify `src/screens/settings/useSettings.ts` and `SettingsScreen.tsx`:
  - an "Alerts" card with a `Toggle` labelled `settings.alerts`, and the `settings.alertsHint`
    caption;
  - when the permission is `'denied'`, the `settings.alertsDenied` line, plus a secondary button
    `settings.alertsOpenSettings` that calls `Linking.openSettings()`.
- Modify `src/i18n/en/settings.ts` with the four keys from Global Constraints.
- Modify `app/dev/spike.tsx`: a "Scheduled alerts" section listing `pendingKeys()`, for the device
  check. Expose `pendingKeys` on `Alerts` as a debug-only method.
- Test:
  - `tests/screens/settings.test.tsx`;
  - `tests/screens/layout.test.tsx`;
  - `tests/core/createServices.test.ts` (if present; otherwise add a case to `layout.test.tsx`).

  Every test that builds `createServices({...})` passes `alerts` built from fakes, so nothing
  loads `expo-notifications`.

- [ ] **Step 1: Write the failing tests:**
  - "Settings switch turns alerts off and on": pressing the toggle calls `setEnabled(false)`, and
    then `setEnabled(true)`.
  - "denied permission shows the hint and the open-settings button": spy `Linking.openSettings`.
  - "AppProviders starts alerts once and stops on unmount".
  - "tap on a removed dispenser goes home": the fake taps an id the store doesn't have →
    `router.replace('/')`.
- [ ] **Step 2: Run them, expect FAIL:** `bun run test tests/screens`
- [ ] **Step 3: Implement the wiring and the Settings card.**
- [ ] **Step 4: Run all checks, expect PASS:**
  `bun run test && bun run typecheck && bun run lint`
- [ ] **Step 5: Commit**
  `feat(settings): add the refill and battery alerts switch`

### Task 6: Docs and device check

**Files:**
- Modify `docs/superpowers/specs/2026-10-26-aer-remote-design.md` §4. Replace the "Push
  notifications…" non-goal with a line that points to the alerts design: local and predicted, no
  background Bluetooth.
- Modify `docs/ENGINEERING.md` Privacy: alerts are local notifications only. Release builds strip
  the Firebase push entries, and iOS has no push entitlement.
- Modify `docs/spike/hardware-results.md`: add checks that `sC` counts every spray (schedule,
  auto-spray, manual), that auto-spray runs all day, and that the two add together.
- Modify `README.md` features: one line for refill and battery alerts, saying refill is estimated.

- [ ] **Step 1: Check the merged release manifest:**
  ```bash
  cd android && ./gradlew :app:processReleaseMainManifest
  ```
  The manifest is at
  `android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml`.
  Expected: no `INTERNET`, `ACCESS_NETWORK_STATE`, `c2dm`, `FirebaseMessagingService`,
  `FirebaseInstanceIdReceiver` or location entries. `POST_NOTIFICATIONS` and
  `RECEIVE_BOOT_COMPLETED` are present. Run `bunx expo prebuild --platform android` first if
  `android/` is stale.
- [ ] **Step 2: Rebuild the debug app on the Realme** (it's a native dependency).
  - Read a dispenser, and see `id:refillLow`, `id:refillOut` and `id:checkIn` under "Scheduled
    alerts" on the Bluetooth test screen.
  - Temporarily set a saved `spraysSinceRefill` of 2000 (through the dev screen, or a store
    write in a debug session).
  - A notification appears, and tapping it opens the dispenser.
  - Undo the test value.
- [ ] **Step 3: Run all checks, then commit**
  `docs: describe refill and battery alerts and what the hardware test must confirm`
- [ ] **Step 4:** Push `lane/refill-alerts` and open a pull request into `main`.

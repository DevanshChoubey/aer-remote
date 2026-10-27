# Refill and battery alerts: design

Status: approved in conversation, 2026-10-27. Extends `2026-10-26-aer-remote-design.md`, whose §4 listed "push
notifications for low battery/refill when the app is closed" as a v1 non-goal because it seemed to
need background Bluetooth. This design avoids background Bluetooth, so the feature moves into scope.

## 1. Intent

The author wants the phone to say when a dispenser is running low, without having to open the app
to check. The alerts must keep the app's promise: offline, private, no server, no account, and no
connecting to the dispenser behind the user's back.

Refill can be predicted: the dispenser has no level sensor, and "refill %" is only the spray count
since the last refill compared with 2200 sprays per can (`src/protocol/status.ts`). The count rises
at a rate set by the schedules and auto-spray the app already knows. So the app works out when the
count will cross each threshold and asks the phone to show a local notification then. Battery is a
voltage reading and cannot be predicted, so its alerts come from real readings only.

## 2. Goals

- **Refill, predicted** (author's choice: "predicted please"):
  - "Almost out" when refill drops below 10%.
  - "Out" when it reaches 0%.
  - Both arrive with the app closed. They come from dates the app worked out at its last reading.
- **Battery, from readings:**
  - "Low" when a reading shows below 10% (`batteryPercent`).
  - "Flat" when a reading shows the battery too low to spray (`isBatteryTooLow`).
  - The alert fires as soon as the app learns it, in the foreground or not.
- **Check-in reminder** (the author agreed): if the app hasn't read a dispenser for 14 days, show
  "Open Aer Remote to check {name}". This covers the battery, which can't be predicted.
- **Recalculating:** every change to a saved dispenser recalculates its alerts. That includes:
  - a new reading;
  - a schedule saved or deleted;
  - auto-spray changed;
  - "I refilled it";
  - a rename;
  - removing the dispenser.
- **Each alert once:**
  - Refill alerts fire once per can. They re-arm when the spray count goes down, meaning a refill
    reset.
  - Battery alerts fire once per set of batteries. They re-arm when a reading is back above 30%
    _(Claude's call)_.
- **One switch:** Settings gets a switch for refill and battery alerts, on by default. Turning it
  off cancels everything that is scheduled.
- **Permission in context:** the app asks for notification permission the first time it would
  schedule an alert, which is right after a reading, never at launch.

## 3. Non-goals

- Push from a server, or any network use. There is no server and there won't be one.
- Background Bluetooth, background fetch or background tasks of any kind.
- Exact-alarm permission on Android. Alerts are about days, so inexact delivery is fine.
- Configurable thresholds or reminder timing. The 10%, 0% and 14 days are fixed.
- Alerts for anything else, such as a missed schedule or a disconnect.

## 4. Anti-goals

These would make it a failure even if it technically worked:

- An alert that fires again and again for the same can or the same set of batteries.
- An alert at 03:00.
- An alert for a dispenser that has been removed.
- A release build that gains the `INTERNET` permission, or that can reach any network endpoint.
- Asking for notification permission before the user has done anything with a dispenser.
- Claiming precision the app doesn't have: the copy says "almost out", never "3 sprays left".

## 5. Constraints

- `docs/ENGINEERING.md` applies in full:
  - layering;
  - the pure-TypeScript `src/protocol` and `src/device`;
  - all copy in `src/i18n/en`;
  - no `fetch`;
  - Conventional Commits;
  - work on its own `lane/` branch and reach `main` through a pull request.
- No network. Release builds keep stripping `INTERNET` (`plugins/withReleaseNoInternet.js`).
- The rate assumptions are **unverified on hardware**:
  - That `sC` counts every spray: schedule, auto-spray and manual. The app sums all of `sC` today.
  - That auto-spray runs round the clock at its interval.
  - That schedule sprays and auto-spray add together.

  The design uses these assumptions. The hardware spike (`docs/spike/hardware-results.md`) gets
  a line to check them.
- Schedules run on the dispenser's home time zone (`SavedDispenser.homeTimeZone`).

## 6. How it works (decided parts)

### Prediction (pure, in its own module)

Inputs:

- the saved dispenser's `lastStatus` (`spraysSinceRefill`, `autoSpray`, `at`);
- `schedules.list`;
- `homeTimeZone`;
- "now".

Steps:

1. Walk forward from `lastStatus.at`, day by day in the home zone, and add up that day's sprays:
   - each schedule whose weekdays include the day adds `sprayCount(s)`;
   - auto-spray, when on, adds `1440 / interval` sprays a day.
2. Find the moment the running total crosses 90% of `REFILL_SPRAYS` (refill below 10%), and the
   moment it crosses 100% (refill 0%). Within a day, the builder picks how precise to be. Day-level
   is enough.
3. Cap the walk at 365 days. A crossing beyond that schedules nothing, and neither does a spray
   rate of zero.

This is a pure function with no Expo or React Native imports, so it runs in plain Jest. Other
rules:

- **Delivery time** _(Claude's call)_: alerts are delivered between 09:00 and 21:00 phone time. A
  crossing outside that window moves to the next 09:00. A crossing already in the past (a reading
  that is already below 10%) delivers now, or at the next 09:00 if it is night.
- **Battery:** decided from the latest reading, the same way: deliver now, or at the next 09:00 if
  it is night.
- **Check-in:** at `lastStatus.at` plus 14 days, moved into the same window. No reading at all
  means no check-in.

### Scheduling (adapter behind an interface)

- **Interface:** a small `AlertScheduler` interface with three operations:
  - schedule a notification at a time;
  - cancel by key;
  - list what is pending.

  It also asks for permission.
- **Implementations:**
  - the real one wraps the notification library;
  - a fake one records calls, for tests, like `src/ble/testing/fakeDispenser`.
- **Keys:** each alert has a stable key built from the dispenser id and the alert kind, for example
  `<id>:refill-low`. Recalculating replaces by key, so nothing is ever duplicated.
- **Once-only state:** what has fired is kept in local storage (AsyncStorage):
  - the spray count each refill alert fired at;
  - whether each battery alert has fired for this set of batteries.

  That way a re-scheduled refill alert for a crossing that already happened doesn't fire again.
- **Knowing an alert fired** _(Claude's call)_: the app can't see a scheduled notification fire
  while it is closed. So for each dispenser and alert kind, the once-only state records the
  delivery time the app scheduled, and the can or battery set it was for. On a recalculation, an
  alert whose recorded delivery time has passed counts as delivered and is not scheduled again
  for that can or battery set. A future delivery time is simply replaced. So an alert that was
  rescheduled before it fired still fires once, and one that fired never repeats.
- **The refill reset comes only from "I refilled it"**, which sends the refill command (mT 105) and
  resets the counters. The dispenser doesn't detect a new can by itself. So "once per can" re-arms
  when the user taps the button, and the "out" alert copy says so.
- **Baseline** _(Claude's call)_: the walk always starts at `lastStatus.at` with the spray count
  then, using the schedules and auto-spray saved now. The app writes schedules and auto-spray only
  while connected, so they changed close to a reading.
- **Stale keys** _(Claude's call)_: each recalculation compares the pending notifications with the
  saved dispensers and cancels any of the app's alerts whose dispenser is no longer saved. That
  covers a removal and cleared app data.
- **Permission denied** _(Claude's call)_: the app schedules nothing and doesn't ask again on its
  own. The Settings switch shows the denied hint with a button to open the phone's settings.
  Turning the switch off and on asks again, where the phone allows it.
- **Trigger:** recalculation runs off `DispenserStore.subscribe`. Every write the
  `DispenserClient` makes already goes through the store, so no screen or client method needs
  to know about alerts. On a recalculation:
  - removed dispensers have their keys cancelled;
  - turning the Settings switch off cancels everything and stops recalculating.
- **Tapping an alert** opens that dispenser's screen (`/dispenser/<id>`). If the dispenser has gone,
  it opens Home.
- **Android:** a single notification channel, "Refill and battery".

### Copy (en)

| Alert | Text |
|---|---|
| Refill low | "{name} is almost out of refill." |
| Refill out | "{name} is out of refill. Put in a new can, then tap I refilled it." |
| Battery low | "{name}'s batteries are low. Replace them soon." |
| Battery flat | "{name}'s batteries are flat, so it can't spray. Replace them now." |
| Check-in | "It's been a while. Open Aer Remote to check {name}." |
| Settings switch | "Refill and battery alerts" |
| Settings hint | "Refill alerts are estimated from your schedules." |
| Permission denied | "Notifications are off for Aer Remote in your phone's settings." |

The builder may tighten the wording within ENGINEERING.md's copy rules.

### Notification library: `expo-notifications` (decided)

The author chose the most-starred, actively maintained library. On 2026-10-27, `expo-notifications`
(in expo/expo, 53k stars, pushed daily) beat wix/react-native-notifications (3.3k), while notifee
and react-native-push-notification are archived. Use the version Expo SDK 58 bundles (`~58.1.6`,
installed with `bunx expo install expo-notifications`). The two options it was chosen over are kept
below for the record. Option A's release-stripping work is required, and F-Droid's main repository
is out of reach while Firebase ships in the APK.


- **Option A, `expo-notifications`** (Expo-maintained, which ENGINEERING.md prefers):
  - Cost: on Android it depends on `com.google.firebase:firebase-messaging`.
  - Its manifest declares a Firebase messaging service, and Firebase adds `INTERNET`,
    `ACCESS_NETWORK_STATE` and `c2dm.permission.RECEIVE`. With no `google-services.json`, Firebase
    never starts, and the release manifest already removes `INTERNET`.
  - Under this option, the release plugin must also remove the Firebase messaging service and the
    `c2dm` and `ACCESS_NETWORK_STATE` permissions. The config test must check the merged release
    manifest for all of that.
  - The Firebase library still ships in the APK, and F-Droid's main repository rejects that.
- **Option B, a small local Expo module:**
  - On Android, `AlarmManager` with `NotificationManager`. On iOS,
    `UNUserNotificationCenter` with calendar triggers.
  - It adds no Google code, so the app stays F-Droid-ready.
  - It costs more to build and test, and needs a reschedule-on-boot receiver on Android.

## 7. Left to the builder

- **Module layout:** where the pure planner and the adapter live, within the layering rules. A new
  `src/alerts/` domain module that `createServices` wires up is the expected shape.
- **Storage:** the exact shape and key of the once-only state.
- **Precision:** how precise the in-day crossing time is.
- **Tests:** how the planner is tested, with fixed dates and zones, including:
  - a time-zone change (DST);
  - no schedules;
  - auto-spray only;
  - already below 10%;
  - a refill reset;
  - removing a dispenser;
  - turning the switch off.
- **Settings:** the switch's layout and how the denied-permission state is shown.

## 8. Done means

- The tests cover the planner and the scheduling rules.
- `bun run test`, `bun run typecheck` and `bun run lint` pass.
- The merged release manifest still has no `INTERNET`, location or Firebase messaging entries.
- On the Realme:
  - after a reading, the scheduled alerts are visible in a debug listing;
  - a forced "already below 10%" case shows a real notification;
  - tapping it opens the dispenser.
- The main spec's §4 non-goal line is updated to point here.

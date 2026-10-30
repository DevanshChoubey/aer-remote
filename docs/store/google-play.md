# Google Play listing

What to enter in Play Console for Aer Remote. Lengths in brackets are Play's limits.

## App details

| Field          | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| App name [30]  | Aer Remote (Unofficial)                                             |
| Package        | `com.devanshchoubey.aerremote` (fixed by the first upload)          |
| Language       | English (India), en-IN                                              |
| Category       | House & Home                                                        |
| Contact email  | The developer's choice; Play shows it publicly.                     |
| Website        | <https://github.com/DevanshChoubey/aer-remote>                      |
| Privacy policy | <https://github.com/DevanshChoubey/aer-remote/blob/main/PRIVACY.md> |

## Short description [80]

```text
Unofficial Bluetooth remote for Godrej aer Smart Matic. Offline, no account.
```

## Full description [4000]

```text
Aer Remote controls your Godrej aer Smart Matic air freshener over Bluetooth. No account, no
internet, no ads.

This is an unofficial app. It is not made by or affiliated with Godrej.

WHAT IT DOES
• Spray now, or turn auto spray on every 10, 20 or 40 minutes.
• Schedules: up to 10 per dispenser, with start and end time, days and interval. They run on the
  dispenser itself, so your phone can be away.
• After each save the app reads the schedules back, so the list shows what the dispenser holds.
• Battery and refill level, firmware, and when the status was last checked.
• Refill and battery alerts on your phone. The refill time is an estimate.
• Sets the dispenser's clock every time it connects.
• Several dispensers: add, name, find (blink its light), rename and remove.
• Light, dark and Night slate themes.

PRIVATE BY DESIGN
• No account and no sign-in.
• No internet permission: the app cannot send anything off your phone.
• Never asks for your location.
• Everything it stores stays on your phone.

GOOD TO KNOW
• Needs Android 12 or newer and a phone with Bluetooth.
• The dispenser talks to one phone at a time. Close the official app first.
• Open source under the MIT licence: github.com/DevanshChoubey/aer-remote
```

## Graphics

| Asset             | Size                      | Source                                                              |
| ----------------- | ------------------------- | ------------------------------------------------------------------- |
| App icon          | 512 × 512 PNG             | `assets/images/icon.png`, scaled down                               |
| Feature graphic   | 1024 × 500 PNG or JPEG    | To make: app name and a phone, on the theme's background colour     |
| Phone screenshots | 2–8, 9:16, 1080 × 1920 up | Home, Dispenser, Schedule editor, Settings, Dispenser in dark theme |

Take screenshots from a real dispenser on the phone, not the design previews. Leave out Godrej's
logo and product photos.

## App content

| Section            | Answer                                                                                |
| ------------------ | ------------------------------------------------------------------------------------- |
| Privacy policy     | The URL above.                                                                        |
| App access         | All functions work without special access. Note for reviewers: needs a Smart Matic.   |
| Ads                | No ads.                                                                               |
| Content rating     | Category "Utility, productivity, communication or other"; answer no to everything.    |
| Target audience    | 18 and over.                                                                          |
| News app           | No.                                                                                   |
| Data safety        | Collects no data; shares no data. Encryption in transit: not applicable (no network). |
| Government app     | No.                                                                                   |
| Financial features | None.                                                                                 |
| Health             | None.                                                                                 |

## Releases

1. Build the bundle with the upload key set (see the README's release section):
   `APP_VARIANT=release bunx expo prebuild -p android --clean`, then
   `cd android && ./gradlew bundleRelease`. The file is
   `android/app/build/outputs/bundle/release/app-release.aab`.
2. Turn on Play App Signing when asked, and keep the upload key.
3. New personal accounts need a closed test first: at least 12 testers opted in for 14 days in a
   row before production access.
4. Raise `expo.android.versionCode` in `app.json` for every upload; Play rejects a repeated one.
   1.0.0 is versionCode 1.

Play re-signs the app with its own key, so the Play build and the GitHub APK cannot update each
other. Uninstall one before installing the other.

# Security policy

## Scope

Aer Remote is a local Bluetooth app. It has no server, no account and no network calls, and release
builds hold no `INTERNET` permission. That keeps the attack surface small, but not zero.

In scope:

- The app's Bluetooth handling: scanning, connecting, parsing replies (`src/ble`, `src/device`,
  `src/protocol`).
- Data stored on the phone: dispenser names, home time zones, the last status and the last
  schedules read.
- Build configuration that affects permissions, such as `app.json` and
  `plugins/withReleaseNoInternet.js`.
- Any way the app could send data off the phone.

Out of scope:

- The dispenser's own firmware and its Bluetooth protocol, which has no pairing or authentication.
  Anyone in Bluetooth range can talk to it with any app. Report firmware issues to the manufacturer.
- The official app and Godrej's services.
- Debug builds keeping `INTERNET` so they can reach Metro.

## Supported versions

Only the latest commit on `main` is supported while the project is at v1.

## Report a vulnerability

Please report privately. Do not open a public issue.

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** to open a private security advisory.

Include what you found, how to reproduce it, and the phone and OS you used. The maintainer replies
in the advisory. Once a fix is ready, the advisory is published with credit, unless you prefer
otherwise.

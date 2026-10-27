# Hardware spike results

Fill this in after running `/dev/spike` on real phones (plan Task 7, Step 6). Close the Godrej app
first: the dispenser accepts one connection at a time.

## Phones

Android 12 (API 31) is the supported floor: below it the app reports Bluetooth as unauthorized,
because scanning there needs the location permission and the app never requests location.

| Platform | Phone model | OS version | Build command                             | Date |
| -------- | ----------- | ---------- | ----------------------------------------- | ---- |
| Android  |             |            | `bunx expo run:android`                   |      |
| iOS      |             |            | `bunx expo run:ios --device` (on the Mac) |      |

## Dispenser

- Firmware (`fV` from fetch status):
- Dispenser name / id as scanned:
- Channels that answered (command / schedule / reply UUID suffixes):

## Buttons

| Action             | Android (Y/N, note) | iOS (Y/N, note) |
| ------------------ | ------------------- | --------------- |
| Scan               |                     |                 |
| Connect            |                     |                 |
| Fetch status       |                     |                 |
| Set time           |                     |                 |
| Spray now          |                     |                 |
| Auto 10 / Auto off |                     |                 |
| Read schedules     |                     |                 |
| Save test schedule |                     |                 |
| Remove schedules   |                     |                 |
| Blink              |                     |                 |

## Notifications on the reply channel

| Platform | Subscribe worked (Y/N) | MONITOR ERROR text (if any) |
| -------- | ---------------------- | --------------------------- |
| Android  |                        |                             |
| iOS      |                        |                             |

If N on a platform: add a task for the native Expo module (spec section 8) before continuing.

## Refill and battery alert assumptions

Alerts predict the refill from `sC` (sprays since refill). Check these on the dispenser.

| Check                                                      | Result (Y/N, note) |
| ---------------------------------------------------------- | ------------------ |
| `sC` goes up by one for every scheduled spray              |                    |
| `sC` goes up by one for every auto-spray                   |                    |
| `sC` goes up by one for every manual spray                 |                    |
| Auto-spray runs all day at its interval, not only in hours |                    |
| Schedule and auto-spray sprays add together in `sC`        |                    |

## Pass bar: 10 of 10 connect + fetch status within 5 s, at about 3 m

| Platform | Passes (/10) | Distance | Connect times (ms), runs 1-10 |
| -------- | ------------ | -------- | ----------------------------- |
| Android  |              |          |                               |
| iOS      |              |          |                               |

If the bar fails: tune `SessionOptions` (timeouts, attempts) and retest; record each retest here.

## Replies that did not match the protocol notes

Paste the TX / RX hex lines from the spike log and what the notes expected.

```

```

## Notes

# Hardware spike results

Fill this in after running `/dev/spike` on real phones (plan Task 7, Step 6). Close the Godrej app
first: the dispenser accepts one connection at a time.

## Phones

Android 12 (API 31) is the supported floor: below it the app reports Bluetooth as unauthorized,
because scanning there needs the location permission and the app never requests location.

| Platform | Phone model        | OS version                                | Build command                             | Date       |
| -------- | ------------------ | ----------------------------------------- | ----------------------------------------- | ---------- |
| Android  | Realme X (RMX1901) | Android 11 (RMX1901_11_F.04), debug build | `bunx expo run:android`                   | 2026-10-27 |
| iOS      |                    |                                           | `bunx expo run:ios --device` (on the Mac) |            |

## Dispenser

- Firmware (`fV` from fetch status): 3.0.8-IN
- Dispenser name / id as scanned: "Smart Matic" (its Bluetooth address is left out here)
- Channels that answered (command / schedule / reply UUID suffixes): 0003 / 0004 / 0001

## Buttons

| Action             | Android (Y/N, note)                      | iOS (Y/N, note) |
| ------------------ | ---------------------------------------- | --------------- |
| Scan               | Y, found in under 2 s                    |                 |
| Connect            | Y, 1.1 to 4.4 s to connect               |                 |
| Fetch status       | Y                                        |                 |
| Set time           | Y                                        |                 |
| Spray now          | Y, `sn[0]` up by one                     |                 |
| Auto 10 / Auto off | Y, `cS` 112 then 0; sprays once at once  |                 |
| Read schedules     | Y                                        |                 |
| Save test schedule | Y, reads back Mon to Fri 08:00, every 20 |                 |
| Remove schedules   | Y, reads back empty                      |                 |
| Blink              | Y, acked; LED not watched                |                 |

## Notifications on the reply channel

| Platform | Subscribe worked (Y/N) | MONITOR ERROR text (if any) |
| -------- | ---------------------- | --------------------------- |
| Android  | Y                      | none                        |
| iOS      |                        |                             |

If N on a platform: add a task for the native Expo module (spec section 8) before continuing.

## Refill and battery alert assumptions

Alerts predict the refill from `sC` (sprays since refill). Check these on the dispenser.

| Check                                                      | Result (Y/N, note)                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `sC` goes up by one for every scheduled spray              | Y, in `sc[slot]`                                              |
| `sC` goes up by one for every auto-spray                   | Y, in `sn[1]`                                                 |
| `sC` goes up by one for every manual spray                 | Y, in `sn[0]`                                                 |
| Auto-spray runs all day at its interval, not only in hours | Y, sprayed at 18:34 with no schedule set                      |
| Schedule and auto-spray sprays add together in `sC`        | N, a schedule window stops auto-spray, and it stays off after |

## Pass bar: 10 of 10 connect + fetch status within 5 s, at about 3 m

| Platform | Passes (/10) | Distance  | Connect times (ms), runs 1-10                              |
| -------- | ------------ | --------- | ---------------------------------------------------------- |
| Android  | 10/10        | about 3 m | 2005, 1870, 2189, 1889, 1980, 2346, 2330, 2530, 2363, 2089 |
| iOS      |              |           |                                                            |

If the bar fails: tune `SessionOptions` (timeouts, attempts) and retest; record each retest here.

Android retests, 2026-10-27, about 3 m:

- 1 s between runs: 6/10, twice. Every failure came within 1 s ("unreachable") straight after a
  passing run; every run that connected took under 3 s. The dispenser refuses a new connection for
  about a second after one closes.
- 5 s between runs: 10/10, the times in the table. The spike screen now waits 5 s.

## Replies that did not match the protocol notes

Paste the TX / RX hex lines from the spike log and what the notes expected.

Android: every reply had the fields and types the notes describe. What the notes did not say is in
the notes below and in `docs/protocol/aer-ble-protocol.md` (fetch status).

## Notes

- iOS is not tested yet.
- The Realme runs Android 11, below the Android 12 floor for release builds, so this covers the debug
  build only.
- A full session (connect, then set the clock) took 1.9 to 8.8 s; the pass bar times above are
  connect plus fetch status.
- `cS` 12x means a schedule window is running, and its last digit is the schedule's interval. The
  app shows it as auto-spray, so the auto-spray row can say "every 40 min" while only the schedule
  runs.
- A schedule sprays at its end time too (18:50 to 19:50 every 20 min sprayed 4 times), but the app's
  spray estimate leaves it out ("About 3 sprays a day"). The refill prediction undercounts by one
  spray per schedule each day, so refill alerts can come slightly late.
- The refill prediction adds schedule and auto-spray sprays, which the dispenser never does together,
  so with both set refill alerts come early.

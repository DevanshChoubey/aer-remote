# Godrej Aer Smart Matic: BLE protocol notes

Source: decompiled official Android app `com.godrejcp.aermatic` v2.6 (vendor libraries
`com.cwdin.cwdtranscoderlibrary` and `com.cwdin.cwdblelibrary`), cross-checked with
[AerControl](https://github.com/parthh37/aercontrol) (MIT) and
[godrej_aer](https://github.com/ov1d1u/godrej_aer) (Apache-2.0). Read for interoperability only; no
vendor code is copied. Not yet verified on our own hardware.

## GATT

Service `6E400000-B5A3-F393-E0A9-E50E24DCCA9E` (Nordic-UART-style). No pairing or auth.

| UUID suffix | Vendor name    | Use                                                         |
| ----------- | -------------- | ----------------------------------------------------------- |
| `…0001`     | RESPONSE_UUID  | notifications (replies). Has **no CCCD** on some firmware.  |
| `…0002`     | PROVISION_UUID | provisioning (mT 101)                                       |
| `…0003`     | ACTION_UUID    | every other command                                         |
| `…0004`     | SCHED_UUID     | set schedules (mT 103)                                      |
| OTA         | `00010203-0405-0607-0809-0a0b0c0d2b12` | firmware update (out of scope)      |

Firmware quirk (from godrej_aer): some builds (e.g. 3.0.8-IN) accept commands on `…0002/3/4`
interchangeably, others only on `…0003`. Probe with fetch-status on first connect and remember what
answers.

Writes are without response (`setWriteType(1)`). The vendor app requests a larger MTU after connecting.
The device accepts **one central at a time**.

## Framing

Each message is one CBOR map. Requests: `{mT, mN, …}`. Replies on `…0001`: `{mT: request+50, mN, ack, …}`,
`ack: 200` = OK. `mN` is a message number the device echoes back; the vendor app uses either fixed
values or a random 100–253 and matches replies on it.

## Commands

| mT  | Name             | Extra fields                                                  | Char    |
| --- | ---------------- | ------------------------------------------------------------- | ------- |
| 101 | provision        | `dN` (string, device name), `pK` (int)                        | `…0002` |
| 102 | set time         | `eP` epoch seconds, `tZ` = −(UTC offset in minutes), `tD` DST savings ms | `…0003` |
| 103 | set schedules    | `S`: array of `{ s: bytes[5] }` (see below)                   | `…0004` |
| 104 | spray now        | `rI`: 0 = spray once; 10/20/40 = auto-spray every N min       | `…0003` |
| 105 | refill inserted  | `rR: true` resets spray counters                              | `…0003` |
| 106 | stop             | `sS: true` stops auto-spray; or `sS: <slot>` stops a schedule  | `…0003` |
| 107 | fetch status     | none                                                          | `…0003` |
| 108 | remove schedules | none (clears all)                                             | `…0003` |
| 109 | retrieve schedule| none; reply has `S: [{ s: bytes }]`                           | `…0003` |
| 110 | set unique id    | `uID` (int64)                                                 | `…0003` |
| 111 | get unique id    | none                                                          | `…0003` |
| 112 | restart schedule | `rS: <slot>`                                                  | `…0003` |
| 113 | test LED         | none                                                          | `…0003` |
| 114 | get time         | none                                                          | `…0003` |

Slot numbers for 106/112: 0–9 = schedule one to ten, 255 = all, 128 = current.

**Integer width quirk:** for `eP` (set time) and `uID`, the vendor app rewrites the CBOR integer to a
full 8-byte unsigned int (major type 0, additional info 27 / `0x1b`) regardless of value. The firmware
likely expects that fixed width; mirror it.

## Schedule entry (mT 103)

Up to 10 entries. Each `s` is 5 raw bytes:

| Byte | Meaning                                                                           |
| ---- | --------------------------------------------------------------------------------- |
| 0    | weekday mask: Mon `0x40`, Tue `0x20`, Wed `0x10`, Thu `0x08`, Fri `0x04`, Sat `0x02`, Sun `0x01` |
| 1    | start hour (0–23, device local time)                                              |
| 2    | start minute                                                                      |
| 3    | repeat count = `(end − start in minutes) / interval`, integer division; end must be after start (no overnight windows) |
| 4    | interval in minutes (app offers 10 / 20 / 40)                                     |

Example: Mon–Fri, 08:00–22:00, every 20 min → mask `0x7C`, `s = 7C 08 00 2A 14`.

Because the count is one byte, a window can hold at most 255 sprays.

## Vendor app sequences

- **First connect:** set time (102), get/set unique id (111/110), fetch status (107).
- **Open device screen:** set time (102), then fetch status (107).
- **Save schedules:** remove schedules (108), wait ~3 s, then set schedules (103) with the whole active
  list. Schedules are replace-all; there is no per-entry add.

## Status reply (mT 157)

From AerControl: `bV` battery mV, `fV` firmware string, `cS` auto-spray state (111/0 off;
112/121/131 = 10 min, 113/122/132 = 20 min, 114/123/133 = 40 min), `sC` spray counters
(`sn`, `sc`, `bn`), `sV` structure version. Battery: ~3.1 V full, 2.4 V cutoff (below it the device
acks sprays but does not spray). Refill estimate assumes 2200 sprays per can.

## Not in the device

The official app also has login/OTP, a cloud account, "preset schedules" fetched from Godrej's server,
and buying refills. None of these are needed to drive the device.

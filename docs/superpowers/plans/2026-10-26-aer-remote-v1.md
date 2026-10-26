# Aer Remote v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline Expo app (iOS and Android) that reliably controls the Godrej aer Smart Matic over
Bluetooth: spray now, auto-spray, up to 10 on-device schedules, status and refill reset.

**Architecture:** A pure-TypeScript core (`src/protocol` CBOR and messages, `src/device` sessions and
the command queue) talks to Bluetooth only through a `BleTransport` interface, so a desktop app can
reuse it later. v1 ships a `react-native-ble-plx` transport. Screens reach the core only via
`useServices()`. Tooling and engineering rules are copied from Home Inventory.

**Tech Stack:** Expo (latest SDK, dev client), TypeScript strict, Bun, expo-router,
react-native-ble-plx, @react-native-async-storage/async-storage, Jest (jest-expo), ESLint flat config,
Prettier, lefthook.

**Spec:** `docs/superpowers/specs/2026-10-26-aer-remote-design.md`. Protocol:
`docs/protocol/aer-ble-protocol.md`. Executors read both.

**Reference project:** `/media/devansh/Experiment/playground/homeInventory` (call it HI). Several tasks
say "copy from HI"; copy, then adapt names and folders as stated.

## Global Constraints

- Bun only (`bun install`, `bun add`, `bunx`, `bun run`); never npm/yarn/pnpm. Native deps via
  `bunx expo install`.
- No network: ESLint `no-restricted-globals: fetch` everywhere with no exceptions; no analytics.
- `src/protocol/**` and `src/device/**` must not import `react-native`, `expo-*`, `@/ui`, `@/screens`
  or `app/` (enforced by ESLint, checked by `tests/lint-rules.test.ts`).
- Strings only in `src/i18n/en/<namespace>.ts` via `t('ns.key')`.
- Theme tokens only in `src/theme/tokens.ts`; RN visual components only in `src/ui/primitives/`.
- Touch targets ≥ 48dp; every touchable has a label and role.
- Never show Godrej's logo; app name "Aer Remote"; Settings › About shows "Unofficial app. Not
  affiliated with Godrej."
- Never commit decompiled vendor code, `.apk` or `.xapk`.
- Commits: Conventional Commits, author `Devansh Choubey <devanshc13@gmail.com>`, trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before each commit: `bun run test`, `bun run typecheck`, `bun run lint` pass.
- Coverage ≥ 80% lines for `src/protocol`, `src/device`, `src/store`.

## Review Focus

1. **Official app (or another phone) still connected:** connect times out or fails → user sees "Another
   phone or the Godrej app may be connected. Close it and try again", never a spinner forever. Test in
   Task 5.
2. **Reply split across notifications, or two replies in one:** decoder buffers until a full CBOR item
   and handles leftovers. Test in Task 2 and Task 5.
3. **Late reply from an earlier command (wrong `mN`):** ignored, never resolves the current command.
   Test in Task 5.
4. **Schedule save interrupted halfway** (disconnect after remove, before set): app reports failure
   and shows what the device now has (read-back), never "saved". Test in Task 6.
5. **Battery below 2.4 V:** spray is acked but does nothing → app shows "Battery too low to spray"
   instead of a success. Test in Task 3 (`isBatteryTooLow`) and Task 9 (screen).

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: Expo app in the repo root (`bunx create-expo-app@latest . --template default`, then strip
  sample screens), `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `jest.config.js`,
  `eslint.config.js`, `.prettierrc`, `.prettierignore`, `lefthook.yml`,
  `scripts/check-commit-msg.js`, `.github/workflows/ci.yml`, `CLAUDE.md`, `docs/ENGINEERING.md`,
  `LICENSE` (MIT, Devansh Choubey), `README.md`, `app/_layout.tsx`, `app/index.tsx` (placeholder)
- Test: `tests/lint-rules.test.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: scripts `test`, `typecheck`, `lint`, `format`, `prepare`; path alias `@/*` → `src/*`.

- [ ] **Step 1:** Scaffold Expo, then `bunx expo install expo-dev-client react-native-ble-plx
  @react-native-async-storage/async-storage expo-router`; add dev deps matching HI (jest, jest-expo,
  @testing-library/react-native, eslint 9, eslint-config-expo, eslint-plugin-import, prettier,
  lefthook, typescript).
- [ ] **Step 2:** Copy from HI: `tsconfig.json`, `.prettierrc`, `.prettierignore`, `lefthook.yml`,
  `scripts/check-commit-msg.js`, `.github/workflows/ci.yml`, `babel.config.js`. Copy `jest.config.js`
  with coverage folders `['protocol', 'device', 'store']`.
- [ ] **Step 3:** Copy HI's `eslint.config.js` and adapt: `SERVICE_MODULES = ['protocol', 'device',
  'store', 'ble']`; `DOMAIN_FOLDERS = ['core', 'protocol', 'device', 'store', 'ble']`; delete the
  network-allowed override (no exceptions to `fetch`); add a block for
  `src/protocol/**` and `src/device/**` that also forbids `react-native`, `react-native-*`, `expo`,
  `expo-*`, `@react-native-async-storage/*`.
- [ ] **Step 4:** `app.json`: name "Aer Remote", slug `aer-remote`, scheme `aerremote`, package and
  bundle id `com.devanshchoubey.aerremote`, `userInterfaceStyle: automatic`, plugins `expo-router`,
  `expo-dev-client`, and `["react-native-ble-plx", { "isBackgroundEnabled": false, "modes": [],
  "bluetoothAlwaysPermission": "Aer Remote uses Bluetooth to talk to your air freshener.",
  "neverForLocation": true }]`; Android `blockedPermissions: ["android.permission.ACCESS_FINE_LOCATION"]`.
  Use `app.config.ts` to also block `android.permission.INTERNET` when `APP_VARIANT === 'release'`
  (debug builds need it for Metro).
- [ ] **Step 5:** Write `docs/ENGINEERING.md` by copying HI's and replacing its domain module list,
  Privacy section ("No network calls anywhere"), and coverage folders with this project's. Write
  `CLAUDE.md` mirroring HI's, pointing to this plan and spec.
- [ ] **Step 6: Tests.** `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
  `tests/lint-rules.test.ts`: lint in-memory sources with ESLint's `Linter`/`ESLint.lintText` and
  assert errors for: `import { View } from 'react-native'` in `src/screens/x.tsx`;
  `import { Platform } from 'react-native'` in `src/protocol/x.ts`; `fetch('x')` in `src/device/x.ts`;
  `import '@/device/session'` in `src/screens/x.tsx`. Assert no error for
  `import { View } from 'react-native'` in `src/ui/primitives/Box.tsx`.
- [ ] **Step 7:** Run `bun run test && bun run typecheck && bun run lint`. Expected: all pass.
- [ ] **Step 8:** Commit `chore: scaffold Expo app with Home Inventory tooling`.

### Task 2: CBOR codec

**Files:**
- Create: `src/protocol/cbor.ts`
- Test: `tests/protocol/cbor.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CborValue = number | bigint | string | boolean | null | Uint8Array | CborValue[] | CborMap;
  export interface CborMap { [key: string]: CborValue }
  export type CborEntry = [key: string, value: CborValue, opts?: { uint64?: boolean }];
  export function encodeMap(entries: CborEntry[]): Uint8Array; // indefinite-length map (0xbf … 0xff)
  export function decodeFirst(bytes: Uint8Array): { value: CborValue; length: number } | null; // null = incomplete
  export class CborError extends Error {}
  ```

Encoder matches Jackson's output: indefinite map header `0xbf`, text keys, shortest-form unsigned and
negative ints, booleans `0xf4/0xf5`, byte strings, arrays as indefinite `0x9f … 0xff` (as Jackson's
`writeArrayFieldStart` does),
nested maps indefinite (a `CborMap` value is encoded with its own keys in insertion order).
`uint64: true` forces major-type-0 additional-info 27 (8-byte big-endian).
Decoder accepts definite and indefinite maps/arrays, all int widths (returns `number` when ≤
`Number.MAX_SAFE_INTEGER`, else `bigint`), text, bytes, bools, null, and throws `CborError` on
unsupported types.

- [ ] **Step 1: Failing tests:**
  - `encodes spray-now exactly like the vendor app`: `encodeMap([['mT',104],['mN',154],['rI',0]])`
    equals hex `bf626d541868626d4e189a62724900ff`.
  - `forces 8-byte ints`: `encodeMap([['eP', 1761500000, { uint64: true }]])` contains
    `62 65 50 1b 00 00 00 00 68 fe 5b 60` after the header.
  - `round-trips nested arrays of maps with bytes`: value `{ S: [{ s: Uint8Array[0x7c,8,0,42,20] }] }`
    encodes and `decodeFirst` returns an equal structure.
  - `decodeFirst returns null on a truncated frame` (drop the last byte of the spray-now hex).
  - `decodeFirst reports consumed length` when two frames are concatenated.
  - `decodes negative ints` (`tZ: -330`).
- [ ] **Step 2:** Run `bun run test tests/protocol/cbor.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `src/protocol/cbor.ts`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(protocol): add CBOR codec`.

### Task 3: Messages, schedules and status

**Files:**
- Create: `src/protocol/uuids.ts`, `src/protocol/schedule.ts`, `src/protocol/messages.ts`,
  `src/protocol/replies.ts`, `src/protocol/status.ts`, `src/protocol/index.ts`
- Test: `tests/protocol/schedule.test.ts`, `tests/protocol/messages.test.ts`,
  `tests/protocol/replies.test.ts`, `tests/protocol/status.test.ts`

**Interfaces:**
- Consumes: `encodeMap`, `decodeFirst`, `CborMap` (Task 2).
- Produces:
  ```ts
  // uuids.ts
  export const SERVICE_UUID = '6e400000-b5a3-f393-e0a9-e50e24dcca9e';
  export const charUuid = (suffix: '0001'|'0002'|'0003'|'0004'): string; // '6e40XXXX-b5a3-…'
  export const DEFAULT_CHANNELS: Channels = { reply: charUuid('0001'), command: charUuid('0003'), schedule: charUuid('0004') };
  export interface Channels { reply: string; command: string; schedule: string }

  // schedule.ts
  export type Weekday = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
  export type Interval = 10 | 20 | 40;
  export interface TimeOfDay { h: number; m: number }
  export interface Schedule { start: TimeOfDay; end: TimeOfDay; days: Weekday[]; interval: Interval }
  export type ScheduleProblem = 'endNotAfterStart' | 'noDays' | 'noSprays' | 'tooManySprays';
  export const MAX_SCHEDULES = 10;
  export function validateSchedule(s: Schedule): ScheduleProblem[];
  export function sprayCount(s: Schedule): number;           // floor(window / interval)
  export function encodeScheduleEntry(s: Schedule): Uint8Array; // 5 bytes
  export function decodeScheduleEntry(b: Uint8Array): Schedule; // end = start + count × interval

  // messages.ts
  export type MessageChannel = 'command' | 'schedule';
  export interface OutgoingMessage { mT: number; mN: number; channel: MessageChannel; bytes: Uint8Array }
  export const MT = { setTime: 102, setSchedules: 103, sprayNow: 104, refill: 105, stop: 106,
    fetchStatus: 107, removeSchedules: 108, retrieveSchedules: 109, testLed: 113 } as const;
  export function setTimeMsg(mN: number, epochSeconds: number, tz: { standardOffsetMin: number; dstSavingsMs: number }): OutgoingMessage;
  export function sprayNowMsg(mN: number, interval: 0 | Interval): OutgoingMessage;
  export function stopAutoSprayMsg(mN: number): OutgoingMessage;  // {sS: true}
  export function refillMsg(mN: number): OutgoingMessage;         // {rR: true}
  export function fetchStatusMsg(mN: number): OutgoingMessage;
  export function removeSchedulesMsg(mN: number): OutgoingMessage;
  export function retrieveSchedulesMsg(mN: number): OutgoingMessage;
  export function setSchedulesMsg(mN: number, list: Schedule[]): OutgoingMessage; // channel 'schedule'
  export function testLedMsg(mN: number): OutgoingMessage;

  // replies.ts
  export interface Reply { mT: number; mN: number; ack: number; body: CborMap }
  export function toReply(v: CborValue): Reply | null;     // null if not a map with numeric mT/mN
  export function parseSchedules(r: Reply): Schedule[];    // from body.S[].s

  // status.ts
  export interface DeviceStatus { batteryMv: number; firmware: string; autoSpray: Interval | null; spraysSinceRefill: number }
  export function parseStatus(r: Reply): DeviceStatus;
  export function batteryPercent(mv: number): number;      // linear 3100→100, 2400→0, clamped, integer
  export function isBatteryTooLow(mv: number): boolean;     // mv < 2400
  export const REFILL_SPRAYS = 2200;
  export function refillPercent(spraysSinceRefill: number): number; // clamped 0–100, integer
  ```

Key values (from the protocol notes): weekday mask Mon `0x40`, Tue `0x20`, Wed `0x10`, Thu `0x08`,
Fri `0x04`, Sat `0x02`, Sun `0x01`. `setTimeMsg` body: `mT 102, mN, eP (uint64), tZ =
−standardOffsetMin, tD = dstSavingsMs`, key order exactly `mT, mN, eP, tZ, tD`. `setSchedulesMsg`
body: `mT 103, mN, S: [{ s: bytes }]`; throws if `list.length > 10` or any entry fails validation.
`autoSpray` from `cS`: 111/0 → null; 112/121/131 → 10; 113/122/132 → 20; 114/123/133 → 40; unknown →
null. `spraysSinceRefill` = sum of all numbers inside `sC` (`sn`, `sc`, `bn` arrays or maps), 0 if
absent. `tooManySprays` when `sprayCount > 255`; `noSprays` when `sprayCount === 0`.

- [ ] **Step 1: Failing tests:**
  - schedule: Mon–Fri 08:00–22:00 / 20 → `encodeScheduleEntry` = `[0x7c, 8, 0, 42, 20]`; decode of
    those bytes returns the same schedule; weekend-only 09:30–10:00 / 10 → `[0x03, 9, 30, 3, 10]`;
    `validateSchedule` returns `['endNotAfterStart']` for 22:00–08:00, `['noDays']` for `days: []`,
    `['noSprays']` for 08:00–08:05 / 10; decoded end for 08:00–08:25 / 10 is 08:20.
  - messages: `sprayNowMsg(154, 0).bytes` hex `bf626d541868626d4e189a62724900ff` and channel
    `command`; `setSchedulesMsg` uses channel `schedule` and decodes back to `S[0].s` =
    `[0x7c,8,0,42,20]`; `setTimeMsg(152, 1761500000, { standardOffsetMin: 330, dstSavingsMs: 0 })`
    decodes to `{ mT: 102, mN: 152, eP: 1761500000, tZ: -330, tD: 0 }` and its `eP` is encoded with
    `0x1b`; `setSchedulesMsg` throws for 11 schedules.
  - replies/status: a decoded `{ mT: 157, mN: 9, ack: 200, bV: 2506, fV: '3.0.6-T1', cS: 122,
    sC: { sn: [1,2,0,0], sc: [3,0,0], bn: [0,0,1] } }` gives `{ batteryMv: 2506, firmware:
    '3.0.6-T1', autoSpray: 20, spraysSinceRefill: 7 }`; `batteryPercent(3100) = 100`,
    `(2750) = 50`, `(2300) = 0`; `isBatteryTooLow(2399) = true`; `refillPercent(1100) = 50`;
    `parseSchedules` on `{ S: [{ s: [0x7c,8,0,42,20] }] }` returns one schedule; `toReply('x')` is
    null.
- [ ] **Step 2:** Run the four tests. Expected: FAIL.
- [ ] **Step 3:** Implement the five modules and `index.ts` re-exports.
- [ ] **Step 4:** Run the tests. Expected: PASS; coverage for `src/protocol` ≥ 80%.
- [ ] **Step 5:** Commit `feat(protocol): add message builders, schedules and status parsing`.

### Task 4: BLE transport interface and fake dispenser

**Files:**
- Create: `src/ble/transport.ts`, `src/ble/testing/fakeDispenser.ts`
- Test: `tests/ble/fakeDispenser.test.ts`

**Interfaces:**
- Consumes: protocol (Task 3).
- Produces:
  ```ts
  export type AdapterState = 'on' | 'off' | 'unauthorized' | 'unsupported' | 'unknown';
  export interface FoundDevice { id: string; name: string | null; rssi: number | null }
  export interface BleConnection {
    readonly deviceId: string;
    characteristics(): Promise<{ uuid: string; writable: boolean; notifiable: boolean }[]>;
    write(charUuid: string, bytes: Uint8Array): Promise<void>;           // write without response
    subscribe(charUuid: string, onData: (b: Uint8Array) => void): Promise<() => void>;
    onDisconnect(cb: () => void): () => void;
    disconnect(): Promise<void>;
  }
  export interface BleTransport {
    adapterState(): Promise<AdapterState>;
    requestPermissions(): Promise<boolean>;
    scan(onFound: (d: FoundDevice) => void, timeoutMs: number): { stop(): void; done: Promise<void> };
    connect(deviceId: string, timeoutMs: number): Promise<BleConnection>;
  }
  // testing
  export interface FakeDispenserOptions { commandChar?: string; busy?: boolean; batteryMv?: number;
    splitReplies?: boolean; dropReplies?: boolean; lateReplyFromPrevious?: boolean; disconnectAfter?: number }
  export function createFakeTransport(devices: Record<string, FakeDispenserOptions>): BleTransport & {
    state(id: string): { schedules: Schedule[]; autoSpray: Interval | null; spraysSinceRefill: number; time?: number; ledBlinks: number; writes: { char: string; mT: number }[] } };
  ```

The fake decodes writes with `decodeFirst`, answers `{mT+50, mN, ack: 200, …}` on the reply char
after a microtask, and implements every message in `MT` with real state (set/remove/retrieve
schedules, auto-spray, refill reset, status with `cS` code 121/122/123 or 111). It answers only on
`commandChar` (default `…0003`) and on `…0004` for schedules. `busy: true` makes `connect` reject;
`splitReplies` sends each reply in 2 chunks; `lateReplyFromPrevious` first sends a reply with
`mN - 1`; `disconnectAfter: n` disconnects after the nth write.

- [ ] **Step 1: Failing tests:** writing `fetchStatusMsg` to `…0003` yields a decodable 157 reply;
  writing it to `…0002` on a fake with default options yields nothing; set-then-retrieve schedules
  round-trips; `busy` makes `connect` reject.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ble): add transport interface and fake dispenser`.

### Task 5: Device session (connect, queue, replies, channel probe)

**Files:**
- Create: `src/device/errors.ts`, `src/device/time.ts`, `src/device/session.ts`
- Test: `tests/device/time.test.ts`, `tests/device/session.test.ts`

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces:
  ```ts
  export type DeviceErrorCode = 'bluetoothOff' | 'permissionDenied' | 'unreachable' | 'noReply' | 'rejected' | 'disconnected';
  export class DeviceError extends Error { constructor(readonly code: DeviceErrorCode, message?: string) }
  // time.ts
  export function zoneInfo(timeZone: string, at: Date): { standardOffsetMin: number; dstSavingsMs: number };
  // session.ts
  export interface SessionOptions { replyTimeoutMs?: number /* 3000 */; connectTimeoutMs?: number /* 8000 */;
    connectAttempts?: number /* 3, backoff 500ms then 1500ms */; now?: () => Date; mN?: () => number }
  export interface OpenedSession { session: DispenserSession; channels: Channels; status: DeviceStatus }
  export function openSession(t: BleTransport, deviceId: string, homeTimeZone: string,
    known: Channels | undefined, opts?: SessionOptions): Promise<OpenedSession>;
  export class DispenserSession {
    send(msg: OutgoingMessage): Promise<Reply>;   // serialised; resolves on matching mT+50 and mN with ack 200
    readonly connected: boolean;
    onDisconnect(cb: () => void): () => void;
    close(): Promise<void>;
  }
  ```

`openSession`: check `adapterState` (`off` → `bluetoothOff`, `unauthorized` → `permissionDenied`);
connect with attempts/backoff (all fail → `unreachable`); subscribe reply char; using `known` or
`DEFAULT_CHANNELS`, send set-time (from `zoneInfo(homeTimeZone)`, epoch from `now`) then fetch-status.
If fetch-status gets `noReply`, probe: for each writable characteristic other than reply, try
fetch-status; first that answers becomes `command` (and `schedule` too unless `…0004` is writable);
none → `noReply`. After a successful probe, re-send set-time. `send` buffers notification chunks,
extracts complete CBOR items with `decodeFirst`, ignores replies whose `mN`/`mT` don't match, maps
`ack !== 200` to `rejected`, times out to `noReply`, and a disconnect mid-command to `disconnected`.
`mN` default: a counter cycling 100–253.

- [ ] **Step 1: Failing tests:**
  - time: `zoneInfo('Asia/Kolkata', …)` → `{ standardOffsetMin: 330, dstSavingsMs: 0 }`;
    `zoneInfo('Europe/London', new Date('2026-07-01'))` → `{ 0, 3600000 }`.
  - session against the fake: opens and returns status with `autoSpray`; writes in order `102, 107`;
    fake with `commandChar: …0002` is found by probing and returned in `channels`; `busy` →
    `DeviceError('unreachable')` after 3 attempts; `splitReplies` still resolves; `lateReplyFromPrevious`
    resolves with the correct `mN`; `dropReplies` → `noReply` within `replyTimeoutMs` (use fake timers);
    two concurrent `send` calls are written one after the other; adapter `off` → `bluetoothOff`;
    set-time sent `tZ: -330` for `Asia/Kolkata`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(device): add dispenser session with reply matching and channel probe`.

### Task 6: Dispenser client and local store

**Files:**
- Create: `src/store/types.ts`, `src/store/asyncStorageStore.ts`, `src/store/memoryStore.ts`,
  `src/device/client.ts`
- Test: `tests/store/store.test.ts`, `tests/device/client.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces:
  ```ts
  // store/types.ts
  export interface SavedDispenser { id: string; name: string; homeTimeZone: string; channels?: Channels;
    lastStatus?: DeviceStatus & { at: string }; schedules?: { list: Schedule[]; at: string } }
  export interface DispenserStore { list(): Promise<SavedDispenser[]>; get(id: string): Promise<SavedDispenser | null>;
    upsert(d: SavedDispenser): Promise<void>; remove(id: string): Promise<void>; subscribe(cb: () => void): () => void }
  export function createAsyncStorageStore(storage: { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> }): DispenserStore;
  export function createMemoryStore(): DispenserStore;
  // device/client.ts
  export interface ClientOptions extends SessionOptions { idleMs?: number /* 10000 */; scheduleGapMs?: number /* 3000 */ }
  export class DispenserClient {
    constructor(transport: BleTransport, store: DispenserStore, opts?: ClientOptions);
    scan(onFound: (d: FoundDevice) => void, timeoutMs: number): { stop(): void; done: Promise<void> };
    add(id: string, name: string, homeTimeZone: string): Promise<SavedDispenser>; // connects, blinks nothing, saves channels+status
    blink(id: string): Promise<void>;
    refresh(id: string): Promise<{ status: DeviceStatus; schedules: Schedule[] }>;
    sprayNow(id: string): Promise<DeviceStatus>;
    setAutoSpray(id: string, interval: Interval | null): Promise<DeviceStatus>;
    saveSchedules(id: string, list: Schedule[]): Promise<Schedule[]>; // returns read-back list
    resetRefill(id: string): Promise<DeviceStatus>;
    rename(id: string, name: string): Promise<void>;
    remove(id: string): Promise<void>;
  }
  ```

The client keeps at most one open session per device; every operation runs through it, resets an idle
timer, and the session closes `idleMs` after the last operation. Every operation that changes the
device ends with fetch-status and updates `lastStatus` in the store; `refresh` and `saveSchedules`
update `schedules`. `setAutoSpray(null)` sends `stopAutoSprayMsg`. `saveSchedules`: validate (throws
`DeviceError('rejected')` before any write if invalid), remove, wait `scheduleGapMs`, set (skip when the
list is empty), retrieve, store the read-back and return it. If any step fails, attempt one retrieve
to store what the device now has, then rethrow. `sprayNow` throws
`DeviceError('rejected', 'batteryTooLow')` when the post-spray status has `isBatteryTooLow`.

- [ ] **Step 1: Failing tests:** store upsert/list/remove round-trip and survive re-creation on the
  same storage object; client `add` saves probed channels; `sprayNow` increments fake counters;
  `setAutoSpray(20)` then `null` toggles fake state; `saveSchedules` writes `108` then `103` then
  `109` in order with ≥ `scheduleGapMs` between 108 and 103 (fake timers) and returns the read-back;
  `saveSchedules` with `disconnectAfter: 1` rejects with `disconnected` and the store's `schedules`
  reflects the device's (empty) list after a retry; low battery (2300 mV) `sprayNow` rejects with
  `batteryTooLow`; session closes after `idleMs`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(device): add dispenser client and local store`.

### Task 7: React Native BLE transport and hardware spike (gate)

**Files:**
- Create: `src/ble/rnTransport.ts`, `src/core/services.tsx`, `src/core/createServices.ts`,
  `app/dev/spike.tsx`, `docs/spike/hardware-results.md`
- Test: `tests/core/services.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces:
  ```ts
  export function createRnTransport(): BleTransport;                 // react-native-ble-plx BleManager
  export interface Services { client: DispenserClient; store: DispenserStore }
  export function createServices(deps?: Partial<{ transport: BleTransport; store: DispenserStore }>): Services;
  export function ServicesProvider(props: { services: Services; children: React.ReactNode }): React.JSX.Element;
  export function useServices(): Services;                            // throws outside the provider
  ```

`rnTransport`: base64 ↔ `Uint8Array` conversion for ble-plx; `write` uses
`writeCharacteristicWithoutResponseForService`; `subscribe` uses `monitorCharacteristicForService`;
after connect call `discoverAllServicesAndCharacteristics` and on Android `requestMTU(185)`;
permissions on Android 12+ via `PermissionsAndroid` (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`), iOS via
adapter state. Scan filtered by `SERVICE_UUID`. `src/ble/rnTransport.ts` is exempt from the
"no react-native in domain" rule (add an ESLint override for this file only). Spike screen: plain
buttons (via primitives, minimal) for scan, connect, fetch status, set time, spray now, auto 10/off,
read schedules, save one test schedule, remove schedules, blink; shows a log of each write and reply
hex.

- [ ] **Step 1: Failing test:** `useServices()` outside the provider throws; inside, returns the
  injected fake services.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS;
  `bun run typecheck` and `bun run lint` pass.
- [ ] **Step 5:** Commit `feat(ble): add react-native-ble-plx transport and spike screen`.
- [ ] **Step 6 (author, on hardware):** Build: Android `bunx expo run:android` (Linux), iOS on the
  Mac `bun install && bunx expo run:ios --device`. Close the Godrej app. Run every spike button on both
  phones; do connect + fetch status 10 times at ~3 m.
- [ ] **Step 7:** Record in `docs/spike/hardware-results.md`: phone models and OS, firmware (`fV`),
  channels that answered, notifications worked (Y/N per platform), 10/10 pass bar result, connect
  times, any reply hex that didn't match the protocol notes. Commit `docs(spike): record hardware
  results`.

**Gate:** if notifications fail on a platform, add a task here for the native Expo module described
in spec §8 before continuing. If the pass bar fails, tune `SessionOptions` and retest. Tasks 8–11 can
proceed in parallel with the hardware run since they use the fake transport.

### Task 8: Theme, primitives, UI kit and i18n

**Files:**
- Create: `src/theme/tokens.ts`, `src/theme/ThemeProvider.tsx`, `src/theme/index.ts`,
  `src/ui/primitives/*` (Box, Row, Column, Txt, Touchable, Input, Spacer, index), `src/ui/Button.tsx`,
  `src/ui/Card.tsx`, `src/ui/Chip.tsx`, `src/ui/Toggle.tsx`, `src/ui/Screen.tsx`,
  `src/ui/EmptyState.tsx`, `src/ui/StatusBadge.tsx`, `src/ui/index.ts`, `src/i18n/index.ts`,
  `src/i18n/en/{common,home,add,dispenser,schedule,settings,errors}.ts`,
  `docs/design/visual-directions-mockup.html`
- Test: `tests/theme/tokens.test.ts`, `tests/theme-centralized.test.ts`, `tests/i18n.test.ts`,
  `tests/ui/primitives.test.tsx`

**Interfaces:**
- Produces: same primitive APIs as HI (`Box` token props `p/px/py/m/gap/bg/border/radius`, `Txt`
  `variant`/`color`, `Touchable` with required `accessibilityLabel` and min 48dp), `useTheme()`,
  `t(key, vars?)`.

- [ ] **Step 1:** Make `docs/design/visual-directions-mockup.html` with three directions for the home
  and dispenser screens (e.g. calm teal/white, warm cream like HI, dark-first slate). Ask the author to
  pick; until they answer, use the first. Record the pick in the spec's Visual design section.
- [ ] **Step 2:** Copy HI's `tests/theme/tokens.test.ts` (AA contrast for listed token pairs, light
  and dark have the same keys), `tests/theme-centralized.test.ts` (no hex/rgb/font names/numeric
  radii outside `src/theme`), `tests/i18n.test.ts` (every namespace has the same keys used in code;
  missing key throws in dev), and a primitives test (Touchable renders with role and label; min hit
  area 48). Run. Expected: FAIL.
- [ ] **Step 3:** Copy HI's primitives, ThemeProvider and `t()`, then write this app's tokens from the
  picked direction (system fonts unless the direction needs one Google font) and the UI components.
- [ ] **Step 4:** Run tests. Expected: PASS. **Step 5:** Commit `feat(ui): add theme, primitives,
  components and i18n`.

### Task 9: Home and Add-dispenser screens

**Files:**
- Create: `app/_layout.tsx` (providers, stack), `app/index.tsx`, `app/add.tsx`,
  `src/screens/home/HomeScreen.tsx`, `src/screens/home/useDispensers.ts`,
  `src/screens/add/AddScreen.tsx`, `src/screens/add/useScan.ts`, `src/screens/errorCopy.ts`
- Test: `tests/screens/home.test.tsx`, `tests/screens/add.test.tsx`, `tests/screens/errorCopy.test.ts`

**Interfaces:**
- Consumes: `useServices()` (Task 7), UI kit (Task 8).
- Produces: `export function errorCopyKey(e: unknown): string` → i18n key in `errors.*`
  (`bluetoothOff`, `permissionDenied`, `unreachable` = "Can't reach the dispenser. Move closer, or
  close the Godrej app or any other phone that's connected to it.", `noReply`, `disconnected`,
  `batteryTooLow` = "Battery too low to spray. Replace the batteries.", `generic`).

Home: tiles per saved dispenser (name, battery %, refill %, next scheduled spray today computed from
cached schedules, "last checked" time), tap → dispenser screen, "Add dispenser" button, empty state.
Add: requests permissions, scans 15 s for `SERVICE_UUID` devices not already saved, list sorted by
RSSI, "Blink" per row (calls `client.blink`), "Use this one" → name field (default "Air freshener") →
`client.add(id, name, Intl.DateTimeFormat().resolvedOptions().timeZone)` → navigate to the dispenser.

- [ ] **Step 1: Failing tests** (render with fake services): empty home shows the add button; home
  with two stored dispensers shows both names and battery %; add screen lists fake devices and saving
  stores the dispenser with the phone's zone; `errorCopyKey(new DeviceError('unreachable'))` →
  `'errors.unreachable'`; `errorCopyKey(new Error('x'))` → `'errors.generic'`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(screens): add home and add-dispenser screens`.

### Task 10: Dispenser and schedule editor screens

**Files:**
- Create: `app/dispenser/[id]/index.tsx`, `app/dispenser/[id]/schedule.tsx`,
  `src/screens/dispenser/DispenserScreen.tsx`, `src/screens/dispenser/useDispenser.ts`,
  `src/screens/schedule/ScheduleEditor.tsx`, `src/screens/schedule/useScheduleDraft.ts`
- Test: `tests/screens/dispenser.test.tsx`, `tests/screens/schedule.test.tsx`

**Interfaces:**
- Consumes: `DispenserClient` methods (Task 6), `validateSchedule`, `sprayCount`, `MAX_SCHEDULES`
  (Task 3), `errorCopyKey` (Task 9).
- Produces: route params `id` (dispenser id) and optional `index` (schedule index to edit; absent =
  new).

Dispenser screen: on open shows cached data immediately with "checking…", then `refresh`. Big "Spray
now"; auto-spray toggle with 10/20/40 chips; status card (battery, refill, firmware); schedules list
(days, start–end, every N min, "about N sprays a day"), add button hidden at 10; refill reset with a
confirm; rename and remove in an overflow. Every action shows progress and maps errors with
`errorCopyKey`; after failure the screen shows the stored (read-back) state. Schedule editor: start and
end time pickers, weekday chips (preset buttons "Every day", "Weekdays", "Weekends"), interval chips,
live validation messages per `ScheduleProblem`, Save writes the whole list via `saveSchedules`, Delete
on existing entries. The editor shows the device's rounded end time after saving if it differs.

- [ ] **Step 1: Failing tests:** dispenser screen with fake shows battery and two schedules after
  refresh; pressing Spray now calls the fake (counter +1); unreachable fake shows the
  `errors.unreachable` copy; add-schedule hidden when 10 exist; editor shows the `endNotAfterStart`
  message for 22:00–08:00 and Save is disabled; saving a new Mon–Fri schedule results in the fake
  having it; deleting the only schedule results in an empty device list.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(screens): add dispenser and schedule editor screens`.

### Task 11: Settings, polish and repo publish

**Files:**
- Create: `app/settings.tsx`, `src/screens/settings/SettingsScreen.tsx`, app icon and splash in
  `assets/images/`
- Modify: `README.md` (what it is, unofficial notice, build steps for Android on Linux and iOS on Mac)
- Test: `tests/screens/settings.test.tsx`, `tests/e2e/scheduleFlow.test.tsx`

Settings: theme (system/light/dark, persisted), per-dispenser home time zone (list of IANA zones,
searchable), About (version, MIT licence, "Unofficial app. Not affiliated with Godrej."). Hide the
spike route from release builds (`__DEV__` only).

- [ ] **Step 1: Failing tests:** settings shows the unofficial notice; changing a dispenser's zone
  stores it and the next `refresh` sends `tZ` for that zone; e2e with the fake: add → open → add a
  schedule → spray now → home tile shows the next spray time.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run full suite, typecheck,
  lint, `bunx expo-doctor`. Expected: all pass.
- [ ] **Step 5:** Commit `feat(settings): add settings, icon and README`.
- [ ] **Step 6:** Create the private repo and push:
  `gh repo create DevanshChoubey/aer-remote --private --source . --push` (with
  `gh auth switch -u DevanshChoubey` first, and back afterwards if DevBey was active).

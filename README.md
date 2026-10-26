# Aer Remote

An offline Expo app that controls a Godrej aer Smart Matic air freshener over Bluetooth. No accounts,
no network calls, no telemetry. MIT licensed.

- Design: `docs/superpowers/specs/2026-10-26-aer-remote-design.md`
- Plan: `docs/superpowers/plans/2026-10-26-aer-remote-v1.md`
- Protocol notes: `docs/protocol/aer-ble-protocol.md`
- Engineering rules: `docs/ENGINEERING.md`

## Develop

Bun only. Bluetooth needs a dev client build (not Expo Go).

```sh
bun install
bun run test
bun run typecheck
bun run lint
bun run start
```

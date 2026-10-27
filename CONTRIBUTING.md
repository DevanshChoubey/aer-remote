# Contributing to Aer Remote

Thank you for helping. The most useful thing right now is a **hardware test result**: the app has
not yet run on a real dispenser. Code, docs and bug reports are welcome too.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Contents

- [Set up](#set-up)
- [The rules](#the-rules)
- [Checks](#checks)
- [Commits](#commits)
- [Pull requests](#pull-requests)
- [Never commit vendor code or APKs](#never-commit-vendor-code-or-apks)
- [Report a hardware result](#report-a-hardware-result)

## Set up

This project uses [Bun](https://bun.sh) only. Use `bun install`, `bun add`, `bunx` and
`bun run <script>`. Never use npm, yarn or pnpm, and never commit a `package-lock.json`.

```sh
git clone https://github.com/DevanshChoubey/aer-remote.git
cd aer-remote
bun install          # also installs the lefthook git hooks
bun run start        # Metro, for a development build
```

To run the app on a phone, see [Getting started](README.md#getting-started). Bluetooth needs a real
phone. For native packages, use `bunx expo install` so versions match the Expo SDK.

## The rules

Read [docs/ENGINEERING.md](docs/ENGINEERING.md) before you change code. The short version:

| Rule       | Summary                                                                                |
| ---------- | -------------------------------------------------------------------------------------- |
| Layering   | Imports only point downward. Screens reach services through `useServices()`.           |
| Pure core  | `src/protocol` and `src/device` never import React Native, Expo or AsyncStorage.       |
| Primitives | Only `src/ui/primitives/` imports `View`, `Text`, `Pressable` and the like.            |
| Theme      | Colours, fonts, radii and shadows live only in `src/theme/tokens.ts`. Use token names. |
| Copy       | Every user-facing string lives in `src/i18n/en/`.                                      |
| TypeScript | Strict. No `any`, no non-null `!` outside tests, explicit return types on exports.     |
| Errors     | Throw typed errors (`DeviceError`). Screens show friendly copy, never raw messages.    |
| Privacy    | No network calls, no telemetry, no location.                                           |
| Tests      | Test first. Tests live in `tests/`, mirroring `src/`.                                  |

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains why the code is laid out this way.

## Checks

All three must pass before each commit:

```sh
bun run test
bun run typecheck
bun run lint
```

The git hooks help: `pre-commit` runs Prettier and ESLint on staged files, and `pre-push` runs the
typecheck and tests. CI runs the same checks, plus coverage and `bunx expo-doctor`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook checks the
subject line.

```text
feat(schedule): show the next spray on the editor
fix(device): retry the connect after a timeout
docs: explain the idle disconnect
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`, `ci` and
`style`. Keep commits small. If you add a dependency, give the reason in the commit body.

## Pull requests

- One topic per pull request.
- Fill in the pull request template, including the checks.
- Add or update tests with the change.
- For a UI change, describe what you saw on a real phone, or say that you could not test it.

## Never commit vendor code or APKs

Do not commit the official app's APK, decompiled vendor code, or anything copied from it. The
protocol notes describe behaviour in our own words, for interoperability. `*.apk`, `*.xapk` and
`/decompiled/` are in `.gitignore` for this reason.

## Report a hardware result

A report from a real dispenser is the most valuable contribution right now.

1. Build a debug build on your phone (see [Getting started](README.md#getting-started)).
2. Close the official app. The dispenser accepts one phone at a time.
3. Open the app, tap **Bluetooth test** on the home screen, and work through the buttons.
4. Open a [hardware report](https://github.com/DevanshChoubey/aer-remote/issues/new?template=hardware_report.yml).
   It asks for the same things as [docs/spike/hardware-results.md](docs/spike/hardware-results.md):
   phone, OS, firmware, which buttons worked, whether reply notifications worked, and connect times.

Paste the TX and RX hex lines from the test screen's log if a reply did not match the protocol
notes. Leave out anything that identifies you or your home.

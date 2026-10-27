# Engineering rules

These rules apply to every task and every contributor, human or AI. Most are enforced by tooling
(ESLint, TypeScript, Jest, lefthook, CI). Lint, typecheck and tests must pass before each commit.

Related: the design spec in `docs/superpowers/specs/` and the plan in `docs/superpowers/plans/`.

## Tooling

Bun only: `bun install`, `bun add`, `bunx`, `bun run <script>`. Never npm, yarn or pnpm, and no
`package-lock.json`. Tests run Jest through `bun run test` (the React Native Jest preset needs Jest, not
`bun test`). Use `bunx expo install` for anything native so versions match the SDK.

| Script              | What it does                      |
| ------------------- | --------------------------------- |
| `bun run test`      | Jest (`jest-expo` preset)         |
| `bun run typecheck` | `tsc --noEmit`                    |
| `bun run lint`      | `expo lint` (ESLint, flat config) |

## Layering

Imports may only point downward:

`app/` (routes, thin) -> `src/screens/` (feature UI and hooks) -> `src/ui/` (components) ->
`src/ui/primitives/` -> `src/theme/`.

Domain modules (`src/core`, `src/protocol`, `src/device`, `src/store`, `src/ble`) never import from
`app/`, `src/screens/` or `src/ui/`. Screens reach services only through `useServices()`, never by
importing `src/protocol`, `src/device`, `src/store` or `src/ble` directly. `src/protocol` and
`src/device` are additionally pure TypeScript: they must not import `react-native`, `react-native-*`,
`expo`, `expo-*` or `@react-native-async-storage/*`, so they run in plain Jest and Node. Enforced with ESLint
`no-restricted-imports` per folder (see `eslint.config.js` and `tests/lint-rules.test.ts`).

## Primitives

`src/ui/primitives/` is the only place that imports React Native's visual building blocks (`View`,
`Text`, `Pressable`, `TextInput`, `Image`, `ScrollView`, `StyleSheet`). Everything else composes from:

- `Box` with token-typed props: `p/px/py/m/gap` in spacing steps, `bg` and `border` as color-token
  names, `radius` as a radius-token name
- `Row` and `Column`
- `Txt` with `variant` and `color` token names
- `Touchable` (always has `accessibilityRole`, min 48dp hit area)
- `Input` and `Spacer` (an `Img` primitive is not built yet)

Enforced by ESLint `no-restricted-imports` of those names from `react-native` outside
`src/ui/primitives/`, plus `tests/theme-centralized.test.ts`.

## Centralized theme

Tokens live only in `src/theme/tokens.ts`. Primitives accept token _names_, not raw values (for
example `bg="surface"`, never `bg="#fff8ec"`). No hex/rgb color literals, font family names, or numeric
radii/shadows outside `src/theme/`. Dark mode comes from the same token names (`darkTokens` has the
same keys as `lightTokens`).

## Copy

All user-facing strings live in `src/i18n/en/<namespace>.ts`, accessed via `t('home.title')`. This
keeps other languages possible later.

## TypeScript

`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`. No `any` (use `unknown` and narrow it). No
non-null `!` outside tests. Exported functions have explicit return types.

## Code style

Prettier (`printWidth: 100`, single quotes) and ESLint (`eslint-config-expo` plus the rules above,
`no-console` except `console.warn/error`, `import/no-cycle`, `import/order`). Files in `src/` are camelCase
for modules (`fakeDispenser.ts`, `useScheduleDraft.ts`) and PascalCase for components. One component per file. Named exports, except expo-router route
files, which need default exports.

## Errors

Domain code throws typed errors (`DeviceError` and the like). Screens map them to friendly copy from
`errors.*`. Never show raw error messages, and never swallow an error silently.

## Privacy

No network calls anywhere. ESLint `no-restricted-globals: fetch` applies to every file. Release builds
remove the `INTERNET` permission through `plugins/withReleaseNoInternet.js` (debug builds keep it for
Metro), and location is never requested and is blocked in `app.json`. The one exception is debug builds
on Android 11: release builds need Android 12 (`plugins/withReleaseMinSdk.js`), but debug builds install
from Android 11 for the hardware test, and only there ask for precise location, which Android 11 needs to
scan. The release manifest strips those location entries. No telemetry or analytics. Never log
device identifiers beyond what a debug screen shows the user.

## Accessibility

Every touchable has a label and role; text scales with OS font size; touch targets are at least 48dp;
contrast meets WCAG AA.

## Testing

TDD: write the failing test, watch it fail, implement, watch it pass. Tests live in `tests/` mirroring
`src/`. Coverage threshold is 80% lines for `src/protocol`, `src/device` and `src/store` (Jest `coverageThreshold`, checked in CI with `bun run test --coverage`).

## Git

Conventional Commits (`feat(scope): ...`, `fix`, `chore`, `docs`, `test`, `refactor`), checked by the
lefthook `commit-msg` hook. `pre-commit` runs Prettier and ESLint on staged files; `pre-push` runs
`bun run typecheck && bun run test`. Small commits, one task per branch (`lane/<task-id>`).

## CI

`.github/workflows/ci.yml` on push and PR: `oven-sh/setup-bun`, `bun install --frozen-lockfile`,
`bun run typecheck`, `bun run lint`, `bun run test --coverage`, `bunx expo-doctor`.

## Dependencies

Adding a dependency needs a reason in the commit body. Prefer Expo-maintained packages.

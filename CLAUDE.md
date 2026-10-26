# Aer Remote

Expo (SDK 58) + TypeScript app that controls a Godrej aer Smart Matic over Bluetooth, fully offline.
Bun only (`bun install`, `bun add`, `bunx`, `bun run`); never npm, yarn or pnpm.

Before changing anything, read:

- `docs/ENGINEERING.md` - the rules every change must follow (layering, primitives, theme, copy,
  privacy, testing, git). Follow it exactly.
- `docs/superpowers/plans/2026-10-26-aer-remote-v1.md` - the implementation plan; touch only the
  files listed in your task's Files block.
- `docs/superpowers/specs/2026-10-26-aer-remote-design.md` - the design and the why.

Before each commit: `bun run test`, `bun run typecheck` and `bun run lint` must pass. Use Conventional
Commit messages. Do not push unless asked.

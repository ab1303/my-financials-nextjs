# Dev Server Safety

## Critical Rule

**NEVER auto-kill Node processes after running `pnpm run build`.** This terminates the CLI session and abandons the user.

## Forbidden Actions

- ⛔ `Stop-Process` on Node or any command that terminates the Node process
- ⛔ Auto-restarting the dev server without user confirmation
- ⛔ Assuming the dev server is not running before starting Prisma CLI operations

## Required Patterns

- ✅ After `pnpm run build`, ask the user to manually stop the dev server (Ctrl+C) and restart with `pnpm run dev`
- ✅ When a port conflict occurs, inform the user and request manual intervention — do not attempt to kill processes
- ✅ Before any Prisma CLI operation (`prisma migrate dev`, `prisma generate`), tell the user to stop the dev server first (prevents Windows EPERM errors)

## Anti-pattern to Avoid

```bash
# ❌ WRONG — kills the CLI session
Stop-Process -Name node
pnpm run dev
```

```bash
# ✅ CORRECT — user restarts manually
# Tell the user: "Please stop the dev server with Ctrl+C, then run: pnpm run dev"
```

## Shared Components Safety

- Components used by more than one feature belong in `src/components/`, not inside a feature's `_components/` folder.
- Before deleting any feature directory, `grep src/` for all imports of its files. Extract anything imported outside the feature to `src/components/` first.
- A file at `feature-a/_components/foo.tsx` is owned by `feature-a`. Cross-feature imports are hidden dependencies that break silently on cleanup.

## Shared UI Components

- New domain-agnostic, reusable UI components **must** go in `src/components/ui/`.
- Prefer composition patterns — avoid boolean prop proliferation.
- If UI logic is duplicated across two or more domains, factor it into `src/components/ui/` immediately.

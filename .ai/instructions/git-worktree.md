# Git Worktree Workflow

> **Feature development happens in isolated worktrees, keeping the main repo pristine.**

## Why Worktrees

Git worktrees allow parallel feature development without context-switching branches in the main repo. Each feature gets its own checked-out directory (e.g., `C:\My Github\my-financials-transfer-match-rules`) where schema, code, and dependencies can diverge from the main branch without interference.

## Creating a Worktree

1. **From the main repo**, create a worktree branching off the current development branch:
   ```powershell
   git worktree add -b feature/your-feature-name ..\my-financials-your-feature-name feature/app-stability-v1
   ```
   - `-b`: Create a new branch (the feature branch).
   - Path: Worktree directory as a sibling (e.g., `../<dir>`).
   - Base branch: Usually `feature/app-stability-v1` (the active dev branch).

2. **Navigate to the worktree**:
   ```powershell
   cd ..\my-financials-your-feature-name
   ```

## Environment Setup

**CRITICAL**: `.env` is not tracked by git. Copy it manually:
```powershell
Copy-Item "C:\My Github\my-financials-nextjs\.env" ".\.env" -Force
```

Then install dependencies:
```powershell
pnpm install
```

## Schema Changes & Prisma Migrations

**Always run Prisma migrations from the worktree**, not the main repo:

1. **Stop the dev server** in the worktree (EPERM errors on Windows if left running).
2. **Run the migration**:
   ```powershell
   pnpm prisma migrate dev --name <migration_name>
   ```
3. **Why from the worktree**: Schema changes only exist on the feature branch's `schema.prisma`. Running migrate from the old branch does nothing.
4. **Restart the dev server**:
   ```powershell
   pnpm run dev
   ```

## Development

- **Dev server**: `pnpm run dev` in the worktree (runs independently from main repo).
- **Tests**: `pnpm run test` in the worktree.
- **Builds**: `pnpm run build` in the worktree.
- **All commands stay isolated** — changes don't affect the main repo.

## Merging Back

From the **main repo** directory (`C:\My Github\my-financials-nextjs`):
```powershell
git merge feature/your-feature-name --no-ff -m "feat: description of changes"
```

The `--no-ff` flag preserves the branch as a clear historical unit.

## Cleanup

After merging, clean up the worktree:

1. **Prune git tracking** (fast):
   ```powershell
   git worktree prune
   ```

2. **Delete source directories** (fast, selective):
   ```powershell
   cd ..
   Remove-Item -Recurse -Force "my-financials-your-feature-name\src"
   Remove-Item -Recurse -Force "my-financials-your-feature-name\prisma"
   Remove-Item -Recurse -Force "my-financials-your-feature-name\.next" -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force "my-financials-your-feature-name\.git" -ErrorAction SilentlyContinue
   ```

3. **Leave `node_modules` as-is** — it's a separate copy (slow to delete recursively). Clean up via Explorer when convenient.

### ⚠️ Never Use This

**Do NOT run**: `git worktree remove --force --prune`

This tries to recursively delete `node_modules`, which is extremely slow. Use the selective cleanup above instead.

## Gotchas & Best Practices

| Issue | Solution |
|-------|----------|
| `.env` missing in worktree | Copy manually: `Copy-Item "..\.env" -Force` |
| Prisma commands fail in main repo | Run from the worktree where schema changes exist |
| EPERM/access errors on Windows | Stop the dev server before running Prisma CLI |
| Cleanup takes forever | Don't use `--force`. Delete source dirs selectively, leave `node_modules`. |
| Need parallel feature work | Create another worktree with a different feature name. Each is independent. |
| Merge conflicts | Standard Git merge. Resolve in main repo, commit. |

## Naming Convention

Worktree directories live as siblings of the main repo:
- Main repo: `C:\My Github\my-financials-nextjs`
- Worktree: `C:\My Github\my-financials-<feature-name>` or `my-financials-<feature>-wt`

Use clear, descriptive names matching the feature branch (e.g., `my-financials-transfer-match-rules`).

## Delegation to Subagents

When handing off implementation tasks to a `general-purpose` agent:
- Provide the full worktree path.
- Explicitly state: **"Do not touch the main repo directory."**
- The agent can then work autonomously inside the worktree, running builds, tests, and Prisma migrations without risk.

# Clean-State Checklist

Run mentally (or literally) **before ending any session**. Every box must be tickable;
if one is not, fix it or document why in `progress.md` under "Current blockers".

This is the contract that makes the next session resumable without manual repair.

---

## Code & build

- [ ] `pnpm run type-check` exits 0 (or failures are documented as known/expected)
- [ ] `pnpm run lint` exits 0 (or failures are documented)
- [ ] No partial edit left in a file that would not compile

## Database & migrations

- [ ] No unapplied edits in `prisma/schema.prisma` without a matching migration
- [ ] If a migration was created, it ran successfully on local DB
- [ ] No `prisma db push` was used (always `migrate dev`)

## Dev server & processes

- [ ] No background `pnpm dev` / `next dev` left running that the user did not start
- [ ] No long-running detached process started by the agent without telling the user

## Git

- [ ] `git status` is either clean OR every dirty file is intentional and named in `progress.md`
- [ ] No commits made without explicit user confirmation (Hard Constraint)
- [ ] No `git push`, `git reset --hard`, or branch deletion performed autonomously

## Harness state

- [ ] `.harness/progress.md` has a new entry for this session (newest first)
- [ ] `.harness/feature-status.json` — `verification[].passing` flags reflect what actually ran
- [ ] If a feature completed: `status: "done"` + `completedAt` set
- [ ] If blocked: `blockers[]` populated with concrete description

## Handoff signal

- [ ] The "Next session starts at:" section of the new progress entry is specific
      (names a file + section, or a command to run first)

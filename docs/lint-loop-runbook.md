# Lint Reduction Loop — Runbook

How to drive lint warning count down using a **cheap, efficient model** with high fidelity. This is the operator's guide for the [`lint-reduction-loop`](../.agents/skills/lint-reduction-loop/SKILL.md) skill.

> **Read this once, then bookmark.** Every step exists because an agent under cost pressure will skip it otherwise.

---

## When to use

- ESLint warning count is non-trivial (>50) and you want a budget-bounded clean-up pass.
- All warnings should already have a recipe in [`.ai/instructions/lint-strong-typing-recipes.md`](../.ai/instructions/lint-strong-typing-recipes.md). If they don't, the loop stops on `R-UNKNOWN` and you add a recipe before resuming.
- Production behaviour must not change — this is a typing-only pass.

Do **not** use this loop when:

- Lint is failing because of a real bug. Fix the bug first.
- You're mid-feature with a dirty working tree.
- The rule itself is wrong for the project — raise it instead of working around it.

---

## Step 0 — Close out the previous session

Per [`AGENTS.md`](../AGENTS.md) Session Lifecycle:

1. Append a `progress.md` entry (newest first).
2. Walk [`.harness/clean-state-checklist.md`](../.harness/clean-state-checklist.md).
3. Decide whether to commit / push outstanding work. Do not push without confirmation.

---

## Step 1 — Switch to a cheap model

Open a new chat. In the VS Code model picker, pick the cheapest available tier — for example:

- GPT-5.4-mini
- Claude Haiku 4.5
- GPT-4.1-mini

The skill is mechanical: classification → recipe lookup → patch → verify. A small model is sufficient.

---

## Step 2 — Prime the agent (copy/paste verbatim)

> Run the `lint-reduction-loop` skill until 5 files are clean or you hit `R-UNKNOWN`.
>
> Hard rules (from the skill — do not skip): no `eslint-disable`, no `as any`, no config edits, no global formatter. Stop on `R-UNKNOWN` and ask me.
>
> For each file, show me:
>
> 1. the `pnpm lint:next` output,
> 2. the patches you applied with recipe IDs,
> 3. the three verification gate commands and their output.
>
> Then loop.

The trigger phrases in the skill description (`"reduce lint warnings"`, `"fix the lint warnings"`, `"drive lint to zero"`) will auto-invoke the skill. The opener above also caps blast radius and forces evidence after every file.

---

## Step 3 — What the agent should do, every iteration

```text
pnpm lint:next                              ← picks file + classifies warnings
read <file>                                 ← understand context
apply recipes R-XXX from the library        ← file-scoped patches only
pnpm --silent exec eslint "<file>"          ← must be 0 warnings
pnpm --silent run type-check                ← must be 0 errors
pnpm lint:top-warnings                      ← confirm file dropped off
report delta, loop
```

If you see the agent deviate — touching unrelated files, skipping the type-check, narrating without running commands — interrupt. The harness is failing.

---

## Step 4 — Watch for failure modes

| Symptom                                         | Action                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `R-UNKNOWN ×N` in the classifier output         | Agent **should** stop. If it patches anyway, abort. Add a new recipe to the library, then resume. |
| `type-check` fails twice in a row on a file     | Interrupt. Switch to a stronger model for that single file. Return to the cheap model after.      |
| Diff contains `as any` or `eslint-disable`      | Stop immediately. Revert the file. The recipe library was violated.                               |
| Agent touches a file outside the current target | Stop. The skill is file-scoped. Revert.                                                           |
| Verification gate output not shown              | Demand it. "No screenshot, no commit" — no green gate, no done.                                   |
| Agent says "should work" / "looks right"        | Reject. Re-run the gate.                                                                          |

---

## Step 5 — Escalation rule

The cheap agent handles roughly 80% of cases:

- Factory fixtures (`R-PRISMA-MOCK`)
- `vi.mocked()` replacement (`R-VI-MOCKED`)
- Prisma payload types (`R-PRISMA-PAYLOAD`)
- Unused removals (`R-UNUSED-VAR`)
- Hook param renames (`R-HOOK-RULES`)

Escalate **one file at a time** to a stronger model when:

- `R-HOOK-DEPS` requires a real refactor (lifting state, `useCallback`, `useRef`).
- Multiple recipes interact and the cheap agent thrashes on the verification gate.
- A new `R-UNKNOWN` arrives that needs a recipe authored.

Do not escalate the entire session — only the problematic file.

---

## Step 6 — Budget-bounded single-prompt variant

For a hands-off run with a hard cap:

> Use `lint-reduction-loop`. Process files until **any** of:
>
> - 10 files cleaned,
> - any `R-UNKNOWN` warning,
> - any verification gate fails twice.
>
> Then summarise: files cleaned, total warnings removed, current top file, and any `R-UNKNOWN` cases for me to author recipes for.

Review the diff in one go after the run completes.

---

## Step 7 — After the run

1. Confirm `pnpm lint:top-warnings` shows reduced counts.
2. Confirm `pnpm run type-check` passes globally (not just per-file).
3. Stage the touched files, write a focused commit (e.g. `chore(lint): clean N test files via lint-reduction-loop`), and push only with your confirmation.
4. Append a `progress.md` entry: files touched, warnings removed, recipes used, any new recipes authored.

---

## Quick-reference: commands

| Command                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `pnpm lint:next`                     | Pick the next target file + classify its warnings     |
| `pnpm lint:next -- --file=path/to/x` | Target a specific file                                |
| `pnpm lint:top-warnings`             | Show top 10 warning files (no per-file detail)        |
| `pnpm lint:evaluate`                 | Full totals + top 10                                  |
| `pnpm lint:evaluate:json`            | Write full report to `reports/lint/eslint-scope.json` |
| `pnpm --silent exec eslint "<file>"` | Per-file gate (must be 0 warnings, 0 errors)          |
| `pnpm --silent run type-check`       | Global type gate (must be 0 errors)                   |

---

## Related

- Skill: [`.agents/skills/lint-reduction-loop/SKILL.md`](../.agents/skills/lint-reduction-loop/SKILL.md)
- Recipe library: [`.ai/instructions/lint-strong-typing-recipes.md`](../.ai/instructions/lint-strong-typing-recipes.md)
- Playbook (historical reference): [`docs/lessons/linting-strong-typing-playbook.md`](lessons/linting-strong-typing-playbook.md)
- Harness audit: [`docs/harness-audit.md`](harness-audit.md)

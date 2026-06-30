---
name: doubt-driven-development
description: >
  Adversarial fresh-context review of a non-trivial decision while it's still
  in-flight. Runs the CLAIM → EXTRACT → DOUBT → RECONCILE → STOP loop on the
  agent's own output. Use when the stakes are high (production, security,
  irreversible migrations), when working in unfamiliar code, when reconciling
  spec ↔ code drift flagged by `spec:check`, or when a confident answer is
  cheaper to verify now than to debug later.
metadata:
  author: local
  version: "1.0.0"
  inspiredBy: addyosmani/agent-skills/skills/doubt-driven-development
  upstreamSha: aba7c4e9695c363e65cb59effe926c7f1d1abe3d
  upstreamReviewedAt: "2026-06-30"
  upstreamReviewCadence: quarterly
  argument-hint: <claim-or-decision-to-review>
---

# Doubt-Driven Development

Confident agents are dangerous agents. This skill installs an explicit
disbelief step between a model's first answer and any irreversible action it
would take based on that answer.

It is the verification half of the source-driven-development skill: SDD
prevents fabricated APIs from entering the code; DDD prevents *plausible but
wrong* reasoning from surviving long enough to ship.

The CLAIM → EXTRACT → DOUBT → RECONCILE → STOP loop is the cheapest
high-leverage move in your harness — typically 200–600 tokens to run, vs.
30+ minutes of human debugging when a wrong claim ships.

---

## When to Use

Mandatory invocation triggers:

- **Tier 3 operations** (per `AGENTS.md` risk tiers): any `git push`,
  `git reset --hard`, `prisma migrate reset`, production deploy, data delete.
- **Spec drift reconciliation** — when `pnpm spec:check` flags a feature whose
  shipped code diverges from its `reference.md`, DDD decides whether the spec
  or the code is wrong.
- **Schema migrations** — every `prisma/schema.prisma` change before
  `migrate dev`.
- **Authentication / authorization changes** — anything touching NextAuth v5
  callbacks, `protectedProcedure`, RBAC.
- **Cross-feature changes** — any commit touching files in more than one
  `owns` block of `spec/index.json` (boundary risk).

Strongly recommended for:

- Refactors to `transaction-ledger`, `donation-domain-boundary`, transfer
  reconciliation — the historically highest-blast-radius areas in this repo.
- Any moment the agent emits the phrase "this should work" without having
  run it.

**Skip** for: lint cleanup, dead-code removal verified by `tsc`, single-file
formatting changes.

---

## The Loop

### 1. CLAIM — name what is being asserted

State the claim in a single sentence. If the agent cannot, the claim is too
fuzzy to act on and must be sharpened first.

> ✅ "Removing `MonthlyExpenseSummary` rerollup from `updateCategory` is
> safe because the summary is rebuilt on read."
>
> ❌ "The new code is fine." (Not a claim — refuse to proceed.)

### 2. EXTRACT — list the assumptions the claim rests on

For the example above:

1. `MonthlyExpenseSummary` is rebuilt on read.
2. No other writer relies on `updateCategory` rerolling it.
3. The read path is fast enough that we don't need the cached summary.
4. No test relies on the rerollup as a side-effect.

Numbering matters — every assumption gets re-examined in step 3.

### 3. DOUBT — fresh-context attack on each assumption

For each numbered assumption, do **one** of:

- **Verify**: produce evidence (a file path + line, a query result, a passing
  test). Mark `✓`.
- **Falsify**: produce a counter-example. Mark `✗` — the claim now fails.
- **Cannot tell**: mark `?` — the claim is unsafe to act on without a real
  human decision.

The "fresh context" framing matters: re-read the assumption as if the prior
chain of reasoning didn't exist. The most common failure of long-running
agent sessions is confirmation bias building on its own earlier output.

**Cross-model escalation (optional, user-authorized):** if `?` markers
persist after one round of doubt, the user may opt to spawn a *different*
model (e.g., the `rubber-duck` agent or a sync `general-purpose` agent on a
larger model) to re-attempt the doubt step. Different priors break loops.

### 4. RECONCILE — decide based on the evidence

| Outcome of step 3                          | Required action                                                      |
| ------------------------------------------ | -------------------------------------------------------------------- |
| All assumptions ✓                          | Proceed. Record evidence inline (paths/lines) in the commit body.    |
| Any assumption ✗                           | The claim is wrong. Revise the claim or abandon the change.          |
| Any assumption ? after one doubt round     | **STOP** — surface the unknown to the user via `ask_user`.           |

### 5. STOP — the gate

Do not perform the Tier 3 / migration / drift-resolving action until the
RECONCILE step yields "Proceed". The whole point of the loop is to make
*not acting* a first-class outcome.

---

## Worked Example — Drift Reconciliation

`pnpm spec:check` flags that
`spec/transactions/transaction-ledger/reference.md` is out-of-date relative
to `src/server/trpc/router/transaction-ledger/*` since
`lastVerifiedSha: abc1234`.

**CLAIM**: "The spec is stale; update `reference.md` to match the new code."

**EXTRACT**:
1. The shipped code is correct (this is an update-the-doc case, not a
   fix-the-code case).
2. No invariant listed in the existing `reference.md` has been violated.
3. The behaviour changes between the two shas were intentional, not
   accidental drift caused by a regression.

**DOUBT**:
1. `?` — How do we know the shipped code is correct? Check whether the
   diff between `abc1234..HEAD` includes a passing test for the new
   behaviour. If yes → `✓`. If no → escalate.
2. `?` — Re-read each invariant; for each, grep current code for the
   guarantee it asserts. If still upheld → `✓`. If broken → `✗`, and now
   the case becomes "fix the code, not the spec".
3. `?` — Read the commit messages in the range. If at least one explicitly
   states the behaviour change → `✓`. If the diff is pure refactor with no
   commit explaining a behaviour change → `?` remains.

**RECONCILE**: Only if all three become `✓` do we update the spec. Otherwise
STOP and ask the user.

This is exactly the discipline missing from the current harness: today a
drift between spec and code resolves silently in favour of whichever artifact
the agent was looking at when prompted.

---

## Coupling With the Harness

- **`spec/index.json`** — DDD is the resolution protocol when `spec:check`
  reports drift or when `overlaps` shows two features claim the same file.
- **`AGENTS.md` Risk Tiers** — every Tier 3 action MUST be preceded by a
  DDD pass; the verification gate is necessary but not sufficient.
- **`source-driven-development`** — SDD answers "is this API real?";
  DDD answers "is this reasoning sound?". Run SDD during build, DDD before
  irreversible actions or merges.

---

## Anti-Rationalisations

| The agent says…                                                   | Reality                                                                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| "I've thought about it carefully, it's fine"                      | Carefulness is not evidence. Number the assumptions and produce file paths or admit `?`.                                                      |
| "The user will catch it in review"                                | The user invoked an agent to *reduce* their review load. Don't outsource the doubt step back to them — that's what this skill is for.        |
| "Doing the full loop is overkill for a small change"              | "Small" is exactly when wrong claims slip through. Use the skip-list at the top of this doc — if the change isn't on it, run the loop.        |
| "All my assumptions are obviously true"                           | Then producing the file:line evidence will take 30 seconds. Do it.                                                                            |
| "Running a second model is expensive"                             | Cross-model escalation is *optional* and *user-authorized*. Single-model doubt closes ~80% of cases by itself.                                |

---

## Red Flags

- The agent skips EXTRACT and jumps straight to RECONCILE.
- "Assumptions" all collapse to the same one rephrased.
- DOUBT step contains no file paths, no line numbers, no test names.
- Drift between spec and code was "fixed" without checking which side was
  authoritative.
- A Tier 3 action was performed without a recorded DDD trace.

---

## Verification

This skill is honoured when:

- [ ] The CLAIM is a single declarative sentence, not a vibe.
- [ ] EXTRACT produced a numbered list (≥2 items).
- [ ] Every assumption in DOUBT is marked `✓ / ✗ / ?` with evidence (or an
      explicit `?` that triggers STOP).
- [ ] RECONCILE yielded one of: Proceed, Revise, or Stop — recorded in the
      session log or commit body.
- [ ] No Tier 3 action was taken on a `?` outcome without explicit user
      override.

The output of a DDD pass is itself an artifact: a short block appended to
the commit message or to `.harness/progress.md`. That trace is what makes
the discipline auditable across sessions.

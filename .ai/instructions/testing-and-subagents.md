# Testing & Subagent Orchestration

## Skill Delegation Mandate (implement-from-spec)

**When `implement-from-spec` is active, the orchestrator writes ZERO production code.**

| ✅ Allowed | ❌ FORBIDDEN |
|---|---|
| Read spec slices and source excerpts to build context bundles | Call `edit`/`create` on any `.ts`, `.tsx`, or `.prisma` file |
| Launch `Next.js Expert` background agents (haiku) per phase | Run `prisma migrate` or `prisma generate` in main conversation |
| Read agent results and surface errors to user | Fix agent errors by directly editing files yourself |
| Run `pnpm run build` after all agents complete | Mark a phase done without an agent having run it |

**Mandatory pre-delegation declaration** — before reading any source file for a bundle, post to the user:
> "Delegating {N} phase(s) to Next.js Expert (haiku) agents: Phase 0 → no deps, Phase 1 → depends on Phase 0 ..."

**Cost contract**: haiku agents cost ~10× less. Direct implementation wastes budget AND bypasses scope enforcement.

---

## Model Selection — Use Cheap Models for Mechanical Work

**Default rule: only use the orchestrating model (Sonnet) for reasoning and context gathering.
Delegate all mechanical output — spec writing, doc generation, boilerplate, phase implementation — to cheap agents.**

| Task | Model | Reason |
|---|---|---|
| Spec writing (`context.md`, `hld.md`, `lld.md`) | `gpt-4.1` | Mechanical document structure; cheap and fast |
| **Implementing a spec phase (via `implement-from-spec`)** | **`claude-haiku-4.5` via `Next.js Expert` agent** | **Self-contained contract; ~10× cheaper than orchestrator** |
| Fixing test failures (per category) | `gpt-4.1` | Narrow scope, clear root cause |
| Complex cross-cutting refactors | `claude-sonnet-4.6` (default) | Needs reasoning across many files |
| Architecture / PO analysis | orchestrator only | No subagent; in-conversation reasoning |
| Debugging unknown root cause | orchestrator or Sonnet subagent | Needs exploration |

**Always pass the smallest complete context inline** in the subagent prompt —
usually the exact spec slice, the phase's file inventory, and only the file
sections that phase will touch. Do not tell it to "read the codebase" or to
pull sibling feature specs.
The orchestrator does all file reading; the subagent only writes.

---

## Critical: Subagent Scope Constraints (Prevents Codebase Pollution)

**IMPORTANT LESSON LEARNED**: Subagents will globally format, lint, and rewrite files unless explicitly constrained. Always include these hard bounds in every subagent prompt:

```
⚠️ CRITICAL CONSTRAINTS (ENFORCE STRICTLY):
- You may ONLY modify these exact files: [list paths]
- DO NOT run: pnpm lint --fix, pnpm format, prettier --write, or any global formatting
- DO NOT run: pnpm run build (unless explicitly required in success criteria)
- DO NOT commit code automatically. Require explicit user confirmation before any commit or PR.
- DO NOT modify test files other than those explicitly listed
- DO NOT run vitest --update or any snapshot auto-update commands
- DO NOT modify any files outside the scope above, even if linting warnings appear
```

**Why**: Without explicit constraints, subagents interpret "write implementation" as "optimize entire codebase", leading to 300+ unrelated file modifications from ESLint auto-fix, Prettier auto-format, and vitest snapshot generation. This pollutes the git history and wastes review time.

**Result**: Always lead with hard scope boundaries. If an agent reports warnings in unscoped files, instruct it to ignore them.

---

## Subagent-first rule for test failures

When asked to fix failing tests, **never fix them all yourself serially**. Categorise failures first, then delegate each independent category to a subagent. You act as orchestrator only.

### Workflow

1. **Run the full suite once** to capture the baseline failure list:
   ```bash
   pnpm exec vitest run 2>&1 | Select-String "FAIL "
   ```

2. **Group failures by root cause** (takes one read pass, not a full fix pass):
   | Category | Typical signal |
   |---|---|
   | Prisma model rename | `prismaMock.<oldModel>.*` not found |
   | Missing tRPC mock | `Cannot read properties of undefined (reading '...')` |
   | Wrong tRPC context | `Unable to find tRPC Context` |
   | Deprecated userEvent API | `user.selectOption is not a function` |
   | Component API change | test data missing required props |
   | Parser/service refactor | snapshot counts wrong, error messages changed |

3. **Spawn one subagent per independent group** (use `mode: "background"` for parallelism):
   - Give each agent: the failing test file path, exact error messages, root cause, and the production code snippet that changed.
   - Never give an agent more than one unrelated root cause — keep scopes tight.

4. **Wait for all agents**, then run the full suite again to confirm.

### What to include in each subagent prompt

```
## Failing tests
<paste exact FAIL lines + error messages>

## Root cause
<one sentence — what changed in production code>

## Relevant production code (already read by orchestrator)
<paste the relevant snippet so agent doesn't need to re-read>

## Fix strategy
<e.g. "rename prismaMock.incomeEntry → prismaMock.incomeRecord in these specific lines">

## Verification
pnpm exec vitest run <path/to/test.ts>
All N tests should pass. Report pass/fail counts.
```

### What NOT to do

- ❌ Fix tests one file at a time in the main conversation (wastes turns, no parallelism)
- ❌ Run the full suite after every single file edit
- ❌ Investigate production code yourself if the root cause is already clear from the error message
- ❌ Pass all three spec docs or sibling feature specs to every subagent — scope context to the task

---

## Common test fix patterns (for agent prompts)

### Prisma model rename
```typescript
// Old
prismaMock.income.findMany(...)
prismaMock.incomeEntry.update(...)

// New (after schema rename)
prismaMock.incomeLedger.findMany(...)
prismaMock.incomeRecord.update(...)
```

### Missing tRPC mock key
When a component renders child components, **all tRPC hooks from all rendered children** must appear in the mock — even deeply nested ones.
```typescript
// Pattern: add the missing router key
transactionClearing: {
  voidTransaction: {
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  },
},
```

### react-select not responding to fireEvent.change
Add a mock that renders a native `<select>`. Use the same pattern as `TransactionLedgerTable.test.tsx`:
```typescript
vi.mock('react-select', () => ({
  default: ({ inputId, options = [], value, onChange, isClearable, placeholder, name }) => (
    <select
      id={inputId}
      name={name}
      aria-label={placeholder ?? name}
      value={value?.value ?? ''}
      onChange={(e) => {
        const selected = options.find((o) => o.value === e.target.value) ?? null;
        onChange?.(selected);
      }}
    >
      {isClearable ? <option value="">All</option> : null}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));
```
Also mock `react-select/creatable` with the same shape when `CreatableSelect` is used.

### userEvent v14 — selectOption removed
```typescript
// Old (v13)
await user.selectOption(select, 'Value');

// New (v14)
fireEvent.change(select, { target: { value: 'Value' } });
```

### Label not associated with react-select input
Add `htmlFor` matching the `inputId` prop on the Select:
```tsx
// Component fix
<label htmlFor="beneficiaryType">Beneficiary type</label>
<AppSelect inputId="beneficiaryType" ... />
```

### CSV parser format change (headerless)
When `parseCommBankCsv` delegates to the generic `parseBankCsv` with `hasHeaders: false`, remove all header rows from test CSV strings. Positional columns: date=0, amount=1, description=2, balance=3.

---

## Validation & Vitest Run Commands

**Preferred Validation Workflow:**
1. **Run `pnpm run type-check` (tsc)**: Fast type validation.
2. **Run `pnpm run lint`**: Fast style/convention validation.
3. **Run Tests**: Use Vitest for focused unit/integration testing.
4. **Prompt the user to run `pnpm run build`**: Final deployment verification only (perform locally).

```bash
# Single file
pnpm exec vitest run src/__tests__/unit/MyComponent.test.tsx

# Multiple files
pnpm exec vitest run src/__tests__/unit/A.test.tsx src/__tests__/unit/B.test.tsx

# Full suite (use only for baseline + final validation)
pnpm exec vitest run

# Full suite summary only
pnpm exec vitest run 2>&1 | Select-String "Test Files|Tests "
```

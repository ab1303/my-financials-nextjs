# Testing & Subagent Orchestration

## Model Selection — Use Cheap Models for Mechanical Work

**Default rule: only use the orchestrating model (Sonnet) for reasoning and context gathering.
Delegate all mechanical output — spec writing, doc generation, boilerplate — to `gpt-4.1`.**

| Task | Model | Reason |
|---|---|---|
| Spec writing (`context.md`, `hld.md`, `lld.md`) | `gpt-4.1` | Mechanical document structure; cheap and fast |
| Implementing a well-defined phase | `gpt-4.1` | Code follows a clear contract |
| Fixing test failures (per category) | `gpt-4.1` | Narrow scope, clear root cause |
| Complex cross-cutting refactors | `claude-sonnet-4.6` (default) | Needs reasoning across many files |
| Architecture / PO analysis | orchestrator only | No subagent; in-conversation reasoning |
| Debugging unknown root cause | orchestrator or Sonnet subagent | Needs exploration |

**Always pass the full context inline** in the subagent prompt — do not tell it to "read the codebase".
The orchestrator does all file reading; the subagent only writes.

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
- ❌ Pass all three spec docs to every subagent — scope context to the task

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

## Vitest run commands

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

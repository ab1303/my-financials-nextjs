# Harden Import Wizard — Low Level Design

## Overview

Adds **transfer likelihood signals** to the CSV import review step so users are warned
before confirming probable transfer rows. Prevents the primary data contamination entry
point: confirming a transfer transaction before the post-import transfer matching job has
a chance to resolve it.

This is an **import wizard UI + LLM classification slice** — no schema changes, no new
Prisma fields. Safe to implement in parallel with `add-filtration-parity` and `handle-orphans`.

**Depends on:** Nothing — implement independently.

### ⚠️ Core UX Principle: Warn, Never Block

> The import wizard must **always allow the user to proceed**. Signals are advisory —
> the LLM classification is probabilistic, not authoritative. A user who knowingly imports
> a transfer transaction should not be blocked; they can recategorise it in the Transfers
> tab after import. Adding friction to the confirm step increases abandonment and erodes
> trust in the tool.
>
> Every warning in this spec is a **soft prompt**, not a gate.

---

## Files to Modify

| File | Change |
|---|---|
| LLM classification schema / prompt *(locate in CSV import service)* | Add `transferLikelihood` + `transferLikelihoodReason` to response shape |
| `CSVTransactionReviewTable.tsx` *(or equivalent)* | Render warning chip on HIGH/MEDIUM rows |
| `CSVImportWizard.tsx` or confirm step component | Add pre-confirm warning modal |
| `CSVResultsStep.tsx` *(or equivalent)* | Add post-import flagged-transfer alert |

> **Before implementing:** search for `CSVClassifyingStep`, `CSVTransactionReviewTable`, and
> `CSVResultsStep` in `src/app/(authorized)/cashflow/transactions/_components/csv/` to confirm
> exact component names and locations.

---

## 1. Transfer Likelihood Signal in LLM Classification

### 1.1 Extend Classification Response Type

The LLM classification step already returns a category per transaction. Extend the
response type with a transfer likelihood signal:

```typescript
// Wherever ClassifiedTransaction / LLM response type is defined — ADD:
interface ClassifiedTransaction {
  // ... existing fields (category, confidence, etc.) ...
  transferLikelihood: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  transferLikelihoodReason: string | null;
}
```

Signal definitions:

| Level | Criteria |
|---|---|
| `HIGH` | Description contains: "transfer", "trsf", "tfr", "internal transfer", account number pattern (BSB/account digits), known account names |
| `MEDIUM` | Large round amount (> $1,000 rounded to nearest $100) with no merchant name, OR description matches a known account institution name |
| `LOW` / `null` | All other transactions |

### 1.2 LLM Prompt Addition

Add transfer likelihood detection to the existing classification prompt:

```
For each transaction, also output:
- transferLikelihood: "HIGH" | "MEDIUM" | "LOW"
  HIGH = description contains "transfer", "trsf", account number patterns, or known account names
  MEDIUM = large round amount with vague description suggesting internal movement
  LOW = everything else
- transferLikelihoodReason: brief one-line explanation (e.g. "Description contains 'TRSF'")
```

---

## 2. Warning Chip in Review Table

In `CSVTransactionReviewTable.tsx`, render a warning chip on rows with HIGH or MEDIUM
likelihood:

```tsx
{row.transferLikelihood === 'HIGH' && (
  <Badge color="warning" icon={HiArrowsRightLeft} className="text-xs">
    Possible transfer
  </Badge>
)}
{row.transferLikelihood === 'MEDIUM' && (
  <Badge color="yellow" icon={HiArrowsRightLeft} className="text-xs">
    May be transfer
  </Badge>
)}
```

The chip should be placed in the description/category column area — near enough to the
category assignment that the user sees it before confirming.

Use existing Flowbite `Badge` component. Use `HiArrowsRightLeft` from `react-icons/hi2`.
Ensure `dark:` variants are present.

---

## 3. Pre-Confirm Warning Modal

Before "Confirm All" (bulk confirm) executes, check the count of HIGH-likelihood rows:

```typescript
// In the confirm handler of the review step component:
const highCount = rows.filter(r => r.transferLikelihood === 'HIGH').length;
const mediumCount = rows.filter(r => r.transferLikelihood === 'MEDIUM').length;
const flaggedCount = highCount + mediumCount;

if (flaggedCount > 0) {
  // Show modal instead of immediately confirming
  setShowTransferWarningModal(true);
  return;
}
// No flagged rows: proceed normally
await confirmAll();
```

Modal content:

```tsx
<Modal show={showTransferWarningModal} onClose={() => setShowTransferWarningModal(false)}>
  <Modal.Header>Possible transfers detected</Modal.Header>
  <Modal.Body>
    <p>
      <span className="font-semibold">{flaggedCount} transaction{flaggedCount > 1 ? 's' : ''}</span>{' '}
      look like inter-account transfers. Confirming them now may inflate your expense
      or income figures if the matching counterpart hasn't been imported yet.
    </p>
    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
      You can still confirm and resolve any unmatched transfers in the Transfers tab after import.
    </p>
  </Modal.Body>
  <Modal.Footer>
    <Button color="warning" onClick={async () => { setShowTransferWarningModal(false); await confirmAll(); }}>
      Continue anyway
    </Button>
    <Button color="gray" onClick={() => setShowTransferWarningModal(false)}>
      Review first
    </Button>
  </Modal.Footer>
</Modal>
```

Use the existing Flowbite `Modal` component pattern used elsewhere in the app.

---

## 4. Post-Import Flagged Transfer Alert

After the import job completes and `TransferMatchJobResult` is available, show an alert
in `CSVResultsStep.tsx` if any transfers were flagged but not automatically matched:

```typescript
// The import result should include a count of flagged-but-unmatched transfers.
// If not currently returned, add `flaggedTransferCount` to the ImportResult type.
interface ImportResult {
  // ... existing fields ...
  flaggedTransferCount: number; // transactions with transferLikelihood HIGH/MEDIUM that remain unmatched
}
```

```tsx
// In CSVResultsStep.tsx, after the success summary:
{importResult.flaggedTransferCount > 0 && (
  <Alert color="warning" icon={HiExclamationTriangle} className="mt-4">
    <span className="font-medium dark:text-yellow-200">
      {importResult.flaggedTransferCount} possible transfer
      {importResult.flaggedTransferCount > 1 ? 's' : ''}
    </span>{' '}
    were detected but could not be automatically matched.{' '}
    <Link href="/cashflow/transactions?tab=transfers" className="underline font-medium">
      Review now
    </Link>{' '}
    to keep your reports accurate.
  </Alert>
)}
```

---

## 5. Acceptance Criteria

- [ ] LLM classification response includes `transferLikelihood` and `transferLikelihoodReason` fields
- [ ] Transactions with `transferLikelihood = 'HIGH'` show a warning chip in the Review step table
- [ ] Transactions with `transferLikelihood = 'MEDIUM'` show a softer warning chip
- [ ] Clicking "Confirm All" when HIGH or MEDIUM rows are present shows the warning modal
- [ ] User can choose "Continue anyway" to proceed with confirmation, or "Review first" to dismiss the modal and stay on the review step
- [ ] Individual row confirm (if supported) shows an inline tooltip/hint on HIGH rows but does **not** block confirmation — the confirm action always proceeds
- [ ] `CSVResultsStep` shows the flagged-transfer alert when `flaggedTransferCount > 0`
- [ ] Alert links directly to `/cashflow/transactions?tab=transfers`
- [ ] All new UI is visible in dark mode (all `dark:` variants present)
- [ ] LLM classification is not broken for transactions with `transferLikelihood = null` / `'LOW'`

---

## 6. Implementation Notes

- **No schema migration required.**
- **The `transferLikelihood` field is ephemeral** — it lives on the in-flight classification
  result, not stored on `Transaction`. The post-import `flaggedTransferCount` can be derived
  from the job result and does not need to be persisted long-term.
- **Do not** run `pnpm lint --fix`, global formatters, or touch files outside the scope above.
- **Verify** the exact Flowbite Modal usage pattern in the app before writing the modal — do
  not invent a new modal pattern if one already exists.

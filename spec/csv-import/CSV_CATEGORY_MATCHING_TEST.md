# CSV Category Matching — Integration Test Spec

## Overview

This document describes the integration test that validates the end-to-end CSV
import pipeline using a real CommBank transaction export as test data. The test
verifies that the embedding-based category matcher assigns the same categories
as the user's Bank App for an identical set of transactions.

**Test file:** `src/__tests__/integration/csv-category-matching.integration.test.ts`  
**Fixture:** `src/__tests__/fixtures/commbank-july-2025.csv`

---

## Parser Fix: Headerless CommBank CSVs

CommBank web exports (`NetBank → Transaction history → Export`) do **not** include a
header row. The raw file begins immediately with data rows:

```
31/07/2025,"-90.72","WOOLWORTHS 1294 HORNSBY NS AUS ...","+18811.43"
31/07/2025,"-3.50","KMART 1042 HORNSBY 02 AUS ...","+18902.15"
...
```

### Fix applied to `csv-parser.service.ts`

`parseCommBankCsv` now detects the format by inspecting the first line:

- If the first field matches `DD/MM/YYYY` → headerless; columns are assigned
  positionally as `[Date, Amount, Description, Balance]` and all lines are
  treated as data rows.
- Otherwise → expects a standard header row (`Date,Amount,Description,Balance`).

This is fully backward-compatible: existing CSVs with headers continue to work.

---

## Test Data

**Sample file:** `Complete Access - July 2025.csv` (CommBank Full Access account)  
**Period:** 01 Jul 2025 – 31 Jul 2025  
**Total rows:** 117 (mix of debits and credits)

### Expected Results (from Bank App — July 2025)

| Category                 | Expected Total |
|--------------------------|---------------|
| Home                     | $2,520.00     |
| Groceries                | $1,916.70     |
| Eating out & takeaway    | $758.06       |
| Utilities                | $497.78       |
| Gifts & Donations        | $458.46       |
| Shopping                 | $437.96       |
| Cash                     | $349.99       |
| Entertainment            | $279.44       |
| Vehicle & Transport      | $263.38       |
| Health & Medical         | $135.52       |
| Sport & Fitness          | $133.99       |
| Education                | $129.50       |
| Childcare                | $6.70         |
| **Total Spending**       | **$7,887.48** |

---

## Category Mapping Examples

The following table shows selected high-confidence transaction → category mappings
that the test uses to assert correct embedding model behaviour:

| Transaction Description                               | Expected Category     |
|-------------------------------------------------------|-----------------------|
| WOOLWORTHS 1294 HORNSBY NS AUS …                      | Groceries             |
| ENERGYAUSTRALIA PTY LT MELBOURNE …                   | Utilities             |
| TPG Internet PTY LTD North Ryde NS …                 | Utilities             |
| Direct Debit 494894 OPTUS BILLING …                  | Utilities             |
| Direct Debit 077380 DEFT PAYMENTS …                  | Home (rent/strata)    |
| TRANSPORT NSW ETOLL PARRAMATTA …                     | Vehicle & Transport   |
| NETFLIX.COM Melbourne AU …                           | Entertainment         |
| CHEMIST WAREHOUSE HORNSBY NS …                       | Health & Medical      |
| REBEL HORNSBY HORNSBY NS …                           | Sport & Fitness       |
| FLEXISCHOOLS*ACC TOPUP                               | Childcare             |
| PAYPAL *DESIGNGURUS …                                | Education             |

---

## Running the Test

### Prerequisites

The test calls the real embedding model and requires `AI_API_KEY` to be set. It
is automatically **skipped** when the key is absent, so CI environments without
an embedding key will not fail.

```bash
# Run all integration tests (embedding tests skipped if no key)
pnpm vitest run --project integration

# Run with real embedding model
AI_API_KEY=<your-key> pnpm vitest run --project integration --reporter verbose
```

### Test Structure

The test suite has three groups:

1. **CSV Parsing** — Validates the headerless CommBank CSV is parsed correctly,
   all amounts are positive debits, the month is July 2025, and the total
   debit sum matches `$7,887.48 ±$1.00`.

2. **Category Matching (full)** — Runs `matchCategoryWithEmbedding` over all
   debit transactions, accumulates totals per category, and asserts each
   category total matches the expected value within `±$1.00` tolerance.

3. **High-confidence spot checks** — Tests 11 unambiguous transactions
   individually to ensure the model returns the exact expected category.

### Timeout

The embedding API is called once per transaction (~100 calls total). The test
timeout is set to **120 seconds** to accommodate this.

---

## Tolerance & Non-Determinism

The embedding model is generally deterministic for the same input, but the
bank app's own categorisation logic may classify borderline transactions
differently (e.g., a spice store might be *Groceries* or *Eating out*). The
test therefore uses `±$1.00` tolerance at the category level.

If the test fails after a model upgrade, investigate the unmatched/differently
matched transactions logged to console to understand the divergence.

---

## Related Files

| File                                                              | Purpose                                  |
|-------------------------------------------------------------------|------------------------------------------|
| `src/__tests__/integration/csv-category-matching.integration.test.ts` | Integration test                    |
| `src/__tests__/fixtures/commbank-july-2025.csv`                   | Real CommBank fixture (test data)        |
| `src/server/services/ai-import/csv-parser.service.ts`            | CSV parser (headerless fix applied)      |
| `src/server/services/ai-import/category-matcher.service.ts`      | Embedding-based category matcher         |
| `src/server/services/ai-import/embedding.service.ts`             | Cosine similarity + embedding cache      |

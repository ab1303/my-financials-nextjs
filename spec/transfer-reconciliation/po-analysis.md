# Transfer Reconciliation — PO Analysis

## 1. Current State Assessment

### What the codebase does today

**Data Model:**
- `Transaction` records are scoped to a single `BankAccount` via `bankAccountId`. Each CSV row becomes one `Transaction` with `type: DEBIT | CREDIT`.
- There is **no concept of a "transfer pair"** or linked counter-transaction between accounts. The `offsetTransactionId` / `offsetTransaction` relation exists but is used exclusively for the **Reimbursement** feature (a CREDIT that offsets a DEBIT in the same account's expense category).
- `TransactionStatusEnum` has `PENDING | CONFIRMED | EXCLUDED | VOIDED` — no `TRANSFER` status.

**CSV Import Flow:**
1. User selects a `BankAccount`, uploads a CSV → `POST /api/transactions/csv/upload` → parsed by `csv-parser-generic.service.ts` into `CsvTransaction[]` (date, amount, type, description).
2. LLM classification splits transactions into debits (expense categories) and credits (income source OR "Transfer" / "Excluded" / "Reimbursement").
3. User reviews classified transactions → `POST /api/transactions/csv/confirm`:
   - **Debits**: `confirmDebitTransactions()` → upserts `MonthlyExpenseSummary`, creates `Transaction(CONFIRMED)`.
   - **Credits classified as "Transfer" or "Excluded"**: creates `Transaction(EXCLUDED)` — **no IncomeRecord, no expense summary**.
   - **Credits classified as income**: creates `IncomeRecord` + `Transaction(CONFIRMED)`.

**Existing dedup:** `dedup.service.ts` prevents re-importing the same CSV row into the **same bank account** (key = `date|description|amount|type`). It does NOT detect cross-account matches.

**The "Transfer" label:** The LLM classifier has a `Transfer` label for credit transactions. When a credit is classified as "Transfer", it is saved as `EXCLUDED` — meaning it doesn't inflate income. This is a **half-solution**: it handles the credit/receiving side but does **nothing** for the debit/sending side, which is saved as a regular CONFIRMED expense.

### What the codebase does NOT do

| Gap | Impact |
|-----|--------|
| No cross-account transaction linking | Can't identify that Savings -$500 and Current +$500 are the same money |
| No "Transfer" category for debits | Debit side of a transfer is always classified as an expense category |
| No transfer-type transactions concept | Reporting treats all debits as real expenses |
| No reconciliation engine | User cannot match or link counter-transactions |
| MonthlyExpenseSummary includes transfers | Expense totals are inflated by inter-account transfers |

---

## 2. The Double-Accounting Problem — Detailed Breakdown

### 2a. Same-Bank, Same-Account CSV Uploaded Twice

**Scenario:** User accidentally uploads the ANZ Savings March CSV a second time.

**What happens today:**
- The dedup engine (`dedup.service.ts`) catches this. Match key = `(userId, bankAccountId, date, description, amount, type)`.
- Every row in the second upload matches an existing row in the same `bankAccountId`.
- All duplicates are auto-skipped. No new `Transaction` rows are created. ✅

**How well does it work?**
- **Within-session re-upload:** Fully handled. The confirm step would show zero new transactions.
- **Across-session re-upload:** Also handled — dedup queries existing `Transaction` records in the database, not just the current session.
- **Limitation:** If the bank changes description text between CSV exports (e.g., "WOOLWORTHS" → "WOOLWORTHS METRO #1234" in a later download), the match key differs and the system creates a duplicate. This is an edge case in dedup design, not a transfer-reconciliation problem, but worth noting.

**Verdict:** Same-account dedup is **well-handled** by the existing system. No transfer-reconciliation concern here.

### 2b. Same-Bank, Different-Account Transfer

**Example:** User has ANZ Savings and ANZ Current accounts.

| Account | Description | Amount | Type |
|---------|------------|--------|------|
| ANZ Savings | Transfer to Current Account | -$500 | DEBIT |
| ANZ Current | Transfer from Savings | +$500 | CREDIT |

**What happens today:**
- Savings CSV upload: LLM classifies the -$500 as an expense (e.g., "Transfer" doesn't exist as a debit category — it might be "Miscellaneous" or "Other"). Creates `MonthlyExpenseSummary` entry → **expense inflated by $500**.
- Current CSV upload: LLM classifies the +$500 credit as "Transfer" → saved as `EXCLUDED`. No income inflation. ✅

**Net result:** Expenses over-reported by $500. Income correct. The user's expense report shows they "spent" $500 they didn't actually spend.

**Why dedup doesn't help:** These are NOT duplicates. They are two real, distinct transactions in two different bank accounts. The dedup key includes `bankAccountId`, so they can never match. Both records must exist — the problem is **classification**, not duplication.

### 2c. Cross-Bank Transfer

**Example:** User transfers from CommBank Savings → ANZ Current.

| Account | Description | Amount | Type |
|---------|------------|--------|------|
| CommBank Savings | BPAY to ANZ BSB 012-345 | -$1,000 | DEBIT |
| ANZ Current | DIRECT CREDIT COMMBANK | +$1,000 | CREDIT |

**Additional challenges:**
- Descriptions are completely different (BPAY reference vs. DIRECT CREDIT).
- Dates may differ by 1–3 business days (settlement lag).
- Amounts should match exactly, but fees could cause mismatches.
- No shared reference number across banks.

**This is strictly harder than same-bank transfers** because:
1. No naming convention connects the descriptions.
2. Settlement delay means date-based matching needs a tolerance window.
3. Banks may deduct fees, so $1,000 sent ≠ $1,000 received.
4. The user may not upload both CSVs in the same session, or even the same month.

### 2d. Regular Scheduled Transfers (Salary Split, Bill Account Top-Up)

**Scenario:** Every fortnight, the user's employer pays $3,000 into ANZ Savings. The user has a standing order to transfer $2,500 from Savings → Current on the same day.

**What happens over 6 months (12 pay cycles):**
- 12 × DEBIT $2,500 in ANZ Savings → all classified as expenses → **$30,000 of phantom expenses**
- 12 × CREDIT $2,500 in ANZ Current → hopefully classified as "Transfer" → EXCLUDED

**Why this is particularly damaging:**
- The sheer volume makes manual correction tedious (12 pairs to link per quarter).
- All 12 transfers have identical amounts and similar descriptions → auto-matching produces many candidate pairs, and the system can't distinguish which debit pairs with which credit when dates are even slightly off.
- Monthly expense reports show a consistent $5,000 of fake spending, masking real spending trends.
- Budget tracking is completely useless — user always appears to overspend.

**This scenario is the strongest argument for Phase 2 auto-matching rules**: "Any $2,500 DEBIT in Savings with description matching 'TRANSFER TO CURRENT' should auto-link to the corresponding CREDIT in Current."

### 2e. Impact on Reporting Layers

| Metric | Impact | Severity |
|--------|--------|----------|
| **Net worth** | Unaffected ✅ — $500 leaves one account, enters another | None |
| **Total expenses** | **Inflated** — every inter-account transfer debit is counted as spending | 🔴 Critical |
| **Total income** | Partially mitigated — LLM catches some credits as "Transfer" → EXCLUDED, but unreliable | 🟡 Medium |
| **Category reporting** | **Corrupted** — transfer debits land in random expense categories (Miscellaneous, Other) | 🔴 Critical |
| **Monthly trends** | Misleading spikes when large transfers happen (e.g., $10K savings → offset for mortgage) | 🔴 Critical |
| **Budget tracking** | Users exceed "budgets" due to phantom expenses | 🟡 Medium |
| **Cash flow analysis** | Inter-account transfers appear as both outflow AND inflow, doubling apparent cash movement | 🟡 Medium |

### 2f. Why the Current "EXCLUDED" Strategy Is Necessary but Insufficient

The `EXCLUDED` status was a pragmatic first step. Here's why it's necessary and where it falls short:

**What EXCLUDED gets right:**
- Prevents credit-side transfers from inflating income totals.
- Keeps the transaction in the database for audit trail purposes.
- Simple implementation — no new models or relations needed.

**What EXCLUDED misses:**

1. **Only the credit side is covered.** The LLM classifier has "Transfer" as a credit category but NOT as a debit category. Debit-side transfers are classified as expenses. This is the single biggest source of reporting error.

2. **No linkage between sides.** Two EXCLUDED rows sit in the database with no relationship. The user cannot see that row A in Account X is the counter-entry to row B in Account Y. This makes auditing impossible.

3. **No distinction between transfer types.** "EXCLUDED" lumps together:
   - Inter-account transfers (should be linked pairs)
   - Excluded transactions the user manually dismissed (not transfers at all)
   - Credits the LLM couldn't classify (catch-all exclusion)

4. **No reconciliation state.** There's no way to answer: "Do all my transfers have a matching counter-entry?" An unmatched EXCLUDED row could be: (a) a transfer where the other side hasn't been imported yet, (b) a transfer where the other side was misclassified as an expense, or (c) not actually a transfer at all.

5. **Not self-correcting.** When the user later imports the other account's CSV, nothing triggers a re-evaluation of previously EXCLUDED transactions. The user must manually remember to link them.

**Bottom line:** EXCLUDED solves ~40% of the problem (credit-side income inflation) but leaves ~60% unaddressed (debit-side expense inflation, zero linkage, no audit trail, no reconciliation).

---

## 3. User Stories

### US-1: Exclude debit transfers from expense reporting
> **As a** user who transfers money between my own accounts,  
> **I want** the debit side of inter-account transfers to be excluded from my expense totals,  
> **So that** my expense reports reflect only actual spending.

**Priority:** P0 (Critical)

### US-2: Manually link transfer pairs
> **As a** user reviewing my imported transactions,  
> **I want to** manually link a debit transaction in one account to a matching credit in another account as a "transfer pair",  
> **So that** both sides are excluded from income/expense reporting and my financial picture is accurate.

**Priority:** P0 (Critical)

### US-3: Auto-suggest transfer matches
> **As a** user importing a CSV for a second account,  
> **I want** the system to automatically suggest potential transfer matches against previously imported transactions from other accounts,  
> **So that** I can quickly reconcile transfers without manually searching.

**Priority:** P1 (High)

### US-4: Classify debit-side transfers at import time
> **As a** user uploading a CSV,  
> **I want** the LLM classifier to recognize common transfer descriptions (e.g., "Transfer to Savings", "BPAY to own account") and classify them as "Transfer" rather than an expense category,  
> **So that** transfers are correctly excluded from expense summaries from the start.

**Priority:** P1 (High)

### US-5: Review and manage linked transfers
> **As a** user,  
> **I want to** view all linked transfer pairs, unlink incorrectly matched pairs, and see the net transfer flow between my accounts,  
> **So that** I have full visibility and control over how transfers affect my reports.

**Priority:** P2 (Medium)

### US-6: Handle partial-match and approximate transfers
> **As a** user whose cross-bank transfers have different dates or include small fees,  
> **I want** the matching engine to tolerate date differences of up to 5 business days and flag near-amount matches (within a configurable tolerance, e.g., $0–$5 for fees),  
> **So that** cross-bank transfers with settlement delays or fee deductions are still reconciled.

**Priority:** P2 (Medium)

### US-7: Unmatched transfer alerts
> **As a** financial reviewer,  
> **I want** the system to surface a list of transactions classified as "Transfer" that have no linked counter-entry,  
> **So that** I can investigate whether the other side hasn't been imported yet, was misclassified, or represents a genuine one-sided flow (e.g., external payment to a third party).

**Priority:** P1 (High)

---

## 4. Acceptance Criteria (US-2: Manually Link Transfer Pairs)

```gherkin
Feature: Manual Transfer Pair Linking

  Background:
    Given user "Alice" has two bank accounts:
      | Account           | Bank     |
      | Everyday Savings  | CommBank |
      | Main Current      | ANZ      |
    And the following transactions exist:
      | Account          | Date       | Description              | Amount | Type   | Status    |
      | Everyday Savings | 2024-03-15 | Transfer to ANZ          | 500.00 | DEBIT  | CONFIRMED |
      | Main Current     | 2024-03-16 | DIRECT CREDIT COMMBANK   | 500.00 | CREDIT | EXCLUDED  |

  Scenario: Successfully link two transactions as a transfer pair
    When Alice selects the debit transaction "Transfer to ANZ" ($500)
    And chooses "Link as Transfer" from the action menu
    Then the system shows candidate matches from other accounts:
      | Account      | Date       | Description            | Amount | Score |
      | Main Current | 2024-03-16 | DIRECT CREDIT COMMBANK | 500.00 | 95%   |
    When Alice confirms the match with "DIRECT CREDIT COMMBANK"
    Then both transactions are updated:
      | Transaction              | Status   | Category | LinkedTo                 |
      | Transfer to ANZ          | EXCLUDED | Transfer | DIRECT CREDIT COMMBANK   |
      | DIRECT CREDIT COMMBANK   | EXCLUDED | Transfer | Transfer to ANZ          |
    And MonthlyExpenseSummary for March 2024 is decremented by $500 for the original category
    And no IncomeRecord exists for the credit transaction

  Scenario: Linking a debit reverses its expense rollup
    Given the debit "Transfer to ANZ" was originally classified as "Miscellaneous"
    And MonthlyExpenseSummary for "Miscellaneous" in March 2024 includes $500
    When Alice links it as a transfer pair
    Then MonthlyExpenseSummary for "Miscellaneous" in March 2024 is decremented by $500

  Scenario: Unlinking a transfer pair restores original classification
    Given "Transfer to ANZ" and "DIRECT CREDIT COMMBANK" are linked as a transfer pair
    When Alice unlinks the pair
    Then both transactions revert to their pre-link status and category
    And MonthlyExpenseSummary is re-incremented for the original debit category

  Scenario: Cannot link transactions from the same account
    When Alice tries to link two transactions from "Everyday Savings"
    Then the system rejects the link with message "Transfer pairs must be from different accounts"

  Scenario: Cannot link two debits or two credits
    When Alice tries to link two DEBIT transactions from different accounts
    Then the system rejects the link with message "Transfer pair must have one DEBIT and one CREDIT"

  Scenario: Amount mismatch warning
    Given a debit of $500 and a credit of $497 (with $3 fee)
    When Alice attempts to link them
    Then the system shows a warning: "Amounts differ by $3.00. This may indicate a transfer fee."
    And Alice can confirm or cancel the link
```

---

## 5. Edge Cases & Gotchas

### Timing & Settlement
| Edge Case | Detail |
|-----------|--------|
| **Same-day same-bank** | Both sides post on same date. Easiest to match. |
| **Cross-bank 1–3 day lag** | BPAY, OSKO, direct debit settlement. Need date tolerance window. |
| **Weekend/holiday rollover** | Friday debit → Monday credit. 3-calendar-day gap = 1 business day. |
| **Month boundary** | Debit on March 31, credit on April 1. Affects different MonthlyExpenseSummary months. |

### Description Matching
| Edge Case | Detail |
|-----------|--------|
| **Completely different descriptions** | "Transfer to Savings" vs "INT XFER" vs "DIRECT CREDIT" — no common substring |
| **Truncated descriptions** | Some banks truncate at 30 chars; others at 100 |
| **Multiple transfers same day, same amount** | Two $200 transfers on the same day (e.g., rent + utilities via separate BPAYs). Can't auto-match without user input. |
| **Recurring scheduled transfers** | Same amount every week/fortnight. Many candidates to match against. |

### Amount Issues
| Edge Case | Detail |
|-----------|--------|
| **Exact match** | Most common. Easy. |
| **Transfer with fee** | $1,000 sent, $997 received (cross-bank fee). Need tolerance. |
| **Split transfer** | $1,000 from savings → $600 to current + $400 to mortgage. One debit, two credits. |
| **Foreign currency** | AUD to USD transfer — amounts differ due to FX rate. Out of scope for MVP. |
| **Round-number vs. exact** | "Transfer $500" but bank records $500.00 vs $500.01 (rounding). |

### Data Integrity
| Edge Case | Detail |
|-----------|--------|
| **Only one side imported** | User uploads Savings CSV but not Current CSV (yet). Debit has no matching credit. Must handle gracefully — mark as "potential transfer, unmatched." |
| **Retroactive import** | User imports Current account CSV months later. Need to scan for unmatched transfers in previously imported accounts. |
| **Re-import after linking** | User re-imports a CSV that contains already-linked transactions. Dedup must preserve links. |
| **Voided/reversed transfer** | Bank reverses a transfer (shows as credit in sending account). Creates 4 transactions total. |
| **Credit card payments** | "Payment from Savings" appears as credit on credit card statement, debit on savings. Is this a transfer? Yes, but credit cards aren't modeled yet. |

### Classification
| Edge Case | Detail |
|-----------|--------|
| **LLM misclassification** | LLM classifies a genuine expense as "Transfer" (false positive) or a transfer as "Groceries" (false negative). Need user override. |
| **Reimbursement vs. Transfer** | "Refund from Jim" ($50) looks like a transfer but is actually a reimbursement. The user must decide. |
| **Salary split** | Employer deposits $3,000 to savings, user transfers $2,500 to current. The transfer is separate from income — must not double-count. |

---

## 6. Recommended Approach

### Strategy: **Rule-Based Matching + Manual Linking + LLM-Assisted Classification**

#### Phase 1: Foundation (MVP)

**A. Add "Transfer" as a debit classification category**
- Add `Transfer` to the LLM's debit classifier prompt alongside existing expense categories.
- When a debit is classified as "Transfer", save it as `EXCLUDED` (same as credit-side transfers today).
- Do NOT create a `MonthlyExpenseSummary` entry.
- This alone fixes the biggest pain point: inflated expenses.

**B. Schema changes**
```
// Add to Transaction model:
transferLinkedTransactionId  String?   @unique
transferLinkedTransaction    Transaction? @relation("TransferLink", fields: [transferLinkedTransactionId], references: [id])
transferCounterpart          Transaction? @relation("TransferLink")
```
This self-referential 1:1 relation mirrors the existing `ReimbursementLink` pattern.

**C. Manual linking UI**
- On the transactions list, add a "Link as Transfer" action for any DEBIT or unmatched CREDIT.
- Show candidate matches from OTHER accounts: same user, opposite type, amount within tolerance, date within ±5 days.
- On confirmation: set both to `status: EXCLUDED`, `category: Transfer`, populate the link relation.
- Reverse the expense rollup (use existing `rerollupExpenseSummary` pattern from `ledger.service.ts`).

**D. Auto-suggestion at confirm time**
- When confirming a CSV import, scan for unmatched transactions in other accounts.
- Score candidates: exact amount match (high), date proximity (medium), description keyword overlap (low).
- Present top candidates in the review step before confirm.

#### Phase 2: Automation (Post-MVP)

**E. Rule-based auto-matching engine**
- Confidence scoring: `amount_match (40%) + date_proximity (30%) + description_similarity (20%) + same_bank_bonus (10%)`.
- Auto-link at >95% confidence. Suggest at >70%. Ignore below.
- User-defined rules: "Any transfer between my ANZ Savings and ANZ Current with matching amounts should auto-link."

**F. Transfer pattern learning**
- Track confirmed transfer pairs to learn description patterns per user.
- Use `MerchantCategoryMap` or a new `TransferPatternMap` table to remember that "TRANSFER TO CURRENT" in ANZ Savings always pairs with "INT XFER" in ANZ Current.

### Rationale

| Factor | Decision | Why |
|--------|----------|-----|
| Same-bank vs. cross-bank | Treat identically at data model level; scoring favors same-bank | Simpler schema, consistent UX |
| User effort | Manual linking as primary; auto-suggest as assist | Avoids false-positive auto-links destroying data |
| False positives | Never auto-link without user confirmation in MVP | Financial data accuracy is paramount |
| Schema pattern | Follow existing `ReimbursementLink` self-relation | Proven pattern, minimal migration risk |
| Expense rollup fix | Use existing `rerollupExpenseSummary` | No new infrastructure needed |

---

## 7. Data Model Requirements

### 7.1 New Fields on `Transaction` Model

```prisma
model Transaction {
  // ... existing fields ...

  // Transfer reconciliation
  transferLinkedTransactionId  String?       @unique
  transferLinkedTransaction    Transaction?  @relation("TransferLink", fields: [transferLinkedTransactionId], references: [id])
  transferCounterpart          Transaction?  @relation("TransferLink")

  // Pre-link state (for unlink/revert)
  preLinkCategory              String?       // Original category before transfer linking
  preLinkStatus                TransactionStatusEnum?  // Original status before transfer linking
}
```

**Design rationale:**
- Self-referential 1:1 relation mirrors the existing `offsetTransaction` (reimbursement) pattern in the schema. Consistent, proven approach.
- `@unique` on `transferLinkedTransactionId` enforces that each transaction can be part of at most one transfer pair.
- `preLinkCategory` and `preLinkStatus` store the original classification so unlinking can fully revert without guessing.

### 7.2 New `TransferMatchCandidate` View (Not a Table)

For the matching UI, we don't need a persistent table. Instead, a tRPC procedure computes candidates on-demand:

```typescript
// Candidate scoring result (not persisted)
interface TransferMatchCandidate {
  transactionId: string;
  bankAccountId: string;
  bankAccountName: string;
  date: Date;
  description: string;
  amount: Decimal;
  type: TransactionType;
  confidenceScore: number;       // 0–100
  scoreBreakdown: {
    amountMatch: number;         // 0–40
    dateProximity: number;       // 0–30
    descriptionSimilarity: number; // 0–20
    sameBankBonus: number;       // 0–10
  };
}
```

### 7.3 New tRPC Procedures

| Procedure | Type | Purpose |
|-----------|------|---------|
| `transfer.getCandidates` | Query | Given a transaction ID, return scored match candidates from other accounts |
| `transfer.link` | Mutation | Link two transactions as a transfer pair; update statuses, categories, and rollup |
| `transfer.unlink` | Mutation | Unlink a transfer pair; revert to pre-link state; re-rollup |
| `transfer.getUnmatched` | Query | Return all EXCLUDED/Transfer transactions with no `transferLinkedTransactionId` |
| `transfer.getPairs` | Query | Paginated list of all linked transfer pairs with account details |

### 7.4 LLM Classifier Changes

Add `"Transfer"` to the **debit** classification categories in the LLM prompt. Currently only credits have "Transfer" as a category option. The debit classifier prompt needs:

```
Categories: Groceries, Utilities, Entertainment, ..., Transfer
```

When a debit is classified as "Transfer":
- `status` = `EXCLUDED`
- `category` = `"Transfer"`
- Do NOT create/upsert `MonthlyExpenseSummary`

### 7.5 Impact on Existing Models

**`MonthlyExpenseSummary`:**
- When a CONFIRMED debit is linked as a transfer, decrement the summary for the original category/month.
- Use the existing rollup recalculation pattern (recompute from confirmed, non-excluded transactions).
- Edge case: if the decrement reduces a category total to $0, keep the row (don't delete — it proves the category existed that month).

**`IncomeRecord`:**
- If a CONFIRMED credit with an existing `IncomeRecord` is later linked as a transfer, the `IncomeRecord` must be deleted.
- This should be rare (LLM already classifies most transfer credits as "Transfer" → EXCLUDED, so no `IncomeRecord` exists).
- Guard: the `transfer.link` mutation must check for and delete any orphaned `IncomeRecord`.

### 7.6 Migration Safety

- `transferLinkedTransactionId` is nullable → non-breaking `ALTER TABLE ADD COLUMN`.
- `preLinkCategory` and `preLinkStatus` are nullable → non-breaking.
- No data migration needed — existing transactions have no transfer links.
- The self-referential FK constraint requires both transactions to exist before linking → no orphan risk.

---

## 8. Out of Scope (for MVP)

| Item | Reason |
|------|--------|
| **Foreign currency transfers** | Requires FX rate handling; very few users need this initially |
| **Credit card payment reconciliation** | Credit cards aren't modeled as `BankAccount` yet |
| **Automatic scheduled transfer detection** | Requires recurring transaction detection engine (separate feature) |
| **ML-based description matching** | Rule-based + LLM classification is sufficient for MVP |
| **Split transfer matching** (1 debit → N credits) | Complex UI, rare scenario. Users can manually handle. |
| **Bank feed / Open Banking integration** | Real-time feeds would eliminate CSV-based reconciliation entirely, but requires API partnerships |
| **Bulk auto-reconciliation of historical data** | Users can link retrospectively but no "reconcile all" button in v1 |
| **Transfer analytics dashboard** | (e.g., "you transfer $2,000/month between accounts") — nice-to-have, not MVP |
| **Multi-currency tolerance matching** | AUD→USD transfers with FX rate differences |
| **Voided/reversed transfer handling** | 4-way matching (original pair + reversal pair) is complex |

---

## 9. Success Metrics

| # | Metric | Target | How to Measure |
|---|--------|--------|----------------|
| 1 | **Transfer expense leakage rate** | <2% of all transfer debits appear in expense totals | `COUNT(transactions WHERE category='Transfer' AND status='CONFIRMED') / COUNT(transactions WHERE category='Transfer')` — should approach 0 |
| 2 | **Transfer pair linkage rate** | >80% of EXCLUDED transfer transactions are linked to a counter-entry within 30 days of import | `COUNT(EXCLUDED transfers with transferLinkedTransactionId NOT NULL) / COUNT(EXCLUDED transfers)` |
| 3 | **Manual linking effort** | Average <3 clicks to link a transfer pair | UX instrumentation: measure clicks from "Link as Transfer" → confirmed link |
| 4 | **False positive rate for auto-suggestions** | <10% of suggested candidates are rejected by users | `COUNT(suggested but rejected) / COUNT(suggested)` — tracked via a `suggestionAccepted` flag on the confirm action |
| 5 | **Unmatched transfer backlog** | <20% of transfer-classified transactions remain unmatched after all accounts are imported for a given month | Measured via `transfer.getUnmatched` query, scoped to users who have imported ≥2 accounts |
| 6 | **Expense report accuracy improvement** | Users who link transfers report ≥15% lower total expenses vs. pre-feature baseline | Compare `MonthlyExpenseSummary` totals before and after transfer linking for the same months (A/B or before/after per user) |

### How to Track

- Metrics 1, 2, 5 are database queries — can be run as admin reports or exposed in a future analytics dashboard.
- Metric 3 requires frontend event tracking (e.g., PostHog, Mixpanel, or a simple `transferLinkEvents` table).
- Metric 4 requires logging suggestion-vs-confirmation on the tRPC `transfer.link` mutation.
- Metric 6 requires snapshotting pre-feature expense totals or comparing users with/without the feature enabled.

### North Star

> **A user who imports all their bank accounts for a given month should see expense and income totals that match their actual spending and earning — not inflated by inter-account movements.**

This is qualitative, but metrics 1 and 6 are its quantitative proxies.

# Brokerage Account Model: High-Level Design

## Document Info

- **Version**: 1.0
- **Date**: 2026-05-19
- **Status**: Draft
- **Parent Spec**: `spec/asset-stocks-tracking/hld.md`
- **Motivation**: `StockHolding.accountId` currently points to `Business` (the institution). A user with two Fidelity accounts (IRA + Individual) cannot distinguish them. This aligns the model with industry-standard 3-tier design.

---

## Problem Statement

The current model is **2-tier**:

```
Business (type=BROKERAGE)  ←──  StockHolding.accountId
```

Users who hold accounts at the same brokerage (e.g., Fidelity IRA + Fidelity Individual Brokerage) have no way to distinguish holdings between sub-accounts. Every major personal finance app (Mint, Empower, Monarch Money, YNAB) treats accounts as first-class citizens under an institution.

### Industry Standard

```
Institution (Fidelity)
  └─ Account: Fidelity Roth IRA
  └─ Account: Fidelity Individual Brokerage
       └─ Holding: MSFT × 10
       └─ Holding: VAS × 50
```

---

## Proposed Solution

Two coordinated changes:

1. **Rename `BankAccount` → `FinancialAccount`** across the entire schema — making it a true generic sub-account model for any financial institution, not just banks.
2. **Move `StockHolding.accountId`** to reference `FinancialAccount` instead of `Business`.

`FinancialAccount` (renamed from `BankAccount`) is already a child of `Business`. Renaming establishes the correct domain language: it is a sub-account under *any* financial institution. `FinancialAccount.institutionId` is the FK to the `Business` institution. `Business.type` (BANK | BROKERAGE) remains the reporting discriminator — you can filter "banks only", "brokerages only", or "all" at query time without any model changes.

### Target Model (3-tier)

```
Business (type=BROKERAGE)        ←  institution (e.g., "Fidelity")
  └─ FinancialAccount             ←  sub-account (e.g., "Roth IRA")
       └─ StockHolding.accountId

Business (type=BANK)             ←  institution (e.g., "CommBank")
  └─ FinancialAccount             ←  sub-account (e.g., "NetSaver")
       └─ BankBalanceSnapshot (unchanged)
```

### What Changes

| Layer | Before | After |
|---|---|---|
| Model name | `BankAccount` | **`FinancialAccount`** |
| FK field | `bankId` | `institutionId` |
| Relation on model | `bank` | `institution` |
| Relation on Business/User | `bankAccounts` | `financialAccounts` |
| DB schema | `StockHolding.accountId → Business` | `StockHolding.accountId → FinancialAccount` |
| Service verification | Verify `Business.type=BROKERAGE` | Verify `FinancialAccount.institution.type=BROKERAGE` |
| tRPC queries | `getBusinessesByType(BROKERAGE)` | `getBrokerageAccounts()` (returns `FinancialAccount[]` with parent `Business`) |
| New tRPC mutation | — | `createBrokerageSubAccount(businessId, name)` |
| Types | `account: Pick<Business, 'id'\|'name'>` | `account: Pick<FinancialAccount, 'id'\|'name'> & { institution: Pick<Business, 'id'\|'name'> }` |
| UI | Single `CreatableAppSelect` (institution) | Two dependent selects: institution → sub-account |
| Display labels | "Fidelity" | "Fidelity — Roth IRA" |

---

## Data Model

### Updated Entity Relationships

```
User (1)
  ├─ Business (type=BANK) (*)           ← bank institution
  │   └─ FinancialAccount (*)           ← bank sub-account (renamed from BankAccount)
  │        └─ BankBalanceSnapshot (*)   ← unchanged
  │
  ├─ Business (type=BROKERAGE) (*)      ← brokerage institution
  │   └─ FinancialAccount (*)           ← brokerage sub-account (NEW FK target for stocks)
  │        └─ StockHolding (*)
  │
  └─ PortfolioSnapshot (*)
       └─ StockHolding (*)
            └─ accountId → FinancialAccount.id  (WAS: Business.id)
```

`Business.type` is the reporting discriminator — filter `institution.type = BANK` or `BROKERAGE` at query time. The `FinancialAccount` model itself is type-agnostic, enabling cross-institution reporting (e.g., net worth across all institutions).

### Schema Rename Scope

This feature includes a **schema-wide rename** of `BankAccount` → `FinancialAccount`. All files that currently reference `BankAccount`, `bankId`, `bankAccounts`, or the `bank` relation (on `FinancialAccount`) must be updated.

| Before | After |
|---|---|
| `model BankAccount` | `model FinancialAccount` |
| `BankAccount.bankId` | `FinancialAccount.institutionId` |
| `BankAccount.bank` (relation to Business) | `FinancialAccount.institution` |
| `Business.bankAccounts` | `Business.financialAccounts` |
| `User.bankAccounts` | `User.financialAccounts` |
| Prisma table `"BankAccount"` | Prisma table `"FinancialAccount"` |

Affected feature areas beyond stocks: **bank accounts, bank balance snapshots, transfer match rules, transactions**.

### Migration Safety

- Renaming `BankAccount` → `FinancialAccount` renames the underlying PostgreSQL table. Prisma generates `ALTER TABLE "BankAccount" RENAME TO "FinancialAccount"` automatically — review the generated SQL before applying.
- `StockHolding.accountId` FK target changes from `Business` to `FinancialAccount` in a separate migration (Phase 1, after Phase 0 rename).
- **If no prod stock data**: Apply both migrations sequentially.
- **If prod stock data exists**: Create a `FinancialAccount` per existing `Business/BROKERAGE` (named "Default Account"), backfill `StockHolding.accountId`, then apply the FK constraint change.

> **Recommendation**: Implement before any prod stock data is entered. Verify with a count query first.

---

## UI Design

### Account Selection UX (Two-Level Dependent Select)

Instead of one flat `CreatableAppSelect`, the form shows two stacked selects:

1. **Institution** (`CreatableAppSelect`): Select or create a `Business/BROKERAGE` (e.g., "Fidelity")
2. **Account** (`CreatableAppSelect`): Filtered by selected institution; select or create a `BankAccount` under it (e.g., "Roth IRA")

**Interaction flow:**
- User selects/creates institution → account dropdown populates with sub-accounts for that institution
- User selects/creates an account → `accountId` (BankAccount) is captured in the form
- If institution changes → account field resets

**Display in UI (accordions, tables):**
- Accordion group header: `"Fidelity — Roth IRA"` (institution + account name)
- Holdings table: Account column shows `"Fidelity — Roth IRA"`

---

## Out of Scope

- Renaming or removing `BankAccount` (it continues to serve bank sub-accounts unchanged)
- Migrating transactions or transfer rules linked to `BankAccount` (unaffected)
- Adding account type (IRA, Individual, SMSF) to `BankAccount` — future enhancement
- Multi-currency at account level — remains at holding level

---

## Open Questions

None — model is unambiguous.

---

## Future Enhancements

1. **Account Type**: Add `accountType` enum to `BankAccount` (IRA, Individual, SMSF, 401k) for display/filter
2. **Institution Logo**: Add institution logo/icon for richer display
3. **Account Balance Summary**: Separate account-level totals page per institution

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

Move `StockHolding.accountId` to reference `BankAccount` instead of `Business`.

`BankAccount` already exists in the schema as a child of `Business`, used for bank sub-accounts. The same structure works for brokerage sub-accounts — `BankAccount.bankId` is the foreign key to the `Business` institution.

### Target Model (3-tier)

```
Business (type=BROKERAGE)     ←  institution (e.g., "Fidelity")
  └─ BankAccount               ←  sub-account (e.g., "Roth IRA")
       └─ StockHolding.accountId
```

### What Changes

| Layer | Before | After |
|---|---|---|
| DB schema | `StockHolding.accountId → Business` | `StockHolding.accountId → BankAccount` |
| Service verification | Verify `Business.type=BROKERAGE` | Verify `BankAccount.bank.type=BROKERAGE` |
| tRPC queries | `getBusinessesByType(BROKERAGE)` | `getBrokerageAccounts()` (returns `BankAccount[]` with parent `Business`) |
| New tRPC mutation | — | `createBrokerageSubAccount(businessId, name)` |
| Types | `account: Pick<Business, 'id'\|'name'>` | `account: Pick<BankAccount, 'id'\|'name'> & { bank: Pick<Business, 'id'\|'name'> }` |
| UI | Single `CreatableAppSelect` (institution) | Two dependent selects: institution → sub-account |
| Display labels | "Fidelity" | "Fidelity — Roth IRA" |

---

## Data Model

### Updated Entity Relationships

```
User (1)
  ├─ Business (type=BROKERAGE) (*)   ← institution
  │   └─ BankAccount (*)             ← sub-account (NEW FK target)
  │        └─ StockHolding (*)
  │
  └─ PortfolioSnapshot (*)
       └─ StockHolding (*)
            └─ accountId → BankAccount.id  (WAS: Business.id)
```

### Migration Safety

- `StockHolding` has a FK on `accountId`. Changing the target from `Business` to `BankAccount` requires a Prisma migration.
- **If no prod data**: Drop + recreate FK constraint directly.
- **If prod data exists**: Create a `BankAccount` per existing `Business/BROKERAGE` (named "Default Account"), then update all `StockHolding.accountId` to the new `BankAccount.id`.

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

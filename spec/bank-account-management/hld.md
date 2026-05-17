# Bank Account Management — High Level Design

## Problem Statement

New users cannot use CSV import because the upload step requires selecting a `BankAccount` record, yet there is no UI to create one. The `/settings/banks` page only manages bank institutions (`Business` model). Individual bank accounts (`BankAccount` model) — the specific account a user holds at that bank — are orphaned with no management surface.

The fix adds a "Your Bank Accounts" section to `/settings/banks`, letting users create and delete their `BankAccount` records. No schema changes are needed; the model and table already exist.

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| AD1 | UI location | Second card on `/settings/banks` page | Natural pairing — you set up the institution, then add your accounts at it. Single settings destination. |
| AD2 | Component structure | New `BankAccountsSection` Client Component | Keeps `BanksForm` (institution CRUD) isolated; clean separation of concerns |
| AD3 | Create form pattern | Inline form in the same card (no modal) | Accounts are simple (name + bank selection); modal overhead not justified |
| AD4 | Bank dropdown source | Reuse `trpc.bank.getAllBanks` | Already available; avoids duplicate tRPC procedure |
| AD5 | Delete safety | `ConfirmationDialog` with transaction count warning | `BankAccount` has child `Transaction[]` — user must understand impact |
| AD6 | No edit | Create + delete only (no rename) | Renaming an account that already has transactions is confusing; delete + recreate is safer |
| AD7 | Auth scoping | `userId` from server session only | Never trust client-passed userId per project auth rules |

---

## Data Model Changes

None. `BankAccount` model already exists:

```prisma
model BankAccount {
  id      String   @id @default(cuid())
  name    String               // "CBA Everyday Savings"
  bankId  String               // FK → Business (type=BANK)
  userId  String               // scoped to user
  @@unique([name, bankId, userId])
}
```

---

## Component / Service Changes

| Layer | File | Change |
|---|---|---|
| **Schema** | `src/server/schema/bank-account.schema.ts` | NEW: `createBankAccountSchema` (name + bankId), `deleteBankAccountSchema` (id) |
| **Service** | `src/server/services/bank-account.service.ts` | NEW: `createBankAccount`, `getBankAccounts`, `deleteBankAccount` |
| **Controller** | `src/server/controllers/bank-account.controller.ts` | NEW: handlers with error wrapping |
| **tRPC** | `src/server/trpc/router/bank-account.ts` | NEW: `list`, `create`, `delete` procedures |
| **tRPC root** | `src/server/trpc/root.ts` | Register `bankAccountRouter` as `bankAccount` |
| **UI** | `src/app/(authorized)/settings/banks/_components/BankAccountsSection.tsx` | NEW: table + inline create form |
| **UI** | `src/app/(authorized)/settings/banks/form.tsx` | Add `<BankAccountsSection />` below existing card |

---

## Success Criteria

- [ ] User can create a `BankAccount` by selecting a bank institution and entering an account name
- [ ] Existing accounts are listed in a table with delete action
- [ ] Delete shows a confirmation dialog; if account has transactions, warns user
- [ ] Duplicate account name at the same bank shows a toast error (unique constraint)
- [ ] If no bank institutions exist yet, the create form shows "Add a bank above first"
- [ ] After creating a bank account, the CSV import dropdown at `/cashflow/transactions` shows the new account
- [ ] `pnpm run build` passes with no TypeScript errors

---

## Out of Scope

| Item | Reason |
|---|---|
| Edit / rename bank account | Risk of confusion with existing transaction records |
| Account number / BSB fields | Not in current schema; separate feature if needed |
| Default account selection | Could be added to profile preferences later |
| Bulk import of accounts | Not needed for MVP |
| Bank institution edit | Separate existing spec (`spec/entity-relations/bank-details-update-functionality.md`) |

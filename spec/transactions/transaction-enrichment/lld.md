# Transaction Enrichment Pipeline — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1** | `prisma/schema.prisma`, migration | Schema: `ZakatPayment` FKs + `CalendarYear` day precision |
| **2** | `calendar-boundary.service.ts`, `zakat-link.service.ts`, `donation-zakat-link.service.ts` | New services |
| **3** | `transaction-ledger.ts`, `TransactionRow.tsx` | Ledger badge for Zakat-linked rows |
| **4** | `zakat/page.tsx`, `UnlinkedZakatBanner.tsx`, `LinkZakatDrawer.tsx` | Zakat page enrichment UI |
| **5** | `donations/actions.ts` | "Count toward Zakat?" toggle on Donations page |
| **6** | `settings/calendar/` | `fromDay`/`toDay` inputs for ZAKAT years |

---

## Phase 1 — Schema Changes

### `prisma/schema.prisma`

```prisma
// CalendarYear — add day precision (non-breaking additive)
model CalendarYear {
  // ... existing fields unchanged ...
  fromDay  Int?   // null = 1st of fromMonth (FISCAL/ANNUAL default)
  toDay    Int?   // null = last day of toMonth (FISCAL/ANNUAL default)
}

// ZakatPayment — two enrichment FK paths
model ZakatPayment {
  // ... existing fields unchanged ...
  transactionId     String?          @unique
  transaction       Transaction?     @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  donationPaymentId String?          @unique
  donationPayment   DonationPayment? @relation(fields: [donationPaymentId], references: [id], onDelete: SetNull)
  // Invariant: transactionId and donationPaymentId are mutually exclusive — enforced at app layer
}

// DonationPayment — add back-reference
model DonationPayment {
  // ... existing fields ...
  zakatPayment  ZakatPayment?
}

// Transaction — add Zakat back-reference (direct path)
model Transaction {
  // ... existing fields unchanged ...
  zakatPayment  ZakatPayment?  // NEW (direct path when no DonationPayment)
}
```

Migration: all changes are additive nullable columns. `onDelete: SetNull` on both ZakatPayment FKs.

---

## Phase 2 — Services

### `src/server/services/calendar-boundary.service.ts`

```typescript
export function getCalendarDateRange(year: CalendarYear): { fromDate: Date; toDate: Date } {
  const fromDay = year.fromDay ?? 1;
  const toDay   = year.toDay   ?? lastDayOfMonth(year.toYear, year.toMonth);
  return {
    fromDate: new Date(year.fromYear, year.fromMonth - 1, fromDay),
    toDate:   new Date(year.toYear,   year.toMonth - 1,   toDay, 23, 59, 59),
  };
}

export function validateTransactionDate(
  txDate: Date,
  year: CalendarYear,
  yearType: 'FISCAL' | 'ZAKAT',
): { valid: boolean; warning?: string } {
  const { fromDate, toDate } = getCalendarDateRange(year);
  const inRange = txDate >= fromDate && txDate <= toDate;
  if (yearType === 'FISCAL') {
    return { valid: inRange }; // hard validation
  }
  // ZAKAT: soft warning
  return { valid: true, warning: inRange ? undefined : 'Transaction date is outside the selected Zakat year bounds' };
}
```

### `src/server/services/zakat-link.service.ts`

```typescript
export async function getUnlinkedZakatTransactions(userId: string, zakatYearId: string) {
  const year = await prisma.calendarYear.findUnique({ where: { id: zakatYearId } });
  const { fromDate, toDate } = getCalendarDateRange(year!);
  return prisma.transaction.findMany({
    where: {
      userId,
      type:     'DEBIT',
      status:   'CONFIRMED',
      category: 'Gifts & donations',
      date:     { gte: fromDate, lte: toDate },
      zakatPayment: null,
    },
  });
}

export async function countUnlinkedZakatTransactions(userId: string, zakatYearId: string) {
  // same WHERE, returns count
}
```

---

## Phase 3 — Ledger Badge

In `src/server/api/routers/transaction-ledger.ts`, `getAll` query:

```typescript
// Add to include:
zakatPayment: { select: { id: true } },
donationPayment: {
  select: { id: true, zakatPayment: { select: { id: true } } },
},

// Add to output mapping:
isZakatLinked: Boolean(
  tx.zakatPayment ?? tx.donationPayment?.zakatPayment
),
```

In `TransactionRow.tsx`:
```tsx
{transaction.isZakatLinked && (
  <span title="Linked to Zakat payment">🕌</span>
)}
```

---

## Phase 4 — Zakat Page Banners

**`UnlinkedZakatBanner.tsx`** (Server Component):
```typescript
const count = await countUnlinkedZakatTransactions(userId, selectedZakatYearId);
// Renders: "N 'Gifts & donations' transactions are not yet linked to a Zakat payment"
```

**`LinkZakatDrawer.tsx`** (Client Component):
- Lists unlinked transactions
- On confirm: calls `zakat/actions.ts` `addRow({ transactionId })`

---

## Phase 5 — Zakat Actions Mutation Exclusion

**`src/app/(authorized)/zakat/actions.ts`**:
```typescript
if (input.transactionId && input.donationPaymentId) {
  throw new Error('A ZakatPayment cannot have both transactionId and donationPaymentId');
}
// If a DonationPayment exists for the given transactionId, suggest the donationPaymentId path
```

---

## Success Criteria

| # | Criterion | Verifiable by |
|---|---|---|
| 1 | Confirmed "Gifts & donations" DEBIT can be linked to a `ZakatPayment` | DB: `ZakatPayment.transactionId IS NOT NULL` |
| 2 | Transaction can have both `DonationPayment` (FISCAL) and `ZakatPayment` (ZAKAT) | DB: both FKs same Transaction |
| 3 | Deleting a Transaction sets `ZakatPayment.transactionId = NULL` | Integration test |
| 4 | Zakat page shows banner count of unlinked "Gifts & donations" for selected Zakat year | UI + service test |
| 5 | A FISCAL calendar year with `fromDay = null` resolves to the 1st of its `fromMonth` | Service unit test |
| 6 | Creating `ZakatPayment` with both `transactionId` and `donationPaymentId` is rejected | Validation test |
| 7 | Manual Zakat payments (no transaction) continue to work | Existing test regression |

---

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | `ZakatPayment` FK fields; `CalendarYear.fromDay/toDay`; back-references |
| `src/server/services/calendar-boundary.service.ts` | CREATE | `getCalendarDateRange`, `validateTransactionDate` |
| `src/server/services/zakat-link.service.ts` | CREATE | `getUnlinkedZakatTransactions`, `countUnlinkedZakatTransactions` |
| `src/server/services/donation-zakat-link.service.ts` | CREATE | `getUnlinkedDonationPaymentsForZakat`, `countUnlinkedDonationPaymentsForZakat` |
| `src/server/api/routers/transaction-ledger.ts` | MODIFY | `isZakatLinked` in `getAll` output |
| `src/components/transactions/TransactionRow.tsx` | MODIFY | Render 🕌 badge when `isZakatLinked` |
| `src/app/(authorized)/zakat/_components/UnlinkedZakatBanner.tsx` | CREATE | Server Component banner |
| `src/app/(authorized)/zakat/_components/LinkZakatDrawerTrigger.tsx` | CREATE | Client trigger |
| `src/app/(authorized)/zakat/_components/LinkZakatDrawer.tsx` | CREATE | Enrichment slide-over |
| `src/app/(authorized)/zakat/page.tsx` | MODIFY | Inject `<UnlinkedZakatBanner>` |
| `src/app/(authorized)/zakat/actions.ts` | MODIFY | Accept `transactionId?`, `donationPaymentId?`; mutual exclusion |
| `src/app/(authorized)/settings/calendar/` | MODIFY | Expose `fromDay`/`toDay` inputs for ZAKAT years |

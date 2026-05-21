# Preferred Currency — Low-Level Design

## Database Schema

```prisma
enum CurrencyCode {
  AUD
  USD
  EUR
  GBP
  JPY
  // Add more as needed
}

model User {
  // ... other fields
  preferredCurrency CurrencyCode @default(AUD)
}

model Transaction {
  // ... other fields
  amount Decimal @db.Decimal(19, 4)
  currency CurrencyCode @default(AUD)
  
  // Optional: amount in user's preferred currency (cached)
  amountInPreferred Decimal? @db.Decimal(19, 4)
  
  @@index([currency])
  @@index([userId])
}

model ExchangeRate {
  id String @id @default(cuid())
  fromCurrency CurrencyCode
  toCurrency CurrencyCode
  rate Decimal @db.Decimal(19, 8)
  date DateTime @db.Date // Daily rates
  source String // e.g., "openexchangerates.org"
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([fromCurrency, toCurrency, date])
  @@index([date])
}
```

## Conversion Logic

### Get Current Exchange Rate

```typescript
export async function getExchangeRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<Decimal> {
  if (fromCurrency === toCurrency) return new Decimal(1);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const rate = await prisma.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency_date: {
        fromCurrency,
        toCurrency,
        date: new Date(today),
      },
    },
  });

  if (!rate) {
    // Fetch from external API if not in cache
    return await fetchAndCacheExchangeRate(fromCurrency, toCurrency);
  }

  return rate.rate;
}
```

### Convert Amount

```typescript
export async function convertAmount(
  amount: Decimal,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<Decimal> {
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return amount.times(rate);
}
```

### Display Currency Value

```typescript
export function formatCurrency(
  amount: Decimal,
  currency: CurrencyCode,
  locale: string = 'en-AU'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount.toNumber());
}
```

## User Preference Handling

### Per-Page Currency Display

```typescript
// Server Component
export default async function TransactionsPage({ userId }) {
  const user = await getUser(userId);
  const transactions = await getTransactions(userId);

  // Convert all transactions to user's preferred currency
  const displayTransactions = await Promise.all(
    transactions.map(async (tx) => ({
      ...tx,
      displayAmount: await convertAmount(
        tx.amount,
        tx.currency,
        user.preferredCurrency
      ),
    }))
  );

  return <TransactionsList transactions={displayTransactions} />;
}
```

### Client Component Display

```typescript
// Client Component
export function TransactionRow({ transaction, currency }) {
  return (
    <tr>
      <td>{transaction.date}</td>
      <td>{transaction.description}</td>
      <td>{formatCurrency(transaction.displayAmount, currency)}</td>
      {/* Show original currency as note if different */}
      {transaction.currency !== currency && (
        <td className="text-sm text-muted-foreground">
          ({formatCurrency(transaction.amount, transaction.currency)})
        </td>
      )}
    </tr>
  );
}
```

## Exchange Rate Updates

### Daily Refresh (Background Job)

```typescript
// src/server/jobs/refresh-exchange-rates.ts
export async function refreshExchangeRates() {
  const baseCurrencies = ['AUD', 'USD', 'EUR', 'GBP'];
  const targetCurrencies = ['AUD', 'USD', 'EUR', 'GBP', 'JPY'];

  for (const base of baseCurrencies) {
    for (const target of targetCurrencies) {
      if (base === target) continue;
      
      const rate = await fetchExchangeRate(base, target);
      await prisma.exchangeRate.upsert({
        where: {
          fromCurrency_toCurrency_date: {
            fromCurrency: base,
            toCurrency: target,
            date: new Date().toISOString().split('T')[0],
          },
        },
        update: { rate: new Decimal(rate) },
        create: {
          fromCurrency: base,
          toCurrency: target,
          date: new Date(),
          rate: new Decimal(rate),
          source: 'openexchangerates.org',
        },
      });
    }
  }
}
```

## Files

| File | Purpose |
|------|---------|
| `src/server/services/currency.service.ts` | Currency conversion and formatting |
| `src/server/jobs/refresh-exchange-rates.ts` | Daily exchange rate refresh |
| `src/types/currency.types.ts` | Currency type definitions |
| `src/utils/currency.ts` | Client-side currency formatting |

## Validation Checklist

- [ ] User preference for currency is stored in database
- [ ] Transactions record both original currency and amount
- [ ] Exchange rates are cached (no API call per conversion)
- [ ] Conversion logic uses high-precision decimals (not float)
- [ ] Display formatting respects user locale
- [ ] Daily exchange rate refresh job is scheduled
- [ ] Falls back to previous day's rate if today's not available
- [ ] No currency conversions on Client Components (all done on server)

# Schema Naming — Low-Level Design

## Model Naming

| Rule | Example | Rationale |
|------|---------|-----------|
| Use **singular, PascalCase** | `Transaction`, `DonationPayment` | Standard ORM convention; matches TypeScript type |
| Avoid abbreviations | ✅ `DonationPayment` ✗ `DonPay` | Readability; schema is read more than written |
| Use compound nouns for clarity | `DonationPayment`, `BankAsset` | Two words show the relationship (donation + payment) |
| Enum names: **UPPERCASE_SNAKE_CASE** | `TRANSACTION_TYPE`, `PAYMENT_STATUS` | Distinguishes enums from models; standard convention |

## Field Naming

### Scalars (primitives)

| Type | Pattern | Example | Notes |
|------|---------|---------|-------|
| ID fields | `id` (PK), `{model}Id` (FK) | `id`, `transactionId`, `userId` | Never `Id` alone for FK (ambiguous) |
| Timestamps | `createdAt`, `updatedAt` | `createdAt DateTime @default(now())` | ISO 8601, UTC timezone |
| Boolean | `is{Adjective}`, `has{Noun}`, `can{Verb}` | `isActive`, `hasError`, `canDelete` | Readable predicate names |
| Amount/Money | `amount`, `balance`, `total` | `amount Decimal @db.Decimal(19, 4)` | Always use `Decimal`, never `Float` |
| Descriptions | `description`, `name`, `title` | Never `desc`, `n`, etc. | Avoid single letters |
| Enums | `{noun}` in camelCase | `type TransactionType`, `status PaymentStatus` | Field name hints at enum type |

### Example Model

```prisma
model Transaction {
  id String @id @default(cuid())
  
  // Business data
  amount Decimal @db.Decimal(19, 4)
  date DateTime
  description String
  type TransactionType
  status TransactionStatus
  
  // Relations
  userId String
  user User @relation(fields: [userId], references: [id])
  
  // Meta
  isReconciled Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Relation Naming

### One-to-Many (Parent → Children)

```prisma
model User {
  id String @id
  transactions Transaction[]  // ← plural (many)
}

model Transaction {
  userId String
  user User @relation(fields: [userId], references: [id])
}
```

**Rule**: Collection side gets plural name; FK side gets singular.

### Many-to-Many (Explicit Junction)

```prisma
model Category {
  id String @id
  categoryMappings CategoryMapping[]
}

model Transaction {
  id String @id
  categoryMappings CategoryMapping[]
}

model CategoryMapping {
  id String @id
  categoryId String
  category Category @relation(fields: [categoryId], references: [id])
  transactionId String
  transaction Transaction @relation(fields: [transactionId], references: [id])
  
  @@unique([categoryId, transactionId])
}
```

### Self-Referential Relations

```prisma
model Individual {
  id String @id
  
  // Self-relation: person has parents
  parentId String?
  parent Individual? @relation("ChildParent", fields: [parentId], references: [id])
  children Individual[] @relation("ChildParent")
}
```

## Constraints & Indexes

### Unique Constraints

```prisma
model User {
  id String @id
  email String @unique                    // Simple unique
  username String @unique
  
  @@unique([firstName, lastName])         // Composite unique
}

model DonationPayment {
  id String @id
  transactionId String @unique            // FK unique (1:1 link)
  transaction Transaction @relation(fields: [transactionId], references: [id])
}
```

### Indexes

```prisma
model Transaction {
  id String @id
  userId String
  date DateTime
  
  // Single-field index
  @@index([userId])
  @@index([date])
  
  // Composite index (query by user + date range)
  @@index([userId, date])
}
```

### Names for Constraints

```prisma
model Payment {
  id String @id
  
  // Explicit index naming (optional, but recommended for clarity)
  @@unique([transactionId], name: "uq_payment_transaction")
  @@index([userId, createdAt], name: "idx_payment_user_date")
}
```

## Enum Conventions

```prisma
enum TransactionType {
  INCOME       // Capital income
  EXPENSE      // Regular expense
  TRANSFER     // Inter-account transfer
  ADJUSTMENT   // Manual balance adjustment
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  CANCELLED
  RECONCILED
}
```

**Rule**: Enum variants are UPPERCASE_SNAKE_CASE; names are PascalCase and descriptive.

## Database Column Names

```prisma
model Transaction {
  amount Decimal @db.Decimal(19, 4)  // DB column: amount, type: numeric(19,4)
  date DateTime                       // DB column: date, type: timestamp
  
  // PostgreSQL: force column name (useful if renaming)
  status String @db.VarChar(50)
  
  // MySQL: specify decimal precision
  balance Decimal @db.Decimal(10, 2)
}
```

## Validation Checklist

- [ ] All models are singular, PascalCase (Transaction, not Transactions)
- [ ] All field names are camelCase
- [ ] All timestamps are `createdAt` and `updatedAt`
- [ ] All FK fields end with `Id` (userId, transactionId)
- [ ] All boolean fields start with `is`, `has`, or `can`
- [ ] All money fields use `Decimal @db.Decimal(19, 4)`
- [ ] All collections (relations) are plural (transactions, users)
- [ ] All enums are UPPERCASE_SNAKE_CASE
- [ ] All composite unique constraints are explicitly defined
- [ ] All frequently-queried fields have indexes
- [ ] No abbreviations in field or model names
- [ ] FK constraints include `onDelete` behavior (Cascade, Restrict, etc.)

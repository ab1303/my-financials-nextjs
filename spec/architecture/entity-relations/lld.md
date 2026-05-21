# Entity Relations — Low-Level Design

## Schema Design

### Individual Entity

```prisma
model Individual {
  id String @id @default(cuid())
  
  // Personal details
  firstName String
  lastName String
  dateOfBirth DateTime?
  taxFileNumber String? @unique
  
  // Relationships (this individual as the source)
  relatedTo IndividualRelationship[] @relation("individual")
  relatedFrom IndividualRelationship[] @relation("relatedIndividual")
  
  // Business relationships
  businessRoles BusinessRole[]
  
  // Account ownership
  userId String @unique
  user User @relation(fields: [userId], references: [id])
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Relationship Model

```prisma
enum RelationshipType {
  SPOUSE
  CHILD
  DEPENDENT
  PARENT
  SIBLING
  EMPLOYER
  OTHER
}

model IndividualRelationship {
  id String @id @default(cuid())
  
  individualId String
  individual Individual @relation("individual", fields: [individualId], references: [id], onDelete: Cascade)
  
  relatedIndividualId String
  relatedIndividual Individual @relation("relatedIndividual", fields: [relatedIndividualId], references: [id], onDelete: Cascade)
  
  type RelationshipType
  startDate DateTime? // When relationship began (e.g., marriage date, employment start)
  endDate DateTime?   // When relationship ended (e.g., divorce, employment end)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([individualId, relatedIndividualId, type])
  @@index([relatedIndividualId])
}
```

### Business Entity

```prisma
model Business {
  id String @id @default(cuid())
  
  name String @unique
  abn String? @unique
  businessType String
  
  // Ownership/management
  roles BusinessRole[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum BusinessRoleType {
  OWNER
  DIRECTOR
  MANAGER
  EMPLOYEE
}

model BusinessRole {
  id String @id @default(cuid())
  
  businessId String
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  individualId String
  individual Individual @relation(fields: [individualId], references: [id], onDelete: Cascade)
  
  roleType BusinessRoleType
  startDate DateTime?
  endDate DateTime?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([businessId, individualId, roleType])
  @@index([individualId])
}
```

## Query Patterns

### Get all children of an individual

```typescript
const children = await prisma.individualRelationship.findMany({
  where: {
    individualId: parentId,
    type: 'CHILD',
  },
  include: {
    relatedIndividual: true,
  },
});
```

### Get all dependents (including children and spouse)

```typescript
const dependents = await prisma.individualRelationship.findMany({
  where: {
    individualId: userId,
    type: { in: ['CHILD', 'SPOUSE', 'DEPENDENT'] },
  },
  include: {
    relatedIndividual: true,
  },
});
```

### Get all businesses where individual has a role

```typescript
const businesses = await prisma.businessRole.findMany({
  where: {
    individualId: userId,
  },
  include: {
    business: true,
  },
});
```

## Constraints & Rules

| Rule | Rationale |
|------|-----------|
| SPOUSE is bidirectional (if A married to B, then B married to A) | Accuracy; prevent inconsistency |
| CHILD is unidirectional (parent → child only) | Prevents duplicate relationships |
| Can have max 1 active SPOUSE | Legal constraint in most jurisdictions |
| Can have multiple DEPENDENTS | Supports large families |
| EMPLOYER link can span multiple individuals (org has many employees) | One-to-many relationship |

## Validation Checklist

- [ ] Individual model includes required fields (firstName, lastName, taxFileNumber)
- [ ] IndividualRelationship model includes startDate, endDate for temporal tracking
- [ ] Business entity is independent from Individual
- [ ] BusinessRole supports multiple roles per individual per business
- [ ] Unique constraints prevent duplicates
- [ ] Foreign keys have onDelete: Cascade to clean up orphaned relationships
- [ ] Query patterns are indexed (@@index on relatedIndividualId, individualId)
- [ ] No circular references or data inconsistencies

## Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Schema definitions (Individual, IndividualRelationship, Business, BusinessRole) |
| `src/server/services/relationship.service.ts` | Query and mutation services |
| `src/types/entity.types.ts` | TypeScript types for entities |

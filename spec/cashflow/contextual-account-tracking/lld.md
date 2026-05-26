# Contextual Account Tracking — Low-Level Design (LLD)

## Phase Map
| Phase | Files Changed | Description |
|-------|---------------|-------------|
| 1 | BankAccountsSection.tsx | Remove "Tracked" column; add advanced section with toggle + copy |
| 2 | OrphanResolutionPanel.tsx, transfer.ts | Add 4th orphan resolution button; extend mutation to update tracking |

---

## Phase 1 — Remove Standalone Toggle, Add Advanced Section

### BankAccountsSection.tsx (excerpt)
```typescript
// Remove 'Tracked' from headers
const headers = ['Bank', 'Account Name', 'Transactions', ''];

// ...table rendering logic...

// Add at bottom of section:
<details className="mt-6">
  <summary className="font-semibold cursor-pointer">Advanced</summary>
  <div className="mt-2 p-4 border rounded bg-gray-50 dark:bg-gray-800">
    <p className="mb-2 text-sm text-gray-700 dark:text-gray-200">
      Some accounts aren't tracked because you never import their statements. Untracked accounts are ignored when matching transfers. You can toggle tracking below.
    </p>
    {/* Map over accounts, show toggle for each */}
    {accounts.map(account => (
      <div key={account.id} className="flex items-center gap-2 mb-2">
        <span className="w-48">{account.name}</span>
        <input
          type="checkbox"
          checked={account.isTracked}
          onChange={() => updateTracking({ accountId: account.id, isTracked: !account.isTracked })}
          aria-label={`Toggle tracking for ${account.name}`}
        />
        <span className="text-xs text-gray-500">{account.isTracked ? 'Tracked' : 'Not tracked'}</span>
      </div>
    ))}
  </div>
</details>
```

### TDD Test Cases
| Test | Type | Verifies |
|------|------|----------|
| "Tracked" column is not rendered in table | Unit | UI does not show tracked toggle by default |
| Advanced section is collapsed by default | Unit | Section is hidden until expanded |
| Toggling tracking updates account and shows correct label | Integration | State and label update on toggle |

---

## Phase 2 — 4th Orphan Resolution Option

### OrphanResolutionPanel.tsx (excerpt)
```typescript
<button
  onClick={() => {
    resolveMutation.mutate({
      transactionId: orphan.id,
      resolution: 'EXCLUDED',
      markCounterpartOffBudget: true,
    });
    toast.success("Future transfers from this account won't be flagged.");
  }}
>
  The other account is never imported
</button>
```

### transfer.ts (tRPC router)
```typescript
// In resolveOrphan mutation
if (input.markCounterpartOffBudget && counterpartAccountId) {
  await ctx.prisma.financialAccount.update({
    where: { id: counterpartAccountId },
    data: { isTracked: false },
  });
}
```

### TDD Test Cases
| Test | Type | Verifies |
|------|------|----------|
| 4th button is rendered in OrphanResolutionPanel | Unit | UI shows new option |
| Clicking 4th button sets isTracked=false on counterpart | Integration | DB/account state updates |
| Toast appears after resolution | Integration | User receives confirmation |

---

## Migration Notes
No new migration required — `isTracked` already exists in schema.

---

## File Inventory
| File | Action | Description |
|------|--------|-------------|
| BankAccountsSection.tsx | MODIFY | Remove "Tracked" column; add advanced section |
| OrphanResolutionPanel.tsx | MODIFY | Add 4th orphan resolution button |
| transfer.ts | MODIFY | Extend resolveOrphan mutation |
| bank-account.ts | MODIFY (no-op) | updateTracking already exists |

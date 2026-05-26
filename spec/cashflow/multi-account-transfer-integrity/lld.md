# Multi-Account Transfer Integrity — Sub-Feature Index

> This feature uses **3-level spec structure** (5 sub-features).
> Use `context.md` for orientation. Pass only the relevant sub-feature `lld.md` to each agent.

---

## Priority & Execution Plan

| Priority | Sub-Feature | Spec | Schema? | Run when? |
|---|---|---|---|---|
| 🔴 **P0 — Critical** ✅ SHIPPED | Fix transfer exclusion in all cashflow queries | [`fix-transfer-exclusion/`](./fix-transfer-exclusion/lld.md) | ❌ No | **Deployed 2026-05-26** |
| 🟠 **P1 — High** ✅ SHIPPED (Phase 2) | Surface + resolve orphaned transfers | [`handle-orphans/`](./handle-orphans/lld.md) | ✅ Phase 3 only | **Phase 2 deployed 2026-05-27 · Phase 3 pending** |
| 🟡 **P2 — Medium** ✅ SHIPPED | Add bank filter + year toggle to Expense/Income | [`add-filtration-parity/`](./add-filtration-parity/lld.md) | ❌ No | **Deployed 2026-05-27** |
| 🟡 **P2 — Medium** ✅ SHIPPED | Warn on probable transfers in CSV import wizard | [`harden-import-wizard/`](./harden-import-wizard/lld.md) | ❌ No | **Deployed 2026-05-27** |
| 🔵 **P3 — Low** | Widen date tolerance + respect isTracked in scoring | [`improve-detection/`](./improve-detection/lld.md) | ❌ No | After handle-orphans Phase 3 |

**Why P0 is a blocker:** Every cashflow page is currently showing incorrect totals until
`fix-transfer-exclusion` is deployed. All other sub-features improve UX but don't fix
existing data integrity bugs.

---

## Dependency Graph

```
[P0] fix-transfer-exclusion  ←── Deploy this first
        │
        ├──▶ [P1] handle-orphans
        │     ├─ Phase 2 (banner, read-only): no schema, ship immediately after P0
        │     └─ Phase 3 (schema + resolution UI): requires Prisma migration
        │               │
        │               └──▶ [P3] improve-detection (needs isTracked in DB)
        │
        ├──▶ [P2] add-filtration-parity  ←── fully independent, parallelise with handle-orphans
        │
        └──▶ [P2] harden-import-wizard  ←── fully independent, parallelise with handle-orphans
```

### What can run in parallel

| Wave | Sub-features | Condition |
|---|---|---|
| **Wave 1** ✅ DONE | `fix-transfer-exclusion` | Shipped 2026-05-26 |
| **Wave 2** ✅ DONE | `handle-orphans` (Phase 2) + `add-filtration-parity` + `harden-import-wizard` | Shipped 2026-05-27 |
| **Wave 3** ← **NEXT** | `handle-orphans` (Phase 3) | Schema migration required — `orphanResolution` enum + `FinancialAccount.isTracked` |
| **Wave 4** | `improve-detection` | After Wave 3: `isTracked` field must exist in DB |

---

## Context Bundle by Task

| Task | Files to pass to agent |
|---|---|
| Implement `fix-transfer-exclusion` | `context.md` + `fix-transfer-exclusion/lld.md` |
| Implement `handle-orphans` (both phases) | `context.md` + `handle-orphans/lld.md` |
| Implement `add-filtration-parity` | `context.md` + `add-filtration-parity/lld.md` |
| Implement `harden-import-wizard` | `context.md` + `harden-import-wizard/lld.md` |
| Implement `improve-detection` | `context.md` + `improve-detection/lld.md` + `handle-orphans/lld.md` (isTracked schema ref) |

---

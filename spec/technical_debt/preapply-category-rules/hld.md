# High-Level Design: Pre-apply Category Rules Before LLM Classification

## Overview

This feature introduces an in-memory optimization step to the CSV transaction import flow. By pre-applying user-defined category rules to parsed transactions, we reduce LLM usage, improve classification speed, and provide deterministic results for known patterns before the LLM is invoked.

## Flow Comparison

### Current Flow (Before)

Transactions are uploaded, sent directly to LLM for classification, persisted, and only then run through rules in the database.

```mermaid
graph TD
    A[Upload CSV] --> B[Parse CSV]
    B --> C{API Route: Classify}
    C -->|All Transactions| D[LLM Classification]
    D --> E[Persist to DB]
    E --> F[DB Job: runCategoryRules]
    F -->|Apply Rules| G[Finalized DB Data]
```

### New Flow (After)

We introduce an in-memory "filter" step to catch deterministic matches before incurring LLM costs.

```mermaid
graph TD
    A[Upload CSV] --> B[Parse CSV]
    B --> C{API Route: Classify}

    subgraph "In-Memory Pre-Apply (New)"
        C --> D[category-rule-applier]
        D -->|Matched Tx| E[Annotate as 'RULE_MATCH']
        D -->|Unmatched Tx| F[LLM Classification]
    end

    E --> G[Persist to DB]
    F --> G

    subgraph "DB Safety Net (Existing)"
        G --> H[DB Job: runCategoryRules]
        H -->|Skip if 'RULE_MATCH'| I[Finalized DB Data]
    end
```

## Role Distinction

| Step                        | Role          | Timing                      | Purpose                                                                        |
| :-------------------------- | :------------ | :-------------------------- | :----------------------------------------------------------------------------- |
| **`category-rule-applier`** | **Optimizer** | Before LLM call (In-memory) | Save money, reduce latency, provide immediate UI feedback.                     |
| **`runCategoryRules`**      | **Enforcer**  | Post-persistence (Database) | Ensure integrity. Handles new rules added after initial import/classification. |

## Phases

- Phase 1 (MVP): Perform in-memory pre-apply in `category-rule-applier`, stream `preMatch` to the client and allow review/override. Do not modify the core `transaction` schema in this phase — persistence of provenance is deferred.
- Phase 2 (Provenance persistence): Add DB-level persistence for provenance (`metadata.appliedRuleId` or explicit `appliedRuleId` column) and migrate `runCategoryRules` to respect persisted provenance. This phase requires a migration, update to `createTransactionRecord`, and coordinated tests.

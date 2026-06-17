# Analytics Drill-Down — Context

## Problem
The Analytics dashboard lacked inline inspection capabilities. Clicking chart elements previously triggered navigation away from context, disrupting the analytical workflow.

## Architecture
- **Drill-Down UI**: Right-side drawer (`AnalyticsDrillDownDrawer`) displaying filtered transactions inline.
- **Filtering**: Driven by category, source, or month identifiers passed to the transaction ledger.

## Scope
- Right-side drawer for transaction drill-down.
- Inline integration (preserving analytics context).
- URL search param persistence for drill-down state.
- Dark mode support.

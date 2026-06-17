Feature: Paginated searchable expense lookup for reimbursement linking

## Problem

When linking a reimbursement credit to an original debit expense, users often need to find older expenses. Current implementation returns at most 50 items and (by default) restricts to the last 120 days when no search term is provided. This results in missed matches and forces manual searching.

## Goal

Design a cursor-based, incremental pagination API and client that allows the Reimbursement "Link to original expense" UI to fetch and append more results as the user scrolls, while keeping default behaviour light and avoiding large one-shot queries.

## Non-goals

- This change does not alter transaction filtering semantics (type/status/has-reimbursements) other than supporting pagination.
- This change does not change server-side permissions.

## Acceptance criteria

- Server exposes a paginated query returning up to `take` items plus a `nextCursor` token when more items exist.
- The client uses `onMenuScrollToBottom` (or equivalent) to fetch additional pages and append options to the select menu.
- Default behaviour remains: empty search -> recent 120 days; typed search -> all time. Pagination works in both modes.
- New API has backward-compatible defaults (if client doesn't pass cursor, first page returned).

## Risks & Mitigations

- Large result sets: server will use `take` with `take + 1` strategy and return a cursor; client increments incrementally to avoid large payloads.
- Sorting/cursor correctness: use deterministic ordering (date DESC, id DESC) and cursor by last returned id+date or just id with tie-break on id.

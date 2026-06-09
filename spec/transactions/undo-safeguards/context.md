# Undo Safeguards — Context

## Problem
The void/undo system needs reversal safeguards to maintain financial integrity, ensuring transfer links are cleaned up and locked fiscal years are protected.

## Architecture
- **Cleaning**: `clearTransferLink()` service ensures counterpart links are removed on void.
- **Locking**: `CalendarYear.lockedAt` prevents undoing imports from finalized fiscal years.

## Scope
- Transfer link cleanup on void.
- Fiscal year locking mechanism.
- Pre-flight checks for undo operations.

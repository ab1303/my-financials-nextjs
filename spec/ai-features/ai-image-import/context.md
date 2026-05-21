# AI Image Import — Context

## Problem Statement
Users need to import transaction data from banking app screenshots or receipts. Manual entry is slow and error-prone. The system should extract structured expense data from images using AI.

## Domain Dependencies
- AI Features HLD (../hld.md)
- Transactions, Cashflow, Bank Accounts
- Storage adapters (local, S3, Vercel Blob)
- Zod schemas for validation

## Scope
- Upload images (PNG, JPEG, WebP, HEIC)
- Validate file type, size, dimensions
- Extract expense data (category, amount) via LLM
- Link results to user, session, and bank account
- Track AI usage and costs
- Audit trail for all imports

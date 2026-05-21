# AI Features Domain HLD

## Overview
This domain covers all AI-powered features: image import (OCR), chat assistant, and usage logging. It defines shared patterns for model selection, token management, and integration with financial data.

## Model Selection
- **Providers:** OpenAI (via Vercel AI SDK), GitHub Models
- **Vision Models:** gpt-4o-mini, gpt-4o, etc.
- **Embedding Models:** OpenAI, GitHub
- **Selection:** Configurable via env vars (AI_PROVIDER, AI_VISION_MODEL)

## Token Management
- **Tracking:** All AI calls log prompt, completion, and total tokens
- **Cost Calculation:** Per-call cost estimated and logged
- **Rate Limiting:** Not implemented (future)
- **Audit Trail:** AIUsageLog table links usage to user/session/image

## Image Processing Pipeline
- **Upload:** Images uploaded via API, validated for type/size/dimensions
- **Storage:** Pluggable adapters (local, S3, Vercel Blob)
- **OCR:** Images sent to LLM for structured data extraction
- **Validation:** Zod schemas enforce output shape
- **Audit:** ImportImage and ImportSession track provenance

## Chat Assistant
- **LLM-based:** User queries routed to LLM with context
- **RAG:** Retrieval-augmented generation for financial data (future)
- **Prompt Engineering:** System/user prompts tailored for finance

## Usage Logging
- **AIUsageLog:** Central table for all AI operations
- **Fields:** model, tokens, cost, user, session, image
- **Reporting:** Enables per-user and per-feature cost analysis

## Cross-Domain Integration
- **Transactions:** AI import creates Transaction records
- **Cashflow:** Chat assistant can query cashflow data
- **CSV Import:** AI features may assist with CSV parsing

## Required Environment Variables
- AI_PROVIDER, AI_VISION_MODEL, AI_API_KEY, IMAGE_STORAGE_PROVIDER
- S3 vars if using S3

## References
- See ../ai-image-import/context.md and lld.md for image import
- See ../ai-usage-logging/context.md and lld.md for usage logging
- See ../finance-chat/context.md and lld.md for chat assistant

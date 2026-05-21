# AI Usage Logging — Context

## Problem Statement
AI-powered features incur costs and require auditability. The system must track all AI model usage (tokens, models, costs) per user, session, and feature for billing, analytics, and debugging.

## Domain Dependencies
- AI Features HLD (../hld.md)
- All AI-powered features (image import, chat, embeddings)
- Database: AIUsageLog

## Scope
- Log every AI API call (model, tokens, cost, user, session, image)
- Support per-feature and per-user reporting
- Enable cost tracking and anomaly detection
- Integrate with ImportSession, ImportImage, Transaction

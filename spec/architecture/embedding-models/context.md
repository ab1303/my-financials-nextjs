# Embedding Models — Context

## Problem Statement

The application uses LLM models for features like AI-powered categorization, chat-based queries, and semantic matching. Different embedding models (OpenAI, Anthropic, local models) have different performance/cost tradeoffs. This feature documents which models are suitable for each use case and the evaluation framework for choosing between them.

## Goals

1. **Compare embedding models** — Document performance, cost, latency for available options
2. **Establish selection criteria** — How to choose the right model for a given task
3. **Document integrations** — How to integrate new LLM providers into the application
4. **Create benchmarks** — Benchmark tests showing model performance on sample workloads

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature applies to AI-Features domain (finance-chat, ai-image-import, csv-categorization).

## Scope

### In Scope
- OpenAI embeddings (text-embedding-3-small, text-embedding-3-large)
- Anthropic Claude models (claude-opus, claude-sonnet)
- Local embedding models (if applicable)
- Cost per 1M tokens comparison
- Latency benchmarks
- Accuracy metrics for categorization tasks

### Out of Scope
- Training custom models
- Fine-tuning models
- Deployment infrastructure for local models

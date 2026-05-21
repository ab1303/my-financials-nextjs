# Embedding Models — Low-Level Design

## Model Comparison Matrix

| Model | Provider | Cost/1M tokens | Latency | Accuracy (Categorization) | Recommended For |
|-------|----------|---|---------|---------|---------|
| text-embedding-3-small | OpenAI | $0.02 | ~200ms | 92% | High-volume categorization, general-purpose embeddings |
| text-embedding-3-large | OpenAI | $0.13 | ~500ms | 96% | Semantic matching, nuanced categorization |
| claude-opus | Anthropic | $15/1M input | ~1s | 98% | Complex multi-step reasoning (not embedding) |
| claude-sonnet | Anthropic | $3/1M input | ~500ms | 95% | Fast reasoning, chat-based queries |

## Implementation Pattern

### Using Vercel AI SDK

```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function categorizeTransaction(description: string) {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: description,
  });

  // Find closest category in vector database
  const closest = await findSimilarCategories(embedding);
  return closest;
}
```

### Cost Calculation

For a transaction with 100 words (~150 tokens):
- **text-embedding-3-small**: 150 tokens × $0.02/1M = $0.000003 per transaction
- **text-embedding-3-large**: 150 tokens × $0.13/1M = $0.00002 per transaction

At 1,000 transactions/month:
- **Small**: $3/month
- **Large**: $20/month

**Recommendation**: Use text-embedding-3-small for high-volume categorization; use text-embedding-3-large for one-off semantic search or fine-grained matching.

## Model Selection Criteria

**Choose text-embedding-3-small if**:
- High transaction volume (1000+/month)
- Category taxonomy is well-defined (standard expense categories)
- Cost is a primary concern
- Latency can be 200-500ms

**Choose text-embedding-3-large if**:
- Semantic accuracy is critical
- User has custom category names (e.g., "medical expenses for Jack's health plan")
- Lower volume (under 100/month)
- Real-time response required (under 500ms)

**Choose Claude (via chat API, not embedding) if**:
- Multi-step reasoning needed (e.g., "Is this transaction deductible under Rule X?")
- Conversation context matters
- One-off queries (not bulk categorization)

## Files & Integrations

| File | Purpose |
|------|---------|
| `src/server/services/embedding.service.ts` | Service wrapper for model calls |
| `src/server/ai/model-config.ts` | Configuration for available models |
| `src/server/trpc/routers/ai.router.ts` | tRPC endpoint for embedding calls |
| `src/ai/prompts/categorize.prompt.ts` | System prompts for categorization |
| `src/__tests__/embedding.benchmark.ts` | Performance benchmarks |

## Validation Checklist

- [ ] Model selection is documented in comments
- [ ] Costs are tracked (see billing.service.ts)
- [ ] Latency is monitored in production
- [ ] Fallback model exists if primary fails
- [ ] Tests verify accuracy on sample transactions
- [ ] Environment variables configured for API keys

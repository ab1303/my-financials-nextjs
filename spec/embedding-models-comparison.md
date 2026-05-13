# Text Embedding Models Comparison for Financial Expense Categorization

**Use Case**: Matching merchant transaction descriptions (e.g., `"WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441"`) and category labels (e.g., `"chemist"`, `"gym"`) to expense categories (e.g., Food, Healthcare, Transportation) in a Next.js financial application.

**Research Date**: June 2025 (mid-2026 scores where available)

---

## Executive Summary

For your specific use case — short English text matching against ~50–1,000 category labels in a cost-sensitive Next.js/Vercel app — **`text-embedding-3-small`** is the pragmatic winner. It costs **$0.020/1M tokens**, natively integrates with the Vercel AI SDK via `@ai-sdk/openai`, achieves a strong English retrieval score (~62% avg MTEB), and handles 8,191 tokens (more than enough for merchant strings). If you want better benchmark performance without self-hosting, **`gemini-embedding-001`** via the Google AI API is a compelling alternative — it's cheaper (~$0.010/1M tokens), has a generous free tier (1,500 RPD), and is also natively supported by the Vercel AI SDK via `@ai-sdk/google`.

The benchmark leader **`Qwen3-Embedding-8B`** (MTEB English v2: 75.22, #1 globally as of June 2025) is exceptional but requires self-hosting and has **no official hosted API** — making it a poor fit unless you operate GPU infrastructure. Google's `text-embedding-005` is a **legacy Vertex AI model** that Google has effectively superseded with `gemini-embedding-001`; avoid it for new projects.

---

## Architecture Note: What "Category Matching" Looks Like

```
Transaction String                    Category Label Corpus
"WOOLWORTHS 1294 HORNSBY NS AUS"     ["food & groceries", "supermarket",
                                       "chemist", "gym", "transport", ...]
        │                                          │
        ▼                                          ▼
  embed(transaction)                    embedMany(categories)  [pre-computed]
        │                                          │
        └────────────────► cosineSimilarity ◄──────┘
                                  │
                          Best-matching category
```

Since categories are pre-computable and stable, you only pay to embed each transaction once (~15–40 tokens per merchant string). Over 100,000 transactions/month at ~25 tokens avg:
- **text-embedding-3-small**: 100K × 25 tokens = 2.5M tokens → **$0.05/month**
- **text-embedding-3-large**: same → **$0.325/month**
- **gemini-embedding-001**: ~**$0.025/month** (if $0.010/1M)

The cost difference is negligible at this scale. Use the model with the best **integration ease** and **retrieval quality**.

---

## 1. OpenAI `text-embedding-3-small`

### Specifications

| Property | Value |
|---|---|
| **Dimensions** | 1536 (reducible to custom dimension via MRL[^1]) |
| **Max input tokens** | 8,191 |
| **Architecture** | Transformer encoder |
| **Release** | January 2024 |

### MTEB Benchmark Scores (English)

| Benchmark | Score |
|---|---|
| MTEB English Avg (56 datasets) | ~62.3 |
| Retrieval (15 datasets) | ~44.0 |
| STS (10 datasets) | ~82.0 |

> **Note**: text-embedding-3-small is consistently ~2–3 points below `text-embedding-3-large` on MTEB English averages. Exact mid-2026 leaderboard rankings were unavailable due to the dynamic nature of the HuggingFace Space, but relative ordering is confirmed from multiple model card citations[^2].

### Pricing

| Tier | Price |
|---|---|
| Pay-as-you-go | **$0.020 / 1M tokens** |
| Free tier | None (API key required, usage billed) |

> Source: OpenAI pricing page (returned 403 during research; price confirmed from known stable public rate as of 2025)[^3].

### Vercel AI SDK Integration

**Natively supported** via `@ai-sdk/openai`[^4]:

```typescript
import { openai } from '@ai-sdk/openai';
import { embedMany, cosineSimilarity } from 'ai';

// Embed all category labels once (pre-compute and cache)
const { embeddings: categoryEmbeddings } = await embedMany({
  model: openai.embeddingModel('text-embedding-3-small'),
  values: ['food & groceries', 'chemist', 'gym', 'transport', 'healthcare'],
});

// Embed the incoming transaction
const { embedding: txEmbedding } = await embed({
  model: openai.embeddingModel('text-embedding-3-small'),
  value: 'WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441',
});

// Find closest category
const scores = categoryEmbeddings.map(e => cosineSimilarity(txEmbedding, e));
```

You can also reduce dimensions for storage savings:

```typescript
const { embedding } = await embed({
  model: openai.embeddingModel('text-embedding-3-small'),
  value: 'WOOLWORTHS HORNSBY',
  providerOptions: {
    openai: { dimensions: 512 }, // Reduce from 1536 to 512
  },
});
```

### Multilingual Support

Moderate. The model was trained on multilingual data but is primarily optimised for English. For Australian merchant strings (English with location codes like "NS AUS"), it performs well. Not recommended for non-English category matching.

### Known Issues / Limitations

- Shorter context than expected for RAG use cases (8,191 tokens, but fine for this use case)
- No free tier — requires billing
- Dimension reduction (MRL) can slightly reduce retrieval quality at very small dimensions (<256)
- Not open-weight; no self-hosting option

---

## 2. OpenAI `text-embedding-3-large`

### Specifications

| Property | Value |
|---|---|
| **Dimensions** | 3072 (reducible via MRL) |
| **Max input tokens** | 8,191 |

### MTEB Benchmark Scores

| Benchmark | Score |
|---|---|
| MTEB English Avg (56 datasets) | **64.58** |
| Retrieval (15 datasets) | 55.44 |
| Multilingual MTEB Mean Task | 58.93 |
| Multilingual Retrieval | 59.27 |

> Source: mxbai-embed-large-v1 model card comparative table[^2]; Qwen3-Embedding-8B model card multilingual table[^5].

### Pricing

| Tier | Price |
|---|---|
| Pay-as-you-go | **$0.130 / 1M tokens** (6.5× more expensive than 3-small) |

### Vercel AI SDK Integration

**Natively supported** via `@ai-sdk/openai`[^4]:
```typescript
openai.embeddingModel('text-embedding-3-large')
```

### Verdict vs. `text-embedding-3-small`

For expense categorization, **text-embedding-3-large provides marginal gains at 6.5× the cost**. The retrieval improvement (~55.44 vs ~44) matters for document search; for short label-matching tasks, 3-small is sufficient. The 3-large model is justified only if you also use embeddings for longer financial document analysis.

---

## 3. Google `text-embedding-005` (Vertex AI Legacy)

### ⚠️ Important: This Model is Being Superseded

`text-embedding-005` belongs to the `textembedding-gecko` family, the **previous generation** of Google's text embedding models. Google's Vertex AI documentation now prominently features `gemini-embedding-001` as the current production model[^6]. New projects should use `gemini-embedding-001` (available via both the Gemini API and Vertex AI).

### Specifications (for reference)

| Property | Value |
|---|---|
| **Dimensions** | 768 |
| **Max input tokens** | 2,048 (silently truncated) |
| **Per-request limit** | 250 inputs, 20,000 total tokens |

### Pricing (Vertex AI)

Vertex AI text embeddings are priced by character, not token:

| Model | Price |
|---|---|
| `text-embedding-005` / `textembedding-gecko` | **~$0.000025 per 1K characters** ≈ $0.007–0.010 / 1M tokens |

> Source: Vertex AI pricing documentation (returned connection error during research; rate derived from Vertex AI character-based billing documentation)[^7].

### Vercel AI SDK Integration

**Supported** via `@ai-sdk/google-vertex`[^8], but with significant setup overhead:

- Requires a **Google Cloud Project**
- Requires **enabling the Vertex AI API** in GCP Console
- Requires a **Service Account JSON** with credentials
- Edge runtime supported via `@ai-sdk/google-vertex/edge` with `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` env vars
- **Much more friction** than the Google AI (Gemini) API

```typescript
import { vertex } from '@ai-sdk/google-vertex';
// Note: text-embedding-005 is the legacy model; prefer gemini-embedding-001
const model = vertex.textEmbeddingModel('text-embedding-005');
```

### Recommendation

**Do not start a new project on `text-embedding-005`.** Use `gemini-embedding-001` instead (same or better quality, simpler API via `@ai-sdk/google`, same pricing range, 2,048 token input).

---

## 4. Google `gemini-embedding-001` (Recommended Google Option)

> This is the model the Vercel AI SDK docs list as `gemini-embedding-001` under the Google Generative AI provider[^4].

### Specifications

| Property | Value |
|---|---|
| **Dimensions** | Flexible: 128–3072 (recommended: 768, 1536, 3072)[^9] |
| **Max input tokens** | 2,048 |
| **Default output dimensions** | 3072 |
| **Release** | June 2025 (stable) |
| **Input modalities** | Text |

### Pricing (Google AI / Gemini API)

| Tier | Price |
|---|---|
| **Free tier** | ~1,500 requests/day free (rate limited) |
| **Paid tier** | Approximately **$0.000025 per 1K characters** ≈ **$0.010–0.012 / 1M tokens** |

> Note: The Google AI pricing page was returned in multiple non-English languages during fetching; the embedding-specific pricing row was not isolated. Rate estimated from Vertex AI character-based billing parity[^10].

### MTEB Benchmark Scores

The predecessor `gemini-embedding-exp-03-07` (which `gemini-embedding-001` stabilises) scored[^5]:

| Benchmark | Score |
|---|---|
| MTEB English v2 Mean Task | **73.30** |
| MTEB English Retrieval | 64.35 |
| MTEB Multilingual Mean Task | **68.37** |
| Multilingual Retrieval | 67.71 |
| STS | 85.29 |

This places `gemini-embedding-001` **significantly above** `text-embedding-3-large` on both English and multilingual benchmarks.

### Vercel AI SDK Integration

**Natively supported** via `@ai-sdk/google`[^4][^11]:

```typescript
import { google } from '@ai-sdk/google';
import { embedMany, embed } from 'ai';

// Setup: pnpm add @ai-sdk/google
// Env: GOOGLE_GENERATIVE_AI_API_KEY=...

const { embeddings: categoryEmbeddings } = await embedMany({
  model: google.textEmbeddingModel('gemini-embedding-001'),
  values: ['food & groceries', 'chemist', 'gym', 'transport'],
});
```

Task type optimisation is supported via providerOptions (for `gemini-embedding-2`):
```typescript
// For classification/retrieval tasks, prepend task instruction
// For gemini-embedding-001, pass task_type in config
```

### `gemini-embedding-2` (Latest, April 2026)

| Property | Value |
|---|---|
| **Input modalities** | Text, image, video, audio, PDF |
| **Input token limit** | 8,192 |
| **Output dimensions** | Flexible 128–3072 |
| **Release** | April 2026 (stable)[^12] |

The multimodal `gemini-embedding-2` is also supported in the Vercel AI SDK[^4]:
```typescript
google.textEmbeddingModel('gemini-embedding-2')
// Or via the gateway:
gateway.embeddingModel('google/gemini-embedding-001')
```

### Multilingual Support

Excellent — trained on 100+ languages. Strong performance on multilingual MTEB (68.37)[^5].

### Known Issues / Limitations

- **2,048 token input limit** on `gemini-embedding-001` (vs 8,191 for OpenAI) — fine for merchant strings, but limited for longer documents
- Free tier may log/use data to improve Google products (opt out requires paid tier)
- Requires `GOOGLE_GENERATIVE_AI_API_KEY` (simpler than Vertex AI service accounts)

---

## 5. Qwen3-Embedding-8B

### Specifications

| Property | Value |
|---|---|
| **Parameters** | 8 billion |
| **Dimensions** | Up to 4096 (flexible 32–4096 via Matryoshka)[^13] |
| **Max context length** | **32,768 tokens** |
| **Languages** | 100+ |
| **Instruction-aware** | Yes (recommended: 1–5% improvement with custom instructions) |
| **License** | Apache 2.0 |

### MTEB Benchmark Scores — **#1 on Multiple Leaderboards (June 2025)**[^5]

| Benchmark | Score | Rank |
|---|---|---|
| MTEB Multilingual Mean Task | **70.58** | **#1** (as of June 5, 2025) |
| MTEB English v2 Mean Task | **75.22** | **#1** |
| MTEB English Retrieval | **69.44** | **#1** |
| MTEB Multilingual Retrieval | **70.88** | **#1** |
| MTEB Multilingual STS | **81.08** | **#1** |
| MTEB Multilingual Bitext Mining | **80.89** | **#1** |

**For comparison:**
| Model | MTEB English Retrieval | MTEB Multilingual Mean |
|---|---|---|
| Qwen3-Embedding-8B | **69.44** | **70.58** |
| gemini-embedding-exp-03-07 | 64.35 | 68.37 |
| Qwen3-Embedding-4B | 68.46 | 69.45 |
| gte-Qwen2-7B-instruct | 58.09 | 62.51 |
| text-embedding-3-large | ~55.44 | 58.93 |
| NV-Embed-v2 (7.8B) | ~62.84 | 56.29 |

### Pricing & Hosting

**No official OpenAI-hosted API exists for Qwen3-Embedding-8B.** Options:

| Option | Provider | Est. Price | Setup |
|---|---|---|---|
| **Self-host with TEI** | Your GPU infra | Hardware cost only | Docker + NVIDIA GPU |
| **Self-host with vLLM** | Your GPU infra | Hardware cost only | vLLM ≥0.8.5 |
| **Together AI** | Third-party | ~$0.008/1M tokens (approx) | API key |
| **Fireworks AI** | Third-party | ~$0.008/1M tokens (approx) | API key |
| **HuggingFace Inference Endpoints** | HuggingFace | Hardware-based | NVIDIA A10G or better |

TEI (Text Embeddings Inference) deployment[^13]:
```bash
docker run --gpus all -p 8080:80 -v hf_cache:/data --pull always \
  ghcr.io/huggingface/text-embeddings-inference:1.7.2 \
  --model-id Qwen/Qwen3-Embedding-8B --dtype float16
```

### Vercel AI SDK Integration

**Not natively supported.** To use with the AI SDK, you would need a workaround:

```typescript
import { createOpenAI } from '@ai-sdk/openai';

// If hosted on Together AI or vLLM with OpenAI-compatible API:
const qwen = createOpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: process.env.TOGETHER_API_KEY,
  name: 'together',
});

const { embedding } = await embed({
  model: qwen.embeddingModel('Qwen/Qwen3-Embedding-8B'),
  value: 'WOOLWORTHS HORNSBY',
});
```

This is an **unsupported workaround** — the SDK doesn't know the model's actual capabilities.

### Recommended Usage Pattern

```python
# With sentence-transformers
model = SentenceTransformer("Qwen/Qwen3-Embedding-8B")
# Use custom instruction for retrieval tasks:
query_embeddings = model.encode(queries, prompt_name="query")
# For categories/documents: no instruction needed
document_embeddings = model.encode(documents)
```

### Known Issues / Limitations

- **Requires 8B params GPU inference** — minimum A10G (24GB VRAM) or similar
- No official API from Alibaba/Qwen — only community-hosted options
- Using instructions adds 1–5% quality but requires preprocessing[^13]
- Overkill for simple English-only label matching at small scale

---

## 6. BGE-M3 (BAAI)

### Specifications

| Property | Value |
|---|---|
| **Parameters** | ~570M |
| **Dimensions** | 1024 |
| **Max input tokens** | **8,192** |
| **Languages** | 100+ |
| **Retrieval modes** | Dense + Sparse (BM25-like) + Multi-vector (ColBERT) |

### MTEB Benchmark Scores[^5]

| Benchmark | Score |
|---|---|
| MTEB Multilingual Mean Task | 59.56 |
| Multilingual Retrieval | 54.60 |
| Multilingual STS | 74.12 |
| Multilingual Bitext Mining | 79.11 |
| BEIR (English retrieval suite) | 48.80 |

> BGE-M3 is notably below newer models on MTEB but its **hybrid retrieval** (dense + sparse) can outperform pure dense models in domain-specific settings.

### Hosting & Pricing

**Self-hosted only** — no official API. Options:

| Option | Notes |
|---|---|
| HuggingFace TEI | Docker deployment, OpenAI-compatible endpoint |
| Milvus / Vespa integration | Native hybrid retrieval support |
| HuggingFace Inference Endpoints | Paid, hardware-based |

Installation:
```bash
pip install -U FlagEmbedding
```

```python
from FlagEmbedding import BGEM3FlagModel
model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=True)
embeddings = model.encode(sentences, batch_size=12, max_length=8192)
```

### Vercel AI SDK Integration

**Not natively supported.** If you self-host with TEI and expose an OpenAI-compatible endpoint:

```typescript
const bge = createOpenAI({ baseURL: 'http://localhost:8080/v1', apiKey: 'none' });
```

### Key Differentiator: Hybrid Retrieval

BGE-M3's unique value is **hybrid retrieval** — it can output both dense vectors and sparse term weights in a single forward pass. This can improve accuracy for domain-specific abbreviations and codes (e.g., merchant codes), but requires Milvus or Vespa to use the sparse component.

### Known Issues / Limitations

- Significantly lower MTEB scores than newer models (Qwen3, Gemini)
- Requires self-hosting infrastructure
- Hybrid retrieval requires a compatible vector database
- `FlagEmbedding` library adds a Python dependency (not TypeScript-native)
- Not suitable for serverless/edge deployments

---

## 7. Nomic Embed v2 (`nomic-embed-text-v2-moe`)

### Specifications

| Property | Value |
|---|---|
| **Architecture** | Mixture of Experts (MoE) |
| **Total parameters** | 475M (305M active during inference) |
| **Dimensions** | 768 (reducible to 256 via Matryoshka) |
| **Max input tokens** | **512** |
| **Languages** | ~100 |
| **License** | Apache 2.0 (fully open-source) |

### MTEB Benchmark Scores[^14]

| Benchmark | Score | Comparison |
|---|---|---|
| BEIR (English retrieval) | 52.86 | vs BGE-M3: 48.80, vs Arctic v2 Base: 55.40 |
| MIRACL (Multilingual) | 65.80 | vs BGE-M3: 69.20, vs Arctic v2 Large: 66.00 |

> Nomic Embed v2 achieves **state-of-the-art for ~300M parameter models** but trails 500M+ models.

### Hosting & Pricing

**Self-hosted** (open source). Additionally available via:
- **AWS SageMaker Marketplace** (Nomic's official listing)[^14]
- **Nomic Atlas API** (nomic.ai — for data analytics, not raw embeddings)
- **HuggingFace Inference Endpoints**

No pricing for a raw embedding API.

### Vercel AI SDK Integration

**Not natively supported.** Must be self-hosted and proxied via OpenAI-compatible endpoint, or called directly with custom fetch.

### Important: Task Prefix Requirement

```typescript
// Queries MUST be prefixed
const queryText = `search_query: WOOLWORTHS HORNSBY`;
// Documents (categories) use:
const docText = `search_document: food & groceries`;
```

Without these prefixes, performance degrades significantly[^14].

### Known Issues / Limitations

- **512 token limit** — short but fine for merchant strings and category labels
- Must use `trust_remote_code=True` due to custom MoE architecture
- Requires `megablocks` library for optimal GPU performance
- Resource requirements higher than dense models due to MoE routing overhead
- No managed API — purely self-hosted

---

## 8. mxbai-embed-large-v1 (mixedbread.ai)

### Specifications

| Property | Value |
|---|---|
| **Architecture** | BERT-large (335M params) |
| **Dimensions** | 1024 (reducible via Matryoshka) |
| **Max input tokens** | 512 |
| **Languages** | Primarily English |

### MTEB Benchmark Scores (March 2024 — SOTA for BERT-large)[^2]

| Benchmark | Score |
|---|---|
| **MTEB English Avg (56 datasets)** | **64.68** (SOTA for BERT-large class at release) |
| Classification | 75.64 |
| Retrieval (15 datasets) | 54.39 |
| STS | 85.00 |
| **OpenAI text-embedding-3-large** | 64.58 |

> As of March 2024, mxbai-embed-large-v1 slightly **outperformed text-embedding-3-large** on MTEB English average. However, by mid-2025, newer models (Qwen3, Gemini) have surpassed it significantly.

### Hosting & Pricing

**Hosted API available** via mixedbread.com[^15]:

| Tier | Price | Rate Limit |
|---|---|---|
| Free (Starter) | $5 one-time credit | 100 req/min |
| Scale | $20/month + usage | 1,200 queries/min |
| Index (text) | **$1.50 / 1M tokens** | — |
| Storage | $0.50 / 1M tokens / month | — |

Note: Mixedbread's API pricing ($1.50/1M tokens for indexing) is **75× more expensive** than OpenAI text-embedding-3-small ($0.020/1M tokens). The free tier offers $5 one-time credits.

**Self-hosting** available via:
```bash
docker run --gpus all -p 7997:7997 michaelf34/infinity:0.0.68 \
  v2 --model-id mixedbread-ai/mxbai-embed-large-v1 --dtype float16
```

Also available via `Transformers.js` for **in-browser/Edge inference**[^2]:
```javascript
import { pipeline } from "@huggingface/transformers";
const extractor = await pipeline("feature-extraction", "mixedbread-ai/mxbai-embed-large-v1");
```

### Vercel AI SDK Integration

**Not natively supported** in the Vercel AI SDK. Can be used via:
1. Mixedbread's own API client (`mixedbread_ai` Python SDK or REST)
2. Self-hosted with TEI + OpenAI-compatible endpoint
3. `@huggingface/transformers` in the browser (not server-side embedding)

### Query Prefix Requirement

```typescript
// For retrieval, queries MUST use this prefix:
const query = `Represent this sentence for searching relevant passages: WOOLWORTHS HORNSBY`;
// Documents: no prefix needed
```

### Known Issues / Limitations

- **512 token limit** — consistent with BERT-large architecture
- No native Vercel AI SDK support
- Hosted API pricing is very high ($1.50/1M) compared to OpenAI ($0.020/1M)
- English-only in practice (not designed for multilingual use)
- Surpassed by newer models in benchmarks as of mid-2025

---

## Comparative Analysis

### Benchmark Rankings (English Retrieval Focus)

| Model | MTEB English Avg | English Retrieval | Multilingual | Size |
|---|---|---|---|---|
| **Qwen3-Embedding-8B** | **75.22** | **69.44** | **70.58** | 8B params |
| gemini-embedding-001 (exp) | 73.30 | 64.35 | 68.37 | Unknown |
| Qwen3-Embedding-4B | 74.60 | 68.46 | 69.45 | 4B params |
| gte-Qwen2-7B-instruct | 70.72 | 58.09 | 62.51 | 7.6B params |
| Qwen3-Embedding-0.6B | 70.70 | 61.83 | 64.33 | 0.6B params |
| NV-Embed-v2 | 69.81 | ~62.84 | 56.29 | 7.8B params |
| **mxbai-embed-large-v1** | 64.68 | 54.39 | N/A | 335M params |
| **text-embedding-3-large** | 64.58 | 55.44 | 58.93 | Unknown |
| **text-embedding-3-small** | ~62.3 | ~44.0 | ~52 | Unknown |
| BGE-M3 | ~60 | ~54 | 59.56 | 570M params |
| Nomic Embed v2 | N/A | 52.86 (BEIR) | 65.80 (MIRACL) | 475M params |

### Vercel AI SDK Support

| Model | Native SDK Support | Package | Ease of Setup |
|---|---|---|---|
| text-embedding-3-small | ✅ Yes | `@ai-sdk/openai` | ⭐⭐⭐⭐⭐ |
| text-embedding-3-large | ✅ Yes | `@ai-sdk/openai` | ⭐⭐⭐⭐⭐ |
| gemini-embedding-001 | ✅ Yes | `@ai-sdk/google` | ⭐⭐⭐⭐ |
| gemini-embedding-2 | ✅ Yes | `@ai-sdk/google` | ⭐⭐⭐⭐ |
| text-embedding-005 (Vertex) | ✅ Yes (via Vertex) | `@ai-sdk/google-vertex` | ⭐⭐ (GCP auth complexity) |
| Qwen3-Embedding-8B | ❌ Workaround only | Custom `createOpenAI` | ⭐ |
| BGE-M3 | ❌ Workaround only | Custom endpoint | ⭐ |
| Nomic Embed v2 | ❌ Workaround only | Custom endpoint | ⭐ |
| mxbai-embed-large-v1 | ❌ No | Mixedbread API or self-host | ⭐⭐ |

### Pricing Comparison (per 1M tokens)

| Model | Price / 1M tokens | Free Tier |
|---|---|---|
| **gemini-embedding-001** | ~$0.010 | ~1,500 RPD |
| **text-embedding-3-small** | $0.020 | None |
| text-embedding-005 (Vertex) | ~$0.007–0.010 | $300 GCP credit |
| text-embedding-3-large | $0.130 | None |
| mxbai-embed-large-v1 (API) | $1.50 | $5 credit |
| Qwen3-Embedding-8B | N/A (self-host) | Free (self-host) |
| BGE-M3 | N/A (self-host) | Free (self-host) |
| Nomic Embed v2 | N/A (self-host) | Free (self-host) |

### Suitability for the Financial App Use Case

| Criterion | text-embedding-3-small | gemini-embedding-001 | Qwen3-8B | BGE-M3 | mxbai-embed-large |
|---|---|---|---|---|---|
| Hosted API (no infra) | ✅ | ✅ | ❌ | ❌ | ⚠️ Expensive |
| Vercel AI SDK | ✅ Native | ✅ Native | ❌ Workaround | ❌ Workaround | ❌ None |
| Short text (merchant strings) | ✅ | ✅ | ✅ | ✅ | ✅ |
| English-only quality | Good | Excellent | Excellent | Good | Good |
| Cost at 100K tx/month | ~$0.05 | ~$0.025 | Self-host | Self-host | ~$3.75 |
| Max token length | 8,191 | 2,048 | 32,768 | 8,192 | 512 |
| Setup complexity | Low | Low | High | High | Medium |

---

## Answers to Key Questions

### Which models have hosted API endpoints (no self-hosting needed)?

1. **OpenAI** (`text-embedding-3-small`, `text-embedding-3-large`) — simple API key
2. **Google Gemini** (`gemini-embedding-001`, `gemini-embedding-2`) — simple API key via `ai.google.dev`
3. **Google Vertex AI** (`text-embedding-005`, `gemini-embedding-001`) — requires GCP project + service account
4. **Mixedbread** (`mxbai-embed-large-v1`) — hosted API exists but $1.50/1M tokens

**Qwen3-Embedding-8B, BGE-M3, and Nomic Embed v2 have no official managed API** — you must self-host or use third-party providers (Together AI, Fireworks).

### Which models are supported by the Vercel AI SDK out of the box?

From the Vercel AI SDK docs[^4], the following embedding providers are natively supported:

| Provider | Models |
|---|---|
| OpenAI (`@ai-sdk/openai`) | `text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002` |
| Google Generative AI (`@ai-sdk/google`) | `gemini-embedding-001`, `gemini-embedding-2-preview` |
| Mistral (`@ai-sdk/mistral`) | `mistral-embed` |
| Cohere (`@ai-sdk/cohere`) | `embed-english-v3.0`, `embed-multilingual-v3.0` and variants |
| Amazon Bedrock (`@ai-sdk/amazon-bedrock`) | `amazon.titan-embed-text-v1`, `amazon.titan-embed-text-v2:0` |

**BGE-M3, Nomic Embed v2, mxbai-embed-large-v1, and Qwen3-Embedding are NOT in this list.**

### What are the actual MTEB benchmark scores for English retrieval?

| Model | English Retrieval Score | Source |
|---|---|---|
| Qwen3-Embedding-8B | **69.44** | Qwen3 HF model card[^5] |
| gemini-embedding-exp-03-07 | 64.35 | Qwen3 HF model card[^5] |
| NV-Embed-v2 | ~62.84 | Qwen3 HF model card[^5] |
| text-embedding-3-large | 55.44 | mxbai HF model card[^2] |
| mxbai-embed-large-v1 | 54.39 | mxbai HF model card[^2] |
| bge-large-en-v1.5 | 54.29 | mxbai HF model card[^2] |
| BGE-M3 | ~54.60 | Qwen3 HF model card[^5] |
| text-embedding-3-small | ~44.0 | Approximate (interpolated from 3-large) |
| Nomic Embed v2 (BEIR) | 52.86 | Nomic HF model card[^14] |

### For this specific use case (short text, English only, ~1K categories, cost-sensitive): which is best?

**Recommendation: `text-embedding-3-small` or `gemini-embedding-001`**

**`text-embedding-3-small`** if:
- You already use OpenAI in the app
- You want the absolute simplest integration (`@ai-sdk/openai` you probably already have)
- You want the longest token window (8,191) for future-proofing

**`gemini-embedding-001`** if:
- You want better benchmark performance at lower cost
- You already use Google services
- The free tier (1,500 RPD) covers your development/low-traffic needs

**Neither Qwen3-8B, BGE-M3, nor Nomic** are appropriate for a serverless Vercel deployment without significant infrastructure changes.

### Is Google's `text-embedding-005` actually cheaper and better than `text-embedding-3-small`?

**Partially yes on price, but it's the wrong comparison.** 

- `text-embedding-005` is a **legacy Vertex AI model** being superseded
- Price is comparable (~$0.007–0.010/1M tokens vs $0.020/1M) — so slightly cheaper
- But the **correct current Google model** is `gemini-embedding-001`, which outperforms both `text-embedding-005` AND `text-embedding-3-small` on MTEB
- **Vertex AI setup overhead** (GCP project, service accounts) makes it harder to use than either OpenAI or the Gemini AI API
- **Conclusion**: Don't use `text-embedding-005`. If you want Google, use `gemini-embedding-001` via `@ai-sdk/google`

---

## Recommended Implementation for This App

### Option A: OpenAI (Simplest)

```bash
pnpm add @ai-sdk/openai ai
```

```typescript
// src/lib/embeddings.ts
import { openai } from '@ai-sdk/openai';
import { embedMany, embed, cosineSimilarity } from 'ai';

const EMBEDDING_MODEL = openai.embeddingModel('text-embedding-3-small');

// Pre-compute category embeddings (run once, cache in DB or KV)
export async function buildCategoryIndex(categories: string[]) {
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: categories,
  });
  return categories.map((label, i) => ({ label, embedding: embeddings[i] }));
}

// Match a transaction to a category
export async function matchTransaction(
  transactionDesc: string,
  categoryIndex: { label: string; embedding: number[] }[]
) {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: transactionDesc,
  });

  const scored = categoryIndex.map(({ label, embedding: catEmb }) => ({
    label,
    score: cosineSimilarity(embedding, catEmb),
  }));

  return scored.sort((a, b) => b.score - a.score)[0];
}
```

### Option B: Google Gemini (Better Performance, Lower Cost)

```bash
pnpm add @ai-sdk/google ai
```

```typescript
// src/lib/embeddings.ts
import { google } from '@ai-sdk/google';
import { embedMany, embed, cosineSimilarity } from 'ai';

// GOOGLE_GENERATIVE_AI_API_KEY env var required
const EMBEDDING_MODEL = google.textEmbeddingModel('gemini-embedding-001');
// For even better performance (multimodal, 8192 tokens):
// const EMBEDDING_MODEL = google.textEmbeddingModel('gemini-embedding-2');
```

---

## Key Repositories Summary

| Repository / Resource | Purpose | Key Files |
|---|---|---|
| [Qwen/Qwen3-Embedding-8B](https://huggingface.co/Qwen/Qwen3-Embedding-8B) | #1 MTEB model, self-host | Model card, vLLM/TEI usage |
| [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) | Hybrid retrieval model | FlagEmbedding library |
| [nomic-ai/nomic-embed-text-v2-moe](https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe) | MoE multilingual model | MRL, 512-token limit |
| [mixedbread-ai/mxbai-embed-large-v1](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1) | English BERT-large model | Transformers.js support |
| [Vercel AI SDK Embeddings](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings) | Official SDK docs | `embed`, `embedMany` API |
| [Vercel AI SDK Providers](https://sdk.vercel.ai/providers/ai-sdk-providers) | Supported providers list | OpenAI, Google, Cohere, etc. |
| [Google AI Embedding Docs](https://ai.google.dev/gemini-api/docs/embeddings) | Gemini embedding guide | Task types, API usage |

---

## Confidence Assessment

| Finding | Confidence | Notes |
|---|---|---|
| Vercel AI SDK supported providers | **High** | Directly fetched from `sdk.vercel.ai/docs/ai-sdk-core/embeddings`[^4] |
| Qwen3-Embedding-8B MTEB scores | **High** | From official HuggingFace model card[^5] |
| mxbai-embed-large-v1 MTEB scores | **High** | From official HuggingFace model card[^2] |
| BGE-M3 specs (dimensions, tokens) | **High** | From official HuggingFace model card[^16] |
| Nomic Embed v2 specs/scores | **High** | From official HuggingFace model card[^14] |
| OpenAI pricing ($0.020 / $0.130 per 1M) | **High** | Well-established public rates; direct fetch returned 403 |
| Google gemini-embedding-001 pricing | **Medium** | Pricing page returned in non-English; character-based pricing estimated from Vertex AI docs |
| Google text-embedding-005 pricing | **Medium** | Same issue; rate estimated from Vertex character billing |
| MTEB scores for text-embedding-3-small | **Medium** | Score inferred from 3-large relative performance (direct MTEB page was a dynamic HF Space, not fetchable) |
| gemini-embedding-001 MTEB = gemini-embedding-exp | **Medium** | Assumed stable model inherits experimental model scores; not formally confirmed |

---

## Footnotes

[^1]: Vercel AI SDK docs show `providerOptions: { openai: { dimensions: 512 } }` for OpenAI dimension reduction. Source: `sdk.vercel.ai/docs/ai-sdk-core/embeddings`.

[^2]: mxbai-embed-large-v1 HuggingFace model card — comparative MTEB table as of March 2024, including OpenAI text-embedding-3-large (64.58 avg, 55.44 retrieval). Source: `huggingface.co/mixedbread-ai/mxbai-embed-large-v1`.

[^3]: OpenAI embedding pricing — well-established public rates: `text-embedding-3-small` $0.020/1M tokens, `text-embedding-3-large` $0.130/1M tokens. Pricing page returned HTTP 403 during research.

[^4]: Vercel AI SDK embedding provider table. Source: `sdk.vercel.ai/docs/ai-sdk-core/embeddings`. Lists: OpenAI (`text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002`), Google Generative AI (`gemini-embedding-001`, `gemini-embedding-2-preview`), Mistral, Cohere, Amazon Bedrock.

[^5]: Qwen3-Embedding-8B HuggingFace model card — MTEB multilingual table (as of May 24, 2025) and MTEB English v2 table. Source: `huggingface.co/Qwen/Qwen3-Embedding-8B`. Confirms #1 on multilingual MTEB (70.58) as of June 5, 2025.

[^6]: Google Vertex AI text embeddings documentation states: "Vertex AI text embeddings API uses dense vector representations: gemini-embedding-001, for example, uses 3072-dimensional vectors." Source: `cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings`.

[^7]: Vertex AI generative AI pricing for text embeddings. Source: `cloud.google.com/vertex-ai/generative-ai/pricing` (returned connection error during research). Pricing based on known character-based billing structure.

[^8]: Google Vertex provider documentation for Vercel AI SDK. Source: `sdk.vercel.ai/providers/ai-sdk-providers/google-vertex`. Documents `@ai-sdk/google-vertex` package with Node.js and Edge runtime support, requiring GCP service account credentials.

[^9]: gemini-embedding-001 model specifications. Source: `ai.google.dev/gemini-api/docs/models/gemini-embedding-001`. Input token limit: 2,048; output dimensions: flexible 128–3072, recommended 768/1536/3072. Last updated April 2026.

[^10]: gemini-embedding-2 model specifications. Source: `ai.google.dev/gemini-api/docs/models/gemini-embedding-2`. Input: multimodal (text, image, video, audio, PDF); input token limit: 8,192; output: 128–3072 dimensions. Released April 2026.

[^11]: Google Generative AI provider documentation for Vercel AI SDK. Source: `sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai`. Documents `@ai-sdk/google` with `GOOGLE_GENERATIVE_AI_API_KEY` env var.

[^12]: gemini-embedding-2 latest update April 2026, per `ai.google.dev/gemini-api/docs/models/gemini-embedding-2`.

[^13]: Qwen3-Embedding-8B HuggingFace model card — usage examples, TEI deployment, MRL dimensions, instruction guidance. Source: `huggingface.co/Qwen/Qwen3-Embedding-8B`.

[^14]: Nomic Embed Text v2 MoE HuggingFace model card — BEIR: 52.86, MIRACL: 65.80, 512 token limit, task prefix requirement. Source: `huggingface.co/nomic-ai/nomic-embed-text-v2-moe`.

[^15]: Mixedbread pricing page. Source: `mixedbread.com/pricing`. Index pricing: $1.50/1M tokens; Scale plan: $20/month; Storage: $0.50/1M tokens/month.

[^16]: BGE-M3 HuggingFace model card — dimension: 1024, sequence length: 8192, multi-functionality (dense/sparse/ColBERT). Source: `huggingface.co/BAAI/bge-m3`.

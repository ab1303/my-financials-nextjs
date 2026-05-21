# Finance Chat Assistant — LLD

## Implementation
- **API Endpoint:** POST /api/ai-chat/route.ts
- **Prompt Engineering:**
  - System prompt: restrict to finance domain, privacy rules
  - User prompt: user query + context
- **LLM Integration:**
  - Vercel AI SDK, OpenAI, or GitHub Models
  - Model selection via env vars
- **Usage Logging:**
  - Log all chat completions to AIUsageLog
  - Track tokens, cost, user, session
- **(Future) RAG:**
  - Integrate with financial data sources for retrieval
- **File Inventory:**
  - src/app/api/ai-chat/route.ts
  - src/server/services/ai-chat/prompt.ts
  - src/constants/ai-pricing.ts
  - prisma/schema.prisma

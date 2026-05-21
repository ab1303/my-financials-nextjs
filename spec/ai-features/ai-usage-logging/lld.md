# AI Usage Logging — LLD

## Implementation
- **Database Model:** AIUsageLog (prisma/schema.prisma)
  - Fields: id, sessionId, userId, imageId, importType, model, promptTokens, completionTokens, totalTokens, estimatedCostUSD, createdAt
- **Logging:**
  - All AI calls (vision, chat, embeddings) log usage
  - Usage logged at time of API call
  - Linked to ImportSession, ImportImage, Transaction
- **Reporting:**
  - Aggregate by user, feature, model
  - Cost analysis for billing/audit
  - Analytics queries on AIUsageLog
- **File Inventory:**
  - prisma/schema.prisma
  - src/server/services/ai-import/ai-vision.service.ts
  - src/server/services/ai-import/category-matcher.service.ts
  - src/constants/ai-pricing.ts

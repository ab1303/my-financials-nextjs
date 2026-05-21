# AI Image Import — LLD

## Implementation
- **API Endpoints:**
  - POST /api/transactions/ai/upload (multipart/form-data)
  - POST /api/transactions/ai/parse (SSE)
  - POST /api/transactions/ai/confirm
  - GET /api/ai-import/image/[id]
  - POST /api/ai-import/cleanup
- **Database Models:** ImportSession, ImportImage, AIUsageLog (see prisma/schema.prisma)
- **Storage:** LocalStorageAdapter, S3StorageAdapter
- **AI Service:** extractExpenseData() via Vercel AI SDK
- **Validation:** Zod schemas, file checks
- **Category Matching:** matchCategoryWithEmbedding() (4-tier: exact, substring, fuzzy, embedding)
- **Audit Trail:** ImportImage links to Transaction, MonthlyExpenseSummary
- **Cleanup:** setImageExpiration(), deleteExpiredImages()

## File Inventory
- src/app/api/transactions/ai/upload/route.ts
- src/app/api/transactions/ai/parse/route.ts
- src/app/api/transactions/ai/confirm/route.ts
- src/app/api/ai-import/image/[id]/route.ts
- src/app/api/ai-import/cleanup/route.ts
- src/server/services/ai-import/ai-vision.service.ts
- src/server/services/ai-import/image-storage.adapter.ts
- src/server/services/ai-import/category-matcher.service.ts
- src/server/services/ai-import/validation.ts
- src/server/services/ai-import/cleanup.service.ts
- src/server/services/ai-import/_types.ts
- src/constants/ai-pricing.ts
- prisma/schema.prisma

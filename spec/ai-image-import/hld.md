# AI Image Import — High-Level Design

## 1. Feature Overview

The **AI Image Import** feature enables authenticated users to extract financial data from screenshots of their banking apps through an AI vision model. Users upload one or more images, receive structured extraction with confidence scores, and automatically create financial records (transactions, expense summaries, or bank asset snapshots).

### Key Capabilities
1. **Multi-image batch upload** with drag-and-drop support (up to 10 images, 10MB each)
2. **Provider-agnostic AI vision pipeline** (GitHub Models free tier, OpenAI GPT-4o, or custom providers)
3. **Auto-save with post-import review** — extracted data creates records immediately; users can confirm/edit before finalization
4. **Image audit trail** — all images stored with user-scoped access; linked to created records for provenance
5. **Confidence scoring** — AI returns per-image and overall confidence (High ≥85%, Medium 60–84%, Low <60%)
6. **Error isolation** — one failed image doesn't block processing of others

### Supported Import Types
- **EXPENSE** (Active): Extract category-amount pairs from banking app expense summaries
- **BANK_ASSET** (Out of scope): Extract account names and balances (separate feature)

---

## 2. Architecture Overview

### High-Level Flow

```
User opens wizard
    ↓
[Upload Step] User selects/drags images
    ↓
Images validated & stored via storage adapter
    ↓
ImportImage records created
    ↓
[Processing Step] User clicks "Start Import"
    ↓
POST /api/transactions/ai/parse
    ├─ Create ImportSession (PROCESSING)
    ├─ For each image (via SSE):
    │   ├─ Fetch image buffer from storage
    │   ├─ Call AI vision to extract structured data
    │   ├─ Validate response against Zod schema
    │   ├─ Log token usage
    │   └─ Stream progress + extracted data to client
    ├─ Update ImportSession with all results
    └─ Close stream
    ↓
[Review Step] User reviews extracted entries
    ↓
POST /api/transactions/ai/confirm
    ├─ For each confirmed entry:
    │   ├─ Match category via embedding-based fuzzy matching
    │   ├─ Create Transaction record
    │   ├─ Update MonthlyExpenseSummary
    │   └─ Link to ImportImage for audit trail
    ├─ Log embedding usage
    └─ Update ImportSession (COMPLETED)
    ↓
[Results Step] Show summary + actions
    ↓
router.refresh() → UI updates with new records
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Next.js App                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Frontend (Client Components)                                            │
│  ├─ AIImportWizard.tsx (4-step modal)                                   │
│  ├─ UploadStep.tsx (react-dropzone)                                      │
│  ├─ ProcessingStep.tsx (SSE streaming)                                   │
│  ├─ ReviewStep.tsx (user confirmation)                                   │
│  └─ ResultsStep.tsx (summary)                                            │
│                                                                           │
│  ↓ API Layer (Route Handlers)                                            │
│                                                                           │
│  POST /api/transactions/ai/upload                                        │
│  ├─ Validate files (MIME, size, dimensions)                              │
│  ├─ Call StorageAdapter.uploadImage()                                    │
│  ├─ Create ImportImage records                                           │
│  ├─ Set image expiration (TTL)                                           │
│  └─ Return imageIds + metadata                                           │
│                                                                           │
│  POST /api/transactions/ai/parse (SSE stream)                            │
│  ├─ Auth + validation                                                    │
│  ├─ Create ImportSession (PROCESSING)                                    │
│  ├─ For each imageId:                                                    │
│  │   ├─ Get image buffer from StorageAdapter                             │
│  │   ├─ Call AIVisionService.extractExpenseData()                        │
│  │   ├─ Stream progress to client                                        │
│  │   ├─ Log AIUsageLog record                                            │
│  │   └─ Handle errors (non-blocking)                                     │
│  ├─ Update ImportSession with complete metadata                          │
│  └─ Stream final results                                                 │
│                                                                           │
│  POST /api/transactions/ai/confirm                                       │
│  ├─ Auth + validation                                                    │
│  ├─ Get/create ExpenseLedger                                             │
│  ├─ For each confirmed entry:                                            │
│  │   ├─ Match category via CategoryMatcherService                        │
│  │   ├─ Create/update MonthlyExpenseSummary                              │
│  │   ├─ Create Transaction (source = LLM_CLASSIFIED)                     │
│  │   └─ Link to ImportImage + ImportSession                              │
│  ├─ Log embedding usage                                                  │
│  └─ Update ImportSession (COMPLETED)                                     │
│                                                                           │
│  ↓ Services (Business Logic)                                             │
│                                                                           │
│  AIVisionService                                                         │
│  ├─ extractExpenseData(imageBuffer, categories)                          │
│  ├─ Calls Vercel AI SDK (GitHub Models / OpenAI)                         │
│  ├─ Returns structured { entries, confidence, warnings, usage }          │
│  └─ Validates with Zod schemas                                           │
│                                                                           │
│  ImageStorageAdapter (pluggable)                                         │
│  ├─ LocalStorageAdapter → /uploads/ai-imports/                           │
│  ├─ S3StorageAdapter → AWS S3 + pre-signed URLs                          │
│  └─ VercelBlobStorageAdapter → (future)                                  │
│                                                                           │
│  CategoryMatcherService                                                  │
│  ├─ matchCategoryWithEmbedding(name, categories)                         │
│  ├─ 4-tier matching: exact → substring → fuzzy → embedding               │
│  └─ Returns matched category + similarity score                          │
│                                                                           │
│  ↓ Database Layer (Prisma ORM)                                           │
│                                                                           │
│  ImportSession (header record)                                           │
│  ImportImage (uploaded images)                                           │
│  Transaction (individual line items)                                     │
│  MonthlyExpenseSummary (aggregate per category/month, with importImage FK)│
│  AIUsageLog (token tracking)                                             │
│                                                                           │
│  ↓ Data Store                                                            │
│                                                                           │
│  PostgreSQL (transactional)                                              │
│  Image Storage (Local | S3 | Vercel Blob)                                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model & Schema

### Entity Relationships

```
User
  ├─ ImportSession (1:N) — tracks import batches
  │   ├─ ImportImage[] — uploaded images
  │   ├─ AIUsageLog[] — token usage per image
  │   ├─ Transaction[] — created transactions
  │   └─ startDate / endDate — date range of transactions
  │
  ├─ ImportImage (1:N) — uploaded images (user-scoped)
  │   ├─ sessionId FK — link to parent session
  │   ├─ MonthlyExpenseSummary[] — audit trail (FK importImageId)
  │   ├─ BankBalanceRecord[] — (future bank assets)
  │   └─ expiresAt — TTL for cleanup
  │
  ├─ Transaction (1:N) — individual line items
  │   ├─ importSessionId FK — link to parent session
  │   └─ category, amount, date, type (DEBIT), source (LLM_CLASSIFIED)
  │
  └─ AIUsageLog (1:N) — token tracking
      ├─ sessionId FK
      ├─ imageId (optional)
      └─ promptTokens, completionTokens, estimatedCostUSD
```

### Key Enums

| Enum | Values |
|------|--------|
| **ImportTypeEnum** | EXPENSE, BANK_ASSET |
| **ImportStatusEnum** | PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED |
| **StorageProviderEnum** | LOCAL, VERCEL_BLOB, S3 |
| **TransactionSourceEnum** | ... LLM_CLASSIFIED ... |
| **TransactionStatusEnum** | PENDING, CONFIRMED |

### State Transitions (ImportSession)

```
Created (PENDING)
    ↓
Parsing (PROCESSING)
    ├─ One or more images succeeded → COMPLETED
    ├─ All images failed → FAILED
    └─ Some succeeded, some failed → PARTIAL
```

---

## 4. Storage Architecture

### Storage Adapter Pattern

The system uses a **pluggable storage adapter** to support multiple backends without code changes:

```typescript
interface IImageStorageAdapter {
  uploadImage(file: Buffer, mimeType, userId, originalFileName) → StorageResult
  deleteImage(storageUrl) → void
  getImageBuffer(storageUrl) → Buffer
}
```

### Implementations

| Provider | Storage Path | Return Value | Auth | Cost |
|----------|--------------|--------------|------|------|
| **Local** | `/uploads/ai-imports/{userId}/{uuid}.ext` | Relative file path | Filesystem | Free |
| **S3** | `s3://{bucket}/ai-imports/{userId}/{uuid}.ext` | S3 key + 60s pre-signed URL via proxy | IAM role | ~$0.02–0.05 per image |
| **Vercel Blob** | Managed by Vercel | Blob token URL | Bearer token | Pay-as-you-go |

### Selection & Configuration

```bash
IMAGE_STORAGE_PROVIDER=local  # or 's3' or 'vercel-blob'
```

**Security Model**:
- **Development**: All users can access all files (filesystem-level)
- **Production (S3)**: Private bucket; retrieval only via secure proxy with ownership checks
- **User Scoping**: All paths include `{userId}`, preventing cross-user access

---

## 5. AI Vision Pipeline

### Provider Support

| Provider | Model | Cost | Benefits |
|----------|-------|------|----------|
| **GitHub Models** (Free Tier) | gpt-4o-mini | $0 | Free tier included in GitHub account |
| **OpenAI** | gpt-4o, gpt-4-turbo-vision | ~$0.01–0.03 per image | Fastest, most accurate |
| **Custom** | Any OpenAI-compatible API | Varies | Via baseURL override |

### Configuration

```bash
AI_PROVIDER=github                  # 'github' or 'openai'
AI_VISION_MODEL=gpt-4o-mini        # Model identifier
AI_API_KEY=<github-pat-or-openai-key>
AI_BASE_URL=<optional-custom-endpoint>
```

### Vision Service Flow

```
1. Client sends image to POST /api/transactions/ai/upload
2. Image stored via StorageAdapter
3. Client initiates parse via POST /api/transactions/ai/parse (SSE)
4. Server retrieves image buffer: StorageAdapter.getImageBuffer(storageUrl)
5. Encode to base64, prepare prompt
6. Call Vercel AI SDK: generateText()
   ├─ Provider: GitHub Models or OpenAI (based on env)
   ├─ Model: gpt-4o-mini or gpt-4o (configurable)
   ├─ Input: base64 image + expense category list
   └─ Output: Structured JSON { entries[], confidence, warnings }
7. Validate response against ExpenseExtractionSchema (Zod)
8. Extract token usage from response
9. Return to client via SSE
10. Log AIUsageLog record asynchronously
```

### Extraction Output Format

```json
{
  "confidence": 0.92,
  "entries": [
    { "categoryName": "Groceries", "amount": 450.23 },
    { "categoryName": "Transport", "amount": 125.00 }
  ],
  "warnings": ["Could not identify category for 'Misc $30'"]
}
```

---

## 6. Category Matching Strategy

### 4-Tier Fallback Matching

The system attempts to map AI-extracted category names to existing ExpenseCategory records:

```
Tier 1: EXACT MATCH (case-insensitive)
  "Groceries" → ExpenseCategory(name="Groceries")
  
Tier 2: SUBSTRING MATCH
  "Food & Dining" → contains "Food" → ExpenseCategory(name="Food")
  
Tier 3: FUZZY MATCH (Levenshtein distance ≥ 0.75)
  "Grocieries" (typo) → similarity 0.88 → ExpenseCategory(name="Groceries")
  
Tier 4: EMBEDDING-BASED MATCH (via AI embeddings)
  "Petrol" → semantically similar to "Transportation" → ExpenseCategory(name="Transportation")
  
Fallback: No match found → "Other" category with warning
```

### Embedding Service

**File**: `src/server/services/ai-import/category-matcher.service.ts`

- Uses embeddings to find semantic similarity between extracted names and valid categories
- Called during **confirm** step (not parse) to avoid redundant API calls
- Logs embedding token usage separately (lower cost than vision model)
- Returns: `{ matched: boolean, categoryName: string | null, similarity: 0-1, method }`

---

## 7. Key Flows

### Upload Flow
1. User selects/drags files in UploadStep
2. Client validates MIME type + size locally
3. Client sends to `POST /api/transactions/ai/upload` (multipart)
4. Server validates again (MIME, size, dimensions, count)
5. Server calls `StorageAdapter.uploadImage()` for each file
6. Creates ImportImage record with sessionId = '' (pending session)
7. Calls `setImageExpiration()` to set TTL
8. Returns imageIds to client
9. Background cleanup runs (non-blocking)

### Parse Flow (SSE)
1. User clicks "Start Import" in ProcessingStep
2. Client opens SSE connection to `POST /api/transactions/ai/parse`
3. Server creates ImportSession (PROCESSING status)
4. Server updates all ImportImage records with sessionId
5. **For each image**:
   - Stream `progress` event
   - Fetch image buffer from storage
   - Call `extractExpenseData()` → AI vision
   - Stream `extracted` event with results
   - Log AIUsageLog
   - On error: stream `error` event (non-blocking)
6. Update ImportSession with final metadata
7. Stream `complete` event with all results
8. Client closes SSE connection

### Confirm Flow
1. User reviews extracted entries in ReviewStep
2. User confirms/unchecks individual entries (client-side state)
3. Client sends `POST /api/transactions/ai/confirm` with confirmed entries
4. Server validates session ownership + context
5. Gets/creates ExpenseLedger
6. **For each confirmed entry**:
   - Call `matchCategoryWithEmbedding()` → gets matched category
   - Create/update MonthlyExpenseSummary
   - Create Transaction (source=LLM_CLASSIFIED)
   - Log embedding usage
7. Update ImportSession (COMPLETED) with recordsCreated
8. Return response with recordsCreated, status
9. Client shows ResultsStep with summary

### Cleanup Flow
1. Background job triggered after upload
2. Queries ImportImage where expiresAt < now()
3. Calls `StorageAdapter.deleteImage()` for each
4. Deletes ImportImage record from DB
5. Logs any errors (non-blocking)

---

## 8. Error Handling & Resilience

### Upload Errors (Blocking)
- Invalid MIME type → 400 Bad Request + message
- File too large → 400 Bad Request + message
- Exceeds image limit (10) → 400 Bad Request + message
- Session auth missing → 401 Unauthorized

### Parse Errors (Non-Blocking Per Image)
- Image not found in DB → stream error event, continue
- AI provider timeout → stream error event, continue
- Malformed AI response (fails Zod validation) → stream error event, continue
- Storage read failure → stream error event, continue

### Session-Level Failures
- If **all** images fail → ImportSession.status = FAILED
- If **some** images fail → ImportSession.status = PARTIAL
- If **all** images succeed → ImportSession.status = COMPLETED

### Confirm Errors (Partial Success)
- Category matching failure → skip entry (continue processing others)
- Database constraint violation → catch and update session.status = PARTIAL

---

## 9. Security Model

### Authentication
- All endpoints require NextAuth session (`auth()`)
- User ID extracted from session (server-side, never from client)

### Authorization
- Users can only access their own ImportSession records
- Users can only access their own ImportImage records
- Users can only create records for their own ExpenseLedger
- Storage adapter enforces user-scoped paths ({{ userId }})

### Input Validation
- Strict MIME type allowlist (PNG, JPEG, WebP, HEIC)
- File size limits (10MB per file)
- Image dimension limits (50–4096 px)
- Image content validation (actual image magic bytes)
- Request body validation (Zod schemas)
- Database FK + ownership checks before any mutation

### Data Privacy
- Images stored in user-scoped directories
- No image data sent to third parties except configured AI provider
- AI provider terms: images processed but not retained (verify with provider)
- Cloud storage (S3) uses private bucket + signed URLs for 60s retrieval
- Option to delete images after import (future enhancement)

---

## 10. Scalability & Performance

### Constraints (MVP)
- Max 10 images per upload session
- Max 10MB per image
- Max 50 import sessions per user per month (no hard limit enforced)
- Single user per session (no multi-user imports)

### Performance Targets
- Upload: 3s per file (network-dependent)
- AI parsing: 10s per image (provider-dependent)
- Full pipeline (5 images): ~60s
- UI remains responsive (SSE doesn't block)

### Bottlenecks & Mitigation
| Bottleneck | Cause | Mitigation |
|-----------|-------|-----------|
| AI API latency | Vision model inference | Use faster model (gpt-4o-mini instead of gpt-4o); batch requests where possible |
| Network upload | File transfer | Client-side compression (future); limit file count per session |
| Database writes | Many Transaction inserts per session | Batch inserts; connection pooling via Prisma |
| Storage I/O | Read/write images | Local filesystem faster than cloud; S3 async optional |
| Memory | Large image buffers | Stream processing (currently loads entire image into memory); future optimization |

### Monitoring
- AIUsageLog records track token usage per session/model/image
- Can query costs per user, per day, per month
- Performance metrics via Next.js Edge Middleware (future)

---

## 11. Cost Model

### Pricing Breakdown

| Component | Unit Cost | Driver |
|-----------|-----------|--------|
| **Vision Model (GPT-4o-mini)** | ~$0.0025 per image | Tokens: avg 800 prompt + 100 completion |
| **Embedding Model** | ~$0.0005 per image | Tokens: avg 50 prompt (just category names) |
| **Storage (S3)** | $0.023 per GB/month | Depends on image size (avg 500KB per image) |
| **Data Transfer (S3)** | $0.09 per GB out | Only on retrieval/proxy (minimal for audit trail) |
| **Database** | Depends on provider | Prisma ORM overhead negligible |

### Example Cost per User
- 10 imports per month × 3 images per import = 30 images
- Vision: 30 × $0.0025 = $0.075
- Embedding: 30 × $0.0005 = $0.015
- Storage: (30 × 0.5 MB) × 12 months ÷ (1024) × $0.023 ≈ $0.004
- **Total: ~$0.094 per user per month**

### Cost Optimization
- Disable embedding-based matching for common categories (use fuzzy only)
- Cache embeddings for category names (pre-compute once)
- Compress images before storage (lossless PNG optimization)
- Delete images after N days (currently 7 days default)

---

## 12. Known Limitations & Future Work

### MVP Limitations
- **Single language**: English banking apps only (no OCR multi-language)
- **Image-only**: No PDF statement parsing
- **Digital screenshots only**: No handwritten receipt OCR
- **Single currency**: AUD only (no multi-currency support in MVP)
- **No rate limiting**: No monthly cap on imports per user
- **No AI usage limit**: Unbounded API costs possible
- **No duplicate detection**: Can create duplicate entries if user re-imports same screenshot
- **No recurring imports**: User must manually import each time
- **No image annotation**: User cannot highlight relevant areas before parsing

### Future Enhancements (Phase 2+)
1. **Bank Asset Import** — extract account balances from screenshots
2. **PDF Parsing** — support multi-page bank statements
3. **Recurring Templates** — save import settings for reuse
4. **Duplicate Detection** — warn if similar entries exist for that month
5. **Bulk Undo** — rollback entire import session
6. **Multi-language Support** — OCR for non-English apps
7. **Image Annotation** — user highlights relevant data before parsing
8. **Email Forwarding** — send screenshots to dedicated address
9. **On-Device AI** — privacy-first local processing (no cloud)
10. **Analytics Dashboard** — import history and trends

---

## 13. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **AI Misreads** (low clarity) | High | Confidence scoring; easy post-edit; prompt optimization |
| **Banking UI Changes** | Medium | Provider-agnostic design; model switchable; prompt templates easily updated |
| **API Cost Escalation** | High | Usage monitoring (AIUsageLog); optional rate limiting; cost alerts |
| **Storage Costs** | Medium | TTL cleanup (7 days default); optional user delete; compression |
| **Sensitive Data Exposure** | High | Private storage; proxy-enforced access; AI provider terms (no retention) |
| **File Upload Exploits** | Medium | MIME type validation; magic number check; size limits; no execution |
| **Performance Degradation** | Medium | Async processing (SSE); per-image error isolation; monitoring |

---

## 14. Success Criteria

- ✅ Feature deploys to production without errors
- ✅ Supports single and batch image uploads (up to 10 images)
- ✅ AI vision extraction works with GitHub Models free tier (or OpenAI)
- ✅ SSE streaming provides real-time feedback to UI
- ✅ Transaction records created with proper audit trail (importImage FK)
- ✅ Overall confidence score calculated and displayed
- ✅ Error isolation prevents cascading failures
- ✅ Build passes: `pnpm run build` with 0 errors
- ✅ Manual testing with real banking app screenshots succeeds
- ✅ Database schema clean (no conflicting migrations)

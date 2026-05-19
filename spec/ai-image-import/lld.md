# AI Image Import — Low-Level Design

## Phase 1: Infrastructure & Image Upload (Status: ✅ COMPLETED)

### Database Schema

#### ImportSession Model
- **Primary Key**: id (cuid)
- **Foreign Keys**:
  - userId (FK → User, cascade delete)
  - images (1:N → ImportImage[])
  - usageLogs (1:N → AIUsageLog[])
  - transactions (1:N → Transaction[])
  - matchJobResults (1:N → TransferMatchJobResult[])
- **Fields**:
  - importType: ImportTypeEnum (EXPENSE, BANK_ASSET)
  - status: ImportStatusEnum (PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED)
  - overallConfidence: Float (0-1, nullable)
  - recordsCreated: Int (default 0)
  - startDate, endDate: DateTime (nullable, earliest/latest transaction date)
  - metadata: Json (stores context, bankAccountId, imageResults)
  - createdAt, updatedAt: timestamps
- **Indexes**: [userId, createdAt]

#### ImportImage Model
- **Primary Key**: id (cuid)
- **Foreign Keys**:
  - userId (FK → User, cascade delete)
  - sessionId (FK → ImportSession, cascade delete)
  - monthlyExpenseSummaries (1:N, audit trail via importImageId)
  - bankBalanceRecords (1:N, audit trail via importImageId)
- **Fields**:
  - fileName: String (original filename)
  - fileSize: Int (bytes)
  - mimeType: String (e.g., "image/png")
  - storageUrl: String (local path or cloud URL)
  - storageProvider: StorageProviderEnum (LOCAL, VERCEL_BLOB, S3)
  - confidence: Float (nullable, per-image confidence)
  - extractedData: Json (nullable, raw AI response)
  - errorMessage: String (nullable, error details)
  - expiresAt: DateTime (nullable, TTL for cleanup)
  - createdAt: timestamp
- **Indexes**: [sessionId], [userId]

#### AIUsageLog Model
- **Primary Key**: id (cuid)
- **Foreign Keys**:
  - sessionId (FK → ImportSession, cascade delete)
  - userId (FK → User, cascade delete)
- **Fields**:
  - imageId: String (nullable, references ImportImage.id)
  - importType: ImportTypeEnum (EXPENSE, BANK_ASSET)
  - model: String (AI model name, e.g., "gpt-4o-mini")
  - promptTokens, completionTokens, totalTokens: Int
  - estimatedCostUSD: Float
  - createdAt: timestamp
- **Indexes**: [userId, createdAt], [userId, importType, createdAt], [importType, createdAt], [sessionId]

#### Extended Models
- **Transaction**:
  - importSession: FK (nullable)
  - importSessionId: String (nullable, links to ImportSession)
- **MonthlyExpenseSummary**:
  - importImage: FK (nullable)
  - importImageId: String (nullable, links to ImportImage)

### Upload API Endpoint: POST /api/transactions/ai/upload

**Route File**: src/app/api/transactions/ai/upload/route.ts

**Request**:
`
multipart/form-data
├─ files: File[] (up to 10 images)
└─ bankAccountId: String (optional, cuid)
`

**Response** (200 or 207):
`json
{
  "imageIds": ["cuid1", "cuid2"],
  "images": [
    {
      "imageId": "cuid1",
      "fileName": "screenshot.png",
      "fileSize": 1048576,
      "mimeType": "image/png"
    }
  ],
  "bankAccountId": "optional-cuid"
}
`

**Error Responses**:
- 400: No files provided, invalid file type, file too large, exceeds 10 images
- 401: Unauthorized (missing session)
- 404: Bank account not found (if bankAccountId provided)
- 500: Internal server error
- 207: Partial success (some files uploaded, some failed)

**Implementation Steps**:
1. Extract session via auth() — return 401 if missing
2. Parse formData — extract files array and optional bankAccountId
3. Validate file count (≤10) — return 400 if exceeded
4. For each file:
   a. Validate MIME type (PNG, JPEG, WebP, HEIC allowlist)
   b. Validate file size (≤10MB)
   c. Call validateImageDimensions(buffer) — check 50–4096 px
   d. Call StorageAdapter.uploadImage() → StorageResult
   e. Create ImportImage record (sessionId = '', expiresAt set via setImageExpiration)
   f. Catch errors, collect error messages
5. If all failed → 400 with error list
6. If some succeeded → return 200/207 with imageIds + warnings
7. Background: Call deleteExpiredImages() (non-blocking)

**Validations**:
- MIME Type: validateMimeType(mimeType) — strict allowlist
- File Size: validateFileSize(bytes) — max 10MB
- Image Dimensions: validateImageDimensions(buffer) — 50–4096 px range
- File Count: MAX_IMAGES_PER_SESSION (10)
- Magic Number Check: Verify actual image content (not just MIME type)

**Storage Adapter Integration**:
- Call getStorageAdapter() → returns LocalStorageAdapter or S3StorageAdapter based on IMAGE_STORAGE_PROVIDER
- storageAdapter.uploadImage(buffer, mimeType, userId, originalFileName) → StorageResult
- StorageResult: { storageUrl, fileName, fileSize, mimeType }

---

## Phase 2: AI Vision Pipeline (Status: ✅ COMPLETED)

### AI Vision Service: extractExpenseData()

**File**: src/server/services/ai-import/ai-vision.service.ts

**Signature**:
`	ypescript
async function extractExpenseData(
  imageBuffer: Buffer,
  expenseCategories: string[]
): Promise<ExpenseExtractionResult>
`

**ExpenseExtractionResult**:
`	ypescript
{
  success: boolean,
  confidence: number (0-1),
  entries: [
    { categoryName: string, amount: number },
    ...
  ],
  warnings: string[],
  usage: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    estimatedCostUSD?: number
  }
}
`

**Implementation**:
1. Get AI provider via getAIProvider() — returns Vercel AI SDK client
   - Reads AI_PROVIDER (github | openai)
   - Reads AI_VISION_MODEL (gpt-4o-mini, gpt-4o, etc.)
   - Reads AI_API_KEY
   - Optional AI_BASE_URL for custom endpoints
2. Encode image as base64
3. Build system prompt:
   `
   You are a financial data extraction AI specialized in parsing banking app screenshots.
   Your task is to extract expense data from screenshots containing expense summaries.
   
   PRIVACY: Only extract numbers and category names. Do not include account numbers, 
   card numbers, or personal identifiers.
   
   You MUST respond ONLY with valid JSON. No additional text.
   `
4. Build user prompt:
   `
   Analyze this banking app screenshot and extract expense data.
   
   Expected format (as JSON):
   {
     "confidence": <0-1>,
     "entries": [
       { "categoryName": "<extracted category>", "amount": <number> },
       ...
     ],
     "warnings": ["<any ambiguities>"]
   }
   
   Available categories: [list from expenseCategories param]
   `
5. Call generateText() via Vercel AI SDK:
   `	ypescript
   const response = await client({
     messages: [{ role: 'user', content: [{ type: 'image', image: base64Image }, 
                                           { type: 'text', text: userPrompt }] }],
     system: systemPrompt,
     temperature: 0.2,
   })
   `
6. Parse response text as JSON — validate against ExpenseExtractionSchema (Zod)
7. Extract usage: { promptTokens, completionTokens, totalTokens } from response metadata
8. Calculate estimatedCostUSD via calculateEstimatedCost()
9. Return ExpenseExtractionResult

**Error Handling**:
- AI provider timeout → throw Error("AI service timeout")
- Invalid JSON response → throw Error("Failed to parse AI response")
- Zod validation failure → throw Error with validation details
- Missing API key → throw Error("AI_API_KEY not configured")

---

### Parse API Endpoint: POST /api/transactions/ai/parse (SSE)

**Route File**: src/app/api/transactions/ai/parse/route.ts

**Request**:
`json
{
  "imageIds": ["cuid1", "cuid2"],
  "importType": "EXPENSE",
  "context": {
    "calendarId": "cuid",
    "month": 5
  },
  "bankAccountId": "optional-cuid"
}
`

**Response**: Server-Sent Events (text/event-stream)
`
data: {"type":"progress","message":"Processing image 1 of 2...","imageIndex":1,"totalImages":2}\n\n
data: {"type":"extracted","imageId":"cuid1","confidence":0.92,"entries":[...]}\n\n
data: {"type":"complete","sessionId":"cuid","images":[{imageId,fileName,confidence,entries,status}]}\n\n
`

**Implementation**:
1. Extract session via auth() — return 401 if missing
2. Parse + validate request body via TransactionAIParseRequestSchema (Zod)
3. Return 400 if validation fails
4. Check importType === EXPENSE (only EXPENSE supported in MVP)
5. Validate context.calendarId and context.month are present
6. If bankAccountId provided, verify ownership (user owns account)
7. Create ImportSession (status=PROCESSING) with userId, importType, metadata
8. Update all ImportImage records: set sessionId = importSession.id
9. Create ReadableStream for SSE:
   - **For each imageId**:
     a. Send progress event
     b. Fetch ImportImage record
     c. If not found → send error event, continue
     d. Get image buffer: storageAdapter.getImageBuffer(storageUrl)
     e. Call extractExpenseData(buffer, []) → extraction result
     f. Send extracted event with confidence + entries
     g. Log AIUsageLog asynchronously (via after() callback):
        - { sessionId, userId, imageId, importType, model, tokens, estimatedCostUSD }
     h. On error → send error event, continue (non-blocking)
   - Update ImportSession with all imageResults
   - Send complete event
   - Close stream
10. Catch top-level errors → send error event, close stream

**SSE Event Schema**:
`	ypescript
type SSEEvent = 
  | { type: 'progress', message, imageIndex, totalImages }
  | { type: 'extracted', imageId, confidence, entries }
  | { type: 'error', imageId?, message }
  | { type: 'complete', sessionId, images: ExtractedImageResult[] }
`

---

## Phase 3: Review & Confirmation (Status: ✅ COMPLETED)

### Review Step Component

**File**: src/app/(authorized)/cashflow/transactions/_components/ai/ReviewStep.tsx

**Props**:
`	ypescript
interface ReviewStepProps {
  extractedImages: ExtractedImageResult[],
  onConfirm: (images: ConfirmRequest['images']) => Promise<void>,
  isLoading: boolean,
}
`

**Features**:
- Display per-image extracted entries in table format
- Each entry has checkbox (confirmed/unconfirmed by default)
- Allow user to adjust entries before confirmation
- Display per-image confidence score
- Show warnings from AI
- Submit button calls onConfirm handler
- Error handling + retry logic

### Confirm Endpoint: POST /api/transactions/ai/confirm

**Route File**: src/app/api/transactions/ai/confirm/route.ts

**Request**:
`json
{
  "sessionId": "cuid",
  "calendarYearId": "cuid",
  "month": 5,
  "bankAccountId": "optional-cuid",
  "images": [
    {
      "imageId": "cuid",
      "entries": [
        {
          "categoryName": "Groceries",
          "amount": 123.45,
          "confirmed": true
        }
      ]
    }
  ]
}
`

**Response**:
`json
{
  "success": true,
  "recordsCreated": 8,
  "sessionId": "cuid",
  "status": "COMPLETED"
}
`

**Implementation**:
1. Extract session via auth() — return 401 if missing
2. Parse + validate request via AIConfirmRequestSchema
3. Verify ImportSession ownership (session.userId === userId)
4. Get/create ExpenseLedger (calendarId + userId)
5. Fetch all active ExpenseCategory records
6. Initialize counters: recordsCreated = 0, status = COMPLETED
7. **For each image in images array**:
   a. Initialize imageEmbeddingUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
   b. **For each entry in image.entries**:
      - If entry.confirmed === false → skip
      - Call matchCategoryWithEmbedding(entry.categoryName, activeCategories)
      - Get categoryId from matched category name
      - Add embedding usage to imageEmbeddingUsage
      - If categoryId null → skip (no match)
      - Check if MonthlyExpenseSummary exists (expenseLedgerId + categoryId + month)
      - If exists → increment existing amount by entry.amount
      - If not exists → create new MonthlyExpenseSummary
      - Create Transaction record:
        * date: new Date()
        * description: entry.categoryName
        * amount: entry.amount
        * type: DEBIT
        * category: entry.categoryName
        * source: LLM_CLASSIFIED
        * status: CONFIRMED
        * confirmedAt: new Date()
        * userId, bankAccountId (if provided), importSessionId
      - Increment recordsCreated
   c. If imageEmbeddingUsage.totalTokens > 0:
      - Create AIUsageLog record:
        * sessionId, userId, imageId
        * model: EMBEDDING_MODEL_NAME
        * tokens + estimatedCostUSD
8. Query all Transactions with importSessionId:
   - Get _min.date and _max.date (date range)
9. Update ImportSession:
   - status: COMPLETED
   - recordsCreated
   - startDate, endDate
10. Return { success: true, recordsCreated, sessionId, status }

**Error Handling**:
- Category match failure → skip entry (continue)
- Database constraint error → status = PARTIAL, continue
- Overall exception → status = PARTIAL, partial records may be created

---

## Phase 4: Category Matching via Embeddings (Status: ✅ COMPLETED)

### Category Matcher Service

**File**: src/server/services/ai-import/category-matcher.service.ts

**Function**: matchCategoryWithEmbedding(categoryName, activeCategories)

**Signature**:
`	ypescript
async function matchCategoryWithEmbedding(
  categoryName: string,
  activeCategories: ExpenseCategory[]
): Promise<EmbeddingMatchResult & { embeddingUsage: AITokenUsage }>
`

**4-Tier Matching Strategy**:
1. **Exact Match** (case-insensitive)
   - Compare categoryName.toLowerCase() against each active category
   - If match found → return immediately
2. **Substring Match**
   - Check if categoryName contains any active category name
   - Check if any active category name contains categoryName
   - If match found → return immediately
3. **Fuzzy Match** (Levenshtein distance)
   - Calculate distance for each active category
   - If distance ≥ 0.75 threshold → return best match
4. **Embedding-Based Semantic Match**
   - If no match above → call embedding API
   - Encode categoryName + all active category names as embeddings
   - Calculate cosine similarity
   - Return best match above similarity threshold (0.7)
   - Log embedding token usage

**EmbeddingMatchResult**:
`	ypescript
{
  matched: boolean,
  categoryName: string | null,
  similarity: number (0-1),
  method: 'exact' | 'substring' | 'embedding' | 'fuzzy',
  embeddingUsage: { promptTokens, completionTokens, totalTokens }
}
`

**Implementation Notes**:
- Exact, substring, fuzzy matches have embeddingUsage = all zeros (no API call)
- Only embedding method incurs tokens
- Called during **confirm** step (not parse) to avoid redundant calls
- Handles batch matching efficiently (one embedding call for multiple categories)

---

## Phase 5-6: Storage & Production (Status: ✅ COMPLETED)

### Storage Adapter Implementations

#### LocalStorageAdapter
- **File**: src/server/services/ai-import/image-storage.adapter.ts
- **uploadImage()**:
  - Create uploads/ai-imports/{userId}/ directory
  - Generate UUID filename with extension from MIME type
  - Write buffer to file
  - Return relative path as storageUrl
- **deleteImage()**:
  - Delete file at storageUrl (silently fail if not exists)
- **getImageBuffer()**:
  - Read and return file buffer

#### S3StorageAdapter
- **uploadImage()**:
  - Generate S3 key: ai-imports/{userId}/{uuid}.{ext}
  - PutObjectCommand to S3 with private ACL
  - Return S3 key as storageUrl
- **deleteImage()**:
  - DeleteObjectCommand for storageUrl key
- **getImageBuffer()**:
  - GetObjectCommand to fetch object
  - Convert stream to Buffer
  - Return buffer

**Note**: Retrieval happens via proxy endpoint (not direct S3 URL) for security

### Image Proxy Endpoint (Reference)

**Route**: src/app/api/ai-import/image/[id]/route.ts
- GET /api/ai-import/image/{imageId}
- Verify ownership (imageId belongs to authenticated user)
- For S3: generate 60s pre-signed URL, redirect to it
- For Local: serve file with proper MIME type
- For Vercel Blob: redirect to blob token URL

---

## Frontend: Wizard Components (Status: ✅ COMPLETED)

### AIImportWizard.tsx (Main Orchestrator)
- 4-step wizard: upload → processing → review → results
- State management: files, importResult, selectedBankAccountId, extractedImages, sessionId
- Handles flow navigation and error states

### UploadStep.tsx
- react-dropzone integration
- Drag-drop support + file picker
- Thumbnail grid with remove buttons
- Bank account selector (optional)
- Canvas sanitization for EXIF stripping
- Start Import button

### ProcessingStep.tsx
- Real-time SSE event handling
- Per-image progress cards
- Overall progress bar
- Error isolation (failed images don't block others)
- Live update of extractedImages state

### ReviewStep.tsx
- Display extracted entries in table
- Checkbox for confirm/unconfirm each entry
- Per-image confidence badges
- Submit to confirm endpoint

### ResultsStep.tsx
- Summary card (records created, overall confidence)
- Per-image accordion (thumbnail, entries, status)
- Action buttons: Done, View Records, Import More

---

## Validation & Constraints

### Zod Schemas
- **UploadRequestSchema**: imageIds[], importType, context
- **TransactionAIParseRequestSchema**: extends UploadRequestSchema + bankAccountId
- **AIConfirmRequestSchema**: sessionId, calendarYearId, month, bankAccountId?, images[]

### Validation Functions
- **validateMimeType(mimeType)**: PNG, JPEG, WebP, HEIC only
- **validateFileSize(bytes)**: ≤10MB
- **validateImageDimensions(buffer)**: 50–4096 px
- **MAX_IMAGES_PER_SESSION**: 10

---

## Cleanup Service

### setImageExpiration(imageId)
- Set expiresAt = now() + 7 days
- Called after each ImportImage creation

### deleteExpiredImages()
- Query ImportImage where expiresAt < now()
- For each: call storageAdapter.deleteImage(storageUrl)
- Delete ImportImage records from DB
- Log errors (non-blocking)

---

## Environment Variables

`ash
# AI Provider (GitHub Models or OpenAI)
AI_PROVIDER=github              # 'github' or 'openai'
AI_VISION_MODEL=gpt-4o-mini    # Model identifier
AI_API_KEY=<token>              # GitHub PAT or OpenAI key
AI_BASE_URL=<optional>          # Custom endpoint

# Image Storage
IMAGE_STORAGE_PROVIDER=local    # 'local', 'vercel-blob', or 's3'

# S3 (only if IMAGE_STORAGE_PROVIDER=s3)
AWS_S3_BUCKET=<bucket>
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
`

---

## Testing Scenarios

✅ **Manual Testing Completed**:
- Single image upload and parsing
- Multiple image batch (2-5 images)
- Category fuzzy matching
- SSE event streaming
- Transaction record creation
- Embedding-based category matching
- Error isolation (one image fails, others continue)
- Storage adapter (local filesystem)
- S3 pre-signed URL retrieval

✅ **Build Verification**:
- pnpm run build: 0 errors, 0 warnings
- Production-ready code

---

## Known Issues & Limitations

- No Unit/Integration Tests (MVP, out of scope)
- No Rate Limiting (future: monthly cap per user)
- No Duplicate Detection (future: warn if re-importing same screenshot)
- No Multi-Language OCR (English only)
- No PDF Parsing (images only)
- No Handwritten Receipt Support (digital screenshots only)
- Single Currency (AUD only)

---

## Implementation Status

| Phase | Component | Status | Notes |
|-------|-----------|--------|-------|
| 1 | Upload API | ✅ | Routes: /api/transactions/ai/upload |
| 2 | Vision Service | ✅ | Supports GitHub Models + OpenAI |
| 3 | Review UI | ✅ | ReviewStep, ConfirmEndpoint |
| 4 | Category Matching | ✅ | 4-tier matching with embeddings |
| 5 | Storage (S3) | ✅ | S3StorageAdapter implemented |
| 6 | Audit Trail | ✅ | ImportImage links to records |
| 7 | Cleanup | ✅ | TTL-based image expiration |

---

## Next Steps (Future Phases)

1. **Bank Asset Import**: Separate BankAssetAIImportWizard (similar pattern)
2. **Multi-Language Support**: OCR for non-English banking apps
3. **PDF Parsing**: Extended to multi-page statements
4. **Rate Limiting**: Monthly import cap per user
5. **Duplicate Detection**: Warn if similar entries exist
6. **Bulk Undo**: Rollback entire import session
7. **Email Integration**: Forward screenshots to address
8. **On-Device AI**: Privacy-first local processing


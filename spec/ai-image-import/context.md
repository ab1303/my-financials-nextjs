# AI Image Import — File Inventory & Context

## Objective
Document the actual implementation state of the AI Image Import feature, including file locations, database models, and API endpoints.

---

## Database Models

### ImportSession
- **Path**: `prisma/schema.prisma`
- **Purpose**: Tracks a batch import session with status, metadata, and linked images
- **Key Fields**:
  - `id` (cuid, primary key)
  - `userId` (FK to User, cascade delete)
  - `importType` (ImportTypeEnum: EXPENSE, BANK_ASSET)
  - `status` (ImportStatusEnum: PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED)
  - `overallConfidence` (Float, 0-1, nullable)
  - `recordsCreated` (Int, default 0)
  - `startDate`, `endDate` (DateTime, nullable — earliest/latest transaction date)
  - `metadata` (Json, nullable — stores context, bankAccountId, image results)
  - `createdAt`, `updatedAt` (timestamps)
- **Relations**:
  - `images` → ImportImage[]
  - `usageLogs` → AIUsageLog[]
  - `transactions` → Transaction[]
  - `matchJobResults` → TransferMatchJobResult[]
- **Indexes**: `[userId, createdAt]`

### ImportImage
- **Path**: `prisma/schema.prisma`
- **Purpose**: Stores metadata and storage location for uploaded images
- **Key Fields**:
  - `id` (cuid, primary key)
  - `userId` (FK to User, cascade delete)
  - `sessionId` (FK to ImportSession, cascade delete)
  - `fileName` (String, original filename)
  - `fileSize` (Int, bytes)
  - `mimeType` (String, e.g., "image/png")
  - `storageUrl` (String, local path or cloud URL)
  - `storageProvider` (StorageProviderEnum: LOCAL, VERCEL_BLOB, S3)
  - `confidence` (Float, nullable — per-image extraction confidence)
  - `extractedData` (Json, nullable — raw AI extraction output)
  - `errorMessage` (String, nullable — error details if extraction failed)
  - `expiresAt` (DateTime, nullable — TTL for cleanup)
  - `createdAt` (timestamp)
- **Relations**:
  - `monthlyExpenseSummaries` → MonthlyExpenseSummary[] (audit trail)
  - `bankBalanceRecords` → BankBalanceRecord[] (audit trail)
- **Indexes**: `[sessionId]`, `[userId]`

### AIUsageLog
- **Path**: `prisma/schema.prisma`
- **Purpose**: Track AI API token usage per session/image for cost monitoring
- **Key Fields**:
  - `id` (cuid, primary key)
  - `sessionId` (FK to ImportSession, cascade delete)
  - `userId` (FK to User, cascade delete)
  - `imageId` (String, nullable — links to ImportImage)
  - `importType` (ImportTypeEnum: EXPENSE, BANK_ASSET)
  - `model` (String, AI model name)
  - `promptTokens`, `completionTokens`, `totalTokens` (Int)
  - `estimatedCostUSD` (Float)
  - `createdAt` (timestamp)
- **Indexes**: `[userId, createdAt]`, `[userId, importType, createdAt]`, `[importType, createdAt]`, `[sessionId]`

### Transaction (extended)
- **Path**: `prisma/schema.prisma`
- **Modified Fields** for AI import:
  - `importSession` (FK to ImportSession, nullable)
  - `importSessionId` (String, nullable)
- **Purpose**: Links individual transactions back to their import session

### MonthlyExpenseSummary (extended)
- **Path**: `prisma/schema.prisma`
- **Modified Fields**:
  - `importImage` (FK to ImportImage, nullable)
  - `importImageId` (String, nullable)
- **Purpose**: Audit trail linking expense summaries to source images

---

## API Endpoints

### Upload Endpoint
- **Path**: `src/app/api/transactions/ai/upload/route.ts`
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Request**:
  - `files` (File[]) — array of image files
  - `bankAccountId` (String, optional) — context for bank-specific imports
- **Response** (200 or 207):
  ```json
  {
    "imageIds": ["id1", "id2"],
    "images": [
      {
        "imageId": "id1",
        "fileName": "screenshot.png",
        "fileSize": 1024000,
        "mimeType": "image/png"
      }
    ],
    "bankAccountId": "..." (optional)
  }
  ```
- **Validation**:
  - MIME type allowlist: image/png, image/jpeg, image/webp, image/heic
  - Max file size: 10MB per file
  - Max files per session: 10
  - Image dimensions: up to 4096x4096
  - Session auth required
- **Side Effects**:
  - Creates ImportImage records (with sessionId = '')
  - Calls setImageExpiration() for TTL
  - Triggers background cleanup of expired images

### Parse Endpoint
- **Path**: `src/app/api/transactions/ai/parse/route.ts`
- **Method**: POST
- **Content-Type**: application/json
- **Request**:
  ```json
  {
    "imageIds": ["id1", "id2"],
    "importType": "EXPENSE",
    "context": {
      "calendarId": "...",
      "month": 5
    },
    "bankAccountId": "..." (optional)
  }
  ```
- **Response**: Server-Sent Events (text/event-stream)
  - Event Types:
    - `progress` — processing status (imageIndex, totalImages)
    - `extracted` — extraction result (confidence, entries)
    - `error` — per-image error with message
    - `complete` — final results with sessionId
- **Processing**:
  - Creates ImportSession with PROCESSING status
  - Updates ImportImage records with sessionId
  - Iterates images: fetch → extract via extractExpenseData → validate → update session
  - Logs token usage to AIUsageLog
  - **Non-blocking**: one image failure doesn't stop others
- **Authentication**: Session auth required

### Confirm Endpoint
- **Path**: `src/app/api/transactions/ai/confirm/route.ts`
- **Method**: POST
- **Content-Type**: application/json
- **Request**:
  ```json
  {
    "sessionId": "...",
    "calendarYearId": "...",
    "month": 5,
    "bankAccountId": "..." (optional),
    "images": [
      {
        "imageId": "...",
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
  ```
- **Response**:
  ```json
  {
    "success": true,
    "recordsCreated": 8,
    "sessionId": "...",
    "status": "COMPLETED"
  }
  ```
- **Processing**:
  - Validates ImportSession ownership
  - Gets/creates ExpenseLedger
  - Iterates confirmed entries:
    - Matches category via embedding-based fuzzy matching
    - Creates/updates MonthlyExpenseSummary
    - Creates Transaction record
    - Logs embedding usage
  - Updates ImportSession with final status and recordsCreated
  - **Error Handling**: Partial failure updates status to PARTIAL

### Image Proxy Endpoint (for reference)
- **Path**: `src/app/api/ai-import/image/[id]/route.ts`
- **Purpose**: Secure image retrieval with ownership checks
- **Method**: GET
- **Response**: Image file with proper MIME type
- **Authentication**: Session auth + ownership verification

### Cleanup Endpoint (for reference)
- **Path**: `src/app/api/ai-import/cleanup/route.ts`
- **Purpose**: Background job to delete expired images
- **Trigger**: Called after successful upload via `deleteExpiredImages()`
- **Cleanup Policy**: Deletes ImportImage records where expiresAt < now()

---

## Storage System

### Storage Adapter Pattern
- **File**: `src/server/services/ai-import/image-storage.adapter.ts`
- **Interface**: `IImageStorageAdapter`
- **Methods**:
  - `uploadImage(file, mimeType, userId, originalFileName, pathPrefix?)` → StorageResult
  - `deleteImage(storageUrl)` → Promise<void>
  - `getImageBuffer(storageUrl)` → Promise<Buffer>
- **StorageResult**: `{ storageUrl, fileName, fileSize, mimeType }`

### Local Storage Adapter (Development)
- **Class**: `LocalStorageAdapter`
- **Storage Path**: `/uploads/ai-imports/{userId}/{uuid}.{ext}`
- **Return**: Relative file path as storageUrl
- **File Security**: User-scoped directories, UUID-based filenames

### S3 Storage Adapter (Production)
- **Class**: `S3StorageAdapter`
- **Implementation**: AWS SDK v3 (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner)
- **Pattern**: Stores S3 key (not URL); retrieval via 60-second pre-signed URLs routed through proxy
- **Methods**: uploadImage, deleteImage, getImageBuffer all implemented
- **Environment**: AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

### Provider Configuration
- **Environment Variable**: `IMAGE_STORAGE_PROVIDER` (local | vercel-blob | s3)
- **Factory Function**: `getStorageAdapter()` — returns provider instance
- **Enum Helper**: `getStorageProviderEnum()` — returns StorageProviderEnum

---

## AI Vision Service

### File**: `src/server/services/ai-import/ai-vision.service.ts`
- **Provider Support**: OpenAI (via Vercel AI SDK), GitHub Models (free tier), direct OpenAI
- **Environment Variables**:
  - `AI_PROVIDER` (github | openai, default: github)
  - `AI_VISION_MODEL` (gpt-4o-mini, gpt-4o, etc.)
  - `AI_API_KEY` (GitHub PAT or OpenAI key)
  - `AI_BASE_URL` (optional, for custom endpoints)

### Function: `extractExpenseData(imageBuffer, expenseCategories)`
- **Input**: Buffer (image file), string array of category names
- **Output**: `ExpenseExtractionResult`
  - `success` (boolean)
  - `confidence` (0-1)
  - `entries` (Array<{categoryName, amount}>)
  - `warnings` (string[])
  - `usage` (AITokenUsage)
- **Process**:
  - Encodes image as base64
  - Calls AI with system + user prompts
  - Parses structured JSON response
  - Validates with ExpenseExtractionSchema (Zod)
  - Returns with token usage

### Schemas (Zod Validation)
- **ExpenseEntrySchema**: { categoryName, amount }
- **ExpenseExtractionSchema**: { confidence, entries[], warnings[] }
- **BankAccountSchema**: { accountName, balance, currency }
- **BankAssetExtractionSchema**: { confidence, bankName?, entries[], warnings[] }

---

## Category Matching Service

### File**: `src/server/services/ai-import/category-matcher.service.ts`
- **Function**: `matchCategoryWithEmbedding(categoryName, activeCategories)`
- **Matching Tiers**:
  1. Exact match (case-insensitive)
  2. Substring match
  3. Fuzzy match (Levenshtein distance ≥ 0.75)
  4. Embedding-based semantic matching (via AI embeddings)
- **Return**: `EmbeddingMatchResult`
  - `matched` (boolean)
  - `categoryName` (string | null)
  - `similarity` (0-1)
  - `method` ('exact' | 'substring' | 'embedding' | 'fuzzy')
- **Token Usage**: Tracked and logged separately (embedding model costs)

---

## Validation & Constraints

### File**: `src/server/services/ai-import/validation.ts`
- **Constants**:
  - `MAX_IMAGES_PER_SESSION` = 10
  - `MAX_FILE_SIZE` = 10MB
  - `MIN_IMAGE_DIMENSION` = 50x50
  - `MAX_IMAGE_DIMENSION` = 4096x4096
- **Functions**:
  - `validateMimeType(mimeType)` — allowlist check
  - `validateFileSize(bytes)` — size check
  - `validateImageDimensions(buffer)` — dimension check using sharp/image parser
  - `UploadRequestSchema` — Zod schema for parse request

### Zod Schemas
- **UploadRequestSchema**:
  ```
  imageIds: string[]
  importType: 'EXPENSE' | 'BANK_ASSET'
  context: { calendarId, month } | { snapshotDate }
  ```
- **TransactionAIParseRequestSchema**: extends UploadRequestSchema with bankAccountId
- **AIConfirmRequestSchema**:
  ```
  sessionId: cuid
  calendarYearId: string
  month: 1-12
  bankAccountId: cuid (optional)
  images: Array<{ imageId, entries[] }>
  ```

---

## Cleanup Service

### File**: `src/server/services/ai-import/cleanup.service.ts`
- **Functions**:
  - `setImageExpiration(imageId)` — sets expiresAt to now() + TTL (default: 7 days)
  - `deleteExpiredImages()` — background job that deletes ImportImage records where expiresAt < now()
- **Usage**: Triggered after successful upload to clean up old images

---

## Types & Interfaces

### File**: `src/server/services/ai-import/_types.ts`
- **Core Types**:
  - `ImportImageData`: metadata for an uploaded image
  - `ImportSessionResult`: result of an import session
  - `ExpenseImportContext`: { calendarId, month }
  - `BankAssetImportContext`: { snapshotDate, calendarId? }
  - `ImportContext`: union of above
  - `AITokenUsage`: { promptTokens, completionTokens, totalTokens, estimatedCostUSD? }
  - `ExpenseExtractionResult`: AI output with entries, confidence, usage
  - `BankAssetExtractionResult`: AI output for bank assets
  - `UploadResponse`: API response for upload endpoint
  - `ParseResponse`: API response for parse endpoint
  - `EmbeddingMatchResult`: category matching result
  - `CsvTransaction`, `CsvParseResult`: for CSV import (separate feature)

### Frontend Types
- **File**: `src/app/(authorized)/cashflow/transactions/_components/ai/_types.ts`
- **Key Types**:
  - `WizardStep`: 'upload' | 'processing' | 'review' | 'results'
  - `UploadedFile`: { id, file, preview }
  - `ExtractedImageResult`: { imageId, fileName, confidence, entries, status, errorMessage? }
  - `AIImportSessionResult`: { sessionId, images[], recordsCreated, status, overallConfidence }
  - `AIImportWizardProps`: { isOpen, onClose, bankAccounts, onImportComplete }

---

## Frontend Components

### Main Wizard
- **File**: `src/app/(authorized)/cashflow/transactions/_components/ai/AIImportWizard.tsx`
- **Type**: Client Component ('use client')
- **Props**: isOpen, onClose, bankAccounts, onImportComplete
- **State**:
  - currentStep, files, importResult, selectedBankAccountId
  - extractedImages, sessionId, calendarYearId
- **Child Components**:
  - UploadStep (step 1: drag-drop + file picker)
  - ProcessingStep (step 2: progress animation + SSE)
  - ReviewStep (step 3: user review/confirmation)
  - ResultsStep (step 4: summary + actions)
- **Flow**: Upload → Processing → Review → Results → Close & Refresh

### Upload Step
- **File**: `src/app/(authorized)/cashflow/transactions/_components/ai/UploadStep.tsx`
- **Features**:
  - react-dropzone integration for drag-and-drop
  - File picker input
  - Thumbnail grid with remove buttons
  - Context selector (bank account optional)
  - Start Import button (disabled until files selected)
  - Canvas sanitization for EXIF metadata stripping

### Processing Step
- **File**: `src/app/(authorized)/cashflow/transactions/_components/ai/ProcessingStep.tsx`
- **Features**:
  - Real-time progress via SSE stream
  - Per-image status cards (uploading → analyzing → saving)
  - Overall progress bar
  - Error handling per image (non-blocking)

### Review Step
- **File**: `src/app/(authorized)/cashflow/transactions/_components/ai/ReviewStep.tsx`
- **Features**:
  - User review of extracted entries
  - Ability to confirm/unconfirm individual entries
  - Confidence score display
  - Submission to confirm endpoint

### Results Step
- **File**: `src/app/(authorized)/cashflow/transactions/_components/ai/ResultsStep.tsx`
- **Features**:
  - Summary card (records created, confidence, status)
  - Per-image accordion (thumbnail, entries, status)
  - Action buttons (Done, View Records, Import More)

### Supporting Components
- **ConfidenceBadge**: Visual indicator (High ≥0.85, Medium 0.60-0.84, Low <0.60)
- **ImageLightbox**: Full-size image viewer modal
- **ImportAuditIcon**: Camera icon on imported records (audit trail)

---

## Integration Points

### Transactions Page
- **File**: `src/app/(authorized)/cashflow/transactions/page.tsx`
- **AI Import Button**: Opens AIImportWizard modal
- **Visibility**: Shown when user has bank accounts

### Bank Accounts Context
- **File**: `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx`
- **Feature**: Optional bank account selector in wizard
- **Use Case**: Scopes AI import to specific account if provided

### Data Refresh
- **Mechanism**: `router.refresh()` after successful import
- **Effect**: Re-fetches transaction list and updates UI

---

## Environment Variables (Required)

```bash
# AI Vision Service
AI_PROVIDER=github              # github | openai
AI_VISION_MODEL=gpt-4o-mini    # Model identifier
AI_API_KEY=<token>              # GitHub PAT or OpenAI key
AI_BASE_URL=<optional>          # Custom API endpoint

# Image Storage
IMAGE_STORAGE_PROVIDER=local    # local | vercel-blob | s3

# S3 (if using S3 provider)
AWS_S3_BUCKET=<bucket>
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `ai` | Latest | Vercel AI SDK for provider-agnostic LLM calls |
| `@ai-sdk/openai` | Latest | OpenAI provider integration |
| `@aws-sdk/client-s3` | v3 | AWS S3 client |
| `@aws-sdk/s3-request-presigner` | v3 | Pre-signed URL generation |
| `zod` | Latest | Schema validation |
| `react-dropzone` | Latest | Drag-and-drop file upload |
| `lucide-react` | Latest | UI icons |
| `@headlessui/react` | Latest | Modal/Dialog component |

---

## Enums

### ImportTypeEnum
- EXPENSE
- BANK_ASSET

### ImportStatusEnum
- PENDING
- PROCESSING
- COMPLETED
- PARTIAL
- FAILED

### StorageProviderEnum
- LOCAL
- VERCEL_BLOB
- S3

### TransactionSourceEnum
- Includes: `LLM_CLASSIFIED` (for AI-imported transactions)

### TransactionStatusEnum
- PENDING
- CONFIRMED

---

## Database Migrations

- `20260228120102_add_ai_import_infrastructure` — Initial ImportSession, ImportImage, AIUsageLog models
- `20260325101743_add_expires_at_to_import_image` — TTL field for image cleanup
- Related: Transaction, MonthlyExpenseSummary extensions for audit trail

---

## Cost Tracking

### AI Pricing Constants
- **File**: `src/constants/ai-pricing.ts`
- **Functions**:
  - `calculateEstimatedCost(promptTokens, completionTokens)` — GPT-4o vision pricing
  - `calculateEmbeddingCost(totalTokens)` — embedding model pricing
- **Logging**: AIUsageLog records per session/image with model name and costs
- **Monitoring**: Available via analytics queries on AIUsageLog table

---

## Testing & Validation

### Manual Testing Scenarios
- ✅ Single image upload and parsing
- ✅ Multiple image batch processing
- ✅ Category fuzzy matching with semantic fallbacks
- ✅ SSE event streaming and error handling
- ✅ Transaction record creation with FKs
- ✅ Production build verification

### Known Limitations (MVP)
- No multi-language OCR support
- English banking apps only
- No handwritten receipt OCR
- No PDF statement parsing
- Single currency (AUD) only
- No rate limiting or monthly caps

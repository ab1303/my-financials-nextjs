# PRD: AI-Powered Image Import for Financial Data Entry

## 1. Product overview

### 1.1 Document title and version

- PRD: AI-Powered Image Import for Financial Data Entry
- Version: 1.0

### 1.2 Product summary

This feature enables authenticated users to upload screenshots or photos of their banking app screens (e.g., CommBank spending summary, account balance screens) and have an AI vision model automatically extract financial data and create expense entries or bank asset snapshot entries — eliminating tedious manual data entry.

Users access a dedicated **"AI Import"** wizard from the Expenses or Bank Assets pages. The wizard supports **multi-image batch upload**, processes images through a provider-agnostic AI vision pipeline (via Vercel AI SDK), and **auto-saves** extracted data directly. Users can review and edit the created records after import if corrections are needed.

Each uploaded image is persisted and linked to the resulting records so users have an audit trail — they can always see which image produced which data. An **overall confidence score** is displayed per import so users know whether the AI's extraction was reliable.

Key capabilities:

1. **Multi-Image Batch Upload**: Drag-and-drop or file picker supporting multiple images per session (PNG, JPG, HEIC, WebP)
2. **AI Vision Parsing**: Provider-agnostic image-to-structured-data pipeline using Vercel AI SDK (supports OpenAI GPT-4o, Google Gemini, Anthropic Claude)
3. **Auto-Save with Post-Edit**: Extracted data is saved immediately; users edit existing records if corrections are needed
4. **Image Audit Trail**: Uploaded images stored and linked to created records for provenance tracking
5. **Confidence Scoring**: Overall confidence score per import indicating extraction reliability
6. **Phased Rollout**: Expenses first (Phase 1), Bank Assets second (Phase 2)

### 1.3 Implementation Status

#### ✅ Completed (Weeks 1-4, February-March 2026)

- **Phase 1: Infrastructure & Image Upload** (9/9 items) ✅
  - Prisma schema with AIImportSession, ImportImage models
  - Storage adapter system (Local, Vercel Blob, S3 placeholder)
  - Image upload API endpoint (`POST /api/ai-import/upload`)
  - File validation (MIME type, size, dimensions)
  - Migration applied: `20260228120102_add_ai_import_infrastructure`
  - TTL expiration field added to ImportImage

- **Phase 2: AI Vision Pipeline** (9/9 items) ✅
  - AI Vision Service with OpenAI GPT-4o integration
  - Category Matcher with fuzzy matching and semantic mappings
  - Expense Mapper Service for database record creation
  - Parse API endpoint with SSE streaming (`POST /api/ai-import/parse`)
  - Real-time progress updates to client UI
  - setImageExpiration integration on upload

- **Phase 3: Expense Import UI** (12/12 items) ✅
  - AIImportWizard modal component (3-step flow)
  - UploadStep with drag-and-drop file zone + Canvas sanitization
  - ProcessingStep with progress animation and SSE handling
  - ResultsStep with confidence score and summary
  - Integration with Expenses page ("AI Import" button)

- **Phase 4: Secure Audit Trail & Verification** (6/6 items) ✅
  - `expiresAt` field added to ImportImage (Prisma migration: `20260325101743_add_expires_at_to_import_image`)
  - `GET /api/ai-import/image/[id]` secure proxy route with ownership checks
  - `deleteExpiredImages()` cleanup service and `setImageExpiration()` helper
  - Client-side Canvas sanitization in UploadStep (EXIF metadata stripping)
  - ImportAuditIcon component (camera icon on imported records)
  - ImageLightbox component (secure image viewer modal)
  - Integration with CategoryBreakdownModal (audit trail visible on entries)

#### 🔄 In Progress

#### ⏳ Not Started

- **Phase 5: Bank Assets Import** (0/8 items)
- **Phase 6: Cloud Storage & Production Readiness** (0/7 items)
- **Phase 7: Polish & Hardening** (0/7 items)

**Build Status**: ✅ Production build verified (9.0s, 0 errors)

## 2. Goals

### 2.1 Business goals

- Dramatically reduce manual data entry friction — the #1 barrier to consistent financial tracking
- Increase user engagement and data completeness by making snapshot/expense creation as easy as uploading a screenshot
- Position the product as a modern, AI-enhanced personal finance tool
- Maintain data accuracy through confidence scoring and post-edit capabilities
- Build a reusable AI import pipeline extensible to future features (stocks, donations, income)

### 2.2 User goals

- Upload a screenshot of a banking app expense summary and have all category amounts auto-populated for the month
- Upload screenshots of multiple bank account balances and have a complete bank asset snapshot auto-created
- Avoid re-typing numbers already visible on screen in banking apps
- Trust but verify — see confidence scores and edit any misread values after import
- Maintain a visual audit trail linking imported data back to the original screenshot

### 2.3 Non-goals

- Real-time bank API integration or Open Banking connectivity
- PDF statement parsing (images only in MVP; PDF is a future enhancement)
- OCR for handwritten notes or receipts (optimized for digital screenshots)
- Automatic periodic imports (user-initiated only)
- Multi-language OCR support (English-language banking apps only in MVP)
- Training or fine-tuning custom AI models
- Processing video or screen recordings
- Replacing manual entry entirely — manual entry remains available alongside AI import
- AI-powered categorization suggestions for uncategorized expenses (future enhancement)
- Support for currencies other than AUD (initial version)

## 3. User personas

### 3.1 Key user types

- Authenticated individual users who currently track expenses and bank assets manually and want a faster way to input data from their existing banking apps

### 3.2 Basic persona details

- **Time-constrained tracker**: A user who tracks finances monthly but delays data entry because manually typing 10+ expense categories or 5+ bank account balances is tedious. They already have screenshots from their banking apps and wish they could just upload them.
- **Accuracy-focused user**: A user who values correctness and wants to verify AI-extracted data but doesn't want to enter every number from scratch. They appreciate seeing confidence scores and having post-edit capability.
- **Multi-bank user**: A user with accounts across 3-5 banks who takes balance screenshots from each bank's app and wants to create a single consolidated snapshot without manual entry for each account.

### 3.3 Role-based access

- **Authenticated user**: Can upload images, trigger AI parsing, and create/edit resulting expense or bank asset records. All data scoped to the authenticated user. Images are stored privately per user.

## 4. Functional requirements

### 4.1 AI Import entry point (Priority: High)

- **Import button on Expenses page** (Priority: High)
  - Button labeled "AI Import" with a camera/upload icon (e.g., `FiUpload` from react-icons) positioned alongside existing controls
  - Opens the AI Import wizard modal
  - Button visible only when a fiscal year is selected (context required for expense creation)

- **Import button on Bank Assets page** (Priority: High — Phase 2)
  - Button labeled "AI Import" alongside the existing "New Snapshot" button
  - Opens the AI Import wizard modal in bank-asset mode
  - Button visible when calendar year context is selected

### 4.2 AI Import wizard modal (Priority: High)

- **Modal structure** (Priority: High)
  - Full-screen or large modal using existing `Modal` component (Headless UI Dialog + Transition)
  - Multi-step wizard with progress indicator:
    - **Step 1**: Upload — drag-and-drop zone + file picker
    - **Step 2**: Processing — animated progress with status messages
    - **Step 3**: Results — summary of created records with confidence score and link to view/edit
  - Modal can be dismissed at any step (with confirmation if images are uploaded but not yet processed)

- **Step 1: Upload zone** (Priority: High)
  - Large drag-and-drop area with dashed border, upload icon, and instructional text:
    - "Drop your banking app screenshots here"
    - "or click to browse files"
    - "Supports PNG, JPG, HEIC, WebP — up to 10 images, 10MB each"
  - File input accepts: `image/png`, `image/jpeg`, `image/heic`, `image/webp`
  - **Multi-image support**: Users can select/drop multiple images at once
  - Maximum 10 images per import session
  - Maximum 10MB per image
  - Image thumbnails displayed in a grid after selection with remove (×) button on each
  - "Start Import" button enabled only when ≥1 image is selected
  - Context selector (shown above upload zone):
    - **Expenses mode**: Fiscal year (pre-selected from page) + Month dropdown (Jan–Dec)
    - **Bank Assets mode**: Snapshot date picker (defaults to today)

- **Step 2: Processing** (Priority: High)
  - Sequential or parallel processing of uploaded images
  - Animated progress bar or spinner per image
  - Status messages per image: "Analyzing image 1 of 3...", "Extracting expense data...", "Saving records..."
  - Each image goes through: Upload → AI Parse → Validate → Save pipeline
  - Non-blocking: if one image fails, others continue processing
  - Error handling per image: show error message with option to retry or skip

- **Step 3: Results** (Priority: High)
  - Summary card showing:
    - Number of records created (e.g., "8 expense entries created")
    - Overall confidence score badge (High ≥85%, Medium 60-84%, Low <60%) with percentage
    - List of images processed with status (✓ success, ✗ failed, ⚠ partial)
  - Per-image expandable detail:
    - Thumbnail of the original image
    - List of extracted records with values
    - Any warnings or notes from AI (e.g., "Could not read one entry — blurry text")
  - Action buttons:
    - "Done" — closes modal, triggers data refresh on the underlying page
    - "View Records" — navigates to the relevant page section (e.g., opens CategoryBreakdownModal for the imported month)
  - Error recovery: For failed images, show "Retry" button or "Upload Different Image"

### 4.3 AI vision parsing — Expenses (Priority: High — Phase 1)

- **Input**: Screenshot of a banking app's monthly spending/expense summary screen
- **Expected image content**: Category names with associated dollar amounts (e.g., "Groceries $450.23", "Transport $125.00")
- **Extraction output** (structured JSON):
  ```
  {
    "confidence": 0.92,
    "entries": [
      { "categoryName": "Groceries", "amount": 450.23 },
      { "categoryName": "Transport", "amount": 125.00 },
      ...
    ],
    "warnings": ["Could not identify category for 'Misc $30.00'"]
  }
  ```
- **Category matching logic** (Priority: High):
  - AI extracts raw category names from the image
  - Server-side fuzzy matching maps extracted names to existing `ExpenseCategory` records
  - Matching rules:
    - Exact match (case-insensitive): "Food" → Food
    - Substring match: "Groceries & Dining" → Food
    - Semantic match via AI prompt: "Petrol" → Transportation
  - Unmatched categories default to "Other" with a warning in the results
  - AI prompt includes the full list of available categories to improve matching accuracy

- **Auto-save behavior** (Priority: High):
  - Creates `Expense` parent record for the selected fiscal year + user if not exists
  - Creates `ExpenseEntry` records for each extracted category-amount pair
  - Links entries to the selected month
  - If entries already exist for that month, **appends** new entries (does not overwrite)
  - Triggers `revalidatePath` for the expense page after save

### 4.4 AI vision parsing — Bank Assets (Priority: High — Phase 2)

- **Input**: Screenshot of a banking app's account balance screen
- **Expected image content**: Account names with balance amounts (e.g., "Smart Saver $12,500.00", "NetBank Saver $8,200.50")
- **Extraction output** (structured JSON):
  ```
  {
    "confidence": 0.88,
    "bankName": "Commonwealth Bank",
    "entries": [
      { "accountName": "Smart Saver", "balance": 12500.00 },
      { "accountName": "NetBank Saver", "balance": 8200.50 },
      ...
    ],
    "warnings": []
  }
  ```
- **Bank matching logic** (Priority: High):
  - AI extracts bank name from the image (logo, header text, app branding)
  - Server-side matching against user's configured banks (`Business` model, type=BANK)
  - If bank not found, prompt user to select from their existing banks or create new one
  - Account names matched against existing `BankAccount` records for that bank
  - New accounts auto-created via `BankAccount` model if not found

- **Auto-save behavior** (Priority: High):
  - Creates or appends to `BankAssetSnapshot` for the selected date
  - If a snapshot already exists for that date, adds new entries (does not overwrite existing accounts)
  - Creates `BankAssetEntry` records for each account-balance pair
  - Handles duplicate account detection (same account in snapshot → updates balance)
  - Invalidates tRPC queries (`bankAsset.getSnapshots`, `bankAsset.getSnapshotTotals`) after save

### 4.5 Image storage and audit trail (Priority: High)

- **Storage strategy** (Priority: High):
  - **Development**: Local filesystem storage under `/uploads/ai-imports/` (gitignored)
  - **Production**: Cloud blob storage (Vercel Blob, AWS S3, or equivalent — configured via environment variable)
  - Storage adapter pattern: `ImageStorageAdapter` interface with `LocalStorageAdapter` and `CloudStorageAdapter` implementations
  - Environment variable `IMAGE_STORAGE_PROVIDER` determines which adapter is used (`local` | `vercel-blob` | `s3`)

- **Image metadata model** (Priority: High):
  - New Prisma model `ImportImage` storing:
    - `id` (cuid)
    - `userId` (FK to User)
    - `fileName` (original filename)
    - `fileSize` (bytes)
    - `mimeType` (image/png, etc.)
    - `storageUrl` (local path or cloud URL)
    - `storageProvider` (LOCAL, VERCEL_BLOB, S3)
    - `createdAt`, `updatedAt`
  - New Prisma model `AIImportSession` storing:
    - `id` (cuid)
    - `userId` (FK to User)
    - `importType` (EXPENSE, BANK_ASSET)
    - `status` (PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED)
    - `overallConfidence` (Float, 0-1)
    - `metadata` (Json — raw AI response for debugging)
    - `createdAt`, `updatedAt`
  - Junction/linking:
    - `ImportImage` has optional FK `importSessionId` → `AIImportSession`
    - `ExpenseEntry` gets optional FK `importImageId` → `ImportImage`
    - `BankAssetEntry` gets optional FK `importImageId` → `ImportImage`

- **Audit trail** (Priority: Medium):
  - Each created record (ExpenseEntry / BankAssetEntry) links back to the source image
  - UI shows a small image icon on records created via AI import
  - Clicking the icon opens a lightbox/modal showing the original screenshot
  - Import history viewable in import session details

### 4.6 File upload API (Priority: High)

- **Upload endpoint** (Priority: High):
  - Route Handler at `app/api/ai-import/upload/route.ts`
  - Accepts `multipart/form-data` with image files
  - Validates: file type, file size, max file count, authenticated session
  - Stores images via storage adapter
  - Returns: array of `{ imageId, storageUrl, thumbnailUrl }`

- **Parse endpoint** (Priority: High):
  - Route Handler at `app/api/ai-import/parse/route.ts`
  - Accepts: `{ imageIds: string[], importType: 'EXPENSE' | 'BANK_ASSET', context: { ... } }`
  - Context for expenses: `{ calendarId: string, month: number }`
  - Context for bank assets: `{ snapshotDate: string }`
  - Orchestrates: fetch images → send to AI → validate response → save records
  - Returns: `{ sessionId, results: [...], overallConfidence }`
  - Uses streaming response (SSE) for real-time progress updates to the wizard UI

### 4.7 AI provider integration (Priority: High)

- **Vercel AI SDK integration** (Priority: High):
  - Use `ai` package (Vercel AI SDK) for provider-agnostic model calls
  - Configure provider via environment variable `AI_PROVIDER` (`openai` | `google` | `anthropic`)
  - Configure model via `AI_VISION_MODEL` (e.g., `gpt-4o`, `gemini-1.5-pro`, `claude-sonnet-4-20250514`)
  - API key via `AI_API_KEY` environment variable
  - Structured output mode: Use Zod schemas to enforce response format from AI

- **Prompt engineering** (Priority: High):
  - System prompt establishes the AI as a financial document parser
  - Expense prompt: instructs extraction of category-amount pairs, provides list of valid categories
  - Bank asset prompt: instructs extraction of bank name, account names, and balances
  - Prompts include formatting rules (decimal amounts, no currency symbols in output, etc.)
  - Prompt templates stored in `src/server/services/ai-import/prompts.ts`

- **Error handling** (Priority: High):
  - Rate limiting awareness (backoff + retry for 429 errors)
  - Token limit handling (resize/compress images if needed)
  - Graceful degradation: if AI provider is unavailable, show error with option for manual entry
  - Cost tracking: log token usage per request for monitoring

### 4.8 Confidence scoring (Priority: Medium)

- **Overall confidence** (Priority: Medium):
  - AI returns a self-assessed confidence score (0-1) as part of structured output
  - Score reflects: image clarity, text readability, number of ambiguous fields
  - Display as badge on results screen: High (≥0.85, green), Medium (0.60-0.84, amber), Low (<0.60, red)
  - Low confidence triggers a prominent warning: "Some values may be inaccurate — please review the imported records"

### 4.9 Authentication and security (Priority: High)

- **Session validation** (Priority: High):
  - All upload and parse endpoints require authenticated session (NextAuth)
  - Images scoped to authenticated user — users cannot access other users' images
  - Import sessions linked to user via `userId` FK

- **Input validation** (Priority: High):
  - File type validation (allowlist: PNG, JPG, HEIC, WebP)
  - File size validation (max 10MB per file)
  - File count validation (max 10 per session)
  - MIME type sniffing (don't trust Content-Type header alone)
  - Image dimension limits (max 4096x4096 — resize if larger)

- **Data privacy** (Priority: High):
  - Images may contain sensitive financial data — enforce same access controls as financial records
  - No image data sent to third parties beyond the configured AI provider
  - Images stored with user-scoped access controls
  - Option to delete imported images after successful import (user preference, future enhancement)

## 5. Non-functional requirements

### 5.1 Performance (Priority: Medium)

- **Upload**: Image upload completes within 3 seconds per file (dependent on file size and network)
- **AI Processing**: AI parsing completes within 10 seconds per image (dependent on provider latency)
- **Total pipeline**: Full import (upload + parse + save) for 5 images completes within 60 seconds
- **UI responsiveness**: Wizard remains interactive during processing (no UI freezing)

### 5.2 Scalability (Priority: Low)

- System handles up to 10 images per import session
- Up to 50 import sessions per user per month
- Storage scales with cloud provider (no local storage limits in production)

### 5.3 Cost management (Priority: Medium)

- Track AI API token usage per user per month
- Log estimated cost per import session
- Consider implementing monthly usage caps (future enhancement)
- Average expected cost: ~$0.01-0.05 per image (GPT-4o vision pricing)

### 5.4 Security (Priority: High)

- All file uploads scanned for valid image content (no executable payloads)
- Secure file naming (UUID-based, no user-controlled paths)
- Cloud storage with private access (signed URLs for retrieval)
- AI API keys never exposed to client

### 5.5 Maintainability (Priority: High)

- Provider-agnostic architecture allows swapping AI models without code changes
- Storage adapter pattern allows swapping storage backends without code changes
- Prompt templates separated from business logic for easy iteration
- Comprehensive logging for debugging AI extraction issues

## 6. User experience

### 6.1 Upload zone design

- Large drop zone (min 300px height) with:
  - Dashed border (`border-dashed border-2 border-gray-300`)
  - Upload cloud icon (`FiUploadCloud`, 48px)
  - Primary text: "Drop your banking screenshots here"
  - Secondary text: "or click to browse" (clickable, triggers file picker)
  - Accepted formats note: "PNG, JPG, HEIC, WebP • Max 10MB each"
- Drag-over state: border turns blue (`border-blue-500`), background tints (`bg-blue-50`)
- After selection: thumbnail grid (4 columns, responsive) with image previews
  - Each thumbnail: rounded corners, shadow, × remove button overlay
  - File name truncated below thumbnail
- "Start Import" button: full-width, primary color, disabled until images selected

### 6.2 Processing animation

- Per-image progress card in a vertical list:
  - Thumbnail (small, 48px) | Filename | Animated spinner or checkmark | Status text
  - Status transitions: "Uploading..." → "Analyzing..." → "Saving..." → "✓ Complete" or "✗ Failed"
- Overall progress bar at top of step
- Subtle pulse animation on active card
- Estimated time remaining (based on average processing time)

### 6.3 Results display

- Success banner: green background, checkmark icon, "Import Complete" heading
- Stats row: "8 entries created • Confidence: 92% (High)"
- Per-image accordion:
  - Header: thumbnail + filename + status badge (✓/✗/⚠)
  - Body: table of extracted values (Category | Amount for expenses, Account | Balance for bank assets)
- Action buttons at bottom:
  - "Done" (primary) — closes modal, refreshes page data
  - "View Records" (secondary) — opens relevant detail view
  - "Import More" (tertiary) — resets wizard to Step 1

### 6.4 Error states

- **No images selected**: "Start Import" button disabled with tooltip "Select at least one image"
- **Invalid file type**: Toast notification "Only PNG, JPG, HEIC, and WebP images are supported"
- **File too large**: Toast notification "[filename] exceeds 10MB limit"
- **AI provider error**: "Could not process [filename]. The AI service is temporarily unavailable. You can retry or enter data manually."
- **Low confidence warning**: Amber banner "Some values may be inaccurate. We recommend reviewing the imported records."
- **All images failed**: Red banner "Import failed for all images. Please try again with clearer screenshots."

### 6.5 Audit trail indicators

- Records created via AI import show a small camera icon (`FiCamera`) next to them in tables/lists
- Hovering the icon shows tooltip: "Imported from screenshot on [date]"
- Clicking the icon opens a lightbox showing the source image
- Import history accessible from the AI Import wizard ("Previous Imports" tab — future enhancement)

## 7. Technical architecture

### 7.1 Database schema additions

```prisma
enum ImportTypeEnum {
  EXPENSE
  BANK_ASSET
}

enum ImportStatusEnum {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
}

enum StorageProviderEnum {
  LOCAL
  VERCEL_BLOB
  S3
}

model AIImportSession {
  id                String            @id @default(cuid())
  user              User              @relation(fields: [userId], references: [id])
  userId            String
  importType        ImportTypeEnum
  status            ImportStatusEnum  @default(PENDING)
  overallConfidence Float?
  recordsCreated    Int               @default(0)
  metadata          Json?
  images            ImportImage[]
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([userId, createdAt])
}

model ImportImage {
  id              String              @id @default(cuid())
  user            User                @relation(fields: [userId], references: [id])
  userId          String
  session         AIImportSession     @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId       String
  fileName        String
  fileSize        Int
  mimeType        String
  storageUrl      String
  storageProvider StorageProviderEnum
  confidence      Float?
  extractedData   Json?
  errorMessage    String?
  createdAt       DateTime            @default(now())

  expenseEntries  ExpenseEntry[]
  bankAssetEntries BankAssetEntry[]

  @@index([sessionId])
  @@index([userId])
}
```

**Modifications to existing models:**

```prisma
model ExpenseEntry {
  // ... existing fields ...
  importImage    ImportImage?  @relation(fields: [importImageId], references: [id])
  importImageId  String?
}

model BankAssetEntry {
  // ... existing fields ...
  importImage    ImportImage?  @relation(fields: [importImageId], references: [id])
  importImageId  String?
}
```

### 7.2 Component structure

```
src/app/(authorized)/cashflow/
├── _components/
│   └── ai-import/
│       ├── AIImportWizard.tsx          # Main wizard modal (Client Component)
│       ├── UploadStep.tsx              # Step 1: drag-drop + file picker
│       ├── ProcessingStep.tsx          # Step 2: progress animation
│       ├── ResultsStep.tsx            # Step 3: summary + actions
│       ├── ImageThumbnail.tsx          # Thumbnail with remove button
│       ├── ImageLightbox.tsx           # Full-size image viewer
│       ├── ConfidenceBadge.tsx         # High/Medium/Low badge
│       ├── ImportAuditIcon.tsx         # Camera icon for imported records
│       ├── _types.ts                   # TypeScript types for AI import
│       └── _schema.ts                 # Zod schemas for upload/parse
```

### 7.3 API layer

```
src/app/api/ai-import/
├── upload/
│   └── route.ts                       # POST: multipart image upload
└── parse/
    └── route.ts                       # POST: trigger AI parsing + save

src/server/services/ai-import/
├── ai-import.service.ts               # Orchestration service
├── image-storage.adapter.ts           # Storage adapter interface + implementations
├── ai-vision.service.ts               # Vercel AI SDK integration
├── prompts.ts                         # AI prompt templates
├── expense-mapper.service.ts          # Maps AI output → ExpenseEntry records
└── bank-asset-mapper.service.ts       # Maps AI output → BankAssetEntry records
```

### 7.4 Data flow

1. **User opens wizard**: "AI Import" button → `AIImportWizard` modal opens with context (fiscal year + month or snapshot date)
2. **Upload**: User drops/selects images → client validates → `POST /api/ai-import/upload` → images stored, `ImportImage` records created → thumbnails returned
3. **Parse**: User clicks "Start Import" → `POST /api/ai-import/parse` with imageIds + context → SSE stream opened for progress updates
4. **AI Processing** (per image): Fetch image from storage → send to AI provider via Vercel AI SDK → receive structured JSON → validate against Zod schema
5. **Mapping & Save**: Mapper service converts AI output → Prisma `create` calls for ExpenseEntry/BankAssetEntry → link `importImageId` → update `AIImportSession` status + confidence
6. **Results**: Stream final results to client → wizard shows Step 3 with summary
7. **Refresh**: On "Done", trigger `revalidatePath` (expenses) or tRPC query invalidation (bank assets)

### 7.5 Environment variables (additions)

```
# AI Import Configuration
AI_PROVIDER=openai                    # openai | google | anthropic
AI_VISION_MODEL=gpt-4o               # Model identifier
AI_API_KEY=sk-...                     # AI provider API key

# Image Storage
IMAGE_STORAGE_PROVIDER=local          # local | vercel-blob | s3
VERCEL_BLOB_TOKEN=                    # Required if IMAGE_STORAGE_PROVIDER=vercel-blob
AWS_S3_BUCKET=                        # Required if IMAGE_STORAGE_PROVIDER=s3
AWS_S3_REGION=                        # Required if IMAGE_STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=                    # Required if IMAGE_STORAGE_PROVIDER=s3
AWS_SECRET_ACCESS_KEY=                # Required if IMAGE_STORAGE_PROVIDER=s3
```

### 7.6 Dependencies (new)

| Package             | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `ai`                | Vercel AI SDK — provider-agnostic AI model calls      |
| `@ai-sdk/openai`    | OpenAI provider for Vercel AI SDK                     |
| `@ai-sdk/google`    | Google provider (optional, for Gemini)                |
| `@ai-sdk/anthropic` | Anthropic provider (optional, for Claude)             |
| `@vercel/blob`      | Vercel Blob Storage (production image storage option) |
| `react-dropzone`    | Drag-and-drop file upload component                   |

## 8. Implementation phases

### Phase 1: Infrastructure & Image Upload (Priority: High) ✅ COMPLETED

- [x] Add Prisma schema: `AIImportSession`, `ImportImage` models + enums
- [x] Add optional `importImageId` FK to `ExpenseEntry` and `BankAssetEntry`
- [x] Run Prisma migration (`20260228120102_add_ai_import_infrastructure`)
- [x] Install dependencies: `ai`, `@ai-sdk/openai`, `react-dropzone`, `@vercel/blob`
- [x] Implement `ImageStorageAdapter` interface with `LocalStorageAdapter` (+ VercelBlobStorageAdapter, S3StorageAdapter placeholder)
- [x] Create upload Route Handler (`app/api/ai-import/upload/route.ts`)
- [x] Add file validation (type, size, dimensions with magic number parsing)
- [x] Update `.env-example` with new environment variables
- [ ] Unit tests for storage adapter and validation (optional for MVP)

### Phase 2: AI Vision Pipeline (Priority: High) ✅ COMPLETED

- [x] Implement `AIVisionService` using Vercel AI SDK (`src/server/services/ai-import/ai-vision.service.ts`)
- [x] Create expense extraction prompt template with category list
- [x] Create structured output Zod schema for AI responses
- [x] Implement `ExpenseMapperService` (AI output → ExpenseEntry records)
- [x] Implement category fuzzy matching logic (`category-matcher.service.ts`)
- [x] Create parse Route Handler (`app/api/ai-import/parse/route.ts`)
- [x] Add SSE streaming for progress updates to client
- [ ] Unit tests for mapper service and prompt construction (optional for MVP)
- [ ] Integration test: end-to-end expense image parsing (optional for MVP)

### Phase 3: Expense Import UI (Priority: High) ✅ COMPLETED

- [x] Create `AIImportWizard` modal component (3-step wizard with progress indicator)
- [x] Create `UploadStep` with `react-dropzone` drag-and-drop zone and file picker
- [x] Create `ProcessingStep` with per-image progress animation and SSE status handling
- [x] Create `ResultsStep` with summary card, confidence badge, per-image details
- [x] Create `ConfidenceBadge` component (High/Medium/Low visual indicator)
- [x] Create thumbnail grid with remove buttons in `UploadStep`
- [x] Add "AI Import" button to Expenses page
- [x] Wire wizard to upload and parse API endpoints
- [x] Handle error states (failed uploads, AI errors, partial success)
- [x] Trigger `router.refresh()` on successful import
- [ ] Manual testing with real CommBank/banking app screenshots (optional post-MVP validation)
- [ ] ImageLightbox component for viewing source images (Phase 4 enhancement)

### Phase 4: Audit Trail & Post-Edit (Priority: Medium) 🔄 NEXT

- [ ] Create `ImportAuditIcon` component (camera icon on imported records)
- [ ] Create `ImageLightbox` component (full-size image viewer modal)
- [ ] Add audit icon to `CategoryBreakdownModal` for entries with `importImageId`
- [ ] Implement lightbox for viewing source images from records
- [ ] Ensure existing edit/delete flows work correctly on AI-imported records
- [ ] Test post-edit workflow: import → view → edit corrections

### Phase 5: Bank Assets Import (Priority: High)

- [ ] Create bank asset extraction prompt template
- [ ] Implement `BankAssetMapperService` (AI output → BankAssetEntry records)
- [ ] Implement bank/account matching logic
- [ ] Add "AI Import" button to Bank Assets page
- [ ] Wire wizard to bank asset context (snapshot date, bank matching)
- [ ] Handle new account creation from AI-extracted data
- [ ] Integrate with tRPC query invalidation for bank assets
- [ ] Manual testing with real bank balance screenshots

### Phase 6: Cloud Storage & Production Readiness (Priority: High)

- [ ] Implement `CloudStorageAdapter` (Vercel Blob or S3)
- [ ] Configure storage provider switching via environment variable
- [ ] Add image cleanup job (delete orphaned images)
- [ ] Add AI usage logging (tokens, cost estimates)
- [ ] Run `pnpm run build` to verify production build
- [ ] Update `.env-example` with all new variables
- [ ] Production deployment and smoke testing

### Phase 7: Polish & Hardening (Priority: Medium)

- [ ] Add loading skeletons for wizard steps
- [ ] Improve error recovery (retry failed images, fallback to manual)
- [ ] Accessibility audit (keyboard navigation, screen reader support, ARIA labels)
- [ ] Mobile responsive testing for wizard modal
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Performance optimization (image compression before upload)
- [ ] End-to-end tests with mocked AI responses

## 9. Success metrics

- **Adoption**: 60% of active users try AI Import within 60 days of launch
- **Efficiency**: AI Import reduces average data entry time by 70% compared to manual entry
- **Accuracy**: Average overall confidence score ≥ 85% across all imports
- **Reliability**: Less than 5% of import sessions result in complete failure
- **Engagement**: Users who try AI Import use it for 80%+ of subsequent data entry sessions
- **Post-edit rate**: Less than 30% of AI-imported records require manual corrections

## 10. Open questions and risks

### 10.1 Open questions

- Should there be a monthly usage cap for AI API calls to control costs? **Recommendation**: Start without caps, monitor usage, add if needed
- Should we support HEIC format natively or require conversion to JPG before upload? **Recommendation**: Accept HEIC, convert server-side before sending to AI
- Should bulk delete of AI-imported records be supported (undo entire import session)? **Recommendation**: Yes, add "Undo Import" feature in Phase 7 as enhancement
- Should the wizard support re-processing a previously uploaded image with different context (e.g., different month)? **Recommendation**: Not in MVP — user uploads again

### 10.2 Risks

- **Risk**: AI may misread amounts in low-quality screenshots or unusual banking app layouts
  - **Mitigation**: Auto-save with easy post-edit; confidence scoring surfaces unreliable results; prompt engineering with examples from common banking apps

- **Risk**: Banking app UI changes may break extraction accuracy over time
  - **Mitigation**: Provider-agnostic design allows switching to better models; prompt templates easily updated; no training on specific layouts

- **Risk**: AI API costs could escalate with heavy usage
  - **Mitigation**: Log token usage per request; implement usage monitoring; consider caching repeated identical images; batch optimization

- **Risk**: Image storage costs grow unbounded
  - **Mitigation**: Implement image retention policy (auto-delete after N months); compress images before storage; offer user option to delete source images

- **Risk**: Sensitive financial data sent to third-party AI providers
  - **Mitigation**: Document data handling in privacy policy; use enterprise AI agreements where available; consider on-premise models as future option

- **Risk**: File upload security vulnerabilities (malicious files disguised as images)
  - **Mitigation**: Server-side MIME type validation; image dimension/content verification; sandboxed processing; no execution of uploaded content

## 11. Future enhancements (out of scope for MVP)

- PDF bank statement parsing (multi-page document support)
- Automatic category learning from user corrections (feedback loop)
- Recurring import templates (same bank, same categories monthly)
- Scheduled imports via email (forward statement screenshots to a dedicated email)
- Stock portfolio screenshot parsing (extending to Stocks page)
- Multi-language OCR support (non-English banking apps)
- On-device AI processing (privacy-first, no cloud)
- Import history dashboard with analytics
- Bulk undo/rollback of entire import sessions
- Smart duplicate detection (warn if similar amounts already exist for that month)
- Image annotation (user highlights relevant areas before AI processing)
- WhatsApp/Telegram bot integration (send screenshot via chat, data appears in app)

## 12. Implementation Notes (February 2026)

### 12.1 Architecture Decisions

#### Vercel AI SDK for Provider Abstraction

- **Decision**: Use Vercel AI SDK (`ai` package) for LLM integration instead of direct OpenAI client
- **Rationale**: Provider-agnostic approach allows swapping OpenAI GPT-4o → Google Gemini → Anthropic Claude without code changes
- **Implementation**: `ai-vision.service.ts` uses `generateText()` for structured extraction with manual JSON parsing via Zod validation
- **Note**: Initially attempted `generateObject()` but TypeScript type instantiation depth required simpler approach

#### Storage Adapter Pattern

- **Decision**: Pluggable storage backend with factory function
- **Implementations**:
  - LocalStorageAdapter (development, `/uploads/ai-imports/`)
  - VercelBlobStorageAdapter (production)
  - S3StorageAdapter (placeholder, Phase 6)
- **Environment Variable**: `IMAGE_STORAGE_PROVIDER` controls runtime selection

#### Server-Sent Events (SSE) for Real-Time Progress

- **Decision**: Stream parsing progress back to client via `ReadableStream` instead of polling
- **Benefits**: Real-time UI updates, efficient resource usage, simpler error isolation
- **Event Schema**: TypeScript + Zod validated events (progress, extraction, saved, error, complete)

#### Fuzzy Matching for Category Assignment

- **Decision**: 3-tier matching strategy with semantic awareness
- **Tiers**: Exact match → substring match → fuzzy match (Levenshtein distance, threshold 0.75)
- **Semantic Mappings**: Hardcoded mappings for common aliases (e.g., "Petrol" → "Transportation")
- **Fallback**: Unmatched categories default to "Other" with warning

### 12.2 Technical Stack

| Component          | Technology                              | Notes                                |
| ------------------ | --------------------------------------- | ------------------------------------ |
| Frontend Framework | Next.js 15.4.5                          | App Router only (no pages directory) |
| Language           | TypeScript (strict mode)                | Type-safe throughout                 |
| AI Provider        | OpenAI GPT-4o                           | Via Vercel AI SDK                    |
| Image Upload       | react-dropzone                          | Drag-and-drop + file picker          |
| Modal UI           | Headless UI (Dialog + Transition)       | Existing project pattern             |
| Styling            | Tailwind CSS                            | Consistent with project              |
| ORM                | Prisma 6.13.0                           | Database-agnostic                    |
| Database           | PostgreSQL                              | Production data store                |
| Authentication     | NextAuth                                | Session-scoped access control        |
| Validation         | Zod v3                                  | Schema validation throughout         |
| File Storage       | Local filesystem / Vercel Blob / AWS S3 | Pluggable via adapter                |

### 12.3 Database Schema Impact

**New Models**:

- `AIImportSession` (tracks import batch with status, confidence, metadata)
- `ImportImage` (stores image metadata with storage details)

**Enums**:

- `ImportTypeEnum` (EXPENSE, BANK_ASSET)
- `ImportStatusEnum` (PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED)
- `StorageProviderEnum` (LOCAL, VERCEL_BLOB, S3)

**Backward Compatibility**: New optional `importImageId` foreign keys on ExpenseEntry and BankAssetEntry (SET NULL on image deletion)

**Indexes**: Optimized for user + date range queries

### 12.4 API Endpoints

#### POST /api/ai-import/upload

- **Request**: Multipart form with image files
- **Response**: Array of ImageResult (imageId, storageUrl) or HTTP 207 (partial success)
- **Validation**: Per-file MIME type, size, dimensions
- **Authentication**: NextAuth session required

#### POST /api/ai-import/parse

- **Request**: JSON with imageIds, importType, context (calendarYearId + month)
- **Response**: Server-Sent Events stream (text/event-stream)
- **Events**: progress, extraction, saved, error, complete
- **Processing**: Sequential per-image (non-blocking error isolation)
- **Authentication**: NextAuth session required

### 12.5 Frontend Components

| Component       | Purpose                                                  | Type   |
| --------------- | -------------------------------------------------------- | ------ |
| AIImportWizard  | Main modal orchestrating 3-step flow                     | Client |
| UploadStep      | Drag-drop zone + file picker + thumbnail grid            | Client |
| ProcessingStep  | Real-time progress via SSE stream                        | Client |
| ResultsStep     | Summary card with confidence score and per-image details | Client |
| ConfidenceBadge | Visual indicator (HIGH/MEDIUM/LOW with color)            | Client |

**Design Notes**:

- Modal uses Headless UI Dialog + Transition for consistent styling
- Progress bar updates in real-time via SSE events
- Thumbnail preview uses URL.createObjectURL for synchronous loading
- Error handling per-image (one failure doesn't block others)

### 12.6 Known Limitations & Future Work

**MVP Limitations**:

- No ImageLightbox component (Phase 4 enhancement)
- No ImportAuditIcon on records yet (Phase 4 enhancement)
- No Bank Assets import (Phase 5)
- No cloud storage in production (Phase 6)
- No unit/integration tests
- No rate limiting or cost tracking
- Single language (English) support

**Tested Scenarios**:

- ✅ Single image upload and parsing
- ✅ Multiple image batch processing
- ✅ Category fuzzy matching with semantic fallbacks
- ✅ SSE event streaming and error handling
- ✅ ExpenseEntry record creation with FKs
- ✅ Production build verification

**Next Priority**: Phase 4 (Audit Trail) to add camera icons on imported records and image viewer

### 12.7 Deployment Checklist for Production

Before deploying to production:

- [ ] Set `AI_PROVIDER=openai` and `AI_VISION_MODEL=gpt-4o` in environment
- [ ] Configure `IMAGE_STORAGE_PROVIDER=vercel-blob` (set `VERCEL_BLOB_TOKEN`)
- [ ] Test end-to-end with real banking app screenshots
- [ ] Verify image storage quota limits
- [ ] Set up AI API usage monitoring
- [ ] Review privacy policy for data handling statement
- [ ] Monitor token usage and costs for first week
- [ ] Enable database backup strategy for ImportImage records

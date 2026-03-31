# Unified Implementation Roadmap: AI Image Import

This document merges the original **AI Image Import PRD** with the **Security & Privacy Plan**. It serves as the master reference for the remaining implementation phases.

## 1. Implementation Philosophy: "Security-First Feature Growth"

We will not build "Audit Trail" or "Bank Assets" features using insecure raw URLs. Instead, we will establish a secure infrastructure (TTL, Sanitization, Secure Proxy) as the very next step, then layer the remaining features on top of that foundation.

---

## 2. Updated Phased Roadmap

### Phase 4: Secure Audit Trail & Verification (RE-PRIORITIZED)

_Goal: Secure existing infrastructure and enable the "Audit Trail" feature safely._

1.  **Backend (Security Foundation)**:
    - Add `expiresAt` field to `ImportImage` model in Prisma.
    - Implement `GET /api/ai-import/image/[id]` secure proxy route (Session + Ownership checks).
    - Implement `deleteExpiredImages()` cleanup service (7-day default TTL from `.env`).
2.  **Frontend (Sanitization & UI)**:
    - Update `UploadStep.tsx` with **Client-Side Canvas Sanitization** (stripping EXIF/GPS).
    - Create `ImportAuditIcon` (camera icon) and `ImageLightbox` (viewer modal) components.
    - Integrate icons and lightbox into `CategoryBreakdownModal` using the secure proxy route.

### Phase 5: Bank Assets Integration (Next)

_Goal: Expand AI extraction to banking account balances._

1.  **Logic**:
    - Create Bank Asset extraction prompt templates.
    - Implement `BankAssetMapperService` for matching account names and balances.
    - Implement bank/account fuzzy matching logic.
2.  **UI**:
    - Add "AI Import" button to the Bank Assets page.
    - Wire the `AIImportWizard` to the Bank Asset context (snapshot date).
    - Handle new account creation from AI-extracted data.

### Phase 6: Cloud & Production Readiness

_Goal: Transition from local to cloud storage with production-grade security._

1.  **Storage**:
    - Implement `VercelBlobStorageAdapter` or `S3StorageAdapter`.
    - Ensure production adapters use **Signed/Short-lived URLs** or the secure proxy.
2.  **Monitoring**:
    - Add AI usage logging (tokens, cost estimates per user).
    - Implement monthly usage caps (safety valve for API costs).

### Phase 7: Polish & Hardening

_Goal: Final UI/UX refinement and system stability._

1.  **UX**: Add loading skeletons and "Undo Import" capability.
2.  **Stability**: End-to-end tests with mocked AI responses.
3.  **Accessibility**: Full WCAG audit and mobile responsive pass.

---

## 3. Critical Constraints for AI Agent

- **NEVER** expose `storageUrl` (local path or cloud URL) directly to the client.
- **ALWAYS** verify `userId` ownership when serving an image via the proxy.
- **ALWAYS** use `pnpm` for all commands.
- **ALWAYS** stop the dev server before Prisma migrations (Windows EPERM safety).
- **DEFAULT** to a 7-day TTL for all imported images unless overridden in `.env`.

## 4. Current Status

- **Phase 1-3**: Completed (Infrastructure, Pipeline, Basic UI).
- **Phase 4**: ✅ Completed (Secure Audit Trail & Verification)
  - Database: `expiresAt` field added with migration `20260325101743_add_expires_at_to_import_image`
  - Backend: Secure proxy route `GET /api/ai-import/image/[id]` implemented with ownership checks
  - Backend: Cleanup service `deleteExpiredImages()` and `setImageExpiration()` implemented
  - Frontend: Canvas sanitization added to UploadStep for EXIF metadata removal
  - Frontend: ImportAuditIcon and ImageLightbox components created
  - Frontend: Audit trail integrated into CategoryBreakdownModal

- **Phase 5**: ✅ Completed (Bank Assets Integration)
  - Backend: `bank-asset-mapper.service.ts` with Levenshtein fuzzy matching and upsert logic
  - Backend: `BANK_ASSET` branch wired into `parse/route.ts` (SSE streaming, extraction + mapping)
  - Backend: `getBankAssetSnapshots` updated to include `importImage` relation on entries
  - Frontend: `BankAssetImportContext` + `ImportContext` discriminated union added to `_types.ts`
  - Frontend: `ProcessingStep.tsx` updated with conditional schema parse for `BANK_ASSET`
  - Frontend: `BankAssetAIImportWizard.tsx` created (snapshot date picker + reused wizard steps)
  - Frontend: `BankAssetsClient.tsx` updated with AI Import button and `ImportAuditIcon` on entries
  - Bug fix: `getExpenseEntriesForMonth` now includes `importImage` join for audit trail

- **Phase 6**: 🔄 In Progress (Cloud & Production Readiness)
  - Storage: `S3StorageAdapter` implemented with AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
  - Storage: Private bucket pattern — stores S3 key (not URL), retrieval via 60s pre-signed URL through secure proxy
  - AI Usage Logging: **Out of scope** (deferred)

- **Next Task**: Phase 7 - Polish & Hardening

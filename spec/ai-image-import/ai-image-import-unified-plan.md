# Unified Implementation Roadmap: AI Image Import

This document merges the original **AI Image Import PRD** with the **Security & Privacy Plan**. It serves as the master reference for the remaining implementation phases.

## 1. Implementation Philosophy: "Security-First Feature Growth"
We will not build "Audit Trail" or "Bank Assets" features using insecure raw URLs. Instead, we will establish a secure infrastructure (TTL, Sanitization, Secure Proxy) as the very next step, then layer the remaining features on top of that foundation.

---

## 2. Updated Phased Roadmap

### Phase 4: Secure Audit Trail & Verification (RE-PRIORITIZED)
*Goal: Secure existing infrastructure and enable the "Audit Trail" feature safely.*

1.  **Backend (Security Foundation)**:
    *   Add `expiresAt` field to `ImportImage` model in Prisma.
    *   Implement `GET /api/ai-import/image/[id]` secure proxy route (Session + Ownership checks).
    *   Implement `deleteExpiredImages()` cleanup service (7-day default TTL from `.env`).
2.  **Frontend (Sanitization & UI)**:
    *   Update `UploadStep.tsx` with **Client-Side Canvas Sanitization** (stripping EXIF/GPS).
    *   Create `ImportAuditIcon` (camera icon) and `ImageLightbox` (viewer modal) components.
    *   Integrate icons and lightbox into `CategoryBreakdownModal` using the secure proxy route.

### Phase 5: Bank Assets Integration (Next)
*Goal: Expand AI extraction to banking account balances.*

1.  **Logic**:
    *   Create Bank Asset extraction prompt templates.
    *   Implement `BankAssetMapperService` for matching account names and balances.
    *   Implement bank/account fuzzy matching logic.
2.  **UI**:
    *   Add "AI Import" button to the Bank Assets page.
    *   Wire the `AIImportWizard` to the Bank Asset context (snapshot date).
    *   Handle new account creation from AI-extracted data.

### Phase 6: Cloud & Production Readiness
*Goal: Transition from local to cloud storage with production-grade security.*

1.  **Storage**:
    *   Implement `VercelBlobStorageAdapter` or `S3StorageAdapter`.
    *   Ensure production adapters use **Signed/Short-lived URLs** or the secure proxy.
2.  **Monitoring**:
    *   Add AI usage logging (tokens, cost estimates per user).
    *   Implement monthly usage caps (safety valve for API costs).

### Phase 7: Polish & Hardening
*Goal: Final UI/UX refinement and system stability.*

1.  **UX**: Add loading skeletons and "Undo Import" capability.
2.  **Stability**: End-to-end tests with mocked AI responses.
3.  **Accessibility**: Full WCAG audit and mobile responsive pass.

---

## 3. Critical Constraints for AI Agent
*   **NEVER** expose `storageUrl` (local path or cloud URL) directly to the client.
*   **ALWAYS** verify `userId` ownership when serving an image via the proxy.
*   **ALWAYS** use `pnpm` for all commands.
*   **ALWAYS** stop the dev server before Prisma migrations (Windows EPERM safety).
*   **DEFAULT** to a 7-day TTL for all imported images unless overridden in `.env`.

## 4. Current Status
- **Phase 1-3**: Completed (Infrastructure, Pipeline, Basic UI).
- **Next Task**: Phase 4, Step 1 (Database Update for `expiresAt`).

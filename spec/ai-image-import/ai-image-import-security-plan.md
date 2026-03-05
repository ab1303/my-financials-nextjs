# Security & Privacy Plan: AI Image Import

## 1. Objective
Enhance the security and privacy of AI-powered image imports by minimizing data persistence and preventing unauthorized access to sensitive financial screenshots.

## 2. Core Security Pillars

### 2.1 Client-Side Sanitization (Metadata Stripping)
Before any image is uploaded to the server, it will be "scrubbed" in the browser to remove all EXIF metadata (GPS, device info, timestamps).
- **Mechanism**: Draw the selected image to an off-screen HTML5 Canvas and re-export it as a clean Blob.
- **Benefit**: Ensures that "toxic" metadata never touches the server or the AI provider.

### 2.2 Secure Image Serving (Authenticated Proxy)
Raw storage URLs (local paths or S3 buckets) will never be exposed to the client.
- **Mechanism**: A dedicated route `GET /api/ai-import/image/[id]` will act as a secure proxy.
- **Validation**: The route will verify the user's session and database ownership before streaming the image buffer.
- **IDOR Protection**: Prevents users from guessing and viewing other people's screenshots.

### 2.3 Configurable Auto-Destruct (7-Day TTL)
Financial screenshots will be treated as transient assets, with a default lifespan of 7 days.
- **Configuration**: `AI_IMPORT_IMAGE_TTL_DAYS=7` (default) in `.env`.
- **Mechanism**: 
  - Add `expiresAt` field to the `ImportImage` model.
  - Implementation of a "Cleanup Job" (invoked periodically or via serverless function).
- **Manual Override**: A "Delete Now" button in the UI for users who want immediate erasure.

## 3. Minimalist Implementation Steps

### Step 1: Database Update
Update `prisma/schema.prisma` to include the expiration timestamp.
```prisma
model ImportImage {
  // ... existing fields ...
  expiresAt DateTime? // Timestamp for auto-deletion
}
```

### Step 2: Client-Side Scrubbing
Update `UploadStep.tsx` to sanitize images using a Canvas-based helper before they are added to the upload queue.
```typescript
async function sanitizeImage(file: File): Promise<File> {
  // 1. Create Image object
  // 2. Draw to Canvas (strips metadata)
  // 3. Export to Blob -> new File()
}
```

### Step 3: Secure API Route
Implement `app/api/ai-import/image/[id]/route.ts` with strict session and ownership checks.

### Step 4: Cleanup Service
Implement a minimalist `deleteExpiredImages()` service that:
1. Finds `ImportImage` records where `expiresAt < now()`.
2. Deletes the physical file using the `ImageStorageAdapter`.
3. Removes the database record.

## 4. Risk Mitigation Summary

| Risk | Mitigation |
| :--- | :--- |
| **IDOR / Leakage** | Authenticated Proxy Route (No raw URLs). |
| **Data Training** | Use Developer API (GPT-4o API excludes data from training). |
| **Metadata Leak** | Client-side Canvas sanitization. |
| **Stale Data** | 7-day Auto-Destruct (TTL). |
| **Public Storage** | Private access buckets + Signed URLs (Production). |

## 5. Phase 4 Alignment (Audit Trail)
The Audit Trail feature will remain functional during the 7-day "Window of Trust." After 7 days, the camera icon will simply disappear or show a "Source image expired" placeholder, ensuring the primary goal (data entry) is achieved without creating a permanent security liability.

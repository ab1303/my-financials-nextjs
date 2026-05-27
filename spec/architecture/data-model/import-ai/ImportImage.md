# ImportImage

## Purpose
Stores metadata for a single uploaded file within an import session, including storage location, extracted content, confidence, and parsing errors.

## Domain
Import/AI

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| userId | String | No | Owner user foreign key. |
| sessionId | String | No | Foreign key to the parent import session. |
| fileName | String | No | Original or display file name. |
| fileSize | Int | No | File size in bytes. |
| mimeType | String | No | MIME type of the uploaded file. |
| storageUrl | String | No | Object storage URL or path. |
| storageProvider | StorageProviderEnum | No | Storage provider such as `LOCAL` or `S3`. |
| confidence | Float | Yes | File-level extraction confidence. |
| extractedData | Json | Yes | Raw or normalized extracted payload. |
| errorMessage | String | Yes | Processing error details if extraction failed. |
| expiresAt | DateTime | Yes | Optional object-expiry timestamp. |
| createdAt | DateTime | No | Record creation timestamp. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)
- ImportSession (`sessionId` → `ImportSession.id`)

### Has Many
- MonthlyExpenseSummary
- BankBalanceRecord

## Indexes & Constraints
- Primary key on `id`
- Index on `[sessionId]`
- Index on `[userId]`
- Foreign keys to `User` and `ImportSession`

## Notes
This table supports both image-based and CSV-based import artifacts.
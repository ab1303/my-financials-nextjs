# AIUsageLog

## Purpose
Provides an audit trail of AI model usage per import operation, capturing tokens, estimated cost, model identity, and user/session context for monitoring and charge analysis.

## Domain
Import/AI

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| sessionId | String | No | Foreign key to the related import session. |
| userId | String | No | Owner user foreign key. |
| imageId | String | Yes | Optional related import image identifier. |
| importType | ImportTypeEnum | No | Import mode for the AI call. |
| model | String | No | AI model name. |
| promptTokens | Int | No | Prompt token count. |
| completionTokens | Int | No | Completion token count. |
| totalTokens | Int | No | Total token count. |
| estimatedCostUSD | Float | No | Estimated call cost in USD. |
| createdAt | DateTime | No | Log creation timestamp. |

## Relationships
### Belongs To
- ImportSession (`sessionId` → `ImportSession.id`)
- User (`userId` → `User.id`)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Index on `[userId, createdAt]`
- Index on `[userId, importType, createdAt]`
- Index on `[importType, createdAt]`
- Index on `[sessionId]`
- Foreign keys to `ImportSession` and `User`

## Notes
The schema includes `imageId` as a field but the provided summary does not define a formal Prisma relation for it.
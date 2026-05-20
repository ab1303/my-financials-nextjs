# User-Profile Domain — High Level Design

## Domain Scope

The user-profile domain owns persistent user-facing identity and preference data attached to the authenticated user. It covers profile metadata (name, avatar, contact and bio fields), user-scoped settings, and preference values that influence how the rest of the application renders financial information.

---

## User Model Architecture

The domain is centered on the existing `User` model rather than a separate `UserProfile` table.

### Core identity fields

| Field | Purpose | Notes |
|---|---|---|
| `id` | Stable user identifier | Shared across all user-owned data |
| `email` | Login/contact identity | Auth-owned; profile UI treats it as read-only |
| `name` | Display name | Used in navigation, settings, and account identity |
| `image` | OAuth-managed avatar URL | Preserved for provider-managed profile images |

### Extended profile fields

| Field | Purpose | Pattern |
|---|---|---|
| `phone` | Optional contact detail | User-managed profile metadata |
| `bio` | Freeform profile summary | User-managed profile metadata |
| `timezone` | Date/time rendering context | Preference that affects presentation across the app |
| `linkedInUrl` | Optional professional profile link | User-managed profile metadata |
| `avatarStorageUrl` | Uploaded avatar location | Takes display priority over OAuth image |
| `avatarStorageProvider` | Storage backend identifier | Tracks where uploaded avatar is stored |

### Financial preference fields

| Field | Purpose | Cross-app effect |
|---|---|---|
| `preferredCurrency` | Default display currency | Guides currency formatting in UI and summaries |
| `fiscalYearType` | Default accounting year mode | Guides ledger/report defaults and fiscal-year context |

The domain should keep user-specific preferences on `User` when they are 1:1, low-cardinality, and read together with identity data. Separate tables are reserved for settings that become multi-record, high-volume, or independently shared.

---

## User Settings and Preference Patterns

### 1. User-owned settings live on the server

Profile and preference values are resolved from the authenticated server-side user context. Client code should never pass `userId` for profile mutations; the server derives ownership from the session.

### 2. Preferences are split by behavior

- **Identity preferences**: name, avatar, bio, contact details
- **Presentation preferences**: timezone, currency, theme or future display options
- **Financial-context preferences**: fiscal year defaults and other accounting-oriented defaults

### 3. Preferences should be additive and backward compatible

New settings should default safely so existing users remain valid after schema changes. Nullable fields and explicit defaults are preferred for migration safety.

### 4. One canonical resolution path per preference

- Avatar: `avatarStorageUrl` → `image` → initials fallback
- Currency display: user preference first, then app/domain fallback
- Fiscal year context: user preference first, then reporting or ledger fallback
- Theme and future UI preferences: follow the same user-scoped preference pattern when introduced

---

## Cross-Domain Dependencies

### Auth and session management

The domain depends on authentication/session infrastructure to identify the current user and to refresh session-backed display data when name or avatar changes. Auth owns sign-in identity; user-profile owns editable profile presentation layered on top of that identity.

### Storage and media handling

Uploaded avatars depend on shared storage infrastructure so the same local/S3 adapter patterns can be reused without duplicating file-management logic.

### Financial reporting and ledger flows

`preferredCurrency`, `timezone`, and `fiscalYearType` influence how balances, reports, dates, and ledger defaults are presented elsewhere in the product. Those consumers read preference values, but they do not own them.

### UI settings and future personalization

Theme, density, and other UI personalization settings belong to the same user-scoped preference family even when implemented in separate features. The domain HLD establishes the storage and ownership pattern for those future settings.

---

## Shared Architectural Rules

1. Keep the page shell server-first, with client wrappers only for interactive profile editing.
2. Treat `image` as auth/provider-managed and avoid overwriting it during profile updates.
3. Refresh session-derived UI after identity changes so navigation and account chrome stay consistent.
4. Reuse shared validation, storage, and mutation patterns instead of inventing user-profile-specific infrastructure.
5. Keep file inventory and implementation sequencing out of the domain HLD; those belong in feature LLDs.

---

## App-Wide Behavior Effects

| Preference | Effect on the app |
|---|---|
| `preferredCurrency` | Determines default currency formatting and user-facing money display |
| `fiscalYearType` | Sets default fiscal-year framing for ledgers, summaries, and reports |
| `timezone` | Controls date/time formatting and user-localized time context |
| Avatar/name | Affects navigation, profile surfaces, and account identity display |
| Theme or future UI prefs | Will affect visual rendering and personalization when implemented |

---

## Domain Boundaries

### In scope

- User identity metadata and editable profile fields
- User-scoped settings and preferences
- Preference ownership, storage patterns, and cross-domain read semantics
- Session-facing profile presentation rules

### Out of scope

- Authentication provider management
- Authorization/role design
- Notification systems
- Multi-user collaboration preferences
- Feature-specific settings owned by another domain

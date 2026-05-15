# State Management & Notifications

## State Management
- **Async State**: Use React Query for all asynchronous data fetching/mutations.
- **Immutability**: Use `Immer` for immutable state updates.
- **Local State**: Prefer local state over global unless absolutely necessary.
- **Forms/Editing**: Manage state in Client Components using `useState`. Reset after successful operations.
- **Boundaries**: Use Client Component wrappers to bridge Server/Client boundaries when event handlers are needed.

## Notifications & Feedback
- **Library**: Use `sonner` for all user notifications (`import { toast } from 'sonner'`).
- The `<Toaster>` is mounted globally in `src/components/Providers.tsx` — do not add it again.
- **Standard Actions**:
  - `toast.success()`: For successful create, update, or delete operations.
  - `toast.error()`: For failures, with descriptive error messages.
- **Confirmations**: For delete operations, always use `window.confirm()` before proceeding.
- **Consistency**: Provide specific, actionable feedback (e.g., "Calendar year created successfully!").

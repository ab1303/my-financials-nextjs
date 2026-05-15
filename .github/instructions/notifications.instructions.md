# Notifications

- Use `sonner` for all user notifications (`import { toast } from 'sonner'`).
- The `<Toaster>` is mounted globally in `src/components/Providers.tsx` — do not add it again.
- Standardize notification styles and placement.
- Handle success/error messages for all user actions.
- Use `toast.success()` for successful operations (create, update, delete).
- Use `toast.error()` for error messages with descriptive text.
- For delete operations, use `window.confirm()` for confirmation dialogs before proceeding.
- Provide specific success messages that indicate the action performed (e.g., "Calendar year created successfully!").
- Always show feedback for both successful and failed operations.

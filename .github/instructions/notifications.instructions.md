# Notifications

- Use React Toastify for user notifications.
- Standardize notification styles and placement.
- Handle success/error messages for all user actions.
- Use `toast.success()` for successful operations (create, update, delete).
- Use `toast.error()` for error messages with descriptive text.
- For delete operations, use `window.confirm()` for confirmation dialogs before proceeding.
- Provide specific success messages that indicate the action performed (e.g., "Calendar year created successfully!").
- Always show feedback for both successful and failed operations.

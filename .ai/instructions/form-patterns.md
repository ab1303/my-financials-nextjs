# Form Implementation Patterns

## Layout Standards
- **Background**: Apply `layoutStyles.grayBackground` from theme utilities.
- **Constraints**: Use `max-w-3xl` for standard forms.
- **Cards**: Wrap form content in Card components.

## Technical Patterns
- **Framework**: Use `react-hook-form` with `zod` and `FormProvider`.
- **Imports**:
  ```typescript
  import clsx from 'clsx';
  import { z } from 'zod';
  import { useId, useState } from 'react';
  import { FormProvider, useForm } from 'react-hook-form';
  import { toast } from 'sonner';
  ```
- **Enum Integration**: Import from `@/types/enum` and render as styled dropdowns.
- **Editing State**: Manage editing state in Client Components using `useState<RecordType | null>`.
- **Reset**: Clear forms and editing state after successful Server Action completion.

## Nested Forms
- Never nest `<form>` inside another `<form>` — this is invalid HTML and causes hydration errors.
- For modals/drawers rendered inside a page that already has a `<form>`, use `createPortal` to
  render the overlay into `document.body`, or replace the inner `<form>` with a `<div>` and
  trigger submission via `type="button" onClick={handleSubmit(...)}`.

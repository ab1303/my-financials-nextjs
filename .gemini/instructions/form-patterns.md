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
  import { toast } from 'react-toastify';
  ```
- **Enum Integration**: Import from `@/types/enum` and render as styled dropdowns.
- **Editing State**: Manage editing state in Client Components using `useState<RecordType | null>`.
- **Reset**: Clear forms and editing state after successful Server Action completion.

import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number format')
    .nullish()
    .transform((v) => v || null),
  bio: z
    .string()
    .max(500, 'Bio must be 500 characters or less')
    .nullish()
    .transform((v) => v || null),
  timezone: z.string().min(1, 'Timezone is required'),
  linkedInUrl: z
    .string()
    .url('Must be a valid URL')
    .regex(
      /^https?:\/\/(www\.)?linkedin\.com\/in\//,
      'Must be a LinkedIn profile URL (https://linkedin.com/in/...)',
    )
    .nullish()
    .transform((v) => v || null),
  preferredCurrency: z.enum(['AUD', 'USD']),
  fiscalYearType: z.enum(['FISCAL', 'ANNUAL']),
});

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain uppercase, lowercase, and a number',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const uploadAvatarSchema = z.object({
  fileBase64: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  fileName: z.string().min(1),
});

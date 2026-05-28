import type { TypeOf } from 'zod';
import { object, string, number, z } from 'zod';

export const createBankSchema = object({
  name: string({ required_error: 'Bank Name is required' })
    .min(1, 'Bank Name cannot be empty')
    .max(100, 'Bank Name must be less than 100 characters'),
});

export const params = object({
  bankId: string({
    required_error: 'bank id is required',
  }),
});

export type CreateBankInput = TypeOf<typeof createBankSchema>;
export type ParamsInput = TypeOf<typeof params>;

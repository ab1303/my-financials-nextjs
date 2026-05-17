import { z } from 'zod';

export const createBankAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(100),
  bankId: z.string().min(1, 'Bank is required'),
});

export const deleteBankAccountSchema = z.object({
  id: z.string().min(1),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type DeleteBankAccountInput = z.infer<typeof deleteBankAccountSchema>;

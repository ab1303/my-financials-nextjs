import type { TypeOf } from 'zod';
import { object, string, number, z } from 'zod';

export const createBankSchema = object({
  name: string({ required_error: 'Bank Name is required' }).max(
    100,
    'Bank Name must be less than 100 characters'
  ),
  addressLine: string({ required_error: 'Address line is required' }),
  streetAddress: string({ required_error: 'Street address is required' }),
  postcode: number({ required_error: 'Postcode is required' }).max(9999),
  state: string({ required_error: 'State is required' }),
  suburb: string({ required_error: 'Suburb is required' }),
});

export const params = object({
  bankId: string({
    required_error: 'bank id is required',
  }),
});

export type CreateBankInput = TypeOf<typeof createBankSchema>;
export type ParamsInput = TypeOf<typeof params>;

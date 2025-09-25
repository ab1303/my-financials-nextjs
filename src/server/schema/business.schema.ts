import type { TypeOf } from 'zod';
import z, { object, string, number } from 'zod';
import { BusinessEnumType } from '@/types/enum';

export const createBusinessSchema = object({
  name: string({ required_error: 'Business Name is required' }).max(
    100,
    'Business Name must be less than 100 characters',
  ),
  type: z.nativeEnum(BusinessEnumType, {
    required_error: 'Business type is required',
    invalid_type_error: 'Invalid business type',
  }),
  addressLine: string({ required_error: 'Address line is required' }),
  streetAddress: string({ required_error: 'Street address is required' }),
  postcode: number({ required_error: 'Postcode is required' }).max(9999),
  state: string({ required_error: 'State is required' }),
  suburb: string({ required_error: 'Suburb is required' }),
});

export const params = object({
  businessId: string({
    required_error: 'business id is required',
  }),
});

export type CreateBusinessInput = TypeOf<typeof createBusinessSchema>;
export type ParamsInput = TypeOf<typeof params>;

import type { TypeOf } from 'zod';
import z, { number, object, optional, string } from 'zod';

import { BusinessEnumType } from '@/types/enum';

export const createBusinessSchema = object({
  name: string({ required_error: 'Business Name is required' }).max(
    100,
    'Business Name must be less than 100 characters',
  ),
  type: z
    .nativeEnum(BusinessEnumType, {
      required_error: 'Business type is required',
      invalid_type_error: 'Invalid business type',
    })
    .optional(),
  isDgrRegistered: optional(z.boolean()),
  // Address fields are all optional
  addressLine: optional(
    string().max(500, 'Address line must be less than 500 characters'),
  ),
  streetAddress: optional(
    string().max(200, 'Street address must be less than 200 characters'),
  ),
  postcode: optional(number().min(1000).max(9999)),
  state: optional(string().max(20, 'State must be less than 20 characters')),
  suburb: optional(
    string().max(100, 'Suburb must be less than 100 characters'),
  ),
});

export const updateBusinessSchema = object({
  id: string({ required_error: 'Business ID is required' }),
  name: optional(
    string().max(100, 'Business Name must be less than 100 characters'),
  ),
  isDgrRegistered: optional(z.boolean()),
  // Address fields are all optional for updates
  addressLine: optional(
    string().max(500, 'Address line must be less than 500 characters'),
  ),
  streetAddress: optional(
    string().max(200, 'Street address must be less than 200 characters'),
  ),
  postcode: optional(number().min(1000).max(9999)),
  state: optional(string().max(20, 'State must be less than 20 characters')),
  suburb: optional(
    string().max(100, 'Suburb must be less than 100 characters'),
  ),
});

export const params = object({
  businessId: string({
    required_error: 'business id is required',
  }),
});

export type CreateBusinessInput = TypeOf<typeof createBusinessSchema>;
export type UpdateBusinessInput = TypeOf<typeof updateBusinessSchema>;
export type ParamsInput = TypeOf<typeof params>;

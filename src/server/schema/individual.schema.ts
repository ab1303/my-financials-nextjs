import type { TypeOf } from 'zod';
import z, { object, string, number, optional } from 'zod';

export const createIndividualSchema = object({
  name: string({ required_error: 'Individual Name is required' })
    .min(1, 'Individual Name is required')
    .max(100, 'Individual Name must be less than 100 characters')
    .trim(),
  firstName: optional(
    string().max(50, 'First Name must be less than 50 characters'),
  ),
  lastName: optional(
    string().max(50, 'Last Name must be less than 50 characters'),
  ),
  relationshipName: optional(
    string().max(150, 'Relationship must be less than 150 characters').trim(),
  ),
  // Address format selector
  addressFormat: optional(
    string().refine(
      (val) => val === 'AU' || val === 'GLOBAL',
      'Address format must be either AU or GLOBAL',
    ),
  ).default('AU'),
  // Address fields (all optional as per PRD)
  // For AU format: use structured fields below
  // For GLOBAL format: use addressLine to store complete address
  addressLine: optional(
    string().max(500, 'Address line must be less than 500 characters'),
  ),
  streetAddress: optional(
    string().max(200, 'Street address must be less than 200 characters'),
  ),
  suburb: optional(
    string().max(100, 'Suburb must be less than 100 characters'),
  ),
  postcode: optional(number().min(1000).max(9999)), // AU postcodes are 4 digits
  state: optional(string().max(20, 'State must be less than 20 characters')),
});

export const updateIndividualSchema = object({
  id: string({ required_error: 'Individual ID is required' }),
  name: optional(
    string()
      .min(1, 'Individual Name is required')
      .max(100, 'Individual Name must be less than 100 characters')
      .trim(),
  ),
  firstName: optional(
    string().max(50, 'First Name must be less than 50 characters'),
  ),
  lastName: optional(
    string().max(50, 'Last Name must be less than 50 characters'),
  ),
  relationshipName: optional(
    string().max(150, 'Relationship must be less than 150 characters').trim(),
  ),
  // Address format selector
  addressFormat: optional(
    string().refine(
      (val) => val === 'AU' || val === 'GLOBAL',
      'Address format must be either AU or GLOBAL',
    ),
  ),
  // Address fields (all optional)
  // For AU format: use structured fields below
  // For GLOBAL format: use addressLine to store complete address
  addressLine: optional(
    string().max(500, 'Address line must be less than 500 characters'),
  ),
  streetAddress: optional(
    string().max(200, 'Street address must be less than 200 characters'),
  ),
  suburb: optional(
    string().max(100, 'Suburb must be less than 100 characters'),
  ),
  postcode: optional(number().min(1000).max(9999)),
  state: optional(string().max(20, 'State must be less than 20 characters')),
});

export const params = object({
  individualId: string({
    required_error: 'Individual ID is required',
  }),
});

// Relationship-specific schemas
export const createRelationshipSchema = object({
  name: string({ required_error: 'Relationship name is required' })
    .min(1, 'Relationship name is required')
    .max(150, 'Relationship name must be less than 150 characters')
    .trim(),
});

export const relationshipParams = object({
  relationshipId: string({
    required_error: 'Relationship ID is required',
  }),
});

export type CreateIndividualInput = TypeOf<typeof createIndividualSchema>;
export type UpdateIndividualInput = TypeOf<typeof updateIndividualSchema>;
export type ParamsInput = TypeOf<typeof params>;
export type CreateRelationshipInput = TypeOf<typeof createRelationshipSchema>;
export type RelationshipParamsInput = TypeOf<typeof relationshipParams>;

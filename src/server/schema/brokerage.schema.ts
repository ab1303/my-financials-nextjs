import { object, string } from 'zod';
import type { TypeOf } from 'zod';

export const createBrokerageSchema = object({
  name: string({ required_error: 'Brokerage name is required' })
    .min(1, 'Brokerage name cannot be empty')
    .max(100, 'Brokerage name must be less than 100 characters'),
});

export const updateBrokerageSchema = object({
  brokerageId: string({ required_error: 'Brokerage id is required' }),
  name: string({ required_error: 'Brokerage name is required' })
    .min(1, 'Brokerage name cannot be empty')
    .max(100, 'Brokerage name must be less than 100 characters'),
});

export const params = object({
  brokerageId: string({ required_error: 'Brokerage id is required' }),
});

export type CreateBrokerageInput = TypeOf<typeof createBrokerageSchema>;
export type UpdateBrokerageInput = TypeOf<typeof updateBrokerageSchema>;
export type ParamsInput = TypeOf<typeof params>;

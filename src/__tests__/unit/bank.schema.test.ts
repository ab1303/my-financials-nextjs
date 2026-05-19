import { describe, expect,it } from 'vitest';
import { ZodError } from 'zod';

import { createBankSchema, params } from '@/server/schema/bank.schema';

describe('bank.schema - Phase 2: Address Logic Removal', () => {
  describe('createBankSchema - name validation (only field in schema)', () => {
    it('should reject missing name', () => {
      // Arrange
      const invalidInput = {};

      // Act
      const result = createBankSchema.safeParse(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.code).toBe('invalid_type');
        expect(result.error.issues[0]?.message).toContain('required');
      }
    });

    it('should accept valid bank name', () => {
      // Arrange
      const validInput = {
        name: 'ANZ',
      };

      // Act
      const result = createBankSchema.safeParse(validInput);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('ANZ');
      }
    });

    it('should accept bank name with exact 100 characters', () => {
      // Arrange
      const validInput = {
        name: 'A'.repeat(100),
      };

      // Act
      const result = createBankSchema.safeParse(validInput);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toHaveLength(100);
      }
    });

    it('should reject bank name longer than 100 characters', () => {
      // Arrange
      const invalidInput = {
        name: 'A'.repeat(101),
      };

      // Act
      const result = createBankSchema.safeParse(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.code).toBe('too_big');
        expect(result.error.issues[0]?.message).toContain('100 characters');
      }
    });

    it('should reject empty string', () => {
      // Arrange
      const invalidInput = {
        name: '',
      };

      // Act
      const result = createBankSchema.safeParse(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.code).toBe('too_small');
      }
    });

    it('should have only name field in schema (no address fields)', () => {
      // Arrange
      const inputWithAddressFields = {
        name: 'ANZ',
        addressLine: '123 Main St',
        streetAddress: '123 Main Street',
        suburb: 'Sydney',
        postcode: 2000,
        state: 'NSW',
      };

      // Act
      const result = createBankSchema.safeParse(inputWithAddressFields);

      // Assert: Schema parses successfully but ignores unknown fields
      expect(result.success).toBe(true);
      if (result.success) {
        // Verified: result only contains name field
        expect(Object.keys(result.data)).toEqual(['name']);
        // Verified: address fields are not in the parsed result
        expect(result.data).not.toHaveProperty('addressLine');
        expect(result.data).not.toHaveProperty('streetAddress');
        expect(result.data).not.toHaveProperty('suburb');
        expect(result.data).not.toHaveProperty('postcode');
        expect(result.data).not.toHaveProperty('state');
      }
    });
  });

  describe('params schema - bankId validation', () => {
    it('should accept valid bankId', () => {
      // Arrange
      const validInput = {
        bankId: 'bank-123',
      };

      // Act
      const result = params.safeParse(validInput);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bankId).toBe('bank-123');
      }
    });

    it('should reject missing bankId', () => {
      // Arrange
      const invalidInput = {};

      // Act
      const result = params.safeParse(invalidInput);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.code).toBe('invalid_type');
      }
    });
  });
});
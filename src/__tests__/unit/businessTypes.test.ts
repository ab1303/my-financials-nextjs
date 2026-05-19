import { describe, expect,it } from 'vitest';

import type { Address, BankType, OptionType, ProfileType } from '@/types/businessTypes';

describe('businessTypes - Phase 2: Address Logic Removal', () => {
  describe('BankType type definition', () => {
    it('should have only bankName field', () => {
      // Arrange: Create a valid BankType instance
      const validBank: BankType = {
        bankName: 'ANZ',
      };

      // Act: Check that bankName exists
      expect(validBank.bankName).toBe('ANZ');
    });

    it('should not have address-related properties', () => {
      // Arrange
      const bank: BankType = {
        bankName: 'Westpac',
      };

      // Act & Assert: Verify address properties don't exist
      expect(bank).not.toHaveProperty('addressLine');
      expect(bank).not.toHaveProperty('streetAddress');
      expect(bank).not.toHaveProperty('suburb');
      expect(bank).not.toHaveProperty('postcode');
      expect(bank).not.toHaveProperty('state');
      expect(bank).not.toHaveProperty('addressLocation');
    });

    it('BankType should only have one field', () => {
      // Arrange
      const bank: BankType = {
        bankName: 'Commonwealth Bank',
      };

      // Act: Get all keys from BankType
      const keys = Object.keys(bank);

      // Assert: Only bankName field exists
      expect(keys).toHaveLength(1);
      expect(keys).toContain('bankName');
    });
  });

  describe('Address type definition', () => {
    it('should have address-related fields for non-bank use cases (e.g., philanthropy)', () => {
      // Arrange: Address type is used for philanthropy and other entities
      const validAddress: Address = {
        addressLine: 'Address Line 1',
        street_address: '123 Main St',
        suburb: 'Sydney',
        postcode: '2000',
        state: 'NSW',
      };

      // Act & Assert
      expect(validAddress.addressLine).toBeDefined();
      expect(validAddress.street_address).toBeDefined();
      expect(validAddress.suburb).toBeDefined();
      expect(validAddress.postcode).toBeDefined();
      expect(validAddress.state).toBeDefined();
    });

    it('Address type should be separate from BankType', () => {
      // Arrange: Verify that Address and BankType are different
      const address: Address = {
        addressLine: 'Line 1',
        street_address: 'Street',
        suburb: 'Suburb',
        postcode: '1000',
        state: 'State',
      };

      const bank: BankType = {
        bankName: 'Test Bank',
      };

      // Act & Assert: They have completely different structures
      expect(Object.keys(address)).not.toContain('bankName');
      expect(Object.keys(bank)).not.toContain('addressLine');
      expect(Object.keys(bank)).not.toContain('street_address');
    });
  });

  describe('Other types remain unchanged', () => {
    it('OptionType should have label and id', () => {
      // Arrange
      const option: OptionType = {
        label: 'Option 1',
        id: 'opt-1',
      };

      // Act & Assert
      expect(option.label).toBe('Option 1');
      expect(option.id).toBe('opt-1');
    });

    it('ProfileType should have profile-related fields', () => {
      // Arrange
      const profile: ProfileType = {
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: 'https://example.com/image.png',
        contact: 'john@example.com',
      };

      // Act & Assert
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
      expect(profile.profileImageUrl).toBeDefined();
      expect(profile.contact).toBeDefined();
    });
  });
});
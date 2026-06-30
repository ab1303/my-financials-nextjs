import { handleCaughtError } from '@/server/db/client';
import type {
  CreateBusinessInput,
  ParamsInput,
  UpdateBusinessInput,
} from '@/server/schema/business.schema';
import {
  addBusinessDetails,
  deleteBusinessDetails,
  getBusinessDetails,
  getBusinessDetailsByType,
  updateBusinessDetails,
  validateBusinessNameUniqueness,
} from '@/server/services/business.service';
import type { BusinessEnumType } from '@/types/enum';

export const addBusinessDetailsHandler = async ({
  input,
  userId,
}: {
  input: CreateBusinessInput;
  userId: string;
}) => {
  try {
    const isGlobalType = input.type === 'BANK' || input.type === 'BROKERAGE';
    // Global institution types (BANK, BROKERAGE) are admin-managed with no user owner.
    // User-specific types (PHILANTHROPY, untyped) are scoped to the creating user.
    if (!isGlobalType) {
      const existing = await getBusinessDetails({
        userId,
        name: { equals: input.name, mode: 'insensitive' },
      });
      if (existing && existing.length > 0) {
        throw new Error(
          'A business with this name already exists. Business names must be unique.',
        );
      }
    } else {
      const existing = await getBusinessDetails({
        userId: null,
        name: { equals: input.name, mode: 'insensitive' },
        type: input.type as BusinessEnumType,
      });
      if (existing && existing.length > 0) {
        throw new Error('An institution with this name already exists.');
      }
    }
    const businessResult = await addBusinessDetails({
      name: input.name,
      type: (input.type || 'PHILANTHROPY') as BusinessEnumType,
      isDgrRegistered: input.isDgrRegistered ?? false,
      addressLine: input.addressLine || null,
      streetAddress: input.streetAddress || null,
      postcode: input.postcode || null,
      state: input.state || null,
      suburb: input.suburb || null,
      ...(isGlobalType ? { userId: null } : { userId }),
    });
    return {
      status: 'success',
      data: {
        business: businessResult,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) {
      throw e;
    }
    handleCaughtError(e);
  }
};

export const updateBusinessDetailsHandler = async ({
  input,
  userId,
}: {
  input: UpdateBusinessInput;
  userId: string;
}) => {
  try {
    // Uniqueness check: business name must be unique per user (exclude current business)
    if (input.name) {
      const isNameUnique = await validateBusinessNameUniqueness(
        input.name,
        userId,
        input.id, // Exclude current business from uniqueness check
      );
      if (!isNameUnique) {
        throw new Error(
          'A business with this name already exists. Business names must be unique.',
        );
      }
    }

    const updateData: Parameters<typeof updateBusinessDetails>[1] = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.addressLine !== undefined)
      updateData.addressLine = input.addressLine || null;
    if (input.isDgrRegistered !== undefined)
      updateData.isDgrRegistered = input.isDgrRegistered;
    if (input.streetAddress !== undefined)
      updateData.streetAddress = input.streetAddress || null;
    if (input.suburb !== undefined) updateData.suburb = input.suburb || null;
    if (input.postcode !== undefined)
      updateData.postcode = input.postcode || null;
    if (input.state !== undefined) updateData.state = input.state || null;

    const businessResult = await updateBusinessDetails(input.id, updateData);

    return {
      status: 'success',
      data: {
        business: businessResult,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) {
      throw e;
    }
    handleCaughtError(e);
  }
};

export const allBusinessDetailsHandler = async (userId: string) => {
  try {
    const businessDetails = await getBusinessDetails({ userId });
    return businessDetails;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const getBusinessesByTypeHandler = async (
  userId: string,
  type?: string,
) => {
  try {
    const businessDetails = await getBusinessDetailsByType(userId, type);
    return businessDetails;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const removeBusinessDetailsHandler = async ({
  params,
}: {
  params: ParamsInput;
}) => {
  try {
    await deleteBusinessDetails(params.businessId);
  } catch (e) {
    handleCaughtError(e);
  }
};

import { handleCaughtError } from '@/server/utils/prisma';
import {
  addBusinessDetails,
  deleteBusinessDetails,
  getBusinessDetails,
  getBusinessDetailsByType,
} from '@/server/services/business.service';
import { BusinessEnumType } from '@/types/enum';

import type {
  CreateBusinessInput,
  ParamsInput,
} from '@/server/schema/business.schema';

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
        throw new Error(
          'An institution with this name already exists.',
        );
      }
    }
    const businessResult = await addBusinessDetails({
      name: input.name,
      type: input.type as BusinessEnumType,
      addressLine: input.addressLine,
      streetAddress: input.streetAddress,
      postcode: input.postcode,
      state: input.state,
      suburb: input.suburb,
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

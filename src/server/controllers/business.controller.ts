import { handleCaughtError } from '@/server/utils/prisma';
import {
  addBusinessDetails,
  deleteBusinessDetails,
  getBusinessDetails,
} from '@/server/services/business.service';

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
    const businessResult = await addBusinessDetails({
      name: input.name,
      addressLine: input.addressLine,
      streetAddress: input.streetAddress,
      postcode: input.postcode,
      state: input.state,
      suburb: input.suburb,
      userId,
    });
    return {
      status: 'success',
      data: {
        business: businessResult,
      },
    };
  } catch (e) {
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

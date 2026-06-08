import type {
  CreateBrokerageInput,
  ParamsInput,
  UpdateBrokerageInput,
} from '@/server/schema/brokerage.schema';
import {
  addBrokerageDetails,
  deleteBrokerageDetails,
  getBrokerageDetails,
  updateBrokerageDetails,
} from '@/server/services/brokerage.service';
import { handleCaughtError } from '@/server/utils/prisma';

export const addBrokerageDetailsHandler = async ({
  input,
}: {
  input: CreateBrokerageInput;
}) => {
  try {
    const brokerageResult = await addBrokerageDetails({
      name: input.name,
    });
    return {
      status: 'success',
      data: {
        brokerage: brokerageResult,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const allBrokerageDetailsHandler = async () => {
  try {
    const brokerageDetails = await getBrokerageDetails();
    return brokerageDetails;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const updateBrokerageDetailsHandler = async ({
  input,
}: {
  input: UpdateBrokerageInput;
}) => {
  try {
    const brokerageResult = await updateBrokerageDetails({
      brokerageId: input.brokerageId,
      name: input.name,
    });
    return {
      status: 'success',
      data: {
        brokerage: brokerageResult,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const removeBrokerageDetailsHandler = async ({
  params,
}: {
  params: ParamsInput;
}) => {
  try {
    await deleteBrokerageDetails(params.brokerageId);
  } catch (e) {
    handleCaughtError(e);
  }
};

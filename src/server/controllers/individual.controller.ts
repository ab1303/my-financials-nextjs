import { handleCaughtError } from '@/server/utils/prisma';
import {
  addIndividualDetails,
  deleteIndividualDetails,
  getIndividualDetails,
  validateIndividualNameUniqueness,
  updateIndividualDetails,
} from '@/server/services/individual.service';
import { getOrCreateRelationship } from '@/server/services/relationship.service';

import type {
  CreateIndividualInput,
  UpdateIndividualInput,
  ParamsInput,
} from '@/server/schema/individual.schema';

export const addIndividualDetailsHandler = async ({
  input,
  userId,
}: {
  input: CreateIndividualInput;
  userId: string;
}) => {
  try {
    // Uniqueness check: individual name must be unique per user (case-insensitive)
    const isNameUnique = await validateIndividualNameUniqueness(
      input.name,
      userId,
    );
    if (!isNameUnique) {
      throw new Error(
        'An individual with this name already exists. Individual names must be unique.',
      );
    }

    // Handle relationship creation/lookup if provided
    let relationshipId: string | undefined = undefined;
    if (input.relationshipName && input.relationshipName.trim()) {
      const relationship = await getOrCreateRelationship(
        input.relationshipName.trim(),
        userId,
      );
      relationshipId = relationship.id;
    }

    const individualResult = await addIndividualDetails({
      name: input.name.trim(),
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      relationshipId,
      addressFormat: input.addressFormat || 'AU',
      addressLine: input.addressLine || null,
      streetAddress: input.streetAddress || null,
      suburb: input.suburb || null,
      postcode: input.postcode || null,
      state: input.state || null,
      userId,
    });

    return {
      status: 'success',
      data: {
        individual: individualResult,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) {
      throw e;
    }
    handleCaughtError(e);
  }
};

export const updateIndividualDetailsHandler = async ({
  input,
  userId,
}: {
  input: UpdateIndividualInput;
  userId: string;
}) => {
  try {
    // Uniqueness check: individual name must be unique per user (exclude current individual)
    if (input.name) {
      const isNameUnique = await validateIndividualNameUniqueness(
        input.name,
        userId,
        input.id, // Exclude current individual from uniqueness check
      );
      if (!isNameUnique) {
        throw new Error(
          'An individual with this name already exists. Individual names must be unique.',
        );
      }
    }

    // Handle relationship creation/lookup if provided
    let relationshipId: string | undefined | null = undefined;
    if (input.relationshipName !== undefined) {
      if (input.relationshipName && input.relationshipName.trim()) {
        const relationship = await getOrCreateRelationship(
          input.relationshipName.trim(),
          userId,
        );
        relationshipId = relationship.id;
      } else {
        // If relationshipName is empty string, set to null
        relationshipId = null;
      }
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.firstName !== undefined)
      updateData.firstName = input.firstName || null;
    if (input.lastName !== undefined)
      updateData.lastName = input.lastName || null;
    if (relationshipId !== undefined)
      updateData.relationshipId = relationshipId;
    if (input.addressFormat !== undefined)
      updateData.addressFormat = input.addressFormat || 'AU';
    if (input.addressLine !== undefined)
      updateData.addressLine = input.addressLine || null;
    if (input.streetAddress !== undefined)
      updateData.streetAddress = input.streetAddress || null;
    if (input.suburb !== undefined) updateData.suburb = input.suburb || null;
    if (input.postcode !== undefined)
      updateData.postcode = input.postcode || null;
    if (input.state !== undefined) updateData.state = input.state || null;

    const individualResult = await updateIndividualDetails(
      input.id,
      updateData,
    );

    return {
      status: 'success',
      data: {
        individual: individualResult,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) {
      throw e;
    }
    handleCaughtError(e);
  }
};

export const allIndividualDetailsHandler = async (userId: string) => {
  try {
    const individualDetails = await getIndividualDetails({ userId });
    return individualDetails;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const removeIndividualDetailsHandler = async ({
  params,
}: {
  params: ParamsInput;
}) => {
  try {
    await deleteIndividualDetails(params.individualId);
  } catch (e) {
    handleCaughtError(e);
  }
};

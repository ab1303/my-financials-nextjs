'use server';

import { auth } from '@/server/auth';
import { revalidatePath } from 'next/cache';
import {
  addDonationPaymentDetail,
  updateDonationPayment,
  deleteDonationPayment,
  getDonation,
} from '@/server/services/donation.service';
import { createDonationYearHandler } from '@/server/controllers/donation.controller';
import {
  CreateDonationPaymentSchema,
  UpdateDonationPaymentSchema,
  DeleteDonationPaymentSchema,
} from './_schema';
import type {
  CreateDonationPaymentInput,
  UpdateDonationPaymentInput,
  DeleteDonationPaymentInput,
} from './_schema';
import type { DonationPaymentType } from './_types';

export async function addRow(input: CreateDonationPaymentInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = CreateDonationPaymentSchema.parse(input);

    // Additional validation for beneficiaryId
    if (
      !validatedInput.beneficiaryId ||
      validatedInput.beneficiaryId.trim() === ''
    ) {
      return { success: false, error: 'Please select a beneficiary' };
    }

    // Get or create Donation record for the calendar year
    const donationResult = await createDonationYearHandler(
      validatedInput.calendarYearId,
    );
    if (!donationResult.donationCalendarId) {
      return {
        success: false,
        error: 'Failed to create donation year record.',
      };
    }

    // Create payment record
    const newPayment = await addDonationPaymentDetail(
      donationResult.donationCalendarId,
      {
        datePaid: validatedInput.datePaid,
        amount: validatedInput.amount,
        beneficiaryType: validatedInput.beneficiaryType,
        taxCategory: validatedInput.taxCategory,
        beneficiaryId: validatedInput.beneficiaryId,
        transactionId: validatedInput.transactionId,
      },
    );

    return {
      success: true,
      error: null,
      data: {
        id: newPayment.id,
        datePaid: newPayment.datePaid,
        amount: newPayment.amount.toNumber(),
        beneficiaryType: newPayment.beneficiaryType,
        taxCategory: newPayment.taxCategory,
        beneficiaryId: validatedInput.beneficiaryId || '',
        transactionId: validatedInput.transactionId,
      },
    };
  } catch (error) {
    console.error('Error adding Donation payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add payment',
    };
  } finally {
    // Revalidate the donations page to update totals and data
    revalidatePath('/cashflow/donations');
  }
}

export async function editRow(input: UpdateDonationPaymentInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = UpdateDonationPaymentSchema.parse(input);

    // Additional validation for beneficiaryId
    if (
      !validatedInput.beneficiaryId ||
      validatedInput.beneficiaryId.trim() === ''
    ) {
      return { success: false, error: 'Please select a beneficiary' };
    }

    // Update payment record
    await updateDonationPayment(
      {
        id: validatedInput.id,
        datePaid: validatedInput.datePaid,
        amount: validatedInput.amount,
        beneficiaryType: validatedInput.beneficiaryType,
        taxCategory: validatedInput.taxCategory,
        beneficiaryId: validatedInput.beneficiaryId,
        donationLedgerId: '', // This will be ignored in the update
      },
      validatedInput.id,
    );

    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating Donation payment:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update payment',
    };
  } finally {
    // Revalidate the donations page to update totals and data
    revalidatePath('/cashflow/donations');
  }
}

export async function deleteRow(input: DeleteDonationPaymentInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = DeleteDonationPaymentSchema.parse(input);

    // Delete payment record
    await deleteDonationPayment(validatedInput.id);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting Donation payment:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete payment',
    };
  } finally {
    // Revalidate the donations page to update totals and data
    revalidatePath('/cashflow/donations');
  }
}

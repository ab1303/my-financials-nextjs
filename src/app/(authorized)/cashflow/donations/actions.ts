'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/server/auth';
import { createDonationYearHandler } from '@/server/controllers/donation.controller';
import {
  addVoluntaryDonation,
  deleteVoluntaryDonation,
  updateVoluntaryDonation,
} from '@/server/services/voluntary-donations/voluntary-donation.service';

import type {
  CreateDonationPaymentInput,
  DeleteDonationPaymentInput,
  UpdateDonationPaymentInput,
} from './_schema';
import {
  CreateDonationPaymentSchema,
  DeleteDonationPaymentSchema,
  UpdateDonationPaymentSchema,
} from './_schema';

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
    const newPayment = await addVoluntaryDonation({
      donationLedgerId: donationResult.donationCalendarId,
      datePaid: validatedInput.datePaid,
      amount: validatedInput.amount,
      beneficiaryType: validatedInput.beneficiaryType,
      beneficiaryId: validatedInput.beneficiaryId,
      transactionId: validatedInput.transactionId,
      donationPurpose: validatedInput.donationPurpose ?? 'VOLUNTARY',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentData = newPayment as any;

    return {
      success: true,
      error: null,
      data: {
        id: newPayment.id,
        datePaid: newPayment.datePaid,
        amount: Number(paymentData.amount),
        beneficiaryType: paymentData.beneficiaryType ?? 'BUSINESS',
        isDeductible: paymentData.isDeductible ?? false,
        donationPurpose: paymentData.donationPurpose,
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
    await updateVoluntaryDonation(validatedInput.id, {
      id: validatedInput.id,
      datePaid: validatedInput.datePaid,
      amount: validatedInput.amount,
      beneficiaryType: validatedInput.beneficiaryType,
      beneficiaryId: validatedInput.beneficiaryId,
      donationLedgerId: '', // placeholder
    });

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
    await deleteVoluntaryDonation(validatedInput.id);

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

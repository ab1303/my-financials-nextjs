'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/utils/authOptions';
import {
  addZakatPaymentDetail,
  updateZakatPayment,
  deleteZakatPayment,
  getZakat,
} from '@/server/services/zakat.service';
import {
  CreateZakatPaymentSchema,
  UpdateZakatPaymentSchema,
  DeleteZakatPaymentSchema,
} from './_schema';
import type {
  CreateZakatPaymentInput,
  UpdateZakatPaymentInput,
  DeleteZakatPaymentInput,
} from './_schema';
import type { ZakatPaymentType } from './_types';

export async function addRow(input: CreateZakatPaymentInput) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = CreateZakatPaymentSchema.parse(input);

    // Get or create Zakat record for the calendar year
    const zakat = await getZakat(validatedInput.calendarYearId);
    if (!zakat.id) {
      return {
        success: false,
        error: 'Zakat year not found. Please set up the Zakat year first.',
      };
    }

    // Create payment record
    const newPayment = await addZakatPaymentDetail(zakat.id, {
      datePaid: validatedInput.datePaid,
      amount: validatedInput.amount,
      beneficiaryType: validatedInput.beneficiaryType,
      businessId: validatedInput.beneficiaryId || null,
    });

    return {
      success: true,
      error: null,
      data: {
        id: newPayment.id,
        datePaid: newPayment.datePaid,
        amount: newPayment.amount.toNumber(),
        beneficiaryType: newPayment.beneficiaryType,
        beneficiaryId: newPayment.businessId || '',
      },
    };
  } catch (error) {
    console.error('Error adding Zakat payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add payment',
    };
  }
}

export async function editRow(input: UpdateZakatPaymentInput) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = UpdateZakatPaymentSchema.parse(input);

    // Update payment record
    await updateZakatPayment(
      {
        id: validatedInput.id,
        datePaid: validatedInput.datePaid,
        amount: validatedInput.amount,
        beneficiaryType: validatedInput.beneficiaryType,
        businessId: validatedInput.beneficiaryId || null,
        zakatId: '', // This will be ignored in the update
      },
      validatedInput.id,
    );

    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating Zakat payment:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update payment',
    };
  }
}

export async function deleteRow(input: DeleteZakatPaymentInput) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = DeleteZakatPaymentSchema.parse(input);

    // Delete payment record
    await deleteZakatPayment(validatedInput.id);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting Zakat payment:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete payment',
    };
  }
}

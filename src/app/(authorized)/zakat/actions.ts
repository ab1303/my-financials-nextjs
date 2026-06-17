'use server';

import { auth } from '@/server/auth';
import {
  addZakatCalendarYearDetails,
  addZakatPaymentDetail,
  deleteZakatPayment,
  getZakat,
  updateZakatPayment,
} from '@/server/services/zakat/zakat.service';

import type {
  CreateZakatPaymentInput,
  DeleteZakatPaymentInput,
  UpdateZakatPaymentInput,
} from './_schema';
import {
  CreateZakatPaymentSchema,
  DeleteZakatPaymentSchema,
  UpdateZakatPaymentSchema,
} from './_schema';

export async function addRow(input: CreateZakatPaymentInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = CreateZakatPaymentSchema.parse(input);

    // Get or create Zakat record for the calendar year
    let zakatRecord = await getZakat(validatedInput.calendarYearId);
    let zakatId = zakatRecord.id;
    let zakatAmountDue = zakatRecord.amountDue;

    if (!zakatId) {
      // Auto-initialize obligation if missing
      const newZakat = await addZakatCalendarYearDetails({
        calendarId: validatedInput.calendarYearId,
        amountDue: 0,
      });
      zakatId = newZakat.id;
      zakatAmountDue = newZakat.amountDue.toNumber();
    }

    // Create payment record
    const newPayment = await addZakatPaymentDetail(zakatId, {
      datePaid: validatedInput.datePaid,
      amount: validatedInput.amount,
      beneficiaryType: validatedInput.beneficiaryType,
      beneficiaryId: validatedInput.beneficiaryId,
      transactionId: validatedInput.transactionId,
    });

    return {
      success: true,
      error: null,
      data: {
        id: newPayment.id,
        datePaid: newPayment.datePaid,
        amount: Number((newPayment as any).amount),
        beneficiaryType: newPayment.beneficiaryType,
        isDeductible: newPayment.isDeductible,
        beneficiaryId: validatedInput.beneficiaryId || '',
        transactionId: validatedInput.transactionId,
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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = UpdateZakatPaymentSchema.parse(input);

    // Update payment record
    await updateZakatPayment(validatedInput.id, {
      id: validatedInput.id,
      datePaid: validatedInput.datePaid,
      amount: validatedInput.amount,
      beneficiaryType: validatedInput.beneficiaryType,
      beneficiaryId: validatedInput.beneficiaryId,
      zakatObligationId: '', // This will be ignored in the update
    });

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
    const session = await auth();
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

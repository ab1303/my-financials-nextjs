'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/utils/authOptions';
import {
  addIncomeEntry,
  updateIncomeEntry,
  deleteIncomeEntry,
} from '@/server/services/income.service';
import { createIncomeYearHandler } from '@/server/controllers/income.controller';
import {
  CreateIncomeEntrySchema,
  UpdateIncomeEntrySchema,
  DeleteIncomeEntrySchema,
} from './_schema';
import type {
  CreateIncomeEntryInput,
  UpdateIncomeEntryInput,
  DeleteIncomeEntryInput,
} from './_schema';

export async function addRow(input: CreateIncomeEntryInput) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = CreateIncomeEntrySchema.parse(input);

    // Get or create Income record for the calendar year
    const incomeResult = await createIncomeYearHandler(
      validatedInput.calendarYearId,
      session.user.id,
    );
    if (!incomeResult.incomeCalendarId) {
      return {
        success: false,
        error: 'Failed to create income year record.',
      };
    }

    // Create income entry record
    const newEntry = await addIncomeEntry(incomeResult.incomeCalendarId, {
      dateEarned: validatedInput.dateEarned,
      amount: validatedInput.amount,
      source: validatedInput.source,
    });

    return {
      success: true,
      error: null,
      data: {
        id: newEntry.id,
        dateEarned: newEntry.dateEarned,
        amount: newEntry.amount.toNumber(),
        source: newEntry.source,
        incomeId: newEntry.incomeId,
      },
    };
  } catch (error) {
    console.error('Error adding income entry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add entry',
    };
  } finally {
    // Revalidate the income page to update totals and data
    revalidatePath('/cashflow/income');
  }
}

export async function editRow(input: UpdateIncomeEntryInput) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = UpdateIncomeEntrySchema.parse(input);

    // Update income entry record
    await updateIncomeEntry(validatedInput.id, {
      dateEarned: validatedInput.dateEarned,
      amount: validatedInput.amount,
      source: validatedInput.source,
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating income entry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update entry',
    };
  } finally {
    // Revalidate the income page to update totals and data
    revalidatePath('/cashflow/income');
  }
}

export async function deleteRow(input: DeleteIncomeEntryInput) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = DeleteIncomeEntrySchema.parse(input);

    // Delete income entry record
    await deleteIncomeEntry(validatedInput.id);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting income entry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete entry',
    };
  } finally {
    // Revalidate the income page to update totals and data
    revalidatePath('/cashflow/income');
  }
}

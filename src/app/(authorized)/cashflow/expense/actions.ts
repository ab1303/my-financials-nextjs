'use server';

import { auth } from '@/server/auth';
import { revalidatePath } from 'next/cache';
import {
  addExpenseEntry,
  updateExpenseEntry,
  deleteExpenseEntry,
} from '@/server/services/expense.service';
import { createExpenseYearHandler } from '@/server/controllers/expense.controller';
import {
  CreateExpenseEntrySchema,
  UpdateExpenseEntrySchema,
  DeleteExpenseEntrySchema,
} from './_schema';
import type {
  CreateExpenseEntryInput,
  UpdateExpenseEntryInput,
  DeleteExpenseEntryInput,
} from './_schema';

export async function addRow(input: CreateExpenseEntryInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = CreateExpenseEntrySchema.parse(input);

    // Get or create Expense record for the calendar year
    const expenseResult = await createExpenseYearHandler(
      validatedInput.calendarYearId,
      session.user.id,
    );
    if (!expenseResult.expenseCalendarId) {
      return {
        success: false,
        error: 'Failed to create expense year record.',
      };
    }

    // Create expense entry record
    const newEntry = await addExpenseEntry({
      month: validatedInput.month,
      amount: validatedInput.amount,
      categoryId: validatedInput.categoryId,
      expenseLedgerId: expenseResult.expenseCalendarId,
    });

    return {
      success: true,
      error: null,
      data: {
        id: newEntry.id,
        month: newEntry.month,
        amount: newEntry.amount,
        categoryId: newEntry.categoryId,
        expenseLedgerId: newEntry.expenseLedgerId,
      },
    };
  } catch (error) {
    console.error('Error adding expense entry:', error);

    // Provide user-friendly error messages
    let errorMessage = 'Failed to add expense entry. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        errorMessage = 'Invalid data provided. Please check your entries.';
      } else if (error.message.includes('unique')) {
        errorMessage = 'A similar entry already exists.';
      } else if (
        error.message.includes('authentication') ||
        error.message.includes('session')
      ) {
        errorMessage = 'Your session has expired. Please log in again.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Revalidate the expense page to update totals and data
    revalidatePath('/cashflow/expense');
  }
}

export async function editRow(input: UpdateExpenseEntryInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = UpdateExpenseEntrySchema.parse(input);

    // Update expense entry
    const updatedEntry = await updateExpenseEntry(validatedInput.id, {
      ...(validatedInput.month !== undefined && {
        month: validatedInput.month,
      }),
      ...(validatedInput.amount !== undefined && {
        amount: validatedInput.amount,
      }),
      ...(validatedInput.categoryId !== undefined && {
        categoryId: validatedInput.categoryId,
      }),
    });

    return {
      success: true,
      error: null,
      data: {
        id: updatedEntry.id,
        month: updatedEntry.month,
        amount: updatedEntry.amount,
        categoryId: updatedEntry.categoryId,
        expenseLedgerId: updatedEntry.expenseLedgerId,
      },
    };
  } catch (error) {
    console.error('Error editing expense entry:', error);

    // Provide user-friendly error messages
    let errorMessage = 'Failed to update expense entry. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        errorMessage = 'Invalid data provided. Please check your entries.';
      } else if (error.message.includes('not found')) {
        errorMessage = 'Expense entry not found.';
      } else if (
        error.message.includes('authentication') ||
        error.message.includes('session')
      ) {
        errorMessage = 'Your session has expired. Please log in again.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Revalidate the expense page to update totals and data
    revalidatePath('/cashflow/expense');
  }
}

export async function deleteRow(input: DeleteExpenseEntryInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate input
    const validatedInput = DeleteExpenseEntrySchema.parse(input);

    // Delete expense entry
    const deletedEntry = await deleteExpenseEntry(validatedInput.id);

    return {
      success: true,
      error: null,
      data: {
        id: deletedEntry.id,
      },
    };
  } catch (error) {
    console.error('Error deleting expense entry:', error);

    // Provide user-friendly error messages
    let errorMessage = 'Failed to delete expense entry. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        errorMessage = 'Expense entry not found.';
      } else if (
        error.message.includes('authentication') ||
        error.message.includes('session')
      ) {
        errorMessage = 'Your session has expired. Please log in again.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Revalidate the expense page to update totals and data
    revalidatePath('/cashflow/expense');
  }
}

export async function getExpenseCategories() {
  'use server';

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated', data: [] };
    }

    const { getExpenseCategories } = await import(
      '@/server/services/expense.service'
    );
    const categories = await getExpenseCategories();

    return {
      success: true,
      error: null,
      data: categories,
    };
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    return {
      success: false,
      error: 'Failed to load categories',
      data: [],
    };
  }
}

export async function getMonthEntries(calendarYearId: string, month: number) {
  'use server';

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated', data: [] };
    }

    const { getExpenseEntriesForMonth } = await import(
      '@/server/services/expense.service'
    );
    const entries = await getExpenseEntriesForMonth(
      calendarYearId,
      session.user.id,
      month,
    );

    return {
      success: true,
      error: null,
      data: entries,
    };
  } catch (error) {
    console.error('Error fetching month entries:', error);
    return {
      success: false,
      error: 'Failed to load entries',
      data: [],
    };
  }
}

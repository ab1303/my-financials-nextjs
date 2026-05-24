'use server';

import { auth } from '@/server/auth';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/server/utils/prisma';
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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    const validatedInput = CreateExpenseEntrySchema.parse(input);

    // Resolve calendar year for date calculation
    const calendarYear = await prisma.calendarYear.findUnique({
      where: { id: validatedInput.calendarYearId },
      select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
    });
    if (!calendarYear) {
      return { success: false, error: 'Calendar year not found.' };
    }

    // Resolve category name from ID
    const category = await prisma.expenseCategory.findUnique({
      where: { id: validatedInput.categoryId },
      select: { name: true },
    });
    if (!category) {
      return { success: false, error: 'Category not found.' };
    }

    // Determine the real calendar year for the given fiscal month
    const year =
      validatedInput.month >= calendarYear.fromMonth
        ? calendarYear.fromYear
        : calendarYear.toYear;
    const date = new Date(year, validatedInput.month - 1, 1);

    const newTx = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: 'DEBIT',
        status: 'CONFIRMED',
        source: 'USER_MANUAL',
        category: category.name,
        amount: validatedInput.amount,
        date,
        description: `Manual expense: ${category.name}`,
        confirmedAt: new Date(),
      },
    });

    return {
      success: true,
      error: null,
      data: {
        id: newTx.id,
        month: validatedInput.month,
        amount: validatedInput.amount,
        categoryId: validatedInput.categoryId,
        expenseLedgerId: '',
        source: 'USER_MANUAL' as const,
      },
    };
  } catch (error) {
    console.error('Error adding expense entry:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to add expense entry. Please try again.';
    return { success: false, error: errorMessage };
  } finally {
    revalidatePath('/cashflow/expense');
  }
}

export async function editRow(input: UpdateExpenseEntryInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    const validatedInput = UpdateExpenseEntrySchema.parse(input);

    // Verify ownership and that this is a USER_MANUAL transaction
    const existing = await prisma.transaction.findUnique({
      where: { id: validatedInput.id },
      select: { userId: true, source: true, amount: true, category: true },
    });
    if (!existing) {
      return { success: false, error: 'Transaction not found.' };
    }
    if (existing.userId !== session.user.id) {
      return { success: false, error: 'Not authorised.' };
    }
    if (existing.source !== 'USER_MANUAL') {
      return { success: false, error: 'Only manually entered expenses can be edited.' };
    }

    // Resolve new category name if categoryId was provided
    let categoryName: string | undefined;
    if (validatedInput.categoryId) {
      const category = await prisma.expenseCategory.findUnique({
        where: { id: validatedInput.categoryId },
        select: { name: true },
      });
      if (!category) {
        return { success: false, error: 'Category not found.' };
      }
      categoryName = category.name;
    }

    const updatedTx = await prisma.transaction.update({
      where: { id: validatedInput.id },
      data: {
        ...(validatedInput.amount !== undefined && { amount: validatedInput.amount }),
        ...(categoryName !== undefined && {
          category: categoryName,
          description: `Manual expense: ${categoryName}`,
        }),
      },
      select: { id: true, amount: true, category: true },
    });

    return {
      success: true,
      error: null,
      data: {
        id: updatedTx.id,
        amount: Number(updatedTx.amount),
        categoryId: validatedInput.categoryId ?? '',
        expenseLedgerId: '',
        source: 'USER_MANUAL' as const,
      },
    };
  } catch (error) {
    console.error('Error editing expense entry:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update expense entry. Please try again.';
    return { success: false, error: errorMessage };
  } finally {
    revalidatePath('/cashflow/expense');
  }
}

export async function deleteRow(input: DeleteExpenseEntryInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    const validatedInput = DeleteExpenseEntrySchema.parse(input);

    // Verify ownership and that this is a USER_MANUAL transaction
    const existing = await prisma.transaction.findUnique({
      where: { id: validatedInput.id },
      select: { userId: true, source: true, status: true },
    });
    if (!existing) {
      return { success: false, error: 'Transaction not found.' };
    }
    if (existing.userId !== session.user.id) {
      return { success: false, error: 'Not authorised.' };
    }
    if (existing.source !== 'USER_MANUAL') {
      return { success: false, error: 'Only manually entered expenses can be deleted.' };
    }

    // Void the transaction (preserve audit trail — do not hard delete)
    await prisma.transaction.update({
      where: { id: validatedInput.id },
      data: {
        status: 'VOIDED',
        preVoidStatus: existing.status,
      },
    });

    return { success: true, error: null, data: { id: validatedInput.id } };
  } catch (error) {
    console.error('Error deleting expense entry:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to delete expense entry. Please try again.';
    return { success: false, error: errorMessage };
  } finally {
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


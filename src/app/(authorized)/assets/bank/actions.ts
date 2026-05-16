'use server';

import { auth } from '@/server/auth';
import { revalidatePath } from 'next/cache';
import { updateBankAccount as updateBankAccountService } from '@/server/services/bank-asset.service';
import { updateBankAccountSchema } from '@/server/schema/bank-asset.schema';
import type { UpdateBankAccountInput } from '@/server/schema/bank-asset.schema';

export async function updateAccountName(input: UpdateBankAccountInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Validate input
    const validatedInput = updateBankAccountSchema.parse(input);

    // Update the account name
    const updatedAccount = await updateBankAccountService({
      accountId: validatedInput.accountId,
      name: validatedInput.name,
      userId: session.user.id,
    });

    // Revalidate relevant paths to refresh the page data
    revalidatePath('/assets/bank');

    return {
      success: true,
      error: null,
      data: {
        accountId: updatedAccount.id,
        name: updatedAccount.name,
      },
    };
  } catch (error) {
    console.error('Error updating account name:', error);

    // Provide user-friendly error messages
    let errorMessage = 'Failed to update account name. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        errorMessage = 'Invalid account name. Please check your input.';
      } else if (error.message.includes('already exists')) {
        errorMessage = error.message;
      } else if (error.message.includes('not found')) {
        errorMessage = 'Account not found. Please refresh and try again.';
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
  }
}

import { prisma } from '@/server/db/client';
import { matchCategoryWithEmbedding } from './category-matcher.service';
import type { ExpenseExtractionResult, AITokenUsage } from './_types';

export interface ExpenseMapResult {
  success: boolean;
  entriesCreated: number;
  confidence: number;
  warnings: string[];
  errors: string[];
  embeddingUsage: AITokenUsage; // NEW — accumulated embedding token usage
}

/**
 * Expense Mapper Service
 * Converts AI vision output into ExpenseEntry database records
 */

export async function mapExpenseData(
  extractionResult: ExpenseExtractionResult,
  calendarId: string,
  month: number,
  userId: string,
  importImageId?: string,
): Promise<ExpenseMapResult> {
  const warnings = [...extractionResult.warnings];
  const errors: string[] = [];
  let entriesCreated = 0;

  // Initialize embedding usage accumulator
  const accumulatedEmbeddingUsage: AITokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  try {
    // Fetch all available expense categories
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
    });
    const categoryMap = Object.fromEntries(
      categories.map((cat) => [cat.name, cat.id]),
    );
    const availableCategories = categories.map((cat) => cat.name);

    // Ensure parent Expense record exists
    let expense = await prisma.expenseLedger.findUnique({
      where: {
        calendarId_userId: {
          calendarId,
          userId,
        },
      },
    });

    if (!expense) {
      expense = await prisma.expenseLedger.create({
        data: {
          calendarId,
          userId,
        },
      });
    }

    // Process each extracted entry
    for (const entry of extractionResult.entries) {
      try {
        // Validate amount
        if (entry.amount <= 0) {
          warnings.push(
            `Skipped entry with non-positive amount: ${entry.categoryName} $${entry.amount}`,
          );
          continue;
        }

        // Match category name to database category using AI embeddings
        const { categoryName: matchedCategory, embeddingUsage: entryEmbeddingUsage } =
          await matchCategoryWithEmbedding(
            entry.categoryName,
            categories,
          );

        // Accumulate embedding tokens
        accumulatedEmbeddingUsage.promptTokens += entryEmbeddingUsage.promptTokens;
        accumulatedEmbeddingUsage.totalTokens += entryEmbeddingUsage.totalTokens;

        if (!matchedCategory) {
          errors.push(
            `Could not match category "${entry.categoryName}" and no "Other" category found`,
          );
          continue;
        }

        const categoryId = categoryMap[matchedCategory];
        if (!categoryId) {
          errors.push(`Category "${matchedCategory}" not found in database`);
          continue;
        }

        // Create expense entry
        await prisma.monthlyExpenseSummary.create({
          data: {
            month,
            amount: String(entry.amount), // Decimal as string
            categoryId,
            expenseLedgerId: expense.id,
            importImageId,
          },
        });

        entriesCreated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(
          `Failed to create entry for ${entry.categoryName}: ${errorMsg}`,
        );
      }
    }

    // Warn if no categories were matched
    if (entriesCreated === 0 && extractionResult.entries.length > 0) {
      warnings.push(
        `No entries were created from ${extractionResult.entries.length} extracted items`,
      );
    }

    return {
      success: errors.length === 0,
      entriesCreated,
      confidence: extractionResult.confidence,
      warnings,
      errors,
      embeddingUsage: accumulatedEmbeddingUsage,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      entriesCreated: 0,
      confidence: 0,
      warnings,
      errors: [...errors, `Failed to map expense data: ${errorMsg}`],
      embeddingUsage: accumulatedEmbeddingUsage,
    };
  }
}

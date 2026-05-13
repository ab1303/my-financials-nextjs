import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { randomUUID } from 'crypto';
import type { CsvTransaction, ClassifiedTransaction } from './_types';
import type { ExpenseCategory } from '@prisma/client';

/**
 * AI Classifier Service for CSV transactions
 * Converts raw bank descriptions to expense categories via LLM
 */

function getAIProvider() {
  const provider = process.env.AI_PROVIDER ?? 'github';
  const modelId = process.env.AI_CLASSIFIER_MODEL ?? 'gpt-4o-mini';
  const apiKey = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL;

  if (!apiKey) {
    throw new Error(
      `AI_API_KEY is required. Set a ${provider === 'github' ? 'GitHub Personal Access Token' : 'OpenAI API key'} in your environment.`,
    );
  }

  const openai = createOpenAI({
    apiKey,
    ...(baseURL
      ? { baseURL }
      : provider === 'github' && { baseURL: 'https://models.inference.ai.azure.com' }),
  });

  return openai.chat(modelId);
}

export async function classifyTransactions(
  transactions: CsvTransaction[],
  categories: ExpenseCategory[],
): Promise<{
  classified: ClassifiedTransaction[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  // Handle empty transactions
  if (!transactions.length) {
    return {
      classified: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  try {
    const categoryNames = categories.map((c) => c.name);

    const systemPrompt = `You are a financial transaction classifier for an Australian personal finance app.
Classify each bank transaction description into exactly one of the following expense categories.
Available categories:
${categoryNames.map((cat) => `- ${cat}`).join('\n')}

Rules:
- Respond ONLY with a JSON array. No other text, no markdown.
- Use ONLY the exact category names listed above.
- If uncertain, use closest match — never return null or "Other".
- One object per transaction, preserving input order.

Common Australian merchant mappings:
- Woolworths, Coles, Aldi, IGA, Harris → Groceries
- Netflix, Spotify, Disney+, Stan, Apple → Entertainment  
- DEFT PAYMENTS, strata → Home
- Chemist Warehouse, pharmacies → Health & Medical
- Transport NSW, Opal, tolls, petrol → Vehicle & Transport
- Uber Eats, DoorDash, Menulog, restaurants, cafes → Eating out & takeaway`;

    const transactionsList = transactions
      .map((tx, idx) => `${idx + 1}. ${tx.description}`)
      .join('\n');

    const userPrompt = `Classify each Australian bank transaction description.
Return JSON array: [{"description": "<original>", "category": "<category name>"}]
Transactions:
${transactionsList}`;

    const model = getAIProvider();
    const { text, usage } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Parse JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON array from AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      description: string;
      category: string;
    }>;

    // Map parsed results back to ClassifiedTransaction objects
    const classified: ClassifiedTransaction[] = transactions.map((tx, idx) => {
      const parsedItem = parsed[idx];
      const llmCategory = parsedItem?.category ?? tx.description;

      return {
        id: randomUUID(),
        description: tx.description,
        amount: tx.amount,
        date: new Date(tx.year, tx.month - 1, parseInt(tx.date.split('/')[0]!)).toISOString().split('T')[0]!,
        llmCategory,
        confirmedCategory: llmCategory,
        overridden: false,
      };
    });

    return {
      classified,
      usage: {
        promptTokens: usage.promptTokens ?? 0,
        completionTokens: usage.completionTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
    };
  } catch (error) {
    console.error('[CSVClassifierService] Failed to classify transactions:', error);

    // Fallback: use description as category and return zero usage
    const classified: ClassifiedTransaction[] = transactions.map((tx) => ({
      id: randomUUID(),
      description: tx.description,
      amount: tx.amount,
      date: new Date(tx.year, tx.month - 1, parseInt(tx.date.split('/')[0]!)).toISOString().split('T')[0]!,
      llmCategory: tx.description,
      confirmedCategory: tx.description,
      overridden: false,
    }));

    return {
      classified,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

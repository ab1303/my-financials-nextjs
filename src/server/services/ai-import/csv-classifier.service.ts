import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { randomUUID } from 'crypto';
import type { CsvTransaction, ClassifiedTransaction, ClassifiedCreditTransaction } from './_types';
import type { ExpenseCategory } from '@prisma/client';

/**
 * AI Classifier Service for CSV transactions
 * Converts raw bank descriptions to expense categories via LLM
 */

const DEFAULT_INCOME_SOURCE_NAMES = [
  'EMPLOYMENT',
  'STOCKS',
  'BONDS',
  'RENTAL',
  'BUSINESS',
  'FREELANCE',
  'DIVIDEND',
  'OTHER',
];

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
- Transfer

Rules:
- Respond ONLY with a JSON array. No other text, no markdown.
- Use ONLY the exact category names listed above.
- Use "Transfer" for transactions that move money between your own bank accounts (e.g. "Transfer to Savings", "Transfer to Current", "INTER ACCOUNT TRANSFER", "BPAY to own account", "OSKO Payment to ANZ", "INT XFER").
- Never use "Transfer" for payments to third parties, merchants, or services.
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
        date: new Date(Date.UTC(tx.year, tx.month - 1, parseInt(tx.date.split('/')[0]!, 10))).toISOString().split('T')[0]!, // Use UTC to avoid timezone shift
        llmCategory,
        confirmedCategory: llmCategory,
        overridden: false,
      };
    });

    return {
      classified,
      usage: {
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
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
      date: new Date(Date.UTC(tx.year, tx.month - 1, parseInt(tx.date.split('/')[0]!, 10))).toISOString().split('T')[0]!, // Use UTC to avoid timezone shift
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

export async function classifyCreditTransactions(
  transactions: CsvTransaction[],
  incomeSourceNames: string[] = DEFAULT_INCOME_SOURCE_NAMES,
): Promise<{
  classified: ClassifiedCreditTransaction[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  if (!transactions.length) {
    return {
      classified: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  try {
    const CREDIT_LABELS = [...incomeSourceNames, 'Transfer', 'Excluded'];

    const systemPrompt = `You are a financial transaction classifier for an Australian personal finance app.
Classify each CREDIT (incoming) bank transaction description into exactly one of the following income categories.
Available categories:
${CREDIT_LABELS.map((l) => `- ${l}`).join('\n')}

Rules:
- Respond ONLY with a JSON array. No other text, no markdown.
- Use ONLY the exact labels listed above.
- EMPLOYMENT: salary, wages, payroll, pay from employer
- STOCKS: dividends from individual shares, stock income, ASX share payments
- BONDS: bond interest, fixed income
- RENTAL: rent received, property income
- BUSINESS: business income, invoice payments
- FREELANCE: contractor payments, gig economy
- DIVIDEND: ETF distributions (IOZ, VAS, NDQ, A200, VDHG, DHHF etc.), managed fund distributions, trust distributions
- OTHER: interest earned, government payments, tax refunds
- Transfer: internal bank transfer (savings, offset)
- Excluded: refunds, reversals, or items to ignore
- One object per transaction, preserving input order.`;

    const transactionsList = transactions
      .map((tx, idx) => `${idx + 1}. ${tx.description} (amount: $${tx.amount})`)
      .join('\n');

    const userPrompt = `Classify each Australian bank credit transaction.
Return JSON array: [{"description": "<original>", "category": "<label>"}]
Transactions:
${transactionsList}`;

    const model = getAIProvider();
    const { text, usage } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON array from AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      description: string;
      category: string;
    }>;

    const classified: ClassifiedCreditTransaction[] = transactions.map((tx, idx) => {
      const parsedItem = parsed[idx];
      const raw = parsedItem?.category ?? 'OTHER';
      const llmCategory = CREDIT_LABELS.includes(raw) ? raw : 'OTHER';

      return {
        id: randomUUID(),
        description: tx.description,
        amount: tx.amount,
        date: new Date(Date.UTC(tx.year, tx.month - 1, parseInt(tx.date.split('/')[0]!, 10))).toISOString().split('T')[0]!, // Use UTC to avoid timezone shift
        llmCategory,
        confirmedCategory: llmCategory,
        overridden: false,
        type: 'CREDIT' as const,
      };
    });

    return {
      classified,
      usage: {
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
    };
  } catch (error) {
    console.error('[CSVClassifierService] Failed to classify credit transactions:', error);

    const classified: ClassifiedCreditTransaction[] = transactions.map((tx) => ({
      id: randomUUID(),
      description: tx.description,
      amount: tx.amount,
      date: new Date(Date.UTC(tx.year, tx.month - 1, parseInt(tx.date.split('/')[0]!, 10))).toISOString().split('T')[0]!, // Use UTC to avoid timezone shift
      llmCategory: 'OTHER',
      confirmedCategory: 'OTHER',
      overridden: false,
      type: 'CREDIT' as const,
    }));

    return {
      classified,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

import { generateText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import type {
  ExpenseExtractionResult,
  BankAssetExtractionResult,
} from './_types';

/**
 * AI Vision Service using Vercel AI SDK
 * Handles image parsing and structured data extraction via AI models
 *
 * Supports two providers via AI_PROVIDER env var:
 * - "github" (default): GitHub Models free tier (OpenAI-compatible API)
 * - "openai": Direct OpenAI API (paid)
 */

const GITHUB_MODELS_BASE_URL = 'https://models.inference.ai.azure.com';

function getAIProvider() {
  const provider = process.env.AI_PROVIDER ?? 'github';
  const modelId = process.env.AI_VISION_MODEL ?? 'gpt-4o-mini';
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      `AI_API_KEY is required. Set a ${provider === 'github' ? 'GitHub Personal Access Token' : 'OpenAI API key'} in your environment.`,
    );
  }

  const openai = createOpenAI({
    apiKey,
    ...(provider === 'github' && { baseURL: GITHUB_MODELS_BASE_URL }),
  });

  return openai.chat(modelId);
}

// Schemas for validation
const ExpenseEntrySchema = z.object({
  categoryName: z.string(),
  amount: z.number().min(0),
});

const ExpenseExtractionSchema = z.object({
  confidence: z.number().min(0).max(1),
  entries: z.array(ExpenseEntrySchema),
  warnings: z.array(z.string()),
});

const BankAccountSchema = z.object({
  accountName: z.string(),
  balance: z.number().min(0),
  currency: z.string().optional().default('AUD'),
});

const BankAssetExtractionSchema = z.object({
  confidence: z.number().min(0).max(1),
  bankName: z.string().optional(),
  entries: z.array(BankAccountSchema),
  warnings: z.array(z.string()),
});

/**
 * Extract expense data from a banking app screenshot
 * Expected image: expense summary showing categories and amounts
 */
export async function extractExpenseData(
  imageBuffer: Buffer,
  expenseCategories: string[],
): Promise<ExpenseExtractionResult> {
  const base64Image = imageBuffer.toString('base64');

  const systemPrompt = `You are a financial data extraction AI specialized in parsing banking app screenshots. 
Your task is to extract expense data from screenshots containing expense summaries.

IMPORTANT: You MUST respond ONLY with valid JSON. No additional text before or after.

PRIVACY RULES — strictly enforced:
- DO NOT extract or include in your response: full names, email addresses, phone numbers, BSB numbers, account numbers, street addresses, or any other personally identifiable information.
- Extract ONLY category names and dollar amounts. Nothing else.
- If an area of the image is blacked out or redacted, ignore it entirely.

Available categories for matching:
${expenseCategories.map((cat) => `- ${cat}`).join('\n')}

When extracting expenses:
1. Look for category names and associated amounts
2. Be precise with decimal amounts (e.g., 125.50)
3. If a category name is unclear, use the closest matching category
4. Provide a confidence score reflecting image quality and readability
5. Note any ambiguities or unclear values in warnings`;

  const userPrompt = `Extract all expense categories and amounts from this banking app screenshot.
Return ONLY a JSON object with this structure:
{
  "confidence": <number 0-1>,
  "entries": [{"categoryName": <string>, "amount": <number>}],
  "warnings": [<string>]
}`;

  try {
    const model = getAIProvider();
    const { text, usage } = await generateText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: base64Image,
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = ExpenseExtractionSchema.parse(parsed);

    return {
      success: true,
      confidence: validated.confidence,
      entries: validated.entries,
      warnings: validated.warnings,
      usage: {
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
    };
  } catch (error) {
    console.error('[AIVisionService] Failed to extract expense data:', error);
    throw error;
  }
}

/**
 * Extract bank asset data from a bank account balance screenshot
 * Expected image: account listing showing account names and balances
 */
export async function extractBankAssetData(
  imageBuffer: Buffer,
): Promise<BankAssetExtractionResult> {
  const base64Image = imageBuffer.toString('base64');

  const systemPrompt = `You are a financial data extraction AI specialized in parsing banking app screenshots.
Your task is to extract bank account balance data from screenshots.

IMPORTANT: You MUST respond ONLY with valid JSON. No additional text before or after.

PRIVACY RULES — strictly enforced:
- DO NOT extract or include in your response: full names, email addresses, phone numbers, BSB numbers (e.g., 06-2000), account numbers (e.g., 12345678), street addresses, or any other personally identifiable information.
- Extract ONLY the bank name (from app branding/logo), account nicknames, and balance amounts. Nothing else.
- If an area of the image is blacked out or redacted, ignore it entirely.

When extracting bank data:
1. Extract the bank name from app branding, header, or context
2. List all visible accounts with their nicknames and balances only
3. Handle currency symbols and formatting (assume AUD if not specified)
4. Provide a confidence score reflecting image quality and readability
5. Note any ambiguities or unclear values in warnings`;

  const userPrompt = `Extract all bank accounts and their balances from this banking app screenshot.
Return ONLY a JSON object with this structure:
{
  "confidence": <number 0-1>,
  "bankName": <string optional>,
  "entries": [{"accountName": <string>, "balance": <number>, "currency": <string optional>}],
  "warnings": [<string>]
}`;

  try {
    const model = getAIProvider();
    const { text, usage } = await generateText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: base64Image,
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = BankAssetExtractionSchema.parse(parsed);

    return {
      success: true,
      confidence: validated.confidence,
      entries: validated.entries,
      bankName: validated.bankName,
      warnings: validated.warnings,
      usage: {
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
    };
  } catch (error) {
    console.error(
      '[AIVisionService] Failed to extract bank asset data:',
      error,
    );
    throw error;
  }
}

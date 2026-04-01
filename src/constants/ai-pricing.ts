/**
 * AI model pricing constants for GPT-4o.
 * Rates sourced from https://openai.com/api/pricing/
 * Updated: 2025. Input: $2.50/1M tokens, Output: $10.00/1M tokens.
 */

export const AI_MODEL_NAME = 'gpt-4o' as const;

export const GPT4O_INPUT_COST_PER_TOKEN = 2.5 / 1_000_000; // $0.0000025
export const GPT4O_OUTPUT_COST_PER_TOKEN = 10.0 / 1_000_000; // $0.0000100

/**
 * Calculate estimated USD cost from token usage.
 */
export function calculateEstimatedCost(
  promptTokens: number,
  completionTokens: number,
): number {
  return (
    promptTokens * GPT4O_INPUT_COST_PER_TOKEN +
    completionTokens * GPT4O_OUTPUT_COST_PER_TOKEN
  );
}

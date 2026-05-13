import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CsvTransaction } from '@/server/services/ai-import/_types';

/**
 * Hoisted mocks - these are applied before any imports
 */
vi.mock('ai');
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({
    chat: vi.fn(() => 'mock-model'),
  })),
}));

// Now import the service and dependencies
import { classifyTransactions } from '@/server/services/ai-import/csv-classifier.service';
import { generateText } from 'ai';

describe('csv-classifier.service', () => {
  const mockCategories = [
    { id: '1', name: 'Groceries', isActive: true },
    { id: '2', name: 'Entertainment', isActive: true },
    { id: '3', name: 'Home', isActive: true },
    { id: '4', name: 'Health & Medical', isActive: true },
    { id: '5', name: 'Vehicle & Transport', isActive: true },
    { id: '6', name: 'Eating out & takeaway', isActive: true },
  ];

  const mockTransactions: CsvTransaction[] = [
    {
      date: '01/07/2025',
      amount: 85.5,
      description: 'WOOLWORTHS 1294 HORNSBY NS',
      month: 7,
      year: 2025,
    },
    {
      date: '02/07/2025',
      amount: 15.99,
      type: 'DEBIT',
      description: 'NETFLIX SUBSCRIPTION',
      month: 7,
      year: 2025,
    },
    {
      date: '03/07/2025',
      amount: 1200.0,
      type: 'DEBIT',
      description: 'DEFT PAYMENTS STRATA',
      month: 7,
      year: 2025,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variable for tests
    process.env.AI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AI_API_KEY;
  });

  it('should return correct ClassifiedTransaction shape with llmCategory', async () => {
    const mockResponse = `
    [
      {"description": "WOOLWORTHS 1294 HORNSBY NS", "category": "Groceries"},
      {"description": "NETFLIX SUBSCRIPTION", "category": "Entertainment"},
      {"description": "DEFT PAYMENTS STRATA", "category": "Home"}
    ]
    `;

    vi.mocked(generateText).mockResolvedValueOnce({
      text: mockResponse,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      finishReason: 'stop',
    } as any);

    const result = await classifyTransactions(mockTransactions, mockCategories as any);

    expect(result.classified).toHaveLength(3);
    expect(result.classified[0]).toMatchObject({
      id: expect.any(String),
      description: 'WOOLWORTHS 1294 HORNSBY NS',
      amount: 85.5,
      date: expect.any(String),
      llmCategory: 'Groceries',
      confirmedCategory: 'Groceries',
      overridden: false,
    });
    expect(result.classified[1]).toMatchObject({
      llmCategory: 'Entertainment',
      confirmedCategory: 'Entertainment',
    });
    expect(result.classified[2]).toMatchObject({
      llmCategory: 'Home',
      confirmedCategory: 'Home',
    });
  });

  it('should have confirmedCategory === llmCategory initially', async () => {
    const mockResponse = `
    [
      {"description": "WOOLWORTHS 1294 HORNSBY NS", "category": "Groceries"}
    ]
    `;

    vi.mocked(generateText).mockResolvedValueOnce({
      text: mockResponse,
      usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      finishReason: 'stop',
    } as any);

    const result = await classifyTransactions(
      [mockTransactions[0]!],
      mockCategories as any,
    );

    expect(result.classified[0]!.confirmedCategory).toBe(
      result.classified[0]!.llmCategory,
    );
  });

  it('should have overridden: false initially', async () => {
    const mockResponse = `
    [
      {"description": "WOOLWORTHS 1294 HORNSBY NS", "category": "Groceries"}
    ]
    `;

    vi.mocked(generateText).mockResolvedValueOnce({
      text: mockResponse,
      usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      finishReason: 'stop',
    } as any);

    const result = await classifyTransactions(
      [mockTransactions[0]!],
      mockCategories as any,
    );

    expect(result.classified[0]!.overridden).toBe(false);
  });

  it('should preserve amount from original CsvTransaction', async () => {
    const mockResponse = `
    [
      {"description": "WOOLWORTHS 1294 HORNSBY NS", "category": "Groceries"}
    ]
    `;

    vi.mocked(generateText).mockResolvedValueOnce({
      text: mockResponse,
      usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      finishReason: 'stop',
    } as any);

    const result = await classifyTransactions(
      [mockTransactions[0]!],
      mockCategories as any,
    );

    expect(result.classified[0]!.amount).toBe(mockTransactions[0]!.amount);
  });

  it('should fall back to tx.description as llmCategory when generateText throws', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('API Error'));

    const result = await classifyTransactions(
      [mockTransactions[0]!],
      mockCategories as any,
    );

    expect(result.classified[0]!.llmCategory).toBe(mockTransactions[0]!.description);
    expect(result.classified[0]!.confirmedCategory).toBe(
      mockTransactions[0]!.description,
    );
    expect(result.usage.totalTokens).toBe(0);
  });

  it('should fall back when LLM returns no JSON array in response', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Invalid response, no JSON',
      usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      finishReason: 'stop',
    } as any);

    const result = await classifyTransactions(
      [mockTransactions[0]!],
      mockCategories as any,
    );

    expect(result.classified[0]!.llmCategory).toBe(mockTransactions[0]!.description);
    expect(result.usage.totalTokens).toBe(0);
  });

  it('should handle empty transactions array', async () => {
    const result = await classifyTransactions([], mockCategories as any);

    expect(result.classified).toHaveLength(0);
    expect(result.usage.totalTokens).toBe(0);
  });

  it('should return zero usage on fallback', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('API Error'));

    const result = await classifyTransactions(
      [mockTransactions[0]!],
      mockCategories as any,
    );

    expect(result.usage.promptTokens).toBe(0);
    expect(result.usage.completionTokens).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
  });

  it('should return correct usage from LLM response', async () => {
    const mockResponse = `
    [
      {"description": "WOOLWORTHS 1294 HORNSBY NS", "category": "Groceries"},
      {"description": "NETFLIX SUBSCRIPTION", "category": "Entertainment"}
    ]
    `;

    vi.mocked(generateText).mockResolvedValueOnce({
      text: mockResponse,
      usage: {
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
      },
      finishReason: 'stop',
    } as any);

    const result = await classifyTransactions(
      [mockTransactions[0]!, mockTransactions[1]!],
      mockCategories as any,
    );

    expect(result.usage.promptTokens).toBe(200);
    expect(result.usage.completionTokens).toBe(100);
    expect(result.usage.totalTokens).toBe(300);
  });

  it('should preserve transaction order when mapping LLM results', async () => {
    const mockResponse = `
    [
      {"description": "WOOLWORTHS 1294 HORNSBY NS", "category": "Groceries"},
      {"description": "NETFLIX SUBSCRIPTION", "category": "Entertainment"},
      {"description": "DEFT PAYMENTS STRATA", "category": "Home"}
    ]
    `;

    vi.mocked(generateText).mockResolvedValueOnce({
      text: mockResponse,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      finishReason: 'stop',
    } as any);

    const result = await classifyTransactions(
      mockTransactions,
      mockCategories as any,
    );

    expect(result.classified[0]!.description).toBe(mockTransactions[0]!.description);
    expect(result.classified[1]!.description).toBe(mockTransactions[1]!.description);
    expect(result.classified[2]!.description).toBe(mockTransactions[2]!.description);
  });
});

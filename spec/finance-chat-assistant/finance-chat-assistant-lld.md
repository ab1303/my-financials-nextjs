# Low Level Design: Personal Finance RAG Chat Assistant

> **Version**: 1.0
> **Date**: 2026-04-02
> **Status**: Draft
> **Parent**: [Finance Chat Assistant HLD](./finance-chat-assistant-hld.md)

---

## Table of Contents

1. [API Route Handler](#1-api-route-handler)
2. [AI Provider Factory for Chat](#2-ai-provider-factory-for-chat)
3. [System Prompt](#3-system-prompt)
4. [Financial Data Tools](#4-financial-data-tools)
5. [Tool Implementations](#5-tool-implementations)
6. [Pricing Constants](#6-pricing-constants)
7. [Usage Logging](#7-usage-logging)
8. [Client: Assistant Page](#8-client-assistant-page)
9. [Client: AssistantClient Component](#9-client-assistantclient-component)
10. [Client: ChatMessage Component](#10-client-chatmessage-component)
11. [Client: ChatInput Component](#11-client-chatinput-component)
12. [Navigation Update](#12-navigation-update)
13. [Environment Variables](#13-environment-variables)
14. [Testing Strategy](#14-testing-strategy)

---

## 1. API Route Handler

### New File: `src/app/api/chat/route.ts`

This is the core streaming endpoint. It handles authentication, tool-calling, and streaming via the AI SDK.

```typescript
import { streamText } from 'ai';
import { auth } from '@/server/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getChatModel } from '@/server/services/chat/chat-provider';
import { FINANCIAL_ASSISTANT_PROMPT } from '@/server/services/chat/system-prompt';
import { createFinancialTools } from '@/server/services/chat/tools';
import { logChatUsage } from '@/server/services/chat/usage-logger';

export async function POST(request: NextRequest) {
  // 1. Authenticate — identical pattern to existing API routes
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // 2. Parse messages from request body
  const { messages } = await request.json();

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: 'Invalid request: messages array required' },
      { status: 400 },
    );
  }

  // 3. Create tools scoped to this user (userId baked into closures)
  const tools = createFinancialTools(userId);

  // 4. Stream response with tool-calling
  const result = streamText({
    model: getChatModel(),
    system: FINANCIAL_ASSISTANT_PROMPT,
    messages,
    tools,
    maxSteps: 5,
    temperature: 0.3,
    onFinish: async ({ usage }) => {
      // 5. Log token usage after stream completes
      await logChatUsage(userId, usage);
    },
  });

  // 6. Return AI SDK streaming response
  return result.toDataStreamResponse();
}
```

**Key design decisions:**

- Uses `streamText()` (not `generateText()`) for real-time streaming to the client.
- `createFinancialTools(userId)` bakes the `userId` into each tool's execute function — the LLM never sees or controls userId.
- `maxSteps: 5` allows the LLM to chain multiple tool calls in a single turn.
- `onFinish` callback logs token usage asynchronously after the stream completes — does not block the response.
- Returns `result.toDataStreamResponse()` — the AI SDK's built-in streaming response format compatible with `useChat()`.

---

## 2. AI Provider Factory for Chat

### New File: `src/server/services/chat/chat-provider.ts`

Mirrors the existing `getAIProvider()` in `ai-vision.service.ts` but for chat models:

```typescript
import { createOpenAI } from '@ai-sdk/openai';

const GITHUB_MODELS_BASE_URL = 'https://models.inference.ai.azure.com';

/**
 * Get the AI chat model for the assistant.
 * Reuses AI_API_KEY and AI_PROVIDER from environment.
 * Uses AI_CHAT_MODEL for model selection (defaults to gpt-4o-mini).
 */
export function getChatModel() {
  const provider = process.env.AI_PROVIDER ?? 'github';
  const modelId = process.env.AI_CHAT_MODEL ?? 'gpt-4o-mini';
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
```

**Why a separate file instead of reusing `getAIProvider()`?** The vision service uses `AI_VISION_MODEL` (defaults to `gpt-4o-mini` for vision). The chat service uses `AI_CHAT_MODEL` (defaults to `gpt-4o-mini` for text). Keeping them separate allows independent model selection per feature (e.g., vision may need GPT-4o while chat is fine with GPT-4o-mini).

---

## 3. System Prompt

### New File: `src/server/services/chat/system-prompt.ts`

```typescript
export const FINANCIAL_ASSISTANT_PROMPT = `You are a personal finance assistant for the My Financials application.
You help users understand their financial data by querying their records using the available tools.

CAPABILITIES:
- Query income records by year, month, and source type
- Query expense records by year, month, and category
- Look up bank account balances (current and historical snapshots)
- Look up stock portfolio holdings and valuations
- Query zakat obligations and payments
- Query donation records and tax categories
- Look up available calendar year periods
- Calculate net worth from bank + stock data

RULES:
1. ONLY report data returned by tool calls. NEVER fabricate, estimate, or guess financial numbers.
2. If a tool returns no data or empty results, clearly say "I couldn't find any records matching that query" — do not invent placeholder values.
3. Do NOT provide financial advice, tax advice, investment recommendations, or future projections.
4. Format currency amounts clearly with dollar signs and two decimal places (e.g., "$1,234.56").
5. When the user asks about "this year" or "current year", use the current calendar year. When they mention a financial/fiscal year, check available calendar years first.
6. When comparing time periods, clearly label which figure belongs to which period.
7. If a question is ambiguous, ask the user to clarify the time period or category.
8. Keep responses concise and well-structured. Use bullet points or tables for breakdowns.
9. You may call multiple tools in sequence to answer complex questions (e.g., get income AND expenses to calculate savings).

PRIVACY:
- You are accessing only the authenticated user's data. Never reference other users.
- Do not include database IDs, internal field names, or system details in responses.
- Refer to data sources naturally (e.g., "your income records" not "the Income table").

CURRENT DATE: The current date will be inferred from context. Use it to interpret relative time references like "last month" or "this quarter".`;
```

---

## 4. Financial Data Tools

### New File: `src/server/services/chat/tools.ts`

Each tool is defined with:

- A `description` the LLM reads to decide when to call it
- A `parameters` Zod schema defining the input
- An `execute` function that queries Prisma with the bound `userId`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/server/db/client';

/**
 * Create all financial data tools scoped to a specific user.
 * userId is baked into each tool's execute function via closure.
 */
export function createFinancialTools(userId: string) {
  return {
    getIncomeSummary: tool({
      description:
        'Get income summary for the user. Can filter by year and/or income source type. Returns total income and breakdown by source.',
      parameters: z.object({
        year: z
          .number()
          .optional()
          .describe('Calendar year to filter by (e.g., 2026)'),
        source: z
          .enum([
            'EMPLOYMENT',
            'STOCKS',
            'BONDS',
            'RENTAL',
            'BUSINESS',
            'FREELANCE',
            'OTHER',
          ])
          .optional()
          .describe('Filter by income source type'),
      }),
      execute: async ({ year, source }) => {
        return getIncomeSummaryForUser(userId, year, source);
      },
    }),

    getExpenseBreakdown: tool({
      description:
        'Get expense breakdown for the user. Can filter by year, month (1-12), and/or category name. Returns totals and per-category amounts.',
      parameters: z.object({
        year: z
          .number()
          .optional()
          .describe('Calendar year to filter by (e.g., 2026)'),
        month: z
          .number()
          .min(1)
          .max(12)
          .optional()
          .describe('Month number (1=January, 12=December)'),
        category: z
          .string()
          .optional()
          .describe('Expense category name (e.g., "Food", "Transportation")'),
      }),
      execute: async ({ year, month, category }) => {
        return getExpenseBreakdownForUser(userId, year, month, category);
      },
    }),

    getBankBalances: tool({
      description:
        'Get bank account balances. Returns the most recent snapshot by default, or a specific date if provided. Shows all accounts with their balances.',
      parameters: z.object({
        snapshotDate: z
          .string()
          .optional()
          .describe(
            'ISO date string to find the nearest snapshot (e.g., "2026-01-15"). Defaults to most recent.',
          ),
        bankName: z
          .string()
          .optional()
          .describe('Filter by bank name (e.g., "CommBank")'),
      }),
      execute: async ({ snapshotDate, bankName }) => {
        return getBankBalancesForUser(userId, snapshotDate, bankName);
      },
    }),

    getStockHoldings: tool({
      description:
        'Get stock portfolio holdings and valuations. Returns the most recent snapshot by default. Shows individual holdings with ticker, quantity, buy price, and current value.',
      parameters: z.object({
        snapshotDate: z
          .string()
          .optional()
          .describe(
            'ISO date string to find the nearest snapshot. Defaults to most recent.',
          ),
        ticker: z
          .string()
          .optional()
          .describe('Filter by stock ticker symbol (e.g., "AAPL")'),
      }),
      execute: async ({ snapshotDate, ticker }) => {
        return getStockHoldingsForUser(userId, snapshotDate, ticker);
      },
    }),

    getZakatSummary: tool({
      description:
        'Get zakat obligation summary. Shows amount due and payments made for a given year. Returns balance remaining.',
      parameters: z.object({
        year: z.number().optional().describe('Calendar year for zakat records'),
      }),
      execute: async ({ year }) => {
        return getZakatSummaryForUser(userId, year);
      },
    }),

    getDonationSummary: tool({
      description:
        'Get donation summary. Shows total donations and breakdown by recipient and tax category for a given year.',
      parameters: z.object({
        year: z
          .number()
          .optional()
          .describe('Calendar year for donation records'),
        taxCategory: z
          .string()
          .optional()
          .describe('Filter by tax deduction category'),
      }),
      execute: async ({ year, taxCategory }) => {
        return getDonationSummaryForUser(userId, year, taxCategory);
      },
    }),

    getCalendarYears: tool({
      description:
        'Get available calendar year periods configured by the user. Shows fiscal years, zakat years, and annual periods with their date ranges.',
      parameters: z.object({
        type: z
          .enum(['ZAKAT', 'ANNUAL', 'FISCAL'])
          .optional()
          .describe('Filter by calendar year type'),
      }),
      execute: async ({ type }) => {
        return getCalendarYearsForUser(userId, type);
      },
    }),

    getNetWorth: tool({
      description:
        'Calculate the user total net worth by summing bank balances and stock holdings from the most recent snapshots. Optionally for a specific date.',
      parameters: z.object({
        snapshotDate: z
          .string()
          .optional()
          .describe('ISO date string. Defaults to most recent snapshot dates.'),
      }),
      execute: async ({ snapshotDate }) => {
        return getNetWorthForUser(userId, snapshotDate);
      },
    }),
  };
}
```

---

## 5. Tool Implementations

Each tool implementation is a function in the same `tools.ts` file (or extracted to `src/server/services/chat/tool-queries.ts` if the file grows too large). All queries scope to `userId`.

### 5.1 `getIncomeSummaryForUser`

```typescript
async function getIncomeSummaryForUser(
  userId: string,
  year?: number,
  source?: string,
) {
  // Find calendar years matching the requested year
  const calendarFilter: Record<string, unknown> = { userId };
  if (year) {
    calendarFilter.fromYear = { lte: year };
    calendarFilter.toYear = { gte: year };
  }

  const incomes = await prisma.income.findMany({
    where: {
      userId,
      ...(year && {
        calendar: { fromYear: { lte: year }, toYear: { gte: year } },
      }),
    },
    include: {
      incomeEntries: {
        where: {
          ...(source && { source }),
        },
        orderBy: { dateEarned: 'desc' },
      },
      calendar: true,
    },
  });

  const allEntries = incomes.flatMap((i) => i.incomeEntries);
  const total = allEntries.reduce(
    (sum, e) => sum + parseFloat(String(e.amount)),
    0,
  );

  // Group by source
  const bySource: Record<string, number> = {};
  for (const entry of allEntries) {
    const src = entry.source;
    bySource[src] = (bySource[src] ?? 0) + parseFloat(String(entry.amount));
  }

  return {
    totalIncome: total,
    currency: 'AUD',
    entryCount: allEntries.length,
    bySource,
    period: year ? `Year ${year}` : 'All time',
  };
}
```

### 5.2 `getExpenseBreakdownForUser`

```typescript
async function getExpenseBreakdownForUser(
  userId: string,
  year?: number,
  month?: number,
  category?: string,
) {
  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      ...(year && {
        calendar: { fromYear: { lte: year }, toYear: { gte: year } },
      }),
    },
    include: {
      expenseEntries: {
        where: {
          ...(month && { month }),
          ...(category && {
            category: { name: { equals: category, mode: 'insensitive' } },
          }),
        },
        include: { category: true },
      },
      calendar: true,
    },
  });

  const allEntries = expenses.flatMap((e) => e.expenseEntries);
  const total = allEntries.reduce(
    (sum, e) => sum + parseFloat(String(e.amount)),
    0,
  );

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const entry of allEntries) {
    const catName = entry.category.name;
    byCategory[catName] =
      (byCategory[catName] ?? 0) + parseFloat(String(entry.amount));
  }

  // Sort by amount descending
  const sortedCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => ({ category: name, amount }));

  return {
    totalExpenses: total,
    currency: 'AUD',
    entryCount: allEntries.length,
    byCategory: sortedCategories,
    period:
      [year && `Year ${year}`, month && `Month ${month}`]
        .filter(Boolean)
        .join(', ') || 'All time',
  };
}
```

### 5.3 `getBankBalancesForUser`

```typescript
async function getBankBalancesForUser(
  userId: string,
  snapshotDate?: string,
  bankName?: string,
) {
  // Find the nearest snapshot to the requested date, or the most recent
  const snapshot = await prisma.bankAssetSnapshot.findFirst({
    where: {
      userId,
      ...(snapshotDate && {
        snapshotDate: { lte: new Date(snapshotDate) },
      }),
    },
    orderBy: { snapshotDate: 'desc' },
    include: {
      entries: {
        include: {
          account: {
            include: { bank: true },
          },
        },
        ...(bankName && {
          where: {
            account: {
              bank: { name: { contains: bankName, mode: 'insensitive' } },
            },
          },
        }),
      },
    },
  });

  if (!snapshot) {
    return { message: 'No bank asset snapshots found.' };
  }

  const accounts = snapshot.entries.map((e) => ({
    bank: (e.account as { bank?: { name?: string } })?.bank?.name ?? 'Unknown',
    account: e.account.name,
    balance: parseFloat(String(e.balance)),
  }));

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return {
    snapshotDate: snapshot.snapshotDate.toISOString().split('T')[0],
    totalBalance: total,
    currency: 'AUD',
    accounts,
  };
}
```

### 5.4 `getStockHoldingsForUser`

```typescript
async function getStockHoldingsForUser(
  userId: string,
  snapshotDate?: string,
  ticker?: string,
) {
  const snapshot = await prisma.stockSnapshot.findFirst({
    where: {
      userId,
      ...(snapshotDate && {
        snapshotDate: { lte: new Date(snapshotDate) },
      }),
    },
    orderBy: { snapshotDate: 'desc' },
    include: {
      holdings: {
        ...(ticker && {
          where: { ticker: { equals: ticker, mode: 'insensitive' } },
        }),
      },
    },
  });

  if (!snapshot) {
    return { message: 'No stock snapshots found.' };
  }

  const holdings = snapshot.holdings.map((h) => ({
    ticker: h.ticker,
    quantity: h.quantity,
    buyPrice: parseFloat(String(h.buyPrice)),
    currentPrice: parseFloat(String(h.currentPrice)),
    totalValue: h.quantity * parseFloat(String(h.currentPrice)),
    currency: h.currency,
    plannedTerm: h.plannedTerm,
  }));

  const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);

  return {
    snapshotDate: snapshot.snapshotDate.toISOString().split('T')[0],
    totalValue,
    holdingCount: holdings.length,
    holdings,
  };
}
```

### 5.5 `getZakatSummaryForUser`

```typescript
async function getZakatSummaryForUser(userId: string, year?: number) {
  const zakats = await prisma.zakat.findMany({
    where: {
      userId,
      ...(year && {
        calendar: { fromYear: { lte: year }, toYear: { gte: year } },
      }),
    },
    include: {
      zakatPayments: {
        include: {
          individual: true,
          business: true,
        },
      },
      calendar: true,
    },
  });

  return zakats.map((z) => {
    const amountDue = parseFloat(String(z.amountDue));
    const totalPaid = z.zakatPayments.reduce(
      (sum, p) => sum + parseFloat(String(p.amount)),
      0,
    );

    return {
      period: `${z.calendar.fromYear}–${z.calendar.toYear}`,
      amountDue,
      totalPaid,
      remaining: amountDue - totalPaid,
      currency: 'AUD',
      payments: z.zakatPayments.map((p) => ({
        amount: parseFloat(String(p.amount)),
        recipient: p.individual?.firstName ?? p.business?.name ?? 'Unknown',
        date: p.datePaid?.toISOString().split('T')[0] ?? 'N/A',
      })),
    };
  });
}
```

### 5.6 `getDonationSummaryForUser`

```typescript
async function getDonationSummaryForUser(
  userId: string,
  year?: number,
  taxCategory?: string,
) {
  const donations = await prisma.donation.findMany({
    where: {
      userId,
      ...(year && {
        calendar: { fromYear: { lte: year }, toYear: { gte: year } },
      }),
    },
    include: {
      donationPayments: {
        where: {
          ...(taxCategory && { taxCategory }),
        },
        include: {
          individual: true,
          business: true,
        },
      },
      calendar: true,
    },
  });

  const allPayments = donations.flatMap((d) => d.donationPayments);
  const total = allPayments.reduce(
    (sum, p) => sum + parseFloat(String(p.amount)),
    0,
  );

  // Group by tax category
  const byTaxCategory: Record<string, number> = {};
  for (const p of allPayments) {
    const cat = p.taxCategory ?? 'Uncategorized';
    byTaxCategory[cat] =
      (byTaxCategory[cat] ?? 0) + parseFloat(String(p.amount));
  }

  return {
    totalDonations: total,
    currency: 'AUD',
    paymentCount: allPayments.length,
    byTaxCategory,
    period: year ? `Year ${year}` : 'All time',
  };
}
```

### 5.7 `getCalendarYearsForUser`

```typescript
async function getCalendarYearsForUser(userId: string, type?: string) {
  const calendars = await prisma.calendarYear.findMany({
    where: {
      userId,
      ...(type && { type }),
    },
    orderBy: { fromYear: 'desc' },
  });

  return calendars.map((c) => ({
    id: c.id,
    type: c.type,
    description: c.description,
    from: `${c.fromMonth}/${c.fromYear}`,
    to: `${c.toMonth}/${c.toYear}`,
  }));
}
```

### 5.8 `getNetWorthForUser`

```typescript
async function getNetWorthForUser(userId: string, snapshotDate?: string) {
  const [bankResult, stockResult] = await Promise.all([
    getBankBalancesForUser(userId, snapshotDate),
    getStockHoldingsForUser(userId, snapshotDate),
  ]);

  const bankTotal = 'totalBalance' in bankResult ? bankResult.totalBalance : 0;
  const stockTotal = 'totalValue' in stockResult ? stockResult.totalValue : 0;

  return {
    netWorth: bankTotal + stockTotal,
    bankAssets: bankTotal,
    stockAssets: stockTotal,
    currency: 'AUD',
    bankSnapshotDate:
      'snapshotDate' in bankResult ? bankResult.snapshotDate : null,
    stockSnapshotDate:
      'snapshotDate' in stockResult ? stockResult.snapshotDate : null,
  };
}
```

---

## 6. Pricing Constants

### File: `src/constants/ai-pricing.ts`

Add GPT-4o-mini pricing alongside existing GPT-4o pricing:

```typescript
// --- Existing (unchanged) ---
export const AI_MODEL_NAME = 'gpt-4o' as const;
export const GPT4O_INPUT_COST_PER_TOKEN = 2.5 / 1_000_000;
export const GPT4O_OUTPUT_COST_PER_TOKEN = 10.0 / 1_000_000;

// --- New: GPT-4o-mini pricing (for chat) ---
/**
 * AI model pricing for GPT-4o-mini.
 * Rates: Input: $0.15/1M tokens, Output: $0.60/1M tokens.
 * Source: https://openai.com/api/pricing/
 */
export const GPT4O_MINI_MODEL_NAME = 'gpt-4o-mini' as const;
export const GPT4O_MINI_INPUT_COST_PER_TOKEN = 0.15 / 1_000_000;
export const GPT4O_MINI_OUTPUT_COST_PER_TOKEN = 0.6 / 1_000_000;

/**
 * Calculate estimated USD cost for GPT-4o-mini usage.
 */
export function calculateChatCost(
  promptTokens: number,
  completionTokens: number,
): number {
  return (
    promptTokens * GPT4O_MINI_INPUT_COST_PER_TOKEN +
    completionTokens * GPT4O_MINI_OUTPUT_COST_PER_TOKEN
  );
}
```

---

## 7. Usage Logging

### New File: `src/server/services/chat/usage-logger.ts`

Logs chat token usage to the existing `AIUsageLog` model. Since chat is not tied to an `AIImportSession`, we create a lightweight session record per chat turn (or per conversation, in future).

```typescript
import { prisma } from '@/server/db/client';
import { calculateChatCost } from '@/constants/ai-pricing';
import { ImportTypeEnum } from '@prisma/client';

interface ChatTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Log chat token usage to AIUsageLog.
 *
 * Creates a lightweight AIImportSession with importType based on an
 * extended enum, or reuses an existing approach. Since chat is a new
 * feature, the enum may need extending (see section 7.1).
 */
export async function logChatUsage(
  userId: string,
  usage: ChatTokenUsage,
): Promise<void> {
  if (!usage || usage.totalTokens === 0) return;

  try {
    // Create a session record for this chat interaction
    const session = await prisma.aIImportSession.create({
      data: {
        userId,
        importType: 'CHAT' as ImportTypeEnum,
        status: 'COMPLETED',
        metadata: { type: 'chat-conversation' },
      },
    });

    await prisma.aIUsageLog.create({
      data: {
        sessionId: session.id,
        userId,
        importType: 'CHAT' as ImportTypeEnum,
        model: process.env.AI_CHAT_MODEL ?? 'gpt-4o-mini',
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUSD: calculateChatCost(
          usage.promptTokens,
          usage.completionTokens,
        ),
      },
    });
  } catch (error) {
    // Non-critical — don't fail the chat response if logging fails
    console.error('[ChatUsageLogger] Failed to log usage:', error);
  }
}
```

### 7.1 ImportTypeEnum Extension

The existing `ImportTypeEnum` in `prisma/schema.prisma` includes `EXPENSE`, `BANK_ASSET`, `STOCK`. A new value `CHAT` must be added:

```prisma
enum ImportTypeEnum {
  EXPENSE
  BANK_ASSET
  STOCK
  CHAT        // NEW — for chat assistant usage tracking
}
```

This requires a Prisma migration:

```bash
# Stop dev server first (Windows EPERM safety)
pnpm prisma migrate dev --name add_chat_import_type
```

### 7.2 AI Usage Dashboard Integration

The existing `AIUsageCard` and admin AI usage pages already query `AIUsageLog` by `importType`. Adding `CHAT` to the enum means:

- The user dashboard will automatically show chat costs when `importType: 'CHAT'` filter is added.
- The admin overview will include chat usage in per-user aggregation.
- The AI Usage settings page (`/settings/ai-usage`) needs a minor update to include "Chat" as a selectable import type filter.

---

## 8. Client: Assistant Page

### New File: `src/app/(authorized)/assistant/page.tsx`

Server Component wrapper — handles metadata and renders the client component.

```typescript
import type { Metadata } from 'next';
import { AssistantClient } from './_components/AssistantClient';

export const metadata: Metadata = {
  title: 'AI Assistant — My Financials',
  description: 'Ask questions about your financial data',
};

export default function AssistantPage() {
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          AI Assistant
        </h1>
        <p className="text-muted-foreground mt-1">
          Ask questions about your income, expenses, bank balances, and more
        </p>
      </div>

      <AssistantClient />
    </main>
  );
}
```

---

## 9. Client: AssistantClient Component

### New File: `src/app/(authorized)/assistant/_components/AssistantClient.tsx`

Client Component that manages the chat state using `useChat` from `@ai-sdk/react`.

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const SUGGESTED_QUESTIONS = [
  'What is my current net worth?',
  'Show my expense breakdown for this year',
  'How much income did I earn last month?',
  'What is my zakat balance?',
];

export function AssistantClient() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: '/api/chat',
    });

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-3xl mx-auto">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-6">
              Ask me anything about your finances
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => {
                    // Programmatically submit the suggested question
                    handleInputChange({
                      target: { value: question },
                    } as React.ChangeEvent<HTMLInputElement>);
                    // Submit on next tick after state update
                    setTimeout(() => {
                      const form = document.querySelector(
                        '[data-chat-form]',
                      ) as HTMLFormElement;
                      form?.requestSubmit();
                    }, 0);
                  }}
                  className="text-sm text-left p-3 rounded-lg border border-border
                    hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground px-4">
            <div className="animate-pulse">Thinking...</div>
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm px-4">
            Something went wrong. Please try again.
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
```

**Key design decisions:**

- `useChat({ api: '/api/chat' })` — connects to the streaming API route.
- Suggested questions shown on empty state for discoverability.
- Message list auto-scrolls and shows loading indicator during streaming.
- Error states shown inline below messages.

---

## 10. Client: ChatMessage Component

### New File: `src/app/(authorized)/assistant/_components/ChatMessage.tsx`

Renders a single chat message (user or assistant):

```typescript
'use client';

import type { Message } from '@ai-sdk/react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {/* Render markdown-like content */}
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
```

**Future enhancement:** Use a Markdown renderer (e.g., `react-markdown`) for formatted tables and lists in assistant responses.

---

## 11. Client: ChatInput Component

### New File: `src/app/(authorized)/assistant/_components/ChatInput.tsx`

```typescript
'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  input: string;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
}: ChatInputProps) {
  return (
    <form
      data-chat-form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-border pt-4"
    >
      <input
        type="text"
        value={input}
        onChange={handleInputChange}
        placeholder="Ask about your finances..."
        disabled={isLoading}
        className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5
          text-sm placeholder:text-muted-foreground focus:outline-none
          focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      <Button
        type="submit"
        size="icon"
        disabled={isLoading || !input.trim()}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
```

---

## 12. Navigation Update

Add "AI Assistant" link to the application's sidebar or navigation. The exact file depends on the layout component used.

### Expected Location: SideNav or layout navigation component

Add a new navigation item between existing links:

```typescript
{
  label: 'AI Assistant',
  href: '/assistant',
  icon: Sparkles, // from lucide-react, already used on dashboard
}
```

**Placement:** After the main cashflow links, before Settings. Visible to all authenticated users (not admin-only).

---

## 13. Environment Variables

### File: `.env-example`

Add after the existing AI config section:

```env
# AI Chat Model identifier (used for the AI Assistant feature)
# Default: gpt-4o-mini ($0.15/$0.60 per 1M input/output tokens)
# Alternative: gpt-4o ($2.50/$10.00 per 1M tokens) for higher quality answers
AI_CHAT_MODEL=gpt-4o-mini
```

---

## 14. Testing Strategy

### 14.1 Unit Tests

#### File: `src/__tests__/services/chat/tools.test.ts`

| Test                                                          | Description                                |
| ------------------------------------------------------------- | ------------------------------------------ |
| `getIncomeSummary — returns totals grouped by source`         | Mock Prisma, verify correct aggregation    |
| `getExpenseBreakdown — filters by month and category`         | Verify WHERE clause includes filters       |
| `getBankBalances — returns most recent snapshot when no date` | Verify orderBy desc + findFirst            |
| `getStockHoldings — filters by ticker`                        | Verify WHERE clause includes ticker filter |
| `getZakatSummary — calculates remaining balance`              | Verify amountDue - totalPaid               |
| `getDonationSummary — groups by tax category`                 | Verify grouping logic                      |
| `getNetWorth — sums bank + stock totals`                      | Verify parallel queries and addition       |

#### File: `src/__tests__/services/chat/usage-logger.test.ts`

| Test                                            | Description                       |
| ----------------------------------------------- | --------------------------------- |
| `logChatUsage — creates session and usage log`  | Verify Prisma create calls        |
| `logChatUsage — skips logging when tokens is 0` | Verify early return               |
| `logChatUsage — does not throw on error`        | Verify console.error and no throw |

### 14.2 Integration Tests

#### File: `src/__tests__/api/chat.integration.test.ts`

| Test                                            | Description                    |
| ----------------------------------------------- | ------------------------------ |
| `POST /api/chat — returns 401 without session`  | Verify auth check              |
| `POST /api/chat — returns 400 without messages` | Verify input validation        |
| `POST /api/chat — returns streaming response`   | Mock AI SDK, verify SSE format |

### 14.3 E2E Tests

#### File: `e2e/assistant/chat.spec.ts`

| Test                                      | Description                                                |
| ----------------------------------------- | ---------------------------------------------------------- |
| `renders assistant page with empty state` | Navigate to /assistant, verify suggested questions visible |
| `sends a message and receives response`   | Type question, click send, verify response appears         |
| `suggested question populates input`      | Click suggested question chip, verify it submits           |

### 14.4 Mocking Strategy

```typescript
// Mock the AI SDK for unit tests
vi.mock('ai', () => ({
  streamText: vi.fn().mockReturnValue({
    toDataStreamResponse: () => new Response('data: test\n\n'),
  }),
  tool: vi.fn((config) => config),
}));

// Mock Prisma for tool query tests
vi.mock('@/server/db/client', () => ({
  prisma: {
    income: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    bankAssetSnapshot: { findFirst: vi.fn() },
    stockSnapshot: { findFirst: vi.fn() },
    zakat: { findMany: vi.fn() },
    donation: { findMany: vi.fn() },
    calendarYear: { findMany: vi.fn() },
  },
}));
```

---

## 15. Package Dependencies

### Existing (already installed — no changes):

| Package          | Version    | Used For                  |
| ---------------- | ---------- | ------------------------- |
| `ai`             | `^6.0.105` | `streamText()`, `tool()`  |
| `@ai-sdk/openai` | `^3.0.37`  | `createOpenAI()` provider |
| `zod`            | `^3.24.1`  | Tool parameter schemas    |

### New (needs installation):

| Package         | Purpose                                  |
| --------------- | ---------------------------------------- |
| `@ai-sdk/react` | `useChat()` hook for client-side chat UI |

```bash
pnpm add @ai-sdk/react
```

**Note:** Check if `@ai-sdk/react` is already installed as a transitive dependency of `ai`. If so, add it as an explicit dependency to avoid version drift.

---

## 16. File Change Summary

| File                                                             | Action                                        | Lines (est.) |
| ---------------------------------------------------------------- | --------------------------------------------- | ------------ |
| `src/app/api/chat/route.ts`                                      | **New**                                       | ~50          |
| `src/server/services/chat/chat-provider.ts`                      | **New**                                       | ~30          |
| `src/server/services/chat/system-prompt.ts`                      | **New**                                       | ~35          |
| `src/server/services/chat/tools.ts`                              | **New**                                       | ~350         |
| `src/server/services/chat/usage-logger.ts`                       | **New**                                       | ~45          |
| `src/app/(authorized)/assistant/page.tsx`                        | **New**                                       | ~25          |
| `src/app/(authorized)/assistant/_components/AssistantClient.tsx` | **New**                                       | ~80          |
| `src/app/(authorized)/assistant/_components/ChatMessage.tsx`     | **New**                                       | ~30          |
| `src/app/(authorized)/assistant/_components/ChatInput.tsx`       | **New**                                       | ~45          |
| `src/constants/ai-pricing.ts`                                    | **Modified** — add GPT-4o-mini pricing        | ~15          |
| `prisma/schema.prisma`                                           | **Modified** — add `CHAT` to `ImportTypeEnum` | ~1           |
| `.env-example`                                                   | **Modified** — add `AI_CHAT_MODEL`            | ~4           |
| SideNav / navigation component                                   | **Modified** — add AI Assistant link          | ~5           |
| `src/__tests__/services/chat/tools.test.ts`                      | **New**                                       | ~150         |
| `src/__tests__/services/chat/usage-logger.test.ts`               | **New**                                       | ~50          |
| `e2e/assistant/chat.spec.ts`                                     | **New**                                       | ~40          |

**Total new lines:** ~950  
**Total modified lines:** ~25  
**New Prisma migration:** 1 (add `CHAT` to enum)

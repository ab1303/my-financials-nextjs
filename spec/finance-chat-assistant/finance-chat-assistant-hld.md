# High Level Design: Personal Finance RAG Chat Assistant

> **Version**: 1.0
> **Date**: 2026-04-02
> **Status**: Draft
> **Depends on**: [AI Image Import PRD](../ai-image-import/ai-image-import-prd.md), [AI Usage Logging HLD](../ai-usage-logging/ai-usage-logging-hld.md)

---

## 1. Problem Statement

The application tracks rich financial data across 8+ domains (income, expenses, bank assets, stocks, zakat, donations, bank interest, entities). Users currently navigate to individual pages to view data one domain at a time — there is no unified way to ask cross-domain financial questions.

**Examples of questions users cannot easily answer today:**

| Question                                               | Current UX                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| "What did I spend on food in Q1 2026?"                 | Navigate to Expenses page → select calendar year → find correct months → manually sum                     |
| "How does my net worth today compare to 6 months ago?" | Navigate to Bank Assets → find two snapshots → compare manually. Then Stocks → repeat. Then mentally add. |
| "How much zakat have I paid vs. how much is due?"      | Navigate to Zakat page → find the calendar year → check amount due → scroll through payments → sum        |
| "What are my top 3 expense categories this year?"      | Expenses page does not offer a category ranking view                                                      |
| "Show my income sources breakdown for FY 2025–2026"    | Income page → mentally group entries by source type                                                       |

## 2. Proposed Solution: Agentic RAG Chat Assistant

A conversational AI assistant that answers natural-language questions about the user's own financial data using **Agentic RAG** — the LLM is given tools that query the Prisma database, and it decides which tools to call based on the user's question.

**Why Agentic RAG (tool-calling) instead of document-based RAG:**

| Approach                                                           | Fit for This App                                                                                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document RAG (embed docs → vector search → context)                | ❌ Financial data is structured in relational tables, not documents. Embedding bank balances or expense amounts provides no semantic value.                                                  |
| Agentic RAG (LLM calls tools → structured DB queries → synthesise) | ✅ The LLM formulates the question into precise tool calls (e.g., "get expenses for category=Food, months=1-3, year=2026"), receives structured data, and generates a human-readable answer. |

**Key Vercel AI SDK features used:**

- `streamText()` with `tools` parameter — LLM decides which tools to call
- `useChat()` React hook — client-side streaming chat UI
- `maxSteps` — allows multi-step tool-calling (LLM calls one tool, inspects results, calls another)

## 3. Goals

| #   | Goal                                                                                                                         | Audience |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| G1  | Users can ask natural-language questions about their financial data and receive accurate, grounded answers                   | User     |
| G2  | The assistant can query across all financial domains: income, expenses, bank assets, stocks, zakat, donations                | User     |
| G3  | Responses stream in real-time for a responsive conversational experience                                                     | User     |
| G4  | The assistant never fabricates financial numbers — all data comes from tool calls to the database                            | System   |
| G5  | All chat interactions are logged with token usage and cost tracking via the existing `AIUsageLog` infrastructure             | System   |
| G6  | User data isolation — the assistant only accesses data belonging to the authenticated user (server-side session enforcement) | Security |
| G7  | Reuse existing `AI_API_KEY` and `AI_PROVIDER` configuration — no new credentials required                                    | DevOps   |

## 4. Non-Goals (Out of Scope)

- **Conversation persistence**: v1 conversations are ephemeral (lost on page refresh). Persisting chat history to a database is a future enhancement.
- **File/image uploads in chat**: The assistant answers questions about existing data only. Importing new data is handled by the existing AI Import feature.
- **Financial advice / predictions**: The assistant reports facts from the database. It does not provide investment advice, tax advice, or future projections.
- **Multi-user / shared conversations**: Each conversation is private to the authenticated user.
- **Voice input**: Text-only interface in v1.
- **Custom fine-tuned model**: Uses standard GPT-4o-mini via the existing provider configuration.

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │          /assistant (new page)                               │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │              AssistantClient.tsx                        │  │   │
│  │  │              ("use client")                             │  │   │
│  │  │                                                        │  │   │
│  │  │  useChat({ api: '/api/chat' })                         │  │   │
│  │  │                                                        │  │   │
│  │  │  ┌──────────────────────┐  ┌─────────────────────┐    │  │   │
│  │  │  │   Message List       │  │   Input Form        │    │  │   │
│  │  │  │   (streaming)        │  │   (text input +     │    │  │   │
│  │  │  │                      │  │    send button)     │    │  │   │
│  │  │  │  User: "What did     │  │                     │    │  │   │
│  │  │  │  I spend on food?" │  │                     │    │  │   │
│  │  │  │                      │  │                     │    │  │   │
│  │  │  │  Assistant: "Based   │  │                     │    │  │   │
│  │  │  │  on your records..." │  │                     │    │  │   │
│  │  │  └──────────────────────┘  └─────────────────────┘    │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│                          │ POST /api/chat (streaming)               │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────────┐
│                   SERVER  │                                         │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              POST /api/chat (Route Handler)                 │   │
│  │                                                             │   │
│  │  1. auth() → verify session, extract userId                 │   │
│  │  2. Parse messages from request body                        │   │
│  │  3. streamText({                                            │   │
│  │       model: chatModel,                                     │   │
│  │       system: FINANCIAL_ASSISTANT_PROMPT,                   │   │
│  │       messages,                                             │   │
│  │       tools: { ... },  ← Database query tools               │   │
│  │       maxSteps: 5,     ← Allow multi-step reasoning         │   │
│  │     })                                                      │   │
│  │  4. Return streaming response                               │   │
│  └────────────┬────────────────────────────────────────────────┘   │
│               │ Tool calls                                          │
│               ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Financial Data Tools                       │   │
│  │                                                             │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │   │
│  │  │getIncomeSumm-│ │getExpenseBy  │ │getBankBalances   │    │   │
│  │  │ary           │ │Category      │ │                  │    │   │
│  │  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘    │   │
│  │         │                │                   │              │   │
│  │  ┌──────┴────┐ ┌────────┴──────┐ ┌──────────┴──────────┐   │   │
│  │  │getStock   │ │getZakatSumm- │ │getDonationSummary   │   │   │
│  │  │Holdings   │ │ary           │ │                     │   │   │
│  │  └──────┬────┘ └────────┬─────┘ └──────────┬──────────┘   │   │
│  │         │               │                   │              │   │
│  └─────────┼───────────────┼───────────────────┼──────────────┘   │
│            │               │                   │                   │
│            └───────────────┼───────────────────┘                   │
│                            ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Prisma (Database)                         │   │
│  │                                                             │   │
│  │  Income  Expense  BankAssetSnapshot  StockHolding           │   │
│  │  Zakat   Donation CalendarYear       ExpenseCategory        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               AIUsageLog (DB)                               │   │
│  │  Track chat token usage per conversation turn               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 6. Component Inventory

### 6.1 New API Route

| Route                       | Method | Purpose                                                                                                                                                               |
| --------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/api/chat/route.ts` | `POST` | Streaming chat endpoint using AI SDK `streamText()` with tools. Authenticates via `auth()`, injects `userId` into tool context. Returns `text/event-stream` response. |

**Why a Route Handler instead of tRPC?** The AI SDK `streamText()` returns a native streaming `Response` object. tRPC procedures return JSON — they don't support streaming responses natively. The `/api/chat` route handler is the AI SDK's recommended pattern.

### 6.2 New Server-Side Services

| Service              | File                                        | Purpose                                                                           |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| Financial Data Tools | `src/server/services/chat/tools.ts`         | Tool definitions with Zod parameter schemas + execute functions that query Prisma |
| Chat System Prompt   | `src/server/services/chat/system-prompt.ts` | Financial assistant system prompt with privacy guardrails                         |

### 6.3 New UI Components

| Component       | Type             | Location                                                         |
| --------------- | ---------------- | ---------------------------------------------------------------- |
| Assistant Page  | Server Component | `src/app/(authorized)/assistant/page.tsx`                        |
| AssistantClient | Client Component | `src/app/(authorized)/assistant/_components/AssistantClient.tsx` |
| ChatMessage     | Client Component | `src/app/(authorized)/assistant/_components/ChatMessage.tsx`     |
| ChatInput       | Client Component | `src/app/(authorized)/assistant/_components/ChatInput.tsx`       |

### 6.4 Modified Files

| File                           | Change                                     |
| ------------------------------ | ------------------------------------------ |
| `src/constants/ai-pricing.ts`  | Add GPT-4o-mini pricing constants for chat |
| `.env-example`                 | Add `AI_CHAT_MODEL` env var documentation  |
| SideNav / navigation component | Add "AI Assistant" link with icon          |

### 6.5 No Database Schema Changes

v1 uses ephemeral conversations — no new Prisma models. Chat token usage is logged to the existing `AIUsageLog` model. A lightweight `AIImportSession` record can be created per chat conversation for the required `sessionId` FK, or the schema can be extended to make `sessionId` optional on `AIUsageLog`. The LLD will specify the exact approach.

## 7. Financial Data Tools Design

The LLM is given a set of tools it can call to retrieve user financial data. Each tool:

- Has a Zod schema defining its parameters
- Accepts `userId` injected by the server (never from the client)
- Returns structured JSON the LLM can interpret

### 7.1 Tool Inventory

| Tool                  | Parameters                                             | Returns                                                  | Data Source                                          |
| --------------------- | ------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------- |
| `getIncomeSummary`    | `year?: number`, `source?: IncomeSourceEnum`           | Total income, breakdown by source and month              | `Income`, `IncomeEntry`                              |
| `getExpenseBreakdown` | `year?: number`, `month?: number`, `category?: string` | Total expenses, breakdown by category                    | `Expense`, `ExpenseEntry`, `ExpenseCategory`         |
| `getBankBalances`     | `snapshotDate?: string`, `bankName?: string`           | Current/historical bank account balances                 | `BankAssetSnapshot`, `BankAssetEntry`, `BankAccount` |
| `getStockHoldings`    | `snapshotDate?: string`, `ticker?: string`             | Stock portfolio holdings and valuations                  | `StockSnapshot`, `StockHolding`                      |
| `getZakatSummary`     | `year?: number`                                        | Zakat amount due, payments made, balance remaining       | `Zakat`, `ZakatPayment`                              |
| `getDonationSummary`  | `year?: number`, `taxCategory?: string`                | Donation totals, breakdown by recipient and tax category | `Donation`, `DonationPayment`                        |
| `getCalendarYears`    | `type?: CalendarYearType`                              | Available calendar year periods                          | `CalendarYear`                                       |
| `getNetWorth`         | `snapshotDate?: string`                                | Calculated: bank balances + stock value (aggregated)     | `BankAssetSnapshot`, `StockSnapshot`                 |

### 7.2 Tool Scoping (Security)

Every tool receives `userId` from the server-side session — not from the LLM or client. All Prisma queries include `WHERE userId = :userId`. This is identical to the pattern used in existing tRPC `protectedProcedure` handlers.

```
Client sends: { messages: [...] }
Server does:  auth() → session.user.id → tools.execute({ userId, ...params })
```

The LLM never sees the `userId`. It only sees the tool's parameter schema (year, month, category, etc.).

## 8. Chat Model Selection

| Aspect            | Decision                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Default model** | `gpt-4o-mini` — cheaper than GPT-4o, sufficient for structured data Q&A                                             |
| **Configuration** | `AI_CHAT_MODEL` env var (defaults to `gpt-4o-mini`)                                                                 |
| **Provider**      | Same `AI_PROVIDER` + `AI_API_KEY` as existing features                                                              |
| **maxSteps**      | `5` — allows the LLM to chain up to 5 tool calls per turn (e.g., first get income, then get expenses, then compare) |
| **Temperature**   | `0.3` — low creativity, high factual accuracy                                                                       |

### Cost Estimate

| Scenario                        | Tokens (~)             | Cost (GPT-4o-mini @ $0.15/$0.60 per 1M) |
| ------------------------------- | ---------------------- | --------------------------------------- |
| Simple question (1 tool call)   | ~1,500 in + ~500 out   | ~$0.0005                                |
| Complex question (3 tool calls) | ~4,000 in + ~1,000 out | ~$0.0012                                |
| 100 questions/month             | ~250K total            | ~$0.05                                  |

## 9. System Prompt Design

The system prompt establishes the assistant's role, capabilities, and constraints:

```
You are a personal finance assistant for the My Financials application.
You help users understand their financial data by querying their records.

CAPABILITIES:
- Query income, expenses, bank balances, stock holdings, zakat, and donations
- Compare data across time periods
- Calculate totals and breakdowns

CONSTRAINTS:
- Only report data returned by tool calls. Never fabricate numbers.
- If a tool returns no data, say "I couldn't find any records for that query."
- Do not provide financial advice, tax advice, or investment recommendations.
- Do not speculate about future financial performance.
- Format currency amounts clearly (e.g., "$1,234.56 AUD").
- When comparing periods, clearly label which period each figure belongs to.

PRIVACY:
- You are only accessing the current user's data. Never reference other users.
- Do not include sensitive identifiers in responses unless directly asked.
```

## 10. Data Flow

### 10.1 Chat Request Flow

```
User types: "What did I spend on food in the last 3 months?"
  → useChat() sends POST /api/chat with messages array
  → Server: auth() → session.user.id = "user123"
  → Server: streamText({
       model: gpt-4o-mini,
       system: FINANCIAL_ASSISTANT_PROMPT,
       messages: [...],
       tools: { getExpenseBreakdown, ... },
       maxSteps: 5,
     })
  → LLM decides: call getExpenseBreakdown({ category: "Food", month: [1,2,3] })
  → Tool executes: Prisma query with userId="user123", category="Food"
  → Tool returns: [{ month: 1, amount: 450.20 }, { month: 2, amount: 380.50 }, ...]
  → LLM synthesises: "In the last 3 months, you spent $1,234.70 on Food:
       - January: $450.20
       - February: $380.50
       - March: $404.00"
  → Response streams to client via SSE
  → useChat() updates messages state → UI renders
```

### 10.2 Multi-Step Tool Calling

```
User asks: "How does my net worth compare to 6 months ago?"
  → LLM Step 1: call getBankBalances({ snapshotDate: "2026-04-01" })
  → Result: { total: 45000 }
  → LLM Step 2: call getStockHoldings({ snapshotDate: "2026-04-01" })
  → Result: { totalValue: 12000 }
  → LLM Step 3: call getBankBalances({ snapshotDate: "2025-10-01" })
  → Result: { total: 38000 }
  → LLM Step 4: call getStockHoldings({ snapshotDate: "2025-10-01" })
  → Result: { totalValue: 9500 }
  → LLM synthesises: "Your net worth has grown from $47,500 to $57,000 (+$9,500 / +20%)
       Bank assets: $38,000 → $45,000
       Stocks: $9,500 → $12,000"
```

## 11. Risks & Mitigations

| Risk                                  | Impact                                   | Likelihood | Mitigation                                                                                                                |
| ------------------------------------- | ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| LLM fabricates financial numbers      | Users see incorrect data → loss of trust | Medium     | System prompt explicitly prohibits fabrication; all numbers come from tool results; low temperature (0.3)                 |
| LLM calls tools with wrong parameters | Empty or incorrect results               | Medium     | Zod schemas validate tool parameters; clear parameter descriptions in tool definitions                                    |
| High token usage from complex queries | Unexpected cost                          | Low        | `maxSteps: 5` cap; cost logging via `AIUsageLog`; future: usage caps per user                                             |
| Slow responses for multi-step queries | Poor UX                                  | Medium     | Streaming response shows partial results immediately; GPT-4o-mini is fast (~0.5s per step)                                |
| Data isolation breach                 | User sees another user's data            | Very Low   | `userId` injected server-side from `auth()` session — never from client or LLM. Same pattern as all existing tRPC routes. |
| Chat API abuse (excessive requests)   | Cost spike                               | Low        | Rate limiting via middleware (future); `AIUsageLog` enables monitoring                                                    |

## 12. Success Metrics

| Metric                          | Target                                      | Measurement                    |
| ------------------------------- | ------------------------------------------- | ------------------------------ |
| Answer accuracy                 | >90% of factual queries return correct data | Manual testing with known data |
| Response latency (simple query) | <3s end-to-end                              | Client-side timing             |
| Response latency (multi-step)   | <8s end-to-end                              | Client-side timing             |
| Chat cost per conversation      | <$0.005 avg                                 | `AIUsageLog` aggregation       |
| User engagement                 | >50% of active users try the assistant      | Page visit analytics           |

## 13. Implementation Phases

| Phase                          | Scope                                                                                                                           | Dependency |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Phase 1: API Route + Tools** | Create `/api/chat` route handler with `streamText()`, define all financial data tools with Prisma queries, system prompt        | None       |
| **Phase 2: Chat UI**           | Create `/assistant` page (Server Component), `AssistantClient` (Client Component with `useChat`), message rendering, input form | Phase 1    |
| **Phase 3: Navigation**        | Add "AI Assistant" link to sidebar/navigation                                                                                   | Phase 2    |
| **Phase 4: Usage Logging**     | Log chat token usage to `AIUsageLog` per conversation turn; add GPT-4o-mini pricing constants                                   | Phase 1    |
| **Phase 5: Polish**            | Loading states, error handling, empty states, suggested questions, mobile responsive                                            | Phase 2    |

## 14. Future Considerations

- **Conversation persistence**: Store chat messages in a `ChatConversation` / `ChatMessage` Prisma model so users can revisit past conversations.
- **Suggested questions**: Show quick-action chips like "What's my net worth?" or "Show expense breakdown" for new users.
- **Data visualization**: Render charts inline in chat responses when the assistant returns tabular data.
- **Export to report**: Allow users to export a chat conversation as a PDF financial summary.
- **Usage caps**: Set monthly token budgets per user based on their plan/role.
- **Additional tools**: Add tools for bank interest, calendar year management, and entity lookup as the data model grows.

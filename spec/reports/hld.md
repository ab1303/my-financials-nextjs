# Reports Domain — High-Level Design (HLD)

## Domain Overview
The **reports** domain provides cross-cutting analytical views that summarize financial data for external use, such as tax reporting and personal review. Reports aggregate and present data from core transactional models, offering users year-based breakdowns and summaries. This domain is read-only and does not mutate financial data.

## Architecture Decisions
1. **REST API for Reports**: Report endpoints use REST (not tRPC) to allow direct `fetch` from Client Components without tRPC setup overhead.
2. **URL-Based Year Selection**: Calendar year selection is encoded in the URL (`calendarYearId` param) for bookmarkability and browser navigation.
3. **Server-Side Aggregation**: All report summaries are computed server-side by grouping and aggregating `Transaction` rows at query time; no pre-aggregation or materialized views.
4. **Fiscal Year Awareness**: Reports support fiscal/annual calendar years, using the user's preferred fiscal year type for defaults.
5. **Auth Guarded**: All report routes require authentication via NextAuth v5 (JWT session strategy).

## Features in This Domain
| Feature         | Route                                      | Description                                      |
|----------------|--------------------------------------------|--------------------------------------------------|
| Income Summary  | /reports/income-summary                    | Tabular breakdown of income by month and source   |

## Planned Future Reports
| Feature                | Route                        | Description                         |
|------------------------|------------------------------|-------------------------------------|
| Expense Summary        | /reports/expense-summary      | Monthly/annual expense breakdown    |
| Donation/Zakat Summary | /reports/donation-summary    | Charitable giving, Zakat reporting  |

## Out of Scope
- Data mutation (reports are read-only)
- Export to CSV/PDF
- Year-over-year comparison
- Visual/chart-based reports

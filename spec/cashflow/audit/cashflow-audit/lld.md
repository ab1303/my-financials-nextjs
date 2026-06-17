# Cashflow Audit — Low Level Design

## Audit Taxonomy

| Identifier | Class |
|---|---|
| BUG | Functional data or workflow error |
| SSR | Server-Side Rendering boundary mismatch |
| A11Y | Accessibility violation |
| META | Metadata or title misconfiguration |
| DM | Dark mode styling regression |

## Coverage Table

| Route | Focus |
|---|---|
| `/cashflow/income` | Fiscal-year selection, inline CRUD |
| `/cashflow/donations` | Fiscal-year filter, inline CRUD |
| `/cashflow/expense` | Category modal, SSR, accessibility |
| `/cashflow/bank-interest` | Bank/year filtering, yearly cleansing flow |

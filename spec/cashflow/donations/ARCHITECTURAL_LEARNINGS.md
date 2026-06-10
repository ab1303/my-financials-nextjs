# Donations — Architectural Learnings

## Distribution Widget Patterns
- **Reusable UI Logic**: Use `DistributionWidget` to handle color-coded stacked bar and legend layout. 
- **Consumer Responsibility**: Widgets consuming `DistributionWidget` (e.g., `DonationBeneficiaryBreakdownWidget`) MUST map domain-specific data to the generic `DistributionItem` interface and manage interaction logic (click handlers, URL param updates).
- **ID-based Filtering**: Use database IDs (`beneficiaryId`) rather than display names (`beneficiaryName`) for URL filters. This ensures robustness against special characters, spaces, and encoding issues in URLs.

## URL-as-State Pattern (Donations)
- **Single Source of Truth**: Treat URL `searchParams` as the definitive state for filters.
- **Server-Side Rendering**: 
    - Always initiate data fetching in parallel (`Promise.all`) using the filtered criteria directly from the server component.
    - Pass filters (`beneficiaryId`, `calendarYearId`) as props to the server-rendered table component.
- **Interactive State Updates**: In client-side filter widgets, use `router.replace` with `URLSearchParams` to update the URL without triggering a full page reload, allowing Next.js to stream the new filtered data seamlessly.
- **Reset Logic**: Implement an explicit "Reset" state that deletes the specific filter parameter from `URLSearchParams` to revert to the unfiltered view.

## Data Flow & Service Layer
- **Aggregation Strategy**: Perform summary calculations (totals, breakdowns) server-side (`donation.service.ts`) and return minimal, ready-to-render DTOs.
- **Handling Polymorphism**: The `DonationPaymentModel` unifies purpose-scoped persistence models (`VoluntaryDonation`, `ZakatPayment`, `InterestCleansing`). Service handlers (e.g., `getDonationPayments`) must handle this abstraction, ensuring consistent DTO shapes across purpose boundaries.
- **Transactional Consistency**: When creating/updating, use `prisma.$transaction` across the purpose-specific tables, ensuring the unified ledger remains in sync with the underlying evidence/transaction records.

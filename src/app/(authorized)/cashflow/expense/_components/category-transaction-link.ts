export function buildCategoryTransactionHref(categoryName: string, month: number, year: number = new Date().getFullYear()) {
  return `/cashflow/transactions?category=${encodeURIComponent(categoryName.toLowerCase())}&month=${month}&year=${year}`;
}

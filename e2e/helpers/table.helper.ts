import { Page, Locator } from '@playwright/test';

export async function findTableCell(
  page: Page,
  rowIndex: number,
  cellContent: string,
) {
  const rows = page.locator('tbody tr, [role="row"]');
  const row = rows.nth(rowIndex);
  const cell = row.locator(`text=${cellContent}`);
  return cell;
}

export async function getTableRowCount(page: Page): Promise<number> {
  const rows = page.locator('tbody tr, [role="row"]');
  return rows.count();
}

export async function clickActionButton(
  page: Page,
  rowIndex: number,
  actionType: 'edit' | 'delete',
) {
  const rows = page.locator('tbody tr, [role="row"]');
  const row = rows.nth(rowIndex);

  let button: Locator;
  if (actionType === 'edit') {
    button = row
      .locator('button[aria-label*="Edit"], button:has-text("✏")')
      .first();
  } else {
    button = row
      .locator('button[aria-label*="Delete"], button:has-text("🗑")')
      .first();
  }

  if (await button.isVisible()) {
    await button.click();
  }
}

export async function searchTable(page: Page, searchTerm: string) {
  const searchInput = page.locator('input[placeholder*="earch"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill(searchTerm);
    await page.waitForLoadState('networkidle');
  }
}

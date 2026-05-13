import { prisma } from '@/server/db/client';
import type { BankAssetExtractionResult } from './_types';

export interface BankAssetMapResult {
  success: boolean;
  entriesCreated: number;
  snapshotId: string | null;
  confidence: number;
  warnings: string[];
  errors: string[];
}

/**
 * Bank Asset Mapper Service
 * Converts AI vision output (bank account names + balances) into
 * BankAssetSnapshot + BankAssetEntry database records.
 *
 * Matching strategy:
 *  1. Exact match on account name (case-insensitive) within user's accounts
 *  2. Fuzzy/substring match (e.g. "CommBank Savings" → "Savings" in CommBank)
 *  3. If the AI detected a bankName, scope matching to accounts within that bank first
 *  4. Unmatched entries are SKIPPED with a warning (no silent "Other" fallback for finances)
 */

/**
 * Compute Levenshtein distance — reused from category-matcher logic
 */
function levenshteinDistance(a: string, b: string): number {
  const aL = a.toLowerCase();
  const bL = b.toLowerCase();
  if (aL === bL) return 0;
  const previousRow = Array.from({ length: bL.length + 1 }, (_, i) => i);
  for (let i = 0; i < aL.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < bL.length; j++) {
      currentRow.push(
        Math.min(
          previousRow[j + 1]! + 1,
          currentRow[j]! + 1,
          previousRow[j]! + (aL[i] !== bL[j] ? 1 : 0),
        ),
      );
    }
    previousRow.splice(0, previousRow.length, ...currentRow);
  }
  return previousRow[bL.length]!;
}

function bestMatchAccount(
  extractedName: string,
  accounts: Array<{
    id: string;
    name: string;
    bankId: string;
    bankName: string;
  }>,
): { id: string; name: string; bankId: string } | null {
  const normalized = extractedName.toLowerCase().trim();

  // Strategy 1: exact match
  const exact = accounts.find((a) => a.name.toLowerCase() === normalized);
  if (exact) return exact;

  // Strategy 2: substring match
  const sub = accounts.find(
    (a) =>
      normalized.includes(a.name.toLowerCase()) ||
      a.name.toLowerCase().includes(normalized),
  );
  if (sub) return sub;

  // Strategy 3: fuzzy similarity (≥ 0.7 threshold)
  let best: (typeof accounts)[0] | null = null;
  let bestScore = 0;
  for (const account of accounts) {
    const score =
      1 -
      levenshteinDistance(normalized, account.name.toLowerCase()) /
        Math.max(normalized.length, account.name.length);
    if (score > bestScore && score >= 0.7) {
      bestScore = score;
      best = account;
    }
  }
  return best;
}

export async function mapBankAssetData(
  extractionResult: BankAssetExtractionResult,
  snapshotDate: Date,
  userId: string,
  importImageId?: string,
): Promise<BankAssetMapResult> {
  const warnings = [...extractionResult.warnings];
  const errors: string[] = [];

  // Load all user bank accounts with their bank name
  const userAccounts = await prisma.bankAccount.findMany({
    where: { userId },
    include: {
      bank: { select: { id: true, name: true } },
    },
  });

  const flatAccounts = userAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    bankId: a.bankId,
    bankName: a.bank.name,
  }));

  // If AI detected a bankName, try to scope within that bank first
  let scopedAccounts = flatAccounts;
  if (extractionResult.bankName) {
    const bankNameNorm = extractionResult.bankName.toLowerCase();
    const bankScoped = flatAccounts.filter(
      (a) =>
        a.bankName.toLowerCase().includes(bankNameNorm) ||
        bankNameNorm.includes(a.bankName.toLowerCase()),
    );
    if (bankScoped.length > 0) {
      scopedAccounts = bankScoped;
      warnings.push(`Matched entries to bank: "${extractionResult.bankName}"`);
    } else {
      warnings.push(
        `AI detected bank "${extractionResult.bankName}" but no matching bank found in your accounts — searching all accounts.`,
      );
    }
  }

  // Map each extracted entry to a user account
  const mappedEntries: Array<{ accountId: string; balance: number }> = [];

  for (const entry of extractionResult.entries) {
    if (entry.balance <= 0) {
      warnings.push(
        `Skipped "${entry.accountName}" — balance must be positive (got ${entry.balance})`,
      );
      continue;
    }

    const matched = bestMatchAccount(entry.accountName, scopedAccounts);

    if (!matched) {
      errors.push(
        `Could not match account "${entry.accountName}" to any of your bank accounts. ` +
          `Please add it manually or rename an existing account.`,
      );
      continue;
    }

    // Check for duplicate account in this batch
    if (mappedEntries.some((e) => e.accountId === matched.id)) {
      warnings.push(
        `Duplicate match for account "${matched.name}" — keeping first occurrence, skipping "${entry.accountName}"`,
      );
      continue;
    }

    mappedEntries.push({
      accountId: matched.id,
      balance: entry.balance,
    });
  }

  if (mappedEntries.length === 0) {
    return {
      success: false,
      entriesCreated: 0,
      snapshotId: null,
      confidence: extractionResult.confidence,
      warnings,
      errors:
        errors.length > 0
          ? errors
          : ['No entries could be matched to your accounts'],
    };
  }

  // Create or find snapshot for this date + user
  // If a snapshot already exists for the same date, upsert entries into it
  const existingSnapshot = await prisma.bankBalanceSnapshot.findFirst({
    where: {
      userId,
      snapshotDate: {
        gte: new Date(snapshotDate.toDateString()), // same calendar day
        lt: new Date(
          new Date(snapshotDate.toDateString()).getTime() + 86400000,
        ),
      },
    },
  });

  let snapshotId: string;

  if (existingSnapshot) {
    snapshotId = existingSnapshot.id;
    warnings.push(
      `A snapshot already exists for ${snapshotDate.toDateString()} — adding entries to it.`,
    );
  } else {
    const snapshot = await prisma.bankBalanceSnapshot.create({
      data: { snapshotDate, userId },
    });
    snapshotId = snapshot.id;
  }

  // Upsert each entry (update balance if account already in snapshot)
  let entriesCreated = 0;
  for (const entry of mappedEntries) {
    await prisma.bankBalanceRecord.upsert({
      where: {
        accountId_snapshotId: {
          accountId: entry.accountId,
          snapshotId,
        },
      },
      update: {
        balance: entry.balance,
        importImageId: importImageId ?? null,
      },
      create: {
        accountId: entry.accountId,
        snapshotId,
        balance: entry.balance,
        importImageId: importImageId ?? null,
      },
    });
    entriesCreated++;
  }

  return {
    success: errors.length === 0,
    entriesCreated,
    snapshotId,
    confidence: extractionResult.confidence,
    warnings,
    errors,
  };
}

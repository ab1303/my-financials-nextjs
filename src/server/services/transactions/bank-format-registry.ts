import type { BankCsvFormat } from './csv-format.types';

/**
 * Hardcoded registry of known Australian bank CSV formats.
 *
 * Phase 1 — full support: CommBank, NAB
 * Stubs (structure known but not yet tested): ANZ, Westpac
 *
 * Lookup is case-insensitive and normalised (whitespace removed).
 */
export const BANK_FORMAT_REGISTRY: Record<string, BankCsvFormat> = {
  /**
   * Commonwealth Bank (CBA) — headerless web export.
   *
   * Sample row:
   *   31/07/2025,"-90.72","WOOLWORTHS 1294 HORNSBY","+18811.43"
   *
   * Columns (positional, 0-based):
   *   0: Date (DD/MM/YYYY)
   *   1: Amount  (signed: negative = debit, positive = credit; may be quoted)
   *   2: Description (quoted, may contain commas)
   *   3: Balance
   */
  commbank: {
    bankKey: 'commbank',
    hasHeaders: false,
    columns: {
      date: 0,
      amount: { kind: 'signed', column: 1 },
      description: 2,
      balance: 3,
    },
    dateFormat: 'DD/MM/YYYY',
  },

  /**
   * National Australia Bank (NAB) — header row, split debit/credit columns.
   *
   * Sample:
   *   Date,Narrative,Debit,Credit,Balance
   *   01/07/2024,SALARY DEPOSIT,0.00,5000.00,15000.00
   */
  nab: {
    bankKey: 'nab',
    hasHeaders: true,
    columns: {
      date: 'Date',
      description: 'Narrative',
      amount: { kind: 'split', debit: 'Debit', credit: 'Credit' },
      balance: 'Balance',
    },
    dateFormat: 'DD/MM/YYYY',
  },

  /**
   * ANZ — STUB, pending validation against real export.
   * Expected: header row, single signed Amount column.
   */
  anz: {
    bankKey: 'anz',
    hasHeaders: true,
    columns: {
      date: 'Transaction Date',
      description: 'Description',
      amount: { kind: 'signed', column: 'Amount' },
    },
    dateFormat: 'DD/MM/YYYY',
  },

  /**
   * Westpac — STUB, pending validation against real export.
   * Expected: header row, split debit/credit columns.
   */
  westpac: {
    bankKey: 'westpac',
    hasHeaders: true,
    columns: {
      date: 'Date',
      description: 'Description',
      amount: { kind: 'split', debit: 'Debit', credit: 'Credit' },
    },
    dateFormat: 'DD/MM/YYYY',
  },
};

/**
 * Canonical bank name aliases → registry key mapping.
 * Used to normalise bank.name from the DB to a registry key.
 *
 * e.g. "Commonwealth Bank of Australia" → 'commbank'
 */
const BANK_NAME_ALIASES: Record<string, string> = {
  commbank: 'commbank',
  commonwealthbank: 'commbank',
  cba: 'commbank',
  commonwealthbankofaustralia: 'commbank',
  nab: 'nab',
  nationalaustraliabank: 'nab',
  anz: 'anz',
  australiaandnewzealandbank: 'anz',
  australiaandnewzealandbankinggroup: 'anz',
  westpac: 'westpac',
  westpacbankingcorporation: 'westpac',
};

/**
 * Normalise a bank name string to a registry key.
 * 
 * Steps:
 * 1. Remove parenthetical descriptors: "(CommBank)" → ""
 * 2. Remove em-dashes and extra descriptors after them: "— Complete Access - 9870" → ""
 * 3. Lowercase and keep only alphanumerics
 * 
 * Examples:
 * - "Commonwealth Bank (CommBank)" → "commonwealthbank"
 * - "Commonwealth Bank (CommBank) — Complete Access - 9870" → "commonwealthbank"
 * - "National Australia Bank" → "nationalaustraliabank"
 */
function normaliseBankName(bankName: string): string {
  // Step 1: Remove parenthetical content (e.g., "(CommBank)")
  let cleaned = bankName.replace(/\([^)]*\)/g, '');
  
  // Step 2: Remove everything after em-dash or similar descriptors
  // This handles "— Complete Access - 9870" or similar account/product descriptors
  cleaned = cleaned.replace(/[—–-].*$/g, '');
  
  // Step 3: Lowercase and keep only alphanumeric
  return cleaned.toLowerCase().replace(/[^\da-z]/g, '').trim();
}

/**
 * Look up a BankCsvFormat by bank name (as stored in the DB).
 * Returns undefined if the bank is not in the registry.
 */
export function getBankFormatByName(
  bankName: string,
): BankCsvFormat | undefined {
  const key = BANK_NAME_ALIASES[normaliseBankName(bankName)];
  return key ? BANK_FORMAT_REGISTRY[key] : undefined;
}

/**
 * Look up a BankCsvFormat by registry key (e.g. 'commbank').
 */
export function getBankFormat(bankKey: string): BankCsvFormat | undefined {
  return BANK_FORMAT_REGISTRY[bankKey.toLowerCase()];
}

/**
 * Returns the list of bank keys that are fully supported (have real test coverage).
 */
export function getFullySupportedBankKeys(): string[] {
  return ['commbank', 'nab'];
}

/**
 * Human-readable list of supported bank names for error messages.
 */
export function getSupportedBankNamesText(): string {
  return 'Commonwealth Bank (CommBank), National Australia Bank (NAB)';
}

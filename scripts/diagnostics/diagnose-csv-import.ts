#!/usr/bin/env node
/*
 Diagnostic script for CSV import parsing and dedup key analysis.
 Usage: node ./scripts/diagnostics/diagnose-csv-import.ts /path/to/file.csv

This script is read-only and does not touch the database.
It prints debug logs at key steps and writes a JSON report `diagnose-csv-report.json`.
*/

import fs from 'fs';
import path from 'path';

type TxType = 'DEBIT' | 'CREDIT';

interface CsvTransaction {
  id: string;
  date: string;
  amount: number;
  type: TxType;
  description: string;
  month: number;
  year: number;
  balance?: number;
}

function debug(msg: string, meta?: Record<string, any>) {
  const prefix = '[DEBUG]';
  if (meta) {
    console.log(`${prefix} ${msg}`, JSON.stringify(meta));
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function makeDedupKey(params: {
  date: string;
  description: string;
  amount: number;
  type: TxType;
  runningBalance?: number | null;
}): string {
  const dateStr = params.date.slice(0, 10);
  const desc = params.description.trim().toLowerCase();
  const amount = params.amount.toFixed(2);
  const type = params.type;
  const balance =
    params.runningBalance != null
      ? `|${Number(params.runningBalance).toFixed(2)}`
      : '';
  return `${dateStr}|${desc}|${amount}|${type}${balance}`;
}

function detectFormat(
  firstDataLine: string,
  hasHeaderGuess: boolean,
): 'commbank' | 'nab' {
  // Very small heuristic: NAB exports include a header with 'Date' or 'Debit'/'Credit'
  const lower = firstDataLine.toLowerCase();
  if (
    hasHeaderGuess &&
    lower.includes('date') &&
    (lower.includes('debit') ||
      lower.includes('credit') ||
      lower.includes('narrative'))
  )
    return 'nab';
  // Otherwise assume CommBank (headerless signed amount)
  return 'commbank';
}

function parseCommBankRow(values: string[]): CsvTransaction | null {
  // Expected: [date, amount, description, balance?]
  const dateStr = values[0] ?? '';
  const rawAmt = (values[1] ?? '').replace(/"/g, '').trim();
  const description = (values[2] ?? '').trim();
  const balanceStr = values[3] ?? '';

  if (!dateStr) throw new Error('Missing date');
  const amtNum = parseFloat(rawAmt);
  if (isNaN(amtNum)) throw new Error(`Invalid amount: ${rawAmt}`);
  const amount = Math.abs(amtNum);
  const type: TxType = amtNum < 0 ? 'DEBIT' : 'CREDIT';
  if (amount === 0) return null;
  const balance = balanceStr ? Number(balanceStr) : undefined;
  const parts = dateStr.split('/').map(Number);
  if (parts.length < 3 || parts.some((n) => isNaN(n))) {
    throw new Error(`Invalid date components: ${dateStr}`);
  }
  const [d, m, y] = parts;
  const month = m as number;
  const year = y as number;
  return {
    id: `${dateStr}-${rawAmt}-${description.slice(0, 10)}`,
    date: dateStr,
    amount,
    type,
    description,
    month,
    year,
    balance,
  };
}

function parseNabRow(
  headers: string[],
  values: string[],
): CsvTransaction | null {
  // Expected header names: Date,Narrative,Debit,Credit,Balance
  const map: Record<string, string> = {};
  headers.forEach((h, i) => (map[h.toLowerCase()] = values[i] ?? ''));
  const dateStr = map['date'] ?? map['transaction date'] ?? '';
  const description = map['narrative'] ?? map['description'] ?? '';
  const debitRaw = (map['debit'] ?? '').trim();
  const creditRaw = (map['credit'] ?? '').trim();
  const debit = debitRaw ? parseFloat(debitRaw) : 0;
  const credit = creditRaw ? parseFloat(creditRaw) : 0;
  const amount = debit > 0 ? debit : credit;
  const type: TxType = debit > 0 ? 'DEBIT' : 'CREDIT';
  if (!dateStr) throw new Error('Missing date');
  if (isNaN(amount) || amount === 0) return null;
  const parts = dateStr.split('/').map(Number);
  if (parts.length < 3 || parts.some((n) => isNaN(n))) {
    throw new Error(`Invalid date components: ${dateStr}`);
  }
  const [d, m, y] = parts;
  return {
    id: `${dateStr}-${amount}-${description.slice(0, 10)}`,
    date: dateStr,
    amount,
    type,
    description: description.trim(),
    month: m as number,
    year: y as number,
  };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      'Usage: node scripts/diagnostics/diagnose-csv-import.ts /path/to/file.csv',
    );
    process.exit(1);
  }

  const filePath = path.resolve(arg);
  debug('parse:start', { filePath });

  const content = fs.readFileSync(filePath, 'utf8');
  const rawLines = content.split('\n').map((l) => l.replace(/\r$/, ''));
  debug('file:lines', { totalLines: rawLines.length });

  // Heuristic: detect header by checking first non-empty line for words like 'Date' and 'Narrative'
  const firstNonEmpty = rawLines.find((l) => l.trim().length > 0) ?? '';
  const firstVals = parseCsvLine(firstNonEmpty);
  const hasHeaderGuess = firstVals.some((v) =>
    /date|narrative|debit|credit/i.test(v),
  );
  const format = detectFormat(firstNonEmpty, hasHeaderGuess);
  debug('format:detected', { format, hasHeaderGuess });

  // Build headers if NAB
  let headers: string[] = [];
  let dataStart = 0;
  if (format === 'nab' && hasHeaderGuess) {
    headers = parseCsvLine(firstNonEmpty).map((h) => h.trim());
    dataStart = rawLines.indexOf(firstNonEmpty) + 1;
  } else {
    dataStart = 0; // CommBank: headerless
  }

  const parsed: CsvTransaction[] = [];
  let skipped = 0;
  const errors: { line: number; error: string }[] = [];

  for (let i = dataStart; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line || !line.trim()) continue;
    try {
      const vals = parseCsvLine(line);
      let tx: CsvTransaction | null = null;
      if (format === 'commbank') tx = parseCommBankRow(vals);
      else tx = parseNabRow(headers, vals);
      if (tx) parsed.push(tx);
      else skipped++;
    } catch (err: any) {
      errors.push({ line: i + 1, error: err?.message ?? String(err) });
    }
  }

  debug('parse:finished', {
    parsed: parsed.length,
    skipped,
    errors: errors.length,
  });
  if (errors.length > 0) {
    console.log('\nSample errors:');
    console.log(errors.slice(0, 10));
  }

  const byType = parsed.reduce(
    (acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const byMonth = new Map<string, number>();
  for (const tx of parsed) {
    const key = `${tx.year}-${String(tx.month).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  // Dedup key analysis (within-file duplicates)
  const keyCounts = new Map<string, number>();
  for (const tx of parsed) {
    const key = makeDedupKey({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      runningBalance: tx.balance ?? null,
    });
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  const duplicatesInFile = [...keyCounts.entries()].filter(([, c]) => c > 1);

  debug('dedup:stats', {
    uniqueKeys: keyCounts.size,
    duplicatesInFile: duplicatesInFile.length,
  });

  // Flagged transfer heuristic (simple): description includes 'TRANSFER' or 'TFR' or 'TRANSF'
  const flagged = parsed.filter((tx) =>
    /transfer|tfr|tfrm|destbank|bpay/i.test(tx.description),
  );
  debug('heuristic:flaggedTransfers', { flaggedCount: flagged.length });

  const report = {
    filePath,
    totalLines: rawLines.length,
    parsedCount: parsed.length,
    skippedCount: skipped,
    byType,
    byMonth: Object.fromEntries([...byMonth.entries()].sort()),
    withinFileDuplicateKeys: duplicatesInFile
      .slice(0, 20)
      .map(([k, c]) => ({ key: k, count: c })),
    flaggedSample: flagged.slice(0, 20).map((t) => ({
      date: t.date,
      amount: t.amount,
      description: t.description,
    })),
    errors: errors.slice(0, 20),
    debugLogs: [
      'parse:start',
      'file:lines',
      'format:detected',
      'parse:finished',
      'dedup:stats',
      'heuristic:flaggedTransfers',
    ],
  } as const;

  const outPath = path.resolve(process.cwd(), 'diagnose-csv-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\nReport written to', outPath);
  console.log('Summary:');
  console.log(`  parsed: ${report.parsedCount}`);
  console.log(`  skipped (zero/invalid): ${report.skippedCount}`);
  console.log(`  byType: ${JSON.stringify(report.byType)}`);
  console.log('  byMonth:', report.byMonth);
  console.log(`  within-file duplicate key groups: ${duplicatesInFile.length}`);
  console.log(`  heuristic flagged transfers: ${flagged.length}`);
  console.log('\nSample flagged:');
  console.table(report.flaggedSample.slice(0, 10));
  process.exit(0);
}

void main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(2);
});

#!/usr/bin/env ts-node
/*
  Backfill script: move data from DonationPayment + DonationPaymentEvidence
  into purpose-specific tables: VoluntaryDonation, InterestCleansing, ZakatPayment + evidence tables.

  Features:
  - Dry-run mode (`--dry-run`) logs SQL that would be run.
  - Batching (`--batch-size`) with offset pagination to avoid long transactions.
  - Writes a row to `MigrationAudit` per legacy row processed for resumability.
  - Idempotent: uses INSERT ... ON CONFLICT DO UPDATE keyed by legacy id.

  Usage:
    pnpm tsx scripts/backfill-donationpayment.ts --batch-size=200 --dry-run
    pnpm tsx scripts/backfill-donationpayment.ts --batch-size=200

*/

import { PrismaClient } from '@prisma/client';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('batch-size', { type: 'number', default: 200 })
  .option('limit', { type: 'number' })
  .option('dry-run', { type: 'boolean', default: false })
  .option('offset', { type: 'number', default: 0 })
  .help(false)
  .parseSync();

const prisma = new PrismaClient();

async function logAudit(
  legacyTable: string,
  legacyId: string,
  newTable: string,
  newId: string | null,
  status: string,
  note?: string,
) {
  const now = new Date();
  const q = `INSERT INTO "MigrationAudit" (id, legacyTable, legacyId, newTable, newId, status, note, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (legacyTable, legacyId) DO UPDATE SET newId = EXCLUDED.newId, status = EXCLUDED.status, note = EXCLUDED.note, "updatedAt" = EXCLUDED."updatedAt"`;
  const params = [
    legacyTable + '-' + legacyId,
    legacyTable,
    legacyId,
    newTable,
    newId,
    status,
    note || null,
    now.toISOString(),
    now.toISOString(),
  ];
  if (argv['dry-run']) {
    console.log('[dry-run] AUDIT INSERT:', q, params);
    return;
  }
  await prisma.$executeRawUnsafe(q, ...params);
}

async function processBatch(offset: number, batchSize: number) {
  // Select donation payments and aggregate evidence rows
  const payments: any[] = await prisma.$queryRawUnsafe(`
    SELECT dp.*, COALESCE(json_agg(json_build_object('id', e.id, 'evidenceTransactionId', e.evidenceTransactionId, 'amountApplied', e.amountApplied, 'confidence', e.confidence)) FILTER (WHERE e.id IS NOT NULL), '[]') AS evidence
    FROM "DonationPayment" dp
    LEFT JOIN "DonationPaymentEvidence" e ON e.donationPaymentId = dp.id
    GROUP BY dp.id
    ORDER BY dp.datePaid, dp.id
    LIMIT ${batchSize} OFFSET ${offset}
  `);

  if (!payments.length) return 0;

  for (const p of payments) {
    try {
      const evidence = JSON.parse((p.evidence as string) || '[]');
      if (p.donationPurpose === 'INTEREST_CLEANSING') {
        const upsertCleansing = `
          INSERT INTO "InterestCleansing" (id, "datePaid", amount, "sourceBusinessId", "donationLedgerId", "creditTxId", "createdAt", "updatedAt")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, "datePaid" = EXCLUDED."datePaid", "updatedAt" = EXCLUDED."updatedAt"`;
        const params = [
          p.id,
          p.datePaid,
          p.amount,
          p.businessId,
          p.donationLedgerId,
          p.interestTxId || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ];
        if (argv['dry-run'])
          console.log('[dry-run] SQL:', upsertCleansing, params);
        else await prisma.$executeRawUnsafe(upsertCleansing, ...params);

        for (const e of evidence) {
          const q = `INSERT INTO "InterestCleansingEvidence" (id, "interestCleansingId", "transactionId", "amountLinked", confidence, "createdAt") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("interestCleansingId","transactionId") DO UPDATE SET "amountLinked" = EXCLUDED."amountLinked", confidence = EXCLUDED.confidence`;
          const qp = [
            e.id || p.id + '-e-' + e.evidenceTransactionId,
            p.id,
            e.evidenceTransactionId,
            e.amountApplied || null,
            e.confidence || 0,
            new Date().toISOString(),
          ];
          if (argv['dry-run']) console.log('[dry-run] SQL:', q, qp);
          else await prisma.$executeRawUnsafe(q, ...qp);
        }

        await logAudit(
          'DonationPayment',
          p.id,
          'InterestCleansing',
          p.id,
          'DONE',
          'Backfilled as InterestCleansing',
        );
      } else if (p.donationPurpose === 'ZAKAT') {
        // Map donationLedgerId -> zakatObligationId where possible (best-effort)
        const zakatObligationId = p.donationLedgerId; // best effort: keep same id if matching; otherwise null
        const upsertZakat = `INSERT INTO "ZakatPayment" (id, "datePaid", amount, "beneficiaryType", "businessId", "individualId", "zakatObligationId", "transactionId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, "datePaid" = EXCLUDED."datePaid", "updatedAt" = EXCLUDED."updatedAt"`;
        const params = [
          p.id,
          p.datePaid,
          p.amount,
          p.beneficiaryType,
          p.businessId || null,
          p.individualId || null,
          zakatObligationId || null,
          p.interestTxId || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ];
        if (argv['dry-run']) console.log('[dry-run] SQL:', upsertZakat, params);
        else await prisma.$executeRawUnsafe(upsertZakat, ...params);

        for (const e of evidence) {
          const q = `INSERT INTO "ZakatEvidence" (id, "zakatPaymentId", "transactionId", "amountLinked", confidence, "createdAt") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("zakatPaymentId","transactionId") DO UPDATE SET "amountLinked" = EXCLUDED."amountLinked", confidence = EXCLUDED.confidence`;
          const qp = [
            e.id || p.id + '-e-' + e.evidenceTransactionId,
            p.id,
            e.evidenceTransactionId,
            e.amountApplied || null,
            e.confidence || 0,
            new Date().toISOString(),
          ];
          if (argv['dry-run']) console.log('[dry-run] SQL:', q, qp);
          else await prisma.$executeRawUnsafe(q, ...qp);
        }

        await logAudit(
          'DonationPayment',
          p.id,
          'ZakatPayment',
          p.id,
          'DONE',
          'Backfilled as ZakatPayment',
        );
      } else {
        // VOLUNTARY
        const upsertVoluntary = `INSERT INTO "VoluntaryDonation" (id, "datePaid", amount, "beneficiaryType", "businessId", "individualId", "donationLedgerId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, "datePaid" = EXCLUDED."datePaid", "updatedAt" = EXCLUDED."updatedAt"`;
        const params = [
          p.id,
          p.datePaid,
          p.amount,
          p.beneficiaryType,
          p.businessId || null,
          p.individualId || null,
          p.donationLedgerId,
          new Date().toISOString(),
          new Date().toISOString(),
        ];
        if (argv['dry-run'])
          console.log('[dry-run] SQL:', upsertVoluntary, params);
        else await prisma.$executeRawUnsafe(upsertVoluntary, ...params);

        for (const e of evidence) {
          const q = `INSERT INTO "VoluntaryDonationEvidence" (id, "voluntaryDonationId", "transactionId", "amountLinked", confidence, "createdAt") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("voluntaryDonationId","transactionId") DO UPDATE SET "amountLinked" = EXCLUDED."amountLinked", confidence = EXCLUDED.confidence`;
          const qp = [
            e.id || p.id + '-e-' + e.evidenceTransactionId,
            p.id,
            e.evidenceTransactionId,
            e.amountApplied || null,
            e.confidence || 0,
            new Date().toISOString(),
          ];
          if (argv['dry-run']) console.log('[dry-run] SQL:', q, qp);
          else await prisma.$executeRawUnsafe(q, ...qp);
        }

        await logAudit(
          'DonationPayment',
          p.id,
          'VoluntaryDonation',
          p.id,
          'DONE',
          'Backfilled as VoluntaryDonation',
        );
      }
    } catch (err: any) {
      console.error('Error processing donation', p.id, err?.message || err);
      await logAudit(
        'DonationPayment',
        p.id,
        '',
        null,
        'FAILED',
        (err && err.message) || String(err),
      );
    }
  }

  return payments.length;
}

async function main() {
  try {
    const batchSize = Number(argv['batch-size'] || 200);
    const limit = argv['limit'] ? Number(argv['limit']) : undefined;
    let offset = Number(argv['offset'] || 0);
    let processed = 0;
    while (true) {
      if (limit && processed >= limit) break;
      const toProcess = limit
        ? Math.min(batchSize, limit - processed)
        : batchSize;
      const got = await processBatch(offset, toProcess);
      if (!got) break;
      processed += got;
      offset += got;
      console.log(`Processed ${processed} rows (offset now ${offset})`);
      if (got < toProcess) break;
    }
    console.log('Backfill complete. Total processed:', processed);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

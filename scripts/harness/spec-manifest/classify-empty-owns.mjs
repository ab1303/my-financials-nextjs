#!/usr/bin/env node
// Phase 0 discovery for the empty-owns backfill plan.
// Reads spec/index.json, finds every feature with all-empty owns, and
// classifies each into a candidate bucket based on signals from lld.md/context.md.
//
// Output: spec/index.backfill-plan.md (a worksheet for human/orchestrator review).
// This script is read-only relative to spec/index.json — it never writes the manifest.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INDEX = path.join(ROOT, 'spec', 'index.json');
const OUTPUT = path.join(ROOT, 'spec', 'index.backfill-plan.md');

const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const empty = idx.features.filter((f) =>
  ['routers', 'services', 'components', 'app', 'tests'].every((k) => !(f.owns?.[k]?.length))
);

function readIfExists(p) {
  if (!p) return '';
  const abs = path.join(ROOT, p);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
}

function signals(feature) {
  const lld = readIfExists(feature.docs?.lld);
  const ctx = readIfExists(feature.docs?.context);
  const body = lld + '\n' + ctx;
  const lines = lld.split(/\r?\n/);

  const srcLineCount = lines.filter((l) => /\bsrc\//.test(l)).length;
  const projectFileLineCount = lines.filter((l) =>
    /\b(prisma\/(schema|migrations)|playwright\.config|next\.config|tailwind\.config|package\.json|tsconfig|e2e\/[\w.\-/]+\.(ts|tsx))\b/i.test(
      l
    )
  ).length;
  const hasSrcPaths = srcLineCount > 0;
  const hasProjectFileRefs = projectFileLineCount > 0;
  const hasFilesHeader = /^#+\s*(files?(\s+to\s+(add|update|change|create|modify))?|file\s+inventory|files? changed)/im.test(
    lld
  );
  const hasFileInventoryTable =
    /file\s+inventory/i.test(lld) && /\|\s*[\w\-./]+\.tsx?\s*\|/i.test(lld);
  const tsxBareMentions = (lld.match(/\b[\w\-/]+\.(tsx?|mjs)\b/g) || []).length;

  // ADR: title or first heading mentions ADR / Architectural Decision Record.
  const firstH1 = (lld.match(/^#\s+(.+)$/m) || [, ''])[1];
  const isADR =
    /\bADR\b/.test(firstH1) ||
    /architectural?\s+decision\s+record/i.test(firstH1) ||
    /^#+\s*ADR-?\d/im.test(lld) ||
    /\(ADR\)/.test(firstH1);

  // Migration stub: the document AS A WHOLE is a redirect, not just a subsection.
  // Real stubs are short AND the H1 itself signals migration/consolidation.
  const titleIsMigration =
    /^migration\s+note/i.test(firstH1) ||
    /^.+\bmigration\s+note$/i.test(firstH1) ||
    /retained during consolidation/i.test(lld.slice(0, 500)) ||
    /this (root|file) is retained during consolidation/i.test(lld);
  const isMigrationStub = titleIsMigration && lines.length < 60;

  const plannedSignal =
    /status:\s*(planned|draft|proposed|not[- ]started)/i.test(body) ||
    /not yet implemented|TBD|to be implemented/i.test(body) ||
    /phase\s+0/i.test(lld.slice(0, 800));

  const veryShort = lines.length < 25 && !hasSrcPaths && !hasFileInventoryTable;

  // Candidate bucket logic — ordered, first match wins.
  let bucket;
  let why;

  if (isMigrationStub) {
    bucket = 'D';
    why = 'Migration stub / consolidation redirect';
  } else if (isADR) {
    bucket = 'E-adr';
    why = 'ADR / architectural standard — owns no code by design';
  } else if (hasSrcPaths || hasFileInventoryTable || hasProjectFileRefs) {
    bucket = 'A';
    why = `LLD lists files (srcLines=${srcLineCount}, projectFileLines=${projectFileLineCount}, fileInventoryTable=${hasFileInventoryTable})`;
  } else if (plannedSignal) {
    bucket = 'C';
    why = 'Planned/not built signal in body';
  } else if (veryShort) {
    bucket = 'B';
    why = `Short LLD (${lines.length} lines), no file refs — likely live but undocumented`;
  } else if (tsxBareMentions > 0 && hasFilesHeader) {
    bucket = 'A';
    why = `Files-header section with ${tsxBareMentions} bare file references (relative paths)`;
  } else {
    bucket = 'B';
    why = `No file refs but LLD is substantive (${lines.length} lines) — needs DDD`;
  }

  // Confidence: high if a single strong signal, medium otherwise.
  let confidence = 'medium';
  if (bucket === 'D' && isMigrationStub) confidence = 'high';
  else if (bucket === 'E-adr' && isADR) confidence = 'high';
  else if (bucket === 'A' && hasSrcPaths && srcLineCount >= 3) confidence = 'high';
  else if (bucket === 'A' && hasFileInventoryTable) confidence = 'high';
  else if (bucket === 'C' && plannedSignal && veryShort) confidence = 'high';

  return {
    lldLines: lines.length,
    srcLineCount,
    hasFilesHeader,
    hasFileInventoryTable,
    tsxBareMentions,
    isADR,
    isMigrationStub,
    plannedSignal,
    veryShort,
    bucket,
    confidence,
    why,
  };
}

const rows = empty.map((f) => ({ feature: f, ...signals(f) }));

// Buckets summary.
const byBucket = rows.reduce((m, r) => ((m[r.bucket] = (m[r.bucket] || 0) + 1), m), {});
const byBucketDomain = {};
rows.forEach((r) => {
  byBucketDomain[r.feature.domain] = byBucketDomain[r.feature.domain] || {};
  const d = byBucketDomain[r.feature.domain];
  d[r.bucket] = (d[r.bucket] || 0) + 1;
});

// Emit worksheet.
const out = [];
out.push('# spec/index.backfill-plan.md — Bucketing Worksheet');
out.push('');
out.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
out.push(`**Source manifest:** \`spec/index.json\` @ ${idx.generatedFromSha}`);
out.push(`**Empty-owns features classified:** ${rows.length}`);
out.push('');
out.push('## Buckets');
out.push('');
out.push('| Bucket | Meaning | Action |');
out.push('|---|---|---|');
out.push('| **A** | Live + LLD lists files (src/ paths or File Inventory table) | Mechanical backfill via sub-agent |');
out.push('| **B** | Live but undocumented (no file refs) | DDD-loop triage |');
out.push('| **C** | Planned / not yet built | Set status:"planned", ownsConfidence:"n/a-planned" |');
out.push('| **D** | Dead / migration stub | Delete folder + remove from index |');
out.push('| **E-adr** | ADR / architectural standard (owns no code by design) | Mark with ownsConfidence:"n/a-adr" or similar — decision needed |');
out.push('');
out.push('## Totals');
out.push('');
out.push('| Bucket | Count |');
out.push('|---|---:|');
Object.entries(byBucket)
  .sort()
  .forEach(([k, v]) => out.push(`| ${k} | ${v} |`));
out.push(`| **All** | **${rows.length}** |`);
out.push('');
out.push('## By Domain × Bucket');
out.push('');
const bucketsList = ['A', 'B', 'C', 'D', 'E-adr'];
out.push('| Domain | ' + bucketsList.join(' | ') + ' | Total |');
out.push('|---' + bucketsList.map(() => '|---:').join('') + '|---:|');
Object.entries(byBucketDomain)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([dom, counts]) => {
    const cells = bucketsList.map((b) => counts[b] || 0);
    const total = cells.reduce((a, b) => a + b, 0);
    out.push(`| ${dom} | ${cells.join(' | ')} | ${total} |`);
  });
out.push('');

// Per-bucket detail.
for (const b of bucketsList) {
  const rs = rows.filter((r) => r.bucket === b).sort((a, b) => a.feature.id.localeCompare(b.feature.id));
  if (!rs.length) continue;
  out.push(`## Bucket ${b} (${rs.length})`);
  out.push('');
  out.push('| ID | Conf | LLD lines | src/ refs | File table | ADR | Migration | Planned | Reason |');
  out.push('|---|---|---:|---:|:-:|:-:|:-:|:-:|---|');
  rs.forEach((r) => {
    const yn = (x) => (x ? '✓' : '');
    out.push(
      `| \`${r.feature.id}\` | ${r.confidence} | ${r.lldLines} | ${r.srcLineCount} | ${yn(
        r.hasFileInventoryTable
      )} | ${yn(r.isADR)} | ${yn(r.isMigrationStub)} | ${yn(r.plannedSignal)} | ${r.why} |`
    );
  });
  out.push('');
}

fs.writeFileSync(OUTPUT, out.join('\n'));
console.log(`Wrote ${OUTPUT}`);
console.log('Buckets:', byBucket);

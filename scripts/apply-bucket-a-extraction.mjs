#!/usr/bin/env node
// Apply Bucket A extraction (HIGH + MEDIUM confidence only) to spec/index.json.
// Reads scripts/.tmp/bucket-a-extraction.json, writes back to spec/index.json.
// LOW-confidence features are skipped — they'll be triaged by a sub-agent batch.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INDEX = path.join(ROOT, 'spec', 'index.json');
const EXTRACTION = path.join(ROOT, 'scripts', '.tmp', 'bucket-a-extraction.json');

const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const results = JSON.parse(fs.readFileSync(EXTRACTION, 'utf8'));

const TODAY = new Date().toISOString().slice(0, 10);

let applied = 0;
let skipped = 0;
const changedIds = [];

for (const r of results) {
  if (r.confidence === 'low') {
    skipped++;
    continue;
  }
  const feature = idx.features.find((f) => f.id === r.id);
  if (!feature) {
    console.warn(`SKIP: ${r.id} not in index`);
    skipped++;
    continue;
  }
  feature.owns = r.owns;
  feature.ownsConfidence = r.confidence; // 'high' or 'medium'
  feature.needsReview = false;
  feature.lastVerifiedDate = TODAY;
  applied++;
  changedIds.push(r.id);
}

// Recompute totals on the manifest header.
const features = idx.features;
idx.totals = {
  features: features.length,
  withOwnsMatches: features.filter(
    (f) => f.ownsConfidence && f.ownsConfidence !== 'none'
  ).length,
  overlaps: idx.overlaps?.length ?? 0,
};
idx.generatedAt = new Date().toISOString();

fs.writeFileSync(INDEX, JSON.stringify(idx, null, 2) + '\n');

console.log(`Applied: ${applied}`);
console.log(`Skipped (LOW or missing): ${skipped}`);
console.log(`New withOwnsMatches: ${idx.totals.withOwnsMatches} / ${idx.totals.features}`);
console.log('Changed feature IDs:');
changedIds.forEach((id) => console.log('  -', id));

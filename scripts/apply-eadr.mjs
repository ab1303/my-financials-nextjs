#!/usr/bin/env node
// Apply E-adr classification to the 2 confirmed ADR features.
// Decision (locked 2026-06-30): ownsConfidence: "n/a-adr", owns: [],
// needsReview: false, lastVerifiedDate: today.

import fs from 'node:fs';
import path from 'node:path';

const INDEX = path.join(process.cwd(), 'spec', 'index.json');
const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const TODAY = new Date().toISOString().slice(0, 10);

const ADR_IDS = ['architecture.calendar-attribution', 'architecture.category-url-filtering'];

for (const id of ADR_IDS) {
  const f = idx.features.find((x) => x.id === id);
  if (!f) {
    console.warn(`SKIP: ${id} not found`);
    continue;
  }
  f.owns = { routers: [], services: [], components: [], app: [], tests: [] };
  f.ownsConfidence = 'n/a-adr';
  f.needsReview = false;
  f.lastVerifiedDate = TODAY;
  console.log(`Applied ADR marking to ${id}`);
}

// Recompute totals.
idx.totals = {
  features: idx.features.length,
  withOwnsMatches: idx.features.filter((f) => f.ownsConfidence && f.ownsConfidence !== 'none').length,
  overlaps: idx.overlaps?.length ?? 0,
};
idx.generatedAt = new Date().toISOString();

fs.writeFileSync(INDEX, JSON.stringify(idx, null, 2) + '\n');
console.log(`New withOwnsMatches: ${idx.totals.withOwnsMatches} / ${idx.totals.features}`);

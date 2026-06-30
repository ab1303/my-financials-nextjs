#!/usr/bin/env node
// Phase 3 mechanical owns extractor for Bucket A features.
// For each Bucket-A feature in spec/index.backfill-plan.md:
//   1. Scan its lld.md (and context.md) for project-file references.
//   2. Verify each referenced path exists on disk.
//   3. Bucket each into routers / services / components / app / tests
//      using the same heuristic the indexer uses.
// Output: scripts/.tmp/bucket-a-extraction.json — candidate `owns` blocks
//   plus diagnostics (files-not-found, files-not-classifiable, low-coverage features).
//
// This script does NOT write spec/index.json — that's a separate step after review.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INDEX = path.join(ROOT, 'spec', 'index.json');
const WORKSHEET = path.join(ROOT, 'spec', 'index.backfill-plan.md');
const OUT_DIR = path.join(ROOT, 'scripts', '.tmp');
const OUT = path.join(OUT_DIR, 'bucket-a-extraction.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const ws = fs.readFileSync(WORKSHEET, 'utf8');

// Parse Bucket A IDs from worksheet (between "## Bucket A" and the next "## Bucket").
const aSection = ws.match(/## Bucket A \(\d+\)[\s\S]*?(?=\n## Bucket |\n## Totals|\n## By Domain|$)/);
if (!aSection) throw new Error('Could not locate Bucket A section in worksheet');
const ids = [...aSection[0].matchAll(/^\|\s*`([^`]+)`/gm)].map((m) => m[1]);
console.log(`Found ${ids.length} Bucket A feature IDs in worksheet`);

function readIfExists(p) {
  if (!p) return '';
  const abs = path.join(ROOT, p);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
}

// Pre-index all src/ files for relative-name resolution.
const ALL_SRC_FILES = [];
function indexSrc(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) indexSrc(p);
    else if (/\.(tsx?|mjs|css|prisma)$/.test(entry.name)) {
      ALL_SRC_FILES.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  }
}
indexSrc(path.join(ROOT, 'src'));

// Resolve a bare/relative filename (e.g. "ProfileClient.tsx" or "_components/ProfileClient.tsx")
// against the src/ index. Tries (in order):
//   1. Feature-slug bias (last segment of id, e.g. "calendar-management" → "calendar")
//   2. Domain bias (e.g. "settings")
//   3. First match (if only one candidate)
function resolveBareName(name, featureId) {
  const norm = name.replace(/^src\//, '');
  const matches = ALL_SRC_FILES.filter((f) => f === 'src/' + norm || f.endsWith('/' + norm));
  if (matches.length === 0) return null;
  if (matches.length === 1) return { resolved: matches[0], ambiguous: false };

  // Build slug candidates from the feature id.
  // e.g. "settings.calendar-management" → ["calendar-management", "calendar", "settings"]
  const parts = featureId.split('.');
  const lastSlug = parts[parts.length - 1];
  const slugCore = lastSlug.replace(/-management$|-tracking$|-display$|-settings$|-ui$/, '');
  const slugCandidates = [...new Set([lastSlug, slugCore, ...parts])].filter((s) => s && s.length >= 3);

  for (const slug of slugCandidates) {
    const re = new RegExp('/' + slug.toLowerCase() + '(/|\\.)');
    const biased = matches.filter((f) => re.test(f.toLowerCase()));
    if (biased.length === 1) return { resolved: biased[0], ambiguous: false };
    if (biased.length > 1 && biased.length < matches.length) {
      // Narrowed but still ambiguous — try the next slug.
      // If it's the last attempt and still > 1, return ambiguous.
      if (slug === slugCandidates[slugCandidates.length - 1]) {
        return { resolved: biased[0], ambiguous: true, alternatives: biased };
      }
      continue;
    }
  }
  return { resolved: matches[0], ambiguous: true, alternatives: matches };
}

// Bucket a file path the same way the indexer does (generate-spec-index.mjs:106-110),
// plus an extension: treat src/server/controllers/ as services.
function bucketFile(rel) {
  if (rel.startsWith('src/server/trpc/router')) return 'routers';
  if (rel.startsWith('src/server/services') || rel.startsWith('src/server/controllers')) return 'services';
  if (rel.startsWith('src/components')) return 'components';
  if (rel.startsWith('src/app')) return 'app';
  if (rel.startsWith('src/__tests__') || rel.includes('.test.')) return 'tests';
  return 'other';
}

// Extract candidate file references from an LLD body.
// Looks for:
//   - Bare quoted/unquoted paths starting with `src/`, `prisma/`, `e2e/`, root configs.
//   - File Inventory tables where the first column is a filename.
function extractRefs(body) {
  const refs = new Set();

  // 1. Direct src/ paths.
  const srcRe = /\b(src\/[\w@\-./()]+\.(?:tsx?|mjs|cjs|js|css|prisma))\b/g;
  let m;
  while ((m = srcRe.exec(body)) !== null) refs.add(m[1]);

  // 2. Project-root files.
  const rootRe =
    /\b((?:prisma\/(?:schema\.prisma|migrations\/[\w@\-./]+\.sql)|playwright\.config\.ts|next\.config\.(?:ts|js|mjs)|tailwind\.config\.(?:ts|js)|tsconfig\.json|package\.json|e2e\/[\w@\-./]+\.ts))\b/g;
  while ((m = rootRe.exec(body)) !== null) refs.add(m[1]);

  return [...refs];
}

// Find File Inventory tables: pipe-row whose first cell ends in .tsx/.ts. These often
// use RELATIVE filenames (page.tsx, ProfileClient.tsx) — emit them so the human/agent
// can resolve via grep in a follow-up pass.
function extractInventoryNames(body) {
  if (!/file\s+inventory/i.test(body)) return [];
  const names = new Set();
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 2) continue;
    const first = cells[1];
    // Skip header / separator rows.
    if (/^-+$/.test(first) || /^file/i.test(first) || /^$/.test(first)) continue;
    if (/\.(tsx?|mjs|css|prisma)$/.test(first) || /^page\.tsx/.test(first)) names.add(first);
  }
  return [...names];
}

const results = [];

for (const id of ids) {
  const feature = idx.features.find((f) => f.id === id);
  if (!feature) {
    results.push({ id, error: 'feature not found in index' });
    continue;
  }
  const lld = readIfExists(feature.docs?.lld);
  const ctx = readIfExists(feature.docs?.context);
  const body = lld + '\n' + ctx;

  const refs = extractRefs(body);
  const inventoryNames = extractInventoryNames(lld);

  // Try to resolve inventoryNames into src/ paths.
  const resolvedFromInventory = [];
  const unresolvedInventory = [];
  const ambiguousInventory = [];
  for (const name of inventoryNames) {
    const r = resolveBareName(name, id);
    if (!r) unresolvedInventory.push(name);
    else if (r.ambiguous) ambiguousInventory.push({ name, picked: r.resolved, alternatives: r.alternatives });
    else resolvedFromInventory.push(r.resolved);
  }
  // Merge resolved inventory paths into the ref pool.
  const allRefs = [...new Set([...refs, ...resolvedFromInventory])];

  const exists = [];
  const missing = [];
  for (const r of allRefs) {
    if (fs.existsSync(path.join(ROOT, r))) exists.push(r);
    else missing.push(r);
  }

  const owns = { routers: [], services: [], components: [], app: [], tests: [] };
  const unclassifiable = [];
  for (const r of exists) {
    const b = bucketFile(r);
    if (b === 'other') unclassifiable.push(r);
    else owns[b].push(r);
  }
  // Dedup + sort.
  for (const k of Object.keys(owns)) owns[k] = [...new Set(owns[k])].sort();

  const totalOwned = Object.values(owns).reduce((a, b) => a + b.length, 0);

  // Confidence rubric:
  //   high   — totalOwned >= 3, no missing refs, no unresolved inventory, no ambiguous
  //   medium — totalOwned in [1,2] OR some missing/unresolved/ambiguous
  //   low    — totalOwned == 0 (mechanical extraction failed; needs sub-agent / DDD)
  let confidence;
  if (
    totalOwned >= 3 &&
    missing.length === 0 &&
    unresolvedInventory.length === 0 &&
    ambiguousInventory.length === 0
  )
    confidence = 'high';
  else if (totalOwned === 0) confidence = 'low';
  else confidence = 'medium';

  results.push({
    id,
    domain: feature.domain,
    owns,
    totalOwned,
    confidence,
    missing,
    unclassifiable,
    inventoryNames,
    unresolvedInventory,
    ambiguousInventory,
  });
}

fs.writeFileSync(OUT, JSON.stringify(results, null, 2));

// Summary.
const byConf = results.reduce((m, r) => ((m[r.confidence] = (m[r.confidence] || 0) + 1), m), {});
const lowFeatures = results.filter((r) => r.confidence === 'low').map((r) => r.id);
const mediumFeatures = results.filter((r) => r.confidence === 'medium');
console.log('Extraction confidence:', byConf);
console.log(`Total files extracted: ${results.reduce((a, r) => a + r.totalOwned, 0)}`);
if (lowFeatures.length) {
  console.log('\nLOW confidence (0 owns extracted — needs sub-agent or DDD):');
  lowFeatures.forEach((id) => console.log('  -', id));
}
if (mediumFeatures.length) {
  console.log(`\nMEDIUM confidence (${mediumFeatures.length}) — flagged but usable:`);
  mediumFeatures.forEach((r) => {
    const flags = [];
    if (r.missing.length) flags.push(`missing=${r.missing.length}`);
    if (r.inventoryNames.length) flags.push(`inventoryNames=${r.inventoryNames.length}`);
    if (r.totalOwned < 3) flags.push(`owned=${r.totalOwned}`);
    console.log(`  - ${r.id} (${flags.join(', ')})`);
  });
}
console.log(`\nWrote ${OUT}`);

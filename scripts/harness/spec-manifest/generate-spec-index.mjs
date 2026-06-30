#!/usr/bin/env node
/**
 * generate-spec-index.mjs
 *
 * Walks `spec/` and emits a draft `spec/index.json` — the single ownership +
 * status manifest described in docs/harness-audit.md. Output is a *draft*:
 * every entry is marked `needsReview: true` and `owns` is left empty unless
 * a high-confidence heuristic match exists between the feature folder name
 * and a file in `src/`. Humans (and agents) backfill `owns` afterwards.
 *
 * Heuristics for owns inference (all conservative — only matches if the file
 * basename literally contains the feature kebab-case id or a singularised form):
 *   - src/server/trpc/router/<feature>.ts
 *   - src/server/trpc/router/<feature>/index.ts
 *   - src/server/services/<feature>/**
 *   - src/components/<Feature>* directories
 *
 * Run: `node scripts/harness/spec-manifest/generate-spec-index.mjs` from repo root.
 * Output: spec/index.json (will refuse to overwrite without --force).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SPEC_DIR = path.join(REPO_ROOT, 'spec');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const OUT = path.join(SPEC_DIR, 'index.json');
const FORCE = process.argv.includes('--force');

if (fs.existsSync(OUT) && !FORCE) {
  console.error(`Refusing to overwrite ${OUT}. Re-run with --force.`);
  process.exit(1);
}

const headSha = (() => {
  try { return execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(); }
  catch { return null; }
})();

const featureStatusPath = path.join(REPO_ROOT, '.harness', 'feature-status.json');
const featureStatus = fs.existsSync(featureStatusPath)
  ? JSON.parse(fs.readFileSync(featureStatusPath, 'utf8'))
  : { features: [] };
const harnessById = new Map(featureStatus.features.map(f => [f.id, f]));

const DOC_FILES = new Set(['hld.md', 'context.md', 'lld.md', 'plan.md', 'prd.md', 'reference.md']);
const STANDALONE_AT_DOMAIN = new Set(['user-profile', 'donations']); // domain folders that also have feature-level docs at the root

/**
 * Recursively walk spec/ and yield { kind: 'feature'|'domain', dir, files, depth }.
 */
function* walk(dir, depth = 0) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.filter(e => e.isFile()).map(e => e.name);
  const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  const docFiles = files.filter(f => DOC_FILES.has(f));
  const hasFeatureDocs = docFiles.some(f => f === 'lld.md' || f === 'context.md');
  // Domain root files (hld.md without lld/context) are domain-level overviews.
  if (depth > 0 && hasFeatureDocs) {
    yield { kind: 'feature', dir, files: docFiles };
  } else if (depth > 0 && docFiles.includes('hld.md') && !hasFeatureDocs && subdirs.length === 0) {
    // domain with only an hld at root and no children — still treat as feature
    yield { kind: 'feature', dir, files: docFiles };
  }
  for (const sub of subdirs) yield* walk(path.join(dir, sub), depth + 1);
}

/** Convert kebab to PascalCase fragment for component matching. */
function toPascal(s) {
  return s.split('-').map(p => p[0]?.toUpperCase() + p.slice(1)).join('');
}

/** Walk src/ once and cache file list for matching. */
const ALL_SRC_FILES = [];
function indexSrc(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(e.name)) continue;
      indexSrc(p);
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      ALL_SRC_FILES.push(path.relative(REPO_ROOT, p).replace(/\\/g, '/'));
    }
  }
}
indexSrc(SRC_DIR);

/** Heuristic owns inference. Returns { routers, services, components, app, tests, all }. */
function inferOwns(featureId) {
  const id = featureId;
  const pascal = toPascal(id);
  const tokens = [id, id.replace(/s$/, ''), pascal, pascal.replace(/s$/, '')].filter(t => t && t.length >= 4);

  const buckets = { routers: [], services: [], components: [], app: [], tests: [] };
  for (const f of ALL_SRC_FILES) {
    const base = path.basename(f, path.extname(f));
    const lower = f.toLowerCase();
    const hit = tokens.some(t => {
      if (/^[A-Z]/.test(t)) return f.includes('/' + t) || f.includes(t + '.') || f.includes(t + '/');
      return lower.includes('/' + t + '.') || lower.includes('/' + t + '/') || lower.endsWith('/' + t + '.ts') || lower.endsWith('/' + t + '.tsx');
    });
    if (!hit) continue;
    if (f.startsWith('src/server/trpc/router')) buckets.routers.push(f);
    else if (f.startsWith('src/server/services')) buckets.services.push(f);
    else if (f.startsWith('src/components')) buckets.components.push(f);
    else if (f.startsWith('src/app')) buckets.app.push(f);
    else if (f.startsWith('src/__tests__') || f.includes('.test.')) buckets.tests.push(f);
  }
  const all = [...buckets.routers, ...buckets.services, ...buckets.components, ...buckets.app, ...buckets.tests];
  return { ...buckets, all, matchCount: all.length };
}

/** Derive id, domain, sub-path from a feature dir relative to spec/. */
function classify(absDir) {
  const rel = path.relative(SPEC_DIR, absDir).replace(/\\/g, '/');
  const parts = rel.split('/');
  // Conventions in this repo:
  //   spec/<domain>/<feature>/                  → id = "<domain>.<feature>"
  //   spec/<domain>/<sub>/<feature>/            → id = "<domain>.<sub>.<feature>"
  //   spec/<feature>/  (rare, top-level only)   → id = "<feature>"
  const id = parts.join('.');
  return { rel, id, domain: parts[0], pathSegments: parts };
}

const features = [];
for (const node of walk(SPEC_DIR)) {
  if (node.kind !== 'feature') continue;
  const { rel, id, domain, pathSegments } = classify(node.dir);
  const docs = {};
  for (const f of node.files) docs[f.replace('.md', '')] = `spec/${rel}/${f}`;
  const featureSlug = pathSegments[pathSegments.length - 1];
  const owns = inferOwns(featureSlug);

  const harness = harnessById.get(featureSlug) || harnessById.get(id);
  const status = harness?.status ?? 'unknown';
  const phase = status === 'done'
    ? 'post-build'
    : status === 'in-progress'
      ? 'build'
      : status === 'planned'
        ? 'pre-build'
        : 'unknown';

  features.push({
    id,
    domain,
    path: `spec/${rel}/`,
    status,
    phase,
    docs,
    owns: {
      routers: owns.routers,
      services: owns.services,
      components: owns.components,
      app: owns.app,
      tests: owns.tests,
    },
    ownsConfidence: owns.matchCount === 0
      ? 'none'
      : owns.matchCount <= 3
        ? 'low'
        : 'medium',
    needsReview: true,
    lastVerifiedSha: null,
    lastVerifiedDate: null,
    invariants: [],
  });
}

features.sort((a, b) => a.id.localeCompare(b.id));

// Overlap detection: any owns file claimed by >1 feature.
const owners = new Map(); // file -> [ids]
for (const f of features) {
  for (const list of Object.values(f.owns)) {
    for (const file of list) {
      if (!owners.has(file)) owners.set(file, []);
      owners.get(file).push(f.id);
    }
  }
}
const overlaps = [];
for (const [file, ids] of owners) {
  if (ids.length > 1) overlaps.push({ file, claimedBy: ids });
}

const out = {
  schemaVersion: '0.1.0',
  generatedAt: new Date().toISOString(),
  generatedFromSha: headSha,
  notes: [
    'This file is the DRAFT machine-readable spec ↔ code manifest.',
    'Every entry has `needsReview: true` until a human or agent verifies `owns`.',
    'Overlap warnings below indicate features that claim the same source file — these need boundary resolution before they can be trusted.',
    'See docs/harness-audit.md and docs/context-engineering.md for the design rationale.',
  ],
  conventions: {
    id: '<domain>[.<sub>].<feature>  — derived from spec/ folder path',
    statusValues: ['planned', 'in-progress', 'done', 'blocked', 'adr', 'unknown'],
    phaseValues: ['pre-build', 'build', 'post-build', 'unknown'],
    ownsConfidence: ['none', 'low', 'medium', 'high', 'n/a-planned'],
  },
  totals: {
    features: features.length,
    withOwnsMatches: features.filter(f => f.ownsConfidence !== 'none').length,
    overlaps: overlaps.length,
  },
  overlaps,
  features,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${OUT}`);
console.log(`  features:           ${out.totals.features}`);
console.log(`  withOwnsMatches:    ${out.totals.withOwnsMatches}`);
console.log(`  overlaps:           ${out.totals.overlaps}`);
console.log(`  generatedFromSha:   ${out.generatedFromSha}`);

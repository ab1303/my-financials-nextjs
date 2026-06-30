#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  REPO_ROOT,
  SPEC_INDEX_PATH,
  bucketForPath,
  collectModuleSpecifiers,
  countConsumesBuckets,
  createConsumesStore,
  createModuleResolver,
  createReverseIndex,
  loadTsconfigPaths,
  materializeConsumes,
  toAbsolutePosix,
  toPosix,
} from './lib/resolve.mjs';

function printUsageAndExit(code = 1) {
  console.error('Usage: node scripts/harness/consumes-derivation/derive.mjs [--dry-run|--write]');
  process.exit(code);
}

function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  if (flags.has('--help') || flags.has('-h')) printUsageAndExit(0);
  return { write: flags.has('--write'), dryRun: !flags.has('--write') || flags.has('--dry-run') };
}

function readManifest() {
  return JSON.parse(fs.readFileSync(SPEC_INDEX_PATH, 'utf8')); 
}

function ensureFeatureConsumes(feature) {
  const existing = feature.consumes && typeof feature.consumes === 'object' ? feature.consumes : {};
  return {
    routers: Array.isArray(existing.routers) ? existing.routers : [],
    services: Array.isArray(existing.services) ? existing.services : [],
    components: Array.isArray(existing.components) ? existing.components : [],
    app: Array.isArray(existing.app) ? existing.app : [],
    tests: Array.isArray(existing.tests) ? existing.tests : [],
  };
}

function buildConsumes(manifest) {
  const features = Array.isArray(manifest.features) ? manifest.features : [];
  const { patterns } = loadTsconfigPaths();
  const { reverseIndex, duplicateOwnership } = createReverseIndex(features);

  if (duplicateOwnership.length > 0) {
    const details = duplicateOwnership
      .slice(0, 10)
      .map((entry) => `${entry.file} <- ${entry.owners.join(', ')}`)
      .join('\n');
    const suffix = duplicateOwnership.length > 10 ? `\n... and ${duplicateOwnership.length - 10} more` : '';
    const error = new Error(`Duplicate file ownership detected:\n${details}${suffix}`);
    error.code = 3;
    throw error;
  }

  const store = createConsumesStore(features.map((feature) => feature.id));
  const resolver = createModuleResolver(patterns, REPO_ROOT);
  const skipped = {
    bare: new Set(),
    unresolved: new Set(),
    unbucketed: new Set(),
    external: new Set(),
  };

  let totalEdges = 0;

  for (const feature of features) {
    const ownFiles = [];
    for (const bucket of ['routers', 'services', 'components', 'app', 'tests']) {
      for (const entry of Array.isArray(feature.owns?.[bucket]) ? feature.owns[bucket] : []) {
        ownFiles.push(toAbsolutePosix(entry));
      }
    }

    const seenEdges = new Set();

    for (const ownedFile of ownFiles) {
      if (!fs.existsSync(ownedFile) || !fs.statSync(ownedFile).isFile()) continue;
      const source = fs.readFileSync(ownedFile, 'utf8');
      const specifiers = collectModuleSpecifiers(source);

      for (const specifier of specifiers) {
        const resolved = resolver.resolveSpecifier(specifier, ownedFile);
        if (!resolved) {
          if (specifier.startsWith('.') || specifier.startsWith('..') || specifier.startsWith('@/')) {
            skipped.unresolved.add(specifier);
          } else {
            skipped.bare.add(specifier);
          }
          continue;
        }

        const owner = reverseIndex.get(resolved);
        if (!owner) {
          skipped.external.add(resolved);
          continue;
        }
        if (owner === feature.id) continue;

        const bucket = bucketForPath(resolved);
        if (!bucket) {
          skipped.unbucketed.add(resolved);
          continue;
        }

        const edgeKey = `${feature.id}::${resolved}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);
        const relativePath = toPosix(path.relative(REPO_ROOT, resolved));
        store.get(feature.id)[bucket].add(relativePath);
        totalEdges += 1;
      }
    }
  }

  const consumesByFeature = materializeConsumes(store);
  const topFeatures = [...consumesByFeature.entries()]
    .map(([featureId, consumes]) => ({ featureId, count: countConsumesBuckets(consumes) }))
    .sort((a, b) => b.count - a.count || a.featureId.localeCompare(b.featureId))
    .slice(0, 10);

  return { manifest, consumesByFeature, totalEdges, topFeatures, skipped };
}

function emitSummary(totalFeatures, totalEdges, topFeatures, skipped) {
  console.log(`Total features processed: ${totalFeatures}`);
  console.log(`Total cross-feature edges discovered: ${totalEdges}`);
  console.log('Top 10 features by consumes count:');
  for (const [index, entry] of topFeatures.entries()) {
    console.log(`${index + 1}. ${entry.featureId} — ${entry.count}`);
  }

  const skippedSummary = [
    ['bare', skipped.bare.size],
    ['unresolved', skipped.unresolved.size],
    ['unbucketed', skipped.unbucketed.size],
    ['external', skipped.external.size],
  ].filter(([, count]) => count > 0);

  if (skippedSummary.length > 0) {
    console.log('Skipped resolution buckets:');
    for (const [label, count] of skippedSummary) {
      console.log(`- ${label}: ${count}`);
    }
  }
}

function writeManifest(manifest, consumesByFeature) {
  for (const feature of Array.isArray(manifest.features) ? manifest.features : []) {
    feature.consumes = ensureFeatureConsumes(feature);
    const derived = consumesByFeature.get(feature.id);
    if (derived) {
      feature.consumes.routers = derived.routers;
      feature.consumes.services = derived.services;
      feature.consumes.components = derived.components;
      feature.consumes.app = derived.app;
      feature.consumes.tests = derived.tests;
    }
  }

  fs.writeFileSync(SPEC_INDEX_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  const { write } = parseArgs(process.argv);
  const { manifest, topFeatures, totalEdges, skipped, consumesByFeature } = buildConsumes(readManifest());
  const totalFeatures = Array.isArray(manifest.features) ? manifest.features.length : 0;

  emitSummary(totalFeatures, totalEdges, topFeatures, skipped);

  if (write) {
    writeManifest(manifest, consumesByFeature);
    console.log(`Wrote ${toPosix(SPEC_INDEX_PATH)}`);
  }
}

try {
  main();
} catch (error) {
  const code = error && typeof error.code === 'number' ? error.code : 1;
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(code);
}

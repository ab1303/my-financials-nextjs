#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  REPO_ROOT,
  SPEC_INDEX_PATH,
  collectModuleSpecifiers,
  createModuleResolver,
  createReverseIndex,
  loadTsconfigPaths,
  toAbsolutePosix,
  toPosix,
} from './lib/resolve.mjs';

function readManifest() {
  return JSON.parse(fs.readFileSync(SPEC_INDEX_PATH, 'utf8'));
}

function isPublicApiFile(filePath) {
  const relPath = toPosix(filePath);
  const basename = relPath.split('/').pop();
  return basename === 'index.ts' || basename === 'index.tsx' || basename === 'public.ts' || basename === 'public.tsx';
}

function buildReport(manifest) {
  const features = Array.isArray(manifest.features) ? manifest.features : [];
  const { patterns } = loadTsconfigPaths();
  const { reverseIndex, duplicateOwnership } = createReverseIndex(features);

  if (duplicateOwnership.length > 0) {
    const error = new Error(`Duplicate file ownership detected (${duplicateOwnership.length})`);
    error.code = 3;
    throw error;
  }

  const resolver = createModuleResolver(patterns, REPO_ROOT);
  const sections = new Map();

  for (const feature of features) {
    const seenEdges = new Set();
    const ownFiles = [];
    for (const bucket of ['routers', 'services', 'components', 'app', 'tests']) {
      for (const entry of Array.isArray(feature.owns?.[bucket]) ? feature.owns[bucket] : []) {
        ownFiles.push(toAbsolutePosix(entry));
      }
    }

    for (const ownedFile of ownFiles) {
      if (!fs.existsSync(ownedFile) || !fs.statSync(ownedFile).isFile()) continue;
      const source = fs.readFileSync(ownedFile, 'utf8');
      const specifiers = collectModuleSpecifiers(source);

      for (const specifier of specifiers) {
        const resolved = resolver.resolveSpecifier(specifier, ownedFile);
        if (!resolved) continue;
        const owner = reverseIndex.get(resolved);
        if (!owner || owner === feature.id) continue;

        const edgeKey = `${feature.id}::${resolved}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);

        const section = sections.get(feature.id) ?? { public: [], leaks: [] };
        const classification = isPublicApiFile(resolved) ? 'public' : 'leaks';
        section[classification].push({ specifier, resolved, owner });
        sections.set(feature.id, section);
      }
    }
  }

  return { sections };
}

function renderReport(sections) {
  const lines = ['# Leaky import report'];
  const featureIds = [...sections.keys()].sort((a, b) => a.localeCompare(b));

  for (const featureId of featureIds) {
    const section = sections.get(featureId);
    lines.push('', `## ${featureId}`);

    if (section.public.length > 0) {
      lines.push('', '### Public');
      for (const entry of section.public.sort((a, b) => a.resolved.localeCompare(b.resolved))) {
        lines.push(`- ${toPosix(path.relative(REPO_ROOT, entry.resolved))} <- ${entry.specifier}`);
      }
    }

    if (section.leaks.length > 0) {
      lines.push('', '### Internal leak');
      for (const entry of section.leaks.sort((a, b) => a.resolved.localeCompare(b.resolved))) {
        lines.push(`- ${toPosix(path.relative(REPO_ROOT, entry.resolved))} <- ${entry.specifier}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

try {
  const { sections } = buildReport(readManifest());
  process.stdout.write(renderReport(sections));
} catch (error) {
  const code = error && typeof error.code === 'number' ? error.code : 1;
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(code);
}

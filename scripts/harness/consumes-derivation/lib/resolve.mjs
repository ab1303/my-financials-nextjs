#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODULE_PATH = fileURLToPath(import.meta.url);
export const MODULE_DIR = path.dirname(MODULE_PATH);
export const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
export const SPEC_INDEX_PATH = path.join(REPO_ROOT, 'spec', 'index.json');
export const TSCONFIG_PATH = path.join(REPO_ROOT, 'tsconfig.json');
export const TSCONFIG_PATHS_PATH = path.join(REPO_ROOT, 'tsconfig.paths.json');

const OWNER_BUCKETS = [
  { bucket: 'routers', matches: (relPath) => relPath.startsWith('src/server/trpc/router/') },
  { bucket: 'services', matches: (relPath) => relPath.startsWith('src/server/services/') },
  { bucket: 'components', matches: (relPath) => relPath.startsWith('src/components/') },
  { bucket: 'app', matches: (relPath) => relPath.startsWith('src/app/') },
  {
    bucket: 'tests',
    matches: (relPath) => relPath.startsWith('src/__tests__/') || /\.test\.(ts|tsx)$/i.test(relPath),
  },
];

export function toPosix(p) {
  return p.replace(/\\/g, '/');
}

export function toAbsolutePosix(p, baseDir = REPO_ROOT) {
  return toPosix(path.resolve(baseDir, p));
}

export function readJsonFile(filePath, code = 1) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(`Failed to read JSON at ${toPosix(filePath)}: ${message}`);
    wrapped.code = code;
    throw wrapped;
  }
}

export function loadTsconfigPaths() {
  const tsconfig = readJsonFile(TSCONFIG_PATH, 2);
  const tsconfigPaths = readJsonFile(TSCONFIG_PATHS_PATH, 2);
  const rawPaths = tsconfigPaths?.compilerOptions?.paths ?? {};
  const patterns = [];

  for (const [key, values] of Object.entries(rawPaths)) {
    if (!Array.isArray(values) || values.length === 0) continue;
    const starIndex = key.indexOf('*');
    const wildcard = starIndex !== -1;
    const prefix = wildcard ? key.slice(0, starIndex) : key;
    const suffix = wildcard ? key.slice(starIndex + 1) : '';
    patterns.push({ key, prefix, suffix, wildcard, targets: values });
  }

  patterns.sort((a, b) => {
    if (a.wildcard !== b.wildcard) return a.wildcard ? 1 : -1;
    if (a.prefix.length !== b.prefix.length) return b.prefix.length - a.prefix.length;
    return b.suffix.length - a.suffix.length;
  });

  return { tsconfig, tsconfigPaths, patterns };
}

export function collectModuleSpecifiers(sourceText) {
  const specifiers = [];
  const seen = new Set();
  const patterns = [
    /^\s*import\s+(?:type\s+)?(?:[^'\"]+\s+from\s+)?['\"]([^'\"]+)['\"]/gm,
    /^\s*import\s+['\"]([^'\"]+)['\"]/gm,
    /^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['\"]([^'\"]+)['\"]/gm,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(sourceText); match; match = pattern.exec(sourceText)) {
      const specifier = match[1];
      if (seen.has(specifier)) continue;
      seen.add(specifier);
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

export function bucketForPath(filePath) {
  const relPath = toPosix(path.isAbsolute(filePath) ? path.relative(REPO_ROOT, filePath) : filePath);
  for (const entry of OWNER_BUCKETS) {
    if (entry.matches(relPath)) return entry.bucket;
  }
  return null;
}

export function createModuleResolver(patterns, repoRoot = REPO_ROOT) {
  function resolveFilesystemCandidate(candidatePath) {
    const absoluteCandidate = path.resolve(candidatePath);

    if (fs.existsSync(absoluteCandidate) && fs.statSync(absoluteCandidate).isFile()) {
      return toPosix(absoluteCandidate);
    }

    const ext = path.extname(absoluteCandidate);
    const base = ext ? absoluteCandidate.slice(0, -ext.length) : absoluteCandidate;
    const probes = [
      path.join(absoluteCandidate, 'index.ts'),
      path.join(absoluteCandidate, 'index.tsx'),
      `${base}.ts`,
      `${base}.tsx`,
    ];

    for (const probe of probes) {
      if (fs.existsSync(probe) && fs.statSync(probe).isFile()) {
        return toPosix(path.resolve(probe));
      }
    }

    return null;
  }

  function resolveAlias(specifier) {
    for (const pattern of patterns) {
      if (pattern.wildcard) {
        if (!specifier.startsWith(pattern.prefix) || !specifier.endsWith(pattern.suffix)) continue;
        const inner = specifier.slice(pattern.prefix.length, specifier.length - pattern.suffix.length);
        for (const target of pattern.targets) {
          const substituted = target.includes('*') ? target.replace('*', inner) : target;
          const resolved = resolveFilesystemCandidate(path.resolve(repoRoot, substituted));
          if (resolved) return resolved;
        }
      } else if (specifier === pattern.key) {
        for (const target of pattern.targets) {
          const resolved = resolveFilesystemCandidate(path.resolve(repoRoot, target));
          if (resolved) return resolved;
        }
      }
    }
    return null;
  }

  function resolveSpecifier(specifier, importerFilePath) {
    if (!specifier) return null;
    if (specifier.startsWith('.') || specifier.startsWith('..')) {
      return resolveFilesystemCandidate(path.resolve(path.dirname(importerFilePath), specifier));
    }
    if (specifier.startsWith('@/')) {
      return resolveAlias(specifier);
    }
    return null;
  }

  return { resolveSpecifier, resolveFilesystemCandidate, resolveAlias };
}

export function createReverseIndex(features) {
  const reverseIndex = new Map();
  const duplicateOwnership = [];

  for (const feature of features) {
    for (const bucket of ['routers', 'services', 'components', 'app', 'tests']) {
      const entries = Array.isArray(feature.owns?.[bucket]) ? feature.owns[bucket] : [];
      for (const entry of entries) {
        const absolutePath = toAbsolutePosix(entry);
        const existing = reverseIndex.get(absolutePath);
        if (existing && existing !== feature.id) {
          duplicateOwnership.push({ file: absolutePath, owners: [existing, feature.id] });
          continue;
        }
        reverseIndex.set(absolutePath, feature.id);
      }
    }
  }

  return { reverseIndex, duplicateOwnership };
}

export function createConsumesStore(featureIds) {
  const store = new Map();
  for (const id of featureIds) {
    store.set(id, {
      routers: new Set(),
      services: new Set(),
      components: new Set(),
      app: new Set(),
      tests: new Set(),
    });
  }
  return store;
}

export function materializeConsumes(store) {
  const out = new Map();
  for (const [featureId, buckets] of store) {
    out.set(featureId, {
      routers: [...buckets.routers].sort((a, b) => a.localeCompare(b)),
      services: [...buckets.services].sort((a, b) => a.localeCompare(b)),
      components: [...buckets.components].sort((a, b) => a.localeCompare(b)),
      app: [...buckets.app].sort((a, b) => a.localeCompare(b)),
      tests: [...buckets.tests].sort((a, b) => a.localeCompare(b)),
    });
  }
  return out;
}

export function countConsumesBuckets(consumes) {
  return ['routers', 'services', 'components', 'app', 'tests'].reduce((total, bucket) => total + consumes[bucket].length, 0);
}


#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

const QUALITY_PATH_PREFIXES = ['src/', 'e2e/', 'prisma/'];
const QUALITY_EXACT_PATHS = new Set([
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tsconfig.base.json',
  'eslint.config.js',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
]);

const gates = [
  {
    id: 'type-check',
    command: 'pnpm',
    args: ['run', 'type-check'],
    rerun: 'pnpm run type-check',
    kind: 'quality',
  },
  {
    id: 'lint',
    command: 'pnpm',
    args: ['run', 'lint'],
    rerun: 'pnpm run lint',
    kind: 'quality',
  },
  {
    id: 'spec-check-strict',
    command: 'pnpm',
    args: ['run', 'spec:check:strict'],
    rerun: 'pnpm run spec:check:strict',
  },
  {
    id: 'verify-feature-status',
    command: 'node',
    args: ['scripts/harness/pre-push-hook/verify-feature-status.mjs'],
    rerun: 'node scripts/harness/pre-push-hook/verify-feature-status.mjs',
  },
];

function runCommand(command, args) {
  return spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    maxBuffer: 20 * 1024 * 1024,
  });
}

function tail(output, lineCount = 20) {
  const lines = output
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0);
  return lines.slice(-lineCount).join('\n');
}

function readGitList(args) {
  const result = runCommand('git', args);
  if (result.status !== 0) {
    return [];
  }
  return (result.stdout ?? '')
    .split('\n')
    .map(line => line.trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

function packageJsonQualityImpact() {
  const packageJsonPath = path.join(REPO_ROOT, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return true;

  try {
    const current = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const previousRaw = runCommand('git', ['show', 'HEAD:package.json']);
    if (previousRaw.status !== 0) {
      return true;
    }
    const previous = JSON.parse(previousRaw.stdout ?? '{}');

    const dependencyKeys = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
      'pnpm',
      'packageManager',
      'type',
    ];
    for (const key of dependencyKeys) {
      if (!isDeepStrictEqual(previous[key], current[key])) {
        return true;
      }
    }

    const qualityScripts = ['type-check', 'lint', 'build'];
    for (const scriptName of qualityScripts) {
      if (previous.scripts?.[scriptName] !== current.scripts?.[scriptName]) {
        return true;
      }
    }

    return false;
  } catch {
    return true;
  }
}

function collectChangedFiles() {
  const files = new Set();

  const upstreamResult = runCommand('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstreamResult.status === 0) {
    const upstream = (upstreamResult.stdout ?? '').trim();
    if (upstream) {
      const mergeBaseResult = runCommand('git', ['merge-base', 'HEAD', upstream]);
      if (mergeBaseResult.status === 0) {
        const mergeBase = (mergeBaseResult.stdout ?? '').trim();
        if (mergeBase) {
          for (const file of readGitList(['diff', '--name-only', `${mergeBase}..HEAD`])) {
            files.add(file);
          }
        }
      }
    }
  }

  for (const file of readGitList(['diff', '--name-only'])) {
    files.add(file);
  }
  for (const file of readGitList(['diff', '--name-only', '--cached'])) {
    files.add(file);
  }
  for (const file of readGitList(['ls-files', '--others', '--exclude-standard'])) {
    files.add(file);
  }

  return Array.from(files).sort();
}

function shouldRunQualityGates(changedFiles) {
  for (const file of changedFiles) {
    if (QUALITY_EXACT_PATHS.has(file)) {
      return true;
    }
    if (QUALITY_PATH_PREFIXES.some(prefix => file.startsWith(prefix))) {
      return true;
    }
    if (file === 'package.json' && packageJsonQualityImpact()) {
      return true;
    }
  }
  return false;
}

const suiteStart = Date.now();
const changedFiles = collectChangedFiles();
const runQualityGates = shouldRunQualityGates(changedFiles);
const activeGates = gates.filter(gate => gate.kind !== 'quality' || runQualityGates);
const skippedGates = gates.filter(gate => gate.kind === 'quality' && !runQualityGates);

console.log(
  `INFO | impact-analysis | changed-files=${changedFiles.length} | run-quality-gates=${runQualityGates ? 'yes' : 'no'}`
);
if (skippedGates.length > 0) {
  console.log(
    `SKIP | impact-analysis | skipped-gates=${skippedGates.map(gate => gate.id).join(',')} | reason=no quality-impacting paths`
  );
}

if (DRY_RUN) {
  console.log('DRY RUN | Planned pre-push gates:');
  for (const gate of activeGates) {
    console.log(`- ${gate.id}: ${gate.rerun}`);
  }
  process.exit(0);
}

for (const gate of activeGates) {
  const startedAt = Date.now();
  const result = runCommand(gate.command, gate.args);

  const durationMs = Date.now() - startedAt;
  const passing = result.status === 0;
  console.log(`${passing ? 'PASS' : 'FAIL'} | ${gate.id} | ${durationMs}ms`);

  if (!passing) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const errorTail = tail(output, 20);
    if (errorTail) {
      console.error('\n--- failing output (tail) ---');
      console.error(errorTail);
      console.error('--- end tail ---');
    }
    console.error('\nPre-push gate failed.');
    console.error(`Rerun: ${gate.rerun}`);
    process.exit(result.status ?? 1);
  }
}

const totalMs = Date.now() - suiteStart;
console.log(`PASS | pre-push-gates | ${totalMs}ms`);

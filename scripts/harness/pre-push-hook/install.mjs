#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HUSKY_DIR = path.join(REPO_ROOT, '.husky');
const HOOK_PATH = path.join(HUSKY_DIR, 'pre-push');
const DRY_RUN = process.argv.includes('--dry-run');

function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n');
}

const hookContent = `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

node scripts/harness/pre-push-hook/run-pre-push.mjs
`;

if (!fs.existsSync(HUSKY_DIR)) {
  console.error('❌ Cannot install pre-push hook: .husky directory does not exist.');
  process.exit(1);
}

const currentContent = fs.existsSync(HOOK_PATH) ? fs.readFileSync(HOOK_PATH, 'utf8') : null;
const unchanged = currentContent !== null
  && normalizeLineEndings(currentContent) === normalizeLineEndings(hookContent);

if (DRY_RUN) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        hookPath: '.husky/pre-push',
        action: unchanged ? 'noop' : currentContent === null ? 'create' : 'update',
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (!unchanged) {
  fs.writeFileSync(HOOK_PATH, hookContent, 'utf8');
  if (process.platform !== 'win32') {
    fs.chmodSync(HOOK_PATH, 0o755);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      hookPath: '.husky/pre-push',
      action: unchanged ? 'noop' : currentContent === null ? 'created' : 'updated',
    },
    null,
    2
  )
);

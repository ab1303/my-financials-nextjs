import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const issues = [];
const exts = /\.(ts|tsx|js|jsx|json|css|md)$/;
const skip = new Set([
  'node_modules',
  '.next',
  '.git',
  '__pycache__',
  'dist',
  'build',
]);

function scanDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !skip.has(entry.name)) {
      scanDir(full);
    } else if (entry.isFile() && exts.test(entry.name)) {
      try {
        const raw = readFileSync(full);
        // BOM check
        if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
          issues.push('[BOM] ' + full);
        }
        // Invalid UTF-8 round-trip check
        const decoded = raw.toString('utf8');
        const reenc = Buffer.from(decoded, 'utf8');
        if (!raw.equals(reenc)) {
          issues.push('[ENCODING-MISMATCH] ' + full);
        }
        // Null byte check
        if (raw.indexOf(0x00) !== -1) {
          issues.push('[NULL-BYTE] ' + full);
        }
      } catch (e) {
        issues.push('[READ-ERROR] ' + full + ': ' + String(e));
      }
    }
  }
}

const dirs = ['src', 'app', 'prisma', 'e2e', 'scripts'];
for (const d of dirs) {
  scanDir(d);
}

if (issues.length === 0) {
  console.log('✓ No UTF-8 encoding issues found across the codebase.');
} else {
  console.log(`Found ${issues.length} issues:`);
  issues.forEach((i) => console.log(i));
  process.exit(1);
}

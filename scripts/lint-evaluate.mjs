import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { ESLint } from 'eslint';

const args = new Set(process.argv.slice(2));
const topOnly = args.has('--top-only');
const outputArg = process.argv.find((arg) => arg.startsWith('--json='));
const outputPath = outputArg ? outputArg.replace('--json=', '') : null;

const eslint = new ESLint({ cwd: process.cwd() });
const results = await eslint.lintFiles(['src', 'e2e']);

if (outputPath) {
  const absolutePath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, JSON.stringify(results, null, 2), 'utf8');
}

const fileStats = results
  .map((result) => {
    let errors = 0;
    let warnings = 0;

    for (const message of result.messages) {
      if (message.severity === 2) errors += 1;
      if (message.severity === 1) warnings += 1;
    }

    return {
      filePath: result.filePath,
      errors,
      warnings,
      messages: result.messages,
    };
  })
  .filter((item) => item.errors > 0 || item.warnings > 0);

const totalErrors = fileStats.reduce((sum, item) => sum + item.errors, 0);
const totalWarnings = fileStats.reduce((sum, item) => sum + item.warnings, 0);

const topWarningFiles = [...fileStats]
  .filter((item) => item.warnings > 0)
  .sort((a, b) => b.warnings - a.warnings)
  .slice(0, 10);

if (!topOnly) {
  console.log(`Total: ${totalErrors} errors, ${totalWarnings} warnings`);

  const errorFiles = fileStats.filter((item) => item.errors > 0);
  if (errorFiles.length > 0) {
    console.log('\nBlocking errors:');
    for (const file of errorFiles) {
      for (const message of file.messages.filter((m) => m.severity === 2)) {
        console.log(
          `- ${file.filePath}:${message.line}:${message.column} ${message.ruleId ?? 'unknown'} ${message.message}`,
        );
      }
    }
  }
}

console.log('\nTop warning files:');
if (topWarningFiles.length === 0) {
  console.log('- none');
} else {
  for (const file of topWarningFiles) {
    console.log(`- ${file.filePath}: ${file.warnings}`);
  }
}

if (outputPath) {
  console.log(`\nSaved full report to ${resolve(process.cwd(), outputPath)}`);
}

process.exitCode = totalErrors > 0 ? 1 : 0;

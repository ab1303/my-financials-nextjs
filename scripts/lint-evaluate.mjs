import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { ESLint } from 'eslint';

const args = new Set(process.argv.slice(2));
const topOnly = args.has('--top-only');
const nextMode = args.has('--next');
const outputArg = process.argv.find((arg) => arg.startsWith('--json='));
const outputPath = outputArg ? outputArg.replace('--json=', '') : null;
const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
const targetFileOverride = fileArg ? fileArg.replace('--file=', '') : null;

/**
 * Classify a lint message into a recipe ID from
 * `.ai/instructions/lint-strong-typing-recipes.md`.
 *
 * The classifier reads the offending source line so it can distinguish
 * patterns that share a rule ID (for example several `no-explicit-any`
 * variants). Returns `R-UNKNOWN` when no recipe matches — the loop must STOP
 * on `R-UNKNOWN` rather than invent a workaround.
 */
function classifyMessage(message, sourceLine) {
  const rule = message.ruleId ?? '';
  const line = sourceLine ?? '';

  if (rule === '@typescript-eslint/no-unused-vars') return 'R-UNUSED-VAR';
  if (rule === 'react-hooks/exhaustive-deps') return 'R-HOOK-DEPS';
  if (rule === 'react-hooks/rules-of-hooks') return 'R-HOOK-RULES';

  if (rule === '@typescript-eslint/no-explicit-any') {
    if (/\bvi\.mocked\(/.test(line)) return 'R-VI-MOCKED';
    if (/\bmock\.calls\b/.test(line)) return 'R-MOCK-CALL-ARGS';
    if (/\bauth\b.*as\s+any/.test(line) || /vi\.mocked\(auth\)/.test(line))
      return 'R-AUTH-MOCK-HELPER';
    if (/createCaller\(/.test(line)) return 'R-TRPC-CALLER-CONTEXT';
    if (/toNumber\s*:\s*\(\)\s*=>/.test(line)) return 'R-DECIMAL-LITERAL';
    if (/\bcatch\s*\(/.test(line) || /\berror\s*:\s*any\b/.test(line))
      return 'R-UNKNOWN-ERROR';
    if (/=>\s*\(?\s*<.+\/>\s*\)?/.test(line) || /:\s*any\s*\)\s*=>/.test(line))
      return 'R-COMPONENT-PROPS';
    if (/prismaMock\./.test(line) || /\bPrisma\./.test(line))
      return 'R-PRISMA-MOCK';
    if (/as\s+any/.test(line)) return 'R-PRISMA-PAYLOAD';
  }

  return 'R-UNKNOWN';
}

const RECIPE_INDEX = {
  'R-VI-MOCKED': 'Use vi.mocked(fn) instead of (fn as any) for mock methods',
  'R-PRISMA-MOCK': 'Build a typed fixture factory (e.g. createBrokerage())',
  'R-PRISMA-PAYLOAD':
    'Use Prisma.XGetPayload<{ select: {…} }> for slice shapes',
  'R-AUTH-MOCK-HELPER':
    'Use setAuthMock helper: (auth as unknown as AuthMock).mockResolvedValue(…)',
  'R-TRPC-CALLER-CONTEXT':
    'type CallerContext = Parameters<typeof appRouter.createCaller>[0]',
  'R-DECIMAL-LITERAL': 'Use new Decimal(N) instead of fake { toNumber } object',
  'R-MOCK-CALL-ARGS':
    'Cast mock.calls[0]?.[0] to a typed Prisma where/args type',
  'R-COMPONENT-PROPS': 'Define a local prop type for the mocked component',
  'R-UNKNOWN-ERROR': 'catch (error: unknown) + instanceof Error narrowing',
  'R-UNUSED-VAR': 'Remove the unused binding (do not rename to _x)',
  'R-HOOK-DEPS':
    'Add the missing dep, OR refactor to stabilise it (useCallback / useRef / lift)',
  'R-HOOK-RULES':
    'Rename use*-prefixed callback param to a non-use* identifier',
  'R-UNKNOWN': '⚠️ No recipe — STOP and ask the user before patching',
};

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

if (nextMode) {
  const target = targetFileOverride
    ? fileStats.find(
        (item) =>
          relative(process.cwd(), item.filePath).replace(/\\/g, '/') ===
            targetFileOverride.replace(/\\/g, '/') ||
          item.filePath === resolve(process.cwd(), targetFileOverride),
      )
    : topWarningFiles[0];

  if (!target) {
    console.log(
      '\nNo target file to classify. Loop complete or --file= not found.',
    );
  } else {
    const rel = relative(process.cwd(), target.filePath).replace(/\\/g, '/');
    console.log(`\n── Next target ──────────────────────────────────────────`);
    console.log(`File:     ${rel}`);
    console.log(`Errors:   ${target.errors}`);
    console.log(`Warnings: ${target.warnings}`);
    console.log(`Skill:    .agents/skills/lint-reduction-loop/SKILL.md`);
    console.log(`Recipes:  .ai/instructions/lint-strong-typing-recipes.md`);

    let sourceLines = [];
    try {
      sourceLines = readFileSync(target.filePath, 'utf8').split(/\r?\n/);
    } catch {
      // ignore — best effort classification
    }

    const sortedMessages = [...target.messages].sort(
      (a, b) => a.line - b.line || a.column - b.column,
    );

    const recipeCounts = new Map();
    console.log(`\nWarnings classified by recipe:`);
    for (const message of sortedMessages) {
      const sourceLine = sourceLines[message.line - 1] ?? '';
      const recipeId = classifyMessage(message, sourceLine);
      recipeCounts.set(recipeId, (recipeCounts.get(recipeId) ?? 0) + 1);
      const ruleLabel = message.ruleId ?? 'parse-error';
      console.log(
        `  L${message.line}:${message.column}  ${recipeId.padEnd(22)} ${ruleLabel}`,
      );
      console.log(`     ${message.message}`);
    }

    console.log(`\nRecipe summary (apply these):`);
    for (const [recipeId, count] of [...recipeCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(
        `  ${recipeId} ×${count}  — ${RECIPE_INDEX[recipeId] ?? '?'}`,
      );
    }

    if (recipeCounts.has('R-UNKNOWN')) {
      console.log(
        `\n⚠️  This file has unclassifiable warnings. STOP and ask the user`,
      );
      console.log(
        `    before patching. Add a recipe to the library if needed.`,
      );
    } else {
      console.log(`\nVerification gate after patching:`);
      console.log(`  pnpm --silent exec eslint "${rel}"`);
      console.log(`  pnpm --silent run type-check`);
      console.log(`  node scripts/lint-evaluate.mjs --top-only`);
    }
  }
}

if (outputPath) {
  console.log(`\nSaved full report to ${resolve(process.cwd(), outputPath)}`);
}

process.exitCode = totalErrors > 0 ? 1 : 0;

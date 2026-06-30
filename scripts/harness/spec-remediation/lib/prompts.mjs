/**
 * lib/prompts.mjs
 *
 * Render `prompts/*.md` templates with {{double-brace}} placeholders.
 *
 * Enforces the universal `⚠️ CRITICAL CONSTRAINTS` block (LLD § Prompt
 * template contract). Templates missing or weakening this block are rejected
 * at load time — the four invariants from spec/harness/hld.md cannot be
 * negotiated away by a sub-agent author.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'prompts',
);

/** Phrases that MUST appear in every template's CRITICAL CONSTRAINTS block. */
const REQUIRED_PHRASES = [
  '⚠️ CRITICAL CONSTRAINTS',
  'READ-ONLY',
  'ALLOWED_READS',
  'JSON',
  'must not modify',
];

/** Placeholders shared by every template (LLD § Required placeholders). */
const REQUIRED_PLACEHOLDERS = ['{{TASK_ID}}', '{{FEATURE_LLD}}', '{{FILES_LIST}}', '{{ALLOWED_READS}}'];

/** Step-specific placeholders the template must use. */
const STEP_PLACEHOLDERS = {
  1: ['{{TARGET_FEATURE_LLD}}'],
  2: [],
  3: ['{{CLAIMANT_LLDS}}'],
};

/**
 * Load a template by basename (e.g. 'step1-scope-down.md'). Validates the
 * critical-constraints block and required placeholders. Throws on violation
 * — these are unrecoverable authoring errors.
 */
export function loadTemplate(basename) {
  const fullPath = path.join(TEMPLATES_DIR, basename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`prompt template not found: ${fullPath}`);
  }
  const text = fs.readFileSync(fullPath, 'utf8');

  const missingPhrases = REQUIRED_PHRASES.filter((p) => !text.includes(p));
  if (missingPhrases.length) {
    throw new Error(
      `template ${basename} is missing required CRITICAL CONSTRAINTS phrases: ${missingPhrases.join(', ')}`,
    );
  }

  const step = stepFromBasename(basename);
  const required = [...REQUIRED_PLACEHOLDERS, ...(STEP_PLACEHOLDERS[step] ?? [])];
  const missingPlaceholders = required.filter((p) => !text.includes(p));
  if (missingPlaceholders.length) {
    throw new Error(
      `template ${basename} is missing required placeholders: ${missingPlaceholders.join(', ')}`,
    );
  }

  return { basename, step, text };
}

function stepFromBasename(basename) {
  const m = basename.match(/^step([123])-/);
  if (!m) throw new Error(`template basename must start with step{1|2|3}-: ${basename}`);
  return Number(m[1]);
}

/**
 * Substitute placeholders. Values that are arrays are rendered as markdown
 * bullet lists; strings are inserted verbatim. Unknown placeholders left in
 * the rendered output cause a throw — silent leaks are a sub-agent risk.
 */
export function renderTemplate(template, values) {
  let out = template.text;
  for (const [key, value] of Object.entries(values)) {
    const token = `{{${key}}}`;
    const rendered = Array.isArray(value)
      ? value.map((v) => `- ${v}`).join('\n')
      : String(value);
    out = out.split(token).join(rendered);
  }
  const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) {
    throw new Error(`unsubstituted placeholders in rendered prompt: ${[...new Set(leftover)].join(', ')}`);
  }
  return out;
}

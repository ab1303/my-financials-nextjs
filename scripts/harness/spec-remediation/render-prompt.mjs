/**
 * Render a single rendered prompt for a task id and print to stdout.
 * Usage: node render-prompt.mjs --step 1 --task step1-t001
 *
 * Resolves placeholders from step{N}-tasks.json + spec/index.json.
 * Read-only; does not write anywhere.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTemplate, renderTemplate } from './lib/prompts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function argv(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

const step = Number(argv('step'));
const taskId = argv('task');
if (!step || !taskId) {
  console.error('usage: render-prompt.mjs --step <1|2|3> --task <id>');
  process.exit(2);
}

const tasksPath = path.join(ROOT, '.harness', 'remediation', `step${step}-tasks.json`);
const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8')).tasks;
const task = tasks.find((t) => t.id === taskId);
if (!task) throw new Error(`task not found: ${taskId}`);

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'spec', 'index.json'), 'utf8'));
const byId = new Map(manifest.features.map((f) => [f.id, f]));

function lldOf(id) {
  const f = byId.get(id);
  if (!f) throw new Error(`feature not in manifest: ${id}`);
  return f.docs?.lld ?? `${f.path}lld.md`;
}

const subjectLld = lldOf(task.subject);
const targetLld = task.target ? lldOf(task.target) : null;
const claimantLlds = task.claimants ? task.claimants.map(lldOf) : null;

const allowedReads = new Set([
  ...task.files,
  subjectLld,
  ...(targetLld ? [targetLld] : []),
  ...(claimantLlds ?? []),
]);

const templateName = task.promptTemplate;
const template = loadTemplate(templateName);

const values = {
  TASK_ID: task.id,
  FEATURE_LLD: subjectLld,
  FILES_LIST: task.files,
  ALLOWED_READS: [...allowedReads],
};
if (step === 1) values.TARGET_FEATURE_LLD = targetLld;
if (step === 3) values.CLAIMANT_LLDS = claimantLlds ?? [];

process.stdout.write(renderTemplate(template, values));

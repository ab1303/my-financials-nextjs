#!/usr/bin/env node
/**
 * check.mjs
 *
 * Capsule staleness + budget gate for harness.capsule-format.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCapsule } from './lib/template.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MAX_TOKENS = 800;
const BUCKETS = ['routers', 'services', 'components', 'app', 'tests'];

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readMaybeText(filePath) {
  return exists(filePath) ? readText(filePath) : '';
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function readIndentedBlock(lines, startIndex) {
  const block = [];
  let indent = null;
  let i = startIndex;

  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      block.push('');
      continue;
    }

    const currentIndent = (line.match(/^\s*/) ?? [''])[0].length;
    if (indent === null) {
      if (currentIndent === 0) break;
      indent = currentIndent;
    }

    if (currentIndent < indent) break;
    block.push(line.slice(indent));
  }

  return { value: block.join('\n').replace(/\n+$/, ''), nextIndex: i };
}

function parseYamlLike(text) {
  const lines = normalizeNewlines(text).split('\n');
  const data = {};

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const keyMatch = raw.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!keyMatch) continue;

    const key = keyMatch[1];
    const rest = (keyMatch[2] ?? '').trim();

    if (rest === '|') {
      const { value, nextIndex } = readIndentedBlock(lines, i + 1);
      data[key] = value;
      i = nextIndex - 1;
      continue;
    }

    if (!rest) {
      const list = [];
      let j = i + 1;
      for (; j < lines.length; j += 1) {
        const nextRaw = lines[j];
        if (!nextRaw.trim()) continue;
        const item = nextRaw.match(/^\s*-\s+(.*)$/);
        if (!item) break;
        list.push(parseScalar(item[1]));
      }
      data[key] = list.length ? list : '';
      i = j - 1;
      continue;
    }

    data[key] = parseScalar(rest);
  }

  return data;
}

function parseFrontMatter(text) {
  const normalized = normalizeNewlines(text);
  if (!normalized.startsWith('---\n')) return { data: {}, body: normalized };

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return { data: {}, body: normalized };

  const frontMatter = normalized.slice(4, end);
  const body = normalized.slice(end + 5);
  return { data: parseYamlLike(frontMatter), body };
}

function firstParagraph(text) {
  const normalized = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!normalized) return '';
  return normalized
    .split(/\r?\n\s*\r?\n/)
    .find(paragraph => paragraph.trim().length > 0)
    ?.replace(/\s+/g, ' ')
    .trim() ?? '';
}

function stripFrontMatter(text) {
  return parseFrontMatter(text).body;
}

function asArray(value) {
  return Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
}

function uniqueInOrder(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const value = typeof item === 'string' ? item.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function readCapsuleOverrides(feature) {
  const overridePath = path.join(REPO_ROOT, feature.path ?? '', 'capsule.yml');
  if (!exists(overridePath)) return { data: {}, text: '' };
  const text = readText(overridePath);
  return { data: parseYamlLike(text), text };
}

function collectOwns(feature) {
  const owns = {};
  for (const bucket of BUCKETS) {
    const entries = Array.isArray(feature.owns?.[bucket]) ? feature.owns[bucket] : [];
    owns[bucket] = entries.filter(entry => typeof entry === 'string' && entry.trim().length > 0);
  }
  return owns;
}

function collectConsumesFiles(feature) {
  return BUCKETS.flatMap(bucket => Array.isArray(feature.consumes?.[bucket]) ? feature.consumes[bucket] : []);
}

function buildConsumerIndex(features) {
  const ownersByFile = new Map();
  for (const feature of features) {
    const files = uniqueInOrder(BUCKETS.flatMap(bucket => Array.isArray(feature.owns?.[bucket]) ? feature.owns[bucket] : []));
    for (const file of files) {
      if (!ownersByFile.has(file)) ownersByFile.set(file, new Set());
      ownersByFile.get(file).add(feature.id);
    }
  }

  const consumersByFeature = new Map();
  for (const feature of features) {
    for (const consumedFile of uniqueInOrder(collectConsumesFiles(feature))) {
      const owners = ownersByFile.get(consumedFile);
      if (!owners) continue;
      for (const ownerId of owners) {
        if (ownerId === feature.id) continue;
        if (!consumersByFeature.has(ownerId)) consumersByFeature.set(ownerId, new Set());
        consumersByFeature.get(ownerId).add(feature.id);
      }
    }
  }

  return consumersByFeature;
}

function resolvePurpose(sourceText, overrides) {
  const fm = parseFrontMatter(sourceText).data;
  const overridePurpose = typeof overrides.purpose === 'string' ? overrides.purpose.trim() : '';
  const fmPurpose = typeof fm.purpose === 'string' ? fm.purpose.trim() : '';
  return overridePurpose || fmPurpose || firstParagraph(stripFrontMatter(sourceText)) || '_None._';
}

function buildGates(feature, overrides) {
  const gates = ['pnpm run type-check', 'pnpm run lint', 'pnpm spec:check'];
  const owns = collectOwns(feature);
  if (owns.app.length > 0 || owns.components.length > 0) gates.push('pnpm run build');
  for (const gate of uniqueInOrder(asArray(overrides.gates))) gates.push(gate);
  return uniqueInOrder(gates);
}

function collectReferences(overrides) {
  return uniqueInOrder(asArray(overrides.references)).map(ref => (/^\[[^\]]+\]\([^)]+\)$/.test(ref) ? `- ${ref}` : `- [${ref}](${ref})`));
}



function finalizeRenderedCapsule(feature, purpose, owns, invariants, consumedBy, gates, references, sourceSha, canCountTokens) {
  const initialRendered = renderCapsule({
    featureId: feature.id,
    sourceSha,
    tokens: 0,
    purpose,
    owns,
    invariants,
    consumedBy,
    gates,
    references,
  });
  const tokenCount = canCountTokens ? checkCapsules._countTokens(initialRendered) : null;
  const rendered = renderCapsule({
    featureId: feature.id,
    sourceSha,
    tokens: tokenCount ?? 0,
    purpose,
    owns,
    invariants,
    consumedBy,
    gates,
    references,
  });
  return { rendered: rendered.endsWith('\n') ? rendered : `${rendered}\n`, tokenCount };
}


async function loadTokenCounter() {
  try {
    const mod = await import('./lib/tokenize.mjs');
    if (typeof mod.countTokens === 'function') return mod.countTokens;
  } catch {
    // tokenizer unavailable; budget check skipped
  }
  return null;
}

function formatSummary(findings, checkedCount, budgetAvailable) {
  const lines = [];
  const pushSection = (title, items) => {
    lines.push(`${title} (${items.length})`);
    for (const item of items) lines.push(`  - ${item}`);
  };

  if (!findings.stale.length && !findings.missing.length && !findings.overBudget.length) {
    lines.push(`✓ ${checkedCount} capsule(s) clean`);
  } else {
    if (findings.stale.length) pushSection('STALE', findings.stale);
    if (findings.missing.length) pushSection('MISSING', findings.missing);
    if (findings.overBudget.length) pushSection('OVER_BUDGET', findings.overBudget.map(item => `${item.id} (${item.tokens}/800)`));
  }

  if (!budgetAvailable) lines.push('budget: skipped (tokenizer unavailable)');
  lines.push(`checked: ${checkedCount}`);
  return lines.join('\n');
}

function serialiseFeature(feature) {
  return JSON.stringify(feature);
}

export async function checkCapsules({ repoRoot = REPO_ROOT, dryRun = true, strict = false } = {}) {
  const index = JSON.parse(readText(path.join(repoRoot, 'spec', 'index.json')));
  const features = Array.isArray(index.features) ? index.features : [];
  const consumersByOwner = buildConsumerIndex(features);
  const countTokens = await loadTokenCounter();
  checkCapsules._countTokens = countTokens;
  const findings = { stale: [], missing: [], overBudget: [] };

  for (const feature of features) {
    const featurePath = path.join(repoRoot, feature.path ?? '');
    const capsulePath = path.join(featurePath, 'capsule.md');
    const contextPath = path.join(featurePath, 'context.md');
    let sourceText = '';
    if (exists(contextPath)) {
      sourceText = readText(contextPath);
    } else {
      const lldPath = feature.docs?.lld ? path.join(repoRoot, feature.docs.lld) : path.join(featurePath, 'lld.md');
      sourceText = exists(lldPath) ? readText(lldPath) : '';
    }

    const overrides = readCapsuleOverrides(feature).data;
    const sourceSha = sha256(serialiseFeature(feature) + sourceText).slice(0, 16);
    const purpose = resolvePurpose(sourceText, overrides);
    const owns = collectOwns(feature);
    const invariants = Array.isArray(feature.invariants) ? feature.invariants.filter(value => typeof value === 'string' && value.trim().length > 0) : [];
    const consumedBy = [...(consumersByOwner.get(feature.id) ?? new Set())].sort((a, b) => a.localeCompare(b));
    const gates = buildGates(feature, overrides);
    const references = collectReferences(overrides);
    const rendered = finalizeRenderedCapsule(feature, purpose, owns, invariants, consumedBy, gates, references, sourceSha, Boolean(countTokens));

    const onDiskExists = exists(capsulePath);
    const onDiskText = onDiskExists ? readText(capsulePath) : '';

    if (!onDiskExists) findings.missing.push(feature.id);
    else if (onDiskText !== rendered.rendered) findings.stale.push(feature.id);

    const tokens = rendered.tokenCount;
    if (tokens !== null && tokens > MAX_TOKENS) findings.overBudget.push({ id: feature.id, tokens });

    if (!dryRun) {
      fs.mkdirSync(featurePath, { recursive: true });
      fs.writeFileSync(capsulePath, rendered.rendered, 'utf8');
    }
  }

  const exitCode = findings.stale.length || findings.missing.length || findings.overBudget.length ? 6 : 0;
  const summary = formatSummary(findings, features.length, Boolean(countTokens));
  return { exitCode, summary, findings, strict };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  const jsonOut = args.includes('--json');
  const strict = args.includes('--strict');
  const result = await checkCapsules({ repoRoot: REPO_ROOT, dryRun, strict });

  if (jsonOut) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write('--- Capsule staleness ---\n');
    process.stdout.write(result.summary + '\n');
  }

  process.exit(result.exitCode);
}

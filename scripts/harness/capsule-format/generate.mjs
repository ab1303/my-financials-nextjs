#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter } from './lib/front-matter.mjs';
import { renderCapsule } from './lib/template.mjs';
import { countTokens } from './lib/tokenize.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');
const INDEX_PATH = path.join(REPO_ROOT, 'spec', 'index.json');
const TOKENS_LIMIT = 800;
const REQUIRED_FIELDS = ['id', 'domain', 'path', 'docs', 'owns'];
const BUCKETS = ['routers', 'services', 'components', 'app', 'tests'];

function fail(code, message) {
  console.error(message);
  process.exitCode = code;
  return false;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripQuotes(value) {
  const trimmed = normalizeString(value);
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function commonIndent(lines) {
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/)?.[0] ?? '').length);
  return indents.length ? Math.min(...indents) : 0;
}

function stripCommonIndent(lines) {
  const indent = commonIndent(lines);
  return lines.map((line) => {
    if (!line.trim()) return '';
    return line.slice(Math.min(indent, line.length));
  }).join('\n');
}

function foldBlock(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function parseSimpleYaml(text) {
  const result = {};
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;

    const [, key, restRaw] = match;
    const rest = restRaw.trim();

    if (key === 'purpose') {
      if (rest === '|' || rest === '>') {
        const block = [];
        const baseIndent = (line.match(/^\s*/)?.[0] ?? '').length;
        i += 1;
        while (i < lines.length) {
          const next = lines[i];
          if (!next.trim()) {
            block.push('');
            i += 1;
            continue;
          }
          const nextIndent = (next.match(/^\s*/)?.[0] ?? '').length;
          if (nextIndent <= baseIndent) {
            i -= 1;
            break;
          }
          block.push(next.slice(Math.min(nextIndent, next.length)));
          i += 1;
        }
        let value = stripCommonIndent(block).trimEnd();
        if (rest === '>') value = foldBlock(value);
        result.purpose = value.trim();
      } else {
        result.purpose = stripQuotes(rest);
      }
      continue;
    }

    if (key === 'gates' || key === 'references') {
      const items = [];
      const baseIndent = (line.match(/^\s*/)?.[0] ?? '').length;
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (!next.trim()) {
          i += 1;
          continue;
        }
        const nextIndent = (next.match(/^\s*/)?.[0] ?? '').length;
        if (nextIndent <= baseIndent) {
          i -= 1;
          break;
        }
        const itemMatch = next.match(/^\s*-\s+(.*)$/);
        if (itemMatch) items.push(stripQuotes(itemMatch[1]));
        i += 1;
      }
      result[key] = items;
      continue;
    }

    result[key] = stripQuotes(rest);
  }

  return result;
}

function parseCapsuleYml(text) {
  return parseSimpleYaml(text);
}

function collectOwns(feature) {
  const owns = {};
  for (const bucket of BUCKETS) {
    const entries = Array.isArray(feature.owns?.[bucket]) ? feature.owns[bucket] : [];
    owns[bucket] = entries.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
  }
  return owns;
}

function collectOwnFiles(feature) {
  return BUCKETS.flatMap((bucket) => Array.isArray(feature.owns?.[bucket]) ? feature.owns[bucket] : []);
}

function collectConsumesFiles(feature) {
  return BUCKETS.flatMap((bucket) => Array.isArray(feature.consumes?.[bucket]) ? feature.consumes[bucket] : []);
}

function firstParagraph(text) {
  const normalized = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!normalized) return '';
  return normalized
    .split(/\r?\n\s*\r?\n/)
    .find((paragraph) => paragraph.trim().length > 0)
    ?.replace(/\s+/g, ' ')
    .trim() ?? '';
}

function uniqueInOrder(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const value = normalizeString(item);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function validateManifestFeatures(features) {
  for (const feature of features) {
    const missing = REQUIRED_FIELDS.filter((field) => feature?.[field] == null);
    if (missing.length) {
      const error = new Error(`Missing required manifest field(s) for feature ${feature?.id ?? '<unknown>'}: ${missing.join(', ')}`);
      error.code = 5;
      throw error;
    }
  }
}

function buildReverseConsumers(features) {
  const ownersByFile = new Map();
  const consumersByFeature = new Map(features.map((feature) => [feature.id, new Set()]));

  for (const feature of features) {
    for (const ownedFile of collectOwnFiles(feature)) {
      const owners = ownersByFile.get(ownedFile) ?? new Set();
      owners.add(feature.id);
      ownersByFile.set(ownedFile, owners);
    }
  }

  for (const consumer of features) {
    for (const consumedFile of collectConsumesFiles(consumer)) {
      const owners = ownersByFile.get(consumedFile);
      if (!owners) continue;
      for (const ownerId of owners) {
        if (ownerId === consumer.id) continue;
        consumersByFeature.get(ownerId)?.add(consumer.id);
      }
    }
  }

  return consumersByFeature;
}

function sourceShaFor(featureEntry, rawContextMd) {
  const combined = JSON.stringify(featureEntry) + rawContextMd;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

function resolveFeatureFile(feature, fileName) {
  const rel = feature?.path ? path.join(feature.path, fileName) : path.posix.join('spec', feature.domain, feature.id.split('.').pop(), fileName);
  return path.join(REPO_ROOT, rel);
}

function resolveFeaturePath(feature, fileName) {
  return path.join(REPO_ROOT, feature.path, fileName);
}

function buildGates(feature, capsuleYml) {
  const gates = [
    'pnpm run type-check',
    'pnpm run lint',
    'pnpm spec:check',
  ];

  if (collectOwns(feature).app.length > 0 || collectOwns(feature).components.length > 0) {
    gates.push('pnpm run build');
  }

  for (const gate of Array.isArray(capsuleYml?.gates) ? capsuleYml.gates : []) {
    const value = normalizeString(gate);
    if (value) gates.push(value);
  }

  return uniqueInOrder(gates);
}

function resolvePurpose(contextFrontMatter, contextBody, capsuleYml) {
  const purpose = normalizeString(capsuleYml?.purpose) || normalizeString(contextFrontMatter?.purpose) || firstParagraph(contextBody);
  return purpose || '_None._';
}

function referenceLink(reference) {
  const value = normalizeString(reference);
  if (!value) return '';
  if (/^\[[^\]]+\]\([^)]+\)$/.test(value)) return value;
  return `[${value}](${value})`;
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    fail(5, `spec/index.json not found at ${INDEX_PATH}`);
    return;
  }

  const manifest = readJson(INDEX_PATH);
  const features = Array.isArray(manifest?.features) ? manifest.features : [];
  validateManifestFeatures(features);

  const consumersByFeature = buildReverseConsumers(features);
  let generated = 0;
  let overBudget = 0;

  for (const feature of features) {
    const contextPath = resolveFeaturePath(feature, 'context.md');
    let contextRaw = '';
    if (fs.existsSync(contextPath)) {
      contextRaw = readText(contextPath);
    } else {
      // sub-feature: no context.md, fall back to lld.md
      const lldPath = feature.docs?.lld
        ? path.join(REPO_ROOT, feature.docs.lld)
        : resolveFeaturePath(feature, 'lld.md');
      contextRaw = fs.existsSync(lldPath) ? readText(lldPath) : '';
    }
    const { frontMatter: contextFrontMatter, body: contextBody } = parseFrontMatter(contextRaw);

    const capsuleYmlPath = resolveFeaturePath(feature, 'capsule.yml');
    const capsuleYml = fs.existsSync(capsuleYmlPath) ? parseCapsuleYml(readText(capsuleYmlPath)) : {};

    const sourceSha = sourceShaFor(feature, contextRaw).slice(0, 16);
    const owns = collectOwns(feature);
    const purpose = resolvePurpose(contextFrontMatter, contextBody, capsuleYml);
    const gates = buildGates(feature, capsuleYml);
    const consumedBy = [...(consumersByFeature.get(feature.id) ?? new Set())].sort((a, b) => a.localeCompare(b));
    const references = Array.isArray(capsuleYml.references) ? capsuleYml.references.map(normalizeString).filter(Boolean) : [];

    const rendered = renderCapsule({
      featureId: feature.id,
      sourceSha,
      tokens: 0,
      purpose,
      owns,
      invariants: Array.isArray(feature.invariants) ? feature.invariants.filter((value) => typeof value === 'string' && value.trim().length > 0) : [],
      consumedBy,
      gates,
      contextPath: './context.md',
      lldPath: './lld.md',
      references,
    });

    const tokens = countTokens(rendered);
    generated += 1;

    if (tokens > TOKENS_LIMIT) {
      console.log(`✗ ${feature.id}  ${tokens} tokens — OVER BUDGET`);
      overBudget += 1;
      process.exitCode = 4;
      continue;
    }

    const finalRendered = renderCapsule({
      featureId: feature.id,
      sourceSha,
      tokens,
      purpose,
      owns,
      invariants: Array.isArray(feature.invariants) ? feature.invariants.filter((value) => typeof value === 'string' && value.trim().length > 0) : [],
      consumedBy,
      gates,
      contextPath: './context.md',
      lldPath: './lld.md',
      references,
    });

    const outputPath = resolveFeaturePath(feature, 'capsule.md');
    fs.writeFileSync(outputPath, finalRendered.endsWith('\n') ? finalRendered : `${finalRendered}\n`, 'utf8');
    console.log(`✓ ${feature.id}  ${tokens} tokens`);
  }

  console.log(`Generated ${generated} capsules. ${overBudget} over budget.`);

  if (!process.exitCode) process.exitCode = 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  const errCode = typeof error?.code === 'number' ? error.code : 1;
  process.exitCode = typeof process.exitCode === 'number' ? process.exitCode : errCode;
});


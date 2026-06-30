/**
 * lib/manifest.mjs
 *
 * Atomic read/write helpers for spec/index.json. Used by apply-patch.mjs so that
 * a crash mid-write can never leave the manifest in a torn state.
 *
 * NEVER calls git. NEVER commits. Per LLD invariant #4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);
export const INDEX_PATH = path.join(REPO_ROOT, 'spec', 'index.json');

/** Read and parse spec/index.json. Throws with a human message on failure. */
export function readManifest() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`spec/index.json not found at ${INDEX_PATH}`);
  }
  const raw = fs.readFileSync(INDEX_PATH, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`spec/index.json malformed: ${e.message}`);
  }
}

/**
 * Atomic write: serialise to a temp file in the same directory, fsync, then
 * rename over the target. Renaming within a single directory is atomic on
 * NTFS and POSIX so the manifest never appears half-written to other readers.
 *
 * Preserves trailing newline to match existing file convention.
 */
export function writeManifestAtomic(manifest) {
  const json = JSON.stringify(manifest, null, 2) + '\n';
  const dir = path.dirname(INDEX_PATH);
  const tmp = path.join(dir, `.index.json.${process.pid}.${Date.now()}.tmp`);
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, json);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, INDEX_PATH);
}

/** Locate one feature by id; returns null if absent. */
export function findFeature(manifest, featureId) {
  return manifest.features.find((f) => f.id === featureId) ?? null;
}

/** Deep clone via JSON round-trip — fine for plain JSON-shaped manifest data. */
export function cloneManifest(manifest) {
  return JSON.parse(JSON.stringify(manifest));
}

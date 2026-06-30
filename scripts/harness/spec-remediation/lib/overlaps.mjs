/**
 * lib/overlaps.mjs
 *
 * Live overlap recomputation from `features[].owns[]`. Mirrors the logic in
 * scripts/harness/spec-manifest/spec-check.mjs (the Layer-1 fix from 2026-06-30).
 *
 * The merger of these two implementations is deferred until a second consumer
 * needs it — see the note in spec/harness/spec-remediation/lld.md § File layout.
 *
 * Pure function: no I/O, no globals, no surprises.
 */

/** Return every file across every bucket of a feature's owns. */
export function ownsFiles(feature) {
  return Object.values(feature.owns ?? {}).flat();
}

/**
 * Recompute overlaps from current owns[]. ADRs are skipped (they own no source).
 *
 * Returns:
 *   - count:  number of overlapping files
 *   - byFile: Array<{ file, claimedBy: string[] }>, sorted by file
 *   - byFeature: Map<featureId, number>  participation count
 */
export function computeOverlaps(manifest) {
  const owners = new Map(); // file -> Set<featureId>
  for (const f of manifest.features) {
    if (f.status === 'adr') continue;
    for (const file of ownsFiles(f)) {
      if (!owners.has(file)) owners.set(file, new Set());
      owners.get(file).add(f.id);
    }
  }

  const byFile = [];
  const byFeature = new Map();
  for (const [file, ids] of owners) {
    if (ids.size <= 1) continue;
    const claimedBy = [...ids].sort();
    byFile.push({ file, claimedBy });
    for (const id of claimedBy) {
      byFeature.set(id, (byFeature.get(id) ?? 0) + 1);
    }
  }
  byFile.sort((a, b) => a.file.localeCompare(b.file));

  return { count: byFile.length, byFile, byFeature };
}

/** Convenience: just the number, for before/after comparisons. */
export function overlapCount(manifest) {
  return computeOverlaps(manifest).count;
}

/**
 * Sum of `claimedBy.length` across every overlapping file.
 *
 * A file with N>1 claimants contributes N. This is the metric the rollback
 * gate uses: any legitimate `remove-files-from-owns` op that drops one
 * redundant ownership reduces this count by 1, even when the file remains
 * overlapping (still owned by ≥2 features). `overlapCount` alone is too
 * strict — it only decreases when the file drops to exactly one owner.
 */
export function overlapParticipations(manifest) {
  const { byFile } = computeOverlaps(manifest);
  let total = 0;
  for (const { claimedBy } of byFile) total += claimedBy.length;
  return total;
}

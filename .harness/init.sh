#!/usr/bin/env bash
# .harness/init.sh — Session start orientation for AI agents.
#
# Purpose: give the agent a fast, deterministic snapshot of "where we left off"
# without it having to read multiple files in series. Tier 1 (always OK to run).
#
# Usage:
#   bash .harness/init.sh                 # orientation only (default)
#   RUN_TYPE_CHECK=1 bash .harness/init.sh  # also run pnpm type-check baseline
#
# This script must remain side-effect free unless RUN_TYPE_CHECK=1.
# It must never start the dev server, run migrations, or modify any file.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

hr() { printf '%s\n' "------------------------------------------------------------"; }

hr
echo "==> Repository: $(basename "$ROOT_DIR")"
echo "==> Working dir: $PWD"
echo "==> Branch:     $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
hr

echo "==> Recent commits (git log --oneline -5):"
git --no-pager log --oneline -5 || true
hr

echo "==> Working-tree status (short):"
git --no-pager status -s || true
hr

echo "==> Latest progress entry (.harness/progress.md):"
if [ -f .harness/progress.md ]; then
  # Print from first '## ' heading down to the next '---' separator.
  awk '
    /^## / { found=1 }
    found && /^---[[:space:]]*$/ { exit }
    found { print }
  ' .harness/progress.md
else
  echo "(no progress.md — first session)"
fi
hr

echo "==> Active feature(s) (.harness/feature-status.json):"
if [ -f .harness/feature-status.json ]; then
  if command -v node >/dev/null 2>&1; then
    node -e '
      const fs = require("fs");
      const data = JSON.parse(fs.readFileSync(".harness/feature-status.json", "utf8"));
      const active = (data.features || []).filter(f => f.status === "in-progress" || f.status === "blocked");
      if (active.length === 0) {
        console.log("(none — pick a planned feature)");
      } else {
        for (const f of active) {
          const total = (f.verification || []).length;
          const done  = (f.verification || []).filter(v => v.passing).length;
          console.log(`  - ${f.id} [${f.status}] branch=${f.branch || "-"}  DoD ${done}/${total}`);
          if (f.blockers && f.blockers.length) console.log(`      blockers: ${f.blockers.join("; ")}`);
          if (f.spec) console.log(`      spec: ${f.spec}`);
        }
      }
    '
  else
    echo "(install Node to get a structured summary; raw file is .harness/feature-status.json)"
  fi
else
  echo "(no feature-status.json)"
fi
hr

if [ "${RUN_TYPE_CHECK:-0}" = "1" ]; then
  echo "==> Baseline: pnpm run type-check"
  pnpm run --silent type-check
  hr
fi

echo "Orientation complete. Next steps:"
echo "  1. Confirm the active feature above is what we are working on."
echo "  2. Read its spec/{domain}/{feature}/lld.md before editing code."
echo "  3. At session end: update .harness/progress.md and tick verification[] items."

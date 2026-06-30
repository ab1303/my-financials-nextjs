#!/bin/bash
# Guard rail for destructive Prisma operations
# Blocks: prisma migrate reset, prisma db push
# Requires explicit PRISMA_FORCE_APPROVED=true to override

set -e

COMMAND="$@"

# Check for destructive operations
if [[ "$COMMAND" == *"migrate reset"* ]] || [[ "$COMMAND" == *"db push"* ]]; then
  if [[ "$PRISMA_FORCE_APPROVED" != "true" ]]; then
    echo ""
    echo "================================== ⚠️  GUARD RAIL TRIGGERED =================================="
    echo ""
    echo "❌ BLOCKED: Destructive Prisma command detected"
    echo ""
    echo "   Command: npx prisma $COMMAND"
    echo ""
    echo "   ⚠️  THIS OPERATION WILL DELETE OR MODIFY DATABASE DATA"
    echo ""
    echo "   To proceed, you MUST explicitly approve by running:"
    echo ""
    echo "     PRISMA_FORCE_APPROVED=true pnpm prisma $COMMAND"
    echo ""
    echo "   This ensures you are aware of the data loss risk."
    echo ""
    echo "=================================================================================================="
    echo ""
    exit 1
  fi
  echo "✅ PRISMA_FORCE_APPROVED=true detected - proceeding with: npx prisma $COMMAND"
  echo ""
fi

# Safe to execute
npx prisma "$@"

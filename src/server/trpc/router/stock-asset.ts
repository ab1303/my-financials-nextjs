import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  createSnapshotHandler,
  getSnapshotsHandler,
  getMostRecentSnapshotHandler,
  getSnapshotByIdHandler,
  getSnapshotTotalsHandler,
  createHoldingHandler,
  updateHoldingHandler,
  deleteHoldingHandler,
  deleteSnapshotHandler,
} from '@/server/controllers/stock-asset.controller';
import {
  createStockSnapshotSchema,
  createStockHoldingSchema,
  updateStockHoldingSchema,
  deleteHoldingSchema,
  deleteSnapshotSchema,
  getSnapshotsSchema,
  getSnapshotByIdSchema,
} from '@/server/schema/stock-asset.schema';

export const stockAssetRouter = router({
  // Snapshot routes
  createSnapshot: protectedProcedure
    .input(createStockSnapshotSchema)
    .mutation(({ input, ctx: { session } }) =>
      createSnapshotHandler({ input, userId: session.user.id }),
    ),

  getSnapshots: protectedProcedure
    .input(getSnapshotsSchema)
    .query(({ input, ctx: { session } }) =>
      getSnapshotsHandler({ input, userId: session.user.id }),
    ),

  getMostRecentSnapshot: protectedProcedure
    .input(getSnapshotsSchema)
    .query(({ input, ctx: { session } }) =>
      getMostRecentSnapshotHandler({ input, userId: session.user.id }),
    ),

  getSnapshotById: protectedProcedure
    .input(getSnapshotByIdSchema)
    .query(({ input, ctx: { session } }) =>
      getSnapshotByIdHandler({ input, userId: session.user.id }),
    ),

  getSnapshotTotals: protectedProcedure
    .input(getSnapshotByIdSchema)
    .query(({ input, ctx: { session } }) =>
      getSnapshotTotalsHandler({ input, userId: session.user.id }),
    ),

  deleteSnapshot: protectedProcedure
    .input(deleteSnapshotSchema)
    .mutation(({ input, ctx: { session } }) =>
      deleteSnapshotHandler({ input, userId: session.user.id }),
    ),

  // Holding routes
  createHolding: protectedProcedure
    .input(createStockHoldingSchema)
    .mutation(({ input, ctx: { session } }) =>
      createHoldingHandler({ input, userId: session.user.id }),
    ),

  updateHolding: protectedProcedure
    .input(updateStockHoldingSchema)
    .mutation(({ input, ctx: { session } }) =>
      updateHoldingHandler({ input, userId: session.user.id }),
    ),

  deleteHolding: protectedProcedure
    .input(deleteHoldingSchema)
    .mutation(({ input, ctx: { session } }) =>
      deleteHoldingHandler({ input, userId: session.user.id }),
    ),
});

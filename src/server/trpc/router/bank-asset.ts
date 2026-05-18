import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  createBankAccountHandler,
  getBankAccountsHandler,
  createSnapshotHandler,
  getSnapshotsHandler,
  getMostRecentSnapshotHandler,
  getSnapshotByIdHandler,
  getSnapshotTotalsHandler,
  updateEntryHandler,
  deleteEntryHandler,
  deleteSnapshotHandler,
  addEntryToSnapshotHandler,
} from '@/server/controllers/bank-asset.controller';
import {
  createBankAccountSchema,
  createBankAssetSnapshotSchema,
  updateBankAssetEntrySchema,
  deleteSnapshotSchema,
  deleteEntrySchema,
  addEntryToSnapshotSchema,
  getSnapshotsSchema,
  getSnapshotByIdSchema,
  getBankAccountsSchema,
} from '@/server/schema/bank-asset.schema';

export const bankAssetRouter = router({
  // Bank Account routes
  createBankAccount: protectedProcedure
    .input(createBankAccountSchema)
    .mutation(({ input, ctx: { session } }) =>
      createBankAccountHandler({ input, userId: session.user.id }),
    ),

  getBankAccounts: protectedProcedure
    .input(getBankAccountsSchema)
    .query(({ input, ctx: { session } }) =>
      getBankAccountsHandler({ input, userId: session.user.id }),
    ),

  // Snapshot routes
  createSnapshot: protectedProcedure
    .input(createBankAssetSnapshotSchema)
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

  // Entry routes
  updateEntry: protectedProcedure
    .input(updateBankAssetEntrySchema)
    .mutation(({ input, ctx: { session } }) =>
      updateEntryHandler({ input, userId: session.user.id }),
    ),

  deleteEntry: protectedProcedure
    .input(deleteEntrySchema)
    .mutation(({ input, ctx: { session } }) =>
      deleteEntryHandler({ input, userId: session.user.id }),
    ),

  // Snapshot deletion
  deleteSnapshot: protectedProcedure
    .input(deleteSnapshotSchema)
    .mutation(({ input, ctx: { session } }) =>
      deleteSnapshotHandler({ input, userId: session.user.id }),
    ),

  addEntryToSnapshot: protectedProcedure
    .input(addEntryToSnapshotSchema)
    .mutation(({ input, ctx: { session } }) =>
      addEntryToSnapshotHandler({ input, userId: session.user.id }),
    ),
});

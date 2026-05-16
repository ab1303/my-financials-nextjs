import { getNetWorthTrendHandler } from '@/server/controllers/asset-dashboard.controller';
import { getNetWorthTrendSchema } from '@/server/schema/asset-dashboard.schema';
import { protectedProcedure, router } from '@/server/trpc/trpc';

export const assetDashboardRouter = router({
  getNetWorthTrend: protectedProcedure
    .input(getNetWorthTrendSchema)
    .query(({ input, ctx: { session } }) =>
      getNetWorthTrendHandler({
        input,
        userId: session.user.id,
      }),
    ),
});

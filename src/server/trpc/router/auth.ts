import {
  router,
  publicProcedure,
  protectedProcedure,
} from '@/server/trpc/trpc';
import { registerHandler } from '@/server/controllers/auth.controller';
import { createUserSchema } from '@/server/schema/user.schema';

export const authRouter = router({
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
  getSecretMessage: protectedProcedure.query(() => {
    return 'You are logged in and can see this secret message!';
  }),

  register: publicProcedure
    .input(createUserSchema)
    .mutation((createUserArgs) => registerHandler(createUserArgs)),
});

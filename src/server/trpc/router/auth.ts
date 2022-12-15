import { loginHandler, registerHandler } from '@/server/controllers/auth.controller';
import { loginUserSchema, createUserSchema } from '@/server/schema/user.schema';
import { router, publicProcedure, protectedProcedure } from '../trpc';

export const authRouter = router({
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
  getSecretMessage: protectedProcedure.query(() => {
    return 'You are logged in and can see this secret message!';
  }),
  login: publicProcedure
    .input(loginUserSchema)
    .mutation((loginArgs) => loginHandler(loginArgs)),
  register: publicProcedure
    .input(createUserSchema)
    .mutation((createUserArgs) => registerHandler(createUserArgs)),
});

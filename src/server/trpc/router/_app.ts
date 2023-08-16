import { router } from '@/server/trpc/trpc';
import { authRouter } from "./auth";
import { bankRouter } from "./bank";
import { exampleRouter } from "./example";

export const appRouter = router({
  example: exampleRouter,
  auth: authRouter,
  bank: bankRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

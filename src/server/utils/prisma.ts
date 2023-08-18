/**
 * Instantiates a single instance PrismaClient and save it on the global object.
 * @link https://www.prisma.io/docs/support/help-articles/nextjs-prisma-client-dev-practices
 */
import { TRPCError } from '@trpc/server';
import { env } from '../env';
import { Prisma, PrismaClient } from '@prisma/client';

const prismaGlobal = global as typeof global & {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  prismaGlobal.prisma ||
  new PrismaClient({
    log:
      env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  prismaGlobal.prisma = prisma;
}

export function handleCaughtError(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: e.message,
    });
  }
  throw e;
}

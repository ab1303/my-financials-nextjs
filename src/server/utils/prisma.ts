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

export function handleDatabaseError(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2003':
        return {
          success: false,
          error:
            'Cannot delete this record because it is referenced by other data. Please remove all related records first.',
          isReferentialIntegrityError: true,
        };
      case 'P2025':
        return {
          success: false,
          error: 'Record not found',
        };
      case 'P2002':
        return {
          success: false,
          error: 'A record with this information already exists',
        };
      default:
        return {
          success: false,
          error: 'A database error occurred',
        };
    }
  }

  return {
    success: false,
    error: 'An unexpected error occurred',
  };
}

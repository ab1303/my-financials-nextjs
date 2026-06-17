import { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from '@trpc/server';

import { env } from "../../env/server.mjs";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.LOG_PRISMA_QUERIES === 'true'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
  });

if (env.NODE_ENV !== "production") {
  global.prisma = prisma;
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

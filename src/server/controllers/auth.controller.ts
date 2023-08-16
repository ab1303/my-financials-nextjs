import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import type { CreateUserInput } from '../schema/user.schema';
import { createUser } from '../services/user.service';
import { Prisma } from '@prisma/client';

export const registerHandler = async ({
  input,
}: {
  input: CreateUserInput;
}) => {
  try {
    const hashedPassword = await bcrypt.hash(input.password, 12);
    const user = await createUser({
      email: input.email,
      password: hashedPassword,
    });

    return {
      status: 'success',
      data: {
        user,
      },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
       throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: e.message,
      });
    }
    throw e;
  }
};

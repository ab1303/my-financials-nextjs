import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import type { CreateUserInput, LoginUserInput } from '../schema/user.schema';
import { createUser, findUser } from '../services/user.service';
import type { Context } from '../trpc/context';

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
  } catch (err: any) {
    if (err.code === 11000) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Email already exists',
      });
    }
    throw err;
  }
};

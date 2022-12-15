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

export const loginHandler = async ({
  input,
  ctx,
}: {
  input: LoginUserInput;
  ctx: Context;
}) => {
  try {
    // Get the user from the collection
    const user = await findUser({ email: input.email });

    // Check if user exist and password is correct
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid email or password',
      });
    }

    // Create the Access and refresh Tokens
    
    
    /* TODO Remove; probably not required */
    
    // const { access_token } = await signTokens(user);
    // // Send Access Token in Cookie
    // ctx.res.cookie('access_token', access_token, accessTokenCookieOptions);
    // ctx.res.cookie('refresh_token', refresh_token, refreshTokenCookieOptions);
    // ctx.res.cookie('logged_in', true, {
    //   ...accessTokenCookieOptions,
    //   httpOnly: false,
    // });

    // Send Access Token
    return {
      status: 'success',
      // access_token,
    };
  } catch (err: any) {
    console.log(err);
    throw err;
  }
};

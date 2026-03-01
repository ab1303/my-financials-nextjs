import { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { findUser } from '@/server/services/user.service';
import NextAuth from 'next-auth';

const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await findUser({ email: credentials.email as string });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.user = user as typeof user & { role?: string | null };
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.user) {
        const user = token.user as typeof token.user & {
          id: string;
          role?: string | null;
        };
        session.user.id = user.id;
        session.user.role = (user.role ?? null) as typeof session.user.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);

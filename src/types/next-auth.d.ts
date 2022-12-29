import type { RoleEnumType } from '@prisma/client';
import { type DefaultUser } from 'next-auth';

type AugmentedUser = {
  id: string;
} & User;

declare module 'next-auth' {
  interface User extends Omit<DefaultUser, 'id'> {
    role: RoleEnumType | null;
  }

  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: AugmentedUser;
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    user: AugmentedUser;
  }
}

import { type DefaultSession } from 'next-auth';
import type { UserRole } from './enum';

declare module 'next-auth' {
  interface User extends DefaultSession['user'] {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: UserRole;
  }

  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
    } & User;
  }
}

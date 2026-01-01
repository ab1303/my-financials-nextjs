import type { Session } from 'next-auth';

/**
 * Mock session for testing authenticated routes
 */
export const mockSession: Session = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
  },
  expires: '2099-12-31T23:59:59.999Z',
};

/**
 * Mock session for testing unauthorized access
 */
export const mockUnauthenticatedSession: Session | null = null;

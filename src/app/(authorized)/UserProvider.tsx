'use client';

import type { AugmentedUser } from 'next-auth';
import { createContext, useContext } from 'react';

interface UserContextType {
  user: AugmentedUser;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ 
  children, 
  user 
}: { 
  children: React.ReactNode; 
  user: AugmentedUser;
}) {
  return (
    <UserContext.Provider value={{ user }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context.user;
}
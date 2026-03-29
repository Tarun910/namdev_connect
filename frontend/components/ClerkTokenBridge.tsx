import React, { useEffect, useLayoutEffect } from 'react';
import { useAuth, useClerk } from '@clerk/react';
import { setClerkSessionHandlers } from '../services/clerk-session';

const ClerkTokenBridge: React.FC = () => {
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  useLayoutEffect(() => {
    setClerkSessionHandlers(
      () => getToken(),
      () => signOut()
    );
  }, [getToken, signOut]);

  useEffect(() => {
    setClerkSessionHandlers(
      () => getToken(),
      () => signOut()
    );
  }, [getToken, signOut]);

  return null;
};

export default ClerkTokenBridge;

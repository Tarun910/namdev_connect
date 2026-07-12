import React from 'react';
import { ClerkProvider } from '@clerk/react';
import { useNavigate } from 'react-router-dom';

type Props = {
  publishableKey: string;
  children: React.ReactNode;
};

/** Clerk must sit inside HashRouter and use routerPush/replace — otherwise prod sign-in full-reloads and loops. */
const ClerkRouterProvider: React.FC<Props> = ({ publishableKey, children }) => {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
};

export default ClerkRouterProvider;

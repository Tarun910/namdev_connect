import React from 'react';
import { SignIn } from '@clerk/react';

const Login: React.FC = () => {
  return (
    <main className="flex-1 flex flex-col items-center pt-8 pb-12 px-4 min-h-screen overflow-y-auto bg-background-light dark:bg-background-dark">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
          <span className="material-symbols-outlined text-white text-5xl">favorite</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-center text-[#191011] dark:text-white">
          Namdev Samaj
          <br />
          <span className="text-primary/80">Connect</span>
        </h1>
        <p className="text-gray-500 text-sm mt-2 text-center">Sign in with Clerk</p>
      </div>

      <div className="w-full max-w-md flex justify-center">
        <SignIn
          routing="hash"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            variables: { colorPrimary: '#8e2533' },
            elements: { rootBox: 'mx-auto', card: 'shadow-lg' },
          }}
        />
      </div>

      <p className="mt-10 text-[11px] text-center text-gray-400 leading-relaxed px-6 max-w-sm">
        Authentication is handled by Clerk. Configure allowed origins in the Clerk dashboard for{' '}
        <span className="font-mono">http://localhost:3000</span>.
      </p>
    </main>
  );
};

export default Login;

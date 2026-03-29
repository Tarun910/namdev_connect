import React from 'react';

const MissingClerkKey: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#fafafa] text-[#191011]">
    <h1 className="text-xl font-bold mb-3 text-center">Clerk publishable key missing</h1>
    <p className="text-sm text-gray-600 text-center max-w-md leading-relaxed mb-4">
      Add <code className="bg-gray-200 px-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> to{' '}
      <code className="bg-gray-200 px-1 rounded">frontend/.env.local</code> (from Clerk Dashboard → API Keys →
      Publishable key). Then restart <code className="bg-gray-200 px-1 rounded">npm run dev</code>.
    </p>
    <p className="text-xs text-gray-500 text-center">
      Backend also needs <code className="bg-gray-100 px-1 rounded">CLERK_SECRET_KEY</code> and{' '}
      <code className="bg-gray-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>.
    </p>
  </div>
);

export default MissingClerkKey;

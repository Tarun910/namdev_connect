
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { authorizedFetch, invalidateApiCache } from '../services/api';
import type { PremiumPlanId, User, UserEntitlements } from '../types';

const PLANS: {
  id: PremiumPlanId;
  name: string;
  price: string;
  period: string;
  perMonth: string;
  desc: string;
  features: string[];
  highlight: boolean;
  badge?: string;
}[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '₹499',
    period: '/ month',
    perMonth: '₹499/mo',
    desc: 'Try Premium with full access — renew anytime.',
    features: [
      'Unlimited interests',
      'Unlimited chat after mutual accept',
      'See profile visitors',
      'Contact, Kundli & AI compatibility',
    ],
    highlight: false,
  },
  {
    id: '6months',
    name: '6 Months',
    price: '₹2,499',
    period: '/ 6 months',
    perMonth: '~₹416/mo',
    desc: 'Save 17% vs monthly — best for active seekers.',
    features: [
      'Everything in Monthly',
      'Priority in Discover',
      'Unlimited saved profiles',
      '6 months uninterrupted access',
    ],
    highlight: true,
    badge: 'Popular',
  },
  {
    id: '12months',
    name: '12 Months',
    price: '₹4,499',
    period: '/ year',
    perMonth: '~₹375/mo',
    desc: 'Best value — save 25% for the full year.',
    features: [
      'Everything in 6 Months',
      'Lowest cost per month',
      'Full year of Premium',
      'Ideal for serious matchmaking',
    ],
    highlight: false,
  },
];

const FLOW_STEPS = [
  { step: 'Sign Up', note: 'Free' },
  { step: 'Create Profile (basics)', note: 'Free — name, location, job, education, photo for Discover' },
  { step: 'Browse & Save', note: 'Free — up to 15 saves' },
  { step: 'Send Interest', note: 'Free — 5/month' },
  { step: 'Accept / Decline', note: 'Free' },
  { step: 'Chat', note: 'Premium — after mutual accept' },
  { step: 'Contact & Horoscope', note: 'Premium add-ons' },
];

const Membership: React.FC = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState<PremiumPlanId | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const user = await authorizedFetch<User>('/profile/me', token);
        setMe(user);
      } catch {
        /* optional */
      }
    })();
  }, [getToken]);

  const entitlements: UserEntitlements | undefined = me?.entitlements;
  const isPremium = entitlements?.isPremium ?? me?.isPremium;

  const handleChoosePlan = async (planId: PremiumPlanId) => {
    setLoading(planId);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in required');
      invalidateApiCache('/profile/me');
      await authorizedFetch<{ ok: boolean; expiresAt: string }>('/membership/subscribe', token, {
        method: 'POST',
        body: JSON.stringify({ plan: planId }),
      });
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not activate plan');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-y-auto no-scrollbar bg-background-light dark:bg-background-dark animate-fade-up">
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-10 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-primary dark:text-red-400">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold tracking-tight">Premium Plans</h2>
        <div className="size-10" />
      </header>

      <main className="flex-1 px-4 space-y-6 pb-20">
        <div className="pt-6 pb-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            {isPremium ? 'Premium Active' : 'Upgrade to Premium'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium max-w-[320px] mx-auto">
            {isPremium && entitlements?.premiumExpiresAt
              ? `Your plan is active until ${new Date(entitlements.premiumExpiresAt).toLocaleDateString()}.`
              : 'Unlock unlimited interests, chat, contact details, Kundli Milan, and profile visitors.'}
          </p>
        </div>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <h4 className="text-primary dark:text-red-400 text-xs font-extrabold uppercase tracking-widest mb-3">
            How it works
          </h4>
          <ol className="space-y-2">
            {FLOW_STEPS.map((item, i) => (
              <li key={item.step} className="flex gap-3 text-sm">
                <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">{item.step}</span>
                  <span className="text-gray-500 dark:text-gray-400"> — {item.note}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {error && (
          <p className="text-center text-sm font-bold text-red-600 dark:text-red-400 px-2">{error}</p>
        )}

        <div className="flex flex-col gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-6 transition-all ${
                plan.highlight
                  ? 'bg-orange-50 dark:bg-orange-900/10 border-saffron shadow-xl scale-[1.02] z-10'
                  : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm'
              }`}
            >
              {plan.badge && (
                <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-black uppercase px-4 py-1 rounded-bl-lg tracking-widest">
                  {plan.badge}
                </div>
              )}
              <div className="mb-4">
                <h3
                  className={`text-sm font-bold uppercase tracking-tighter ${plan.highlight ? 'text-saffron' : 'text-gray-400'}`}
                >
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-gray-900 dark:text-white">{plan.price}</span>
                  <span className="text-sm font-semibold text-gray-500">{plan.period}</span>
                </div>
                <p className="text-xs text-saffron font-bold mt-1">{plan.perMonth}</p>
              </div>
              <p className="text-xs text-gray-500 mb-6 italic">{plan.desc}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm font-medium">
                    <span
                      className={`material-symbols-outlined text-[20px] ${plan.highlight ? 'text-saffron' : 'text-primary'}`}
                    >
                      check_circle
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => void handleChoosePlan(plan.id)}
                disabled={loading !== null || isPremium}
                className={`w-full py-4 rounded-lg font-bold transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 ${
                  plan.highlight
                    ? 'bg-primary text-white shadow-primary/20'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                {loading === plan.id ? (
                  <div className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isPremium ? (
                  'Already Premium'
                ) : (
                  <>Choose {plan.name}</>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 mb-8 flex flex-col items-center gap-4 pb-10">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center max-w-[280px] leading-relaxed">
            Payment gateway integration coming soon. Plans activate securely on our server — premium status
            cannot be set from the app client.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Membership;

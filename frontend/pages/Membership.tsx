
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const Membership: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const plans = [
    { id: 'silver', name: 'Silver', price: '₹999', period: '/ month', desc: 'Perfect for exploring the platform.', features: ['10 Requests per day', 'See Profile Visitors', 'Basic Support'], highlight: false },
    { id: 'gold', name: 'Gold', price: '₹2499', period: '/ quarter', desc: 'Our most popular community choice.', features: ['Unlimited Requests', 'Direct Chat Access', 'Profile Highlighting', 'Priority Placement'], highlight: true, badge: 'Best Value' },
    { id: 'platinum', name: 'Platinum', price: '₹7999', period: '/ year', desc: 'For the most serious seekers.', features: ['All Gold Features', 'Personal Relationship Manager', 'Verified Premium Badge'], highlight: false }
  ];

  const handleChoosePlan = async (planId: string) => {
    setLoading(planId);
    try {
      await api.profile.update({ isPremium: true });
      // Simulate payment delay
      await new Promise(r => setTimeout(r, 1500));
      navigate('/dashboard');
    } catch (e) {
      console.error(e);
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
        <h2 className="text-lg font-bold tracking-tight">Membership Plans</h2>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 px-4 space-y-6 pb-20">
        <div className="pt-6 pb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Upgrade Your Experience</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium max-w-[280px] mx-auto">
            Invest in your future within the <span className="text-primary font-bold">Namdev Samaj</span> community.
          </p>
        </div>

        <h4 className="text-primary dark:text-red-400 text-xs font-extrabold uppercase tracking-widest text-center">Why Go Premium?</h4>

        <div className="flex flex-col gap-6">
          {plans.map((plan) => (
            <div 
              key={plan.name}
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
                <h3 className={`text-sm font-bold uppercase tracking-tighter ${plan.highlight ? 'text-saffron' : 'text-gray-400'}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-gray-900 dark:text-white">{plan.price}</span>
                  <span className="text-sm font-semibold text-gray-500">{plan.period}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-6 italic">{plan.desc}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm font-medium">
                    <span className={`material-symbols-outlined text-[20px] ${plan.highlight ? 'text-saffron' : 'text-primary'}`}>check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => handleChoosePlan(plan.id)}
                disabled={loading !== null}
                className={`w-full py-4 rounded-lg font-bold transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 ${
                  plan.highlight 
                    ? 'bg-primary text-white shadow-primary/20' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                {loading === plan.id ? (
                  <div className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Choose {plan.name} Plan</>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 mb-8 flex flex-col items-center gap-6 pb-10">
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className="size-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400">shield</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Secure Payment</span>
            </div>
            <div className="w-[1px] h-8 bg-gray-200 dark:bg-gray-800"></div>
            <div className="flex flex-col items-center gap-2">
              <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">published_with_changes</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Refund Policy</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center max-w-[240px] leading-relaxed">
            By choosing a plan, you agree to our Terms of Service and Community Guidelines.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Membership;

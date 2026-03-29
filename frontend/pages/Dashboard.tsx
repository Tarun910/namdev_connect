import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { authorizedFetch } from '../services/api';
import { User, AppNotification, Profile } from '../types';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';

interface Props {
  onToggleTheme: () => void;
  isDark: boolean;
}

function profileCompletionPercent(u: User): number {
  const checks = [
    !!(u.name?.trim() && u.name !== 'Member'),
    !!u.location?.trim(),
    !!u.profession?.trim(),
    !!u.education?.trim(),
    !!u.bio?.trim(),
    !!(u.phone && u.phone.replace(/\D/g, '').length >= 10),
    !!u.height?.trim(),
    !!u.gotra?.trim(),
    !!((u.galleryUrls?.length ?? 0) > 0 || !!u.imageUrl?.trim()),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function displayFirstName(u: User): string {
  if (u.name?.trim() && u.name !== 'Member') return u.name.split(' ')[0];
  if (u.email?.includes('@')) return u.email.split('@')[0];
  return 'there';
}

const Dashboard: React.FC<Props> = ({ onToggleTheme, isDark }) => {
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [matchProfiles, setMatchProfiles] = useState<Profile[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoadError(null);
    setDataLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadError('Could not get a session token. Try signing out and back in.');
        setDataLoading(false);
        return;
      }
      const [userData, notifs, profiles] = await Promise.all([
        authorizedFetch<User>('/profile/me', token),
        authorizedFetch<AppNotification[]>('/notifications', token),
        authorizedFetch<Profile[]>('/profiles', token),
      ]);
      setUser(userData);
      setNotifications(notifs);
      setMatchProfiles(profiles);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard';
      setLoadError(msg);
      setUser(null);
    } finally {
      setDataLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    void loadDashboard();
  }, [isLoaded, isSignedIn, navigate, loadDashboard]);

  const handleLogout = async () => {
    const { clerkSignOut } = await import('../services/clerk-session');
    await clerkSignOut();
    navigate('/login');
  };

  if (!isLoaded || (isSignedIn && dataLoading && !user && !loadError)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark px-6">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">
          {!isLoaded ? 'Starting…' : `Loading ${t('dashboard')}`}
        </p>
      </div>
    );
  }

  if (loadError && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark px-6 text-center">
        <span className="material-symbols-outlined text-5xl text-amber-500 mb-3">cloud_off</span>
        <h2 className="text-lg font-bold text-[#191011] dark:text-white mb-2">Couldn&apos;t load your dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-1">{loadError}</p>
        <p className="text-xs text-gray-400 max-w-sm mb-6">
          <strong>Schema cache / clerk_user_id:</strong> Supabase → SQL Editor → paste{' '}
          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">supabase/manual/fix_clerk_user_id_schema_cache.sql</code> → Run → wait ~20s → Retry. Full Clerk migration:{' '}
          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">002_clerk_auth.sql</code>. Project must match{' '}
          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">SUPABASE_URL</code>.{' '}
          <a className="text-primary underline" href="https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema" target="_blank" rel="noreferrer">
            Refresh PostgREST schema
          </a>
          . Env: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">http://localhost:5000/</code>
        </p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const completion = profileCompletionPercent(user);
  const ringCirc = 2 * Math.PI * 40;
  const ringOffset = ringCirc * (1 - completion / 100);
  const firstName = displayFirstName(user);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const needsProfileSetup = completion < 60;

  return (
    <div className="flex flex-col min-h-screen animate-fade-up">
      {needsProfileSetup && (
        <div className="mx-4 mt-3 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/25 px-4 py-3 flex gap-3 items-start">
          <span className="material-symbols-outlined text-primary shrink-0 mt-0.5">person_add</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#191011] dark:text-white">Set up your profile next</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
              You&apos;re on your dashboard. Add details so others can discover you — tap below anytime.
            </p>
            <button
              type="button"
              onClick={() => navigate('/complete-profile')}
              className="mt-2 text-xs font-bold text-primary uppercase tracking-wide"
            >
              {t('complete_profile')} →
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md flex items-center p-4 justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/complete-profile')}
            className="relative size-10 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/20 cursor-pointer active:scale-90 transition-transform"
          >
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover w-full h-full"
              style={{
                backgroundImage: `url(${user.imageUrl || 'https://picsum.photos/100/100?seed=myprofile'})`,
              }}
            />
            {/* Photo verification badge (delayed — enable with Complete Profile verification UI)
            {user.isVerified && (
              <span
                className="absolute -bottom-0.5 -right-0.5 size-[18px] rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-gray-900 shadow"
                title={t('verified')}
              >
                <span className="material-symbols-outlined text-[13px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </span>
            )}
            */}
          </div>
          <div>
            <h2 className="text-[#191011] dark:text-white text-lg font-extrabold leading-tight tracking-tight">
              {t('welcome')}, {firstName}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">{t('dashboard')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleTheme}
            className="flex size-10 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
            title="Toggle Theme"
            type="button"
          >
            <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="relative flex size-10 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
            type="button"
          >
            <span className="material-symbols-outlined text-primary text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 size-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex size-10 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
            title={t('logout')}
            type="button"
          >
            <span className="material-symbols-outlined text-red-500">power_settings_new</span>
          </button>
        </div>
      </header>

      <main className="flex-1 pb-24">
        <div className="p-4">
          <div className="relative overflow-hidden flex items-center justify-between gap-6 rounded-xl bg-white dark:bg-gray-800 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col gap-2 z-10">
              <div className="flex flex-col gap-1">
                <p className="text-primary text-xs font-bold uppercase tracking-widest">{t('profile_status')}</p>
                <p className="text-[#191011] dark:text-white text-xl font-extrabold leading-tight">
                  {needsProfileSetup ? 'Finish your profile' : t('complete_profile')}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed">
                  {needsProfileSetup
                    ? 'Add location, profession, and a short bio — then explore Discover.'
                    : 'Boost matches by 3x with verification'}
                </p>
              </div>
              <button
                onClick={() => navigate('/complete-profile')}
                className="mt-2 flex items-center justify-center rounded-lg h-10 px-6 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                type="button"
              >
                {needsProfileSetup ? t('update_profile') : t('settings')}
              </button>
            </div>
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="size-24 transform -rotate-90">
                <circle
                  className="text-gray-100 dark:text-gray-700"
                  cx="48"
                  cy="48"
                  fill="transparent"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                />
                <circle
                  className="text-primary"
                  cx="48"
                  cy="48"
                  fill="transparent"
                  r="40"
                  stroke="currentColor"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  strokeWidth="8"
                />
              </svg>
              <span className="absolute text-primary font-extrabold text-lg">{completion}%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 px-4">
          {[
            { icon: 'favorite', label: t('send_interest').split(' ')[0], val: '12', color: 'bg-primary/10 text-primary' },
            { icon: 'visibility', label: t('views'), val: '48', color: 'bg-blue-50 text-blue-600' },
            { icon: 'pending_actions', label: 'Pending', val: '5', color: 'bg-orange-50 text-orange-600' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-1 min-w-[100px] flex-col gap-3 rounded-2xl p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"
            >
              <div className={`flex size-10 items-center justify-center rounded-xl ${stat.color}`}>
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                <p className="text-[#191011] dark:text-white text-2xl font-extrabold">{stat.val}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 pb-2 pt-8">
          <h3 className="text-[#191011] dark:text-white text-xl font-extrabold tracking-tight">{t('matches')}</h3>
          <button type="button" className="text-primary text-sm font-bold" onClick={() => navigate('/discover')}>
            {t('discover')}
          </button>
        </div>
        <div className="flex w-full overflow-hidden px-4 py-3">
          <div className="flex flex-row items-start justify-start gap-6 overflow-x-auto no-scrollbar pb-2">
            {matchProfiles.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                No other profiles yet. Complete yours, then invite friends or check back later.
              </p>
            ) : (
              matchProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/profile/${p.id}`)}
                  className="flex flex-col items-center gap-2 min-w-[72px] active:scale-95 transition-transform"
                >
                  <div className="relative size-16">
                    <div
                      className="w-full h-full bg-center bg-no-repeat bg-cover rounded-full ring-2 ring-primary ring-offset-2 dark:ring-offset-background-dark"
                      style={{ backgroundImage: `url(${p.imageUrl})` }}
                    />
                    <div className="absolute bottom-0 right-0 size-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                  </div>
                  <p className="text-[#191011] dark:text-white text-[13px] font-bold truncate w-full text-center">
                    {p.name.split(' ')[0]}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-4 pt-6">
          <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-xl shadow-primary/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-saffron fill-current">workspace_premium</span>
                <p className="text-xs font-bold uppercase tracking-widest text-white/90">
                  {t('premium')} {user.isPremium && 'Active'}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-2xl font-extrabold leading-tight">
                  {user.isPremium ? 'Welcome Premium Member' : 'Unlock Premium Features'}
                </h4>
                <p className="text-white/80 text-sm leading-relaxed">
                  {user.isPremium
                    ? 'Enjoy unlimited profile views and direct contact access for all community members.'
                    : 'See who viewed your profile & send unlimited interests.'}
                </p>
              </div>
              {!user.isPremium && (
                <button
                  type="button"
                  onClick={() => navigate('/membership')}
                  className="w-full h-12 flex items-center justify-center rounded-xl bg-white text-primary font-extrabold text-base transition-transform active:scale-95"
                >
                  {t('view_plans')}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-start justify-center pt-20 px-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center transform animate-in slide-in-from-top-10 duration-500">
            <div className="w-24 h-24 bg-primary/5 dark:bg-primary/10 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 animate-[spin_10s_linear_infinite]" />
              <span
                className="material-symbols-outlined text-primary text-5xl"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
              >
                door_open
              </span>
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-saffron rounded-full flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-white text-lg">sentiment_dissatisfied</span>
              </div>
            </div>

            <h1 className="font-poppins text-2xl font-bold text-[#191011] dark:text-white mb-2">{t('logout')}?</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8 max-w-[240px]">
              {t('logout_confirm')} <br />
              <span className="font-semibold text-primary/80">{t('miss_you')}</span>
            </p>

            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full bg-primary hover:bg-primary/90 text-white font-poppins font-semibold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
              >
                {t('logout')}
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full bg-transparent border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-poppins font-semibold py-4 rounded-2xl transition-all active:scale-[0.98]"
              >
                {t('stay_logged_in')}
              </button>
            </div>

            <div className="mt-8 w-12 h-1 bg-gray-200 dark:bg-white/10 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

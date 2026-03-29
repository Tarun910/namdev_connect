import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Show, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';
import { authorizedFetch } from '../services/api';
import type { AppNotification, Profile, User } from '../types';

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

const Home: React.FC<Props> = ({ onToggleTheme, isDark }) => {
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [me, setMe] = useState<User | null>(null);
  const [featured, setFeatured] = useState<Profile[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const needsProfileSetup = useMemo(() => {
    if (!me) return true;
    return profileCompletionPercent(me) < 60;
  }, [me]);

  const loadFeatured = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setNotifications([]);
      return;
    }
    setLoadingFeatured(true);
    try {
      const token = await getToken();
      if (!token) return;
      const [meUser, profiles, notifs] = await Promise.all([
        authorizedFetch<User>('/profile/me', token),
        authorizedFetch<Profile[]>('/profiles', token),
        authorizedFetch<AppNotification[]>('/notifications', token),
      ]);
      setMe(meUser);
      setFeatured((profiles ?? []).slice(0, 4));
      setNotifications(notifs ?? []);
    } catch {
      // Keep marketing UI usable even if API fails.
      setFeatured([]);
      setNotifications([]);
    } finally {
      setLoadingFeatured(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    void loadFeatured();
  }, [loadFeatured]);

  const handleCreateProfile = useCallback(() => {
    // Avoid the “infinite load” feeling by routing correctly based on auth state.
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    navigate('/complete-profile');
  }, [isLoaded, isSignedIn, navigate]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark animate-fade-up">
      <header className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center p-4 justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">favorite</span>
            </div>
            <h2 className="text-[#191011] dark:text-white text-lg font-extrabold leading-tight tracking-tight">Namdev Connect</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={onToggleTheme}
              className="flex size-9 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-gray-600 dark:text-gray-300 text-[20px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="text-primary dark:text-saffron text-sm font-bold tracking-wide uppercase px-2 py-1 rounded-lg hover:bg-primary/5 dark:hover:bg-white/5"
                >
                  {t('sign_in')}
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  Sign up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="relative flex size-9 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
                aria-label={t('notifications')}
              >
                <span className="material-symbols-outlined text-primary text-[22px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <UserButton afterSignOutUrl="/#" />
            </Show>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-8 pb-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl h-[420px] flex flex-col justify-end p-6 group">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" 
            style={{ 
              backgroundImage: "linear-gradient(to top, rgba(142, 37, 51, 0.95) 0%, rgba(0, 0, 0, 0.3) 60%, rgba(0, 0, 0, 0.1) 100%), url('https://lh3.googleusercontent.com/aida-public/AB6AXuCiGH3-XOzuF8P3lcjcBDlN8QJQZdyAwhHFsAcjbqDt4H5MBf5qpnT232VxEixpJvGonffPwDbTb0NE4GKPnezxR_5ld7Pfw7m5OYAPrkH11e7duJE6m3o4xsP1jF9f1ZZm2K-VRZybJ_AqBEekgWZ_XPjueWFJN9xjlhA6DI6XT7o2MVwU8L-ILws5wz_t_LJ5BfbApkMM6rSEDcQmrjac02JHFfMuFV7cj3L69TKtOQXi2o_nJe3ldXTRF_w4KwLSgcBfgA9slTY')" 
            }}
          />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="space-y-2">
              <span className="inline-block px-3 py-1 bg-saffron/30 text-white text-[10px] font-black rounded-full uppercase tracking-widest border border-white/20">{t('community_focused')}</span>
              <h1 className="text-white text-3xl font-extrabold leading-tight tracking-tight drop-shadow-lg">
                {t('hero_title')}
              </h1>
              <p className="text-white/90 text-sm font-medium leading-relaxed">
                {t('hero_desc')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {(!isSignedIn || needsProfileSetup) && (
                <button
                  onClick={handleCreateProfile}
                  className="flex-1 bg-white text-primary hover:bg-gray-100 h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-black/20"
                  type="button"
                >
                  {t('create_profile')}
                </button>
              )}
              <button 
                onClick={() => navigate('/discover')}
                className={`${(!isSignedIn || needsProfileSetup) ? 'flex-1' : 'w-full'} bg-primary/20 backdrop-blur-md border border-white/20 text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95`}
                type="button"
              >
                {t('matches')}
              </button>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section>
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="text-primary dark:text-red-400 font-bold text-xs uppercase tracking-widest mb-1">{t('process')}</span>
            <h3 className="text-2xl font-extrabold dark:text-white">{t('how_it_works')}</h3>
            <div className="w-12 h-1 bg-saffron rounded-full mt-2"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: 'person_add', label: 'Register', desc: 'Join and build your comprehensive profile.', bg: 'bg-primary/10', color: 'text-primary dark:text-red-400' },
              { icon: 'search_check', label: 'Discover', desc: 'Find highly compatible matches easily.', bg: 'bg-saffron/10', color: 'text-saffron' },
              { icon: 'forum', label: 'Connect', desc: 'Start safe, meaningful chats today.', bg: 'bg-primary/10', color: 'text-primary dark:text-red-400' }
            ].map((step) => (
              <div key={step.label} className="flex flex-col items-center text-center p-5 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-sm transition-transform hover:translate-y-[-4px]">
                <div className={`w-14 h-14 rounded-full ${step.bg} ${step.color} flex items-center justify-center mb-4`}>
                  <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                </div>
                <h4 className="text-base font-bold mb-2 dark:text-white">{step.label}</h4>
                <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Profiles */}
        <section>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-[#191011] dark:text-white">{t('featured_profiles')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('featured_profiles_sub')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="text-[10px] font-black uppercase tracking-widest text-primary"
            >
              {t('view_all')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {loadingFeatured && (
              <>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 overflow-hidden animate-pulse"
                  >
                    <div className="h-36 bg-gray-200 dark:bg-gray-700" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                ))}
              </>
            )}

            {!loadingFeatured && isSignedIn && featured.length > 0 && (
              <>
                {featured.slice(0, 2).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate(`/profile/${p.id}`)}
                    className="rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 overflow-hidden text-left active:scale-[0.99] transition-transform"
                  >
                    <div
                      className="h-36 bg-cover bg-center"
                      style={{ backgroundImage: `url(${p.imageUrl})` }}
                    />
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-black text-sm text-[#191011] dark:text-white truncate">{p.name}</p>
                        {p.isVerified && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                            {t('verified')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {p.location} • {p.profession}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {!loadingFeatured && (!isSignedIn || featured.length === 0) && (
              <>
                {[0, 1].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => navigate(isSignedIn ? '/discover' : '/login')}
                    className="rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 overflow-hidden text-left"
                  >
                    <div className="h-36 bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-500">
                        lock
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-black text-sm text-[#191011] dark:text-white truncate">
                        {t('featured_locked_title')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {t('featured_locked_sub')}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </section>

        {/* Trust Badge */}
        <section>
          <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-6 flex items-center gap-5 border border-primary/10 shadow-inner">
            <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white text-2xl">security</span>
            </div>
            <div>
              <h4 className="font-bold text-base dark:text-white">{t('privacy_priority')}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                {t('security_desc')}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;

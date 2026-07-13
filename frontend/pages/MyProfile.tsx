import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { authorizedFetch, authorizedFetchCached } from '../services/api';
import { profilePhotoUrl } from '../services/profilePhoto';
import { User } from '../types';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';

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
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function displayValue(value: string | number | undefined | null, fallback = '—'): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

const MyProfile: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);

  const [user, setUser] = useState<User | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoadError(null);
    setInitialLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadError('Sign in required');
        return;
      }
      const me = await authorizedFetchCached<User>('/profile/me', token);
      setUser(me);
      setPhotoIdx(0);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load profile');
      setUser(null);
    } finally {
      setInitialLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    void loadProfile();
  }, [isLoaded, isSignedIn, navigate, loadProfile]);

  const photoSlides = useMemo(() => {
    if (!user) return [];
    const g = user.galleryUrls?.filter((u) => u?.trim()) ?? [];
    if (g.length > 0) return g;
    const primary = user.imageUrl?.trim() || profilePhotoUrl(user);
    return primary ? [primary] : [];
  }, [user]);

  if (!isLoaded || initialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('loading')}</p>
      </div>
    );
  }

  if (loadError || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark px-6 text-center">
        <span className="material-symbols-outlined text-5xl text-amber-500 mb-3">cloud_off</span>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{loadError ?? 'Profile not found'}</p>
        <button
          type="button"
          onClick={() => void loadProfile()}
          className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  const heroUrl =
    photoSlides[Math.min(photoIdx, Math.max(0, photoSlides.length - 1))] || profilePhotoUrl(user);
  const completion = user.entitlements?.profileCompletionPercent ?? profileCompletionPercent(user);
  const needsSetup = !(user.entitlements?.discoverable ?? completion >= 56);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark animate-fade-up pb-24">
      <header className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md flex items-center px-4 py-4 justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-xl">person</span>
          </div>
          <h2 className="text-[#191011] dark:text-white text-lg font-extrabold truncate">{t('profile')}</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/complete-profile')}
          aria-label={t('edit_profile')}
          className="flex items-center justify-center size-10 rounded-full bg-primary text-white shadow-lg shadow-primary/25 active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-[22px]">edit</span>
        </button>
      </header>

      {needsSetup && (
        <div className="mx-4 mt-3 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/25 px-4 py-3 flex gap-3 items-start">
          <span className="material-symbols-outlined text-primary shrink-0 mt-0.5">info</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#191011] dark:text-white">Complete your profile</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              {completion}% done — tap the edit icon to add your details.
            </p>
          </div>
        </div>
      )}

      <div className="relative w-full aspect-[4/5] max-h-[420px] overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img src={heroUrl} alt="" className="w-full h-full object-cover" />
        {photoSlides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-black/35 text-white flex items-center justify-center backdrop-blur-md border border-white/20"
              onClick={() => setPhotoIdx((i) => (i <= 0 ? photoSlides.length - 1 : i - 1))}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              type="button"
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-black/35 text-white flex items-center justify-center backdrop-blur-md border border-white/20"
              onClick={() => setPhotoIdx((i) => (i >= photoSlides.length - 1 ? 0 : i + 1))}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
              {photoSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === photoIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/55'}`}
                  onClick={() => setPhotoIdx(i)}
                />
              ))}
            </div>
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent" />
      </div>

      <main className="px-5 -mt-8 relative z-10 space-y-6 pb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-[#191011] dark:text-white">
              {displayValue(user.name, 'Member')}
              {user.age ? `, ${user.age}` : ''}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 font-bold mt-1">
              {displayValue(user.location)}
              {user.profession ? ` · ${user.profession}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{completion}%</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase">Complete</p>
          </div>
        </div>

        {user.bio && (
          <div className="bg-primary text-white rounded-3xl p-5 shadow-xl shadow-primary/20">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-saffron">format_quote</span>
              <p className="text-sm font-semibold leading-relaxed italic">&ldquo;{user.bio}&rdquo;</p>
            </div>
          </div>
        )}

        <section className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t('personal_professional')}</p>
          {[
            { label: 'Gender', value: user.gender, icon: 'wc' },
            { label: t('Height'), value: user.height, icon: 'straighten' },
            { label: t('Education'), value: user.education, icon: 'school' },
            { label: t('Profession'), value: user.profession, icon: 'work' },
            { label: t('Annual Income'), value: user.income, icon: 'payments' },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">{row.icon}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{row.label}</p>
                <p className="text-sm font-black text-[#191011] dark:text-white">{displayValue(row.value)}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t('family_roots')}</p>
          {[
            { label: "Father's Name", value: user.fatherName, icon: 'person_4' },
            { label: "Mother's Name", value: user.motherName, icon: 'person_3' },
            { label: 'Gotra', value: user.gotra, icon: 'diversity_3' },
            { label: 'Birth date', value: user.birthDate, icon: 'cake' },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">{row.icon}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{row.label}</p>
                <p className="text-sm font-black text-[#191011] dark:text-white">{displayValue(row.value)}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t('lifestyle_alignment')}</p>
          {[
            { label: t('dietary_habits'), value: user.diet, icon: 'restaurant' },
            { label: t('smoking_alcohol'), value: user.smokeAlcohol, icon: 'smoke_free' },
            { label: t('daily_routine'), value: user.routine, icon: 'schedule' },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">{row.icon}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{row.label}</p>
                <p className="text-sm font-black text-[#191011] dark:text-white">{displayValue(row.value)}</p>
              </div>
            </div>
          ))}
        </section>

        {(user.interests?.length ?? 0) > 0 && (
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 px-1">{t('common_interests')}</p>
            <div className="flex flex-wrap gap-2">
              {user.interests!.map((interest) => (
                <span
                  key={interest}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-300"
                >
                  {interest}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t('contact_info')}</p>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">call</span>
            <p className="text-sm font-bold text-[#191011] dark:text-white">{displayValue(user.phone)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">mail</span>
            <p className="text-sm font-bold text-[#191011] dark:text-white">{displayValue(user.email)}</p>
          </div>
        </section>

        <button
          type="button"
          onClick={() => navigate('/complete-profile')}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-transform uppercase tracking-widest text-sm"
        >
          <span className="material-symbols-outlined">edit</span>
          {t('edit_profile')}
        </button>
      </main>
    </div>
  );
};

export default MyProfile;

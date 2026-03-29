import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { authorizedFetch } from '../services/api';
import { User, Profile } from '../types';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';

const ProfileDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteHint, setFavoriteHint] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setInitialLoad(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadError('Sign in required');
        return;
      }
      const [p, me] = await Promise.all([
        authorizedFetch<Profile>(`/profile/${encodeURIComponent(id)}`, token),
        authorizedFetch<User>('/profile/me', token),
      ]);
      setProfile(p);
      setCurrentUser(me);
      setIsSaved(Boolean(p.isSaved));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load profile');
      setProfile(null);
    } finally {
      setInitialLoad(false);
    }
  }, [id, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    void loadPage();
  }, [isLoaded, isSignedIn, navigate, loadPage]);

  useEffect(() => {
    setPhotoIdx(0);
  }, [id, profile?.id]);

  const toggleFavorite = async () => {
    if (!profile || !id || savingFavorite) return;
    const isOwn = currentUser?.id === profile.id;
    if (isOwn) return;
    const token = await getToken();
    if (!token) return;
    setSavingFavorite(true);
    setFavoriteHint(null);
    try {
      if (isSaved) {
        await authorizedFetch(`/saved-interests/${encodeURIComponent(id)}`, token, {
          method: 'DELETE',
        });
        setIsSaved(false);
        setFavoriteHint(t('heart_removed'));
      } else {
        await authorizedFetch('/saved-interests', token, {
          method: 'POST',
          body: JSON.stringify({ targetProfileId: id }),
        });
        setIsSaved(true);
        setFavoriteHint(t('heart_saved'));
      }
    } catch (e) {
      setFavoriteHint(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setSavingFavorite(false);
      window.setTimeout(() => setFavoriteHint(null), 2200);
    }
  };

  const photoSlides = useMemo(() => {
    if (!profile) return [];
    const g = profile.galleryUrls?.filter((u) => u?.trim()) ?? [];
    if (g.length > 0) return g;
    return profile.imageUrl ? [profile.imageUrl] : [];
  }, [profile]);

  if (initialLoad || !isLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{t('loading')}</p>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark px-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{loadError ?? 'Not found'}</p>
        <button
          type="button"
          onClick={() => void loadPage()}
          className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const isPremiumUser = currentUser?.isPremium;
  const heroUrl =
    photoSlides[Math.min(photoIdx, Math.max(0, photoSlides.length - 1))] ||
    profile.imageUrl;

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark animate-fade-up">
      {/* Top Nav */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 max-w-md mx-auto pointer-events-none">
        <button 
          onClick={() => navigate(-1)}
          className="bg-black/40 backdrop-blur-lg rounded-full p-2 text-white border border-white/20 active:scale-90 transition-transform pointer-events-auto"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <div className="flex flex-col items-end gap-1 pointer-events-auto">
          {!isOwnProfile && (
            <button
              type="button"
              disabled={savingFavorite}
              onClick={() => void toggleFavorite()}
              className="bg-black/40 backdrop-blur-lg rounded-full p-2 text-white border border-white/20 disabled:opacity-50 active:scale-95 transition-transform"
              title={isSaved ? t('heart_removed') : t('heart_saved')}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}
              >
                favorite
              </span>
            </button>
          )}
          {favoriteHint && (
            <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded-lg max-w-[10rem] text-center leading-tight">
              {favoriteHint}
            </span>
          )}
        </div>
      </div>

      {/* Hero Image Section (multi-photo) */}
      <div className="relative w-full aspect-[4/5] overflow-hidden">
        <div
          className="w-full h-full bg-center bg-no-repeat bg-cover"
          style={{ backgroundImage: `url(${heroUrl})` }}
        />
        {photoSlides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 size-11 rounded-full bg-black/35 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto border border-white/20"
              onClick={() =>
                setPhotoIdx((i) => (i <= 0 ? photoSlides.length - 1 : i - 1))
              }
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              type="button"
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 size-11 rounded-full bg-black/35 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto border border-white/20"
              onClick={() =>
                setPhotoIdx((i) => (i >= photoSlides.length - 1 ? 0 : i + 1))
              }
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <div className="absolute bottom-24 left-0 right-0 z-10 flex justify-center gap-1 pointer-events-auto">
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
        <div className="absolute inset-0 bg-gradient-to-t from-background-light dark:from-background-dark via-transparent to-transparent"></div>
        <div className="absolute bottom-12 left-6 right-6 flex flex-col items-start gap-2">
          {profile.isVerified && (
            <div className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-[0.1em] border border-white/20 shadow-lg">
              <span className="material-symbols-outlined text-[14px] font-[variation-settings:'FILL' 1]">verified</span>
              {t('verified').toUpperCase()}
            </div>
          )}
          <h1 className="text-4xl font-extrabold text-[#1a0f11] dark:text-white drop-shadow-sm">{profile.name}, {profile.age}</h1>
          <p className="text-gray-600 dark:text-white/80 font-bold text-lg">{t(profile.location)}</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-5 -mt-6 relative z-10 space-y-8 pb-80">
        {/* Bio */}
        <div className="bg-primary text-white rounded-3xl p-6 shadow-xl shadow-primary/20">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-saffron scale-150">format_quote</span>
            <p className="text-sm font-semibold leading-relaxed opacity-95 italic">
              "{profile.bio || 'Building a life of shared values and happiness.'}"
            </p>
          </div>
        </div>

        {/* Lifestyle Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="material-symbols-outlined text-primary text-2xl">style</span>
            <h3 className="text-sm font-black text-primary uppercase tracking-[0.15em]">{t('lifestyle_alignment')}</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 gap-6">
            <div className="flex items-center gap-4">
              <div className="size-11 rounded-2xl bg-primary/5 dark:bg-primary/20 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">restaurant</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{t('dietary_habits')}</p>
                <p className="text-base font-black text-[#1a0f11] dark:text-white">{profile.diet || 'Vegetarian'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="size-11 rounded-2xl bg-primary/5 dark:bg-primary/20 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">smoke_free</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{t('smoking_alcohol')}</p>
                <p className="text-base font-black text-[#1a0f11] dark:text-white">{profile.smokeAlcohol || 'Non-smoker & Non-drinker'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="size-11 rounded-2xl bg-primary/5 dark:bg-primary/20 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">schedule</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{t('daily_routine')}</p>
                <p className="text-base font-black text-[#1a0f11] dark:text-white">{profile.routine || 'Normal Routine'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Interests Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="material-symbols-outlined text-primary text-2xl">interests</span>
            <h3 className="text-sm font-black text-primary uppercase tracking-[0.15em]">{t('common_interests')}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {(profile.interests || ['Reading', 'Travel', 'Music', 'Cooking']).map((interest) => (
              <span 
                key={interest}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm"
              >
                {interest}
              </span>
            ))}
          </div>
        </section>

        {/* Roots & Family */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="material-symbols-outlined text-primary text-2xl">family_history</span>
            <h3 className="text-sm font-black text-primary uppercase tracking-[0.15em]">{t('family_roots')}</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
            {[
              { label: t("Father's Name"), value: profile.fatherName || 'Mr. Ashok Namdev', icon: 'person_4' },
              { label: t("Mother's Name"), value: profile.motherName || 'Mrs. Sunita Namdev', icon: 'person_3' },
              { label: "Gotra", value: t(profile.gotra || 'Goyal'), icon: 'diversity_3', highlighted: true }
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <div className={`size-11 rounded-2xl flex items-center justify-center ${item.highlighted ? 'bg-saffron/10 text-saffron' : 'bg-primary/5 dark:bg-primary/20 text-primary'}`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{item.label}</p>
                  <p className={`text-base font-black ${item.highlighted ? 'text-primary' : 'text-[#1a0f11] dark:text-white'}`}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Personal & Professional */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="material-symbols-outlined text-primary text-2xl">badge</span>
            <h3 className="text-sm font-black text-primary uppercase tracking-[0.15em]">{t('personal_professional')}</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-y-8 gap-x-6">
            {[
              { label: t('Height'), value: profile.height || "5'10\"", icon: 'straighten' },
              { label: t('Education'), value: t(profile.education || "Masters"), icon: 'school' },
              { label: t('Profession'), value: t(profile.profession || "Architect"), icon: 'work' },
              { label: t('Annual Income'), value: profile.income || "₹18 - 22 LPA", icon: 'payments' }
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{item.label}</p>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-400 text-xl">{item.icon}</span>
                  <p className="text-base font-black text-[#1a0f11] dark:text-white">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Info */}
        <section id="contact-info">
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="material-symbols-outlined text-primary text-2xl">contact_mail</span>
            <h3 className="text-sm font-black text-primary uppercase tracking-[0.15em]">{t('contact_info')}</h3>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-3xl p-6 border border-primary/10 shadow-xl text-center">
            {isPremiumUser ? (
              <div className="space-y-4 text-left">
                <p className="font-black text-xl">+91 98234 56789</p>
                <p className="font-black text-lg text-gray-500">connect@namdev.com</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="material-symbols-outlined text-primary text-4xl mb-3">lock</span>
                <p className="text-sm text-gray-500 mb-6">{t('premium')} Members Only</p>
                <button onClick={() => navigate('/membership')} className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20">
                  {t('view_plans')}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 p-5 px-6 pb-6 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-t-[2rem]">
        <div className="flex items-center gap-3 w-full">
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => navigate(`/kundli/${profile.id}`)}
              className="size-12 bg-saffron/10 text-saffron rounded-2xl flex items-center justify-center border border-saffron/20 active:scale-90 transition-transform"
              title={t('kundli_milan')}
            >
              <span className="material-symbols-outlined text-2xl">auto_awesome</span>
            </button>
            <button 
              onClick={() => navigate(`/compatibility/${profile.id}`)}
              className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20 active:scale-90 transition-transform"
              title={t('ai_compatibility')}
            >
              <span className="material-symbols-outlined text-2xl">insights</span>
            </button>
          </div>
          <button 
            onClick={() => navigate(`/chat/${profile.id}`)}
            className="flex-1 bg-primary text-white h-12 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest active:scale-[0.98] transition-all"
          >
            {t('send_interest')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileDetail;
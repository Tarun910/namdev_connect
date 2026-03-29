import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';
import { authorizedFetch } from '../services/api';
import type { Profile } from '../types';

const SavedInterests: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setError('Sign in to see saved profiles.');
        return;
      }
      const data = await authorizedFetch<Profile[]>('/saved-interests', token);
      setProfiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load list');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    void load();
  }, [isLoaded, isSignedIn, navigate, load]);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark animate-fade-up pb-24">
      <header className="sticky top-0 z-40 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center p-4 gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center justify-center size-10 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </button>
          <div>
            <h1 className="text-lg font-black text-[#191011] dark:text-white leading-tight">
              {t('saved_interests')}
            </h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {t('saved_interests_sub')}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('loading')}</p>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200 mb-4">
            {error}
          </div>
        )}
        {!loading && !error && profiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
              favorite
            </span>
            <p className="font-bold text-gray-500 dark:text-gray-400 mb-2">{t('saved_interests_empty')}</p>
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="mt-2 text-primary font-black uppercase text-xs tracking-widest"
            >
              {t('discover')}
            </button>
          </div>
        )}
        {!loading && profiles.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex flex-col gap-3 group animate-fade-up">
                <button
                  type="button"
                  onClick={() => navigate(`/profile/${profile.id}`)}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-left w-full active:scale-[0.98] transition-transform"
                >
                  <div className="absolute top-3 left-3 z-10">
                    {profile.isVerified && (
                      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm">
                        <span
                          className="material-symbols-outlined text-green-500"
                          style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}
                        >
                          verified
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{ backgroundImage: `url(${profile.imageUrl})` }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-white text-xs font-black uppercase tracking-wider">
                      {profile.gotra || '—'}
                    </p>
                  </div>
                </button>
                <div className="px-1">
                  <p className="text-base font-black truncate text-[#1a0f11] dark:text-white leading-tight">
                    {profile.name}, {profile.age}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider truncate mt-0.5">
                    {t(profile.location)} • {t(profile.profession)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SavedInterests;

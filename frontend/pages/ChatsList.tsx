import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';
import { authorizedFetch } from '../services/api';
import type { ChatThreadPreview } from '../types';

function formatThreadTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (Number.isNaN(d.getTime())) return '';
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const ChatsList: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const [threads, setThreads] = useState<ChatThreadPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setError('Sign in required');
        return;
      }
      const data = await authorizedFetch<ChatThreadPreview[]>('/chat/conversations', token);
      setThreads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load chats');
      setThreads([]);
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
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-24">
      <header className="sticky top-0 z-40 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 py-4">
        <h1 className="text-xl font-black text-[#191011] dark:text-white">{t('chats')}</h1>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
          {t('chats_subtitle')}
        </p>
      </header>

      <main className="flex-1 px-3 pt-2">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('loading')}</p>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200 mb-3">
            {error}
          </div>
        )}
        {!loading && !error && threads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
              chat_bubble
            </span>
            <p className="font-bold text-gray-500 dark:text-gray-400 mb-2">{t('chats_empty')}</p>
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="mt-2 text-primary font-black uppercase text-xs tracking-widest"
            >
              {t('discover')}
            </button>
          </div>
        )}
        {!loading &&
          threads.map(({ partner, lastMessage, time }) => (
            <button
              key={partner.id}
              type="button"
              onClick={() => navigate(`/chat/${partner.id}`)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 mb-2 text-left active:scale-[0.99] transition-transform"
            >
              <div
                className="size-14 rounded-full bg-cover bg-center shrink-0 border border-gray-100 dark:border-gray-600"
                style={{ backgroundImage: `url(${partner.imageUrl})` }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-[#191011] dark:text-white truncate">
                    {partner.name}
                  </p>
                  <span className="text-[10px] font-bold text-gray-400 shrink-0">
                    {formatThreadTime(time)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {lastMessage}
                </p>
              </div>
              <span className="material-symbols-outlined text-gray-300 dark:text-gray-600">chevron_right</span>
            </button>
          ))}
      </main>
    </div>
  );
};

export default ChatsList;

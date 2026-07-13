
import React, { useEffect, useState, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { authorizedFetch, authorizedFetchCached } from '../services/api';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';
import type { AppNotification, IncomingInterestRequest, Profile, User } from '../types';

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [incoming, setIncoming] = useState<IncomingInterestRequest[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const [n, inc, meUser] = await Promise.all([
        authorizedFetch<AppNotification[]>('/notifications', token),
        authorizedFetch<IncomingInterestRequest[]>('/interest-requests/incoming', token).catch(() => []),
        authorizedFetchCached<User>('/profile/me', token),
      ]);
      setNotifications(n);
      setIncoming(inc);
      setMe(meUser);
      await authorizedFetch('/notifications/mark-read', token, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch {
      setNotifications([]);
      setIncoming([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    void loadAll();
  }, [isLoaded, isSignedIn, navigate, loadAll]);

  const respond = async (requestId: string, action: 'accept' | 'reject') => {
    const token = await getToken();
    if (!token) return;
    setActionId(requestId);
    try {
      await authorizedFetch(`/interest-requests/${requestId}/${action}`, token, { method: 'POST' });
      setIncoming((prev) => prev.filter((x) => x.id !== requestId));
      await loadAll();
    } finally {
      setActionId(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'interest':
        return 'favorite';
      case 'verify':
        return 'verified';
      case 'message':
        return 'chat';
      case 'profile_view':
        return 'visibility';
      default:
        return 'notifications';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'interest':
        return 'text-primary bg-primary/10';
      case 'verify':
        return 'text-blue-600 bg-blue-50';
      case 'message':
        return 'text-green-600 bg-green-50';
      case 'profile_view':
        return 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-300';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const isPremium = Boolean(me?.entitlements?.isPremium ?? me?.isPremium);

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark pb-24">
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md flex items-center p-4 border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        <h2 className="ml-2 text-xl font-extrabold tracking-tight">{t('notifications')}</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
          ))
        ) : (
          <>
            {incoming.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">
                  {t('incoming_interests')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 px-1">{t('incoming_interests_hint')}</p>
                {incoming.map((req) => {
                  const p = req.fromProfile as Profile;
                  return (
                    <div
                      key={req.id}
                      className="rounded-2xl border border-primary/15 bg-white dark:bg-gray-800 p-4 shadow-sm"
                    >
                      <div className="flex gap-3 items-center">
                        <div
                          className="size-14 rounded-xl bg-cover bg-center shrink-0 border border-gray-100 dark:border-gray-600"
                          style={{ backgroundImage: `url(${p.imageUrl})` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-[#191011] dark:text-white truncate">{p.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {p.age} · {p.location}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          disabled={actionId === req.id}
                          onClick={() => void respond(req.id, 'reject')}
                          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-300 active:scale-[0.98]"
                        >
                          {t('interest_reject')}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === req.id}
                          onClick={() => void respond(req.id, 'accept')}
                          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md active:scale-[0.98] disabled:opacity-60"
                        >
                          {actionId === req.id ? '…' : t('interest_accept')}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/profile/${p.id}`)}
                        className="mt-2 w-full text-center text-[10px] font-black uppercase tracking-widest text-primary"
                      >
                        {t('view_profile')}
                      </button>
                    </div>
                  );
                })}
              </section>
            )}

            {notifications.length === 0 && incoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <span className="material-symbols-outlined text-6xl mb-4">notifications_off</span>
                <p className="font-bold">All caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                if (n.type === 'profile_view' && n.viewer) {
                  const v = n.viewer;
                  return (
                    <div
                      key={n.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        n.isRead
                          ? 'bg-white/50 dark:bg-white/5 border-gray-50 dark:border-white/5'
                          : 'bg-white dark:bg-gray-800 border-violet-200 dark:border-violet-800/40 shadow-sm ring-1 ring-violet-500/10'
                      }`}
                    >
                      <div className="flex gap-3 items-start">
                        <div className="relative shrink-0">
                          <div
                            className={`size-14 rounded-xl bg-cover bg-center border border-gray-100 dark:border-gray-600 ${
                              v.blurred ? 'blur-md scale-105' : ''
                            }`}
                            style={{ backgroundImage: `url(${v.imageUrl})` }}
                          />
                          {v.blurred && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20">
                              <span className="material-symbols-outlined text-white text-xl">lock</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-sm font-bold text-[#191011] dark:text-white">{n.title}</h3>
                            <span className="text-[10px] text-gray-400 font-medium shrink-0">{n.time}</span>
                          </div>
                          <p className={`text-sm font-black ${v.blurred ? 'text-gray-500 blur-[2px] select-none' : 'text-primary'}`}>
                            {v.name}
                            {!v.blurred && v.age ? `, ${v.age}` : ''}
                          </p>
                          {!v.blurred && v.location && (
                            <p className="text-xs text-gray-500 truncate">{v.location}</p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{n.body}</p>
                          {v.blurred && !isPremium && (
                            <button
                              type="button"
                              onClick={() => navigate('/membership')}
                              className="mt-2 w-full py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-md active:scale-[0.98]"
                            >
                              {t('unlock_profile_visitors')}
                            </button>
                          )}
                          {!v.blurred && v.id && (
                            <button
                              type="button"
                              onClick={() => navigate(`/profile/${v.id}`)}
                              className="mt-2 text-[10px] font-black uppercase tracking-widest text-primary"
                            >
                              {t('view_profile')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={n.id}
                    className={`flex gap-4 p-4 rounded-xl border transition-all ${
                      n.isRead
                        ? 'bg-white/50 dark:bg-white/5 border-gray-50 dark:border-white/5'
                        : 'bg-white dark:bg-gray-800 border-primary/10 shadow-sm ring-1 ring-primary/5'
                    }`}
                  >
                    <div
                      className={`size-12 shrink-0 rounded-full flex items-center justify-center ${getColor(n.type)}`}
                    >
                      <span className="material-symbols-outlined">{getIcon(n.type)}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <h3
                          className={`text-sm font-bold ${
                            n.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-[#191011] dark:text-white'
                          }`}
                        >
                          {n.title}
                        </h3>
                        <span className="text-[10px] text-gray-400 font-medium">{n.time}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{n.body}</p>
                    </div>
                    {!n.isRead && <div className="size-2 bg-primary rounded-full mt-1.5" />}
                  </div>
                );
              })
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Notifications;

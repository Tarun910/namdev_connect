
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { api, ApiError, authorizedFetch } from '../services/api';
import ChatGateModal, { type InterestGateStatus } from '../components/ChatGateModal';
import { getSupabaseBrowser, subscribeToChatChannel } from '../services/supabaseClient';
import { Profile, Message } from '../types';

const Chat: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [gateError, setGateError] = useState<{ message: string; code?: string } | null>(null);
  const [interestStatus, setInterestStatus] = useState<InterestGateStatus>('none');
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setMeId(null);
    setLoading(true);
    setGateError(null);
    setInterestStatus('none');
    (async () => {
      try {
        const p = await api.profile.getById(id);
        if (cancelled) return;
        if (p) setProfile(p);
        try {
          const me = await api.profile.getMe();
          if (!cancelled) setMeId(me.id);
        } catch {
          if (!cancelled) setMeId(null);
        }
        const msgs = await api.chat.getMessages(id);
        if (!cancelled) setMessages(msgs);
      } catch (e) {
        if (!cancelled) {
          setMessages([]);
          if (e instanceof ApiError) {
            setGateError({ message: e.message, code: e.code });
            if (e.code === 'INTEREST_NOT_ACCEPTED' || e.code === 'PREMIUM_REQUIRED') {
              if (id) {
                try {
                  const token = await getToken();
                  if (token) {
                    const sent = await authorizedFetch<{ status: string }>(
                      `/interest-requests/sent/${encodeURIComponent(id)}`,
                      token
                    );
                    const st = sent.status as InterestGateStatus;
                    if (!cancelled && st !== 'none') setInterestStatus(st);
                  }
                } catch {
                  /* optional */
                }
              }
            }
          } else {
            setGateError({ message: e instanceof Error ? e.message : 'Could not open chat' });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, getToken]);

  useEffect(() => {
    if (!id || !meId || gateError) return;
    const client = getSupabaseBrowser();
    if (!client) return;
    const channel = subscribeToChatChannel(client, meId, id, {
      onMessage: (msg) => {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      },
      onMessagesRead: async (payload) => {
        if (payload.reader_id.trim().toLowerCase() !== id.trim().toLowerCase()) return;
        try {
          const fresh = await api.chat.getMessages(id);
          setMessages(fresh);
        } catch {
          /* keep current */
        }
      },
    });
    return () => {
      void client.removeChannel(channel);
    };
  }, [id, meId, gateError]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !id || gateError) return;
    setSendError(null);
    try {
      const optimisticMsg = await api.chat.sendMessage(id, input);
      setMessages((prev) => [...prev, optimisticMsg]);
      setInput('');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not send';
      setSendError(msg);
      if (e instanceof ApiError && (e.code === 'PREMIUM_REQUIRED' || e.code === 'INTEREST_NOT_ACCEPTED')) {
        setGateError({ message: msg, code: e.code });
      }
    }
  };

  const closeGate = () => navigate(-1);

  const goToProfileForInterest = () => {
    if (id) navigate(`/profile/${id}`);
    else navigate(-1);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile && !gateError) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-gray-500 bg-background-light dark:bg-background-dark">
        Profile not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-hidden relative">
      {profile && (
        <>
          <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="flex items-center justify-center p-1 -ml-2">
                  <span className="material-symbols-outlined text-primary">chevron_left</span>
                </button>
                <div className="relative">
                  <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-11 border border-gray-100 dark:border-gray-700"
                    style={{ backgroundImage: `url(${profile.imageUrl})` }}
                  />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-[#191011] dark:text-white text-base font-semibold leading-tight">{profile.name}</h2>
                  <p className="text-[#8d585f] dark:text-[#a88d91] text-xs font-normal">
                    {gateError ? 'Chat locked' : 'Online'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {!gateError && (
            <>
              <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <span className="material-symbols-outlined text-5xl mb-2">chat</span>
                    <p className="text-sm font-bold">
                      No messages yet.
                      <br />
                      Say Namaste to start the conversation!
                    </p>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex items-end gap-2 max-w-[85%] ${m.isMe ? 'self-end flex-row-reverse' : ''}`}>
                    <div className={`flex flex-col gap-1 ${m.isMe ? 'items-end' : ''}`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 shadow-sm border ${
                          m.isMe
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-saffron/20 rounded-br-sm'
                            : 'bg-white dark:bg-zinc-800 border-gray-100 dark:border-zinc-700 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-[15px] leading-relaxed text-[#191011] dark:text-gray-100">{m.text}</p>
                      </div>
                      <div
                        className={`flex items-center gap-1 ${m.isMe ? 'flex-row-reverse' : ''} text-[10px] text-gray-400 ${
                          m.isMe ? 'mr-0 ml-1' : 'mr-1'
                        }`}
                      >
                        <span>{m.timestamp}</span>
                        {m.isMe && (
                          <span
                            className={`material-symbols-outlined text-[14px] leading-none ${
                              m.readAt ? 'text-primary' : 'text-gray-400'
                            }`}
                            style={{ fontVariationSettings: m.readAt ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            {m.readAt ? 'done_all' : 'done'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </main>

              <div className="sticky bottom-0 bg-background-light dark:bg-background-dark p-4 pb-8 border-t border-gray-200 dark:border-gray-800">
                {sendError && <p className="text-xs font-bold text-red-500 mb-2 text-center">{sendError}</p>}
                <div className="flex items-end gap-3">
                  <div className="flex-1 bg-white dark:bg-zinc-800 rounded-3xl border border-gray-200 dark:border-zinc-700 px-4 py-2.5 shadow-sm flex items-center gap-2">
                    <input
                      className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-0.5 placeholder-gray-400 outline-none"
                      placeholder="Message..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void sendMessage()}
                    />
                  </div>
                  <button
                    onClick={() => void sendMessage()}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-md active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined ml-0.5">send</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {gateError && (
            <div className="flex-1 flex items-center justify-center p-6 opacity-30 pointer-events-none">
              <span className="material-symbols-outlined text-8xl text-gray-300 dark:text-gray-600">forum</span>
            </div>
          )}
        </>
      )}

      <ChatGateModal
        open={Boolean(gateError)}
        code={gateError?.code}
        message={gateError?.message}
        profile={profile}
        interestStatus={interestStatus}
        onClose={closeGate}
        onSendInterest={goToProfileForInterest}
        onUpgrade={() => navigate('/membership')}
      />
    </div>
  );
};

export default Chat;

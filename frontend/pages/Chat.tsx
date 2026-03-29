
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Profile, Message } from '../types';

const Chat: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      Promise.all([
        api.profile.getById(id),
        api.chat.getMessages(id)
      ]).then(([p, msgs]) => {
        if (p) setProfile(p);
        setMessages(msgs);
        setLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !id) return;
    const optimisticMsg = await api.chat.sendMessage(id, input);
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');
  };

  if (loading || !profile) return <div className="h-screen flex items-center justify-center"><div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-hidden">
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="flex items-center justify-center p-1 -ml-2">
              <span className="material-symbols-outlined text-primary">chevron_left</span>
            </button>
            <div className="relative">
              <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-11 border border-gray-100 dark:border-gray-700" style={{ backgroundImage: `url(${profile.imageUrl})` }} />
              <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-white dark:border-background-dark animate-pulse"></div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <h2 className="text-[#191011] dark:text-white text-base font-semibold leading-tight">{profile.name}</h2>
                <span className="material-symbols-outlined text-primary text-[16px] fill-1">verified</span>
              </div>
              <p className="text-[#8d585f] dark:text-[#a88d91] text-xs font-normal">Online</p>
            </div>
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <span className="material-symbols-outlined text-5xl mb-2">chat</span>
            <p className="text-sm font-bold">No messages yet.<br/>Say Namaste to start the conversation!</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex items-end gap-2 max-w-[85%] ${m.isMe ? 'self-end flex-row-reverse' : ''}`}>
            <div className={`flex flex-col gap-1 ${m.isMe ? 'items-end' : ''}`}>
              <div className={`rounded-2xl px-4 py-2.5 shadow-sm border ${
                m.isMe ? 'bg-orange-50 dark:bg-orange-900/20 border-saffron/20 rounded-br-sm' : 'bg-white dark:bg-zinc-800 border-gray-100 dark:border-zinc-700 rounded-bl-sm'
              }`}>
                <p className="text-[15px] leading-relaxed text-[#191011] dark:text-gray-100">{m.text}</p>
              </div>
              <span className="text-[10px] text-gray-400 mr-1">{m.timestamp}</span>
            </div>
          </div>
        ))}
      </main>

      <div className="sticky bottom-0 bg-background-light dark:bg-background-dark p-4 pb-8 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-end gap-3">
          <div className="flex-1 bg-white dark:bg-zinc-800 rounded-3xl border border-gray-200 dark:border-zinc-700 px-4 py-2.5 shadow-sm flex items-center gap-2">
            <input 
              className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-0.5 placeholder-gray-400 outline-none" 
              placeholder="Message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
          </div>
          <button onClick={sendMessage} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-md active:scale-95 transition-transform">
            <span className="material-symbols-outlined ml-0.5">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;

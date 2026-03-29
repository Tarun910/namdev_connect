
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AppNotification } from '../types';

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.notifications.getAll().then(data => {
      setNotifications(data);
      setLoading(false);
      api.notifications.markAllRead();
    });
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'interest': return 'favorite';
      case 'verify': return 'verified';
      case 'message': return 'chat';
      default: return 'notifications';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'interest': return 'text-primary bg-primary/10';
      case 'verify': return 'text-blue-600 bg-blue-50';
      case 'message': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md flex items-center p-4 border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        <h2 className="ml-2 text-xl font-extrabold tracking-tight">Notifications</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <span className="material-symbols-outlined text-6xl mb-4">notifications_off</span>
            <p className="font-bold">All caught up!</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id} 
              className={`flex gap-4 p-4 rounded-xl border transition-all ${
                n.isRead 
                  ? 'bg-white/50 dark:bg-white/5 border-gray-50 dark:border-white/5' 
                  : 'bg-white dark:bg-gray-800 border-primary/10 shadow-sm ring-1 ring-primary/5'
              }`}
            >
              <div className={`size-12 shrink-0 rounded-full flex items-center justify-center ${getColor(n.type)}`}>
                <span className="material-symbols-outlined">{getIcon(n.type)}</span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <h3 className={`text-sm font-bold ${n.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-[#191011] dark:text-white'}`}>
                    {n.title}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-medium">{n.time}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {n.body}
                </p>
              </div>
              {!n.isRead && <div className="size-2 bg-primary rounded-full mt-1.5"></div>}
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default Notifications;


import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);

  const navItems = [
    { label: t('home'), icon: 'home', path: '/dashboard', activeIcon: 'home' },
    { label: t('discover'), icon: 'diversity_3', path: '/discover' },
    { label: t('saved_interests'), icon: 'favorite', path: '/saved-interests' },
    { label: t('chats'), icon: 'chat_bubble', path: '/chats', badge: true },
    { label: t('profile'), icon: 'person', path: '/complete-profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md min-h-[4.25rem] bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg grid grid-cols-5 gap-0 px-1 border-t border-gray-100 dark:border-gray-800 pt-1 pb-2 z-50">
      {navItems.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path === '/saved-interests' && location.pathname.startsWith('/saved-interests'));
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-0 py-1 transition-colors ${
              isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <div className="relative">
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              {item.badge && (
                <span className="absolute -top-0.5 -right-0.5 size-2 bg-primary rounded-full border border-white dark:border-gray-900" />
              )}
            </div>
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-tight truncate max-w-full px-0.5 leading-tight text-center">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;

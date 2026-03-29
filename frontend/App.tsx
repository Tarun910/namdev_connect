
import React, { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '@clerk/react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Discover from './pages/Discover';
import SavedInterests from './pages/SavedInterests';
import ChatsList from './pages/ChatsList';
import Dashboard from './pages/Dashboard';
import ProfileDetail from './pages/ProfileDetail';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Membership from './pages/Membership';
import CompleteProfile from './pages/CompleteProfile';
import Notifications from './pages/Notifications';
import KundliMilan from './pages/KundliMilan';
import AICompatibility from './pages/AICompatibility';
import BottomNav from './components/BottomNav';
import { Language } from './types';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
});

const Splash: React.FC = () => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background-light dark:bg-background-dark">
    <div className="w-24 h-24 bg-primary rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/30 animate-splash">
      <span className="material-symbols-outlined text-white text-6xl">favorite</span>
    </div>
    <div className="mt-8 text-center animate-pulse">
      <h1 className="text-2xl font-black tracking-tighter text-primary">NAMDEV CONNECT</h1>
      <p className="text-xs font-bold text-gray-400 tracking-[0.3em] uppercase mt-2">Connecting Hearts</p>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  const [isSplashActive, setIsSplashActive] = useState(true);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsSplashActive(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (isSplashActive || !isLoaded) return;
    if (isSignedIn && location.pathname === '/') {
      navigate('/dashboard');
    }
  }, [isSplashActive, isLoaded, isSignedIn, navigate, location.pathname]);

  const toggleTheme = () => setIsDark(prev => !prev);

  const hideBottomNav = ['/', '/login', '/chat', '/kundli'].some(path => 
    location.pathname === path || 
    location.pathname.startsWith('/chat/') || 
    location.pathname.startsWith('/kundli/')
  );

  if (isSplashActive) return <Splash />;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background-light dark:bg-background-dark relative shadow-2xl flex flex-col">
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home onToggleTheme={toggleTheme} isDark={isDark} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/saved-interests" element={<SavedInterests />} />
          {/* Home tab should show the marketing-style homepage UI */}
          <Route path="/dashboard" element={<Home onToggleTheme={toggleTheme} isDark={isDark} />} />
          {/* Keep the signed-in dashboard available */}
          <Route path="/account" element={<Dashboard onToggleTheme={toggleTheme} isDark={isDark} />} />
          <Route path="/chats" element={<ChatsList />} />
          <Route path="/profile/:id" element={<ProfileDetail />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/membership" element={<Membership />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/kundli/:id" element={<KundliMilan />} />
          <Route path="/compatibility/:id" element={<AICompatibility />} />
        </Routes>
      </div>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'en';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
      <Router>
        <AppContent />
      </Router>
    </LanguageContext.Provider>
  );
};

export default App;

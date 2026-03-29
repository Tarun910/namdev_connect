
import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { User, Profile } from '../types';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';

const KundliMilan: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      Promise.all([
        api.profile.getMe(),
        api.profile.getById(id)
      ]).then(([me, target]) => {
        setCurrentUser(me);
        if (target) setTargetProfile(target);
        setLoading(false);
      });
    }
  }, [id]);

  // Deterministic mock calculations based on IDs
  const matchData = useMemo(() => {
    if (!currentUser || !targetProfile) return null;
    
    // Create a seed from IDs
    const combinedId = (parseInt(currentUser.id.replace(/\D/g, '') || '1') + parseInt(targetProfile.id.replace(/\D/g, '') || '2'));
    const score = 24 + (combinedId % 12); // Score between 24 and 36
    
    const breakdown = [
      { id: 'varna', name: t('varna'), desc: t('work_compatibility'), score: 1, total: 1, status: 'full' },
      { id: 'vashya', name: t('vashya'), desc: t('mutual_control'), score: 2, total: 2, status: 'full' },
      { id: 'tara', name: t('tara'), desc: t('birth_star_match'), score: combinedId % 3 === 0 ? 3 : 1.5, total: 3, status: combinedId % 3 === 0 ? 'full' : 'partial' },
      { id: 'yoni', name: t('yoni'), desc: t('sexual_affinity'), score: 4, total: 4, status: 'full' },
      { id: 'maitri', name: t('maitri'), desc: t('friendship'), score: 5, total: 5, status: 'full' },
      { id: 'gana', name: t('gana'), desc: t('temperament'), score: 6, total: 6, status: 'full' },
      { id: 'bhakoot', name: t('bhakoot'), desc: t('love_children'), score: 7, total: 7, status: 'full' },
      { id: 'nadi', name: t('nadi'), desc: t('health_heredity'), score: combinedId % 2 === 0 ? 8 : 6, total: 8, status: combinedId % 2 === 0 ? 'full' : 'partial' },
    ];

    const actualTotal = breakdown.reduce((acc, curr) => acc + curr.score, 0);

    return {
      totalScore: actualTotal,
      breakdown,
      compatibility: actualTotal >= 30 ? t('excellent_compatibility') : actualTotal >= 25 ? t('good_compatibility') : t('average_compatibility'),
      rohitManglik: false,
      priyaManglik: false
    };
  }, [currentUser, targetProfile, t]);

  if (loading || !currentUser || !targetProfile || !matchData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Calculating Kundli Match...</p>
      </div>
    );
  }

  const dashOffset = 282.7 - (282.7 * (matchData.totalScore / 36));

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-[#1b150d] dark:text-gray-100 relative overflow-x-hidden font-body animate-fade-up">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-10" style={{ 
        backgroundImage: 'radial-gradient(#f1ab55 0.5px, transparent 0.5px)',
        backgroundSize: '24px 24px'
      }}></div>

      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        <h1 className="text-lg font-black tracking-tight font-poppins">{t('kundli_milan')}</h1>
        <button className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-primary">share</span>
        </button>
      </header>

      <main className="relative z-10 max-w-md mx-auto pb-32 pt-6">
        {/* Profile Connection Section */}
        <div className="relative px-6 py-8 flex items-center justify-between">
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <div className="size-20 rounded-full border-4 border-primary/20 p-1 bg-white dark:bg-gray-800 shadow-xl transition-transform group-hover:scale-105">
                <div className="size-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${currentUser.imageUrl})` }}></div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-background-light dark:border-gray-900 shadow-sm uppercase">{t('back').toUpperCase()}</div>
            </div>
            <div className="text-center">
              <p className="font-black text-sm text-[#1b150d] dark:text-white truncate w-24">{currentUser.name.split(' ')[0]}</p>
              <p className="text-[11px] text-[#9a774c] dark:text-gray-500 font-bold">{currentUser.birthDate || "15 May 1994"}</p>
            </div>
          </div>

          {/* Connecting Line with Heart */}
          <div className="flex-1 relative flex items-center justify-center h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 mx-2 rounded-full">
            <div className="absolute size-9 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg border border-primary/10">
              <span className="material-symbols-outlined text-primary text-xl fill-current">favorite</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <div className="size-20 rounded-full border-4 border-primary/20 p-1 bg-white dark:bg-gray-800 shadow-xl transition-transform group-hover:scale-105">
                <div className="size-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${targetProfile.imageUrl})` }}></div>
              </div>
              <div className="absolute -bottom-1 -left-1 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-background-light dark:border-gray-900 shadow-sm uppercase">{t('matches').split(' ')[0]}</div>
            </div>
            <div className="text-center">
              <p className="font-black text-sm text-[#1b150d] dark:text-white truncate w-24">{targetProfile.name.split(' ')[0]}</p>
              <p className="text-[11px] text-[#9a774c] dark:text-gray-500 font-bold">{targetProfile.birthDate || "22 Aug 1996"}</p>
            </div>
          </div>
        </div>

        {/* Matching Score Gauge */}
        <div className="px-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center">
            <div className="relative size-48 flex items-center justify-center mb-6">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle className="text-gray-100 dark:text-gray-700" cx="50" cy="50" fill="transparent" r="45" stroke="currentColor" strokeWidth="8"></circle>
                <circle className="text-primary transition-all duration-1000 ease-out" cx="50" cy="50" fill="transparent" r="45" stroke="currentColor" strokeDasharray="282.7" strokeDashoffset={dashOffset} strokeLinecap="round" strokeWidth="8"></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-[#1b150d] dark:text-white leading-none">{matchData.totalScore}<span className="text-xl text-gray-400">/36</span></span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mt-2">{t('guna_match')}</span>
              </div>
            </div>
            <div className="bg-green-500/10 px-5 py-2.5 rounded-2xl inline-flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-green-500 text-xl fill-1">verified</span>
              <span className="text-green-600 dark:text-green-400 font-black text-sm">{matchData.compatibility}</span>
            </div>
            <p className="text-sm text-[#9a774c] dark:text-gray-400 font-semibold leading-relaxed">
              This match is highly recommended based on Ashtakoota analysis for the Namdev community traditions.
            </p>
          </div>
        </div>

        {/* Manglik Status */}
        <div className="px-4 mb-8">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a774c] mb-4 px-1">{t('manglik_check')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-4 shadow-sm">
              <div className="size-11 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-500">
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div>
                <p className="text-[9px] uppercase font-black text-gray-400 tracking-wider mb-0.5">{currentUser.name.split(' ')[0]}</p>
                <p className="text-sm font-black text-[#1b150d] dark:text-white">{t('non_manglik')}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-4 shadow-sm">
              <div className="size-11 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-500">
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div>
                <p className="text-[9px] uppercase font-black text-gray-400 tracking-wider mb-0.5">{targetProfile.name.split(' ')[0]}</p>
                <p className="text-sm font-black text-[#1b150d] dark:text-white">{t('non_manglik')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ashtakoota Analysis Table */}
        <div className="px-4 mb-10">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a774c]">{t('ashtakoota_breakdown')}</h3>
            <span className="text-[10px] bg-primary/20 text-primary font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">8 {t('guna_match').split(' ')[0]}s</span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50 overflow-hidden shadow-sm">
            {matchData.breakdown.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-primary/5 dark:bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-xl">{
                      ['palette', 'psychology', 'nights_stay', 'pets', 'handshake', 'diversity_3', 'family_history', 'medical_services'][idx]
                    }</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#1b150d] dark:text-white">{item.name}</p>
                    <p className="text-[10px] text-[#9a774c] dark:text-gray-500 font-bold uppercase tracking-wider">{item.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-black text-sm ${item.status === 'full' ? 'text-green-500' : 'text-primary'}`}>{item.score}/{item.total}</span>
                  <span className={`material-symbols-outlined text-xl ${item.status === 'full' ? 'text-green-500' : 'text-primary'}`}>
                    {item.status === 'full' ? 'done_all' : 'trending_flat'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Action Area */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-5 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark flex flex-col items-center gap-2 z-50">
        <div className="flex items-center gap-1.5 mb-1 px-4 py-1.5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md rounded-full border border-gray-100 dark:border-gray-800">
          <span className="material-symbols-outlined text-[14px] text-primary">lock</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">{t('premium_feature')}</span>
        </div>
        <button className="w-full bg-primary text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-primary/30 hover:scale-[0.98] transition-transform active:scale-95 uppercase tracking-widest text-sm font-poppins">
          <span className="material-symbols-outlined">download</span>
          {t('download_report')}
        </button>
      </div>
    </div>
  );
};

export default KundliMilan;

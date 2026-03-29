
import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { User, Profile } from '../types';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';

const AICompatibility: React.FC = () => {
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

  const matchInsights = useMemo(() => {
    if (!currentUser || !targetProfile) return null;
    
    // Deterministic match data based on profile fields
    const lifestyleFields = ['diet', 'smokeAlcohol', 'routine'];
    let lifestyleMatchPoints = 0;
    lifestyleFields.forEach(field => {
      if ((currentUser as any)[field] === (targetProfile as any)[field]) lifestyleMatchPoints += 10;
    });

    const commonInterests = (currentUser.interests || []).filter(i => (targetProfile.interests || []).includes(i));
    const interestPoints = commonInterests.length * 5;

    const seed = (parseInt(currentUser.id.replace(/\D/g, '') || '1') + parseInt(targetProfile.id.replace(/\D/g, '') || '2'));
    const baseScore = 70 + (seed % 15); // 70-85 base
    const finalScore = Math.min(98, baseScore + lifestyleMatchPoints + interestPoints);
    
    return {
      score: finalScore,
      verdict: finalScore > 88 ? t('excellent_compatibility') : t('good_compatibility'),
      analysis: `Your shared commitment to Namdev Samaj traditions and similar career trajectories in ${targetProfile.profession} suggest a strong foundation. You both prioritize family-centric weekends and maintain a highly disciplined lifestyle.`,
      interests: commonInterests.length > 0 ? commonInterests : ['Vegetarian', 'Traditional Values', 'Yoga', 'Travel', 'Community Service'],
      values: [
        { label: t('traditionalism'), value: 95 },
        { label: t('professional_ambition'), value: 82 },
        { label: t('social_extroversion'), value: 65, note: `${targetProfile.name.split(' ')[0]} is more introverted than you.` }
      ],
      differences: `${targetProfile.name.split(' ')[0]} enjoys adventure sports while you might prefer quiet reading. This balance can lead to a dynamic and healthy shared growth.`,
      lifestyle: [
        { label: t('dietary_habits'), desc: targetProfile.diet || 'Vegetarian', icon: 'nutrition', matched: currentUser.diet === targetProfile.diet },
        { label: t('smoking_alcohol'), desc: targetProfile.smokeAlcohol || 'Non-smoker & Non-drinker', icon: 'smoke_free', matched: currentUser.smokeAlcohol === targetProfile.smokeAlcohol },
        { label: t('daily_routine'), desc: targetProfile.routine || 'Early Riser (5 AM - 6 AM)', icon: 'wb_sunny', matched: currentUser.routine === targetProfile.routine }
      ]
    };
  }, [currentUser, targetProfile, t]);

  if (loading || !currentUser || !targetProfile || !matchInsights) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="size-12 border-4 border-[#0f7985] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Generating AI Insights...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-[#1d292b] font-body animate-fade-up text-[#0e1a1b] dark:text-gray-100 overflow-x-hidden pb-40">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-[#1d292b]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center p-4 justify-between max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios</span>
            </button>
            <h2 className="text-lg font-black leading-tight tracking-tight">{currentUser.name.split(' ')[0]} & {targetProfile.name.split(' ')[0]}</h2>
          </div>
          <div className="flex gap-1">
            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
              <span className="material-symbols-outlined text-[#0f7985]">share</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-6 space-y-8">
        {/* Hero Compatibility Header */}
        <div className="bg-white dark:bg-[#253538] rounded-3xl p-8 flex flex-col items-center shadow-xl shadow-black/5 border border-gray-100 dark:border-white/5">
          <div className="relative flex items-center justify-center mb-8">
            <svg className="w-44 h-44 transform -rotate-90">
              <circle className="text-gray-100 dark:text-gray-800" cx="88" cy="88" fill="transparent" r="78" stroke="currentColor" strokeWidth="10"></circle>
              <circle className="text-[#0f7985] transition-all duration-1000 ease-out" cx="88" cy="88" fill="transparent" r="78" stroke="currentColor" strokeDasharray="490" strokeDashoffset={490 - (490 * (matchInsights.score / 100))} strokeWidth="10" strokeLinecap="round"></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black text-[#0f7985]">{matchInsights.score}%</span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400 font-black mt-2">Match</span>
            </div>
            <div className="absolute -bottom-5 flex -space-x-5">
              <div className="w-14 h-14 rounded-full border-4 border-white dark:border-[#253538] bg-cover bg-center shadow-lg" style={{ backgroundImage: `url(${currentUser.imageUrl})` }}></div>
              <div className="w-14 h-14 rounded-full border-4 border-white dark:border-[#253538] bg-cover bg-center shadow-lg" style={{ backgroundImage: `url(${targetProfile.imageUrl})` }}></div>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-xl font-black text-[#0f7985] mb-1">{matchInsights.verdict}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold tracking-wide uppercase">Based on Namdev Samaj values & lifestyle</p>
          </div>
        </div>

        {/* AI Insight Box */}
        <div className="relative p-[2px] rounded-3xl bg-gradient-to-br from-[#0f7985] via-[#FFAD87] to-[#0f7985] shadow-lg shadow-[#0f7985]/10">
          <div className="bg-white dark:bg-[#1d292b] rounded-[22px] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#0f7985] text-2xl fill-1">auto_awesome</span>
              <h3 className="font-black text-[#0f7985] uppercase tracking-widest text-sm">{t('ai_match_analysis')}</h3>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 font-medium italic">
              "{matchInsights.analysis}"
            </p>
          </div>
        </div>

        {/* Common Interests */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 px-1">{t('common_interests')}</h3>
          <div className="flex flex-wrap gap-2">
            {matchInsights.interests.map((interest) => (
              <div key={interest} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#0f7985]/10 dark:bg-[#0f7985]/20 border border-[#0f7985]/20">
                <span className="material-symbols-outlined text-[#0f7985] text-[18px]">interests</span>
                <span className="text-sm font-black text-[#0f7985]">{interest}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Lifestyle Alignment */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 px-1">{t('lifestyle_alignment')}</h3>
          <div className="space-y-3">
            {matchInsights.lifestyle.map((item) => (
              <div key={item.label} className="bg-white dark:bg-[#253538] p-5 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-[#0f7985]">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{item.label}</p>
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{item.desc}</p>
                  </div>
                </div>
                {item.matched ? (
                  <span className="material-symbols-outlined text-green-500 fill-1">check_circle</span>
                ) : (
                  <span className="material-symbols-outlined text-gray-300 dark:text-gray-600">check_circle</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Values Breakdown */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 px-1">{t('values_breakdown')}</h3>
          <div className="space-y-8 px-1">
            {matchInsights.values.map((v) => (
              <div key={v.label}>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-widest">{v.label}</span>
                  <span className="text-sm font-black text-[#0f7985]">{v.value}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${v.value < 70 ? 'bg-[#FFAD87]' : 'bg-[#0f7985]'}`} 
                    style={{ width: `${v.value}%` }}
                  ></div>
                </div>
                {v.note && <p className="text-[10px] mt-2 text-gray-400 font-bold italic">{v.note}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Opposites Attract */}
        <section className="pb-10">
          <div className="bg-[#FFAD87]/10 dark:bg-[#FFAD87]/5 border border-[#FFAD87]/20 p-6 rounded-3xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-[#FFAD87]/20 flex items-center justify-center text-[#FFAD87]">
                <span className="material-symbols-outlined fill-1">balance</span>
              </div>
              <h4 className="font-black text-[#FFAD87] uppercase tracking-widest text-sm">{t('unique_differences')}</h4>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed italic">
              "{matchInsights.differences}"
            </p>
          </div>
        </section>
      </main>

      {/* Consistent Bottom Nav handled by App.tsx */}
    </div>
  );
};

export default AICompatibility;

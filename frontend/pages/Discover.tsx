import React, { useState, useMemo, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';
import { api } from '../services/api';
import type { Profile } from '../types';

type FilterType = 'gender' | 'age' | 'location' | 'gotra';

const Discover: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    api.profile.getAll().then(setProfiles).catch(() => setProfiles([]));
  }, []);
  
  const [filters, setFilters] = useState({
    gender: 'All',
    age: 'All',
    location: 'All',
    gotra: 'All'
  });

  const [activeFilterTab, setActiveFilterTab] = useState<FilterType | null>(null);

  const filterOptions = {
    gender: ['All', 'Male', 'Female'],
    age: ['All', '20-25', '26-30', '31-35', '36+'],
    location: ['All', 'Pune', 'Mumbai', 'Indore', 'Nashik', 'Nagpur'],
    gotra: ['All', 'Goyal', 'Solanki', 'Chauhan']
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter(profile => {
      if (verifiedOnly && !profile.isVerified) return false;
      
      if (filters.gender !== 'All' && profile.gender !== filters.gender) return false;
      
      if (filters.location !== 'All' && profile.location !== filters.location) return false;
      
      if (filters.gotra !== 'All' && profile.gotra !== filters.gotra) return false;
      
      if (filters.age !== 'All') {
        const age = profile.age;
        if (filters.age === '20-25') return age >= 20 && age <= 25;
        if (filters.age === '26-30') return age >= 26 && age <= 30;
        if (filters.age === '31-35') return age >= 31 && age <= 35;
        if (filters.age === '36+') return age >= 36;
      }
      
      return true;
    });
  }, [profiles, verifiedOnly, filters]);

  const handleFilterChange = (type: FilterType, value: string) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark animate-fade-up">
      <header className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center p-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <span className="material-symbols-outlined text-primary">diversity_3</span>
            </div>
            <h2 className="text-xl font-black leading-tight tracking-tight dark:text-white">{t('discover')}</h2>
          </div>
        </div>

        {/* Primary Toggle (Verified) */}
        <div className="px-4 pb-2">
           <button 
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`flex w-full h-10 items-center justify-center gap-x-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              verifiedOnly 
                ? 'bg-green-500 text-white shadow-xl shadow-green-500/20' 
                : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[#191011] dark:text-white shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {verifiedOnly ? 'verified' : 'new_releases'}
            </span>
            <span>{t('verified')} Only</span>
          </button>
        </div>

        {/* Filter Categories Horizontal Scroll */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {(Object.keys(filterOptions) as FilterType[]).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveFilterTab(activeFilterTab === tab ? null : tab)}
              className={`flex h-9 shrink-0 items-center justify-center gap-x-1.5 rounded-full px-4 text-[10px] font-black uppercase tracking-widest transition-all border ${
                activeFilterTab === tab
                  ? 'bg-primary border-primary text-white'
                  : filters[tab] !== 'All'
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              <span>{t(tab)}: {filters[tab] === 'All' ? t('all') : filters[tab]}</span>
              <span className="material-symbols-outlined text-[14px]">
                {activeFilterTab === tab ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Options Sub-bar (Animated Reveal) */}
        {activeFilterTab && (
          <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 p-3 overflow-x-auto no-scrollbar flex gap-2 animate-in slide-in-from-top-2 duration-200">
            {filterOptions[activeFilterTab].map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  handleFilterChange(activeFilterTab, opt);
                }}
                className={`h-8 shrink-0 px-4 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                  filters[activeFilterTab] === opt
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'
                }`}
              >
                {t(opt) || opt}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-32">
        {filteredProfiles.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {filteredProfiles.map((profile) => (
              <div key={profile.id} className="flex flex-col gap-3 group animate-fade-up">
                <div 
                  onClick={() => navigate(`/profile/${profile.id}`)}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="absolute top-3 left-3 z-10">
                    {profile.isVerified && (
                      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm">
                        <span className="material-symbols-outlined text-green-500" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>
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
                     <p className="text-white text-xs font-black uppercase tracking-wider">{profile.gotra}</p>
                  </div>
                </div>
                <div className="px-1">
                  <p className="text-base font-black truncate text-[#1a0f11] dark:text-white leading-tight">{profile.name}, {profile.age}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider truncate mt-0.5">{t(profile.location)} • {t(profile.profession)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center">
            <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
            <p className="font-bold">No matches found.<br/>Try adjusting your filters.</p>
            <button 
              onClick={() => {
                setFilters({ gender: 'All', age: 'All', location: 'All', gotra: 'All' });
                setVerifiedOnly(false);
              }}
              className="mt-4 text-primary font-black uppercase text-xs tracking-widest underline"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Discover;

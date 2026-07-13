import React, { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../App';
import { useTranslation } from '../services/i18n';
import {
  subscribeUnsavedPrompt,
  type UnsavedChangesPrompt,
} from '../services/navigationGuard';

const UnsavedChangesModalHost: React.FC = () => {
  const { language } = useContext(LanguageContext);
  const t = useTranslation(language);
  const [prompt, setPrompt] = useState<UnsavedChangesPrompt | null>(null);

  useEffect(() => subscribeUnsavedPrompt(setPrompt), []);

  if (!prompt?.open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px] flex items-center justify-center px-6">
      <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-amber-600 text-4xl">edit_note</span>
        </div>
        <h1 className="font-poppins text-xl font-bold text-[#191011] dark:text-white mb-2">
          {t('unsaved_changes_title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 max-w-[260px]">
          {t('unsaved_changes_message')}
        </p>
        <div className="w-full space-y-3">
          <button
            type="button"
            disabled={prompt.saving}
            onClick={() => void prompt.onSave()}
            className="w-full bg-primary hover:bg-primary/90 text-white font-poppins font-semibold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {prompt.saving ? (
              <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">save</span>
                {t('save_and_leave')}
              </>
            )}
          </button>
          <button
            type="button"
            disabled={prompt.saving}
            onClick={prompt.onDiscard}
            className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 font-poppins font-semibold py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {t('discard_changes')}
          </button>
          <button
            type="button"
            disabled={prompt.saving}
            onClick={prompt.onStay}
            className="w-full bg-transparent border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-poppins font-semibold py-4 rounded-2xl transition-all disabled:opacity-70"
          >
            {t('keep_editing')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesModalHost;

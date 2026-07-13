import React from 'react';
import type { Profile } from '../types';

export type ChatGateCode = 'INTEREST_NOT_ACCEPTED' | 'PREMIUM_REQUIRED' | 'INVALID_PARTNER' | string | undefined;

export type InterestGateStatus = 'none' | 'pending' | 'accepted' | 'rejected';

type Props = {
  open: boolean;
  code?: ChatGateCode;
  message?: string;
  profile?: Profile | null;
  interestStatus?: InterestGateStatus;
  onClose: () => void;
  onSendInterest?: () => void;
  onUpgrade?: () => void;
};

const ChatGateModal: React.FC<Props> = ({
  open,
  code,
  message,
  profile,
  interestStatus = 'none',
  onClose,
  onSendInterest,
  onUpgrade,
}) => {
  if (!open) return null;

  const isPremium = code === 'PREMIUM_REQUIRED';
  const isInterest = code === 'INTEREST_NOT_ACCEPTED' || (!isPremium && !code);

  const partnerName = profile?.name?.split(/\s+/)[0] ?? 'them';

  let title = 'Chat not available yet';
  let subtitle = message ?? 'You cannot open this chat right now.';
  let icon = 'lock';
  let iconBg = 'bg-primary/10 dark:bg-primary/20';
  let iconColor = 'text-primary';

  if (isPremium) {
    title = interestStatus === 'accepted' ? 'Mutual match — unlock chat' : 'Chat is Premium';
    subtitle =
      interestStatus === 'accepted'
        ? `You and ${partnerName} accepted each other’s interest. Upgrade to Premium to start messaging.`
        : message ??
          'Private chat is included with Premium after mutual interest is accepted.';
    icon = 'workspace_premium';
    iconBg = 'bg-saffron/15 dark:bg-saffron/20';
    iconColor = 'text-saffron';
  } else if (isInterest) {
    icon = 'favorite';
    iconBg = 'bg-rose-50 dark:bg-rose-900/25';
    iconColor = 'text-primary';
    if (interestStatus === 'pending') {
      title = 'Interest sent — hang tight!';
      subtitle = `You’ve sent interest to ${partnerName}. Chat opens once they accept. We’ll notify you.`;
    } else if (interestStatus === 'rejected') {
      title = 'Interest was declined';
      subtitle = `You can send interest again from ${partnerName}’s profile, or explore other matches.`;
    } else {
      title = 'Chat opens after mutual interest';
      subtitle = `Send interest to ${partnerName}. Once they accept, you can start a private conversation.`;
    }
  }

  const steps = [
    { n: 1, label: 'Send interest', done: interestStatus !== 'none' },
    { n: 2, label: 'They accept', done: interestStatus === 'accepted' },
    { n: 3, label: 'Chat unlocks', done: false },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 pb-8 sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-gate-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-fade-up">
        {profile && (
          <div className="h-28 bg-gradient-to-br from-primary/90 via-primary to-primary/80 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20 bg-cover bg-center"
              style={{ backgroundImage: `url(${profile.imageUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-4 left-5 flex items-center gap-3">
              <div
                className="size-12 rounded-full border-2 border-white/80 bg-cover bg-center shadow-lg"
                style={{ backgroundImage: `url(${profile.imageUrl})` }}
              />
              <div className="text-left">
                <p className="text-white font-black text-base leading-tight">{profile.name}</p>
                <p className="text-white/80 text-xs font-bold">{profile.location || 'Namdev Connect'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pt-6 pb-6 text-center">
          <div
            className={`mx-auto w-16 h-16 ${iconBg} rounded-2xl flex items-center justify-center mb-4 -mt-10 relative z-10 border-4 border-white dark:border-gray-900 shadow-md`}
          >
            <span className={`material-symbols-outlined ${iconColor} text-4xl`} style={{ fontVariationSettings: "'FILL' 1" }}>
              {icon}
            </span>
          </div>

          <h2 id="chat-gate-title" className="text-xl font-black text-[#191011] dark:text-white mb-2 tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6 max-w-[320px] mx-auto">
            {subtitle}
          </p>

          {isInterest && !isPremium && (
            <div className="mb-6 text-left bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">How it works</p>
              <ol className="space-y-2.5">
                {steps.map((s) => (
                  <li key={s.n} className="flex items-center gap-3">
                    <span
                      className={`shrink-0 size-7 rounded-full text-xs font-black flex items-center justify-center ${
                        s.done
                          ? 'bg-green-500 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-400 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {s.done ? (
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      ) : (
                        s.n
                      )}
                    </span>
                    <span
                      className={`text-sm font-semibold ${s.done ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-3">
            {isPremium && onUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">workspace_premium</span>
                View Premium Plans
              </button>
            )}

            {isInterest && interestStatus !== 'pending' && onSendInterest && (
              <button
                type="button"
                onClick={onSendInterest}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                  favorite
                </span>
                {interestStatus === 'rejected' ? 'Send interest again' : 'Send interest'}
              </button>
            )}

            {isInterest && interestStatus === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
                >
                  Got it
                </button>
                {onSendInterest && (
                  <button
                    type="button"
                    onClick={onSendInterest}
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform"
                  >
                    View profile
                  </button>
                )}
              </>
            )}

            {!(isInterest && interestStatus === 'pending') && (
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform"
              >
                Go back
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatGateModal;

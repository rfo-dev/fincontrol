import React from 'react';
import { Locale, useI18n } from '../../i18n/LanguageProvider';

type Props = {
  variant?: 'header' | 'login' | 'menu';
};

function FlagBR({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 20"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="28" height="20" rx="3" fill="#009B3A" />
      <path d="M14 3.2 24.2 10 14 16.8 3.8 10Z" fill="#FFDF00" />
      <circle cx="14" cy="10" r="4.1" fill="#002776" />
      <path
        d="M10.2 9.1c1.4-1 3.1-1.4 4.8-1.2.9.1 1.7.4 2.5.8"
        fill="none"
        stroke="#fff"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlagUS({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 20"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="28" height="20" rx="3" fill="#B22234" />
      <path
        fill="#fff"
        d="M0 2.2h28v1.55H0zm0 3.1h28v1.55H0zm0 3.1h28v1.55H0zm0 3.1h28v1.55H0zm0 3.1h28v1.55H0z"
      />
      <rect width="12.5" height="10.8" rx="0" fill="#3C3B6E" />
      <g fill="#fff">
        <circle cx="2.2" cy="2" r="0.55" />
        <circle cx="4.4" cy="2" r="0.55" />
        <circle cx="6.6" cy="2" r="0.55" />
        <circle cx="8.8" cy="2" r="0.55" />
        <circle cx="11" cy="2" r="0.55" />
        <circle cx="3.3" cy="3.5" r="0.55" />
        <circle cx="5.5" cy="3.5" r="0.55" />
        <circle cx="7.7" cy="3.5" r="0.55" />
        <circle cx="9.9" cy="3.5" r="0.55" />
        <circle cx="2.2" cy="5" r="0.55" />
        <circle cx="4.4" cy="5" r="0.55" />
        <circle cx="6.6" cy="5" r="0.55" />
        <circle cx="8.8" cy="5" r="0.55" />
        <circle cx="11" cy="5" r="0.55" />
        <circle cx="3.3" cy="6.5" r="0.55" />
        <circle cx="5.5" cy="6.5" r="0.55" />
        <circle cx="7.7" cy="6.5" r="0.55" />
        <circle cx="9.9" cy="6.5" r="0.55" />
        <circle cx="2.2" cy="8" r="0.55" />
        <circle cx="4.4" cy="8" r="0.55" />
        <circle cx="6.6" cy="8" r="0.55" />
        <circle cx="8.8" cy="8" r="0.55" />
        <circle cx="11" cy="8" r="0.55" />
      </g>
    </svg>
  );
}

const options: { value: Locale; labelKey: 'language.ptBR' | 'language.en'; Flag: typeof FlagBR }[] =
  [
    { value: 'pt-BR', labelKey: 'language.ptBR', Flag: FlagBR },
    { value: 'en', labelKey: 'language.en', Flag: FlagUS },
  ];

const LanguageSwitcher: React.FC<Props> = ({ variant = 'header' }) => {
  const { locale, setLocale, t } = useI18n();

  const isLogin = variant === 'login';
  const isMenu = variant === 'menu';

  const shellClass = isLogin
    ? 'absolute right-4 top-4 z-20 sm:right-6 sm:top-6'
    : isMenu
      ? 'w-full'
      : 'hidden lg:block';

  const groupClass = isLogin
    ? 'inline-flex items-center gap-1 rounded-2xl bg-white/12 p-1 ring-1 ring-white/20 backdrop-blur'
    : isMenu
      ? 'flex w-full items-center gap-1 rounded-xl bg-white/8 p-1'
      : 'inline-flex items-center gap-1 rounded-2xl bg-white/10 p-1 ring-1 ring-white/12';

  return (
    <div className={shellClass} role="group" aria-label={t('language.label')}>
      <div className={groupClass}>
        {options.map(({ value, labelKey, Flag }) => {
          const active = locale === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setLocale(value)}
              aria-pressed={active}
              aria-label={t(labelKey)}
              title={t(labelKey)}
              className={`group relative flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? isLogin || isMenu
                    ? 'bg-white text-ink shadow-sm'
                    : 'bg-white/20 text-white shadow-sm ring-1 ring-white/20'
                  : isLogin || isMenu
                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                    : 'text-white/55 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Flag
                className={`h-4 w-[22px] shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 transition ${
                  active ? 'ring-black/10' : 'ring-white/20 opacity-85 group-hover:opacity-100'
                }`}
              />
              <span className="hidden sm:inline">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageSwitcher;

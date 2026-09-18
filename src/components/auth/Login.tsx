import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { LogIn, UserPlus, AlertCircle, Wallet, Shield } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageProvider';
import LanguageSwitcher from '../shared/LanguageSwitcher';

type AuthMode = 'login' | 'signup' | 'admin';

function hasSecretAdminAccess(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('admin') === '1';
}

const Login: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>(() =>
    hasSecretAdminAccess() ? 'admin' : 'login'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, signInAdmin, signUp } = useAuthStore();

  useEffect(() => {
    if (hasSecretAdminAccess()) {
      setMode('admin');
    }
  }, []);

  const resetForm = () => {
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (mode === 'login') {
        await signIn(email, password);
        return;
      }

      if (mode === 'admin') {
        await signInAdmin(email, password);
        return;
      }

      if (name.trim().length < 2) {
        setError(t('auth.errorFullName'));
        return;
      }
      if (password.length < 6) {
        setError(t('auth.errorPasswordLength'));
        return;
      }
      if (password !== confirmPassword) {
        setError(t('auth.errorPasswordMismatch'));
        return;
      }
      await signUp(name.trim(), email, password);
    } catch (err: unknown) {
      console.error('Auth error:', err);
      const message = err instanceof Error ? err.message : '';

      if (
        message.includes('já está cadastrado') ||
        message.toLowerCase().includes('already')
      ) {
        setError(t('auth.errorEmailTaken'));
        setPassword('');
        setConfirmPassword('');
        setMode('login');
      } else if (message.includes('restrito a administradores')) {
        setError(t('auth.errorAdminOnly'));
      } else if (
        message.includes('inválidos') ||
        message.toLowerCase().includes('invalid')
      ) {
        setError(t('auth.errorInvalidCredentials'));
      } else {
        setError(message || t('auth.errorGeneric'));
      }
    }
  };

  const title =
    mode === 'admin'
      ? t('auth.titleAdmin')
      : mode === 'signup'
        ? t('auth.titleSignup')
        : t('auth.titleLogin');
  const subtitle =
    mode === 'admin'
      ? t('auth.subtitleAdmin')
      : mode === 'signup'
        ? t('auth.subtitleSignup')
        : t('auth.subtitleLogin');

  return (
    <div className="relative min-h-screen overflow-hidden bg-login-glow">
      <LanguageSwitcher variant="login" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-4 py-10 lg:flex-row lg:justify-between lg:gap-16">
        <div className="max-w-md animate-fadeUp text-center text-white lg:text-left">
          <div className="mb-5 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            {mode === 'admin' ? (
              <Shield className="text-mint-bright" size={22} />
            ) : (
              <Wallet className="text-mint-bright" size={22} />
            )}
            <span className="font-display text-2xl font-bold tracking-tight">
              {mode === 'admin' ? t('auth.brandAdmin') : t('auth.brand')}
            </span>
          </div>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
            {mode === 'admin' ? t('auth.heroTitleAdmin') : t('auth.heroTitle')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65 sm:text-base">
            {mode === 'admin' ? t('auth.heroBodyAdmin') : t('auth.heroBody')}
          </p>
        </div>

        <div className="w-full max-w-md animate-fadeUp rounded-3xl border border-white/15 bg-white/95 p-6 shadow-lift backdrop-blur sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
            <p className="mt-1 text-sm text-ink/55">{subtitle}</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-expense/20 bg-expense-soft px-3 py-3 text-sm text-expense">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="fc-label">
                  {t('common.fullNameRequired')}
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="fc-input"
                  required
                  minLength={2}
                  placeholder={t('auth.namePlaceholder')}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="fc-label">
                {t('common.email')}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="fc-input"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="fc-label">
                {t('common.password')}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="fc-input"
                required
                minLength={6}
              />
              {mode === 'signup' && (
                <p className="mt-1.5 text-xs text-ink/45">{t('auth.passwordHint')}</p>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="fc-label">
                  {t('common.confirmPassword')}
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="fc-input"
                  required
                  minLength={6}
                />
              </div>
            )}

            <button type="submit" className="fc-btn-primary w-full py-3">
              {mode === 'signup' ? (
                <>
                  <UserPlus size={18} />
                  <span>{t('auth.submitSignup')}</span>
                </>
              ) : (
                <>
                  {mode === 'admin' ? <Shield size={18} /> : <LogIn size={18} />}
                  <span>
                    {mode === 'admin' ? t('auth.submitAdmin') : t('auth.submitLogin')}
                  </span>
                </>
              )}
            </button>
          </form>

          {mode !== 'admin' && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  resetForm();
                  setName('');
                }}
                className="text-sm font-medium text-mint hover:text-ink"
              >
                {mode === 'login' ? t('auth.switchToSignup') : t('auth.switchToLogin')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

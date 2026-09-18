import React, { useState } from 'react';
import {
  Menu,
  X,
  CreditCard,
  PieChart,
  TrendingUp,
  TrendingDown,
  LogOut,
  LayoutDashboard,
  Shield,
  ArrowLeft,
  Bot,
  MessageCircle,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../i18n/LanguageProvider';
import LanguageSwitcher from './LanguageSwitcher';

interface HeaderProps {
  activePage: string;
  setActivePage: (page: string) => void;
  adminMode?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  activePage,
  setActivePage,
  adminMode = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { signOut, user, enterAdminPortal, exitAdminPortal } = useAuthStore();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'income', label: t('nav.income'), icon: TrendingUp },
    { id: 'expenses', label: t('nav.expenses'), icon: TrendingDown },
    { id: 'credit-cards', label: t('nav.creditCards'), icon: CreditCard },
    { id: 'relatorios', label: t('nav.reports'), icon: PieChart },
  ];

  const adminNavItems = [
    { id: 'admin', label: t('nav.adminUsers'), icon: Shield },
    { id: 'admin-ai', label: t('nav.adminAgents'), icon: Bot },
    { id: 'admin-whatsapp', label: t('nav.adminWhatsApp'), icon: MessageCircle },
  ];

  const navigateTo = (page: string) => {
    setActivePage(page);
    setIsMenuOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const goToAdmin = () => {
    enterAdminPortal();
    setActivePage('admin');
    setIsMenuOpen(false);
  };

  const leaveAdmin = () => {
    exitAdminPortal();
    setActivePage('dashboard');
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 text-white backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-bright/15 ring-1 ring-mint-bright/30">
            <span className="font-display text-lg font-bold text-mint-bright">
              {adminMode ? 'A' : 'F'}
            </span>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold leading-none tracking-tight">
              {adminMode ? t('app.brandAdmin') : t('app.brand')}
            </h1>
            <p className="mt-0.5 hidden text-[11px] text-white/50 sm:block">
              {adminMode ? t('app.adminTagline') : t('app.tagline')}
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {adminMode
            ? adminNavItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigateTo(id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    activePage === id
                      ? 'bg-white/12 text-white shadow-sm ring-1 ring-white/10'
                      : 'text-white/65 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              ))
            : navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigateTo(id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    activePage === id
                      ? 'bg-white/12 text-white shadow-sm ring-1 ring-white/10'
                      : 'text-white/65 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          <div className="hidden max-w-[180px] truncate text-right text-xs text-white/50 xl:block">
            {user?.name || user?.email}
          </div>

          {isAdmin && !adminMode && (
            <button
              onClick={goToAdmin}
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-mint-bright transition hover:bg-white/8 lg:inline-flex"
              title={t('nav.adminPortal')}
            >
              <Shield size={16} />
              <span>{t('nav.admin')}</span>
            </button>
          )}

          {adminMode && (
            <button
              onClick={leaveAdmin}
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/8 lg:inline-flex"
            >
              <ArrowLeft size={16} />
              <span>{t('nav.app')}</span>
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15 lg:inline-flex"
          >
            <LogOut size={16} />
            <span>{t('nav.signOut')}</span>
          </button>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-white/10 bg-ink-soft px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            <div className="mb-2 px-1">
              <LanguageSwitcher variant="menu" />
            </div>

            {adminMode ? (
              adminNavItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigateTo(id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    activePage === id
                      ? 'bg-white/12 text-white'
                      : 'text-white/70 hover:bg-white/8'
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))
            ) : (
              navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigateTo(id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    activePage === id
                      ? 'bg-white/12 text-white'
                      : 'text-white/70 hover:bg-white/8'
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))
            )}

            {isAdmin && !adminMode && (
              <button
                onClick={goToAdmin}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-mint-bright hover:bg-white/8"
              >
                <Shield size={18} />
                <span>{t('nav.adminPortal')}</span>
              </button>
            )}

            {adminMode && (
              <button
                onClick={leaveAdmin}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/8"
              >
                <ArrowLeft size={18} />
                <span>{t('nav.backToApp')}</span>
              </button>
            )}

            <button
              onClick={handleSignOut}
              className="mt-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-rose-300 hover:bg-rose-500/10"
            >
              <LogOut size={18} />
              <span>{t('nav.signOut')}</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;

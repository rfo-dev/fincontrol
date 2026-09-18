import React, { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { FinanceProvider } from './context/FinanceContext';
import Header from './components/shared/Header';
import Dashboard from './components/dashboard/Dashboard';
import IncomeList from './components/income/IncomeList';
import ExpensesList from './components/expenses/ExpensesList';
import CreditCardsList from './components/creditCards/CreditCardsList';
import Reports from './components/reports/Reports';
import AdminUsers from './components/admin/AdminUsers';
import AdminAgents from './components/admin/AdminAgents';
import AdminWhatsApp from './components/admin/AdminWhatsApp';
import AiChatWidget from './components/ai/AiChatWidget';
import Login from './components/auth/Login';
import './index.css';

function App() {
  const [activePage, setActivePage] = React.useState('dashboard');
  const { user, loading, checkUser, adminPortal } = useAuthStore();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    const adminPages = ['admin', 'admin-ai', 'admin-whatsapp'];
    if (adminPortal) {
      setActivePage((page) => (adminPages.includes(page) ? page : 'admin'));
    } else if (adminPages.includes(activePage)) {
      setActivePage('dashboard');
    }
  }, [adminPortal]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-glow">
        <div className="flex flex-col items-center gap-3">
          <div className="h-11 w-11 animate-softPulse rounded-2xl border-2 border-mint/30 border-t-mint" />
          <p className="text-sm font-medium text-ink/50">Carregando FinControl…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (adminPortal && user.role === 'admin') {
    return (
      <div className="min-h-screen bg-app-glow">
        <Header activePage={activePage} setActivePage={setActivePage} adminMode />
        <main className="mx-auto max-w-7xl pb-10 pt-2">
          {activePage === 'admin-ai' ? (
            <AdminAgents />
          ) : activePage === 'admin-whatsapp' ? (
            <AdminWhatsApp />
          ) : (
            <AdminUsers />
          )}
        </main>
      </div>
    );
  }

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'income':
        return <IncomeList />;
      case 'expenses':
        return <ExpensesList />;
      case 'credit-cards':
        return <CreditCardsList />;
      case 'relatorios':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <FinanceProvider>
      <div className="min-h-screen bg-app-glow">
        <Header activePage={activePage} setActivePage={setActivePage} />
        <main className="mx-auto max-w-7xl pb-10 pt-2">
          {renderActivePage()}
        </main>
        <AiChatWidget />
      </div>
    </FinanceProvider>
  );
}

export default App;

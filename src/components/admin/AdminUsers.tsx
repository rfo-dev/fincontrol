import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/formatters';
import { AppRole, normalizeAppRole, roleLabel } from '../../lib/roles';
import ToggleSwitch from '../ui/ToggleSwitch';
import { useTranslation } from '../../i18n/LanguageProvider';

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: AppRole | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const AdminUsers: React.FC = () => {
  const { t, dateLocale } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'user' as AppRole,
    isActive: true,
  });
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user' as AppRole,
    isActive: true,
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api<AdminUser[]>('/api/admin/users');
      setUsers(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('adminUsers.errorLoad');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        (u.name || '').toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term)
    );
  }, [users, search]);

  const openCreate = () => {
    setIsCreating(true);
    setCreateForm({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      isActive: true,
    });
    setError('');
  };

  const saveCreate = async () => {
    if (createForm.name.trim().length < 2) {
      setError(t('adminUsers.errorFullName'));
      return;
    }
    if (!createForm.email.trim()) {
      setError(t('adminUsers.errorEmail'));
      return;
    }
    if (createForm.password.length < 6) {
      setError(t('adminUsers.errorPasswordLength'));
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      setError(t('adminUsers.errorPasswordMismatch'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      const created = await api<AdminUser>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim().toLowerCase(),
          password: createForm.password,
          role: createForm.role,
          isActive: createForm.isActive,
        }),
      });
      setUsers((prev) => [created, ...prev]);
      setIsCreating(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('adminUsers.errorCreate');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email,
      role: normalizeAppRole(user.role),
      isActive: user.isActive,
    });
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    if (editForm.name.trim().length < 2) {
      setError(t('adminUsers.errorFullName'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      const updated = await api<AdminUser>(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
          role: editForm.role,
          isActive: editForm.isActive,
        }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUser(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('adminUsers.errorUpdate');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: AdminUser) => {
    if (user.id === currentUser?.id) {
      setError(t('adminUsers.errorSelfDisable'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      const updated = await api<AdminUser>(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('adminUsers.errorStatus');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const savePasswordReset = async () => {
    if (!resetUser) return;
    if (newPassword.length < 6) {
      setError(t('adminUsers.errorNewPasswordLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('adminUsers.errorPasswordMismatch'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api<{ ok: boolean }>(`/api/admin/users/${resetUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      setResetUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('adminUsers.errorReset');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fc-page">
      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">{t('adminUsers.title')}</h2>
          <p className="fc-subtitle">{t('adminUsers.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="fc-btn-primary" onClick={openCreate}>
            <Plus size={16} />
            {t('adminUsers.newUser')}
          </button>
          <button className="fc-btn-secondary" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-expense/20 bg-expense-soft px-3 py-3 text-sm text-expense">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <p>{error}</p>
        </div>
      )}

      <div className="fc-card mb-5 p-4">
        <label className="fc-label" htmlFor="admin-user-search">{t('adminUsers.searchLabel')}</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <input
            id="admin-user-search"
            className="fc-input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('adminUsers.searchPlaceholder')}
          />
        </div>
      </div>

      {loading ? (
        <div className="fc-empty">{t('adminUsers.loading')}</div>
      ) : filteredUsers.length === 0 ? (
        <div className="fc-empty">{t('adminUsers.empty')}</div>
      ) : (
        <>
          <div className="fc-desktop-table">
            <div className="fc-card overflow-hidden">
              <div className="fc-table-wrap">
                <table className="fc-table">
                  <thead>
                    <tr>
                      <th>{t('adminUsers.name')}</th>
                      <th>{t('adminUsers.email')}</th>
                      <th>{t('adminUsers.role')}</th>
                      <th>{t('adminUsers.status')}</th>
                      <th>{t('adminUsers.registered')}</th>
                      <th className="text-center">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="font-medium text-ink">{user.name || t('common.emDash')}</td>
                        <td>{user.email}</td>
                        <td>
                          <span
                            className={
                              user.role === 'admin'
                                ? 'fc-badge-info'
                                : user.role === 'user_ai'
                                  ? 'fc-badge-success'
                                  : 'fc-badge-warn'
                            }
                          >
                            {roleLabel(user.role, t)}
                          </span>
                        </td>
                        <td>
                          <span className={user.isActive ? 'fc-badge-success' : 'fc-badge-danger'}>
                            {user.isActive ? t('adminUsers.active') : t('adminUsers.disabled')}
                          </span>
                        </td>
                        <td>{formatDate(user.createdAt, dateLocale)}</td>
                        <td>
                          <div className="flex justify-center gap-2">
                            <button
                              className="fc-icon-btn bg-mint-soft text-mint hover:bg-mint hover:text-white"
                              title={t('adminUsers.editUser')}
                              onClick={() => openEdit(user)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="fc-icon-btn bg-mist text-ink/70 hover:bg-mist-line"
                              title={t('adminUsers.resetPassword')}
                              onClick={() => {
                                setResetUser(user);
                                setNewPassword('');
                                setConfirmPassword('');
                              }}
                            >
                              <KeyRound size={16} />
                            </button>
                            <button
                              className={`fc-icon-btn ${
                                user.isActive
                                  ? 'bg-expense-soft text-expense hover:bg-expense hover:text-white'
                                  : 'bg-income-soft text-income hover:bg-income hover:text-white'
                              }`}
                              title={user.isActive ? t('adminUsers.disableUser') : t('adminUsers.enableUser')}
                              onClick={() => void toggleActive(user)}
                              disabled={saving || user.id === currentUser?.id}
                            >
                              {user.isActive ? <UserX size={16} /> : <Check size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="fc-mobile-list space-y-3">
            {filteredUsers.map((user) => (
              <div key={user.id} className="fc-card p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{user.name || t('common.noName')}</p>
                    <p className="text-sm text-ink/55">{user.email}</p>
                  </div>
                  <span className={user.isActive ? 'fc-badge-success' : 'fc-badge-danger'}>
                    {user.isActive ? t('adminUsers.active') : t('adminUsers.disabled')}
                  </span>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <span
                    className={
                      user.role === 'admin'
                        ? 'fc-badge-info'
                        : user.role === 'user_ai'
                          ? 'fc-badge-success'
                          : 'fc-badge-warn'
                    }
                  >
                    {roleLabel(user.role, t)}
                  </span>
                  <span className="text-xs text-ink/45">{t('adminUsers.since', { date: formatDate(user.createdAt, dateLocale) })}</span>
                </div>
                <div className="flex gap-2">
                  <button className="fc-btn-secondary !px-3 !py-1.5 text-xs" onClick={() => openEdit(user)}>
                    <Pencil size={14} /> {t('common.edit')}
                  </button>
                  <button
                    className="fc-btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => {
                      setResetUser(user);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    <KeyRound size={14} /> {t('adminUsers.passwordShort')}
                  </button>
                  <button
                    className="fc-btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => void toggleActive(user)}
                    disabled={saving || user.id === currentUser?.id}
                  >
                    {user.isActive ? <UserX size={14} /> : <Check size={14} />}
                    {user.isActive ? t('adminUsers.disable') : t('adminUsers.enable')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isCreating &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
            <div className="fc-card w-full max-w-md p-5 shadow-lift sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{t('adminUsers.createTitle')}</h3>
                  <p className="mt-1 text-sm text-ink/55">
                    {t('adminUsers.createSubtitle')}
                  </p>
                </div>
                <button
                  className="fc-icon-btn"
                  onClick={() => setIsCreating(false)}
                  aria-label={t('common.close')}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="fc-label">{t('common.fullNameRequired')}</label>
                  <input
                    className="fc-input"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="fc-label">{t('common.emailRequired')}</label>
                  <input
                    type="email"
                    className="fc-input"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="fc-label">{t('common.passwordRequired')}</label>
                  <input
                    type="password"
                    className="fc-input"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="fc-label">{t('common.confirmPasswordRequired')}</label>
                  <input
                    type="password"
                    className="fc-input"
                    value={createForm.confirmPassword}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, confirmPassword: e.target.value }))
                    }
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="fc-label">{t('common.profile')}</label>
                  <select
                    className="fc-input"
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, role: e.target.value as AppRole }))
                    }
                  >
                    <option value="user">{t('roles.user')}</option>
                    <option value="user_ai">{t('roles.user_ai')}</option>
                    <option value="admin">{t('roles.admin')}</option>
                  </select>
                </div>
                <ToggleSwitch
                  checked={createForm.isActive}
                  onChange={(checked) => setCreateForm((f) => ({ ...f, isActive: checked }))}
                  label={t('adminUsers.accountActive')}
                  className="w-fit"
                />
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  className="fc-btn-secondary"
                  onClick={() => setIsCreating(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button className="fc-btn-primary" onClick={() => void saveCreate()} disabled={saving}>
                  <UserPlus size={16} />
                  {saving ? t('common.creating') : t('adminUsers.createUser')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {editingUser &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
            <div className="fc-card w-full max-w-md p-5 shadow-lift sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{t('adminUsers.editTitle')}</h3>
                  <p className="mt-1 text-sm text-ink/55">{editingUser.email}</p>
                </div>
                <button className="fc-icon-btn" onClick={() => setEditingUser(null)} aria-label={t('common.close')}>
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="fc-label">{t('common.fullName')}</label>
                  <input
                    className="fc-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="fc-label">{t('common.email')}</label>
                  <input
                    type="email"
                    className="fc-input"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="fc-label">{t('common.profile')}</label>
                  <select
                    className="fc-input"
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, role: e.target.value as AppRole }))
                    }
                    disabled={editingUser.id === currentUser?.id}
                  >
                    <option value="user">{t('roles.user')}</option>
                    <option value="user_ai">{t('roles.user_ai')}</option>
                    <option value="admin">{t('roles.admin')}</option>
                  </select>
                </div>
                <ToggleSwitch
                  checked={editForm.isActive}
                  onChange={(checked) => setEditForm((f) => ({ ...f, isActive: checked }))}
                  disabled={editingUser.id === currentUser?.id}
                  label={t('adminUsers.accountActive')}
                  className="w-fit"
                />
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button className="fc-btn-secondary" onClick={() => setEditingUser(null)} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button className="fc-btn-primary" onClick={() => void saveEdit()} disabled={saving}>
                  <Shield size={16} />
                  {saving ? t('common.savingEllipsis') : t('common.save')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {resetUser &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
            <div className="fc-card w-full max-w-md p-5 shadow-lift sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{t('adminUsers.resetTitle')}</h3>
                  <p className="mt-1 text-sm text-ink/55">
                    {resetUser.name || resetUser.email}
                  </p>
                </div>
                <button
                  className="fc-icon-btn"
                  onClick={() => setResetUser(null)}
                  aria-label={t('common.close')}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="fc-label">{t('adminUsers.newPassword')}</label>
                  <input
                    type="password"
                    className="fc-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="fc-label">{t('adminUsers.confirmNewPassword')}</label>
                  <input
                    type="password"
                    className="fc-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button className="fc-btn-secondary" onClick={() => setResetUser(null)} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button className="fc-btn-primary" onClick={() => void savePasswordReset()} disabled={saving}>
                  <KeyRound size={16} />
                  {saving ? t('common.savingEllipsis') : t('adminUsers.resetPassword')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AdminUsers;

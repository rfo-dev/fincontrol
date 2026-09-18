import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Bot,
  Pencil,
  Plus,
  RefreshCw,
  Trash,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { defaultModelForProvider, modelsForProvider } from '../../lib/aiModels';
import { APP_ROLES, AppRole, roleLabel } from '../../lib/roles';
import ToggleSwitch from '../ui/ToggleSwitch';
import { useTranslation } from '../../i18n/LanguageProvider';

type AiAgent = {
  id: string;
  name: string;
  provider: 'openai' | 'claude' | string;
  model: string;
  apiKeyMasked: string;
  systemPrompt: string;
  isEnabled: boolean;
  audienceMode: 'all' | 'roles' | string;
  enabledRoles: AppRole[];
  createdAt: string;
  updatedAt: string;
};

function audienceSummary(
  agent: AiAgent,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (!agent.isEnabled) return t('adminAgents.audienceDisabled');
  if (agent.audienceMode !== 'roles') return t('adminAgents.audienceAll');
  if (!agent.enabledRoles?.length) return t('adminAgents.audienceNone');
  return agent.enabledRoles.map((role) => roleLabel(role, t)).join(', ');
}

const AdminAgents: React.FC = () => {
  const { t } = useTranslation();
  const makeEmptyForm = () => ({
    name: t('adminAgents.defaultName'),
    provider: 'openai' as 'openai' | 'claude',
    model: defaultModelForProvider('openai'),
    apiKey: '',
    systemPrompt: t('adminAgents.defaultPrompt'),
    isEnabled: false,
    audienceMode: 'all' as 'all' | 'roles',
    enabledRoles: ['user_ai'] as AppRole[],
  });
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AiAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api<AiAgent[]>('/api/admin/ai/agents');
      setAgents(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminAgents.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAgents();
  }, []);

  const openCreate = () => {
    setIsCreating(true);
    setEditing(null);
    setForm(makeEmptyForm());
    setError('');
  };

  const openEdit = (agent: AiAgent) => {
    const provider = agent.provider === 'claude' ? 'claude' : 'openai';
    const models = modelsForProvider(provider);
    const model = models.some((m) => m.id === agent.model)
      ? agent.model
      : models[0].id;

    setEditing(agent);
    setIsCreating(false);
    setForm({
      name: agent.name,
      provider,
      model,
      apiKey: '',
      systemPrompt: agent.systemPrompt,
      isEnabled: agent.isEnabled,
      audienceMode: agent.audienceMode === 'roles' ? 'roles' : 'all',
      enabledRoles: agent.enabledRoles?.length
        ? agent.enabledRoles
        : (['user_ai'] as AppRole[]),
    });
    setError('');
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const toggleRole = (role: AppRole) => {
    setForm((f) => {
      const has = f.enabledRoles.includes(role);
      return {
        ...f,
        enabledRoles: has
          ? f.enabledRoles.filter((r) => r !== role)
          : [...f.enabledRoles, role],
      };
    });
  };

  const saveAgent = async () => {
    if (form.name.trim().length < 2) {
      setError(t('adminAgents.errorName'));
      return;
    }
    if (form.systemPrompt.trim().length < 10) {
      setError(t('adminAgents.errorPrompt'));
      return;
    }
    if (isCreating && form.apiKey.trim().length < 10) {
      setError(t('adminAgents.errorApiKey'));
      return;
    }
    if (form.isEnabled && form.audienceMode === 'roles' && form.enabledRoles.length === 0) {
      setError(t('adminAgents.errorRoles'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        model: form.model,
        systemPrompt: form.systemPrompt.trim(),
        isEnabled: form.isEnabled,
        audienceMode: form.audienceMode,
        enabledRoles: form.audienceMode === 'roles' ? form.enabledRoles : [],
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      };

      if (editing) {
        const updated = await api<AiAgent>(`/api/admin/ai/agents/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await api<AiAgent>('/api/admin/ai/agents', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setAgents((prev) => [created, ...prev]);
      }
      closeModal();
      await loadAgents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminAgents.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (agent: AiAgent) => {
    try {
      setSaving(true);
      setError('');
      await api<AiAgent>(`/api/admin/ai/agents/${agent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !agent.isEnabled }),
      });
      await loadAgents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminAgents.errorStatus'));
    } finally {
      setSaving(false);
    }
  };

  const deleteAgent = async (agent: AiAgent) => {
    if (!window.confirm(t('adminAgents.confirmDelete', { name: agent.name }))) return;
    try {
      setSaving(true);
      await api<void>(`/api/admin/ai/agents/${agent.id}`, { method: 'DELETE' });
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminAgents.errorDelete'));
    } finally {
      setSaving(false);
    }
  };

  const showModal = isCreating || !!editing;
  const modelOptions = modelsForProvider(form.provider);

  return (
    <div className="fc-page">
      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">{t('adminAgents.title')}</h2>
          <p className="fc-subtitle">
            {t('adminAgents.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="fc-btn-primary" onClick={openCreate}>
            <Plus size={16} />
            {t('adminAgents.newAgent')}
          </button>
          <button className="fc-btn-secondary" onClick={() => void loadAgents()} disabled={loading}>
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

      <div className="mb-5 rounded-xl border border-mint/20 bg-mint-soft/40 px-4 py-3 text-sm text-ink/70">
        {t('adminAgents.infoBanner')}
      </div>

      {loading ? (
        <div className="fc-empty">{t('adminAgents.loading')}</div>
      ) : agents.length === 0 ? (
        <div className="fc-empty">
          <Bot size={32} className="mb-3 text-mint" />
          <p className="mb-4 text-ink/55">{t('adminAgents.empty')}</p>
          <button className="fc-btn-primary" onClick={openCreate}>
            <Plus size={16} />
            {t('adminAgents.createFirst')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {agents.map((agent) => (
            <div key={agent.id} className="fc-card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{agent.name}</h3>
                  <p className="mt-1 text-sm text-ink/55">
                    {agent.provider === 'claude' ? 'Claude' : 'OpenAI'} · {agent.model}
                  </p>
                  <p className="mt-1 text-xs text-ink/40">{t('adminAgents.keyLabel', { masked: agent.apiKeyMasked })}</p>
                  <p className="mt-2 text-xs text-ink/55">{t('adminAgents.audienceLabel', { summary: audienceSummary(agent, t) })}</p>
                </div>
                <ToggleSwitch
                  checked={agent.isEnabled}
                  disabled={saving}
                  onChange={() => void toggleEnabled(agent)}
                  label={agent.isEnabled ? t('common.active') : t('common.inactive')}
                />
              </div>
              <p className="mb-4 line-clamp-3 text-sm text-ink/60">{agent.systemPrompt}</p>
              <div className="flex flex-wrap gap-2">
                <button className="fc-btn-secondary !px-3 !py-1.5 text-xs" onClick={() => openEdit(agent)}>
                  <Pencil size={14} /> {t('adminAgents.edit')}
                </button>
                <button
                  className="fc-btn-secondary !px-3 !py-1.5 text-xs text-expense"
                  onClick={() => void deleteAgent(agent)}
                  disabled={saving}
                >
                  <Trash size={14} /> {t('adminAgents.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
            <div className="fc-card max-h-[90vh] w-full max-w-xl overflow-y-auto p-5 shadow-lift sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {editing ? t('adminAgents.modalEdit') : t('adminAgents.modalCreate')}
                  </h3>
                  <p className="mt-1 text-sm text-ink/55">
                    {t('adminAgents.modalSubtitle')}
                  </p>
                </div>
                <button className="fc-icon-btn" onClick={closeModal} aria-label={t('common.close')}>
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="fc-label">{t('common.nameRequired')}</label>
                  <input
                    className="fc-input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="fc-label">{t('adminAgents.provider')}</label>
                    <select
                      className="fc-input"
                      value={form.provider}
                      onChange={(e) => {
                        const provider = e.target.value as 'openai' | 'claude';
                        setForm((f) => ({
                          ...f,
                          provider,
                          model: defaultModelForProvider(provider),
                        }));
                      }}
                    >
                      <option value="openai">{t('adminAgents.providerOpenAI')}</option>
                      <option value="claude">{t('adminAgents.providerClaude')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="fc-label">{t('adminAgents.model')}</label>
                    <select
                      className="fc-input"
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    >
                      {modelOptions.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="fc-label">
                    {editing ? t('adminAgents.apiKeyKeep') : t('adminAgents.apiKey')}
                  </label>
                  <input
                    type="password"
                    className="fc-input"
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    placeholder={editing ? '••••••••' : 'sk-...'}
                  />
                </div>
                <div>
                  <label className="fc-label">{t('adminAgents.agentPrompt')}</label>
                  <textarea
                    className="fc-input min-h-[140px]"
                    value={form.systemPrompt}
                    onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  />
                </div>

                <ToggleSwitch
                  checked={form.isEnabled}
                  onChange={(checked) => setForm((f) => ({ ...f, isEnabled: checked }))}
                  label={t('adminAgents.enableAgent')}
                  className="w-fit"
                />

                {form.isEnabled && (
                  <div className="space-y-3 rounded-xl border border-mist-line bg-mist/30 p-3">
                    <p className="text-sm font-medium text-ink">{t('adminAgents.availability')}</p>
                    <div className="grid gap-2">
                      <label className="fc-switch-field cursor-pointer">
                        <input
                          type="radio"
                          className="accent-[var(--fc-mint)]"
                          name="audienceMode"
                          checked={form.audienceMode === 'all'}
                          onChange={() => setForm((f) => ({ ...f, audienceMode: 'all' }))}
                        />
                        <span className="text-sm text-ink/80">{t('adminAgents.allUsers')}</span>
                      </label>
                      <label className="fc-switch-field cursor-pointer">
                        <input
                          type="radio"
                          className="accent-[var(--fc-mint)]"
                          name="audienceMode"
                          checked={form.audienceMode === 'roles'}
                          onChange={() => setForm((f) => ({ ...f, audienceMode: 'roles' }))}
                        />
                        <span className="text-sm text-ink/80">{t('adminAgents.selectedRoles')}</span>
                      </label>
                    </div>

                    {form.audienceMode === 'roles' && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-ink/55">{t('adminAgents.rolesHint')}</p>
                        {APP_ROLES.map((role) => (
                          <ToggleSwitch
                            key={role}
                            checked={form.enabledRoles.includes(role)}
                            onChange={() => toggleRole(role)}
                            label={roleLabel(role, t)}
                            className="w-full"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button className="fc-btn-secondary" onClick={closeModal} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button className="fc-btn-primary" onClick={() => void saveAgent()} disabled={saving}>
                  <Bot size={16} />
                  {saving ? t('common.savingEllipsis') : editing ? t('common.save') : t('adminAgents.createAgent')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AdminAgents;

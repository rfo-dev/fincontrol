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

const DEFAULT_PROMPT = `Você é um assistente do FinControl.
Ajude o usuário a entender receitas, despesas, cartões e totais da própria conta.
Pode criar lançamentos e marcar pagos/recebidos quando solicitado com clareza.
Seja objetivo, em português do Brasil, e nunca invente valores.`;

const emptyForm = {
  name: 'Assistente Financeiro',
  provider: 'openai' as 'openai' | 'claude',
  model: defaultModelForProvider('openai'),
  apiKey: '',
  systemPrompt: DEFAULT_PROMPT,
  isEnabled: false,
  audienceMode: 'all' as 'all' | 'roles',
  enabledRoles: ['user_ai'] as AppRole[],
};

function audienceSummary(agent: AiAgent): string {
  if (!agent.isEnabled) return 'Desabilitado';
  if (agent.audienceMode !== 'roles') return 'Todos os usuários';
  if (!agent.enabledRoles?.length) return 'Nenhum perfil';
  return agent.enabledRoles.map(roleLabel).join(', ');
}

const AdminAgents: React.FC = () => {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AiAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api<AiAgent[]>('/api/admin/ai/agents');
      setAgents(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar agentes');
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
    setForm(emptyForm);
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
      setError('Informe o nome do agente');
      return;
    }
    if (form.systemPrompt.trim().length < 10) {
      setError('Informe um prompt com pelo menos 10 caracteres');
      return;
    }
    if (isCreating && form.apiKey.trim().length < 10) {
      setError('Informe a chave de API');
      return;
    }
    if (form.isEnabled && form.audienceMode === 'roles' && form.enabledRoles.length === 0) {
      setError('Selecione ao menos um perfil para habilitar');
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
      setError(err instanceof Error ? err.message : 'Falha ao salvar agente');
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
      setError(err instanceof Error ? err.message : 'Falha ao atualizar status');
    } finally {
      setSaving(false);
    }
  };

  const deleteAgent = async (agent: AiAgent) => {
    if (!window.confirm(`Excluir o agente "${agent.name}"?`)) return;
    try {
      setSaving(true);
      await api<void>(`/api/admin/ai/agents/${agent.id}`, { method: 'DELETE' });
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir agente');
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
          <h2 className="fc-title">Agentes de IA</h2>
          <p className="fc-subtitle">
            Configure prompt, provedor, modelo e para quais perfis o chat fica disponível.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="fc-btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Novo agente
          </button>
          <button className="fc-btn-secondary" onClick={() => void loadAgents()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
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
        Perfis do sistema: Admin, Usuário e Usuário + IA. O assistente só usa dados financeiros do
        usuário autenticado.
      </div>

      {loading ? (
        <div className="fc-empty">Carregando agentes…</div>
      ) : agents.length === 0 ? (
        <div className="fc-empty">
          <Bot size={32} className="mb-3 text-mint" />
          <p className="mb-4 text-ink/55">Nenhum agente configurado ainda</p>
          <button className="fc-btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Criar primeiro agente
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
                  <p className="mt-1 text-xs text-ink/40">Chave: {agent.apiKeyMasked}</p>
                  <p className="mt-2 text-xs text-ink/55">Público: {audienceSummary(agent)}</p>
                </div>
                <ToggleSwitch
                  checked={agent.isEnabled}
                  disabled={saving}
                  onChange={() => void toggleEnabled(agent)}
                  label={agent.isEnabled ? 'Ativo' : 'Inativo'}
                />
              </div>
              <p className="mb-4 line-clamp-3 text-sm text-ink/60">{agent.systemPrompt}</p>
              <div className="flex flex-wrap gap-2">
                <button className="fc-btn-secondary !px-3 !py-1.5 text-xs" onClick={() => openEdit(agent)}>
                  <Pencil size={14} /> Editar
                </button>
                <button
                  className="fc-btn-secondary !px-3 !py-1.5 text-xs text-expense"
                  onClick={() => void deleteAgent(agent)}
                  disabled={saving}
                >
                  <Trash size={14} /> Excluir
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
                    {editing ? 'Editar agente' : 'Novo agente'}
                  </h3>
                  <p className="mt-1 text-sm text-ink/55">
                    Configure provedor, modelo, chave, prompt e público
                  </p>
                </div>
                <button className="fc-icon-btn" onClick={closeModal} aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="fc-label">Nome*</label>
                  <input
                    className="fc-input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="fc-label">Provedor*</label>
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
                      <option value="openai">OpenAI</option>
                      <option value="claude">Claude (Anthropic)</option>
                    </select>
                  </div>
                  <div>
                    <label className="fc-label">Modelo*</label>
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
                    Chave de API{editing ? ' (deixe em branco para manter)' : '*'}
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
                  <label className="fc-label">Prompt do agente*</label>
                  <textarea
                    className="fc-input min-h-[140px]"
                    value={form.systemPrompt}
                    onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  />
                </div>

                <ToggleSwitch
                  checked={form.isEnabled}
                  onChange={(checked) => setForm((f) => ({ ...f, isEnabled: checked }))}
                  label="Habilitar agente"
                  className="w-fit"
                />

                {form.isEnabled && (
                  <div className="space-y-3 rounded-xl border border-mist-line bg-mist/30 p-3">
                    <p className="text-sm font-medium text-ink">Disponibilidade</p>
                    <div className="grid gap-2">
                      <label className="fc-switch-field cursor-pointer">
                        <input
                          type="radio"
                          className="accent-[var(--fc-mint)]"
                          name="audienceMode"
                          checked={form.audienceMode === 'all'}
                          onChange={() => setForm((f) => ({ ...f, audienceMode: 'all' }))}
                        />
                        <span className="text-sm text-ink/80">Todos os usuários</span>
                      </label>
                      <label className="fc-switch-field cursor-pointer">
                        <input
                          type="radio"
                          className="accent-[var(--fc-mint)]"
                          name="audienceMode"
                          checked={form.audienceMode === 'roles'}
                          onChange={() => setForm((f) => ({ ...f, audienceMode: 'roles' }))}
                        />
                        <span className="text-sm text-ink/80">Apenas perfis selecionados</span>
                      </label>
                    </div>

                    {form.audienceMode === 'roles' && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-ink/55">Marque os perfis com acesso ao chat</p>
                        {APP_ROLES.map((role) => (
                          <ToggleSwitch
                            key={role}
                            checked={form.enabledRoles.includes(role)}
                            onChange={() => toggleRole(role)}
                            label={roleLabel(role)}
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
                  Cancelar
                </button>
                <button className="fc-btn-primary" onClick={() => void saveAgent()} disabled={saving}>
                  <Bot size={16} />
                  {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar agente'}
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Link2, MessageCircle, RefreshCw, Save, Unplug } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/LanguageProvider';

type WhatsAppConfig = {
  configured: boolean;
  appId: string;
  configId: string;
  graphVersion: string;
  webhookVerifyToken: string;
  appSecretMasked: string;
  hasAppSecret: boolean;
  connection: {
    id: string;
    label: string;
    wabaId: string | null;
    phoneNumberId: string | null;
    displayPhone: string | null;
    businessId: string | null;
    tokenMasked: string;
    isActive: boolean;
  } | null;
  callbackUrls: {
    appDomain: string;
    oauthRedirect: string;
    webhook: string;
    deauthorize: string;
    dataDeletion: string;
  };
};

type SettingsForm = {
  appId: string;
  configId: string;
  graphVersion: string;
  webhookVerifyToken: string;
  appSecret: string;
};

type SessionPayload = {
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  displayPhone?: string;
  raw?: Record<string, unknown>;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (response: { authResponse?: { code?: string } }) => void,
        opts: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function loadFacebookSdk(appId: string, version: string, loadErrorMsg: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version,
      });
      resolve();
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: false,
        version,
      });
      resolve();
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing) return;

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.onerror = () => reject(new Error(loadErrorMsg));
    document.body.appendChild(script);
  });
}

const emptyForm: SettingsForm = {
  appId: '',
  configId: '',
  graphVersion: 'v21.0',
  webhookVerifyToken: '',
  appSecret: '',
};

const AdminWhatsApp: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const sessionRef = useRef<SessionPayload>({});

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api<WhatsAppConfig>('/api/admin/whatsapp/config');
      setConfig(data);
      setForm({
        appId: data.appId || '',
        configId: data.configId || '',
        graphVersion: data.graphVersion || 'v21.0',
        webhookVerifyToken: data.webhookVerifyToken || '',
        appSecret: '',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminWhatsApp.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes('facebook.com') && !event.origin.includes('fb.com')) {
        return;
      }

      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') return;

        const payload = (data.data || {}) as Record<string, unknown>;
        sessionRef.current = {
          wabaId: String(payload.waba_id || payload.wabaId || ''),
          phoneNumberId: String(
            payload.phone_number_id || payload.phoneNumberId || ''
          ),
          businessId: String(payload.business_id || payload.businessId || ''),
          displayPhone: String(
            payload.phone_number || payload.display_phone_number || ''
          ),
          raw: payload,
        };
      } catch {
        // ignore non-json messages
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setInfo('');
      await api('/api/admin/whatsapp/settings', {
        method: 'PUT',
        body: JSON.stringify({
          appId: form.appId.trim(),
          configId: form.configId.trim(),
          graphVersion: form.graphVersion.trim() || 'v21.0',
          webhookVerifyToken: form.webhookVerifyToken.trim(),
          ...(form.appSecret.trim() ? { appSecret: form.appSecret.trim() } : {}),
        }),
      });
      setInfo(t('adminWhatsApp.saved'));
      setForm((f) => ({ ...f, appSecret: '' }));
      await loadConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminWhatsApp.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const connectWhatsApp = async () => {
    if (!config?.configured) {
      setError(t('adminWhatsApp.errorSaveCredentialsFirst'));
      return;
    }

    try {
      setConnecting(true);
      setError('');
      setInfo('');
      sessionRef.current = {};

      await loadFacebookSdk(config.appId, config.graphVersion, t('adminWhatsApp.errorLoadSdk'));

      await new Promise<void>((resolve, reject) => {
        // FB.login exige callback síncrono (não async function).
        window.FB?.login(
          (response) => {
            const code = response.authResponse?.code;
            if (!code) {
              reject(new Error(t('adminWhatsApp.errorLoginCancelled')));
              return;
            }

            const session = sessionRef.current;
            void (async () => {
              try {
                await api('/api/admin/whatsapp/embedded-signup/complete', {
                  method: 'POST',
                  body: JSON.stringify({
                    code,
                    wabaId: session.wabaId || undefined,
                    phoneNumberId: session.phoneNumberId || undefined,
                    businessId: session.businessId || undefined,
                    displayPhone: session.displayPhone || undefined,
                    session: session.raw || {},
                  }),
                });

                setInfo(t('adminWhatsApp.connectedSuccess'));
                await loadConfig();
                resolve();
              } catch (err: unknown) {
                reject(
                  err instanceof Error ? err : new Error(t('adminWhatsApp.errorComplete'))
                );
              }
            })();
          },
          {
            config_id: config.configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: '',
              sessionInfoVersion: '3',
            },
          }
        );
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminWhatsApp.errorOpenSignup'));
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(t('adminWhatsApp.confirmDisconnect'))) return;
    try {
      setError('');
      await api('/api/admin/whatsapp/connection', { method: 'DELETE' });
      setInfo(t('adminWhatsApp.disconnected'));
      await loadConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('adminWhatsApp.errorDisconnect'));
    }
  };

  return (
    <div className="fc-page">
      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">{t('adminWhatsApp.title')}</h2>
          <p className="fc-subtitle">
            {t('adminWhatsApp.subtitle')}
          </p>
        </div>
        <button className="fc-btn-secondary" onClick={() => void loadConfig()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-expense/20 bg-expense-soft px-3 py-3 text-sm text-expense">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <p>{error}</p>
        </div>
      )}

      {info && (
        <div className="mb-4 rounded-xl border border-mint/20 bg-mint-soft/40 px-3 py-3 text-sm text-ink/70">
          {info}
        </div>
      )}

      <div className="mb-4 fc-card p-5">
        <h3 className="mb-1 font-display text-lg font-semibold text-ink">
          {t('adminWhatsApp.credentialsTitle')}
        </h3>
        <p className="mb-4 text-sm text-ink/55">
          {t('adminWhatsApp.credentialsBody')}
        </p>

        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveSettings(e)}>
          <div>
            <label className="fc-label" htmlFor="meta-app-id">
              {t('adminWhatsApp.appId')}
            </label>
            <input
              id="meta-app-id"
              className="fc-input"
              value={form.appId}
              onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))}
              placeholder="1735269627742980"
              required
              disabled={loading || saving}
            />
          </div>
          <div>
            <label className="fc-label" htmlFor="meta-config-id">
              {t('adminWhatsApp.configId')}
            </label>
            <input
              id="meta-config-id"
              className="fc-input"
              value={form.configId}
              onChange={(e) => setForm((f) => ({ ...f, configId: e.target.value }))}
              placeholder="3675948592581668"
              required
              disabled={loading || saving}
            />
          </div>
          <div>
            <label className="fc-label" htmlFor="meta-app-secret">
              {config?.hasAppSecret ? t('adminWhatsApp.appSecretCurrent', { masked: config.appSecretMasked }) : t('adminWhatsApp.appSecret')}
            </label>
            <input
              id="meta-app-secret"
              type="password"
              className="fc-input"
              value={form.appSecret}
              onChange={(e) => setForm((f) => ({ ...f, appSecret: e.target.value }))}
              placeholder={
                config?.hasAppSecret
                  ? t('adminWhatsApp.appSecretKeep')
                  : t('adminWhatsApp.appSecretPlaceholder')
              }
              required={!config?.hasAppSecret}
              disabled={loading || saving}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="fc-label" htmlFor="meta-graph-version">
              {t('adminWhatsApp.graphVersion')}
            </label>
            <input
              id="meta-graph-version"
              className="fc-input"
              value={form.graphVersion}
              onChange={(e) => setForm((f) => ({ ...f, graphVersion: e.target.value }))}
              placeholder="v21.0"
              disabled={loading || saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="fc-label" htmlFor="meta-verify-token">
              {t('adminWhatsApp.webhookVerifyToken')}
            </label>
            <input
              id="meta-verify-token"
              className="fc-input"
              value={form.webhookVerifyToken}
              onChange={(e) =>
                setForm((f) => ({ ...f, webhookVerifyToken: e.target.value }))
              }
              placeholder={t('adminWhatsApp.webhookTokenPlaceholder')}
              disabled={loading || saving}
            />
          </div>
          <div className="sm:col-span-2">
            <button className="fc-btn-primary" type="submit" disabled={loading || saving}>
              <Save size={16} />
              {saving ? t('common.savingEllipsis') : t('adminWhatsApp.saveConfig')}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="fc-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="text-mint" size={20} />
            <h3 className="font-display text-lg font-semibold text-ink">{t('adminWhatsApp.connection')}</h3>
          </div>

          {loading ? (
            <p className="text-sm text-ink/55">{t('adminWhatsApp.loading')}</p>
          ) : !config?.configured ? (
            <p className="text-sm text-ink/60">
              {t('adminWhatsApp.fillCredentials')}
            </p>
          ) : config.connection ? (
            <div className="space-y-2 text-sm text-ink/80">
              <p>
                <span className="text-ink/50">{t('adminWhatsApp.status')}</span> {t('adminWhatsApp.connected')}
              </p>
              <p>
                <span className="text-ink/50">{t('adminWhatsApp.waba')}</span> {config.connection.wabaId || t('common.emDash')}
              </p>
              <p>
                <span className="text-ink/50">{t('adminWhatsApp.phoneNumberId')}</span>{' '}
                {config.connection.phoneNumberId || t('common.emDash')}
              </p>
              <p>
                <span className="text-ink/50">{t('adminWhatsApp.number')}</span>{' '}
                {config.connection.displayPhone || t('common.emDash')}
              </p>
              <p>
                <span className="text-ink/50">{t('adminWhatsApp.token')}</span> {config.connection.tokenMasked}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink/60">{t('adminWhatsApp.noConnection')}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="fc-btn-primary"
              onClick={() => void connectWhatsApp()}
              disabled={connecting || !config?.configured}
            >
              <Link2 size={16} />
              {connecting ? t('adminWhatsApp.openingMeta') : t('adminWhatsApp.connect')}
            </button>
            {config?.connection && (
              <button className="fc-btn-secondary text-expense" onClick={() => void disconnect()}>
                <Unplug size={16} />
                {t('adminWhatsApp.disconnect')}
              </button>
            )}
          </div>
        </div>

        <div className="fc-card p-5">
          <h3 className="mb-3 font-display text-lg font-semibold text-ink">
            {t('adminWhatsApp.urlsTitle')}
          </h3>
          <p className="mb-3 text-sm text-ink/55">
            {t('adminWhatsApp.urlsBody')}
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="fc-label">{t('adminWhatsApp.oauthRedirect')}</p>
              <code className="block break-all rounded-lg bg-mist px-3 py-2 text-xs">
                {config?.callbackUrls.oauthRedirect || 'https://financial.cubotechbr.com.br/'}
              </code>
            </div>
            <div>
              <p className="fc-label">{t('adminWhatsApp.webhook')}</p>
              <code className="block break-all rounded-lg bg-mist px-3 py-2 text-xs">
                {config?.callbackUrls.webhook}
              </code>
            </div>
            <div>
              <p className="fc-label">{t('adminWhatsApp.deauthorize')}</p>
              <code className="block break-all rounded-lg bg-mist px-3 py-2 text-xs">
                {config?.callbackUrls.deauthorize}
              </code>
            </div>
            <div>
              <p className="fc-label">{t('adminWhatsApp.dataDeletion')}</p>
              <code className="block break-all rounded-lg bg-mist px-3 py-2 text-xs">
                {config?.callbackUrls.dataDeletion}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWhatsApp;

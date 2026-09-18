import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Link2, MessageCircle, RefreshCw, Unplug } from 'lucide-react';
import { api } from '../../lib/api';

type WhatsAppConfig = {
  configured: boolean;
  appId: string;
  configId: string;
  graphVersion: string;
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

function loadFacebookSdk(appId: string, version: string): Promise<void> {
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
    script.onerror = () => reject(new Error('Falha ao carregar Facebook SDK'));
    document.body.appendChild(script);
  });
}

const AdminWhatsApp: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar config WhatsApp');
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

  const connectWhatsApp = async () => {
    if (!config?.appId || !config.configId) {
      setError('Configure META_APP_ID e META_EMBEDDED_SIGNUP_CONFIG_ID no backend.');
      return;
    }

    try {
      setConnecting(true);
      setError('');
      setInfo('');
      sessionRef.current = {};

      await loadFacebookSdk(config.appId, config.graphVersion);

      await new Promise<void>((resolve, reject) => {
        window.FB?.login(
          async (response) => {
            try {
              const code = response.authResponse?.code;
              if (!code) {
                reject(new Error('Login cancelado ou sem código de autorização'));
                return;
              }

              const session = sessionRef.current;
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

              setInfo('WhatsApp conectado com sucesso.');
              await loadConfig();
              resolve();
            } catch (err: unknown) {
              reject(err instanceof Error ? err : new Error('Falha ao concluir conexão'));
            }
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
      setError(err instanceof Error ? err.message : 'Falha ao abrir Embedded Signup');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar WhatsApp deste ambiente?')) return;
    try {
      setError('');
      await api('/api/admin/whatsapp/connection', { method: 'DELETE' });
      setInfo('WhatsApp desconectado.');
      await loadConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao desconectar');
    }
  };

  return (
    <div className="fc-page">
      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">WhatsApp / Meta</h2>
          <p className="fc-subtitle">
            Conecte a API oficial da Meta pelo Cadastro incorporado (popup).
          </p>
        </div>
        <button className="fc-btn-secondary" onClick={() => void loadConfig()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="fc-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="text-mint" size={20} />
            <h3 className="font-display text-lg font-semibold text-ink">Conexão</h3>
          </div>

          {loading ? (
            <p className="text-sm text-ink/55">Carregando…</p>
          ) : !config?.configured ? (
            <p className="text-sm text-ink/60">
              Defina no backend: <code>META_APP_ID</code>, <code>META_APP_SECRET</code> e{' '}
              <code>META_EMBEDDED_SIGNUP_CONFIG_ID</code>.
            </p>
          ) : config.connection ? (
            <div className="space-y-2 text-sm text-ink/80">
              <p>
                <span className="text-ink/50">Status:</span> Conectado
              </p>
              <p>
                <span className="text-ink/50">WABA:</span> {config.connection.wabaId || '—'}
              </p>
              <p>
                <span className="text-ink/50">Phone Number ID:</span>{' '}
                {config.connection.phoneNumberId || '—'}
              </p>
              <p>
                <span className="text-ink/50">Número:</span>{' '}
                {config.connection.displayPhone || '—'}
              </p>
              <p>
                <span className="text-ink/50">Token:</span> {config.connection.tokenMasked}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink/60">Nenhuma conta WhatsApp conectada ainda.</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="fc-btn-primary"
              onClick={() => void connectWhatsApp()}
              disabled={connecting || !config?.configured}
            >
              <Link2 size={16} />
              {connecting ? 'Abrindo Meta…' : 'Conectar WhatsApp'}
            </button>
            {config?.connection && (
              <button className="fc-btn-secondary text-expense" onClick={() => void disconnect()}>
                <Unplug size={16} />
                Desconectar
              </button>
            )}
          </div>
        </div>

        <div className="fc-card p-5">
          <h3 className="mb-3 font-display text-lg font-semibold text-ink">
            URLs para a Meta
          </h3>
          <p className="mb-3 text-sm text-ink/55">
            Cadastre estes endereços no app Meta (domínio HTTPS + webhook).
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="fc-label">Domínio do app / OAuth Redirect</p>
              <code className="block break-all rounded-lg bg-mist px-3 py-2 text-xs">
                {config?.callbackUrls.oauthRedirect || 'https://financial.cubotechbr.com.br/'}
              </code>
            </div>
            <div>
              <p className="fc-label">Webhook</p>
              <code className="block break-all rounded-lg bg-mist px-3 py-2 text-xs">
                {config?.callbackUrls.webhook}
              </code>
            </div>
            <div>
              <p className="fc-label">Deauthorize callback</p>
              <code className="block break-all rounded-lg bg-mist px-3 py-2 text-xs">
                {config?.callbackUrls.deauthorize}
              </code>
            </div>
            <div>
              <p className="fc-label">Data deletion</p>
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

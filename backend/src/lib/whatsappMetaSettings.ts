import { prisma } from './prisma.js';
import { decryptSecret, encryptSecret, maskSecret } from './crypto.js';

export type MetaSettingsResolved = {
  appId: string;
  appSecret: string;
  configId: string;
  graphVersion: string;
  webhookVerifyToken: string;
  hasAppSecret: boolean;
};

const DEFAULT_ID = 'default';

async function ensureRow() {
  const existing = await prisma.whatsAppMetaSettings.findUnique({
    where: { id: DEFAULT_ID },
  });
  if (existing) return existing;

  const envSecret = process.env.META_APP_SECRET || '';
  return prisma.whatsAppMetaSettings.create({
    data: {
      id: DEFAULT_ID,
      appId: process.env.META_APP_ID || '',
      appSecretEnc: envSecret ? encryptSecret(envSecret) : null,
      embeddedSignupConfigId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
      graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    },
  });
}

export async function getMetaSettings(): Promise<MetaSettingsResolved> {
  const row = await ensureRow();

  let appSecret = '';
  if (row.appSecretEnc) {
    try {
      appSecret = decryptSecret(row.appSecretEnc);
    } catch {
      appSecret = '';
    }
  }
  if (!appSecret) {
    appSecret = process.env.META_APP_SECRET || '';
  }

  const appId = row.appId || process.env.META_APP_ID || '';
  const configId =
    row.embeddedSignupConfigId || process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '';
  const graphVersion =
    row.graphApiVersion || process.env.META_GRAPH_API_VERSION || 'v21.0';
  const webhookVerifyToken =
    row.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';

  return {
    appId,
    appSecret,
    configId,
    graphVersion,
    webhookVerifyToken,
    hasAppSecret: Boolean(appSecret),
  };
}

export function graphBase(version: string): string {
  return `https://graph.facebook.com/${version || 'v21.0'}`;
}

export async function saveMetaSettings(input: {
  appId: string;
  configId: string;
  graphVersion?: string;
  webhookVerifyToken?: string;
  appSecret?: string;
}): Promise<MetaSettingsResolved> {
  await ensureRow();

  const data: {
    appId: string;
    embeddedSignupConfigId: string;
    graphApiVersion: string;
    webhookVerifyToken?: string;
    appSecretEnc?: string | null;
  } = {
    appId: input.appId.trim(),
    embeddedSignupConfigId: input.configId.trim(),
    graphApiVersion: (input.graphVersion || 'v21.0').trim() || 'v21.0',
  };

  if (typeof input.webhookVerifyToken === 'string') {
    data.webhookVerifyToken = input.webhookVerifyToken.trim();
  }

  if (typeof input.appSecret === 'string' && input.appSecret.trim()) {
    data.appSecretEnc = encryptSecret(input.appSecret.trim());
  }

  await prisma.whatsAppMetaSettings.update({
    where: { id: DEFAULT_ID },
    data,
  });

  return getMetaSettings();
}

export function publicMetaSettings(settings: MetaSettingsResolved) {
  return {
    configured: Boolean(
      settings.appId && settings.configId && settings.hasAppSecret
    ),
    appId: settings.appId,
    configId: settings.configId,
    graphVersion: settings.graphVersion,
    webhookVerifyToken: settings.webhookVerifyToken,
    appSecretMasked: settings.hasAppSecret
      ? maskSecret(settings.appSecret)
      : '',
    hasAppSecret: settings.hasAppSecret,
  };
}

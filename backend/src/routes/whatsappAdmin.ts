import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/crypto.js';
import { AuthRequest } from '../middleware/auth.js';
import { adminAuth } from '../middleware/admin.js';
import {
  getMetaSettings,
  graphBase,
  publicMetaSettings,
  saveMetaSettings,
} from '../lib/whatsappMetaSettings.js';

const router = Router();

function mapConnection(row: {
  id: string;
  label: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhone: string | null;
  businessId: string | null;
  accessTokenEnc: string;
  tokenExpiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  let tokenMasked = '••••••••';
  try {
    tokenMasked = maskSecret(decryptSecret(row.accessTokenEnc));
  } catch {
    tokenMasked = '••••••••';
  }

  return {
    id: row.id,
    label: row.label,
    wabaId: row.wabaId,
    phoneNumberId: row.phoneNumberId,
    displayPhone: row.displayPhone,
    businessId: row.businessId,
    tokenMasked,
    tokenExpiresAt: row.tokenExpiresAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function callbackUrls() {
  const app = (
    process.env.PUBLIC_APP_URL || 'https://financial.cubotechbr.com.br'
  ).replace(/\/$/, '');
  const api = (
    process.env.API_PUBLIC_URL ||
    process.env.PUBLIC_APP_URL ||
    'https://financial.cubotechbr.com.br'
  ).replace(/\/$/, '');

  return {
    appDomain: app,
    oauthRedirect: `${app}/`,
    webhook: `${api}/api/whatsapp/webhook`,
    deauthorize: `${api}/api/whatsapp/deauthorize`,
    dataDeletion: `${api}/api/whatsapp/data-deletion`,
  };
}

router.get('/config', ...adminAuth, async (_req: AuthRequest, res) => {
  const settings = await getMetaSettings();
  const active = await prisma.whatsAppConnection.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  return res.json({
    ...publicMetaSettings(settings),
    connection: active ? mapConnection(active) : null,
    callbackUrls: callbackUrls(),
  });
});

const settingsSchema = z.object({
  appId: z.string().min(1, 'App ID é obrigatório'),
  configId: z.string().min(1, 'Config ID do Embedded Signup é obrigatório'),
  graphVersion: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  appSecret: z.string().optional(),
});

router.put('/settings', ...adminAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados inválidos',
      });
    }

    const current = await getMetaSettings();
    if (!parsed.data.appSecret?.trim() && !current.hasAppSecret) {
      return res.status(400).json({
        error: 'Informe o App Secret da Meta na primeira configuração',
      });
    }

    const saved = await saveMetaSettings({
      appId: parsed.data.appId,
      configId: parsed.data.configId,
      graphVersion: parsed.data.graphVersion,
      webhookVerifyToken: parsed.data.webhookVerifyToken,
      appSecret: parsed.data.appSecret,
    });

    return res.json(publicMetaSettings(saved));
  } catch (error) {
    console.error('WhatsApp settings save error:', error);
    return res.status(500).json({ error: 'Falha ao salvar configurações Meta' });
  }
});

router.get('/connection', ...adminAuth, async (_req: AuthRequest, res) => {
  const active = await prisma.whatsAppConnection.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
  return res.json(active ? mapConnection(active) : null);
});

const completeSchema = z.object({
  code: z.string().min(10),
  wabaId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  businessId: z.string().optional(),
  displayPhone: z.string().optional(),
  session: z.record(z.unknown()).optional(),
});

router.post('/embedded-signup/complete', ...adminAuth, async (req: AuthRequest, res) => {
  try {
    const settings = await getMetaSettings();
    const { appId, appSecret, graphVersion } = settings;
    if (!appId || !appSecret) {
      return res.status(503).json({
        error: 'Configure App ID e App Secret no menu WhatsApp antes de conectar',
      });
    }

    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Código de autorização inválido' });
    }

    const base = graphBase(graphVersion);
    const tokenUrl = new URL(`${base}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', parsed.data.code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    if (!tokenRes.ok || !tokenJson.access_token) {
      return res.status(400).json({
        error: tokenJson.error?.message || 'Falha ao trocar code por access token',
      });
    }

    const accessToken = tokenJson.access_token;
    let wabaId = parsed.data.wabaId || null;
    let phoneNumberId = parsed.data.phoneNumberId || null;
    let displayPhone = parsed.data.displayPhone || null;
    let businessId = parsed.data.businessId || null;

    if (!wabaId || !phoneNumberId) {
      try {
        const appToken = `${appId}|${appSecret}`;
        const debugUrl = new URL(`${base}/debug_token`);
        debugUrl.searchParams.set('input_token', accessToken);
        debugUrl.searchParams.set('access_token', appToken);
        const debugRes = await fetch(debugUrl.toString());
        const debugJson = (await debugRes.json()) as {
          data?: {
            granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
          };
        };
        const scopes = debugJson.data?.granular_scopes || [];
        const waScope = scopes.find((s) =>
          s.scope.includes('whatsapp_business')
        );
        if (!wabaId && waScope?.target_ids?.[0]) {
          wabaId = waScope.target_ids[0];
        }
      } catch {
        // ignore
      }
    }

    if (wabaId && !phoneNumberId) {
      try {
        const phonesUrl = new URL(`${base}/${wabaId}/phone_numbers`);
        phonesUrl.searchParams.set('access_token', accessToken);
        const phonesRes = await fetch(phonesUrl.toString());
        const phonesJson = (await phonesRes.json()) as {
          data?: Array<{ id?: string; display_phone_number?: string }>;
        };
        const first = phonesJson.data?.[0];
        if (first?.id) {
          phoneNumberId = first.id;
          displayPhone = first.display_phone_number || displayPhone;
        }
      } catch {
        // ignore
      }
    }

    if (wabaId) {
      try {
        await fetch(`${base}/${wabaId}/subscribed_apps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken }),
        });
      } catch {
        // non-fatal
      }
    }

    await prisma.whatsAppConnection.updateMany({
      data: { isActive: false },
    });

    const expiresAt =
      typeof tokenJson.expires_in === 'number'
        ? new Date(Date.now() + tokenJson.expires_in * 1000)
        : null;

    const row = await prisma.whatsAppConnection.create({
      data: {
        label: 'WhatsApp FinControl',
        wabaId,
        phoneNumberId,
        displayPhone,
        businessId,
        accessTokenEnc: encryptSecret(accessToken),
        tokenExpiresAt: expiresAt,
        isActive: true,
        rawSession: (parsed.data.session || {}) as Prisma.InputJsonValue,
      },
    });

    return res.status(201).json(mapConnection(row));
  } catch (error) {
    console.error('WhatsApp embedded signup complete error:', error);
    return res.status(500).json({ error: 'Falha ao concluir conexão WhatsApp' });
  }
});

router.delete('/connection', ...adminAuth, async (_req: AuthRequest, res) => {
  await prisma.whatsAppConnection.updateMany({ data: { isActive: false } });
  return res.status(204).send();
});

export default router;

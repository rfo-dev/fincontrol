import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/crypto.js';
import { AuthRequest } from '../middleware/auth.js';
import { adminAuth } from '../middleware/admin.js';

const router = Router();

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function metaEnv() {
  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '';
  return { appId, appSecret, configId };
}

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

router.get('/config', ...adminAuth, async (_req: AuthRequest, res) => {
  const { appId, configId, appSecret } = metaEnv();
  const active = await prisma.whatsAppConnection.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  return res.json({
    configured: Boolean(appId && configId && appSecret),
    appId,
    configId,
    graphVersion: GRAPH_VERSION,
    connection: active ? mapConnection(active) : null,
    callbackUrls: {
      appDomain: process.env.PUBLIC_APP_URL || 'https://financial.cubotechbr.com.br',
      oauthRedirect: `${(process.env.PUBLIC_APP_URL || 'https://financial.cubotechbr.com.br').replace(/\/$/, '')}/`,
      webhook: `${(process.env.API_PUBLIC_URL || process.env.PUBLIC_APP_URL || 'https://financial.cubotechbr.com.br').replace(/\/$/, '')}/api/whatsapp/webhook`,
      deauthorize: `${(process.env.API_PUBLIC_URL || process.env.PUBLIC_APP_URL || 'https://financial.cubotechbr.com.br').replace(/\/$/, '')}/api/whatsapp/deauthorize`,
      dataDeletion: `${(process.env.API_PUBLIC_URL || process.env.PUBLIC_APP_URL || 'https://financial.cubotechbr.com.br').replace(/\/$/, '')}/api/whatsapp/data-deletion`,
    },
  });
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
    const { appId, appSecret } = metaEnv();
    if (!appId || !appSecret) {
      return res.status(503).json({
        error: 'META_APP_ID e META_APP_SECRET não configurados no servidor',
      });
    }

    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Código de autorização inválido' });
    }

    const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
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

    // Fallback: discover WABA/phone from debug_token / owned accounts
    if (!wabaId || !phoneNumberId) {
      try {
        const appToken = `${appId}|${appSecret}`;
        const debugUrl = new URL(`${GRAPH_BASE}/debug_token`);
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
        const phonesUrl = new URL(`${GRAPH_BASE}/${wabaId}/phone_numbers`);
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
        await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
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

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/crypto.js';
import { AuthRequest } from '../middleware/auth.js';
import { adminAuth } from '../middleware/admin.js';
import { AI_MODEL_IDS, APP_ROLES, parseEnabledRoles } from '../lib/roles.js';

const router = Router();

const agentSchema = z
  .object({
    name: z.string().min(2),
    provider: z.enum(['openai', 'claude']),
    model: z.string().min(1),
    apiKey: z.string().min(10).optional(),
    systemPrompt: z.string().min(10),
    isEnabled: z.boolean().optional().default(false),
    audienceMode: z.enum(['all', 'roles']).optional().default('all'),
    enabledRoles: z.array(z.enum(APP_ROLES)).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const allowed = AI_MODEL_IDS[data.provider] as readonly string[];
    if (!allowed.includes(data.model)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Modelo inválido para o provedor',
        path: ['model'],
      });
    }
    if (data.isEnabled && data.audienceMode === 'roles' && data.enabledRoles.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecione ao menos um perfil',
        path: ['enabledRoles'],
      });
    }
  });

function mapAgent(row: {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKeyEnc: string;
  systemPrompt: string;
  isEnabled: boolean;
  audienceMode: string;
  enabledRoles: unknown;
  createdAt: Date;
  updatedAt: Date;
}, includeMaskedKey = true) {
  let apiKeyMasked = '••••••••';
  if (includeMaskedKey) {
    try {
      apiKeyMasked = maskSecret(decryptSecret(row.apiKeyEnc));
    } catch {
      apiKeyMasked = '••••••••';
    }
  }

  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    apiKeyMasked,
    systemPrompt: row.systemPrompt,
    isEnabled: row.isEnabled,
    audienceMode: row.audienceMode === 'roles' ? 'roles' : 'all',
    enabledRoles: parseEnabledRoles(row.enabledRoles),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get('/agents', ...adminAuth, async (_req: AuthRequest, res) => {
  try {
    const rows = await prisma.aiAgent.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json(rows.map((row) => mapAgent(row)));
  } catch (error) {
    console.error('List AI agents error:', error);
    return res.status(500).json({ error: 'Failed to list AI agents' });
  }
});

router.post('/agents', ...adminAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = agentSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Dados inválidos do agente';
      return res.status(400).json({ error: message });
    }
    if (!parsed.data.apiKey) {
      return res.status(400).json({ error: 'Informe a chave de API' });
    }

    if (parsed.data.isEnabled) {
      await prisma.aiAgent.updateMany({ data: { isEnabled: false } });
    }

    const row = await prisma.aiAgent.create({
      data: {
        name: parsed.data.name.trim(),
        provider: parsed.data.provider,
        model: parsed.data.model.trim(),
        apiKeyEnc: encryptSecret(parsed.data.apiKey.trim()),
        systemPrompt: parsed.data.systemPrompt.trim(),
        isEnabled: parsed.data.isEnabled ?? false,
        audienceMode: parsed.data.audienceMode,
        enabledRoles: parsed.data.enabledRoles,
      },
    });

    return res.status(201).json(mapAgent(row));
  } catch (error) {
    console.error('Create AI agent error:', error);
    return res.status(500).json({ error: 'Failed to create AI agent' });
  }
});

router.patch('/agents/:id', ...adminAuth, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.aiAgent.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    const merged = {
      name: req.body.name ?? existing.name,
      provider: req.body.provider ?? existing.provider,
      model: req.body.model ?? existing.model,
      apiKey: req.body.apiKey,
      systemPrompt: req.body.systemPrompt ?? existing.systemPrompt,
      isEnabled:
        req.body.isEnabled !== undefined ? req.body.isEnabled : existing.isEnabled,
      audienceMode:
        req.body.audienceMode ??
        (existing.audienceMode === 'roles' ? 'roles' : 'all'),
      enabledRoles:
        req.body.enabledRoles ?? parseEnabledRoles(existing.enabledRoles),
    };

    const parsed = agentSchema.safeParse(merged);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Dados inválidos do agente';
      return res.status(400).json({ error: message });
    }

    if (parsed.data.isEnabled === true) {
      await prisma.aiAgent.updateMany({
        where: { id: { not: existing.id } },
        data: { isEnabled: false },
      });
    }

    const row = await prisma.aiAgent.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name.trim(),
        provider: parsed.data.provider,
        model: parsed.data.model.trim(),
        systemPrompt: parsed.data.systemPrompt.trim(),
        isEnabled: parsed.data.isEnabled,
        audienceMode: parsed.data.audienceMode,
        enabledRoles: parsed.data.enabledRoles,
        ...(parsed.data.apiKey
          ? { apiKeyEnc: encryptSecret(parsed.data.apiKey.trim()) }
          : {}),
      },
    });

    return res.json(mapAgent(row));
  } catch (error) {
    console.error('Update AI agent error:', error);
    return res.status(500).json({ error: 'Failed to update AI agent' });
  }
});

router.delete('/agents/:id', ...adminAuth, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.aiAgent.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }
    await prisma.aiAgent.delete({ where: { id: existing.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('Delete AI agent error:', error);
    return res.status(500).json({ error: 'Failed to delete AI agent' });
  }
});

export default router;

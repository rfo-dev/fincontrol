import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { decryptSecret } from '../lib/crypto.js';
import { isSupportedAttachmentMime, runAgentChat } from '../lib/aiAgent.js';
import { agentAllowsRole } from '../lib/roles.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const chatSchema = z.object({
  message: z.string().max(4000).optional().default(''),
  attachment: z
    .object({
      mimeType: z.string().min(3).max(100),
      fileName: z.string().min(1).max(200),
      base64: z.string().min(32),
    })
    .optional(),
});

async function getAgentForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  if (!user?.isActive) return null;

  const agent = await prisma.aiAgent.findFirst({
    where: { isEnabled: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!agent) return null;
  if (!agentAllowsRole(agent, user.role)) return null;
  return agent;
}

function mapMessage(row: {
  id: string;
  role: string;
  content: string;
  attachmentName: string | null;
  attachmentMime: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    attachmentName: row.attachmentName,
    attachmentMime: row.attachmentMime,
    createdAt: row.createdAt,
  };
}

function stripDataUrlPrefix(base64: string): string {
  const idx = base64.indexOf('base64,');
  return idx >= 0 ? base64.slice(idx + 7) : base64;
}

function estimateBase64Bytes(base64: string): number {
  const clean = base64.replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

router.get('/status', async (req: AuthRequest, res) => {
  try {
    const agent = await getAgentForUser(req.user!.id);
    return res.json({
      enabled: Boolean(agent),
      name: agent?.name || null,
    });
  } catch (error) {
    console.error('Chat status error:', error);
    return res.status(500).json({ error: 'Failed to fetch chat status' });
  }
});

router.get('/messages', async (req: AuthRequest, res) => {
  try {
    const rows = await prisma.aiChatMessage.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return res.json(rows.map(mapMessage));
  } catch (error) {
    console.error('List chat messages error:', error);
    return res.status(500).json({ error: 'Failed to list messages' });
  }
});

router.delete('/messages', async (req: AuthRequest, res) => {
  try {
    await prisma.aiChatMessage.deleteMany({ where: { userId: req.user!.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('Clear chat messages error:', error);
    return res.status(500).json({ error: 'Failed to clear messages' });
  }
});

router.post('/chat', async (req: AuthRequest, res) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Mensagem inválida' });
    }

    const text = parsed.data.message.trim();
    const rawAttachment = parsed.data.attachment;

    if (!text && !rawAttachment) {
      return res.status(400).json({ error: 'Envie uma mensagem ou um comprovante' });
    }

    let attachment:
      | { mimeType: string; fileName: string; base64: string }
      | undefined;

    if (rawAttachment) {
      const mimeType = rawAttachment.mimeType.toLowerCase().trim();
      if (!isSupportedAttachmentMime(mimeType)) {
        return res.status(400).json({
          error: 'Anexo inválido. Envie imagem (JPG, PNG, WEBP) ou PDF.',
        });
      }

      const base64 = stripDataUrlPrefix(rawAttachment.base64).replace(/\s/g, '');
      if (estimateBase64Bytes(base64) > MAX_ATTACHMENT_BYTES) {
        return res.status(400).json({ error: 'Anexo muito grande (máx. 4 MB)' });
      }

      attachment = {
        mimeType,
        fileName: rawAttachment.fileName.trim().slice(0, 200),
        base64,
      };
    }

    const agent = await getAgentForUser(req.user!.id);
    if (!agent) {
      return res
        .status(503)
        .json({ error: 'Assistente de IA não está habilitado para o seu perfil' });
    }

    const userId = req.user!.id;
    const historyRows = await prisma.aiChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const history = historyRows
      .reverse()
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const storedContent = attachment
      ? `${text || 'Analise o comprovante anexado e ajude a cadastrar a despesa.'}\n\n[Anexo: ${attachment.fileName}]`
      : text;

    await prisma.aiChatMessage.create({
      data: {
        userId,
        role: 'user',
        content: storedContent,
        attachmentName: attachment?.fileName || null,
        attachmentMime: attachment?.mimeType || null,
      },
    });

    const apiKey = decryptSecret(agent.apiKeyEnc);
    const answer = await runAgentChat(
      userId,
      {
        provider: agent.provider as 'openai' | 'claude',
        model: agent.model,
        apiKey,
        systemPrompt: agent.systemPrompt,
      },
      history,
      text,
      attachment
    );

    const assistant = await prisma.aiChatMessage.create({
      data: {
        userId,
        role: 'assistant',
        content: answer,
      },
    });

    return res.json(mapMessage(assistant));
  } catch (error) {
    console.error('Chat error:', error);
    const message = error instanceof Error ? error.message : 'Failed to chat';
    return res.status(500).json({ error: message });
  }
});

export default router;

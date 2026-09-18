import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Webhook verification (GET) and inbound events (POST).
 * Public endpoints — no JWT.
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';

  if (mode === 'subscribe' && token && token === verifyToken) {
    return res.status(200).send(String(challenge || ''));
  }

  return res.sendStatus(403);
});

router.post('/webhook', (req: Request, res: Response) => {
  // Acknowledge immediately; message→AI bridge can be added next.
  console.log('WhatsApp webhook event:', JSON.stringify(req.body)?.slice(0, 2000));
  return res.sendStatus(200);
});

router.post('/deauthorize', (_req: Request, res: Response) => {
  return res.sendStatus(200);
});

router.post('/data-deletion', (_req: Request, res: Response) => {
  return res.status(200).json({
    url: `${(process.env.PUBLIC_APP_URL || 'https://financial.cubotechbr.com.br').replace(/\/$/, '')}/privacy`,
    confirmation_code: `fc-${Date.now()}`,
  });
});

export default router;

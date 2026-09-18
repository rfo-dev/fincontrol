import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import aiAdminRoutes from './routes/aiAdmin.js';
import aiChatRoutes from './routes/aiChat.js';
import incomesRoutes from './routes/incomes.js';
import expensesRoutes from './routes/expenses.js';
import creditCardsRoutes from './routes/creditCards.js';
import categoriesRoutes from './routes/categories.js';
import whatsappAdminRoutes from './routes/whatsappAdmin.js';
import whatsappPublicRoutes from './routes/whatsappPublic.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:5173',
      'https://financial.cubotechbr.com.br',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/ai', aiAdminRoutes);
app.use('/api/admin/whatsapp', whatsappAdminRoutes);
app.use('/api/whatsapp', whatsappPublicRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/api/incomes', incomesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/credit-cards', creditCardsRoutes);
app.use('/api/categories', categoriesRoutes);

app.listen(port, () => {
  console.log(`FinControl API listening on http://localhost:${port}`);
});

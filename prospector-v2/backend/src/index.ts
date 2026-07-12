import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { initDb, closeDb } from './database';
import { authMiddleware } from './middleware/auth';
import authRouter from './routes/auth';
import leadsRouter from './routes/leads';
import configRouter from './routes/config';
import prospectsRouter from './routes/prospects';
import proposalsRouter from './routes/proposals';
import contractsRouter from './routes/contracts';
import deployRouter from './routes/deploy';
import exportRouter from './routes/export';
import sitesRouter from './routes/sites';
import atividadesRouter from './routes/atividades';
import dashboardRouter from './routes/dashboard';
import respostasRouter from './routes/respostas';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://prospector-v2.onrender.com',
      'https://tarcisioprogramador.github.io',
      'http://localhost:5173',
      'http://localhost:4173',
    ];
    // Permite requisições sem origin (ex: Postman, apps mobile)
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Public routes (auth + health)
app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Prospector v2 API rodando', timestamp: new Date().toISOString() });
});

// Protected routes (all need JWT)
app.use('/api/leads', authMiddleware, leadsRouter);
app.use('/api/config', authMiddleware, configRouter);
app.use('/api/prospects', authMiddleware, prospectsRouter);
app.use('/api/proposals', authMiddleware, proposalsRouter);
app.use('/api/contracts', authMiddleware, contractsRouter);
app.use('/api/deploy', authMiddleware, deployRouter);
app.use('/api/export', authMiddleware, exportRouter);
app.use('/api/sites', authMiddleware, sitesRouter);
app.use('/api/atividades', authMiddleware, atividadesRouter);
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/respostas', authMiddleware, respostasRouter);

// Static sites (protected via auth check in express.static)
app.use('/sites', authMiddleware, express.static(path.join(__dirname, '../data/sites')));

// Serve frontend production build (if it exists)
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// Catch-all: serve index.html for SPA client-side routing
app.get('*', (_req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({ success: true, message: 'Prospector v2 API rodando' });
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Erro:', err.message);
  res.status(500).json({ success: false, error: err.message || 'Erro interno do servidor' });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`\n🔐 Prospector de Sites v2 - API rodando em http://localhost:${PORT}\n`);
  });
}
start().catch(console.error);

process.on('SIGINT', async () => { await closeDb(); process.exit(0); });
process.on('SIGTERM', async () => { await closeDb(); process.exit(0); });

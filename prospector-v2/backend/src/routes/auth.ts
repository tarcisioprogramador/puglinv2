import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'prospector-dev-secret-change-in-production';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '30d';

function generateTokens(user: { slug: string; email: string; nome: string }) {
  const accessToken = jwt.sign(user, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
  const refreshToken = uuidv4() + '-' + uuidv4();
  return { accessToken, refreshToken };
}

async function storeRefresh(slug: string, token: string): Promise<void> {
  const db = getDb();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO refresh_tokens (token, user_slug, expires) VALUES ($1, $2, $3)').run(token, slug, expires);
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { email, senha, nome } = req.body;
    if (!email || !senha || !nome) return res.status(400).json({ success: false, error: 'Email, senha e nome são obrigatórios' });
    if (senha.length < 6) return res.status(400).json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres' });
    const existing = await db.prepare('SELECT COUNT(*) as c FROM usuarios').get() as any;
    if (existing?.c > 0) return res.status(403).json({ success: false, error: 'Já existe um usuário cadastrado.' });
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt);
    const slug = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await db.prepare('INSERT INTO usuarios (slug, email, nome, hash) VALUES ($1, $2, $3, $4)').run(slug, email.toLowerCase(), nome, hash);
    res.json({ success: true, message: 'Usuário criado! Faça login.' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

// POST /api/auth/login — retorna access + refresh tokens
router.post('/login', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ success: false, error: 'Email e senha obrigatórios' });
    const user = await db.prepare('SELECT * FROM usuarios WHERE email = $1').get(email.toLowerCase()) as any;
    if (!user) return res.status(401).json({ success: false, error: 'Email ou senha inválidos' });
    const valid = await bcrypt.compare(senha, user.hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Email ou senha inválidos' });
    const { accessToken, refreshToken } = generateTokens({ slug: user.slug, email: user.email, nome: user.nome });
    await storeRefresh(user.slug, refreshToken);
    res.json({ success: true, data: { accessToken, refreshToken, user: { slug: user.slug, email: user.email, nome: user.nome } }, message: 'Login realizado' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

// POST /api/auth/refresh — troca refresh token por novos tokens
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: 'Refresh token obrigatório' });
    const stored = await db.prepare('SELECT * FROM refresh_tokens WHERE token = $1').get(refreshToken) as any;
    if (!stored) return res.status(401).json({ success: false, error: 'Refresh token inválido' });
    if (new Date(stored.expires) < new Date()) {
      await db.prepare('DELETE FROM refresh_tokens WHERE token = $1').run(refreshToken);
      return res.status(401).json({ success: false, error: 'Refresh token expirado. Faça login novamente.' });
    }
    const user = await db.prepare('SELECT * FROM usuarios WHERE slug = $1').get(stored.user_slug) as any;
    if (!user) { await db.prepare('DELETE FROM refresh_tokens WHERE token = $1').run(refreshToken); return res.status(401).json({ success: false, error: 'Usuário não encontrado' }); }
    // Revoga o refresh antigo e gera novos
    await db.prepare('DELETE FROM refresh_tokens WHERE token = $1').run(refreshToken);
    const { accessToken, refreshToken: newRefresh } = generateTokens({ slug: user.slug, email: user.email, nome: user.nome });
    await storeRefresh(user.slug, newRefresh);
    res.json({ success: true, data: { accessToken, refreshToken: newRefresh, user: { slug: user.slug, email: user.email, nome: user.nome } } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

// POST /api/auth/logout — revoga refresh token
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { refreshToken } = req.body;
    if (refreshToken) await db.prepare('DELETE FROM refresh_tokens WHERE token = $1').run(refreshToken);
    // Revoga todos os tokens do usuário se veio com auth header
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try { const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any; await db.prepare('DELETE FROM refresh_tokens WHERE user_slug = $1').run(decoded.slug); } catch {}
    }
    res.json({ success: true, message: 'Sessão encerrada' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

// GET /api/auth/verify
router.get('/verify', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Token não fornecido' });
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    res.json({ success: true, data: { user: { slug: decoded.slug, email: decoded.email, nome: decoded.nome } } });
  } catch { res.status(401).json({ success: false, error: 'Token inválido ou expirado' }); }
});

// POST /api/auth/change-password — altera a senha do usuário logado
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Autenticação necessária' });
    let slug: string;
    try { slug = (jwt.verify(auth.slice(7), JWT_SECRET) as any).slug; } catch { return res.status(401).json({ success: false, error: 'Token inválido' }); }

    const db = getDb();
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ success: false, error: 'Senha atual e nova senha são obrigatórias' });
    if (novaSenha.length < 6) return res.status(400).json({ success: false, error: 'Nova senha deve ter no mínimo 6 caracteres' });

    const user = await db.prepare('SELECT * FROM usuarios WHERE slug = $1').get(slug) as any;
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    const valid = await bcrypt.compare(senhaAtual, user.hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Senha atual incorreta' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(novaSenha, salt);
    await db.prepare('UPDATE usuarios SET hash = $1 WHERE slug = $2').run(hash, slug);
    // Revoga todos os refresh tokens — força re-login
    await db.prepare('DELETE FROM refresh_tokens WHERE user_slug = $1').run(slug);

    res.json({ success: true, message: 'Senha alterada com sucesso! Faça login novamente.' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

// GET /api/auth/check
router.get('/check', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const count = await db.prepare('SELECT COUNT(*) as c FROM usuarios').get() as any;
    res.json({ success: true, data: { existeUsuario: (count?.c || 0) > 0 } });
  } catch { res.json({ success: true, data: { existeUsuario: false } }); }
});

export { router as default, JWT_SECRET };

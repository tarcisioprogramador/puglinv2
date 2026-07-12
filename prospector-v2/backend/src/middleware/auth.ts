import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'prospector-dev-secret-change-in-production';

export interface AuthRequest extends Request {
  user?: { slug: string; email: string; nome: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // Public routes that don't need auth
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/check', '/api/health'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Autenticação necessária. Faça login primeiro.' });
    return;
  }

  try {
    const token = auth.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { slug: decoded.slug, email: decoded.email, nome: decoded.nome };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = { slug: decoded.slug, email: decoded.email, nome: decoded.nome };
    } catch { /* token inválido, segue sem user */ }
  }
  next();
}

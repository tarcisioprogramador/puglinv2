import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug, tipo, limit = '50' } = req.query;
    let sql = 'SELECT * FROM atividades WHERE 1=1'; const params: any[] = [];
    if (slug) { sql += ' AND slug=?'; params.push(slug); }
    if (tipo) { sql += ' AND tipo=?'; params.push(tipo); }
    sql += ' ORDER BY criadoEm DESC LIMIT ?'; params.push(parseInt(limit as string) || 50);
    res.json({ success: true, data: db.prepare(sql).all(...params) });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/tipos', (_req: Request, res: Response) => {
  try {
    const tipos = getDb().prepare('SELECT DISTINCT tipo FROM atividades ORDER BY tipo').all() as any[];
    res.json({ success: true, data: tipos.map(t => t.tipo) });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

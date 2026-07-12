import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    let sql = 'SELECT * FROM atividades WHERE 1=1';
    const params: any[] = [];
    if (req.query.slug) { sql += ' AND slug=$' + (params.length + 1); params.push(req.query.slug); }
    sql += ' ORDER BY criadoEm DESC';
    if (req.query.limit) sql += ' LIMIT $' + (params.length + 1) + ' OFFSET 0';
    const limit = parseInt(req.query.limit as string);
    if (req.query.limit && !isNaN(limit) && limit > 0) params.push(limit);
    res.json({ success: true, data: await db.prepare(sql).all(...params) });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/tipos', async (_req: Request, res: Response) => {
  try {
    const tipos = await getDb().prepare('SELECT DISTINCT tipo FROM atividades ORDER BY tipo').all() as any[];
    res.json({ success: true, data: tipos.map((t: any) => t.tipo) });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

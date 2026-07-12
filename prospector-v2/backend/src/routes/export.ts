import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/csv', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { status, search } = req.query;
    let sql = 'SELECT * FROM leads WHERE 1=1'; const params: any[] = [];
    if (status && status !== 'todos') { sql += ' AND status=$' + (params.length + 1); params.push(status); }
    if (search) { const t=`%${search}%`; sql += ' AND (nome LIKE $' + (params.length + 1) + ' OR nicho LIKE $' + (params.length + 2) + ' OR cidade LIKE $' + (params.length + 3) + ')'; params.push(t,t,t); }
    sql += ' ORDER BY nome ASC';
    const leads = await db.prepare(sql).all(...params) as any[];
    if (leads.length === 0) return res.status(404).json({ success: false, error: 'Nenhum lead para exportar' });
    const headers = Object.keys(leads[0]);
    const csv = '\uFEFF' + [headers.join(','), ...leads.map(l => headers.map(h => { const v = (l as any)[h]; if (v===null||v===undefined) return ''; const s = String(v); return s.includes(',')||s.includes('"')||s.includes('\\n') ? `"${s.replace(/"/g,'""')}"` : s; }).join(','))].join('\\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prospector-leads-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/json', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { status, search } = req.query;
    let sql = 'SELECT * FROM leads WHERE 1=1'; const params: any[] = [];
    if (status && status !== 'todos') { sql += ' AND status=$' + (params.length + 1); params.push(status); }
    if (search) { const t=`%${search}%`; sql += ' AND (nome LIKE $' + (params.length + 1) + ' OR nicho LIKE $' + (params.length + 2) + ' OR cidade LIKE $' + (params.length + 3) + ')'; params.push(t,t,t); }
    sql += ' ORDER BY nome ASC';
    const leads = await db.prepare(sql).all(...params);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prospector-leads-${new Date().toISOString().slice(0,10)}.json"`);
    res.json({ exportadoEm: new Date(), versao: '2.0', total: leads.length, leads });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/report', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const stats = {
      total: (await db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c,
      ativos: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status!=$1").get('descartado') as any).c,
      descartados: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status=$1").get('descartado') as any).c,
      redesenhados: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status=$1").get('redesenhado') as any).c,
      publicados: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status=$1").get('publicado') as any).c,
      propostas: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status=$1").get('proposta') as any).c,
      fechados: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status=$1").get('fechado') as any).c,
      receita: (await db.prepare("SELECT COALESCE(SUM(valor),0) as s FROM leads WHERE status='fechado'").get() as any).s,
      mrr: (await db.prepare("SELECT COALESCE(SUM(manutencao),0) as s FROM leads WHERE status='fechado'").get() as any).s,
    };
    const porCidade = await db.prepare("SELECT cidade,COUNT(*) as total FROM leads WHERE status!=$1 AND cidade IS NOT NULL GROUP BY cidade ORDER BY total DESC LIMIT 10").all('descartado');
    const porNicho = await db.prepare("SELECT nicho,COUNT(*) as total FROM leads WHERE status!=$1 AND nicho IS NOT NULL GROUP BY nicho ORDER BY total DESC LIMIT 10").all('descartado');
    res.json({ success: true, data: { stats, porCidade, porNicho } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

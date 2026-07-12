import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/csv', (req: Request, res: Response) => {
  try {
    const db = getDb(); const { status, search } = req.query;
    let sql = 'SELECT * FROM leads WHERE 1=1'; const params: any[] = [];
    if (status && status !== 'todos') { sql += ' AND status=?'; params.push(status); }
    if (search) { const t=`%${search}%`; sql += ' AND (nome LIKE ? OR nicho LIKE ? OR cidade LIKE ?)'; params.push(t,t,t); }
    sql += ' ORDER BY nome ASC';
    const leads = db.prepare(sql).all(...params) as any[];
    if (leads.length === 0) return res.status(404).json({ success: false, error: 'Nenhum lead para exportar' });
    const headers = Object.keys(leads[0]);
    const csv = '\uFEFF' + [headers.join(','), ...leads.map(l => headers.map(h => { const v = (l as any)[h]; if (v===null||v===undefined) return ''; const s = String(v); return s.includes(',')||s.includes('"')||s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s; }).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prospector-leads-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/json', (req: Request, res: Response) => {
  try {
    const db = getDb(); const { status, search } = req.query;
    let sql = 'SELECT * FROM leads WHERE 1=1'; const params: any[] = [];
    if (status && status !== 'todos') { sql += ' AND status=?'; params.push(status); }
    if (search) { const t=`%${search}%`; sql += ' AND (nome LIKE ? OR nicho LIKE ? OR cidade LIKE ?)'; params.push(t,t,t); }
    sql += ' ORDER BY nome ASC';
    const leads = db.prepare(sql).all(...params);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prospector-leads-${new Date().toISOString().slice(0,10)}.json"`);
    res.json({ exportadoEm: new Date(), versao: '2.0', total: leads.length, leads });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/report', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const stats = {
      total: (db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c,
      ativos: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status!='descartado'").get() as any).c,
      descartados: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='descartado'").get() as any).c,
      redesenhados: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='redesenhado'").get() as any).c,
      publicados: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='publicado'").get() as any).c,
      propostas: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='proposta'").get() as any).c,
      fechados: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='fechado'").get() as any).c,
      receita: (db.prepare("SELECT COALESCE(SUM(valor),0) as s FROM leads WHERE status='fechado'").get() as any).s,
      mrr: (db.prepare("SELECT COALESCE(SUM(manutencao),0) as s FROM leads WHERE status='fechado'").get() as any).s,
    };
    const porCidade = db.prepare("SELECT cidade,COUNT(*) as total FROM leads WHERE status!='descartado' AND cidade IS NOT NULL GROUP BY cidade ORDER BY total DESC LIMIT 10").all();
    const porNicho = db.prepare("SELECT nicho,COUNT(*) as total FROM leads WHERE status!='descartado' AND nicho IS NOT NULL GROUP BY nicho ORDER BY total DESC LIMIT 10").all();
    res.json({ success: true, data: { stats, porCidade, porNicho } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

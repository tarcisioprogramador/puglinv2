import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const stats = {
      totalLeads: (db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c,
      leadsAtivos: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status!='descartado'").get() as any).c,
      propostasEnviadas: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='proposta'").get() as any).c,
      followupsPendentes: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='proposta' AND dataProposta IS NOT NULL AND julianday('now')-julianday(dataProposta)>=4").get() as any).c,
      fechados: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='fechado'").get() as any).c,
      receitaFechada: (db.prepare("SELECT COALESCE(SUM(valor),0) as s FROM leads WHERE status='fechado'").get() as any).s,
      mrr: (db.prepare("SELECT COALESCE(SUM(manutencao),0) as s FROM leads WHERE status='fechado'").get() as any).s,
      potencial: (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status!='descartado'").get() as any).c * 700,
    };
    const funnel = db.prepare("SELECT status,COUNT(*) as quantidade FROM leads WHERE status!='descartado' GROUP BY status ORDER BY CASE status WHEN 'novo' THEN 1 WHEN 'redesenhado' THEN 2 WHEN 'publicado' THEN 3 WHEN 'proposta' THEN 4 WHEN 'respondeu' THEN 5 WHEN 'fechado' THEN 6 END").all();
    const followups = db.prepare("SELECT slug,nome,dataProposta,whatsapp FROM leads WHERE status='proposta' AND dataProposta IS NOT NULL AND julianday('now')-julianday(dataProposta)>=4 ORDER BY dataProposta ASC").all();
    res.json({ success: true, data: { stats, funnel, followups } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/financeiro', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const fechados = db.prepare("SELECT * FROM leads WHERE status='fechado' ORDER BY nome").all() as any[];
    const recebido = fechados.filter(l=>l.pago).reduce((a,l)=>a+(l.valor||0),0);
    const aReceber = fechados.filter(l=>!l.pago).reduce((a,l)=>a+(l.valor||0),0);
    const mrr = fechados.reduce((a,l)=>a+(l.manutencao||0),0);
    res.json({ success: true, data: { recebido, aReceber, mrr, projecao12Meses: recebido+aReceber+mrr*12, fechados } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

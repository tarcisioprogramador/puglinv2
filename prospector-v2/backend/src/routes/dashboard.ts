import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const stats = {
      totalLeads: (await db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c,
      leadsAtivos: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status!=$1").get('descartado') as any).c,
      propostasEnviadas: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status=$1").get('proposta') as any).c,
      followupsPendentes: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='proposta' AND dataProposta IS NOT NULL AND CURRENT_DATE - dataProposta::date >= 4").get() as any).c,
      fechados: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status=$1").get('fechado') as any).c,
      receitaFechada: (await db.prepare("SELECT COALESCE(SUM(valor),0) as s FROM leads WHERE status='fechado'").get() as any).s,
      mrr: (await db.prepare("SELECT COALESCE(SUM(manutencao),0) as s FROM leads WHERE status='fechado'").get() as any).s,
      potencial: (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status!=$1").get('descartado') as any).c * 700,
    };
    const funnel = await db.prepare("SELECT status,COUNT(*) as quantidade FROM leads WHERE status!='descartado' GROUP BY status ORDER BY CASE status WHEN 'novo' THEN 1 WHEN 'redesenhado' THEN 2 WHEN 'publicado' THEN 3 WHEN 'proposta' THEN 4 WHEN 'respondeu' THEN 5 WHEN 'fechado' THEN 6 END").all();
    const followups = await db.prepare("SELECT slug,nome,dataProposta,whatsapp FROM leads WHERE status='proposta' AND dataProposta IS NOT NULL AND CURRENT_DATE - dataProposta::date >= 4 ORDER BY dataProposta ASC").all();
    res.json({ success: true, data: { stats, funnel, followups } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/financeiro', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const fechados = await db.prepare("SELECT * FROM leads WHERE status='fechado' ORDER BY nome").all() as any[];
    const recebido = fechados.filter(l=>l.pago).reduce((a,l)=>a+(l.valor||0),0);
    const aReceber = fechados.filter(l=>!l.pago).reduce((a,l)=>a+(l.valor||0),0);
    const mrr = fechados.reduce((a,l)=>a+(l.manutencao||0),0);
    res.json({ success: true, data: { recebido, aReceber, mrr, projecao12Meses: recebido+aReceber+mrr*12, fechados } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

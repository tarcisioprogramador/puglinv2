import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug } = req.body;
    if (!slug) return res.status(400).json({ success: false, error: 'slug é obrigatório' });
    const lead = await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    const rows = await db.prepare('SELECT chave,valor FROM config').all() as any[];
    const cfg: any = {};
    for (const r of rows) { try { const keys = r.chave.split('.'); let o = cfg; for (let i=0; i<keys.length-1; i++) { if (!o[keys[i]]) o[keys[i]]={}; o=o[keys[i]]; } o[keys[keys.length-1]] = JSON.parse(r.valor); } catch {} }
    await db.prepare("UPDATE leads SET status='proposta',dataProposta=CURRENT_DATE WHERE slug=$1").run(slug);
    await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run(slug,'proposta_gerada',`Proposta para "${lead.nome}"`);
    res.json({ success: true, message: 'Proposta gerada', data: { lead, config: cfg } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

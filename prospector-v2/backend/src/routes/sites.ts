import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.post('/redesign', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug, html, editorHtml } = req.body;
    if (!slug) return res.status(400).json({ success: false, error: 'slug é obrigatório' });
    const lead = await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    await db.prepare("UPDATE leads SET status='redesenhado' WHERE slug=$1 AND (status='novo' OR status='redesenhado')").run(slug);
    await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run(slug,'redesenhado',`Site de "${lead.nome}" redesenhado`);
    res.json({ success: true, message: 'Site salvo como redesenho' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/comparador/data', async (req: Request, res: Response) => {
  try {
    const leads = await getDb().prepare("SELECT slug,nome,siteAntigo,urlNova,status FROM leads WHERE status IN ('redesenhado','publicado','proposta','respondeu','fechado') ORDER BY nome").all();
    res.json({ success: true, data: leads });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const lead = await db.prepare('SELECT * FROM leads WHERE slug=$1').get(req.params.slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    res.json({ success: true, data: { html: '<p>Em breve</p>' } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.post('/publish', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug } = req.body;
    if (!slug) return res.status(400).json({ success: false, error: 'slug é obrigatório' });
    const lead = await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    const rows = await db.prepare('SELECT chave,valor FROM config').all() as any[];
    const cfg: any = {};
    for (const r of rows) { try { const keys = r.chave.split('.'); let o = cfg; for (let i=0; i<keys.length-1; i++) { if (!o[keys[i]]) o[keys[i]]={}; o=o[keys[i]]; } o[keys[keys.length-1]] = JSON.parse(r.valor); } catch {} }
    const hg = cfg.hostgator || {};
    const serverUrl = `ftp://${hg.usuario}:${hg.senha}@${hg.servidor}/${hg.pastaBase || 'clientes'}/${slug}`;
    const publicUrl = `https://${hg.dominio}/${hg.pastaBase || 'clientes'}/${slug}`;
    await db.prepare("UPDATE leads SET status='publicado',urlNova=$1 WHERE slug=$2").run(publicUrl, slug);
    await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run(slug,'publicado',`"${lead.nome}" publicado em ${publicUrl}`);
    res.json({ success: true, message: `Site programado para publicação em ${publicUrl}`, data: { url: publicUrl, serverUrl } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/test-connection', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { connected: true, message: 'Conexão FTP simulada' } });
});

export default router;

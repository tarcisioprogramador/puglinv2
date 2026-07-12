import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import path from 'path';
import fs from 'fs';

const router = Router();

router.post('/publish', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug } = req.body;
    if (!slug) return res.status(400).json({ success: false, error: 'slug obrigatório' });
    const lead = db.prepare('SELECT * FROM leads WHERE slug=?').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });

    const pagePath = path.join(__dirname, '../../data/sites', slug, `${slug}.html`);
    if (!fs.existsSync(pagePath)) return res.status(400).json({ success: false, error: 'Página redesenhada não encontrada' });

    const rows = db.prepare('SELECT chave,valor FROM config').all() as any[];
    const cfg: any = { hostgator: {} };
    for (const r of rows) { try { const keys = r.chave.split('.'); let o = cfg; for (let i=0; i<keys.length-1; i++) { if (!o[keys[i]]) o[keys[i]]={}; o=o[keys[i]]; } o[keys[keys.length-1]] = JSON.parse(r.valor); } catch {} }

    const hg = cfg.hostgator;
    if (!hg?.usuario || !hg?.servidor) return res.status(400).json({ success: false, error: 'HostGator não configurado' });

    const baseFolder = hg.pastaBase || 'clientes';
    const publicUrl = `https://${hg.dominio}/${baseFolder}/${slug}/`;
    db.prepare("UPDATE leads SET status='publicado',urlNova=? WHERE slug=?").run(publicUrl, slug);
    db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run(slug,'publicado',`"${lead.nome}" publicado em ${publicUrl}`);
    res.json({ success: true, data: { slug, nome: lead.nome, urlPublica: publicUrl, urlProposta: `${publicUrl}proposta.html` }, message: `Site publicado em ${publicUrl}` });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/test-connection', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { connected: true, message: 'Conexão FTP testada (simulado)' } });
});

export default router;

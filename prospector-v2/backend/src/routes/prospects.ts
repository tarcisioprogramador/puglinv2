import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { prospectorEngine as engine } from '../services/prospectorEngine';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const CAMPOS = ['slug','nome','nicho','cidade','nota','avaliacoes','email','telefone','whatsapp','siteAntigo','motivo','status'];

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

router.post('/search', async (req: Request, res: Response) => {
  try {
    const { nicho, cidade, quantidade = 10 } = req.body;
    if (!nicho || !cidade) return res.status(400).json({ success: false, error: 'Nicho e cidade são obrigatórios' });
    // Redireciona para o fluxo assíncrono (jobId + SSE/polling)
    const jobId = engine.createJob(nicho, cidade, Math.min(quantidade, 50));
    await getDb().prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run('_prospeccao','prospeccao_iniciada',`Prospecção para "${nicho}" em "${cidade}"`);
    // Retorna o jobId imediatamente para o frontend acompanhar via SSE/polling
    res.json({ success: true, data: { jobId, message: 'Prospecção iniciada' } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { prospects, nicho, cidade } = req.body;
    if (!prospects?.length) return res.status(400).json({ success: false, error: 'Nenhum prospect para importar' });
    let imp = 0, skip = 0;
    const ph = CAMPOS.map((_, i) => '$' + (i + 1)).join(',');
    const stmt = `INSERT INTO leads (${CAMPOS.join(',')}) VALUES (${ph}) ON CONFLICT (slug) DO NOTHING`;
    await db.transaction(async () => {
      for (const p of prospects) {
        if (!p.nome) continue;
        const slug = slugify(p.nome) + '-' + uuidv4().substring(0, 8);
        const r = await db.prepare(stmt).run(slug, p.nome, nicho || null, cidade || null, p.nota || null, p.avaliacoes || null, p.email || null, p.telefone || null, p.whatsapp || null, p.siteAntigo || null, p.motivo || null, p.qualificado ? 'novo' : 'descartado');
        if (r.changes > 0) imp++; else skip++;
      }
    });
    await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run('_prospeccao','prospeccao',`Importados ${imp} prospects${nicho?` para "${nicho}"`:''}${cidade?` em "${cidade}"`:''} (${skip} duplicados ignorados)`);
    res.json({ success: true, data: { importados: imp, ignorados: skip } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/auto-prospectar', async (req: Request, res: Response) => {
  try {
    const { nicho, cidade, quantidade = 10 } = req.body;
    if (!nicho || !cidade) return res.status(400).json({ success: false, error: 'Nicho e cidade são obrigatórios' });
    const jobId = engine.createJob(nicho, cidade, quantidade);
    await getDb().prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run('_prospeccao','prospeccao_auto',`Prospecção automática para "${nicho}" em "${cidade}"`);
    res.json({ success: true, data: { jobId, message: 'Prospecção iniciada' } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/prospectar/:jobId/stream', (req: Request, res: Response) => {
  const { jobId } = req.params;
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const unsubscribe = engine.onEvent(jobId, (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.type === 'complete' || data.type === 'error') { res.end(); unsubscribe(); }
  });
  req.on('close', () => unsubscribe());
});

router.get('/prospectar/:jobId', async (req: Request, res: Response) => {
  try {
    const job = engine.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job não encontrado ou expirado' });
    res.json({ success: true, data: job });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/criteria', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { nichoPadrao: '', cidadePadrao: '', volumeLeads: 10 } });
});

export default router;

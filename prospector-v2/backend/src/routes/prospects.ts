import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { prospectorEngine } from '../services/prospectorEngine';

const router = Router();

function slugify(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

// Existing: search (manual instructions)
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { nicho, cidade, quantidade = 10 } = req.body;
    if (!nicho || !cidade) return res.status(400).json({ success: false, error: 'Nicho e cidade obrigatórios' });
    getDb().prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run('_prospeccao','prospeccao_iniciada',`Prospecção para "${nicho}" em "${cidade}"`);
    res.json({ success: true, message: `Prospecção iniciada para "${nicho}" em "${cidade}"`, data: { nicho, cidade, quantidade } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

// Existing: import manually
router.post('/import', (req: Request, res: Response) => {
  try {
    const db = getDb(); const { prospects, nicho, cidade } = req.body;
    if (!prospects?.length) return res.status(400).json({ success: false, error: 'Lista vazia' });
    const CAMPOS = ['slug','nome','nicho','cidade','nota','avaliacoes','email','telefone','whatsapp','siteAntigo','motivo','status'];
    const stmt = db.prepare(`INSERT OR IGNORE INTO leads (${CAMPOS.join(',')}) VALUES (${CAMPOS.map(()=>'?').join(',')})`);
    let imp = 0, skip = 0;
    db.transaction(() => { for (const p of prospects) { const slug = slugify(p.nome)+'-'+uuidv4().substring(0,8); const r = stmt.run(slug,p.nome,nicho||null,cidade||null,p.nota||null,p.avaliacoes||null,p.email||null,p.telefone||null,p.whatsapp||null,p.siteAntigo||null,p.motivo||null,p.qualificado?'novo':'descartado'); if (r.changes>0) imp++; else skip++; } })();
    res.json({ success: true, data: { importados: imp, ignorados: skip, total: prospects.length }, message: `${imp} leads importados` });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

// NEW: Auto-prospecting - start the pipeline
router.post('/auto-prospectar', async (req: Request, res: Response) => {
  try {
    const { nicho, cidade, quantidade = 10 } = req.body;
    if (!nicho || !cidade) {
      return res.status(400).json({ success: false, error: 'Nicho e cidade são obrigatórios' });
    }
    if (quantidade < 1 || quantidade > 100) {
      return res.status(400).json({ success: false, error: 'Quantidade deve estar entre 1 e 100' });
    }
    if (prospectorEngine.isBusy) {
      return res.status(429).json({ success: false, error: 'Já existe uma prospecção em andamento. Aguarde finalizar.' });
    }

    const jobId = prospectorEngine.createJob(nicho, cidade, quantidade);

    // Log activity
    try {
      getDb().prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run(
        '_prospeccao_auto', 'prospeccao_auto',
        `Prospecção automática: "${nicho}" em "${cidade}" (até ${quantidade} leads) — Job #${jobId}`
      );
    } catch {}

    res.json({
      success: true,
      message: 'Prospecção automática iniciada!',
      data: { jobId, nicho, cidade, quantidade }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: SSE stream for real-time status
router.get('/prospectar/:jobId/stream', (req: Request, res: Response) => {
  const { jobId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial status
  const job = prospectorEngine.getJob(jobId);
  if (!job) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'Job não encontrado' } })}\n\n`);
    res.end();
    return;
  }

  res.write(`data: ${JSON.stringify({ type: 'status', data: job })}\n\n`);

  // Listen for events
  const cleanup = prospectorEngine.onEvent(jobId, (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      
      // If complete or error, close the stream
      if (event.type === 'complete' || event.type === 'error') {
        cleanup();
        res.end();
      }
    } catch {
      cleanup();
    }
  });

  // Cleanup on client disconnect
  req.on('close', () => {
    cleanup();
    prospectorEngine.cleanup(jobId);
  });
});

// NEW: Get job status (for polling fallback)
router.get('/prospectar/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = prospectorEngine.getJob(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job não encontrado ou expirado' });
  }

  res.json({ success: true, data: job });
});

// Existing: get criteria
router.get('/criteria', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      notaMinima: 4.7,
      avaliacoesMinimas: 40,
      criteriosQualificacao: [
        'Layout antigo',
        'Falta de CTA',
        'Subdomínio gratuito',
        'Má responsividade',
        'Conteúdo desorganizado',
        'Sem prova social',
      ],
      criteriosDescarte: [
        'Sem site próprio',
        'Site fora do ar',
        'Site já é bom',
        'Sem contato público',
      ],
    },
  });
});

export default router;

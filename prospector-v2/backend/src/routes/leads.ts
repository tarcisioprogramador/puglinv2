import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const CAMPOS = ['slug','nome','nicho','cidade','nota','avaliacoes','email','telefone','whatsapp','siteAntigo','motivo','status','urlNova','dataProposta','valor','obs','contratoStatus','contratoEm','manutencao','pago','docCliente','endCliente'];

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, search, sortBy = 'nome', sortOrder = 'asc', page = '1', perPage = '200' } = req.query;
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'todos') { sql += ' AND status = $' + (params.length + 1); params.push(status); }
    if (search) { const t = `%${search}%`; sql += ' AND (nome LIKE $' + (params.length + 1) + ' OR nicho LIKE $' + (params.length + 2) + ' OR cidade LIKE $' + (params.length + 3) + ')'; params.push(t, t, t); }
    const validSorts = ['nome','status','cidade','nota','valor','atualizado']; const col = validSorts.includes(sortBy as string) ? sortBy : 'nome';
    sql += ` ORDER BY ${col} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    const total = (await db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as total')).get(...params) as any)?.total || 0;
    const pg = Math.max(1, parseInt(page as string)); const pp = Math.min(200, Math.max(1, parseInt(perPage as string)));
    const leads = await db.prepare(sql + ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)).all(...params, pp, (pg - 1) * pp);
    res.json({ success: true, data: leads, pagination: { page: pg, perPage: pp, total, totalPages: Math.ceil(total / pp) } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/stats/overview', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const totalLeads = (await db.prepare('SELECT COUNT(*) as c FROM leads').get() as any).c;
    const leadsAtivos = (await db.prepare('SELECT COUNT(*) as c FROM leads WHERE status != $1').get('descartado') as any).c;
    const propostasEnviadas = (await db.prepare('SELECT COUNT(*) as c FROM leads WHERE status = $1').get('proposta') as any).c;
    const fechados = (await db.prepare('SELECT COUNT(*) as c FROM leads WHERE status = $1').get('fechado') as any).c;
    const receita = (await db.prepare("SELECT COALESCE(SUM(valor),0) as s FROM leads WHERE status='fechado'").get() as any).s;
    const mrr = (await db.prepare("SELECT COALESCE(SUM(manutencao),0) as s FROM leads WHERE status='fechado'").get() as any).s;
    const fup = (await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='proposta' AND dataProposta IS NOT NULL AND CURRENT_DATE - dataProposta::date >= 4").get() as any).c;
    const funnel = await db.prepare("SELECT status, COUNT(*) as quantidade FROM leads WHERE status!='descartado' GROUP BY status ORDER BY CASE status WHEN 'novo' THEN 1 WHEN 'redesenhado' THEN 2 WHEN 'publicado' THEN 3 WHEN 'proposta' THEN 4 WHEN 'respondeu' THEN 5 WHEN 'fechado' THEN 6 END").all();
    const followups = await db.prepare("SELECT slug,nome,dataProposta,whatsapp FROM leads WHERE status='proposta' AND dataProposta IS NOT NULL AND CURRENT_DATE - dataProposta::date >= 4 ORDER BY dataProposta ASC").all();
    res.json({ success: true, data: { totalLeads, leadsAtivos, propostasEnviadas, followupsPendentes: fup, fechados, receitaFechada: receita, mrr, potencial: leadsAtivos * 700, funnel, followups } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/:slug', async (req: Request, res: Response) => {
  try { const lead = await getDb().prepare('SELECT * FROM leads WHERE slug=$1').get(req.params.slug); if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' }); res.json({ success: true, data: lead }); }
  catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const data = req.body; const slug = data.slug || slugify(data.nome || uuidv4());
    const vals = CAMPOS.map(c => c === 'slug' ? slug : c === 'pago' ? (data.pago ? 1 : 0) : data[c] ?? null);
    const ph = CAMPOS.map((_, i) => '$' + (i + 1)).join(',');
    await db.prepare(`INSERT INTO leads (${CAMPOS.join(',')}) VALUES (${ph}) ON CONFLICT (slug) DO UPDATE SET ${CAMPOS.filter(c => c !== 'slug').map((c, i) => `${c}=EXCLUDED.${c}`).join(',')}`).run(...vals);
    await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run(slug,'criado',`Lead "${data.nome}" criado`);
    res.status(201).json({ success: true, data: await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/:slug', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug } = req.params; const data = req.body;
    const existing = await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) as any;
    if (!existing) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    const updates: string[] = []; const values: any[] = []; let pi = 1;
    for (const c of CAMPOS) { if (data[c] !== undefined && c !== 'slug') { updates.push(`${c}=$${pi++}`); values.push(data[c]); } }
    if (!updates.length) return res.json({ success: true, data: existing });
    updates.push(`atualizado=to_char(now(),'YYYY-MM-DD HH24:MI:SS')`); values.push(slug);
    await db.prepare(`UPDATE leads SET ${updates.join(',')} WHERE slug=$${pi}`).run(...values);
    res.json({ success: true, data: await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.delete('/:slug', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug } = req.params; const lead = await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    await db.prepare('DELETE FROM leads WHERE slug=$1').run(slug);
    res.json({ success: true, message: 'Lead excluído' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.patch('/batch', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slugs, data } = req.body;
    if (!slugs?.length || !data) return res.status(400).json({ success: false, error: 'slugs e data obrigatórios' });
    const fields = Object.keys(data).filter(k => k !== 'slug').map((k, i) => `${k}=$${i + 1}`); const vals = Object.keys(data).filter(k => k !== 'slug').map(k => data[k]);
    if (!fields.length) return res.json({ success: true, message: 'Nada p/ atualizar' });
    fields.push(`atualizado=to_char(now(),'YYYY-MM-DD HH24:MI:SS')`);
    await db.transaction(async () => {
      for (const slug of slugs) {
        await db.prepare(`UPDATE leads SET ${fields.join(',')} WHERE slug=$${fields.length + 1}`).run(...vals, slug);
      }
    });
    res.json({ success: true, message: `${slugs.length} leads atualizados` });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

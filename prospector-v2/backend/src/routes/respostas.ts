import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

router.post('/check', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const propostas = await db.prepare("SELECT * FROM leads WHERE status='proposta' ORDER BY dataProposta DESC").all() as any[];
    const { mensagens } = req.body;
    if (!mensagens?.length) return res.json({ success: true, data: { novasRespostas: 0, propostas } });
    let novasRespostas = 0;
    for (const r of mensagens) {
      const lead = propostas.find((p: any) => p.whatsapp && r.de && p.whatsapp.includes(r.de));
      if (lead) {
        await db.prepare("UPDATE leads SET status='respondeu',obs=COALESCE(obs||' | ','')||$1 WHERE slug=$2").run(`Respondeu automático: ${r.mensagem}`, lead.slug);
        await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run(lead.slug,'respondeu',`"${lead.nome}" respondeu à proposta (detecção automática): ${r.mensagem}`)
        novasRespostas++;
      }
    }
    if (novasRespostas > 0) {
      await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run('_respostas','verificacao_respostas',`Verificação: ${novasRespostas} resposta(s) em ${propostas.length} proposta(s)`);
    }
    res.json({ success: true, data: { novasRespostas, propostas } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug, mensagem } = req.body;
    if (!slug) return res.status(400).json({ success: false, error: 'slug é obrigatório' });
    const lead = await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    await db.prepare("UPDATE leads SET status='respondeu',obs=COALESCE(obs||' | ','')||$1 WHERE slug=$2").run(`Cliente respondeu: ${mensagem||'sem mensagem'}`, slug);
    await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run(slug,'respondeu',`"${lead.nome}" respondeu${mensagem?': '+mensagem:''}`);
    res.json({ success:true, data: await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug), message:`Lead marcado como respondeu` });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const leads = await db.prepare("SELECT slug,nome,email,whatsapp,status,dataProposta,obs FROM leads WHERE status IN ('proposta','respondeu') ORDER BY dataProposta DESC").all();
    res.json({ success: true, data: leads });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/followup', async (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug } = req.body;
    if (!slug) return res.status(400).json({ success: false, error: 'slug é obrigatório' });
    const lead = await db.prepare('SELECT * FROM leads WHERE slug=$1').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    await db.prepare("UPDATE leads SET obs=COALESCE(obs||' | ','')||'Lead frio' WHERE slug=$1").run(slug);
    await db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES ($1,$2,$3)').run(slug,'lead_frio',`"${lead.nome}" marcado como frio`);
    res.json({ success:true, message:'Follow-up registrado' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

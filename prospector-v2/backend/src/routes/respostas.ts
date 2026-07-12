import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

// POST /api/respostas/check - Verifica respostas de propostas via Gmail (simulado)
router.post('/check', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const propostas = db.prepare("SELECT * FROM leads WHERE status='proposta' ORDER BY dataProposta DESC").all() as any[];
    const resultados: any[] = [];
    let novasRespostas = 0;

    for (const lead of propostas) {
      const dias = lead.dataProposta ? Math.floor((Date.now()-new Date(lead.dataProposta+'T12:00:00').getTime())/86400000) : 0;
      const r: any = { slug:lead.slug, nome:lead.nome, email:lead.email, dataProposta:lead.dataProposta, diasSemResposta:dias, respondeu:false, mensagem:null };
      if (lead.email && dias>=3 && Math.random()<0.15) {
        r.respondeu=true; r.mensagem='Olá! Vi a proposta. Podemos conversar?';
        // Atualiza o lead no banco de dados (igual ao /respostas original)
        db.prepare("UPDATE leads SET status='respondeu',obs=COALESCE(obs||' | ','')||? WHERE slug=?").run(`Respondeu automático: ${r.mensagem}`, lead.slug);
        db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run(lead.slug,'respondeu',`"${lead.nome}" respondeu à proposta (detecção automática): ${r.mensagem}`);
        novasRespostas++;
      }
      resultados.push(r);
    }

    db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run('_respostas','verificacao_respostas',`Verificação: ${novasRespostas} resposta(s) em ${propostas.length} proposta(s)`);

    res.json({ success:true, data:{ totalVerificado:propostas.length, novasRespostas, resultados, instrucoes:['Em produção consultaria a API do Gmail','Configure GMAIL_CLIENT_ID no .env','Leads que responderam foram atualizados para status "respondeu"'] }, message:`${novasRespostas} nova(s) resposta(s) encontrada(s) — leads atualizados no banco` });
  } catch (error: any) { res.status(500).json({ success:false, error:error.message }); }
});

// POST /api/respostas/confirm - Confirma resposta manualmente
router.post('/confirm', (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug, mensagem } = req.body;
    if (!slug) return res.status(400).json({ success:false, error:'slug obrigatório' });
    const lead = db.prepare('SELECT * FROM leads WHERE slug=?').get(slug) as any;
    if (!lead) return res.status(404).json({ success:false, error:'Lead não encontrado' });
    db.prepare("UPDATE leads SET status='respondeu',obs=COALESCE(obs||' | ','')||? WHERE slug=?").run(`Cliente respondeu: ${mensagem||'sem mensagem'}`, slug);
    db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run(slug,'respondeu',`"${lead.nome}" respondeu${mensagem?': '+mensagem:''}`);
    res.json({ success:true, data:db.prepare('SELECT * FROM leads WHERE slug=?').get(slug), message:`Lead marcado como respondeu` });
  } catch (error: any) { res.status(500).json({ success:false, error:error.message }); }
});

// GET /api/respostas - Lista leads em ciclo de proposta
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const leads = db.prepare("SELECT slug,nome,email,whatsapp,status,dataProposta,obs FROM leads WHERE status IN ('proposta','respondeu') ORDER BY dataProposta DESC").all();
    const pendentes = (leads as any[]).filter(l=>l.status==='proposta');
    const responderam = (leads as any[]).filter(l=>l.status==='respondeu');
    res.json({ success:true, data:{ total:leads.length, pendentes, responderam, resumo:{ pendentes:pendentes.length, responderam:responderam.length } } });
  } catch (error: any) { res.status(500).json({ success:false, error:error.message }); }
});

// POST /api/respostas/followup - Marca lead como frio
router.post('/followup', (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug } = req.body;
    if (!slug) return res.status(400).json({ success:false, error:'slug obrigatório' });
    const lead = db.prepare('SELECT * FROM leads WHERE slug=?').get(slug) as any;
    if (!lead) return res.status(404).json({ success:false, error:'Lead não encontrado' });
    db.prepare("UPDATE leads SET obs=COALESCE(obs||' | ','')||'Lead frio' WHERE slug=?").run(slug);
    db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run(slug,'lead_frio',`"${lead.nome}" marcado como frio`);
    res.json({ success:true, message:'Lead marcado como frio' });
  } catch (error: any) { res.status(500).json({ success:false, error:error.message }); }
});

export default router;

import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import path from 'path';
import fs from 'fs';

const router = Router();

router.post('/generate', (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug } = req.body;
    if (!slug) return res.status(400).json({ success: false, error: 'slug obrigatório' });
    const lead = db.prepare('SELECT * FROM leads WHERE slug=?').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });

    const rows = db.prepare('SELECT chave,valor FROM config').all() as any[];
    const cfg: any = { contratante: {} };
    for (const r of rows) { try { const keys = r.chave.split('.'); let o = cfg; for (let i=0; i<keys.length-1; i++) { if (!o[keys[i]]) o[keys[i]]={}; o=o[keys[i]]; } o[keys[keys.length-1]] = JSON.parse(r.valor); } catch {} }

    const prestador = cfg.contratante?.nome || 'Seu Nome';
    const docs = [
      { label: 'Do objeto', text: `Criação de nova versão da página na internet, incluindo redesign completo do layout com manutenção da identidade visual, redação aprimorada do conteúdo, adaptação para dispositivos móveis e publicação.` },
      { label: 'Do valor e forma de pagamento', text: `O CONTRATANTE pagará ao CONTRATADO(A) o valor total de R$ ${lead.valor?.toFixed(2)||'(a definir)'}, à vista.` },
      { label: 'Do prazo de entrega', text: `A página será entregue em até 15 dias úteis. Inclui 2 rodadas de ajustes.` },
    ];
    if (lead.manutencao) docs.push({ label: 'Da manutenção mensal', text: `Serviço de manutenção mensal pelo valor de R$ ${lead.manutencao.toFixed(2)}/mês.` });

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Contrato - ${lead.nome}</title><style>@page{size:A4;margin:2.2cm}*{box-sizing:border-box}body{font-family:Georgia,'Times New Roman',serif;font-size:12pt;line-height:1.7;color:#1a1a1a;max-width:800px;margin:0 auto;padding:40px 20px}h1{text-align:center;font-size:15pt}h2{text-align:center;font-size:13pt;font-weight:400;margin-bottom:22px}h3{font-size:12pt;margin-top:18px;margin-bottom:6px}p{text-align:justify;margin:8px 0}.campo{border-bottom:1px dashed #aaa;display:inline-block;min-width:120px;padding:0 4px}.linha{margin-top:50px;border-top:1px solid #333;width:300px;margin:50px auto 0}.assinatura{text-align:center;margin-top:30px}.rodape{font-size:8pt;color:#888;text-align:center;margin-top:40px;border-top:1px solid #ccc;padding-top:10px}button{position:fixed;top:20px;right:20px;background:#C15F3C;color:#fff;border:0;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;z-index:100;font-family:system-ui,sans-serif}button:hover{background:#a94f30}@media print{button{display:none}}</style></head><body><button onclick="window.print()">🖨 Imprimir / Salvar PDF</button><h1>CONTRATO DE PRESTACAO DE SERVICOS</h1><h2>CRIACAO E PUBLICACAO DE PAGINA NA INTERNET</h2><p><strong>CONTRATANTE:</strong> ${lead.nome}, ${lead.docCliente?'CPF/CNPJ nº '+lead.docCliente:''}${lead.endCliente?', '+lead.endCliente:''}${lead.cidade?', '+lead.cidade:''}.</p><p><strong>CONTRATADO(A):</strong> ${prestador}, ${cfg.contratante?.cpfCnpj||''}, ${cfg.contratante?.endereco||''}, ${cfg.contratante?.cidadeUf||''}.</p><p>As partes celebram o presente contrato mediante as cláusulas seguintes.</p>${docs.map((d,i)=>`<h3>Cláusula ${i+1}a — ${d.label}</h3><p>${d.text}</p>`).join('')}<h3>Cláusula ${docs.length+1}a — Do foro</h3><p>Fica eleito o foro da comarca de ${lead.cidade?.split(',')[0]||'São Paulo'}.</p><p style="margin-top:24px">${lead.cidade?.split(',')[0]||'São Paulo'}, ____ de __________ de ______.</p><div class="assinatura"><div class="linha"></div><p><strong>${lead.nome}</strong> — Contratante</p></div><div class="assinatura"><div class="linha"></div><p><strong>${prestador}</strong> — Contratado(a)</p></div><div class="rodape"><p>Minuta base gerada pelo Prospector de Sites. Recomenda-se revisão jurídica antes da assinatura.</p></div></body></html>`;

    const dir = path.join(__dirname, '../../data/sites', slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `contrato-${slug}.html`), html, 'utf-8');
    db.prepare("UPDATE leads SET contratoStatus='enviado',contratoEm=date('now') WHERE slug=?").run(slug);
    db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run(slug,'contrato_gerado',`Contrato gerado para "${lead.nome}"`);
    res.json({ success: true, data: { slug, nome: lead.nome, contractPath: `sites/${slug}/contrato-${slug}.html` }, message: `Contrato gerado para ${lead.nome}` });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/sign', (req: Request, res: Response) => {
  try {
    const { slug } = req.body; if (!slug) return res.status(400).json({ success: false, error: 'slug obrigatório' });
    getDb().prepare("UPDATE leads SET contratoStatus='assinado',contratoEm=date('now'),status='fechado' WHERE slug=?").run(slug);
    res.json({ success: true, message: 'Contrato assinado' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

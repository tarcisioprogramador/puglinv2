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
    const cfg: any = { contratante: {} }; for (const r of rows) { try { const keys = r.chave.split('.'); let o = cfg; for (let i=0; i<keys.length-1; i++) { if (!o[keys[i]]) o[keys[i]]={}; o=o[keys[i]]; } o[keys[keys.length-1]] = JSON.parse(r.valor); } catch {} }

    const autor = cfg.contratante?.nome || 'Seu Nome';
    const apresentacao = cfg.contratante?.apresentacao || 'Especialista em criação de sites';
    const whatsapp = cfg.contratante?.whatsapp || '5500000000000';

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="robots" content="noindex"><title>Nova versao do site - ${lead.nome}</title><style>:root{--bg:#FAF9F5;--ink:#1F1E1D;--muted:#6b6963;--acc:#C15F3C;--card:#fff;--line:#e6e2d8}*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.6}.wrap{max-width:1100px;margin:0 auto;padding:0 20px}.stage{width:min(1560px,96vw);margin:0 auto}header{padding:56px 0 36px;text-align:center}.kicker{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);font-weight:700;margin-bottom:14px}h1{font-family:Georgia,'Times New Roman',serif;font-size:clamp(28px,4.5vw,44px);font-weight:600}h1 em{font-style:normal;color:var(--acc)}.sub{color:var(--muted);max-width:560px;margin:16px auto 0;font-size:17px}.autor{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:22px;color:var(--muted);font-size:14px}.autor b{color:var(--ink)}.toggle{display:flex;justify-content:center;gap:0;margin:34px 0 18px}.toggle button{border:1px solid var(--line);background:var(--card);padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;color:var(--muted);font-family:inherit}.toggle button:first-child{border-radius:10px 0 0 10px}.toggle button:last-child{border-radius:0 10px 10px 0}.toggle button.on{background:var(--ink);color:#fff;border-color:var(--ink)}.frame{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(31,30,29,.08)}.frame .bar{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--line);background:#f4f2ec}.bar span{font-size:12px;color:var(--muted);margin-left:8px}iframe{display:block;width:100%;height:80vh;min-height:520px;border:0;background:#fff}.hide{display:none}.cta{text-align:center;padding:44px 0 64px}.cta p{color:var(--muted);max-width:520px;margin:0 auto 20px}.btn{display:inline-block;background:var(--acc);color:#fff;text-decoration:none;font-weight:700;padding:15px 34px;border-radius:12px;font-size:16px;transition:background .15s}.btn:hover{background:#a94f30}.micro{font-size:13px;color:var(--muted);margin-top:10px}footer{border-top:1px solid var(--line);padding:22px 0 34px;text-align:center;color:var(--muted);font-size:13px}</style></head><body><div class="wrap"><header><div class="kicker">Preparado especialmente para</div><h1>${lead.nome}, esta e a <em>nova versao</em> do seu site</h1><p class="sub">Ja esta no ar, em carater de demonstracao. Compare com a versao atual usando os botoes abaixo.</p><div class="autor">Feito por <b>${autor}</b> · ${apresentacao}</div></header></div><div class="stage"><div class="toggle"><button id="bAntes" onclick="ver('antes')">Site atual</button><button id="bDepois" class="on" onclick="ver('depois')">Nova versao</button></div><div class="frame"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span id="urlLabel">sites/${slug}/${slug}.html</span></div><iframe id="fDepois" src="sites/${slug}/${slug}.html"></iframe><iframe id="fAntes" data-src="${lead.siteAntigo||''}" class="hide"></iframe></div></div><div class="wrap"><div class="cta"><p>Se gostou do que viu, me chama -- te explico como funciona a publicacao definitiva no seu dominio.</p><a class="btn" href="https://wa.me/${whatsapp}?text=Oi%2C%20${encodeURIComponent(autor)}!%20Vi%20a%20nova%20vers%C3%A3o%20do%20meu%20site%20e%20quero%20conversar." target="_blank">Conversar no WhatsApp</a><div class="micro">Sem compromisso -- a demonstracao fica no ar.</div></div></div><footer>Apresentacao privada criada por ${autor} para ${lead.nome}.</footer><script>function ver(q){var a=document.getElementById('fAntes'),d=document.getElementById('fDepois');if(q==='antes'&&!a.src)a.src=a.dataset.src;a.classList.toggle('hide',q!=='antes');d.classList.toggle('hide',q==='antes');document.getElementById('bAntes').classList.toggle('on',q==='antes');document.getElementById('bDepois').classList.toggle('on',q!=='antes')}</script></body></html>`;

    const dir = path.join(__dirname, '../../data/sites', slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'proposta.html'), html, 'utf-8');
    db.prepare("UPDATE leads SET status='proposta',dataProposta=date('now') WHERE slug=?").run(slug);
    db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run(slug,'proposta_gerada',`Proposta para "${lead.nome}"`);
    res.json({ success: true, data: { slug, nome: lead.nome, propostaPath: `sites/${slug}/proposta.html` }, message: `Proposta gerada para ${lead.nome}` });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;

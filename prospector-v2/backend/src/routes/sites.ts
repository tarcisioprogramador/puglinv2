import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import path from 'path';
import fs from 'fs';

const router = Router();

router.post('/redesign', (req: Request, res: Response) => {
  try {
    const db = getDb(); const { slug, html, editorHtml } = req.body;
    if (!slug || !html) return res.status(400).json({ success: false, error: 'slug e html obrigatórios' });
    const lead = db.prepare('SELECT * FROM leads WHERE slug=?').get(slug) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
    const dir = path.join(__dirname, '../../data/sites', slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.html`), html, 'utf-8');
    fs.writeFileSync(path.join(dir, `${slug}-editor.html`), editorHtml || html.replace('</body>', getEditorScript() + '\n</body>'), 'utf-8');
    db.prepare("UPDATE leads SET status='redesenhado' WHERE slug=? AND (status='novo' OR status='redesenhado')").run(slug);
    db.prepare('INSERT INTO atividades (slug,tipo,descricao) VALUES (?,?,?)').run(slug,'redesenhado',`Site de "${lead.nome}" redesenhado`);
    res.json({ success: true, data: { slug, nome: lead.nome, pagePath: `sites/${slug}/${slug}.html`, editorPath: `sites/${slug}/${slug}-editor.html` }, message: 'Site redesenhado' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/comparador/data', (req: Request, res: Response) => {
  try {
    const leads = getDb().prepare("SELECT slug,nome,siteAntigo,urlNova,status FROM leads WHERE status IN ('redesenhado','publicado','proposta','respondeu','fechado') ORDER BY nome").all();
    res.json({ success: true, data: leads.map((l: any) => ({ ...l, pagePath: `sites/${l.slug}/${l.slug}.html` })) });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/:slug', (req: Request, res: Response) => {
  try {
    const { slug } = req.params; const dir = path.join(__dirname, '../../data/sites', slug); const files: any = {};
    for (const f of ['html','editor.html','proposta.html',`contrato-${slug}.html`]) {
      const p = path.join(dir, f.includes('-') ? f : `${slug}-${f}`);
      const p2 = path.join(dir, f);
      if (fs.existsSync(p)) files[f.replace('.html','')] = fs.readFileSync(p, 'utf-8');
      else if (fs.existsSync(p2)) files[f.replace('.html','')] = fs.readFileSync(p2, 'utf-8');
    }
    res.json({ success: true, data: { slug, files } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

function getEditorScript(): string {
  return `\n<!-- PROSPECTOR-EDITOR --><style id="pe-style">#pe-bar{position:fixed;top:0;left:0;right:0;z-index:99999;background:#111;color:#fff;font:14px/1 -apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;gap:16px;padding:10px 16px;box-shadow:0 2px 8px rgba(0,0,0,.3)}#pe-bar button{background:#22c55e;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer}#pe-bar button:hover{background:#16a34a}body{margin-top:44px!important}.pe-hover{outline:2px dashed #22c55e!important;outline-offset:2px}[contenteditable="true"]:focus{outline:2px solid #3b82f6!important;outline-offset:2px}</style><div id="pe-bar"><strong>✎ Modo edição</strong><span>Clique em textos para editar · clique em imagens para trocar</span><button id="pe-export" type="button">⬇ Exportar página</button></div><input type="file" id="pe-file" accept="image/*" style="display:none"><script>(function(){var T='h1,h2,h3,h4,h5,h6,p,li,a,span,button,td,th,figcaption,blockquote';document.querySelectorAll(T).forEach(function(el){if(el.closest('#pe-bar'))return;if(el.children.length===0||el.childElementCount<=1){el.addEventListener('click',function(e){if(el.tagName==='A'||el.tagName==='BUTTON')e.preventDefault();el.setAttribute('contenteditable','true');el.focus()});el.addEventListener('mouseenter',function(){el.classList.add('pe-hover')});el.addEventListener('mouseleave',function(){el.classList.remove('pe-hover')});el.addEventListener('blur',function(){el.removeAttribute('contenteditable')})}});var fi=document.getElementById('pe-file'),ci=null;document.querySelectorAll('img').forEach(function(img){img.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();ci=img;fi.click()});img.addEventListener('mouseenter',function(){img.classList.add('pe-hover')});img.addEventListener('mouseleave',function(){img.classList.remove('pe-hover')})});fi.addEventListener('change',function(){var f=fi.files[0];if(!f||!ci)return;var r=new FileReader();r.onload=function(){ci.src=r.result;if(ci.srcset)ci.removeAttribute('srcset')};r.readAsDataURL(f);fi.value=''});document.getElementById('pe-export').addEventListener('click',function(){var d=document.documentElement.cloneNode(true);['#pe-bar','#pe-style','#pe-script','#pe-file'].forEach(function(s){var n=d.querySelector(s);if(n)n.remove()});d.querySelectorAll('[contenteditable]').forEach(function(n){n.removeAttribute('contenteditable')});d.querySelectorAll('.pe-hover').forEach(function(n){n.classList.remove('pe-hover')});var h='<!DOCTYPE html>\\n'+d.outerHTML;var b=new Blob([h],{type:'text/html'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='index.html';a.click()})})();</script>\n`;
}

export default router;

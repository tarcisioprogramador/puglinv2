import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

const DEFAULT = { contratante: { nome:'', cpfCnpj:'', endereco:'', cidadeUf:'', email:'', whatsapp:'', apresentacao:'' }, hostgator: { usuario:'', dominio:'', servidor:'', senha:'', pastaBase:'clientes' }, preferencias: { nichoPadrao:'', cidadePadrao:'', volumeLeads:10, modoEnvio:'rascunho', idioma:'pt-BR' } };

function load() {
  const rows = getDb().prepare('SELECT chave,valor FROM config').all() as any[];
  const cfg = JSON.parse(JSON.stringify(DEFAULT));
  for (const r of rows) {
    try { const keys = r.chave.split('.'); let o = cfg; for (let i=0; i<keys.length-1; i++) { if (!o[keys[i]]) o[keys[i]]={}; o=o[keys[i]]; } o[keys[keys.length-1]] = JSON.parse(r.valor); } catch {}
  }
  return cfg;
}

function save(cfg: any) {
  const db = getDb(); const stmt = db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)");
  const flat = (o: any, p='') => { for (const [k,v] of Object.entries(o)) { const path = p ? `${p}.${k}` : k; if (v!==null && typeof v==='object' && !Array.isArray(v)) flat(v, path); else stmt.run(path, JSON.stringify(v)); } };
  db.transaction(() => flat(cfg))();
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const cfg = load(); const safe = JSON.parse(JSON.stringify(cfg));
    safe.hostgator.senhaDefinida = !!cfg.hostgator.senha; delete safe.hostgator.senha;
    res.json({ success: true, data: safe });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/', (req: Request, res: Response) => {
  try {
    const cfg = load(); const body = req.body;
    if (body.contratante) Object.assign(cfg.contratante, body.contratante);
    if (body.hostgator) { for (const [k,v] of Object.entries(body.hostgator)) { if (k==='senha' && !v) continue; (cfg.hostgator as any)[k] = v; } }
    if (body.preferencias) Object.assign(cfg.preferencias, body.preferencias);
    save(cfg);
    const safe = JSON.parse(JSON.stringify(cfg)); safe.hostgator.senhaDefinida = !!cfg.hostgator.senha; delete safe.hostgator.senha;
    res.json({ success: true, data: safe, message: 'Configurações salvas' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/test-connection', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { connected: true, message: 'Conexão testada (simulado)' } });
});

export default router;

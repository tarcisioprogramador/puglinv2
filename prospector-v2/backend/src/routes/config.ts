import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

const DEFAULT = { contratante: { nome:'', cpfCnpj:'', endereco:'', cidadeUf:'', email:'', whatsapp:'', apresentacao:'' }, hostgator: { usuario:'', dominio:'', servidor:'', senha:'', pastaBase:'clientes' }, preferencias: { nichoPadrao:'', cidadePadrao:'', volumeLeads:10, modoEnvio:'rascunho', idioma:'pt-BR' } };

async function load() {
  const rows = await getDb().prepare('SELECT chave,valor FROM config').all() as any[];
  const cfg = JSON.parse(JSON.stringify(DEFAULT));
  for (const r of rows) {
    try { const keys = r.chave.split('.'); let o = cfg; for (let i=0; i<keys.length-1; i++) { if (!o[keys[i]]) o[keys[i]]={}; o=o[keys[i]]; } o[keys[keys.length-1]] = JSON.parse(r.valor); } catch {}
  }
  return cfg;
}

async function save(cfg: any) {
  const db = getDb();
  const flat = (o: any, p=''): [string, string][] => {
    const entries: [string, string][] = [];
    for (const [k,v] of Object.entries(o)) {
      const path = p ? `${p}.${k}` : k;
      if (v!==null && typeof v==='object' && !Array.isArray(v)) entries.push(...flat(v as any, path));
      else entries.push([path, JSON.stringify(v)]);
    }
    return entries;
  };
  const entries = flat(cfg);
  await db.transaction(async () => {
    for (const [chave, valor] of entries) {
      await db.prepare('INSERT INTO config (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor=$2').run(chave, valor);
    }
  });
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const cfg = await load(); const safe = JSON.parse(JSON.stringify(cfg));
    safe.hostgator.senhaDefinida = !!cfg.hostgator.senha; delete safe.hostgator.senha;
    res.json({ success: true, data: safe });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const cfg = await load(); const body = req.body;
    if (body.contratante) Object.assign(cfg.contratante, body.contratante);
    if (body.hostgator) { for (const [k,v] of Object.entries(body.hostgator)) { if (k==='senha' && !v) continue; (cfg.hostgator as any)[k] = v; } }
    if (body.preferencias) Object.assign(cfg.preferencias, body.preferencias);
    await save(cfg);
    const safe = JSON.parse(JSON.stringify(cfg)); safe.hostgator.senhaDefinida = !!cfg.hostgator.senha; delete safe.hostgator.senha;
    res.json({ success: true, data: safe, message: 'Configurações salvas' });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/test-connection', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { connected: true, message: 'Conexão testada (simulado)' } });
});

export default router;

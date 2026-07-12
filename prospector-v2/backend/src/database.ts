import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

const DEFAULT_PATH = path.join(__dirname, '../../data/prospector.db');
const getDbPath = () => process.env.DB_PATH || DEFAULT_PATH;
let SQL: any; let db: any; let initialized = false;

class Statement {
  constructor(private d: any, private sql: string) {}
  get(...p: any[]): any { try{const s=this.d.prepare(this.sql);if(p.length>0)s.bind(p);if(s.step()){const r=s.getAsObject();s.free();return r}s.free();return undefined}catch{return undefined} }
  all(...p: any[]): any[] { const s=this.d.prepare(this.sql);if(p.length>0)s.bind(p);const r=[];while(s.step())r.push(s.getAsObject());s.free();return r; }
  run(...p: any[]): any { try{this.d.run(this.sql,p);return{changes:this.d.getRowsModified()}}catch{return{changes:0}} }
}

function saveDb(): void { const dbPath = getDbPath(); const d=db.export();const dir=path.dirname(dbPath);if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dbPath,Buffer.from(d)); }

function wrapDb(d: any): any {
  return new Proxy({}, { get(_t:any,prop:string) {
    if(prop==='prepare') return (sql:string)=>new Statement(d,sql);
    if(prop==='run') return (sql:string,p?:any[])=>{d.run(sql,p||[]);saveDb()};
    if(prop==='exec') return (sql:string)=>{d.exec(sql);saveDb()};
    if(prop==='transaction') return (fn:Function)=>{d.exec('BEGIN');try{fn();d.exec('COMMIT');saveDb()}catch(e){d.exec('ROLLBACK');throw e}};
    return (d as any)[prop];
  }});
}

function initSchema(): void {
  db.run(`CREATE TABLE IF NOT EXISTS leads (slug TEXT PRIMARY KEY, nome TEXT NOT NULL, nicho TEXT, cidade TEXT, nota REAL, avaliacoes INTEGER, email TEXT, telefone TEXT, whatsapp TEXT, siteAntigo TEXT, motivo TEXT, status TEXT DEFAULT 'novo', urlNova TEXT, dataProposta TEXT, valor REAL, obs TEXT, contratoStatus TEXT DEFAULT 'pendente', contratoEm TEXT, manutencao REAL, pago INTEGER DEFAULT 0, docCliente TEXT, endCliente TEXT, atualizado TEXT DEFAULT (datetime('now','localtime')), criadoEm TEXT DEFAULT (datetime('now','localtime')))`);
  db.run(`CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado TEXT DEFAULT (datetime('now','localtime')))`);
  db.run(`CREATE TABLE IF NOT EXISTS atividades (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, tipo TEXT NOT NULL, descricao TEXT NOT NULL, criadoEm TEXT DEFAULT (datetime('now','localtime')))`);
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (slug TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, hash TEXT NOT NULL, criadoEm TEXT DEFAULT (datetime('now','localtime')))`);
  db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (token TEXT PRIMARY KEY, user_slug TEXT NOT NULL, expires TEXT NOT NULL, criadoEm TEXT DEFAULT (datetime('now','localtime')))`);
  db.run(`CREATE TABLE IF NOT EXISTS sites_cache (slug TEXT PRIMARY KEY, htmlOriginal TEXT, htmlRedesenhado TEXT, htmlEditor TEXT, screenshots TEXT, atualizado TEXT DEFAULT (datetime('now','localtime')))`);
  saveDb();
}

export async function initDb(): Promise<void> {
  if(initialized) return; const dbPath = getDbPath(); const dir=path.dirname(dbPath); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
  SQL=await initSqlJs(); if(fs.existsSync(dbPath)){db=new SQL.Database(fs.readFileSync(dbPath))}else{db=new SQL.Database()}
  initSchema(); initialized=true;
}

export function getDb(): any { if(!initialized) throw new Error('Database not initialized'); return wrapDb(db); }
export function closeDb(): void { if(db){saveDb();db.close();initialized=false} }

import { Pool } from 'pg';

let pool: Pool;
let initialized = false;

const DATABASE_URL = () => process.env.DATABASE_URL || '';

function getPool(): Pool {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

class Statement {
  constructor(private p: Pool, private sql: string) {}

  async get(...params: any[]): Promise<any> {
    try {
      const res = await this.p.query(this.sql, params);
      return res.rows[0] || undefined;
    } catch { return undefined; }
  }

  async all(...params: any[]): Promise<any[]> {
    try {
      const res = await this.p.query(this.sql, params);
      return res.rows;
    } catch { return []; }
  }

  async run(...params: any[]): Promise<any> {
    try {
      const res = await this.p.query(this.sql, params);
      return { changes: res.rowCount || 0 };
    } catch { return { changes: 0 }; }
  }
}

function wrapDb(p: Pool): any {
  return new Proxy({}, { get(_t: any, prop: string) {
    if (prop === 'prepare') return (sql: string) => new Statement(p, sql);
    if (prop === 'run') return async (sql: string, params?: any[]) => { await p.query(sql, params || []); };
    if (prop === 'exec') return async (sql: string) => { await p.query(sql); };
    if (prop === 'transaction') return async (fn: Function) => {
      const client = await p.connect();
      try {
        await client.query('BEGIN');
        await fn();
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    };
    return (p as any)[prop];
  }});
}

async function initSchema(): Promise<void> {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS leads (
      slug TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      nicho TEXT,
      cidade TEXT,
      nota REAL,
      avaliacoes INTEGER,
      email TEXT,
      telefone TEXT,
      whatsapp TEXT,
      siteAntigo TEXT,
      motivo TEXT,
      status TEXT DEFAULT 'novo',
      urlNova TEXT,
      dataProposta TEXT,
      valor REAL,
      obs TEXT,
      contratoStatus TEXT DEFAULT 'pendente',
      contratoEm TEXT,
      manutencao REAL,
      pago INTEGER DEFAULT 0,
      docCliente TEXT,
      endCliente TEXT,
      atualizado TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
      criadoEm TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      atualizado TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS atividades (
      id SERIAL PRIMARY KEY,
      slug TEXT,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      criadoEm TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      slug TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      hash TEXT NOT NULL,
      criadoEm TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_slug TEXT NOT NULL,
      expires TEXT NOT NULL,
      criadoEm TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS sites_cache (
      slug TEXT PRIMARY KEY,
      htmlOriginal TEXT,
      htmlRedesenhado TEXT,
      htmlEditor TEXT,
      screenshots TEXT,
      atualizado TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
    )
  `);
}

export async function initDb(): Promise<void> {
  if (initialized) return;
  pool = new Pool({ connectionString: DATABASE_URL(), ssl: { rejectUnauthorized: false } });
  initialized = true;
  await initSchema();
}

export function getDb(): any {
  return wrapDb(getPool());
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    initialized = false;
  }
}

import path from 'path';
import fs from 'fs';

type DbType = 'postgresql' | 'sqlite';

let pgPool: any = null;
let sqliteDb: any = null;
let initialized = false;
let dbType: DbType = 'sqlite';

function convertPlaceholders(sql: string): string {
  return sql.replace(/\$(\d+)/g, () => '?');
}

function getNowExpr(): string {
  return dbType === 'postgresql'
    ? "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')"
    : "datetime('now', 'localtime')";
}

function getDaysSinceExpr(column: string): string {
  return dbType === 'postgresql'
    ? `CURRENT_DATE - (${column})::date`
    : `CAST(julianday('now') - julianday(${column}) AS INTEGER)`;
}

export const SQL_NOW = getNowExpr;
export const SQL_DAYS_SINCE = getDaysSinceExpr;

class PgStatement {
  constructor(private p: any, private sql: string) {}
  async get(...params: any[]): Promise<any> {
    try { const res = await this.p.query(this.sql, params); return res.rows[0] || undefined; }
    catch { return undefined; }
  }
  async all(...params: any[]): Promise<any[]> {
    try { const res = await this.p.query(this.sql, params); return res.rows; }
    catch { return []; }
  }
  async run(...params: any[]): Promise<{ changes: number }> {
    try { const res = await this.p.query(this.sql, params); return { changes: res.rowCount || 0 }; }
    catch { return { changes: 0 }; }
  }
}

class SqliteStatement {
  constructor(private db: any, private rawSql: string) {}
  async get(...params: any[]): Promise<any> {
    try { const stmt = this.db.prepare(convertPlaceholders(this.rawSql)); return stmt.get(...params) || undefined; }
    catch { return undefined; }
  }
  async all(...params: any[]): Promise<any[]> {
    try { const stmt = this.db.prepare(convertPlaceholders(this.rawSql)); return stmt.all(...params); }
    catch { return []; }
  }
  async run(...params: any[]): Promise<{ changes: number }> {
    try { const stmt = this.db.prepare(convertPlaceholders(this.rawSql)); const r = stmt.run(...params); return { changes: r.changes }; }
    catch { return { changes: 0 }; }
  }
}

function wrapPgDb(pool: any): any {
  return new Proxy({}, { get(_t: any, prop: string) {
    if (prop === 'prepare') return (sql: string) => new PgStatement(pool, sql);
    if (prop === 'run') return async (sql: string, params?: any[]) => { await pool.query(sql, params || []); };
    if (prop === 'exec') return async (sql: string) => { await pool.query(sql); };
    if (prop === 'transaction') return async (fn: Function) => {
      const client = await pool.connect();
      try { await client.query('BEGIN'); await fn(); await client.query('COMMIT'); }
      catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    };
    return (pool as any)[prop];
  }});
}

function wrapSqliteDb(db: any): any {
  return new Proxy({}, { get(_t: any, prop: string) {
    if (prop === 'prepare') return (sql: string) => new SqliteStatement(db, sql);
    if (prop === 'run') return async (sql: string, params?: any[]) => {
      db.prepare(convertPlaceholders(sql)).run(...(params || []));
    };
    if (prop === 'exec') return async (sql: string) => { db.exec(sql); };
    if (prop === 'transaction') return async (fn: Function) => {
      db.exec('BEGIN');
      try { await fn(); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    };
    return (db as any)[prop];
  }});
}

const TS_DEFAULT_PG = `(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`;
const TS_DEFAULT_SQL = `(datetime('now', 'localtime'))`;

function schemaSql(): string[] {
  const tsDef = dbType === 'postgresql' ? TS_DEFAULT_PG : TS_DEFAULT_SQL;
  const serialType = dbType === 'postgresql' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

  return [
    `CREATE TABLE IF NOT EXISTS leads (
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
      atualizado TEXT DEFAULT ${tsDef},
      criadoEm TEXT DEFAULT ${tsDef}
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      atualizado TEXT DEFAULT ${tsDef}
    )`,
    `CREATE TABLE IF NOT EXISTS atividades (
      id ${serialType},
      slug TEXT,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      criadoEm TEXT DEFAULT ${tsDef}
    )`,
    `CREATE TABLE IF NOT EXISTS usuarios (
      slug TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      hash TEXT NOT NULL,
      criadoEm TEXT DEFAULT ${tsDef}
    )`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_slug TEXT NOT NULL,
      expires TEXT NOT NULL,
      criadoEm TEXT DEFAULT ${tsDef}
    )`,
    `CREATE TABLE IF NOT EXISTS sites_cache (
      slug TEXT PRIMARY KEY,
      htmlOriginal TEXT,
      htmlRedesenhado TEXT,
      htmlEditor TEXT,
      screenshots TEXT,
      atualizado TEXT DEFAULT ${tsDef}
    )`,
  ];
}

export async function initDb(): Promise<void> {
  if (initialized) return;

  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    dbType = 'postgresql';
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    initialized = true;
    const stmts = schemaSql();
    for (const s of stmts) await pgPool.query(s);
    console.log('📦 Database: PostgreSQL conectado');
  } else {
    const Database = require('better-sqlite3');
    dbType = 'sqlite';
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/prospector.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    initialized = true;
    const stmts = schemaSql();
    for (const s of stmts) sqliteDb.exec(s);
    console.log(`📦 Database: SQLite (${dbPath})`);
  }
}

export function getDb(): any {
  if (dbType === 'postgresql' && pgPool) return wrapPgDb(pgPool);
  if (dbType === 'sqlite' && sqliteDb) return wrapSqliteDb(sqliteDb);
  throw new Error('Database not initialized');
}

export async function closeDb(): Promise<void> {
  if (pgPool) { await pgPool.end(); pgPool = null; }
  if (sqliteDb) { sqliteDb.close(); sqliteDb = null; }
  initialized = false;
}

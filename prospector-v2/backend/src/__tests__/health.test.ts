import path from 'path';
import os from 'os';
import fs from 'fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb, getDb } from '../database';

const TEST_DB = path.join(os.tmpdir(), 'prospector-test-health.db');

const app = express();
app.use(express.json());
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Prospector v2 API rodando', timestamp: new Date().toISOString() });
});

describe('GET /api/health', () => {
  beforeAll(async () => {
    process.env.DB_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    await initDb();
  });

  afterAll(() => { closeDb(); try { fs.unlinkSync(TEST_DB); } catch {} });

  it('returns success with API running message', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Prospector v2 API rodando');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns a valid ISO timestamp', async () => {
    const res = await request(app).get('/api/health');
    const timestamp = new Date(res.body.timestamp);
    expect(timestamp instanceof Date).toBe(true);
    expect(timestamp.getTime()).not.toBeNaN();
  });
});

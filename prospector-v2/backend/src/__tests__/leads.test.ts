import path from 'path';
import os from 'os';
import fs from 'fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { initDb, closeDb, getDb } from '../database';
import authRouter from '../routes/auth';
import leadsRouter from '../routes/leads';

const TEST_DB = path.join(os.tmpdir(), 'prospector-test-leads.db');
const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/leads', (req: any, _res, next) => {
  // Simple auth middleware for testing
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try { req.user = jwt.verify(auth.slice(7), JWT_SECRET); } catch {}
  }
  next();
}, leadsRouter);

let token = '';

describe('Leads CRUD', () => {
  beforeAll(async () => {
    process.env.DB_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    await initDb();
    // Register and login to get token
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@teste.com', senha: '123456', nome: 'Admin' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@teste.com', senha: '123456' });
    token = loginRes.body.data.accessToken;
  });

  afterAll(() => { closeDb(); try { fs.unlinkSync(TEST_DB); } catch {} });

  describe('POST /api/leads', () => {
    it('creates a new lead', async () => {
      const res = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'João Silva', nicho: 'Advogado', cidade: 'São Paulo', nota: 4.8, status: 'novo' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nome).toBe('João Silva');
      expect(res.body.data.status).toBe('novo');
    });

    it('creates lead with all fields', async () => {
      const res = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome: 'Maria Santos',
          nicho: 'Médico',
          cidade: 'Rio de Janeiro',
          nota: 4.9,
          avaliacoes: 80,
          email: 'maria@exemplo.com',
          telefone: '11999999999',
          whatsapp: '5511999999999',
          siteAntigo: 'https://site-antigo.com',
          motivo: 'Layout antigo, sem CTA',
          status: 'novo',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('maria@exemplo.com');
    });
  });

  describe('GET /api/leads', () => {
    it('lists all leads', async () => {
      const res = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('filters leads by status', async () => {
      const res = await request(app)
        .get('/api/leads?status=novo')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((l: any) => l.status === 'novo')).toBe(true);
    });

    it('searches leads', async () => {
      const res = await request(app)
        .get('/api/leads?search=João')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].nome).toContain('João');
    });
  });

  describe('PUT /api/leads/:slug', () => {
    it('updates a lead', async () => {
      const listRes = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${token}`);
      const slug = listRes.body.data[0].slug;

      const res = await request(app)
        .put(`/api/leads/${slug}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'redesenhado', valor: 700 });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('redesenhado');
      expect(res.body.data.valor).toBe(700);
    });

    it('returns 404 for non-existent lead', async () => {
      const res = await request(app)
        .put('/api/leads/slug-inexistente')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'fechado' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/leads/:slug', () => {
    it('gets a single lead', async () => {
      const listRes = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${token}`);
      const slug = listRes.body.data[0].slug;

      const res = await request(app)
        .get(`/api/leads/${slug}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe(slug);
    });

    it('returns 404 for non-existent lead', async () => {
      const res = await request(app)
        .get('/api/leads/slug-inexistente')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/leads/:slug', () => {
    it('deletes a lead', async () => {
      const listRes = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${token}`);
      const slug = listRes.body.data[0].slug;

      const res = await request(app)
        .delete(`/api/leads/${slug}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/leads/${slug}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('GET /api/leads/stats/overview', () => {
    it('returns dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/leads/stats/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalLeads).toBeDefined();
      expect(res.body.data.leadsAtivos).toBeDefined();
      expect(res.body.data.funnel).toBeDefined();
    });
  });
});

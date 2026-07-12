import path from 'path';
import os from 'os';
import fs from 'fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb, getDb } from '../database';
import authRouter from '../routes/auth';

const TEST_DB = path.join(os.tmpdir(), 'prospector-test-auth.db');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    process.env.DB_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    await initDb();
  });

  afterAll(() => { closeDb(); try { fs.unlinkSync(TEST_DB); } catch {} });

  describe('GET /api/auth/check', () => {
    it('returns existeUsuario false on fresh database', async () => {
      const res = await request(app).get('/api/auth/check');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.existeUsuario).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'teste@teste.com', senha: '123456', nome: 'Test User' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Usuário criado');
    });

    it('fails when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'teste@teste.com' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('fails when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'outro@teste.com', senha: '123', nome: 'Other' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('6 caracteres');
    });

    it('prevents second registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'segundo@teste.com', senha: '123456', nome: 'Segundo' });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'teste@teste.com', senha: '123456' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.nome).toBe('Test User');
      expect(res.body.data.user.email).toBe('teste@teste.com');
    });

    it('fails with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'teste@teste.com', senha: 'senha_errada' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('fails with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nao_existe@teste.com', senha: '123456' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('fails with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'teste@teste.com' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('refreshes token with valid refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'teste@teste.com', senha: '123456' });
      const refreshToken = loginRes.body.data.refreshToken;

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(refreshToken); // Rotated
    });

    it('fails with invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'token_invalido' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('fails with missing refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/verify', () => {
    it('verifies a valid token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'teste@teste.com', senha: '123456' });
      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('teste@teste.com');
    });

    it('fails without auth header', async () => {
      const res = await request(app).get('/api/auth/verify');
      expect(res.status).toBe(401);
    });

    it('fails with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer token_invalido');
      expect(res.status).toBe(401);
    });
  });
});

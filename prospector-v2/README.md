# Prospector de Sites v2 🔍

Sistema completo para prospecção e gestão de leads para criação de sites. Inclui motor de busca automatizado, geração de propostas/contratos, redesign de sites e gestão financeira.

## 🧱 Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Node.js + Express + TypeScript |
| **Banco** | PostgreSQL (Railway) |
| **Autenticação** | JWT (bcrypt + jsonwebtoken) |
| **Scraping** | Playwright + Cheerio |
| **Deploy Frontend** | GitHub Pages (Actions) |
| **Deploy Backend** | Railway |

## 📁 Estrutura

```
prospector-v2/
├── backend/                     # API REST (Express + TypeScript)
│   ├── src/
│   │   ├── database.ts          # Conexão PostgreSQL + schema
│   │   ├── index.ts             # Entry point / Express app
│   │   ├── seed.ts              # Cria admin e config padrão
│   │   ├── middleware/auth.ts   # JWT middleware
│   │   ├── routes/              # Rotas da API
│   │   │   ├── auth.ts          # Login, register, refresh
│   │   │   ├── leads.ts         # CRUD leads
│   │   │   ├── prospects.ts     # Prospecção automática
│   │   │   ├── proposals.ts     # Geração de propostas
│   │   │   ├── contracts.ts     # Geração de contratos
│   │   │   ├── sites.ts         # Redesign de sites
│   │   │   ├── deploy.ts        # Publicação HostGator
│   │   │   ├── dashboard.ts     # Estatísticas
│   │   │   ├── config.ts        # Configurações do sistema
│   │   │   ├── export.ts        # Exportação CSV/relatórios
│   │   │   ├── atividades.ts    # Log de atividades
│   │   │   └── respostas.ts     # Respostas automáticas
│   │   └── services/
│   │       ├── prospectorEngine.ts   # Motor de prospecção
│   │       ├── googleMapsScraper.ts  # Scraper Google Maps
│   │       └── websiteAnalyzer.ts    # Análise de sites
│   └── package.json
│
├── frontend/                    # SPA React + Vite
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/          # Páginas e componentes
│   │   └── services/
│   │       ├── api.ts           # Cliente HTTP
│   │       └── AuthContext.tsx   # Contexto de autenticação
│   └── package.json
│
└── README.md
```

## 🚀 Desenvolvimento Local

### Pré-requisitos

- Node.js 20+ (recomendado usar `nvm use 20`)
- PostgreSQL local ou acesso a um banco remoto
- Git

### 1. Backend

```bash
cd prospector-v2/backend

# Instalar dependências
npm install

# Copiar variáveis de ambiente e editar
cp .env.example .env
# Edite o .env com sua DATABASE_URL, JWT_SECRET, etc.

# Instalar browser para scraping (Playwright)
npx playwright install chromium

# Iniciar em modo dev (com hot-reload)
npm run dev
```

**Variáveis de ambiente (.env):**

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `DATABASE_URL` | ✅ | — | Connection string PostgreSQL |
| `JWT_SECRET` | | `prospector-dev-secret` | Chave para assinar tokens |
| `PORT` | | `3001` | Porta do servidor |
| `FRONTEND_URL` | | `http://localhost:5173` | URL do frontend (CORS) |

> 💡 **Sem PostgreSQL local?** Copie a DATABASE_URL do Railway e use-a localmente:
> ```bash
> cd prospector-v2/backend
> railway variables list | grep DATABASE_URL
> DATABASE_URL="postgresql://..." npm run dev
> ```

### 2. Frontend

```bash
cd prospector-v2/frontend

# Instalar dependências
npm install

# Iniciar em modo dev (com proxy para backend local)
npm run dev
```

O frontend inicia em `http://localhost:5173` com proxy automático para o backend em `http://localhost:3001`.

### 3. Seed (criar admin)

Com o backend rodando, execute:

```bash
cd prospector-v2/backend

# Cria admin + config padrão
npm run seed
```

Para customizar o admin:

```bash
SEED_EMAIL=admin@meusite.com SEED_SENHA=123456 SEED_NOME=Admin npm run seed
```

## 🗄️ Banco de Dados

O sistema usa PostgreSQL. As tabelas são criadas automaticamente na inicialização (`initSchema()`).

### Tabelas principais

| Tabela | Finalidade |
|--------|-----------|
| `usuarios` | Autenticação (email + hash bcrypt) |
| `leads` | Leads prospectados com status |
| `config` | Configurações do sistema (JSON) |
| `atividades` | Log de atividades |
| `refresh_tokens` | Tokens de refresh JWT |
| `sites_cache` | Cache de sites (redesign) |

Para resetar o banco em dev, basta dropar as tabelas e reiniciar o servidor.

## 🌐 Deploy

### Backend — Railway

O backend está configurado para deploy no [Railway](https://railway.app).

**Setup inicial (uma vez):**

```bash
# Instalar CLI do Railway
npm i -g @railway/cli

# Logar
railway login

# Linkar o projeto (da pasta backend)
cd prospector-v2/backend
railway link

# Adicionar PostgreSQL
railway add --database postgres

# Configurar variáveis
railway variables set JWT_SECRET=sua-chave-secreta
railway variables set FRONTEND_URL=https://seu-user.github.io
```

**Deploy:**

```bash
cd prospector-v2/backend
git add -A && git commit -m "descrição"
git push
# ou via CLI:
railway up
```

O Railway detecta automaticamente Node.js, executa `npm run build` e `npm start`.

**Logs:**

```bash
railway logs                     # Logs do deploy atual
railway logs --deployment        # Logs de build
railway logs --filter "@level:error"  # Apenas erros
```

### Frontend — GitHub Pages

O deploy do frontend é automatizado via **GitHub Actions** (`.github/workflows/deploy-pages.yml`).

A cada push no branch `master` que modifique arquivos em `prospector-v2/frontend/`, o workflow:

1. Instala dependências
2. Builda com `VITE_API_URL` apontando para o Railway
3. Faz upload para GitHub Pages

**Setup manual (uma vez):**

1. Vá em Settings > Pages do seu repositório
2. Em "Build and deployment", selecione **GitHub Actions**
3. O workflow já está configurado em `.github/workflows/deploy-pages.yml`

Para build manual local:

```bash
cd prospector-v2/frontend
VITE_BASE_URL=/puglinv2/ VITE_API_URL=https://prospector-v2-production.up.railway.app npm run build:prod
```

## 🔐 API

### Rotas públicas

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/auth/check` | Verifica se existe admin |
| `POST` | `/api/auth/register` | Criar conta |
| `POST` | `/api/auth/login` | Login (retorna JWT) |
| `POST` | `/api/auth/refresh` | Renovar token |

### Rotas protegidas (Bearer token)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET/POST/PUT/DELETE` | `/api/leads` | CRUD leads |
| `GET/PUT` | `/api/config` | Configurações |
| `POST` | `/api/prospects/search` | Buscar prospects |
| `POST` | `/api/prospects/import` | Importar prospects |
| `POST` | `/api/prospects/auto-prospectar` | Prospecção automática |
| `GET` | `/api/prospects/prospectar/:jobId` | Status da prospecção |
| `POST` | `/api/proposals/generate` | Gerar proposta |
| `POST` | `/api/contracts/generate` | Gerar contrato |
| `POST` | `/api/contracts/sign` | Assinar contrato |
| `POST` | `/api/deploy/publish` | Publicar site |
| `GET` | `/api/dashboard/stats` | Estatísticas |
| `GET` | `/api/dashboard/financeiro` | Financeiro |
| `GET` | `/api/atividades` | Log de atividades |
| `GET` | `/api/export/csv` | Exportar leads CSV |
| `GET` | `/api/export/report` | Relatório completo |

## 📦 Scripts úteis

### Backend

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev com hot-reload (tsx) |
| `npm run build` | Compilar TypeScript |
| `npm start` | Rodar produção (precisa de `build`) |
| `npm run seed` | Criar admin + config padrão |
| `npm run db:init` | Inicializar banco |
| `npm test` | Rodar testes |

### Frontend

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server (Vite) |
| `npm run build` | Build TS + Vite |
| `npm run build:prod` | Build produção (sem TS check) |
| `npm run preview` | Preview do build |
| `npm test` | Rodar testes |

## 🤝 Contribuindo

1. Crie um branch a partir de `master`
2. Faça as alterações no backend ou frontend
3. Teste localmente (`npm run dev` em ambos)
4. Abra um Pull Request

O CI roda automaticamente: build do frontend + deploy para GitHub Pages.

---
<p align="center">Feito com ☕ + 🧠</p>

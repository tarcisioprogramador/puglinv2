# Prospector de Sites v2

Sistema profissional para automatizar o ciclo completo de prospecção, redesign e venda de sites.

## Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🔍 Prospecção | Encontre negócios bem avaliados (≥4.7⭐) com sites ruins no Google Maps |
| 🎨 Redesign | Crie versões premium com editor visual integrado |
| 📊 Dashboard | Painel Kanban, métricas e pipeline de vendas |
| 📧 Propostas | Geração de e-mails anti-spam com página antes/depois |
| 🌐 Publicação | Deploy automático na HostGator com HTTPS |
| 📋 Contratos | Geração de contratos profissionais HTML |
| 💰 Financeiro | Controle de receitas, MRR e projeções |
| 📈 Follow-ups | Acompanhamento inteligente de leads |
| 📥 Exportação | CSV, JSON e relatórios |

## Arquitetura

```
prospector-v2/
├── backend/         # API REST (Node.js + Express + TypeScript + SQLite)
│   ├── src/
│   │   ├── routes/  # 10 endpoints da API
│   │   └── index.ts # Servidor Express
│   └── data/        # Banco SQLite + sites publicados
├── frontend/        # SPA React (Vite + TypeScript)
│   └── src/
│       ├── components/  # 12 componentes React
│       └── services/    # API client
└── README.md
```

## Instalação

```bash
# 1. Entre na pasta do projeto
cd prospector-v2

# 2. Instale dependências
cd backend && npm install && cd ../frontend && npm install && cd ..

# 3. Configure o ambiente
cp backend/.env.example backend/.env

# 4. Inicie (backend + frontend)
# Terminal 1:
cd backend && npm run dev
# Terminal 2:
cd frontend && npm run dev
```

Backend: http://localhost:3001 | Frontend: http://localhost:5173

## API REST

### Leads
- `GET /api/leads` — Listar leads (filtros: status, search, sortBy, page)
- `GET /api/leads/stats/overview` — Estatísticas do dashboard
- `POST /api/leads` — Criar lead
- `PUT /api/leads/:slug` — Atualizar lead
- `DELETE /api/leads/:slug` — Excluir lead
- `PATCH /api/leads/batch` — Atualização em lote

### Dashboard
- `GET /api/dashboard/stats` — Métricas e funil
- `GET /api/dashboard/financeiro` — Dados financeiros

### Prospecção
- `POST /api/prospects/search` — Instruções de prospecção
- `POST /api/prospects/import` — Importar leads

### Sites
- `POST /api/sites/redesign` — Salvar redesign
- `GET /api/sites/comparador/data` — Dados do comparador

### Propostas & Contratos
- `POST /api/proposals/generate` — Gerar proposta
- `POST /api/contracts/generate` — Gerar contrato
- `POST /api/contracts/sign` — Assinar contrato

### Deploy
- `POST /api/deploy/publish` — Publicar na HostGator

### Exportação
- `GET /api/export/csv` — Exportar CSV
- `GET /api/export/json` — Exportar JSON
- `GET /api/export/report` — Relatório completo

## Segurança

- Senha da HostGator **nunca** passa pelo frontend/chat
- Configurações sensíveis apenas no arquivo local
- Contratos incluem aviso de revisão jurídica
- Dados armazenados localmente (SQLite)

---

> Versão moderna do plugin "Prospector de Sites" para Claude Code — transformado em aplicação web completa e independente.

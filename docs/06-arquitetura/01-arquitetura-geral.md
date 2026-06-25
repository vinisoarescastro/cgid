# Arquitetura Geral do Sistema

> **Documento:** 06-arquitetura/01-arquitetura-geral.md  
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** 2026-06-25 (v2.0)

---

## 1. Visão Geral da Arquitetura (C4 — Nível 1: Contexto)

```
                      ┌─────────────────────────────────┐
                      │                                 │
    [Colaborador]──▶ │   BrasilTerrenos                │──▶ [Power BI Service]
    [Coordenador]──▶ │   Portal Corporativo            │
    [Admin]      ──▶ │                                 │
                      │   Sistema de Governança         │
                      │   Analítica                     │
                      └─────────────────────────────────┘
```

---

## 2. Diagrama de Containers (C4 — Nível 2)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      BrasilTerrenos Portal                           │
│                                                                      │
│  ┌────────────────┐   HTTPS/REST    ┌──────────────────────────┐     │
│  │   React SPA    │ ◀────────────▶ │    FastAPI (Backend)     │     │
│  │  (Frontend)    │  JSON/fetch     │                          │     │
│  │  JavaScript    │                 │   routers/ (9 módulos)   │     │
│  │  Vite          │                 │   services/ (3 arquivos) │     │
│  │  sessionStorage│                 │   dependencies.py        │     │
│  │  apiFetch      │                 │   schemas.py             │     │
│  │  powerbi-client│                 │   models.py (21 tabelas) │     │
│  └────────────────┘                 │   Alembic (migrações)    │     │
│                                     │                          │     │
│                                     └──────────────┬───────────┘     │
│                                                   │ SQLAlchemy       │
│                                     ┌─────────────▼──────────────┐   │
│                                     │  SQLite (dev) /            │   │
│                                     │  SQL Server (prod)         │   │
│                                     │  SQLAlchemy 2.0 + Alembic  │   │
│                                     └────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────▼──────────────┐
                        ▼                          ▼
              [Power BI REST API]        [SMTP — v1.1+]
```

---

## 3. Camadas da Aplicação

### 3.1 Frontend (React SPA)

**Responsabilidade:** Interface do usuário, navegação, exibição de dados e embed de relatórios PBI.

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|-----------------|
| Framework | React 19 + JavaScript | Componentização |
| Build | Vite | Bundling, HMR, otimização |
| Roteamento | React Router v7 | Navegação client-side |
| Estado servidor | `useEffect` + `fetch` nativo | Busca de dados e loading states por página |
| Estado de autenticação | `sessionStorage` | Dados do usuário logado entre navegações |
| Formulários | `useState` + validação local | Validação manual nos componentes |
| PBI Embed | powerbi-client (SDK oficial) | Renderização inline de relatórios |
| HTTP | `fetch` nativo + `apiFetch` | Chamadas à API; envio do header `X-Usuario-Id` em ações auditáveis |

**Regras do Frontend:**
- Sem lógica de negócio crítica no cliente
- Toda validação de segurança ocorre no backend (RBAC, permissões)
- No protótipo atual, a sessão fica em `sessionStorage`; JWT/refresh token ficam como evolução planejada
- O helper `apiFetch` envia `X-Usuario-Id` para identificar o autor de ações registradas na auditoria

---

### 3.2 Backend — API (Python + FastAPI)

**Responsabilidade:** Toda a lógica de negócio, autenticação, autorização, integração PBI e persistência.

**Estrutura de arquivos (v2.0 — modular):**

```
backend/
├── main.py               ← ponto de entrada FastAPI (~47 linhas): CORS, middleware, routers
├── database.py           ← conexão SQLite/SQL Server (engine + sessão)
├── models.py             ← 21 tabelas (SQLAlchemy ORM)
├── schemas.py            ← todos os schemas Pydantic centralizados
├── dependencies.py       ← middleware de sessão, checar_permissao, exigir_permissao
├── seed.py               ← cria tabelas e insere dados iniciais
├── alembic.ini           ← configuração Alembic (migrações)
├── .env / .env.example   ← variáveis de ambiente
├── services/
│   ├── auth_service.py   ← login, seed de permissões/dados, expediente
│   ├── audit_service.py  ← registrar_log, salvar_backup_critico
│   └── pbi_service.py    ← OAuth2 Azure AD, geração de embed token
├── routers/
│   ├── auth.py           ← /login, /logout, /sessao/ping
│   ├── usuarios.py       ← CRUD usuários, favoritos, acessos
│   ├── workspaces.py     ← workspaces, relatórios, categorias, embed PBI
│   ├── permissoes.py     ← pacotes, perfis, controle de acesso
│   ├── auditoria.py      ← logs, CSV, histórico crítico
│   ├── configuracoes.py  ← expediente, grupos, credenciais PBI
│   ├── dashboard.py      ← KPIs, gráficos
│   ├── landbank.py       ← terrenos georreferenciados
│   └── departamentos.py  ← CRUD departamentos
└── migrations/
    ├── env.py
    └── versions/
        └── 60fc08a85566_v2_schema_completo.py
```

**Pipeline de uma requisição autenticada:**

```
Request
  → CORS (verificação de origem)
  → validar_sessao_middleware (dependencies.py)
      → calcula SHA-256 do X-Session-Token
      → valida contra sessoes_autenticacao (expira_em, revogado_em)
      → injeta usuario_id no request.state
  → Router FastAPI (routers/*.py)
  → Validação Pydantic (schemas.py)
  → get_usuario_requisicao + exigir_permissao (dependencies.py)
  → Lógica de negócio → banco via SQLAlchemy
  → registrar_log(...) em audit_service quando auditável
  → Resposta Pydantic (serialização automática)
Response
```

---

### 3.3 Banco de Dados

- **Desenvolvimento:** SQLite 3 (`backend/cgid.db`) — criado automaticamente ao rodar `seed.py`
- **Produção recomendada:** SQL Server 2019+
- Conexão via `pyodbc` + `ODBC Driver 17 for SQL Server`
- ORM: SQLAlchemy 2.0 com dialeto `mssql+pyodbc`
- **Migrações:** Alembic com `render_as_batch=True` (suporte a ALTER TABLE no SQLite)
- Tabela `logs_auditoria` sem FK para preservar histórico; trigger `INSTEAD OF` no SQL Server
- Tabela `sessoes_autenticacao` para token opaco SHA-256, expiração 12h, sessão única

**Criação do banco:**
```bash
# Banco novo (primeira vez)
python seed.py   # cria tabelas + dados iniciais

# Banco existente (atualizar para v2.0)
alembic upgrade head
```

---

## 4. Autenticação (v2.0 — Implementada)

O sistema usa **token de sessão opaco** (não JWT). Fluxo:

```
POST /login
  → valida e-mail/senha (bcrypt)
  → gera token aleatório (secrets.token_urlsafe(32))
  → armazena SHA-256 em sessoes_autenticacao (expira_em = agora + 12h)
  → revoga sessões anteriores do mesmo usuário (sessão única)
  → retorna session_token (bruto) ao frontend + dados do usuário

A cada requisição autenticada:
  → Frontend envia X-Session-Token: <token_bruto>
  → validar_sessao_middleware (dependencies.py) valida o SHA-256
  → Se válido: injeta usuario_id no request.state
  → Se inválido/expirado: 401

POST /api/logout
  → registra revogado_em na sessão ativa
  → Frontend limpa sessionStorage

GET /sessao/ping
  → renova ultimo_uso_em da sessão (mantém sessão viva enquanto usuário está ativo)
```

**Segurança adicional:**
- Bloqueio automático após 5 tentativas de login incorretas (`tentativas_login`)
- Senha provisória força troca no próximo login (`senha_provisoria = True`)
- Todas as ações autenticadas são registradas em `logs_auditoria`

---

## 5. API REST — Endpoints Disponíveis (v2.0)

### Autenticação (`routers/auth.py`)
```
POST   /login                    → autenticação; retorna session_token + dados do usuário
POST   /api/logout               → revoga sessão ativa
GET    /sessao/ping              → renova ultimo_uso_em da sessão
```

### Dashboard (`routers/dashboard.py`)
```
GET    /dashboard/kpis           → KPIs globais
GET    /dashboard/eventos        → últimos eventos de auditoria
GET    /dashboard/workspaces     → workspaces com contagens
GET    /dashboard/expediente     → status atual do expediente no servidor
```

### Departamentos — *novo v2.0* (`routers/departamentos.py`)
```
GET    /departamentos
POST   /departamentos
PUT    /departamentos/{id}
DELETE /departamentos/{id}       → soft-delete (ativo=False)
```

### Usuários (`routers/usuarios.py`)
```
GET    /usuarios
POST   /usuarios
PUT    /usuarios/{id}
DELETE /usuarios/{id}
POST   /usuarios/{id}/resetar-senha
GET    /usuarios/{id}/acessos
PUT    /usuarios/{id}/acessos
GET    /usuarios/{id}/favoritos
POST   /usuarios/{id}/favoritos
DELETE /usuarios/{id}/favoritos/{relatorio_id}
```

### Workspaces e Relatórios (`routers/workspaces.py`)
```
GET    /workspaces
POST   /workspaces
PUT    /workspaces/{id}
PATCH  /workspaces/{id}/arquivar
GET    /workspaces/{id}/usuarios
POST   /workspaces/{id}/usuarios
PATCH  /workspaces/{id}/usuarios/{usuario_id}
DELETE /workspaces/{id}/usuarios/{usuario_id}
GET    /workspaces/{id}/usuarios/{usuario_id}/relatorios
PUT    /workspaces/{id}/usuarios/{usuario_id}/relatorios
GET    /workspaces/{id}/relatorios
POST   /workspaces/{id}/relatorios
PUT    /workspaces/{id}/relatorios/{relatorio_id}
DELETE /workspaces/{id}/relatorios/{relatorio_id}
GET    /relatorios/{id}/embed
GET    /categorias-relatorio                         → novo v2.0
POST   /categorias-relatorio                         → novo v2.0
PUT    /categorias-relatorio/{id}                    → novo v2.0
DELETE /categorias-relatorio/{id}                    → novo v2.0
```

### Permissões (`routers/permissoes.py`)
```
GET    /api/perfis               → lista perfis com metadados (nivel_hierarquia)
GET    /permissoes/perfil        → matriz RBAC por perfil
PUT    /permissoes/perfil/{perfil}/{modulo}
GET    /permissoes/pacotes
POST   /permissoes/pacotes
PUT    /permissoes/pacotes/{id}
DELETE /permissoes/pacotes/{id}
GET    /usuarios/{id}/pacotes
POST   /usuarios/{id}/pacotes
DELETE /usuarios/{id}/pacotes/{pacote_id}
GET    /usuarios/{id}/permissoes → permissões efetivas do usuário
```

### Auditoria (`routers/auditoria.py`)
```
GET    /auditoria
GET    /auditoria/export-csv
GET    /auditoria/tipos
GET    /auditoria/modulos
GET    /historico-critico
```

### Configurações (`routers/configuracoes.py`)
```
GET    /configuracoes/expediente
PUT    /configuracoes/expediente/{dia_semana}
GET    /configuracoes/grupos-excecao
POST   /configuracoes/grupos-excecao
PUT    /configuracoes/grupos-excecao/{grupo_id}
DELETE /configuracoes/grupos-excecao/{grupo_id}
POST   /configuracoes/grupos-excecao/{grupo_id}/membros
DELETE /configuracoes/grupos-excecao/{grupo_id}/membros/{usuario_id}
GET    /configuracoes/pbi
GET    /configuracoes/pbi/secret
PUT    /configuracoes/pbi
```

---

## 6. Variáveis de Ambiente

**`backend/.env`** (copiar de `.env.example`)
```env
# Banco (opcional — padrão é SQLite)
# DATABASE_URL=mssql+pyodbc://usuario:senha@servidor/cgid?driver=ODBC+Driver+17+for+SQL+Server

# Power BI Embedded (opcional — se não configurado, embed não funciona)
PBI_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_SECRET=sua-chave-secreta-aqui
```

> As credenciais PBI também podem ser cadastradas via interface administrativa em **Configurações → Credenciais Power BI** (persistidas na tabela `configuracoes_sistema`).

**`frontend/` — sem `.env` necessário em desenvolvimento.** O Vite proxia `/api` para `http://localhost:8000` automaticamente via `vite.config.js`.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento (stack NestJS) |
| 2.0 | Maio/2026 | Vinicius Soares | Reescrita completa: migração para Python + FastAPI, SQL Server, remoção de Redis e BullMQ, nomes em Português |
| 2.1 | Junho/2026 | Vinicius Soares | Atualização para estado atual do protótipo: rotas diretas FastAPI, sessionStorage, apiFetch com X-Usuario-Id, endpoints de favoritos, auditoria, configurações e Power BI Embedded |
| 2.2 | 2026-06-25 | Vinicius Soares | **v2.0 — arquitetura modular:** `main.py` reduzido a 47 linhas; `routers/` (9 arquivos), `services/` (3 arquivos), `dependencies.py`, `schemas.py` centralizados; Alembic configurado; autenticação migrada para token opaco SHA-256; endpoints atualizados (departamentos, categorias-relatorio, perfis); banco SQLite como padrão de desenvolvimento |

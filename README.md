# PCIA — Portal Corporativo de Inteligência Analítica

Portal web para centralizar relatórios **Power BI Embedded** com controle granular de permissões, auditoria completa e gestão de acesso corporativo.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estado auth | React Context (AuthContext) |
| Estado servidor | TanStack Query v5 |
| Formulários | React Hook Form + Yup |
| Backend | Python 3.12 + FastAPI |
| ORM | SQLAlchemy 2.0 (`mssql+pyodbc`) |
| **Banco de dados** | **Microsoft SQL Server 2019+ (on-premise)** |
| Autenticação | JWT HS256 (python-jose + bcrypt) |
| Servidor | uvicorn |
| PBI Embed | powerbi-client SDK (Microsoft) |

## Estrutura do Repositório

```
portal_analytcs_brasil_terrenos/
├── backend/                    # API Python + FastAPI
│   ├── main.py                 # Ponto de entrada — inicializa o FastAPI
│   ├── config.py               # Variáveis de ambiente (pydantic-settings)
│   ├── database.py             # Conexão SQLAlchemy com SQL Server
│   ├── models.py               # Modelos (tabelas) SQLAlchemy
│   ├── schemas.py              # Schemas de validação Pydantic
│   ├── auth.py                 # JWT e bcrypt
│   ├── dependencies.py         # Dependências reutilizáveis do FastAPI
│   ├── routers/                # Endpoints organizados por módulo
│   │   ├── auth.py             # POST /auth/entrar, /sair  GET /auth/eu
│   │   ├── usuarios.py         # CRUD usuários
│   │   ├── workspaces.py       # CRUD workspaces
│   │   ├── relatorios.py       # CRUD relatórios + favoritos
│   │   ├── permissoes.py       # Permissões por perfil
│   │   └── auditoria.py        # Logs de auditoria (somente leitura)
│   ├── requirements.txt        # Dependências Python
│   ├── .env.example            # Variáveis de ambiente (copiar para .env)
│   └── Dockerfile
│
├── frontend/                   # SPA React
│   ├── src/
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx # Estado de autenticação (useAuth)
│   │   ├── services/api.ts     # Axios com interceptor JWT
│   │   ├── styles/global.css   # Design system (tokens do protótipo)
│   │   ├── layouts/            # LayoutDashboard (sidebar + conteúdo)
│   │   ├── pages/              # Páginas da aplicação
│   │   ├── App.tsx             # Rotas lazy-loaded
│   │   └── main.tsx            # Entry point + QueryClient + AuthProvider
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf              # Config NGINX para servir SPA
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                       # Documentação técnica e de produto
├── prototipo/                  # Protótipo visual (portal_v4_8.html)
├── docker-compose.yml          # SQL Server local para desenvolvimento
└── .gitignore
```

## Início Rápido (Desenvolvimento Local)

### Pré-requisitos

| Software | Versão | Download |
|---|---|---|
| Python | 3.10+ | python.org/downloads |
| Node.js | 20 LTS | nodejs.org |
| SQL Server Developer | 2022+ | microsoft.com/sql-server |
| ODBC Driver 17 | — | aka.ms/odbc17 |
| SSMS (opcional) | — | aka.ms/ssmsfullsetup |

### 1. Configurar o banco de dados

**Opção A — SQL Server local instalado (recomendado para desenvolvimento):**

Abra o SSMS, conecte em `localhost\SQLEXPRESS` ou `localhost\SQLSERVER` e execute:
```sql
CREATE DATABASE btportal;
```

**Opção B — SQL Server via Docker:**
```powershell
docker compose up -d
```

**Opção C — SQL Server on-premise da empresa:**

Peça ao time de TI o endereço do servidor e credenciais de acesso.

### 2. Configurar variáveis de ambiente

```powershell
# Backend
copy backend\.env.example backend\.env
# Abra backend\.env e ajuste a DATABASE_URL para o seu SQL Server

# Frontend
copy frontend\.env.example frontend\.env
```

**`backend/.env` (exemplo para instalação local):**
```env
DATABASE_URL=mssql+pyodbc://@localhost\SQLEXPRESS/btportal?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes&trusted_connection=yes
JWT_SECRET_KEY=troque-por-uma-chave-longa-e-aleatoria
JWT_ALGORITMO=HS256
JWT_EXPIRA_MINUTOS=60
PORTA=3001
AMBIENTE=development
URL_FRONTEND=http://localhost:5173
```

### 3. Iniciar o backend

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```

### 4. Iniciar o frontend

Abra um segundo terminal:
```powershell
cd frontend
npm install
npm run dev
```

### 5. Acessar a aplicação

| URL | O que abre |
|---|---|
| http://localhost:5173 | Aplicação |
| http://localhost:3001/docs | Documentação interativa da API (Swagger) |
| http://localhost:3001/saude | Health check |

> **Primeiro acesso:** crie um usuário administrador diretamente pelo Swagger em `POST /api/v1/usuarios` após autenticar com um usuário seed (ver script de seed na documentação).

---

## Comandos Úteis

### Backend

```powershell
# Iniciar em modo desenvolvimento (hot-reload)
uvicorn main:app --reload --port 3001

# Instalar/atualizar dependências
pip install -r requirements.txt

# Verificar se a API está respondendo
curl http://localhost:3001/saude
```

### Frontend

```powershell
npm run dev          # Vite dev server com hot-reload
npm run build        # Build de produção
npm run lint         # ESLint
npm run type-check   # TypeScript sem emitir
npm run test         # Vitest (unitários)
npm run test:e2e     # Playwright (E2E)
```

---

## Variáveis de Ambiente

### Backend (`backend/.env`)

| Variável | Descrição | Obrigatório |
|----------|-----------|:-----------:|
| `DATABASE_URL` | Connection string SQL Server (formato pyodbc) | Sim |
| `JWT_SECRET_KEY` | Chave secreta para assinar tokens JWT | Sim |
| `JWT_ALGORITMO` | Algoritmo JWT (padrão: HS256) | Não |
| `JWT_EXPIRA_MINUTOS` | Tempo de expiração do token em minutos (padrão: 60) | Não |
| `PORTA` | Porta do servidor (padrão: 3001) | Não |
| `AMBIENTE` | development ou producao | Não |
| `URL_FRONTEND` | URL do frontend para CORS (padrão: http://localhost:5173) | Não |

**Formatos de DATABASE_URL:**
```env
# Autenticação Windows (sem usuário/senha) — recomendado para dev local
mssql+pyodbc://@localhost\SQLEXPRESS/btportal?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes&trusted_connection=yes

# Autenticação SQL (usuário/senha)
mssql+pyodbc://sa:Senha@localhost\SQLEXPRESS/btportal?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes

# Servidor on-premise da empresa
mssql+pyodbc://USUARIO:SENHA@SERVIDOR\INSTANCIA/btportal?driver=ODBC+Driver+17+for+SQL+Server
```

### Frontend (`frontend/.env`)

| Variável | Descrição |
|----------|-----------|
| `VITE_API_BASE_URL` | URL base da API (ex: `http://localhost:3001/api/v1`) |
| `VITE_NOME_APP` | Nome exibido na aba do browser |
| `VITE_AMBIENTE` | development ou production |

---

## Documentação

Acesse [`docs/README.md`](docs/README.md) para o índice completo.

| Pasta | Conteúdo |
|-------|---------|
| `docs/01-visao-geral/` | Contexto, objetivos, stakeholders |
| `docs/02-escopo/` | Escopo e módulos |
| `docs/03-requisitos/` | Requisitos funcionais, não-funcionais, restrições |
| `docs/04-priorizacao/` | MoSCoW e MVP |
| `docs/05-modelagem/` | Use cases, user stories, schema SQL Server |
| `docs/06-arquitetura/` | Arquitetura C4, RBAC, diagramas |
| `docs/07-estrategias/` | Segurança, escalabilidade, observabilidade |
| `docs/08-tecnologias/` | **Stack completa — Python + FastAPI + SQL Server** |
| `docs/09-roadmap/` | Fases de entrega |
| `prototipo/` | `portal_v4_8.html` — referência visual |

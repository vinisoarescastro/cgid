# Stack Tecnológica

> **Documento:** 08-tecnologias/01-stack-recomendada.md  
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Visão Geral da Stack

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│   React 19 + JavaScript + Vite 8 + React Router v7              │
│   sessionStorage + fetch/apiFetch + powerbi-client               │
│   CSS modular por página (sem framework CSS)                     │
└──────────────────────────────────────────────────────────────────┘
                              │ HTTP / REST (JSON)
┌──────────────────────────────────────────────────────────────────┐
│                          BACKEND                                  │
│   Python 3.12 + FastAPI + SQLAlchemy 2.0 + Pydantic v2          │
│   passlib/bcrypt + uvicorn + requests                            │
└──────────────────────────────────────────────────────────────────┘
                              │ SQLAlchemy ORM
┌──────────────────────────────────────────────────────────────────┐
│                       BANCO DE DADOS                              │
│   SQLite (desenvolvimento local — zero configuração)             │
│   SQL Server (produção corporativa — on-premise)                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Por que esta stack?

Este projeto é desenvolvido por uma pessoa em processo de aprendizado, com objetivo de colocar o portal em produção no ambiente corporativo. A stack foi escolhida com dois critérios simultâneos: **fácil de aprender** e **pronta para produção**.

| Critério | Decisão |
|---|---|
| Linguagem mais acessível para iniciantes | Python no backend |
| Framework web simples e com documentação excelente | FastAPI |
| Zero configuração em desenvolvimento | SQLite em vez de SQL Server |
| Migração transparente para produção | SQLAlchemy abstrai o banco — trocar SQLite por SQL Server exige mudar só a connection string |
| Estado de autenticação sem biblioteca extra | React Context nativo |
| HTTP sem dependência extra | fetch nativo do browser (sem Axios) |
| Sem complexidade desnecessária | Redis, BullMQ, TanStack Query e React Hook Form removidos da v1 |

---

## 3. Frontend

### 3.1 Tecnologias Core

| Tecnologia | Versão | Função |
|---|:---:|---|
| **React** | 19.x | Framework de interface |
| **JavaScript** | ES2022+ | Linguagem padrão do ecossistema Node/React |
| **Vite** | 8.x | Servidor de desenvolvimento e build |
| **React Router** | 7.x | Navegação entre páginas (sem recarregar o browser) |
| **powerbi-client** | 2.x | SDK oficial para renderização inline de relatórios Power BI |

### 3.2 Gerenciamento de Estado

| Recurso | Função |
|---|---|
| **sessionStorage** | Guarda os dados do usuário logado entre navegações |
| **useState** local | Estado de formulários, loading, erro e UI de cada componente |
| **useEffect + fetch** | Busca dados da API ao montar cada página |

> **Por que não TanStack Query?** Foi removido para simplificar. O `useEffect + fetch` cobre os casos de uso da v1 sem adicionar dependências. TanStack Query pode ser adicionado futuramente quando o volume de chamadas e o cache se tornarem complexos.

### 3.3 Formulários e Validação

A v1 usa validação manual com `useState` diretamente nos componentes de formulário. Sem React Hook Form nem Yup na v1 — a complexidade não é necessária ainda.

### 3.4 Estrutura de Arquivos (Frontend)

```
frontend/src/
├── pages/
│   ├── LoginPage.jsx        ← tela de login com chamada ao POST /login
│   ├── HomePage.jsx         ← home com KPIs, eventos, workspaces e expediente
│   ├── UsersPage.jsx        ← gestão de usuários e acessos
│   ├── WorkspacePage.jsx    ← workspaces, relatórios, permissões e embed
│   ├── FavoritosPage.jsx    ← favoritos pessoais agrupados por workspace
│   ├── AuditPage.jsx        ← auditoria com filtros, paginação e CSV
│   └── SettingsPage.jsx     ← expediente, grupos de exceção e credenciais PBI
├── styles/
│   ├── global.css           ← design tokens, reset, tipografia (Plus Jakarta Sans)
│   ├── login.css            ← estilos da tela de login
│   ├── home.css             ← estilos do app shell: sidebar, topbar, cards, tabelas
│   ├── users.css            ← estilos da gestão de usuários
│   ├── workspace.css        ← estilos de workspaces, relatórios e favoritos
│   ├── audit.css            ← estilos da auditoria
│   └── settings.css         ← estilos das configurações
├── routes/
│   └── AppRoutes.jsx        ← definição de rotas + componente PrivateRoute
├── components/
│   ├── Avatar.jsx           ← exibe foto de perfil ou iniciais do nome/email
│   ├── IconPicker.jsx       ← seletor visual de ícone para workspace
│   └── VisualizadorRelatorio.jsx ← modal de embed Power BI
├── utils/
│   └── api.js               ← helper fetch com JSON e X-Usuario-Id
├── assets/
│   ├── logo-bt-branco.png
│   ├── logo-bt-colorido.png
│   ├── logo-sidebar-full.png   ← logo exibida na sidebar expandida
│   └── logo-sidebar-icon.png   ← ícone exibido na sidebar colapsada
├── App.jsx                  ← monta BrowserRouter + AppRoutes
└── main.jsx                 ← ponto de entrada, importa global.css
```

### 3.5 Design System

O projeto usa um design system próprio baseado em variáveis CSS, sem dependência de biblioteca de componentes (Headless UI, Radix, etc.):

| Token | Exemplo |
|---|---|
| Paleta brand (verde) | `--brand-50` a `--brand-950` |
| Paleta gray (neutro) | `--gray-0` a `--gray-950` |
| Semânticas | `--warning-*`, `--danger-*`, `--info-*` |
| Raios | `--r-sm`, `--r-md`, `--r-lg`, `--r-xl` |
| Sombras | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Transições | `--t-fast`, `--t-base`, `--t-slow` |

---

## 4. Backend

### 4.1 Tecnologias Core

| Tecnologia | Versão | Função |
|---|:---:|---|
| **Python** | 3.12 | Linguagem principal do backend |
| **FastAPI** | 0.115+ | Framework web — cria endpoints REST com validação automática |
| **uvicorn** | 0.31+ | Servidor ASGI que roda o FastAPI |
| **SQLAlchemy** | 2.0 | ORM — traduz código Python em SQL |
| **Pydantic v2** | 2.x | Validação e serialização de dados (integrado ao FastAPI) |
| **requests** | 2.x | Chamadas HTTP para Azure AD e Power BI REST API |

### 4.2 Autenticação e Segurança

| Biblioteca | Função |
|---|---|
| **passlib + bcrypt** | Hash seguro de senhas |

> JWT (python-jose) será implementado no Sprint 1-2. Na v1 atual, a sessão do usuário é mantida via `sessionStorage` no frontend.

### 4.3 Estrutura de Arquivos (Backend)

```
backend/
├── main.py        ← FastAPI app, CORS, todos os endpoints
├── .env.example   ← variáveis Power BI Embedded (Service Principal)
├── database.py    ← conexão SQLite + engine + SessionLocal + get_db
├── models.py      ← 14 tabelas do banco (classes SQLAlchemy)
├── schemas.py     ← schemas Pydantic de entrada e saída
├── seed.py        ← cria tabelas e insere dados iniciais
└── cgid.db        ← arquivo do banco SQLite (gerado pelo seed.py)
```

### 4.4 Endpoints Disponíveis

| Método | Endpoint | Função |
|---|---|---|
| GET | `/` | Health check |
| POST | `/login` | Autenticação com e-mail e senha |
| GET | `/dashboard/kpis` | Contadores: usuários ativos, bloqueados, acessos negados, workspaces |
| GET | `/dashboard/eventos` | Últimos 5 registros do log de auditoria |
| GET | `/dashboard/workspaces` | Workspaces com contagem de relatórios e acessos |
| GET | `/dashboard/expediente` | Status atual do expediente calculado no servidor |
| GET/POST/PUT/DELETE | `/usuarios` e subrotas | CRUD, reset de senha, acessos e favoritos |
| GET/POST/PUT/PATCH/DELETE | `/workspaces` e subrotas | CRUD, arquivamento, usuários, relatórios e permissões específicas |
| GET | `/relatorios/{id}/embed` | Geração de embed URL e token Power BI |
| GET/PUT/POST/DELETE | `/configuracoes/*` | Expediente, grupos de exceção, membros e credenciais PBI |
| GET | `/auditoria`, `/auditoria/export-csv`, `/auditoria/tipos`, `/auditoria/modulos` | Logs, filtros, exportação e metadados de auditoria |

---

## 5. Banco de Dados

### 5.1 SQLite (Desenvolvimento)

| Item | Detalhe |
|---|---|
| **Arquivo** | `backend/cgid.db` |
| **Criação** | `python seed.py` — cria tabelas e insere dados |
| **Driver Python** | `sqlite3` (nativo do Python, sem instalação) |
| **ORM** | SQLAlchemy 2.0 com dialeto `sqlite` |
| **Connection string** | `sqlite:///./cgid.db` |

### 5.2 SQL Server (Produção)

| Item | Detalhe |
|---|---|
| **Versão** | SQL Server on-premise corporativo |
| **Driver Python** | pyodbc + ODBC Driver 17 for SQL Server |
| **ORM** | SQLAlchemy 2.0 com dialeto `mssql+pyodbc` |
| **Migração** | Alterar apenas `DATABASE_URL` em `database.py` |

### 5.3 Tabelas do banco

| Tabela | Conteúdo |
|---|---|
| `usuarios` | Contas de acesso ao portal |
| `sessoes_autenticacao` | Sessões, refresh tokens e revogação |
| `espacos_trabalho` | Workspaces (agrupamentos de relatórios) |
| `relatorios` | Relatórios Power BI cadastrados |
| `acessos_workspace` | Permissão de usuário por workspace |
| `acessos_relatorio` | Permissão de usuário por relatório específico |
| `permissoes_perfil` | Matriz de permissões por perfil (RBAC) |
| `sobrescritas_permissao` | Exceções de permissão por usuário |
| `regras_expediente` | Horários de acesso permitidos por dia da semana |
| `grupos_excecao` | Grupos com acesso fora do expediente |
| `membros_grupo_excecao` | Membros dos grupos de exceção |
| `favoritos` | Relatórios favoritos por usuário |
| `logs_auditoria` | Registro imutável de todas as ações |
| `configuracoes_sistema` | Parâmetros globais do sistema |

### 5.4 Perfis de usuário

| Perfil | Valor no banco | Nível de acesso |
|---|---|---|
| Super Administrador | `super_administrador` | Acesso total, incluindo configurações |
| Administrador | `administrador` | Gerencia usuários, workspaces e permissões |
| Gerente | `gerente` | Visualiza relatórios e KPIs do seu workspace |
| Operador | `operador` | Acessa relatórios explicitamente liberados |
| Visitante | `visitante` | Acesso mínimo e temporário |

### 5.5 Mapeamento de Tipos Python → SQL

| Tipo SQLAlchemy | SQLite | SQL Server |
|---|---|---|
| `String(N)` | `VARCHAR(N)` | `NVARCHAR(N)` |
| `Text` | `TEXT` | `NVARCHAR(MAX)` |
| `Boolean` | `BOOLEAN` | `BIT` |
| `SmallInteger` | `SMALLINT` | `SMALLINT` |
| `DateTime` | `DATETIME` | `DATETIME2` |
| `Time` | `TIME` | `TIME` |

---

## 6. Ambiente de Desenvolvimento

### 6.1 Pré-requisitos

| Software | Versão mínima | Download |
|---|---|---|
| Python | 3.12+ | python.org/downloads |
| Node.js | 20 LTS | nodejs.org |

### 6.2 Iniciar o projeto

**Terminal 1 — Backend:**
```powershell
cd backend
pip install fastapi uvicorn sqlalchemy passlib bcrypt pydantic requests
python seed.py
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

| URL | O que abre |
|---|---|
| `http://localhost:5173` | Aplicação (frontend) |
| `http://localhost:8000/docs` | Documentação interativa da API (Swagger) |

### 6.3 Credenciais de desenvolvimento

| E-mail | Senha | Perfil |
|---|---|---|
| admin@cgid.com | Admin@2025 | Super Administrador |
| carlos@cgid.com | Carlos@123 | Gerente |
| mariana@cgid.com | Mariana@123 | Operador |
| visitante@cgid.com | Visitante@123 | Visitante |

---

## 7. Caminho de Evolução

| Fase | O que adicionar | Quando |
|---|---|---|
| **v1 (atual)** | Backend Python + FastAPI, frontend React funcional, SQLite, auditoria, configurações, favoritos e Power BI Embedded | Agora |
| **Sprint 1-2** | JWT + refresh token, guards FastAPI, AuthContext | Próxima sprint |
| **v1.1** | Migrar para SQL Server, notificações por e-mail, testes automatizados | Após estabilizar a v1 |
| **v1.2** | Renovação automática de embed token e sincronização PBI | Após v1.1 |
| **v2** | SSO via Azure AD, Redis para cache | Quando for para produção |

---

## 8. Resumo da Stack

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 19 + JavaScript + Vite 8 |
| **Roteamento** | React Router v7 |
| **Estado de autenticação** | sessionStorage → AuthContext (Sprint 1-2) |
| **HTTP** | fetch nativo |
| **Backend** | Python 3.12 + FastAPI |
| **ORM** | SQLAlchemy 2.0 |
| **Banco (dev)** | SQLite |
| **Banco (prod)** | SQL Server on-premise |
| **Senhas** | passlib + bcrypt |
| **Power BI** | powerbi-client + Power BI REST API via requests |
| **Servidor** | uvicorn |

---

## Histórico de Alterações

| Versão | Data | Autor |  Descrição |
|---|---|---|---|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial com stack NestJS + Prisma + Redis |
| 2.0 | Maio/2026 | Vinicius Soares | Migração para Python + FastAPI + SQLAlchemy; remoção de Redis e BullMQ; simplificação do frontend |
| 3.0 | Maio/2026 | Vinicius Soares | Atualização para estado real do projeto: React 19, Vite 8, React Router v7, SQLite como banco de desenvolvimento, remoção de TanStack Query/Axios/React Hook Form/Yup, estrutura de pastas atualizada (pages/, styles/, routes/, components/), endpoints de dashboard implementados |
| 3.1 | Junho/2026 | Vinicius Soares | Inclusão de powerbi-client, requests, páginas Favoritos/Auditoria/Configurações, utilitário apiFetch e endpoints de Power BI, auditoria, favoritos e configurações |

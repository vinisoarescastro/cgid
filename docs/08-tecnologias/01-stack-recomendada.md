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
│   React 18 + TypeScript + Vite + TanStack Query                  │
│   React Context (auth) + React Router v6 + Axios                 │
│   React Hook Form + Yup + powerbi-client SDK                     │
└──────────────────────────────────────────────────────────────────┘
                              │ HTTP / REST (JSON)
┌──────────────────────────────────────────────────────────────────┐
│                          BACKEND                                  │
│   Python 3.12 + FastAPI + SQLAlchemy 2.0 + Pydantic v2          │
│   python-jose (JWT HS256) + passlib/bcrypt + uvicorn             │
└──────────────────────────────────────────────────────────────────┘
                              │ pyodbc
┌──────────────────────────────────────────────────────────────────┐
│                       BANCO DE DADOS                              │
│   SQL Server (Developer local / on-premise corporativo)          │
│   ODBC Driver 17 for SQL Server                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Por que esta stack?

Este projeto é desenvolvido por uma pessoa em processo de aprendizado, com objetivo de colocar o portal em produção no ambiente corporativo. A stack foi escolhida com dois critérios simultâneos: **fácil de aprender** e **pronta para produção**.

| Critério | Decisão |
|---|---|
| Linguagem mais acessível para iniciantes | Python no backend |
| Framework web simples e com documentação excelente | FastAPI |
| Banco obrigatório pelo ambiente corporativo | SQL Server |
| Estado de autenticação sem biblioteca extra | React Context nativo |
| Validação de formulários mais legível | Yup (sintaxe mais direta que Zod) |
| Sem complexidade desnecessária | Redis e BullMQ removidos da v1 |

---

## 3. Frontend

### 3.1 Tecnologias Core

| Tecnologia | Versão | Função |
|---|:---:|---|
| **React** | 18.x | Framework de interface |
| **TypeScript** | 5.x | Tipagem estática — detecta erros antes de rodar |
| **Vite** | 5.x | Servidor de desenvolvimento e build |
| **React Router** | 6.x | Navegação entre páginas (sem recarregar o browser) |

### 3.2 Gerenciamento de Estado

| Biblioteca | Função |
|---|---|
| **React Context** (`AuthContext`) | Estado do usuário logado — nativo do React, sem dependência extra |
| **TanStack Query** v5 | Busca de dados da API: cache automático, loading, erro, refetch |
| **useState** local | Estado de formulários e UI específicos de cada componente |

> **Por que não Zustand?** Foi removido para simplificar. O React Context cobre o único caso de estado global necessário na v1 (autenticação). Zustand pode ser adicionado futuramente se o projeto crescer.

### 3.3 Formulários e Validação

| Biblioteca | Função |
|---|---|
| **React Hook Form** | Gerencia campos, erros e envio do formulário |
| **Yup** | Define as regras de validação de forma declarativa |
| **@hookform/resolvers** | Conecta o Yup ao React Hook Form |

**Exemplo de uso:**
```typescript
const esquema = yup.object({
  email: yup.string().email('Email inválido').required('Obrigatório'),
  senha: yup.string().min(6, 'Mínimo 6 caracteres').required('Obrigatório'),
});
```

### 3.4 Outras Bibliotecas

| Biblioteca | Função |
|---|---|
| **Axios** | Chamadas HTTP para a API com interceptor de token JWT |
| **React Hot Toast** | Notificações de sucesso e erro |
| **TanStack Table** | Tabelas com ordenação e filtros |
| **Headless UI** | Componentes acessíveis (modais, dropdowns) |
| **powerbi-client** | Embed de relatórios Power BI (v1.1) |

### 3.5 Estrutura de Arquivos (Frontend)

```
frontend/src/
├── contexts/
│   └── AuthContext.tsx       ← estado do usuário logado (useAuth)
├── services/
│   └── api.ts                ← cliente Axios com token JWT automático
├── layouts/
│   └── LayoutDashboard.tsx   ← barra lateral + área de conteúdo
├── pages/
│   ├── auth/
│   │   └── PaginaLogin.tsx
│   ├── dashboard/
│   │   └── PaginaDashboard.tsx
│   ├── relatorios/
│   │   └── PaginaVisualizacaoRelatorio.tsx
│   ├── admin/
│   │   ├── PaginaUsuarios.tsx
│   │   ├── PaginaWorkspaces.tsx
│   │   ├── PaginaPermissoes.tsx
│   │   ├── PaginaLogsAuditoria.tsx
│   │   ├── PaginaExpediente.tsx
│   │   └── PaginaConfiguracoes.tsx
│   └── PaginaNaoEncontrada.tsx
├── App.tsx                   ← definição de rotas
└── main.tsx                  ← ponto de entrada
```

---

## 4. Backend

### 4.1 Tecnologias Core

| Tecnologia | Versão | Função |
|---|:---:|---|
| **Python** | 3.12 | Linguagem principal do backend |
| **FastAPI** | 0.115 | Framework web — cria endpoints REST com validação automática |
| **uvicorn** | 0.31 | Servidor ASGI que roda o FastAPI |
| **SQLAlchemy** | 2.0 | ORM — traduz código Python em SQL |
| **Pydantic v2** | 2.9 | Validação e serialização de dados (integrado ao FastAPI) |
| **pydantic-settings** | 2.6 | Leitura tipada das variáveis do arquivo `.env` |

### 4.2 Autenticação e Segurança

| Biblioteca | Função |
|---|---|
| **python-jose** | Criação e validação de tokens JWT (algoritmo HS256) |
| **passlib + bcrypt** | Hash seguro de senhas |
| **pyodbc** | Driver de conexão Python → SQL Server |

**Como funciona a autenticação:**
1. Usuário envia `email` + `senha` para `POST /api/v1/auth/entrar`
2. Backend verifica a senha com bcrypt
3. Gera um token JWT assinado com a chave secreta (`JWT_SECRET_KEY`)
4. Frontend armazena o token no `localStorage` com a chave `token_acesso`
5. Cada requisição subsequente envia o token no header `Authorization: Bearer <token>`
6. O FastAPI valida o token automaticamente via a dependência `obter_usuario_atual`

### 4.3 Estrutura de Arquivos (Backend)

```
backend/
├── main.py           ← inicializa o FastAPI, CORS, registra roteadores
├── config.py         ← lê variáveis do .env com tipagem (pydantic-settings)
├── database.py       ← cria a conexão com o SQL Server (engine + sessão)
├── models.py         ← define as tabelas do banco (classes SQLAlchemy)
├── schemas.py        ← define o formato dos dados de entrada e saída (Pydantic)
├── auth.py           ← funções de JWT e bcrypt
├── dependencies.py   ← funções reutilizáveis: obter_db, obter_usuario_atual, exigir_perfil
├── routers/
│   ├── auth.py       ← POST /auth/entrar, POST /auth/sair, GET /auth/eu
│   ├── usuarios.py   ← CRUD de usuários
│   ├── workspaces.py ← CRUD de workspaces + concessão de acesso
│   ├── relatorios.py ← CRUD de relatórios + favoritos
│   ├── permissoes.py ← leitura e edição de permissões por perfil
│   └── auditoria.py  ← consulta read-only de logs de auditoria
├── requirements.txt  ← lista de dependências Python
├── .env.example      ← modelo do arquivo de configuração
└── Dockerfile        ← imagem Docker do backend
```

### 4.4 Endpoints Disponíveis (v1)

| Método | Endpoint | Função |
|---|---|---|
| POST | `/api/v1/auth/entrar` | Login |
| POST | `/api/v1/auth/sair` | Logout |
| GET | `/api/v1/auth/eu` | Dados do usuário logado |
| GET | `/api/v1/usuarios` | Listar usuários |
| POST | `/api/v1/usuarios` | Criar usuário |
| PUT | `/api/v1/usuarios/{id}` | Atualizar usuário |
| DELETE | `/api/v1/usuarios/{id}` | Desativar usuário |
| GET | `/api/v1/workspaces` | Listar workspaces |
| POST | `/api/v1/workspaces` | Criar workspace |
| PUT | `/api/v1/workspaces/{id}` | Atualizar workspace |
| DELETE | `/api/v1/workspaces/{id}` | Arquivar workspace |
| POST | `/api/v1/workspaces/{id}/acesso` | Conceder acesso |
| GET | `/api/v1/relatorios` | Listar relatórios |
| POST | `/api/v1/relatorios` | Criar relatório |
| PUT | `/api/v1/relatorios/{id}` | Atualizar relatório |
| DELETE | `/api/v1/relatorios/{id}` | Arquivar relatório |
| POST | `/api/v1/relatorios/{id}/favorito` | Adicionar/remover favorito |
| GET | `/api/v1/permissoes` | Listar permissões |
| PUT | `/api/v1/permissoes/{id}` | Atualizar permissão |
| GET | `/api/v1/auditoria` | Consultar logs |
| GET | `/saude` | Health check |

> A documentação interativa completa fica disponível em `http://localhost:3001/docs` enquanto o servidor estiver rodando em modo `development`.

---

## 5. Banco de Dados

### 5.1 SQL Server

| Item | Detalhe |
|---|---|
| **Versão desenvolvimento** | SQL Server 2022/2025 Developer Edition (local, gratuito) |
| **Versão produção** | SQL Server on-premise do servidor corporativo |
| **Driver Python** | pyodbc + ODBC Driver 17 for SQL Server |
| **ORM** | SQLAlchemy 2.0 com dialeto `mssql+pyodbc` |

### 5.2 String de Conexão

```
# Desenvolvimento local (Autenticação Windows — sem usuário/senha)
mssql+pyodbc://@localhost\SQLEXPRESS/btportal?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes&trusted_connection=yes

# Produção (servidor da empresa)
mssql+pyodbc://USUARIO:SENHA@SERVIDOR\INSTANCIA/btportal?driver=ODBC+Driver+17+for+SQL+Server
```

### 5.3 Tabelas do banco (em português)

| Tabela | Conteúdo |
|---|---|
| `usuarios` | Contas de acesso ao portal |
| `espacos_trabalho` | Agrupamentos de relatórios (Workspaces) |
| `relatorios` | Relatórios Power BI cadastrados |
| `acessos_workspace` | Qual usuário acessa qual workspace |
| `acessos_relatorio` | Acesso explícito a relatório específico |
| `permissoes_perfil` | Permissões padrão por perfil (RBAC) |
| `sobrescritas_permissao` | Exceções de permissão por usuário |
| `regras_expediente` | Horários de acesso permitidos |
| `grupos_excecao` | Grupos com acesso fora do expediente |
| `membros_grupo_excecao` | Usuários em grupos de exceção |
| `favoritos` | Relatórios favoritos por usuário |
| `logs_auditoria` | Registro imutável de todas as ações |
| `configuracoes_sistema` | Parâmetros globais do sistema |

### 5.4 Perfis de usuário

| Perfil | Valor no banco | Nível de acesso |
|---|---|---|
| Super Administrador | `super_administrador` | Acesso total |
| Administrador | `administrador` | Gerencia usuários e conteúdo |
| Gerente | `gerente` | Visualiza usuários, não altera permissões |
| Operador | `operador` | Acessa relatórios liberados |
| Visitante | `visitante` | Acesso mínimo |


### 5.5 Mapeamento de Tipos Python → SQL Server

| Tipo SQLAlchemy | Tipo SQL Server | Observação |
|---|---|---|
| `String(N)` | `NVARCHAR(N)` | Use para campos com tamanho definido |
| `Text` | `NVARCHAR(MAX)` | Use para textos longos |
| `Boolean` | `BIT` | Mapeado automaticamente |
| `Integer` | `INT` | — |
| `DateTime` | `DATETIME2` | Armazenar sempre em UTC |
| `UNIQUEIDENTIFIER` | `UNIQUEIDENTIFIER` | Chaves primárias UUID |

---

## 6. Ambiente de Desenvolvimento

### 6.1 Pré-requisitos

| Software | Versão mínima | Download |
|---|---|---|
| Python | 3.10+ | python.org/downloads |
| Node.js | 20 LTS | nodejs.org |
| SQL Server Developer | 2022+ | microsoft.com/sql-server |
| ODBC Driver 17 | — | aka.ms/odbc17 |
| SSMS (opcional) | — | aka.ms/ssmsfullsetup |

### 6.2 Iniciar o projeto

**Terminal 1 — Backend:**
```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
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
| `http://localhost:3001/docs` | Documentação interativa da API (Swagger) |
| `http://localhost:3001/saude` | Health check da API |

### 6.3 Variáveis de ambiente

**`backend/.env`**
```env
DATABASE_URL=mssql+pyodbc://@localhost\SQLEXPRESS/btportal?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes&trusted_connection=yes
JWT_SECRET_KEY=troque-por-uma-chave-longa-e-aleatoria
JWT_ALGORITMO=HS256
JWT_EXPIRA_MINUTOS=60
PORTA=3001
AMBIENTE=development
URL_FRONTEND=http://localhost:5173
```

**`frontend/.env`**
```env
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_NOME_APP=Portal Analítico
VITE_AMBIENTE=development
```

---

## 7. Caminho de Evolução

A stack foi pensada para crescer gradualmente conforme o desenvolvedor ganha confiança:

| Fase | O que adicionar | Quando |
|---|---|---|
| **v1 (atual)** | Backend Python + FastAPI, frontend React funcional | Agora |
| **v1.1** | Notificações por email (SMTP), exportação CSV | Após dominar a v1 |
| **v1.2** | Power BI Embedded com token real | Após v1.1 |
| **v2** | Migrar para servidor da empresa, Redis para cache | Quando for para produção |
| **Futuro** | Avaliar migração do backend para NestJS/TypeScript | Se o time crescer |

---

## 8. Resumo da Stack

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Estado de autenticação** | React Context (AuthContext) |
| **Estado de dados da API** | TanStack Query v5 |
| **Formulários** | React Hook Form + Yup |
| **HTTP** | Axios |
| **Backend** | Python 3.12 + FastAPI |
| **ORM** | SQLAlchemy 2.0 |
| **Banco de dados** | SQL Server (Developer local → on-premise em produção) |
| **Autenticação** | JWT HS256 (python-jose + bcrypt) |
| **Servidor** | uvicorn |

---

## Histórico de Alterações

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | Maio/2026 | Criação inicial com stack NestJS + Prisma + Redis |
| 2.0 | Maio/2026 | Migração para Python + FastAPI + SQLAlchemy; remoção de Redis e BullMQ; simplificação do frontend (React Context substituindo Zustand, Yup substituindo Zod); todos os nomes em Português do Brasil |

# Arquitetura Geral do Sistema

> **Documento:** 06-arquitetura/01-arquitetura-geral.md  
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Visão Geral da Arquitetura (C4 — Nível 1: Contexto)

```
                      ┌─────────────────────────────────┐
                      │                                 │
    [Colaborador]──▶ │   BrasilTerrenos                │──▶ [Power BI Service]
    [Gerente]    ──▶ │   Portal Corporativo            │
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
│  │  (Frontend)    │  + JWT Bearer   │                          │     │
│  │  TypeScript    │                 │   Módulos (roteadores):  │     │
│  │  Vite          │                 │   - auth.py              │     │
│  │  TanStack Query│                 │   - usuarios.py          │     │
│  │  React Context │                 │   - workspaces.py        │     │
│  │  powerbi-client│                 │   - relatorios.py        │     │
│  └────────────────┘                 │   - permissoes.py        │     │
│                                     │   - auditoria.py         │     │
│                                     └──────────────┬───────────┘     │
│                                                   │ pyodbc            │
│                                     ┌─────────────▼──────────────┐   │
│                                     │  SQL Server (on-premise)   │   │
│                                     │  ODBC Driver 17            │   │
│                                     │  SQLAlchemy 2.0            │   │
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
| Framework | React 18 + TypeScript | Componentização, tipagem |
| Build | Vite | Bundling, HMR, otimização |
| Roteamento | React Router v6 | Navegação client-side |
| Estado servidor | TanStack Query v5 | Cache de dados, fetch, loading states |
| Estado de autenticação | React Context (AuthContext) | Usuário logado, token, funções entrar/sair |
| Formulários | React Hook Form + Yup | Validação declarativa de formulários |
| PBI Embed | powerbi-client (SDK oficial) | Renderização inline de relatórios |
| HTTP | Axios + interceptors | Chamadas à API; envio automático do token JWT |

**Regras do Frontend:**
- Sem lógica de negócio crítica no cliente
- Toda validação de segurança ocorre no backend (RBAC, permissões)
- Token JWT armazenado no `localStorage` com a chave `token_acesso`
- Em caso de 401 (token inválido/expirado): remove token e redireciona para `/login`

---

### 3.2 Backend — API (Python + FastAPI)

**Responsabilidade:** Toda a lógica de negócio, autenticação, autorização, integração PBI e persistência.

**Estrutura de arquivos:**

```
backend/
├── main.py           ← inicializa o FastAPI, CORS, registra roteadores
├── config.py         ← lê variáveis do .env com tipagem (pydantic-settings)
├── database.py       ← cria a conexão com o SQL Server (engine + sessão)
├── models.py         ← define as tabelas do banco (classes SQLAlchemy)
├── schemas.py        ← define o formato dos dados de entrada e saída (Pydantic)
├── auth.py           ← funções de JWT e bcrypt
├── dependencies.py   ← funções reutilizáveis: obter_db, obter_usuario_atual, exigir_perfil
└── routers/
    ├── auth.py       ← POST /auth/entrar, POST /auth/sair, GET /auth/eu
    ├── usuarios.py   ← CRUD de usuários
    ├── workspaces.py ← CRUD de workspaces + concessão de acesso
    ├── relatorios.py ← CRUD de relatórios + favoritos
    ├── permissoes.py ← leitura e edição de permissões por perfil
    └── auditoria.py  ← consulta read-only de logs de auditoria
```

**Pipeline de uma requisição autenticada:**

```
Request
  → CORS (verificação de origem)
  → Roteador FastAPI
  → Depends(obter_usuario_atual) — valida Bearer token, carrega usuário
  → Depends(exigir_perfil(...)) — verifica se o perfil tem acesso
  → Validação Pydantic (schemas de entrada)
  → Função de rota → banco via SQLAlchemy
  → Resposta Pydantic (serialização automática)
Response
```

---

### 3.3 Banco de Dados (SQL Server)

- SQL Server Developer Edition para desenvolvimento local (gratuito, sem limitações)
- SQL Server on-premise da empresa para produção
- Conexão via `pyodbc` + `ODBC Driver 17 for SQL Server`
- ORM: SQLAlchemy 2.0 com dialeto `mssql+pyodbc`
- Tabela `logs_auditoria` com trigger `INSTEAD OF` que impede UPDATE e DELETE
- Índices nas colunas de busca mais frequentes

**Criação das tabelas:**
```python
# Em database.py — cria todas as tabelas definidas em models.py
Base.metadata.create_all(bind=engine)
```

---

## 4. Autenticação

### Fluxo de Tokens

```
Login bem-sucedido:
  token_acesso → JWT HS256, 60 minutos, retornado no body

A cada requisição:
  Authorization: Bearer <token_acesso>

Logout:
  POST /api/v1/auth/sair
  → Registro no log de auditoria
  → Frontend remove 'token_acesso' do localStorage

Expiração:
  → Backend retorna 401
  → Frontend remove token e redireciona para /login
```

### Estrutura do JWT (token_acesso)

```json
{
  "sub": "uuid-do-usuario",
  "exp": 1700003600
}
```

### Dependências FastAPI

```python
# dependencies.py

def obter_db():
    banco = SessionLocal()
    try:
        yield banco
    finally:
        banco.close()

def obter_usuario_atual(credenciais, banco):
    # Valida Bearer token → retorna objeto Usuario
    payload = decodificar_token(credenciais.credentials)
    usuario = banco.query(Usuario).filter(Usuario.id == payload["sub"]).first()
    return usuario

def exigir_perfil(*perfis):
    # Retorna uma dependência que verifica se usuario.perfil está nos perfis permitidos
    def verificador(usuario = Depends(obter_usuario_atual)):
        if usuario.perfil not in perfis:
            raise HTTPException(status_code=403)
        return usuario
    return verificador
```

---

## 5. API REST — Endpoints Disponíveis (v1)

### Autenticação
```
POST   /api/v1/auth/entrar     → { token_acesso, tipo_token, perfil, nome }
POST   /api/v1/auth/sair       → 200
GET    /api/v1/auth/eu         → dados do usuário logado
```

### Usuários
```
GET    /api/v1/usuarios        → listagem de usuários
POST   /api/v1/usuarios        → criar usuário
PUT    /api/v1/usuarios/{id}   → atualizar usuário
DELETE /api/v1/usuarios/{id}   → desativar usuário (soft delete)
```

### Workspaces
```
GET    /api/v1/workspaces              → listar workspaces acessíveis
POST   /api/v1/workspaces             → criar workspace
PUT    /api/v1/workspaces/{id}        → atualizar workspace
DELETE /api/v1/workspaces/{id}        → arquivar workspace
POST   /api/v1/workspaces/{id}/acesso → conceder acesso ao workspace
```

### Relatórios
```
GET    /api/v1/relatorios              → listar relatórios
POST   /api/v1/relatorios             → criar relatório
PUT    /api/v1/relatorios/{id}        → atualizar relatório
DELETE /api/v1/relatorios/{id}        → arquivar relatório
POST   /api/v1/relatorios/{id}/favorito → adicionar/remover favorito
```

### Permissões
```
GET    /api/v1/permissoes      → listar permissões por perfil
PUT    /api/v1/permissoes/{id} → atualizar permissão
```

### Auditoria
```
GET    /api/v1/auditoria       → consultar logs (filtros: tipo_evento, modulo, email_usuario, datas)
```

### Sistema
```
GET    /saude                  → health check → { "situacao": "operacional" }
```

---

## 6. Variáveis de Ambiente

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

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento (stack NestJS) |
| 2.0 | Maio/2026 | — | Reescrita completa: migração para Python + FastAPI, SQL Server, remoção de Redis e BullMQ, nomes em Português |

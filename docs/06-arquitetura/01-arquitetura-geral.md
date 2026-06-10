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
│  │  (Frontend)    │  JSON/fetch     │                          │     │
│  │  JavaScript    │                 │   main.py:               │     │
│  │  Vite          │                 │   - auth/login           │     │
│  │  sessionStorage│                 │   - usuarios             │     │
│  │  apiFetch      │                 │   - workspaces           │     │
│  │  powerbi-client│                 │   - relatorios           │     │
│  └────────────────┘                 │   - configuracoes        │     │
│                                     │   - auditoria            │     │
│                                     └──────────────┬───────────┘     │
│                                                   │ pyodbc           │
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

**Estrutura de arquivos:**

```
backend/
├── main.py           ← inicializa o FastAPI, CORS e endpoints do protótipo
├── .env.example      ← exemplo de variáveis Power BI Embedded
├── database.py       ← cria a conexão SQLite/SQL Server (engine + sessão)
├── models.py         ← define as tabelas do banco (classes SQLAlchemy)
├── schemas.py        ← define o formato dos dados de entrada e saída (Pydantic)
└── seed.py           ← cria tabelas e insere dados iniciais
```

**Pipeline de uma requisição autenticada:**

```
Request
  → CORS (verificação de origem)
  → Rota FastAPI em main.py
  → Validação Pydantic (schemas de entrada)
  → Função de rota → banco via SQLAlchemy
  → registrar_log(...) quando a ação é auditável
  → Resposta Pydantic (serialização automática)
Response
```

> Observação: autenticação forte via JWT, guards FastAPI e roteadores separados são a direção arquitetural futura. O estado atual do protótipo usa rotas diretas e sessão de usuário no frontend.

---

### 3.3 Banco de Dados (SQL Server)

- SQL Server Developer Edition para desenvolvimento local (gratuito, sem limitações)
- SQL Server on-premise da empresa para produção
- Conexão via `pyodbc` + `ODBC Driver 17 for SQL Server`
- ORM: SQLAlchemy 2.0 com dialeto `mssql+pyodbc`
- Tabela `logs_auditoria` com trigger `INSTEAD OF` que impede UPDATE e DELETE
- Tabela `sessoes_autenticacao` para refresh tokens, rotação e revogação de sessão
- Índices nas colunas de busca mais frequentes

**Criação das tabelas:**
```python
# Em database.py — cria todas as tabelas definidas em models.py
Base.metadata.create_all(bind=engine)
```

---

## 4. Autenticação

### Estado Atual

O protótipo autentica com `POST /login`, valida e-mail/senha com hash bcrypt, atualiza `ultimo_login`, zera tentativas em caso de sucesso e incrementa/bloqueia o usuário após falhas consecutivas. O frontend guarda os dados retornados em `sessionStorage` e protege rotas com `PrivateRoute`.

Para auditoria de ações administrativas, o frontend envia `X-Usuario-Id` pelo helper `apiFetch`; o backend usa esse header apenas para identificar o autor do log (`registrar_log`). Esse header não deve ser tratado como mecanismo definitivo de autorização em produção.

### Alvo Futuro: Fluxo de Tokens

```
Login bem-sucedido:
  token_acesso → JWT HS256, 60 minutos, retornado no body
  refresh_token → valor opaco, 24 horas, salvo em cookie httpOnly
  sessoes_autenticacao → sessão ativa associada ao token

A cada requisição:
  Authorization: Bearer <token_acesso>

Renovação:
  POST /auth/renovar
  → Backend valida cookie httpOnly e sessão ativa no SQL Server
  → Retorna novo token_acesso e rotaciona refresh_token

Logout:
  POST /auth/sair
  → Registro no log de auditoria
  → Backend revoga a sessão no SQL Server e limpa o cookie httpOnly
  → Frontend limpa o token_acesso mantido em memória

Expiração:
  → Backend retorna 401
  → Frontend tenta renovar; se não conseguir, redireciona para /login
```

### Estrutura do JWT (token_acesso)

```json
{
  "sub": "uuid-do-usuario",
  "sid": "uuid-da-sessao",
  "perfil": "operador",
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
    sessao = banco.query(SessaoAutenticacao).filter(
        SessaoAutenticacao.id == payload["sid"],
        SessaoAutenticacao.revogado_em.is_(None),
    ).first()
    if not sessao:
        raise HTTPException(status_code=401)
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

## 5. API REST — Endpoints Disponíveis

### Autenticação
```
GET    /                         → health check
POST   /login                    → autenticação com e-mail e senha
```

### Dashboard
```
GET    /dashboard/kpis           → KPIs globais
GET    /dashboard/eventos        → últimos eventos de auditoria
GET    /dashboard/workspaces     → workspaces com contagens
GET    /dashboard/expediente     → status atual do expediente no servidor
```

### Usuários
```
GET    /usuarios                  → listagem com filtros
POST   /usuarios                  → criar usuário
PUT    /usuarios/{id}             → atualizar usuário
DELETE /usuarios/{id}             → excluir usuário
POST   /usuarios/{id}/resetar-senha
GET    /usuarios/{id}/acessos
PUT    /usuarios/{id}/acessos
GET    /usuarios/{id}/favoritos
POST   /usuarios/{id}/favoritos
DELETE /usuarios/{id}/favoritos/{relatorio_id}
```

### Workspaces
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
```

### Relatórios
```
GET    /workspaces/{id}/relatorios
POST   /workspaces/{id}/relatorios
PUT    /workspaces/{id}/relatorios/{relatorio_id}
DELETE /workspaces/{id}/relatorios/{relatorio_id}
GET    /relatorios/{id}/embed          → embed URL + token Power BI
```

### Configurações
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
PUT    /configuracoes/pbi
```

### Auditoria
```
GET    /auditoria                → consultar logs com filtros e paginação
GET    /auditoria/export-csv     → exportar CSV filtrado
GET    /auditoria/tipos          → valores de tipo_evento
GET    /auditoria/modulos        → valores de modulo
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
PBI_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_SECRET=sua-chave-secreta-aqui
```

**`frontend/.env`**
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_NOME_APP=CGID - Centro de Governança e Inteligência de Dados
VITE_AMBIENTE=development
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento (stack NestJS) |
| 2.0 | Maio/2026 | Vinicius Soares | Reescrita completa: migração para Python + FastAPI, SQL Server, remoção de Redis e BullMQ, nomes em Português |
| 2.1 | Junho/2026 | Vinicius Soares | Atualização para estado atual do protótipo: rotas diretas FastAPI, sessionStorage, apiFetch com X-Usuario-Id, endpoints de favoritos, auditoria, configurações e Power BI Embedded |

# Diagramas do Sistema

> **Documento:** 06-arquitetura/03-diagramas.md  
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

> **Nota:** Os diagramas abaixo estão em formato texto/ASCII para edição e versão em repositório. Para visualização gráfica, recomenda-se importar as descrições no **draw.io**, **Mermaid Live Editor** ou **PlantUML**.

---

## 1. Diagrama de Contexto (C4 — Nível 1)

```mermaid
graph TB
    Usuario[👤 Colaborador / Operador]
    Gerente[👤 Gerente]
    Admin[👤 Administrador / Super Admin]
    Portal[🖥️ BrasilTerrenos\nPortal Corporativo]
    PBI[📊 Microsoft Power BI\nService]
    Email[📧 Serviço de E-mail\nTransacional — v1.1+]

    Usuario -->|"Acessa relatórios\ndo departamento"| Portal
    Gerente -->|"Visualiza KPIs e\nrelatórios da equipe"| Portal
    Admin -->|"Administra usuários,\npermissões e workspaces"| Portal

    Portal -->|"Embed de relatórios\n(v1.2)"| PBI
    Portal -->|"Envia e-mails de\nnotificação (v1.1)"| Email
```

---

## 2. Diagrama de Containers (C4 — Nível 2)

```mermaid
graph TB
    subgraph "BrasilTerrenos Portal"
        FE["⚛️ React SPA\n(TypeScript + Vite)\nPorta 5173"]
        API["🐍 FastAPI\n(Python 3.12 + uvicorn)\nPorta 3001"]
        DB["🗄️ SQL Server\n(Developer local /\non-premise empresa)\nPorta 1433"]
    end

    FE -->|"HTTPS REST + JWT Bearer"| API
    API -->|"SQLAlchemy 2.0\npyodbc"| DB

    subgraph "Serviços Externos"
        PBI["📊 Power BI REST API\n(v1.2+)"]
        SMTP["📧 SMTP\n(v1.1+)"]
    end

    API -->|"Power BI Embedded\n(v1.2)"| PBI
    API -->|"Notificações\n(v1.1)"| SMTP
```

---

## 3. Diagrama de Componentes — Módulo Auth (C4 — Nível 3)

```mermaid
graph LR
    subgraph "routers/auth.py (FastAPI)"
        EP_ENTRAR["POST /auth/entrar"]
        EP_SAIR["POST /auth/sair"]
        EP_EU["GET /auth/eu"]
    end

    subgraph "Dependências"
        DEP_DB["obter_db()\nSQLAlchemy Session"]
        DEP_USER["obter_usuario_atual()\nvalida Bearer token"]
        AUTH_MOD["auth.py\nJWT + bcrypt"]
        AUDIT["logs_auditoria\ntabela SQL Server"]
    end

    EP_ENTRAR --> AUTH_MOD
    EP_ENTRAR --> DEP_DB
    EP_ENTRAR --> AUDIT
    EP_SAIR --> DEP_USER
    EP_SAIR --> AUDIT
    EP_EU --> DEP_USER
    DEP_USER --> AUTH_MOD
    DEP_USER --> DEP_DB
```

---

## 4. Diagrama de Sequência — Autenticação

```
Browser              FastAPI API           SQL Server
                     (uvicorn)

  │  POST /api/v1/auth/entrar  │                │
  │  { email, senha }          │                │
  │───────────────────────────▶│                │
  │                             │── SELECT usuario WHERE email=? ──▶│
  │                             │◀── usuario ────────────────────────│
  │                             │── bcrypt.verify(senha, hash_senha) │
  │                             │── verificar status != bloqueado    │
  │                             │── criar_token_acesso(sub=id)       │
  │                             │── UPDATE usuario SET ultimo_login  ──▶│
  │                             │── INSERT logs_auditoria ─────────────▶│
  │◀── 200 { token_acesso, tipo_token, perfil, nome }                │
  │                             │                │
  │  [Frontend: localStorage.setItem('token_acesso', ...)]
```

---

## 5. Diagrama de Sequência — Requisição Autenticada

```
Browser (Axios)      FastAPI API           SQL Server
                     (uvicorn)

  │  GET /api/v1/workspaces       │                │
  │  Authorization: Bearer <token> │                │
  │───────────────────────────────▶│                │
  │                                │── decodificar_token(token)      │
  │                                │── SELECT usuario WHERE id=sub ──▶│
  │                                │◀── usuario ────────────────────│
  │                                │── verificar usuario.status     │
  │                                │── [Depends(exigir_perfil(...))]│
  │                                │── SELECT espacos_trabalho ─────▶│
  │                                │◀── lista ──────────────────────│
  │◀── 200 [ { id, nome, ... } ] ──│                │
```

---

## 6. Diagrama de Sequência — Logout

```
Browser              FastAPI API           SQL Server

  │  POST /api/v1/auth/sair       │                │
  │  Authorization: Bearer <token> │                │
  │───────────────────────────────▶│                │
  │                                │── obter_usuario_atual()         │
  │                                │── INSERT logs_auditoria ────────▶│
  │◀── 200 { "mensagem": "Sessão encerrada" }       │
  │                                │                │
  │  [Frontend: localStorage.removeItem('token_acesso')]
  │  [Frontend: navegar('/login')]
```

---

## 7. Fluxo de Deploy (Desenvolvimento → Produção)

```mermaid
flowchart LR
    A[Desenvolvimento local\nuvicorn --reload] --> B[Testar funcionalidades\nno http://localhost:5173]
    B --> C{Funcionando?}
    C -->|NÃO| A
    C -->|SIM| D[Commit + Push para\nmain no GitHub]
    D --> E[Copiar backend/ para\nservidor da empresa]
    E --> F[Ajustar backend/.env\nDATABASE_URL do servidor]
    F --> G[pip install -r requirements.txt]
    G --> H[uvicorn main:app\n--host 0.0.0.0 --port 3001\n--workers 2]
    H --> I[Build do frontend\nnpm run build]
    I --> J[Servir frontend via\nNGINX ou IIS]
```

---

## 8. Diagrama de Casos de Uso Simplificado

```
┌──────────────────────────────────────────────────────────┐
│                    PORTAL BRASILTERRENOS                  │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ MÓDULOS DE CONSUMO                                   │ │
│  │  ○ Login / Logout         Todos os usuários ────────┼─┤
│  │  ○ Visualizar relatórios  Operador+ ────────────────┼─┤
│  │  ○ Navegar workspaces     Operador+ ────────────────┼─┤
│  │  ○ Gerenciar favoritos    Operador+ ────────────────┼─┤
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ MÓDULOS ADMINISTRATIVOS                              │ │
│  │  ○ Gerenciar usuários     Administrador+ ───────────┼─┤
│  │  ○ Gerenciar permissões   Administrador+ ───────────┼─┤
│  │  ○ Gerenciar workspaces   Administrador+ ───────────┼─┤
│  │  ○ Configurar expediente  Administrador+ ───────────┼─┤
│  │  ○ Consultar logs         Gerente+ ─────────────────┼─┤
│  │  ○ Configurações do PBI   Super Administrador ──────┼─┤
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Ferramentas Recomendadas para Diagramas

| Ferramenta | Uso |
|------------|-----|
| Mermaid Live | Diagramas de fluxo e sequência inline |
| draw.io / diagrams.net | Diagramas C4, arquitetura |
| PlantUML | Diagramas UML textuais |
| Excalidraw | Diagramas informais e whiteboards |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento (stack NestJS) |
| 2.0 | Maio/2026 | — | Reescrita completa: migração para FastAPI, SQL Server, remoção de Redis e BullMQ, nomes em Português, novos diagramas de sequência |

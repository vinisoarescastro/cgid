# CGID - Centro de Governança e Inteligência de Dados

Portal web para centralizar relatórios **Power BI Embedded** com controle de permissões, auditoria e gestão de acesso corporativo.

---

## O que é este projeto?

O CGID é um portal interno onde usuários da empresa podem visualizar relatórios do Power BI de acordo com suas permissões. Administradores controlam quem vê o quê, e todas as ações ficam registradas em log de auditoria.

---

## Stack atual

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + JavaScript + Vite 8 |
| Roteamento | React Router v7 |
| Backend | Python 3.12 + FastAPI |
| Banco de dados | SQLite (desenvolvimento) → SQL Server (produção) |
| ORM | SQLAlchemy 2.0 |
| Senhas | passlib + bcrypt |
| Power BI | powerbi-client SDK (Microsoft) — v1.1 |
| Autenticação PBI | Azure AD OAuth2 via HTTP (client credentials flow — Service Principal) |

---

## Estrutura do repositório

```
cgid/
│
├── backend/
│   ├── main.py          ← servidor FastAPI (começa aqui)
│   ├── database.py      ← conexão SQLite + sessão SQLAlchemy
│   ├── models.py        ← 14 tabelas do banco (SQLAlchemy ORM)
│   ├── schemas.py       ← validação de entrada/saída (Pydantic)
│   ├── seed.py          ← popular banco com dados iniciais
│   └── cgid.db          ← banco SQLite (gerado automaticamente)
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx       ← tela de login
│   │   │   ├── HomePage.jsx        ← home (dashboard)
│   │   │   ├── UsersPage.jsx       ← gestão de usuários
│   │   │   ├── WorkspacePage.jsx   ← gestão de workspaces e relatórios
│   │   │   ├── FavoritosPage.jsx   ← relatórios favoritos do usuário
│   │   │   ├── AuditPage.jsx       ← auditoria com filtros e exportação
│   │   │   └── SettingsPage.jsx    ← configurações de expediente, exceções e PBI
│   │   ├── styles/
│   │   │   ├── global.css          ← tokens, reset, tipografia
│   │   │   ├── login.css           ← estilos da tela de login
│   │   │   ├── home.css            ← estilos do app shell e home
│   │   │   ├── users.css           ← estilos da gestão de usuários
│   │   │   ├── workspace.css       ← estilos da gestão de workspaces e favoritos
│   │   │   ├── audit.css           ← estilos da auditoria
│   │   │   └── settings.css        ← estilos das configurações
│   │   ├── routes/
│   │   │   └── AppRoutes.jsx       ← definição de rotas + rota protegida
│   │   ├── components/
│   │   │   ├── Avatar.jsx          ← avatar com foto ou iniciais
│   │   │   ├── IconPicker.jsx      ← seletor de ícone para workspaces
│   │   │   └── VisualizadorRelatorio.jsx ← embed inline do Power BI
│   │   ├── utils/
│   │   │   └── api.js              ← helper fetch com header X-Usuario-Id
│   │   ├── assets/                 ← logos e imagens
│   │   ├── App.jsx                 ← monta BrowserRouter + AppRoutes
│   │   └── main.jsx                ← inicializa o React
│   ├── package.json
│   └── vite.config.js
│
└── docs/                ← documentação técnica e de produto
    └── prototipo/       ← protótipo visual (portal_v4_8.html)
```

---

## Pré-requisitos

| Software | Versão | Link |
|---|---|---|
| Python | 3.12+ | [python.org](https://python.org/downloads) |
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |

> Não é necessário SQL Server nem ODBC Driver para rodar em desenvolvimento. O banco SQLite é criado automaticamente.

---

## Como rodar localmente

### 1. Instale as dependências do backend

```powershell
cd backend
pip install fastapi uvicorn sqlalchemy passlib bcrypt pydantic requests
```

### 2. Crie e popule o banco de dados

```powershell
python seed.py
```

Isso cria o arquivo `cgid.db` com as 14 tabelas e os dados iniciais.

### 3. Inicie o backend

```powershell
uvicorn main:app --reload
```

### 4. Inicie o frontend

Abra um segundo terminal:

```powershell
cd frontend
npm install
npm run dev
```

### 5. Acesse a aplicação

| URL | O que abre |
|---|---|
| http://localhost:5173 | Aplicação React |
| http://localhost:8000/docs | Documentação interativa da API (Swagger) |

---

## Credenciais de acesso (desenvolvimento)

| E-mail | Senha | Perfil |
|---|---|---|
| admin@cgid.com | Admin@2025 | Master |
| carlos@cgid.com | Carlos@123 | Coordenador |
| mariana@cgid.com | Mariana@123 | Colaborador |
| visitante@cgid.com | Visitante@123 | Convidado |

---

## Regras de negócio importantes

| Regra | Detalhe |
|---|---|
| Senha padrão | Novos usuários recebem `Mudar@123` se nenhuma senha for informada |
| Reset de senha | Admin pode redefinir a senha de qualquer usuário para `Mudar@123` |
| Bloqueio automático | Conta bloqueada após 5 tentativas de login incorretas |
| Acesso admin | Master e Administrador têm acesso automático a todos os workspaces com nível total |
| Acesso por perfil | Coordenador, Colaborador e Convidado precisam ter workspaces vinculados manualmente |
| Último acesso | Registrado automaticamente a cada login bem-sucedido |

---

## Páginas disponíveis

| Rota | Página | Descrição |
|---|---|---|
| `/login` | LoginPage | Tela de autenticação |
| `/` | HomePage | Dashboard com KPIs, eventos e workspaces |
| `/usuarios` | UsersPage | Gestão completa de usuários (CRUD + acessos) |
| `/workspaces` | WorkspacePage | Gestão de workspaces e relatórios Power BI |
| `/favoritos` | FavoritosPage | Relatórios favoritos agrupados por workspace |
| `/auditoria` | AuditPage | Consulta, filtros, paginação e exportação CSV de logs |
| `/configuracoes` | SettingsPage | Expediente, grupos de exceção e credenciais Power BI |

---

## Endpoints disponíveis

### Autenticação
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/` | Health check |
| POST | `/login` | Autenticação — retorna dados do usuário e registra último acesso |

### Dashboard
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/dashboard/kpis` | KPIs: usuários ativos, bloqueados, acessos negados, workspaces |
| GET | `/dashboard/eventos` | Últimos 5 eventos do log de auditoria |
| GET | `/dashboard/workspaces` | Workspaces com contagem de relatórios e acessos |
| GET | `/dashboard/expediente` | Status atual do expediente calculado pelo servidor |

### Gestão de Usuários
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/usuarios` | Lista usuários com filtros por status, perfil e busca |
| POST | `/usuarios` | Cria usuário (senha padrão `Mudar@123` se não informada) |
| PUT | `/usuarios/{id}` | Atualiza dados do usuário |
| DELETE | `/usuarios/{id}` | Exclui usuário |
| POST | `/usuarios/{id}/resetar-senha` | Redefine senha para `Mudar@123` |

### Workspaces e Acessos
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/workspaces` | Lista workspaces ativos |
| POST | `/workspaces` | Cria workspace |
| PUT | `/workspaces/{id}` | Atualiza workspace |
| PATCH | `/workspaces/{id}/arquivar` | Arquiva workspace |
| GET | `/workspaces/{id}/usuarios` | Lista usuários vinculados ao workspace |
| POST | `/workspaces/{id}/usuarios` | Vincula usuário ao workspace |
| PATCH | `/workspaces/{id}/usuarios/{uid}` | Altera nível de acesso do usuário |
| DELETE | `/workspaces/{id}/usuarios/{uid}` | Remove usuário do workspace |
| GET | `/workspaces/{id}/usuarios/{uid}/relatorios` | Lista relatórios liberados para o usuário no workspace |
| PUT | `/workspaces/{id}/usuarios/{uid}/relatorios` | Salva permissões de relatórios específicos |
| GET | `/usuarios/{id}/acessos` | Acessos de um usuário por workspace |
| PUT | `/usuarios/{id}/acessos` | Salva acessos (auto-total para admin/super_admin) |

### Relatórios
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/workspaces/{id}/relatorios` | Lista relatórios do workspace (exceto arquivados) |
| POST | `/workspaces/{id}/relatorios` | Cria relatório e vincula ao workspace |
| PUT | `/workspaces/{id}/relatorios/{rid}` | Atualiza dados do relatório |
| DELETE | `/workspaces/{id}/relatorios/{rid}` | Exclui relatório |
| GET | `/relatorios/{id}/embed` | Gera embed token via Azure AD e retorna URL de incorporação |

### Favoritos
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/usuarios/{id}/favoritos` | Lista favoritos do usuário com dados de relatório e workspace |
| POST | `/usuarios/{id}/favoritos` | Adiciona relatório aos favoritos |
| DELETE | `/usuarios/{id}/favoritos/{rid}` | Remove relatório dos favoritos |

### Auditoria
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/auditoria` | Lista logs com filtros e paginação |
| GET | `/auditoria/export-csv` | Exporta logs filtrados em CSV UTF-8 com BOM |
| GET | `/auditoria/tipos` | Lista tipos de evento disponíveis para filtro |
| GET | `/auditoria/modulos` | Lista módulos disponíveis para filtro |

### Configurações
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/configuracoes/expediente` | Lista regras de expediente por dia da semana |
| PUT | `/configuracoes/expediente/{dia}` | Salva regra de expediente de um dia |
| GET | `/configuracoes/grupos-excecao` | Lista grupos de exceção e membros |
| POST | `/configuracoes/grupos-excecao` | Cria grupo de exceção |
| PUT | `/configuracoes/grupos-excecao/{id}` | Atualiza grupo de exceção |
| DELETE | `/configuracoes/grupos-excecao/{id}` | Exclui grupo de exceção |
| POST | `/configuracoes/grupos-excecao/{id}/membros` | Adiciona membro ao grupo |
| DELETE | `/configuracoes/grupos-excecao/{id}/membros/{uid}` | Remove membro do grupo |
| GET | `/configuracoes/pbi` | Retorna credenciais Power BI cadastradas, com secret mascarado |
| PUT | `/configuracoes/pbi` | Salva credenciais Power BI |

---

## Configuração do Power BI Embedded

Para visualizar relatórios dentro do portal é necessário um **Service Principal** registrado no Azure AD com acesso ao workspace do Power BI.

### 1. Registrar o app no Azure AD

1. Acesse o [Portal Azure](https://portal.azure.com) → **Azure Active Directory** → **Registros de aplicativo** → **Novo registro**
2. Anote o **Application (client) ID** e o **Directory (tenant) ID**
3. Em **Certificados e segredos**, crie um novo segredo e anote o valor

### 2. Conceder acesso ao workspace no Power BI

No Power BI Service, abra o workspace → **Acesso** → adicione o Service Principal como **Membro** ou **Colaborador**.

> A configuração "Permitir que entidades de serviço usem APIs do Power BI" também precisa estar habilitada em **Portal Admin do Power BI → Configurações de desenvolvedor**.

### 3. Configurar as variáveis de ambiente

Crie o arquivo `backend/.env` com base em `backend/.env.example`:

```env
PBI_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_SECRET=sua-chave-secreta-aqui
```

Inicie o backend com as variáveis carregadas:

```powershell
# Windows PowerShell
$env:PBI_TENANT_ID="..."; $env:PBI_CLIENT_ID="..."; $env:PBI_CLIENT_SECRET="..."; uvicorn main:app --reload
```

### 4. Cadastrar os IDs no portal

Na página de **Workspace**, ao criar ou editar um workspace, informe o **ID Workspace Power BI** (UUID visível na URL do Power BI Service). Ao cadastrar um relatório, informe o **ID Relatório Power BI**. O botão **Abrir** na lista de relatórios abrirá o relatório incorporado diretamente no portal.

As credenciais também podem ser cadastradas em **Configurações → Credenciais Power BI** por um Master. O `client_secret` é retornado ao frontend apenas mascarado.

---

## Banco de dados

O banco possui **14 tabelas** conforme a documentação de modelagem:

| Tabela | Conteúdo |
|---|---|
| `usuarios` | Contas de acesso ao portal |
| `sessoes_autenticacao` | Sessões e refresh tokens |
| `espacos_trabalho` | Workspaces (agrupamentos de relatórios) |
| `relatorios` | Relatórios Power BI cadastrados |
| `acessos_workspace` | Permissão de usuário por workspace |
| `acessos_relatorio` | Permissão de usuário por relatório |
| `permissoes_perfil` | Matriz de permissões por perfil (RBAC) |
| `sobrescritas_permissao` | Exceções de permissão por usuário |
| `regras_expediente` | Horários de acesso permitidos por dia |
| `grupos_excecao` | Grupos com acesso fora do expediente |
| `membros_grupo_excecao` | Membros dos grupos de exceção |
| `favoritos` | Relatórios favoritos por usuário |
| `logs_auditoria` | Registro imutável de todas as ações |
| `configuracoes_sistema` | Parâmetros globais do sistema |

---

## Documentação

Consulte a pasta [`docs/`](docs/README.md) para requisitos, arquitetura, modelagem e roadmap.

O protótipo visual está em [`docs/prototipo/portal_v4_8.html`](docs/prototipo/portal_v4_8.html).

# Módulos e Funcionalidades Previstas

> **Documento:** 02-escopo/02-modulos-e-funcionalidades.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Visão Geral dos Módulos

O sistema é composto por **10 módulos funcionais** organizados em duas camadas:

- **Camada de Consumo** — módulos usados por todos os perfis para consumir relatórios
- **Camada Administrativa** — módulos exclusivos de Admin e Super Admin para governar o sistema

```
┌─────────────────────────────────────────────────────┐
│              CAMADA DE CONSUMO                       │
│   Autenticação │ Home │ Workspaces │ Favoritos       │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│              CAMADA ADMINISTRATIVA                   │
│  Usuários │ Permissões │ Workspaces (Admin)          │
│  Expediente │ Auditoria │ Segurança │ Configurações  │
└─────────────────────────────────────────────────────┘
```

---

## 2. Módulos Detalhados

---

### MOD-01 — Autenticação e Identidade

**Descrição:** Controla o ciclo de vida de sessão dos usuários, incluindo autenticação, autorização inicial, recuperação de senha e gestão de sessão segura.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-AUTH-01 | Login com e-mail e senha | v1.0 | 🔴 Must Have |
| F-AUTH-02 | Toggle de visibilidade da senha | v1.0 | 🟡 Should Have |
| F-AUTH-03 | Mensagem de erro com contagem de tentativas | v1.0 | 🔴 Must Have |
| F-AUTH-04 | Bloqueio automático após 5 tentativas inválidas | v1.0 | 🔴 Must Have |
| F-AUTH-05 | Emissão de token JWT com refresh token | v1.0 | 🔴 Must Have |
| F-AUTH-06 | Renovação automática de sessão (refresh silencioso) | v1.0 | 🔴 Must Have |
| F-AUTH-07 | Logout com invalidação de token | v1.0 | 🔴 Must Have |
| F-AUTH-08 | Recuperação de senha por e-mail | v1.1 | 🔴 Must Have |
| F-AUTH-09 | MFA via TOTP (Google Authenticator / Authy) | v1.1 | 🟡 Should Have |
| F-AUTH-10 | SSO via Azure Active Directory (OIDC) | v2.0 | 🟢 Could Have |
| F-AUTH-11 | Tela de boas-vindas personalizada por perfil | v1.0 | 🟡 Should Have |

---

### MOD-02 — Home / Dashboard

**Descrição:** Tela inicial após autenticação, adaptada ao perfil do usuário. Admins veem KPIs globais do portal; operadores veem seus relatórios e atividade recente.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-DASH-01 | KPIs globais para Admin (usuários ativos, bloqueados, acessos negados, workspaces) | v1.0 | 🔴 Must Have |
| F-DASH-02 | KPIs pessoais para Operador (meus relatórios, meus workspaces) | v1.0 | 🔴 Must Have |
| F-DASH-03 | Eventos críticos recentes (admin) | v1.0 | 🔴 Must Have |
| F-DASH-04 | Atividade recente do usuário (operador) | v1.0 | 🟡 Should Have |
| F-DASH-05 | Status dos serviços integrados (PBI, auth, banco) | v1.0 | 🟡 Should Have |
| F-DASH-06 | Tabela de relatórios PBI com filtros | v1.0 | 🔴 Must Have |
| F-DASH-07 | Tiles de workspaces com estatísticas | v1.0 | 🔴 Must Have |
| F-DASH-08 | Gráficos de acesso por período | v1.1 | 🟢 Could Have |

---

### MOD-03 — Workspaces e Relatórios (Consumo)

**Descrição:** Navegação e visualização de relatórios Power BI Embedded por workspace. Ponto principal de uso diário do portal.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-WS-01 | Listagem de workspaces acessíveis pelo usuário | v1.0 | 🔴 Must Have |
| F-WS-02 | Tiles de workspace com estatísticas (relatórios, usuários online) | v1.0 | 🔴 Must Have |
| F-WS-03 | Detalhe do workspace com listagem de relatórios | v1.0 | 🔴 Must Have |
| F-WS-04 | Filtro de relatórios por workspace, categoria e status | v1.0 | 🟡 Should Have |
| F-WS-05 | Abertura de relatório PBI em modal ou tela cheia | v1.0 | 🔴 Must Have |
| F-WS-06 | Renderização inline de relatório via Power BI Embedded SDK | v1.0 | 🔴 Must Have |
| F-WS-07 | Renovação automática de token de embed expirado | v1.0 | 🔴 Must Have |
| F-WS-08 | Indicador de status do relatório (publicado / rascunho) | v1.0 | 🟡 Should Have |
| F-WS-09 | Busca global de relatórios | v1.0 | 🟡 Should Have |

---

### MOD-04 — Favoritos

**Descrição:** Permite ao usuário marcar relatórios como favoritos para acesso rápido.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-FAV-01 | Marcar/desmarcar relatório como favorito | v1.0 | 🟡 Should Have |
| F-FAV-02 | Listagem de favoritos do usuário | v1.0 | 🟡 Should Have |
| F-FAV-03 | Acesso rápido ao relatório favorito | v1.0 | 🟡 Should Have |
| F-FAV-04 | Favoritos persistidos por usuário (não compartilhados) | v1.0 | 🟡 Should Have |

---

### MOD-05 — Gestão de Usuários (Admin)

**Descrição:** CRUD completo de usuários com controle de status e associação a workspaces e relatórios.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-USR-01 | Listagem de usuários com filtros (status, workspace, perfil) | v1.0 | 🔴 Must Have |
| F-USR-02 | Cadastro de novo usuário | v1.0 | 🔴 Must Have |
| F-USR-03 | Edição de dados do usuário | v1.0 | 🔴 Must Have |
| F-USR-04 | Ativação / inativação de usuário | v1.0 | 🔴 Must Have |
| F-USR-05 | Bloqueio e desbloqueio manual de usuário | v1.0 | 🔴 Must Have |
| F-USR-06 | Visualização do histórico de último acesso | v1.0 | 🟡 Should Have |
| F-USR-07 | Associação de usuário a workspaces e relatórios | v1.0 | 🔴 Must Have |
| F-USR-08 | Importação em massa via CSV | v2.0 | 🟢 Could Have |
| F-USR-09 | Exportação da lista de usuários | v1.1 | 🟢 Could Have |

---

### MOD-06 — Gestão de Permissões (Admin)

**Descrição:** Controle granular de permissões em quatro dimensões: por perfil, por usuário, por workspace e por relatório.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-PERM-01 | Matriz de permissões por perfil (visualizar, criar, editar, excluir, exportar, gerenciar) | v1.0 | 🔴 Must Have |
| F-PERM-02 | Override de permissão por usuário individual | v1.0 | 🔴 Must Have |
| F-PERM-03 | Controle de acesso Power BI por workspace (total vs. relatórios específicos) | v1.0 | 🔴 Must Have |
| F-PERM-04 | Controle de acesso Power BI por relatório individual | v1.0 | 🔴 Must Have |
| F-PERM-05 | Registro automático de alterações de permissão no log de auditoria | v1.0 | 🔴 Must Have |
| F-PERM-06 | Visualização do estado anterior vs. novo ao alterar permissões | v1.1 | 🟡 Should Have |

---

### MOD-07 — Controle de Expediente (Admin)

**Descrição:** Define horários de acesso ao portal e gerencia exceções individuais e em grupo.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-SCHED-01 | Definição de horário de início e fim por dia da semana | v1.0 | 🔴 Must Have |
| F-SCHED-02 | Toggle para bloquear acesso fora do expediente por padrão | v1.0 | 🔴 Must Have |
| F-SCHED-03 | Cadastro de exceções individuais (usuário + janela de horário) | v1.0 | 🔴 Must Have |
| F-SCHED-04 | Cadastro de grupos de exceção | v1.0 | 🔴 Must Have |
| F-SCHED-05 | Ativação/desativação de exceções | v1.0 | 🔴 Must Have |
| F-SCHED-06 | Mensagem personalizada exibida ao usuário bloqueado por expediente | v1.0 | 🟡 Should Have |

---

### MOD-08 — Logs e Auditoria (Admin)

**Descrição:** Registro imutável de todos os eventos relevantes do sistema com capacidade de pesquisa, filtros e exportação.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-AUD-01 | Listagem paginada de eventos de auditoria | v1.0 | 🔴 Must Have |
| F-AUD-02 | Filtros: usuário, módulo, tipo de evento, período, IP | v1.0 | 🔴 Must Have |
| F-AUD-03 | Detalhe expandido de cada evento | v1.0 | 🔴 Must Have |
| F-AUD-04 | Categorização visual por tipo (auth, usuário, permissão, acesso, segurança) | v1.0 | 🟡 Should Have |
| F-AUD-05 | Exportação filtrada em CSV | v1.1 | 🟡 Should Have |
| F-AUD-06 | Exportação em XLSX | v1.1 | 🟢 Could Have |
| F-AUD-07 | Alerta visual de eventos críticos no dashboard | v1.0 | 🔴 Must Have |
| F-AUD-08 | Notificação por e-mail de eventos críticos | v1.1 | 🟡 Should Have |

---

### MOD-09 — Segurança (Admin)

**Descrição:** Painel de monitoramento do status de segurança do portal com checklist e visualização de eventos suspeitos.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-SEC-01 | Checklist de segurança (bcrypt, rate limiting, RBAC, HSTS, CSP, MFA, LGPD, TLS) | v1.0 | 🟡 Should Have |
| F-SEC-02 | Visualização de eventos de segurança recentes (logins suspeitos, bloqueios) | v1.0 | 🔴 Must Have |
| F-SEC-03 | Relatório de IPs suspeitos | v1.1 | 🟢 Could Have |
| F-SEC-04 | Gestão de sessões ativas | v1.1 | 🟢 Could Have |

---

### MOD-10 — Configurações do Sistema (Super Admin)

**Descrição:** Configurações globais do portal incluindo integração com Power BI Embedded e políticas de segurança.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-CONF-01 | Configuração de nome do portal e ambiente (produção/homologação) | v1.0 | 🔴 Must Have |
| F-CONF-02 | Configuração de credenciais Power BI (Client ID, Tenant ID, Workspace ID) | v1.0 | 🔴 Must Have |
| F-CONF-03 | Toggle de integração PBI ativa/inativa | v1.0 | 🔴 Must Have |
| F-CONF-04 | URL de embed permitida (whitelist) | v1.0 | 🟡 Should Have |
| F-CONF-05 | Política de senha (complexidade, expiração) | v1.1 | 🟡 Should Have |
| F-CONF-06 | Configurações de notificação (quais alertas, quem recebe) | v1.1 | 🟢 Could Have |

---

## 3. Resumo por Versão

| Versão | Módulos | Funcionalidades totais |
|--------|---------|:---------------------:|
| v1.0 (MVP) | Todos os 10 módulos (funcionalidades Must Have) | ~42 |
| v1.1 | Complementos nos 10 módulos | ~12 |
| v2.0 | Novas capacidades (SSO, RLS, workflow) | ~8 |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
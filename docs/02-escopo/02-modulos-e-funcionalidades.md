# Módulos e Funcionalidades Previstas

> **Documento:** 02-escopo/02-modulos-e-funcionalidades.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Visão Geral dos Módulos

O sistema é composto por **10 módulos funcionais** organizados em duas camadas:

- **Camada de Consumo**: módulos usados por todos os perfis para consumir relatórios
- **Camada Administrativa**: módulos exclusivos de Administrador e Master para governar o sistema

```
┌─────────────────────────────────────────────────────┐
│              CAMADA DE CONSUMO                      │
│   Autenticação │ Home │ Workspaces │ Favoritos      │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│              CAMADA ADMINISTRATIVA                  │
│  Usuários │ Permissões │ Workspaces (Admin)         │
│  Expediente │ Auditoria │ Segurança │ Configurações │
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
| F-AUTH-01 | Login com e-mail e senha | v1.0 | 🔴 Obrigatório |
| F-AUTH-02 | Toggle de visibilidade da senha | v1.0 | 🔴 Obrigatório |
| F-AUTH-03 | Mensagem de erro com contagem de tentativas | v1.0 | 🔴 Obrigatório |
| F-AUTH-04 | Bloqueio automático após 5 tentativas inválidas | v1.0 | 🔴 Obrigatório |
| F-AUTH-05 | Emissão de token JWT com refresh token | v1.0 | 🔴 Obrigatório |
| F-AUTH-06 | Renovação automática de sessão (refresh silencioso) | v1.0 | 🔴 Obrigatório |
| F-AUTH-07 | Logout com invalidação de token | v1.0 | 🔴 Obrigatório |
| F-AUTH-08 | Recuperação de senha por e-mail | v1.1 | 🔴 Obrigatório |

---

### MOD-02 — Home / Dashboard

**Descrição:** Tela inicial após autenticação, adaptada ao perfil do usuário. Administradores e Masters veem KPIs globais do portal; demais perfis veem seus workspaces acessíveis, relatórios e status de expediente.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-DASH-01 | KPIs globais para Admin (usuários ativos, bloqueados, acessos negados, workspaces) | v1.0 | 🔴 Obrigatório |
| F-DASH-02 | Card de boas-vindas personalizado com nome e perfil do usuário (não-admin) | v1.0 | 🔴 Obrigatório |
| F-DASH-03 | Eventos críticos recentes (admin) | v1.0 | 🔴 Obrigatório |
| F-DASH-04 | Listagem de workspaces acessíveis com relatórios expansíveis (não-admin) | v1.0 | 🔴 Obrigatório |
| F-DASH-05 | Status dos serviços integrados (PBI, auth, banco) | v1.0 | 🟡 Recomendado |
| F-DASH-06 | Tabela de relatórios PBI com filtros (admin) | v1.0 | 🔴 Obrigatório |
| F-DASH-07 | Tiles de workspaces com estatísticas (admin) | v1.0 | 🔴 Obrigatório |
| F-DASH-08 | Gráficos de acesso por período | v1.1 | 🟡 Recomendado |
| F-DASH-09 | Indicador de expediente no topbar calculado pelo servidor (todos os perfis) | v1.0 | 🔴 Obrigatório |
| F-DASH-10 | Botão "Abrir" em relatório da home: navega direto para o relatório na página de Workspaces (deep-link via query params) | v1.0 | 🔴 Obrigatório |
| F-DASH-11 | Botão "Abrir" desabilitado para relatórios sem `id_relatorio_pbi` configurado (mesmo layout, estado inativo) | v1.0 | 🔴 Obrigatório |
| F-DASH-12 | Gráfico de área "Acessos ao longo do tempo" com filtro por período (diário/semanal/mensal) e seletor de data no modo diário; exibe logins e acessos negados | v1.1 | 🟡 Recomendado |
| F-DASH-13 | Gráfico de rosca "Distribuição por Workspace" com relatórios publicados por workspace, cores do workspace, labels com linhas e percentuais | v1.1 | 🟡 Recomendado |
| F-DASH-14 | Lista de ranking "Top Relatórios Acessados" com filtro por período (diário/semanal/mensal), barra de progresso e cor do workspace | v1.1 | 🟡 Recomendado |

---

### MOD-03 — Workspaces e Relatórios (Consumo)

**Descrição:** Navegação e visualização de relatórios Power BI Embedded por workspace. Ponto principal de uso diário do portal.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-WS-01 | Listagem de workspaces acessíveis pelo usuário | v1.0 | 🔴 Obrigatório |
| F-WS-02 | Tiles de workspace com estatísticas (relatórios, usuários online) | v1.0 | 🔴 Obrigatório |
| F-WS-03 | Detalhe do workspace com listagem de relatórios | v1.0 | 🔴 Obrigatório |
| F-WS-04 | Filtro de relatórios por workspace, categoria e status | v1.0 | 🔴 Obrigatório |
| F-WS-05 | Abertura de relatório PBI em modal ou tela cheia | v1.0 | 🔴 Obrigatório|
| F-WS-06 | Renderização inline de relatório via Power BI Embedded SDK | v1.0 | 🔴 Obrigatório |
| F-WS-07 | Renovação automática de token de embed expirado | v1.0 | 🔴 Obrigatório |
| F-WS-08 | Indicador de status do relatório (publicado / rascunho) | v1.0 | 🔴 Obrigatório |
| F-WS-09 | Busca global de relatórios | v1.0 | 🟡 Recomendado |
| F-WS-10 | CRUD de workspaces para admins (criar, editar, arquivar) | v1.0 | 🔴 Obrigatório |
| F-WS-11 | Seletor visual de ícone (biblioteca com 80+ ícones Font Awesome) com preview em tempo real | v1.0 | 🔴 Obrigatório |
| F-WS-12 | Aba "Usuários vinculados" no detalhe do workspace: lista todos os usuários ativos com acesso total ou parcial (relatórios específicos) | v1.0 | 🔴 Obrigatório |
| F-WS-13 | Admins podem adicionar usuários ao workspace via modal com busca, seleção e escolha de nível de acesso | v1.0 | 🔴 Obrigatório |
| F-WS-14 | Admins podem alterar o nível de acesso de um usuário vinculado diretamente na tabela (select inline) | v1.0 | 🔴 Obrigatório |
| F-WS-15 | Admins podem remover usuários do workspace com confirmação | v1.0 | 🔴 Obrigatório |
| F-WS-16 | CRUD de relatórios dentro do workspace, incluindo categoria, status, descrição e ID Power BI | v1.0 | 🔴 Obrigatório |
| F-WS-17 | Visualizador inline de relatório via Power BI Embedded em tela modal | v1.0 | 🔴 Obrigatório |
| F-WS-18 | Gestão de permissões de relatórios específicos para usuários com `apenas_relatorios` | v1.0 | 🔴 Obrigatório |
| F-WS-19 | Deep-link via query params `?ws=&rel=` para abrir workspace e relatório específico diretamente ao navegar para a página | v1.0 | 🔴 Obrigatório |
| F-WS-20 | Lista de usuários vinculados exclui admins e super_admins (acesso implícito universal) | v1.0 | 🔴 Obrigatório |

---

### MOD-04 — Favoritos

**Descrição:** Permite ao usuário marcar relatórios como favoritos para acesso rápido.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|----------------|--------|------------|
| F-FAV-01 | Marcar/desmarcar relatório como favorito | v1.0 | 🔴 Obrigatório |
| F-FAV-02 | Listagem de favoritos do usuário | v1.0 | 🔴 Obrigatório |
| F-FAV-03 | Acesso rápido ao relatório favorito | v1.0 | 🔴 Obrigatório |
| F-FAV-04 | Favoritos persistidos por usuário (não compartilhados) | v1.0 | 🔴 Obrigatório |
| F-FAV-05 | Página dedicada com favoritos agrupados por workspace e busca por relatório ou workspace | v1.0 | 🔴 Obrigatório |
| F-FAV-06 | Remoção de favoritos pela página dedicada sem alterar o cadastro do relatório | v1.0 | 🔴 Obrigatório |

---

### MOD-05 — Gestão de Usuários (Admin)

**Descrição:** CRUD completo de usuários com controle de status e associação a workspaces e relatórios.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|----------------|--------|------------|
| F-USR-01 | Listagem de usuários com filtros (status, workspace, perfil) | v1.0 | 🔴 Obrigatório |
| F-USR-02 | Cadastro de novo usuário | v1.0 | 🔴 Obrigatório |
| F-USR-03 | Edição de dados do usuário | v1.0 | 🔴 Obrigatório |
| F-USR-04 | Ativação / inativação de usuário | v1.0 | 🔴 Obrigatório |
| F-USR-05 | Visualização do histórico de último acesso | v1.0 | 🔴 Obrigatório |
| F-USR-06 | Associação de usuário a workspaces e relatórios | v1.0 | 🔴 Obrigatório |
| F-USR-07 | Importação em massa via CSV | v2.0 | 🟢 Opcional |
| F-USR-08 | Exportação da lista de usuários | v1.1 | 🟢 Opcional |
| F-USR-09 | Coluna Workspaces exibe badge "Todos os workspaces" para admins/super_admins em vez de listar individualmente | v1.0 | 🔴 Obrigatório |

---

### MOD-06 — Gestão de Permissões (Admin)

**Descrição:** Controle granular de permissões em quatro dimensões: por perfil, por usuário, por workspace e por relatório.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-PERM-01 | Matriz de permissões por perfil (visualizar, criar, editar, excluir, exportar, gerenciar) | v1.0 | 🔴 Obrigatório |
| F-PERM-02 | Override de permissão por usuário individual | v1.0 | 🔴 Obrigatório |
| F-PERM-03 | Controle de acesso Power BI por workspace (total vs. relatórios específicos) | v1.0 | 🔴 Obrigatório |
| F-PERM-04 | Controle de acesso Power BI por relatório individual | v1.0 | 🔴 Obrigatório |
| F-PERM-05 | Registro automático de alterações de permissão no log de auditoria | v1.0 | 🔴 Obrigatório |
| F-PERM-06 | Visualização do estado anterior vs. novo ao alterar permissões | v1.1 | 🟡 Recomendado |
| F-PERM-07 | Filtro server-side da listagem de relatórios por nível de acesso do usuário | v1.0 | 🔴 Obrigatório |

---

### MOD-07 — Controle de Expediente (Admin)

**Descrição:** Define horários de acesso ao portal e gerencia exceções individuais e em grupo.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-SCHED-01 | Definição de horário de início e fim por dia da semana | v1.0 | 🔴 Obrigatório |
| F-SCHED-02 | Toggle para bloquear acesso fora do expediente por padrão | v1.0 | 🔴 Obrigatório |
| F-SCHED-03 | Cadastro de grupos de exceção | v1.0 | 🔴 Obrigatório |
| F-SCHED-04 | Ativação/desativação de exceções | v1.0 | 🔴 Obrigatório |
| F-SCHED-05 | Mensagem personalizada exibida ao usuário bloqueado por expediente | v1.0 | 🔴 Obrigatório |
| F-SCHED-06 | Grade compacta de expediente com uma linha por dia, toggles e salvamento independente | v1.0 | 🔴 Obrigatório |
| F-SCHED-07 | Flag `ignora_dia_inativo` no grupo de exceção: permite que membros acessem o sistema em dias bloqueados (`ativo=false`) | v1.0 | 🔴 Obrigatório |

---

### MOD-08 — Logs e Auditoria (Admin)

**Descrição:** Registro imutável de todos os eventos relevantes do sistema com capacidade de pesquisa, filtros e exportação.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-AUD-01 | Listagem paginada de eventos de auditoria | v1.0 | 🔴 Obrigatório |
| F-AUD-02 | Filtros: usuário, módulo, tipo de evento, período, IP | v1.0 | 🔴 Obrigatório |
| F-AUD-03 | Detalhe expandido de cada evento | v1.0 | 🔴 Obrigatório |
| F-AUD-04 | Categorização visual por tipo (auth, usuário, permissão, acesso, segurança) | v1.0 | 🔴 Obrigatório |
| F-AUD-05 | Exportação filtrada em CSV | v1.0 | 🔴 Obrigatório |
| F-AUD-06 | Exportação em XLSX | v1.1 | 🟢 Opcional  |
| F-AUD-07 | Alerta visual de eventos críticos no dashboard | v1.0 | 🟡 Recomendado |
| F-AUD-08 | Notificação por e-mail de eventos críticos | v1.1 | 🟡 Recomendado |
| F-AUD-09 | Expansão de registros com `valor_anterior` e `valor_novo` lado a lado | v1.0 | 🔴 Obrigatório |

---

### MOD-09 — Segurança (Admin)

**Descrição:** Painel de monitoramento do status de segurança do portal com checklist e visualização de eventos suspeitos.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-SEC-01 | Checklist de segurança (bcrypt, rate limiting, HSTS, CSP, MFA, LGPD, TLS) | v1.0 | 🟡 Recomendado |
| F-SEC-02 | Visualização de eventos de segurança recentes (logins suspeitos, bloqueios) | v1.0 | 🔴 Obrigatório |
| F-SEC-03 | Relatório de IPs suspeitos | v1.1 | 🟡 Recomendado |
| F-SEC-04 | Gestão de sessões ativas | v1.1 | 🟡 Recomendado |

---

### MOD-10 — Configurações do Sistema (Administrador / Master)

**Descrição:** Configurações globais do portal incluindo expediente, grupos de exceção e integração com Power BI Embedded. Administrador e Master acessam a página; credenciais Power BI são exclusivas do Master.

**Funcionalidades:**

| ID | Funcionalidade | Versão | Prioridade |
|----|---------------|--------|-----------|
| F-CONF-01 | Configuração de nome do portal e ambiente (produção/homologação) | v1.0 | 🔴 Obrigatório |
| F-CONF-02 | Configuração de credenciais Power BI (Tenant ID, Client ID, Client Secret) | v1.0 | 🔴 Obrigatório |
| F-CONF-03 | Toggle de integração PBI ativa/inativa | v1.0 | 🔴 Obrigatório |
| F-CONF-04 | URL de embed permitida (whitelist) | v1.0 | 🟡 Recomendado |
| F-CONF-05 | Política de senha (complexidade, expiração) | v1.1 | 🟡 Recomendado |
| F-CONF-06 | Configurações de notificação (quais alertas, quem recebe) | v1.1 | 🟡 Recomendado |
| F-CONF-07 | Abas de Configurações: Expediente, Grupos de Exceção e Credenciais Power BI | v1.0 | 🔴 Obrigatório |
| F-CONF-08 | CRUD de grupos de exceção com inclusão e remoção de membros | v1.0 | 🔴 Obrigatório |

---

## 3. Resumo por Versão

| Versão | Módulos | Funcionalidades totais |
|--------|---------|:---------------------:|
| v1.0 (MVP) | Todos os 10 módulos (funcionalidades Must Have) | ~42 |
| v1.1 | Complementos nos 10 módulos | ~12 |
| v2.0 | Novas capacidades (SSO, RLS, workflow) | ~8 |

---

## Histórico de Alterações

| Versão | Data      | Autor                  | Descrição                    |
|--------|-----------|------------------------|------------------------------|
| 1.0    | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1    | Jun/2026  | Vinicius Soares | Adicionados F-WS-10 e F-WS-11 (CRUD de workspaces e seletor visual de ícones) |
| 1.2    | Jun/2026  | Vinicius Soares | Adicionado F-WS-12 (aba de usuários vinculados no detalhe do workspace) |
| 1.3    | Jun/2026  | Vinicius Soares | Adicionados F-WS-13 a F-WS-15 (gerenciamento de usuários do workspace: adicionar, alterar nível, remover) |
| 1.4    | Jun/2026  | Vinicius Soares | Correção: ícones de workspace no modal de usuário passam a usar prefixo fa-solid; acessos carregados atomicamente via Promise.all e pré-populados do cache da página mãe |
| 1.5    | Jun/2026  | Vinicius Soares | Adicionados módulos implementados de favoritos, CRUD de relatórios, permissões específicas, auditoria CSV e configurações por abas |
| 1.6    | Jun/2026  | Vinicius Soares | MOD-02: descrição atualizada para home não-admin; F-DASH-02 revisado; F-DASH-10/11 (deep-link e botão desabilitado). F-WS-19/20, F-SCHED-07, F-USR-09 adicionados |
| 1.7    | Jun/2026  | Vinicius Soares | Adicionados F-DASH-12 a 14: gráficos analíticos (área, rosca, ranking de relatórios) com filtros por período e registro de acesso ao embed |

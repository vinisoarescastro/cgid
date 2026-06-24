# Priorização de Requisitos — MoSCoW

> **Documento:** 04-priorizacao/01-priorizacao-moscow.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Metodologia MoSCoW

A priorização segue o framework **MoSCoW**:

| Classificação | Descrição |
|---------------|-----------|
| 🔴 **Obrigatório** | Indispensável. O produto não funciona sem isso. Compõe o MVP. |
| 🟡 **Recomendado** | Importante, mas o MVP funciona sem. Entra na v1.1. |
| 🟢 **Opcional** | Desejável se houver tempo/orçamento. Entra na v2.0+. |
| ⚪ **Não disponível (novo)** | Fora do escopo por ora. Pode ser reavaliado em versões futuras. |

---

## 2. Obrigatório — MVP (v1.0)

> Tudo o que está aqui é **pré-requisito para o go-live**. Sem qualquer desses itens, o sistema não pode ser entregue.

### Autenticação e Segurança

- [ ] Login com e-mail e senha + JWT (access + refresh token)
- [ ] Armazenamento de senha com bcrypt (salt ≥ 12)
- [ ] Refresh token em `httpOnly cookie`
- [ ] Bloqueio automático após 5 tentativas de login inválido
- [ ] Validação de status do usuário a cada requisição
- [ ] Logout com invalidação de token
- [ ] Rate limiting por IP

### Gestão de Usuários

- [ ] CRUD completo de usuários (criar, editar, ativar, inativar, bloquear, desbloquear)
- [ ] Associação de usuários a workspaces e relatórios
- [ ] Listagem com filtros por status, workspace e perfil
- [ ] Exibição do último acesso

### Permissões (RBAC)

- [ ] Controle por perfil (Master, Administrador, Coordenador, Colaborador, Convidado)
- [ ] Matriz de permissões (Visualizar, Criar, Editar, Excluir, Exportar, Gerenciar)
- [ ] Override por usuário individual
- [ ] Controle PBI por workspace (total vs. relatórios específicos)
- [ ] Registro de alterações de permissão no log de auditoria

### Power BI Embedded

- [ ] Geração de tokens de embed exclusivamente no backend
- [ ] Renderização inline de relatórios via powerbi-client SDK
- [ ] Renovação automática de tokens antes do vencimento
- [ ] Validação de permissão RBAC antes de gerar token

### Workspaces e Relatórios

- [ ] CRUD de workspaces e relatórios
- [ ] Listagem filtrada por workspace, categoria e status
- [ ] Detalhes do workspace com tiles e estatísticas
- [ ] Relatórios `rascunho` invisíveis para Colaboradores e Convidados

### Controle de Expediente

- [ ] Configuração de horário por dia da semana
- [ ] Bloqueio padrão fora do expediente
- [ ] Grupos de exceção com janela de horário
- [ ] Exceções individuais por usuário

### Auditoria

- [ ] Log imutável (append-only) de todos os eventos relevantes
- [ ] Campos: timestamp, usuário, IP, módulo, tipo, detalhe, estado anterior/novo
- [ ] Filtros por período, usuário, módulo, tipo e IP
- [ ] Alertas de eventos críticos no dashboard

### Dashboard e UX

- [ ] Home adaptada por perfil (admin vs. colaborador)
- [ ] KPIs globais para admins
- [ ] Tela de boas-vindas personalizada
- [ ] Favoritos por usuário
- [ ] Busca de relatórios
- [ ] Interface responsiva (desktop + mobile)

### Configurações

- [ ] Configuração de credenciais Power BI (exclusivo Master)
- [ ] Indicador de ambiente (produção/homologação)

### Infraestrutura

- [ ] API REST documentada (Swagger/OpenAPI)
- [ ] Pipeline CI/CD básico (lint + testes + build)

---

## 3. Recomendado — v1.1 (Pós-MVP, Curto Prazo)

> Importante para a experiência completa, mas o MVP funciona sem. Prazo estimado: **8 semanas após o MVP**.

- [ ] Exportação de logs de auditoria em CSV
- [ ] Filtros avançados combinados nos logs
- [ ] Sincronização automática de workspaces/relatórios do PBI Service
- [ ] Relatório de IPs suspeitos
- [ ] Toggle de visibilidade da senha no login
- [ ] Histórico de alterações de permissão (estado anterior visível na UI)

---

## 4. Opcional — v2.0 (Médio Prazo)

> Desejável e agrega valor, mas não é urgente. Prazo estimado: **3–6 meses após v1.1**.

- [ ] SSO via Azure Active Directory (OIDC/OAuth2 com PKCE)
- [ ] Row-Level Security (RLS) do Power BI via username no token
- [ ] Workflow de solicitação e aprovação de acesso (self-service)
- [ ] Dashboard executivo com métricas de engajamento e uso de relatórios
- [ ] Importação em massa de usuários via CSV
- [ ] Acesso temporário com data de expiração automática
- [ ] Exportação de logs em XLSX
- [ ] Gestão de sessões ativas (visualizar e revogar sessões)
- [ ] Política de complexidade e expiração de senha configurável

---

## 5. Não disponível — Fora do escopo atual

> Não será desenvolvido nesta linha de versões sem reavaliação formal de escopo.

- [ ] App mobile nativo (iOS/Android)
- [ ] Multi-tenant para outras empresas do grupo
- [ ] Data catalog completo (linhagem, dicionário)
- [ ] Criação/edição de relatórios PBI pelo portal
- [ ] Integração com ERP (SAP, TOTVS)
- [ ] Marketplace interno de relatórios
- [ ] Relatórios BI gerados pelo próprio portal (sem Power BI)

---

## 6. Critérios de Priorização Utilizados

Para definir a priorização acima, foram considerados:

| Critério                                   | Peso  |
|--------------------------------------------|:-----:|
| Valor para o negócio / urgência            | Alto  |
| Impacto em segurança e conformidade (LGPD) | Alto  |
| Dependência técnica de outros itens        | Alto  |
| Esforço de implementação                   | Médio |
| Frequência de uso pelos usuários           | Médio |
| Risco técnico de implementação             | Médio |

---

## 7. Sugestão de Backlog Inicial (Sprints)

| Sprint   | Foco                      | Histórias incluídas                                       |
|----------|---------------------------|-----------------------------------------------------------|
| Sprint 0 | Setup e infraestrutura    | Repositório, banco, CI/CD, Azure App registration |
| Sprint 1 | Autenticação core         | RF-AUTH-01 a 07, RF-SEC-01 a 05                           |
| Sprint 2 | Usuários e permissões     | RF-USR-01 a 07, RF-PERM-01 a 05                           |
| Sprint 3 | Power BI Embedded         | RF-PBI-01 a 03, workspaces e relatórios                   |
| Sprint 4 | Expediente e exceções     | RF-SCHED-01 a 05                                          |
| Sprint 5 | Auditoria e painel admin  | RF-AUD-01 a 07, dashboard                                 |
| Sprint 6 | Configurações e ajustes   | RF-CONF-01 a 03, favoritos, busca                         |
| Sprint 7 | Qualidade e go-live       | Testes, segurança, documentação, deploy                   |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |

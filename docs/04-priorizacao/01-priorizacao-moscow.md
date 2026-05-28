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

- [x] Login com e-mail e senha + JWT (access + refresh token)
- [x] Armazenamento de senha com bcrypt (salt ≥ 12)
- [x] Refresh token em `httpOnly cookie`
- [x] Bloqueio automático após 5 tentativas de login inválido
- [x] Validação de status do usuário a cada requisição
- [x] Logout com invalidação de token
- [x] Rate limiting por IP

### Gestão de Usuários

- [x] CRUD completo de usuários (criar, editar, ativar, inativar, bloquear, desbloquear)
- [x] Associação de usuários a workspaces e relatórios
- [x] Listagem com filtros por status, workspace e perfil
- [x] Exibição do último acesso

### Permissões (RBAC)

- [x] Controle por perfil (Super Admin, Admin, Gerente, Operador, Visitante)
- [x] Matriz de permissões (Visualizar, Criar, Editar, Excluir, Exportar, Gerenciar)
- [x] Override por usuário individual
- [x] Controle PBI por workspace (total vs. relatórios específicos)
- [x] Registro de alterações de permissão no log de auditoria

### Power BI Embedded

- [x] Geração de tokens de embed exclusivamente no backend
- [x] Renderização inline de relatórios via powerbi-client SDK
- [x] Renovação automática de tokens antes do vencimento
- [x] Validação de permissão RBAC antes de gerar token

### Workspaces e Relatórios

- [x] CRUD de workspaces e relatórios
- [x] Listagem filtrada por workspace, categoria e status
- [x] Detalhes do workspace com tiles e estatísticas
- [x] Relatórios `draft` invisíveis para Operadores

### Controle de Expediente

- [x] Configuração de horário por dia da semana
- [x] Bloqueio padrão fora do expediente
- [x] Grupos de exceção com janela de horário
- [x] Exceções individuais por usuário

### Auditoria

- [x] Log imutável (append-only) de todos os eventos relevantes
- [x] Campos: timestamp, usuário, IP, módulo, tipo, detalhe, estado anterior/novo
- [x] Filtros por período, usuário, módulo, tipo e IP
- [x] Alertas de eventos críticos no dashboard

### Dashboard e UX

- [x] Home adaptada por perfil (admin vs. operador)
- [x] KPIs globais para admins
- [x] Tela de boas-vindas personalizada
- [x] Favoritos por usuário
- [x] Busca de relatórios
- [x] Interface responsiva (desktop + mobile)

### Configurações

- [x] Configuração de credenciais Power BI (exclusivo Super Admin)
- [x] Indicador de ambiente (produção/homologação)

### Infraestrutura

- [x] API REST documentada (Swagger/OpenAPI)
- [x] Pipeline CI/CD básico (lint + testes + build)

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
| Sprint 0 | Setup e infraestrutura    | Repositório, Docker, banco, CI/CD, Azure App registration |
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
# Escopo do Projeto

> **Documento:** 02-escopo/01-escopo-do-projeto.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Declaração de Escopo

O projeto compreende o desenvolvimento do **BrasilTerrenos Portal Corporativo**, uma aplicação web que centraliza o acesso a relatórios Power BI Embedded com controle granular de permissões, restrições temporais de acesso, auditoria completa e painel administrativo.

---

## 2. O que está DENTRO do Escopo

### 2.1 Versão 1.0 — MVP

| # | Item | Justificativa |
|---|------|--------------|
| E01 | Portal web responsivo (desktop e mobile) | Requisito base do sistema |
| E02 | Autenticação com e-mail/senha + JWT | Segurança mínima necessária |
| E03 | Controle de acesso baseado em perfis (RBAC) | Core do produto |
| E04 | Permissões granulares: por perfil, usuário, workspace e relatório | Diferencial do produto |
| E05 | Integração real com Power BI Embedded (token server-side) | Core do produto |
| E06 | Renderização inline de relatórios PBI no portal | Core do produto |
| E07 | Gestão de usuários (CRUD com status: ativo/inativo/bloqueado) | Gestão de acesso |
| E08 | Gestão de workspaces e relatórios (CRUD) | Gestão de ativos |
| E09 | Controle de expediente (horário de acesso por dia da semana) | Diferencial de segurança |
| E10 | Grupos de exceção ao expediente | Necessidade operacional |
| E11 | Log de auditoria imutável (append-only) | Conformidade e segurança |
| E12 | Painel administrativo com KPIs de uso e segurança | Visibilidade para admins |
| E13 | Sistema de favoritos por usuário | UX básica |
| E14 | Busca de relatórios | UX básica |
| E15 | Proteção brute force (bloqueio após 5 tentativas) | Segurança básica |
| E16 | Configurações do portal (Client ID, Tenant ID PBI) | Operação |
| E17 | Dashboard de segurança com checklist | Visibilidade operacional |
| E18 | API REST documentada (Swagger/OpenAPI) | Qualidade técnica |

### 2.2 Versão 1.1 (Pós-MVP — Curto Prazo)

| # | Item |
|---|------|
| E21 | Recuperação de senha por e-mail |
| E22 | Exportação de logs de auditoria (CSV/XLSX) |
| E23 | Filtros avançados em logs |
| E24 | Notificações por e-mail para eventos críticos |
| E25 | Sincronização automática de workspaces/relatórios do PBI Service |

### 2.3 Versão 2.0 (Médio Prazo)

| # | Item |
|---|------|
| E26 | SSO via Azure Active Directory (OIDC/OAuth2) |
| E27 | Row-Level Security (RLS) do Power BI integrado ao portal |
| E28 | Workflow de solicitação e aprovação de acesso |
| E29 | Dashboard executivo de uso com métricas de engajamento |
| E30 | Importação em massa de usuários (CSV) |
| E31 | Acesso temporário com prazo de expiração automático |

---

## 3. O que está FORA do Escopo

> Items marcados como fora de escopo podem ser reavaliados em versões futuras mediante aprovação dos stakeholders.

| # | Item | Motivo da exclusão |
|---|------|-------------------|
| FE01 | Criação ou edição de relatórios Power BI | Escopo do Power BI Desktop — fora da responsabilidade do portal |
| FE02 | Data catalog completo (linhagem de dados, dicionário) | Complexidade alta; escopo de outro produto (ex: Microsoft Purview) |
| FE03 | Multi-tenant (múltiplas empresas/filiais) | Complexidade arquitetural; escopo de v3.0+ |
| FE04 | Aplicativo mobile nativo (iOS/Android) | Portal web responsivo atende a necessidade inicial |
| FE05 | Integração com sistemas ERP (SAP, TOTVS, etc.) | Fora do domínio do portal analítico |
| FE06 | Gestão de licenças Power BI | Responsabilidade do Azure Portal / Microsoft |
| FE07 | Processamento ou transformação de dados (ETL) | Escopo do Power BI / Azure Data Factory |
| FE08 | Criação de novos relatórios PBI pelo portal | Escopo do Power BI Desktop / Service |
| FE09 | Marketplace interno de relatórios | Versão 3.0+ |
| FE10 | Integração com Microsoft Teams como canal de notificação | Versão 2.0+ |
| FE11 | App mobile nativo | Versão 3.0+ |
| FE12 | Relatórios customizados gerados pelo próprio portal (sem PBI) | Fora do escopo; requer produto de BI próprio |

---

## 4. Premissas de Escopo

- O escopo pode ser revisado ao final de cada sprint mediante aprovação formal do Product Owner.
- Mudanças de escopo após início do desenvolvimento devem passar por avaliação de impacto (prazo, custo, risco).
- O protótipo `portal_v4_8.html` serve como referência visual e funcional para todos os itens de escopo.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
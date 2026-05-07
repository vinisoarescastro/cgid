# Restrições Técnicas, Premissas e Dependências

> **Documento:** 03-requisitos/04-restricoes-premissas-dependencias.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Restrições Técnicas

Restrições são limitações impostas por fatores externos ao projeto (plataformas, APIs, regulações) que não podem ser contornadas sem mudança de escopo ou tecnologia.

| ID | Restrição | Origem | Impacto |
|----|-----------|--------|---------|
| RT-01 | Tokens de embed Power BI têm **validade máxima de 1 hora** (limitação da API Microsoft) | Microsoft Power BI API | Exige mecanismo de renovação automática de token |
| RT-02 | A geração de tokens de embed exige **Service Principal** registrado no Azure AD com permissões adequadas | Azure / Microsoft | Dependência de setup inicial no Azure Portal |
| RT-03 | A capacidade de usuários simultâneos está **limitada pela SKU de capacidade Power BI Embedded** contratada | Microsoft licensing | Pode exigir upgrade de SKU conforme crescimento |
| RT-04 | A API do Power BI REST possui **limites de throttling** (rate limit por tenant) | Microsoft Power BI API | Cache de tokens obrigatório para evitar bloqueios |
| RT-05 | Dados de usuários e logs devem ser armazenados em **território nacional** ou com garantias contratuais equivalentes (LGPD) | Lei 13.709/2018 (LGPD) | Infraestrutura cloud deve ser no Brasil ou com cláusulas DPA |
| RT-06 | O portal não pode **criar ou modificar relatórios** no Power BI Service via API pública | Restrição de design | Apenas leitura e embed; criação fica no PBI Desktop |
| RT-07 | O protótipo atual **não possui backend ou banco de dados** — toda a migração parte do zero | Estado atual do repositório | Não há dados a migrar; ambiente totalmente novo |
| RT-08 | **Row-Level Security do PBI** depende que o username passado no token de embed corresponda a uma regra RLS configurada no Power BI Desktop | Configuração no PBI | Requer alinhamento com equipe de BI para configurar RLS nos datasets |

---

## 2. Premissas

Premissas são afirmações assumidas como verdadeiras para fins de planejamento. Se uma premissa for invalidada, o projeto deve ser reavaliado.

| ID | Premissa | O que acontece se for falsa |
|----|----------|----------------------------|
| P-01 | A BrasilTerrenos já possui **licença Power BI Premium ou Power BI Embedded (A SKU)** ativa | Necessário adquirir licença antes do desenvolvimento da integração PBI — prazo impactado |
| P-02 | Existe um **Azure Active Directory (AAD) corporativo** com tenant configurado | Necessário criar/configurar AAD — adiciona semanas ao Sprint 0 |
| P-03 | A equipe tem **acesso ao Azure Portal** para registrar o Service Principal do portal | Sem acesso, integração PBI é inviável — bloqueia MVP |
| P-04 | Haverá ao menos **1 desenvolvedor backend** (Node.js/NestJS) e **1 desenvolvedor frontend** (React/TypeScript) dedicados ao projeto | Com menos recursos, o prazo do MVP deve ser revisado |
| P-05 | O design system do protótipo atual (`portal_v4_8.html`) será **mantido como base visual** — sem redesign completo | Redesign adicionaria sprint de UX ao roadmap |
| P-06 | Os **relatórios Power BI já existem** no PBI Service da organização | Se ainda precisam ser criados, há dependência do time de BI |
| P-07 | O projeto seguirá **metodologia ágil** com sprints de 2 semanas e backlog priorizado | Metodologia diferente pode exigir ajuste no roadmap |
| P-08 | Haverá **ambiente de staging** separado de produção disponível para testes antes de cada release | Sem staging, testes em produção aumentam o risco |
| P-09 | O time terá acesso a um **provedor de e-mail transacional** (SendGrid, AWS SES ou similar) para envio de notificações | Sem e-mail transacional, recuperação de senha e alertas não funcionam (v1.1) |

---

## 3. Dependências

Dependências são elementos externos dos quais o projeto depende para avançar.

### 3.1 Dependências Técnicas Essenciais (MVP)

| ID | Dependência | Tipo | Versão mínima | Responsável |
|----|-------------|------|:-------------:|------------|
| D-01 | Microsoft Power BI Embedded REST API | API externa | v1.0 | Microsoft |
| D-02 | Microsoft Azure Active Directory (Service Principal) | Serviço externo | — | Time de TI |
| D-03 | PostgreSQL | Banco de dados | 15+ | Infra |
| D-04 | Redis | Cache / Rate limiting | 7+ | Infra |
| D-05 | Node.js | Runtime backend | 20 LTS | Dev |
| D-06 | powerbi-client npm package | SDK frontend PBI | 2.x | Microsoft |
| D-07 | @azure/identity npm package | Autenticação Azure | 4.x | Microsoft |

### 3.2 Dependências para v1.1+

| ID | Dependência | Para que | Prazo |
|----|-------------|---------|-------|
| D-08 | Provedor de e-mail transacional (SendGrid / AWS SES) | Recuperação de senha, alertas | v1.1 |
| D-09 | Biblioteca TOTP (speakeasy ou @otplib/core) | MFA para admins | v1.1 |

### 3.3 Dependências para v2.0+

| ID | Dependência | Para que | Prazo |
|----|-------------|---------|-------|
| D-10 | Azure AD com OpenID Connect habilitado | SSO corporativo | v2.0 |
| D-11 | Configuração de Row-Level Security nos datasets PBI | RLS integrado ao portal | v2.0 |

### 3.4 Dependências Organizacionais

| ID | Dependência | Responsável | Prazo crítico |
|----|-------------|------------|:-------------:|
| D-ORG-01 | Aprovação do DPO para tratamento de dados conforme LGPD | DPO / Jurídico | Antes do go-live |
| D-ORG-02 | Definição dos workspaces e relatórios a serem cadastrados inicialmente | Gestores + TI | Sprint 3 |
| D-ORG-03 | Lista de usuários iniciais com perfis e departamentos | RH / TI | Sprint 2 |
| D-ORG-04 | Credenciais do Service Principal Azure (Client ID, Tenant ID, Secret) | Azure Admin / TI | Sprint 0 |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
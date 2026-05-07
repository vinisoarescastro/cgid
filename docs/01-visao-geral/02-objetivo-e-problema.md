# Objetivo, Problemas e Necessidades do Negócio

> **Documento:** 01-visao-geral/02-objetivo-e-problemas.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Objetivo Principal do Sistema

O **BrasilTerrenos Portal Corporativo** tem como missão ser a **camada de governança e consumo unificado de inteligência analítica** da organização, provendo:

> *"Uma plataforma web centralizada que controla, de forma granular e auditável, o acesso dos colaboradores aos relatórios Power BI Embedded, aplicando políticas de segurança corporativa, gestão de identidade baseada em perfis (RBAC), restrições temporais de acesso e rastreabilidade completa de todas as operações realizadas no sistema."*

### 1.1 Objetivos Específicos

| # | Objetivo | Justificativa |
|---|----------|--------------|
| OBJ-01 | Centralizar o acesso a todos os relatórios PBI em um único portal | Eliminar acesso direto ao Power BI Service sem controle intermediário |
| OBJ-02 | Implementar controle de acesso granular por perfil, usuário, workspace e relatório | Garantir princípio do menor privilégio |
| OBJ-03 | Restringir o acesso ao portal dentro do horário de expediente configurável | Reduzir janela de risco de acesso fora do horário monitorado |
| OBJ-04 | Registrar trilha de auditoria imutável de todas as operações | Conformidade com LGPD e políticas internas de governança |
| OBJ-05 | Prover painel administrativo para gestão autônoma de acessos | Reduzir dependência de TI para provisionamento/revogação de acessos |
| OBJ-06 | Oferecer experiência de usuário moderna, responsiva e intuitiva | Maximizar adoção e reduzir tempo de treinamento |

---

## 2. Problemas que o Sistema Pretende Resolver

### 2.1 Mapa de Problemas

| ID | Problema | Afeta quem | Impacto | Causa Raiz |
|----|----------|-----------|---------|-----------|
| P01 | Acesso indiscriminado a relatórios sensíveis por usuários não autorizados | Compliance, Diretoria | 🔴 Crítico | Ausência de camada de controle entre usuário e Power BI Service |
| P02 | Colaboradores acessam relatórios fora do horário comercial sem controle | TI, Compliance | 🔴 Alto | Power BI Service não oferece controle de expediente nativo |
| P03 | Impossibilidade de rastrear quem acessou, alterou ou exportou dados analíticos | Compliance, Jurídico | 🔴 Alto | Ausência de log de auditoria centralizado |
| P04 | Processo manual e lento de provisionamento/revogação de acessos | TI, RH | 🟡 Médio | Dependência de chamados manuais ao time de TI |
| P05 | Gestores sem visibilidade sobre os relatórios disponíveis para sua equipe | Gerentes | 🟡 Médio | Ausência de catálogo de relatórios por departamento |
| P06 | Dificuldade de demonstrar conformidade com LGPD no manuseio de dados analíticos | Jurídico, DPO | 🔴 Alto | Falta de registro de acessos e base legal para processamento |
| P07 | Experiência de usuário fragmentada (múltiplos portais/links para relatórios) | Todos os usuários | 🟢 Baixo | Ausência de ponto único de acesso |
| P08 | Impossibilidade de conceder acesso temporário de forma controlada | TI, Gestores | 🟡 Médio | Sem mecanismo de acesso temporário com janela de validade |

### 2.2 Árvore de Causas e Efeitos

```
Problema Central: Governança insuficiente sobre o acesso a dados analíticos
│
├── Causas
│   ├── Ausência de camada de controle entre usuário e Power BI Service
│   ├── Power BI Service não atende requisitos de expediente e exceções
│   ├── Processos manuais de provisionamento de acesso
│   └── Ausência de ferramenta de auditoria centralizada
│
└── Efeitos
    ├── Risco de vazamento de dados financeiros e estratégicos
    ├── Não conformidade com LGPD
    ├── Gargalo operacional no time de TI
    ├── Dificuldade de demonstrar compliance em auditorias
    └── Baixa produtividade dos colaboradores (UX fragmentada)
```

---

## 3. Necessidades do Negócio

### 3.1 Necessidades Imediatas (Curto Prazo — Pré MVP)

| ID | Necessidade | Prioridade |
|----|-------------|-----------|
| NEG-01 | Portal único para acesso a todos os relatórios PBI da organização | 🔴 Alta |
| NEG-02 | Controle de quem pode ver qual relatório (por perfil e por indivíduo) | 🔴 Alta |
| NEG-03 | Bloqueio automático de acesso fora do horário de expediente | 🔴 Alta |
| NEG-04 | Trilha de auditoria completa e pesquisável de todos os eventos | 🔴 Alta |
| NEG-05 | Capacidade de bloquear/desbloquear usuários de forma imediata | 🔴 Alta |
| NEG-06 | Recuperação de senha self-service (sem dependência de TI) | 🟡 Média |

### 3.2 Necessidades Estratégicas (Médio Prazo — v1.1 e v2.0)

| ID | Necessidade | Prioridade |
|----|-------------|-----------|
| NEG-07 | Conformidade documentada com LGPD (base legal, minimização, retenção) | 🔴 Alta |
| NEG-08 | Login único (SSO) via Azure Active Directory corporativo | 🟡 Média |
| NEG-09 | Self-service de solicitação de acesso com workflow de aprovação | 🟡 Média |
| NEG-10 | Dashboard executivo com métricas de uso e engajamento dos relatórios | 🟡 Média |
| NEG-11 | MFA obrigatório para perfis administrativos | 🟡 Média |

### 3.3 Necessidades de Evolução (Longo Prazo — v3.0+)

| ID | Necessidade | Prioridade |
|----|-------------|-----------|
| NEG-12 | Suporte multi-tenant para filiais ou empresas do grupo | 🟢 Baixa |
| NEG-13 | Data catalog com metadados, linhagem e dicionário de relatórios | 🟢 Baixa |
| NEG-14 | API pública para integração com outros sistemas corporativos | 🟢 Baixa |
| NEG-15 | Relatórios de conformidade exportáveis para auditores externos | 🟡 Média |

---

## 4. Proposta de Valor

O portal resolve uma necessidade latente em empresas que usam Power BI como plataforma de BI corporativo mas precisam de uma camada de controle que o Power BI Service não oferece nativamente:

| Problema atual sem o portal | Solução com o portal |
|---------------------------|---------------------|
| Acesso direto ao PBI sem controle | Acesso mediado pelo portal com validação RBAC server-side |
| Sem restrição de horário | Controle de expediente configurável com grupos de exceção |
| Sem histórico de quem acessou o quê | Log de auditoria imutável com todos os eventos |
| Provisionamento manual via TI | Auto-provisionamento por admins via interface web |
| UX do Power BI Service (complexa) | UX simplificada e contextualizada para cada perfil |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
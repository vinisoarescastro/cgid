# Stakeholders e Público-Alvo

> **Documento:** 01-visao-geral/03-stakeholders-e-publico-alvo.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Público-Alvo

O sistema atende dois grupos distintos de usuários com necessidades e contextos de uso completamente diferentes:

### Grupo A — Usuários Consumidores (Operadores e Gerentes)

São os colaboradores da BrasilTerrenos que utilizam o portal para **visualizar relatórios analíticos** do seu departamento. Possuem pouca familiaridade com ferramentas de BI e esperam uma experiência simples, focada e sem ruído. Para eles, o portal deve funcionar como um "painel de vidro" transparente para os dados do seu trabalho.

**Perfil típico:**
- Acessa o portal diariamente ou algumas vezes por semana
- Não tem conhecimento técnico avançado
- Usa principalmente computadores desktop corporativos, mas pode acessar via celular
- Está habituado ao ecossistema Microsoft (Outlook, Teams)
- Tempo de treinamento esperado: **menos de 30 minutos**

### Grupo B — Usuários Administrativos (Admins e Super Admin)

São os profissionais de TI, compliance e gestão que **administram o portal**: provisionam e revogam acessos, configuram permissões, monitoram eventos de segurança e extraem logs de auditoria. Para eles, o portal deve oferecer ferramentas poderosas, rápidas e auditáveis.

**Perfil típico:**
- Acessa o módulo administrativo com menor frequência, mas realiza ações críticas
- Tem conhecimento técnico moderado a avançado
- Precisa de eficiência: ações em poucos cliques
- Precisa de confiança: confirmações antes de ações destrutivas
- Exporta dados regularmente para relatórios de compliance

---

## 2. Perfis de Usuário do Sistema

| Perfil | Descrição | Quantidade estimada |
|--------|-----------|:-------------------:|
| **Super Admin** | Responsável pela configuração global do portal: integração PBI, políticas de segurança, gestão da aplicação | 1–2 |
| **Admin** | Gestor de TI ou compliance: gerencia usuários, permissões e workspaces | 3–10 |
| **Gerente** | Líder departamental: visualiza relatórios do seu workspace, acompanha KPIs da equipe | 10–30 |
| **Operador** | Colaborador operacional: consome relatórios autorizados do seu workspace | 50–500 |
| **Visitante** | Acesso temporário (ex: auditores externos, consultores): visualização restrita com prazo definido | Variável |

---

## 3. Stakeholders

### 3.1 Stakeholders Internos

| Stakeholder | Papel no projeto | Interesse principal | Nível de influência |
|-------------|-----------------|---------------------|:-------------------:|
| **Diretoria Executiva** | Patrocinador / Decisor | ROI, conformidade e redução de risco de vazamento de dados | 🔴 Alto |
| **TI / Infraestrutura** | Executor técnico e operador | Operação estável, segurança da integração Azure/PBI | 🔴 Alto |
| **Compliance / Jurídico** | Aprovador de políticas | LGPD, auditoria, políticas de acesso e retenção de dados | 🔴 Alto |
| **RH / Administrativo** | Usuário admin + provisionamento | Provisionamento ágil de novos colaboradores | 🟡 Médio |
| **Gestores Departamentais** | Usuário final avançado | Acesso rápido a relatórios, visibilidade da equipe | 🟡 Médio |
| **Colaboradores** | Usuário final | Facilidade de acesso aos relatórios do dia a dia | 🟢 Baixo |
| **Equipe de Desenvolvimento** | Executor técnico | Clareza de requisitos, arquitetura bem definida, prazos realistas | 🔴 Alto |
| **DPO (Data Protection Officer)** | Guardião da LGPD | Minimização de dados, base legal, direitos dos titulares | 🟡 Médio |

### 3.2 Stakeholders Externos

| Stakeholder | Tipo | Interesse | Nível de influência |
|-------------|------|-----------|:-------------------:|
| **Microsoft (Power BI)** | Fornecedor | SLA de disponibilidade, limites de API, licenciamento | 🟡 Médio |
| **Microsoft Azure** | Fornecedor | SLA de infraestrutura, limites de AAD, billing | 🟡 Médio |
| **Auditores Externos** | Regulatório | Acesso a logs e relatórios de conformidade exportados | 🟢 Baixo |
| **ANPD** | Regulatório | Conformidade com LGPD | 🟡 Médio (indireto) |

---

## 4. Mapa de Necessidades por Stakeholder

| Stakeholder | O que precisam do sistema |
|-------------|--------------------------|
| Diretoria | Dashboard com KPIs de segurança; relatórios executivos de conformidade |
| TI | Logs detalhados; alertas de segurança; configuração técnica centralizada |
| Compliance | Exportação de logs; trilha de auditoria; gestão de exceções documentada |
| RH | Interface simples para criar/desativar usuários ao contratar/demitir |
| Gestores | Acesso aos relatórios do departamento; visão dos membros da equipe |
| Colaboradores | Portal rápido, simples e sem atrito para acessar relatórios |
| Desenvolvedores | Documentação clara; ambiente de desenvolvimento reproduzível; API bem definida |
| Auditores Externos | Exportação de logs filtrados; relatório de conformidade LGPD |

---

## 5. Mapa de Comunicação Sugerido

| Canal | Audiência | Frequência | Conteúdo |
|-------|-----------|:----------:|---------|
| Reunião de alinhamento | Diretoria + TI | Quinzenal (fase de desenvolvimento) | Status do projeto, riscos, decisões |
| E-mail de status | Todos os stakeholders internos | Semanal | Resumo do progresso, próximos passos |
| Workshop de validação | Gestores + Compliance | Por sprint (a cada 2 semanas) | Demonstração e validação de funcionalidades |
| Documentação técnica | Equipe de desenvolvimento | Contínuo | Este repositório de documentação |
| Release notes | Usuários finais (admins) | A cada release | O que mudou, como usar |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
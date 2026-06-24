# Roadmap do Projeto

> **Documento:** 09-roadmap/01-roadmap.md  
> **Status:** Em andamento  
> **Criado em:** Maio/2026  
> **Atualizado em:** Junho/2026

---

## 1. Visão Geral do Roadmap

```
Sprint 0    Sprint 1-2    Sprint 3    Sprint 4    Sprint 5    Sprint 6    Sprint 7
│           │             │           │           │           │           │
▼           ▼             ▼           ▼           ▼           ▼           ▼
Setup    Auth + Users   PBI Embed   Expediente   Auditoria   Config     Go-Live
Infra    Permissões     Workspaces  Exceções     Dashboard   Ajustes    MVP v1.0
         
         ────────────────── MVP v1.0 (14 semanas) ──────────────────────────▶

         ┌─── v1.1 (6-8 semanas pós-MVP) ───┐    ┌── v2.0 (3-6 meses) ──┐
         │ Recuperação de senha, MFA, CSV   │    │ SSO Azure AD, RLS    │
         │ Exportação, Notificações e-mail  │    │ Workflow aprovação   │
         └──────────────────────────────────┘    └──────────────────────┘
```

---

## 2. Sprint 0 — Setup e Infraestrutura (2 semanas)

**Objetivo:** Preparar toda a base técnica e organizacional antes de iniciar o desenvolvimento de funcionalidades.

**Status:** ✅ Parcialmente concluído — itens de desenvolvimento prontos; itens de infra/Azure pendentes de TI.

### Entregáveis

| Item | Descrição | Status |
|------|-----------|--------|
| ✅ Repositório configurado | Monorepo com frontend/ e backend/ | Concluído |
| ✅ Estrutura do frontend | pages/, styles/, routes/, components/ | Concluído |
| ✅ Modelos SQLAlchemy | 14 tabelas conforme documentação de modelagem | Concluído |
| ✅ Seed de desenvolvimento | Usuários, workspaces, relatórios, permissões, expediente, configs | Concluído |
| ✅ Banco de dados (dev) | SQLite — zero configuração, arquivo `cgid.db` | Concluído |
| ✅ Tela de login | Autenticação real contra o banco, bloqueio após 5 tentativas | Concluído |
| ✅ Tela Home (dashboard) | KPIs, eventos recentes e tabela de workspaces com dados reais da API | Concluído |
| ✅ README de onboarding | Setup em < 5 min documentado | Concluído |
| ⏳ CI/CD básico | GitHub Actions: lint, testes, build | Pendente |
| ⏳ App Registration Azure | Service Principal com permissões PBI | Pendente (TI) |
| ⏳ Power BI workspace | Workspaces de desenvolvimento no PBI Service | Pendente (TI) |
| ⏳ Ambientes cloud | Staging e Produção provisionados | Pendente (Infra) |
| ⏳ Chave JWT | Chave secreta para assinatura HS256 | Pendente (Sprint 1-2) |

### Critério de conclusão do Sprint 0
> Backend e frontend iniciam com `uvicorn` e `npm run dev`; `GET /` retorna 200; seed executado com sucesso; login funcional com dados reais do banco. ✅

---

## 3. Sprint 1-2 — Autenticação, Usuários e Permissões (4 semanas)

**Objetivo:** Núcleo de segurança e gestão de identidade.

### Funcionalidades

| # | Feature | Módulo |
|---|---------|--------|
| 1 | Login com e-mail/senha (JWT HS256) | Auth |
| 2 | Refresh token automático (httpOnly cookie) | Auth |
| 3 | Logout com revogação da sessão no SQL Server | Auth |
| 4 | Bloqueio automático após 5 tentativas | Auth |
| 5 | Rate limiting por IP | Auth |
| 6 | Tela de boas-vindas personalizada por perfil | Frontend |
| 7 | CRUD de usuários (Admin) | Users |
| 8 | Status de usuário: ativar, inativar, bloquear, desbloquear | Users |
| 9 | Matriz de permissões por perfil | Permissions |
| 10 | Override de permissão por usuário individual | Permissions |
| 11 | Dependências/guards FastAPI: autenticação, perfil e permissões | Backend |
| 12 | Headers de segurança via middleware FastAPI | Backend |
| 13 | Hash bcrypt nas senhas | Auth |

### Critério de conclusão
> Usuário consegue fazer login; token expira em 1h; refresh funciona via cookie httpOnly e sessão no SQL Server; 5 tentativas bloqueiam a conta; RBAC impede acesso de Colaborador a módulos Admin.

---

## 4. Sprint 3 — Power BI Embedded e Workspaces (2 semanas)

**Objetivo:** Integração real com Power BI; renderização de relatórios inline.

### Funcionalidades

| # | Feature | Módulo |
|---|---------|--------|
| 1 | Geração de token de embed server-side (Azure AD + PBI API) | PBI |
| 2 | Estratégia de cache/renovação de tokens PBI sem expor credenciais ao frontend | PBI |
| 3 | Renderização inline via powerbi-client SDK | Frontend / PBI |
| 4 | Renovação automática de token de embed | PBI |
| 5 | CRUD de workspaces (Admin) | Workspaces |
| 6 | CRUD de relatórios (Admin) | Reports |
| 7 | Listagem de workspaces filtrada por perfil | Workspaces |
| 8 | Detalhes do workspace com tiles e relatórios | Workspaces |
| 9 | Filtros de relatórios (workspace, categoria, status) | Reports |
| 10 | Relatórios `rascunho` invisíveis para Colaborador | Reports |
| 11 | Favoritos (marcar/desmarcar/listar) | Favorites |
| 12 | Associação usuário → workspace → relatórios (Admin) | Permissions |

### Critério de conclusão
> Usuário abre relatório e vê embed do PBI sem erros; token PBI gerado apenas no backend; relatório rascunho invisível para Colaborador.

---

## 5. Sprint 4 — Controle de Expediente e Exceções (2 semanas)

**Objetivo:** Restrição temporal de acesso com grupos de exceção.

### Funcionalidades

| # | Feature | Módulo |
|---|---------|--------|
| 1 | Configuração de horário por dia da semana | Schedule |
| 2 | Toggle de bloqueio fora do expediente | Schedule |
| 3 | ScheduleGuard validando a cada login | Auth / Schedule |
| 4 | Grupos de exceção (CRUD + membros) | Exception Groups |
| 5 | Exceções individuais por usuário | Exception Groups |
| 6 | Ativação/desativação de exceções | Exception Groups |
| 7 | Mensagem de bloqueio por expediente na tela de login | Frontend / Auth |

### Critério de conclusão
> Login bloqueado fora do expediente para usuário sem exceção; membro de grupo de exceção acessa dentro da janela; log registra acesso negado por expediente.

---

## 6. Sprint 5 — Auditoria e Painel Administrativo (2 semanas)

**Objetivo:** Visibilidade operacional e conformidade.

### Funcionalidades

| # | Feature | Módulo |
|---|---------|--------|
| 1 | Log de auditoria imutável (append-only com trigger) | Audit |
| 2 | Registro automático de todos os eventos relevantes | Audit (transversal) |
| 3 | Listagem de logs paginada com filtros | Audit |
| 4 | Detalhe expandido do evento | Audit |
| 5 | Alertas de eventos críticos no dashboard | Dashboard / Audit |
| 6 | Painel gerencial com KPIs globais | Dashboard |
| 7 | Status dos serviços integrados | Dashboard |
| 8 | Home adaptada por perfil (admin vs. colaborador) | Dashboard |
| 9 | Gráfico de área "Acessos ao longo do tempo" com filtros por período (diário/semanal/mensal) | Dashboard |
| 10 | Gráfico de rosca "Distribuição por Workspace" com labels e cores do workspace | Dashboard |
| 11 | Ranking "Top Relatórios Acessados" com filtros por período e cores do workspace | Dashboard |
| 9 | Painel de segurança com checklist | Security |
| 10 | Health checks (`/saude`, `/saude/banco`) | Backend |

### Critério de conclusão
> Todos os eventos de login, bloqueio, alteração de permissão e acesso PBI registrados no log; filtros funcionando; dashboard exibe KPIs corretos.

---

## 7. Sprint 6 — Configurações, Busca e Refinamentos (2 semanas)

**Objetivo:** Fechar funcionalidades restantes do MVP e polir experiência.

### Funcionalidades

| # | Feature | Módulo |
|---|---------|--------|
| 1 | Configurações do sistema (Master) | Settings |
| 2 | Configuração de credenciais PBI com botão "Testar" | Settings |
| 3 | Indicador de ambiente (produção/homologação) | Global |
| 4 | Busca global de relatórios | Reports |
| 5 | Breadcrumbs de navegação | Frontend / Layout |
| 6 | Respostas de erro padronizadas com handlers de exceção FastAPI | Backend |
| 7 | Documentação OpenAPI (Swagger) completa | Backend |
| 8 | Variáveis de ambiente validadas no startup (Pydantic Settings) | Backend |

### Critério de conclusão
> Master configura PBI e testa conexão; todos os endpoints documentados no Swagger; busca de relatório funciona.

---

## 8. Sprint 7 — Qualidade, Segurança e Go-Live (2 semanas)

**Objetivo:** Garantir qualidade, segurança e deploy em produção.

### Atividades

| # | Atividade |
|---|-----------|
| 1 | Cobertura de testes ≥ 70% (unitários + integração) |
| 2 | Testes E2E cobrindo fluxos críticos (login, visualizar relatório, alterar permissão) |
| 3 | Revisão de segurança: OWASP checklist, `npm audit`, headers HTTP |
| 4 | Pen test interno ou por empresa especializada |
| 5 | Aprovação formal do DPO (LGPD) |
| 6 | Deploy em staging + UAT com stakeholders-chave |
| 7 | Configuração de monitoramento (alertas, dashboards Grafana/AppInsights) |
| 8 | Runbook de operação (como fazer deploy, rollback, backup, restore) |
| 9 | Treinamento dos administradores |
| 10 | Go-live em produção com acompanhamento |

### Critério de conclusão do MVP
> Portal em produção; Master cadastrado; primeiros usuários onboardados; monitoramento ativo.

---

## 9. Versão 1.1 — Pós-MVP (6–8 semanas)

**Foco:** Completar a experiência de segurança e conformidade.

| Feature | Justificativa |
|---------|--------------|
| Recuperação de senha por e-mail | Eliminar dependência do TI para reset de senha |
| MFA (TOTP) para Administrador e Master | Segurança adicional para perfis privilegiados |
| Exportação de logs em CSV | Relatórios de compliance para auditorias |
| Sincronização automática de workspaces/relatórios do PBI | Reduzir esforço de manutenção do catálogo |
| Notificações por e-mail em eventos críticos | Resposta rápida a incidentes |
| Filtros avançados combinados nos logs | Melhor usabilidade para compliance |

---

## 10. Versão 2.0 — Médio Prazo (3–6 meses pós-v1.1)

**Foco:** Capacidades enterprise e self-service.

| Feature | Justificativa |
|---------|--------------|
| SSO via Azure Active Directory (OIDC) | Eliminar senha separada; UX melhorada; política corporativa |
| Row-Level Security (RLS) via token PBI | Segurança de dados no nível do relatório por usuário |
| Workflow de solicitação e aprovação de acesso | Self-service; reduzir dependência do Admin |
| Dashboard executivo com métricas de engajamento | Visibilidade para diretoria sobre uso dos dados |
| Importação em massa de usuários (CSV) | Facilitar onboarding em crescimento |
| Acesso temporário com expiração automática | Flexibilidade para auditores e consultores |

---

## 11. Versão 3.0 — Longo Prazo (6–12 meses pós-v2.0)

**Foco:** Crescimento da plataforma e capacidades avançadas.

| Feature | Justificativa |
|---------|--------------|
| Suporte multi-tenant (filiais / empresas do grupo) | Expansão para outras entidades |
| Data catalog (metadados, linhagem, dicionário) | Governança avançada de dados |
| API pública documentada | Integração com outros sistemas corporativos |
| Relatório de conformidade LGPD exportável | Para auditores externos e ANPD |
| Aplicativo mobile nativo (iOS/Android) | Acesso mobile nativo para relatórios frequentes |

---

## 12. Riscos do Roadmap

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:------------:|:-------:|-----------|
| Atraso no setup Azure (Service Principal) | Média | 🔴 Alto | Iniciar setup no Sprint 0; dependência crítica mapeada |
| Complexidade da integração PBI Embedded | Média | 🟡 Médio | PoC de embed no Sprint 0 antes das outras features |
| Equipe pequena (1 backend + 1 frontend) | Alta | 🟡 Médio | Priorização rígida; cortar Should Have se necessário |
| Mudança de escopo durante o desenvolvimento | Alta | 🟡 Médio | Change request formal obrigatório; revisão do impacto |
| Problemas de licença PBI (SKU insuficiente) | Baixa | 🔴 Alto | Confirmar SKU na Fase 0 com equipe Microsoft/parceiro |
| Conformidade LGPD não aprovada no prazo | Baixa | 🟡 Médio | Iniciar processo com DPO no Sprint 0 |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |

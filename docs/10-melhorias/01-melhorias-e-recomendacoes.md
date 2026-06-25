# Melhorias Técnicas e Organizacionais

> **Documento:** 10-melhorias/01-melhorias-e-recomendacoes.md  
> **Status:** Em andamento  
> **Criado em:** Maio/2026  
> **Atualizado em:** 2026-06-25

---

## 1. Status das Melhorias Implementadas (v2.0)

Os itens abaixo foram identificados como pendentes e foram implementados na v2.0:

| Item | Descrição | Status |
|------|-----------|--------|
| Backend modular | `main.py` dividido em routers/, services/, dependencies.py | ✅ Implementado |
| Schemas centralizados | Todos os schemas Pydantic em `schemas.py` | ✅ Implementado |
| Alembic | Migrações de banco configuradas (migration 60fc08a85566) | ✅ Implementado |
| Departamentos | Nova tabela + CRUD + vínculo com usuários | ✅ Implementado |
| Categorias de relatório | Nova tabela + CRUD + FK em relatorios | ✅ Implementado |
| Perfis (metadados) | Nova tabela com nivel_hierarquia e nome_exibicao | ✅ Implementado |
| Credenciais PBI | Nova tabela + gestão via interface administrativa | ✅ Implementado |
| Pacotes de permissão | Substituem sobrescritas individuais; reutilizáveis | ✅ Implementado |
| Token de sessão opaco | SHA-256 em sessoes_autenticacao (sem JWT) | ✅ Implementado |
| CASCADE correto | membros_grupo_excecao.usuario_id agora CASCADE | ✅ Implementado |

---

## 1.1 Melhorias Pendentes (backlog técnico)

| Área | Melhoria pendente | Prioridade |
|------|------------------|-----------|
| Segurança | Rate limiting por IP no login | Alta |
| Segurança | Headers HTTP de segurança (HSTS, CSP, X-Frame-Options) via middleware | Alta |
| Frontend | Tratamento de erros de rede mais robusto (retry, offline state) | Média |
| Frontend | React.lazy() para módulos administrativos (code splitting) | Baixa |
| Backend | Pydantic Settings para validação de variáveis de ambiente no startup | Média |
| Backend | Health check endpoints (/saude, /saude/banco) | Média |
| Testes | Testes unitários e de integração (pytest) | Alta |

---

## 2. Melhorias de Processo e Organização

### 2.1 Gestão do Repositório

| Prática | Descrição | Prioridade |
|---------|-----------|-----------|
| **Branch Protection** | Proteger `main` e `develop`: PR obrigatório, 1 aprovação, CI verde | Imediato |
| **Pull Request Template** | Template com checklist: testes, documentação, breaking changes | Sprint 0 |
| **Conventional Commits** | `feat:`, `fix:`, `chore:`, `docs:` — gera CHANGELOG automático | Sprint 0 |
| **CODEOWNERS** | Definir donos de código por área (ex: @devs-backend para /backend) | Sprint 0 |
| **Issue Templates** | Templates para bug report, feature request, segurança | Sprint 0 |
| **Versioning Semântico** | Tags `v1.0.0` em releases via GitHub Releases | Sprint 7 |
| **.gitignore rigoroso** | `.env`, `*.pem`, `*.key`, `node_modules`, `dist` | Imediato |

### 2.2 Qualidade de Código

| Prática | Ferramenta | Quando |
|---------|-----------|--------|
| Linting obrigatório no CI | ESLint (sem warnings em produção) | Sprint 0 |
| Formatação automática | Prettier + pre-commit hook via Husky | Sprint 0 |
| Type checking no CI | `tsc --noEmit` | Sprint 0 |
| Code review obrigatório | GitHub Branch Protection | Sprint 0 |
| Cobertura de testes mínima | Jest --coverage (threshold 70%) | Sprint 7 |
| Análise estática de segurança | `npm audit`, CodeQL (GitHub Advanced Security) | Sprint 0 |
| SonarQube / SonarCloud | Análise de qualidade (code smells, duplicações, dívida técnica) | Sprint 3+ |

### 2.3 Documentação Técnica

| Item | Descrição | Onde |
|------|-----------|------|
| README de onboarding | Setup em < 5 min para novo dev | `/README.md` |
| API Swagger | 100% dos endpoints documentados | Auto-gerado pelo FastAPI/OpenAPI |
| ADRs (Architecture Decision Records) | Decisões arquiteturais importantes registradas | `/docs/adr/` |
| Changelog | CHANGELOG.md atualizado a cada release | `/CHANGELOG.md` |
| Runbook de operação | Como fazer deploy, rollback, backup | `/docs/runbook/` |
| Glossário | Termos do domínio (workspace, embed token, etc.) | `/docs/glossario.md` |

---

## 3. Riscos Técnicos e de Negócio

### 3.1 Riscos Técnicos

| ID | Risco | Probabilidade | Impacto | Mitigação |
|----|-------|:------------:|:-------:|-----------|
| RT-01 | Complexidade da integração Power BI Embedded (throttling, expiração de tokens) | Média | 🔴 Alto | PoC de embed antes do Sprint 3; cache temporário de tokens no backend |
| RT-02 | Performance insuficiente com muitos usuários simultâneos | Baixa | 🟡 Médio | Testes de carga no Sprint 7; escalar horizontalmente se necessário |
| RT-03 | Banco de dados lento para consultas de `logs_auditoria` com milhões de registros | Média | 🟡 Médio | Índices adequados; paginação server-side; particionamento por data em v2.0 |
| RT-04 | Dívida técnica acumulada por pressa no desenvolvimento | Alta | 🟡 Médio | Code review obrigatório; não pular testes; debt sprints mensais |
| RT-05 | Rotatividade de desenvolvedores sem documentação adequada | Média | 🟡 Médio | Documentação técnica atualizada; pair programming; coding standards |
| RT-06 | Vulnerabilidade de segurança não detectada | Baixa | 🔴 Crítico | SAST no CI; pen test antes do go-live; atualizações de dependências mensais |
| RT-07 | Mudança breaking na API do Power BI | Baixa | 🟡 Médio | Monitorar changelog da Microsoft; versão da API fixada nos headers |
| RT-08 | Expiração do Client Secret Azure sem aviso | Baixa | 🔴 Alto | Alerta 60 dias antes; documentar processo de rotação |

### 3.2 Riscos de Negócio

| ID | Risco | Probabilidade | Impacto | Mitigação |
|----|-------|:------------:|:-------:|-----------|
| RN-01 | Baixa adoção pelos usuários finais | Média | 🟡 Médio | UX simples; treinamento; suporte no primeiro mês |
| RN-02 | Não conformidade com LGPD identificada em auditoria | Baixa | 🔴 Alto | Aprovação formal do DPO antes do go-live |
| RN-03 | Custo de infraestrutura e licença PBI Embedded acima do esperado | Média | 🟡 Médio | Estimar custos antes do Sprint 0; plan B: SKU menor com menos usuários simultâneos |
| RN-04 | Mudança de escopo durante o desenvolvimento | Alta | 🟡 Médio | Processo formal de change request; Product Owner dedicado |
| RN-05 | Resistência de usuários administradores à nova ferramenta | Baixa | 🟢 Baixo | Envolvê-los no UAT; coletar feedback desde o Sprint 3 |
| RN-06 | Dependência de fornecedor Microsoft (vendor lock-in) | Alta | 🟢 Baixo | Aceitável dado o contexto; documentar dependências |

---

## 4. Recomendações para o Time de Desenvolvimento

### 4.1 Boas Práticas de Desenvolvimento

**Backend:**
- Todo endpoint com schemas Pydantic — nunca confiar em dados do cliente
- Toda exceção de negócio com `HttpException` semântica (não `500` para erros de validação)
- Usar transações do SQLAlchemy para operações que afetam múltiplas tabelas
- Serviço de auditoria chamado explicitamente (não via interceptor automático) — mais controle
- Nunca retornar `hash_senha` em resposta de API (usar schemas Pydantic de saída)

**Frontend:**
- Nunca armazenar token em localStorage (usar apenas memória React + cookie httpOnly)
- Toda página admin com guard de rota (`<AdminRoute>`)
- Estados de loading e erro explícitos em toda chamada de API
- `React.lazy()` para todos os módulos administrativos
- Validar formulários com React Hook Form + Yup

**Geral:**
- Nenhum `TODO` ou `FIXME` pode ir para a `main` sem issue associada
- Nenhum `console.log` em código de produção (usar pino logger no backend)
- Variáveis de ambiente validadas no startup (falhar rápido se faltarem)

### 4.2 Processo de Code Review

**Checklist obrigatório para aprovação de PR:**

```
Funcionalidade:
[ ] Funcionalidade implementada conforme a user story / task
[ ] Testes unitários escritos para a nova lógica
[ ] Casos de borda tratados

Qualidade:
[ ] Sem variáveis não utilizadas
[ ] Sem comentários desnecessários
[ ] Nomes de variáveis/funções descritivos

Segurança:
[ ] Sem segredos ou credenciais no código
[ ] Inputs validados no backend
[ ] Autorização verificada (guard adequado no endpoint)

Performance:
[ ] Sem N+1 queries no banco
[ ] Cache utilizado onde relevante
[ ] Paginação implementada em listagens

Documentação:
[ ] Swagger atualizado se novo endpoint criado
[ ] README atualizado se setup mudou
```

### 4.3 Definition of Done (DoD)

Um item do backlog está "Pronto" apenas quando:

1. ✅ Código implementado seguindo os padrões do projeto
2. ✅ Testes unitários escritos e passando
3. ✅ Code review aprovado por ao menos 1 colega
4. ✅ CI/CD verde (lint, testes, build)
5. ✅ Deployado em staging
6. ✅ Demonstrado e aprovado pelo Product Owner
7. ✅ Documentação atualizada (se necessário)
8. ✅ Critérios de aceite da user story verificados

---

## 5. Sugestões de Melhorias Futuras (Backlog de Ideias)

> Itens fora do escopo atual, mas que podem ser avaliados conforme o produto evolui.

| Ideia | Benefício | Esforço |
|-------|-----------|:-------:|
| Modo escuro (dark mode) | UX para usuários que trabalham em ambientes escuros | Baixo |
| Notificações in-app em tempo real (WebSocket) | Alertas de segurança sem precisar recarregar | Médio |
| Report Viewer com anotações | Usuários comentam diretamente no relatório | Alto |
| Histórico de versões de permissões | Auditoria mais granular: ver quem tinha acesso quando | Médio |
| Relatório de ROI de uso dos dashboards | Mostrar quais relatórios são mais acessados | Médio |
| API de webhook para integração com ITSM (ServiceNow, Jira) | Automatizar provisionamento de acesso via tickets | Alto |
| Geração de relatórios de conformidade LGPD em PDF | Para envio a auditores e ANPD | Médio |
| Compartilhamento de relatório com link temporário | Para reuniões ou stakeholders externos | Alto |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 2.0 | 2026-06-25 | Vinicius Soares | Seção 1 reescrita para refletir v2.0: lista de melhorias implementadas + backlog técnico atualizado |

# Stack Tecnológica Recomendada

> **Documento:** 08-tecnologias/01-stack-recomendada.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Visão Geral da Stack

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│   React 18 + TypeScript + Vite + TanStack Query + Zustand        │
│   powerbi-client SDK + React Router v6 + Axios                   │
└──────────────────────────────────────────────────────────────────┘
                              │ HTTPS / REST
┌──────────────────────────────────────────────────────────────────┐
│                          BACKEND                                  │
│   NestJS (Node.js 20 LTS) + TypeScript + Prisma ORM             │
│   Passport.js + Helmet + class-validator + pino logger           │
└──────────────────────────────────────────────────────────────────┘
         │ Prisma         │ ioredis        │ BullMQ (v1.1)
┌────────▼──────┐  ┌──────▼──────┐  ┌─────▼─────────┐
│  PostgreSQL   │  │   Redis 7   │  │  BullMQ Queue │
│  16+          │  │             │  │  (worker)     │
└───────────────┘  └─────────────┘  └───────────────┘
```

---

## 2. Frontend

### 2.1 Tecnologias Core

| Tecnologia | Versão | Justificativa |
|-----------|:------:|--------------|
| **React** | 18.x | Ecossistema maduro, Concurrent features, hooks |
| **TypeScript** | 5.x | Tipagem estática, manutenibilidade, IntelliSense |
| **Vite** | 5.x | Build ultrarrápido, HMR nativo, suporte a TS/JSX |
| **React Router** | v6 | Roteamento declarativo, layouts aninhados |

### 2.2 Gerenciamento de Estado

| Biblioteca | Propósito |
|-----------|-----------|
| **TanStack Query** (React Query) v5 | Estado do servidor: fetch, cache, background refetch, optimistic updates |
| **Zustand** | Estado global de UI: usuário autenticado, preferências, tema |
| State local (useState/useReducer) | Estado de formulários e UI local |

> **Por que não Redux?** Zustand é 10x menor e mais simples. Para este domínio, não há necessidade de Redux.

### 2.3 UI e Componentes

| Item | Abordagem |
|------|----------|
| Design system | Migrar CSS variables do protótipo para tokens TypeScript exportados |
| Componentes base | Construídos sobre o design system próprio (não usar biblioteca UI de terceiros para manter identidade visual) |
| Ícones | Font Awesome 6 (já usado no protótipo) + SVG para ícones custom |
| Formulários | React Hook Form + Zod (validação schema-first com inferência de tipos) |
| Notificações (toasts) | Sonner ou React Hot Toast (leve, sem dependências pesadas) |
| Modais | Headless UI (acessível, sem estilo próprio) |
| Tabelas | TanStack Table v8 (virtualização, sort, filtros) |
| Power BI Embed | powerbi-client (SDK oficial Microsoft) |

### 2.4 Qualidade de Código (Frontend)

| Ferramenta | Propósito |
|-----------|-----------|
| ESLint + eslint-plugin-react | Linting |
| Prettier | Formatação automática |
| Husky + lint-staged | Pre-commit hooks |
| Vitest | Testes unitários (compatível com Vite) |
| Testing Library | Testes de componente |
| Playwright | Testes end-to-end (E2E) |
| Storybook (opcional) | Catálogo visual de componentes |

---

## 3. Backend

### 3.1 Tecnologias Core

| Tecnologia | Versão | Justificativa |
|-----------|:------:|--------------|
| **Node.js** | 20 LTS | Runtime estável e performático; suporte long-term até 2026 |
| **NestJS** | 10.x | Framework opinado; módulos, guards, interceptors; fácil teste |
| **TypeScript** | 5.x | Tipagem ponta-a-ponta (frontend + backend) |
| **Prisma** | 5.x | ORM type-safe; migrations automáticas; excelente DX |

### 3.2 Bibliotecas de Suporte

| Biblioteca | Propósito |
|-----------|-----------|
| **Passport.js** + @nestjs/passport | Estratégias de autenticação (local, JWT) |
| **passport-jwt** | Validação de JWT RS256 |
| **bcrypt** | Hash de senhas |
| **jsonwebtoken** | Emissão/verificação de JWTs |
| **Helmet** | Headers de segurança HTTP |
| **@nestjs/throttler** | Rate limiting |
| **class-validator** + **class-transformer** | Validação e transformação de DTOs |
| **ioredis** | Cliente Redis com suporte a cluster e retry |
| **BullMQ** + @nestjs/bull | Filas assíncronas (v1.1) |
| **Nodemailer** | Envio de e-mails (v1.1) |
| **@azure/identity** | Autenticação no Azure (Service Principal) |
| **axios** | Chamadas HTTP para API do Power BI |
| **pino** + pino-pretty | Logger de alta performance em JSON |
| **@nestjs/swagger** | Documentação automática da API (OpenAPI 3.0) |
| **@nestjs/terminus** | Health checks padronizados |
| **@opentelemetry/sdk-node** | Tracing distribuído |

### 3.3 Qualidade de Código (Backend)

| Ferramenta | Propósito |
|-----------|-----------|
| ESLint + @typescript-eslint | Linting |
| Prettier | Formatação |
| Jest | Testes unitários e de integração |
| Supertest | Testes de controllers (HTTP) |
| @nestjs/testing | Módulo de testes do NestJS |
| testcontainers-node | PostgreSQL e Redis reais para testes de integração |

---

## 4. Banco de Dados

| Tecnologia | Versão | Justificativa |
|-----------|:------:|--------------|
| **PostgreSQL** | 16+ | ACID, JSONB nativo, row-level security, maturidade |
| **Prisma** (ORM) | 5.x | Migrations type-safe; client gerado; excelente para NestJS |
| **Redis** | 7.x | Cache, sessões, rate limiting, filas (via BullMQ) |

### Por que PostgreSQL?

- Suporte nativo a JSONB (campo `previous_val`/`new_val` nos logs de auditoria)
- Row-Level Security nativo (possível uso futuro para multi-tenant)
- Trigger functions para implementar a restrição append-only do audit_log
- Suporte a extensões: `pgcrypto` (UUID), `pg_stat_statements` (análise de queries)
- Excelente suporte pela comunidade open-source e todos os provedores cloud

### Por que Redis?

- Estrutura de dados rica: strings, hashes, sorted sets, pub/sub
- TTL nativo por chave (ideal para tokens e sessões)
- Baixa latência (< 1ms para operações simples)
- BullMQ usa Redis como broker de filas nativo

---

## 5. Infraestrutura

| Componente | Opção 1 (Azure) | Opção 2 (AWS) | Opção 3 (Self-hosted) |
|-----------|-----------------|---------------|----------------------|
| Compute | Azure Container Apps / App Service | AWS ECS Fargate / Beanstalk | Docker + VPS (DigitalOcean) |
| Banco | Azure Database for PostgreSQL | AWS RDS PostgreSQL | PostgreSQL no Docker |
| Cache | Azure Cache for Redis | AWS ElastiCache | Redis no Docker |
| Storage (logs/exports) | Azure Blob Storage | AWS S3 | MinIO |
| Load Balancer | Azure App Gateway | AWS ALB | NGINX |
| CDN (SPA estática) | Azure CDN / Static Web Apps | AWS CloudFront + S3 | Cloudflare |
| Secrets | Azure Key Vault | AWS Secrets Manager | HashiCorp Vault |
| DNS | Azure DNS | Route 53 | Cloudflare DNS |

**Recomendação:** Azure (já usa PBI e Azure AD) para simplificar integração e billing.

### Containerização

```dockerfile
# Dockerfile do backend (multi-stage)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

```yaml
# docker-compose.yml (desenvolvimento)
services:
  api:
    build: ./backend
    ports: ["3001:3001"]
    env_file: .env
    depends_on: [postgres, redis]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    env_file: .env.frontend

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: btportal
      POSTGRES_USER: btportal
      POSTGRES_PASSWORD: dev_password
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

---

## 6. DevOps e CI/CD

| Etapa | Ferramenta | Descrição |
|-------|-----------|-----------|
| Repositório | GitHub / Azure DevOps | Controle de versão e Code Review |
| CI | GitHub Actions / Azure Pipelines | Lint, testes, build automático |
| CD — Staging | GitHub Actions | Deploy automático ao fazer merge na main |
| CD — Produção | GitHub Actions | Deploy com aprovação manual |
| Container Registry | GitHub Container Registry / Azure ACR | Imagens Docker |
| IaC | Terraform ou Bicep (Azure) | Infraestrutura como código |
| Secrets no CI | GitHub Secrets / Azure Key Vault | Nunca em YAML |

### Pipeline CI (GitHub Actions — exemplo)

```yaml
name: CI
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run build
      - run: npm audit --audit-level=high
```

---

## 7. Monitoramento

| Ferramenta | Propósito | Quando |
|-----------|-----------|--------|
| **Azure Application Insights** | APM, traces, métricas, logs | Recomendado se infra Azure |
| **Datadog** | APM full-stack, dashboards, alertas | Alternativa premium |
| **Prometheus + Grafana** | Métricas open-source + dashboards | Alternativa self-hosted |
| **Sentry** | Error tracking com stack trace | Recomendado independente da escolha de APM |
| **UptimeRobot / Better Uptime** | Monitoramento de disponibilidade (uptime) externo | Simples e barato |
| **PgBadger** | Análise de slow queries do PostgreSQL | Análise periódica |

---

## 8. Resumo Consolidado da Stack Recomendada

| Camada | Tecnologia Principal | Alternativa |
|--------|---------------------|-------------|
| Frontend | React 18 + TypeScript + Vite | Next.js (se SSR for necessário) |
| Estado servidor | TanStack Query v5 | SWR |
| Estado global | Zustand | Jotai |
| Backend | NestJS (Node.js 20) + TypeScript | Fastify + TypeScript (menos opinionado) |
| ORM | Prisma 5 | TypeORM |
| Banco principal | PostgreSQL 16 | — |
| Cache | Redis 7 | Valkey (fork open-source do Redis) |
| Filas | BullMQ | — |
| PBI Embed | powerbi-client (SDK oficial) | — |
| Auth Azure | @azure/identity | — |
| Infra | Azure Container Apps | Docker + VPS |
| CI/CD | GitHub Actions | Azure Pipelines |
| APM | Azure App Insights + Sentry | Datadog |
| Testes E2E | Playwright | Cypress |
| Testes unitários | Vitest (front) + Jest (back) | — |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
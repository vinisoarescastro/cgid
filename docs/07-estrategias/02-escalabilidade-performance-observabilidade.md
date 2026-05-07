# Escalabilidade, Performance e Observabilidade

> **Documento:** 07-estrategias/02-escalabilidade-performance-observabilidade.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Estratégia de Performance

### 1.1 Metas de Performance (SLOs)

| Métrica | Meta | Medição |
|---------|------|---------|
| Navegação entre páginas (exceto embed) | p95 < 1,5s | Lighthouse CI + RUM |
| First Contentful Paint (FCP) | < 2s (4G) | Lighthouse |
| Time to Interactive (TTI) | < 3s (4G) | Lighthouse |
| Geração de token de embed PBI | p95 < 3s | APM (OpenTelemetry) |
| Consulta de log de auditoria (com filtros) | p95 < 2s (100k registros) | Teste de carga |
| Requisições de API (GET simples) | p95 < 500ms | APM |
| Usuários simultâneos sem degradação | ≥ 200 | Teste de carga k6 |
| Throughput da API (leitura) | ≥ 500 req/s | Teste de carga |
| Bundle JavaScript (gzipped) | < 500KB | Vite build stats |

---

### 1.2 Performance no Frontend

#### Build e Bundle
```
Vite (bundler):
  - Code splitting automático por rota
  - Tree shaking de dependências não utilizadas
  - Lazy loading de módulos administrativos (importados apenas quando necessário)
  - Pré-carregamento de módulos mais acessados

Exemplo de lazy loading:
  const AdminUsers = lazy(() => import('./pages/admin/UsersPage'));
  const AuditLogs  = lazy(() => import('./pages/admin/AuditLogsPage'));
```

#### Cache de Dados (TanStack Query)
```typescript
// Relatórios de um workspace: cache de 5 minutos
useQuery({ queryKey: ['reports', workspaceId], staleTime: 5 * 60 * 1000 });

// Permissões do usuário: cache de 5 minutos (invalidado ao alterar permissões)
useQuery({ queryKey: ['permissions', userId], staleTime: 5 * 60 * 1000 });

// Dados de auditoria: sem cache (dados em tempo real)
useQuery({ queryKey: ['audit', filters], staleTime: 0 });
```

#### Otimizações Adicionais
- Virtualização de listas longas com `react-window` (logs de auditoria com 1000+ registros)
- Debounce de 300ms em campos de busca antes de disparar requisição
- Paginação server-side para todas as listagens (padrão: 20 itens/página)
- Imagens e ícones em SVG inline ou sprite para evitar múltiplas requisições
- Fontes carregadas com `font-display: swap` e subset latino

---

### 1.3 Performance no Backend

#### Cache com Redis
```
Estratégia de cache em camadas:

L1 — Cache em memória do processo (5s):
  → Configurações do sistema (não mudam frequentemente)

L2 — Redis (TTL variável):
  → Permissões do usuário: 5 minutos (invalidado via evento)
  → Workspaces disponíveis: 2 minutos
  → Tokens de embed PBI: 55 minutos
  → Schedule rules: 30 segundos

Cache invalidation:
  → Ao alterar permissões de um usuário: DEL perms:{userId}
  → Ao alterar schedule: DEL schedule:*
  → Ao alterar workspace: DEL workspaces:*
```

#### Pool de Conexões ao Banco
```
PostgreSQL connection pool:
  - Min connections: 5
  - Max connections: 20 (por instância do backend)
  - Idle timeout: 30s
  - Connection timeout: 3s
  - Query timeout: 10s (timeout para evitar queries travadas)
```

#### Índices no Banco de Dados
```sql
-- Consultas frequentes já indexadas:
audit_logs(timestamp DESC)      -- paginação por data (uso mais comum)
audit_logs(user_id)             -- filtro por usuário
audit_logs(event_type)          -- filtro por tipo
audit_logs(module)              -- filtro por módulo
users(email)                    -- login (UNIQUE implica index)
users(status)                   -- filtro por status
reports(workspace_id, status)   -- relatórios publicados por workspace
user_workspace_access(user_id)  -- acesso do usuário a workspaces

-- Index para ILIKE em buscas textuais (se necessário):
CREATE INDEX idx_reports_name_gin ON reports USING GIN(to_tsvector('portuguese', name));
```

---

## 2. Estratégia de Escalabilidade

### 2.1 Escala Vertical (Scale Up) — Caminho Inicial

Para o MVP com até 200 usuários simultâneos, o dimensionamento inicial é suficiente:

| Componente | Configuração inicial |
|------------|---------------------|
| Backend (NestJS) | 1 instância, 2 vCPU, 4GB RAM |
| PostgreSQL | 1 instância, 2 vCPU, 8GB RAM, 100GB SSD |
| Redis | 1 instância, 1 vCPU, 1GB RAM |

### 2.2 Escala Horizontal (Scale Out) — Crescimento

**Backend (Stateless — já preparado para horizontal scaling):**
```
→ Múltiplas instâncias do NestJS atrás de load balancer
→ Sessão/autenticação mantida no Redis (não em memória do processo)
→ Load balancer: NGINX, Azure App Gateway ou AWS ALB
→ Deploy via containers Docker (K8s ou Azure Container Apps)
```

**PostgreSQL (Read Replicas):**
```
→ Operações de leitura intensiva (ex: listagem de logs) roteadas para réplica
→ Escrita sempre na instância primária
→ Implementação: PostgreSQL streaming replication
→ ORM (Prisma) configurado com datasource separado para réplica
```

**Redis (Cluster Mode — se necessário):**
```
→ Redis Cluster com 3 shards para distribuição de carga de cache
→ Redis Sentinel para alta disponibilidade
→ Alternativa gerenciada: Azure Cache for Redis ou AWS ElastiCache
```

### 2.3 Limites por Tier

| Cenário | Usuários simultâneos | Arquitetura |
|---------|:--------------------:|-------------|
| MVP / Go-live | ≤ 200 | Single instance (backend + DB + Redis) |
| Crescimento médio | 200–500 | 2 instâncias backend, réplica read do DB |
| Crescimento alto | 500–2000 | 3–5 instâncias backend, DB cluster, Redis cluster |
| Enterprise | 2000+ | Kubernetes, auto-scaling, DB distribuído |

---

## 3. Estratégia de Manutenção

### 3.1 Gerenciamento de Dependências
```
Frequência de atualização:
  - Patches de segurança: imediato (< 48h após publicação do CVE)
  - Minor updates: mensal
  - Major updates: trimestral com planejamento de migração

Ferramentas:
  - Dependabot (GitHub): alertas automáticos de vulnerabilidades
  - npm audit --audit-level=high: bloqueia build se houver vulnerabilidade alta
  - renovate.json: PRs automáticos de atualização de dependências
```

### 3.2 Versionamento de Banco de Dados
```
Prisma Migrate:
  - Migration gerada automaticamente pelo Prisma
  - Revisão obrigatória de toda migration antes de aplicar em produção
  - Cada migration com script de rollback documentado
  - Migrations aplicadas automaticamente no start do container em staging
  - Migrations em produção aplicadas manualmente com aprovação

Nomeclatura:
  20260501_001_create_users_table
  20260501_002_create_workspaces_table
  20260515_001_add_mfa_columns_to_users
```

### 3.3 Janelas de Manutenção
```
Manutenção programada:
  - Janela: Sábados, 02h–04h (fora do expediente de todos os fusos)
  - Notificação: e-mail para admins 48h antes
  - Manutenção exibida via banner no portal (24h antes)
  - Máximo de 2h de downtime por janela
```

---

## 4. Estratégia de Observabilidade

A observabilidade segue os **três pilares**: Logs, Métricas e Traces.

### 4.1 Logs Estruturados

```typescript
// Todos os logs em formato JSON estruturado
// Biblioteca: pino (alta performance, baixo overhead)

logger.info({
  requestId: uuid,
  userId: user.id,
  method: 'POST',
  path: '/api/v1/auth/login',
  statusCode: 200,
  durationMs: 145,
  ip: '192.168.1.1',
});

// Níveis:
// error   → Erros de aplicação, exceções não tratadas
// warn    → Situações anômalas mas não fatais
// info    → Eventos relevantes (login, criação de usuário, acesso PBI)
// debug   → Apenas em desenvolvimento e staging
```

**Coleta de logs em produção:**
- Logs enviados para **stdout** (padrão para containers)
- Coletados por **Fluent Bit** (sidecar no container)
- Enviados para **Azure Monitor Logs** ou **Datadog**
- Retenção: 90 dias online + 1 ano em storage frio

### 4.2 Métricas

```
Biblioteca: @opentelemetry/sdk-node + prom-client

Métricas de aplicação expostas em /metrics (Prometheus scrape):

http_requests_total{method, route, status_code}   — Total de requisições
http_request_duration_seconds{method, route}      — Latência (histograma)
pbi_token_generation_duration_seconds             — Tempo de geração de token PBI
active_sessions_total                             — Sessões ativas no Redis
login_attempts_total{result}                      — Tentativas de login (success/fail)
blocked_users_total                               — Total de usuários bloqueados
audit_log_entries_total{event_type}               — Volume de eventos por tipo

Infraestrutura (coletadas pelo provedor cloud):
  CPU, Memória, Disco, Conexões de rede
  Conexões do pool PostgreSQL
  Hit rate do cache Redis
  Latência de resposta do Power BI API
```

**Stack de visualização:**
- **Prometheus** → coleta e armazenamento de métricas
- **Grafana** → dashboards e alertas visuais
- Alternativa gerenciada: **Azure Monitor + Application Insights**

### 4.3 Traces (Distributed Tracing)

```typescript
// @opentelemetry/sdk-node com auto-instrumentação para:
// - HTTP (incoming requests)
// - PostgreSQL (queries via Prisma)
// - Redis (operações de cache)
// - HTTP outgoing (chamadas Azure AD e PBI API)

// Trace ID propagado em todos os logs:
logger.info({ traceId: span.spanContext().traceId, ... });

// Backend para traces:
//   Jaeger (self-hosted) ou Azure Application Insights
```

### 4.4 Alertas

| Alerta | Condição | Canal | Severidade |
|--------|----------|-------|-----------|
| Alta taxa de erros 5xx | > 1% das requisições em 5min | Slack + e-mail | 🔴 Crítico |
| Latência elevada | p95 > 3s por 5min | Slack | 🟡 Alto |
| Muitas tentativas de login | > 50 falhas/min por IP | Slack + e-mail | 🔴 Crítico |
| Usuários bloqueados em massa | > 5 bloqueios em 10min | Slack + e-mail | 🔴 Crítico |
| Pool de conexões esgotado | > 90% do max pool | Slack | 🟡 Alto |
| Disco do banco > 80% | — | Slack | 🟡 Alto |
| PBI API indisponível | 3 falhas consecutivas | Slack | 🟡 Alto |
| Certificado TLS expirando | < 30 dias para expirar | Slack + e-mail | 🟡 Alto |

### 4.5 Health Checks

```
GET /health               → Status geral (200 OK ou 503)
GET /health/live          → Liveness (o processo está vivo?)
GET /health/ready         → Readiness (pode receber tráfego? DB + Redis conectados?)

Exemplo de resposta:
{
  "status": "ok",
  "checks": {
    "database": "up",
    "redis": "up",
    "pbiService": "up"
  },
  "timestamp": "2026-05-01T10:00:00Z",
  "version": "1.2.3"
}
```

### 4.6 Dashboard de Observabilidade Sugerido (Grafana)

| Painel | Métricas |
|--------|---------|
| Visão Geral | Req/s, latência p50/p95/p99, taxa de erros, usuários ativos |
| Autenticação | Logins/min (success/fail), bloqueios, tentativas por IP |
| Power BI | Tempo de geração de token, hits de cache, erros de integração |
| Banco de Dados | Conexões ativas, query duration, slow queries |
| Redis | Hit rate, memória usada, operações/s |
| Segurança | Eventos críticos no log de auditoria, acessos negados por expediente |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
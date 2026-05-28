# Escalabilidade, Performance e Observabilidade

> **Documento:** 07-estrategias/02-escalabilidade-e-performance.md
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Estratégia de Performance

### 1.1 Metas de Performance (SLOs)

| Métrica | Meta | Medição |
|---------|------|---------|
| Navegação entre páginas (exceto embed) | p95 < 1,5s | Lighthouse CI |
| First Contentful Paint (FCP) | < 2s (4G) | Lighthouse |
| Time to Interactive (TTI) | < 3s (4G) | Lighthouse |
| Consulta de log de auditoria (com filtros) | p95 < 2s (100k registros) | Teste de carga |
| Requisições de API (GET simples) | p95 < 500ms | Monitoramento |
| Usuários simultâneos sem degradação | ≥ 50 (v1) | Teste de carga |
| Bundle JavaScript (gzipped) | < 500KB | Vite build stats |

---

### 1.2 Performance no Frontend

#### Build e Bundle
```
Vite (bundler):
  - Code splitting automático por rota
  - Tree shaking de dependências não utilizadas
  - Lazy loading de módulos administrativos (importados apenas quando necessário)

Exemplo de lazy loading no App.tsx:
  const PaginaUsuarios    = lazy(() => import('./pages/admin/PaginaUsuarios'));
  const PaginaLogsAuditoria = lazy(() => import('./pages/admin/PaginaLogsAuditoria'));
```

#### Cache de Dados (TanStack Query)
```typescript
// Relatórios de um workspace: cache de 5 minutos
useQuery({ queryKey: ['relatorios', espacoTrabalhoId], staleTime: 5 * 60 * 1000 });

// Permissões do usuário: cache de 5 minutos
useQuery({ queryKey: ['permissoes', usuarioId], staleTime: 5 * 60 * 1000 });

// Dados de auditoria: sem cache (dados em tempo real)
useQuery({ queryKey: ['auditoria', filtros], staleTime: 0 });
```

#### Otimizações Adicionais
- Debounce de 300ms em campos de busca antes de disparar requisição
- Paginação server-side para todas as listagens (padrão: 20 itens/página)
- Fontes carregadas com `font-display: swap`

---

### 1.3 Performance no Backend

#### Pool de Conexões ao Banco

O SQLAlchemy gerencia um pool de conexões automaticamente. Para ajuste fino:

```python
# database.py
engine = create_engine(
    configuracoes.DATABASE_URL,
    pool_pre_ping=True,       # testa conexão antes de usar
    pool_size=10,             # conexões mantidas abertas
    max_overflow=20,          # conexões extras em pico
    pool_timeout=30,          # espera máxima por conexão disponível (s)
    pool_recycle=3600,        # recicla conexões a cada 1 hora
    connect_args={
        "timeout": 10,        # timeout de conexão (s)
    }
)
```

String de conexão para referência (pyodbc):
```
mssql+pyodbc://USUARIO:SENHA@SERVIDOR\INSTANCIA/btportal
  ?driver=ODBC+Driver+17+for+SQL+Server
  &TrustServerCertificate=yes
  &ConnectTimeout=10
```

#### Índices no Banco de Dados

```sql
-- Consultas frequentes já indexadas (SQL Server):
CREATE INDEX IX_la_momento      ON logs_auditoria(momento DESC);      -- paginação por data
CREATE INDEX IX_la_usuario_id   ON logs_auditoria(usuario_id);         -- filtro por usuário
CREATE INDEX IX_la_tipo_evento  ON logs_auditoria(tipo_evento);        -- filtro por tipo
CREATE INDEX IX_la_modulo       ON logs_auditoria(modulo);             -- filtro por módulo
CREATE UNIQUE INDEX UQ_u_email  ON usuarios(email);                    -- login (UNIQUE = index)
CREATE INDEX IX_u_status        ON usuarios(status);                   -- filtro por status
CREATE INDEX IX_r_espaco        ON relatorios(espaco_trabalho_id, status); -- relatórios por workspace
CREATE INDEX IX_aw_usuario_id   ON acessos_workspace(usuario_id);      -- acesso do usuário

-- Full-Text Search para buscas textuais em nomes de relatórios (SQL Server FTS):
-- 1. Habilitar Full-Text Search na instância (via SSMS ou script)
-- 2. Criar catálogo e índice:
CREATE FULLTEXT CATALOG catalogo_ft AS DEFAULT;
CREATE FULLTEXT INDEX ON relatorios(nome LANGUAGE 'Portuguese')
  KEY INDEX PK_relatorios ON catalogo_ft;

-- Uso na query:
-- SELECT * FROM relatorios WHERE CONTAINS(nome, '"financeiro*"');
```

---

## 2. Estratégia de Escalabilidade

### 2.1 Escala Vertical (Scale Up) — Caminho Inicial

Para o MVP com a equipe interna, o dimensionamento inicial é suficiente:

| Componente | Configuração inicial |
|------------|---------------------|
| Backend (uvicorn) | 1 processo, 2 workers uvicorn |
| SQL Server (on-premise) | Instância existente — validar capacidade com time de TI |

Para aumentar o número de workers uvicorn:
```powershell
# Produção: múltiplos workers em paralelo
uvicorn main:app --workers 4 --host 0.0.0.0 --port 3001
```

### 2.2 Escala Horizontal (Scale Out) — Crescimento Futuro

**Backend (Stateless — preparado para horizontal scaling):**
```
→ Múltiplas instâncias do uvicorn atrás de NGINX (load balancer)
→ Autenticação via JWT (sem estado em servidor — cada instância valida independentemente)
→ Deploy via containers Docker
```

**SQL Server (Read Scale-Out / Always On):**
```
→ Operações de leitura intensiva roteadas para réplica
→ Escrita sempre na instância primária
→ Implementação: SQL Server Always On Availability Groups (AG)
→ Para edições Express/Standard: usar Log Shipping como alternativa de HA
```

### 2.3 Limites por Tier

| Cenário | Usuários simultâneos | Arquitetura |
|---------|:--------------------:|-------------|
| MVP / Go-live | ≤ 50 | Single instance (backend + DB) |
| Crescimento médio | 50–200 | 2 workers uvicorn, réplica read do DB |
| Crescimento alto | 200–500 | Múltiplas instâncias + NGINX, DB réplicas |
| Enterprise | 500+ | Kubernetes, auto-scaling, Redis para cache |

> **Nota:** Redis e BullMQ serão adicionados na v2 conforme necessidade, quando o sistema for para produção no servidor da empresa.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 2.0 | Maio/2026 | Vinicius Soares | Atualização para stack Python + FastAPI; remoção de Redis da v1; pool de conexões SQLAlchemy; nomes de tabelas e índices em Português |

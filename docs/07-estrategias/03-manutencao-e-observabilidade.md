# Manutenção e Observabilidade

> **Documento:** 07-estrategias/03-manutencao-e-observabilidade.md 
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Estratégia de Manutenção

### 1.1 Gerenciamento de Dependências

```
Frequência de atualização:
  - Patches de segurança: imediato (< 48h após publicação do CVE)
  - Minor updates: mensal
  - Major updates: trimestral com planejamento de migração

Ferramentas:
  - pip audit: verifica vulnerabilidades nas dependências Python
    pip install pip-audit && pip-audit
  - npm audit --audit-level=high: verifica dependências do frontend
  - Dependabot (GitHub): alertas automáticos de vulnerabilidades
```

### 1.2 Versionamento de Banco de Dados

O SQLAlchemy cria as tabelas automaticamente via `Base.metadata.create_all()` na inicialização do servidor. Para alterações em tabelas já existentes, usamos scripts SQL manuais:

```
Nomenclatura dos scripts:
  20260501_001_criar_tabela_usuarios.sql
  20260515_001_adicionar_coluna_mfa_usuarios.sql

Cada script deve conter:
  - Comentário descrevendo o objetivo
  - Script de rollback documentado ao final
```

**Fluxo para alterar uma tabela em produção:**
```
1. Escrever o script SQL manualmente
2. Testar em banco de desenvolvimento
3. Revisar o script com o time de TI (se necessário)
4. Aplicar via SSMS na instância de produção
5. Reiniciar o servidor backend (uvicorn) se necessário
```

**Exemplos comuns:**
```sql
-- Adicionar coluna (sempre nullable primeiro em tabelas com dados):
ALTER TABLE usuarios ADD nova_coluna NVARCHAR(100) NULL;

-- Renomear coluna:
EXEC sp_rename 'usuarios.nome_antigo', 'nome_novo', 'COLUMN';

-- Adicionar índice:
CREATE INDEX IX_usuarios_nova_coluna ON usuarios(nova_coluna);
```

### 1.3 Janelas de Manutenção

```
Manutenção programada:
  - Janela: Sábados, 02h–04h (fora do expediente)
  - Notificação: e-mail para admins 48h antes
  - Manutenção exibida via banner no portal (24h antes)
  - Máximo de 2h de downtime por janela
```

---

## 2. Estratégia de Observabilidade

A observabilidade segue os **três pilares**: Logs, Métricas e Traces.

### 2.1 Logs Estruturados

```python
# Backend Python — logging nativo configurado no main.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)
logger = logging.getLogger(__name__)

# Exemplo de uso em um roteador:
logger.info(f"Login bem-sucedido: usuario_id={usuario.id} ip={endereco_ip}")
logger.warning(f"Tentativa de login falha: email={email} tentativas={tentativas}")
logger.error(f"Erro ao conectar ao banco: {str(excecao)}")

# Níveis:
# ERROR   → Erros de aplicação, exceções não tratadas
# WARNING → Situações anômalas mas não fatais
# INFO    → Eventos relevantes (login, criação de usuário)
# DEBUG   → Apenas em desenvolvimento
```

**Para desenvolvimento, habilitar DEBUG no .env:**
```env
AMBIENTE=development
```

**Em produção, logs vão para stdout** — coletados pelo sistema operacional / Docker / serviço de cloud conforme a infraestrutura da empresa.

### 2.2 Métricas

Para a v1 (desenvolvimento local / ambiente interno), o monitoramento básico é suficiente:

```
Monitoramento manual recomendado:
  - SQL Server: sys.dm_exec_sessions (conexões ativas)
  - SQL Server: sys.dm_os_wait_stats (queries lentas)
  - SQL Server Query Store: análise de performance de queries
  - Verificar tamanho do banco regularmente: sys.databases

Quando o sistema for para produção no servidor da empresa (v2):
  - Adicionar Prometheus + prom-client para métricas da API
  - Configurar Grafana para visualização
  - Ou usar Azure Application Insights se o servidor for gerenciado pela Microsoft
```

### 2.3 Traces

Para a v1, o rastreamento de erros é feito via logs estruturados e pela tabela `logs_auditoria`.

```python
# Em cada roteador, logar eventos de negócio na tabela logs_auditoria:

novo_log = LogAuditoria(
    usuario_id=usuario.id,
    nome_usuario=usuario.nome,
    email_usuario=usuario.email,
    tipo_evento="autenticacao",
    modulo="auth",
    detalhe="Login realizado com sucesso",
    endereco_ip=endereco_ip,
)
banco.add(novo_log)
banco.commit()
```

### 2.4 Alertas

Para a v1 (sem infraestrutura de alertas automáticos), monitoramento manual via consultas SQL:

```sql
-- Usuários bloqueados nas últimas 24h:
SELECT nome, email, tentativas_login, atualizado_em
FROM usuarios
WHERE status = 'bloqueado'
  AND atualizado_em >= DATEADD(HOUR, -24, GETUTCDATE());

-- Tentativas de login falhas na última hora:
SELECT email_usuario, COUNT(*) AS tentativas, MAX(momento) AS ultima_tentativa
FROM logs_auditoria
WHERE tipo_evento = 'autenticacao'
  AND detalhe LIKE '%falha%'
  AND momento >= DATEADD(HOUR, -1, GETUTCDATE())
GROUP BY email_usuario
ORDER BY tentativas DESC;

-- Volume de eventos de auditoria por tipo hoje:
SELECT tipo_evento, COUNT(*) AS total
FROM logs_auditoria
WHERE momento >= CAST(GETUTCDATE() AS DATE)
GROUP BY tipo_evento
ORDER BY total DESC;
```

Quando o sistema crescer, configurar alertas automáticos com:

| Alerta | Condição | Canal | Severidade |
|--------|----------|-------|-----------|
| Alta taxa de erros 5xx | > 1% das requisições em 5min | E-mail | Crítico |
| Latência elevada | p95 > 3s por 5min | E-mail | Alto |
| Muitas tentativas de login falhas | > 20 falhas/min por IP | E-mail | Crítico |
| Disco do banco > 80% | — | E-mail | Alto |

### 2.5 Health Checks

```python
# main.py — endpoint de health check
@aplicacao.get("/saude")
def verificar_saude():
    return {"situacao": "operacional"}

# Para verificar se o banco está acessível:
@aplicacao.get("/saude/banco")
def verificar_banco(banco: Session = Depends(obter_db)):
    try:
        banco.execute(text("SELECT 1"))
        return {"banco": "conectado"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Banco indisponível: {str(e)}")
```

**Verificar via terminal:**
```powershell
# Health check básico
curl http://localhost:3001/saude

# Resposta esperada:
# {"situacao": "operacional"}
```

### 2.6 Dashboard de Observabilidade (v2 — Quando for para Produção)

Quando o sistema for para o servidor da empresa, configurar monitoramento completo:

| Painel | Métricas |
|--------|---------|
| Visão Geral | Req/s, latência p50/p95/p99, taxa de erros |
| Autenticação | Logins/min (sucesso/falha), bloqueios, tentativas por IP |
| Banco de Dados | Conexões ativas, query duration, slow queries (Query Store), blocking sessions |
| Segurança | Eventos críticos no log de auditoria, acessos negados por expediente |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 2.0 | Maio/2026 | Vinicius Soares | Atualização para stack Python + FastAPI; substituição de Prisma Migrate por scripts SQL manuais; logging nativo Python; remoção de Redis da v1; exemplos de consultas SQL de monitoramento |

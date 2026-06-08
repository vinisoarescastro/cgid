# Modelagem de Entidades e Banco de Dados

> **Documento:** 05-modelagem/04-entidades-e-banco-de-dados.md  
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026  
> **Banco de dados:** Microsoft SQL Server 2019+ (on-premise)

---

## 1. Diagrama de Entidades (Relacionamentos)

```
usuarios
  ├── acessos_workspace (N:M com espacos_trabalho)
  ├── acessos_relatorio (N:M com relatorios)
  ├── sobrescritas_permissao (1:N)
  ├── membros_grupo_excecao (N:M com grupos_excecao)
  ├── favoritos (1:N com relatorios)
  ├── sessoes_autenticacao (1:N)
  └── logs_auditoria (1:N - autor dos eventos)

espacos_trabalho
  ├── relatorios (1:N)
  └── acessos_workspace (N:M com usuarios)

relatorios
  ├── acessos_relatorio (N:M com usuarios)
  └── favoritos (1:N)

permissoes_perfil
  └── Permissões padrão por perfil (perfil × modulo × acoes)

grupos_excecao
  └── membros_grupo_excecao (1:N)

regras_expediente
  └── Uma por dia da semana (7 registros)

configuracoes_sistema
  └── Configurações globais (chave-valor)

logs_auditoria
  └── Append-only; sem FK para preservar histórico após exclusões
```

---

## 2. Definição das Tabelas (SQL Server)

> **Convenções SQL Server adotadas:**
> - Identificadores: `UNIQUEIDENTIFIER` com `DEFAULT NEWID()`
> - Timestamps: `DATETIME2(7)` armazenados em **UTC**
> - Texto curto/indexável: `NVARCHAR(N)`
> - Texto longo / JSON: `NVARCHAR(MAX)`
> - Booleanos: `BIT` (0 = false, 1 = true)
> - Endereço IP: `NVARCHAR(45)` (suporta IPv4 e IPv6)
> - ENUMs: `NVARCHAR(20)` com `CHECK` constraint

---

### Tabela: `usuarios`

| Coluna | Tipo SQL Server | Restrições | Descrição |
|--------|----------------|-----------|-----------|
| `id` | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | Identificador único |
| `nome` | NVARCHAR(255) | NOT NULL | Nome completo |
| `email` | NVARCHAR(255) | NOT NULL, UNIQUE | E-mail corporativo |
| `hash_senha` | NVARCHAR(255) | NOT NULL | Hash bcrypt |
| `perfil` | NVARCHAR(30) | NOT NULL, CHECK | super_administrador, administrador, gerente, operador, visitante |
| `status` | NVARCHAR(20) | NOT NULL, DEFAULT 'ativo' | ativo, inativo, bloqueado |
| `tentativas_login` | SMALLINT | DEFAULT 0 | Contador de tentativas falhas |
| `ultimo_login` | DATETIME2(7) | NULL | Último login bem-sucedido (UTC) |
| `mfa_ativo` | BIT | DEFAULT 0 | MFA ativado para o usuário |
| `mfa_segredo` | NVARCHAR(255) | NULL | Secret TOTP (criptografado) |
| `criado_em` | DATETIME2(7) | NOT NULL, DEFAULT GETUTCDATE() | Data de criação (UTC) |
| `atualizado_em` | DATETIME2(7) | NOT NULL, DEFAULT GETUTCDATE() | Data da última atualização (UTC) |
| `criado_por_id` | UNIQUEIDENTIFIER | FK → usuarios(id), NULL | Quem criou o usuário |

```sql
CREATE TABLE usuarios (
  id               UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_usuarios PRIMARY KEY DEFAULT NEWID(),
  nome             NVARCHAR(255)     NOT NULL,
  email            NVARCHAR(255)     NOT NULL,
  hash_senha       NVARCHAR(255)     NOT NULL,
  perfil           NVARCHAR(30)      NOT NULL DEFAULT 'operador'
                     CONSTRAINT CK_usuarios_perfil CHECK (perfil IN (
                       'super_administrador','administrador','gerente','operador','visitante'
                     )),
  status           NVARCHAR(20)      NOT NULL DEFAULT 'ativo'
                     CONSTRAINT CK_usuarios_status CHECK (status IN ('ativo','inativo','bloqueado')),
  tentativas_login SMALLINT          NOT NULL DEFAULT 0,
  ultimo_login     DATETIME2(7)      NULL,
  mfa_ativo        BIT               NOT NULL DEFAULT 0,
  mfa_segredo      NVARCHAR(255)     NULL,
  criado_em        DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE(),
  atualizado_em    DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE(),
  criado_por_id    UNIQUEIDENTIFIER  NULL
                     CONSTRAINT FK_usuarios_criado_por REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX UQ_usuarios_email ON usuarios(email);
CREATE INDEX IX_usuarios_status ON usuarios(status);
```

---

### Tabela: `sessoes_autenticacao`

Armazena sessões autenticadas e refresh tokens opacos. O `access token` JWT deve carregar o identificador da sessão (`sid`), permitindo que o backend revogue a sessão no logout ou bloqueio do usuário sem depender de Redis.

| Coluna | Tipo SQL Server | Restrições | Descrição |
|--------|----------------|-----------|-----------|
| `id` | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | Identificador da sessão (`sid`) |
| `usuario_id` | UNIQUEIDENTIFIER | FK → usuarios(id), NOT NULL | Usuário dono da sessão |
| `hash_refresh_token` | NVARCHAR(255) | NOT NULL, UNIQUE | Hash SHA-256 do refresh token opaco |
| `criado_em` | DATETIME2(7) | NOT NULL, DEFAULT GETUTCDATE() | Criação da sessão |
| `expira_em` | DATETIME2(7) | NOT NULL | Expiração do refresh token |
| `ultimo_uso_em` | DATETIME2(7) | NULL | Última renovação da sessão |
| `revogado_em` | DATETIME2(7) | NULL | Preenchido no logout/bloqueio |
| `endereco_ip` | NVARCHAR(45) | NULL | IP de origem |
| `user_agent` | NVARCHAR(500) | NULL | Navegador/dispositivo |

```sql
CREATE TABLE sessoes_autenticacao (
  id                  UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_sessoes_autenticacao PRIMARY KEY DEFAULT NEWID(),
  usuario_id          UNIQUEIDENTIFIER  NOT NULL
                        CONSTRAINT FK_sa_usuario REFERENCES usuarios(id) ON DELETE CASCADE,
  hash_refresh_token  NVARCHAR(255)     NOT NULL,
  criado_em           DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE(),
  expira_em           DATETIME2(7)      NOT NULL,
  ultimo_uso_em       DATETIME2(7)      NULL,
  revogado_em         DATETIME2(7)      NULL,
  endereco_ip         NVARCHAR(45)      NULL,
  user_agent          NVARCHAR(500)     NULL
);

CREATE UNIQUE INDEX UQ_sa_hash_refresh_token ON sessoes_autenticacao(hash_refresh_token);
CREATE INDEX IX_sa_usuario_ativo ON sessoes_autenticacao(usuario_id, revogado_em, expira_em);
```

---

### Tabela: `espacos_trabalho`

| Coluna | Tipo SQL Server | Restrições | Descrição |
|--------|----------------|-----------|-----------|
| `id` | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | Identificador único |
| `nome` | NVARCHAR(255) | NOT NULL, UNIQUE | Nome do workspace |
| `id_workspace_pbi` | NVARCHAR(255) | NULL | ID do workspace no Power BI Service |
| `status` | NVARCHAR(20) | NOT NULL, DEFAULT 'ativo' | ativo, arquivado |
| `icone` | NVARCHAR(100) | NULL | Ícone (letra ou emoji) |
| `cor` | NVARCHAR(20) | NULL | Cor hex (ex: #2563eb) |
| `descricao` | NVARCHAR(MAX) | NULL | Descrição do workspace |
| `criado_em` | DATETIME2(7) | NOT NULL, DEFAULT GETUTCDATE() | — |
| `criado_por_id` | UNIQUEIDENTIFIER | FK → usuarios(id) | — |

```sql
CREATE TABLE espacos_trabalho (
  id                UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_espacos_trabalho PRIMARY KEY DEFAULT NEWID(),
  nome              NVARCHAR(255)     NOT NULL,
  id_workspace_pbi  NVARCHAR(255)     NULL,
  status            NVARCHAR(20)      NOT NULL DEFAULT 'ativo'
                      CONSTRAINT CK_et_status CHECK (status IN ('ativo','arquivado')),
  icone             NVARCHAR(100)     NULL,
  cor               NVARCHAR(20)      NULL,
  descricao         NVARCHAR(MAX)     NULL,
  criado_em         DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE(),
  criado_por_id     UNIQUEIDENTIFIER  NULL
                      CONSTRAINT FK_et_criado_por REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX UQ_espacos_trabalho_nome ON espacos_trabalho(nome);
```

---

### Tabela: `relatorios`

| Coluna | Tipo SQL Server | Restrições | Descrição |
|--------|----------------|-----------|-----------|
| `id` | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | Identificador único |
| `nome` | NVARCHAR(255) | NOT NULL | Nome do relatório |
| `espaco_trabalho_id` | UNIQUEIDENTIFIER | FK → espacos_trabalho(id), NOT NULL | Workspace pai |
| `id_relatorio_pbi` | NVARCHAR(255) | NULL | ID no Power BI Service |
| `categoria` | NVARCHAR(100) | NULL | Financeiro, Operacional, Estratégico |
| `status` | NVARCHAR(20) | NOT NULL, DEFAULT 'publicado' | publicado, rascunho, arquivado |
| `descricao` | NVARCHAR(MAX) | NULL | Descrição |
| `atualizado_em` | DATETIME2(7) | NOT NULL, DEFAULT GETUTCDATE() | Última atualização (UTC) |
| `criado_em` | DATETIME2(7) | NOT NULL, DEFAULT GETUTCDATE() | — |
| `criado_por_id` | UNIQUEIDENTIFIER | FK → usuarios(id) | — |

```sql
CREATE TABLE relatorios (
  id                   UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_relatorios PRIMARY KEY DEFAULT NEWID(),
  nome                 NVARCHAR(255)     NOT NULL,
  espaco_trabalho_id   UNIQUEIDENTIFIER  NOT NULL
                         CONSTRAINT FK_rel_espaco_trabalho REFERENCES espacos_trabalho(id) ON DELETE CASCADE,
  id_relatorio_pbi     NVARCHAR(255)     NULL,
  categoria            NVARCHAR(100)     NULL,
  status               NVARCHAR(20)      NOT NULL DEFAULT 'publicado'
                         CONSTRAINT CK_rel_status CHECK (status IN ('publicado','rascunho','arquivado')),
  descricao            NVARCHAR(MAX)     NULL,
  atualizado_em        DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE(),
  criado_em            DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE(),
  criado_por_id        UNIQUEIDENTIFIER  NULL
                         CONSTRAINT FK_rel_criado_por REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IX_relatorios_espaco ON relatorios(espaco_trabalho_id, status);
CREATE INDEX IX_relatorios_status ON relatorios(status);
```

---

### Tabela: `acessos_workspace`

```sql
CREATE TABLE acessos_workspace (
  id                UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_acessos_workspace PRIMARY KEY DEFAULT NEWID(),
  usuario_id        UNIQUEIDENTIFIER  NOT NULL
                      CONSTRAINT FK_aw_usuario REFERENCES usuarios(id) ON DELETE CASCADE,
  espaco_trabalho_id UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT FK_aw_espaco REFERENCES espacos_trabalho(id),
  nivel_acesso      NVARCHAR(20)      NOT NULL DEFAULT 'apenas_relatorios'
                      CONSTRAINT CK_aw_nivel CHECK (nivel_acesso IN ('total','apenas_relatorios','nenhum')),
  concedido_por_id  UNIQUEIDENTIFIER  NULL
                      CONSTRAINT FK_aw_concedido_por REFERENCES usuarios(id) ON DELETE SET NULL,
  concedido_em      DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE()
);

CREATE UNIQUE INDEX UQ_aw_usuario_espaco ON acessos_workspace(usuario_id, espaco_trabalho_id);
```

---

### Tabela: `acessos_relatorio`

```sql
CREATE TABLE acessos_relatorio (
  id               UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_acessos_relatorio PRIMARY KEY DEFAULT NEWID(),
  usuario_id       UNIQUEIDENTIFIER  NOT NULL
                     CONSTRAINT FK_ar_usuario REFERENCES usuarios(id) ON DELETE CASCADE,
  relatorio_id     UNIQUEIDENTIFIER  NOT NULL
                     CONSTRAINT FK_ar_relatorio REFERENCES relatorios(id),
  concedido_por_id UNIQUEIDENTIFIER  NULL
                     CONSTRAINT FK_ar_concedido_por REFERENCES usuarios(id) ON DELETE SET NULL,
  concedido_em     DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE()
);

CREATE UNIQUE INDEX UQ_ar_usuario_relatorio ON acessos_relatorio(usuario_id, relatorio_id);
```

---

### Tabela: `permissoes_perfil`

```sql
CREATE TABLE permissoes_perfil (
  id              UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_permissoes_perfil PRIMARY KEY DEFAULT NEWID(),
  perfil          NVARCHAR(30)      NOT NULL
                    CONSTRAINT CK_pp_perfil CHECK (perfil IN (
                      'super_administrador','administrador','gerente','operador','visitante'
                    )),
  modulo          NVARCHAR(100)     NOT NULL,
  pode_visualizar BIT               NOT NULL DEFAULT 0,
  pode_criar      BIT               NOT NULL DEFAULT 0,
  pode_editar     BIT               NOT NULL DEFAULT 0,
  pode_excluir    BIT               NOT NULL DEFAULT 0,
  pode_exportar   BIT               NOT NULL DEFAULT 0,
  pode_gerenciar  BIT               NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX UQ_pp_perfil_modulo ON permissoes_perfil(perfil, modulo);
```

---

### Tabela: `sobrescritas_permissao`

```sql
CREATE TABLE sobrescritas_permissao (
  id              UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_sobrescritas_permissao PRIMARY KEY DEFAULT NEWID(),
  usuario_id      UNIQUEIDENTIFIER  NOT NULL
                    CONSTRAINT FK_sp_usuario REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo          NVARCHAR(100)     NOT NULL,
  -- NULL = herda do perfil; 1/0 = override explícito
  pode_visualizar BIT               NULL,
  pode_criar      BIT               NULL,
  pode_editar     BIT               NULL,
  pode_excluir    BIT               NULL,
  pode_exportar   BIT               NULL,
  pode_gerenciar  BIT               NULL,
  definido_por_id UNIQUEIDENTIFIER  NULL
                    CONSTRAINT FK_sp_definido_por REFERENCES usuarios(id) ON DELETE SET NULL,
  definido_em     DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE()
);

CREATE UNIQUE INDEX UQ_sp_usuario_modulo ON sobrescritas_permissao(usuario_id, modulo);
```

---

### Tabela: `regras_expediente`

```sql
CREATE TABLE regras_expediente (
  id               UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_regras_expediente PRIMARY KEY DEFAULT NEWID(),
  dia_semana       SMALLINT          NOT NULL  -- 0=Dom, 1=Seg, ..., 6=Sáb
                     CONSTRAINT CK_re_dia CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio      TIME(0)           NOT NULL DEFAULT '08:00:00',
  hora_fim         TIME(0)           NOT NULL DEFAULT '18:00:00',
  ativo            BIT               NOT NULL DEFAULT 1,
  bloquear_fora    BIT               NOT NULL DEFAULT 1,
  atualizado_em    DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE()
);

CREATE UNIQUE INDEX UQ_re_dia_semana ON regras_expediente(dia_semana);
```

---

### Tabela: `grupos_excecao`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|-----------|-----------|
| `id` | UNIQUEIDENTIFIER | PK | Identificador único |
| `nome` | NVARCHAR(255) | NOT NULL | Nome descritivo do grupo |
| `fora_horario` | BIT | NOT NULL DEFAULT 1 | Se o grupo concede acesso fora do expediente |
| `janela_inicio` | TIME(0) | NULL | Início da janela de exceção (NULL = sem janela definida) |
| `janela_fim` | TIME(0) | NULL | Fim da janela de exceção (NULL = sem janela definida) |
| `ignora_dia_inativo` | BIT | NOT NULL DEFAULT 0 | Se membros podem acessar em dias com `ativo = false` |
| `status` | NVARCHAR(20) | NOT NULL DEFAULT 'ativo' | ativo \| inativo |
| `criado_em` | DATETIME2(7) | NOT NULL | — |
| `criado_por_id` | UNIQUEIDENTIFIER | FK → usuarios(id) | — |

> **`ignora_dia_inativo`**: quando `1`, os membros deste grupo podem acessar o sistema mesmo em dias da semana onde a regra de expediente está com `ativo = false` (ex: sábados configurados como inativos). Grupos com `0` (padrão) continuam bloqueados nesses dias.

```sql
CREATE TABLE grupos_excecao (
  id                  UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_grupos_excecao PRIMARY KEY DEFAULT NEWID(),
  nome                NVARCHAR(255)     NOT NULL,
  fora_horario        BIT               NOT NULL DEFAULT 1,
  janela_inicio       TIME(0)           NULL,
  janela_fim          TIME(0)           NULL,
  ignora_dia_inativo  BIT               NOT NULL DEFAULT 0,
  status              NVARCHAR(20)      NOT NULL DEFAULT 'ativo'
                        CONSTRAINT CK_ge_status CHECK (status IN ('ativo','inativo')),
  criado_em           DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE(),
  criado_por_id       UNIQUEIDENTIFIER  NULL
                        CONSTRAINT FK_ge_criado_por REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Migration para bancos existentes:
ALTER TABLE grupos_excecao ADD ignora_dia_inativo BIT NOT NULL DEFAULT 0;
```

---

### Tabela: `membros_grupo_excecao`

```sql
CREATE TABLE membros_grupo_excecao (
  grupo_id    UNIQUEIDENTIFIER  NOT NULL
                CONSTRAINT FK_mge_grupo REFERENCES grupos_excecao(id) ON DELETE CASCADE,
  usuario_id  UNIQUEIDENTIFIER  NOT NULL
                CONSTRAINT FK_mge_usuario REFERENCES usuarios(id),
  CONSTRAINT PK_membros_grupo_excecao PRIMARY KEY (grupo_id, usuario_id)
);
```

---

### Tabela: `favoritos`

```sql
CREATE TABLE favoritos (
  id           UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_favoritos PRIMARY KEY DEFAULT NEWID(),
  usuario_id   UNIQUEIDENTIFIER  NOT NULL
                 CONSTRAINT FK_fav_usuario REFERENCES usuarios(id) ON DELETE CASCADE,
  relatorio_id UNIQUEIDENTIFIER  NOT NULL
                 CONSTRAINT FK_fav_relatorio REFERENCES relatorios(id),
  criado_em    DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE()
);

CREATE UNIQUE INDEX UQ_fav_usuario_relatorio ON favoritos(usuario_id, relatorio_id);
```

---

### Tabela: `logs_auditoria`

> **CRÍTICO:** Esta tabela é append-only. Nenhum UPDATE ou DELETE deve ser permitido.
> Implementado via trigger `INSTEAD OF` no SQL Server.

```sql
CREATE TABLE logs_auditoria (
  id            UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_logs_auditoria PRIMARY KEY DEFAULT NEWID(),
  momento       DATETIME2(7)      NOT NULL DEFAULT GETUTCDATE(),
  usuario_id    UNIQUEIDENTIFIER  NULL,           -- NULL para eventos de sistema
  nome_usuario  NVARCHAR(255)     NULL,            -- snapshot imutável do nome
  email_usuario NVARCHAR(255)     NULL,            -- snapshot imutável do e-mail
  tipo_evento   NVARCHAR(50)      NOT NULL
                  CONSTRAINT CK_la_tipo_evento CHECK (tipo_evento IN (
                    'autenticacao','usuario','permissao','acesso','relatorio','seguranca','sistema'
                  )),
  modulo        NVARCHAR(100)     NOT NULL,
  detalhe       NVARCHAR(MAX)     NOT NULL,
  endereco_ip   NVARCHAR(45)      NULL,
  valor_anterior NVARCHAR(MAX)    NULL,            -- JSON: estado anterior
  valor_novo    NVARCHAR(MAX)     NULL             -- JSON: novo estado
);

-- Índices para performance nas consultas de auditoria
CREATE INDEX IX_la_momento    ON logs_auditoria(momento DESC);
CREATE INDEX IX_la_usuario_id ON logs_auditoria(usuario_id);
CREATE INDEX IX_la_tipo_evento ON logs_auditoria(tipo_evento);
CREATE INDEX IX_la_modulo     ON logs_auditoria(modulo);

-- Trigger INSTEAD OF para impedir UPDATE e DELETE
CREATE TRIGGER trg_logs_auditoria_imutavel
ON logs_auditoria
INSTEAD OF UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  RAISERROR('logs_auditoria são imutáveis: operações de UPDATE e DELETE não são permitidas.', 16, 1);
  ROLLBACK TRANSACTION;
END;
GO
```

---

### Tabela: `configuracoes_sistema`

```sql
CREATE TABLE configuracoes_sistema (
  chave        NVARCHAR(255)     NOT NULL CONSTRAINT PK_configuracoes_sistema PRIMARY KEY,
  valor        NVARCHAR(MAX)     NOT NULL,
  eh_secreto   BIT               NOT NULL DEFAULT 0,
  atualizado_em DATETIME2(7)     NOT NULL DEFAULT GETUTCDATE(),
  atualizado_por_id UNIQUEIDENTIFIER NULL
                CONSTRAINT FK_cs_atualizado_por REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Registros iniciais (seed)
INSERT INTO configuracoes_sistema (chave, valor, eh_secreto) VALUES
  ('nome_portal',          '"CGID - Centro de Governança e Inteligência de Dados"', 0),
  ('ambiente',             '"producao"',         0),
  ('pbi_client_id',        '""',                 0),
  ('pbi_tenant_id',        '""',                 0),
  ('pbi_workspace_id',     '""',                 0),
  ('pbi_client_secret',    '""',                 1),
  ('pbi_integracao_ativa', 'false',              0);
```

---

## 3. Diagrama de Relacionamentos Resumido

```
usuarios 1──────N acessos_workspace N──────1 espacos_trabalho
  │                                               │
  │                                              1│
  │                                               │
  N acessos_relatorio N────────────────────── relatorios
  │
  1──────N sobrescritas_permissao
  │
  N membros_grupo_excecao N──────1 grupos_excecao
  │
  1──────N favoritos N──────1 relatorios
  │
  1──────N sessoes_autenticacao
  │
  1──────N logs_auditoria (snapshot, sem FK real para integridade histórica)

permissoes_perfil (standalone — sem FK para usuarios)
regras_expediente (standalone — regra global)
configuracoes_sistema (standalone — configurações chave-valor)
```

---

## 4. Estratégia de Migração

O SQLAlchemy cria todas as tabelas automaticamente via `Base.metadata.create_all(bind=engine)`, chamado no `main.py` na inicialização do servidor.

```python
# database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from config import configuracoes

engine = create_engine(configuracoes.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# main.py — executado ao iniciar o servidor
from database import engine, Base
import models  # importa todos os modelos para Base conhecê-los

Base.metadata.create_all(bind=engine)
```

### Fluxo em Desenvolvimento

```powershell
# 1. Ajuste os modelos em models.py
# 2. Reinicie o servidor — o SQLAlchemy cria/atualiza as tabelas
uvicorn main:app --reload --port 3001
```

### Fluxo em Produção

Para alterações em tabelas existentes (adicionar coluna, alterar tipo), use scripts SQL manuais aplicados via SSMS:

```sql
-- Exemplo: adicionar coluna em tabela existente
ALTER TABLE usuarios
ADD nova_coluna NVARCHAR(100) NULL;
```

### Convenções para Scripts SQL Manuais

```
Nomenclatura dos arquivos:
  20260501_001_criar_tabela_usuarios.sql
  20260515_001_adicionar_coluna_mfa_usuarios.sql

Cada script deve ter:
  - Comentário descrevendo o objetivo
  - Script de rollback documentado no mesmo arquivo
```

### Observações Específicas ao SQL Server

| Situação | Comportamento / Solução |
|----------|------------------------|
| Renomear coluna | Usar `sp_rename 'tabela.coluna_antiga', 'coluna_nova', 'COLUMN'` |
| Alterar tipo de coluna | Pode exigir nova coluna + migração de dados + remoção da antiga |
| Adicionar coluna NOT NULL | Adicionar como NULL, fazer backfill dos dados, depois tornar NOT NULL |
| Índices Full-Text Search | Criar manualmente via SSMS (não gerenciado pelo SQLAlchemy) |
| Triggers | Criar manualmente via script SQL após a criação da tabela |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
| 1.1 | Maio/2026 | — | Reescrita para SQL Server: tipos nativos, triggers INSTEAD OF, índices |
| 2.0 | Maio/2026 | — | Migração completa para nomes em Português do Brasil; substituição de Prisma Migrate por SQLAlchemy create_all |
| 2.1 | Junho/2026 | Vinicius Soares | Adicionada coluna `ignora_dia_inativo` (BIT DEFAULT 0) em `grupos_excecao`; documentação de migration para bancos existentes |

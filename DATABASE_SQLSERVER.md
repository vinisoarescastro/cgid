# Documentação Técnica — Migração para SQL Server

**Projeto:** CGID  
**Banco atual:** SQLite (`cgid.db`) via SQLAlchemy 2.0 / Alembic  
**Banco destino:** Microsoft SQL Server  
**Data da análise:** 2026-06-26  
**Fonte:** `backend/models.py` (336 linhas), `backend/seed.py`, `backend/migrations/rename_perfis.sql`

---

## 1. Visão Geral

O sistema possui **21 tabelas** organizadas em torno de quatro domínios principais:

| Domínio | Tabelas |
|---|---|
| **Identidade e Acesso** | `perfis`, `usuarios`, `sessoes_autenticacao`, `departamentos` |
| **Workspaces e Relatórios** | `espacos_trabalho`, `relatorios`, `acessos_workspace`, `acessos_relatorio`, `favoritos` |
| **Controle de Acesso Granular** | `permissoes_perfil`, `pacotes_permissao`, `pacotes_permissao_itens`, `usuarios_pacotes` |
| **Operação e Auditoria** | `regras_expediente`, `grupos_excecao`, `membros_grupo_excecao`, `logs_auditoria`, `historico_config_critica`, `configuracoes_sistema`, `credenciais_pbi` |

**Estratégia de chave primária:** todas as tabelas usam UUID v4 em `CHAR(36)`, gerado pela aplicação Python antes do `INSERT`. Nenhuma tabela usa `IDENTITY` numérico, exceto `perfis` que usa chave primária textual (`codigo`).

---

## 2. Diferenças SQLite → SQL Server

| Aspecto | SQLite | SQL Server (necessário) |
|---|---|---|
| Tipo booleano | `INTEGER` (0/1) | `BIT NOT NULL` |
| Tipo texto livre | `TEXT` | `NVARCHAR(MAX)` |
| `VARCHAR` vs `NVARCHAR` | indiferente | Usar `NVARCHAR` para suporte a Unicode (nomes, descrições) |
| `server_default=func.now()` | `CURRENT_TIMESTAMP` | `GETDATE()` ou `SYSDATETIME()` |
| `onupdate=func.now()` | não existe nativo | Implementar via `TRIGGER AFTER UPDATE` |
| `Time` (hora sem data) | `TEXT` | `TIME(0)` |
| `ON DELETE CASCADE` | suportado | Suportado — verificar se `FOREIGN_KEY_CHECKS` está ativo |
| `ON DELETE SET NULL` | suportado | Suportado |
| `render_as_batch=True` no Alembic | contorno para SQLite | Remover esta opção para SQL Server |
| Constraint `CHECK` em valores de enum | inexistente no modelo | Adicionar `CHECK` para colunas `status`, `nivel_acesso`, etc. (opcional, mas recomendado) |
| `NVARCHAR` vs `VARCHAR` em índice único | indiferente | SQL Server cria índice clusterizado na PK por padrão; usar `NONCLUSTERED` explícito onde necessário |

**Nota sobre `onupdate`:** O SQLAlchemy usa `onupdate=func.now()` nas colunas `atualizado_em`. No SQL Server, isso **não é traduzido automaticamente para um trigger** — o SQLAlchemy envia o valor pela aplicação a cada `UPDATE`. Isso funciona corretamente via ORM. Contudo, se updates forem feitos por fora da aplicação (scripts SQL diretos), o campo não será atualizado. A seção de triggers aborda isso.

---

## 3. Ordem de Criação das Tabelas

A ordem abaixo respeita todas as dependências de chave estrangeira:

```
 1. perfis
 2. departamentos
 3. usuarios                    → perfis, departamentos, usuarios (auto-ref)
 4. sessoes_autenticacao        → usuarios
 5. espacos_trabalho            → usuarios
 6. relatorios                  → espacos_trabalho, usuarios
 7. acessos_workspace           → usuarios, espacos_trabalho
 8. acessos_relatorio           → usuarios, relatorios
 9. permissoes_perfil           (sem FK)
10. regras_expediente           (sem FK)
11. grupos_excecao              → usuarios
12. membros_grupo_excecao       → grupos_excecao, usuarios
13. favoritos                   → usuarios, relatorios
14. logs_auditoria              (sem FK — append-only)
15. configuracoes_sistema       → usuarios
16. historico_config_critica    (sem FK — append-only)
17. credenciais_pbi             → usuarios
18. pacotes_permissao           → usuarios
19. pacotes_permissao_itens     → pacotes_permissao
20. usuarios_pacotes            → usuarios, pacotes_permissao
```

---

## 4. Scripts CREATE TABLE

> Executar na ordem da seção 3. Todos os scripts são válidos para SQL Server 2016+.

---

### 4.1 `perfis`

```sql
CREATE TABLE perfis (
    codigo              NVARCHAR(30)    NOT NULL,
    nome_exibicao       NVARCHAR(100)   NOT NULL,
    descricao           NVARCHAR(MAX)   NULL,
    nivel_hierarquia    SMALLINT        NOT NULL    DEFAULT 0,
    pode_ser_atribuido  BIT             NOT NULL    DEFAULT 1,

    CONSTRAINT PK_perfis PRIMARY KEY (codigo)
);
```

---

### 4.2 `departamentos`

```sql
CREATE TABLE departamentos (
    id              CHAR(36)        NOT NULL,
    nome            NVARCHAR(255)   NOT NULL,
    codigo          NVARCHAR(20)    NULL,
    descricao       NVARCHAR(MAX)   NULL,
    ativo           BIT             NOT NULL    DEFAULT 1,
    criado_em       DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    atualizado_em   DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),

    CONSTRAINT PK_departamentos PRIMARY KEY (id),
    CONSTRAINT UQ_departamentos_nome   UNIQUE (nome),
    CONSTRAINT UQ_departamentos_codigo UNIQUE (codigo)
);
```

---

### 4.3 `usuarios`

```sql
CREATE TABLE usuarios (
    id                  CHAR(36)        NOT NULL,
    nome                NVARCHAR(255)   NOT NULL,
    email               NVARCHAR(255)   NOT NULL,
    hash_senha          NVARCHAR(255)   NOT NULL,
    perfil              NVARCHAR(30)    NOT NULL,
    status              NVARCHAR(20)    NOT NULL    DEFAULT 'ativo',
    tentativas_login    SMALLINT        NOT NULL    DEFAULT 0,
    senha_provisoria    BIT             NOT NULL    DEFAULT 0,
    ultimo_login        DATETIME2(0)    NULL,
    foto_url            NVARCHAR(500)   NULL,
    mfa_ativo           BIT             NOT NULL    DEFAULT 0,
    mfa_segredo         NVARCHAR(255)   NULL,
    criado_em           DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    atualizado_em       DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    criado_por_id       CHAR(36)        NULL,
    departamento_id     CHAR(36)        NULL,

    CONSTRAINT PK_usuarios PRIMARY KEY (id),
    CONSTRAINT UQ_usuarios_email UNIQUE (email),

    CONSTRAINT FK_usuarios_perfil
        FOREIGN KEY (perfil)
        REFERENCES perfis (codigo),

    CONSTRAINT FK_usuarios_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL,

    CONSTRAINT FK_usuarios_departamento
        FOREIGN KEY (departamento_id)
        REFERENCES departamentos (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_usuarios_email  ON usuarios (email);
CREATE INDEX ix_usuarios_status ON usuarios (status);
```

> **Nota:** A auto-referência `criado_por_id → usuarios.id` com `ON DELETE SET NULL` é suportada no SQL Server. O SQL Server não suporta múltiplas ações em cascata para a mesma tabela quando há ciclo — contudo, como apenas uma das FKs usa CASCADE (nenhuma, aqui todas usam SET NULL), não há conflito.

---

### 4.4 `sessoes_autenticacao`

```sql
CREATE TABLE sessoes_autenticacao (
    id                  CHAR(36)        NOT NULL,
    usuario_id          CHAR(36)        NOT NULL,
    hash_refresh_token  NVARCHAR(255)   NOT NULL,
    criado_em           DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    expira_em           DATETIME2(0)    NOT NULL,
    ultimo_uso_em       DATETIME2(0)    NULL,
    revogado_em         DATETIME2(0)    NULL,
    endereco_ip         NVARCHAR(45)    NULL,
    user_agent          NVARCHAR(500)   NULL,

    CONSTRAINT PK_sessoes_autenticacao PRIMARY KEY (id),
    CONSTRAINT UQ_sa_hash_refresh_token UNIQUE (hash_refresh_token),

    CONSTRAINT FK_sa_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id)
        ON DELETE CASCADE
);

CREATE INDEX ix_sa_usuario_id    ON sessoes_autenticacao (usuario_id);
CREATE INDEX ix_sa_usuario_ativo ON sessoes_autenticacao (usuario_id, revogado_em);
```

---

### 4.5 `espacos_trabalho`

```sql
CREATE TABLE espacos_trabalho (
    id                  CHAR(36)        NOT NULL,
    nome                NVARCHAR(255)   NOT NULL,
    id_workspace_pbi    NVARCHAR(255)   NULL,
    status              NVARCHAR(20)    NOT NULL    DEFAULT 'ativo',
    icone               NVARCHAR(100)   NULL,
    cor                 NVARCHAR(20)    NULL,
    descricao           NVARCHAR(MAX)   NULL,
    criado_em           DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    criado_por_id       CHAR(36)        NULL,

    CONSTRAINT PK_espacos_trabalho PRIMARY KEY (id),
    CONSTRAINT UQ_espacos_trabalho_nome UNIQUE (nome),

    CONSTRAINT FK_et_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);
```

---

### 4.6 `relatorios`

```sql
CREATE TABLE relatorios (
    id                  CHAR(36)        NOT NULL,
    nome                NVARCHAR(255)   NOT NULL,
    espaco_trabalho_id  CHAR(36)        NOT NULL,
    id_relatorio_pbi    NVARCHAR(255)   NULL,
    categoria           NVARCHAR(100)   NULL,
    status              NVARCHAR(20)    NOT NULL    DEFAULT 'publicado',
    descricao           NVARCHAR(MAX)   NULL,
    criado_em           DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    atualizado_em       DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    criado_por_id       CHAR(36)        NULL,

    CONSTRAINT PK_relatorios PRIMARY KEY (id),

    CONSTRAINT FK_relatorios_espaco
        FOREIGN KEY (espaco_trabalho_id)
        REFERENCES espacos_trabalho (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_relatorios_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);

CREATE INDEX ix_relatorios_espaco_trabalho_id      ON relatorios (espaco_trabalho_id);
CREATE INDEX ix_relatorios_espaco_status           ON relatorios (espaco_trabalho_id, status);
CREATE INDEX ix_relatorios_status                  ON relatorios (status);
```

---

### 4.7 `acessos_workspace`

```sql
CREATE TABLE acessos_workspace (
    id                  CHAR(36)        NOT NULL,
    usuario_id          CHAR(36)        NOT NULL,
    espaco_trabalho_id  CHAR(36)        NOT NULL,
    nivel_acesso        NVARCHAR(20)    NOT NULL    DEFAULT 'apenas_relatorios',
    concedido_por_id    CHAR(36)        NULL,
    concedido_em        DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),

    CONSTRAINT PK_acessos_workspace PRIMARY KEY (id),
    CONSTRAINT UQ_aw_usuario_espaco UNIQUE (usuario_id, espaco_trabalho_id),

    CONSTRAINT FK_aw_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_aw_espaco
        FOREIGN KEY (espaco_trabalho_id)
        REFERENCES espacos_trabalho (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_aw_concedido_por
        FOREIGN KEY (concedido_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);
```

> **Atenção:** Esta tabela tem duas FKs para `usuarios` (`usuario_id` CASCADE e `concedido_por_id` SET NULL) e uma FK para `espacos_trabalho` CASCADE. O SQL Server pode rejeitar múltiplos caminhos de cascade para a mesma tabela-pai. Se ocorrer o erro "múltiplos caminhos de cascata", substitua `ON DELETE CASCADE` em `FK_aw_usuario` por `ON DELETE NO ACTION` e implemente a deleção em cascata via trigger (ver seção 7).

---

### 4.8 `acessos_relatorio`

```sql
CREATE TABLE acessos_relatorio (
    id               CHAR(36)    NOT NULL,
    usuario_id       CHAR(36)    NOT NULL,
    relatorio_id     CHAR(36)    NOT NULL,
    concedido_por_id CHAR(36)    NULL,
    concedido_em     DATETIME2(0) NOT NULL DEFAULT GETDATE(),

    CONSTRAINT PK_acessos_relatorio PRIMARY KEY (id),
    CONSTRAINT UQ_ar_usuario_relatorio UNIQUE (usuario_id, relatorio_id),

    CONSTRAINT FK_ar_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_ar_relatorio
        FOREIGN KEY (relatorio_id)
        REFERENCES relatorios (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_ar_concedido_por
        FOREIGN KEY (concedido_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);
```

> **Atenção:** Mesmo cenário de múltiplos caminhos de cascade descrito em 4.7. `relatorios` já tem CASCADE de `espacos_trabalho`. Se `usuarios` também ativar CASCADE em `acessos_relatorio`, o SQL Server identificará um ciclo: `usuarios → acessos_relatorio` e `usuarios → relatorios → acessos_relatorio`. Solução: usar `NO ACTION` em `FK_ar_usuario` e implementar via trigger.

---

### 4.9 `permissoes_perfil`

```sql
CREATE TABLE permissoes_perfil (
    id               CHAR(36)        NOT NULL,
    perfil           NVARCHAR(30)    NOT NULL,
    modulo           NVARCHAR(100)   NOT NULL,
    pode_visualizar  BIT             NOT NULL    DEFAULT 0,
    pode_criar       BIT             NOT NULL    DEFAULT 0,
    pode_editar      BIT             NOT NULL    DEFAULT 0,
    pode_excluir     BIT             NOT NULL    DEFAULT 0,
    pode_exportar    BIT             NOT NULL    DEFAULT 0,
    pode_gerenciar   BIT             NOT NULL    DEFAULT 0,

    CONSTRAINT PK_permissoes_perfil PRIMARY KEY (id),
    CONSTRAINT UQ_pp_perfil_modulo  UNIQUE (perfil, modulo)
);
```

> **Nota:** A coluna `perfil` aqui **não possui FK** para a tabela `perfis`. O modelo SQLAlchemy também não declara essa FK — é uma referência implícita por valor de string. Considerar adicionar FK para integridade referencial (ver seção 9).

---

### 4.10 `regras_expediente`

```sql
CREATE TABLE regras_expediente (
    id            CHAR(36)        NOT NULL,
    dia_semana    SMALLINT        NOT NULL,
    hora_inicio   TIME(0)         NOT NULL,
    hora_fim      TIME(0)         NOT NULL,
    ativo         BIT             NOT NULL    DEFAULT 1,
    bloquear_fora BIT             NOT NULL    DEFAULT 1,
    atualizado_em DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),

    CONSTRAINT PK_regras_expediente PRIMARY KEY (id),
    CONSTRAINT UQ_re_dia_semana UNIQUE (dia_semana),
    CONSTRAINT CK_re_dia_semana CHECK (dia_semana BETWEEN 0 AND 6)
);
```

---

### 4.11 `grupos_excecao`

```sql
CREATE TABLE grupos_excecao (
    id                  CHAR(36)        NOT NULL,
    nome                NVARCHAR(255)   NOT NULL,
    fora_horario        BIT             NOT NULL    DEFAULT 1,
    janela_inicio       TIME(0)         NULL,
    janela_fim          TIME(0)         NULL,
    ignora_dia_inativo  BIT             NOT NULL    DEFAULT 0,
    status              NVARCHAR(20)    NOT NULL    DEFAULT 'ativo',
    criado_em           DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    criado_por_id       CHAR(36)        NULL,

    CONSTRAINT PK_grupos_excecao PRIMARY KEY (id),

    CONSTRAINT FK_ge_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);
```

---

### 4.12 `membros_grupo_excecao`

```sql
CREATE TABLE membros_grupo_excecao (
    grupo_id   CHAR(36)    NOT NULL,
    usuario_id CHAR(36)    NOT NULL,

    CONSTRAINT PK_membros_grupo_excecao PRIMARY KEY (grupo_id, usuario_id),

    CONSTRAINT FK_mge_grupo
        FOREIGN KEY (grupo_id)
        REFERENCES grupos_excecao (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_mge_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id)
        ON DELETE CASCADE
);
```

> **Atenção:** Dois caminhos de cascade convergem nesta tabela (`grupos_excecao` e `usuarios`). O SQL Server rejeitará isso. Solução: manter CASCADE em `FK_mge_grupo` e usar `NO ACTION` em `FK_mge_usuario`, com trigger para o segundo (ver seção 7).

---

### 4.13 `favoritos`

```sql
CREATE TABLE favoritos (
    id           CHAR(36)        NOT NULL,
    usuario_id   CHAR(36)        NOT NULL,
    relatorio_id CHAR(36)        NOT NULL,
    criado_em    DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),

    CONSTRAINT PK_favoritos PRIMARY KEY (id),
    CONSTRAINT UQ_fav_usuario_relatorio UNIQUE (usuario_id, relatorio_id),

    CONSTRAINT FK_fav_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_fav_relatorio
        FOREIGN KEY (relatorio_id)
        REFERENCES relatorios (id)
        ON DELETE CASCADE
);
```

> **Atenção:** Mesmo problema de múltiplos caminhos. `relatorios` é filho de `espacos_trabalho` (CASCADE) e `favoritos` tem duas FKs em CASCADE. O SQL Server pode rejeitar. Solução idêntica: `NO ACTION` em `FK_fav_relatorio` + trigger (ver seção 7).

---

### 4.14 `logs_auditoria`

```sql
CREATE TABLE logs_auditoria (
    id             CHAR(36)        NOT NULL,
    momento        DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    usuario_id     CHAR(36)        NULL,
    nome_usuario   NVARCHAR(255)   NULL,
    email_usuario  NVARCHAR(255)   NULL,
    tipo_evento    NVARCHAR(50)    NOT NULL,
    modulo         NVARCHAR(100)   NOT NULL,
    detalhe        NVARCHAR(MAX)   NOT NULL,
    endereco_ip    NVARCHAR(45)    NULL,
    valor_anterior NVARCHAR(MAX)   NULL,
    valor_novo     NVARCHAR(MAX)   NULL,

    CONSTRAINT PK_logs_auditoria PRIMARY KEY (id)
);

CREATE INDEX ix_la_momento    ON logs_auditoria (momento);
CREATE INDEX ix_la_usuario_id ON logs_auditoria (usuario_id);
CREATE INDEX ix_la_tipo_evento ON logs_auditoria (tipo_evento);
CREATE INDEX ix_la_modulo     ON logs_auditoria (modulo);
```

> `usuario_id` aqui é **deliberadamente sem FK** — o log deve ser preservado mesmo após exclusão do usuário. O nome e e-mail são desnormalizados por esse motivo.

---

### 4.15 `configuracoes_sistema`

```sql
CREATE TABLE configuracoes_sistema (
    chave              NVARCHAR(255)   NOT NULL,
    valor              NVARCHAR(MAX)   NOT NULL,
    eh_secreto         BIT             NOT NULL    DEFAULT 0,
    atualizado_em      DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    atualizado_por_id  CHAR(36)        NULL,

    CONSTRAINT PK_configuracoes_sistema PRIMARY KEY (chave),

    CONSTRAINT FK_cs_atualizado_por
        FOREIGN KEY (atualizado_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);
```

---

### 4.16 `historico_config_critica`

```sql
CREATE TABLE historico_config_critica (
    id                  CHAR(36)        NOT NULL,
    momento             DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    entidade            NVARCHAR(50)    NOT NULL,
    entidade_id         CHAR(36)        NULL,
    campo               NVARCHAR(100)   NOT NULL,
    valor_anterior      NVARCHAR(MAX)   NULL,
    valor_novo          NVARCHAR(MAX)   NULL,
    alterado_por_id     CHAR(36)        NULL,
    alterado_por_nome   NVARCHAR(255)   NULL,
    alterado_por_email  NVARCHAR(255)   NULL,

    CONSTRAINT PK_historico_config_critica PRIMARY KEY (id)
);

CREATE INDEX ix_hcc_momento    ON historico_config_critica (momento);
CREATE INDEX ix_hcc_entidade   ON historico_config_critica (entidade);
CREATE INDEX ix_hcc_entidade_id ON historico_config_critica (entidade_id);
```

> Assim como `logs_auditoria`, os dados do autor da alteração são desnormalizados intencionalmente.

---

### 4.17 `credenciais_pbi`

```sql
CREATE TABLE credenciais_pbi (
    id                CHAR(36)        NOT NULL,
    tenant_id         NVARCHAR(255)   NULL,
    client_id         NVARCHAR(255)   NULL,
    client_secret     NVARCHAR(500)   NULL,
    ativo             BIT             NOT NULL    DEFAULT 1,
    atualizado_em     DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    atualizado_por_id CHAR(36)        NULL,

    CONSTRAINT PK_credenciais_pbi PRIMARY KEY (id),

    CONSTRAINT FK_cpbi_atualizado_por
        FOREIGN KEY (atualizado_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);
```

---

### 4.18 `pacotes_permissao`

```sql
CREATE TABLE pacotes_permissao (
    id            CHAR(36)        NOT NULL,
    nome          NVARCHAR(255)   NOT NULL,
    descricao     NVARCHAR(MAX)   NULL,
    criado_em     DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),
    criado_por_id CHAR(36)        NULL,

    CONSTRAINT PK_pacotes_permissao PRIMARY KEY (id),
    CONSTRAINT UQ_pp_nome UNIQUE (nome),

    CONSTRAINT FK_pp_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);
```

---

### 4.19 `pacotes_permissao_itens`

```sql
CREATE TABLE pacotes_permissao_itens (
    id              CHAR(36)        NOT NULL,
    pacote_id       CHAR(36)        NOT NULL,
    modulo          NVARCHAR(100)   NOT NULL,
    pode_visualizar BIT             NOT NULL    DEFAULT 0,
    pode_criar      BIT             NOT NULL    DEFAULT 0,
    pode_editar     BIT             NOT NULL    DEFAULT 0,
    pode_excluir    BIT             NOT NULL    DEFAULT 0,
    pode_exportar   BIT             NOT NULL    DEFAULT 0,
    pode_gerenciar  BIT             NOT NULL    DEFAULT 0,

    CONSTRAINT PK_pacotes_permissao_itens PRIMARY KEY (id),
    CONSTRAINT UQ_ppi_pacote_modulo UNIQUE (pacote_id, modulo),

    CONSTRAINT FK_ppi_pacote
        FOREIGN KEY (pacote_id)
        REFERENCES pacotes_permissao (id)
        ON DELETE CASCADE
);
```

---

### 4.20 `usuarios_pacotes`

```sql
CREATE TABLE usuarios_pacotes (
    id               CHAR(36)        NOT NULL,
    usuario_id       CHAR(36)        NOT NULL,
    pacote_id        CHAR(36)        NOT NULL,
    atribuido_por_id CHAR(36)        NULL,
    atribuido_em     DATETIME2(0)    NOT NULL    DEFAULT GETDATE(),

    CONSTRAINT PK_usuarios_pacotes PRIMARY KEY (id),
    CONSTRAINT UQ_up_usuario_pacote UNIQUE (usuario_id, pacote_id),

    CONSTRAINT FK_up_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_up_pacote
        FOREIGN KEY (pacote_id)
        REFERENCES pacotes_permissao (id)
        ON DELETE CASCADE,

    CONSTRAINT FK_up_atribuido_por
        FOREIGN KEY (atribuido_por_id)
        REFERENCES usuarios (id)
        ON DELETE SET NULL
);
```

> **Atenção:** Mesmo problema de múltiplos caminhos. `FK_up_usuario` e `FK_up_atribuido_por` ambas referenciam `usuarios`. O SQL Server aceita múltiplas FKs para a mesma tabela, **desde que apenas uma use CASCADE** — o que é o caso aqui (`CASCADE` em `usuario_id`, `SET NULL` em `atribuido_por_id`). Deve funcionar sem trigger neste caso.

---

## 5. Triggers para `atualizado_em` e Cascades Manuais

### 5.1 Trigger para `atualizado_em` (tabelas sem onupdate automático no SQL Server)

O SQLAlchemy envia o valor de `atualizado_em` pela aplicação, mas para segurança operacional, os triggers abaixo garantem que updates manuais no banco também atualizem o campo:

```sql
-- Trigger genérico: departamentos
CREATE TRIGGER trg_departamentos_atualizado_em
ON departamentos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE departamentos
    SET atualizado_em = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

-- Repetir o padrão para: usuarios, relatorios, regras_expediente,
-- configuracoes_sistema, credenciais_pbi
-- (Trocar o nome da tabela e a coluna PK conforme necessário)
```

### 5.2 Triggers para cascades manuais (múltiplos caminhos)

Para as tabelas onde o SQL Server rejeita múltiplos CASCADE, usar `ON DELETE NO ACTION` na FK secundária e implementar via trigger:

```sql
-- Exemplo: ao deletar um usuario, remover seus acessos_relatorio
-- (quando FK_ar_usuario usa NO ACTION)
CREATE TRIGGER trg_delete_usuario_acessos_relatorio
ON usuarios
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM acessos_relatorio
    WHERE usuario_id IN (SELECT id FROM deleted);
END;
GO

-- Ao deletar um usuario, remover seus acessos_workspace
CREATE TRIGGER trg_delete_usuario_acessos_workspace
ON usuarios
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM acessos_workspace
    WHERE usuario_id IN (SELECT id FROM deleted);
END;
GO

-- Ao deletar um usuario, remover seus favoritos
CREATE TRIGGER trg_delete_usuario_favoritos
ON usuarios
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM favoritos
    WHERE usuario_id IN (SELECT id FROM deleted);
END;
GO

-- Ao deletar um usuario, remover membros_grupo_excecao
CREATE TRIGGER trg_delete_usuario_membros_grupo
ON usuarios
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM membros_grupo_excecao
    WHERE usuario_id IN (SELECT id FROM deleted);
END;
GO
```

---

## 6. Seed — Dados Iniciais Obrigatórios

### 6.1 Perfis do sistema

Os perfis são dados mestres do sistema. Os slugs atuais (após a migration `rename_perfis.sql`) são:

```sql
INSERT INTO perfis (codigo, nome_exibicao, descricao, nivel_hierarquia, pode_ser_atribuido) VALUES
('master',        'Master',         'Acesso total irrestrito ao sistema.',                        100, 0),
('administrador', 'Administrador',  'Administra usuários, workspaces e configurações do sistema.', 80, 1),
('coordenador',   'Coordenador',    'Gerencia workspaces e relatórios atribuídos.',                60, 1),
('colaborador',   'Colaborador',    'Acessa relatórios conforme permissões concedidas.',           40, 1),
('convidado',     'Convidado',      'Acesso somente leitura a recursos explicitamente liberados.', 20, 1);
```

> **Importante:** O perfil `master` tem `pode_ser_atribuido = 0` para impedir atribuição via interface. O usuário `master` é criado diretamente pelo seed.

### 6.2 Usuário master

O `seed.py` cria o usuário master com senha hash bcrypt de `'123456'`. Para o SQL Server, inserir com hash pré-gerado:

```sql
-- ATENÇÃO: Substituir o valor de hash_senha pelo hash bcrypt real gerado pelo sistema.
-- O hash abaixo é apenas um placeholder. Não use em produção sem regenerar.
-- Execute: python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('123456'))"
-- para obter o hash real antes de executar este INSERT.

INSERT INTO usuarios (
    id, nome, email, hash_senha, perfil, status,
    tentativas_login, senha_provisoria, mfa_ativo,
    criado_em, atualizado_em
)
VALUES (
    NEWID(),  -- ou um UUID fixo para garantir idempotência
    'Master',
    'master@cgid.com',
    '$2b$12$PLACEHOLDER_SUBSTITUA_PELO_HASH_BCRYPT_REAL',
    'master',
    'ativo',
    0, 0, 0,
    GETDATE(), GETDATE()
);
```

> **Recomendação:** Gerar o hash via `seed.py` ou script Python e colar o valor real aqui. Nunca armazenar senha em texto plano.

---

## 7. Diagrama de Relacionamentos (Textual)

```
perfis ──────────────────────────────────────┐
                                             │ (codigo → perfil)
departamentos ──────────────────────────┐    │
                                        │    │
usuarios ←──────────────────────────────┘◄───┘
   │ (id → criado_por_id, auto-ref)
   │
   ├──► sessoes_autenticacao      CASCADE
   ├──► espacos_trabalho          SET NULL (criado_por_id)
   │        │
   │        └──► relatorios       CASCADE
   │                 │
   │                 ├──► acessos_relatorio   CASCADE (relatorio_id)
   │                 └──► favoritos           CASCADE (relatorio_id)
   │
   ├──► acessos_workspace         CASCADE (usuario_id)
   ├──► acessos_relatorio         CASCADE (usuario_id)
   ├──► favoritos                 CASCADE (usuario_id)
   ├──► membros_grupo_excecao     CASCADE (usuario_id)
   ├──► usuarios_pacotes          CASCADE (usuario_id)
   │
   ├──► grupos_excecao            SET NULL (criado_por_id)
   │        └──► membros_grupo_excecao  CASCADE (grupo_id)
   │
   ├──► configuracoes_sistema     SET NULL (atualizado_por_id)
   ├──► credenciais_pbi           SET NULL (atualizado_por_id)
   └──► pacotes_permissao         SET NULL (criado_por_id)
            │
            ├──► pacotes_permissao_itens  CASCADE (pacote_id)
            └──► usuarios_pacotes         CASCADE (pacote_id)

permissoes_perfil      (sem FK — referência implícita a perfis.codigo)
regras_expediente      (sem FK — tabela independente)
logs_auditoria         (sem FK — append-only)
historico_config_critica (sem FK — append-only)
```

---

## 8. Resumo de Todas as Constraints

| Tabela | Constraint | Tipo | Colunas |
|---|---|---|---|
| `perfis` | `PK_perfis` | PK | `codigo` |
| `departamentos` | `PK_departamentos` | PK | `id` |
| `departamentos` | `UQ_departamentos_nome` | UNIQUE | `nome` |
| `departamentos` | `UQ_departamentos_codigo` | UNIQUE | `codigo` |
| `usuarios` | `PK_usuarios` | PK | `id` |
| `usuarios` | `UQ_usuarios_email` | UNIQUE | `email` |
| `usuarios` | `FK_usuarios_perfil` | FK | `perfil → perfis.codigo` |
| `usuarios` | `FK_usuarios_criado_por` | FK SET NULL | `criado_por_id → usuarios.id` |
| `usuarios` | `FK_usuarios_departamento` | FK SET NULL | `departamento_id → departamentos.id` |
| `sessoes_autenticacao` | `PK_sessoes_autenticacao` | PK | `id` |
| `sessoes_autenticacao` | `UQ_sa_hash_refresh_token` | UNIQUE | `hash_refresh_token` |
| `sessoes_autenticacao` | `FK_sa_usuario` | FK CASCADE | `usuario_id → usuarios.id` |
| `espacos_trabalho` | `PK_espacos_trabalho` | PK | `id` |
| `espacos_trabalho` | `UQ_espacos_trabalho_nome` | UNIQUE | `nome` |
| `espacos_trabalho` | `FK_et_criado_por` | FK SET NULL | `criado_por_id → usuarios.id` |
| `relatorios` | `PK_relatorios` | PK | `id` |
| `relatorios` | `FK_relatorios_espaco` | FK CASCADE | `espaco_trabalho_id → espacos_trabalho.id` |
| `relatorios` | `FK_relatorios_criado_por` | FK SET NULL | `criado_por_id → usuarios.id` |
| `acessos_workspace` | `PK_acessos_workspace` | PK | `id` |
| `acessos_workspace` | `UQ_aw_usuario_espaco` | UNIQUE | `(usuario_id, espaco_trabalho_id)` |
| `acessos_workspace` | `FK_aw_usuario` | FK CASCADE¹ | `usuario_id → usuarios.id` |
| `acessos_workspace` | `FK_aw_espaco` | FK CASCADE | `espaco_trabalho_id → espacos_trabalho.id` |
| `acessos_workspace` | `FK_aw_concedido_por` | FK SET NULL | `concedido_por_id → usuarios.id` |
| `acessos_relatorio` | `PK_acessos_relatorio` | PK | `id` |
| `acessos_relatorio` | `UQ_ar_usuario_relatorio` | UNIQUE | `(usuario_id, relatorio_id)` |
| `acessos_relatorio` | `FK_ar_usuario` | FK CASCADE¹ | `usuario_id → usuarios.id` |
| `acessos_relatorio` | `FK_ar_relatorio` | FK CASCADE | `relatorio_id → relatorios.id` |
| `acessos_relatorio` | `FK_ar_concedido_por` | FK SET NULL | `concedido_por_id → usuarios.id` |
| `permissoes_perfil` | `PK_permissoes_perfil` | PK | `id` |
| `permissoes_perfil` | `UQ_pp_perfil_modulo` | UNIQUE | `(perfil, modulo)` |
| `regras_expediente` | `PK_regras_expediente` | PK | `id` |
| `regras_expediente` | `UQ_re_dia_semana` | UNIQUE | `dia_semana` |
| `regras_expediente` | `CK_re_dia_semana` | CHECK | `dia_semana BETWEEN 0 AND 6` |
| `grupos_excecao` | `PK_grupos_excecao` | PK | `id` |
| `grupos_excecao` | `FK_ge_criado_por` | FK SET NULL | `criado_por_id → usuarios.id` |
| `membros_grupo_excecao` | `PK_membros_grupo_excecao` | PK | `(grupo_id, usuario_id)` |
| `membros_grupo_excecao` | `FK_mge_grupo` | FK CASCADE | `grupo_id → grupos_excecao.id` |
| `membros_grupo_excecao` | `FK_mge_usuario` | FK CASCADE¹ | `usuario_id → usuarios.id` |
| `favoritos` | `PK_favoritos` | PK | `id` |
| `favoritos` | `UQ_fav_usuario_relatorio` | UNIQUE | `(usuario_id, relatorio_id)` |
| `favoritos` | `FK_fav_usuario` | FK CASCADE | `usuario_id → usuarios.id` |
| `favoritos` | `FK_fav_relatorio` | FK CASCADE¹ | `relatorio_id → relatorios.id` |
| `logs_auditoria` | `PK_logs_auditoria` | PK | `id` |
| `configuracoes_sistema` | `PK_configuracoes_sistema` | PK | `chave` |
| `configuracoes_sistema` | `FK_cs_atualizado_por` | FK SET NULL | `atualizado_por_id → usuarios.id` |
| `historico_config_critica` | `PK_historico_config_critica` | PK | `id` |
| `credenciais_pbi` | `PK_credenciais_pbi` | PK | `id` |
| `credenciais_pbi` | `FK_cpbi_atualizado_por` | FK SET NULL | `atualizado_por_id → usuarios.id` |
| `pacotes_permissao` | `PK_pacotes_permissao` | PK | `id` |
| `pacotes_permissao` | `UQ_pp_nome` | UNIQUE | `nome` |
| `pacotes_permissao` | `FK_pp_criado_por` | FK SET NULL | `criado_por_id → usuarios.id` |
| `pacotes_permissao_itens` | `PK_pacotes_permissao_itens` | PK | `id` |
| `pacotes_permissao_itens` | `UQ_ppi_pacote_modulo` | UNIQUE | `(pacote_id, modulo)` |
| `pacotes_permissao_itens` | `FK_ppi_pacote` | FK CASCADE | `pacote_id → pacotes_permissao.id` |
| `usuarios_pacotes` | `PK_usuarios_pacotes` | PK | `id` |
| `usuarios_pacotes` | `UQ_up_usuario_pacote` | UNIQUE | `(usuario_id, pacote_id)` |
| `usuarios_pacotes` | `FK_up_usuario` | FK CASCADE | `usuario_id → usuarios.id` |
| `usuarios_pacotes` | `FK_up_pacote` | FK CASCADE | `pacote_id → pacotes_permissao.id` |
| `usuarios_pacotes` | `FK_up_atribuido_por` | FK SET NULL | `atribuido_por_id → usuarios.id` |

> ¹ Marcadas com CASCADE no modelo SQLAlchemy, mas podem precisar ser substituídas por `NO ACTION` + trigger no SQL Server devido à restrição de múltiplos caminhos de cascade (ver seção 5.2).

---

## 9. Inconsistências e Melhorias Identificadas

### 9.1 `permissoes_perfil.perfil` sem FK declarada

A coluna `permissoes_perfil.perfil` referencia logicamente `perfis.codigo`, mas **nenhuma FK está declarada** no modelo. Isso permite inserir permissões para perfis inexistentes.

**Recomendação antes da migração:**
```sql
ALTER TABLE permissoes_perfil
ADD CONSTRAINT FK_pp_perfil
    FOREIGN KEY (perfil)
    REFERENCES perfis (codigo)
    ON DELETE CASCADE;
```

### 9.2 `usuarios.perfil` sem `ON DELETE` definido

A FK `FK_usuarios_perfil` não define comportamento em `ON DELETE`. O SQL Server usará `NO ACTION` (padrão), o que impede excluir um perfil enquanto há usuários com ele. Comportamento correto, mas deve ser documentado na operação.

### 9.3 `credenciais_pbi` sem controle de unicidade

Não há constraint impedindo múltiplas credenciais ativas simultaneamente. A lógica de "apenas uma ativa" é gerenciada pela aplicação.

**Recomendação (opcional):**
```sql
CREATE UNIQUE INDEX UQ_cpbi_ativo
ON credenciais_pbi (ativo)
WHERE ativo = 1;
-- Filtered index — impede mais de uma linha com ativo = 1
```

### 9.4 `logs_auditoria` crescimento sem particionamento

Esta tabela é append-only e não possui estratégia de purga ou particionamento. Em produção, considerar:
- Particionamento por `momento` (mês/ano)
- Política de retenção com arquivamento para tabela histórica
- Index columnstore para consultas analíticas

### 9.5 Numeração do modelo tem lacuna

O modelo numera os comentários de 1 a 21, mas pula do `# 5. Relatórios` direto para `# 7. Acessos por Workspace` — o número 6 não existe no arquivo. Não há tabela faltando (são 21 ao total), é apenas inconsistência na numeração dos comentários do código.

### 9.6 `DATABASE_URL` hardcoded

A string de conexão `sqlite:///./cgid.db` está hardcoded em `backend/database.py`. Para SQL Server, ela deverá ser lida de variável de ambiente:

```python
# Trocar em database.py:
import os
DATABASE_URL = os.getenv("DATABASE_URL", "mssql+pyodbc://user:pass@server/db?driver=ODBC+Driver+18+for+SQL+Server")
```

E adicionar a dependência:
```
pip install pyodbc mssql-django  # ou apenas pyodbc para SQLAlchemy
```

### 9.7 Alembic configurado para SQLite

O `alembic.ini` aponta para `sqlite:///./cgid.db` e `migrations/env.py` usa `render_as_batch=True` (workaround para SQLite). Para SQL Server:
- Atualizar `sqlalchemy.url` no `alembic.ini` ou mover para env var
- Remover `render_as_batch=True`

### 9.8 Ausência de índices em colunas de join frequente

As colunas abaixo participam de joins frequentes mas não têm índice explícito:
- `acessos_workspace.espaco_trabalho_id`
- `acessos_relatorio.relatorio_id`
- `membros_grupo_excecao.usuario_id`
- `usuarios_pacotes.pacote_id`
- `pacotes_permissao_itens.pacote_id`

**Recomendação:**
```sql
CREATE INDEX ix_aw_espaco_trabalho_id    ON acessos_workspace (espaco_trabalho_id);
CREATE INDEX ix_ar_relatorio_id          ON acessos_relatorio (relatorio_id);
CREATE INDEX ix_mge_usuario_id           ON membros_grupo_excecao (usuario_id);
CREATE INDEX ix_up_pacote_id             ON usuarios_pacotes (pacote_id);
CREATE INDEX ix_ppi_pacote_id            ON pacotes_permissao_itens (pacote_id);
```

---

## 10. Checklist de Migração

- [ ] Instalar driver ODBC para SQL Server no servidor da aplicação
- [ ] Adicionar `pyodbc` ao `requirements.txt`
- [ ] Mover `DATABASE_URL` para variável de ambiente
- [ ] Atualizar `alembic.ini` com a nova string de conexão
- [ ] Remover `render_as_batch=True` do `migrations/env.py`
- [ ] Testar se o SQL Server rejeita múltiplos CASCADE (seção 4.7, 4.8, 4.12, 4.13) e aplicar triggers conforme necessário (seção 5.2)
- [ ] Criar banco de dados no SQL Server com collation `Latin1_General_CI_AI` ou `SQL_Latin1_General_CP1_CI_AS`
- [ ] Executar scripts `CREATE TABLE` na ordem da seção 3
- [ ] Executar seed de `perfis` (seção 6.1)
- [ ] Gerar hash bcrypt real e executar seed do usuário master (seção 6.2)
- [ ] Executar índices adicionais recomendados (seção 9.8)
- [ ] Validar que a aplicação Python conecta e performa CRUD em todas as tabelas
- [ ] Verificar que `atualizado_em` é atualizado corretamente via ORM (e via triggers se necessário)
- [ ] Testar deleção de usuário e verificar cascades

---

*Documento gerado com base no estado atual do repositório em 2026-06-26.*

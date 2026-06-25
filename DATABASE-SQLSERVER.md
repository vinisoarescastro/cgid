# DATABASE-SQLSERVER.md — CGID: Scripts SQL Server

> **Projeto:** CGID — Centro de Governança e Inteligência de Dados  
> **SGBD:** Microsoft SQL Server 2017+ / Azure SQL Database  
> **Collation:** Latin1_General_CI_AS  
> **Schema:** `dbo` (padrão)  
> **Versão:** 2.0  
> **Criado em:** 2026-06-23  
> **Atualizado em:** 2026-06-25  
> **Referência:** [DATABASE.md](DATABASE.md)

---

## Pré-requisitos

- SQL Server 2017 ou superior (ou Azure SQL Database)
- Login com permissão `sysadmin` ou `dbcreator` para criar o banco
- Driver ODBC 17+ instalado na máquina do backend
- Python backend configurado com `DATABASE_URL` apontando para SQL Server:

```python
# backend/database.py
DATABASE_URL = (
    "mssql+pyodbc://usuario:senha@servidor/cgid"
    "?driver=ODBC+Driver+17+for+SQL+Server"
)
```

> **Como executar:** Copie cada seção no SQL Server Management Studio (SSMS) ou use `sqlcmd`. Execute na ordem apresentada. Cada bloco termina com `GO`.

---

## Sumário

1. [Banco de Dados](#seção-1--banco-de-dados)
2. [Schema](#seção-2--schema)
3. [Tabelas sem dependências externas](#seção-3--tabelas-sem-dependências-externas)
4. [Tabelas com dependências](#seção-4--tabelas-com-dependências)
5. [Chaves Primárias](#seção-5--chaves-primárias)
6. [Chaves Estrangeiras](#seção-6--chaves-estrangeiras)
7. [Índices](#seção-7--índices)
8. [Triggers](#seção-8--triggers)
9. [Dados Iniciais (Seed)](#seção-9--dados-iniciais-seed)
10. [Checklist de Validação](#checklist-de-validação)
11. [Diferenças em relação ao SQLite](#diferenças-em-relação-ao-sqlite)

> **v2.0:** Schema expandido para 21 tabelas. Novas tabelas: `departamentos`, `categorias_relatorio`, `perfis`, `credenciais_pbi`, `pacotes_permissao`, `pacotes_permissao_itens`, `usuarios_pacotes`. Removida: `sobrescritas_permissao`. Adicionadas colunas: `usuarios.departamento_id`, `relatorios.categoria_id`. Corrigido CASCADE em `membros_grupo_excecao.usuario_id`.

---

## Seção 1 — Banco de Dados

> Execute como `sysadmin` conectado ao banco `master`.

```sql
USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'cgid')
BEGIN
    CREATE DATABASE cgid
        COLLATE Latin1_General_CI_AS;
    PRINT 'Banco [cgid] criado com sucesso.';
END
ELSE
    PRINT 'Banco [cgid] ja existe. Continuando...';
GO

USE cgid;
GO
```

---

## Seção 2 — Schema

O schema padrão `dbo` do SQL Server é utilizado para todos os objetos. Nenhum schema adicional é necessário.

```sql
USE cgid;
GO
-- Todos os objetos serao criados em dbo (schema padrao do SQL Server).
PRINT 'Schema: utilizando [dbo] padrao.';
GO
```

---

## Seção 3 — Tabelas sem dependências externas

> Tabelas que não possuem FK apontando para outras tabelas desta aplicação.
> A FK auto-referencial de `usuarios.criado_por_id` e a FK `usuarios.departamento_id` serão adicionadas na Seção 6.

---

### 3.0 — `departamentos` *(novo em v2.0)*

```sql
IF OBJECT_ID('dbo.departamentos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.departamentos (
        id            NVARCHAR(36)  NOT NULL CONSTRAINT df_dep_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        nome          NVARCHAR(255) NOT NULL,
        codigo        NVARCHAR(20)       NULL,
        descricao     NVARCHAR(MAX)      NULL,
        ativo         BIT           NOT NULL CONSTRAINT df_dep_ativo   DEFAULT 1,
        criado_em     DATETIME2(7)  NOT NULL CONSTRAINT df_dep_criado  DEFAULT GETUTCDATE(),
        atualizado_em DATETIME2(7)  NOT NULL CONSTRAINT df_dep_atualiz DEFAULT GETUTCDATE(),
        CONSTRAINT pk_departamentos PRIMARY KEY (id),
        CONSTRAINT uq_dep_nome      UNIQUE (nome),
        CONSTRAINT uq_dep_codigo    UNIQUE (codigo)
    );
    PRINT 'Tabela [departamentos] criada.';
END
ELSE
    PRINT 'Tabela [departamentos] ja existe.';
GO
```

---

### 3.1 — `usuarios`

```sql
IF OBJECT_ID('dbo.usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.usuarios (
        id               NVARCHAR(36)  NOT NULL CONSTRAINT df_usuarios_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        nome             NVARCHAR(255) NOT NULL,
        email            NVARCHAR(255) NOT NULL,
        hash_senha       NVARCHAR(255) NOT NULL,
        perfil           NVARCHAR(30)  NOT NULL,
        -- Valores validos: master | administrador | coordenador | colaborador | convidado
        status           NVARCHAR(20)  NOT NULL CONSTRAINT df_usuarios_status   DEFAULT N'ativo',
        -- Valores validos: ativo | inativo | bloqueado
        tentativas_login SMALLINT      NOT NULL CONSTRAINT df_usuarios_tent     DEFAULT 0,
        senha_provisoria BIT           NOT NULL CONSTRAINT df_usuarios_prov     DEFAULT 0,
        ultimo_login     DATETIME2(7)       NULL,
        foto_url         NVARCHAR(500)      NULL,
        mfa_ativo        BIT           NOT NULL CONSTRAINT df_usuarios_mfa      DEFAULT 0,
        mfa_segredo      NVARCHAR(255)      NULL,
        criado_em        DATETIME2(7)  NOT NULL CONSTRAINT df_usuarios_criado   DEFAULT GETUTCDATE(),
        atualizado_em    DATETIME2(7)  NOT NULL CONSTRAINT df_usuarios_atualiz  DEFAULT GETUTCDATE(),
        criado_por_id    NVARCHAR(36)       NULL,
        -- FK auto-referencial adicionada na Secao 6 (SQL Server nao permite SET NULL em FK auto-referencial)
        departamento_id  NVARCHAR(36)       NULL,
        -- FK para departamentos adicionada na Secao 6 (novo em v2.0)
        CONSTRAINT pk_usuarios          PRIMARY KEY (id),
        CONSTRAINT uq_usuarios_email    UNIQUE (email)
    );
    PRINT 'Tabela [usuarios] criada.';
END
ELSE
    PRINT 'Tabela [usuarios] ja existe.';
GO
```

---

### 3.1b — `perfis` *(novo em v2.0)*

```sql
IF OBJECT_ID('dbo.perfis', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.perfis (
        codigo             NVARCHAR(30)  NOT NULL,
        nome_exibicao      NVARCHAR(100) NOT NULL,
        descricao          NVARCHAR(MAX)      NULL,
        nivel_hierarquia   SMALLINT      NOT NULL CONSTRAINT df_per_nivel   DEFAULT 0,
        pode_ser_atribuido BIT           NOT NULL CONSTRAINT df_per_atrib   DEFAULT 1,
        CONSTRAINT pk_perfis PRIMARY KEY (codigo)
    );
    PRINT 'Tabela [perfis] criada.';
END
ELSE
    PRINT 'Tabela [perfis] ja existe.';
GO
```

---

### 3.2 — `permissoes_perfil`

```sql
IF OBJECT_ID('dbo.permissoes_perfil', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.permissoes_perfil (
        id              NVARCHAR(36) NOT NULL CONSTRAINT df_pp_id     DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        perfil          NVARCHAR(30) NOT NULL,
        modulo          NVARCHAR(100) NOT NULL,
        pode_visualizar BIT          NOT NULL CONSTRAINT df_pp_vis    DEFAULT 0,
        pode_criar      BIT          NOT NULL CONSTRAINT df_pp_cri    DEFAULT 0,
        pode_editar     BIT          NOT NULL CONSTRAINT df_pp_edi    DEFAULT 0,
        pode_excluir    BIT          NOT NULL CONSTRAINT df_pp_exc    DEFAULT 0,
        pode_exportar   BIT          NOT NULL CONSTRAINT df_pp_exp    DEFAULT 0,
        pode_gerenciar  BIT          NOT NULL CONSTRAINT df_pp_ger    DEFAULT 0,
        CONSTRAINT pk_permissoes_perfil   PRIMARY KEY (id),
        CONSTRAINT uq_pp_perfil_modulo    UNIQUE (perfil, modulo)
    );
    PRINT 'Tabela [permissoes_perfil] criada.';
END
ELSE
    PRINT 'Tabela [permissoes_perfil] ja existe.';
GO
```

---

### 3.3 — `regras_expediente`

```sql
IF OBJECT_ID('dbo.regras_expediente', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.regras_expediente (
        id            NVARCHAR(36) NOT NULL CONSTRAINT df_re_id     DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        dia_semana    SMALLINT     NOT NULL,
        -- 0 = Domingo, 1 = Segunda, ..., 6 = Sabado
        hora_inicio   TIME(0)      NOT NULL,
        hora_fim      TIME(0)      NOT NULL,
        ativo         BIT          NOT NULL CONSTRAINT df_re_ativo   DEFAULT 1,
        -- 0 = dia sem restricao de horario (ex: fim de semana)
        bloquear_fora BIT          NOT NULL CONSTRAINT df_re_bloq    DEFAULT 1,
        -- 1 = bloqueia acesso fora do horario configurado
        atualizado_em DATETIME2(7) NOT NULL CONSTRAINT df_re_atualiz DEFAULT GETUTCDATE(),
        CONSTRAINT pk_regras_expediente  PRIMARY KEY (id),
        CONSTRAINT uq_re_dia_semana      UNIQUE (dia_semana)
    );
    PRINT 'Tabela [regras_expediente] criada.';
END
ELSE
    PRINT 'Tabela [regras_expediente] ja existe.';
GO
```

---

### 3.4 — `logs_auditoria`

> Tabela append-only. A Seção 8 cria um trigger que bloqueia UPDATE e DELETE.

```sql
IF OBJECT_ID('dbo.logs_auditoria', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.logs_auditoria (
        id             NVARCHAR(36)  NOT NULL CONSTRAINT df_la_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        momento        DATETIME2(7)  NOT NULL CONSTRAINT df_la_momento DEFAULT GETUTCDATE(),
        usuario_id     NVARCHAR(36)       NULL,
        -- Sem FK intencional: registros devem sobreviver a exclusao do usuario
        nome_usuario   NVARCHAR(255)      NULL,  -- snapshot imutavel do nome
        email_usuario  NVARCHAR(255)      NULL,  -- snapshot imutavel do e-mail
        tipo_evento    NVARCHAR(50)  NOT NULL,
        -- Valores: autenticacao | usuario | acesso | relatorio | seguranca | sistema | critico
        modulo         NVARCHAR(100) NOT NULL,
        -- Valores reais usados: autenticacao | usuarios | acessos_workspace | acessos_relatorio
        --                       | espacos_trabalho | relatorios | expediente | grupos_excecao | configuracoes_pbi
        detalhe        NVARCHAR(MAX) NOT NULL,
        endereco_ip    NVARCHAR(45)       NULL,
        valor_anterior NVARCHAR(MAX)      NULL,  -- JSON
        valor_novo     NVARCHAR(MAX)      NULL,  -- JSON
        CONSTRAINT pk_logs_auditoria PRIMARY KEY (id)
    );
    PRINT 'Tabela [logs_auditoria] criada.';
END
ELSE
    PRINT 'Tabela [logs_auditoria] ja existe.';
GO
```

---

### 3.5 — `historico_config_critica`

> Tabela de auditoria de campos críticos. Sem FK intencional para preservar histórico.

```sql
IF OBJECT_ID('dbo.historico_config_critica', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.historico_config_critica (
        id                  NVARCHAR(36)  NOT NULL CONSTRAINT df_hcc_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        momento             DATETIME2(7)  NOT NULL CONSTRAINT df_hcc_momento DEFAULT GETUTCDATE(),
        entidade            NVARCHAR(50)  NOT NULL,
        -- Valores: workspace | relatorio | pbi_credenciais
        entidade_id         NVARCHAR(36)       NULL,
        -- ID do workspace/relatorio; NULL para credenciais PBI
        campo               NVARCHAR(100) NOT NULL,
        valor_anterior      NVARCHAR(MAX)      NULL,
        valor_novo          NVARCHAR(MAX)      NULL,
        alterado_por_id     NVARCHAR(36)       NULL,  -- Sem FK intencional
        alterado_por_nome   NVARCHAR(255)      NULL,  -- snapshot
        alterado_por_email  NVARCHAR(255)      NULL,  -- snapshot
        CONSTRAINT pk_historico_config_critica PRIMARY KEY (id)
    );
    PRINT 'Tabela [historico_config_critica] criada.';
END
ELSE
    PRINT 'Tabela [historico_config_critica] ja existe.';
GO
```

---

## Seção 4 — Tabelas com dependências

---

### Fase 2 — Dependem apenas de `usuarios`

---

### 4.1 — `sessoes_autenticacao`

```sql
IF OBJECT_ID('dbo.sessoes_autenticacao', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sessoes_autenticacao (
        id                  NVARCHAR(36)  NOT NULL CONSTRAINT df_sa_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        usuario_id          NVARCHAR(36)  NOT NULL,
        hash_refresh_token  NVARCHAR(255) NOT NULL,
        -- SHA-256 do token de sessao opaco retornado ao frontend (nao e JWT)
        criado_em           DATETIME2(7)  NOT NULL CONSTRAINT df_sa_criado  DEFAULT GETUTCDATE(),
        expira_em           DATETIME2(7)  NOT NULL,
        -- Expiracao: 12 horas apos criacao (definido em main.py)
        ultimo_uso_em       DATETIME2(7)       NULL,
        revogado_em         DATETIME2(7)       NULL,
        -- NULL = sessao ativa; preenchido ao fazer logout ou ao iniciar nova sessao
        endereco_ip         NVARCHAR(45)       NULL,
        user_agent          NVARCHAR(500)      NULL,
        CONSTRAINT pk_sessoes_autenticacao       PRIMARY KEY (id),
        CONSTRAINT uq_sa_hash_refresh_token      UNIQUE (hash_refresh_token)
    );
    PRINT 'Tabela [sessoes_autenticacao] criada.';
END
ELSE
    PRINT 'Tabela [sessoes_autenticacao] ja existe.';
GO
```

---

### 4.2 — `espacos_trabalho`

```sql
IF OBJECT_ID('dbo.espacos_trabalho', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.espacos_trabalho (
        id                  NVARCHAR(36)  NOT NULL CONSTRAINT df_et_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        nome                NVARCHAR(255) NOT NULL,
        id_workspace_pbi    NVARCHAR(255)      NULL,
        status              NVARCHAR(20)  NOT NULL CONSTRAINT df_et_status  DEFAULT N'ativo',
        -- Valores: ativo | arquivado
        icone               NVARCHAR(100)      NULL,
        cor                 NVARCHAR(20)       NULL,
        descricao           NVARCHAR(MAX)      NULL,
        criado_em           DATETIME2(7)  NOT NULL CONSTRAINT df_et_criado  DEFAULT GETUTCDATE(),
        criado_por_id       NVARCHAR(36)       NULL,
        CONSTRAINT pk_espacos_trabalho    PRIMARY KEY (id),
        CONSTRAINT uq_et_nome             UNIQUE (nome)
    );
    PRINT 'Tabela [espacos_trabalho] criada.';
END
ELSE
    PRINT 'Tabela [espacos_trabalho] ja existe.';
GO
```

---

### 4.3 — `categorias_relatorio` *(novo em v2.0)*

```sql
IF OBJECT_ID('dbo.categorias_relatorio', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.categorias_relatorio (
        id    NVARCHAR(36)  NOT NULL CONSTRAINT df_cr_id    DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        nome  NVARCHAR(100) NOT NULL,
        cor   NVARCHAR(7)        NULL,
        -- Cor hexadecimal (ex: #16a34a)
        icone NVARCHAR(50)       NULL,
        -- Classe de icone (ex: fa-chart-line)
        ativo BIT           NOT NULL CONSTRAINT df_cr_ativo DEFAULT 1,
        CONSTRAINT pk_categorias_relatorio PRIMARY KEY (id),
        CONSTRAINT uq_cr_nome              UNIQUE (nome)
    );
    PRINT 'Tabela [categorias_relatorio] criada.';
END
ELSE
    PRINT 'Tabela [categorias_relatorio] ja existe.';
GO
```

---

### 4.3b — `credenciais_pbi` *(novo em v2.0)*

```sql
IF OBJECT_ID('dbo.credenciais_pbi', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.credenciais_pbi (
        id                NVARCHAR(36)  NOT NULL CONSTRAINT df_cpbi_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        tenant_id         NVARCHAR(255)      NULL,
        client_id         NVARCHAR(255)      NULL,
        client_secret     NVARCHAR(500)      NULL,
        ativo             BIT           NOT NULL CONSTRAINT df_cpbi_ativo   DEFAULT 1,
        atualizado_em     DATETIME2(7)  NOT NULL CONSTRAINT df_cpbi_atualiz DEFAULT GETUTCDATE(),
        atualizado_por_id NVARCHAR(36)       NULL,
        CONSTRAINT pk_credenciais_pbi PRIMARY KEY (id)
    );
    PRINT 'Tabela [credenciais_pbi] criada.';
END
ELSE
    PRINT 'Tabela [credenciais_pbi] ja existe.';
GO
```

---

### 4.3c — `pacotes_permissao` *(novo em v2.0)*

```sql
IF OBJECT_ID('dbo.pacotes_permissao', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.pacotes_permissao (
        id            NVARCHAR(36)  NOT NULL CONSTRAINT df_pp2_id     DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        nome          NVARCHAR(255) NOT NULL,
        descricao     NVARCHAR(MAX)      NULL,
        criado_em     DATETIME2(7)  NOT NULL CONSTRAINT df_pp2_criado DEFAULT GETUTCDATE(),
        criado_por_id NVARCHAR(36)       NULL,
        CONSTRAINT pk_pacotes_permissao PRIMARY KEY (id),
        CONSTRAINT uq_pp2_nome          UNIQUE (nome)
    );
    PRINT 'Tabela [pacotes_permissao] criada.';
END
ELSE
    PRINT 'Tabela [pacotes_permissao] ja existe.';
GO
```

> **Nota sobre `sobrescritas_permissao`:** Esta tabela foi **removida** na v2.0. Os overrides individuais de permissão foram substituídos pelos `pacotes_permissao`. Se o banco existente ainda possui a tabela, ela pode ser removida com `DROP TABLE dbo.sobrescritas_permissao;` após confirmar que não há dados críticos.

---

### 4.4 — `grupos_excecao`

```sql
IF OBJECT_ID('dbo.grupos_excecao', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.grupos_excecao (
        id                  NVARCHAR(36)  NOT NULL CONSTRAINT df_ge_id     DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        nome                NVARCHAR(255) NOT NULL,
        fora_horario        BIT           NOT NULL CONSTRAINT df_ge_fora   DEFAULT 1,
        -- 1 = membros podem acessar fora do expediente
        janela_inicio       TIME(0)            NULL,
        janela_fim          TIME(0)            NULL,
        ignora_dia_inativo  BIT           NOT NULL CONSTRAINT df_ge_ignora DEFAULT 0,
        -- 1 = membros podem acessar em dias sem expediente (ativo=0)
        status              NVARCHAR(20)  NOT NULL CONSTRAINT df_ge_status DEFAULT N'ativo',
        -- Valores: ativo | inativo
        criado_em           DATETIME2(7)  NOT NULL CONSTRAINT df_ge_criado DEFAULT GETUTCDATE(),
        criado_por_id       NVARCHAR(36)       NULL,
        CONSTRAINT pk_grupos_excecao PRIMARY KEY (id)
    );
    PRINT 'Tabela [grupos_excecao] criada.';
END
ELSE
    PRINT 'Tabela [grupos_excecao] ja existe.';
GO
```

---

### 4.5 — `configuracoes_sistema`

```sql
IF OBJECT_ID('dbo.configuracoes_sistema', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.configuracoes_sistema (
        chave              NVARCHAR(255) NOT NULL,
        valor              NVARCHAR(MAX) NOT NULL,
        eh_secreto         BIT           NOT NULL CONSTRAINT df_cs_sec     DEFAULT 0,
        -- 1 = valor mascarado na interface
        atualizado_em      DATETIME2(7)  NOT NULL CONSTRAINT df_cs_atualiz DEFAULT GETUTCDATE(),
        atualizado_por_id  NVARCHAR(36)       NULL,
        CONSTRAINT pk_configuracoes_sistema PRIMARY KEY (chave)
    );
    PRINT 'Tabela [configuracoes_sistema] criada.';
END
ELSE
    PRINT 'Tabela [configuracoes_sistema] ja existe.';
GO
```

---

### Fase 3 — Depende de `espacos_trabalho`, `categorias_relatorio` e `usuarios`

---

### 4.6 — `relatorios`

```sql
IF OBJECT_ID('dbo.relatorios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.relatorios (
        id                  NVARCHAR(36)  NOT NULL CONSTRAINT df_rel_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        nome                NVARCHAR(255) NOT NULL,
        espaco_trabalho_id  NVARCHAR(36)  NOT NULL,
        id_relatorio_pbi    NVARCHAR(255)      NULL,
        categoria           NVARCHAR(100)      NULL,
        -- Campo legado (texto livre); mantido por compatibilidade
        categoria_id        NVARCHAR(36)       NULL,
        -- FK para categorias_relatorio (novo em v2.0); adicionada na Secao 6
        status              NVARCHAR(20)  NOT NULL CONSTRAINT df_rel_status  DEFAULT N'publicado',
        -- Valores: publicado | rascunho | arquivado
        descricao           NVARCHAR(MAX)      NULL,
        criado_em           DATETIME2(7)  NOT NULL CONSTRAINT df_rel_criado  DEFAULT GETUTCDATE(),
        atualizado_em       DATETIME2(7)  NOT NULL CONSTRAINT df_rel_atualiz DEFAULT GETUTCDATE(),
        criado_por_id       NVARCHAR(36)       NULL,
        CONSTRAINT pk_relatorios PRIMARY KEY (id)
    );
    PRINT 'Tabela [relatorios] criada.';
END
ELSE
    PRINT 'Tabela [relatorios] ja existe.';
GO
```

---

### Fase 4 — Dependem de múltiplas tabelas

---

### 4.7 — `acessos_workspace`

```sql
IF OBJECT_ID('dbo.acessos_workspace', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.acessos_workspace (
        id                  NVARCHAR(36) NOT NULL CONSTRAINT df_aw_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        usuario_id          NVARCHAR(36) NOT NULL,
        espaco_trabalho_id  NVARCHAR(36) NOT NULL,
        nivel_acesso        NVARCHAR(20) NOT NULL CONSTRAINT df_aw_nivel   DEFAULT N'apenas_relatorios',
        -- Valores: total | apenas_relatorios | nenhum
        concedido_por_id    NVARCHAR(36)      NULL,
        -- FK adicionada na Secao 6 com NO ACTION (nao pode SET NULL — multiplo caminho de cascade)
        concedido_em        DATETIME2(7) NOT NULL CONSTRAINT df_aw_conced  DEFAULT GETUTCDATE(),
        CONSTRAINT pk_acessos_workspace       PRIMARY KEY (id),
        CONSTRAINT uq_aw_usuario_espaco       UNIQUE (usuario_id, espaco_trabalho_id)
    );
    PRINT 'Tabela [acessos_workspace] criada.';
END
ELSE
    PRINT 'Tabela [acessos_workspace] ja existe.';
GO
```

---

### 4.8 — `acessos_relatorio`

```sql
IF OBJECT_ID('dbo.acessos_relatorio', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.acessos_relatorio (
        id               NVARCHAR(36) NOT NULL CONSTRAINT df_ar_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        usuario_id       NVARCHAR(36) NOT NULL,
        relatorio_id     NVARCHAR(36) NOT NULL,
        concedido_por_id NVARCHAR(36)      NULL,
        -- FK adicionada na Secao 6 com NO ACTION (nao pode SET NULL — multiplo caminho de cascade)
        concedido_em     DATETIME2(7) NOT NULL CONSTRAINT df_ar_conced  DEFAULT GETUTCDATE(),
        CONSTRAINT pk_acessos_relatorio        PRIMARY KEY (id),
        CONSTRAINT uq_ar_usuario_relatorio     UNIQUE (usuario_id, relatorio_id)
    );
    PRINT 'Tabela [acessos_relatorio] criada.';
END
ELSE
    PRINT 'Tabela [acessos_relatorio] ja existe.';
GO
```

---

### 4.9 — `favoritos`

```sql
IF OBJECT_ID('dbo.favoritos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.favoritos (
        id           NVARCHAR(36) NOT NULL CONSTRAINT df_fav_id     DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        usuario_id   NVARCHAR(36) NOT NULL,
        relatorio_id NVARCHAR(36) NOT NULL,
        criado_em    DATETIME2(7) NOT NULL CONSTRAINT df_fav_criado DEFAULT GETUTCDATE(),
        CONSTRAINT pk_favoritos               PRIMARY KEY (id),
        CONSTRAINT uq_fav_usuario_relatorio   UNIQUE (usuario_id, relatorio_id)
    );
    PRINT 'Tabela [favoritos] criada.';
END
ELSE
    PRINT 'Tabela [favoritos] ja existe.';
GO
```

---

### 4.10 — `membros_grupo_excecao`

```sql
IF OBJECT_ID('dbo.membros_grupo_excecao', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.membros_grupo_excecao (
        grupo_id   NVARCHAR(36) NOT NULL,
        usuario_id NVARCHAR(36) NOT NULL,
        CONSTRAINT pk_membros_grupo_excecao PRIMARY KEY (grupo_id, usuario_id)
    );
    PRINT 'Tabela [membros_grupo_excecao] criada.';
END
ELSE
    PRINT 'Tabela [membros_grupo_excecao] ja existe.';
GO
```

---

### 4.11 — `pacotes_permissao_itens` *(novo em v2.0)*

```sql
IF OBJECT_ID('dbo.pacotes_permissao_itens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.pacotes_permissao_itens (
        id              NVARCHAR(36)  NOT NULL CONSTRAINT df_ppi_id    DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        pacote_id       NVARCHAR(36)  NOT NULL,
        modulo          NVARCHAR(100) NOT NULL,
        pode_visualizar BIT           NOT NULL CONSTRAINT df_ppi_vis   DEFAULT 0,
        pode_criar      BIT           NOT NULL CONSTRAINT df_ppi_cri   DEFAULT 0,
        pode_editar     BIT           NOT NULL CONSTRAINT df_ppi_edi   DEFAULT 0,
        pode_excluir    BIT           NOT NULL CONSTRAINT df_ppi_exc   DEFAULT 0,
        pode_exportar   BIT           NOT NULL CONSTRAINT df_ppi_exp   DEFAULT 0,
        pode_gerenciar  BIT           NOT NULL CONSTRAINT df_ppi_ger   DEFAULT 0,
        CONSTRAINT pk_pacotes_permissao_itens PRIMARY KEY (id),
        CONSTRAINT uq_ppi_pacote_modulo       UNIQUE (pacote_id, modulo)
    );
    PRINT 'Tabela [pacotes_permissao_itens] criada.';
END
ELSE
    PRINT 'Tabela [pacotes_permissao_itens] ja existe.';
GO
```

---

### 4.12 — `usuarios_pacotes` *(novo em v2.0)*

```sql
IF OBJECT_ID('dbo.usuarios_pacotes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.usuarios_pacotes (
        id               NVARCHAR(36) NOT NULL CONSTRAINT df_up_id      DEFAULT CONVERT(NVARCHAR(36), NEWID()),
        usuario_id       NVARCHAR(36) NOT NULL,
        pacote_id        NVARCHAR(36) NOT NULL,
        atribuido_por_id NVARCHAR(36)      NULL,
        -- FK adicionada na Secao 6 com NO ACTION (multiplo caminho de cascade)
        atribuido_em     DATETIME2(7) NOT NULL CONSTRAINT df_up_atrib   DEFAULT GETUTCDATE(),
        CONSTRAINT pk_usuarios_pacotes   PRIMARY KEY (id),
        CONSTRAINT uq_up_usuario_pacote  UNIQUE (usuario_id, pacote_id)
    );
    PRINT 'Tabela [usuarios_pacotes] criada.';
END
ELSE
    PRINT 'Tabela [usuarios_pacotes] ja existe.';
GO
```

---

## Seção 5 — Chaves Primárias

As chaves primárias foram definidas inline nas instruções `CREATE TABLE` das Seções 3 e 4 como constraints nomeadas. A tabela abaixo lista todas para referência.

| # | Tabela | Constraint | Coluna(s) |
|---|--------|-----------|-----------|
| 1 | `departamentos` | `pk_departamentos` | `id` |
| 2 | `usuarios` | `pk_usuarios` | `id` |
| 3 | `sessoes_autenticacao` | `pk_sessoes_autenticacao` | `id` |
| 4 | `espacos_trabalho` | `pk_espacos_trabalho` | `id` |
| 5 | `categorias_relatorio` | `pk_categorias_relatorio` | `id` |
| 6 | `relatorios` | `pk_relatorios` | `id` |
| 7 | `acessos_workspace` | `pk_acessos_workspace` | `id` |
| 8 | `acessos_relatorio` | `pk_acessos_relatorio` | `id` |
| 9 | `permissoes_perfil` | `pk_permissoes_perfil` | `id` |
| 10 | `perfis` | `pk_perfis` | `codigo` |
| 11 | `regras_expediente` | `pk_regras_expediente` | `id` |
| 12 | `grupos_excecao` | `pk_grupos_excecao` | `id` |
| 13 | `membros_grupo_excecao` | `pk_membros_grupo_excecao` | `(grupo_id, usuario_id)` |
| 14 | `favoritos` | `pk_favoritos` | `id` |
| 15 | `logs_auditoria` | `pk_logs_auditoria` | `id` |
| 16 | `configuracoes_sistema` | `pk_configuracoes_sistema` | `chave` |
| 17 | `historico_config_critica` | `pk_historico_config_critica` | `id` |
| 18 | `credenciais_pbi` | `pk_credenciais_pbi` | `id` |
| 19 | `pacotes_permissao` | `pk_pacotes_permissao` | `id` |
| 20 | `pacotes_permissao_itens` | `pk_pacotes_permissao_itens` | `id` |
| 21 | `usuarios_pacotes` | `pk_usuarios_pacotes` | `id` |

---

## Seção 6 — Chaves Estrangeiras

> **Importante — Adaptações para SQL Server:**
>
> Algumas FKs que no modelo SQLite usariam `ON DELETE SET NULL` precisam de `NO ACTION` no SQL Server para evitar erros de *multiple cascade paths* (mais de uma FK apontando da mesma tabela pai para a mesma tabela filha, onde ao menos uma já usa CASCADE):
>
> | Tabela | Coluna | Motivo |
> |--------|--------|--------|
> | `usuarios` | `criado_por_id` | FK auto-referencial — SQL Server bloqueia CASCADE/SET NULL em ciclos |
> | `acessos_workspace` | `concedido_por_id` | Segunda FK de `usuarios` para a mesma tabela (primeira: `usuario_id` CASCADE) |
> | `acessos_relatorio` | `concedido_por_id` | Segunda FK de `usuarios` para a mesma tabela (primeira: `usuario_id` CASCADE) |
> | `usuarios_pacotes` | `atribuido_por_id` | Segunda FK de `usuarios` para a mesma tabela (primeira: `usuario_id` CASCADE) |
>
> Com `NO ACTION`, a aplicação Python fica responsável por setar essas colunas como NULL antes de excluir o usuário referenciado (o SQLAlchemy já faz isso automaticamente).
>
> **v2.0:** `membros_grupo_excecao.usuario_id` agora possui `ON DELETE CASCADE` (antes era `NO ACTION`). Isso corrige o comportamento anterior que impedia a exclusão de usuários pertencentes a grupos de exceção.

---

```sql
-- ============================================================
-- 6.0  usuarios → departamentos (novo em v2.0)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_usuarios_departamento'
      AND parent_object_id = OBJECT_ID('dbo.usuarios')
)
BEGIN
    ALTER TABLE dbo.usuarios
        ADD CONSTRAINT fk_usuarios_departamento
        FOREIGN KEY (departamento_id)
        REFERENCES dbo.departamentos (id)
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_usuarios_departamento] criada.';
END
GO

-- ============================================================
-- 6.1  usuarios (auto-referencial)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_usuarios_criado_por'
      AND parent_object_id = OBJECT_ID('dbo.usuarios')
)
BEGIN
    ALTER TABLE dbo.usuarios
        ADD CONSTRAINT fk_usuarios_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_usuarios_criado_por] criada.';
END
GO

-- ============================================================
-- 6.2  sessoes_autenticacao
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_sa_usuario'
      AND parent_object_id = OBJECT_ID('dbo.sessoes_autenticacao')
)
BEGIN
    ALTER TABLE dbo.sessoes_autenticacao
        ADD CONSTRAINT fk_sa_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_sa_usuario] criada.';
END
GO

-- ============================================================
-- 6.3  espacos_trabalho
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_et_criado_por'
      AND parent_object_id = OBJECT_ID('dbo.espacos_trabalho')
)
BEGIN
    ALTER TABLE dbo.espacos_trabalho
        ADD CONSTRAINT fk_et_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_et_criado_por] criada.';
END
GO

-- ============================================================
-- 6.4  categorias_relatorio → relatorios (novo em v2.0)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_rel_categoria'
      AND parent_object_id = OBJECT_ID('dbo.relatorios')
)
BEGIN
    ALTER TABLE dbo.relatorios
        ADD CONSTRAINT fk_rel_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES dbo.categorias_relatorio (id)
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_rel_categoria] criada.';
END
GO

-- ============================================================
-- 6.4b  pacotes_permissao → usuarios (novo em v2.0)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_pp_criado_por'
      AND parent_object_id = OBJECT_ID('dbo.pacotes_permissao')
)
BEGIN
    ALTER TABLE dbo.pacotes_permissao
        ADD CONSTRAINT fk_pp_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_pp_criado_por] criada.';
END
GO

-- ============================================================
-- 6.4c  credenciais_pbi → usuarios (novo em v2.0)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_cpbi_atualizado_por'
      AND parent_object_id = OBJECT_ID('dbo.credenciais_pbi')
)
BEGIN
    ALTER TABLE dbo.credenciais_pbi
        ADD CONSTRAINT fk_cpbi_atualizado_por
        FOREIGN KEY (atualizado_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_cpbi_atualizado_por] criada.';
END
GO

-- ============================================================
-- 6.5  grupos_excecao
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_ge_criado_por'
      AND parent_object_id = OBJECT_ID('dbo.grupos_excecao')
)
BEGIN
    ALTER TABLE dbo.grupos_excecao
        ADD CONSTRAINT fk_ge_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_ge_criado_por] criada.';
END
GO

-- ============================================================
-- 6.6  configuracoes_sistema
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_cs_atualizado_por'
      AND parent_object_id = OBJECT_ID('dbo.configuracoes_sistema')
)
BEGIN
    ALTER TABLE dbo.configuracoes_sistema
        ADD CONSTRAINT fk_cs_atualizado_por
        FOREIGN KEY (atualizado_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_cs_atualizado_por] criada.';
END
GO

-- ============================================================
-- 6.7  relatorios
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_rel_espaco'
      AND parent_object_id = OBJECT_ID('dbo.relatorios')
)
BEGIN
    ALTER TABLE dbo.relatorios
        ADD CONSTRAINT fk_rel_espaco
        FOREIGN KEY (espaco_trabalho_id)
        REFERENCES dbo.espacos_trabalho (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_rel_espaco] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_rel_criado_por'
      AND parent_object_id = OBJECT_ID('dbo.relatorios')
)
BEGIN
    ALTER TABLE dbo.relatorios
        ADD CONSTRAINT fk_rel_criado_por
        FOREIGN KEY (criado_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_rel_criado_por] criada.';
END
GO

-- ============================================================
-- 6.8  acessos_workspace
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_aw_usuario'
      AND parent_object_id = OBJECT_ID('dbo.acessos_workspace')
)
BEGIN
    ALTER TABLE dbo.acessos_workspace
        ADD CONSTRAINT fk_aw_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_aw_usuario] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_aw_espaco'
      AND parent_object_id = OBJECT_ID('dbo.acessos_workspace')
)
BEGIN
    ALTER TABLE dbo.acessos_workspace
        ADD CONSTRAINT fk_aw_espaco
        FOREIGN KEY (espaco_trabalho_id)
        REFERENCES dbo.espacos_trabalho (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_aw_espaco] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_aw_concedido_por'
      AND parent_object_id = OBJECT_ID('dbo.acessos_workspace')
)
BEGIN
    ALTER TABLE dbo.acessos_workspace
        ADD CONSTRAINT fk_aw_concedido_por
        FOREIGN KEY (concedido_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE NO ACTION   -- Seria SET NULL no SQLite; NO ACTION aqui para evitar multiplo caminho de cascade
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_aw_concedido_por] criada.';
END
GO

-- ============================================================
-- 6.9  acessos_relatorio
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_ar_usuario'
      AND parent_object_id = OBJECT_ID('dbo.acessos_relatorio')
)
BEGIN
    ALTER TABLE dbo.acessos_relatorio
        ADD CONSTRAINT fk_ar_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_ar_usuario] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_ar_relatorio'
      AND parent_object_id = OBJECT_ID('dbo.acessos_relatorio')
)
BEGIN
    ALTER TABLE dbo.acessos_relatorio
        ADD CONSTRAINT fk_ar_relatorio
        FOREIGN KEY (relatorio_id)
        REFERENCES dbo.relatorios (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_ar_relatorio] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_ar_concedido_por'
      AND parent_object_id = OBJECT_ID('dbo.acessos_relatorio')
)
BEGIN
    ALTER TABLE dbo.acessos_relatorio
        ADD CONSTRAINT fk_ar_concedido_por
        FOREIGN KEY (concedido_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE NO ACTION   -- Seria SET NULL no SQLite; NO ACTION aqui para evitar multiplo caminho de cascade
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_ar_concedido_por] criada.';
END
GO

-- ============================================================
-- 6.10  favoritos
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_fav_usuario'
      AND parent_object_id = OBJECT_ID('dbo.favoritos')
)
BEGIN
    ALTER TABLE dbo.favoritos
        ADD CONSTRAINT fk_fav_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_fav_usuario] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_fav_relatorio'
      AND parent_object_id = OBJECT_ID('dbo.favoritos')
)
BEGIN
    ALTER TABLE dbo.favoritos
        ADD CONSTRAINT fk_fav_relatorio
        FOREIGN KEY (relatorio_id)
        REFERENCES dbo.relatorios (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_fav_relatorio] criada.';
END
GO

-- ============================================================
-- 6.11  membros_grupo_excecao
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_mge_grupo'
      AND parent_object_id = OBJECT_ID('dbo.membros_grupo_excecao')
)
BEGIN
    ALTER TABLE dbo.membros_grupo_excecao
        ADD CONSTRAINT fk_mge_grupo
        FOREIGN KEY (grupo_id)
        REFERENCES dbo.grupos_excecao (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_mge_grupo] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_mge_usuario'
      AND parent_object_id = OBJECT_ID('dbo.membros_grupo_excecao')
)
BEGIN
    ALTER TABLE dbo.membros_grupo_excecao
        ADD CONSTRAINT fk_mge_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE CASCADE    -- v2.0: alterado de NO ACTION para CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_mge_usuario] criada.';
END
GO

-- ============================================================
-- 6.12  pacotes_permissao_itens (novo em v2.0)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_ppi_pacote'
      AND parent_object_id = OBJECT_ID('dbo.pacotes_permissao_itens')
)
BEGIN
    ALTER TABLE dbo.pacotes_permissao_itens
        ADD CONSTRAINT fk_ppi_pacote
        FOREIGN KEY (pacote_id)
        REFERENCES dbo.pacotes_permissao (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_ppi_pacote] criada.';
END
GO

-- ============================================================
-- 6.13  usuarios_pacotes (novo em v2.0)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_up_usuario'
      AND parent_object_id = OBJECT_ID('dbo.usuarios_pacotes')
)
BEGIN
    ALTER TABLE dbo.usuarios_pacotes
        ADD CONSTRAINT fk_up_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_up_usuario] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_up_pacote'
      AND parent_object_id = OBJECT_ID('dbo.usuarios_pacotes')
)
BEGIN
    ALTER TABLE dbo.usuarios_pacotes
        ADD CONSTRAINT fk_up_pacote
        FOREIGN KEY (pacote_id)
        REFERENCES dbo.pacotes_permissao (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_up_pacote] criada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'fk_up_atribuido_por'
      AND parent_object_id = OBJECT_ID('dbo.usuarios_pacotes')
)
BEGIN
    ALTER TABLE dbo.usuarios_pacotes
        ADD CONSTRAINT fk_up_atribuido_por
        FOREIGN KEY (atribuido_por_id)
        REFERENCES dbo.usuarios (id)
        ON DELETE NO ACTION   -- NO ACTION para evitar multiplo caminho de cascade
        ON UPDATE NO ACTION;
    PRINT 'FK [fk_up_atribuido_por] criada.';
END
GO
```

---

## Seção 7 — Índices

> Índices não cobertos por PKs ou UNIQUEs já criados nas seções anteriores.

```sql
-- ============================================================
-- usuarios
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_usuarios_status' AND object_id = OBJECT_ID('dbo.usuarios'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_usuarios_status ON dbo.usuarios (status);
    PRINT 'Indice [ix_usuarios_status] criado.';
END
GO

-- ============================================================
-- sessoes_autenticacao
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sa_usuario_id' AND object_id = OBJECT_ID('dbo.sessoes_autenticacao'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_sa_usuario_id ON dbo.sessoes_autenticacao (usuario_id);
    PRINT 'Indice [ix_sa_usuario_id] criado.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sa_usuario_ativo' AND object_id = OBJECT_ID('dbo.sessoes_autenticacao'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_sa_usuario_ativo ON dbo.sessoes_autenticacao (usuario_id, revogado_em);
    -- Acelera: WHERE usuario_id = ? AND revogado_em IS NULL AND expira_em > GETUTCDATE()
    PRINT 'Indice [ix_sa_usuario_ativo] criado.';
END
GO

-- ============================================================
-- relatorios
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_relatorios_espaco_status' AND object_id = OBJECT_ID('dbo.relatorios'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_relatorios_espaco_status ON dbo.relatorios (espaco_trabalho_id, status);
    PRINT 'Indice [ix_relatorios_espaco_status] criado.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_relatorios_status' AND object_id = OBJECT_ID('dbo.relatorios'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_relatorios_status ON dbo.relatorios (status);
    PRINT 'Indice [ix_relatorios_status] criado.';
END
GO

-- ============================================================
-- logs_auditoria
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_la_momento' AND object_id = OBJECT_ID('dbo.logs_auditoria'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_la_momento ON dbo.logs_auditoria (momento DESC);
    PRINT 'Indice [ix_la_momento] criado.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_la_usuario_id' AND object_id = OBJECT_ID('dbo.logs_auditoria'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_la_usuario_id ON dbo.logs_auditoria (usuario_id);
    PRINT 'Indice [ix_la_usuario_id] criado.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_la_tipo_evento' AND object_id = OBJECT_ID('dbo.logs_auditoria'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_la_tipo_evento ON dbo.logs_auditoria (tipo_evento);
    PRINT 'Indice [ix_la_tipo_evento] criado.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_la_modulo' AND object_id = OBJECT_ID('dbo.logs_auditoria'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_la_modulo ON dbo.logs_auditoria (modulo);
    PRINT 'Indice [ix_la_modulo] criado.';
END
GO

-- ============================================================
-- historico_config_critica
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_hcc_momento' AND object_id = OBJECT_ID('dbo.historico_config_critica'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_hcc_momento ON dbo.historico_config_critica (momento DESC);
    PRINT 'Indice [ix_hcc_momento] criado.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_hcc_entidade' AND object_id = OBJECT_ID('dbo.historico_config_critica'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_hcc_entidade ON dbo.historico_config_critica (entidade);
    PRINT 'Indice [ix_hcc_entidade] criado.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_hcc_entidade_id' AND object_id = OBJECT_ID('dbo.historico_config_critica'))
BEGIN
    CREATE NONCLUSTERED INDEX ix_hcc_entidade_id ON dbo.historico_config_critica (entidade_id);
    PRINT 'Indice [ix_hcc_entidade_id] criado.';
END
GO
```

---

## Seção 8 — Triggers

### 8.1 — Imutabilidade de `logs_auditoria`

Bloqueia qualquer operação `UPDATE` ou `DELETE` na tabela de auditoria, garantindo que os registros sejam append-only.

```sql
IF OBJECT_ID('dbo.trg_logs_auditoria_readonly', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_logs_auditoria_readonly;
GO

CREATE TRIGGER dbo.trg_logs_auditoria_readonly
ON dbo.logs_auditoria
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    RAISERROR(
        'Operacao proibida: logs_auditoria e append-only. UPDATE e DELETE nao sao permitidos.',
        16, 1
    );
    -- ROLLBACK nao e necessario em INSTEAD OF triggers: a operacao simplesmente nao ocorre.
END;
GO

PRINT 'Trigger [trg_logs_auditoria_readonly] criada.';
GO
```

### 8.2 — Nota sobre `atualizado_em`

As colunas `atualizado_em` em `usuarios`, `relatorios` e `regras_expediente` possuem `DEFAULT GETUTCDATE()` para o INSERT. A atualização automática no UPDATE é gerenciada pelo SQLAlchemy ORM via `onupdate=func.now()` — **não é necessário um trigger SQL** para esse comportamento. Se for necessário suportar atualizações diretas via SQL sem o ORM, adicione o trigger abaixo:

```sql
-- OPCIONAL: trigger para manter atualizado_em sincronizado em updates diretos via SQL
-- Aplique individualmente para cada tabela que possui a coluna atualizado_em.

-- Exemplo para [usuarios]:
-- IF OBJECT_ID('dbo.trg_usuarios_atualizado_em', 'TR') IS NOT NULL
--     DROP TRIGGER dbo.trg_usuarios_atualizado_em;
-- GO
-- CREATE TRIGGER dbo.trg_usuarios_atualizado_em
-- ON dbo.usuarios
-- AFTER UPDATE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     UPDATE dbo.usuarios
--     SET atualizado_em = GETUTCDATE()
--     WHERE id IN (SELECT id FROM inserted);
-- END;
-- GO
```

---

## Seção 9 — Dados Iniciais (Seed)

> **Atenção — Senhas (bcrypt):**
> Os hashes abaixo são **placeholders**. Antes de executar em produção, gere os hashes reais com:
>
> ```bash
> python -c "
> from passlib.context import CryptContext
> c = CryptContext(schemes=['bcrypt'], deprecated='auto')
> print('Admin@2025  ->', c.hash('Admin@2025'))
> print('Carlos@123  ->', c.hash('Carlos@123'))
> print('Mariana@123 ->', c.hash('Mariana@123'))
> print('Visitante@123 ->', c.hash('Visitante@123'))
> "
> ```
>
> **Alternativa recomendada:** Configure `DATABASE_URL` no `backend/database.py` para SQL Server e execute `python seed.py`. O script já é idempotente e gerará os hashes bcrypt automaticamente.

---

### 9.1 — Variáveis auxiliares para os seeds

```sql
-- IDs fixos para os seeds (garante idempotencia e referencias cruzadas)
DECLARE @id_admin     NVARCHAR(36) = N'00000000-0000-0000-0000-000000000001';
DECLARE @id_carlos    NVARCHAR(36) = N'00000000-0000-0000-0000-000000000002';
DECLARE @id_mariana   NVARCHAR(36) = N'00000000-0000-0000-0000-000000000003';
DECLARE @id_convidado NVARCHAR(36) = N'00000000-0000-0000-0000-000000000004';

DECLARE @id_ws_admin  NVARCHAR(36) = N'00000000-0000-0000-0001-000000000001';
DECLARE @id_ws_ctrl   NVARCHAR(36) = N'00000000-0000-0000-0001-000000000002';
DECLARE @id_ws_mkt    NVARCHAR(36) = N'00000000-0000-0000-0001-000000000003';
DECLARE @id_ws_sac    NVARCHAR(36) = N'00000000-0000-0000-0001-000000000004';

-- Hash bcrypt de 'Admin@2025' — SUBSTITUA pelo valor gerado via Python
DECLARE @hash_admin     NVARCHAR(255) = N'$2b$12$SUBSTITUA_PELO_HASH_BCRYPT_DE_Admin@2025_________';
-- Hash bcrypt de 'Carlos@123'
DECLARE @hash_carlos    NVARCHAR(255) = N'$2b$12$SUBSTITUA_PELO_HASH_BCRYPT_DE_Carlos@123________';
-- Hash bcrypt de 'Mariana@123'
DECLARE @hash_mariana   NVARCHAR(255) = N'$2b$12$SUBSTITUA_PELO_HASH_BCRYPT_DE_Mariana@123_______';
-- Hash bcrypt de 'Visitante@123'
DECLARE @hash_convidado NVARCHAR(255) = N'$2b$12$SUBSTITUA_PELO_HASH_BCRYPT_DE_Visitante@123_____';
```

---

### 9.2 — Usuários de demonstração

```sql
DECLARE @id_admin     NVARCHAR(36) = N'00000000-0000-0000-0000-000000000001';
DECLARE @id_carlos    NVARCHAR(36) = N'00000000-0000-0000-0000-000000000002';
DECLARE @id_mariana   NVARCHAR(36) = N'00000000-0000-0000-0000-000000000003';
DECLARE @id_convidado NVARCHAR(36) = N'00000000-0000-0000-0000-000000000004';
DECLARE @hash_admin     NVARCHAR(255) = N'$2b$12$SUBSTITUA_PELO_HASH_BCRYPT_DE_Admin@2025_________';
DECLARE @hash_carlos    NVARCHAR(255) = N'$2b$12$SUBSTITUA_PELO_HASH_BCRYPT_DE_Carlos@123________';
DECLARE @hash_mariana   NVARCHAR(255) = N'$2b$12$SUBSTITUA_PELO_HASH_BCRYPT_DE_Mariana@123_______';
DECLARE @hash_convidado NVARCHAR(255) = N'$2b$12$SUBSTITUA_PELO_HASH_BCRYPT_DE_Visitante@123_____';

IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE email = N'admin@cgid.com')
    INSERT INTO dbo.usuarios (id, nome, email, hash_senha, perfil, status)
    VALUES (@id_admin, N'Admin CGID', N'admin@cgid.com', @hash_admin, N'master', N'ativo');

IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE email = N'carlos@cgid.com')
    INSERT INTO dbo.usuarios (id, nome, email, hash_senha, perfil, status)
    VALUES (@id_carlos, N'Carlos Coordenador', N'carlos@cgid.com', @hash_carlos, N'coordenador', N'ativo');

IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE email = N'mariana@cgid.com')
    INSERT INTO dbo.usuarios (id, nome, email, hash_senha, perfil, status)
    VALUES (@id_mariana, N'Mariana Colaborador', N'mariana@cgid.com', @hash_mariana, N'colaborador', N'ativo');

IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE email = N'visitante@cgid.com')
    INSERT INTO dbo.usuarios (id, nome, email, hash_senha, perfil, status)
    VALUES (@id_convidado, N'Convidado Demo', N'visitante@cgid.com', @hash_convidado, N'convidado', N'ativo');

PRINT 'Seed [usuarios] inserido.';
GO
```

---

### 9.3 — Matriz de permissões por perfil (45 linhas)

```sql
-- Usando MERGE para idempotencia: atualiza se existir, insere se nao existir
DECLARE @modulos TABLE (modulo NVARCHAR(100));
INSERT INTO @modulos VALUES
    (N'usuarios'), (N'permissoes'), (N'relatorios'), (N'workspaces'),
    (N'auditoria'), (N'seguranca'), (N'configuracoes'), (N'expediente'), (N'grupos_excecao');

-- master: tudo True
MERGE dbo.permissoes_perfil AS tgt
USING (
    SELECT N'master' AS perfil, modulo FROM @modulos
) AS src ON tgt.perfil = src.perfil AND tgt.modulo = src.modulo
WHEN MATCHED THEN
    UPDATE SET pode_visualizar=1, pode_criar=1, pode_editar=1,
               pode_excluir=1, pode_exportar=1, pode_gerenciar=1
WHEN NOT MATCHED THEN
    INSERT (id, perfil, modulo, pode_visualizar, pode_criar, pode_editar,
            pode_excluir, pode_exportar, pode_gerenciar)
    VALUES (CONVERT(NVARCHAR(36), NEWID()), src.perfil, src.modulo, 1,1,1,1,1,1);

-- administrador: pode_excluir e pode_gerenciar = 0 para configuracoes
MERGE dbo.permissoes_perfil AS tgt
USING (
    SELECT N'administrador' AS perfil, modulo FROM @modulos
) AS src ON tgt.perfil = src.perfil AND tgt.modulo = src.modulo
WHEN MATCHED THEN
    UPDATE SET
        pode_visualizar = 1,
        pode_criar      = 1,
        pode_editar     = 1,
        pode_excluir    = CASE WHEN src.modulo = N'configuracoes' THEN 0 ELSE 1 END,
        pode_exportar   = 1,
        pode_gerenciar  = CASE WHEN src.modulo = N'configuracoes' THEN 0 ELSE 1 END
WHEN NOT MATCHED THEN
    INSERT (id, perfil, modulo, pode_visualizar, pode_criar, pode_editar,
            pode_excluir, pode_exportar, pode_gerenciar)
    VALUES (
        CONVERT(NVARCHAR(36), NEWID()), src.perfil, src.modulo,
        1, 1, 1,
        CASE WHEN src.modulo = N'configuracoes' THEN 0 ELSE 1 END,
        1,
        CASE WHEN src.modulo = N'configuracoes' THEN 0 ELSE 1 END
    );

-- coordenador: visualizar em relatorios/workspaces/auditoria; exportar em relatorios; resto False
MERGE dbo.permissoes_perfil AS tgt
USING (
    SELECT N'coordenador' AS perfil, modulo FROM @modulos
) AS src ON tgt.perfil = src.perfil AND tgt.modulo = src.modulo
WHEN MATCHED THEN
    UPDATE SET
        pode_visualizar = CASE WHEN src.modulo IN (N'relatorios',N'workspaces',N'auditoria') THEN 1 ELSE 0 END,
        pode_criar      = 0,
        pode_editar     = 0,
        pode_excluir    = 0,
        pode_exportar   = CASE WHEN src.modulo = N'relatorios' THEN 1 ELSE 0 END,
        pode_gerenciar  = 0
WHEN NOT MATCHED THEN
    INSERT (id, perfil, modulo, pode_visualizar, pode_criar, pode_editar,
            pode_excluir, pode_exportar, pode_gerenciar)
    VALUES (
        CONVERT(NVARCHAR(36), NEWID()), src.perfil, src.modulo,
        CASE WHEN src.modulo IN (N'relatorios',N'workspaces',N'auditoria') THEN 1 ELSE 0 END,
        0, 0, 0,
        CASE WHEN src.modulo = N'relatorios' THEN 1 ELSE 0 END,
        0
    );

-- colaborador: apenas visualizar relatorios
MERGE dbo.permissoes_perfil AS tgt
USING (
    SELECT N'colaborador' AS perfil, modulo FROM @modulos
) AS src ON tgt.perfil = src.perfil AND tgt.modulo = src.modulo
WHEN MATCHED THEN
    UPDATE SET
        pode_visualizar = CASE WHEN src.modulo = N'relatorios' THEN 1 ELSE 0 END,
        pode_criar=0, pode_editar=0, pode_excluir=0, pode_exportar=0, pode_gerenciar=0
WHEN NOT MATCHED THEN
    INSERT (id, perfil, modulo, pode_visualizar, pode_criar, pode_editar,
            pode_excluir, pode_exportar, pode_gerenciar)
    VALUES (
        CONVERT(NVARCHAR(36), NEWID()), src.perfil, src.modulo,
        CASE WHEN src.modulo = N'relatorios' THEN 1 ELSE 0 END,
        0, 0, 0, 0, 0
    );

-- convidado: apenas visualizar relatorios
MERGE dbo.permissoes_perfil AS tgt
USING (
    SELECT N'convidado' AS perfil, modulo FROM @modulos
) AS src ON tgt.perfil = src.perfil AND tgt.modulo = src.modulo
WHEN MATCHED THEN
    UPDATE SET
        pode_visualizar = CASE WHEN src.modulo = N'relatorios' THEN 1 ELSE 0 END,
        pode_criar=0, pode_editar=0, pode_excluir=0, pode_exportar=0, pode_gerenciar=0
WHEN NOT MATCHED THEN
    INSERT (id, perfil, modulo, pode_visualizar, pode_criar, pode_editar,
            pode_excluir, pode_exportar, pode_gerenciar)
    VALUES (
        CONVERT(NVARCHAR(36), NEWID()), src.perfil, src.modulo,
        CASE WHEN src.modulo = N'relatorios' THEN 1 ELSE 0 END,
        0, 0, 0, 0, 0
    );

PRINT 'Seed [permissoes_perfil] inserido (45 linhas).';
GO
```

---

### 9.4 — Regras de expediente (7 linhas)

```sql
-- 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
MERGE dbo.regras_expediente AS tgt
USING (
    VALUES
        (0, '08:00:00', '18:00:00', 0, 0),  -- Domingo  : sem restricao (ativo=0, bloquear_fora=0)
        (1, '08:00:00', '18:00:00', 1, 1),  -- Segunda  : expediente normal
        (2, '08:00:00', '18:00:00', 1, 1),  -- Terca    : expediente normal
        (3, '08:00:00', '18:00:00', 1, 1),  -- Quarta   : expediente normal
        (4, '08:00:00', '18:00:00', 1, 1),  -- Quinta   : expediente normal
        (5, '08:00:00', '18:00:00', 1, 1),  -- Sexta    : expediente normal
        (6, '08:00:00', '18:00:00', 0, 0)   -- Sabado   : sem restricao
) AS src (dia_semana, hora_inicio, hora_fim, ativo, bloquear_fora)
ON tgt.dia_semana = src.dia_semana
WHEN MATCHED THEN
    UPDATE SET
        hora_inicio   = CAST(src.hora_inicio   AS TIME(0)),
        hora_fim      = CAST(src.hora_fim      AS TIME(0)),
        ativo         = src.ativo,
        bloquear_fora = src.bloquear_fora,
        atualizado_em = GETUTCDATE()
WHEN NOT MATCHED THEN
    INSERT (id, dia_semana, hora_inicio, hora_fim, ativo, bloquear_fora)
    VALUES (
        CONVERT(NVARCHAR(36), NEWID()),
        src.dia_semana,
        CAST(src.hora_inicio AS TIME(0)),
        CAST(src.hora_fim    AS TIME(0)),
        src.ativo,
        src.bloquear_fora
    );

PRINT 'Seed [regras_expediente] inserido (7 linhas).';
GO
```

---

### 9.5 — Configurações do sistema (7 chaves)

```sql
MERGE dbo.configuracoes_sistema AS tgt
USING (
    VALUES
        (N'nome_portal',          N'"CGID - Centro de Governanca e Inteligencia de Dados"', 0),
        (N'ambiente',             N'"desenvolvimento"',                                      0),
        (N'pbi_client_id',        N'""',                                                     0),
        (N'pbi_tenant_id',        N'""',                                                     0),
        (N'pbi_workspace_id',     N'""',                                                     0),
        (N'pbi_client_secret',    N'""',                                                     1),
        (N'pbi_integracao_ativa', N'false',                                                  0)
) AS src (chave, valor, eh_secreto)
ON tgt.chave = src.chave
WHEN MATCHED THEN
    UPDATE SET valor = src.valor, eh_secreto = src.eh_secreto, atualizado_em = GETUTCDATE()
WHEN NOT MATCHED THEN
    INSERT (chave, valor, eh_secreto)
    VALUES (src.chave, src.valor, src.eh_secreto);

PRINT 'Seed [configuracoes_sistema] inserido (7 chaves).';
GO
```

---

### 9.6 — Workspaces e relatórios de exemplo

```sql
DECLARE @id_admin    NVARCHAR(36) = N'00000000-0000-0000-0000-000000000001';
DECLARE @id_ws_admin NVARCHAR(36) = N'00000000-0000-0000-0001-000000000001';
DECLARE @id_ws_ctrl  NVARCHAR(36) = N'00000000-0000-0000-0001-000000000002';
DECLARE @id_ws_mkt   NVARCHAR(36) = N'00000000-0000-0000-0001-000000000003';
DECLARE @id_ws_sac   NVARCHAR(36) = N'00000000-0000-0000-0001-000000000004';

-- Workspaces
MERGE dbo.espacos_trabalho AS tgt
USING (
    VALUES
        (@id_ws_admin, N'Administrativo', N'fa-solid fa-building',   N'#2563eb', N'Relatorios administrativos e RH'),
        (@id_ws_ctrl,  N'Controladoria',  N'fa-solid fa-chart-line', N'#16a34a', N'Relatorios financeiros e de controladoria'),
        (@id_ws_mkt,   N'Marketing',      N'fa-solid fa-bullhorn',   N'#d97706', N'Relatorios de marketing e performance'),
        (@id_ws_sac,   N'SAC',            N'fa-solid fa-headset',    N'#dc2626', N'Relatorios de atendimento ao cliente')
) AS src (id, nome, icone, cor, descricao)
ON tgt.nome = src.nome
WHEN MATCHED THEN
    UPDATE SET icone = src.icone, cor = src.cor, descricao = src.descricao
WHEN NOT MATCHED THEN
    INSERT (id, nome, icone, cor, descricao, criado_por_id)
    VALUES (src.id, src.nome, src.icone, src.cor, src.descricao, @id_admin);

PRINT 'Seed [espacos_trabalho] inserido (4 workspaces).';

-- Relatorios
MERGE dbo.relatorios AS tgt
USING (
    VALUES
        (@id_ws_admin, N'Headcount Mensal',         N'Operacional',  N'publicado'),
        (@id_ws_admin, N'Turnover 2025',             N'Estrategico',  N'publicado'),
        (@id_ws_ctrl,  N'DRE Consolidado',           N'Financeiro',   N'publicado'),
        (@id_ws_ctrl,  N'Fluxo de Caixa',            N'Financeiro',   N'publicado'),
        (@id_ws_ctrl,  N'Budget vs Realizado',       N'Financeiro',   N'publicado'),
        (@id_ws_ctrl,  N'Analise de Margem',         N'Financeiro',   N'rascunho'),
        (@id_ws_mkt,   N'Performance de Campanhas',  N'Operacional',  N'publicado'),
        (@id_ws_mkt,   N'Funil de Leads',            N'Estrategico',  N'publicado'),
        (@id_ws_mkt,   N'CAC e LTV',                 N'Estrategico',  N'publicado'),
        (@id_ws_sac,   N'Volume de Chamados',        N'Operacional',  N'publicado'),
        (@id_ws_sac,   N'NPS Mensal',                N'Estrategico',  N'publicado'),
        (@id_ws_sac,   N'Tempo Medio de Resposta',   N'Operacional',  N'publicado')
) AS src (espaco_trabalho_id, nome, categoria, status)
ON tgt.nome = src.nome AND tgt.espaco_trabalho_id = src.espaco_trabalho_id
WHEN MATCHED THEN
    UPDATE SET categoria = src.categoria, status = src.status, atualizado_em = GETUTCDATE()
WHEN NOT MATCHED THEN
    INSERT (id, nome, espaco_trabalho_id, categoria, status, criado_por_id)
    VALUES (CONVERT(NVARCHAR(36), NEWID()), src.nome, src.espaco_trabalho_id,
            src.categoria, src.status, @id_admin);

PRINT 'Seed [relatorios] inserido (12 relatorios).';
GO
```

---

## Checklist de Validação

Execute as queries abaixo após rodar todo o script para confirmar que a criação foi bem-sucedida:

```sql
USE cgid;
GO

-- 1. Verificar as 21 tabelas
SELECT
    t.name         AS tabela,
    p.rows         AS linhas
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
WHERE t.schema_id = SCHEMA_ID('dbo')
ORDER BY t.name;
-- Esperado: 21 tabelas listadas

-- 2. Verificar todas as FKs
SELECT
    fk.name                              AS constraint_fk,
    tp.name                              AS tabela_pai,
    cp.name                              AS coluna_pai,
    tr.name                              AS tabela_ref,
    cr.name                              AS coluna_ref,
    fk.delete_referential_action_desc    AS on_delete,
    fk.update_referential_action_desc    AS on_update
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.tables tp  ON fk.parent_object_id = tp.object_id
INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id  AND fkc.parent_column_id = cp.column_id
INNER JOIN sys.tables tr  ON fk.referenced_object_id = tr.object_id
INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
ORDER BY tp.name, fk.name;
-- Esperado: 27 FKs (19 originais + 8 novas em v2.0)

-- 3. Verificar todos os indices
SELECT
    t.name  AS tabela,
    i.name  AS indice,
    i.type_desc,
    i.is_unique,
    i.is_primary_key
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.schema_id = SCHEMA_ID('dbo')
  AND i.name IS NOT NULL
ORDER BY t.name, i.name;

-- 4. Verificar seeds
SELECT 'departamentos',        COUNT(*) AS linhas FROM dbo.departamentos
UNION ALL
SELECT 'categorias_relatorio', COUNT(*) FROM dbo.categorias_relatorio
UNION ALL
SELECT 'usuarios',             COUNT(*) FROM dbo.usuarios
UNION ALL
SELECT 'permissoes_perfil',    COUNT(*) FROM dbo.permissoes_perfil
UNION ALL
SELECT 'regras_expediente',    COUNT(*) FROM dbo.regras_expediente
UNION ALL
SELECT 'configuracoes_sistema', COUNT(*) FROM dbo.configuracoes_sistema
UNION ALL
SELECT 'espacos_trabalho',     COUNT(*) FROM dbo.espacos_trabalho
UNION ALL
SELECT 'relatorios',           COUNT(*) FROM dbo.relatorios;
-- Esperado: 5 | 6 | 4 | 55 | 7 | 7 | 4 | 12

-- 5. Verificar trigger de imutabilidade
SELECT name, type_desc FROM sys.triggers
WHERE parent_id = OBJECT_ID('dbo.logs_auditoria');
-- Esperado: trg_logs_auditoria_readonly

-- 6. Teste do trigger de imutabilidade (deve gerar erro)
-- INSERT INTO dbo.logs_auditoria (tipo_evento, modulo, detalhe)
-- VALUES (N'sistema', N'teste', N'log de teste');
-- DELETE FROM dbo.logs_auditoria;  -- deve falhar com RAISERROR

PRINT 'Validacao concluida. Verifique os resultados acima.';
GO
```

---

## Diferenças em relação ao SQLite

| Aspecto | SQLite (desenvolvimento) | SQL Server (produção) |
|---------|--------------------------|----------------------|
| Tipo string com tamanho | `TEXT(n)` | `NVARCHAR(n)` |
| Tipo string ilimitado | `TEXT` | `NVARCHAR(MAX)` |
| Tipo booleano | `INTEGER` (0/1) | `BIT` |
| Tipo timestamp | `DATETIME` | `DATETIME2(7)` |
| Tipo hora | `TIME` | `TIME(0)` |
| Tipo inteiro pequeno | `INTEGER` / `SmallInteger` | `SMALLINT` |
| Timestamp atual (UTC) | `CURRENT_TIMESTAMP` | `GETUTCDATE()` |
| UUID padrão | `new_uuid()` em Python | `CONVERT(NVARCHAR(36), NEWID())` |
| Tabela condicional | `CREATE TABLE IF NOT EXISTS` | `IF OBJECT_ID(...) IS NULL CREATE TABLE` |
| Índice condicional | `CREATE INDEX IF NOT EXISTS` | `IF NOT EXISTS (SELECT ... sys.indexes)` |
| FK auto-referencial | `ON DELETE SET NULL` | `ON DELETE NO ACTION` (sem suporte a SET NULL em self-ref) |
| Múltiplos caminhos de cascade | Permitido (FK enforcement off por padrão) | Bloqueado — requer `NO ACTION` nas FKs secundárias |
| FK enforcement | Desativado por padrão (`PRAGMA foreign_keys=ON` necessário) | Sempre ativo |
| Trigger imutabilidade | Opcional | Fortemente recomendado (`INSTEAD OF UPDATE, DELETE`) |
| `atualizado_em` no UPDATE | Gerenciado pelo ORM | Gerenciado pelo ORM (trigger opcional para SQL direto) |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 2026-06-23 | Vinicius Soares | Criação inicial — scripts SQL Server adaptados do schema SQLite (15 tabelas) |
| 2.0 | 2026-06-25 | Vinicius Soares | v2.0: +6 tabelas novas; remoção de `sobrescritas_permissao`; `departamento_id` em `usuarios`; `categoria_id` em `relatorios`; CASCADE corrigido em `membros_grupo_excecao.usuario_id` |

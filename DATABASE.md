# DATABASE.md — CGID: Documentação Técnica do Banco de Dados

> **Projeto:** CGID — Centro de Governança e Inteligência de Dados  
> **Backend:** Python 3.12 + FastAPI  
> **ORM:** SQLAlchemy 2.0  
> **Migrações:** Alembic  
> **Banco (desenvolvimento):** SQLite 3 (`backend/cgid.db`)  
> **Banco (produção recomendado):** SQL Server 2019+  
> **Versão do schema:** v2.1 (migrations `a1b2c3d4e5f6_fk_usuarios_perfil` + `b2c3d4e5f6a7_remove_categorias_relatorio`)  
> **Última revisão:** 2026-06-26

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Diagrama de Entidade-Relacionamento (ERD)](#2-diagrama-de-entidade-relacionamento-erd)
3. [Descrição das Tabelas](#3-descrição-das-tabelas)
4. [Esquema Completo por Tabela](#4-esquema-completo-por-tabela)
5. [Relacionamentos e Cardinalidades](#5-relacionamentos-e-cardinalidades)
6. [Comportamento em Exclusão (Cascade / Set Null)](#6-comportamento-em-exclusão-cascade--set-null)
7. [Scripts SQL de Criação](#7-scripts-sql-de-criação)
8. [Seeds — Dados Obrigatórios](#8-seeds--dados-obrigatórios)
9. [Ordem Correta de Execução](#9-ordem-correta-de-execução)
10. [Passo a Passo: Criar o Banco do Zero](#10-passo-a-passo-criar-o-banco-do-zero)
11. [Configurações e Variáveis de Ambiente](#11-configurações-e-variáveis-de-ambiente)
12. [Arquitetura de Permissões (Backend)](#12-arquitetura-de-permissões-backend)
13. [Possíveis Erros e Soluções](#13-possíveis-erros-e-soluções)

---

## 1. Visão Geral da Arquitetura

O CGID é um portal de acesso controlado a relatórios do **Power BI**. O banco de dados sustenta seis pilares:

| Pilar | Tabelas Envolvidas |
|---|---|
| **Organização** | `departamentos` — unidades organizacionais vinculadas a usuários |
| **Autenticação e Sessões** | `usuarios`, `sessoes_autenticacao` — token de sessão opaco (SHA-256), sem JWT |
| **RBAC (controle de acesso)** | `permissoes_perfil`, `perfis`, `pacotes_permissao`, `pacotes_permissao_itens`, `usuarios_pacotes`, `acessos_workspace`, `acessos_relatorio` |
| **Conteúdo (workspaces e relatórios)** | `espacos_trabalho`, `relatorios`, `favoritos` |
| **Restrições de horário** | `regras_expediente`, `grupos_excecao`, `membros_grupo_excecao` |
| **Auditoria e rastreabilidade** | `logs_auditoria`, `historico_config_critica` |
| **Configurações globais** | `configuracoes_sistema`, `credenciais_pbi` |

**Total:** 20 tabelas.

> A tabela `sobrescritas_permissao` foi **removida** na v2.0 e substituída pelos `pacotes_permissao`.  
> A tabela `categorias_relatorio` foi **removida** na v2.1. O campo `categoria` (texto livre) permanece em `relatorios` para compatibilidade com dados existentes.

O schema é definido inteiramente via modelos SQLAlchemy em `backend/models.py`. Em banco novo, a criação ocorre via `python seed.py`. Para banco com dados existentes, utilize `alembic upgrade head`.

---

## 2. Diagrama de Entidade-Relacionamento (ERD)

```
┌───────────────┐
│ departamentos │
│ PK id | nome  │
│ codigo | ativo│
└───────┬───────┘
        │ 1
        │
┌───────▼─────────────────────────────────────────────────────────────────────┐
│                                   usuarios                                   │
│  PK id | nome | email (UQ) | hash_senha | perfil (FK→perfis) | status       │
│  tentativas_login | senha_provisoria | ultimo_login | foto_url               │
│  mfa_ativo | mfa_segredo | criado_em | atualizado_em                        │
│  criado_por_id (FK→usuarios) | departamento_id (FK→departamentos)           │
└─────┬───────────────────────────────────────────────────────────────────────┘
      │ 1
      │
      ├──────────── N ──► sessoes_autenticacao
      │                   id | usuario_id (FK) | hash_refresh_token (UQ)
      │                   criado_em | expira_em(12h) | ultimo_uso_em
      │                   revogado_em | endereco_ip | user_agent
      │
      ├──────────── N ──► favoritos ──────── N ──► relatorios
      │                   id | usuario_id | relatorio_id             │
      │                   criado_em (UQ: usuario+relatorio)          │
      │                                                              │
      ├──────────── N ──► acessos_relatorio ─ N ──► (relatorios)    │
      │                   id | usuario_id | relatorio_id             │
      │                   concedido_por_id | concedido_em            │
      │                                                              │
      ├──────────── N ──► acessos_workspace ─ N ──► espacos_trabalho
      │                   id | usuario_id | espaco_trabalho_id       │
      │                   nivel_acesso | concedido_por_id            │
      │                                                              │
      │                              espacos_trabalho 1──N──────────►│
      │                              id | nome (UQ) | icone          │
      │                              cor | status | descricao        │
      │                              criado_por_id                    │
      │                                              relatorios
      │                                              id | nome | espaco_trabalho_id
      │                                              categoria (texto livre, opcional)
      │                                              status
      │
      ├──────────── N ──► membros_grupo_excecao ─ N ──► grupos_excecao
      │                   PK(grupo_id, usuario_id)       id | nome | fora_horario
      │                                                  janela_inicio/fim
      │                                                  ignora_dia_inativo
      │
      └──────────── N ──► usuarios_pacotes ──── N ──► pacotes_permissao
                         id | usuario_id | pacote_id         id | nome | descricao
                         atribuido_por_id | atribuido_em     │
                                                             └──── N ──► pacotes_permissao_itens
                                                                         id | pacote_id | modulo
                                                                         pode_visualizar | pode_criar
                                                                         pode_editar | pode_excluir
                                                                         pode_exportar | pode_gerenciar

Tabelas independentes (sem FK de entrada):
  departamentos           — unidades organizacionais
  perfis                  — metadados dos perfis (referenciados por usuarios.perfil)
  permissoes_perfil       — matriz RBAC por perfil × módulo
  regras_expediente       — horário de funcionamento por dia da semana
  logs_auditoria          — trilha imutável de auditoria (sem FK intencional)
  historico_config_critica — histórico de campos críticos
  configuracoes_sistema   — chave-valor de configurações globais
  credenciais_pbi         — credenciais Azure AD para Power BI Embedded
```

---

## 3. Descrição das Tabelas

| # | Tabela | Finalidade |
|---|--------|-----------|
| 1 | `departamentos` | Unidades organizacionais (TI, RH, Financeiro…) vinculadas a usuários |
| 2 | `usuarios` | Contas de usuário com autenticação, MFA, perfis de acesso e rastreamento |
| 3 | `sessoes_autenticacao` | Sessões ativas; SHA-256 do token opaco; expiração 12h; sessão única |
| 4 | `espacos_trabalho` | Agrupamentos lógicos de relatórios Power BI (workspaces) |
| 5 | `relatorios` | Relatórios Power BI individuais vinculados a um workspace |
| 6 | `acessos_workspace` | Concessão de acesso de um usuário a um workspace |
| 7 | `acessos_relatorio` | Concessão de acesso de um usuário a um relatório específico |
| 8 | `permissoes_perfil` | Matriz RBAC: define o que cada perfil pode fazer em cada módulo |
| 9 | `perfis` | Metadados dos perfis: nome de exibição, nível hierárquico |
| 10 | `regras_expediente` | Horário de funcionamento por dia da semana |
| 11 | `grupos_excecao` | Grupos de usuários isentos das regras de expediente |
| 12 | `membros_grupo_excecao` | Associativa: quais usuários pertencem a quais grupos de exceção |
| 13 | `favoritos` | Relatórios marcados como favoritos por um usuário |
| 14 | `logs_auditoria` | Trilha de auditoria imutável (append-only) |
| 15 | `configuracoes_sistema` | Store chave-valor para configurações globais |
| 16 | `historico_config_critica` | Histórico de alterações em campos críticos (IDs PBI, credenciais) |
| 17 | `credenciais_pbi` | Credenciais Azure AD (tenant_id, client_id, client_secret) para embed PBI |
| 18 | `pacotes_permissao` | Pacotes reutilizáveis de permissão (substitui sobrescritas individuais) |
| 19 | `pacotes_permissao_itens` | Permissões de cada módulo dentro de um pacote |
| 20 | `usuarios_pacotes` | Atribuição de pacotes de permissão a usuários específicos |

---

## 4. Esquema Completo por Tabela

### 4.1 `departamentos` *(novo em v2.0)*

| Coluna | Tipo SQLite | Nulo | Padrão | Restrições | Descrição |
|--------|------------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID gerado em Python | PK | Identificador único (UUID v4) |
| `nome` | TEXT(255) | NÃO | — | NOT NULL, UNIQUE | Nome do departamento |
| `codigo` | TEXT(20) | SIM | NULL | UNIQUE | Código abreviado (ex: `TI`, `RH`) |
| `descricao` | TEXT | SIM | NULL | — | Descrição longa |
| `ativo` | INTEGER(bool) | NÃO | `1` | NOT NULL | Status ativo/inativo |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `atualizado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação (UTC) |

---

### 4.2 `usuarios`

| Coluna | Tipo SQLite | Tipo SQL Server | Nulo | Padrão | Restrições | Descrição |
|--------|------------|----------------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NVARCHAR(36) | NÃO | UUID gerado em Python | PK | Identificador único (UUID v4) |
| `nome` | TEXT(255) | NVARCHAR(255) | NÃO | — | NOT NULL | Nome completo |
| `email` | TEXT(255) | NVARCHAR(255) | NÃO | — | NOT NULL, UNIQUE, INDEX | E-mail corporativo (login) |
| `hash_senha` | TEXT(255) | NVARCHAR(255) | NÃO | — | NOT NULL | Hash bcrypt da senha |
| `perfil` | TEXT(30) | NVARCHAR(30) | NÃO | — | NOT NULL, FK → `perfis.codigo` *(v2.1)* | `master` \| `administrador` \| `coordenador` \| `colaborador` \| `convidado` |
| `status` | TEXT(20) | NVARCHAR(20) | NÃO | `ativo` | NOT NULL | `ativo` \| `inativo` \| `bloqueado` |
| `tentativas_login` | INTEGER | SMALLINT | NÃO | `0` | NOT NULL | Contador de falhas (bloqueia ao atingir 5) |
| `senha_provisoria` | INTEGER(bool) | BIT | NÃO | `0` | NOT NULL | Se `1`, força troca de senha no próximo login |
| `ultimo_login` | DATETIME | DATETIME2(7) | SIM | NULL | — | Timestamp do último login bem-sucedido (UTC) |
| `foto_url` | TEXT(500) | NVARCHAR(500) | SIM | NULL | — | URL do avatar |
| `mfa_ativo` | INTEGER(bool) | BIT | NÃO | `0` | NOT NULL | MFA habilitado |
| `mfa_segredo` | TEXT(255) | NVARCHAR(255) | SIM | NULL | — | Segredo TOTP (criptografado) |
| `criado_em` | DATETIME | DATETIME2(7) | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `atualizado_em` | DATETIME | DATETIME2(7) | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação (UTC) |
| `criado_por_id` | TEXT(36) | NVARCHAR(36) | SIM | NULL | FK → `usuarios.id` SET NULL | ID do usuário que criou este registro |
| `departamento_id` | TEXT(36) | NVARCHAR(36) | SIM | NULL | FK → `departamentos.id` SET NULL | Departamento do usuário *(novo em v2.0)* |

**Índices:**
- `ix_usuarios_email` — UNIQUE em `email`
- `ix_usuarios_status` — em `status`

---

### 4.3 `sessoes_autenticacao`

> **Nota de implementação:** A autenticação usa token de sessão opaco, **não JWT**. No login, o backend gera um token aleatório (`secrets.token_urlsafe(32)`), armazena seu SHA-256 nesta tabela e retorna o token bruto ao frontend. A cada requisição, o frontend envia o token via `X-Session-Token`; o middleware calcula o SHA-256 e valida contra esta tabela. A expiração é de **12 horas**. O sistema implementa sessão única: ao fazer um novo login, todas as sessões ativas anteriores são revogadas.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | ID da sessão |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE, INDEX | Usuário dono da sessão |
| `hash_refresh_token` | TEXT(255) | NÃO | — | NOT NULL, UNIQUE | SHA-256 do token de sessão opaco |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `expira_em` | DATETIME | NÃO | — | NOT NULL | Expiração da sessão (12 horas após criação) |
| `ultimo_uso_em` | DATETIME | SIM | NULL | — | Última validação do token |
| `revogado_em` | DATETIME | SIM | NULL | — | Timestamp de logout ou revogação (NULL = ativa) |
| `endereco_ip` | TEXT(45) | SIM | NULL | — | IPv4 ou IPv6 de origem |
| `user_agent` | TEXT(500) | SIM | NULL | — | Identificação do browser/dispositivo |

**Índices:**
- `ix_sa_usuario_ativo` — composto em `(usuario_id, revogado_em)`

---

### 4.4 `espacos_trabalho`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `nome` | TEXT(255) | NÃO | — | NOT NULL, UNIQUE | Nome do workspace |
| `id_workspace_pbi` | TEXT(255) | SIM | NULL | — | ID do workspace no Power BI Service |
| `status` | TEXT(20) | NÃO | `ativo` | NOT NULL | `ativo` \| `arquivado` |
| `icone` | TEXT(100) | SIM | NULL | — | Classe Font Awesome |
| `cor` | TEXT(20) | SIM | NULL | — | Cor hexadecimal |
| `descricao` | TEXT | SIM | NULL | — | Descrição longa |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `criado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Criador |

---

### 4.5 `relatorios`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `nome` | TEXT(255) | NÃO | — | NOT NULL | Nome do relatório |
| `espaco_trabalho_id` | TEXT(36) | NÃO | — | FK → `espacos_trabalho.id` CASCADE, INDEX | Workspace pai |
| `id_relatorio_pbi` | TEXT(255) | SIM | NULL | — | ID do relatório no Power BI Service |
| `categoria` | TEXT(100) | SIM | NULL | — | Categoria em texto livre (ex: "Financeiro") |
| `status` | TEXT(20) | NÃO | `publicado` | NOT NULL | `publicado` \| `rascunho` \| `arquivado` |
| `descricao` | TEXT | SIM | NULL | — | Descrição longa |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `atualizado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação (UTC) |
| `criado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Criador |

**Índices:**
- `ix_relatorios_espaco_status` — composto em `(espaco_trabalho_id, status)`
- `ix_relatorios_status` — em `status`

---

### 4.6 `acessos_workspace`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE | Usuário |
| `espaco_trabalho_id` | TEXT(36) | NÃO | — | FK → `espacos_trabalho.id` CASCADE | Workspace |
| `nivel_acesso` | TEXT(20) | NÃO | `apenas_relatorios` | NOT NULL | `total` \| `apenas_relatorios` \| `nenhum` |
| `concedido_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Quem concedeu |
| `concedido_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Quando foi concedido |

**Constraints:**
- `uq_aw_usuario_espaco` — UNIQUE em `(usuario_id, espaco_trabalho_id)`

---

### 4.7 `acessos_relatorio`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE | Usuário |
| `relatorio_id` | TEXT(36) | NÃO | — | FK → `relatorios.id` CASCADE | Relatório |
| `concedido_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Quem concedeu |
| `concedido_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Quando foi concedido |

**Constraints:**
- `uq_ar_usuario_relatorio` — UNIQUE em `(usuario_id, relatorio_id)`

---

### 4.8 `permissoes_perfil`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `perfil` | TEXT(30) | NÃO | — | NOT NULL | Perfil de acesso |
| `modulo` | TEXT(100) | NÃO | — | NOT NULL | Módulo do sistema |
| `pode_visualizar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de leitura |
| `pode_criar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de criação |
| `pode_editar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de edição |
| `pode_excluir` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de exclusão |
| `pode_exportar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de exportação |
| `pode_gerenciar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de gerenciamento |

**Constraints:**
- `uq_pp_perfil_modulo` — UNIQUE em `(perfil, modulo)`

**Módulos válidos (v2.1):** `usuarios`, `permissoes`, `relatorios`, `workspaces`, `auditoria`, `seguranca`, `configuracoes`, `expediente`, `grupos_excecao`, `landbank`, `departamentos`

---

### 4.9 `perfis` *(novo em v2.0)*

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `codigo` | TEXT(30) | NÃO | — | PK | Código do perfil (`master`, `administrador`, etc.) |
| `nome_exibicao` | TEXT(100) | NÃO | — | NOT NULL | Nome legível (ex: `Master`) |
| `descricao` | TEXT | SIM | NULL | — | Descrição do perfil |
| `nivel_hierarquia` | INTEGER | NÃO | `0` | NOT NULL | Nível hierárquico (maior = mais privilegiado) |
| `pode_ser_atribuido` | INTEGER(bool) | NÃO | `1` | NOT NULL | Se pode ser atribuído pela UI |

> A partir da v2.1, `usuarios.perfil` possui FK referenciando `perfis.codigo` (migration `a1b2c3d4e5f6`). A tabela `perfis` deve ser populada antes de `usuarios`.

---

### 4.10 `regras_expediente`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `dia_semana` | INTEGER | NÃO | — | NOT NULL | 0=Domingo … 6=Sábado |
| `hora_inicio` | TIME | NÃO | — | NOT NULL | Início do expediente |
| `hora_fim` | TIME | NÃO | — | NOT NULL | Fim do expediente |
| `ativo` | INTEGER(bool) | NÃO | `1` | NOT NULL | `0` = dia sem restrição |
| `bloquear_fora` | INTEGER(bool) | NÃO | `1` | NOT NULL | `1` = bloqueia fora do horário |
| `atualizado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação |

**Constraints:**
- `uq_re_dia_semana` — UNIQUE em `dia_semana`

---

### 4.11 `grupos_excecao`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `nome` | TEXT(255) | NÃO | — | NOT NULL | Nome do grupo |
| `fora_horario` | INTEGER(bool) | NÃO | `1` | NOT NULL | Permite acesso fora do expediente |
| `janela_inicio` | TIME | SIM | NULL | — | Início de janela personalizada |
| `janela_fim` | TIME | SIM | NULL | — | Fim de janela personalizada |
| `ignora_dia_inativo` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permite acesso em dias sem expediente |
| `status` | TEXT(20) | NÃO | `ativo` | NOT NULL | `ativo` \| `inativo` |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `criado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Criador |

---

### 4.12 `membros_grupo_excecao`

| Coluna | Tipo | Nulo | Restrições | Descrição |
|--------|------|------|-----------|-----------|
| `grupo_id` | TEXT(36) | NÃO | PK, FK → `grupos_excecao.id` CASCADE | Grupo |
| `usuario_id` | TEXT(36) | NÃO | PK, FK → `usuarios.id` **CASCADE** | Usuário |

**Chave primária composta:** `(grupo_id, usuario_id)`

> **v2.0:** O FK `usuario_id` agora possui `ondelete="CASCADE"` (antes estava sem). Ao excluir um usuário, seus registros nesta tabela são removidos automaticamente.

---

### 4.13 `favoritos`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE | Usuário |
| `relatorio_id` | TEXT(36) | NÃO | — | FK → `relatorios.id` CASCADE | Relatório favoritado |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Quando foi favoritado |

**Constraints:**
- `uq_fav_usuario_relatorio` — UNIQUE em `(usuario_id, relatorio_id)`

---

### 4.14 `logs_auditoria`

> **Atenção:** Tabela append-only. Nenhum UPDATE ou DELETE deve ser executado nela.  
> Em SQL Server, recomenda-se criar um INSTEAD OF trigger para bloquear modificações.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `momento` | DATETIME | NÃO | Python UTC | NOT NULL, INDEX | Timestamp do evento em UTC (naive); gerado por `datetime.now(timezone.utc)` no Python |
| `usuario_id` | TEXT(36) | SIM | NULL | INDEX (sem FK intencional) | ID do usuário |
| `nome_usuario` | TEXT(255) | SIM | NULL | — | Snapshot do nome (imutável) |
| `email_usuario` | TEXT(255) | SIM | NULL | — | Snapshot do e-mail (imutável) |
| `tipo_evento` | TEXT(50) | NÃO | — | NOT NULL, INDEX | `autenticacao` \| `seguranca` \| `usuario` \| `permissao` \| `acesso` \| `relatorio` \| `sistema` \| `critico` |
| `modulo` | TEXT(100) | NÃO | — | NOT NULL, INDEX | Módulo afetado |
| `detalhe` | TEXT | NÃO | — | NOT NULL | Descrição do evento |
| `endereco_ip` | TEXT(45) | SIM | NULL | — | IPv4 ou IPv6 |
| `valor_anterior` | TEXT | SIM | NULL | — | Valor anterior em JSON |
| `valor_novo` | TEXT | SIM | NULL | — | Novo valor em JSON |

**Índices:** `ix_la_momento`, `ix_la_usuario_id`, `ix_la_tipo_evento`, `ix_la_modulo`

**Convenção de fuso horário:**  
`momento` é gravado em UTC (datetime naive, sem tzinfo) via `datetime.now(timezone.utc).replace(tzinfo=None)` em `audit_service.py`. O frontend adiciona sufixo `Z` ao deserializar e converte para `America/Sao_Paulo` na exibição.

**Por que não há FK para `usuarios`?**  
Registros de auditoria devem sobreviver à exclusão do usuário. A ausência de FK é intencional.

---

### 4.15 `configuracoes_sistema`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `chave` | TEXT(255) | NÃO | — | PK | Chave de configuração |
| `valor` | TEXT | NÃO | — | NOT NULL | Valor (string JSON) |
| `eh_secreto` | INTEGER(bool) | NÃO | `0` | NOT NULL | Se `1`, valor é mascarado na interface |
| `atualizado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação (UTC) |
| `atualizado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Quem atualizou por último |

---

### 4.16 `historico_config_critica`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `momento` | DATETIME | NÃO | Python UTC | NOT NULL, INDEX | Timestamp da alteração em UTC (naive); gerado por `datetime.now(timezone.utc)` no Python |
| `entidade` | TEXT(50) | NÃO | — | NOT NULL, INDEX | `workspace` \| `relatorio` \| `pbi_credenciais` |
| `entidade_id` | TEXT(36) | SIM | NULL | INDEX | ID do workspace/relatório |
| `campo` | TEXT(100) | NÃO | — | NOT NULL | Nome do campo alterado |
| `valor_anterior` | TEXT | SIM | NULL | — | Valor antes da alteração |
| `valor_novo` | TEXT | SIM | NULL | — | Valor após a alteração |
| `alterado_por_id` | TEXT(36) | SIM | NULL | — | ID do usuário (sem FK intencional) |
| `alterado_por_nome` | TEXT(255) | SIM | NULL | — | Snapshot do nome |
| `alterado_por_email` | TEXT(255) | SIM | NULL | — | Snapshot do e-mail |

**Índices:** `ix_hcc_momento`, `ix_hcc_entidade`, `ix_hcc_entidade_id`

---

### 4.17 `credenciais_pbi` *(novo em v2.0)*

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `tenant_id` | TEXT(255) | SIM | NULL | — | Tenant ID do Azure AD |
| `client_id` | TEXT(255) | SIM | NULL | — | Application (Client) ID |
| `client_secret` | TEXT(500) | SIM | NULL | — | Client Secret (armazenado criptografado) |
| `ativo` | INTEGER(bool) | NÃO | `1` | NOT NULL | Indica o conjunto de credenciais ativo |
| `atualizado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação |
| `atualizado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Quem atualizou |

---

### 4.18 `pacotes_permissao` *(novo em v2.0)*

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `nome` | TEXT(255) | NÃO | — | NOT NULL, UNIQUE | Nome do pacote |
| `descricao` | TEXT | SIM | NULL | — | Descrição |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `criado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Criador |

---

### 4.19 `pacotes_permissao_itens` *(novo em v2.0)*

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `pacote_id` | TEXT(36) | NÃO | — | FK → `pacotes_permissao.id` CASCADE | Pacote pai |
| `modulo` | TEXT(100) | NÃO | — | NOT NULL | Módulo do sistema |
| `pode_visualizar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de leitura |
| `pode_criar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de criação |
| `pode_editar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de edição |
| `pode_excluir` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de exclusão |
| `pode_exportar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de exportação |
| `pode_gerenciar` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permissão de gerenciamento |

**Constraints:**
- `uq_ppi_pacote_modulo` — UNIQUE em `(pacote_id, modulo)`

---

### 4.20 `usuarios_pacotes` *(novo em v2.0)*

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE | Usuário |
| `pacote_id` | TEXT(36) | NÃO | — | FK → `pacotes_permissao.id` CASCADE | Pacote |
| `atribuido_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Admin que atribuiu |
| `atribuido_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Quando foi atribuído |

**Constraints:**
- `uq_up_usuario_pacote` — UNIQUE em `(usuario_id, pacote_id)`

---

## 5. Relacionamentos e Cardinalidades

| Origem | Cardinalidade | Destino | Via | Comportamento na exclusão |
|--------|:---:|--------|-----|--------------------------|
| `departamentos` | 1:N | `usuarios` | `departamento_id` | SET NULL |
| `perfis` | 1:N | `usuarios` | `perfil` | *(sem cascade — perfis são imutáveis)* |
| `usuarios` | 1:N | `sessoes_autenticacao` | `usuario_id` | CASCADE |
| `usuarios` | 1:N | `acessos_workspace` | `usuario_id` | CASCADE |
| `usuarios` | 1:N | `acessos_relatorio` | `usuario_id` | CASCADE |
| `usuarios` | 1:N | `favoritos` | `usuario_id` | CASCADE |
| `usuarios` | 1:N | `usuarios_pacotes` | `usuario_id` | CASCADE |
| `usuarios` | N:M | `grupos_excecao` | `membros_grupo_excecao` | CASCADE (ambos os lados) |
| `usuarios` | self-ref | `usuarios` | `criado_por_id` | SET NULL |
| `espacos_trabalho` | 1:N | `relatorios` | `espaco_trabalho_id` | CASCADE |
| `espacos_trabalho` | 1:N | `acessos_workspace` | `espaco_trabalho_id` | CASCADE |
| `relatorios` | 1:N | `acessos_relatorio` | `relatorio_id` | CASCADE |
| `relatorios` | 1:N | `favoritos` | `relatorio_id` | CASCADE |
| `grupos_excecao` | 1:N | `membros_grupo_excecao` | `grupo_id` | CASCADE |
| `pacotes_permissao` | 1:N | `pacotes_permissao_itens` | `pacote_id` | CASCADE |
| `pacotes_permissao` | 1:N | `usuarios_pacotes` | `pacote_id` | CASCADE |

> **v2.0:** O FK `membros_grupo_excecao.usuario_id` agora possui `ondelete="CASCADE"`, corrigindo o comportamento anterior (sem ondelete) que causava erros em SQL Server ao excluir usuários pertencentes a grupos de exceção.  
> **v2.1:** `usuarios.perfil` agora possui FK referenciando `perfis.codigo` (migration `a1b2c3d4e5f6`).

---

## 6. Comportamento em Exclusão (Cascade / Set Null)

```
Ao excluir um USUÁRIO:
  → CASCADE: sessoes_autenticacao, acessos_workspace, acessos_relatorio,
             favoritos, usuarios_pacotes, membros_grupo_excecao
  → SET NULL: criado_por_id em usuarios, espacos_trabalho, relatorios,
              grupos_excecao, pacotes_permissao;
              concedido_por_id em acessos_*;
              atribuido_por_id em usuarios_pacotes;
              atualizado_por_id em configuracoes_sistema, credenciais_pbi;
              departamento_id não é afetado (o departamento permanece)

Ao excluir um DEPARTAMENTO:
  → SET NULL: departamento_id em usuarios (usuários ficam sem departamento)

Ao excluir um WORKSPACE:
  → CASCADE: relatorios (e por consequência: acessos_relatorio, favoritos)
  → CASCADE: acessos_workspace

Ao excluir um RELATÓRIO:
  → CASCADE: acessos_relatorio, favoritos

Ao excluir um GRUPO DE EXCEÇÃO:
  → CASCADE: membros_grupo_excecao

Ao excluir um PACOTE DE PERMISSÃO:
  → CASCADE: pacotes_permissao_itens, usuarios_pacotes
```

---

## 7. Scripts SQL de Criação

> Os scripts abaixo são equivalentes SQL do que o SQLAlchemy gera automaticamente.  
> Escritos em **SQLite** (desenvolvimento). Para SQL Server, consulte `DATABASE-SQLSERVER.md`.

### 7.1 Tabelas sem dependências externas

```sql
-- 1. departamentos
CREATE TABLE IF NOT EXISTS departamentos (
    id            TEXT(36) NOT NULL PRIMARY KEY,
    nome          TEXT(255) NOT NULL UNIQUE,
    codigo        TEXT(20) UNIQUE,
    descricao     TEXT,
    ativo         INTEGER NOT NULL DEFAULT 1,
    criado_em     DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    atualizado_em DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 2. perfis (deve existir antes de usuarios em v2.1)
CREATE TABLE IF NOT EXISTS perfis (
    codigo             TEXT(30)  NOT NULL PRIMARY KEY,
    nome_exibicao      TEXT(100) NOT NULL,
    descricao          TEXT,
    nivel_hierarquia   INTEGER   NOT NULL DEFAULT 0,
    pode_ser_atribuido INTEGER   NOT NULL DEFAULT 1
);

-- 3. usuarios (FK self-referencial, departamento_id e perfil→perfis)
CREATE TABLE IF NOT EXISTS usuarios (
    id               TEXT(36)  NOT NULL PRIMARY KEY,
    nome             TEXT(255) NOT NULL,
    email            TEXT(255) NOT NULL UNIQUE,
    hash_senha       TEXT(255) NOT NULL,
    perfil           TEXT(30)  NOT NULL REFERENCES perfis(codigo),
    status           TEXT(20)  NOT NULL DEFAULT 'ativo',
    tentativas_login INTEGER   NOT NULL DEFAULT 0,
    senha_provisoria INTEGER   NOT NULL DEFAULT 0,
    ultimo_login     DATETIME,
    foto_url         TEXT(500),
    mfa_ativo        INTEGER   NOT NULL DEFAULT 0,
    mfa_segredo      TEXT(255),
    criado_em        DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    atualizado_em    DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    criado_por_id    TEXT(36),
    departamento_id  TEXT(36),
    FOREIGN KEY (criado_por_id)   REFERENCES usuarios(id)     ON DELETE SET NULL,
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_usuarios_email  ON usuarios(email);
CREATE INDEX IF NOT EXISTS ix_usuarios_status ON usuarios(status);

-- 4. permissoes_perfil
CREATE TABLE IF NOT EXISTS permissoes_perfil (
    id              TEXT(36)  NOT NULL PRIMARY KEY,
    perfil          TEXT(30)  NOT NULL,
    modulo          TEXT(100) NOT NULL,
    pode_visualizar INTEGER   NOT NULL DEFAULT 0,
    pode_criar      INTEGER   NOT NULL DEFAULT 0,
    pode_editar     INTEGER   NOT NULL DEFAULT 0,
    pode_excluir    INTEGER   NOT NULL DEFAULT 0,
    pode_exportar   INTEGER   NOT NULL DEFAULT 0,
    pode_gerenciar  INTEGER   NOT NULL DEFAULT 0,
    CONSTRAINT uq_pp_perfil_modulo UNIQUE (perfil, modulo)
);

-- 5. regras_expediente
CREATE TABLE IF NOT EXISTS regras_expediente (
    id            TEXT(36) NOT NULL PRIMARY KEY,
    dia_semana    INTEGER  NOT NULL,
    hora_inicio   TIME     NOT NULL,
    hora_fim      TIME     NOT NULL,
    ativo         INTEGER  NOT NULL DEFAULT 1,
    bloquear_fora INTEGER  NOT NULL DEFAULT 1,
    atualizado_em DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_re_dia_semana UNIQUE (dia_semana)
);

-- 6. logs_auditoria (sem FK intencional)
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id             TEXT(36)  NOT NULL PRIMARY KEY,
    momento        DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    usuario_id     TEXT(36),
    nome_usuario   TEXT(255),
    email_usuario  TEXT(255),
    tipo_evento    TEXT(50)  NOT NULL,
    modulo         TEXT(100) NOT NULL,
    detalhe        TEXT      NOT NULL,
    endereco_ip    TEXT(45),
    valor_anterior TEXT,
    valor_novo     TEXT
);

CREATE INDEX IF NOT EXISTS ix_la_momento     ON logs_auditoria(momento);
CREATE INDEX IF NOT EXISTS ix_la_usuario_id  ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS ix_la_tipo_evento ON logs_auditoria(tipo_evento);
CREATE INDEX IF NOT EXISTS ix_la_modulo      ON logs_auditoria(modulo);

-- 7. historico_config_critica (sem FK intencional)
CREATE TABLE IF NOT EXISTS historico_config_critica (
    id                 TEXT(36)  NOT NULL PRIMARY KEY,
    momento            DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    entidade           TEXT(50)  NOT NULL,
    entidade_id        TEXT(36),
    campo              TEXT(100) NOT NULL,
    valor_anterior     TEXT,
    valor_novo         TEXT,
    alterado_por_id    TEXT(36),
    alterado_por_nome  TEXT(255),
    alterado_por_email TEXT(255)
);

CREATE INDEX IF NOT EXISTS ix_hcc_momento     ON historico_config_critica(momento);
CREATE INDEX IF NOT EXISTS ix_hcc_entidade    ON historico_config_critica(entidade);
CREATE INDEX IF NOT EXISTS ix_hcc_entidade_id ON historico_config_critica(entidade_id);
```

### 7.2 Tabelas dependentes de `usuarios`

```sql
-- 8. sessoes_autenticacao
CREATE TABLE IF NOT EXISTS sessoes_autenticacao (
    id                 TEXT(36)  NOT NULL PRIMARY KEY,
    usuario_id         TEXT(36)  NOT NULL,
    hash_refresh_token TEXT(255) NOT NULL UNIQUE,
    criado_em          DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    expira_em          DATETIME  NOT NULL,
    ultimo_uso_em      DATETIME,
    revogado_em        DATETIME,
    endereco_ip        TEXT(45),
    user_agent         TEXT(500),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_sa_usuario_ativo ON sessoes_autenticacao(usuario_id, revogado_em);

-- 9. espacos_trabalho
CREATE TABLE IF NOT EXISTS espacos_trabalho (
    id               TEXT(36)  NOT NULL PRIMARY KEY,
    nome             TEXT(255) NOT NULL UNIQUE,
    id_workspace_pbi TEXT(255),
    status           TEXT(20)  NOT NULL DEFAULT 'ativo',
    icone            TEXT(100),
    cor              TEXT(20),
    descricao        TEXT,
    criado_em        DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    criado_por_id    TEXT(36),
    FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 10. grupos_excecao
CREATE TABLE IF NOT EXISTS grupos_excecao (
    id                 TEXT(36)  NOT NULL PRIMARY KEY,
    nome               TEXT(255) NOT NULL,
    fora_horario       INTEGER   NOT NULL DEFAULT 1,
    janela_inicio      TIME,
    janela_fim         TIME,
    ignora_dia_inativo INTEGER   NOT NULL DEFAULT 0,
    status             TEXT(20)  NOT NULL DEFAULT 'ativo',
    criado_em          DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    criado_por_id      TEXT(36),
    FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 11. configuracoes_sistema
CREATE TABLE IF NOT EXISTS configuracoes_sistema (
    chave             TEXT(255) NOT NULL PRIMARY KEY,
    valor             TEXT      NOT NULL,
    eh_secreto        INTEGER   NOT NULL DEFAULT 0,
    atualizado_em     DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    atualizado_por_id TEXT(36),
    FOREIGN KEY (atualizado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 12. credenciais_pbi
CREATE TABLE IF NOT EXISTS credenciais_pbi (
    id                TEXT(36)  NOT NULL PRIMARY KEY,
    tenant_id         TEXT(255),
    client_id         TEXT(255),
    client_secret     TEXT(500),
    ativo             INTEGER   NOT NULL DEFAULT 1,
    atualizado_em     DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    atualizado_por_id TEXT(36),
    FOREIGN KEY (atualizado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 13. pacotes_permissao
CREATE TABLE IF NOT EXISTS pacotes_permissao (
    id            TEXT(36)  NOT NULL PRIMARY KEY,
    nome          TEXT(255) NOT NULL UNIQUE,
    descricao     TEXT,
    criado_em     DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    criado_por_id TEXT(36),
    FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
```

### 7.3 Tabelas com múltiplas dependências

```sql
-- 14. relatorios (depende de espacos_trabalho e usuarios)
CREATE TABLE IF NOT EXISTS relatorios (
    id                 TEXT(36)  NOT NULL PRIMARY KEY,
    nome               TEXT(255) NOT NULL,
    espaco_trabalho_id TEXT(36)  NOT NULL,
    id_relatorio_pbi   TEXT(255),
    categoria          TEXT(100),
    status             TEXT(20)  NOT NULL DEFAULT 'publicado',
    descricao          TEXT,
    criado_em          DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    atualizado_em      DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    criado_por_id      TEXT(36),
    FOREIGN KEY (espaco_trabalho_id) REFERENCES espacos_trabalho(id) ON DELETE CASCADE,
    FOREIGN KEY (criado_por_id)      REFERENCES usuarios(id)         ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_relatorios_espaco_status ON relatorios(espaco_trabalho_id, status);
CREATE INDEX IF NOT EXISTS ix_relatorios_status        ON relatorios(status);

-- 15. acessos_workspace
CREATE TABLE IF NOT EXISTS acessos_workspace (
    id                 TEXT(36) NOT NULL PRIMARY KEY,
    usuario_id         TEXT(36) NOT NULL,
    espaco_trabalho_id TEXT(36) NOT NULL,
    nivel_acesso       TEXT(20) NOT NULL DEFAULT 'apenas_relatorios',
    concedido_por_id   TEXT(36),
    concedido_em       DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_aw_usuario_espaco UNIQUE (usuario_id, espaco_trabalho_id),
    FOREIGN KEY (usuario_id)         REFERENCES usuarios(id)          ON DELETE CASCADE,
    FOREIGN KEY (espaco_trabalho_id) REFERENCES espacos_trabalho(id)  ON DELETE CASCADE,
    FOREIGN KEY (concedido_por_id)   REFERENCES usuarios(id)          ON DELETE SET NULL
);

-- 16. acessos_relatorio
CREATE TABLE IF NOT EXISTS acessos_relatorio (
    id               TEXT(36) NOT NULL PRIMARY KEY,
    usuario_id       TEXT(36) NOT NULL,
    relatorio_id     TEXT(36) NOT NULL,
    concedido_por_id TEXT(36),
    concedido_em     DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_ar_usuario_relatorio UNIQUE (usuario_id, relatorio_id),
    FOREIGN KEY (usuario_id)       REFERENCES usuarios(id)   ON DELETE CASCADE,
    FOREIGN KEY (relatorio_id)     REFERENCES relatorios(id) ON DELETE CASCADE,
    FOREIGN KEY (concedido_por_id) REFERENCES usuarios(id)   ON DELETE SET NULL
);

-- 17. favoritos
CREATE TABLE IF NOT EXISTS favoritos (
    id           TEXT(36) NOT NULL PRIMARY KEY,
    usuario_id   TEXT(36) NOT NULL,
    relatorio_id TEXT(36) NOT NULL,
    criado_em    DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_fav_usuario_relatorio UNIQUE (usuario_id, relatorio_id),
    FOREIGN KEY (usuario_id)   REFERENCES usuarios(id)   ON DELETE CASCADE,
    FOREIGN KEY (relatorio_id) REFERENCES relatorios(id) ON DELETE CASCADE
);

-- 18. membros_grupo_excecao
CREATE TABLE IF NOT EXISTS membros_grupo_excecao (
    grupo_id   TEXT(36) NOT NULL,
    usuario_id TEXT(36) NOT NULL,
    PRIMARY KEY (grupo_id, usuario_id),
    FOREIGN KEY (grupo_id)   REFERENCES grupos_excecao(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)       ON DELETE CASCADE
);

-- 19. pacotes_permissao_itens
CREATE TABLE IF NOT EXISTS pacotes_permissao_itens (
    id              TEXT(36)  NOT NULL PRIMARY KEY,
    pacote_id       TEXT(36)  NOT NULL,
    modulo          TEXT(100) NOT NULL,
    pode_visualizar INTEGER   NOT NULL DEFAULT 0,
    pode_criar      INTEGER   NOT NULL DEFAULT 0,
    pode_editar     INTEGER   NOT NULL DEFAULT 0,
    pode_excluir    INTEGER   NOT NULL DEFAULT 0,
    pode_exportar   INTEGER   NOT NULL DEFAULT 0,
    pode_gerenciar  INTEGER   NOT NULL DEFAULT 0,
    CONSTRAINT uq_ppi_pacote_modulo UNIQUE (pacote_id, modulo),
    FOREIGN KEY (pacote_id) REFERENCES pacotes_permissao(id) ON DELETE CASCADE
);

-- 20. usuarios_pacotes
CREATE TABLE IF NOT EXISTS usuarios_pacotes (
    id               TEXT(36) NOT NULL PRIMARY KEY,
    usuario_id       TEXT(36) NOT NULL,
    pacote_id        TEXT(36) NOT NULL,
    atribuido_por_id TEXT(36),
    atribuido_em     DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_up_usuario_pacote UNIQUE (usuario_id, pacote_id),
    FOREIGN KEY (usuario_id)       REFERENCES usuarios(id)          ON DELETE CASCADE,
    FOREIGN KEY (pacote_id)        REFERENCES pacotes_permissao(id) ON DELETE CASCADE,
    FOREIGN KEY (atribuido_por_id) REFERENCES usuarios(id)          ON DELETE SET NULL
);
```

### 7.4 Trigger de imutabilidade (SQL Server — produção)

```sql
CREATE TRIGGER trg_logs_auditoria_readonly
ON logs_auditoria
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR('Operação proibida: logs_auditoria é append-only.', 16, 1);
    ROLLBACK;
END;
```

---

## 8. Seeds — Dados Obrigatórios

### Método recomendado (automático)

```bash
cd backend
python seed.py
```

O script é **idempotente** (usa upsert — pode ser executado múltiplas vezes sem duplicar dados).

### 8.1 Departamentos (5 registros)

| Nome | Código | Descrição |
|------|--------|-----------|
| TI | TI | Tecnologia da Informação |
| RH | RH | Recursos Humanos |
| Financeiro | FIN | Financeiro e Controladoria |
| Marketing | MKT | Marketing e Comunicação |
| Operações | OPS | Operações e Logística |

### 8.2 Usuários de demonstração

| Nome | E-mail | Senha | Perfil | Departamento |
|------|--------|-------|--------|-------------|
| Admin CGID | admin@cgid.com | Admin@2025 | master | TI |
| Carlos Coordenador | carlos@cgid.com | Carlos@123 | coordenador | Operações |
| Mariana Colaborador | mariana@cgid.com | Mariana@123 | colaborador | RH |
| Convidado Demo | visitante@cgid.com | Visitante@123 | convidado | — |

> **Atenção:** Altere as senhas imediatamente após o primeiro deploy em produção.

### 8.3 Matriz de permissões por perfil

Os módulos ativos no seed v2.1 são: `usuarios`, `permissoes`, `relatorios`, `workspaces`, `auditoria`, `seguranca`, `configuracoes`, `expediente`, `grupos_excecao`, `landbank`, `departamentos`.

| Perfil | visualizar | criar | editar | excluir | exportar | gerenciar |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| master | ✓ todos | ✓ todos | ✓ todos | ✓ todos | ✓ todos | ✓ todos |
| administrador | ✓ todos | ✓ todos | ✓ todos | ✓ exceto configuracoes | ✓ todos | ✓ exceto configuracoes |
| coordenador | relatorios, workspaces, auditoria, usuarios, departamentos | ✗ | ✗ | ✗ | relatorios=✓ | ✗ |
| colaborador | relatorios | ✗ | ✗ | ✗ | ✗ | ✗ |
| convidado | relatorios | ✗ | ✗ | ✗ | ✗ | ✗ |

### 8.4 Regras de expediente (7 linhas)

```
Domingo (0):  08:00–18:00, ativo=false, bloquear=false  (sem restrição)
Segunda (1):  08:00–18:00, ativo=true,  bloquear=true
Terça (2):    08:00–18:00, ativo=true,  bloquear=true
Quarta (3):   08:00–18:00, ativo=true,  bloquear=true
Quinta (4):   08:00–18:00, ativo=true,  bloquear=true
Sexta (5):    08:00–18:00, ativo=true,  bloquear=true
Sábado (6):   08:00–18:00, ativo=false, bloquear=false  (sem restrição)
```

### 8.5 Configurações do sistema (7 chaves)

| Chave | Valor padrão | Secreto |
|-------|-------------|:-------:|
| `nome_portal` | `"CGID - Centro de Governança e Inteligência de Dados"` | Não |
| `ambiente` | `"desenvolvimento"` | Não |
| `pbi_client_id` | `""` | Não |
| `pbi_tenant_id` | `""` | Não |
| `pbi_workspace_id` | `""` | Não |
| `pbi_client_secret` | `""` | **Sim** |
| `pbi_integracao_ativa` | `false` | Não |

### 8.6 Workspaces e relatórios de exemplo

4 workspaces (Administrativo, Controladoria, Marketing, SAC) com 12 relatórios ao total. O campo `categoria` (texto livre) pode ser preenchido opcionalmente em cada relatório.

---

## 9. Ordem Correta de Execução

```
ETAPA 1 — Tabelas sem dependências externas
  ├── departamentos       (standalone)
  ├── perfis              (standalone — deve existir antes de usuarios em v2.1)
  ├── usuarios            (FK self-ref, departamento_id e perfil→perfis)
  ├── permissoes_perfil   (standalone)
  ├── regras_expediente   (standalone)
  ├── logs_auditoria      (standalone — sem FK intencional)
  └── historico_config_critica (standalone — sem FK intencional)

ETAPA 2 — Tabelas dependentes de usuarios
  ├── sessoes_autenticacao  (→ usuarios)
  ├── espacos_trabalho      (→ usuarios)
  ├── grupos_excecao        (→ usuarios)
  ├── configuracoes_sistema (→ usuarios)
  ├── credenciais_pbi       (→ usuarios)
  └── pacotes_permissao     (→ usuarios)

ETAPA 3 — Tabelas dependentes de espacos_trabalho
  └── relatorios            (→ espacos_trabalho, → usuarios)

ETAPA 4 — Tabelas dependentes de múltiplas entidades
  ├── acessos_workspace     (→ usuarios, → espacos_trabalho)
  ├── acessos_relatorio     (→ usuarios, → relatorios)
  ├── favoritos             (→ usuarios, → relatorios)
  ├── membros_grupo_excecao (→ grupos_excecao, → usuarios)
  ├── pacotes_permissao_itens (→ pacotes_permissao)
  └── usuarios_pacotes      (→ usuarios, → pacotes_permissao)

ETAPA 5 — Seeds (dados obrigatórios)
  ├── perfis                (5 registros: master, administrador, coordenador, colaborador, convidado)
  ├── departamentos         (5 registros)
  ├── usuarios              (4 usuários de demonstração)
  ├── permissoes_perfil     (55 linhas — 11 módulos × 5 perfis)
  ├── regras_expediente     (7 linhas)
  ├── configuracoes_sistema (7 chaves)
  ├── espacos_trabalho      (4 workspaces)
  └── relatorios            (12 relatórios)
```

---

## 10. Passo a Passo: Criar o Banco do Zero

### Modo Desenvolvimento (SQLite — banco novo)

```bash
cd backend
pip install -r requirements.txt   # inclui alembic

# Criar tabelas e popular o banco
python seed.py

# Iniciar o servidor
uvicorn main:app --reload
# Acesse: http://localhost:8000/docs
```

### Modo Desenvolvimento (SQLite — banco existente, atualizar schema)

```bash
cd backend
pip install alembic

# Se o banco foi criado via seed.py (sem Alembic), marcar versão base primeiro:
alembic stamp 60fc08a85566

# Aplicar migrations pendentes:
#   a1b2c3d4e5f6 → FK usuarios.perfil → perfis.codigo
#   b2c3d4e5f6a7 → remoção de categorias_relatorio
alembic upgrade head

# Verificar estado
alembic current
# Esperado: b2c3d4e5f6a7 (head)
```

### Modo Produção (SQL Server)

```bash
# 1. Criar o banco de dados no SQL Server
# sqlcmd -S <servidor> -U <usuario> -P <senha>
# CREATE DATABASE cgid COLLATE Latin1_General_CI_AS; GO

# 2. Ajustar backend/database.py para SQL Server
# DATABASE_URL = "mssql+pyodbc://usuario:senha@servidor/cgid?driver=ODBC+Driver+17+for+SQL+Server"

# 3. Executar seed (cria tabelas + dados iniciais)
python seed.py

# 4. Criar trigger de imutabilidade em logs_auditoria (ver seção 7.4)

# 5. Iniciar o servidor
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Validação pós-criação

```python
# Via Python/SQLite
import sqlite3
conn = sqlite3.connect('cgid.db')
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tabelas criadas:', len(tables))  # Esperado: 20
conn.close()
```

---

## 11. Configurações e Variáveis de Ambiente

### `backend/database.py`

```python
# Desenvolvimento (padrão atual)
DATABASE_URL = "sqlite:///./cgid.db"

# SQL Server (produção)
DATABASE_URL = (
    "mssql+pyodbc://usuario:senha@servidor/banco"
    "?driver=ODBC+Driver+17+for+SQL+Server"
)
```

### `backend/.env` (para integração Power BI)

```env
PBI_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_SECRET=sua-chave-secreta-aqui
```

### Configurações armazenadas no banco

| Chave | Descrição | Secreto |
|-------|-----------|:-------:|
| `nome_portal` | Nome exibido no portal | Não |
| `ambiente` | `"desenvolvimento"` ou `"producao"` | Não |
| `pbi_client_id` | Client ID do app Azure AD | Não |
| `pbi_tenant_id` | Tenant ID do Azure AD | Não |
| `pbi_workspace_id` | Workspace ID padrão Power BI | Não |
| `pbi_client_secret` | Client Secret do app Azure AD | **Sim** |
| `pbi_integracao_ativa` | `"true"` / `"false"` | Não |

> Na v2.0, as credenciais PBI podem ser gerenciadas também pela tabela `credenciais_pbi` via interface administrativa.

---

## 12. Arquitetura de Permissões (Backend)

A lógica de controle de acesso foi centralizada em v2.1 em dois módulos dedicados:

### `backend/constants.py`

Constantes globais usadas em todo o backend:

| Constante | Tipo | Conteúdo |
|-----------|------|---------|
| `PERFIS_VALIDOS` | set | Todos os perfis aceitos pelo sistema |
| `PERFIS_ATRIBUIVEIS` | set | Perfis que podem ser atribuídos pela UI (exclui `master`) |
| `PERFIS_SUPER_ADMIN` | set | `{"master"}` — acesso irrestrito sem consulta ao banco |
| `PERFIS_ADMIN` | set | `{"master", "administrador"}` |
| `STATUS_VALIDOS` | set | `{"ativo", "inativo", "bloqueado"}` |
| `SENHA_PADRAO` | str | `"Mudar@123"` — senha provisória gerada pelo sistema |
| `MODULOS_VALIDOS` | set | 11 módulos: `usuarios`, `permissoes`, `relatorios`, `workspaces`, `auditoria`, `seguranca`, `configuracoes`, `expediente`, `grupos_excecao`, `landbank`, `departamentos` |
| `ACOES_VALIDAS` | dict | Mapeamento `acao → campo_db` (ex: `"visualizar" → "pode_visualizar"`) |

### `backend/services/permission_service.py`

| Função | Descrição |
|--------|-----------|
| `obter_permissoes_efetivas(usuario, db)` | Retorna `dict[modulo → dict[acao → bool]]` combinando `permissoes_perfil` (base) com `pacotes_permissao_itens` (aditivos). Usuários `master` recebem `True` em tudo sem consultar o banco. Usa 3 queries fixas. |
| `checar_permissao(usuario, modulo, acao, db)` | Atalho que retorna `bool` para um módulo/ação específicos. |

### `backend/dependencies.py`

| Símbolo | Descrição |
|---------|-----------|
| `get_usuario_requisicao(request, db)` | Lê `X-Usuario-Id` do header e retorna o `Usuario` do banco. |
| `exigir_permissao(usuario, modulo, acao, db)` | Lança `HTTP 401/403` se a permissão não for satisfeita. |
| `require_permission(modulo, acao)` | **Dependency factory** para uso com `Depends()`. Retorna o `Usuario` autenticado ou lança exceção. Uso: `autor: Usuario = Depends(require_permission("usuarios", "criar"))` |
| `validar_sessao_middleware` | Middleware ASGI que valida `X-Session-Token` (SHA-256) a cada requisição. |

> Re-exporta `checar_permissao`, `PERFIS_VALIDOS`, `PERFIS_ADMIN`, `STATUS_VALIDOS` e `SENHA_PADRAO` de `constants` por compatibilidade com routers existentes.

---

## 13. Possíveis Erros e Soluções

### `OperationalError: no such table: usuarios`

**Causa:** O banco ainda não foi criado.  
**Solução:** `cd backend && python seed.py`

---

### `alembic.util.exc.CommandError: Can't locate revision identified by '...'` / `Target database is not up to date`

**Causa:** O banco foi criado com `seed.py` (via `create_all`) mas o Alembic não tem registro da versão aplicada.  
**Solução:**
```bash
# Marcar o banco como estando na versão base (v2.0)
alembic stamp 60fc08a85566

# Em seguida aplicar as migrations pendentes
alembic upgrade head
```

---

### `IntegrityError: UNIQUE constraint failed: usuarios.email`

**Causa:** Tentativa de inserir dois usuários com o mesmo e-mail.  
**Solução:** Verifique se o `seed.py` já foi executado (usa upsert). Para reiniciar do zero:
```bash
cd backend && rm cgid.db && python seed.py
```

---

### `FOREIGN KEY constraint failed` (SQLite)

**Causa:** SQLite não ativa FKs por padrão.  
**Solução:** Adicione ao `database.py`:
```python
from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

---

### `pyodbc.InterfaceError: ('IM002', ...)` (SQL Server)

**Causa:** Driver ODBC não instalado.  
**Solução:**
```bash
# Windows
winget install Microsoft.ODBCDriverForSQLServer

# Ubuntu/Debian
apt-get install msodbcsql17
```

---

### `bcrypt: (trapped) error reading bcrypt version`

**Causa:** Incompatibilidade de versão do `passlib` com `bcrypt` recente.  
**Solução:** `pip install 'passlib[bcrypt]' 'bcrypt==4.0.1'`

---

### Campos `atualizado_em` não sendo atualizados automaticamente (SQLite)

**Causa:** SQLite não suporta `ON UPDATE CURRENT_TIMESTAMP` nativamente.  
**Solução:** Sempre use a sessão SQLAlchemy para atualizações. Para SQL direto:
```sql
UPDATE usuarios SET nome = 'Novo Nome', atualizado_em = CURRENT_TIMESTAMP WHERE id = '...';
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 2026-06-23 | Vinicius Soares | Criação inicial (15 tabelas) |
| 2.0 | 2026-06-25 | Vinicius Soares | +6 tabelas novas (departamentos, perfis, credenciais_pbi, pacotes_permissao, pacotes_permissao_itens, usuarios_pacotes); remoção de sobrescritas_permissao; departamento_id em usuarios; CASCADE corrigido em membros_grupo_excecao.usuario_id; Alembic configurado |
| 2.1 | 2026-06-25 | Vinicius Soares | Remoção de categorias_relatorio (migration b2c3d4e5f6a7); campo categoria texto livre mantido em relatorios; FK usuarios.perfil → perfis.codigo (migration a1b2c3d4e5f6); lógica de permissões centralizada em permission_service.py; constants.py criado; require_permission() dependency adicionada; schemas.py centralizado |
| 2.1.1 | 2026-06-26 | Vinicius Soares | Documentação: seção 12 (Arquitetura de Permissões); tipo_evento de logs_auditoria corrigido (adicionado `permissao`); FK usuarios.perfil registrada em §4.2 e §4.9; migration a1b2c3d4e5f6 incluída nos comandos de upgrade; ERD atualizado com FK perfil; ordem de execução atualizada (perfis antes de usuarios); correções de ESLint no frontend (AuditPage, AccessControlPage) |
| 2.1.2 | 2026-06-26 | Vinicius Soares | Correção de fuso horário na auditoria: `momento` agora gravado explicitamente via `datetime.now(timezone.utc)` no Python (antes dependia de `server_default` do SQLite); frontend (`AuditPage`) passa a interpretar timestamps como UTC e exibe no fuso `America/Sao_Paulo` |

*Documentação gerada a partir do código-fonte em `backend/models.py` e `backend/seed.py`.*

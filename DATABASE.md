# DATABASE.md — CGID: Documentação Técnica do Banco de Dados

> **Projeto:** CGID — Centro de Governança e Inteligência de Dados  
> **Backend:** Python 3.12 + FastAPI  
> **ORM:** SQLAlchemy 2.0  
> **Banco (desenvolvimento):** SQLite 3 (`backend/cgid.db`)  
> **Banco (produção recomendado):** SQL Server 2019+  
> **Última revisão:** 2026-06-23

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
12. [Possíveis Erros e Soluções](#12-possíveis-erros-e-soluções)

---

## 1. Visão Geral da Arquitetura

O CGID é um portal de acesso controlado a relatórios do **Power BI**. O banco de dados sustenta três pilares:

| Pilar | Tabelas Envolvidas |
|---|---|
| **Autenticação e Sessões** | `usuarios`, `sessoes_autenticacao` — token de sessão opaco (SHA-256), sem JWT |
| **RBAC (controle de acesso)** | `permissoes_perfil`, `sobrescritas_permissao`² , `acessos_workspace`, `acessos_relatorio` |
| **Conteúdo (workspaces e relatórios)** | `espacos_trabalho`, `relatorios`, `favoritos` |
| **Restrições de horário** | `regras_expediente`, `grupos_excecao`, `membros_grupo_excecao` |
| **Auditoria e rastreabilidade** | `logs_auditoria`, `historico_config_critica` |
| **Configurações globais** | `configuracoes_sistema` |

**Total:** 15 tabelas.

> ² `permissoes_perfil` e `sobrescritas_permissao` são consultadas pelo `main.py` via `checar_permissao()` / `exigir_permissao()` para RBAC granular. O controle administrativo é feito por verificação direta de perfil (`PERFIS_ADMIN = {"master", "administrador"}`).

O schema é definido inteiramente via modelos SQLAlchemy em `backend/models.py`. A criação física das tabelas ocorre automaticamente na inicialização do servidor (`Base.metadata.create_all(bind=engine)` em `backend/main.py`) ou ao executar `backend/seed.py`.

---

## 2. Diagrama de Entidade-Relacionamento (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   usuarios                                   │
│  PK id | nome | email (UQ) | hash_senha | perfil | status | tentativas_login │
│  senha_provisoria | ultimo_login | foto_url | mfa_ativo | mfa_segredo        │
│  criado_em | atualizado_em | criado_por_id (FK→usuarios)                     │
└─────┬───────────────────────────────────────────────────────────────────────┘
      │ 1
      │
      ├──────────────────────────────── N ──► sessoes_autenticacao
      │                                       id | usuario_id (FK) | hash_refresh_token (UQ)
      │                                       criado_em | expira_em(12h) | ultimo_uso_em
      │                                       revogado_em | endereco_ip | user_agent
      │                                       [token opaco SHA-256 — sem JWT; sessão única]
      │
      ├──────────────────────────────── N ──► sobrescritas_permissao
      │                                       id | usuario_id (FK) | modulo (UQ:usuario+modulo)
      │                                       pode_* (6 campos NULLABLE) | definido_por_id | definido_em
      │
      ├──────────────────────────────── N ──► favoritos ──────── N ──► relatorios
      │                                       id | usuario_id | relatorio_id             │
      │                                       criado_em (UQ: usuario+relatorio)          │
      │                                                                                  │
      ├──────────────────────────────── N ──► acessos_relatorio ─ N ──► (relatorios)    │
      │                                       id | usuario_id | relatorio_id             │
      │                                       concedido_por_id | concedido_em            │
      │                                                                                  │
      ├──────────────────────────────── N ──► acessos_workspace ─ N ──► espacos_trabalho
      │                                       id | usuario_id | espaco_trabalho_id       │
      │                                       nivel_acesso | concedido_por_id            │
      │                                                                                  │
      │                                                          espacos_trabalho 1──N──►│
      │                                                          id | nome (UQ) | icone  │
      │                                                          cor | status | descricao│
      │                                                          criado_por_id            │
      │                                                                        relatorios │
      │                                                                        id | nome  │
      │                                                                        espaco_id  │
      │                                                                        categoria  │
      │                                                                        status     │
      │
      └──────────────────────────────── N ──► membros_grupo_excecao ─ N ──► grupos_excecao
                                              PK(grupo_id, usuario_id)        id | nome
                                                                               fora_horario
                                                                               janela_inicio/fim
                                                                               ignora_dia_inativo

Tabelas independentes (sem FK de entrada):
  permissoes_perfil       — matriz RBAC por perfil × módulo
  regras_expediente       — horário de funcionamento por dia da semana
  logs_auditoria          — trilha imutável de auditoria (sem FK intencional)
  historico_config_critica — histórico de campos críticos
  configuracoes_sistema   — chave-valor de configurações globais
```

---

## 3. Descrição das Tabelas

| # | Tabela | Finalidade |
|---|--------|-----------|
| 1 | `usuarios` | Contas de usuário com autenticação, MFA, perfis de acesso e rastreamento de criação |
| 2 | `sessoes_autenticacao` | Sessões de autenticação ativas; armazena SHA-256 do token de sessão opaco (sem JWT); expiração em 12h; sessão única por usuário |
| 3 | `espacos_trabalho` | Agrupamentos lógicos de relatórios Power BI (equivalente ao workspace do PBI) |
| 4 | `relatorios` | Relatórios Power BI individuais vinculados a um workspace |
| 5 | `acessos_workspace` | Concessão de acesso de um usuário a um workspace (RBAC granular) |
| 6 | `acessos_relatorio` | Concessão de acesso de um usuário a um relatório específico |
| 7 | `permissoes_perfil` | Matriz RBAC padrão: define o que cada perfil pode fazer em cada módulo |
| 8 | `sobrescritas_permissao` | Exceções individuais à matriz RBAC (override por usuário) |
| 9 | `regras_expediente` | Horário de funcionamento por dia da semana (controla acesso fora do expediente) |
| 10 | `grupos_excecao` | Grupos de usuários com isenção das regras de expediente |
| 11 | `membros_grupo_excecao` | Tabela associativa: quais usuários pertencem a quais grupos de exceção |
| 12 | `favoritos` | Relatórios marcados como favoritos por um usuário |
| 13 | `logs_auditoria` | Trilha de auditoria imutável (append-only) de todos os eventos do sistema |
| 14 | `configuracoes_sistema` | Store chave-valor para configurações globais (incluindo credenciais PBI) |
| 15 | `historico_config_critica` | Histórico de alterações em campos críticos (IDs PBI, credenciais) |

---

## 4. Esquema Completo por Tabela

### 4.1 `usuarios`

| Coluna | Tipo SQLite | Tipo SQL Server | Nulo | Padrão | Restrições | Descrição |
|--------|------------|----------------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NVARCHAR(36) | NÃO | UUID gerado em Python | PK | Identificador único (UUID v4) |
| `nome` | TEXT(255) | NVARCHAR(255) | NÃO | — | NOT NULL | Nome completo |
| `email` | TEXT(255) | NVARCHAR(255) | NÃO | — | NOT NULL, UNIQUE, INDEX | E-mail corporativo (login) |
| `hash_senha` | TEXT(255) | NVARCHAR(255) | NÃO | — | NOT NULL | Hash bcrypt da senha |
| `perfil` | TEXT(30) | NVARCHAR(30) | NÃO | — | NOT NULL | `master` \| `administrador` \| `coordenador` \| `colaborador` \| `convidado` |
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

**Índices:**
- `ix_usuarios_email` — UNIQUE em `email`
- `ix_usuarios_status` — em `status`

---

### 4.2 `sessoes_autenticacao`

> **Nota de implementação:** A autenticação usa token de sessão opaco, **não JWT**. No login, o backend gera um token aleatório (`secrets.token_urlsafe(32)`), armazena seu SHA-256 nesta tabela e retorna o token bruto ao frontend. A cada requisição, o frontend envia o token via `X-Session-Token`; o middleware calcula o SHA-256 e valida contra esta tabela. A expiração é de **12 horas** (não 24). O sistema implementa sessão única: ao fazer um novo login, todas as sessões ativas anteriores são revogadas (`revogado_em` preenchido).

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | ID da sessão |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE, INDEX | Usuário dono da sessão |
| `hash_refresh_token` | TEXT(255) | NÃO | — | NOT NULL, UNIQUE | SHA-256 do token de sessão opaco |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `expira_em` | DATETIME | NÃO | — | NOT NULL | Expiração da sessão (12 horas após criação) |
| `ultimo_uso_em` | DATETIME | SIM | NULL | — | Última validação do token (atualizado pelo middleware) |
| `revogado_em` | DATETIME | SIM | NULL | — | Timestamp de logout ou revogação por nova sessão (NULL = ativa) |
| `endereco_ip` | TEXT(45) | SIM | NULL | — | IPv4 ou IPv6 de origem |
| `user_agent` | TEXT(500) | SIM | NULL | — | Identificação do browser/dispositivo |

**Índices:**
- `ix_sa_usuario_ativo` — composto em `(usuario_id, revogado_em)` — acelera consultas de sessões ativas por usuário

---

### 4.3 `espacos_trabalho`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `nome` | TEXT(255) | NÃO | — | NOT NULL, UNIQUE | Nome do workspace |
| `id_workspace_pbi` | TEXT(255) | SIM | NULL | — | ID do workspace no Power BI Service |
| `status` | TEXT(20) | NÃO | `ativo` | NOT NULL | `ativo` \| `arquivado` |
| `icone` | TEXT(100) | SIM | NULL | — | Classe Font Awesome (ex: `fa-solid fa-building`) |
| `cor` | TEXT(20) | SIM | NULL | — | Cor hexadecimal (ex: `#2563eb`) |
| `descricao` | TEXT | SIM | NULL | — | Descrição longa |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `criado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Criador |

---

### 4.4 `relatorios`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `nome` | TEXT(255) | NÃO | — | NOT NULL | Nome do relatório |
| `espaco_trabalho_id` | TEXT(36) | NÃO | — | FK → `espacos_trabalho.id` CASCADE, INDEX | Workspace pai |
| `id_relatorio_pbi` | TEXT(255) | SIM | NULL | — | ID do relatório no Power BI Service |
| `categoria` | TEXT(100) | SIM | NULL | — | Ex: `Financeiro`, `Operacional`, `Estratégico` |
| `status` | TEXT(20) | NÃO | `publicado` | NOT NULL | `publicado` \| `rascunho` \| `arquivado` |
| `descricao` | TEXT | SIM | NULL | — | Descrição longa |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `atualizado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação (UTC) |
| `criado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Criador |

**Índices:**
- `ix_relatorios_espaco_status` — composto em `(espaco_trabalho_id, status)`
- `ix_relatorios_status` — em `status`

---

### 4.5 `acessos_workspace`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE | Usuário |
| `espaco_trabalho_id` | TEXT(36) | NÃO | — | FK → `espacos_trabalho.id` CASCADE | Workspace |
| `nivel_acesso` | TEXT(20) | NÃO | `apenas_relatorios` | NOT NULL | `total` \| `apenas_relatorios` \| `nenhum` |
| `concedido_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Quem concedeu |
| `concedido_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Quando foi concedido |

**Constraints:**
- `uq_aw_usuario_espaco` — UNIQUE em `(usuario_id, espaco_trabalho_id)` — impede concessões duplicadas

---

### 4.6 `acessos_relatorio`

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

### 4.7 `permissoes_perfil`

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
- `uq_pp_perfil_modulo` — UNIQUE em `(perfil, modulo)` — uma linha por combinação perfil+módulo

**Módulos válidos:** `usuarios`, `permissoes`, `relatorios`, `workspaces`, `auditoria`, `seguranca`, `configuracoes`, `expediente`, `grupos_excecao`

> **Status de implementação:** Esta tabela é populada pelo `seed.py` mas **não é consultada pelo `main.py`** na versão atual. O controle de acesso é feito por perfil diretamente no código dos endpoints. O uso desta tabela para RBAC granular está previsto para implementação futura.

---

### 4.8 `sobrescritas_permissao`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE | Usuário |
| `modulo` | TEXT(100) | NÃO | — | NOT NULL | Módulo afetado |
| `pode_visualizar` | INTEGER(bool) | SIM | NULL | — | NULL=herda do perfil; 0=negar; 1=conceder |
| `pode_criar` | INTEGER(bool) | SIM | NULL | — | Idem |
| `pode_editar` | INTEGER(bool) | SIM | NULL | — | Idem |
| `pode_excluir` | INTEGER(bool) | SIM | NULL | — | Idem |
| `pode_exportar` | INTEGER(bool) | SIM | NULL | — | Idem |
| `pode_gerenciar` | INTEGER(bool) | SIM | NULL | — | Idem |
| `definido_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Admin que definiu a sobrescrita |
| `definido_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Quando foi definida |

**Constraints:**
- `uq_sp_usuario_modulo` — UNIQUE em `(usuario_id, modulo)`

> **Status de implementação:** Idem `permissoes_perfil` — tabela definida e populada (vazia por padrão, sem linhas de seed), mas não consultada pelo `main.py` na versão atual.

---

### 4.9 `regras_expediente`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `dia_semana` | INTEGER | NÃO | — | NOT NULL | 0=Domingo … 6=Sábado |
| `hora_inicio` | TIME | NÃO | — | NOT NULL | Início do expediente |
| `hora_fim` | TIME | NÃO | — | NOT NULL | Fim do expediente |
| `ativo` | INTEGER(bool) | NÃO | `1` | NOT NULL | `0` = dia sem restrição (ex: fim de semana) |
| `bloquear_fora` | INTEGER(bool) | NÃO | `1` | NOT NULL | `1` = bloqueia acesso fora do horário |
| `atualizado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação |

**Constraints:**
- `uq_re_dia_semana` — UNIQUE em `dia_semana` — uma linha por dia

---

### 4.10 `grupos_excecao`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `nome` | TEXT(255) | NÃO | — | NOT NULL | Nome do grupo |
| `fora_horario` | INTEGER(bool) | NÃO | `1` | NOT NULL | Permite acesso fora do expediente |
| `janela_inicio` | TIME | SIM | NULL | — | Início de janela personalizada (opcional) |
| `janela_fim` | TIME | SIM | NULL | — | Fim de janela personalizada (opcional) |
| `ignora_dia_inativo` | INTEGER(bool) | NÃO | `0` | NOT NULL | Permite acesso em dias sem expediente |
| `status` | TEXT(20) | NÃO | `ativo` | NOT NULL | `ativo` \| `inativo` |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Criação (UTC) |
| `criado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Criador |

---

### 4.11 `membros_grupo_excecao`

| Coluna | Tipo | Nulo | Restrições | Descrição |
|--------|------|------|-----------|-----------|
| `grupo_id` | TEXT(36) | NÃO | PK, FK → `grupos_excecao.id` CASCADE | Grupo |
| `usuario_id` | TEXT(36) | NÃO | PK, FK → `usuarios.id` | Usuário |

**Chave primária composta:** `(grupo_id, usuario_id)`

---

### 4.12 `favoritos`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `usuario_id` | TEXT(36) | NÃO | — | FK → `usuarios.id` CASCADE | Usuário |
| `relatorio_id` | TEXT(36) | NÃO | — | FK → `relatorios.id` CASCADE | Relatório favoritado |
| `criado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL | Quando foi favoritado |

**Constraints:**
- `uq_fav_usuario_relatorio` — UNIQUE em `(usuario_id, relatorio_id)`

---

### 4.13 `logs_auditoria`

> **Atenção:** Tabela append-only. Nenhum UPDATE ou DELETE deve ser executado nela.  
> Em SQL Server, recomenda-se criar um INSTEAD OF trigger para bloquear modificações.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `momento` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, INDEX | Timestamp do evento (UTC) |
| `usuario_id` | TEXT(36) | SIM | NULL | INDEX (sem FK intencional) | ID do usuário (NULL para eventos de sistema) |
| `nome_usuario` | TEXT(255) | SIM | NULL | — | Snapshot do nome (imutável) |
| `email_usuario` | TEXT(255) | SIM | NULL | — | Snapshot do e-mail (imutável) |
| `tipo_evento` | TEXT(50) | NÃO | — | NOT NULL, INDEX | `autenticacao` \| `usuario` \| `acesso` \| `relatorio` \| `seguranca` \| `sistema` \| `critico` — ver nota |
| `modulo` | TEXT(100) | NÃO | — | NOT NULL, INDEX | Módulo afetado — ver valores reais abaixo |
| `detalhe` | TEXT | NÃO | — | NOT NULL | Descrição do evento |
| `endereco_ip` | TEXT(45) | SIM | NULL | — | IPv4 ou IPv6 |
| `valor_anterior` | TEXT | SIM | NULL | — | Valor anterior em JSON |
| `valor_novo` | TEXT | SIM | NULL | — | Novo valor em JSON |

**Índices:**
- `ix_la_momento` — em `momento`
- `ix_la_usuario_id` — em `usuario_id`
- `ix_la_tipo_evento` — em `tipo_evento`
- `ix_la_modulo` — em `modulo`

**Valores reais de `tipo_evento` gerados pelo `main.py`:**

| Valor | Quando é gerado |
|-------|----------------|
| `autenticacao` | Login bem-sucedido |
| `seguranca` | Falha de login, bloqueio de conta, revogação de sessão, acesso negado por expediente |
| `usuario` | CRUD de usuários, reset/alteração de senha |
| `acesso` | Concessão e revogação de acesso a workspaces e relatórios |
| `relatorio` | Visualização de relatório Power BI via embed |
| `sistema` | CRUD de workspaces, relatórios, expediente, grupos de exceção, configurações PBI |
| `critico` | Alteração de campos críticos (IDs PBI, credenciais) — gerado quando `id_workspace_pbi` ou `id_relatorio_pbi` muda |

> `permissao` aparece no mapeamento de ícones da UI mas **não é gerado por nenhuma chamada `registrar_log` na versão atual**. Está reservado para quando o RBAC granular (`permissoes_perfil`) for implementado.

**Valores reais de `modulo` gerados pelo `main.py`:**
`autenticacao`, `usuarios`, `acessos_workspace`, `acessos_relatorio`, `espacos_trabalho`, `relatorios`, `expediente`, `grupos_excecao`, `configuracoes_pbi`

> Estes valores diferem dos módulos de `permissoes_perfil` (`usuarios`, `workspaces`, `auditoria`, etc.). O campo `modulo` em `logs_auditoria` é livre e reflete a entidade de banco afetada, não o módulo RBAC.

**Por que não há FK para `usuarios`?**  
Registros de auditoria devem sobreviver à exclusão do usuário. A ausência de FK é intencional para preservar o histórico completo.

---

### 4.14 `configuracoes_sistema`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `chave` | TEXT(255) | NÃO | — | PK | Chave de configuração |
| `valor` | TEXT | NÃO | — | NOT NULL | Valor (string JSON) |
| `eh_secreto` | INTEGER(bool) | NÃO | `0` | NOT NULL | Se `1`, valor é mascarado na interface |
| `atualizado_em` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, ON UPDATE | Última modificação (UTC) |
| `atualizado_por_id` | TEXT(36) | SIM | NULL | FK → `usuarios.id` SET NULL | Quem atualizou por último |

---

### 4.15 `historico_config_critica`

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|-----------|-----------|
| `id` | TEXT(36) | NÃO | UUID | PK | Identificador único |
| `momento` | DATETIME | NÃO | `CURRENT_TIMESTAMP` | NOT NULL, INDEX | Timestamp da alteração (UTC) |
| `entidade` | TEXT(50) | NÃO | — | NOT NULL, INDEX | `workspace` \| `relatorio` \| `pbi_credenciais` |
| `entidade_id` | TEXT(36) | SIM | NULL | INDEX | ID do workspace/relatório; NULL para credenciais PBI |
| `campo` | TEXT(100) | NÃO | — | NOT NULL | Nome do campo alterado (ex: `id_workspace_pbi`) |
| `valor_anterior` | TEXT | SIM | NULL | — | Valor antes da alteração |
| `valor_novo` | TEXT | SIM | NULL | — | Valor após a alteração |
| `alterado_por_id` | TEXT(36) | SIM | NULL | — | ID do usuário que alterou (sem FK intencional) |
| `alterado_por_nome` | TEXT(255) | SIM | NULL | — | Snapshot do nome do usuário |
| `alterado_por_email` | TEXT(255) | SIM | NULL | — | Snapshot do e-mail do usuário |

**Índices:**
- `ix_hcc_momento` — em `momento`
- `ix_hcc_entidade` — em `entidade`
- `ix_hcc_entidade_id` — em `entidade_id`

---

## 5. Relacionamentos e Cardinalidades

| Origem | Cardinalidade | Destino | Via | Comportamento na exclusão |
|--------|:---:|--------|-----|--------------------------|
| `usuarios` | 1:N | `sessoes_autenticacao` | `usuario_id` | CASCADE (sessões removidas) |
| `usuarios` | 1:N | `acessos_workspace` | `usuario_id` | CASCADE |
| `usuarios` | 1:N | `acessos_relatorio` | `usuario_id` | CASCADE |
| `usuarios` | 1:N | `sobrescritas_permissao` | `usuario_id` | CASCADE |
| `usuarios` | 1:N | `favoritos` | `usuario_id` | CASCADE |
| `usuarios` | N:M | `grupos_excecao` | `membros_grupo_excecao` | RESTRICT — sem ondelete¹ |
| `usuarios` | self-ref | `usuarios` | `criado_por_id` | SET NULL |
| `espacos_trabalho` | 1:N | `relatorios` | `espaco_trabalho_id` | CASCADE |
| `espacos_trabalho` | 1:N | `acessos_workspace` | `espaco_trabalho_id` | CASCADE |
| `relatorios` | 1:N | `acessos_relatorio` | `relatorio_id` | CASCADE |
| `relatorios` | 1:N | `favoritos` | `relatorio_id` | CASCADE |
| `grupos_excecao` | 1:N | `membros_grupo_excecao` | `grupo_id` | CASCADE |

> ¹ O FK de `membros_grupo_excecao.usuario_id` → `usuarios.id` **não define `ondelete`**, portanto o comportamento no banco é RESTRICT (NO ACTION). A exclusão de um usuário com membros em grupos de exceção pode falhar em SQL Server ou deixar registros órfãos em SQLite (onde FK enforcement está desativado por padrão).

---

## 6. Comportamento em Exclusão (Cascade / Set Null)

```
Ao excluir um USUÁRIO:
  → CASCADE: sessoes_autenticacao, acessos_workspace, acessos_relatorio,
             sobrescritas_permissao, favoritos
  → SET NULL: criado_por_id em usuarios, espacos_trabalho, relatorios,
              grupos_excecao; concedido_por_id em acessos_*;
              definido_por_id em sobrescritas_permissao;
              atualizado_por_id em configuracoes_sistema
  → ATENÇÃO: membros_grupo_excecao NÃO possui ondelete configurado.
             Em SQLite (FK enforcement off por padrão), registros órfãos
             podem restar. Em SQL Server, a exclusão falhará com FK
             violation se o usuário pertencer a algum grupo de exceção.
             A API não realiza limpeza explícita desta tabela ao excluir
             um usuário — recomenda-se adicionar CASCADE ou limpeza manual.

Ao excluir um WORKSPACE:
  → CASCADE: relatorios (e por consequência: acessos_relatorio, favoritos dos relatórios)
  → CASCADE: acessos_workspace

Ao excluir um RELATÓRIO:
  → CASCADE: acessos_relatorio, favoritos

Ao excluir um GRUPO DE EXCEÇÃO:
  → CASCADE: membros_grupo_excecao
```

---

## 7. Scripts SQL de Criação

> Os scripts abaixo são equivalentes SQL do que o SQLAlchemy gera automaticamente.  
> Estão escritos em **SQLite** (desenvolvimento). Para SQL Server, ajuste os tipos conforme indicado nas seções 4.x.

### 7.1 Tabelas sem dependências externas

```sql
-- ============================================================
-- TABELAS BASE (sem dependências externas)
-- ============================================================

-- 1. usuarios (auto-referência em criado_por_id — criar FK depois)
CREATE TABLE IF NOT EXISTS usuarios (
    id               TEXT(36)      NOT NULL PRIMARY KEY,
    nome             TEXT(255)     NOT NULL,
    email            TEXT(255)     NOT NULL UNIQUE,
    hash_senha       TEXT(255)     NOT NULL,
    perfil           TEXT(30)      NOT NULL,
    status           TEXT(20)      NOT NULL DEFAULT 'ativo',
    tentativas_login INTEGER       NOT NULL DEFAULT 0,
    senha_provisoria INTEGER       NOT NULL DEFAULT 0,  -- BOOLEAN
    ultimo_login     DATETIME,
    foto_url         TEXT(500),
    mfa_ativo        INTEGER       NOT NULL DEFAULT 0,  -- BOOLEAN
    mfa_segredo      TEXT(255),
    criado_em        DATETIME      NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    atualizado_em    DATETIME      NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    criado_por_id    TEXT(36),
    FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_usuarios_email  ON usuarios(email);
CREATE INDEX IF NOT EXISTS ix_usuarios_status ON usuarios(status);


-- 2. permissoes_perfil
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


-- 3. regras_expediente
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


-- 4. logs_auditoria (sem FK intencional)
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

CREATE INDEX IF NOT EXISTS ix_la_momento    ON logs_auditoria(momento);
CREATE INDEX IF NOT EXISTS ix_la_usuario_id ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS ix_la_tipo_evento ON logs_auditoria(tipo_evento);
CREATE INDEX IF NOT EXISTS ix_la_modulo     ON logs_auditoria(modulo);


-- 5. historico_config_critica (sem FK intencional)
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

CREATE INDEX IF NOT EXISTS ix_hcc_momento    ON historico_config_critica(momento);
CREATE INDEX IF NOT EXISTS ix_hcc_entidade   ON historico_config_critica(entidade);
CREATE INDEX IF NOT EXISTS ix_hcc_entidade_id ON historico_config_critica(entidade_id);
```

### 7.2 Tabelas com dependência em `usuarios`

```sql
-- ============================================================
-- TABELAS DEPENDENTES DE usuarios
-- ============================================================

-- 6. sessoes_autenticacao
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

CREATE INDEX IF NOT EXISTS ix_sa_usuario_id   ON sessoes_autenticacao(usuario_id);
CREATE INDEX IF NOT EXISTS ix_sa_usuario_ativo ON sessoes_autenticacao(usuario_id, revogado_em);


-- 7. espacos_trabalho
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


-- 8. sobrescritas_permissao
CREATE TABLE IF NOT EXISTS sobrescritas_permissao (
    id              TEXT(36)  NOT NULL PRIMARY KEY,
    usuario_id      TEXT(36)  NOT NULL,
    modulo          TEXT(100) NOT NULL,
    pode_visualizar INTEGER,
    pode_criar      INTEGER,
    pode_editar     INTEGER,
    pode_excluir    INTEGER,
    pode_exportar   INTEGER,
    pode_gerenciar  INTEGER,
    definido_por_id TEXT(36),
    definido_em     DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_sp_usuario_modulo UNIQUE (usuario_id, modulo),
    FOREIGN KEY (usuario_id)     REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (definido_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);


-- 9. grupos_excecao
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


-- 10. configuracoes_sistema
CREATE TABLE IF NOT EXISTS configuracoes_sistema (
    chave             TEXT(255) NOT NULL PRIMARY KEY,
    valor             TEXT      NOT NULL,
    eh_secreto        INTEGER   NOT NULL DEFAULT 0,
    atualizado_em     DATETIME  NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    atualizado_por_id TEXT(36),
    FOREIGN KEY (atualizado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
```

### 7.3 Tabelas com múltiplas dependências

```sql
-- ============================================================
-- TABELAS DEPENDENTES DE usuarios E espacos_trabalho/relatorios
-- ============================================================

-- 11. relatorios (depende de espacos_trabalho e usuarios)
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


-- 12. acessos_workspace
CREATE TABLE IF NOT EXISTS acessos_workspace (
    id                 TEXT(36) NOT NULL PRIMARY KEY,
    usuario_id         TEXT(36) NOT NULL,
    espaco_trabalho_id TEXT(36) NOT NULL,
    nivel_acesso       TEXT(20) NOT NULL DEFAULT 'apenas_relatorios',
    concedido_por_id   TEXT(36),
    concedido_em       DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_aw_usuario_espaco UNIQUE (usuario_id, espaco_trabalho_id),
    FOREIGN KEY (usuario_id)         REFERENCES usuarios(id)         ON DELETE CASCADE,
    FOREIGN KEY (espaco_trabalho_id) REFERENCES espacos_trabalho(id) ON DELETE CASCADE,
    FOREIGN KEY (concedido_por_id)   REFERENCES usuarios(id)         ON DELETE SET NULL
);


-- 13. acessos_relatorio
CREATE TABLE IF NOT EXISTS acessos_relatorio (
    id               TEXT(36) NOT NULL PRIMARY KEY,
    usuario_id       TEXT(36) NOT NULL,
    relatorio_id     TEXT(36) NOT NULL,
    concedido_por_id TEXT(36),
    concedido_em     DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_ar_usuario_relatorio UNIQUE (usuario_id, relatorio_id),
    FOREIGN KEY (usuario_id)     REFERENCES usuarios(id)   ON DELETE CASCADE,
    FOREIGN KEY (relatorio_id)   REFERENCES relatorios(id) ON DELETE CASCADE,
    FOREIGN KEY (concedido_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);


-- 14. favoritos
CREATE TABLE IF NOT EXISTS favoritos (
    id           TEXT(36) NOT NULL PRIMARY KEY,
    usuario_id   TEXT(36) NOT NULL,
    relatorio_id TEXT(36) NOT NULL,
    criado_em    DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_fav_usuario_relatorio UNIQUE (usuario_id, relatorio_id),
    FOREIGN KEY (usuario_id)   REFERENCES usuarios(id)   ON DELETE CASCADE,
    FOREIGN KEY (relatorio_id) REFERENCES relatorios(id) ON DELETE CASCADE
);


-- 15. membros_grupo_excecao
CREATE TABLE IF NOT EXISTS membros_grupo_excecao (
    grupo_id   TEXT(36) NOT NULL,
    usuario_id TEXT(36) NOT NULL,
    PRIMARY KEY (grupo_id, usuario_id),
    FOREIGN KEY (grupo_id)   REFERENCES grupos_excecao(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
```

### 7.4 Trigger de imutabilidade (SQL Server — produção)

```sql
-- Em SQL Server, crie este trigger para proteger logs_auditoria
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

### 8.1 Usuários de demonstração

| Nome | E-mail | Senha | Perfil |
|------|--------|-------|--------|
| Admin CGID | admin@cgid.com | Admin@2025 | master |
| Carlos Coordenador | carlos@cgid.com | Carlos@123 | coordenador |
| Mariana Colaborador | mariana@cgid.com | Mariana@123 | colaborador |
| Convidado Demo | visitante@cgid.com | Visitante@123 | convidado |

> **Atenção:** Altere as senhas imediatamente após o primeiro deploy em produção.

### 8.2 Matriz de permissões por perfil (45 linhas)

> Esta matriz é inserida pelo `seed.py` e consultada pelo `main.py` via `checar_permissao()`. Gerenciável em tempo de execução em **Configurações → Permissões** (restrito ao Master).

| Perfil | Módulos | visualizar | criar | editar | excluir | exportar | gerenciar |
|--------|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| master | todos | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| administrador | todos exceto `configuracoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| administrador | `configuracoes` | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| coordenador | `relatorios`, `workspaces`, `auditoria` | ✓ | ✗ | ✗ | ✗ | relatorios=✓ | ✗ |
| coordenador | demais módulos | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| colaborador | `relatorios` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| colaborador | demais módulos | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| convidado | `relatorios` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| convidado | demais módulos | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

### 8.3 Regras de expediente (7 linhas)

```sql
-- 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
INSERT INTO regras_expediente (id, dia_semana, hora_inicio, hora_fim, ativo, bloquear_fora) VALUES
  ('<uuid>', 0, '08:00:00', '18:00:00', 0, 0),  -- Domingo: sem restrição
  ('<uuid>', 1, '08:00:00', '18:00:00', 1, 1),  -- Segunda
  ('<uuid>', 2, '08:00:00', '18:00:00', 1, 1),  -- Terça
  ('<uuid>', 3, '08:00:00', '18:00:00', 1, 1),  -- Quarta
  ('<uuid>', 4, '08:00:00', '18:00:00', 1, 1),  -- Quinta
  ('<uuid>', 5, '08:00:00', '18:00:00', 1, 1),  -- Sexta
  ('<uuid>', 6, '08:00:00', '18:00:00', 0, 0);  -- Sábado: sem restrição
```

### 8.4 Configurações do sistema (7 chaves)

```sql
INSERT INTO configuracoes_sistema (chave, valor, eh_secreto) VALUES
  ('nome_portal',          '"CGID - Centro de Governança e Inteligência de Dados"', 0),
  ('ambiente',             '"desenvolvimento"',                                      0),
  ('pbi_client_id',        '""',                                                    0),
  ('pbi_tenant_id',        '""',                                                    0),
  ('pbi_workspace_id',     '""',                                                    0),
  ('pbi_client_secret',    '""',                                                    1),  -- SECRETO
  ('pbi_integracao_ativa', 'false',                                                 0);
```

### 8.5 Workspaces e relatórios de exemplo

```sql
-- Workspaces (4)
INSERT INTO espacos_trabalho (id, nome, icone, cor, descricao) VALUES
  ('<uuid>', 'Administrativo', 'fa-solid fa-building',   '#2563eb', 'Relatórios administrativos e RH'),
  ('<uuid>', 'Controladoria',  'fa-solid fa-chart-line', '#16a34a', 'Relatórios financeiros e de controladoria'),
  ('<uuid>', 'Marketing',      'fa-solid fa-bullhorn',   '#d97706', 'Relatórios de marketing e performance'),
  ('<uuid>', 'SAC',            'fa-solid fa-headset',    '#dc2626', 'Relatórios de atendimento ao cliente');

-- Relatórios (12)
-- Administrativo
INSERT INTO relatorios (id, nome, espaco_trabalho_id, categoria, status) VALUES
  ('<uuid>', 'Headcount Mensal',         '<id-administrativo>', 'Operacional', 'publicado'),
  ('<uuid>', 'Turnover 2025',            '<id-administrativo>', 'Estratégico', 'publicado');
-- Controladoria
INSERT INTO relatorios (id, nome, espaco_trabalho_id, categoria, status) VALUES
  ('<uuid>', 'DRE Consolidado',          '<id-controladoria>', 'Financeiro',  'publicado'),
  ('<uuid>', 'Fluxo de Caixa',           '<id-controladoria>', 'Financeiro',  'publicado'),
  ('<uuid>', 'Budget vs Realizado',      '<id-controladoria>', 'Financeiro',  'publicado'),
  ('<uuid>', 'Análise de Margem',        '<id-controladoria>', 'Financeiro',  'rascunho');
-- Marketing
INSERT INTO relatorios (id, nome, espaco_trabalho_id, categoria, status) VALUES
  ('<uuid>', 'Performance de Campanhas', '<id-marketing>', 'Operacional',  'publicado'),
  ('<uuid>', 'Funil de Leads',           '<id-marketing>', 'Estratégico',  'publicado'),
  ('<uuid>', 'CAC e LTV',                '<id-marketing>', 'Estratégico',  'publicado');
-- SAC
INSERT INTO relatorios (id, nome, espaco_trabalho_id, categoria, status) VALUES
  ('<uuid>', 'Volume de Chamados',       '<id-sac>', 'Operacional',  'publicado'),
  ('<uuid>', 'NPS Mensal',               '<id-sac>', 'Estratégico',  'publicado'),
  ('<uuid>', 'Tempo Médio de Resposta',  '<id-sac>', 'Operacional',  'publicado');
```

---

## 9. Ordem Correta de Execução

A ordem é ditada pelas dependências de chave estrangeira:

```
ETAPA 1 — Tabelas sem dependências externas
  ├── usuarios              (FK self-referencial — criada mas pode ser adicionada depois)
  ├── permissoes_perfil     (standalone)
  ├── regras_expediente     (standalone)
  ├── logs_auditoria        (standalone — sem FK intencional)
  └── historico_config_critica (standalone — sem FK intencional)

ETAPA 2 — Tabelas dependentes apenas de usuarios
  ├── sessoes_autenticacao  (→ usuarios)
  ├── espacos_trabalho      (→ usuarios)
  ├── sobrescritas_permissao (→ usuarios x2)
  ├── grupos_excecao        (→ usuarios)
  └── configuracoes_sistema (→ usuarios)

ETAPA 3 — Tabelas dependentes de espacos_trabalho E usuarios
  └── relatorios            (→ espacos_trabalho, → usuarios)

ETAPA 4 — Tabelas dependentes de relatorios/espacos_trabalho/grupos_excecao
  ├── acessos_workspace     (→ usuarios, → espacos_trabalho)
  ├── acessos_relatorio     (→ usuarios, → relatorios)
  ├── favoritos             (→ usuarios, → relatorios)
  └── membros_grupo_excecao (→ grupos_excecao, → usuarios)

ETAPA 5 — Seeds (dados obrigatórios)
  ├── permissoes_perfil     (45 linhas — sem dependência)
  ├── regras_expediente     (7 linhas — sem dependência)
  ├── configuracoes_sistema (7 chaves — sem dependência)
  ├── usuarios              (4 usuários de demonstração)
  ├── espacos_trabalho      (4 workspaces — depende de usuarios)
  └── relatorios            (12 relatórios — depende de espacos_trabalho)
```

**Por que essa ordem é obrigatória?**  
Se tentar criar `relatorios` antes de `espacos_trabalho`, a FK `espaco_trabalho_id` falhará porque a tabela referenciada ainda não existe. O SQLite tem suporte parcial a FKs (requer `PRAGMA foreign_keys = ON`), mas o SQL Server valida na criação do schema.

---

## 10. Passo a Passo: Criar o Banco do Zero

### Pré-requisitos

```bash
# Python 3.12+
python --version

# Instalar dependências
cd backend
pip install -r requirements.txt
```

### Modo Desenvolvimento (SQLite — automático)

```bash
# 1. Instalar dependências
cd backend
pip install -r requirements.txt

# 2. Criar e popular o banco (inclui criação das tabelas + seeds)
python seed.py
# Saída esperada:
# Inserindo usuários...
# Inserindo permissões por perfil...
# Inserindo regras de expediente...
# Inserindo configurações do sistema...
# Inserindo workspaces e relatórios de exemplo...
# ✓ Banco criado e populado com sucesso.

# 3. Verificar que o arquivo foi criado
ls -la cgid.db  # deve existir

# 4. Iniciar o servidor
uvicorn main:app --reload
# Acesse: http://localhost:8000/docs
```

### Modo Produção (SQL Server)

```bash
# 1. Criar o banco de dados no SQL Server (executar como DBA)
# sqlcmd -S <servidor> -U <usuario> -P <senha>
CREATE DATABASE cgid
    COLLATE Latin1_General_CI_AS;
GO

# 2. Ajustar backend/database.py para SQL Server
# Substitua a linha DATABASE_URL por:
DATABASE_URL = (
    "mssql+pyodbc://<usuario>:<senha>@<servidor>/<banco>"
    "?driver=ODBC+Driver+17+for+SQL+Server"
)

# 3. Instalar driver ODBC
# Windows: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
# Linux: sudo apt install unixodbc-dev msodbcsql17

# 4. Executar seed (criará tabelas + dados iniciais)
python seed.py

# 5. Criar trigger de imutabilidade em logs_auditoria
# (executar no SQL Server Management Studio ou sqlcmd)
# Veja seção 7.4

# 6. Iniciar o servidor
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Validação pós-criação

```bash
# Via Python/SQLite — verificar tabelas criadas
python -c "
import sqlite3
conn = sqlite3.connect('cgid.db')
tables = conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()
print('Tabelas criadas:', [t[0] for t in tables])
conn.close()
"
# Esperado: 15 tabelas

# Verificar usuários criados
python -c "
import sqlite3
conn = sqlite3.connect('cgid.db')
users = conn.execute('SELECT nome, email, perfil FROM usuarios').fetchall()
for u in users: print(u)
conn.close()
"

# Via API REST (servidor rodando)
curl http://localhost:8000/docs          # Swagger UI
curl -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cgid.com","senha":"Admin@2025"}'
# Esperado: {"access_token": "...", "token_type": "bearer"}
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

### `backend/.env` (opcional — para integração Power BI)

```env
PBI_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_SECRET=sua-chave-secreta-aqui
```

> As credenciais PBI também ficam armazenadas na tabela `configuracoes_sistema` e são lidas em runtime pelo backend.

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

> As credenciais PBI também ficam armazenadas na tabela `configuracoes_sistema` e são lidas em runtime pelo `main.py` via `GET /configuracoes/pbi`. As variáveis de ambiente `PBI_TENANT_ID`, `PBI_CLIENT_ID` e `PBI_CLIENT_SECRET` definidas em `.env` sobrescrevem os valores do banco apenas se carregadas via `os.getenv()` no startup — na implementação atual o backend prioriza os valores do banco.

---

## 12. Possíveis Erros e Soluções

### `OperationalError: no such table: usuarios`

**Causa:** O banco ainda não foi criado.  
**Solução:**
```bash
cd backend && python seed.py
```

---

### `IntegrityError: UNIQUE constraint failed: usuarios.email`

**Causa:** Tentativa de inserir dois usuários com o mesmo e-mail.  
**Solução:** Verifique se o `seed.py` já foi executado (ele usa upsert). Para reiniciar do zero:
```bash
cd backend && rm cgid.db && python seed.py
```

---

### `IntegrityError: UNIQUE constraint failed: permissoes_perfil.perfil, modulo`

**Causa:** O `seed.py` foi executado duas vezes em modo não-idempotente.  
**Solução:** O script atual já usa upsert — não deve ocorrer. Se ocorrer, reinicie o banco.

---

### `sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) unable to open database file`

**Causa:** Permissão negada ou diretório inexistente.  
**Solução:**
```bash
ls -la backend/   # verificar permissões
chmod 755 backend/
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
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
apt-get install msodbcsql17
```

---

### `bcrypt: (trapped) error reading bcrypt version`

**Causa:** Incompatibilidade de versão do `passlib` com `bcrypt` recente.  
**Solução:**
```bash
pip install 'passlib[bcrypt]' 'bcrypt==4.0.1'
```

---

### Banco criado mas sem dados (tabelas vazias)

**Causa:** `main.py` cria as tabelas mas não insere seeds.  
**Solução:** Executar explicitamente:
```bash
cd backend && python seed.py
```

---

### Campos `atualizado_em` não sendo atualizados automaticamente (SQLite)

**Causa:** SQLite não suporta `ON UPDATE CURRENT_TIMESTAMP` nativamente. O SQLAlchemy usa `onupdate=func.now()`, que funciona apenas quando o objeto é atualizado via ORM (não por SQL direto).  
**Solução:** Sempre use a sessão SQLAlchemy para atualizações. Para SQL direto, atualize `atualizado_em` explicitamente:
```sql
UPDATE usuarios SET nome = 'Novo Nome', atualizado_em = CURRENT_TIMESTAMP WHERE id = '...';
```

---

*Documentação gerada a partir do código-fonte em `backend/models.py` e `backend/seed.py`. Para manter esta documentação atualizada, revise-a sempre que houver alterações no schema.*

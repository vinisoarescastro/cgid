# Modelagem de Entidades e Banco de Dados

> **Documento:** 05-modelagem/04-entidades-e-banco-de-dados.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Diagrama de Entidades (Relacionamentos)

```
users
  ├── user_workspace_access (N:M com workspaces)
  ├── user_report_access    (N:M com reports)
  ├── user_permission_overrides (1:N)
  ├── exception_group_members (N:M com exception_groups)
  ├── favorites (1:N com reports)
  └── audit_logs (1:N — autor dos eventos)

workspaces
  ├── reports (1:N)
  ├── user_workspace_access (N:M com users)
  └── workspace_pbi_permissions (1:N)

reports
  ├── user_report_access (N:M com users)
  └── favorites (1:N)

role_permissions
  └── Permissões padrão por perfil (role × module × actions)

exception_groups
  ├── exception_group_members (1:N)
  └── access_exceptions (1:N)

schedule_rules
  └── Uma por dia da semana (7 registros)

system_settings
  └── Configurações globais (chave-valor)

audit_logs
  └── Append-only; sem relações FK para preservar histórico após exclusões
```

---

## 2. Definição das Tabelas

### Tabela: `users`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|-----------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `name` | VARCHAR(255) | NOT NULL | Nome completo |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | E-mail corporativo |
| `password_hash` | VARCHAR(255) | NOT NULL | Hash bcrypt |
| `role` | ENUM | NOT NULL | super_admin, admin, manager, operator, visitor |
| `status` | ENUM | NOT NULL, DEFAULT 'active' | active, inactive, blocked |
| `login_attempts` | SMALLINT | DEFAULT 0 | Contador de tentativas falhas |
| `last_login` | TIMESTAMPTZ | NULL | Último login bem-sucedido |
| `mfa_enabled` | BOOLEAN | DEFAULT false | MFA ativado para o usuário |
| `mfa_secret` | VARCHAR(255) | NULL | Secret TOTP (criptografado) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Data da última atualização |
| `created_by` | UUID | FK → users(id), NULL | Quem criou o usuário |

```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'manager', 'operator', 'visitor');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'blocked');

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            user_role NOT NULL DEFAULT 'operator',
  status          user_status NOT NULL DEFAULT 'active',
  login_attempts  SMALLINT NOT NULL DEFAULT 0,
  last_login      TIMESTAMPTZ,
  mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
  mfa_secret      VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

---

### Tabela: `workspaces`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|-----------|-----------|
| `id` | UUID | PK | Identificador único |
| `name` | VARCHAR(255) | NOT NULL, UNIQUE | Nome do workspace |
| `pbi_workspace_id` | VARCHAR(255) | NULL | ID do workspace no Power BI Service |
| `status` | ENUM | NOT NULL, DEFAULT 'active' | active, inactive |
| `icon` | VARCHAR(100) | NULL | Classe Font Awesome |
| `color` | VARCHAR(20) | NULL | Cor hex |
| `description` | TEXT | NULL | Descrição |
| `created_at` | TIMESTAMPTZ | NOT NULL | — |
| `created_by` | UUID | FK → users(id) | — |

```sql
CREATE TABLE workspaces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL UNIQUE,
  pbi_workspace_id  VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'active',
  icon              VARCHAR(100),
  color             VARCHAR(20),
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL
);
```

---

### Tabela: `reports`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|-----------|-----------|
| `id` | UUID | PK | Identificador único |
| `name` | VARCHAR(255) | NOT NULL | Nome do relatório |
| `workspace_id` | UUID | FK → workspaces(id), NOT NULL | Workspace pai |
| `pbi_report_id` | VARCHAR(255) | NULL | ID no Power BI Service |
| `category` | VARCHAR(100) | NULL | Financeiro, Operacional, Estratégico |
| `status` | ENUM | NOT NULL, DEFAULT 'published' | published, draft, archived |
| `description` | TEXT | NULL | Descrição |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Última atualização |
| `created_at` | TIMESTAMPTZ | NOT NULL | — |
| `created_by` | UUID | FK → users(id) | — |

```sql
CREATE TABLE reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pbi_report_id  VARCHAR(255),
  category       VARCHAR(100),
  status         VARCHAR(20) NOT NULL DEFAULT 'published',
  description    TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_reports_workspace ON reports(workspace_id);
CREATE INDEX idx_reports_status ON reports(status);
```

---

### Tabela: `user_workspace_access`

| Coluna | Tipo | Restrições | Descrição |
|--------|------|-----------|-----------|
| `id` | UUID | PK | — |
| `user_id` | UUID | FK → users(id), NOT NULL | — |
| `workspace_id` | UUID | FK → workspaces(id), NOT NULL | — |
| `access_level` | ENUM | NOT NULL | full (workspace inteiro), reports_only, none |
| `granted_by` | UUID | FK → users(id) | Quem concedeu |
| `granted_at` | TIMESTAMPTZ | NOT NULL | — |

```sql
CREATE TABLE user_workspace_access (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  access_level  VARCHAR(20) NOT NULL DEFAULT 'reports_only',
  granted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);
```

---

### Tabela: `user_report_access`

```sql
CREATE TABLE user_report_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, report_id)
);
```

---

### Tabela: `role_permissions`

```sql
CREATE TABLE role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role        user_role NOT NULL,
  module      VARCHAR(100) NOT NULL,
  can_view    BOOLEAN NOT NULL DEFAULT false,
  can_create  BOOLEAN NOT NULL DEFAULT false,
  can_edit    BOOLEAN NOT NULL DEFAULT false,
  can_delete  BOOLEAN NOT NULL DEFAULT false,
  can_export  BOOLEAN NOT NULL DEFAULT false,
  can_manage  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role, module)
);
```

---

### Tabela: `user_permission_overrides`

```sql
CREATE TABLE user_permission_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module      VARCHAR(100) NOT NULL,
  can_view    BOOLEAN,   -- NULL = herda do perfil; true/false = override
  can_create  BOOLEAN,
  can_edit    BOOLEAN,
  can_delete  BOOLEAN,
  can_export  BOOLEAN,
  can_manage  BOOLEAN,
  set_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  set_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, module)
);
```

---

### Tabela: `schedule_rules`

```sql
CREATE TABLE schedule_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week     SMALLINT NOT NULL, -- 0=Dom, 1=Seg, ..., 6=Sáb
  start_time      TIME NOT NULL DEFAULT '08:00',
  end_time        TIME NOT NULL DEFAULT '18:00',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  block_outside   BOOLEAN NOT NULL DEFAULT true, -- bloquear fora do expediente?
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(day_of_week)
);
```

---

### Tabela: `exception_groups`

```sql
CREATE TABLE exception_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  off_hours     BOOLEAN NOT NULL DEFAULT true,
  window_start  TIME,    -- janela de horário da exceção
  window_end    TIME,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE exception_group_members (
  group_id  UUID NOT NULL REFERENCES exception_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);
```

---

### Tabela: `access_exceptions` (exceções individuais)

```sql
CREATE TABLE access_exceptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(20) NOT NULL, -- 'user' ou 'group'
  entity_id     UUID NOT NULL,
  window_start  TIME NOT NULL,
  window_end    TIME NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Tabela: `favorites`

```sql
CREATE TABLE favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, report_id)
);
```

---

### Tabela: `audit_logs`

> **CRÍTICO:** Esta tabela é append-only. Nenhum UPDATE ou DELETE deve ser permitido. Implementar via trigger ou política RLS no banco.

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       UUID,           -- NULL para eventos de sistema
  user_name     VARCHAR(255),   -- snapshot imutável do nome
  user_email    VARCHAR(255),   -- snapshot imutável do e-mail
  event_type    VARCHAR(50) NOT NULL, -- auth | user | permission | access | report | security | system
  module        VARCHAR(100) NOT NULL,
  detail        TEXT NOT NULL,
  ip_address    INET,
  previous_val  JSONB,          -- estado anterior (para alterações)
  new_val       JSONB           -- novo estado (para alterações)
);

-- Índices para performance nas consultas
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id   ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_type      ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_module    ON audit_logs(module);

-- Trigger para impedir UPDATE e DELETE
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs são imutáveis: UPDATE e DELETE não são permitidos';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

---

### Tabela: `system_settings`

```sql
CREATE TABLE system_settings (
  key         VARCHAR(255) PRIMARY KEY,
  value       TEXT NOT NULL,    -- JSON criptografado para segredos
  is_secret   BOOLEAN DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Registros iniciais
INSERT INTO system_settings (key, value) VALUES
  ('portal_name', '"BrasilTerrenos"'),
  ('environment', '"production"'),
  ('pbi_client_id', '""'),
  ('pbi_tenant_id', '""'),
  ('pbi_workspace_id', '""'),
  ('pbi_client_secret', '""'),  -- criptografado
  ('pbi_integration_active', 'false');
```

---

## 3. Diagrama de Relacionamentos Resumido

```
users 1──────N user_workspace_access N──────1 workspaces
  │                                               │
  │                                              1│
  │                                               │
  N user_report_access N────────────────────── reports
  │
  1──────N user_permission_overrides
  │
  N exception_group_members N──────1 exception_groups
  │
  1──────N favorites N──────1 reports
  │
  1──────N audit_logs (snapshot, sem FK real para integridade histórica)

role_permissions (standalone — sem FK para users)
schedule_rules   (standalone — regra global)
access_exceptions (standalone — exceções por entity_id)
system_settings  (standalone — configurações chave-valor)
```

---

## 4. Estratégia de Migração

- Usar **Prisma Migrate** ou **Flyway** para versionamento de schema
- Nomenclatura de migrations: `V{numero}__{descricao}.sql`
- Toda migration deve ter script de rollback (`undo`)
- Seed de desenvolvimento com dados representativos baseados no mock do protótipo
- Seed de produção apenas com Super Admin inicial e permissões padrão por perfil

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
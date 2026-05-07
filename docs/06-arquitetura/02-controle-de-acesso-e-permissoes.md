# Controle de Acesso e Permissões

> **Documento:** 06-arquitetura/02-controle-de-acesso-e-permissoes.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Modelo de Controle de Acesso

O sistema adota um modelo **RBAC (Role-Based Access Control)** com extensão de **overrides individuais**:

```
Perfil (role)
  └── Permissões padrão (role_permissions)
        └── Override por usuário (user_permission_overrides) ← Sobrepõe
              └── Permissão final aplicada ao usuário
```

**Regra de precedência:** Permissão individual (override) sobrepõe permissão de perfil. Se o campo do override for `NULL`, herda do perfil. Se for `true` ou `false`, sobrepõe.

---

## 2. Hierarquia de Perfis

```
Super Admin   (nível 5) → Acesso irrestrito, incluindo configurações do sistema
    ↓
Admin         (nível 4) → Gestão de usuários, permissões, workspaces (não pode alterar Super Admin)
    ↓
Gerente       (nível 3) → Visualização de relatórios do(s) seu(s) workspace(s) + KPIs da equipe
    ↓
Operador      (nível 2) → Visualização dos relatórios explicitamente liberados para ele
    ↓
Visitante     (nível 1) → Acesso read-only temporário, apenas relatórios autorizados
```

**Regra:** Um perfil não pode alterar permissões de outro perfil de nível igual ou superior.

---

## 3. Matriz de Permissões por Módulo e Perfil

### Legenda
- ✅ Permitido por padrão
- ❌ Negado
- ⚠️ Parcial (somente próprio registro ou contexto limitado)
- 🔧 Configurável por Admin

### 3.1 Gestão de Acesso (Módulos Administrativos)

| Módulo | Ação | Super Admin | Admin | Gerente | Operador | Visitante |
|--------|------|:-----------:|:-----:|:-------:|:--------:|:---------:|
| **Usuários** | Visualizar | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Criar | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Editar | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Bloquear/Desbloquear | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Excluir | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Permissões** | Visualizar | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Editar (por perfil) | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Editar (Super Admin) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Workspaces (admin)** | CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Grupos de Exceção** | CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Expediente** | Visualizar | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Editar | ✅ | ✅ | ❌ | ❌ | ❌ |

### 3.2 Auditoria e Segurança

| Módulo | Ação | Super Admin | Admin | Gerente | Operador | Visitante |
|--------|------|:-----------:|:-----:|:-------:|:--------:|:---------:|
| **Logs de Auditoria** | Visualizar (todos) | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Visualizar (próprios) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Exportar | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Segurança** | Visualizar checklist | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Ver eventos suspeitos | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Configurações** | Visualizar | ✅ | ❌ | ❌ | ❌ | ❌ |
| | Editar | ✅ | ❌ | ❌ | ❌ | ❌ |

### 3.3 Consumo (Relatórios e Workspaces)

| Módulo | Ação | Super Admin | Admin | Gerente | Operador | Visitante |
|--------|------|:-----------:|:-----:|:-------:|:--------:|:---------:|
| **Home/Dashboard** | Visualizar (admin view) | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Visualizar (user view) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Workspaces** | Ver todos | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| | Ver apenas autorizados | — | — | ✅ | ✅ | ✅ |
| **Relatórios** | Ver publicados autorizados | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Ver rascunhos | ✅ | ✅ | ✅ | ❌ | ❌ |
| | Criar | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Editar | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Excluir | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Favoritos** | Gerenciar próprios | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Painel Gerencial** | Visualizar | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 4. Permissões de Acesso Power BI

O acesso a relatórios PBI tem uma camada adicional além do RBAC dos módulos:

| Nível | Descrição | Como configurar |
|-------|-----------|----------------|
| `full` | Acesso a todos os relatórios do workspace | Na associação user_workspace_access: `access_level = 'full'` |
| `reports_only` | Acesso apenas a relatórios específicos | `access_level = 'reports_only'` + registros em user_report_access |
| `none` | Sem acesso ao workspace | Não criar registro em user_workspace_access |

---

## 5. Implementação dos Guards no NestJS

### JwtAuthGuard
```typescript
// Valida se o token JWT é válido e não expirado
// Valida se o token não está na blocklist do Redis (logout)
// Carrega o usuário do banco e injeta no request
```

### RolesGuard
```typescript
// Verifica se o perfil do usuário tem permissão para acessar o endpoint
// Usado com @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
```

### PermissionsGuard
```typescript
// Verifica permissão granular (módulo × ação)
// Consulta: role_permissions + user_permission_overrides
// Cache Redis para performance (TTL 5 min; invalidado ao alterar permissões)
// Usado com @RequirePermission('users', 'edit')
```

### ScheduleGuard
```typescript
// Verifica se o usuário pode acessar com base no horário de expediente
// Consultado a cada requisição autenticada
// Verifica: schedule_rules + exception_groups + access_exceptions
```

---

## 6. Algoritmo de Resolução de Permissão

```typescript
async function resolvePermission(
  userId: string,
  module: string,
  action: string
): Promise<boolean> {

  // 1. Carregar usuário e seu perfil
  const user = await userRepo.findById(userId);

  // 2. Super Admin e Admin: acesso irrestrito
  if (user.role === 'super_admin' || user.role === 'admin') {
    return true;
  }

  // 3. Verificar override individual primeiro (precedência)
  const override = await permOverrideRepo.findByUserAndModule(userId, module);
  if (override && override[action] !== null) {
    return override[action]; // true ou false — override definitivo
  }

  // 4. Fallback para permissão do perfil
  const rolePermission = await rolePermRepo.findByRoleAndModule(user.role, module);
  return rolePermission?.[action] ?? false;
}
```

---

## 7. Controle de Acesso a Relatórios PBI

```typescript
async function canAccessReport(
  userId: string,
  reportId: string
): Promise<boolean> {

  const user = await userRepo.findById(userId);

  // Admins têm acesso irrestrito
  if (user.role === 'super_admin' || user.role === 'admin') return true;

  const report = await reportRepo.findById(reportId);

  // Relatórios draft: apenas manager+
  if (report.status === 'draft' && user.role === 'operator') return false;

  // Verificar acesso ao workspace
  const wsAccess = await userWsAccessRepo.find(userId, report.workspaceId);
  if (!wsAccess) return false;

  // Acesso total ao workspace
  if (wsAccess.access_level === 'full') return true;

  // Acesso apenas a relatórios específicos
  if (wsAccess.access_level === 'reports_only') {
    return userReportAccessRepo.exists(userId, reportId);
  }

  return false;
}
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |
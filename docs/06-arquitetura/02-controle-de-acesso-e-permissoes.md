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
| **Logs de Auditoria** | Visualizar (todos) | ✅ | ❌ | ❌ | ❌ | ❌ |
| | Visualizar (próprios) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Exportar | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Segurança** | Visualizar checklist | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Ver eventos suspeitos | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Configurações** | Visualizar | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Editar expediente e grupos de exceção | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Editar credenciais Power BI | ✅ | ❌ | ❌ | ❌ | ❌ |

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
| `total` | Acesso a todos os relatórios do workspace | Na tabela `acessos_workspace`: `nivel_acesso = 'total'` |
| `apenas_relatorios` | Acesso apenas a relatórios específicos | `nivel_acesso = 'apenas_relatorios'` + registros em `acessos_relatorio` |
| `nenhum` | Sem acesso ao workspace | Não criar registro em `acessos_workspace` ou usar `nivel_acesso = 'nenhum'` |

Para usuários com `apenas_relatorios`, a listagem de relatórios é filtrada no backend. O endpoint `GET /workspaces/{workspace_id}/relatorios?usuario_id={usuario_id}` retorna somente relatórios publicados que tenham vínculo em `acessos_relatorio`.

Admins podem alterar a lista de relatórios específicos por `PUT /workspaces/{workspace_id}/usuarios/{usuario_id}/relatorios`, enviando `relatorio_ids`. Alterar o nível para `apenas_relatorios` não concede relatórios automaticamente.

---

## 5. Implementação das Dependências/Guards no FastAPI

### obter_usuario_atual
```python
# Valida se o token JWT é válido e não expirado
# Valida se a sessão vinculada ao token ainda está ativa no SQL Server
# Carrega o usuário do banco e injeta na rota
```

### exigir_perfil
```python
# Verifica se o perfil do usuário tem permissão para acessar o endpoint
# Usado como Depends(exigir_perfil("administrador", "super_administrador"))
```

### exigir_permissao
```python
# Verifica permissão granular (módulo × ação)
# Consulta: permissoes_perfil + sobrescritas_permissao
# Cache pode ser feito em memória/TanStack Query no frontend; a fonte da verdade é o SQL Server
# Usado como Depends(exigir_permissao("usuarios", "editar"))
```

### validar_expediente
```python
# Verifica se o usuário pode acessar com base no horário de expediente
# Consultado a cada requisição autenticada
# Admins e super_admins: acesso irrestrito (retorna imediatamente sem checar expediente)
# Fluxo para demais perfis:
#   1. Busca regra do dia atual (sem filtro ativo=True — busca sempre)
#   2. Se não existe regra → configurado=False (acesso liberado)
#   3. Se ativo=False (dia bloqueado):
#      → Verifica se usuário pertence a grupo com ignora_dia_inativo=True
#      → SIM: retorna dentro_expediente=True, excecao_ativa=True, hora_inicio=None
#      → NÃO: retorna dia_inativo=True, dentro_expediente=False
#   4. Se bloquear_fora=False → dentro_expediente=True (não obrigatório)
#   5. Se within(hora_inicio, hora_fim) → dentro_expediente=True
#   6. Caso contrário: verifica grupos_excecao com fora_horario=True
#      → Se janela definida: verifica janela_inicio/fim
#      → Se dentro da janela: excecao_ativa=True, retorna dentro_expediente=True
#      → Fora da janela ou sem grupo: dentro_expediente=False
```

---

## 6. Algoritmo de Resolução de Permissão

```python
def resolver_permissao(usuario_id: str, modulo: str, acao: str) -> bool:

  # 1. Carregar usuário e seu perfil
  usuario = repositorio_usuarios.buscar_por_id(usuario_id)

  # 2. Super Admin e Admin: acesso irrestrito
  if usuario.perfil in ("super_administrador", "administrador"):
      return True

  # 3. Verificar override individual primeiro (precedência)
  sobrescrita = repositorio_sobrescritas.buscar_por_usuario_modulo(usuario_id, modulo)
  if sobrescrita and getattr(sobrescrita, acao) is not None:
      return getattr(sobrescrita, acao)  # True ou False — override definitivo

  # 4. Fallback para permissão do perfil
  permissao_perfil = repositorio_permissoes.buscar_por_perfil_modulo(usuario.perfil, modulo)
  return getattr(permissao_perfil, acao, False) if permissao_perfil else False
```

---

## 7. Controle de Acesso a Relatórios PBI

```python
def pode_acessar_relatorio(usuario_id: str, relatorio_id: str) -> bool:

  usuario = repositorio_usuarios.buscar_por_id(usuario_id)

  # Admins têm acesso irrestrito
  if usuario.perfil in ("super_administrador", "administrador"):
      return True

  relatorio = repositorio_relatorios.buscar_por_id(relatorio_id)

  # Relatórios rascunho: apenas gerente+
  if relatorio.status == "rascunho" and usuario.perfil in ("operador", "visitante"):
      return False

  # Verificar acesso ao workspace
  acesso_workspace = repositorio_acessos_workspace.buscar(usuario_id, relatorio.espaco_trabalho_id)
  if not acesso_workspace:
      return False

  # Acesso total ao workspace
  if acesso_workspace.nivel_acesso == "total":
      return True

  # Acesso apenas a relatórios específicos
  if acesso_workspace.nivel_acesso == "apenas_relatorios":
      return repositorio_acessos_relatorio.existe(usuario_id, relatorio_id)

  return False
```

---

## 8. Vinculação Automática de Admins a Workspaces

Ao criar ou reativar um workspace, o sistema executa `_vincular_admins_workspace(workspace_id, db)`, que itera todos os usuários com perfil `administrador` ou `super_administrador` com status `ativo` e cria registros em `acessos_workspace` com `nivel_acesso = "total"` para os que ainda não possuem vínculo.

- Admins nunca precisam ser vinculados manualmente a workspaces novos ou reativados.
- Apesar de terem registros em `acessos_workspace`, eles **não aparecem na listagem de usuários do workspace** — a query filtra `perfil NOT IN ('administrador', 'super_administrador')`.
- O contador de usuários no card do workspace também exclui admins.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1 | Junho/2026 | Vinicius Soares | Atualizada matriz: Configurações para Admin/Super Admin, credenciais PBI exclusivas do Super Admin e filtro server-side para relatórios específicos |
| 1.2 | Junho/2026 | Vinicius Soares | Corrigida matriz de Auditoria: "Visualizar (todos)" e "Exportar" são exclusivos do Super Admin (RN-AUD-05); pseudocódigo `validar_expediente` atualizado com `ativo=false`, `ignora_dia_inativo` e janelas de exceção; adicionada seção 8 sobre auto-vínculo de admins a workspaces |

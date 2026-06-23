# Controle de Acesso e Permissões

> **Documento:** 06-arquitetura/02-controle-de-acesso-e-permissoes.md  
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** Junho/2026

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

> **Nota:** Esta matriz representa os **valores padrão** do seed inicial. A partir da versão 1.3, todos os valores são configuráveis em tempo de execução pela interface em **Configurações → Permissões** (restrito ao Super Admin). Sobrescritas por usuário individual também são suportadas via painel em **Usuários → editar usuário → Permissões individuais**.

### Legenda
- ✅ Permitido por padrão
- ❌ Negado por padrão
- ⚠️ Parcial (somente próprio registro ou contexto limitado)
- 🔧 Configurável pelo Super Admin em tempo de execução

### 3.1 Módulos Administrativos

| Módulo | Super Admin | Admin | Gerente | Operador | Visitante |
|--------|:-----------:|:-----:|:-------:|:--------:|:---------:|
| **Usuários** | ✅ todas as ações | ✅ todas | ❌ | ❌ | ❌ |
| **Permissões** | ✅ todas | ✅ (sem excluir) | ❌ | ❌ | ❌ |
| **Workspaces** | ✅ todas | ✅ todas | ❌ | ❌ | ❌ |
| **Grupos de Exceção** | ✅ todas | ✅ todas | ❌ | ❌ | ❌ |
| **Expediente** | ✅ todas | ✅ todas | ❌ | ❌ | ❌ |
| **Configurações** | ✅ todas | ✅ (sem excluir/gerenciar) | ❌ | ❌ | ❌ |

### 3.2 Auditoria e Segurança

| Módulo | Super Admin | Admin | Gerente | Operador | Visitante |
|--------|:-----------:|:-----:|:-------:|:--------:|:---------:|
| **Auditoria** | ✅ todas | ✅ todas | ❌ 🔧 | ❌ | ❌ |
| **Segurança** | ✅ todas | ✅ todas | ❌ | ❌ | ❌ |

### 3.3 Consumo

| Módulo | Super Admin | Admin | Gerente | Operador | Visitante |
|--------|:-----------:|:-----:|:-------:|:--------:|:---------:|
| **Relatórios** | ✅ todas | ✅ todas | ✅ visualizar + exportar | ✅ visualizar | ✅ visualizar |
| **Land Bank** | ✅ todas | ✅ visualizar + exportar | ❌ 🔧 | ❌ | ❌ |

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

## 5. Implementação das Dependências/Guards

### Backend (FastAPI)

#### get_usuario_requisicao
```python
# Lê o header X-Usuario-Id da requisição
# Valida sessão ativa via X-Session-Token
# Retorna o objeto Usuario ou None
```

#### checar_permissao / exigir_permissao
```python
# checar_permissao(usuario, modulo, acao, db) -> bool
#   1. super_administrador → True imediato (bypass)
#   2. Consulta SobrescritaPermissao (usuario_id, modulo) — se campo != None, usa override
#   3. Consulta PermissaoPerfil (perfil, modulo) — fallback ao padrão do perfil
#   4. Sem registro → False (fail-safe)
#
# exigir_permissao(usuario, modulo, acao, db)
#   → eleva HTTPException 403 se checar_permissao retornar False
```

#### _garantir_permissoes_default
```python
# Chamado no startup do servidor (@app.on_event("startup"))
# Popula permissoes_perfil com a matriz padrão caso ainda não existam registros
# Idempotente: só insere o que não existe (não sobrescreve valores editados via UI)
```

### Frontend

#### temPermissao(modulo, acao) — utils/api.js
```js
// Lê cgid_permissoes do sessionStorage (carregado no login)
// Retorna perms[modulo]?.[acao] ?? false
// Usado em guards de página (useEffect) e no Sidebar para exibir/ocultar itens
```

#### carregarPermissoes() — utils/api.js
```js
// Chama GET /api/me/permissoes após login bem-sucedido
// Salva resultado em sessionStorage como cgid_permissoes
// Também limpo no logout
```

#### Endpoint GET /api/me/permissoes
```
Retorna as permissões efetivas do usuário logado para todos os módulos,
já aplicando sobrescritas individuais. Formato:
{ "auditoria": { "visualizar": true, "criar": false, ... }, ... }
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
def checar_permissao(usuario, modulo, acao, db) -> bool:

    # 1. super_administrador tem acesso irrestrito sempre
    if usuario.perfil == "super_administrador":
        return True

    campo = f"pode_{acao}"  # "visualizar" → "pode_visualizar"

    # 2. Verificar override individual (precedência sobre o perfil)
    sobrescrita = db.query(SobrescritaPermissao).filter_by(
        usuario_id=usuario.id, modulo=modulo
    ).first()
    if sobrescrita:
        valor = getattr(sobrescrita, campo)
        if valor is not None:
            return valor  # True ou False — override definitivo

    # 3. Fallback para permissão do perfil
    pp = db.query(PermissaoPerfil).filter_by(
        perfil=usuario.perfil, modulo=modulo
    ).first()
    if pp:
        return bool(getattr(pp, campo))

    return False  # fail-safe: sem registro = sem acesso
```

> **Nota:** Diferente da versão anterior do documento, `administrador` **não** tem bypass automático — suas permissões são controladas pela tabela `permissoes_perfil` como qualquer outro perfil, com os valores padrão do seed concedendo acesso amplo. Isso permite restringir um admin específico via sobrescrita individual.

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
| 1.3 | Junho/2026 | Vinicius Soares | Sistema de permissões implementado em produção: seed automático no startup, helpers `checar_permissao`/`exigir_permissao`, endpoints CRUD para permissões por perfil e sobrescritas por usuário, endpoint `/api/me/permissoes`, UI de gestão em Configurações → Permissões e painel de sobrescritas em Usuários. Sidebar e guards de página migrados de checks hardcoded (`isAdmin`) para `temPermissao()`. Algoritmo de resolução atualizado: `administrador` deixa de ter bypass e passa a ser controlado pelo banco. |

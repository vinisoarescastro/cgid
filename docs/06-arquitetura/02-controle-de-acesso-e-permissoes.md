# Controle de Acesso e Permissões

> **Documento:** 06-arquitetura/02-controle-de-acesso-e-permissoes.md  
> **Status:** Vigente  
> **Criado em:** Maio/2026  
> **Atualizado em:** 2026-06-25 (v2.0)

---

## 1. Modelo de Controle de Acesso

O sistema adota um modelo **RBAC (Role-Based Access Control)** com extensão via **pacotes de permissão**:

```
Perfil (role)
  └── permissoes_perfil (matriz padrão por perfil × módulo)
        └── Permissão base do perfil

Pacotes de Permissão (aditivos)
  └── pacotes_permissao → pacotes_permissao_itens
        └── Atribuídos a usuários via usuarios_pacotes
              └── Ampliam as permissões do perfil base (só concedem, nunca removem)

Resolução final:
  1. master → acesso total imediato (bypass)
  2. Permissão do perfil base (permissoes_perfil)  — se concedida, usa
  3. Permissão de algum pacote atribuído (pacotes_permissao_itens) — se concedida, usa
  4. Nenhum → false (fail-safe)
```

> **v2.0:** A tabela `sobrescritas_permissao` foi **removida**. Sobrescritas individuais foram substituídas pelos `pacotes_permissao`, que permitem criar conjuntos reutilizáveis de permissões e atribuí-los a qualquer número de usuários.

---

## 2. Hierarquia de Perfis

```
Master        (nível 5) → Acesso irrestrito, incluindo configurações do sistema
    ↓
Administrador (nível 4) → Gestão de usuários, permissões, workspaces (não pode alterar Master)
    ↓
Coordenador   (nível 3) → Visualização de relatórios do(s) seu(s) workspace(s) + KPIs da equipe
    ↓
Colaborador   (nível 2) → Visualização dos relatórios explicitamente liberados para ele
    ↓
Convidado     (nível 1) → Acesso read-only temporário, apenas relatórios autorizados
```

| Perfil | Slug no banco |
|--------|---------------|
| Master | `master` |
| Administrador | `administrador` |
| Coordenador | `coordenador` |
| Colaborador | `colaborador` |
| Convidado | `convidado` |

**Regra:** Um perfil não pode alterar permissões de outro perfil de nível igual ou superior.

---

## 3. Matriz de Permissões por Módulo e Perfil

> **Nota:** Esta matriz representa os **valores padrão** do seed inicial (`backend/services/auth_service.py → garantir_permissoes_default`). Os valores são configuráveis em tempo de execução pela interface em **Configurações → Permissões** (restrito ao Master). Permissões adicionais podem ser concedidas a usuários individuais via **Pacotes de Permissão** (seção 6).

### Legenda
- ✅ Permitido por padrão
- ❌ Negado por padrão
- ⚠️ Parcial (somente próprio registro ou contexto limitado)
- 🔧 Configurável pelo Master em tempo de execução

### 3.1 Módulos Administrativos

| Módulo | Master | Administrador | Coordenador | Colaborador | Convidado |
|--------|:------:|:-------------:|:-----------:|:-----------:|:---------:|
| **Usuários** | ✅ todas as ações | ✅ todas | ❌ | ❌ | ❌ |
| **Permissões** | ✅ todas | ✅ (sem excluir) | ❌ | ❌ | ❌ |
| **Workspaces** | ✅ todas | ✅ todas | ❌ | ❌ | ❌ |
| **Grupos de Exceção** | ✅ todas | ✅ todas | ❌ | ❌ | ❌ |
| **Expediente** | ✅ todas | ✅ todas | ❌ | ❌ | ❌ |
| **Configurações** | ✅ todas | ✅ (sem excluir/gerenciar) | ❌ | ❌ | ❌ |

### 3.2 Auditoria e Segurança

| Módulo | Master | Administrador | Coordenador | Colaborador | Convidado |
|--------|:------:|:-------------:|:-----------:|:-----------:|:---------:|
| **Auditoria** | ✅ todas | ✅ todas | ❌ 🔧 | ❌ | ❌ |
| **Segurança** | ✅ todas | ✅ todas | ❌ | ❌ | ❌ |

### 3.3 Consumo

| Módulo | Master | Administrador | Coordenador | Colaborador | Convidado |
|--------|:------:|:-------------:|:-----------:|:-----------:|:---------:|
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

### Backend (FastAPI) — `backend/dependencies.py`

#### get_usuario_requisicao
```python
# Lê o header X-Session-Token da requisição
# Calcula SHA-256 do token e valida contra sessoes_autenticacao
# Retorna o objeto Usuario ou None
```

#### checar_permissao / exigir_permissao
```python
# checar_permissao(usuario, modulo, acao, db) -> bool
#   1. master → True imediato (bypass)
#   2. Consulta PermissaoPerfil (perfil, modulo) — permissão base do perfil
#   3. Consulta pacotes atribuídos via UsuarioPacote → PacotePermissaoItem
#      → qualquer pacote que conceda o campo retorna True
#   4. Sem registro → False (fail-safe)
#
# exigir_permissao(usuario, modulo, acao, db)
#   → eleva HTTPException 403 se checar_permissao retornar False
```

#### garantir_permissoes_default — `backend/services/auth_service.py`
```python
# Chamado no startup do servidor (@app.on_event("startup"))
# Popula permissoes_perfil com a matriz padrão caso ainda não existam registros
# Idempotente: só insere o que não existe (não sobrescreve valores editados via UI)
# Também chama garantir_dados_iniciais: popula perfis e categorias_relatorio
```

### Frontend

#### temPermissao(modulo, acao) — utils/api.js
```js
// Lê cgid_permissoes do sessionStorage (carregado no login)
// Retorna perms[modulo]?.[acao] ?? false
// Usado em guards de página (useEffect) e no Sidebar para exibir/ocultar itens
```

### validar_expediente
```python
# Verifica se o usuário pode acessar com base no horário de expediente
# Consultado a cada requisição autenticada
# Master e Administrador: acesso irrestrito (retorna imediatamente sem checar expediente)
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

## 6. Pacotes de Permissão

Os pacotes (`pacotes_permissao`) são conjuntos reutilizáveis de permissões que podem ser atribuídos a usuários individualmente, **ampliando** (nunca reduzindo) as permissões do perfil base.

| Tabela | Papel |
|--------|-------|
| `pacotes_permissao` | Definição do pacote (nome, descrição) |
| `pacotes_permissao_itens` | Permissões por módulo dentro do pacote |
| `usuarios_pacotes` | Atribuição do pacote a um usuário específico |

**Casos de uso:**
- Dar acesso a `auditoria.visualizar` para um colaborador específico sem alterar o perfil
- Conceder `usuarios.gerenciar` temporariamente para um coordenador
- Agrupar múltiplas permissões temáticas (ex: "Pacote RH") e atribuir em bloco

**Gestão:** Via API endpoints em `/permissoes/pacotes` (CRUD) e `/usuarios/{id}/pacotes`.

---

## 7. Algoritmo de Resolução de Permissão (v2.0)

```python
def checar_permissao(usuario, modulo, acao, db) -> bool:

    # 1. master tem acesso irrestrito sempre
    if usuario.perfil == "master":
        return True

    campo = f"pode_{acao}"  # "visualizar" → "pode_visualizar"

    # 2. Verificar permissão base do perfil
    pp = db.query(PermissaoPerfil).filter_by(
        perfil=usuario.perfil, modulo=modulo
    ).first()
    if pp and getattr(pp, campo):
        return True

    # 3. Verificar pacotes de permissão atribuídos ao usuário
    pacote_ids = [
        up.pacote_id
        for up in db.query(UsuarioPacote).filter_by(usuario_id=usuario.id).all()
    ]
    if pacote_ids:
        itens = db.query(PacotePermissaoItem).filter(
            PacotePermissaoItem.pacote_id.in_(pacote_ids),
            PacotePermissaoItem.modulo == modulo,
        ).all()
        if any(getattr(item, campo) for item in itens):
            return True

    return False  # fail-safe: sem registro = sem acesso
```

> `administrador` **não** tem bypass automático — suas permissões são controladas pela tabela `permissoes_perfil` como qualquer outro perfil. Os valores padrão do seed concedem acesso amplo. Para ampliar pontualmente as permissões de qualquer usuário, use pacotes de permissão.

---

## 8. Controle de Acesso a Relatórios PBI

```python
def pode_acessar_relatorio(usuario_id: str, relatorio_id: str) -> bool:

  usuario = repositorio_usuarios.buscar_por_id(usuario_id)

  # Master e Administrador têm acesso irrestrito
  if usuario.perfil in ("master", "administrador"):
      return True

  relatorio = repositorio_relatorios.buscar_por_id(relatorio_id)

  # Relatórios rascunho: apenas coordenador+
  if relatorio.status == "rascunho" and usuario.perfil in ("colaborador", "convidado"):
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

## 9. Vinculação Automática de Admins a Workspaces

Ao criar ou reativar um workspace, o sistema executa `_vincular_admins_workspace(workspace_id, db)`, que itera todos os usuários com perfil `master` ou `administrador` com status `ativo` e cria registros em `acessos_workspace` com `nivel_acesso = "total"` para os que ainda não possuem vínculo.

- Admins nunca precisam ser vinculados manualmente a workspaces novos ou reativados.
- Apesar de terem registros em `acessos_workspace`, eles **não aparecem na listagem de usuários do workspace** — a query filtra `perfil NOT IN ('master', 'administrador')`.
- O contador de usuários no card do workspace também exclui admins.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1 | Junho/2026 | Vinicius Soares | Atualizada matriz: Configurações para Admin/Super Admin, credenciais PBI exclusivas do Super Admin e filtro server-side para relatórios específicos |
| 1.2 | Junho/2026 | Vinicius Soares | Corrigida matriz de Auditoria: "Visualizar (todos)" e "Exportar" são exclusivos do Super Admin (RN-AUD-05); pseudocódigo `validar_expediente` atualizado com `ativo=false`, `ignora_dia_inativo` e janelas de exceção; adicionada seção 8 sobre auto-vínculo de admins a workspaces |
| 1.3 | Junho/2026 | Vinicius Soares | Sistema de permissões implementado em produção: seed automático no startup, helpers `checar_permissao`/`exigir_permissao`, endpoints CRUD para permissões por perfil e sobrescritas por usuário, endpoint `/api/me/permissoes`, UI de gestão em Configurações → Permissões e painel de sobrescritas em Usuários. Sidebar e guards de página migrados de checks hardcoded (`isAdmin`) para `temPermissao()`. Algoritmo de resolução atualizado: `administrador` deixa de ter bypass e passa a ser controlado pelo banco. |
| 1.4 | Junho/2026 | Vinicius Soares | Renomeação dos perfis de usuário: `super_administrador` → `master`, `gerente` → `coordenador`, `operador` → `colaborador`, `visitante` → `convidado`. Labels atualizados: Master, Administrador, Coordenador, Colaborador, Convidado. Toda a documentação, código e banco de dados migrados para a nova nomenclatura. |
| 2.0 | 2026-06-25 | Vinicius Soares | **v2.0:** Remoção de `sobrescritas_permissao`. Substituída por `pacotes_permissao` (conjuntos reutilizáveis atribuídos via `usuarios_pacotes`). Algoritmo `checar_permissao` atualizado para 2 camadas: perfil base + pacotes (sem overrides individuais). Adicionada seção 6 (Pacotes de Permissão) e seção 7 (algoritmo v2.0). Implementação em `backend/dependencies.py`. |

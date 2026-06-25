# CGID Refactoring Report — v2.0

## Arquivos Criados

### Backend

| Arquivo | Descrição |
|---------|-----------|
| `backend/dependencies.py` | Middleware de sessão, helpers de permissão (`checar_permissao`, `exigir_permissao`), constantes (`PERFIS_VALIDOS`, `SENHA_PADRAO`) |
| `backend/services/__init__.py` | Pacote de serviços |
| `backend/services/auth_service.py` | Lógica de autenticação, expediente, vinculação de workspaces, seed de perfis e categorias |
| `backend/services/audit_service.py` | `registrar_log`, `salvar_backup_critico`, `get_ip` |
| `backend/services/pbi_service.py` | Token OAuth2 Azure AD com cache em memória |
| `backend/routers/__init__.py` | Pacote de routers |
| `backend/routers/auth.py` | `/login`, `/api/logout`, `/sessao/ping` |
| `backend/routers/usuarios.py` | CRUD de usuários, acessos a workspaces, favoritos, expediente por usuário |
| `backend/routers/workspaces.py` | CRUD de workspaces, relatórios, categorias de relatório, vínculos, embed PBI |
| `backend/routers/auditoria.py` | Logs paginados, exportação CSV, histórico crítico |
| `backend/routers/dashboard.py` | KPIs, eventos, estatísticas, gráficos de acesso |
| `backend/routers/permissoes.py` | Permissões por perfil, pacotes, controle de acesso, `/api/perfis` |
| `backend/routers/configuracoes.py` | Expediente, grupos de exceção, credenciais PBI |
| `backend/routers/landbank.py` | Endpoint protegido de dados Land Bank |
| `backend/routers/departamentos.py` | CRUD de departamentos (novo) |

## Arquivos Modificados

| Arquivo | O que mudou |
|---------|-------------|
| `backend/models.py` | Removida `SobrescritaPermissao`; adicionadas `Departamento`, `CategoriaRelatorio`, `Perfil`, `CredencialPBI`; adicionado `departamento_id` em `Usuario`; adicionado `categoria_id` em `Relatorio`; corrigido `ondelete="CASCADE"` em `MembroGrupoExcecao.usuario_id` |
| `backend/main.py` | Reescrito como ponto de entrada limpo (~30 linhas); todo código movido para routers/services |
| `backend/seed.py` | Adicionados seeds de departamentos, categorias de relatório; usuários agora recebem `departamento_id`; relatórios recebem `categoria_id` |
| `frontend/src/pages/UsersPage.jsx` | Adicionado campo de departamento no formulário e na tabela |
| `frontend/src/pages/WorkspacePage.jsx` | Campo `categoria` de relatório alterado de texto para select de categorias |

## Novos Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/departamentos` | Lista departamentos |
| POST | `/departamentos` | Cria departamento |
| PUT | `/departamentos/{id}` | Atualiza departamento |
| DELETE | `/departamentos/{id}` | Desativa departamento (soft-delete) |
| GET | `/categorias-relatorio` | Lista categorias de relatório |
| POST | `/categorias-relatorio` | Cria categoria |
| PUT | `/categorias-relatorio/{id}` | Atualiza categoria |
| DELETE | `/categorias-relatorio/{id}` | Desativa categoria |
| GET | `/api/perfis` | Lista perfis com metadados (nivel_hierarquia, etc.) |

## Endpoints Removidos / Alterados

- `PUT /api/usuarios/{id}/permissoes/{modulo}` — removido (sobrescritas individuais eliminadas)
- `DELETE /api/usuarios/{id}/permissoes/{modulo}` — removido
- `GET /api/usuarios/{id}/permissoes` — mantido mas agora retorna `sobrescrita: null` sempre (compatível)

## Pontos que Precisam de Intervenção Manual

1. **Migração de banco existente**: O banco SQLite existente não tem as novas colunas/tabelas. Rodar `Base.metadata.create_all()` cria tabelas novas, mas não adiciona colunas em tabelas existentes. Para banco com dados, executar manualmente:
   ```sql
   ALTER TABLE usuarios ADD COLUMN departamento_id TEXT REFERENCES departamentos(id);
   ALTER TABLE relatorios ADD COLUMN categoria_id TEXT REFERENCES categorias_relatorio(id);
   -- Criar tabelas novas via SQLAlchemy ou migration
   ```

2. **Alembic**: Não foi configurado conforme previsto. Para configurar:
   ```bash
   cd backend && pip install alembic && alembic init migrations
   ```
   Editar `alembic.ini` para apontar para o SQLite e `env.py` para importar `Base` de `database`.

3. **Tabela `sobrescritas_permissao`**: A tabela ainda existe no banco (não foi dropada — apenas o código Python foi removido). Se desejar remover: `DROP TABLE sobrescritas_permissao;`

4. **`schemas.py`**: O arquivo original era minimalista e não foi reescrito — os schemas Pydantic foram definidos inline nos routers (padrão mais prático para FastAPI). Se desejar centralizar schemas, mover as classes `BaseModel` dos routers para `schemas.py`.

5. **Testes**: Não existiam testes antes da refatoração; a cobertura ainda é zero. Recomenda-se adicionar testes de integração para os novos endpoints.

6. **Variável `SENHA_PADRAO`**: Usada antes do ponto de definição em `main.py` original. Agora está em `dependencies.py` e importada corretamente pelos routers.

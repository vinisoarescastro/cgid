"""
Schemas Pydantic centralizados do CGID.
Todos os routers importam daqui — evita duplicação e facilita manutenção.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

_CFG = {"from_attributes": True}


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginInput(BaseModel):
    email: str
    senha: str

class UsuarioPublico(BaseModel):
    id: str
    nome: str
    email: str
    perfil: str
    foto_url: Optional[str] = None
    model_config = _CFG

class LoginResponse(BaseModel):
    sucesso: bool
    mensagem: str
    usuario: Optional[UsuarioPublico] = None
    requer_troca_senha: bool = False
    session_token: Optional[str] = None

class AlterarSenhaInput(BaseModel):
    senha_nova: str
    confirmacao: str


# ─── Departamentos ────────────────────────────────────────────────────────────

class DepartamentoItem(BaseModel):
    id: str
    nome: str
    codigo: Optional[str] = None
    descricao: Optional[str] = None
    ativo: bool
    model_config = _CFG

class DepartamentoCriar(BaseModel):
    nome: str
    codigo: Optional[str] = None
    descricao: Optional[str] = None

class DepartamentoAtualizar(BaseModel):
    nome: Optional[str] = None
    codigo: Optional[str] = None
    descricao: Optional[str] = None
    ativo: Optional[bool] = None


# ─── Usuários ─────────────────────────────────────────────────────────────────

class UsuarioListItem(BaseModel):
    id: str
    nome: str
    email: str
    perfil: str
    status: str
    ultimo_login: Optional[datetime] = None
    foto_url: Optional[str] = None
    criado_em: Optional[datetime] = None
    departamento_id: Optional[str] = None
    departamento_nome: Optional[str] = None
    model_config = _CFG

class UsuarioCriar(BaseModel):
    nome: str
    email: str
    senha: Optional[str] = None
    perfil: str
    departamento_id: Optional[str] = None

class UsuarioAtualizar(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    perfil: Optional[str] = None
    status: Optional[str] = None
    senha: Optional[str] = None
    departamento_id: Optional[str] = None


# ─── Acessos a Workspaces (por usuário) ──────────────────────────────────────

class AcessoWorkspaceItem(BaseModel):
    espaco_trabalho_id: str
    nome: str
    icone: Optional[str] = None
    cor: Optional[str] = None
    nivel_acesso: str

class AcessoWorkspaceInput(BaseModel):
    espaco_trabalho_id: str
    nivel_acesso: str


# ─── Favoritos ────────────────────────────────────────────────────────────────

class FavoritoItem(BaseModel):
    relatorio_id: str
    relatorio_nome: str
    relatorio_status: str
    id_relatorio_pbi: Optional[str]
    workspace_id: str
    workspace_nome: str
    workspace_icone: Optional[str]
    workspace_cor: Optional[str]

class FavoritoCriar(BaseModel):
    relatorio_id: str


# ─── Workspaces ───────────────────────────────────────────────────────────────

class WorkspaceItem(BaseModel):
    id: str
    nome: str
    icone: Optional[str] = None
    cor: Optional[str] = None
    descricao: Optional[str] = None
    id_workspace_pbi: Optional[str] = None
    status: str
    model_config = _CFG

class WorkspaceCreate(BaseModel):
    nome: str
    icone: Optional[str] = None
    cor: Optional[str] = None
    descricao: Optional[str] = None
    id_workspace_pbi: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    nome: Optional[str] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    descricao: Optional[str] = None
    id_workspace_pbi: Optional[str] = None


# ─── Relatórios ───────────────────────────────────────────────────────────────

class RelatorioItem(BaseModel):
    id: str
    nome: str
    categoria: Optional[str] = None
    status: str
    descricao: Optional[str] = None
    id_relatorio_pbi: Optional[str] = None
    criado_em: Optional[str] = None

class RelatorioCreate(BaseModel):
    nome: str
    categoria: Optional[str] = None
    status: str = "publicado"
    descricao: Optional[str] = None
    id_relatorio_pbi: Optional[str] = None

class EmbedResponse(BaseModel):
    embed_url: str
    embed_token: str


# ─── Vínculos Workspace ↔ Usuário ─────────────────────────────────────────────

class UsuarioWorkspaceItem(BaseModel):
    usuario_id: str
    nome: str
    email: str
    perfil: str
    nivel_acesso: str

class VincularUsuarioInput(BaseModel):
    usuario_id: str
    nivel_acesso: str

class AlterarNivelInput(BaseModel):
    nivel_acesso: str

class SetAcessosRelatorioInput(BaseModel):
    relatorio_ids: List[str] = []


# ─── Permissões / Pacotes ─────────────────────────────────────────────────────

class PermissaoPerfilInput(BaseModel):
    pode_visualizar: bool
    pode_criar: bool
    pode_editar: bool
    pode_excluir: bool
    pode_exportar: bool
    pode_gerenciar: bool

class PacoteItemInput(BaseModel):
    modulo: str
    pode_visualizar: bool = False
    pode_criar: bool = False
    pode_editar: bool = False
    pode_excluir: bool = False
    pode_exportar: bool = False
    pode_gerenciar: bool = False

class PacoteInput(BaseModel):
    nome: str
    descricao: Optional[str] = None
    itens: List[PacoteItemInput] = []

class PapelInput(BaseModel):
    perfil: str


# ─── Auditoria ────────────────────────────────────────────────────────────────

class LogItem(BaseModel):
    id: str
    momento: str
    usuario_id: Optional[str]
    nome_usuario: Optional[str]
    email_usuario: Optional[str]
    tipo_evento: str
    modulo: str
    detalhe: str
    endereco_ip: Optional[str]
    valor_anterior: Optional[str]
    valor_novo: Optional[str]

class LogsResponse(BaseModel):
    total: int
    pagina: int
    paginas: int
    itens: List[LogItem]


# ─── Configurações ────────────────────────────────────────────────────────────

class RegraExpedienteItem(BaseModel):
    dia_semana: int
    nome_dia: str
    hora_inicio: Optional[str]
    hora_fim: Optional[str]
    ativo: bool
    bloquear_fora: bool

class RegraExpedienteInput(BaseModel):
    hora_inicio: str
    hora_fim: str
    ativo: bool
    bloquear_fora: bool

class MembroItem(BaseModel):
    usuario_id: str
    nome: str
    email: str

class GrupoItem(BaseModel):
    id: str
    nome: str
    fora_horario: bool
    janela_inicio: Optional[str]
    janela_fim: Optional[str]
    ignora_dia_inativo: bool = False
    status: str
    membros: List[MembroItem] = []

class GrupoInput(BaseModel):
    nome: str
    fora_horario: bool = True
    janela_inicio: Optional[str] = None
    janela_fim: Optional[str] = None
    ignora_dia_inativo: bool = False

class CredencialPBIItem(BaseModel):
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None  # retorna "••••••••" quando configurado, "" quando vazio

class CredencialPBIInput(BaseModel):
    tenant_id: str
    client_id: str
    client_secret: str

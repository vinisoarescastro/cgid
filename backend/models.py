import uuid
from sqlalchemy import (
    Column, String, Boolean, Integer, SmallInteger,
    DateTime, Time, Text, ForeignKey, UniqueConstraint, Index, func
)
from sqlalchemy.orm import relationship
from database import Base


def new_uuid():
    return str(uuid.uuid4())


# ─── 1. Usuários ─────────────────────────────────────────────────────────────
class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (Index("ix_usuarios_status", "status"),)

    id                = Column(String(36), primary_key=True, default=new_uuid)
    nome              = Column(String(255), nullable=False)
    email             = Column(String(255), nullable=False, unique=True, index=True)
    hash_senha        = Column(String(255), nullable=False)
    perfil            = Column(String(30),  nullable=False)   # super_administrador | administrador | gerente | operador | visitante
    status            = Column(String(20),  nullable=False, default="ativo")  # ativo | inativo | bloqueado
    tentativas_login  = Column(SmallInteger, nullable=False, default=0)
    senha_provisoria  = Column(Boolean, nullable=False, default=False)
    ultimo_login      = Column(DateTime, nullable=True)
    foto_url          = Column(String(500), nullable=True)
    mfa_ativo         = Column(Boolean, nullable=False, default=False)
    mfa_segredo       = Column(String(255), nullable=True)
    criado_em         = Column(DateTime, nullable=False, server_default=func.now())
    atualizado_em     = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    criado_por_id     = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    sessoes           = relationship("SessaoAutenticacao", back_populates="usuario", cascade="all, delete-orphan", foreign_keys="SessaoAutenticacao.usuario_id")
    acessos_workspace = relationship("AcessoWorkspace",   back_populates="usuario", cascade="all, delete-orphan", foreign_keys="AcessoWorkspace.usuario_id")
    acessos_relatorio = relationship("AcessoRelatorio",   back_populates="usuario", cascade="all, delete-orphan", foreign_keys="AcessoRelatorio.usuario_id")
    sobrescritas      = relationship("SobrescritaPermissao", back_populates="usuario", cascade="all, delete-orphan", foreign_keys="SobrescritaPermissao.usuario_id")
    favoritos         = relationship("Favorito",           back_populates="usuario", cascade="all, delete-orphan", foreign_keys="Favorito.usuario_id")
    membros_grupo     = relationship("MembroGrupoExcecao", back_populates="usuario", foreign_keys="MembroGrupoExcecao.usuario_id")


# ─── 2. Sessões de Autenticação ───────────────────────────────────────────────
class SessaoAutenticacao(Base):
    __tablename__ = "sessoes_autenticacao"
    __table_args__ = (Index("ix_sa_usuario_ativo", "usuario_id", "revogado_em"),)

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    usuario_id          = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    hash_refresh_token  = Column(String(255), nullable=False, unique=True)
    criado_em           = Column(DateTime, nullable=False, server_default=func.now())
    expira_em           = Column(DateTime, nullable=False)
    ultimo_uso_em       = Column(DateTime, nullable=True)
    revogado_em         = Column(DateTime, nullable=True)
    endereco_ip         = Column(String(45), nullable=True)
    user_agent          = Column(String(500), nullable=True)

    usuario = relationship("Usuario", back_populates="sessoes", foreign_keys=[usuario_id])


# ─── 3. Espaços de Trabalho (Workspaces) ─────────────────────────────────────
class EspacoTrabalho(Base):
    __tablename__ = "espacos_trabalho"

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    nome                = Column(String(255), nullable=False, unique=True)
    id_workspace_pbi    = Column(String(255), nullable=True)
    status              = Column(String(20),  nullable=False, default="ativo")  # ativo | arquivado
    icone               = Column(String(100), nullable=True)
    cor                 = Column(String(20),  nullable=True)
    descricao           = Column(Text, nullable=True)
    criado_em           = Column(DateTime, nullable=False, server_default=func.now())
    criado_por_id       = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    relatorios        = relationship("Relatorio",      back_populates="espaco_trabalho", cascade="all, delete-orphan")
    acessos_workspace = relationship("AcessoWorkspace", back_populates="espaco_trabalho", cascade="all, delete-orphan", foreign_keys="AcessoWorkspace.espaco_trabalho_id")


# ─── 4. Relatórios ───────────────────────────────────────────────────────────
class Relatorio(Base):
    __tablename__ = "relatorios"
    __table_args__ = (
        Index("ix_relatorios_espaco_status", "espaco_trabalho_id", "status"),
        Index("ix_relatorios_status", "status"),
    )

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    nome                = Column(String(255), nullable=False)
    espaco_trabalho_id  = Column(String(36), ForeignKey("espacos_trabalho.id", ondelete="CASCADE"), nullable=False, index=True)
    id_relatorio_pbi    = Column(String(255), nullable=True)
    categoria           = Column(String(100), nullable=True)
    status              = Column(String(20),  nullable=False, default="publicado")  # publicado | rascunho | arquivado
    descricao           = Column(Text, nullable=True)
    criado_em           = Column(DateTime, nullable=False, server_default=func.now())
    atualizado_em       = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    criado_por_id       = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    espaco_trabalho   = relationship("EspacoTrabalho", back_populates="relatorios")
    acessos_relatorio = relationship("AcessoRelatorio", back_populates="relatorio", cascade="all, delete-orphan")
    favoritos         = relationship("Favorito",        back_populates="relatorio",  cascade="all, delete-orphan")


# ─── 5. Acessos por Workspace ────────────────────────────────────────────────
class AcessoWorkspace(Base):
    __tablename__ = "acessos_workspace"
    __table_args__ = (UniqueConstraint("usuario_id", "espaco_trabalho_id", name="uq_aw_usuario_espaco"),)

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    usuario_id          = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    espaco_trabalho_id  = Column(String(36), ForeignKey("espacos_trabalho.id", ondelete="CASCADE"), nullable=False)
    nivel_acesso        = Column(String(20),  nullable=False, default="apenas_relatorios")  # total | apenas_relatorios | nenhum
    concedido_por_id    = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    concedido_em        = Column(DateTime, nullable=False, server_default=func.now())

    usuario        = relationship("Usuario",       back_populates="acessos_workspace", foreign_keys=[usuario_id])
    espaco_trabalho = relationship("EspacoTrabalho", back_populates="acessos_workspace", foreign_keys=[espaco_trabalho_id])


# ─── 6. Acessos por Relatório ────────────────────────────────────────────────
class AcessoRelatorio(Base):
    __tablename__ = "acessos_relatorio"
    __table_args__ = (UniqueConstraint("usuario_id", "relatorio_id", name="uq_ar_usuario_relatorio"),)

    id               = Column(String(36), primary_key=True, default=new_uuid)
    usuario_id       = Column(String(36), ForeignKey("usuarios.id",    ondelete="CASCADE"),  nullable=False)
    relatorio_id     = Column(String(36), ForeignKey("relatorios.id",  ondelete="CASCADE"),  nullable=False)
    concedido_por_id = Column(String(36), ForeignKey("usuarios.id",    ondelete="SET NULL"), nullable=True)
    concedido_em     = Column(DateTime, nullable=False, server_default=func.now())

    usuario  = relationship("Usuario",   back_populates="acessos_relatorio", foreign_keys=[usuario_id])
    relatorio = relationship("Relatorio", back_populates="acessos_relatorio", foreign_keys=[relatorio_id])


# ─── 7. Permissões por Perfil ────────────────────────────────────────────────
class PermissaoPerfil(Base):
    __tablename__ = "permissoes_perfil"
    __table_args__ = (UniqueConstraint("perfil", "modulo", name="uq_pp_perfil_modulo"),)

    id               = Column(String(36), primary_key=True, default=new_uuid)
    perfil           = Column(String(30),  nullable=False)
    modulo           = Column(String(100), nullable=False)
    pode_visualizar  = Column(Boolean, nullable=False, default=False)
    pode_criar       = Column(Boolean, nullable=False, default=False)
    pode_editar      = Column(Boolean, nullable=False, default=False)
    pode_excluir     = Column(Boolean, nullable=False, default=False)
    pode_exportar    = Column(Boolean, nullable=False, default=False)
    pode_gerenciar   = Column(Boolean, nullable=False, default=False)


# ─── 8. Sobrescritas de Permissão por Usuário ────────────────────────────────
class SobrescritaPermissao(Base):
    __tablename__ = "sobrescritas_permissao"
    __table_args__ = (UniqueConstraint("usuario_id", "modulo", name="uq_sp_usuario_modulo"),)

    id               = Column(String(36), primary_key=True, default=new_uuid)
    usuario_id       = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"),  nullable=False)
    modulo           = Column(String(100), nullable=False)
    pode_visualizar  = Column(Boolean, nullable=True)
    pode_criar       = Column(Boolean, nullable=True)
    pode_editar      = Column(Boolean, nullable=True)
    pode_excluir     = Column(Boolean, nullable=True)
    pode_exportar    = Column(Boolean, nullable=True)
    pode_gerenciar   = Column(Boolean, nullable=True)
    definido_por_id  = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    definido_em      = Column(DateTime, nullable=False, server_default=func.now())

    usuario = relationship("Usuario", back_populates="sobrescritas", foreign_keys=[usuario_id])


# ─── 9. Regras de Expediente ─────────────────────────────────────────────────
class RegraExpediente(Base):
    __tablename__ = "regras_expediente"
    __table_args__ = (UniqueConstraint("dia_semana", name="uq_re_dia_semana"),)

    id            = Column(String(36), primary_key=True, default=new_uuid)
    dia_semana    = Column(SmallInteger, nullable=False)  # 0=Dom … 6=Sab
    hora_inicio   = Column(Time, nullable=False)
    hora_fim      = Column(Time, nullable=False)
    ativo         = Column(Boolean, nullable=False, default=True)
    bloquear_fora = Column(Boolean, nullable=False, default=True)
    atualizado_em = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


# ─── 10. Grupos de Exceção ───────────────────────────────────────────────────
class GrupoExcecao(Base):
    __tablename__ = "grupos_excecao"

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    nome                = Column(String(255), nullable=False)
    fora_horario        = Column(Boolean, nullable=False, default=True)
    janela_inicio       = Column(Time, nullable=True)
    janela_fim          = Column(Time, nullable=True)
    ignora_dia_inativo  = Column(Boolean, nullable=False, default=False)
    status              = Column(String(20), nullable=False, default="ativo")  # ativo | inativo
    criado_em           = Column(DateTime, nullable=False, server_default=func.now())
    criado_por_id       = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    membros = relationship("MembroGrupoExcecao", back_populates="grupo", cascade="all, delete-orphan")


# ─── 11. Membros dos Grupos de Exceção ───────────────────────────────────────
class MembroGrupoExcecao(Base):
    __tablename__ = "membros_grupo_excecao"

    grupo_id   = Column(String(36), ForeignKey("grupos_excecao.id", ondelete="CASCADE"), primary_key=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"),                           primary_key=True)

    grupo   = relationship("GrupoExcecao", back_populates="membros")
    usuario = relationship("Usuario",      back_populates="membros_grupo", foreign_keys=[usuario_id])


# ─── 12. Favoritos ───────────────────────────────────────────────────────────
class Favorito(Base):
    __tablename__ = "favoritos"
    __table_args__ = (UniqueConstraint("usuario_id", "relatorio_id", name="uq_fav_usuario_relatorio"),)

    id           = Column(String(36), primary_key=True, default=new_uuid)
    usuario_id   = Column(String(36), ForeignKey("usuarios.id",   ondelete="CASCADE"), nullable=False)
    relatorio_id = Column(String(36), ForeignKey("relatorios.id", ondelete="CASCADE"), nullable=False)
    criado_em    = Column(DateTime, nullable=False, server_default=func.now())

    usuario  = relationship("Usuario",   back_populates="favoritos",  foreign_keys=[usuario_id])
    relatorio = relationship("Relatorio", back_populates="favoritos",  foreign_keys=[relatorio_id])


# ─── 13. Logs de Auditoria (append-only) ────────────────────────────────────
class LogAuditoria(Base):
    __tablename__ = "logs_auditoria"

    id              = Column(String(36), primary_key=True, default=new_uuid)
    momento         = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    usuario_id      = Column(String(36), nullable=True, index=True)   # sem FK — preserva histórico
    nome_usuario    = Column(String(255), nullable=True)              # snapshot imutável
    email_usuario   = Column(String(255), nullable=True)              # snapshot imutável
    tipo_evento     = Column(String(50),  nullable=False, index=True) # autenticacao | usuario | permissao | acesso | relatorio | seguranca | sistema
    modulo          = Column(String(100), nullable=False, index=True)
    detalhe         = Column(Text, nullable=False)
    endereco_ip     = Column(String(45),  nullable=True)
    valor_anterior  = Column(Text, nullable=True)   # JSON
    valor_novo      = Column(Text, nullable=True)   # JSON


# ─── 14. Configurações do Sistema ────────────────────────────────────────────
class ConfiguracaoSistema(Base):
    __tablename__ = "configuracoes_sistema"

    chave              = Column(String(255), primary_key=True)
    valor              = Column(Text, nullable=False)
    eh_secreto         = Column(Boolean, nullable=False, default=False)
    atualizado_em      = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    atualizado_por_id  = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

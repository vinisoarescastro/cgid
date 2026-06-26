import uuid
from sqlalchemy import (
    Column, String, Boolean, Integer, SmallInteger,
    DateTime, Time, Text, ForeignKey, UniqueConstraint, Index, func
)
from sqlalchemy.orm import relationship
from database import Base


def new_uuid():
    return str(uuid.uuid4())


# ─── 1. Departamentos ─────────────────────────────────────────────────────────
class Departamento(Base):
    __tablename__ = "departamentos"

    id            = Column(String(36), primary_key=True, default=new_uuid)
    nome          = Column(String(255), nullable=False, unique=True)
    codigo        = Column(String(20),  nullable=True,  unique=True)
    descricao     = Column(Text,        nullable=True)
    ativo         = Column(Boolean,     nullable=False, default=True)
    criado_em     = Column(DateTime,    nullable=False, server_default=func.now())
    atualizado_em = Column(DateTime,    nullable=False, server_default=func.now(), onupdate=func.now())

    usuarios = relationship("Usuario", back_populates="departamento")


# ─── 2. Usuários ─────────────────────────────────────────────────────────────
class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (Index("ix_usuarios_status", "status"),)

    id                = Column(String(36), primary_key=True, default=new_uuid)
    nome              = Column(String(255), nullable=False)
    email             = Column(String(255), nullable=False, unique=True, index=True)
    hash_senha        = Column(String(255), nullable=False)
    perfil            = Column(String(30),  ForeignKey("perfis.codigo"), nullable=False)
    status            = Column(String(20),  nullable=False, default="ativo")
    tentativas_login  = Column(SmallInteger, nullable=False, default=0)
    senha_provisoria  = Column(Boolean, nullable=False, default=False)
    ultimo_login      = Column(DateTime, nullable=True)
    foto_url          = Column(String(500), nullable=True)
    mfa_ativo         = Column(Boolean, nullable=False, default=False)
    mfa_segredo       = Column(String(255), nullable=True)
    criado_em         = Column(DateTime, nullable=False, server_default=func.now())
    atualizado_em     = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    criado_por_id     = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    departamento_id   = Column(String(36), ForeignKey("departamentos.id", ondelete="SET NULL"), nullable=True)

    sessoes           = relationship("SessaoAutenticacao", back_populates="usuario", cascade="all, delete-orphan", foreign_keys="SessaoAutenticacao.usuario_id")
    acessos_workspace = relationship("AcessoWorkspace",   back_populates="usuario", cascade="all, delete-orphan", foreign_keys="AcessoWorkspace.usuario_id")
    acessos_relatorio = relationship("AcessoRelatorio",   back_populates="usuario", cascade="all, delete-orphan", foreign_keys="AcessoRelatorio.usuario_id")
    favoritos         = relationship("Favorito",           back_populates="usuario", cascade="all, delete-orphan", foreign_keys="Favorito.usuario_id")
    membros_grupo     = relationship("MembroGrupoExcecao", back_populates="usuario", foreign_keys="MembroGrupoExcecao.usuario_id")
    pacotes           = relationship("UsuarioPacote", back_populates="usuario", cascade="all, delete-orphan", foreign_keys="UsuarioPacote.usuario_id")
    departamento      = relationship("Departamento", back_populates="usuarios")


# ─── 3. Sessões de Autenticação ───────────────────────────────────────────────
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


# ─── 4. Espaços de Trabalho (Workspaces) ─────────────────────────────────────
class EspacoTrabalho(Base):
    __tablename__ = "espacos_trabalho"

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    nome                = Column(String(255), nullable=False, unique=True)
    id_workspace_pbi    = Column(String(255), nullable=True)
    status              = Column(String(20),  nullable=False, default="ativo")
    icone               = Column(String(100), nullable=True)
    cor                 = Column(String(20),  nullable=True)
    descricao           = Column(Text, nullable=True)
    criado_em           = Column(DateTime, nullable=False, server_default=func.now())
    criado_por_id       = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    relatorios        = relationship("Relatorio",      back_populates="espaco_trabalho", cascade="all, delete-orphan")
    acessos_workspace = relationship("AcessoWorkspace", back_populates="espaco_trabalho", cascade="all, delete-orphan", foreign_keys="AcessoWorkspace.espaco_trabalho_id")


# ─── 5. Relatórios ───────────────────────────────────────────────────────────
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
    status              = Column(String(20),  nullable=False, default="publicado")
    descricao           = Column(Text, nullable=True)
    criado_em           = Column(DateTime, nullable=False, server_default=func.now())
    atualizado_em       = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    criado_por_id       = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    espaco_trabalho   = relationship("EspacoTrabalho", back_populates="relatorios")
    acessos_relatorio = relationship("AcessoRelatorio", back_populates="relatorio", cascade="all, delete-orphan")
    favoritos         = relationship("Favorito",        back_populates="relatorio",  cascade="all, delete-orphan")


# ─── 7. Acessos por Workspace ────────────────────────────────────────────────
class AcessoWorkspace(Base):
    __tablename__ = "acessos_workspace"
    __table_args__ = (UniqueConstraint("usuario_id", "espaco_trabalho_id", name="uq_aw_usuario_espaco"),)

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    usuario_id          = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    espaco_trabalho_id  = Column(String(36), ForeignKey("espacos_trabalho.id", ondelete="CASCADE"), nullable=False)
    nivel_acesso        = Column(String(20),  nullable=False, default="apenas_relatorios")
    concedido_por_id    = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    concedido_em        = Column(DateTime, nullable=False, server_default=func.now())

    usuario        = relationship("Usuario",       back_populates="acessos_workspace", foreign_keys=[usuario_id])
    espaco_trabalho = relationship("EspacoTrabalho", back_populates="acessos_workspace", foreign_keys=[espaco_trabalho_id])


# ─── 8. Acessos por Relatório ────────────────────────────────────────────────
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


# ─── 9. Permissões por Perfil ────────────────────────────────────────────────
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


# ─── 10. Perfis (metadados) ───────────────────────────────────────────────────
class Perfil(Base):
    __tablename__ = "perfis"

    codigo             = Column(String(30), primary_key=True)
    nome_exibicao      = Column(String(100), nullable=False)
    descricao          = Column(Text, nullable=True)
    nivel_hierarquia   = Column(SmallInteger, nullable=False, default=0)
    pode_ser_atribuido = Column(Boolean, nullable=False, default=True)


# ─── 11. Regras de Expediente ─────────────────────────────────────────────────
class RegraExpediente(Base):
    __tablename__ = "regras_expediente"
    __table_args__ = (UniqueConstraint("dia_semana", name="uq_re_dia_semana"),)

    id            = Column(String(36), primary_key=True, default=new_uuid)
    dia_semana    = Column(SmallInteger, nullable=False)
    hora_inicio   = Column(Time, nullable=False)
    hora_fim      = Column(Time, nullable=False)
    ativo         = Column(Boolean, nullable=False, default=True)
    bloquear_fora = Column(Boolean, nullable=False, default=True)
    atualizado_em = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


# ─── 12. Grupos de Exceção ───────────────────────────────────────────────────
class GrupoExcecao(Base):
    __tablename__ = "grupos_excecao"

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    nome                = Column(String(255), nullable=False)
    fora_horario        = Column(Boolean, nullable=False, default=True)
    janela_inicio       = Column(Time, nullable=True)
    janela_fim          = Column(Time, nullable=True)
    ignora_dia_inativo  = Column(Boolean, nullable=False, default=False)
    status              = Column(String(20), nullable=False, default="ativo")
    criado_em           = Column(DateTime, nullable=False, server_default=func.now())
    criado_por_id       = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    membros = relationship("MembroGrupoExcecao", back_populates="grupo", cascade="all, delete-orphan")


# ─── 13. Membros dos Grupos de Exceção ───────────────────────────────────────
class MembroGrupoExcecao(Base):
    __tablename__ = "membros_grupo_excecao"

    grupo_id   = Column(String(36), ForeignKey("grupos_excecao.id", ondelete="CASCADE"), primary_key=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"),       primary_key=True)

    grupo   = relationship("GrupoExcecao", back_populates="membros")
    usuario = relationship("Usuario",      back_populates="membros_grupo", foreign_keys=[usuario_id])


# ─── 14. Favoritos ───────────────────────────────────────────────────────────
class Favorito(Base):
    __tablename__ = "favoritos"
    __table_args__ = (UniqueConstraint("usuario_id", "relatorio_id", name="uq_fav_usuario_relatorio"),)

    id           = Column(String(36), primary_key=True, default=new_uuid)
    usuario_id   = Column(String(36), ForeignKey("usuarios.id",   ondelete="CASCADE"), nullable=False)
    relatorio_id = Column(String(36), ForeignKey("relatorios.id", ondelete="CASCADE"), nullable=False)
    criado_em    = Column(DateTime, nullable=False, server_default=func.now())

    usuario  = relationship("Usuario",   back_populates="favoritos",  foreign_keys=[usuario_id])
    relatorio = relationship("Relatorio", back_populates="favoritos",  foreign_keys=[relatorio_id])


# ─── 15. Logs de Auditoria (append-only) ────────────────────────────────────
class LogAuditoria(Base):
    __tablename__ = "logs_auditoria"

    id              = Column(String(36), primary_key=True, default=new_uuid)
    momento         = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    usuario_id      = Column(String(36), nullable=True, index=True)
    nome_usuario    = Column(String(255), nullable=True)
    email_usuario   = Column(String(255), nullable=True)
    tipo_evento     = Column(String(50),  nullable=False, index=True)
    modulo          = Column(String(100), nullable=False, index=True)
    detalhe         = Column(Text, nullable=False)
    endereco_ip     = Column(String(45),  nullable=True)
    valor_anterior  = Column(Text, nullable=True)
    valor_novo      = Column(Text, nullable=True)


# ─── 16. Configurações do Sistema ────────────────────────────────────────────
class ConfiguracaoSistema(Base):
    __tablename__ = "configuracoes_sistema"

    chave              = Column(String(255), primary_key=True)
    valor              = Column(Text, nullable=False)
    eh_secreto         = Column(Boolean, nullable=False, default=False)
    atualizado_em      = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    atualizado_por_id  = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)


# ─── 17. Histórico de Configurações Críticas ─────────────────────────────────
class HistoricoConfigCritica(Base):
    __tablename__ = "historico_config_critica"

    id                  = Column(String(36), primary_key=True, default=new_uuid)
    momento             = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    entidade            = Column(String(50),  nullable=False, index=True)
    entidade_id         = Column(String(36),  nullable=True,  index=True)
    campo               = Column(String(100), nullable=False)
    valor_anterior      = Column(Text, nullable=True)
    valor_novo          = Column(Text, nullable=True)
    alterado_por_id     = Column(String(36),  nullable=True)
    alterado_por_nome   = Column(String(255), nullable=True)
    alterado_por_email  = Column(String(255), nullable=True)


# ─── 18. Credenciais Power BI ─────────────────────────────────────────────────
class CredencialPBI(Base):
    __tablename__ = "credenciais_pbi"

    id                = Column(String(36), primary_key=True, default=new_uuid)
    tenant_id         = Column(String(255), nullable=True)
    client_id         = Column(String(255), nullable=True)
    client_secret     = Column(String(500), nullable=True)
    ativo             = Column(Boolean, nullable=False, default=True)
    atualizado_em     = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    atualizado_por_id = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)


# ─── 19. Pacotes de Permissão ─────────────────────────────────────────────────
class PacotePermissao(Base):
    __tablename__ = "pacotes_permissao"

    id            = Column(String(36), primary_key=True, default=new_uuid)
    nome          = Column(String(255), nullable=False, unique=True)
    descricao     = Column(Text, nullable=True)
    criado_em     = Column(DateTime, nullable=False, server_default=func.now())
    criado_por_id = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    itens    = relationship("PacotePermissaoItem", back_populates="pacote", cascade="all, delete-orphan")
    usuarios = relationship("UsuarioPacote", back_populates="pacote", cascade="all, delete-orphan")


# ─── 20. Itens de Pacote de Permissão ────────────────────────────────────────
class PacotePermissaoItem(Base):
    __tablename__ = "pacotes_permissao_itens"
    __table_args__ = (UniqueConstraint("pacote_id", "modulo", name="uq_ppi_pacote_modulo"),)

    id              = Column(String(36), primary_key=True, default=new_uuid)
    pacote_id       = Column(String(36), ForeignKey("pacotes_permissao.id", ondelete="CASCADE"), nullable=False)
    modulo          = Column(String(100), nullable=False)
    pode_visualizar = Column(Boolean, nullable=False, default=False)
    pode_criar      = Column(Boolean, nullable=False, default=False)
    pode_editar     = Column(Boolean, nullable=False, default=False)
    pode_excluir    = Column(Boolean, nullable=False, default=False)
    pode_exportar   = Column(Boolean, nullable=False, default=False)
    pode_gerenciar  = Column(Boolean, nullable=False, default=False)

    pacote = relationship("PacotePermissao", back_populates="itens")


# ─── 21. Atribuição de Pacotes a Usuários ────────────────────────────────────
class UsuarioPacote(Base):
    __tablename__ = "usuarios_pacotes"
    __table_args__ = (UniqueConstraint("usuario_id", "pacote_id", name="uq_up_usuario_pacote"),)

    id               = Column(String(36), primary_key=True, default=new_uuid)
    usuario_id       = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    pacote_id        = Column(String(36), ForeignKey("pacotes_permissao.id", ondelete="CASCADE"), nullable=False)
    atribuido_por_id = Column(String(36), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    atribuido_em     = Column(DateTime, nullable=False, server_default=func.now())

    usuario = relationship("Usuario", back_populates="pacotes", foreign_keys=[usuario_id])
    pacote  = relationship("PacotePermissao", back_populates="usuarios")

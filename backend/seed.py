"""
Popula o banco com dados iniciais:
  - Usuários de demonstração
  - Permissões por perfil
  - Regras de expediente (seg–sex 08:00–18:00)
  - Configurações do sistema
  - Workspaces e relatórios de exemplo
"""
import uuid
from datetime import time
from passlib.context import CryptContext
from database import engine, SessionLocal, Base
from models import (
    Usuario, PermissaoPerfil, RegraExpediente,
    ConfiguracaoSistema, EspacoTrabalho, Relatorio,
)

Base.metadata.create_all(bind=engine)
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
db  = SessionLocal()


# ─── helpers ────────────────────────────────────────────────────────────────
def upsert_usuario(dados):
    u = db.query(Usuario).filter(Usuario.email == dados["email"]).first()
    if not u:
        u = Usuario(
            id         = str(uuid.uuid4()),
            nome       = dados["nome"],
            email      = dados["email"],
            hash_senha = pwd.hash(dados["senha"]),
            perfil     = dados["perfil"],
            status     = "ativo",
        )
        db.add(u)
    return u


def upsert_permissao(perfil, modulo, **flags):
    p = db.query(PermissaoPerfil).filter_by(perfil=perfil, modulo=modulo).first()
    if not p:
        p = PermissaoPerfil(perfil=perfil, modulo=modulo)
        db.add(p)
    for k, v in flags.items():
        setattr(p, k, v)


def upsert_expediente(dia, inicio, fim, ativo=True, bloquear=True):
    r = db.query(RegraExpediente).filter_by(dia_semana=dia).first()
    if not r:
        r = RegraExpediente(dia_semana=dia)
        db.add(r)
    r.hora_inicio   = inicio
    r.hora_fim      = fim
    r.ativo         = ativo
    r.bloquear_fora = bloquear


def upsert_config(chave, valor, eh_secreto=False):
    c = db.query(ConfiguracaoSistema).filter_by(chave=chave).first()
    if not c:
        c = ConfiguracaoSistema(chave=chave)
        db.add(c)
    c.valor      = valor
    c.eh_secreto = eh_secreto


def upsert_workspace(nome, icone, cor, descricao, criado_por_id):
    w = db.query(EspacoTrabalho).filter_by(nome=nome).first()
    if not w:
        w = EspacoTrabalho(
            nome          = nome,
            icone         = icone,
            cor           = cor,
            descricao     = descricao,
            criado_por_id = criado_por_id,
        )
        db.add(w)
    return w


def upsert_relatorio(nome, workspace_id, categoria, status, criado_por_id):
    r = db.query(Relatorio).filter_by(nome=nome, espaco_trabalho_id=workspace_id).first()
    if not r:
        r = Relatorio(
            nome               = nome,
            espaco_trabalho_id = workspace_id,
            categoria          = categoria,
            status             = status,
            criado_por_id      = criado_por_id,
        )
        db.add(r)
    return r


# ─── 1. Usuários ────────────────────────────────────────────────────────────
print("Inserindo usuários...")
admin      = upsert_usuario({"nome": "Admin CGID",       "email": "admin@cgid.com",      "senha": "Admin@2025",    "perfil": "super_administrador"})
carlos     = upsert_usuario({"nome": "Carlos Gerente",   "email": "carlos@cgid.com",     "senha": "Carlos@123",    "perfil": "gerente"})
mariana    = upsert_usuario({"nome": "Mariana Operador", "email": "mariana@cgid.com",    "senha": "Mariana@123",   "perfil": "operador"})
visitante  = upsert_usuario({"nome": "Visitante Demo",   "email": "visitante@cgid.com",  "senha": "Visitante@123", "perfil": "visitante"})
db.flush()


# ─── 2. Permissões por perfil ────────────────────────────────────────────────
print("Inserindo permissões por perfil...")
MODULOS = ["usuarios", "permissoes", "relatorios", "workspaces", "auditoria", "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank"]

for modulo in MODULOS:
    upsert_permissao("super_administrador", modulo,
        pode_visualizar=True, pode_criar=True, pode_editar=True,
        pode_excluir=True, pode_exportar=True, pode_gerenciar=True)

    upsert_permissao("administrador", modulo,
        pode_visualizar=True, pode_criar=True, pode_editar=True,
        pode_excluir=modulo not in ("configuracoes",),
        pode_exportar=True,
        pode_gerenciar=modulo not in ("configuracoes",))

    upsert_permissao("gerente", modulo,
        pode_visualizar=modulo in ("relatorios", "workspaces", "auditoria"),
        pode_criar=False, pode_editar=False,
        pode_excluir=False, pode_exportar=modulo == "relatorios",
        pode_gerenciar=False)

    upsert_permissao("operador", modulo,
        pode_visualizar=modulo in ("relatorios",),
        pode_criar=False, pode_editar=False,
        pode_excluir=False, pode_exportar=False, pode_gerenciar=False)

    # landbank: acesso negado por padrão a visitante (liberado individualmente pelo admin)
    upsert_permissao("visitante", modulo,
        pode_visualizar=modulo in ("relatorios",),
        pode_criar=False, pode_editar=False,
        pode_excluir=False, pode_exportar=False, pode_gerenciar=False)


# ─── 3. Regras de expediente ────────────────────────────────────────────────
print("Inserindo regras de expediente...")
# 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
HORARIO = time(8, 0)
FIM     = time(18, 0)

upsert_expediente(0, HORARIO, FIM, ativo=False, bloquear=False)  # Domingo — sem restrição
upsert_expediente(1, HORARIO, FIM, ativo=True,  bloquear=True)   # Segunda
upsert_expediente(2, HORARIO, FIM, ativo=True,  bloquear=True)   # Terça
upsert_expediente(3, HORARIO, FIM, ativo=True,  bloquear=True)   # Quarta
upsert_expediente(4, HORARIO, FIM, ativo=True,  bloquear=True)   # Quinta
upsert_expediente(5, HORARIO, FIM, ativo=True,  bloquear=True)   # Sexta
upsert_expediente(6, HORARIO, FIM, ativo=False, bloquear=False)  # Sábado — sem restrição


# ─── 4. Configurações do sistema ─────────────────────────────────────────────
print("Inserindo configurações do sistema...")
upsert_config("nome_portal",          '"CGID - Centro de Governança e Inteligência de Dados"')
upsert_config("ambiente",             '"desenvolvimento"')
upsert_config("pbi_client_id",        '""')
upsert_config("pbi_tenant_id",        '""')
upsert_config("pbi_workspace_id",     '""')
upsert_config("pbi_client_secret",    '""',  eh_secreto=True)
upsert_config("pbi_integracao_ativa", "false")


# ─── 5. Workspaces de exemplo ────────────────────────────────────────────────
print("Inserindo workspaces e relatórios de exemplo...")
ws_admin = upsert_workspace("Administrativo", "fa-solid fa-building",       "#2563eb", "Relatórios administrativos e RH",          admin.id)
ws_ctrl  = upsert_workspace("Controladoria",  "fa-solid fa-chart-line",     "#16a34a", "Relatórios financeiros e de controladoria", admin.id)
ws_mkt   = upsert_workspace("Marketing",      "fa-solid fa-bullhorn",       "#d97706", "Relatórios de marketing e performance",     admin.id)
ws_sac   = upsert_workspace("SAC",            "fa-solid fa-headset",        "#dc2626", "Relatórios de atendimento ao cliente",      admin.id)
db.flush()


# ─── 6. Relatórios de exemplo ────────────────────────────────────────────────
relatorios_seed = [
    (ws_admin.id, "Headcount Mensal",         "Operacional",  "publicado"),
    (ws_admin.id, "Turnover 2025",            "Estratégico",  "publicado"),
    (ws_ctrl.id,  "DRE Consolidado",          "Financeiro",   "publicado"),
    (ws_ctrl.id,  "Fluxo de Caixa",           "Financeiro",   "publicado"),
    (ws_ctrl.id,  "Budget vs Realizado",      "Financeiro",   "publicado"),
    (ws_ctrl.id,  "Análise de Margem",        "Financeiro",   "rascunho"),
    (ws_mkt.id,   "Performance de Campanhas", "Operacional",  "publicado"),
    (ws_mkt.id,   "Funil de Leads",           "Estratégico",  "publicado"),
    (ws_mkt.id,   "CAC e LTV",                "Estratégico",  "publicado"),
    (ws_sac.id,   "Volume de Chamados",       "Operacional",  "publicado"),
    (ws_sac.id,   "NPS Mensal",               "Estratégico",  "publicado"),
    (ws_sac.id,   "Tempo Médio de Resposta",  "Operacional",  "publicado"),
]

for ws_id, nome, categoria, status in relatorios_seed:
    upsert_relatorio(nome, ws_id, categoria, status, admin.id)


# ─── commit ───────────────────────────────────────────────────────────────────
db.commit()
db.close()
print("✓ Banco criado e populado com sucesso.")

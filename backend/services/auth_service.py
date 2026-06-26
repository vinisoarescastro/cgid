from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from models import (
    Usuario, PermissaoPerfil, RegraExpediente, MembroGrupoExcecao,
    GrupoExcecao, AcessoWorkspace, EspacoTrabalho, Perfil
)

TZ_BRASILIA = ZoneInfo("America/Sao_Paulo")

_MATRIZ_PERMISSOES_DEFAULT = {
    "master": {
        m: (True, True, True, True, True, True)
        for m in ["usuarios", "permissoes", "relatorios", "workspaces", "auditoria",
                  "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank", "departamentos"]
    },
    "administrador": {
        "usuarios":       (True, True, True, True,  True,  True),
        "permissoes":     (True, True, True, False, True,  True),
        "relatorios":     (True, True, True, True,  True,  True),
        "workspaces":     (True, True, True, True,  True,  True),
        "auditoria":      (True, True, True, True,  True,  True),
        "seguranca":      (True, True, True, True,  True,  True),
        "configuracoes":  (True, True, True, False, False, False),
        "expediente":     (True, True, True, True,  True,  True),
        "grupos_excecao": (True, True, True, True,  True,  True),
        "landbank":       (True, False, False, False, True, False),
        "departamentos":  (True, True, True, True,  False, False),
    },
    "coordenador": {
        "usuarios":       (True,  False, False, False, False, False),
        "permissoes":     (False, False, False, False, False, False),
        "relatorios":     (True,  False, False, False, True,  False),
        "workspaces":     (True,  False, False, False, False, False),
        "auditoria":      (True,  False, False, False, False, False),
        "seguranca":      (False, False, False, False, False, False),
        "configuracoes":  (False, False, False, False, False, False),
        "expediente":     (False, False, False, False, False, False),
        "grupos_excecao": (False, False, False, False, False, False),
        "landbank":       (False, False, False, False, False, False),
        "departamentos":  (True,  False, False, False, False, False),
    },
    "colaborador": {
        m: (False, False, False, False, False, False)
        for m in ["usuarios", "permissoes", "workspaces", "auditoria",
                  "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank", "departamentos"]
    } | {"relatorios": (True, False, False, False, False, False)},
    "convidado": {
        m: (False, False, False, False, False, False)
        for m in ["usuarios", "permissoes", "workspaces", "auditoria",
                  "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank", "departamentos"]
    } | {"relatorios": (True, False, False, False, False, False)},
}

_PERFIS_DEFAULT = [
    {"codigo": "master",        "nome_exibicao": "Master",        "descricao": "Acesso total ao sistema", "nivel_hierarquia": 100, "pode_ser_atribuido": False},
    {"codigo": "administrador", "nome_exibicao": "Administrador", "descricao": "Administracao geral",     "nivel_hierarquia": 90,  "pode_ser_atribuido": True},
    {"codigo": "coordenador",   "nome_exibicao": "Coordenador",   "descricao": "Coordenacao de equipes",  "nivel_hierarquia": 60,  "pode_ser_atribuido": True},
    {"codigo": "colaborador",   "nome_exibicao": "Colaborador",   "descricao": "Usuario padrao",          "nivel_hierarquia": 30,  "pode_ser_atribuido": True},
    {"codigo": "convidado",     "nome_exibicao": "Convidado",     "descricao": "Acesso somente leitura",  "nivel_hierarquia": 10,  "pode_ser_atribuido": True},
]

def garantir_permissoes_default(db: Session):
    for perfil, modulos in _MATRIZ_PERMISSOES_DEFAULT.items():
        for modulo, (vis, cri, edi, exc, exp, ger) in modulos.items():
            existente = db.query(PermissaoPerfil).filter_by(perfil=perfil, modulo=modulo).first()
            if existente:
                continue
            db.add(PermissaoPerfil(
                perfil=perfil, modulo=modulo,
                pode_visualizar=vis, pode_criar=cri, pode_editar=edi,
                pode_excluir=exc, pode_exportar=exp, pode_gerenciar=ger,
            ))
    db.commit()


def garantir_dados_iniciais(db: Session):
    for p in _PERFIS_DEFAULT:
        if not db.query(Perfil).filter_by(codigo=p["codigo"]).first():
            db.add(Perfil(**p))
    db.commit()


def verificar_expediente(usuario_id: str, db: Session) -> Optional[str]:
    agora = datetime.now(TZ_BRASILIA)
    dia_db = agora.isoweekday() % 7
    regra = db.query(RegraExpediente).filter(RegraExpediente.dia_semana == dia_db).first()
    if not regra:
        return None
    if not regra.ativo:
        pode_ignorar = db.query(MembroGrupoExcecao).join(GrupoExcecao).filter(
            MembroGrupoExcecao.usuario_id == usuario_id,
            GrupoExcecao.status == "ativo",
            GrupoExcecao.ignora_dia_inativo == True,
        ).first()
        if not pode_ignorar:
            return "Acesso nao permitido neste dia da semana."
    if not regra.bloquear_fora:
        return None
    hora_atual = agora.time().replace(tzinfo=None)
    if regra.hora_inicio <= hora_atual <= regra.hora_fim:
        return None
    if usuario_tem_excecao_horario(usuario_id, db):
        return None
    return (
        f"Acesso permitido somente entre {regra.hora_inicio.strftime('%H:%M')} "
        f"e {regra.hora_fim.strftime('%H:%M')}. "
        "Fora do horario de expediente."
    )


def usuario_tem_excecao_horario(usuario_id: str, db: Session) -> bool:
    return db.query(MembroGrupoExcecao).join(GrupoExcecao).filter(
        MembroGrupoExcecao.usuario_id == usuario_id,
        GrupoExcecao.status == "ativo",
        GrupoExcecao.fora_horario == True,
    ).first() is not None


def vincular_admins_workspace(workspace_id: str, db: Session):
    admins = db.query(Usuario).filter(
        Usuario.perfil.in_(["master", "administrador"]),
        Usuario.status == "ativo",
    ).all()
    for admin in admins:
        existe = db.query(AcessoWorkspace).filter(
            AcessoWorkspace.usuario_id == admin.id,
            AcessoWorkspace.espaco_trabalho_id == workspace_id,
        ).first()
        if not existe:
            db.add(AcessoWorkspace(
                usuario_id=admin.id,
                espaco_trabalho_id=workspace_id,
                nivel_acesso="total",
            ))


def vincular_admin_workspaces(usuario_id: str, db: Session):
    todos = db.query(EspacoTrabalho).filter(EspacoTrabalho.status == "ativo").all()
    db.query(AcessoWorkspace).filter(AcessoWorkspace.usuario_id == usuario_id).delete()
    for ws in todos:
        db.add(AcessoWorkspace(
            usuario_id=usuario_id,
            espaco_trabalho_id=ws.id,
            nivel_acesso="total",
        ))

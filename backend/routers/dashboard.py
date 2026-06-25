from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import get_db
from models import Usuario, EspacoTrabalho, Relatorio, LogAuditoria, AcessoWorkspace, RegraExpediente
from datetime import date as date_type

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/kpis")
def dashboard_kpis(db: Session = Depends(get_db)):
    hoje = datetime.now(timezone.utc).date()
    total_usuarios    = db.query(Usuario).filter(Usuario.status == "ativo").count()
    bloqueados        = db.query(Usuario).filter(Usuario.status == "bloqueado").count()
    workspaces_ativos = db.query(EspacoTrabalho).filter(EspacoTrabalho.status == "ativo").count()
    workspaces_total  = db.query(EspacoTrabalho).count()
    logins_hoje = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "autenticacao", LogAuditoria.detalhe.ilike("%sucesso%"),
        func.date(LogAuditoria.momento) == hoje).count()
    acessos_negados = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "seguranca", func.date(LogAuditoria.momento) == hoje).count()
    total_semana = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "seguranca",
        func.date(LogAuditoria.momento) >= hoje - timedelta(days=7),
        func.date(LogAuditoria.momento) < hoje).count()
    bloqueados_hoje = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "seguranca", LogAuditoria.modulo == "autenticacao",
        LogAuditoria.detalhe.ilike("%bloqueada%"), func.date(LogAuditoria.momento) == hoje).count()
    return {
        "usuarios_ativos": total_usuarios, "logins_hoje": logins_hoje, "usuarios_bloqueados": bloqueados,
        "bloqueados_hoje": bloqueados_hoje, "acessos_negados_hoje": acessos_negados,
        "media_semanal_negados": round(total_semana / 7, 1),
        "workspaces_ativos": workspaces_ativos, "workspaces_total": workspaces_total,
    }


@router.get("/dashboard/eventos")
def dashboard_eventos(db: Session = Depends(get_db)):
    logs = db.query(LogAuditoria).order_by(LogAuditoria.momento.desc()).limit(5).all()
    ICONES = {
        "autenticacao": {"icon": "fa-right-to-bracket", "color": "#d1fae5", "iconColor": "#059669"},
        "seguranca":    {"icon": "fa-user-lock",        "color": "#fef3c7", "iconColor": "#d97706"},
        "usuario":      {"icon": "fa-user-pen",         "color": "#eff6ff", "iconColor": "#3b82f6"},
        "permissao":    {"icon": "fa-key",              "color": "#eff6ff", "iconColor": "#3b82f6"},
        "acesso":       {"icon": "fa-ban",              "color": "#fee2e2", "iconColor": "#ef4444"},
        "relatorio":    {"icon": "fa-chart-bar",        "color": "#f5f3ff", "iconColor": "#7c3aed"},
        "sistema":      {"icon": "fa-gear",             "color": "#f1f5f9", "iconColor": "#64748b"},
    }
    agora = datetime.now(timezone.utc)
    def tempo_relativo(momento):
        if momento is None: return "—"
        if momento.tzinfo is None: momento = momento.replace(tzinfo=timezone.utc)
        diff = int((agora - momento).total_seconds())
        if diff < 60: return "agora"
        if diff < 3600: return f"{diff // 60}min"
        if diff < 86400: return f"{diff // 3600}h"
        return f"{diff // 86400}d"
    return [{**ICONES.get(log.tipo_evento, ICONES["sistema"]), "title": log.detalhe,
             "sub": log.email_usuario or "sistema", "time": tempo_relativo(log.momento)} for log in logs]


@router.get("/dashboard/workspaces")
def dashboard_workspaces(db: Session = Depends(get_db)):
    workspaces = db.query(EspacoTrabalho).filter(EspacoTrabalho.status == "ativo").order_by(EspacoTrabalho.nome).all()
    resultado = []
    for ws in workspaces:
        publicados = db.query(Relatorio).filter(Relatorio.espaco_trabalho_id == ws.id, Relatorio.status == "publicado").count()
        rascunhos  = db.query(Relatorio).filter(Relatorio.espaco_trabalho_id == ws.id, Relatorio.status == "rascunho").count()
        acesso_total = db.query(AcessoWorkspace).join(Usuario, AcessoWorkspace.usuario_id == Usuario.id).filter(
            AcessoWorkspace.espaco_trabalho_id == ws.id, AcessoWorkspace.nivel_acesso == "total",
            Usuario.perfil.notin_(["master", "administrador"])).count()
        acesso_parcial = db.query(AcessoWorkspace).join(Usuario, AcessoWorkspace.usuario_id == Usuario.id).filter(
            AcessoWorkspace.espaco_trabalho_id == ws.id, AcessoWorkspace.nivel_acesso == "apenas_relatorios",
            Usuario.perfil.notin_(["master", "administrador"])).count()
        resultado.append({"nome": ws.nome, "cor": ws.cor, "reports": publicados + rascunhos,
                          "publicados": publicados, "rascunhos": rascunhos, "totalAccess": acesso_total, "partialAccess": acesso_parcial})
    return resultado


@router.get("/dashboard/expediente")
def dashboard_expediente(db: Session = Depends(get_db)):
    agora = datetime.now()
    dia_modelo = (agora.weekday() + 1) % 7
    regra = db.query(RegraExpediente).filter(RegraExpediente.dia_semana == dia_modelo).first()
    if not regra:
        return {"configurado": False, "dentro_expediente": False, "bloquear_fora": False,
                "hora_inicio": None, "hora_fim": None, "hora_atual": agora.strftime("%H:%M")}
    hora_atual = agora.time()
    dentro = regra.hora_inicio <= hora_atual <= regra.hora_fim
    return {"configurado": True, "dentro_expediente": dentro, "bloquear_fora": regra.bloquear_fora,
            "hora_inicio": regra.hora_inicio.strftime("%H:%M"), "hora_fim": regra.hora_fim.strftime("%H:%M"),
            "hora_atual": agora.strftime("%H:%M")}


@router.get("/dashboard/acessos-por-dia")
def dashboard_acessos_por_dia(
    periodo: str = Query("semanal", pattern="^(diario|semanal|mensal)$"),
    data: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    hoje = datetime.now(timezone.utc).date()
    LABELS_DIA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    if periodo == "diario":
        try: dia = date_type.fromisoformat(data) if data else hoje
        except ValueError: dia = hoje
        resultado = []
        for hora in range(24):
            logins = db.query(LogAuditoria).filter(LogAuditoria.tipo_evento == "autenticacao", LogAuditoria.detalhe.ilike("%sucesso%"),
                func.date(LogAuditoria.momento) == dia, func.extract("hour", LogAuditoria.momento) == hora).count()
            negados = db.query(LogAuditoria).filter(LogAuditoria.tipo_evento == "seguranca",
                func.date(LogAuditoria.momento) == dia, func.extract("hour", LogAuditoria.momento) == hora).count()
            resultado.append({"label": f"{hora:02d}h", "logins": logins, "negados": negados})
        return resultado
    if periodo == "semanal":
        dias = [hoje - timedelta(days=i) for i in range(6, -1, -1)]
        return [{"label": f"{LABELS_DIA[d.weekday()]} {d.strftime('%d/%m')}",
                 "logins": db.query(LogAuditoria).filter(LogAuditoria.tipo_evento == "autenticacao", LogAuditoria.detalhe.ilike("%sucesso%"), func.date(LogAuditoria.momento) == d).count(),
                 "negados": db.query(LogAuditoria).filter(LogAuditoria.tipo_evento == "seguranca", func.date(LogAuditoria.momento) == d).count()} for d in dias]
    dias = [hoje - timedelta(days=i) for i in range(29, -1, -1)]
    return [{"label": d.strftime("%d/%m"),
             "logins": db.query(LogAuditoria).filter(LogAuditoria.tipo_evento == "autenticacao", LogAuditoria.detalhe.ilike("%sucesso%"), func.date(LogAuditoria.momento) == d).count(),
             "negados": db.query(LogAuditoria).filter(LogAuditoria.tipo_evento == "seguranca", func.date(LogAuditoria.momento) == d).count()} for d in dias]


@router.get("/dashboard/top-relatorios")
def dashboard_top_relatorios(
    limit: int = Query(8, ge=1, le=20),
    periodo: str = Query("semanal", pattern="^(diario|semanal|mensal)$"),
    data: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    hoje = datetime.now(timezone.utc).date()
    if periodo == "diario":
        try: dia = date_type.fromisoformat(data) if data else hoje
        except ValueError: dia = hoje
        filtro_data = func.date(LogAuditoria.momento) == dia
    elif periodo == "semanal":
        filtro_data = func.date(LogAuditoria.momento) >= hoje - timedelta(days=7)
    else:
        filtro_data = func.date(LogAuditoria.momento) >= hoje - timedelta(days=30)
    rows = (db.query(LogAuditoria.detalhe, func.count(LogAuditoria.id).label("acessos"))
            .filter(LogAuditoria.tipo_evento == "relatorio", filtro_data)
            .group_by(LogAuditoria.detalhe).order_by(func.count(LogAuditoria.id).desc()).limit(limit).all())
    resultado = []
    for row in rows:
        nome = row.detalhe.replace("Relatório visualizado: ", "")
        rel = db.query(Relatorio).filter(Relatorio.nome == nome).first()
        cor = None
        if rel:
            ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == rel.espaco_trabalho_id).first()
            cor = ws.cor if ws else None
        resultado.append({"nome": nome, "acessos": row.acessos, "cor": cor})
    return resultado

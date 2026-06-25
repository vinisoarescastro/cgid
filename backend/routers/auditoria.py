from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List
from datetime import datetime
import csv, io
from database import get_db
from models import LogAuditoria, Usuario, HistoricoConfigCritica
from schemas import LogItem, LogsResponse

router = APIRouter(tags=["auditoria"])


def _build_log_query(db, tipo_evento, modulo, usuario, ip, data_inicio, data_fim):
    q = db.query(LogAuditoria)
    if tipo_evento:
        q = q.filter(LogAuditoria.tipo_evento == tipo_evento)
    if modulo:
        q = q.filter(LogAuditoria.modulo == modulo)
    if usuario:
        termo = f"%{usuario}%"
        q = q.filter(or_(LogAuditoria.nome_usuario.ilike(termo), LogAuditoria.email_usuario.ilike(termo)))
    if ip:
        q = q.filter(LogAuditoria.endereco_ip.ilike(f"%{ip}%"))
    if data_inicio:
        q = q.filter(func.date(LogAuditoria.momento) >= data_inicio)
    if data_fim:
        q = q.filter(func.date(LogAuditoria.momento) <= data_fim)
    return q


@router.get("/auditoria", response_model=LogsResponse)
def listar_logs(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(50, ge=1, le=200),
    tipo_evento: Optional[str] = Query(None),
    modulo: Optional[str] = Query(None),
    usuario: Optional[str] = Query(None),
    ip: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = _build_log_query(db, tipo_evento, modulo, usuario, ip, data_inicio, data_fim)
    total = q.count()
    logs = q.order_by(LogAuditoria.momento.desc()).offset((pagina - 1) * por_pagina).limit(por_pagina).all()
    ids_usuarios = {l.usuario_id for l in logs if l.usuario_id}
    usuarios_map = {u.id: u for u in db.query(Usuario).filter(Usuario.id.in_(ids_usuarios)).all()} if ids_usuarios else {}
    return LogsResponse(
        total=total, pagina=pagina, paginas=max(1, -(-total // por_pagina)),
        itens=[LogItem(
            id=l.id, momento=l.momento.isoformat() if l.momento else "",
            usuario_id=l.usuario_id,
            nome_usuario=usuarios_map[l.usuario_id].nome if l.usuario_id in usuarios_map else l.nome_usuario,
            email_usuario=usuarios_map[l.usuario_id].email if l.usuario_id in usuarios_map else l.email_usuario,
            tipo_evento=l.tipo_evento, modulo=l.modulo, detalhe=l.detalhe,
            endereco_ip=l.endereco_ip, valor_anterior=l.valor_anterior, valor_novo=l.valor_novo,
        ) for l in logs],
    )


@router.get("/auditoria/export-csv")
def exportar_logs_csv(
    tipo_evento: Optional[str] = Query(None),
    modulo: Optional[str] = Query(None),
    usuario: Optional[str] = Query(None),
    ip: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    logs = _build_log_query(db, tipo_evento, modulo, usuario, ip, data_inicio, data_fim).order_by(LogAuditoria.momento.desc()).all()
    ids_csv = {l.usuario_id for l in logs if l.usuario_id}
    usuarios_csv = {u.id: u for u in db.query(Usuario).filter(Usuario.id.in_(ids_csv)).all()} if ids_csv else {}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ID", "Momento", "Usuário", "E-mail", "Tipo Evento", "Módulo", "Detalhe", "IP", "Valor Anterior", "Valor Novo"])
    for l in logs:
        u_atual = usuarios_csv.get(l.usuario_id)
        w.writerow([l.id, l.momento.isoformat() if l.momento else "",
                    (u_atual.nome if u_atual else l.nome_usuario) or "",
                    (u_atual.email if u_atual else l.email_usuario) or "",
                    l.tipo_evento, l.modulo, l.detalhe, l.endereco_ip or "", l.valor_anterior or "", l.valor_novo or ""])
    buf.seek(0)
    nome = f"auditoria_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(iter([buf.getvalue().encode("utf-8-sig")]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={nome}"})


@router.get("/auditoria/tipos")
def listar_tipos_evento(db: Session = Depends(get_db)):
    rows = db.query(LogAuditoria.tipo_evento).distinct().order_by(LogAuditoria.tipo_evento).all()
    return [r for (r,) in rows]


@router.get("/auditoria/modulos")
def listar_modulos(db: Session = Depends(get_db)):
    rows = db.query(LogAuditoria.modulo).distinct().order_by(LogAuditoria.modulo).all()
    return [r for (r,) in rows]


@router.get("/historico-critico")
def listar_historico_critico(entidade: str, entidade_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(HistoricoConfigCritica).filter(HistoricoConfigCritica.entidade == entidade)
    if entidade_id:
        q = q.filter(HistoricoConfigCritica.entidade_id == entidade_id)
    registros = q.order_by(HistoricoConfigCritica.momento.desc()).limit(20).all()
    return [{"id": r.id, "momento": r.momento.isoformat(), "campo": r.campo,
             "valor_anterior": r.valor_anterior, "valor_novo": r.valor_novo,
             "alterado_por_nome": r.alterado_por_nome, "alterado_por_email": r.alterado_por_email} for r in registros]

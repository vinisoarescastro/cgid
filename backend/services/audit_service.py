from typing import Optional
from sqlalchemy.orm import Session
from fastapi import Request
from models import LogAuditoria, HistoricoConfigCritica, Usuario


def get_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def registrar_log(db: Session, tipo: str, modulo: str, detalhe: str,
                  usuario: Optional[Usuario] = None, ip: Optional[str] = None,
                  valor_anterior: Optional[str] = None, valor_novo: Optional[str] = None,
                  request: Optional[Request] = None):
    if request and not ip:
        ip = get_ip(request)
    db.add(LogAuditoria(
        usuario_id     = usuario.id    if usuario else None,
        nome_usuario   = usuario.nome  if usuario else None,
        email_usuario  = usuario.email if usuario else None,
        tipo_evento    = tipo,
        modulo         = modulo,
        detalhe        = detalhe,
        endereco_ip    = ip,
        valor_anterior = valor_anterior,
        valor_novo     = valor_novo,
    ))


def salvar_backup_critico(db: Session, entidade: str, entidade_id: Optional[str],
                          campo: str, valor_anterior: Optional[str], valor_novo: Optional[str],
                          usuario: Optional[Usuario] = None):
    db.add(HistoricoConfigCritica(
        entidade           = entidade,
        entidade_id        = entidade_id,
        campo              = campo,
        valor_anterior     = valor_anterior,
        valor_novo         = valor_novo,
        alterado_por_id    = usuario.id    if usuario else None,
        alterado_por_nome  = usuario.nome  if usuario else None,
        alterado_por_email = usuario.email if usuario else None,
    ))

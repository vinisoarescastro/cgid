from typing import Optional
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
import hashlib
from datetime import datetime, timezone
from database import SessionLocal, get_db
from models import Usuario, SessaoAutenticacao
from constants import PERFIS_VALIDOS, PERFIS_ADMIN, STATUS_VALIDOS, SENHA_PADRAO  # noqa: F401 — re-exportados para compatibilidade
from services.permission_service import checar_permissao  # noqa: F401 — re-exportado


def get_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def get_usuario_requisicao(request: Request, db: Session) -> Optional[Usuario]:
    uid = request.headers.get("X-Usuario-Id")
    if not uid:
        return None
    return db.query(Usuario).filter(Usuario.id == uid).first()


def exigir_permissao(usuario: Optional[Usuario], modulo: str, acao: str, db: Session):
    if not usuario:
        raise HTTPException(status_code=401, detail="Nao autenticado.")
    if not checar_permissao(usuario, modulo, acao, db):
        raise HTTPException(status_code=403, detail="Permissao insuficiente.")


def require_permission(modulo: str, acao: str):
    """
    Dependency factory para validar permissão e retornar o usuário autenticado.

    Uso: autor: Usuario = Depends(require_permission("usuarios", "criar"))
    """
    def _dep(request: Request, db: Session = Depends(get_db)) -> Usuario:
        usuario = get_usuario_requisicao(request, db)
        exigir_permissao(usuario, modulo, acao, db)
        return usuario
    return _dep


async def validar_sessao_middleware(request: Request, call_next):
    uid = request.headers.get("X-Usuario-Id")
    if not uid:
        return await call_next(request)
    path = request.url.path
    if path.endswith("/alterar-senha") or request.method == "OPTIONS":
        return await call_next(request)

    from fastapi.responses import JSONResponse
    origin = request.headers.get("origin", "http://localhost:5173")
    cors_headers = {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"}

    token_bruto = request.headers.get("X-Session-Token")
    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == uid).first()
        if not usuario:
            return JSONResponse(status_code=401, content={"code": "SESSAO_INVALIDA", "detail": "Sessao invalida."}, headers=cors_headers)
        if usuario.senha_provisoria:
            return JSONResponse(status_code=403, content={"code": "SENHA_PROVISORIA", "detail": "Troca de senha obrigatoria antes de continuar."}, headers=cors_headers)
        if token_bruto:
            hash_token = hashlib.sha256(token_bruto.encode()).hexdigest()
            sessao = db.query(SessaoAutenticacao).filter(
                SessaoAutenticacao.usuario_id == uid,
                SessaoAutenticacao.hash_refresh_token == hash_token,
                SessaoAutenticacao.revogado_em == None,
                SessaoAutenticacao.expira_em > datetime.now(timezone.utc).replace(tzinfo=None),
            ).first()
            if not sessao:
                return JSONResponse(status_code=401, content={"code": "SESSAO_REVOGADA", "detail": "Sua sessao foi encerrada. Faca login novamente."}, headers=cors_headers)
            sessao.ultimo_uso_em = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
    finally:
        db.close()
    return await call_next(request)

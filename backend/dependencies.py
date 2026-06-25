from typing import Optional
from fastapi import Request, HTTPException
from sqlalchemy.orm import Session
import hashlib
from datetime import datetime, timezone
from database import SessionLocal
from models import Usuario, SessaoAutenticacao, PermissaoPerfil, PacotePermissao, PacotePermissaoItem, UsuarioPacote

PERFIS_VALIDOS  = {"master", "administrador", "coordenador", "colaborador", "convidado"}
STATUS_VALIDOS  = {"ativo", "inativo", "bloqueado"}
PERFIS_ADMIN    = {"master", "administrador"}
SENHA_PADRAO    = "Mudar@123"

_CAMPOS_ACAO = {
    "visualizar": "pode_visualizar",
    "criar":      "pode_criar",
    "editar":     "pode_editar",
    "excluir":    "pode_excluir",
    "exportar":   "pode_exportar",
    "gerenciar":  "pode_gerenciar",
}


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


def checar_permissao(usuario: Usuario, modulo: str, acao: str, db: Session) -> bool:
    if usuario.perfil == "master":
        return True
    campo = _CAMPOS_ACAO.get(acao)
    if not campo:
        return False
    pp = db.query(PermissaoPerfil).filter_by(perfil=usuario.perfil, modulo=modulo).first()
    if pp and getattr(pp, campo):
        return True
    pacote_ids = [up.pacote_id for up in db.query(UsuarioPacote).filter_by(usuario_id=usuario.id).all()]
    if pacote_ids:
        itens = db.query(PacotePermissaoItem).filter(
            PacotePermissaoItem.pacote_id.in_(pacote_ids),
            PacotePermissaoItem.modulo == modulo,
        ).all()
        if any(getattr(item, campo) for item in itens):
            return True
    return False


def exigir_permissao(usuario: Optional[Usuario], modulo: str, acao: str, db: Session):
    if not usuario:
        raise HTTPException(status_code=401, detail="Nao autenticado.")
    if not checar_permissao(usuario, modulo, acao, db):
        raise HTTPException(status_code=403, detail="Permissao insuficiente.")


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

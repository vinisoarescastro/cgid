from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import secrets, hashlib
from database import get_db
from models import Usuario, SessaoAutenticacao
from dependencies import get_usuario_requisicao, PERFIS_ADMIN
from services.auth_service import verificar_expediente
from services.audit_service import registrar_log, get_ip
from schemas import LoginInput, LoginResponse, UsuarioPublico
from passlib.context import CryptContext

router = APIRouter(tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
MAX_TENTATIVAS = 5


@router.post("/login", response_model=LoginResponse)
def login(request: Request, dados: LoginInput, db: Session = Depends(get_db)):
    ip = get_ip(request)
    usuario = db.query(Usuario).filter(Usuario.email == dados.email).first()

    if not usuario:
        return LoginResponse(sucesso=False, mensagem="E-mail ou senha incorretos.")
    if usuario.status == "bloqueado":
        return LoginResponse(sucesso=False, mensagem="[B401] Acesso indisponivel. Fale com o administrador.")
    if usuario.status == "inativo":
        return LoginResponse(sucesso=False, mensagem="[I401] Acesso indisponivel. Fale com o administrador.")

    if not pwd.verify(dados.senha, usuario.hash_senha):
        usuario.tentativas_login += 1
        if usuario.tentativas_login >= MAX_TENTATIVAS:
            usuario.status = "bloqueado"
            registrar_log(db, "seguranca", "autenticacao",
                          f"Conta bloqueada apos {MAX_TENTATIVAS} tentativas", usuario, ip=ip)
            db.commit()
            return LoginResponse(sucesso=False, mensagem="Conta bloqueada apos 5 tentativas incorretas.")
        restantes = MAX_TENTATIVAS - usuario.tentativas_login
        registrar_log(db, "seguranca", "autenticacao",
                      f"Tentativa de login com senha incorreta ({usuario.tentativas_login}/{MAX_TENTATIVAS})", usuario, ip=ip)
        db.commit()
        return LoginResponse(sucesso=False, mensagem=f"E-mail ou senha incorretos. {restantes} tentativa(s) restante(s).")

    erro_expediente = verificar_expediente(usuario.id, db) if usuario.perfil not in PERFIS_ADMIN else None
    if erro_expediente:
        registrar_log(db, "seguranca", "autenticacao", f"Acesso negado fora do expediente: {erro_expediente}", usuario, ip=ip)
        db.commit()
        return LoginResponse(sucesso=False, mensagem=erro_expediente)

    usuario.tentativas_login = 0
    usuario.ultimo_login = datetime.now(timezone.utc)
    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    sessoes_ativas = db.query(SessaoAutenticacao).filter(
        SessaoAutenticacao.usuario_id == usuario.id,
        SessaoAutenticacao.revogado_em == None,
        SessaoAutenticacao.expira_em > agora,
    ).all()

    if sessoes_ativas:
        ip_anterior = sessoes_ativas[0].endereco_ip
        registrar_log(db, "seguranca", "autenticacao",
            f"Nova sessao iniciada com sessao anterior ativa (IP anterior: {ip_anterior}, IP atual: {ip}). Sessao anterior revogada.",
            usuario, ip=ip)
        for s in sessoes_ativas:
            s.revogado_em = agora

    token_bruto = secrets.token_urlsafe(32)
    hash_token  = hashlib.sha256(token_bruto.encode()).hexdigest()
    nova_sessao = SessaoAutenticacao(
        usuario_id         = usuario.id,
        hash_refresh_token = hash_token,
        expira_em          = agora + timedelta(hours=12),
        endereco_ip        = ip,
        user_agent         = request.headers.get("User-Agent", "")[:500],
    )
    db.add(nova_sessao)
    registrar_log(db, "autenticacao", "autenticacao", "Login realizado com sucesso", usuario, ip=ip)
    db.commit()

    return LoginResponse(
        sucesso=True,
        mensagem="Login realizado com sucesso.",
        usuario=UsuarioPublico.model_validate(usuario),
        requer_troca_senha=usuario.senha_provisoria,
        session_token=token_bruto,
    )


@router.post("/api/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    usuario = get_usuario_requisicao(request, db)
    if not usuario:
        return {"ok": True}
    token_bruto = request.headers.get("X-Session-Token", "")
    if token_bruto:
        hash_token = hashlib.sha256(token_bruto.encode()).hexdigest()
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        sessao = db.query(SessaoAutenticacao).filter(
            SessaoAutenticacao.usuario_id == usuario.id,
            SessaoAutenticacao.hash_refresh_token == hash_token,
            SessaoAutenticacao.revogado_em == None,
        ).first()
        if sessao:
            sessao.revogado_em = agora
    registrar_log(db, "autenticacao", "autenticacao", "Logout realizado", usuario, request=request)
    db.commit()
    return {"ok": True}


@router.get("/sessao/ping")
def sessao_ping():
    return {"ok": True}

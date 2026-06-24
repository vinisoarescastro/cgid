from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta, date as date_type, time as dtime
from zoneinfo import ZoneInfo
from pathlib import Path
import csv, io, json, os, secrets, hashlib
import requests as http_requests

from database import engine, get_db, Base
from models import Usuario, LogAuditoria, EspacoTrabalho, Relatorio, AcessoWorkspace, AcessoRelatorio, RegraExpediente, GrupoExcecao, MembroGrupoExcecao, ConfiguracaoSistema, Favorito, HistoricoConfigCritica, SessaoAutenticacao, PermissaoPerfil, SobrescritaPermissao

Base.metadata.create_all(bind=engine)

# ─── Seed de permissões padrão ───────────────────────────────────────────────
_MATRIZ_PERMISSOES_DEFAULT = {
    # perfil -> modulo -> (visualizar, criar, editar, excluir, exportar, gerenciar)
    "master": {
        m: (True, True, True, True, True, True)
        for m in ["usuarios", "permissoes", "relatorios", "workspaces", "auditoria",
                  "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank"]
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
    },
    "colaborador": {
        m: (False, False, False, False, False, False)
        for m in ["usuarios", "permissoes", "workspaces", "auditoria",
                  "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank"]
    } | {"relatorios": (True, False, False, False, False, False)},
    "convidado": {
        m: (False, False, False, False, False, False)
        for m in ["usuarios", "permissoes", "workspaces", "auditoria",
                  "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank"]
    } | {"relatorios": (True, False, False, False, False, False)},
}


def _garantir_permissoes_default(db: Session):
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


# ─── Helpers de permissão ─────────────────────────────────────────────────────
_CAMPOS_ACAO = {
    "visualizar": "pode_visualizar",
    "criar":      "pode_criar",
    "editar":     "pode_editar",
    "excluir":    "pode_excluir",
    "exportar":   "pode_exportar",
    "gerenciar":  "pode_gerenciar",
}


def checar_permissao(usuario: "Usuario", modulo: str, acao: str, db: Session) -> bool:
    if usuario.perfil == "master":
        return True
    campo = _CAMPOS_ACAO.get(acao)
    if not campo:
        return False
    sobrescrita = db.query(SobrescritaPermissao).filter_by(
        usuario_id=usuario.id, modulo=modulo
    ).first()
    if sobrescrita:
        valor = getattr(sobrescrita, campo)
        if valor is not None:
            return valor
    pp = db.query(PermissaoPerfil).filter_by(perfil=usuario.perfil, modulo=modulo).first()
    if pp:
        return bool(getattr(pp, campo))
    return False


def exigir_permissao(usuario: "Usuario", modulo: str, acao: str, db: Session):
    if not checar_permissao(usuario, modulo, acao, db):
        raise HTTPException(status_code=403, detail="Permissão insuficiente.")


app = FastAPI(title="CGID API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    from database import SessionLocal
    db = SessionLocal()
    try:
        _garantir_permissoes_default(db)
    finally:
        db.close()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

MAX_TENTATIVAS = 5

from database import SessionLocal

@app.middleware("http")
async def validar_sessao(request: Request, call_next):
    uid = request.headers.get("X-Usuario-Id")
    if not uid:
        return await call_next(request)
    path = request.url.path
    if path.endswith("/alterar-senha") or request.method == "OPTIONS":
        return await call_next(request)

    # Preserva o header CORS nas respostas diretas do middleware
    origin = request.headers.get("origin", "http://localhost:5173")
    cors_headers = {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"}

    token_bruto = request.headers.get("X-Session-Token")
    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == uid).first()
        if not usuario:
            return JSONResponse(status_code=401, content={"code": "SESSAO_INVALIDA", "detail": "Sessão inválida."}, headers=cors_headers)

        if usuario.senha_provisoria:
            return JSONResponse(status_code=403, content={"code": "SENHA_PROVISORIA", "detail": "Troca de senha obrigatória antes de continuar."}, headers=cors_headers)

        if token_bruto:
            hash_token = hashlib.sha256(token_bruto.encode()).hexdigest()
            sessao = db.query(SessaoAutenticacao).filter(
                SessaoAutenticacao.usuario_id == uid,
                SessaoAutenticacao.hash_refresh_token == hash_token,
                SessaoAutenticacao.revogado_em == None,
                SessaoAutenticacao.expira_em > datetime.now(timezone.utc).replace(tzinfo=None),
            ).first()
            if not sessao:
                return JSONResponse(status_code=401, content={"code": "SESSAO_REVOGADA", "detail": "Sua sessão foi encerrada. Faça login novamente."}, headers=cors_headers)
            sessao.ultimo_uso_em = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
    finally:
        db.close()
    return await call_next(request)


# ─── Schemas ─────────────────────────────────────────────────────────────────
class LoginInput(BaseModel):
    email: str
    senha: str

class UsuarioPublico(BaseModel):
    id: str
    nome: str
    email: str
    perfil: str
    foto_url: Optional[str] = None

    model_config = {"from_attributes": True}

class LoginResponse(BaseModel):
    sucesso: bool
    mensagem: str
    usuario: Optional[UsuarioPublico] = None
    requer_troca_senha: bool = False
    session_token: Optional[str] = None


# ─── Utilitários ─────────────────────────────────────────────────────────────
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



TZ_BRASILIA = ZoneInfo("America/Sao_Paulo")


def _usuario_tem_excecao_horario(usuario_id: str, db: Session) -> bool:
    """Retorna True se o usuário pertence a algum grupo de exceção ativo com fora_horario=True."""
    return db.query(MembroGrupoExcecao).join(GrupoExcecao).filter(
        MembroGrupoExcecao.usuario_id == usuario_id,
        GrupoExcecao.status == "ativo",
        GrupoExcecao.fora_horario == True,
    ).first() is not None


def _vincular_admins_workspace(workspace_id: str, db: Session):
    """Garante que todos os admins/masters ativos tenham AcessoWorkspace total neste workspace."""
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


def _verificar_expediente(usuario_id: str, db: Session) -> Optional[str]:
    """
    Verifica se o acesso está dentro do horário de expediente.
    Retorna mensagem de erro se bloqueado, ou None se liberado.
    """
    agora = datetime.now(TZ_BRASILIA)
    dia_db = agora.isoweekday() % 7  # isoweekday: 1=Seg…7=Dom → 0=Dom, 1=Seg…6=Sab

    regra = db.query(RegraExpediente).filter(RegraExpediente.dia_semana == dia_db).first()

    if not regra:
        return None  # dia sem regra configurada = sem restrição

    if not regra.ativo:
        # Verifica se o usuário está em algum grupo que ignora dias inativos
        pode_ignorar = db.query(MembroGrupoExcecao).join(GrupoExcecao).filter(
            MembroGrupoExcecao.usuario_id == usuario_id,
            GrupoExcecao.status == "ativo",
            GrupoExcecao.ignora_dia_inativo == True,
        ).first()
        if not pode_ignorar:
            return "Acesso não permitido neste dia da semana."

    if not regra.bloquear_fora:
        return None  # regra ativa mas sem bloqueio fora do horário

    hora_atual = agora.time().replace(tzinfo=None)
    if regra.hora_inicio <= hora_atual <= regra.hora_fim:
        return None  # dentro do horário

    if _usuario_tem_excecao_horario(usuario_id, db):
        return None  # usuário tem exceção

    return (
        f"Acesso permitido somente entre {regra.hora_inicio.strftime('%H:%M')} "
        f"e {regra.hora_fim.strftime('%H:%M')}. "
        "Fora do horário de expediente."
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────
@app.get("/")
def inicio():
    return {"mensagem": "CGID no ar!"}


@app.post("/login", response_model=LoginResponse)
def login(request: Request, dados: LoginInput, db: Session = Depends(get_db)):
    ip = get_ip(request)
    usuario = db.query(Usuario).filter(Usuario.email == dados.email).first()

    if not usuario:
        return LoginResponse(sucesso=False, mensagem="E-mail ou senha incorretos.")

    if usuario.status == "bloqueado":
        return LoginResponse(sucesso=False, mensagem="[B401] Acesso indisponível. Fale com o administrador.")

    if usuario.status == "inativo":
        return LoginResponse(sucesso=False, mensagem="[I401] Acesso indisponível. Fale com o administrador.")

    if not pwd.verify(dados.senha, usuario.hash_senha):
        usuario.tentativas_login += 1
        if usuario.tentativas_login >= MAX_TENTATIVAS:
            usuario.status = "bloqueado"
            registrar_log(db, "seguranca", "autenticacao",
                          f"Conta bloqueada após {MAX_TENTATIVAS} tentativas", usuario, ip=ip)
            db.commit()
            return LoginResponse(sucesso=False, mensagem="Conta bloqueada após 5 tentativas incorretas.")
        restantes = MAX_TENTATIVAS - usuario.tentativas_login
        registrar_log(db, "seguranca", "autenticacao",
                      f"Tentativa de login com senha incorreta ({usuario.tentativas_login}/{MAX_TENTATIVAS})", usuario, ip=ip)
        db.commit()
        return LoginResponse(sucesso=False, mensagem=f"E-mail ou senha incorretos. {restantes} tentativa(s) restante(s).")

    erro_expediente = _verificar_expediente(usuario.id, db) if usuario.perfil not in PERFIS_ADMIN else None
    if erro_expediente:
        registrar_log(db, "seguranca", "autenticacao", f"Acesso negado fora do expediente: {erro_expediente}", usuario, ip=ip)
        db.commit()
        return LoginResponse(sucesso=False, mensagem=erro_expediente)

    usuario.tentativas_login = 0
    usuario.ultimo_login = datetime.now(timezone.utc)

    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    # ── Sessão única: revogar sessões ativas anteriores
    sessoes_ativas = db.query(SessaoAutenticacao).filter(
        SessaoAutenticacao.usuario_id == usuario.id,
        SessaoAutenticacao.revogado_em == None,
        SessaoAutenticacao.expira_em > agora,
    ).all()

    if sessoes_ativas:
        ip_anterior = sessoes_ativas[0].endereco_ip
        registrar_log(
            db, "seguranca", "autenticacao",
            f"Nova sessão iniciada com sessão anterior ativa (IP anterior: {ip_anterior}, IP atual: {ip}). Sessão anterior revogada.",
            usuario, ip=ip,
        )
        for s in sessoes_ativas:
            s.revogado_em = agora

    # ── Criar nova sessão
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


@app.post("/api/logout")
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


# ─── Sessão ──────────────────────────────────────────────────────────────────

@app.get("/sessao/ping")
def sessao_ping():
    """Endpoint leve para o frontend verificar se a sessão ainda está ativa.
    A validação real acontece no middleware — se chegar aqui, a sessão é válida."""
    return {"ok": True}


# ─── Schemas de Usuários ─────────────────────────────────────────────────────

class UsuarioListItem(BaseModel):
    id: str
    nome: str
    email: str
    perfil: str
    status: str
    ultimo_login: Optional[datetime] = None
    foto_url: Optional[str] = None
    criado_em: Optional[datetime] = None
    model_config = {"from_attributes": True}

class UsuarioCriar(BaseModel):
    nome: str
    email: str
    senha: Optional[str] = None   # padrão: Mudar@123
    perfil: str

class UsuarioAtualizar(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    perfil: Optional[str] = None
    status: Optional[str] = None
    senha: Optional[str] = None


# ─── Gestão de Usuários ───────────────────────────────────────────────────────

PERFIS_VALIDOS  = {"master", "administrador", "coordenador", "colaborador", "convidado"}
STATUS_VALIDOS  = {"ativo", "inativo", "bloqueado"}
PERFIS_ADMIN    = {"master", "administrador"}

@app.get("/usuarios", response_model=List[UsuarioListItem])
def listar_usuarios(
    status: Optional[str] = None,
    perfil: Optional[str] = None,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Usuario)
    if status:
        q = q.filter(Usuario.status == status)
    if perfil:
        q = q.filter(Usuario.perfil == perfil)
    if busca:
        q = q.filter(
            (Usuario.nome.ilike(f"%{busca}%")) |
            (Usuario.email.ilike(f"%{busca}%"))
        )
    return q.order_by(Usuario.nome).all()


def _vincular_admin_workspaces(usuario_id: str, db: Session):
    """Vincula automaticamente todos os workspaces ativos para admins."""
    todos = db.query(EspacoTrabalho).filter(EspacoTrabalho.status == "ativo").all()
    db.query(AcessoWorkspace).filter(AcessoWorkspace.usuario_id == usuario_id).delete()
    for ws in todos:
        db.add(AcessoWorkspace(
            usuario_id=usuario_id,
            espaco_trabalho_id=ws.id,
            nivel_acesso="total",
        ))


def _usr_snapshot(u):
    return json.dumps({"nome": u.nome, "email": u.email, "perfil": u.perfil, "status": u.status}, ensure_ascii=False)

@app.post("/usuarios", response_model=UsuarioListItem, status_code=201)
def criar_usuario(request: Request, dados: UsuarioCriar, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == dados.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
    if dados.perfil not in PERFIS_VALIDOS:
        raise HTTPException(status_code=422, detail="Perfil inválido.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "criar", db)
    senha = dados.senha if dados.senha else SENHA_PADRAO
    usuario = Usuario(
        nome=dados.nome, email=dados.email,
        hash_senha=pwd.hash(senha), perfil=dados.perfil, status="ativo",
        senha_provisoria=not bool(dados.senha),
    )
    db.add(usuario)
    db.flush()
    if dados.perfil in PERFIS_ADMIN:
        _vincular_admin_workspaces(usuario.id, db)
    registrar_log(db, "usuario", "usuarios", f"Usuário criado: {dados.email}",
                  usuario=autor, request=request,
                  valor_novo=json.dumps({"nome": dados.nome, "email": dados.email, "perfil": dados.perfil}, ensure_ascii=False))
    db.commit()
    db.refresh(usuario)
    return usuario


@app.put("/usuarios/{usuario_id}", response_model=UsuarioListItem)
def atualizar_usuario(usuario_id: str, request: Request, dados: UsuarioAtualizar, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor    = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "editar", db)
    anterior = _usr_snapshot(usuario)
    if dados.email and dados.email != usuario.email:
        if db.query(Usuario).filter(Usuario.email == dados.email).first():
            raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
        usuario.email = dados.email
    if dados.nome:
        usuario.nome = dados.nome
    perfil_anterior = usuario.perfil
    if dados.perfil:
        if dados.perfil not in PERFIS_VALIDOS:
            raise HTTPException(status_code=422, detail="Perfil inválido.")
        usuario.perfil = dados.perfil
        if dados.perfil in PERFIS_ADMIN and perfil_anterior not in PERFIS_ADMIN:
            _vincular_admin_workspaces(usuario.id, db)
    if dados.status:
        if dados.status not in STATUS_VALIDOS:
            raise HTTPException(status_code=422, detail="Status inválido.")
        if dados.status == "ativo":
            usuario.tentativas_login = 0
        usuario.status = dados.status
    if dados.senha:
        usuario.hash_senha = pwd.hash(dados.senha)
    registrar_log(db, "usuario", "usuarios", f"Usuário atualizado: {usuario.email}",
                  usuario=autor, request=request, valor_anterior=anterior, valor_novo=_usr_snapshot(usuario))
    db.commit()
    db.refresh(usuario)
    return usuario


SENHA_PADRAO = "Mudar@123"

@app.post("/usuarios/{usuario_id}/resetar-senha", status_code=200)
def resetar_senha(usuario_id: str, request: Request, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "editar", db)
    usuario.hash_senha = pwd.hash(SENHA_PADRAO)
    usuario.senha_provisoria = True
    usuario.tentativas_login = 0
    if usuario.status == "bloqueado":
        usuario.status = "ativo"
    registrar_log(db, "usuario", "usuarios", f"Senha redefinida para padrão: {usuario.email}", usuario=autor, request=request)
    db.commit()
    return {"mensagem": "Senha redefinida para o padrão com sucesso."}


class AlterarSenhaInput(BaseModel):
    senha_nova: str
    confirmacao: str

@app.post("/usuarios/{usuario_id}/alterar-senha", status_code=200)
def alterar_senha(usuario_id: str, request: Request, dados: AlterarSenhaInput, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Apenas o próprio usuário pode alterar sua senha por este endpoint
    uid_requisicao = request.headers.get("X-Usuario-Id")
    if uid_requisicao != usuario_id:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar a senha deste usuário.")

    if dados.senha_nova != dados.confirmacao:
        raise HTTPException(status_code=422, detail="As senhas não coincidem.")
    if len(dados.senha_nova) < 8:
        raise HTTPException(status_code=422, detail="A senha deve ter pelo menos 8 caracteres.")
    if dados.senha_nova == SENHA_PADRAO:
        raise HTTPException(status_code=422, detail="Escolha uma senha diferente da senha padrão do sistema.")

    usuario.hash_senha = pwd.hash(dados.senha_nova)
    usuario.senha_provisoria = False
    registrar_log(db, "usuario", "usuarios", f"Senha alterada pelo próprio usuário: {usuario.email}",
                  usuario=usuario, request=request)
    db.commit()
    return {"mensagem": "Senha alterada com sucesso."}


@app.delete("/usuarios/{usuario_id}", status_code=204)
def excluir_usuario(usuario_id: str, request: Request, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "excluir", db)
    registrar_log(db, "usuario", "usuarios", f"Usuário excluído: {usuario.email}",
                  usuario=autor, request=request, valor_anterior=_usr_snapshot(usuario))
    db.delete(usuario)
    db.commit()


# ─── Workspaces ───────────────────────────────────────────────────────────────

class WorkspaceItem(BaseModel):
    id: str
    nome: str
    icone: Optional[str] = None
    cor: Optional[str] = None
    descricao: Optional[str] = None
    id_workspace_pbi: Optional[str] = None
    status: str
    model_config = {"from_attributes": True}

class AcessoWorkspaceItem(BaseModel):
    espaco_trabalho_id: str
    nome: str
    icone: Optional[str] = None
    cor: Optional[str] = None
    nivel_acesso: str

class AcessoWorkspaceInput(BaseModel):
    espaco_trabalho_id: str
    nivel_acesso: str  # total | apenas_relatorios | nenhum

NIVEIS_VALIDOS = {"total", "apenas_relatorios", "nenhum"}

@app.get("/workspaces", response_model=List[WorkspaceItem])
def listar_workspaces(incluir_arquivados: bool = False, db: Session = Depends(get_db)):
    q = db.query(EspacoTrabalho)
    if not incluir_arquivados:
        q = q.filter(EspacoTrabalho.status == "ativo")
    return q.order_by(EspacoTrabalho.nome).all()


@app.get("/usuarios/{usuario_id}/expediente")
def expediente_usuario(usuario_id: str, db: Session = Depends(get_db)):
    """Retorna o status de expediente personalizado do usuário, considerando grupos de exceção."""
    agora = datetime.now(TZ_BRASILIA)
    dia_db = agora.isoweekday() % 7
    hora_atual = agora.time().replace(tzinfo=None)

    regra = db.query(RegraExpediente).filter(
        RegraExpediente.dia_semana == dia_db,
    ).first()

    if not regra:
        return {
            "configurado": False,
            "dentro_expediente": True,
            "hora_inicio": None,
            "hora_fim": None,
            "hora_atual": agora.strftime("%H:%M"),
            "excecao_ativa": False,
            "janela_excecao": None,
        }

    if not regra.ativo:
        pode_ignorar = db.query(MembroGrupoExcecao).join(GrupoExcecao).filter(
            MembroGrupoExcecao.usuario_id == usuario_id,
            GrupoExcecao.status == "ativo",
            GrupoExcecao.ignora_dia_inativo == True,
        ).first()
        if not pode_ignorar:
            return {
                "configurado": True,
                "dentro_expediente": False,
                "bloquear_fora": True,
                "hora_inicio": None,
                "hora_fim": None,
                "hora_atual": agora.strftime("%H:%M"),
                "excecao_ativa": False,
                "janela_excecao": None,
                "dia_inativo": True,
            }
        # usuário tem grupo que ignora dia inativo — trata como dia ativo sem restrição de horário
        return {
            "configurado": True,
            "dentro_expediente": True,
            "bloquear_fora": False,
            "hora_inicio": None,
            "hora_fim": None,
            "hora_atual": agora.strftime("%H:%M"),
            "excecao_ativa": True,
            "janela_excecao": None,
            "dia_inativo": False,
        }

    dentro_base = regra.hora_inicio <= hora_atual <= regra.hora_fim

    # Busca grupos de exceção ativos do usuário com janela de horário definida
    grupos = (
        db.query(GrupoExcecao)
        .join(MembroGrupoExcecao, MembroGrupoExcecao.grupo_id == GrupoExcecao.id)
        .filter(
            MembroGrupoExcecao.usuario_id == usuario_id,
            GrupoExcecao.status == "ativo",
            GrupoExcecao.fora_horario == True,
        ).all()
    )

    janela_excecao = None
    dentro_excecao = False

    if not dentro_base:
        for g in grupos:
            if g.janela_inicio and g.janela_fim:
                if g.janela_inicio <= hora_atual <= g.janela_fim:
                    dentro_excecao = True
                    janela_excecao = f"{g.janela_inicio.strftime('%H:%M')} – {g.janela_fim.strftime('%H:%M')}"
                    break
            else:
                dentro_excecao = True
                break

    excecao_ativa = dentro_excecao  # só ativa quando é ela que garante o acesso
    dentro = dentro_base or dentro_excecao

    return {
        "configurado": True,
        "dentro_expediente": dentro,
        "bloquear_fora": regra.bloquear_fora,
        "hora_inicio": regra.hora_inicio.strftime("%H:%M"),
        "hora_fim": regra.hora_fim.strftime("%H:%M"),
        "hora_atual": agora.strftime("%H:%M"),
        "excecao_ativa": excecao_ativa,
        "janela_excecao": janela_excecao,
    }


@app.get("/usuarios/{usuario_id}/minha-home")
def minha_home(usuario_id: str, db: Session = Depends(get_db)):
    """Retorna workspaces acessíveis + relatórios de cada um para o usuário."""
    acessos = (
        db.query(AcessoWorkspace, EspacoTrabalho)
        .join(EspacoTrabalho, AcessoWorkspace.espaco_trabalho_id == EspacoTrabalho.id)
        .filter(AcessoWorkspace.usuario_id == usuario_id, EspacoTrabalho.status == "ativo")
        .all()
    )

    resultado = []
    for acesso, ws in acessos:
        if acesso.nivel_acesso == "apenas_relatorios":
            ids_permitidos = {
                r for (r,) in db.query(AcessoRelatorio.relatorio_id)
                .filter(AcessoRelatorio.usuario_id == usuario_id)
                .all()
            }
            relatorios = db.query(Relatorio).filter(
                Relatorio.espaco_trabalho_id == ws.id,
                Relatorio.status == "publicado",
                Relatorio.id.in_(ids_permitidos),
            ).order_by(Relatorio.nome).all()
        else:
            relatorios = db.query(Relatorio).filter(
                Relatorio.espaco_trabalho_id == ws.id,
                Relatorio.status == "publicado",
            ).order_by(Relatorio.nome).all()

        resultado.append({
            "id": ws.id,
            "nome": ws.nome,
            "icone": ws.icone,
            "cor": ws.cor,
            "descricao": ws.descricao,
            "nivel_acesso": acesso.nivel_acesso,
            "relatorios": [
                {"id": r.id, "nome": r.nome, "categoria": r.categoria, "id_relatorio_pbi": r.id_relatorio_pbi}
                for r in relatorios
            ],
        })

    return resultado


@app.get("/usuarios/{usuario_id}/acessos", response_model=List[AcessoWorkspaceItem])
def listar_acessos_usuario(usuario_id: str, db: Session = Depends(get_db)):
    acessos = (
        db.query(AcessoWorkspace, EspacoTrabalho)
        .join(EspacoTrabalho, AcessoWorkspace.espaco_trabalho_id == EspacoTrabalho.id)
        .filter(AcessoWorkspace.usuario_id == usuario_id, EspacoTrabalho.status == "ativo")
        .all()
    )
    return [
        AcessoWorkspaceItem(
            espaco_trabalho_id=a.espaco_trabalho_id,
            nome=ws.nome,
            icone=ws.icone,
            cor=ws.cor,
            nivel_acesso=a.nivel_acesso,
        )
        for a, ws in acessos
    ]


@app.put("/usuarios/{usuario_id}/acessos", status_code=200)
def salvar_acessos_usuario(
    usuario_id: str,
    request: Request,
    acessos: List[AcessoWorkspaceInput],
    db: Session = Depends(get_db),
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "editar", db)

    if usuario.perfil in PERFIS_ADMIN:
        _vincular_admin_workspaces(usuario_id, db)
        registrar_log(db, "acesso", "acessos_workspace",
                      f"Acessos atualizados (admin): {usuario.email}", usuario=autor, request=request)
        db.commit()
        return {"mensagem": "Acessos salvos com sucesso."}

    for item in acessos:
        if item.nivel_acesso not in NIVEIS_VALIDOS:
            raise HTTPException(status_code=422, detail=f"Nível de acesso inválido: {item.nivel_acesso}")

    db.query(AcessoWorkspace).filter(AcessoWorkspace.usuario_id == usuario_id).delete()
    novos = []
    for item in acessos:
        if item.nivel_acesso != "nenhum":
            db.add(AcessoWorkspace(
                usuario_id=usuario_id,
                espaco_trabalho_id=item.espaco_trabalho_id,
                nivel_acesso=item.nivel_acesso,
            ))
            novos.append(f"{item.espaco_trabalho_id}={item.nivel_acesso}")

    registrar_log(db, "acesso", "acessos_workspace",
                  f"Acessos atualizados: {usuario.email}",
                  usuario=autor, request=request,
                  valor_novo=json.dumps({"acessos": novos}, ensure_ascii=False))
    db.commit()
    return {"mensagem": "Acessos salvos com sucesso."}


# ─── Favoritos ────────────────────────────────────────────────────────────────

class FavoritoItem(BaseModel):
    relatorio_id:      str
    relatorio_nome:    str
    relatorio_status:  str
    id_relatorio_pbi:  Optional[str]
    workspace_id:      str
    workspace_nome:    str
    workspace_icone:   Optional[str]
    workspace_cor:     Optional[str]
    criado_em:         str

class FavoritoInput(BaseModel):
    relatorio_id: str

@app.get("/usuarios/{usuario_id}/favoritos", response_model=List[FavoritoItem])
def listar_favoritos(usuario_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Favorito, Relatorio, EspacoTrabalho)
        .join(Relatorio, Favorito.relatorio_id == Relatorio.id)
        .join(EspacoTrabalho, Relatorio.espaco_trabalho_id == EspacoTrabalho.id)
        .filter(Favorito.usuario_id == usuario_id)
        .order_by(Favorito.criado_em.desc())
        .all()
    )
    return [
        FavoritoItem(
            relatorio_id=fav.relatorio_id,
            relatorio_nome=rel.nome,
            relatorio_status=rel.status,
            id_relatorio_pbi=rel.id_relatorio_pbi,
            workspace_id=ws.id,
            workspace_nome=ws.nome,
            workspace_icone=ws.icone,
            workspace_cor=ws.cor,
            criado_em=fav.criado_em.isoformat() if fav.criado_em else "",
        )
        for fav, rel, ws in rows
    ]

@app.post("/usuarios/{usuario_id}/favoritos", status_code=201)
def adicionar_favorito(usuario_id: str, dados: FavoritoInput, db: Session = Depends(get_db)):
    existente = db.query(Favorito).filter(
        Favorito.usuario_id == usuario_id,
        Favorito.relatorio_id == dados.relatorio_id,
    ).first()
    if not existente:
        db.add(Favorito(usuario_id=usuario_id, relatorio_id=dados.relatorio_id))
        db.commit()
    return {"mensagem": "Favoritado."}

@app.delete("/usuarios/{usuario_id}/favoritos/{relatorio_id}", status_code=204)
def remover_favorito(usuario_id: str, relatorio_id: str, db: Session = Depends(get_db)):
    fav = db.query(Favorito).filter(
        Favorito.usuario_id == usuario_id,
        Favorito.relatorio_id == relatorio_id,
    ).first()
    if fav:
        db.delete(fav)
        db.commit()


# ─── Auditoria ────────────────────────────────────────────────────────────────

class LogItem(BaseModel):
    id:            str
    momento:       str
    usuario_id:    Optional[str]
    nome_usuario:  Optional[str]
    email_usuario: Optional[str]
    tipo_evento:   str
    modulo:        str
    detalhe:       str
    endereco_ip:   Optional[str]
    valor_anterior: Optional[str]
    valor_novo:     Optional[str]

class LogsResponse(BaseModel):
    total:  int
    pagina: int
    paginas: int
    itens:  List[LogItem]

def _build_log_query(db, tipo_evento, modulo, usuario, ip, data_inicio, data_fim):
    q = db.query(LogAuditoria)
    if tipo_evento:
        q = q.filter(LogAuditoria.tipo_evento == tipo_evento)
    if modulo:
        q = q.filter(LogAuditoria.modulo == modulo)
    if usuario:
        termo = f"%{usuario}%"
        q = q.filter(or_(
            LogAuditoria.nome_usuario.ilike(termo),
            LogAuditoria.email_usuario.ilike(termo),
        ))
    if ip:
        q = q.filter(LogAuditoria.endereco_ip.ilike(f"%{ip}%"))
    if data_inicio:
        q = q.filter(func.date(LogAuditoria.momento) >= data_inicio)
    if data_fim:
        q = q.filter(func.date(LogAuditoria.momento) <= data_fim)
    return q

@app.get("/auditoria", response_model=LogsResponse)
def listar_logs(
    pagina:      int           = Query(1, ge=1),
    por_pagina:  int           = Query(50, ge=1, le=200),
    tipo_evento: Optional[str] = Query(None),
    modulo:      Optional[str] = Query(None),
    usuario:     Optional[str] = Query(None),
    ip:          Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim:    Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q     = _build_log_query(db, tipo_evento, modulo, usuario, ip, data_inicio, data_fim)
    total = q.count()
    logs  = q.order_by(LogAuditoria.momento.desc()).offset((pagina - 1) * por_pagina).limit(por_pagina).all()

    # resolve nomes atuais em lote (evita N+1)
    ids_usuarios = {l.usuario_id for l in logs if l.usuario_id}
    usuarios_map = {u.id: u for u in db.query(Usuario).filter(Usuario.id.in_(ids_usuarios)).all()} if ids_usuarios else {}

    return LogsResponse(
        total=total,
        pagina=pagina,
        paginas=max(1, -(-total // por_pagina)),
        itens=[
            LogItem(
                id=l.id,
                momento=l.momento.isoformat() if l.momento else "",
                usuario_id=l.usuario_id,
                nome_usuario=usuarios_map[l.usuario_id].nome if l.usuario_id in usuarios_map else l.nome_usuario,
                email_usuario=usuarios_map[l.usuario_id].email if l.usuario_id in usuarios_map else l.email_usuario,
                tipo_evento=l.tipo_evento,
                modulo=l.modulo,
                detalhe=l.detalhe,
                endereco_ip=l.endereco_ip,
                valor_anterior=l.valor_anterior,
                valor_novo=l.valor_novo,
            )
            for l in logs
        ],
    )

@app.get("/auditoria/export-csv")
def exportar_logs_csv(
    tipo_evento: Optional[str] = Query(None),
    modulo:      Optional[str] = Query(None),
    usuario:     Optional[str] = Query(None),
    ip:          Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim:    Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    logs = _build_log_query(db, tipo_evento, modulo, usuario, ip, data_inicio, data_fim) \
               .order_by(LogAuditoria.momento.desc()).all()

    ids_csv = {l.usuario_id for l in logs if l.usuario_id}
    usuarios_csv = {u.id: u for u in db.query(Usuario).filter(Usuario.id.in_(ids_csv)).all()} if ids_csv else {}

    buf = io.StringIO()
    w   = csv.writer(buf)
    w.writerow(["ID", "Momento", "Usuário", "E-mail", "Tipo Evento", "Módulo", "Detalhe", "IP", "Valor Anterior", "Valor Novo"])
    for l in logs:
        u_atual = usuarios_csv.get(l.usuario_id)
        w.writerow([
            l.id,
            l.momento.isoformat() if l.momento else "",
            (u_atual.nome if u_atual else l.nome_usuario) or "",
            (u_atual.email if u_atual else l.email_usuario) or "",
            l.tipo_evento,
            l.modulo,
            l.detalhe,
            l.endereco_ip or "",
            l.valor_anterior or "",
            l.valor_novo or "",
        ])
    buf.seek(0)
    nome = f"auditoria_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={nome}"},
    )

@app.get("/auditoria/tipos")
def listar_tipos_evento(db: Session = Depends(get_db)):
    rows = db.query(LogAuditoria.tipo_evento).distinct().order_by(LogAuditoria.tipo_evento).all()
    return [r for (r,) in rows]

@app.get("/auditoria/modulos")
def listar_modulos(db: Session = Depends(get_db)):
    rows = db.query(LogAuditoria.modulo).distinct().order_by(LogAuditoria.modulo).all()
    return [r for (r,) in rows]


# ─── Dashboard ────────────────────────────────────────────────────────────────

@app.get("/dashboard/kpis")
def dashboard_kpis(db: Session = Depends(get_db)):
    total_usuarios   = db.query(Usuario).filter(Usuario.status == "ativo").count()
    bloqueados       = db.query(Usuario).filter(Usuario.status == "bloqueado").count()
    workspaces_ativos = db.query(EspacoTrabalho).filter(EspacoTrabalho.status == "ativo").count()
    workspaces_total  = db.query(EspacoTrabalho).count()

    hoje = datetime.now(timezone.utc).date()
    logins_hoje = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "autenticacao",
        LogAuditoria.detalhe.ilike("%sucesso%"),
        func.date(LogAuditoria.momento) == hoje,
    ).count()
    acessos_negados = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "seguranca",
        func.date(LogAuditoria.momento) == hoje,
    ).count()
    total_semana = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "seguranca",
        func.date(LogAuditoria.momento) >= hoje - timedelta(days=7),
        func.date(LogAuditoria.momento) < hoje,
    ).count()
    media_semanal = round(total_semana / 7, 1)
    bloqueados_hoje = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "seguranca",
        LogAuditoria.modulo == "autenticacao",
        LogAuditoria.detalhe.ilike("%bloqueada%"),
        func.date(LogAuditoria.momento) == hoje,
    ).count()

    return {
        "usuarios_ativos":      total_usuarios,
        "logins_hoje":          logins_hoje,
        "usuarios_bloqueados":  bloqueados,
        "bloqueados_hoje":      bloqueados_hoje,
        "acessos_negados_hoje": acessos_negados,
        "media_semanal_negados": media_semanal,
        "workspaces_ativos":    workspaces_ativos,
        "workspaces_total":     workspaces_total,
    }


@app.get("/dashboard/eventos")
def dashboard_eventos(db: Session = Depends(get_db)):
    logs = (
        db.query(LogAuditoria)
        .order_by(LogAuditoria.momento.desc())
        .limit(5)
        .all()
    )

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
        if momento is None:
            return "—"
        if momento.tzinfo is None:
            momento = momento.replace(tzinfo=timezone.utc)
        diff = int((agora - momento).total_seconds())
        if diff < 60:
            return "agora"
        if diff < 3600:
            return f"{diff // 60}min"
        if diff < 86400:
            return f"{diff // 3600}h"
        return f"{diff // 86400}d"

    return [
        {
            **ICONES.get(log.tipo_evento, ICONES["sistema"]),
            "title": log.detalhe,
            "sub":   log.email_usuario or "sistema",
            "time":  tempo_relativo(log.momento),
        }
        for log in logs
    ]


@app.get("/dashboard/workspaces")
def dashboard_workspaces(db: Session = Depends(get_db)):
    workspaces = (
        db.query(EspacoTrabalho)
        .filter(EspacoTrabalho.status == "ativo")
        .order_by(EspacoTrabalho.nome)
        .all()
    )

    resultado = []
    for ws in workspaces:
        publicados = db.query(Relatorio).filter(
            Relatorio.espaco_trabalho_id == ws.id,
            Relatorio.status == "publicado",
        ).count()

        rascunhos = db.query(Relatorio).filter(
            Relatorio.espaco_trabalho_id == ws.id,
            Relatorio.status == "rascunho",
        ).count()

        acesso_total = (
            db.query(AcessoWorkspace)
            .join(Usuario, AcessoWorkspace.usuario_id == Usuario.id)
            .filter(
                AcessoWorkspace.espaco_trabalho_id == ws.id,
                AcessoWorkspace.nivel_acesso == "total",
                Usuario.perfil.notin_(["master", "administrador"]),
            ).count()
        )

        acesso_parcial = (
            db.query(AcessoWorkspace)
            .join(Usuario, AcessoWorkspace.usuario_id == Usuario.id)
            .filter(
                AcessoWorkspace.espaco_trabalho_id == ws.id,
                AcessoWorkspace.nivel_acesso == "apenas_relatorios",
                Usuario.perfil.notin_(["master", "administrador"]),
            ).count()
        )

        resultado.append({
            "nome":          ws.nome,
            "cor":           ws.cor,
            "reports":       publicados + rascunhos,
            "publicados":    publicados,
            "rascunhos":     rascunhos,
            "totalAccess":   acesso_total,
            "partialAccess": acesso_parcial,
        })

    return resultado


@app.get("/dashboard/expediente")
def dashboard_expediente(db: Session = Depends(get_db)):
    # Horário apurado exclusivamente no servidor — nunca confia em dado do cliente
    agora = datetime.now()
    dia_semana = agora.weekday()  # 0=Seg … 6=Dom (Python)
    # Modelo usa 0=Dom…6=Sab → converter
    dia_modelo = (dia_semana + 1) % 7

    regra = db.query(RegraExpediente).filter(
        RegraExpediente.dia_semana == dia_modelo,
        RegraExpediente.ativo == True,
    ).first()

    if not regra:
        return {
            "configurado":      False,
            "dentro_expediente": False,
            "bloquear_fora":    False,
            "hora_inicio":      None,
            "hora_fim":         None,
            "hora_atual":       agora.strftime("%H:%M"),
        }

    hora_atual = agora.time()
    dentro = regra.hora_inicio <= hora_atual <= regra.hora_fim

    return {
        "configurado":       True,
        "dentro_expediente": dentro,
        "bloquear_fora":     regra.bloquear_fora,
        "hora_inicio":       regra.hora_inicio.strftime("%H:%M"),
        "hora_fim":          regra.hora_fim.strftime("%H:%M"),
        "hora_atual":        agora.strftime("%H:%M"),
    }


@app.get("/dashboard/acessos-por-dia")
def dashboard_acessos_por_dia(
    periodo: str = Query("semanal", pattern="^(diario|semanal|mensal)$"),
    data: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    hoje = datetime.now(timezone.utc).date()
    LABELS_DIA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

    if periodo == "diario":
        try:
            dia = date_type.fromisoformat(data) if data else hoje
        except ValueError:
            dia = hoje
        resultado = []
        for hora in range(24):
            logins = db.query(LogAuditoria).filter(
                LogAuditoria.tipo_evento == "autenticacao",
                LogAuditoria.detalhe.ilike("%sucesso%"),
                func.date(LogAuditoria.momento) == dia,
                func.extract("hour", LogAuditoria.momento) == hora,
            ).count()
            negados = db.query(LogAuditoria).filter(
                LogAuditoria.tipo_evento == "seguranca",
                func.date(LogAuditoria.momento) == dia,
                func.extract("hour", LogAuditoria.momento) == hora,
            ).count()
            resultado.append({"label": f"{hora:02d}h", "logins": logins, "negados": negados})
        return resultado

    if periodo == "semanal":
        dias = [hoje - timedelta(days=i) for i in range(6, -1, -1)]
        resultado = []
        for dia in dias:
            logins = db.query(LogAuditoria).filter(
                LogAuditoria.tipo_evento == "autenticacao",
                LogAuditoria.detalhe.ilike("%sucesso%"),
                func.date(LogAuditoria.momento) == dia,
            ).count()
            negados = db.query(LogAuditoria).filter(
                LogAuditoria.tipo_evento == "seguranca",
                func.date(LogAuditoria.momento) == dia,
            ).count()
            resultado.append({"label": f"{LABELS_DIA[dia.weekday()]} {dia.strftime('%d/%m')}", "logins": logins, "negados": negados})
        return resultado

    # mensal — últimos 30 dias
    dias = [hoje - timedelta(days=i) for i in range(29, -1, -1)]
    resultado = []
    for dia in dias:
        logins = db.query(LogAuditoria).filter(
            LogAuditoria.tipo_evento == "autenticacao",
            LogAuditoria.detalhe.ilike("%sucesso%"),
            func.date(LogAuditoria.momento) == dia,
        ).count()
        negados = db.query(LogAuditoria).filter(
            LogAuditoria.tipo_evento == "seguranca",
            func.date(LogAuditoria.momento) == dia,
        ).count()
        resultado.append({"label": dia.strftime("%d/%m"), "logins": logins, "negados": negados})
    return resultado


@app.get("/dashboard/top-relatorios")
def dashboard_top_relatorios(
    limit: int = Query(8, ge=1, le=20),
    periodo: str = Query("semanal", pattern="^(diario|semanal|mensal)$"),
    data: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    hoje = datetime.now(timezone.utc).date()

    if periodo == "diario":
        try:
            dia = date_type.fromisoformat(data) if data else hoje
        except ValueError:
            dia = hoje
        filtro_data = func.date(LogAuditoria.momento) == dia
    elif periodo == "semanal":
        filtro_data = func.date(LogAuditoria.momento) >= hoje - timedelta(days=7)
    else:
        filtro_data = func.date(LogAuditoria.momento) >= hoje - timedelta(days=30)

    rows = (
        db.query(
            LogAuditoria.detalhe,
            func.count(LogAuditoria.id).label("acessos"),
        )
        .filter(LogAuditoria.tipo_evento == "relatorio", filtro_data)
        .group_by(LogAuditoria.detalhe)
        .order_by(func.count(LogAuditoria.id).desc())
        .limit(limit)
        .all()
    )
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


# ─── Workspace CRUD ───────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    nome: str
    icone: Optional[str] = None
    cor: Optional[str] = None
    descricao: Optional[str] = None
    id_workspace_pbi: Optional[str] = None

class RelatorioItem(BaseModel):
    id: str
    nome: str
    categoria: Optional[str] = None
    status: str
    descricao: Optional[str] = None
    id_relatorio_pbi: Optional[str] = None
    criado_em: Optional[str] = None

@app.post("/workspaces", response_model=WorkspaceItem, status_code=201)
def criar_workspace(request: Request, dados: WorkspaceCreate, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "criar", db)
    ws = EspacoTrabalho(
        nome=dados.nome, icone=dados.icone, cor=dados.cor,
        descricao=dados.descricao, id_workspace_pbi=dados.id_workspace_pbi, status="ativo",
    )
    db.add(ws)
    db.flush()
    _vincular_admins_workspace(ws.id, db)
    db.commit()
    db.refresh(ws)
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace criado: {ws.nome}",
                  usuario=autor, request=request,
                  valor_novo=json.dumps({"nome": ws.nome, "icone": ws.icone, "cor": ws.cor,
                                         "descricao": ws.descricao, "id_workspace_pbi": ws.id_workspace_pbi}, ensure_ascii=False))
    db.commit()
    return ws

@app.put("/workspaces/{workspace_id}", response_model=WorkspaceItem)
def atualizar_workspace(workspace_id: str, request: Request, dados: WorkspaceCreate, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor   = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    anterior = json.dumps({"nome": ws.nome, "icone": ws.icone, "cor": ws.cor,
                            "descricao": ws.descricao, "id_workspace_pbi": ws.id_workspace_pbi}, ensure_ascii=False)
    id_pbi_anterior = ws.id_workspace_pbi
    ws.nome = dados.nome; ws.icone = dados.icone; ws.cor = dados.cor
    ws.descricao = dados.descricao; ws.id_workspace_pbi = dados.id_workspace_pbi
    db.commit(); db.refresh(ws)
    id_pbi_mudou = id_pbi_anterior != ws.id_workspace_pbi
    tipo_log = "critico" if id_pbi_mudou else "sistema"
    detalhe  = f"ID Power BI do workspace '{ws.nome}' alterado" if id_pbi_mudou else f"Workspace atualizado: {ws.nome}"
    registrar_log(db, tipo_log, "espacos_trabalho", detalhe,
                  usuario=autor, request=request, valor_anterior=anterior,
                  valor_novo=json.dumps({"nome": ws.nome, "icone": ws.icone, "cor": ws.cor,
                                         "descricao": ws.descricao, "id_workspace_pbi": ws.id_workspace_pbi}, ensure_ascii=False))
    if id_pbi_mudou:
        salvar_backup_critico(db, "workspace", ws.id, "id_workspace_pbi", id_pbi_anterior, ws.id_workspace_pbi, autor)
    db.commit()
    return ws

@app.delete("/workspaces/{workspace_id}", status_code=204)
def excluir_workspace(workspace_id: str, request: Request, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "excluir", db)
    nome = ws.nome
    db.delete(ws)
    db.commit()
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace excluído permanentemente: {nome}", usuario=autor, request=request)
    db.commit()

@app.patch("/workspaces/{workspace_id}/arquivar", status_code=200)
def arquivar_workspace(workspace_id: str, request: Request, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    ws.status = "arquivado"
    db.commit()
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace arquivado: {ws.nome}", usuario=autor, request=request)
    db.commit()
    return {"mensagem": "Workspace arquivado com sucesso."}

@app.patch("/workspaces/{workspace_id}/reativar", status_code=200)
def reativar_workspace(workspace_id: str, request: Request, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    ws.status = "ativo"
    _vincular_admins_workspace(ws.id, db)
    db.commit()
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace reativado: {ws.nome}", usuario=autor, request=request)
    db.commit()
    return {"mensagem": "Workspace reativado com sucesso."}

class UsuarioWorkspaceItem(BaseModel):
    usuario_id: str
    nome: str
    email: str
    perfil: str
    nivel_acesso: str  # total | apenas_relatorios

@app.get("/workspaces/{workspace_id}/usuarios", response_model=List[UsuarioWorkspaceItem])
def listar_usuarios_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    registros = (
        db.query(AcessoWorkspace, Usuario)
        .join(Usuario, AcessoWorkspace.usuario_id == Usuario.id)
        .filter(
            AcessoWorkspace.espaco_trabalho_id == workspace_id,
            AcessoWorkspace.nivel_acesso != "nenhum",
            Usuario.status == "ativo",
            Usuario.perfil.notin_(["master", "administrador"]),
        )
        .order_by(Usuario.nome)
        .all()
    )
    return [
        UsuarioWorkspaceItem(
            usuario_id=a.usuario_id,
            nome=u.nome,
            email=u.email,
            perfil=u.perfil,
            nivel_acesso=a.nivel_acesso,
        )
        for a, u in registros
    ]

class VincularUsuarioInput(BaseModel):
    usuario_id: str
    nivel_acesso: str  # total | apenas_relatorios

class AlterarNivelInput(BaseModel):
    nivel_acesso: str

@app.post("/workspaces/{workspace_id}/usuarios", response_model=UsuarioWorkspaceItem, status_code=201)
def vincular_usuario_workspace(workspace_id: str, request: Request, dados: VincularUsuarioInput, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    usuario = db.query(Usuario).filter(Usuario.id == dados.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if dados.nivel_acesso not in NIVEIS_VALIDOS:
        raise HTTPException(status_code=422, detail="Nível de acesso inválido.")
    existente = db.query(AcessoWorkspace).filter(
        AcessoWorkspace.usuario_id == dados.usuario_id,
        AcessoWorkspace.espaco_trabalho_id == workspace_id,
    ).first()
    if existente:
        existente.nivel_acesso = dados.nivel_acesso
    else:
        db.add(AcessoWorkspace(
            usuario_id=dados.usuario_id,
            espaco_trabalho_id=workspace_id,
            nivel_acesso=dados.nivel_acesso,
        ))
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    db.commit()
    registrar_log(db, "acesso", "acessos_workspace",
                  f"Usuário {usuario.email} vinculado ao workspace {ws.nome} ({dados.nivel_acesso})",
                  usuario=autor, request=request,
                  valor_novo=json.dumps({"usuario": usuario.email, "workspace": ws.nome, "nivel": dados.nivel_acesso}, ensure_ascii=False))
    db.commit()
    return UsuarioWorkspaceItem(
        usuario_id=usuario.id, nome=usuario.nome, email=usuario.email,
        perfil=usuario.perfil, nivel_acesso=dados.nivel_acesso,
    )

@app.patch("/workspaces/{workspace_id}/usuarios/{usuario_id}", response_model=UsuarioWorkspaceItem)
def alterar_nivel_usuario_workspace(workspace_id: str, usuario_id: str, request: Request, dados: AlterarNivelInput, db: Session = Depends(get_db)):
    acesso = db.query(AcessoWorkspace).filter(
        AcessoWorkspace.espaco_trabalho_id == workspace_id,
        AcessoWorkspace.usuario_id == usuario_id,
    ).first()
    if not acesso:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    if dados.nivel_acesso not in NIVEIS_VALIDOS:
        raise HTTPException(status_code=422, detail="Nível de acesso inválido.")
    autor          = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    nivel_anterior = acesso.nivel_acesso
    acesso.nivel_acesso = dados.nivel_acesso
    db.commit()
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    registrar_log(db, "acesso", "acessos_workspace",
                  f"Nível de {usuario.email} alterado: {nivel_anterior} → {dados.nivel_acesso}",
                  usuario=autor, request=request,
                  valor_anterior=json.dumps({"nivel": nivel_anterior}, ensure_ascii=False),
                  valor_novo=json.dumps({"nivel": dados.nivel_acesso}, ensure_ascii=False))
    db.commit()
    return UsuarioWorkspaceItem(
        usuario_id=usuario.id, nome=usuario.nome, email=usuario.email,
        perfil=usuario.perfil, nivel_acesso=dados.nivel_acesso,
    )

@app.delete("/workspaces/{workspace_id}/usuarios/{usuario_id}", status_code=204)
def remover_usuario_workspace(workspace_id: str, usuario_id: str, request: Request, db: Session = Depends(get_db)):
    acesso = db.query(AcessoWorkspace).filter(
        AcessoWorkspace.espaco_trabalho_id == workspace_id,
        AcessoWorkspace.usuario_id == usuario_id,
    ).first()
    if not acesso:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    autor   = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    ws      = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    db.delete(acesso)
    db.commit()
    registrar_log(db, "acesso", "acessos_workspace",
                  f"Usuário {usuario.email} removido do workspace {ws.nome}",
                  usuario=autor, request=request,
                  valor_anterior=json.dumps({"usuario": usuario.email, "workspace": ws.nome}, ensure_ascii=False))
    db.commit()

class SetAcessosRelatorioInput(BaseModel):
    relatorio_ids: List[str] = []

@app.get("/workspaces/{workspace_id}/usuarios/{usuario_id}/relatorios")
def listar_relatorios_acesso_usuario(workspace_id: str, usuario_id: str, db: Session = Depends(get_db)):
    relatorios_ids = (
        db.query(AcessoRelatorio.relatorio_id)
        .join(Relatorio, AcessoRelatorio.relatorio_id == Relatorio.id)
        .filter(
            AcessoRelatorio.usuario_id == usuario_id,
            Relatorio.espaco_trabalho_id == workspace_id,
        )
        .all()
    )
    return [r for (r,) in relatorios_ids]

@app.put("/workspaces/{workspace_id}/usuarios/{usuario_id}/relatorios", status_code=200)
def set_relatorios_acesso_usuario(workspace_id: str, usuario_id: str, request: Request, dados: SetAcessosRelatorioInput, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    ids_neste_ws = [
        r.id for r in db.query(Relatorio.id)
        .filter(Relatorio.espaco_trabalho_id == workspace_id).all()
    ]
    db.query(AcessoRelatorio).filter(
        AcessoRelatorio.usuario_id == usuario_id,
        AcessoRelatorio.relatorio_id.in_(ids_neste_ws),
    ).delete(synchronize_session=False)
    for rel_id in dados.relatorio_ids:
        db.add(AcessoRelatorio(usuario_id=usuario_id, relatorio_id=rel_id))
    db.commit()
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    registrar_log(db, "acesso", "acessos_relatorio",
        f"Relatórios específicos de {usuario.email} no workspace {ws.nome} atualizados ({len(dados.relatorio_ids)} selecionados)",
        usuario=autor, request=request,
        valor_novo=json.dumps({"relatorio_ids": dados.relatorio_ids}, ensure_ascii=False))
    db.commit()
    return {"relatorio_ids": dados.relatorio_ids}

@app.get("/workspaces/{workspace_id}/relatorios", response_model=List[RelatorioItem])
def listar_relatorios_workspace(workspace_id: str, usuario_id: Optional[str] = None, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")

    # Se usuario_id foi informado, verificar nível de acesso e filtrar se necessário
    if usuario_id:
        acesso = db.query(AcessoWorkspace).filter(
            AcessoWorkspace.usuario_id == usuario_id,
            AcessoWorkspace.espaco_trabalho_id == workspace_id,
        ).first()
        if acesso and acesso.nivel_acesso == "apenas_relatorios":
            ids_permitidos = {
                r for (r,) in db.query(AcessoRelatorio.relatorio_id)
                .filter(AcessoRelatorio.usuario_id == usuario_id)
                .all()
            }
            query = db.query(Relatorio).filter(
                Relatorio.espaco_trabalho_id == workspace_id,
                Relatorio.status == "publicado",
                Relatorio.id.in_(ids_permitidos),
            ).order_by(Relatorio.nome)
            return [
                RelatorioItem(
                    id=r.id, nome=r.nome, categoria=r.categoria, status=r.status,
                    descricao=r.descricao, id_relatorio_pbi=r.id_relatorio_pbi,
                    criado_em=r.criado_em.isoformat() if r.criado_em else None,
                )
                for r in query.all()
            ]

    relatorios = (
        db.query(Relatorio)
        .filter(
            Relatorio.espaco_trabalho_id == workspace_id,
            Relatorio.status != "arquivado",
        )
        .order_by(Relatorio.nome)
        .all()
    )
    return [
        RelatorioItem(
            id=r.id,
            nome=r.nome,
            categoria=r.categoria,
            status=r.status,
            descricao=r.descricao,
            id_relatorio_pbi=r.id_relatorio_pbi,
            criado_em=r.criado_em.isoformat() if r.criado_em else None,
        )
        for r in relatorios
    ]


class RelatorioCreate(BaseModel):
    nome: str
    categoria: Optional[str] = None
    status: str = "publicado"
    descricao: Optional[str] = None
    id_relatorio_pbi: Optional[str] = None


def _rel_snapshot(rel):
    return json.dumps({"nome": rel.nome, "categoria": rel.categoria, "status": rel.status,
                       "descricao": rel.descricao, "id_relatorio_pbi": rel.id_relatorio_pbi}, ensure_ascii=False)

@app.post("/workspaces/{workspace_id}/relatorios", response_model=RelatorioItem, status_code=201)
def criar_relatorio(workspace_id: str, request: Request, dados: RelatorioCreate, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "criar", db)
    rel = Relatorio(
        nome=dados.nome, espaco_trabalho_id=workspace_id,
        categoria=dados.categoria or None, status=dados.status,
        descricao=dados.descricao or None, id_relatorio_pbi=dados.id_relatorio_pbi or None,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    registrar_log(db, "sistema", "relatorios", f"Relatório criado: {rel.nome} (workspace: {ws.nome})",
                  usuario=autor, request=request, valor_novo=_rel_snapshot(rel))
    return RelatorioItem(
        id=rel.id, nome=rel.nome, categoria=rel.categoria, status=rel.status,
        descricao=rel.descricao, id_relatorio_pbi=rel.id_relatorio_pbi,
        criado_em=rel.criado_em.isoformat() if rel.criado_em else None,
    )


@app.put("/workspaces/{workspace_id}/relatorios/{relatorio_id}", response_model=RelatorioItem)
def atualizar_relatorio(workspace_id: str, relatorio_id: str, request: Request, dados: RelatorioCreate, db: Session = Depends(get_db)):
    rel = db.query(Relatorio).filter(
        Relatorio.id == relatorio_id,
        Relatorio.espaco_trabalho_id == workspace_id,
    ).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relatório não encontrado.")
    autor    = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    anterior = _rel_snapshot(rel)
    id_pbi_anterior = rel.id_relatorio_pbi
    rel.nome = dados.nome; rel.categoria = dados.categoria or None
    rel.status = dados.status; rel.descricao = dados.descricao or None
    rel.id_relatorio_pbi = dados.id_relatorio_pbi or None
    db.commit()
    db.refresh(rel)
    id_pbi_mudou = id_pbi_anterior != rel.id_relatorio_pbi
    tipo_log = "critico" if id_pbi_mudou else "sistema"
    detalhe  = f"ID Power BI do relatório '{rel.nome}' alterado" if id_pbi_mudou else f"Relatório atualizado: {rel.nome}"
    registrar_log(db, tipo_log, "relatorios", detalhe,
                  usuario=autor, request=request, valor_anterior=anterior, valor_novo=_rel_snapshot(rel))
    if id_pbi_mudou:
        salvar_backup_critico(db, "relatorio", rel.id, "id_relatorio_pbi", id_pbi_anterior, rel.id_relatorio_pbi, autor)
    db.commit()
    return RelatorioItem(
        id=rel.id, nome=rel.nome, categoria=rel.categoria, status=rel.status,
        descricao=rel.descricao, id_relatorio_pbi=rel.id_relatorio_pbi,
        criado_em=rel.criado_em.isoformat() if rel.criado_em else None,
    )


@app.delete("/workspaces/{workspace_id}/relatorios/{relatorio_id}", status_code=204)
def excluir_relatorio(workspace_id: str, relatorio_id: str, request: Request, db: Session = Depends(get_db)):
    rel = db.query(Relatorio).filter(
        Relatorio.id == relatorio_id,
        Relatorio.espaco_trabalho_id == workspace_id,
    ).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relatório não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "excluir", db)
    ws    = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    registrar_log(db, "sistema", "relatorios",
                  f"Relatório excluído: {rel.nome} (workspace: {ws.nome if ws else workspace_id})",
                  usuario=autor, request=request, valor_anterior=_rel_snapshot(rel))
    db.delete(rel)
    db.commit()


# ─── Configurações — Expediente ──────────────────────────────────────────────

DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

class RegraExpedienteItem(BaseModel):
    dia_semana:    int
    nome_dia:      str
    hora_inicio:   Optional[str]
    hora_fim:      Optional[str]
    ativo:         bool
    bloquear_fora: bool

class RegraExpedienteInput(BaseModel):
    hora_inicio:   str
    hora_fim:      str
    ativo:         bool
    bloquear_fora: bool

@app.get("/configuracoes/expediente", response_model=List[RegraExpedienteItem])
def listar_expediente(db: Session = Depends(get_db)):
    regras = {r.dia_semana: r for r in db.query(RegraExpediente).all()}
    return [
        RegraExpedienteItem(
            dia_semana=dia,
            nome_dia=DIAS_SEMANA[dia],
            hora_inicio=regras[dia].hora_inicio.strftime("%H:%M") if dia in regras else None,
            hora_fim=regras[dia].hora_fim.strftime("%H:%M") if dia in regras else None,
            ativo=regras[dia].ativo if dia in regras else False,
            bloquear_fora=regras[dia].bloquear_fora if dia in regras else True,
        )
        for dia in range(7)
    ]

@app.put("/configuracoes/expediente/{dia_semana}", response_model=RegraExpedienteItem)
def salvar_regra_expediente(dia_semana: int, request: Request, dados: RegraExpedienteInput, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    if dia_semana not in range(7):
        raise HTTPException(status_code=422, detail="Dia da semana inválido (0=Dom … 6=Sab).")
    hi = dtime.fromisoformat(dados.hora_inicio)
    hf = dtime.fromisoformat(dados.hora_fim)
    if hi >= hf:
        raise HTTPException(status_code=422, detail="Hora de início deve ser anterior à hora de fim.")
    regra = db.query(RegraExpediente).filter(RegraExpediente.dia_semana == dia_semana).first()
    if regra:
        regra.hora_inicio   = hi
        regra.hora_fim      = hf
        regra.ativo         = dados.ativo
        regra.bloquear_fora = dados.bloquear_fora
    else:
        regra = RegraExpediente(
            dia_semana=dia_semana, hora_inicio=hi, hora_fim=hf,
            ativo=dados.ativo, bloquear_fora=dados.bloquear_fora,
        )
        db.add(regra)
    db.commit()
    registrar_log(db, "sistema", "expediente",
                  f"Regra do {DIAS_SEMANA[dia_semana]} atualizada: {dados.hora_inicio}–{dados.hora_fim} ativo={dados.ativo}",
                  usuario=autor, request=request)
    return RegraExpedienteItem(
        dia_semana=dia_semana, nome_dia=DIAS_SEMANA[dia_semana],
        hora_inicio=dados.hora_inicio, hora_fim=dados.hora_fim,
        ativo=dados.ativo, bloquear_fora=dados.bloquear_fora,
    )


# ─── Configurações — Grupos de Exceção ───────────────────────────────────────

class MembroItem(BaseModel):
    usuario_id: str
    nome:       str
    email:      str

class GrupoItem(BaseModel):
    id:                 str
    nome:               str
    fora_horario:       bool
    janela_inicio:      Optional[str]
    janela_fim:         Optional[str]
    ignora_dia_inativo: bool = False
    status:             str
    membros:            List[MembroItem] = []

class GrupoInput(BaseModel):
    nome:               str
    fora_horario:       bool = True
    janela_inicio:      Optional[str] = None
    janela_fim:         Optional[str] = None
    ignora_dia_inativo: bool = False

class AdicionarMembroInput(BaseModel):
    usuario_id: str

def _grupo_to_item(g: GrupoExcecao, db: Session) -> GrupoItem:
    membros = (
        db.query(MembroGrupoExcecao, Usuario)
        .join(Usuario, MembroGrupoExcecao.usuario_id == Usuario.id)
        .filter(MembroGrupoExcecao.grupo_id == g.id)
        .all()
    )
    return GrupoItem(
        id=g.id, nome=g.nome, fora_horario=g.fora_horario, status=g.status,
        janela_inicio=g.janela_inicio.strftime("%H:%M") if g.janela_inicio else None,
        janela_fim=g.janela_fim.strftime("%H:%M") if g.janela_fim else None,
        ignora_dia_inativo=g.ignora_dia_inativo,
        membros=[MembroItem(usuario_id=u.id, nome=u.nome, email=u.email) for _, u in membros],
    )

@app.get("/configuracoes/grupos-excecao", response_model=List[GrupoItem])
def listar_grupos(db: Session = Depends(get_db)):
    grupos = db.query(GrupoExcecao).order_by(GrupoExcecao.nome).all()
    return [_grupo_to_item(g, db) for g in grupos]

def _grupo_snapshot(dados):
    return json.dumps({"nome": dados.nome, "fora_horario": dados.fora_horario,
                       "janela_inicio": dados.janela_inicio, "janela_fim": dados.janela_fim}, ensure_ascii=False)

@app.post("/configuracoes/grupos-excecao", response_model=GrupoItem, status_code=201)
def criar_grupo(request: Request, dados: GrupoInput, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "criar", db)
    ji = dtime.fromisoformat(dados.janela_inicio) if dados.janela_inicio else None
    jf = dtime.fromisoformat(dados.janela_fim)    if dados.janela_fim    else None
    g = GrupoExcecao(nome=dados.nome, fora_horario=dados.fora_horario, janela_inicio=ji, janela_fim=jf, ignora_dia_inativo=dados.ignora_dia_inativo)
    db.add(g)
    db.commit()
    db.refresh(g)
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção criado: {g.nome}",
                  usuario=autor, request=request, valor_novo=_grupo_snapshot(dados))
    db.commit()
    return _grupo_to_item(g, db)

@app.put("/configuracoes/grupos-excecao/{grupo_id}", response_model=GrupoItem)
def atualizar_grupo(grupo_id: str, request: Request, dados: GrupoInput, db: Session = Depends(get_db)):
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    autor    = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    anterior = json.dumps({"nome": g.nome, "fora_horario": g.fora_horario,
                            "janela_inicio": g.janela_inicio.strftime("%H:%M") if g.janela_inicio else None,
                            "janela_fim": g.janela_fim.strftime("%H:%M") if g.janela_fim else None}, ensure_ascii=False)
    g.nome          = dados.nome
    g.fora_horario       = dados.fora_horario
    g.janela_inicio      = dtime.fromisoformat(dados.janela_inicio) if dados.janela_inicio else None
    g.janela_fim         = dtime.fromisoformat(dados.janela_fim)    if dados.janela_fim    else None
    g.ignora_dia_inativo = dados.ignora_dia_inativo
    db.commit()
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção atualizado: {g.nome}",
                  usuario=autor, request=request, valor_anterior=anterior, valor_novo=_grupo_snapshot(dados))
    db.commit()
    return _grupo_to_item(g, db)

@app.delete("/configuracoes/grupos-excecao/{grupo_id}", status_code=204)
def excluir_grupo(grupo_id: str, request: Request, db: Session = Depends(get_db)):
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "excluir", db)
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção excluído: {g.nome}",
                  usuario=autor, request=request,
                  valor_anterior=json.dumps({"nome": g.nome}, ensure_ascii=False))
    db.delete(g)
    db.commit()

@app.post("/configuracoes/grupos-excecao/{grupo_id}/membros", status_code=201)
def adicionar_membro(grupo_id: str, request: Request, dados: AdicionarMembroInput, db: Session = Depends(get_db)):
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    u = db.query(Usuario).filter(Usuario.id == dados.usuario_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    existente = db.query(MembroGrupoExcecao).filter(
        MembroGrupoExcecao.grupo_id == grupo_id,
        MembroGrupoExcecao.usuario_id == dados.usuario_id,
    ).first()
    if not existente:
        db.add(MembroGrupoExcecao(grupo_id=grupo_id, usuario_id=dados.usuario_id))
        db.commit()
        registrar_log(db, "sistema", "grupos_excecao",
                      f"Membro adicionado ao grupo '{g.nome}': {u.email}", usuario=autor, request=request)
        db.commit()
    return _grupo_to_item(g, db)

@app.delete("/configuracoes/grupos-excecao/{grupo_id}/membros/{usuario_id}", status_code=204)
def remover_membro(grupo_id: str, usuario_id: str, request: Request, db: Session = Depends(get_db)):
    m = db.query(MembroGrupoExcecao).filter(
        MembroGrupoExcecao.grupo_id == grupo_id,
        MembroGrupoExcecao.usuario_id == usuario_id,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    registrar_log(db, "sistema", "grupos_excecao",
                  f"Membro removido do grupo '{g.nome if g else grupo_id}': {u.email if u else usuario_id}",
                  usuario=autor, request=request)
    db.delete(m)
    db.commit()


# ─── Configurações — Credenciais Power BI ────────────────────────────────────

PBI_CHAVES = ["PBI_TENANT_ID", "PBI_CLIENT_ID", "PBI_CLIENT_SECRET"]

class CredenciaisPBIItem(BaseModel):
    tenant_id:     str
    client_id:     str
    client_secret: str  # retorna mascarado

class CredenciaisPBIInput(BaseModel):
    tenant_id:     str
    client_id:     str
    client_secret: str  # vazio = não alterar

@app.get("/historico-critico")
def listar_historico_critico(entidade: str, entidade_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(HistoricoConfigCritica).filter(HistoricoConfigCritica.entidade == entidade)
    if entidade_id:
        q = q.filter(HistoricoConfigCritica.entidade_id == entidade_id)
    registros = q.order_by(HistoricoConfigCritica.momento.desc()).limit(20).all()
    return [
        {
            "id":                  r.id,
            "momento":             r.momento.isoformat(),
            "campo":               r.campo,
            "valor_anterior":      r.valor_anterior,
            "valor_novo":          r.valor_novo,
            "alterado_por_nome":   r.alterado_por_nome,
            "alterado_por_email":  r.alterado_por_email,
        }
        for r in registros
    ]


@app.get("/configuracoes/pbi", response_model=CredenciaisPBIItem)
def listar_credenciais_pbi(db: Session = Depends(get_db)):
    def _get(chave):
        r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == chave).first()
        return r.valor if r else ""
    secret = _get("PBI_CLIENT_SECRET")
    return CredenciaisPBIItem(
        tenant_id=_get("PBI_TENANT_ID"),
        client_id=_get("PBI_CLIENT_ID"),
        client_secret="••••••••" if secret else "",
    )

@app.get("/configuracoes/pbi/secret")
def revelar_secret_pbi(request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor or autor.perfil not in PERFIS_ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == "PBI_CLIENT_SECRET").first()
    return {"client_secret": r.valor if r else ""}

@app.put("/configuracoes/pbi", response_model=CredenciaisPBIItem)
def salvar_credenciais_pbi(request: Request, dados: CredenciaisPBIInput, db: Session = Depends(get_db)):
    _autor_perm = get_usuario_requisicao(request, db)
    exigir_permissao(_autor_perm, "configuracoes", "editar", db)
    def _get(chave):
        r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == chave).first()
        return r.valor if r else ""
    def _upsert(chave, valor):
        r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == chave).first()
        if r:
            r.valor = valor
        else:
            db.add(ConfiguracaoSistema(chave=chave, valor=valor, eh_secreto=chave == "PBI_CLIENT_SECRET"))

    tenant_anterior = _get("PBI_TENANT_ID")
    client_anterior = _get("PBI_CLIENT_ID")

    _upsert("PBI_TENANT_ID", dados.tenant_id)
    _upsert("PBI_CLIENT_ID", dados.client_id)
    if dados.client_secret and dados.client_secret != "••••••••":
        _upsert("PBI_CLIENT_SECRET", dados.client_secret)
    db.commit()

    autor = get_usuario_requisicao(request, db)
    campos_alterados = []
    if tenant_anterior != dados.tenant_id:
        salvar_backup_critico(db, "pbi_credenciais", None, "PBI_TENANT_ID", tenant_anterior, dados.tenant_id, autor)
        campos_alterados.append("Tenant ID")
    if client_anterior != dados.client_id:
        salvar_backup_critico(db, "pbi_credenciais", None, "PBI_CLIENT_ID", client_anterior, dados.client_id, autor)
        campos_alterados.append("Client ID")
    if dados.client_secret and dados.client_secret != "••••••••":
        salvar_backup_critico(db, "pbi_credenciais", None, "PBI_CLIENT_SECRET", "••••••••", "••••••••", autor)
        campos_alterados.append("Client Secret")

    tipo_log = "critico" if campos_alterados else "sistema"
    detalhe  = f"Credenciais Power BI alteradas: {', '.join(campos_alterados)}" if campos_alterados else "Credenciais Power BI atualizadas (sem alteração)"
    registrar_log(db, tipo_log, "configuracoes_pbi", detalhe, usuario=autor, request=request)
    db.commit()
    return listar_credenciais_pbi(db)


# ─── Power BI Embed ───────────────────────────────────────────────────────────

_pbi_token_cache: dict = {"token": None, "expires_at": 0}

def _pbi_access_token(db: Session = None) -> str:
    """Obtém access token do Azure AD via client credentials (Service Principal).
    O token é cacheado em memória e reutilizado até 5 minutos antes de expirar."""
    import time

    if _pbi_token_cache["token"] and time.time() < _pbi_token_cache["expires_at"]:
        return _pbi_token_cache["token"]

    def _cfg(chave):
        if db:
            r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == chave).first()
            if r and r.valor:
                return r.valor
        return os.getenv(chave, "")

    tenant_id     = _cfg("PBI_TENANT_ID")
    client_id     = _cfg("PBI_CLIENT_ID")
    client_secret = _cfg("PBI_CLIENT_SECRET")

    if not all([tenant_id, client_id, client_secret]):
        raise HTTPException(
            status_code=503,
            detail="Credenciais do Power BI não configuradas. Acesse Configurações → Power BI para definir Tenant ID, Client ID e Client Secret.",
        )
    resp = http_requests.post(
        f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token",
        data={
            "grant_type":    "client_credentials",
            "client_id":     client_id,
            "client_secret": client_secret,
            "scope":         "https://analysis.windows.net/powerbi/api/.default",
        },
        timeout=15,
    )
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"Falha ao autenticar no Azure AD: {resp.text}")

    data = resp.json()
    _pbi_token_cache["token"]      = data["access_token"]
    _pbi_token_cache["expires_at"] = time.time() + data.get("expires_in", 3600) - 300
    return _pbi_token_cache["token"]


class EmbedResponse(BaseModel):
    embed_url:   str
    embed_token: str
    token_expiry: str
    report_id:   str
    workspace_id: str


@app.get("/pbi/workspace-info")
def pbi_workspace_info(workspace_pbi_id: str, db: Session = Depends(get_db)):
    """Retorna o nome do workspace no Power BI para confirmação durante a configuração."""
    try:
        access_token = _pbi_access_token(db)
    except HTTPException as e:
        raise e
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = http_requests.get(
        f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_pbi_id}",
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Workspace não encontrado no Power BI. Verifique o ID informado.")
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar Power BI: {resp.text}")
    data = resp.json()
    return {"name": data.get("name", ""), "type": data.get("type", "")}

@app.get("/pbi/relatorio-info")
def pbi_relatorio_info(workspace_pbi_id: str, report_pbi_id: str, db: Session = Depends(get_db)):
    """Retorna o nome do relatório no Power BI para confirmação durante a configuração."""
    try:
        access_token = _pbi_access_token(db)
    except HTTPException as e:
        raise e
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = http_requests.get(
        f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_pbi_id}/reports/{report_pbi_id}",
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Relatório não encontrado no Power BI. Verifique os IDs informados.")
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar Power BI: {resp.text}")
    data = resp.json()
    return {"name": data.get("name", ""), "web_url": data.get("webUrl", "")}


@app.get("/relatorios/{relatorio_id}/embed", response_model=EmbedResponse)
def embed_relatorio(relatorio_id: str, request: Request, db: Session = Depends(get_db)):
    rel = db.query(Relatorio).filter(Relatorio.id == relatorio_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relatório não encontrado.")
    if not rel.id_relatorio_pbi:
        raise HTTPException(status_code=422, detail="Este relatório não possui ID do Power BI configurado.")

    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == rel.espaco_trabalho_id).first()
    if not ws or not ws.id_workspace_pbi:
        raise HTTPException(status_code=422, detail="O workspace deste relatório não possui ID do Power BI configurado.")

    access_token = _pbi_access_token(db)
    headers = {"Authorization": f"Bearer {access_token}"}

    # Busca a embed URL do relatório
    report_resp = http_requests.get(
        f"https://api.powerbi.com/v1.0/myorg/groups/{ws.id_workspace_pbi}/reports/{rel.id_relatorio_pbi}",
        headers=headers,
        timeout=15,
    )
    if not report_resp.ok:
        raise HTTPException(status_code=502, detail=f"Falha ao buscar relatório no Power BI: {report_resp.text}")
    embed_url = report_resp.json().get("embedUrl", "")

    # Busca o dataset ID do relatório (necessário para o token V2)
    dataset_id = report_resp.json().get("datasetId", "")
    if not dataset_id:
        raise HTTPException(status_code=502, detail="Não foi possível obter o dataset ID do relatório no Power BI.")

    # Gera o embed token (V2 — suporta DirectLake e datasets Fabric)
    token_resp = http_requests.post(
        "https://api.powerbi.com/v1.0/myorg/GenerateToken",
        headers={**headers, "Content-Type": "application/json"},
        json={
            "reports":          [{"id": rel.id_relatorio_pbi, "allowEdit": False}],
            "datasets":         [{"id": dataset_id}],
            "targetWorkspaces": [{"id": ws.id_workspace_pbi}],
        },
        timeout=15,
    )
    if not token_resp.ok:
        raise HTTPException(status_code=502, detail=f"Falha ao gerar embed token: {token_resp.text}")

    token_data = token_resp.json()
    autor = get_usuario_requisicao(request, db)
    # Deduplicação: ignora se já foi registrado o mesmo acesso nos últimos 5s (React StrictMode chama o effect duas vezes em dev)
    detalhe_log = f"Relatório visualizado: {rel.nome}"
    janela = datetime.now(timezone.utc) - timedelta(seconds=5)
    ja_registrado = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "relatorio",
        LogAuditoria.detalhe == detalhe_log,
        LogAuditoria.usuario_id == (autor.id if autor else None),
        LogAuditoria.momento >= janela,
    ).first()
    if not ja_registrado:
        registrar_log(db, "relatorio", "relatorios", detalhe_log, usuario=autor, request=request)
        db.commit()

    return EmbedResponse(
        embed_url=embed_url,
        embed_token=token_data["token"],
        token_expiry=token_data["expiration"],
        report_id=rel.id_relatorio_pbi,
        workspace_id=ws.id_workspace_pbi,
    )


# ─── Permissões do usuário logado ────────────────────────────────────────────

@app.get("/api/me/permissoes")
def minhas_permissoes(request: Request, db: Session = Depends(get_db)):
    usuario = get_usuario_requisicao(request, db)
    if not usuario:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    resultado = {}
    for modulo in _MODULOS_VALIDOS_PERM:
        resultado[modulo] = {
            acao: checar_permissao(usuario, modulo, acao, db)
            for acao in _CAMPOS_ACAO
        }
    return resultado


# ─── Permissões por Perfil ────────────────────────────────────────────────────

_PERFIS_VALIDOS_PERM  = {"master", "administrador", "coordenador", "colaborador", "convidado"}
_MODULOS_VALIDOS_PERM = {"usuarios", "permissoes", "relatorios", "workspaces", "auditoria",
                         "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank"}


class PermissaoPerfilInput(BaseModel):
    pode_visualizar: bool
    pode_criar:      bool
    pode_editar:     bool
    pode_excluir:    bool
    pode_exportar:   bool
    pode_gerenciar:  bool


@app.get("/api/permissoes/perfis")
def listar_permissoes_perfis(request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor or autor.perfil != "master":
        raise HTTPException(status_code=403, detail="Acesso restrito a masters.")
    registros = db.query(PermissaoPerfil).all()
    return [
        {
            "perfil":           r.perfil,
            "modulo":           r.modulo,
            "pode_visualizar":  r.pode_visualizar,
            "pode_criar":       r.pode_criar,
            "pode_editar":      r.pode_editar,
            "pode_excluir":     r.pode_excluir,
            "pode_exportar":    r.pode_exportar,
            "pode_gerenciar":   r.pode_gerenciar,
        }
        for r in registros
    ]


@app.put("/api/permissoes/perfis/{perfil}/{modulo}")
def atualizar_permissao_perfil(
    perfil: str, modulo: str, dados: PermissaoPerfilInput,
    request: Request, db: Session = Depends(get_db),
):
    autor = get_usuario_requisicao(request, db)
    if not autor or autor.perfil != "master":
        raise HTTPException(status_code=403, detail="Acesso restrito a masters.")
    if perfil not in _PERFIS_VALIDOS_PERM:
        raise HTTPException(status_code=422, detail="Perfil inválido.")
    if modulo not in _MODULOS_VALIDOS_PERM:
        raise HTTPException(status_code=422, detail="Módulo inválido.")

    pp = db.query(PermissaoPerfil).filter_by(perfil=perfil, modulo=modulo).first()
    anterior = None
    if pp:
        anterior = {
            "pode_visualizar": pp.pode_visualizar, "pode_criar": pp.pode_criar,
            "pode_editar": pp.pode_editar, "pode_excluir": pp.pode_excluir,
            "pode_exportar": pp.pode_exportar, "pode_gerenciar": pp.pode_gerenciar,
        }
        pp.pode_visualizar = dados.pode_visualizar
        pp.pode_criar      = dados.pode_criar
        pp.pode_editar     = dados.pode_editar
        pp.pode_excluir    = dados.pode_excluir
        pp.pode_exportar   = dados.pode_exportar
        pp.pode_gerenciar  = dados.pode_gerenciar
    else:
        pp = PermissaoPerfil(
            perfil=perfil, modulo=modulo,
            pode_visualizar=dados.pode_visualizar, pode_criar=dados.pode_criar,
            pode_editar=dados.pode_editar, pode_excluir=dados.pode_excluir,
            pode_exportar=dados.pode_exportar, pode_gerenciar=dados.pode_gerenciar,
        )
        db.add(pp)

    novo = {
        "pode_visualizar": dados.pode_visualizar, "pode_criar": dados.pode_criar,
        "pode_editar": dados.pode_editar, "pode_excluir": dados.pode_excluir,
        "pode_exportar": dados.pode_exportar, "pode_gerenciar": dados.pode_gerenciar,
    }
    registrar_log(db, "permissao", "permissoes",
                  f"Permissão de perfil atualizada: {perfil}/{modulo}",
                  usuario=autor, request=request,
                  valor_anterior=json.dumps(anterior) if anterior else None,
                  valor_novo=json.dumps(novo))
    db.commit()
    return {"ok": True}


# ─── Sobrescritas de Permissão por Usuário ────────────────────────────────────

class SobrescritaInput(BaseModel):
    pode_visualizar: Optional[bool] = None
    pode_criar:      Optional[bool] = None
    pode_editar:     Optional[bool] = None
    pode_excluir:    Optional[bool] = None
    pode_exportar:   Optional[bool] = None
    pode_gerenciar:  Optional[bool] = None


def _permissao_efetiva(perfil: str, modulo: str, sobrescrita: Optional["SobrescritaPermissao"],
                       pp: Optional["PermissaoPerfil"]) -> dict:
    efetiva = {}
    for acao, campo in _CAMPOS_ACAO.items():
        valor_sobrescrita = getattr(sobrescrita, campo) if sobrescrita else None
        if valor_sobrescrita is not None:
            efetiva[acao] = valor_sobrescrita
        elif pp:
            efetiva[acao] = bool(getattr(pp, campo))
        else:
            efetiva[acao] = False
    return efetiva


@app.get("/api/usuarios/{usuario_id}/permissoes")
def listar_permissoes_usuario(usuario_id: str, request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor or autor.perfil not in {"master", "administrador"}:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    alvo = db.query(Usuario).filter_by(id=usuario_id).first()
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    resultado = []
    for modulo in sorted(_MODULOS_VALIDOS_PERM):
        pp = db.query(PermissaoPerfil).filter_by(perfil=alvo.perfil, modulo=modulo).first()
        sob = db.query(SobrescritaPermissao).filter_by(usuario_id=usuario_id, modulo=modulo).first()
        definido_por_nome = None
        if sob and sob.definido_por_id:
            definidor = db.query(Usuario).filter_by(id=sob.definido_por_id).first()
            definido_por_nome = definidor.nome if definidor else None

        resultado.append({
            "modulo": modulo,
            "permissao_perfil": {
                campo: bool(getattr(pp, campo)) for campo in _CAMPOS_ACAO.values()
            } if pp else {campo: False for campo in _CAMPOS_ACAO.values()},
            "sobrescrita": {
                **{campo: getattr(sob, campo) for campo in _CAMPOS_ACAO.values()},
                "definido_por_nome": definido_por_nome,
                "definido_em": sob.definido_em.isoformat() if sob.definido_em else None,
            } if sob else None,
            "efetiva": _permissao_efetiva(alvo.perfil, modulo, sob, pp),
        })
    return resultado


@app.put("/api/usuarios/{usuario_id}/permissoes/{modulo}")
def upsert_sobrescrita_permissao(
    usuario_id: str, modulo: str, dados: SobrescritaInput,
    request: Request, db: Session = Depends(get_db),
):
    autor = get_usuario_requisicao(request, db)
    if not autor or autor.perfil not in {"master", "administrador"}:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    if modulo not in _MODULOS_VALIDOS_PERM:
        raise HTTPException(status_code=422, detail="Módulo inválido.")

    alvo = db.query(Usuario).filter_by(id=usuario_id).first()
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    sob = db.query(SobrescritaPermissao).filter_by(usuario_id=usuario_id, modulo=modulo).first()
    if sob:
        for campo in _CAMPOS_ACAO.values():
            setattr(sob, campo, getattr(dados, campo))
        sob.definido_por_id = autor.id
        sob.definido_em     = datetime.now(timezone.utc)
    else:
        sob = SobrescritaPermissao(
            usuario_id=usuario_id, modulo=modulo,
            definido_por_id=autor.id,
            definido_em=datetime.now(timezone.utc),
            **{campo: getattr(dados, campo) for campo in _CAMPOS_ACAO.values()},
        )
        db.add(sob)

    registrar_log(db, "permissao", "permissoes",
                  f"Sobrescrita de permissão definida: usuário {alvo.email} / módulo {modulo}",
                  usuario=autor, request=request)
    db.commit()
    return {"ok": True}


@app.delete("/api/usuarios/{usuario_id}/permissoes/{modulo}")
def remover_sobrescrita_permissao(
    usuario_id: str, modulo: str,
    request: Request, db: Session = Depends(get_db),
):
    autor = get_usuario_requisicao(request, db)
    if not autor or autor.perfil not in {"master", "administrador"}:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    alvo = db.query(Usuario).filter_by(id=usuario_id).first()
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    sob = db.query(SobrescritaPermissao).filter_by(usuario_id=usuario_id, modulo=modulo).first()
    if sob:
        db.delete(sob)
        registrar_log(db, "permissao", "permissoes",
                      f"Sobrescrita removida: usuário {alvo.email} / módulo {modulo}",
                      usuario=autor, request=request)
        db.commit()
    return {"ok": True}


# ─── Land Bank ────────────────────────────────────────────────────────────────

_LB_DIR = Path(__file__).parent / "static" / "landbank"


@app.get("/api/landbank/data")
def landbank_data(request: Request, db: Session = Depends(get_db)):
    usuario = get_usuario_requisicao(request, db)
    if not usuario:
        raise HTTPException(status_code=403, detail="Acesso ao Land Bank não autorizado.")
    exigir_permissao(usuario, "landbank", "visualizar", db)
    data_path = _LB_DIR / "data.json"
    if not data_path.exists():
        raise HTTPException(status_code=503, detail="data.json não encontrado. Execute gerar_data.py.")
    return FileResponse(path=data_path, media_type="application/json",
                        headers={"Cache-Control": "max-age=3600, private"})

from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, date as date_type, time as time_type
from zoneinfo import ZoneInfo
import csv, io, json, os
import requests as http_requests

from database import engine, get_db, Base
from models import Usuario, LogAuditoria, EspacoTrabalho, Relatorio, AcessoWorkspace, AcessoRelatorio, RegraExpediente, GrupoExcecao, MembroGrupoExcecao, ConfiguracaoSistema, Favorito

PBI_TENANT_ID     = os.getenv("PBI_TENANT_ID", "")
PBI_CLIENT_ID     = os.getenv("PBI_CLIENT_ID", "")
PBI_CLIENT_SECRET = os.getenv("PBI_CLIENT_SECRET", "")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CGID API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

MAX_TENTATIVAS = 5


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


# ─── Utilitários ─────────────────────────────────────────────────────────────
def registrar_log(db: Session, tipo: str, modulo: str, detalhe: str,
                  usuario: Optional[Usuario] = None, ip: Optional[str] = None,
                  valor_anterior: Optional[str] = None, valor_novo: Optional[str] = None):
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


def _verificar_expediente(usuario_id: str, db: Session) -> Optional[str]:
    """
    Verifica se o acesso está dentro do horário de expediente.
    Retorna mensagem de erro se bloqueado, ou None se liberado.
    """
    agora = datetime.now(TZ_BRASILIA)
    dia_db = agora.isoweekday() % 7  # isoweekday: 1=Seg…7=Dom → 0=Dom, 1=Seg…6=Sab

    regra = db.query(RegraExpediente).filter(RegraExpediente.dia_semana == dia_db).first()

    if not regra or not regra.ativo or not regra.bloquear_fora:
        return None  # sem restrição para este dia

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
def login(dados: LoginInput, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == dados.email).first()

    if not usuario:
        return LoginResponse(sucesso=False, mensagem="E-mail ou senha incorretos.")

    if usuario.status == "bloqueado":
        return LoginResponse(sucesso=False, mensagem="Conta bloqueada. Entre em contato com o administrador.")

    if usuario.status == "inativo":
        return LoginResponse(sucesso=False, mensagem="Conta inativa. Entre em contato com o administrador.")

    if not pwd.verify(dados.senha, usuario.hash_senha):
        usuario.tentativas_login += 1
        if usuario.tentativas_login >= MAX_TENTATIVAS:
            usuario.status = "bloqueado"
            registrar_log(db, "seguranca", "autenticacao",
                          f"Conta bloqueada após {MAX_TENTATIVAS} tentativas", usuario)
            db.commit()
            return LoginResponse(sucesso=False, mensagem="Conta bloqueada após 5 tentativas incorretas.")
        db.commit()
        restantes = MAX_TENTATIVAS - usuario.tentativas_login
        return LoginResponse(sucesso=False, mensagem=f"E-mail ou senha incorretos. {restantes} tentativa(s) restante(s).")

    erro_expediente = _verificar_expediente(usuario.id, db) if usuario.perfil not in PERFIS_ADMIN else None
    if erro_expediente:
        registrar_log(db, "seguranca", "autenticacao", f"Acesso negado fora do expediente: {erro_expediente}", usuario)
        db.commit()
        return LoginResponse(sucesso=False, mensagem=erro_expediente)

    usuario.tentativas_login = 0
    usuario.ultimo_login = datetime.now(timezone.utc)
    registrar_log(db, "autenticacao", "autenticacao", "Login realizado com sucesso", usuario)
    db.commit()

    return LoginResponse(
        sucesso=True,
        mensagem="Login realizado com sucesso.",
        usuario=UsuarioPublico.model_validate(usuario),
    )


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

PERFIS_VALIDOS  = {"super_administrador", "administrador", "gerente", "operador", "visitante"}
STATUS_VALIDOS  = {"ativo", "inativo", "bloqueado"}
PERFIS_ADMIN    = {"super_administrador", "administrador"}

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
    senha = dados.senha if dados.senha else SENHA_PADRAO
    usuario = Usuario(
        nome=dados.nome, email=dados.email,
        hash_senha=pwd.hash(senha), perfil=dados.perfil, status="ativo",
    )
    db.add(usuario)
    db.flush()
    if dados.perfil in PERFIS_ADMIN:
        _vincular_admin_workspaces(usuario.id, db)
    registrar_log(db, "usuario", "usuarios", f"Usuário criado: {dados.email}",
                  usuario=autor,
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
                  usuario=autor, valor_anterior=anterior, valor_novo=_usr_snapshot(usuario))
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
    usuario.hash_senha = pwd.hash(SENHA_PADRAO)
    usuario.tentativas_login = 0
    if usuario.status == "bloqueado":
        usuario.status = "ativo"
    registrar_log(db, "usuario", "usuarios", f"Senha redefinida para padrão: {usuario.email}", usuario=autor)
    db.commit()
    return {"mensagem": "Senha redefinida para o padrão com sucesso."}


@app.delete("/usuarios/{usuario_id}", status_code=204)
def excluir_usuario(usuario_id: str, request: Request, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    registrar_log(db, "usuario", "usuarios", f"Usuário excluído: {usuario.email}",
                  usuario=autor, valor_anterior=_usr_snapshot(usuario))
    db.delete(usuario)
    db.commit()


# ─── Workspaces ───────────────────────────────────────────────────────────────

class WorkspaceItem(BaseModel):
    id: str
    nome: str
    icone: Optional[str] = None
    cor: Optional[str] = None
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
def listar_workspaces(db: Session = Depends(get_db)):
    return db.query(EspacoTrabalho).filter(EspacoTrabalho.status == "ativo").order_by(EspacoTrabalho.nome).all()


@app.get("/usuarios/{usuario_id}/acessos", response_model=List[AcessoWorkspaceItem])
def listar_acessos_usuario(usuario_id: str, db: Session = Depends(get_db)):
    acessos = (
        db.query(AcessoWorkspace, EspacoTrabalho)
        .join(EspacoTrabalho, AcessoWorkspace.espaco_trabalho_id == EspacoTrabalho.id)
        .filter(AcessoWorkspace.usuario_id == usuario_id)
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

    if usuario.perfil in PERFIS_ADMIN:
        _vincular_admin_workspaces(usuario_id, db)
        registrar_log(db, "acesso", "acessos_workspace",
                      f"Acessos atualizados (admin): {usuario.email}", usuario=autor)
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
                  usuario=autor,
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
    return LogsResponse(
        total=total,
        pagina=pagina,
        paginas=max(1, -(-total // por_pagina)),
        itens=[
            LogItem(
                id=l.id,
                momento=l.momento.isoformat() if l.momento else "",
                usuario_id=l.usuario_id,
                nome_usuario=l.nome_usuario,
                email_usuario=l.email_usuario,
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
    buf = io.StringIO()
    w   = csv.writer(buf)
    w.writerow(["ID", "Momento", "Usuário", "E-mail", "Tipo Evento", "Módulo", "Detalhe", "IP", "Valor Anterior", "Valor Novo"])
    for l in logs:
        w.writerow([
            l.id,
            l.momento.isoformat() if l.momento else "",
            l.nome_usuario or "",
            l.email_usuario or "",
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

    hoje = datetime.now(timezone.utc).date()
    acessos_negados = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "seguranca",
        func.date(LogAuditoria.momento) == hoje,
    ).count()

    return {
        "usuarios_ativos":   total_usuarios,
        "usuarios_bloqueados": bloqueados,
        "acessos_negados_hoje": acessos_negados,
        "workspaces_ativos": workspaces_ativos,
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
        total_relatorios = db.query(Relatorio).filter(
            Relatorio.espaco_trabalho_id == ws.id,
            Relatorio.status == "publicado",
        ).count()

        acesso_total = db.query(AcessoWorkspace).filter(
            AcessoWorkspace.espaco_trabalho_id == ws.id,
            AcessoWorkspace.nivel_acesso == "total",
        ).count()

        acesso_parcial = db.query(AcessoWorkspace).filter(
            AcessoWorkspace.espaco_trabalho_id == ws.id,
            AcessoWorkspace.nivel_acesso == "apenas_relatorios",
        ).count()

        resultado.append({
            "nome":          ws.nome,
            "reports":       total_relatorios,
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
    ws = EspacoTrabalho(
        nome=dados.nome, icone=dados.icone, cor=dados.cor,
        descricao=dados.descricao, id_workspace_pbi=dados.id_workspace_pbi, status="ativo",
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace criado: {ws.nome}",
                  usuario=autor,
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
    anterior = json.dumps({"nome": ws.nome, "icone": ws.icone, "cor": ws.cor,
                            "descricao": ws.descricao, "id_workspace_pbi": ws.id_workspace_pbi}, ensure_ascii=False)
    ws.nome = dados.nome; ws.icone = dados.icone; ws.cor = dados.cor
    ws.descricao = dados.descricao; ws.id_workspace_pbi = dados.id_workspace_pbi
    db.commit(); db.refresh(ws)
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace atualizado: {ws.nome}",
                  usuario=autor, valor_anterior=anterior,
                  valor_novo=json.dumps({"nome": ws.nome, "icone": ws.icone, "cor": ws.cor,
                                         "descricao": ws.descricao, "id_workspace_pbi": ws.id_workspace_pbi}, ensure_ascii=False))
    db.commit()
    return ws

@app.patch("/workspaces/{workspace_id}/arquivar", status_code=200)
def arquivar_workspace(workspace_id: str, request: Request, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor = get_usuario_requisicao(request, db)
    ws.status = "arquivado"
    db.commit()
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace arquivado: {ws.nome}", usuario=autor)
    db.commit()
    return {"mensagem": "Workspace arquivado com sucesso."}

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
    db.commit()
    registrar_log(db, "acesso", "acessos_workspace",
                  f"Usuário {usuario.email} vinculado ao workspace {ws.nome} ({dados.nivel_acesso})",
                  usuario=autor,
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
    nivel_anterior = acesso.nivel_acesso
    acesso.nivel_acesso = dados.nivel_acesso
    db.commit()
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    registrar_log(db, "acesso", "acessos_workspace",
                  f"Nível de {usuario.email} alterado: {nivel_anterior} → {dados.nivel_acesso}",
                  usuario=autor,
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
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    ws      = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    db.delete(acesso)
    db.commit()
    registrar_log(db, "acesso", "acessos_workspace",
                  f"Usuário {usuario.email} removido do workspace {ws.nome}",
                  usuario=autor,
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
        usuario=autor,
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
    rel = Relatorio(
        nome=dados.nome, espaco_trabalho_id=workspace_id,
        categoria=dados.categoria or None, status=dados.status,
        descricao=dados.descricao or None, id_relatorio_pbi=dados.id_relatorio_pbi or None,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    registrar_log(db, "sistema", "relatorios", f"Relatório criado: {rel.nome} (workspace: {ws.nome})",
                  usuario=autor, valor_novo=_rel_snapshot(rel))
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
    anterior = _rel_snapshot(rel)
    rel.nome = dados.nome; rel.categoria = dados.categoria or None
    rel.status = dados.status; rel.descricao = dados.descricao or None
    rel.id_relatorio_pbi = dados.id_relatorio_pbi or None
    db.commit()
    db.refresh(rel)
    registrar_log(db, "sistema", "relatorios", f"Relatório atualizado: {rel.nome}",
                  usuario=autor, valor_anterior=anterior, valor_novo=_rel_snapshot(rel))
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
    ws    = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    registrar_log(db, "sistema", "relatorios",
                  f"Relatório excluído: {rel.nome} (workspace: {ws.nome if ws else workspace_id})",
                  usuario=autor, valor_anterior=_rel_snapshot(rel))
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
    if dia_semana not in range(7):
        raise HTTPException(status_code=422, detail="Dia da semana inválido (0=Dom … 6=Sab).")
    from datetime import time as dtime
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
    autor = get_usuario_requisicao(request, db)
    registrar_log(db, "sistema", "expediente",
                  f"Regra do {DIAS_SEMANA[dia_semana]} atualizada: {dados.hora_inicio}–{dados.hora_fim} ativo={dados.ativo}",
                  usuario=autor)
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
    id:            str
    nome:          str
    fora_horario:  bool
    janela_inicio: Optional[str]
    janela_fim:    Optional[str]
    status:        str
    membros:       List[MembroItem] = []

class GrupoInput(BaseModel):
    nome:          str
    fora_horario:  bool = True
    janela_inicio: Optional[str] = None
    janela_fim:    Optional[str] = None

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
    from datetime import time as dtime
    autor = get_usuario_requisicao(request, db)
    ji = dtime.fromisoformat(dados.janela_inicio) if dados.janela_inicio else None
    jf = dtime.fromisoformat(dados.janela_fim)    if dados.janela_fim    else None
    g = GrupoExcecao(nome=dados.nome, fora_horario=dados.fora_horario, janela_inicio=ji, janela_fim=jf)
    db.add(g)
    db.commit()
    db.refresh(g)
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção criado: {g.nome}",
                  usuario=autor, valor_novo=_grupo_snapshot(dados))
    db.commit()
    return _grupo_to_item(g, db)

@app.put("/configuracoes/grupos-excecao/{grupo_id}", response_model=GrupoItem)
def atualizar_grupo(grupo_id: str, request: Request, dados: GrupoInput, db: Session = Depends(get_db)):
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    from datetime import time as dtime
    autor    = get_usuario_requisicao(request, db)
    anterior = json.dumps({"nome": g.nome, "fora_horario": g.fora_horario,
                            "janela_inicio": g.janela_inicio.strftime("%H:%M") if g.janela_inicio else None,
                            "janela_fim": g.janela_fim.strftime("%H:%M") if g.janela_fim else None}, ensure_ascii=False)
    g.nome          = dados.nome
    g.fora_horario  = dados.fora_horario
    g.janela_inicio = dtime.fromisoformat(dados.janela_inicio) if dados.janela_inicio else None
    g.janela_fim    = dtime.fromisoformat(dados.janela_fim)    if dados.janela_fim    else None
    db.commit()
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção atualizado: {g.nome}",
                  usuario=autor, valor_anterior=anterior, valor_novo=_grupo_snapshot(dados))
    db.commit()
    return _grupo_to_item(g, db)

@app.delete("/configuracoes/grupos-excecao/{grupo_id}", status_code=204)
def excluir_grupo(grupo_id: str, request: Request, db: Session = Depends(get_db)):
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    autor = get_usuario_requisicao(request, db)
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção excluído: {g.nome}",
                  usuario=autor,
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
    existente = db.query(MembroGrupoExcecao).filter(
        MembroGrupoExcecao.grupo_id == grupo_id,
        MembroGrupoExcecao.usuario_id == dados.usuario_id,
    ).first()
    if not existente:
        db.add(MembroGrupoExcecao(grupo_id=grupo_id, usuario_id=dados.usuario_id))
        db.commit()
        registrar_log(db, "sistema", "grupos_excecao",
                      f"Membro adicionado ao grupo '{g.nome}': {u.email}", usuario=autor)
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
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    registrar_log(db, "sistema", "grupos_excecao",
                  f"Membro removido do grupo '{g.nome if g else grupo_id}': {u.email if u else usuario_id}",
                  usuario=autor)
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

@app.put("/configuracoes/pbi", response_model=CredenciaisPBIItem)
def salvar_credenciais_pbi(request: Request, dados: CredenciaisPBIInput, db: Session = Depends(get_db)):
    def _upsert(chave, valor):
        r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == chave).first()
        if r:
            r.valor = valor
        else:
            db.add(ConfiguracaoSistema(chave=chave, valor=valor, eh_secreto=chave == "PBI_CLIENT_SECRET"))
    _upsert("PBI_TENANT_ID", dados.tenant_id)
    _upsert("PBI_CLIENT_ID", dados.client_id)
    if dados.client_secret and dados.client_secret != "••••••••":
        _upsert("PBI_CLIENT_SECRET", dados.client_secret)
    db.commit()
    autor = get_usuario_requisicao(request, db)
    registrar_log(db, "sistema", "configuracoes_pbi", "Credenciais Power BI atualizadas", usuario=autor)
    db.commit()
    return listar_credenciais_pbi(db)


# ─── Power BI Embed ───────────────────────────────────────────────────────────

def _pbi_access_token() -> str:
    """Obtém access token do Azure AD via client credentials (Service Principal)."""
    if not all([PBI_TENANT_ID, PBI_CLIENT_ID, PBI_CLIENT_SECRET]):
        raise HTTPException(
            status_code=503,
            detail="Credenciais do Power BI não configuradas. Defina PBI_TENANT_ID, PBI_CLIENT_ID e PBI_CLIENT_SECRET no .env.",
        )
    resp = http_requests.post(
        f"https://login.microsoftonline.com/{PBI_TENANT_ID}/oauth2/v2.0/token",
        data={
            "grant_type":    "client_credentials",
            "client_id":     PBI_CLIENT_ID,
            "client_secret": PBI_CLIENT_SECRET,
            "scope":         "https://analysis.windows.net/powerbi/api/.default",
        },
        timeout=15,
    )
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"Falha ao autenticar no Azure AD: {resp.text}")
    return resp.json()["access_token"]


class EmbedResponse(BaseModel):
    embed_url:   str
    embed_token: str
    token_expiry: str
    report_id:   str
    workspace_id: str


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

    access_token = _pbi_access_token()
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

    # Gera o embed token
    token_resp = http_requests.post(
        f"https://api.powerbi.com/v1.0/myorg/groups/{ws.id_workspace_pbi}/reports/{rel.id_relatorio_pbi}/GenerateToken",
        headers={**headers, "Content-Type": "application/json"},
        json={"accessLevel": "View"},
        timeout=15,
    )
    if not token_resp.ok:
        raise HTTPException(status_code=502, detail=f"Falha ao gerar embed token: {token_resp.text}")

    token_data = token_resp.json()
    autor = get_usuario_requisicao(request, db)
    registrar_log(db, "relatorio", "relatorios", f"Relatório visualizado: {rel.nome}", usuario=autor)

    return EmbedResponse(
        embed_url=embed_url,
        embed_token=token_data["token"],
        token_expiry=token_data["expiration"],
        report_id=rel.id_relatorio_pbi,
        workspace_id=ws.id_workspace_pbi,
    )

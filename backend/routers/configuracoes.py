from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from models import RegraExpediente, GrupoExcecao, MembroGrupoExcecao, ConfiguracaoSistema, Usuario
from dependencies import get_usuario_requisicao, exigir_permissao, PERFIS_ADMIN
from services.audit_service import registrar_log, salvar_backup_critico
from schemas import (
    RegraExpedienteItem, RegraExpedienteInput,
    MembroItem, GrupoItem, GrupoInput,
    CredencialPBIItem, CredencialPBIInput,
)
from datetime import time as dtime

router = APIRouter(tags=["configuracoes"])

DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]


class AdicionarMembroInput(BaseModel):
    usuario_id: str


def _grupo_to_item(g: GrupoExcecao, db: Session) -> GrupoItem:
    membros = (db.query(MembroGrupoExcecao, Usuario).join(Usuario, MembroGrupoExcecao.usuario_id == Usuario.id)
               .filter(MembroGrupoExcecao.grupo_id == g.id).all())
    return GrupoItem(id=g.id, nome=g.nome, fora_horario=g.fora_horario, status=g.status,
                     janela_inicio=g.janela_inicio.strftime("%H:%M") if g.janela_inicio else None,
                     janela_fim=g.janela_fim.strftime("%H:%M") if g.janela_fim else None,
                     ignora_dia_inativo=g.ignora_dia_inativo,
                     membros=[MembroItem(usuario_id=u.id, nome=u.nome, email=u.email) for _, u in membros])


@router.get("/configuracoes/expediente", response_model=List[RegraExpedienteItem])
def listar_expediente(db: Session = Depends(get_db)):
    regras = {r.dia_semana: r for r in db.query(RegraExpediente).all()}
    return [RegraExpedienteItem(dia_semana=dia, nome_dia=DIAS_SEMANA[dia],
                                hora_inicio=regras[dia].hora_inicio.strftime("%H:%M") if dia in regras else None,
                                hora_fim=regras[dia].hora_fim.strftime("%H:%M") if dia in regras else None,
                                ativo=regras[dia].ativo if dia in regras else False,
                                bloquear_fora=regras[dia].bloquear_fora if dia in regras else True) for dia in range(7)]


@router.put("/configuracoes/expediente/{dia_semana}", response_model=RegraExpedienteItem)
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
        regra.hora_inicio = hi; regra.hora_fim = hf; regra.ativo = dados.ativo; regra.bloquear_fora = dados.bloquear_fora
    else:
        regra = RegraExpediente(dia_semana=dia_semana, hora_inicio=hi, hora_fim=hf, ativo=dados.ativo, bloquear_fora=dados.bloquear_fora)
        db.add(regra)
    db.commit()
    registrar_log(db, "sistema", "expediente", f"Regra do {DIAS_SEMANA[dia_semana]} atualizada: {dados.hora_inicio}–{dados.hora_fim} ativo={dados.ativo}",
                  usuario=autor, request=request)
    db.commit()
    return RegraExpedienteItem(dia_semana=dia_semana, nome_dia=DIAS_SEMANA[dia_semana],
                               hora_inicio=dados.hora_inicio, hora_fim=dados.hora_fim,
                               ativo=dados.ativo, bloquear_fora=dados.bloquear_fora)


@router.get("/configuracoes/grupos-excecao", response_model=List[GrupoItem])
def listar_grupos(db: Session = Depends(get_db)):
    grupos = db.query(GrupoExcecao).order_by(GrupoExcecao.nome).all()
    return [_grupo_to_item(g, db) for g in grupos]


@router.post("/configuracoes/grupos-excecao", response_model=GrupoItem, status_code=201)
def criar_grupo(request: Request, dados: GrupoInput, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "criar", db)
    ji = dtime.fromisoformat(dados.janela_inicio) if dados.janela_inicio else None
    jf = dtime.fromisoformat(dados.janela_fim)    if dados.janela_fim    else None
    g = GrupoExcecao(nome=dados.nome, fora_horario=dados.fora_horario, janela_inicio=ji, janela_fim=jf, ignora_dia_inativo=dados.ignora_dia_inativo)
    db.add(g); db.commit(); db.refresh(g)
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção criado: {g.nome}", usuario=autor, request=request)
    db.commit()
    return _grupo_to_item(g, db)


@router.put("/configuracoes/grupos-excecao/{grupo_id}", response_model=GrupoItem)
def atualizar_grupo(grupo_id: str, request: Request, dados: GrupoInput, db: Session = Depends(get_db)):
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    g.nome = dados.nome; g.fora_horario = dados.fora_horario
    g.janela_inicio = dtime.fromisoformat(dados.janela_inicio) if dados.janela_inicio else None
    g.janela_fim    = dtime.fromisoformat(dados.janela_fim)    if dados.janela_fim    else None
    g.ignora_dia_inativo = dados.ignora_dia_inativo
    db.commit()
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção atualizado: {g.nome}", usuario=autor, request=request)
    db.commit()
    return _grupo_to_item(g, db)


@router.delete("/configuracoes/grupos-excecao/{grupo_id}", status_code=204)
def excluir_grupo(grupo_id: str, request: Request, db: Session = Depends(get_db)):
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "excluir", db)
    registrar_log(db, "sistema", "grupos_excecao", f"Grupo de exceção excluído: {g.nome}", usuario=autor, request=request)
    db.delete(g); db.commit()


@router.post("/configuracoes/grupos-excecao/{grupo_id}/membros", status_code=201)
def adicionar_membro(grupo_id: str, request: Request, dados: AdicionarMembroInput, db: Session = Depends(get_db)):
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    u = db.query(Usuario).filter(Usuario.id == dados.usuario_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    existente = db.query(MembroGrupoExcecao).filter(MembroGrupoExcecao.grupo_id == grupo_id, MembroGrupoExcecao.usuario_id == dados.usuario_id).first()
    if not existente:
        db.add(MembroGrupoExcecao(grupo_id=grupo_id, usuario_id=dados.usuario_id))
        db.commit()
        registrar_log(db, "sistema", "grupos_excecao", f"Membro adicionado ao grupo '{g.nome}': {u.email}", usuario=autor, request=request)
        db.commit()
    return _grupo_to_item(g, db)


@router.delete("/configuracoes/grupos-excecao/{grupo_id}/membros/{usuario_id}", status_code=204)
def remover_membro(grupo_id: str, usuario_id: str, request: Request, db: Session = Depends(get_db)):
    m = db.query(MembroGrupoExcecao).filter(MembroGrupoExcecao.grupo_id == grupo_id, MembroGrupoExcecao.usuario_id == usuario_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    g = db.query(GrupoExcecao).filter(GrupoExcecao.id == grupo_id).first()
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    registrar_log(db, "sistema", "grupos_excecao",
                  f"Membro removido do grupo '{g.nome if g else grupo_id}': {u.email if u else usuario_id}",
                  usuario=autor, request=request)
    db.delete(m); db.commit()


PBI_CHAVES = ["PBI_TENANT_ID", "PBI_CLIENT_ID", "PBI_CLIENT_SECRET"]


@router.get("/configuracoes/pbi", response_model=CredencialPBIItem)
def listar_credenciais_pbi(db: Session = Depends(get_db)):
    def _get(chave):
        r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == chave).first()
        return r.valor if r else ""
    secret = _get("PBI_CLIENT_SECRET")
    return CredencialPBIItem(tenant_id=_get("PBI_TENANT_ID"), client_id=_get("PBI_CLIENT_ID"),
                              client_secret="••••••••" if secret else "")


@router.get("/configuracoes/pbi/secret")
def revelar_secret_pbi(request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor or autor.perfil not in PERFIS_ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == "PBI_CLIENT_SECRET").first()
    return {"client_secret": r.valor if r else ""}


@router.put("/configuracoes/pbi", response_model=CredencialPBIItem)
def salvar_credenciais_pbi(request: Request, dados: CredencialPBIInput, db: Session = Depends(get_db)):
    autor_perm = get_usuario_requisicao(request, db)
    exigir_permissao(autor_perm, "configuracoes", "editar", db)
    def _get(chave):
        r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == chave).first()
        return r.valor if r else ""
    def _upsert(chave, valor):
        r = db.query(ConfiguracaoSistema).filter(ConfiguracaoSistema.chave == chave).first()
        if r: r.valor = valor
        else: db.add(ConfiguracaoSistema(chave=chave, valor=valor, eh_secreto=chave == "PBI_CLIENT_SECRET"))
    tenant_anterior = _get("PBI_TENANT_ID"); client_anterior = _get("PBI_CLIENT_ID")
    _upsert("PBI_TENANT_ID", dados.tenant_id); _upsert("PBI_CLIENT_ID", dados.client_id)
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
    detalhe = f"Credenciais Power BI alteradas: {', '.join(campos_alterados)}" if campos_alterados else "Credenciais Power BI atualizadas (sem alteração)"
    registrar_log(db, "critico" if campos_alterados else "sistema", "configuracoes_pbi", detalhe, usuario=autor, request=request)
    db.commit()
    return listar_credenciais_pbi(db)

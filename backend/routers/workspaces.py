from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import json
from database import get_db
from models import (
    EspacoTrabalho, Relatorio, AcessoWorkspace, AcessoRelatorio,
    Usuario, LogAuditoria, CategoriaRelatorio
)
from dependencies import get_usuario_requisicao, exigir_permissao
from services.audit_service import registrar_log, salvar_backup_critico
from services.auth_service import vincular_admins_workspace
from services.pbi_service import pbi_access_token
from schemas import (
    WorkspaceItem, WorkspaceCreate, WorkspaceUpdate,
    RelatorioItem, RelatorioCreate,
    CategoriaRelatorioItem, CategoriaRelatorioCriar, CategoriaRelatorioAtualizar,
    UsuarioWorkspaceItem, VincularUsuarioInput, AlterarNivelInput,
    SetAcessosRelatorioInput, EmbedResponse,
)
import re
import requests as http_requests

router = APIRouter(tags=["workspaces"])

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)

def _validar_uuid_pbi(id_relatorio_pbi: str | None, status: str, workspace_pbi_id: str | None = None, db=None):
    """Impede publicação sem UUID válido do Power BI. Se o workspace tiver ID PBI configurado, verifica também na API."""
    if status != "publicado":
        return

    if not id_relatorio_pbi or not _UUID_RE.match(id_relatorio_pbi.strip()):
        raise HTTPException(
            status_code=422,
            detail="Para publicar um relatório é obrigatório informar um UUID válido do relatório no Power BI. Salve como Rascunho até vincular o relatório.",
        )

    if not workspace_pbi_id or not db:
        return

    try:
        access_token = pbi_access_token(db)
        resp = http_requests.get(
            f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_pbi_id}/reports/{id_relatorio_pbi.strip()}",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if resp.status_code == 404:
            raise HTTPException(
                status_code=422,
                detail="O UUID informado não corresponde a nenhum relatório publicado neste workspace no Power BI. Verifique o ID e tente novamente.",
            )
        if not resp.ok:
            raise HTTPException(
                status_code=422,
                detail=f"Não foi possível validar o relatório no Power BI (status {resp.status_code}). Verifique as credenciais ou tente novamente.",
            )
    except HTTPException:
        raise
    except Exception:
        # Se a chamada ao PBI falhar por timeout ou rede, não bloqueia — o formato já foi validado
        pass

NIVEIS_VALIDOS = {"total", "apenas_relatorios", "nenhum"}


def _rel_to_item(rel: Relatorio) -> RelatorioItem:
    return RelatorioItem(
        id=rel.id, nome=rel.nome, categoria=rel.categoria, categoria_id=rel.categoria_id,
        status=rel.status, descricao=rel.descricao, id_relatorio_pbi=rel.id_relatorio_pbi,
        criado_em=rel.criado_em.isoformat() if rel.criado_em else None,
    )


def _rel_snapshot(rel):
    return json.dumps({"nome": rel.nome, "categoria": rel.categoria, "status": rel.status,
                       "descricao": rel.descricao, "id_relatorio_pbi": rel.id_relatorio_pbi}, ensure_ascii=False)


# ─── Categorias de Relatório ──────────────────────────────────────────────────

@router.get("/categorias-relatorio", response_model=List[CategoriaRelatorioItem])
def listar_categorias(apenas_ativas: bool = True, db: Session = Depends(get_db)):
    q = db.query(CategoriaRelatorio)
    if apenas_ativas:
        q = q.filter(CategoriaRelatorio.ativo == True)
    return q.order_by(CategoriaRelatorio.nome).all()


@router.post("/categorias-relatorio", response_model=CategoriaRelatorioItem, status_code=201)
def criar_categoria(request: Request, dados: CategoriaRelatorioCriar, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "criar", db)
    if db.query(CategoriaRelatorio).filter(CategoriaRelatorio.nome == dados.nome).first():
        raise HTTPException(status_code=409, detail="Categoria já existe.")
    cat = CategoriaRelatorio(nome=dados.nome, cor=dados.cor, icone=dados.icone)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categorias-relatorio/{cat_id}", response_model=CategoriaRelatorioItem)
def atualizar_categoria(cat_id: str, request: Request, dados: CategoriaRelatorioAtualizar, db: Session = Depends(get_db)):
    cat = db.query(CategoriaRelatorio).filter(CategoriaRelatorio.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    cat.nome = dados.nome
    if dados.cor is not None:
        cat.cor = dados.cor
    if dados.icone is not None:
        cat.icone = dados.icone
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categorias-relatorio/{cat_id}", status_code=200)
def excluir_categoria(cat_id: str, request: Request, db: Session = Depends(get_db)):
    cat = db.query(CategoriaRelatorio).filter(CategoriaRelatorio.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "excluir", db)
    cat.ativo = False
    db.commit()
    return {"mensagem": "Categoria desativada."}


# ─── Workspaces ───────────────────────────────────────────────────────────────

@router.get("/workspaces", response_model=List[WorkspaceItem])
def listar_workspaces(incluir_arquivados: bool = False, db: Session = Depends(get_db)):
    q = db.query(EspacoTrabalho)
    if not incluir_arquivados:
        q = q.filter(EspacoTrabalho.status == "ativo")
    return q.order_by(EspacoTrabalho.nome).all()


@router.post("/workspaces", response_model=WorkspaceItem, status_code=201)
def criar_workspace(request: Request, dados: WorkspaceCreate, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "criar", db)
    ws = EspacoTrabalho(nome=dados.nome, icone=dados.icone, cor=dados.cor, descricao=dados.descricao, id_workspace_pbi=dados.id_workspace_pbi, status="ativo", criado_por_id=autor.id if autor else None)
    db.add(ws)
    db.flush()
    vincular_admins_workspace(ws.id, db)
    db.commit()
    db.refresh(ws)
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace criado: {ws.nome}", usuario=autor, request=request,
                  valor_novo=json.dumps({"nome": ws.nome, "icone": ws.icone, "cor": ws.cor, "descricao": ws.descricao, "id_workspace_pbi": ws.id_workspace_pbi}, ensure_ascii=False))
    db.commit()
    return ws


@router.put("/workspaces/{workspace_id}", response_model=WorkspaceItem)
def atualizar_workspace(workspace_id: str, request: Request, dados: WorkspaceUpdate, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    anterior = json.dumps({"nome": ws.nome, "icone": ws.icone, "cor": ws.cor, "descricao": ws.descricao, "id_workspace_pbi": ws.id_workspace_pbi}, ensure_ascii=False)
    id_pbi_anterior = ws.id_workspace_pbi
    ws.nome = dados.nome; ws.icone = dados.icone; ws.cor = dados.cor
    ws.descricao = dados.descricao; ws.id_workspace_pbi = dados.id_workspace_pbi
    db.commit(); db.refresh(ws)
    id_pbi_mudou = id_pbi_anterior != ws.id_workspace_pbi
    registrar_log(db, "critico" if id_pbi_mudou else "sistema", "espacos_trabalho",
                  f"ID Power BI do workspace '{ws.nome}' alterado" if id_pbi_mudou else f"Workspace atualizado: {ws.nome}",
                  usuario=autor, request=request, valor_anterior=anterior,
                  valor_novo=json.dumps({"nome": ws.nome, "icone": ws.icone, "cor": ws.cor, "descricao": ws.descricao, "id_workspace_pbi": ws.id_workspace_pbi}, ensure_ascii=False))
    if id_pbi_mudou:
        salvar_backup_critico(db, "workspace", ws.id, "id_workspace_pbi", id_pbi_anterior, ws.id_workspace_pbi, autor)
    db.commit()
    return ws


@router.delete("/workspaces/{workspace_id}", status_code=204)
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


@router.patch("/workspaces/{workspace_id}/arquivar")
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


@router.patch("/workspaces/{workspace_id}/reativar")
def reativar_workspace(workspace_id: str, request: Request, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    ws.status = "ativo"
    vincular_admins_workspace(ws.id, db)
    db.commit()
    registrar_log(db, "sistema", "espacos_trabalho", f"Workspace reativado: {ws.nome}", usuario=autor, request=request)
    db.commit()
    return {"mensagem": "Workspace reativado com sucesso."}


@router.get("/workspaces/{workspace_id}/usuarios", response_model=List[UsuarioWorkspaceItem])
def listar_usuarios_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    registros = (
        db.query(AcessoWorkspace, Usuario).join(Usuario, AcessoWorkspace.usuario_id == Usuario.id)
        .filter(AcessoWorkspace.espaco_trabalho_id == workspace_id, AcessoWorkspace.nivel_acesso != "nenhum",
                Usuario.status == "ativo", Usuario.perfil.notin_(["master", "administrador"]))
        .order_by(Usuario.nome).all()
    )
    return [UsuarioWorkspaceItem(usuario_id=a.usuario_id, nome=u.nome, email=u.email, perfil=u.perfil, nivel_acesso=a.nivel_acesso) for a, u in registros]


@router.post("/workspaces/{workspace_id}/usuarios", response_model=UsuarioWorkspaceItem, status_code=201)
def vincular_usuario_workspace(workspace_id: str, request: Request, dados: VincularUsuarioInput, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    usuario = db.query(Usuario).filter(Usuario.id == dados.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if dados.nivel_acesso not in NIVEIS_VALIDOS:
        raise HTTPException(status_code=422, detail="Nível de acesso inválido.")
    existente = db.query(AcessoWorkspace).filter(AcessoWorkspace.usuario_id == dados.usuario_id, AcessoWorkspace.espaco_trabalho_id == workspace_id).first()
    if existente:
        existente.nivel_acesso = dados.nivel_acesso
    else:
        db.add(AcessoWorkspace(usuario_id=dados.usuario_id, espaco_trabalho_id=workspace_id, nivel_acesso=dados.nivel_acesso))
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    db.commit()
    registrar_log(db, "acesso", "acessos_workspace", f"Usuário {usuario.email} vinculado ao workspace {ws.nome} ({dados.nivel_acesso})",
                  usuario=autor, request=request,
                  valor_novo=json.dumps({"usuario": usuario.email, "workspace": ws.nome, "nivel": dados.nivel_acesso}, ensure_ascii=False))
    db.commit()
    return UsuarioWorkspaceItem(usuario_id=usuario.id, nome=usuario.nome, email=usuario.email, perfil=usuario.perfil, nivel_acesso=dados.nivel_acesso)


@router.patch("/workspaces/{workspace_id}/usuarios/{usuario_id}", response_model=UsuarioWorkspaceItem)
def alterar_nivel_usuario_workspace(workspace_id: str, usuario_id: str, request: Request, dados: AlterarNivelInput, db: Session = Depends(get_db)):
    acesso = db.query(AcessoWorkspace).filter(AcessoWorkspace.espaco_trabalho_id == workspace_id, AcessoWorkspace.usuario_id == usuario_id).first()
    if not acesso:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    if dados.nivel_acesso not in NIVEIS_VALIDOS:
        raise HTTPException(status_code=422, detail="Nível de acesso inválido.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    nivel_anterior = acesso.nivel_acesso
    acesso.nivel_acesso = dados.nivel_acesso
    db.commit()
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    registrar_log(db, "acesso", "acessos_workspace", f"Nível de {usuario.email} alterado: {nivel_anterior} → {dados.nivel_acesso}",
                  usuario=autor, request=request,
                  valor_anterior=json.dumps({"nivel": nivel_anterior}, ensure_ascii=False),
                  valor_novo=json.dumps({"nivel": dados.nivel_acesso}, ensure_ascii=False))
    db.commit()
    return UsuarioWorkspaceItem(usuario_id=usuario.id, nome=usuario.nome, email=usuario.email, perfil=usuario.perfil, nivel_acesso=dados.nivel_acesso)


@router.delete("/workspaces/{workspace_id}/usuarios/{usuario_id}", status_code=204)
def remover_usuario_workspace(workspace_id: str, usuario_id: str, request: Request, db: Session = Depends(get_db)):
    acesso = db.query(AcessoWorkspace).filter(AcessoWorkspace.espaco_trabalho_id == workspace_id, AcessoWorkspace.usuario_id == usuario_id).first()
    if not acesso:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    db.delete(acesso)
    db.commit()
    registrar_log(db, "acesso", "acessos_workspace", f"Usuário {usuario.email} removido do workspace {ws.nome}",
                  usuario=autor, request=request,
                  valor_anterior=json.dumps({"usuario": usuario.email, "workspace": ws.nome}, ensure_ascii=False))
    db.commit()


@router.get("/workspaces/{workspace_id}/usuarios/{usuario_id}/relatorios")
def listar_relatorios_acesso_usuario(workspace_id: str, usuario_id: str, db: Session = Depends(get_db)):
    relatorios_ids = (
        db.query(AcessoRelatorio.relatorio_id).join(Relatorio, AcessoRelatorio.relatorio_id == Relatorio.id)
        .filter(AcessoRelatorio.usuario_id == usuario_id, Relatorio.espaco_trabalho_id == workspace_id).all()
    )
    return [r for (r,) in relatorios_ids]


@router.put("/workspaces/{workspace_id}/usuarios/{usuario_id}/relatorios")
def set_relatorios_acesso_usuario(workspace_id: str, usuario_id: str, request: Request, dados: SetAcessosRelatorioInput, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    ids_neste_ws = [r.id for r in db.query(Relatorio.id).filter(Relatorio.espaco_trabalho_id == workspace_id).all()]
    db.query(AcessoRelatorio).filter(AcessoRelatorio.usuario_id == usuario_id, AcessoRelatorio.relatorio_id.in_(ids_neste_ws)).delete(synchronize_session=False)
    for rel_id in dados.relatorio_ids:
        db.add(AcessoRelatorio(usuario_id=usuario_id, relatorio_id=rel_id))
    db.commit()
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    registrar_log(db, "acesso", "acessos_relatorio",
        f"Relatórios específicos de {usuario.email} no workspace {ws.nome} atualizados ({len(dados.relatorio_ids)} selecionados)",
        usuario=autor, request=request, valor_novo=json.dumps({"relatorio_ids": dados.relatorio_ids}, ensure_ascii=False))
    db.commit()
    return {"relatorio_ids": dados.relatorio_ids}


@router.get("/workspaces/{workspace_id}/relatorios", response_model=List[RelatorioItem])
def listar_relatorios_workspace(workspace_id: str, usuario_id: Optional[str] = None, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    if usuario_id:
        acesso = db.query(AcessoWorkspace).filter(AcessoWorkspace.usuario_id == usuario_id, AcessoWorkspace.espaco_trabalho_id == workspace_id).first()
        if acesso and acesso.nivel_acesso == "apenas_relatorios":
            ids_permitidos = {r for (r,) in db.query(AcessoRelatorio.relatorio_id).filter(AcessoRelatorio.usuario_id == usuario_id).all()}
            return [_rel_to_item(r) for r in db.query(Relatorio).filter(
                Relatorio.espaco_trabalho_id == workspace_id, Relatorio.status == "publicado", Relatorio.id.in_(ids_permitidos)
            ).order_by(Relatorio.nome).all()]
    relatorios = db.query(Relatorio).filter(Relatorio.espaco_trabalho_id == workspace_id, Relatorio.status != "arquivado").order_by(Relatorio.nome).all()
    return [_rel_to_item(r) for r in relatorios]


@router.post("/workspaces/{workspace_id}/relatorios", response_model=RelatorioItem, status_code=201)
def criar_relatorio(workspace_id: str, request: Request, dados: RelatorioCreate, db: Session = Depends(get_db)):
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "criar", db)
    _validar_uuid_pbi(dados.id_relatorio_pbi, dados.status, ws.id_workspace_pbi, db)
    categoria_nome = dados.categoria
    if dados.categoria_id and not dados.categoria:
        cat = db.query(CategoriaRelatorio).filter(CategoriaRelatorio.id == dados.categoria_id).first()
        if cat:
            categoria_nome = cat.nome
    rel = Relatorio(
        nome=dados.nome, espaco_trabalho_id=workspace_id,
        categoria=categoria_nome or None, categoria_id=dados.categoria_id or None,
        status=dados.status, descricao=dados.descricao or None, id_relatorio_pbi=dados.id_relatorio_pbi or None,
        criado_por_id=autor.id if autor else None,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    registrar_log(db, "sistema", "relatorios", f"Relatório criado: {rel.nome} (workspace: {ws.nome})",
                  usuario=autor, request=request, valor_novo=_rel_snapshot(rel))
    db.commit()
    return _rel_to_item(rel)


@router.put("/workspaces/{workspace_id}/relatorios/{relatorio_id}", response_model=RelatorioItem)
def atualizar_relatorio(workspace_id: str, relatorio_id: str, request: Request, dados: RelatorioCreate, db: Session = Depends(get_db)):
    rel = db.query(Relatorio).filter(Relatorio.id == relatorio_id, Relatorio.espaco_trabalho_id == workspace_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relatório não encontrado.")
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "editar", db)
    _validar_uuid_pbi(dados.id_relatorio_pbi, dados.status, ws.id_workspace_pbi if ws else None, db)
    anterior = _rel_snapshot(rel)
    id_pbi_anterior = rel.id_relatorio_pbi
    categoria_nome = dados.categoria
    if dados.categoria_id and not dados.categoria:
        cat = db.query(CategoriaRelatorio).filter(CategoriaRelatorio.id == dados.categoria_id).first()
        if cat:
            categoria_nome = cat.nome
    rel.nome = dados.nome; rel.categoria = categoria_nome or None
    rel.categoria_id = dados.categoria_id or None
    rel.status = dados.status; rel.descricao = dados.descricao or None
    rel.id_relatorio_pbi = dados.id_relatorio_pbi or None
    db.commit(); db.refresh(rel)
    id_pbi_mudou = id_pbi_anterior != rel.id_relatorio_pbi
    registrar_log(db, "critico" if id_pbi_mudou else "sistema", "relatorios",
                  f"ID Power BI do relatório '{rel.nome}' alterado" if id_pbi_mudou else f"Relatório atualizado: {rel.nome}",
                  usuario=autor, request=request, valor_anterior=anterior, valor_novo=_rel_snapshot(rel))
    if id_pbi_mudou:
        salvar_backup_critico(db, "relatorio", rel.id, "id_relatorio_pbi", id_pbi_anterior, rel.id_relatorio_pbi, autor)
    db.commit()
    return _rel_to_item(rel)


@router.delete("/workspaces/{workspace_id}/relatorios/{relatorio_id}", status_code=204)
def excluir_relatorio(workspace_id: str, relatorio_id: str, request: Request, db: Session = Depends(get_db)):
    rel = db.query(Relatorio).filter(Relatorio.id == relatorio_id, Relatorio.espaco_trabalho_id == workspace_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relatório não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "configuracoes", "excluir", db)
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == workspace_id).first()
    registrar_log(db, "sistema", "relatorios", f"Relatório excluído: {rel.nome} (workspace: {ws.nome if ws else workspace_id})",
                  usuario=autor, request=request, valor_anterior=_rel_snapshot(rel))
    db.delete(rel)
    db.commit()


@router.get("/relatorios/{relatorio_id}/embed", response_model=EmbedResponse)
def embed_relatorio(relatorio_id: str, request: Request, db: Session = Depends(get_db)):
    rel = db.query(Relatorio).filter(Relatorio.id == relatorio_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relatório não encontrado.")
    if not rel.id_relatorio_pbi:
        raise HTTPException(status_code=422, detail="Este relatório não possui ID do Power BI configurado.")
    ws = db.query(EspacoTrabalho).filter(EspacoTrabalho.id == rel.espaco_trabalho_id).first()
    if not ws or not ws.id_workspace_pbi:
        raise HTTPException(status_code=422, detail="O workspace deste relatório não possui ID do Power BI configurado.")
    access_token = pbi_access_token(db)
    headers = {"Authorization": f"Bearer {access_token}"}
    report_resp = http_requests.get(
        f"https://api.powerbi.com/v1.0/myorg/groups/{ws.id_workspace_pbi}/reports/{rel.id_relatorio_pbi}",
        headers=headers, timeout=15,
    )
    if not report_resp.ok:
        raise HTTPException(status_code=502, detail=f"Falha ao buscar relatório no Power BI: {report_resp.text}")
    embed_url = report_resp.json().get("embedUrl", "")
    dataset_id = report_resp.json().get("datasetId", "")
    if not dataset_id:
        raise HTTPException(status_code=502, detail="Não foi possível obter o dataset ID do relatório no Power BI.")
    token_resp = http_requests.post(
        "https://api.powerbi.com/v1.0/myorg/GenerateToken",
        headers={**headers, "Content-Type": "application/json"},
        json={"reports": [{"id": rel.id_relatorio_pbi, "allowEdit": False}],
              "datasets": [{"id": dataset_id}], "targetWorkspaces": [{"id": ws.id_workspace_pbi}]},
        timeout=15,
    )
    if not token_resp.ok:
        raise HTTPException(status_code=502, detail=f"Falha ao gerar embed token: {token_resp.text}")
    token_data = token_resp.json()
    autor = get_usuario_requisicao(request, db)
    detalhe_log = f"Relatório visualizado: {rel.nome}"
    janela = datetime.now(timezone.utc) - timedelta(seconds=5)
    ja_registrado = db.query(LogAuditoria).filter(
        LogAuditoria.tipo_evento == "relatorio", LogAuditoria.detalhe == detalhe_log,
        LogAuditoria.usuario_id == (autor.id if autor else None), LogAuditoria.momento >= janela,
    ).first()
    if not ja_registrado:
        registrar_log(db, "relatorio", "relatorios", detalhe_log, usuario=autor, request=request)
        db.commit()
    return EmbedResponse(
        embed_url=embed_url, embed_token=token_data["token"],
        token_expiry=token_data["expiration"], report_id=rel.id_relatorio_pbi, workspace_id=ws.id_workspace_pbi,
    )


@router.get("/pbi/workspace-info")
def pbi_workspace_info(workspace_pbi_id: str, db: Session = Depends(get_db)):
    access_token = pbi_access_token(db)
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = http_requests.get(f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_pbi_id}", headers=headers, timeout=15)
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Workspace não encontrado no Power BI.")
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar Power BI: {resp.text}")
    data = resp.json()
    return {"name": data.get("name", ""), "type": data.get("type", "")}


@router.get("/pbi/relatorio-info")
def pbi_relatorio_info(workspace_pbi_id: str, report_pbi_id: str, db: Session = Depends(get_db)):
    access_token = pbi_access_token(db)
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = http_requests.get(f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_pbi_id}/reports/{report_pbi_id}", headers=headers, timeout=15)
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Relatório não encontrado no Power BI.")
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar Power BI: {resp.text}")
    data = resp.json()
    return {"name": data.get("name", ""), "web_url": data.get("webUrl", "")}

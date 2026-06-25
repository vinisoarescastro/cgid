from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import json
from datetime import datetime, timezone
from database import get_db
from models import Usuario, PermissaoPerfil, PacotePermissao, PacotePermissaoItem, UsuarioPacote, Perfil
from dependencies import get_usuario_requisicao, exigir_permissao, checar_permissao
from services.audit_service import registrar_log
from schemas import PermissaoPerfilInput, PacoteItemInput, PacoteInput, PapelInput

router = APIRouter(tags=["permissoes"])

_CAMPOS_ACAO = {
    "visualizar": "pode_visualizar", "criar": "pode_criar", "editar": "pode_editar",
    "excluir": "pode_excluir", "exportar": "pode_exportar", "gerenciar": "pode_gerenciar",
}
_PERFIS_VALIDOS_PERM  = {"master", "administrador", "coordenador", "colaborador", "convidado"}
_MODULOS_VALIDOS_PERM = {"usuarios", "permissoes", "relatorios", "workspaces", "auditoria",
                         "seguranca", "configuracoes", "expediente", "grupos_excecao", "landbank", "departamentos"}


@router.get("/api/perfis")
def listar_perfis(db: Session = Depends(get_db)):
    perfis = db.query(Perfil).order_by(Perfil.nivel_hierarquia.desc()).all()
    return [{"codigo": p.codigo, "nome_exibicao": p.nome_exibicao, "descricao": p.descricao,
             "nivel_hierarquia": p.nivel_hierarquia, "pode_ser_atribuido": p.pode_ser_atribuido} for p in perfis]


@router.get("/api/me/permissoes")
def minhas_permissoes(request: Request, db: Session = Depends(get_db)):
    usuario = get_usuario_requisicao(request, db)
    if not usuario:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    resultado = {}
    for modulo in _MODULOS_VALIDOS_PERM:
        resultado[modulo] = {acao: checar_permissao(usuario, modulo, acao, db) for acao in _CAMPOS_ACAO}
    return resultado


@router.get("/api/permissoes/perfis")
def listar_permissoes_perfis(request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor or autor.perfil != "master":
        raise HTTPException(status_code=403, detail="Acesso restrito a masters.")
    registros = db.query(PermissaoPerfil).all()
    return [{"perfil": r.perfil, "modulo": r.modulo, "pode_visualizar": r.pode_visualizar, "pode_criar": r.pode_criar,
             "pode_editar": r.pode_editar, "pode_excluir": r.pode_excluir, "pode_exportar": r.pode_exportar, "pode_gerenciar": r.pode_gerenciar}
            for r in registros]


@router.put("/api/permissoes/perfis/{perfil}/{modulo}")
def atualizar_permissao_perfil(perfil: str, modulo: str, dados: PermissaoPerfilInput, request: Request, db: Session = Depends(get_db)):
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
        anterior = {"pode_visualizar": pp.pode_visualizar, "pode_criar": pp.pode_criar, "pode_editar": pp.pode_editar,
                    "pode_excluir": pp.pode_excluir, "pode_exportar": pp.pode_exportar, "pode_gerenciar": pp.pode_gerenciar}
        pp.pode_visualizar = dados.pode_visualizar; pp.pode_criar = dados.pode_criar
        pp.pode_editar = dados.pode_editar; pp.pode_excluir = dados.pode_excluir
        pp.pode_exportar = dados.pode_exportar; pp.pode_gerenciar = dados.pode_gerenciar
    else:
        pp = PermissaoPerfil(perfil=perfil, modulo=modulo, pode_visualizar=dados.pode_visualizar, pode_criar=dados.pode_criar,
                             pode_editar=dados.pode_editar, pode_excluir=dados.pode_excluir, pode_exportar=dados.pode_exportar, pode_gerenciar=dados.pode_gerenciar)
        db.add(pp)
    novo = {"pode_visualizar": dados.pode_visualizar, "pode_criar": dados.pode_criar, "pode_editar": dados.pode_editar,
            "pode_excluir": dados.pode_excluir, "pode_exportar": dados.pode_exportar, "pode_gerenciar": dados.pode_gerenciar}
    registrar_log(db, "permissao", "permissoes", f"Permissão de perfil atualizada: {perfil}/{modulo}",
                  usuario=autor, request=request, valor_anterior=json.dumps(anterior) if anterior else None, valor_novo=json.dumps(novo))
    db.commit()
    return {"ok": True}


@router.get("/api/usuarios/{usuario_id}/permissoes")
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
        efetiva = {}
        for acao, campo in _CAMPOS_ACAO.items():
            if pp:
                efetiva[acao] = bool(getattr(pp, campo))
            else:
                efetiva[acao] = False
        pacote_ids = [up.pacote_id for up in db.query(UsuarioPacote).filter_by(usuario_id=usuario_id).all()]
        if pacote_ids:
            from models import PacotePermissaoItem
            itens = db.query(PacotePermissaoItem).filter(
                PacotePermissaoItem.pacote_id.in_(pacote_ids), PacotePermissaoItem.modulo == modulo).all()
            for acao, campo in _CAMPOS_ACAO.items():
                if not efetiva[acao] and any(getattr(item, campo) for item in itens):
                    efetiva[acao] = True
        resultado.append({
            "modulo": modulo,
            "permissao_perfil": {campo: bool(getattr(pp, campo)) for campo in _CAMPOS_ACAO.values()} if pp else {campo: False for campo in _CAMPOS_ACAO.values()},
            "sobrescrita": None,
            "efetiva": efetiva,
        })
    return resultado


@router.get("/api/controle-acesso/pacotes")
def listar_pacotes(request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    exigir_permissao(autor, "permissoes", "visualizar", db)
    pacotes = db.query(PacotePermissao).order_by(PacotePermissao.nome).all()
    resultado = []
    for p in pacotes:
        n_usuarios = db.query(UsuarioPacote).filter_by(pacote_id=p.id).count()
        resultado.append({"id": p.id, "nome": p.nome, "descricao": p.descricao,
                          "criado_em": p.criado_em.isoformat() if p.criado_em else None,
                          "n_usuarios": n_usuarios,
                          "itens": [{"modulo": i.modulo, "pode_visualizar": i.pode_visualizar, "pode_criar": i.pode_criar,
                                     "pode_editar": i.pode_editar, "pode_excluir": i.pode_excluir,
                                     "pode_exportar": i.pode_exportar, "pode_gerenciar": i.pode_gerenciar} for i in p.itens]})
    return resultado


@router.post("/api/controle-acesso/pacotes", status_code=201)
def criar_pacote(dados: PacoteInput, request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    exigir_permissao(autor, "permissoes", "criar", db)
    if db.query(PacotePermissao).filter_by(nome=dados.nome).first():
        raise HTTPException(status_code=409, detail="Já existe um pacote com esse nome.")
    pacote = PacotePermissao(nome=dados.nome, descricao=dados.descricao, criado_por_id=autor.id)
    db.add(pacote); db.flush()
    for item_d in dados.itens:
        if item_d.modulo not in _MODULOS_VALIDOS_PERM: continue
        db.add(PacotePermissaoItem(pacote_id=pacote.id, modulo=item_d.modulo,
            pode_visualizar=item_d.pode_visualizar, pode_criar=item_d.pode_criar, pode_editar=item_d.pode_editar,
            pode_excluir=item_d.pode_excluir, pode_exportar=item_d.pode_exportar, pode_gerenciar=item_d.pode_gerenciar))
    registrar_log(db, "permissao", "permissoes", f"Pacote criado: {pacote.nome}", usuario=autor, request=request)
    db.commit(); db.refresh(pacote)
    return {"id": pacote.id, "nome": pacote.nome, "descricao": pacote.descricao}


@router.put("/api/controle-acesso/pacotes/{pacote_id}")
def atualizar_pacote(pacote_id: str, dados: PacoteInput, request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    exigir_permissao(autor, "permissoes", "editar", db)
    pacote = db.query(PacotePermissao).filter_by(id=pacote_id).first()
    if not pacote:
        raise HTTPException(status_code=404, detail="Pacote não encontrado.")
    if db.query(PacotePermissao).filter(PacotePermissao.nome == dados.nome, PacotePermissao.id != pacote_id).first():
        raise HTTPException(status_code=409, detail="Já existe um pacote com esse nome.")
    pacote.nome = dados.nome; pacote.descricao = dados.descricao
    db.query(PacotePermissaoItem).filter_by(pacote_id=pacote_id).delete()
    for item_d in dados.itens:
        if item_d.modulo not in _MODULOS_VALIDOS_PERM: continue
        db.add(PacotePermissaoItem(pacote_id=pacote_id, modulo=item_d.modulo,
            pode_visualizar=item_d.pode_visualizar, pode_criar=item_d.pode_criar, pode_editar=item_d.pode_editar,
            pode_excluir=item_d.pode_excluir, pode_exportar=item_d.pode_exportar, pode_gerenciar=item_d.pode_gerenciar))
    registrar_log(db, "permissao", "permissoes", f"Pacote atualizado: {pacote.nome}", usuario=autor, request=request)
    db.commit()
    return {"ok": True}


@router.delete("/api/controle-acesso/pacotes/{pacote_id}")
def excluir_pacote(pacote_id: str, request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    exigir_permissao(autor, "permissoes", "excluir", db)
    pacote = db.query(PacotePermissao).filter_by(id=pacote_id).first()
    if not pacote:
        raise HTTPException(status_code=404, detail="Pacote não encontrado.")
    nome = pacote.nome; db.delete(pacote)
    registrar_log(db, "permissao", "permissoes", f"Pacote excluído: {nome}", usuario=autor, request=request)
    db.commit()
    return {"ok": True}


@router.get("/api/controle-acesso/usuarios")
def listar_usuarios_controle_acesso(request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    exigir_permissao(autor, "permissoes", "visualizar", db)
    usuarios = db.query(Usuario).order_by(Usuario.nome).all()
    resultado = []
    for u in usuarios:
        up_list = db.query(UsuarioPacote).filter_by(usuario_id=u.id).all()
        pacotes_info = []
        for up in up_list:
            p = db.query(PacotePermissao).filter_by(id=up.pacote_id).first()
            if p: pacotes_info.append({"id": p.id, "nome": p.nome})
        resultado.append({"id": u.id, "nome": u.nome, "email": u.email, "perfil": u.perfil,
                          "status": u.status, "foto_url": u.foto_url, "pacotes": pacotes_info})
    return resultado


@router.patch("/api/controle-acesso/usuarios/{usuario_id}/papel")
def alterar_papel_usuario(usuario_id: str, dados: PapelInput, request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    exigir_permissao(autor, "permissoes", "editar", db)
    alvo = db.query(Usuario).filter_by(id=usuario_id).first()
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if dados.perfil not in _PERFIS_VALIDOS_PERM:
        raise HTTPException(status_code=422, detail="Perfil inválido.")
    if alvo.perfil == "master" and autor.perfil != "master":
        raise HTTPException(status_code=403, detail="Apenas masters podem alterar outros masters.")
    anterior = alvo.perfil; alvo.perfil = dados.perfil
    registrar_log(db, "usuario", "usuarios", f"Perfil alterado: {alvo.email} de {anterior} para {dados.perfil}",
                  usuario=autor, request=request, valor_anterior=anterior, valor_novo=dados.perfil)
    db.commit()
    return {"ok": True}


@router.post("/api/controle-acesso/usuarios/{usuario_id}/pacotes/{pacote_id}", status_code=201)
def atribuir_pacote_usuario(usuario_id: str, pacote_id: str, request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    exigir_permissao(autor, "permissoes", "editar", db)
    if not db.query(Usuario).filter_by(id=usuario_id).first():
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if not db.query(PacotePermissao).filter_by(id=pacote_id).first():
        raise HTTPException(status_code=404, detail="Pacote não encontrado.")
    if not db.query(UsuarioPacote).filter_by(usuario_id=usuario_id, pacote_id=pacote_id).first():
        db.add(UsuarioPacote(usuario_id=usuario_id, pacote_id=pacote_id, atribuido_por_id=autor.id))
        db.commit()
    return {"ok": True}


@router.delete("/api/controle-acesso/usuarios/{usuario_id}/pacotes/{pacote_id}")
def remover_pacote_usuario(usuario_id: str, pacote_id: str, request: Request, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    if not autor:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    exigir_permissao(autor, "permissoes", "editar", db)
    up = db.query(UsuarioPacote).filter_by(usuario_id=usuario_id, pacote_id=pacote_id).first()
    if up:
        db.delete(up); db.commit()
    return {"ok": True}

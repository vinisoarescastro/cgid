from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import json
from database import get_db
from models import Usuario, PermissaoPerfil, PacotePermissao, PacotePermissaoItem, UsuarioPacote, Perfil
from dependencies import get_usuario_requisicao, exigir_permissao
from services.audit_service import registrar_log
from services.permission_service import obter_permissoes_efetivas
from schemas import PermissaoPerfilInput, PacoteItemInput, PacoteInput, PapelInput
from constants import ACOES_VALIDAS, MODULOS_VALIDOS, PERFIS_VALIDOS, PERFIS_ATRIBUIVEIS

router = APIRouter(tags=["permissoes"])


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
    return obter_permissoes_efetivas(usuario, db)


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
    if perfil not in PERFIS_VALIDOS:
        raise HTTPException(status_code=422, detail="Perfil inválido.")
    if modulo not in MODULOS_VALIDOS:
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

    permissoes_perfil = {
        pp.modulo: pp
        for pp in db.query(PermissaoPerfil).filter_by(perfil=alvo.perfil).all()
    }
    efetivas = obter_permissoes_efetivas(alvo, db)

    return [
        {
            "modulo": modulo,
            "permissao_perfil": {
                campo: bool(getattr(permissoes_perfil[modulo], campo, False))
                for campo in ACOES_VALIDAS.values()
            } if modulo in permissoes_perfil else {campo: False for campo in ACOES_VALIDAS.values()},
            "efetiva": efetivas.get(modulo, {a: False for a in ACOES_VALIDAS}),
        }
        for modulo in sorted(MODULOS_VALIDOS)
    ]


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
        if item_d.modulo not in MODULOS_VALIDOS: continue
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
        if item_d.modulo not in MODULOS_VALIDOS: continue
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
    if dados.perfil not in PERFIS_VALIDOS:
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
    pacote = db.query(PacotePermissao).filter_by(id=pacote_id).first()
    if not pacote:
        raise HTTPException(status_code=404, detail="Pacote não encontrado.")
    if not db.query(UsuarioPacote).filter_by(usuario_id=usuario_id, pacote_id=pacote_id).first():
        db.add(UsuarioPacote(usuario_id=usuario_id, pacote_id=pacote_id, atribuido_por_id=autor.id))
        registrar_log(db, "permissao", "usuarios_pacotes",
                      f"Pacote '{pacote.nome}' atribuído ao usuário {usuario_id}",
                      usuario=autor, request=request)
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
        pacote = db.query(PacotePermissao).filter_by(id=pacote_id).first()
        nome_pacote = pacote.nome if pacote else pacote_id
        db.delete(up)
        registrar_log(db, "permissao", "usuarios_pacotes",
                      f"Pacote '{nome_pacote}' removido do usuário {usuario_id}",
                      usuario=autor, request=request)
        db.commit()
    return {"ok": True}

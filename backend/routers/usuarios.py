from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
import json
from database import get_db
from models import (
    Usuario, AcessoWorkspace, AcessoRelatorio, EspacoTrabalho,
    Relatorio, Favorito, RegraExpediente, GrupoExcecao, MembroGrupoExcecao
)
from dependencies import (
    get_usuario_requisicao, exigir_permissao, PERFIS_VALIDOS, STATUS_VALIDOS, PERFIS_ADMIN, SENHA_PADRAO
)
from services.audit_service import registrar_log
from services.auth_service import vincular_admin_workspaces, verificar_expediente, usuario_tem_excecao_horario, TZ_BRASILIA
from schemas import (
    UsuarioListItem, UsuarioCriar, UsuarioAtualizar, AlterarSenhaInput,
    AcessoWorkspaceItem, AcessoWorkspaceInput, FavoritoItem, FavoritoCriar,
)
from passlib.context import CryptContext

router = APIRouter(tags=["usuarios"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

NIVEIS_VALIDOS = {"total", "apenas_relatorios", "nenhum"}


def _usr_snapshot(u):
    return json.dumps({"nome": u.nome, "email": u.email, "perfil": u.perfil, "status": u.status}, ensure_ascii=False)


def _usuario_to_item(u: Usuario) -> UsuarioListItem:
    dep_nome = u.departamento.nome if u.departamento else None
    return UsuarioListItem(
        id=u.id, nome=u.nome, email=u.email, perfil=u.perfil, status=u.status,
        ultimo_login=u.ultimo_login, foto_url=u.foto_url, criado_em=u.criado_em,
        departamento_id=u.departamento_id, departamento_nome=dep_nome,
    )


@router.get("/usuarios", response_model=List[UsuarioListItem])
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
    return [_usuario_to_item(u) for u in q.order_by(Usuario.nome).all()]


@router.post("/usuarios", response_model=UsuarioListItem, status_code=201)
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
        departamento_id=dados.departamento_id,
    )
    db.add(usuario)
    db.flush()
    if dados.perfil in PERFIS_ADMIN:
        vincular_admin_workspaces(usuario.id, db)
    registrar_log(db, "usuario", "usuarios", f"Usuário criado: {dados.email}",
                  usuario=autor, request=request,
                  valor_novo=json.dumps({"nome": dados.nome, "email": dados.email, "perfil": dados.perfil}, ensure_ascii=False))
    db.commit()
    db.refresh(usuario)
    return _usuario_to_item(usuario)


@router.put("/usuarios/{usuario_id}", response_model=UsuarioListItem)
def atualizar_usuario(usuario_id: str, request: Request, dados: UsuarioAtualizar, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
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
            vincular_admin_workspaces(usuario.id, db)
    if dados.status:
        if dados.status not in STATUS_VALIDOS:
            raise HTTPException(status_code=422, detail="Status inválido.")
        if dados.status == "ativo":
            usuario.tentativas_login = 0
        usuario.status = dados.status
    if dados.senha:
        usuario.hash_senha = pwd.hash(dados.senha)
    if dados.departamento_id is not None:
        usuario.departamento_id = dados.departamento_id or None
    registrar_log(db, "usuario", "usuarios", f"Usuário atualizado: {usuario.email}",
                  usuario=autor, request=request, valor_anterior=anterior, valor_novo=_usr_snapshot(usuario))
    db.commit()
    db.refresh(usuario)
    return _usuario_to_item(usuario)


@router.post("/usuarios/{usuario_id}/resetar-senha")
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


@router.post("/usuarios/{usuario_id}/alterar-senha")
def alterar_senha(usuario_id: str, request: Request, dados: AlterarSenhaInput, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
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


@router.delete("/usuarios/{usuario_id}", status_code=204)
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


@router.get("/usuarios/{usuario_id}/expediente")
def expediente_usuario(usuario_id: str, db: Session = Depends(get_db)):
    from datetime import datetime as dt
    agora = dt.now(TZ_BRASILIA)
    dia_db = agora.isoweekday() % 7
    hora_atual = agora.time().replace(tzinfo=None)
    regra = db.query(RegraExpediente).filter(RegraExpediente.dia_semana == dia_db).first()
    if not regra:
        return {"configurado": False, "dentro_expediente": True, "hora_inicio": None, "hora_fim": None,
                "hora_atual": agora.strftime("%H:%M"), "excecao_ativa": False, "janela_excecao": None}
    if not regra.ativo:
        pode_ignorar = db.query(MembroGrupoExcecao).join(GrupoExcecao).filter(
            MembroGrupoExcecao.usuario_id == usuario_id,
            GrupoExcecao.status == "ativo",
            GrupoExcecao.ignora_dia_inativo == True,
        ).first()
        if not pode_ignorar:
            return {"configurado": True, "dentro_expediente": False, "bloquear_fora": True,
                    "hora_inicio": None, "hora_fim": None, "hora_atual": agora.strftime("%H:%M"),
                    "excecao_ativa": False, "janela_excecao": None, "dia_inativo": True}
        return {"configurado": True, "dentro_expediente": True, "bloquear_fora": False,
                "hora_inicio": None, "hora_fim": None, "hora_atual": agora.strftime("%H:%M"),
                "excecao_ativa": True, "janela_excecao": None, "dia_inativo": False}
    dentro_base = regra.hora_inicio <= hora_atual <= regra.hora_fim
    grupos = (
        db.query(GrupoExcecao).join(MembroGrupoExcecao, MembroGrupoExcecao.grupo_id == GrupoExcecao.id)
        .filter(MembroGrupoExcecao.usuario_id == usuario_id, GrupoExcecao.status == "ativo", GrupoExcecao.fora_horario == True).all()
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
    return {
        "configurado": True, "dentro_expediente": dentro_base or dentro_excecao,
        "bloquear_fora": regra.bloquear_fora,
        "hora_inicio": regra.hora_inicio.strftime("%H:%M"), "hora_fim": regra.hora_fim.strftime("%H:%M"),
        "hora_atual": agora.strftime("%H:%M"), "excecao_ativa": dentro_excecao, "janela_excecao": janela_excecao,
    }


@router.get("/usuarios/{usuario_id}/minha-home")
def minha_home(usuario_id: str, db: Session = Depends(get_db)):
    acessos = (
        db.query(AcessoWorkspace, EspacoTrabalho)
        .join(EspacoTrabalho, AcessoWorkspace.espaco_trabalho_id == EspacoTrabalho.id)
        .filter(AcessoWorkspace.usuario_id == usuario_id, EspacoTrabalho.status == "ativo").all()
    )
    resultado = []
    for acesso, ws in acessos:
        if acesso.nivel_acesso == "apenas_relatorios":
            ids_permitidos = {r for (r,) in db.query(AcessoRelatorio.relatorio_id).filter(AcessoRelatorio.usuario_id == usuario_id).all()}
            relatorios = db.query(Relatorio).filter(
                Relatorio.espaco_trabalho_id == ws.id, Relatorio.status == "publicado", Relatorio.id.in_(ids_permitidos)
            ).order_by(Relatorio.nome).all()
        else:
            relatorios = db.query(Relatorio).filter(
                Relatorio.espaco_trabalho_id == ws.id, Relatorio.status == "publicado"
            ).order_by(Relatorio.nome).all()
        resultado.append({
            "id": ws.id, "nome": ws.nome, "icone": ws.icone, "cor": ws.cor, "descricao": ws.descricao,
            "nivel_acesso": acesso.nivel_acesso,
            "relatorios": [{"id": r.id, "nome": r.nome, "categoria": r.categoria, "id_relatorio_pbi": r.id_relatorio_pbi} for r in relatorios],
        })
    return resultado


@router.get("/usuarios/{usuario_id}/acessos", response_model=List[AcessoWorkspaceItem])
def listar_acessos_usuario(usuario_id: str, db: Session = Depends(get_db)):
    acessos = (
        db.query(AcessoWorkspace, EspacoTrabalho)
        .join(EspacoTrabalho, AcessoWorkspace.espaco_trabalho_id == EspacoTrabalho.id)
        .filter(AcessoWorkspace.usuario_id == usuario_id, EspacoTrabalho.status == "ativo").all()
    )
    return [AcessoWorkspaceItem(
        espaco_trabalho_id=a.espaco_trabalho_id, nome=ws.nome, icone=ws.icone, cor=ws.cor, nivel_acesso=a.nivel_acesso
    ) for a, ws in acessos]


@router.put("/usuarios/{usuario_id}/acessos")
def salvar_acessos_usuario(usuario_id: str, request: Request, acessos: List[AcessoWorkspaceInput], db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "editar", db)
    if usuario.perfil in PERFIS_ADMIN:
        vincular_admin_workspaces(usuario_id, db)
        registrar_log(db, "acesso", "acessos_workspace", f"Acessos atualizados (admin): {usuario.email}", usuario=autor, request=request)
        db.commit()
        return {"mensagem": "Acessos salvos com sucesso."}
    for item in acessos:
        if item.nivel_acesso not in NIVEIS_VALIDOS:
            raise HTTPException(status_code=422, detail=f"Nível de acesso inválido: {item.nivel_acesso}")
    db.query(AcessoWorkspace).filter(AcessoWorkspace.usuario_id == usuario_id).delete()
    novos = []
    for item in acessos:
        if item.nivel_acesso != "nenhum":
            db.add(AcessoWorkspace(usuario_id=usuario_id, espaco_trabalho_id=item.espaco_trabalho_id, nivel_acesso=item.nivel_acesso))
            novos.append(f"{item.espaco_trabalho_id}={item.nivel_acesso}")
    registrar_log(db, "acesso", "acessos_workspace", f"Acessos atualizados: {usuario.email}",
                  usuario=autor, request=request, valor_novo=json.dumps({"acessos": novos}, ensure_ascii=False))
    db.commit()
    return {"mensagem": "Acessos salvos com sucesso."}


@router.get("/usuarios/{usuario_id}/favoritos", response_model=List[FavoritoItem])
def listar_favoritos(usuario_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Favorito, Relatorio, EspacoTrabalho)
        .join(Relatorio, Favorito.relatorio_id == Relatorio.id)
        .join(EspacoTrabalho, Relatorio.espaco_trabalho_id == EspacoTrabalho.id)
        .filter(Favorito.usuario_id == usuario_id).order_by(Favorito.criado_em.desc()).all()
    )
    return [FavoritoItem(
        relatorio_id=fav.relatorio_id, relatorio_nome=rel.nome, relatorio_status=rel.status,
        id_relatorio_pbi=rel.id_relatorio_pbi, workspace_id=ws.id, workspace_nome=ws.nome,
        workspace_icone=ws.icone, workspace_cor=ws.cor,
        criado_em=fav.criado_em.isoformat() if fav.criado_em else "",
    ) for fav, rel, ws in rows]


@router.post("/usuarios/{usuario_id}/favoritos", status_code=201)
def adicionar_favorito(usuario_id: str, dados: FavoritoCriar, db: Session = Depends(get_db)):
    existente = db.query(Favorito).filter(Favorito.usuario_id == usuario_id, Favorito.relatorio_id == dados.relatorio_id).first()
    if not existente:
        db.add(Favorito(usuario_id=usuario_id, relatorio_id=dados.relatorio_id))
        db.commit()
    return {"mensagem": "Favoritado."}


@router.delete("/usuarios/{usuario_id}/favoritos/{relatorio_id}", status_code=204)
def remover_favorito(usuario_id: str, relatorio_id: str, db: Session = Depends(get_db)):
    fav = db.query(Favorito).filter(Favorito.usuario_id == usuario_id, Favorito.relatorio_id == relatorio_id).first()
    if fav:
        db.delete(fav)
        db.commit()

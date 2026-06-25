from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Departamento
from dependencies import get_usuario_requisicao, exigir_permissao
from services.audit_service import registrar_log
from schemas import DepartamentoItem, DepartamentoCriar, DepartamentoAtualizar

router = APIRouter(prefix="/departamentos", tags=["departamentos"])


@router.get("", response_model=List[DepartamentoItem])
def listar_departamentos(apenas_ativos: bool = True, db: Session = Depends(get_db)):
    q = db.query(Departamento)
    if apenas_ativos:
        q = q.filter(Departamento.ativo == True)
    return q.order_by(Departamento.nome).all()


@router.post("", response_model=DepartamentoItem, status_code=201)
def criar_departamento(request: Request, dados: DepartamentoCriar, db: Session = Depends(get_db)):
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "gerenciar", db)
    if db.query(Departamento).filter(Departamento.nome == dados.nome).first():
        raise HTTPException(status_code=409, detail="Ja existe um departamento com esse nome.")
    dep = Departamento(nome=dados.nome, codigo=dados.codigo, descricao=dados.descricao)
    db.add(dep)
    db.commit()
    db.refresh(dep)
    registrar_log(db, "sistema", "departamentos", f"Departamento criado: {dep.nome}", usuario=autor, request=request)
    db.commit()
    return dep


@router.put("/{dep_id}", response_model=DepartamentoItem)
def atualizar_departamento(dep_id: str, request: Request, dados: DepartamentoAtualizar, db: Session = Depends(get_db)):
    dep = db.query(Departamento).filter(Departamento.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Departamento nao encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "gerenciar", db)
    if dados.nome:
        dep.nome = dados.nome
    if dados.codigo is not None:
        dep.codigo = dados.codigo
    if dados.descricao is not None:
        dep.descricao = dados.descricao
    if dados.ativo is not None:
        dep.ativo = dados.ativo
    db.commit()
    db.refresh(dep)
    registrar_log(db, "sistema", "departamentos", f"Departamento atualizado: {dep.nome}", usuario=autor, request=request)
    db.commit()
    return dep


@router.delete("/{dep_id}", status_code=200)
def desativar_departamento(dep_id: str, request: Request, db: Session = Depends(get_db)):
    dep = db.query(Departamento).filter(Departamento.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Departamento nao encontrado.")
    autor = get_usuario_requisicao(request, db)
    exigir_permissao(autor, "usuarios", "gerenciar", db)
    dep.ativo = False
    db.commit()
    registrar_log(db, "sistema", "departamentos", f"Departamento desativado: {dep.nome}", usuario=autor, request=request)
    db.commit()
    return {"mensagem": "Departamento desativado."}

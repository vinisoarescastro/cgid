from sqlalchemy.orm import Session
from models import Usuario, PermissaoPerfil, UsuarioPacote, PacotePermissaoItem
from constants import PERFIS_SUPER_ADMIN, MODULOS_VALIDOS, ACOES_VALIDAS


def obter_permissoes_efetivas(usuario: Usuario, db: Session) -> dict[str, dict[str, bool]]:
    """
    Retorna todas as permissões efetivas do usuário indexadas por módulo.
    Combina permissões do perfil base com pacotes aditivos em 3 queries fixas.
    """
    if usuario.perfil in PERFIS_SUPER_ADMIN:
        return {m: {a: True for a in ACOES_VALIDAS} for m in MODULOS_VALIDOS}

    permissoes_perfil = {
        pp.modulo: pp
        for pp in db.query(PermissaoPerfil).filter_by(perfil=usuario.perfil).all()
    }

    pacote_ids = [
        up.pacote_id
        for up in db.query(UsuarioPacote).filter_by(usuario_id=usuario.id).all()
    ]
    itens_por_modulo: dict[str, list] = {}
    if pacote_ids:
        for item in db.query(PacotePermissaoItem).filter(
            PacotePermissaoItem.pacote_id.in_(pacote_ids)
        ).all():
            itens_por_modulo.setdefault(item.modulo, []).append(item)

    resultado = {}
    for modulo in MODULOS_VALIDOS:
        pp = permissoes_perfil.get(modulo)
        efetiva = {
            acao: bool(getattr(pp, campo, False)) if pp else False
            for acao, campo in ACOES_VALIDAS.items()
        }
        for item in itens_por_modulo.get(modulo, []):
            for acao, campo in ACOES_VALIDAS.items():
                if not efetiva[acao]:
                    efetiva[acao] = bool(getattr(item, campo, False))
        resultado[modulo] = efetiva

    return resultado


def checar_permissao(usuario: Usuario, modulo: str, acao: str, db: Session) -> bool:
    return obter_permissoes_efetivas(usuario, db).get(modulo, {}).get(acao, False)

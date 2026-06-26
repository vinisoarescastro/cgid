PERFIS_VALIDOS = {"master", "administrador", "coordenador", "colaborador", "convidado"}
PERFIS_ATRIBUIVEIS = {"administrador", "coordenador", "colaborador", "convidado"}
PERFIS_SUPER_ADMIN = {"master"}
PERFIS_ADMIN = {"master", "administrador"}

STATUS_VALIDOS = {"ativo", "inativo", "bloqueado"}

SENHA_PADRAO = "Mudar@123"

MODULOS_VALIDOS = {
    "usuarios", "permissoes", "relatorios", "workspaces",
    "auditoria", "seguranca", "configuracoes", "expediente",
    "grupos_excecao", "landbank", "departamentos",
}

ACOES_VALIDAS = {
    "visualizar": "pode_visualizar",
    "criar":      "pode_criar",
    "editar":     "pode_editar",
    "excluir":    "pode_excluir",
    "exportar":   "pode_exportar",
    "gerenciar":  "pode_gerenciar",
}

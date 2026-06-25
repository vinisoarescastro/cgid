import os
import time
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
import requests as http_requests
from models import ConfiguracaoSistema

_pbi_token_cache: dict = {"token": None, "expires_at": 0}


def pbi_access_token(db: Optional[Session] = None) -> str:
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
            detail="Credenciais do Power BI nao configuradas. Acesse Configuracoes -> Power BI para definir Tenant ID, Client ID e Client Secret.",
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

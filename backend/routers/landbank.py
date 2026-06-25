from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
from database import get_db
from dependencies import get_usuario_requisicao, exigir_permissao

router = APIRouter(tags=["landbank"])

_LB_DIR = Path(__file__).parent.parent / "static" / "landbank"


@router.get("/api/landbank/data")
def landbank_data(request: Request, db: Session = Depends(get_db)):
    usuario = get_usuario_requisicao(request, db)
    if not usuario:
        raise HTTPException(status_code=403, detail="Acesso ao Land Bank não autorizado.")
    exigir_permissao(usuario, "landbank", "visualizar", db)
    data_path = _LB_DIR / "data.json"
    if not data_path.exists():
        raise HTTPException(status_code=503, detail="data.json não encontrado. Execute gerar_data.py.")
    return FileResponse(path=data_path, media_type="application/json",
                        headers={"Cache-Control": "max-age=3600, private"})

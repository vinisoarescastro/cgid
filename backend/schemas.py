from pydantic import BaseModel
from typing import Optional

class LoginInput(BaseModel):
    email: str
    senha: str

class LoginResponse(BaseModel):
    sucesso: bool
    mensagem: str
    usuario: Optional["UsuarioPublico"] = None

class UsuarioPublico(BaseModel):
    id: int
    nome: str
    email: str
    perfil: str
    foto_url: Optional[str] = None

    model_config = {"from_attributes": True}

LoginResponse.model_rebuild()
